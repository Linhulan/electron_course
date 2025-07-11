import { app, dialog, shell } from "electron";
import * as fs from "fs/promises";
import * as path from "path";
import jsPDF from "jspdf";
import ExcelJS from "exceljs";
import { formatAmount, formatCurrency, formatDenomination } from "./utils.js";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => void;
    lastAutoTable: {
      finalY: number;
    };
  }
}

/**
 * 点钞机数据接口 - 用于记录每次点钞的详细信息
 */
interface CounterData {
  id: string;
  no: number; // 记录编号
  timestamp: string;
  currencyCode: string; // 货币代码 (例如: "CNY")
  denomination: number; // 面额
  status: "counting" | "completed" | "error" | "paused"; // 计数状态
  errorCode?: string;
  serialNumber?: string; // 纸币序列号
}

/**
 * 记录不同货币的点钞信息
 */
interface CurrencyCountRecord {
  currencyCode: string; // 货币代码 (例如: "CNY")
  totalCount: number; // 总张数
  totalAmount: number; // 总金额
  errorCount: number; // 错误张数
  denominationBreakdown: Map<number, DenominationDetail>; // 面额分布 Ex. {"CNY": {denomination: 100, count: 5, amount: 500}}
}

// Session数据结构 - 用于记录完整的点钞会话
interface SessionData {
  id: string;
  no: number;
  user?: string; // 用户名 (如果有)
  machineId?: string; // 机器ID (如果有)
  timestamp: string;
  startTime: string;
  endTime?: string;
  machineMode?: string; // 机器模式 (如果有)
  currencyCode?: string; // 货币代码 (例如: "CNY") 用于判断 MIX 模式
  currencyCountRecords?: Map<string, CurrencyCountRecord>; // 记录不同货币的点钞信息, 主要为了兼容MIX模式点钞
  details?: CounterData[]; // 每张点钞记录的详细信息
  status: "counting" | "completed" | "error" | "paused";
  totalCount: number;
  errorCount: number; // 错误张数
  errorCode?: string;

  /* 以下字段标记为废弃, 保留用作兼容----------------------------------- */
  /**
   * @deprecated 请使用 CurrencyCountRecord 替代
   */
  totalAmount?: number;
  /**
   * @deprecated 请使用 CurrencyCountRecord 替代
   */
  denominationBreakdown?: Map<number, DenominationDetail>; // 面额分布
}

// 面额详细信息
interface DenominationDetail {
  denomination: number; // 面额 (例如: 1, 5, 10, 20, 50, 100)
  count: number; // 张数
  amount: number; // 小计金额
}

// 文件管理相关类型定义
export interface FileManagerConfig {
  defaultExportDir: string;
  maxHistoryFiles: number;
  autoCleanOldFiles: boolean;
  cleanupDays: number;
}

export interface ExportFileInfo {
  id: string;
  filename: string;
  filePath: string;
  fileType: "excel" | "pdf";
  size: number;
  createdAt: string;
  sessionCount: number;
}

export interface ExportOptions {
  format?: "excel" | "pdf";
  filename?: string;
  useDefaultDir?: boolean;
  customDir?: string; // 自定义目录路径
  openAfterExport?: boolean;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  fileInfo?: ExportFileInfo;
  error?: string;
}

/**
 * 获取seesionData中的国家列表
 */
export function getCountries(sessionDataList: SessionData[]): string[] {
  const countrySet = new Set<string>();
  sessionDataList.forEach((session) => {
    if (session.currencyCode) {
      countrySet.add(session.currencyCode);
    }
  });
  return Array.from(countrySet);
}

/**
 * 计算不同国家的数量
 * @param sessionDataList - 会话数据列表
 * @returns 国家数量
 */
export function countCountries(sessionDataList: SessionData[]): number {
  return getCountries(sessionDataList).length;
}

/**
 * 文件管理器类 - 负责导出文件的创建、保存和管理
 */
export class FileManager {
  private config: FileManagerConfig;
  private historyFile: string;
  constructor() {
    // 获取项目根目录的 Data 文件夹路径
    // 在开发环境中，使用当前工作目录；在打包后，使用可执行文件目录
    const isDev = process.env.NODE_ENV === "development";
    let projectRoot: string;

    if (isDev) {
      // 开发环境：使用当前工作目录
      projectRoot = process.cwd();
    } else {
      // 生产环境：使用可执行文件的目录
      projectRoot = path.dirname(app.getPath("exe"));
    }

    const dataDir = path.join(projectRoot, "Data");

    this.config = {
      defaultExportDir: dataDir,
      maxHistoryFiles: 50,
      autoCleanOldFiles: true,
      cleanupDays: 30,
    };

    this.historyFile = path.join(dataDir, "export-history.json");
    this.initializeDirectories();
  }
  /**
   * 初始化必要的目录
   */
  private async initializeDirectories(): Promise<void> {
    try {
      console.log("Initializing FileManager directories...");
      console.log("Default export directory:", this.config.defaultExportDir);
      console.log("History file path:", this.historyFile);

      await fs.mkdir(this.config.defaultExportDir, { recursive: true });
      await fs.mkdir(path.dirname(this.historyFile), { recursive: true });

      console.log("FileManager directories initialized successfully");
    } catch (error) {
      console.error("Failed to initialize directories:", error);
    }
  }
  /**
   * 导出 Excel 文件
   */
  async exportExcel(
    sessionData: SessionData[],
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    try {
      const filename = options.filename || this.generateFilename("excel");
      const filePath = await this.getExportPath(filename, "excel", options);

      if (!filePath) {
        return { success: false, error: "User cancelled export" };
      }

      // 生成 Excel 文件 buffer
      const buffer = await this.generateExcelBuffer(sessionData);

      // 保存文件
      await fs.writeFile(filePath, buffer);

      // 获取文件信息
      const stats = await fs.stat(filePath);
      const fileInfo: ExportFileInfo = {
        id: this.generateFileId(),
        filename: path.basename(filePath),
        filePath,
        fileType: "excel",
        size: stats.size,
        createdAt: new Date().toISOString(),
        sessionCount: sessionData.length,
      };

      // 添加到历史记录
      await this.addToHistory(fileInfo);

      // 可选：导出后打开文件
      if (options.openAfterExport) {
        await shell.openPath(filePath);
      }

      return { success: true, filePath, fileInfo };
    } catch (error) {
      console.error("Excel export failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
  /**
   * 导出 PDF 文件
   */
  async exportPDF(
    sessionData: SessionData[],
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    try {
      const filename = options.filename || this.generateFilename("pdf");
      const filePath = await this.getExportPath(filename, "pdf", options);

      if (!filePath) {
        return { success: false, error: "User cancelled export" };
      }

      // 生成 PDF 文件 buffer
      const buffer = await this.generatePDFBuffer(sessionData);

      // 保存文件
      await fs.writeFile(filePath, buffer);

      // 获取文件信息
      const stats = await fs.stat(filePath);
      const fileInfo: ExportFileInfo = {
        id: this.generateFileId(),
        filename: path.basename(filePath),
        filePath,
        fileType: "pdf",
        size: stats.size,
        createdAt: new Date().toISOString(),
        sessionCount: sessionData.length,
      };

      // 添加到历史记录
      await this.addToHistory(fileInfo);

      // 可选：导出后打开文件
      if (options.openAfterExport) {
        await shell.openPath(filePath);
      }

      return { success: true, filePath, fileInfo };
    } catch (error) {
      console.error("PDF export failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 获取导出历史记录
   */
  async getExportHistory(): Promise<ExportFileInfo[]> {
    try {
      const data = await fs.readFile(this.historyFile, "utf-8");
      const history: ExportFileInfo[] = JSON.parse(data);

      // 清理不存在的文件
      const validHistory = await this.cleanupHistory(history);
      return validHistory;
    } catch (error) {
      console.log("No export history found or failed to read:", error);
      return [];
    }
  }

  /**
   * 打开文件
   */
  async openFile(filePath: string): Promise<boolean> {
    try {
      const result = await shell.openPath(filePath);
      return result === "";
    } catch (error) {
      console.error("Failed to open file:", error);
      return false;
    }
  }

  /**
   * 在文件管理器中显示文件
   */
  async showInFolder(filePath: string): Promise<void> {
    shell.showItemInFolder(filePath);
  }

  /**
   * 删除文件
   */
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      await fs.unlink(filePath);
      // 从历史记录中移除
      await this.removeFromHistory(filePath);
      return true;
    } catch (error) {
      console.error("Failed to delete file:", error);
      return false;
    }
  }

  /**
   * 获取默认导出目录
   */
  getDefaultExportDir(): string {
    return this.config.defaultExportDir;
  }

  /**
   * 设置默认导出目录
   */
  async setDefaultExportDir(dirPath: string): Promise<boolean> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      this.config.defaultExportDir = dirPath;
      return true;
    } catch (error) {
      console.error("Failed to set default export directory:", error);
      return false;
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 生成文件名
   */
  private generateFilename(format: "excel" | "pdf"): string {
    const timestamp = new Date().toISOString().split("T")[0];
    const time = new Date().toTimeString().split(" ")[0].replace(/:/g, "-");
    const extension = format === "excel" ? "xlsx" : "pdf";
    return `currency-report-${timestamp}-${time}.${extension}`;
  }

  /**
   * 获取导出路径
   */
  private getExportPath(
    filename: string,
    format: "excel" | "pdf",
    options: { useDefaultDir?: boolean; customDir?: string }
  ): string {
    const { useDefaultDir = true, customDir } = options;

    if (useDefaultDir) {
      return path.join(this.config.defaultExportDir, filename);
    }

    // 如果不使用默认目录，使用自定义目录
    if (customDir) {
      return path.join(customDir, filename);
    }

    // 如果既不使用默认目录也没有自定义目录，则使用默认目录作为后备
    return path.join(this.config.defaultExportDir, filename);

    // 显示保存对话框
    // const result = await dialog.showSaveDialog({
    //   defaultPath: path.join(this.config.defaultExportDir, filename),
    //   filters: [
    //     format === 'excel'
    //       ? { name: 'Excel Files', extensions: ['xlsx'] }
    //       : { name: 'PDF Files', extensions: ['pdf'] }
    //   ]
    // });

    // return result.canceled ? null : result.filePath || null;
  }

  private addPageFooter(
    pdf: jsPDF,
    pageNumber: number,
    totalSessions: number,
    filename: string
  ) {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.setFontSize(9);
    pdf.setTextColor(128, 128, 128);

    pdf.text(`${filename}`, 10, pageHeight - 5);

    const sessionInfo = `Total ${totalSessions} sessions`;
    const textWidth = pdf.getTextWidth(sessionInfo);
    pdf.text(sessionInfo, (pageWidth - textWidth) / 2, pageHeight - 5);

    const pageInfo = `Page ${pageNumber}`;
    const pageTextWidth = pdf.getTextWidth(pageInfo);
    pdf.text(pageInfo, pageWidth - pageTextWidth - 10, pageHeight - 5);

    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.1);
    pdf.line(10, pageHeight - 10, pageWidth - 10, pageHeight - 10);
  }

  /**
   * 生成 Excel buffer - 集成完整的导出逻辑
   */
  private async generateExcelBuffer(
    sessionDataList: SessionData[]
  ): Promise<Buffer> {
    // const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();

    // 设置工作簿属性
    workbook.creator = "Currency Counter";
    workbook.lastModifiedBy = "System";
    workbook.created = new Date();
    workbook.modified = new Date();

    await this.createBanknoteDetailsSheet(workbook, sessionDataList);

    // 创建统一的面额统计工作表（包含所有货币的独立表格）
    await this.createUnifiedDenominationSheet(workbook, sessionDataList);

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }
  /**
   * 生成 PDF buffer - 集成完整的导出逻辑
   */
  private async generatePDFBuffer(
    sessionDataList: SessionData[]
  ): Promise<Buffer> {
    const { jsPDF } = await import("jspdf");
    const { applyPlugin } = await import("jspdf-autotable");
    applyPlugin(jsPDF);
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const filename = this.generateFilename("pdf").replace(".pdf", "");

    // 封面页
    const coverY = 32;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.setTextColor(40, 64, 134);
    pdf.text("Currency Counter Session Report", 105, coverY, {
      align: "center",
    });

    pdf.setFontSize(13);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(120, 120, 120);
    pdf.text("Data Export Overview", 105, coverY + 12, { align: "center" });

    pdf.setDrawColor(40, 64, 134);
    pdf.setLineWidth(1.2);
    pdf.line(60, coverY + 18, 150, coverY + 18);

    pdf.setFontSize(10);
    pdf.setTextColor(110, 110, 110);
    pdf.text(`Export Time: ${new Date().toLocaleString()}`, 105, coverY + 28, {
      align: "center",
    });

    // 统计信息
    let currentY = coverY + 40;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.setTextColor(44, 130, 201);
    pdf.text("Summary Statistics", 15, currentY);

    const totalSessions = sessionDataList.length;
    const totalCount = sessionDataList.reduce(
      (sum, session) => sum + session.totalCount,
      0
    );
    const completedSessions = sessionDataList.filter(
      (s) => s.status === "completed"
    ).length;
    const errorSessions = sessionDataList.filter(
      (s) => s.status === "error"
    ).length;

    pdf.autoTable({
      startY: currentY + 5,
      head: [["Item", "Value", "Unit"]],
      body: [
        ["Total Sessions", totalSessions, ""],
        ["Total Notes", totalCount, "notes"],
        [
          "Total Currency",
          getCountries(sessionDataList).join(", "),
          countCountries(sessionDataList),
        ],
        ["Completed Sessions", completedSessions, ""],
        ["Error Sessions", errorSessions, ""],
      ],
      margin: { left: 15, right: 15 },
      theme: "grid",
      styles: {
        font: "helvetica",
        fontStyle: "normal",
        fontSize: 10,
        cellPadding: 3,
        textColor: 60,
      },
      headStyles: {
        fillColor: [44, 130, 201],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [230, 245, 255] },
    });
    currentY = (pdf as any).lastAutoTable.finalY + 10;

    // 货币统计 (如果有多种货币)
    const currencyStats = this.getCurrencyStats(sessionDataList);
    if (currencyStats.length > 1) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(15);
      pdf.setTextColor(44, 130, 201);
      pdf.text("Currency Distribution", 15, currentY);

      pdf.autoTable({
        startY: currentY + 5,
        head: [["Currency", "Notes", "Amount", "Error Count", "Percentage"]],
        body: currencyStats.map((stat) => [
          stat.currencyCode,
          stat.totalCount,
          formatCurrency(stat.totalAmount, { currency: stat.currencyCode }),
          stat.errorCount,
          `0.00%`, // 简化百分比计算
        ]),
        theme: "striped",
        margin: { left: 15, right: 15 },
        styles: { font: "helvetica", fontSize: 10, cellPadding: 2 },
        headStyles: {
          fillColor: [44, 130, 201],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [245, 250, 255] },
      });
      currentY = (pdf as any).lastAutoTable.finalY + 10;
    }

    // 面额统计 (每个货币单独表格)
    const multiCurrencyDenominationStats =
      this.calculateMultiCurrencyDenominationStats(sessionDataList);

    // 按货币分组
    const currencyGroups = new Map<
      string,
      Array<{
        currencyCode: string;
        denomination: number;
        count: number;
        amount: number;
        percentage: number;
      }>
    >();

    multiCurrencyDenominationStats.forEach((stat) => {
      if (!currencyGroups.has(stat.currencyCode)) {
        currencyGroups.set(stat.currencyCode, []);
      }
      currencyGroups.get(stat.currencyCode)!.push(stat);
    });

    // 为每个货币创建单独的表格
    currencyGroups.forEach((stats, currencyCode) => {
      // 检查是否需要新页面（调整为更小的阈值，因为表格更紧凑）
      if (currentY > 220) {
        pdf.addPage();
        currentY = 20;
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(44, 130, 201);
      pdf.text(`${currencyCode} Currency Statistics`, 15, currentY);

      // 计算合计
      const totalCount = stats.reduce((sum, stat) => sum + stat.count, 0);
      const totalAmount = stats.reduce((sum, stat) => sum + stat.amount, 0);

      // 准备表格数据（包含合计行）
      const tableBody = [
        ...stats.map((stat) => [
          formatDenomination(stat.denomination, {
            currency: stat.currencyCode,
          }),
          stat.count,
          formatAmount(stat.amount, { currency: stat.currencyCode }),
          `${stat.percentage.toFixed(2)}%`,
        ]),
        // 合计行
        [
          "Total",
          totalCount,
          formatAmount(totalAmount, { currency: currencyCode }),
          "100.00%",
        ],
      ];

      pdf.autoTable({
        startY: currentY + 5,
        head: [["Denomination", "Count", "Amount", "Percentage"]],
        body: tableBody,
        theme: "striped",
        margin: { left: 20, right: 20 },
        styles: { font: "helvetica", fontSize: 9, cellPadding: 1.5 },
        headStyles: {
          fillColor: [44, 130, 201],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [245, 250, 255] },
        didParseCell: function (data: any) {
          // 合计行样式
          if (
            data.row.section === "body" &&
            data.row.index === tableBody.length - 1
          ) {
            data.cell.styles.fillColor = [220, 235, 255];
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.textColor = [44, 130, 201];
          }
        },
      });

      currentY = (pdf as any).lastAutoTable.finalY + 15;
    });

    // 会话概览
    pdf.addPage();
    currentY = 15;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.setTextColor(44, 130, 201);
    pdf.text("Session Overview", 15, currentY);

    pdf.autoTable({
      startY: currentY + 5,
      head: [
        [
          "No.",
          "Start Time",
          "Currency",
          "Note Count",
          "Amount",
          "Error Count",
        ],
      ],
      body: sessionDataList.map((session) => {
        const currencyKeys = Array.from(
          session.currencyCountRecords?.keys() || []
        );
        const currencyLen = currencyKeys.length;
        return [
          session.no,
          new Date(session.startTime).toLocaleString(),
          currencyKeys.join(", "),
          session.totalCount,
          currencyLen > 1
            ? "-"
            : formatAmount(session.totalAmount || 0, {
                currency: session.currencyCode,
              }),
          session.errorCount || 0,
        ];
      }),
      theme: "striped",
      margin: { left: 10, right: 10 },
      styles: { font: "helvetica", fontSize: 10, cellPadding: 2 },
      headStyles: {
        fillColor: [40, 64, 134],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [240, 240, 250] },
    });

    // 详细会话信息
    const sessionPageNumbers: number[] = [];
    sessionDataList.forEach((session, idx) => {
      if (currentY > 210 || idx === 0) {
        pdf.addPage();
        currentY = 20;
      }
      const currency_cnt = session.currencyCountRecords
        ? session.currencyCountRecords.size
        : 0;
      sessionPageNumbers.push(pdf.getNumberOfPages());

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(44, 130, 201);
      pdf.text(`Session #${session.no} Details`, 12, currentY);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(60, 60, 60);
      pdf.text(
        `Start: ${session.startTime}   |   Notes: ${
          session.totalCount
        }   |   Amount: ${
          currency_cnt > 1
            ? "-"
            : formatAmount(session.totalAmount || 0, {
                currency: session.currencyCode,
              })
        }   ${session.errorCount ? `|   Errors: ${session.errorCount}` : ""}`,
        12,
        currentY + 7
      );
      currentY += 15;

      // 如果当前Session包含多种货币，在明细表格前添加面额详情展示
      const hasMultipleCurrencies =
        session.currencyCountRecords && session.currencyCountRecords.size > 1;
      const hasRichCurrencyData =
        session.currencyCountRecords && session.currencyCountRecords.size >= 1;

      if (
        hasMultipleCurrencies ||
        (hasRichCurrencyData &&
          session.currencyCountRecords!.size === 1 &&
          session.totalCount > 20)
      ) {
        // 检查是否需要新页面
        if (currentY > 160) {
          pdf.addPage();
          currentY = 20;
        }

        // 为每种货币创建面额详情表格
        session.currencyCountRecords!.forEach((record, currencyCode) => {
          // 检查页面空间
          if (currentY > 200) {
            pdf.addPage();
            currentY = 20;
          }

          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10);
          pdf.setTextColor(52, 73, 94);
          pdf.text(`${currencyCode} Currency Details`, 15, currentY);
          currentY += 3;

          // 准备面额数据
          const denominationData: Array<[string, number, string, string]> = [];
          let totalCount = 0;
          let totalAmount = 0;

          record.denominationBreakdown.forEach((detail, denomination) => {
            const percentage =
              record.totalAmount > 0
                ? (detail.amount / record.totalAmount) * 100
                : 0;
            denominationData.push([
              formatDenomination(denomination, { currency: currencyCode }),
              detail.count,
              formatAmount(detail.amount, { currency: currencyCode }),
              `${percentage.toFixed(1)}%`,
            ]);
            totalCount += detail.count;
            totalAmount += detail.amount;
          });

          // 按面额降序排序
          denominationData.sort((a, b) => {
            const denomA = parseFloat(a[0].replace(/[^0-9.-]/g, ""));
            const denomB = parseFloat(b[0].replace(/[^0-9.-]/g, ""));
            return denomB - denomA;
          });

          // 添加合计行
          denominationData.push([
            "Total",
            totalCount,
            formatAmount(totalAmount, { currency: currencyCode }),
            "100.0%",
          ]);

          pdf.autoTable({
            startY: currentY,
            head: [["Denomination", "Count", "Amount", "Percentage"]],
            body: denominationData,
            theme: "striped",
            margin: { left: 20, right: 20 },
            styles: { font: "helvetica", fontSize: 8, cellPadding: 1 },
            headStyles: {
              fillColor: [52, 73, 94],
              textColor: 255,
              fontStyle: "bold",
            },
            alternateRowStyles: { fillColor: [248, 249, 250] },
            didParseCell: function (data: any) {
              // 合计行样式
              if (
                data.row.section === "body" &&
                data.row.index === denominationData.length - 1
              ) {
                data.cell.styles.fillColor = [220, 235, 255];
                data.cell.styles.fontStyle = "bold";
                data.cell.styles.textColor = [52, 73, 94];
              }
            },
          });

          currentY = (pdf as any).lastAutoTable.finalY + 7;
        });

        currentY += 3; // 在面额详情后留出额外空间，然后显示明细表格
      }

      if (session.details && session.details.length > 0) {
        pdf.autoTable({
          startY: currentY,
          head: [
            [
              "No.",
              "Timestamp",
              "Denomination",
              "Currency",
              "Serial No.",
              "Error Code",
              "Status",
            ],
          ],
          body: session.details.map((detail) => [
            detail.no,
            detail.timestamp,
            formatDenomination(detail.denomination, {
              currency: detail.currencyCode,
            }),
            detail.currencyCode || "-",
            detail.serialNumber || "-",
            detail.errorCode && detail.errorCode !== "E0"
              ? detail.errorCode
              : "-",
            detail.status === "error" ||
            (detail.errorCode && detail.errorCode !== "E0")
              ? "Abnormal"
              : "OK",
          ]),
          styles: { font: "helvetica", fontSize: 9, cellPadding: 1.5 },
          headStyles: {
            fillColor: [44, 130, 201],
            textColor: 255,
            fontStyle: "bold",
          },
          alternateRowStyles: { fillColor: [248, 248, 255] },
          margin: { left: 10, right: 10 },
          showHead: "everyPage",
          theme: "striped",
          didParseCell: function (data: any) {
            if (
              data.row.section === "body" &&
              Array.isArray(data.row.raw) &&
              data.row.raw[6] === "Abnormal"
            ) {
              data.cell.styles.textColor = [220, 53, 69];
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [255, 245, 245];
            }
          },
          didDrawPage: () => {
            this.addPageFooter(
              pdf,
              pdf.getNumberOfPages(),
              sessionDataList.length,
              filename
            );
          },
        });
      }
      currentY = (pdf as any).lastAutoTable.finalY + 8;

      if (currentY > 210 && idx < sessionDataList.length - 1) {
        pdf.addPage();
        currentY = 20;
      }
    });

    // 页脚
    // pdf.setFontSize(10);
    // pdf.setTextColor(120, 120, 120);
    // pdf.text(
    //   `Report generated at ${new Date().toLocaleString()}`,
    //   105,
    //   290,
    //   { align: 'center' }
    // );

    return Buffer.from(pdf.output("arraybuffer"));
  }

  /**
   * 添加到历史记录
   */
  private async addToHistory(fileInfo: ExportFileInfo): Promise<void> {
    try {
      const history = await this.getExportHistory();
      history.unshift(fileInfo);

      // 限制历史记录数量
      if (history.length > this.config.maxHistoryFiles) {
        history.splice(this.config.maxHistoryFiles);
      }

      await fs.writeFile(this.historyFile, JSON.stringify(history, null, 2));
    } catch (error) {
      console.error("Failed to add to history:", error);
    }
  }

  /**
   * 从历史记录中移除
   */
  private async removeFromHistory(filePath: string): Promise<void> {
    try {
      const history = await this.getExportHistory();
      const filteredHistory = history.filter(
        (item) => item.filePath !== filePath
      );
      await fs.writeFile(
        this.historyFile,
        JSON.stringify(filteredHistory, null, 2)
      );
    } catch (error) {
      console.error("Failed to remove from history:", error);
    }
  }

  /**
   * 清理无效的历史记录
   */
  private async cleanupHistory(
    history: ExportFileInfo[]
  ): Promise<ExportFileInfo[]> {
    const validHistory: ExportFileInfo[] = [];

    for (const item of history) {
      try {
        await fs.access(item.filePath);
        validHistory.push(item);
      } catch {
        // 文件不存在，跳过
      }
    }

    // 如果有变化，更新历史文件
    if (validHistory.length !== history.length) {
      await fs.writeFile(
        this.historyFile,
        JSON.stringify(validHistory, null, 2)
      );
    }

    return validHistory;
  }

  /**
   * 生成文件 ID
   */
  private generateFileId(): string {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ==================== Excel 生成辅助方法 ====================

  /**
   * 获取状态文本
   */
  private getStatusText(status: SessionData["status"]): string {
    switch (status) {
      case "counting":
        return "Counting";
      case "completed":
        return "Completed";
      case "error":
        return "Error";
      case "paused":
        return "Paused";
      default:
        return "Unknown";
    }
  }

  /**
   * 创建摘要工作表 - 美化版本，与PDF样式保持一致
   */
  private async createSummarySheet(
    workbook: ExcelJS.Workbook,
    sessionDataList: SessionData[]
  ): Promise<void> {
    const worksheet = workbook.addWorksheet("📊 Summary Statistics");

    // 计算统计数据
    const totalSessions = sessionDataList.length;
    const totalCount = sessionDataList.reduce(
      (sum, session) => sum + session.totalCount,
      0
    );

    // 计算总金额（支持多货币）
    let primaryCurrency = "CNY";
    const currencyStats = this.getCurrencyStats(sessionDataList);
    if (currencyStats.length > 0) {
      primaryCurrency = currencyStats[0].currencyCode; // 使用金额最大的货币作为主货币
    }

    // 获取货币信息
    const currencies = getCountries(sessionDataList);
    const currencyCount = countCountries(sessionDataList);
    const currencyDisplay =
      currencyCount > 1
        ? `${currencies.join(", ")} (${currencyCount} types)`
        : currencies[0] || primaryCurrency;

    // 设置主标题区域
    let currentRow = 1;

    // 主标题
    const titleCell = worksheet.getCell(currentRow, 1);
    titleCell.value = "Summary Statistics";
    titleCell.font = {
      bold: true,
      size: 18,
      color: { argb: "FFFFFFFF" },
      name: "Calibri",
    };
    titleCell.fill = {
      type: "gradient",
      gradient: "angle",
      degree: 90,
      stops: [
        { position: 0, color: { argb: "FF2C82C9" } }, // RGB(44,130,201)
        { position: 1, color: { argb: "FF3498DB" } },
      ],
    };
    titleCell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: false,
    };
    titleCell.border = {
      top: { style: "medium", color: { argb: "FF2C82C9" } },
      left: { style: "medium", color: { argb: "FF2C82C9" } },
      bottom: { style: "medium", color: { argb: "FF2C82C9" } },
      right: { style: "medium", color: { argb: "FF2C82C9" } },
    };
    worksheet.mergeCells(currentRow, 1, currentRow, 3);
    worksheet.getRow(currentRow).height = 35;
    currentRow += 2; // 留出间距

    // 设置列定义
    worksheet.columns = [
      { header: "📋 Item", key: "item", width: 25 },
      { header: "📈 Value", key: "value", width: 25 },
    ];

    // 表头行
    const headerRow = worksheet.getRow(currentRow);
    headerRow.values = ["📋 Item", "📈 Value"];
    headerRow.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 12,
      name: "Calibri",
    };
    headerRow.height = 28;

    // 设置表头样式
    headerRow.eachCell((cell: ExcelJS.Cell, colNumber: number) => {
      if (colNumber <= 3) {
        cell.fill = {
          type: "gradient",
          gradient: "angle",
          degree: 90,
          stops: [
            { position: 0, color: { argb: "FF2C82C9" } },
            { position: 1, color: { argb: "FF3498DB" } },
          ],
        };
        cell.border = {
          top: { style: "medium", color: { argb: "FF2C82C9" } },
          left: { style: "thin", color: { argb: "FF85C1E9" } },
          bottom: { style: "medium", color: { argb: "FF2C82C9" } },
          right: { style: "thin", color: { argb: "FF85C1E9" } },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: false,
        };
      }
    });
    currentRow++;

    // 准备数据
    const summaryData = [
      { item: "📊 Total Sessions", value: totalSessions },
      { item: "📝 Total Notes", value: totalCount },
      { item: "🌍 Total Currency", value: currencyDisplay },
    ];

    // 添加数据行
    summaryData.forEach((data, index) => {
      const dataRow = worksheet.getRow(currentRow);
      dataRow.values = [data.item, data.value];
      dataRow.height = 24;

      const isEvenRow = index % 2 === 0;

      dataRow.eachCell((cell: ExcelJS.Cell, colNumber: number) => {
        if (colNumber <= 3) {
          // 交替行颜色 - 与PDF的alternateRowStyles保持一致
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: isEvenRow ? "FFE6F5FF" : "FFFFFFFF" }, // 浅蓝色交替
          };

          // 精细边框
          cell.border = {
            top: { style: "thin", color: { argb: "FFD0D0D0" } },
            left: { style: "thin", color: { argb: "FFD0D0D0" } },
            bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
            right: { style: "thin", color: { argb: "FFD0D0D0" } },
          };

          // 字体设置
          cell.font = {
            name: "Calibri",
            size: 11,
            color: { argb: "FF3C3C3C" }, // 与PDF的textColor: 60保持一致
          };

          // 根据列内容设置对齐方式
          if (colNumber === 1) {
            // Item
            cell.alignment = {
              vertical: "middle",
              horizontal: "left",
              indent: 1,
            };
            cell.font = { ...cell.font, bold: true };
          } else if (colNumber === 2) {
            // Value
            cell.alignment = { vertical: "middle", horizontal: "center" };
            cell.font = { ...cell.font, bold: true };
          } else {
            // Unit
            cell.alignment = { vertical: "middle", horizontal: "center" };
          }
        }
      });
      currentRow++;
    });

    // 工作表设置
    worksheet.views = [
      {
        state: "frozen",
        xSplit: 0,
        ySplit: currentRow - summaryData.length - 1, // 冻结表头
        topLeftCell: "A1",
        activeCell: "A1",
      },
    ];

    // 设置打印属性
    worksheet.pageSetup = {
      paperSize: 9, // A4
      orientation: "portrait",
      horizontalCentered: true,
      verticalCentered: true,
      margins: {
        left: 0.7,
        right: 0.7,
        top: 0.75,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3,
      },
    };
  }

  /**
   * 创建详细信息工作表
   */
  private async createDetailSheet(
    workbook: ExcelJS.Workbook,
    sessionDataList: SessionData[]
  ): Promise<void> {
    const worksheet = workbook.addWorksheet("Details");

    worksheet.columns = [
      { header: "Session ID", key: "id", width: 20 },
      { header: "Session No.", key: "no", width: 12 },
      { header: "Start Time", key: "startTime", width: 20 },
      { header: "End Time", key: "endTime", width: 20 },
      { header: "Status", key: "status", width: 12 },
      { header: "Total Count", key: "totalCount", width: 12 },
      { header: "Total Amount", key: "totalAmount", width: 12 },
      { header: "Error Count", key: "errorCount", width: 10 },
      { header: "Machine Mode", key: "machineMode", width: 12 },
    ];

    sessionDataList.forEach((session) => {
      worksheet.addRow({
        id: session.id,
        no: session.no,
        startTime: session.startTime,
        endTime: session.endTime || "-",
        status: this.getStatusText(session.status),
        totalCount: session.totalCount,
        totalAmount: (session.totalAmount || 0).toFixed(2),
        errorCount: session.errorCount,
        machineMode: session.machineMode || "-",
      });
    });

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // 状态列条件格式
    worksheet.getColumn("status").eachCell((cell: any, rowNumber: number) => {
      if (rowNumber > 1) {
        const status = cell.value as string;
        if (status === "Completed") {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE6FFE6" },
          };
        } else if (status === "Error") {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFE6E6" },
          };
        }
      }
    });
  }

  /**
   * 创建统一的面额统计工作表（所有货币在一个Sheet中，每个货币独立表格）
   */
  private async createUnifiedDenominationSheet(
    workbook: ExcelJS.Workbook,
    sessionDataList: SessionData[]
  ): Promise<void> {
    const worksheet = workbook.addWorksheet("Denomination Statistics");
    const multiCurrencyDenominationStats =
      this.calculateMultiCurrencyDenominationStats(sessionDataList);

    // 按货币分组
    const currencyGroups = new Map<
      string,
      Array<{
        currencyCode: string;
        denomination: number;
        count: number;
        amount: number;
        percentage: number;
      }>
    >();

    multiCurrencyDenominationStats.forEach((stat) => {
      if (!currencyGroups.has(stat.currencyCode)) {
        currencyGroups.set(stat.currencyCode, []);
      }
      currencyGroups.get(stat.currencyCode)!.push(stat);
    });

    let currentRow = 1;

    // 为每个货币创建独立的表格区域
    currencyGroups.forEach((stats, currencyCode) => {
      // 添加额外间距（除了第一个表格）
      if (currentRow > 1) {
        currentRow += 1;
      }

      // 主标题 - 更加醒目的设计
      const titleCell = worksheet.getCell(currentRow, 1);
      titleCell.value = `💰 ${currencyCode} Currency Statistics`;
      titleCell.font = {
        bold: true,
        size: 16,
        color: { argb: "FFFFFFFF" },
        name: "Calibri",
      };
      titleCell.fill = {
        type: "gradient",
        gradient: "angle",
        degree: 90,
        stops: [
          { position: 0, color: { argb: "FF1B4F72" } },
          { position: 1, color: { argb: "FF2874A6" } },
        ],
      };
      titleCell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: false,
      };
      titleCell.border = {
        top: { style: "medium", color: { argb: "FF1B4F72" } },
        left: { style: "medium", color: { argb: "FF1B4F72" } },
        bottom: { style: "medium", color: { argb: "FF1B4F72" } },
        right: { style: "medium", color: { argb: "FF1B4F72" } },
      };
      worksheet.mergeCells(currentRow, 1, currentRow, 4);
      worksheet.getRow(currentRow).height = 30;
      currentRow += 1;

      // 表头 - 专业的渐变设计
      const headerRow = worksheet.getRow(currentRow);
      headerRow.values = [
        "💸 Denomination",
        "📊 Count",
        "💵 Amount",
        "📈 Percentage",
      ];
      headerRow.font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
        size: 11,
        name: "Calibri",
      };
      headerRow.height = 25;

      // 设置表头样式
      headerRow.eachCell((cell: any, colNumber: number) => {
        if (colNumber <= 4) {
          cell.fill = {
            type: "gradient",
            gradient: "angle",
            degree: 90,
            stops: [
              { position: 0, color: { argb: "FF1B4F72" } },
              { position: 1, color: { argb: "FF3498DB" } },
            ],
          };
          cell.border = {
            top: { style: "medium", color: { argb: "FF1B4F72" } },
            left: { style: "thin", color: { argb: "FF85C1E9" } },
            bottom: { style: "medium", color: { argb: "FF1B4F72" } },
            right: { style: "thin", color: { argb: "FF85C1E9" } },
          };
          cell.alignment = {
            vertical: "middle",
            horizontal: "center",
            wrapText: false,
          };
        }
      });
      currentRow++;

      // 添加面额数据 - 交替行颜色和精美样式
      stats.forEach((stat, statIndex) => {
        const dataRow = worksheet.getRow(currentRow);
        dataRow.values = [
          formatDenomination(stat.denomination, {
            currency: stat.currencyCode,
          }),
          stat.count,
          formatCurrency(stat.amount, { currency: stat.currencyCode }),
          `${stat.percentage.toFixed(2)}%`,
        ];
        dataRow.height = 22;

        // 设置数据行样式 - 交替背景色
        const isEvenRow = statIndex % 2 === 0;
        dataRow.eachCell((cell: any, colNumber: number) => {
          if (colNumber <= 4) {
            // 交替行颜色
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: isEvenRow ? "FFFBFCFD" : "FFF8F9FA" },
            };

            // 精细边框
            cell.border = {
              top: { style: "thin", color: { argb: "FFE5E8EC" } },
              left: { style: "thin", color: { argb: "FFE5E8EC" } },
              bottom: { style: "thin", color: { argb: "FFE5E8EC" } },
              right: { style: "thin", color: { argb: "FFE5E8EC" } },
            };

            // 字体和对齐
            cell.font = {
              name: "Calibri",
              size: 10,
              color: { argb: "FF2C3E50" },
            };

            // 根据列内容设置对齐方式
            if (colNumber === 1) {
              // Denomination
              cell.alignment = {
                vertical: "middle",
                horizontal: "left",
                indent: 1,
              };
              cell.font = { ...cell.font, bold: true };
            } else if (colNumber === 2 || colNumber === 4) {
              // Count, Percentage
              cell.alignment = { vertical: "middle", horizontal: "center" };
            } else {
              // Amount
              cell.alignment = {
                vertical: "middle",
                horizontal: "right",
                indent: 1,
              };
            }
          }
        });
        currentRow++;
      });

      // 计算合计
      const totalCount = stats.reduce((sum, stat) => sum + stat.count, 0);
      const totalAmount = stats.reduce((sum, stat) => sum + stat.amount, 0);

      // 添加合计行 - 特殊的高亮设计
      const totalRow = worksheet.getRow(currentRow);
      totalRow.values = [
        "🎯 Total",
        totalCount,
        formatCurrency(totalAmount, { currency: currencyCode }),
        "100.00%",
      ];
      totalRow.height = 28;

      // 设置合计行样式 - 渐变和特殊效果
      totalRow.eachCell((cell: any, colNumber: number) => {
        if (colNumber <= 4) {
          cell.fill = {
            type: "gradient",
            gradient: "angle",
            degree: 90,
            stops: [
              { position: 0, color: { argb: "FFE8F4FD" } },
              { position: 1, color: { argb: "FFDBEAFE" } },
            ],
          };
          cell.font = {
            bold: true,
            color: { argb: "FF1B4F72" },
            size: 11,
            name: "Calibri",
          };
          cell.border = {
            top: { style: "medium", color: { argb: "FF2874A6" } },
            left: { style: "thin", color: { argb: "FF2874A6" } },
            bottom: { style: "medium", color: { argb: "FF2874A6" } },
            right: { style: "thin", color: { argb: "FF2874A6" } },
          };

          // 根据列内容设置对齐方式
          if (colNumber === 1) {
            // Total label
            cell.alignment = {
              vertical: "middle",
              horizontal: "left",
              indent: 1,
            };
          } else if (colNumber === 2 || colNumber === 4) {
            // Count, Percentage
            cell.alignment = { vertical: "middle", horizontal: "center" };
          } else {
            // Amount
            cell.alignment = {
              vertical: "middle",
              horizontal: "right",
              indent: 1,
            };
          }
        }
      });
      currentRow += 2; // 在表格之间留出更多空隙
    });

    // 设置列宽 - 优化的比例和宽度
    worksheet.getColumn(1).width = 18; // Denomination - 更宽以容纳图标和货币符号
    worksheet.getColumn(2).width = 12; // Count - 适中宽度
    worksheet.getColumn(3).width = 20; // Amount - 更宽以显示完整金额
    worksheet.getColumn(4).width = 14; // Percentage - 适中宽度

    // 添加工作表级别的格式设置
    worksheet.views = [
      {
        state: "frozen",
        xSplit: 0,
        ySplit: 0,
        topLeftCell: "A1",
        activeCell: "A1",
      },
    ];

    // 设置打印属性
    worksheet.pageSetup = {
      paperSize: 9, // A4
      orientation: "portrait",
      horizontalCentered: true,
      verticalCentered: false,
      margins: {
        left: 0.7,
        right: 0.7,
        top: 0.75,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3,
      },
    };
  }

  /**
   * 创建纸币详细信息工作表 - 美化版本
   */
  private async createBanknoteDetailsSheet(
    workbook: ExcelJS.Workbook,
    sessionDataList: SessionData[]
  ): Promise<void> {
    const worksheet = workbook.addWorksheet("💵 Banknote Details");

    // 设置列定义
    worksheet.columns = [
      { header: "🆔 Session ID", key: "sessionId", width: 20 },
      { header: "📝 Note No.", key: "noteNo", width: 8 },
      { header: "⏰ Timestamp", key: "timestamp", width: 18 },
      { header: "💸 Denomination", key: "denomination", width: 12 },
      { header: "🌍 Currency", key: "currencyCode", width: 10 },
      { header: "🔍 Serial Number", key: "serialNumber", width: 22 },
      { header: "⚠️ Error Code", key: "errorCode", width: 10 },
      { header: "✅ Status", key: "status", width: 8 },
    ];

    const allBanknoteDetails: Array<{
      sessionId: string;
      noteNo: number;
      timestamp: string;
      denomination: string;
      currencyCode: string;
      serialNumber: string;
      errorCode: string;
      status: string;
    }> = [];

    sessionDataList.forEach((session) => {
      if (session.details && session.details.length > 0) {
        session.details.forEach((detail) => {
          allBanknoteDetails.push({
            sessionId: session.id,
            noteNo: detail.no,
            timestamp: detail.timestamp,
            denomination: formatDenomination(detail.denomination, {
              currency: detail.currencyCode,
            }),
            currencyCode: detail.currencyCode || "-",
            serialNumber: detail.serialNumber || "-",
            errorCode:
              detail.errorCode && detail.errorCode !== "E0"
                ? detail.errorCode
                : "-",
            status:
              detail.status === "error" ||
              (detail.errorCode && detail.errorCode !== "E0")
                ? "Error"
                : "OK",
          });
        });
      }
    });

    worksheet.addRows(allBanknoteDetails);

    // 设置默认行高
    // 注意：ExcelJS中已明确设置每行高度的情况下，defaultRowHeight不会生效

    // 美化标题行 - 渐变蓝色主题
    const headerRow = worksheet.getRow(1);
    headerRow.height = 32;
    headerRow.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 11,
      name: "Calibri",
    };

    headerRow.eachCell((cell: any, colNumber: number) => {
      if (colNumber <= 8) {
        cell.fill = {
          type: "gradient",
          gradient: "angle",
          degree: 90,
          stops: [
            { position: 0, color: { argb: "FF1B4F72" } },
            { position: 1, color: { argb: "FF3498DB" } },
          ],
        };
        cell.border = {
          top: { style: "medium", color: { argb: "FF1B4F72" } },
          left: { style: "thin", color: { argb: "FF85C1E9" } },
          bottom: { style: "medium", color: { argb: "FF1B4F72" } },
          right: { style: "thin", color: { argb: "FF85C1E9" } },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: false,
        };
      }
    });

    // 美化数据行 - 交替背景色和精细样式
    allBanknoteDetails.forEach((_, index) => {
      const rowNumber = index + 2; // 从第2行开始（第1行是表头）
      const dataRow = worksheet.getRow(rowNumber);
      const isEvenRow = index % 2 === 0;

      // 设置行高
      dataRow.height = 22;

      dataRow.eachCell((cell: any, colNumber: number) => {
        if (colNumber <= 8) {
          // 交替行颜色
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: isEvenRow ? "FFFBFCFD" : "FFF8F9FA" },
          };

          // 精细边框
          cell.border = {
            top: { style: "thin", color: { argb: "FFE5E8EC" } },
            left: { style: "thin", color: { argb: "FFE5E8EC" } },
            bottom: { style: "thin", color: { argb: "FFE5E8EC" } },
            right: { style: "thin", color: { argb: "FFE5E8EC" } },
          };

          // 字体设置
          cell.font = {
            name: "Calibri",
            size: 10,
            color: { argb: "FF2C3E50" },
          };

          // 根据列内容设置对齐方式和特殊样式
          if (colNumber === 1 || colNumber === 2) {
            // Session ID, Note No
            cell.alignment = { vertical: "middle", horizontal: "center" };
            cell.font = { ...cell.font, bold: true };
          } else if (colNumber === 3) {
            // Timestamp
            cell.alignment = {
              vertical: "middle",
              horizontal: "left",
              indent: 1,
            };
            cell.font = { ...cell.font, size: 9 };
          } else if (colNumber === 4 || colNumber === 5) {
            // Denomination, Currency
            cell.alignment = { vertical: "middle", horizontal: "left" };
            cell.font = { ...cell.font, bold: true };
          } else if (colNumber === 6) {
            // Serial Number - 简单优化：等宽字体和加粗
            cell.alignment = {
              vertical: "middle",
              horizontal: "left",
              indent: 1,
            };
            cell.font = {
              name: "Consolas", // 等宽字体便于读取冠字号
              size: 10,
              bold: true,
              color: { argb: "FF2C3E50" },
            };
          } else if (colNumber === 7) {
            // Error Code
            cell.alignment = { vertical: "middle", horizontal: "center" };
            // 错误代码特殊颜色
            if (cell.value && cell.value !== "-") {
              cell.font = {
                ...cell.font,
                bold: true,
                color: { argb: "FFDC3545" },
              };
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFFF5F5" },
              };
            }
          } else if (colNumber === 8) {
            // Status
            cell.alignment = { vertical: "middle", horizontal: "center" };
            cell.font = { ...cell.font, bold: true };
          }
        }
      });
    });

    // 状态列特殊条件格式 - 增强版
    worksheet.getColumn("status").eachCell((cell: any, rowNumber: number) => {
      if (rowNumber > 1) {
        const status = cell.value as string;
        if (status === "OK") {
          cell.fill = {
            type: "gradient",
            gradient: "angle",
            degree: 90,
            stops: [
              { position: 0, color: { argb: "FFE8F5E8" } },
              { position: 1, color: { argb: "FFD4F3D4" } },
            ],
          };
          cell.font = {
            bold: true,
            color: { argb: "FF28A745" },
            name: "Calibri",
            size: 10,
          };
          cell.border = {
            ...cell.border,
            top: { style: "thin", color: { argb: "FF28A745" } },
            bottom: { style: "thin", color: { argb: "FF28A745" } },
          };
        } else if (status === "Error") {
          cell.fill = {
            type: "gradient",
            gradient: "angle",
            degree: 90,
            stops: [
              { position: 0, color: { argb: "FFFEF2F2" } },
              { position: 1, color: { argb: "FFFECACA" } },
            ],
          };
          cell.font = {
            bold: true,
            color: { argb: "FFDC3545" },
            name: "Calibri",
            size: 10,
          };
          cell.border = {
            ...cell.border,
            top: { style: "thin", color: { argb: "FFDC3545" } },
            bottom: { style: "thin", color: { argb: "FFDC3545" } },
          };
        }
      }
    });

    // 启用自动筛选和高级功能
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: allBanknoteDetails.length + 1, column: 8 },
    };

    // 冻结首行（表头）
    worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

    // 设置打印选项
    worksheet.pageSetup = {
      paperSize: 9, // A4
      orientation: "landscape", // 横向打印
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.5,
        right: 0.5,
        top: 0.75,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3,
      },
    };

    // 设置打印标题（每页都显示表头）
    worksheet.pageSetup.printTitlesRow = "1:1";
  }

  /**
   * 从Excel文件导入SessionData[]
   * @param filePath Excel文件路径（可选，如果不提供则打开文件选择对话框）
   * @param options 导入选项
   */
  async importFromExcel(
    filePath?: string,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    try {
      let filePaths: string[] = [];
      // 如果没有提供文件路径，打开文件选择对话框
      if (!filePath) {
        const result = await dialog.showOpenDialog({
          title: "Select Excel File to Import",
          defaultPath: this.config.defaultExportDir,
          filters: [
            { name: "Excel Files", extensions: ["xlsx", "xls"] },
            { name: "All Files", extensions: ["*", "xlsx", "xls"] },
          ],
          properties: ["openFile", "multiSelections"],
        });

        if (result.canceled || !result.filePaths.length) {
          return {
            success: false,
            cancelled: true,
            errors: ["User cancelled import"],
          };
        }

        filePaths = result.filePaths;
      }

      // 读取并解析Excel文件
      const importResult = await this.processMultipleExcelFiles(filePaths, options);

      return importResult;
    } catch (error) {
      console.error("Excel import failed:", error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }

  /**
   * 批量导入指定目录下的Excel文件
   * @param directory 目录路径（可选，默认使用defaultExportDir）
   * @param options 导入选项
   */
  async importFromDirectory(
    directory?: string,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    const targetDir = directory || this.config.defaultExportDir;

    // 扫描目录中的Excel文件
    const excelFiles = await this.scanExcelFiles(
      targetDir,
      options.filePattern
    );

    if (excelFiles.length === 0) {
      return {
        success: false,
        errors: ["No Excel files found in the specified directory"],
      };
    }

    return this.processMultipleExcelFiles(excelFiles, options);
  }

  /**
   * 解析单个Excel文件
   */
  private async parseExcelFile(
    filePath: string,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    try {
      if ( filePath && !filePath.endsWith(".xlsx") && !filePath.endsWith(".xls")) {
        return {
          success: false,
          errors: ["Invalid file format. Please select an Excel file."],
        };
      }

      // 验证文件是否存在
      await fs.access(filePath);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      // 查找必要的工作表
      const banknoteSheet = this.findWorksheet(workbook, [
        "💵 Banknote Details",
        "Banknote Details",
      ]);

      if (!banknoteSheet) {
        return {
          success: false,
          errors: ['Required "Banknote Details" worksheet not found'],
        };
      }

      // 解析纸币详细数据
      const sessionData = await this.parseBanknoteDetailsSheet(banknoteSheet);

      // 可选：验证数据
      if (options.validateData !== false) {
        const validationErrors = this.validateImportedData(sessionData);
        if (validationErrors.length > 0) {
          return {
            success: false,
            errors: validationErrors,
          };
        }
      }

      return {
        success: true,
        sessionData,
        importedCount: sessionData.length,
        skippedCount: 0,
        errorCount: 0,
        filePath,
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          error instanceof Error ? error.message : "Failed to parse Excel file",
        ],
      };
    }
  }

  /**
   * 处理多个Excel文件
   */
  private async processMultipleExcelFiles(
    filePaths: string[],
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    if (filePaths.length === 0) {
      return {
        success: false,
        errors: ["No Excel files found in the specified directory"],
      };
    }

    const allSessionData: SessionData[] = [];
    const importedFiles: ImportedFileInfo[] = [];
    const errors: string[] = [];
    let totalImported = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // 逐个处理Excel文件
    for (const filePath of filePaths) {
      try {
        const result = await this.parseExcelFile(filePath, options);

        if (result.success && result.sessionData) {
          allSessionData.push(...result.sessionData);
          totalImported += result.importedCount || 0;
          totalSkipped += result.skippedCount || 0;

          importedFiles.push({
            filePath,
            filename: path.basename(filePath),
            sessionCount: result.sessionData.length,
            importedAt: new Date().toISOString(),
            fileSize: (await fs.stat(filePath)).size,
            isValid: true,
          });
        } else {
          totalErrors++;
          errors.push(
            ...(result.errors || [
              `Failed to import ${path.basename(filePath)}`,
            ])
          );

          importedFiles.push({
            filePath,
            filename: path.basename(filePath),
            sessionCount: 0,
            importedAt: new Date().toISOString(),
            fileSize: (await fs.stat(filePath)).size,
            isValid: false,
            errors: result.errors,
          });
        }
      } catch (error) {
        totalErrors++;
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        errors.push(`Error processing ${path.basename(filePath)}: ${errorMsg}`);
      }
    }

    // 如果启用了跳过重复项，需要去重
    const finalSessionData = options.skipDuplicates
      ? this.removeDuplicateSessions(allSessionData)
      : allSessionData;

    return {
      success: finalSessionData.length > 0,
      sessionData: finalSessionData,
      importedCount: totalImported,
      skippedCount: totalSkipped,
      errorCount: totalErrors,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * 扫描目录中的Excel文件
   */
  private async scanExcelFiles(
    directory: string,
    pattern?: string
  ): Promise<string[]> {
    try {
      const files = await fs.readdir(directory);
      const excelFiles: string[] = [];

      for (const file of files) {
        const filePath = path.join(directory, file);
        const stats = await fs.stat(filePath);

        if (stats.isFile()) {
          const ext = path.extname(file).toLowerCase();
          if ([".xlsx", ".xls"].includes(ext)) {
            // 应用文件名模式过滤
            if (!pattern || this.matchesPattern(file, pattern)) {
              excelFiles.push(filePath);
            }
          }
        }
      }

      return excelFiles.sort();
    } catch (error) {
      console.error("Failed to scan directory:", error);
      return [];
    }
  }

  /**
   * 查找指定名称的工作表
   */
  private findWorksheet(
    workbook: ExcelJS.Workbook,
    names: string[]
  ): ExcelJS.Worksheet | null {
    for (const name of names) {
      const worksheet = workbook.getWorksheet(name);
      if (worksheet) {
        return worksheet;
      }
    }
    return null;
  }

  /**
   * 解析纸币详细信息工作表
   */
  private async parseBanknoteDetailsSheet(
    worksheet: ExcelJS.Worksheet
  ): Promise<SessionData[]> {
    const sessionMap = new Map<string, SessionData>();
    const headerRow = worksheet.getRow(1);

    // 动态识别列索引
    const columnMapping = this.identifyColumns(headerRow);

    // 遍历数据行（跳过标题行）
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // 跳过标题行

      try {
        const rowData = this.parseDetailRow(row, columnMapping);
        if (!rowData) return;

        // 获取或创建Session
        let session = sessionMap.get(rowData.sessionId);
        if (!session) {
          session = this.createSessionFromFirstDetail(rowData);
          sessionMap.set(rowData.sessionId, session);
        }

        // 添加详细记录
        session.details = session.details || [];
        session.details.push(rowData.detail);

        // 更新Session统计
        this.updateSessionStats(session, rowData.detail);
      } catch (error) {
        console.warn(`Error parsing row ${rowNumber}:`, error);
      }
    });

    // 转换为数组并完成最终处理
    const sessions = Array.from(sessionMap.values());

    // 为每个Session重建面额分布和货币记录
    sessions.forEach((session) => {
      this.rebuildSessionAggregations(session);
    });

    return sessions;
  }

  /**
   * 识别Excel列的映射关系
   */
  private identifyColumns(headerRow: ExcelJS.Row): Map<string, number> {
    const mapping = new Map<string, number>();

    headerRow.eachCell((cell, colNumber) => {
      const value = cell.value?.toString().toLowerCase() || "";

      // 识别各种可能的列名变体
      if (value.includes("session") && value.includes("id")) {
        mapping.set("sessionId", colNumber);
      } else if (value.includes("note") && value.includes("no")) {
        mapping.set("noteNo", colNumber);
      } else if (value.includes("timestamp") || value.includes("time")) {
        mapping.set("timestamp", colNumber);
      } else if (value.includes("denomination") || value.includes("amount")) {
        mapping.set("denomination", colNumber);
      } else if (value.includes("currency")) {
        mapping.set("currencyCode", colNumber);
      } else if (value.includes("serial")) {
        mapping.set("serialNumber", colNumber);
      } else if (value.includes("error")) {
        mapping.set("errorCode", colNumber);
      } else if (value.includes("status")) {
        mapping.set("status", colNumber);
      }
    });

    return mapping;
  }

  /**
   * 解析详细记录行
   */
  private parseDetailRow(
    row: ExcelJS.Row,
    columnMapping: Map<string, number>
  ): { sessionId: string; detail: CounterData } | null {
    try {
      const sessionId = this.getCellValue(
        row,
        columnMapping.get("sessionId")
      ) as string;
      const noteNo = this.getCellValue(
        row,
        columnMapping.get("noteNo")
      ) as string;
      const timestamp = this.getCellValue(
        row,
        columnMapping.get("timestamp")
      ) as string;
      const denomination = this.getCellValue(
        row,
        columnMapping.get("denomination")
      ) as number;
      const currencyCode = this.getCellValue(
        row,
        columnMapping.get("currencyCode")
      ) as string;
      const serialNumber = this.getCellValue(
        row,
        columnMapping.get("serialNumber")
      ) as string;
      const errorCode = this.getCellValue(
        row,
        columnMapping.get("errorCode")
      ) as string;
      const status = this.getCellValue(
        row,
        columnMapping.get("status")
      ) as string;

      // 必需字段验证
      if (!sessionId || !noteNo || !timestamp) {
        return null;
      }

      // 解析面额值（移除货币符号）
      const parsedDenomination = this.parseDenomination(denomination);

      const detail: CounterData = {
        id: sessionId + noteNo, // 生成临时唯一ID，避免精度丢失
        no: parseInt(noteNo.toString()) || 0,
        timestamp: timestamp.toString(),
        currencyCode: currencyCode?.toString() || "-",
        denomination: parsedDenomination,
        status: this.parseStatus(status?.toString()),
        errorCode:
          errorCode && errorCode !== "-" ? errorCode.toString() : undefined,
        serialNumber:
          serialNumber && serialNumber !== "-"
            ? serialNumber.toString()
            : undefined,
      };

      return {
        sessionId: sessionId.toString(),
        detail,
      };
    } catch (error) {
      console.warn("Error parsing detail row:", error);
      return null;
    }
  }
  /**
   * 从第一条详细记录创建Session
   */
  private createSessionFromFirstDetail(rowData: {
    sessionId: string;
    detail: CounterData;
  }): SessionData {
    return {
      id: rowData.sessionId, // 使用传入的Session ID
      no: this.generateSessionNoFromId(rowData.sessionId), // 从Session ID生成显示用的编号
      timestamp: rowData.detail.timestamp,
      startTime: rowData.detail.timestamp,
      currencyCode: rowData.detail.currencyCode,
      status: "completed", // 导入的数据默认为已完成
      totalCount: 0,
      totalAmount: 0,
      errorCount: 0,
      details: [],
      currencyCountRecords: new Map(),
      denominationBreakdown: new Map(),
    };
  }

  /**
   * 从Session ID生成显示用的Session编号
   */
  private generateSessionNoFromId(sessionId: string): number {
    // 对于雪花ID，取后6位并转换为数字，确保唯一性
    const lastDigits = sessionId.slice(-6);
    const numericPart = lastDigits.replace(/\D/g, ""); // 移除非数字字符
    return parseInt(numericPart) || Date.now() % 1000000;
  }

  /**
   * 更新Session统计信息
   */
  private updateSessionStats(session: SessionData, detail: CounterData): void {
    session.totalCount++;
    session.totalAmount = (session.totalAmount || 0) + detail.denomination;

    if (
      detail.status === "error" ||
      (detail.errorCode && detail.errorCode !== "E0")
    ) {
      session.errorCount++;
    }

    // 更新结束时间
    session.endTime = detail.timestamp;
  }

  /**
   * 重建Session的聚合数据（面额分布和货币记录）
   */
  private rebuildSessionAggregations(session: SessionData): void {
    const denominationBreakdown = new Map<number, DenominationDetail>();
    const currencyCountRecords = new Map<string, CurrencyCountRecord>();

    // 重置统计
    session.totalCount = 0;
    session.totalAmount = 0;
    session.errorCount = 0;

    session.details?.forEach((detail) => {
      const { currencyCode, denomination } = detail;
      const isError =
        detail.status === "error" ||
        (detail.errorCode && detail.errorCode !== "E0");

      // 更新总统计
      session.totalCount++;
      if (!isError) {
        session.totalAmount = (session.totalAmount || 0) + denomination;
      }
      if (isError) {
        session.errorCount++;
      }

      // 更新面额分布（兼容旧结构）
      const existingDenom = denominationBreakdown.get(denomination);
      if (existingDenom) {
        existingDenom.count++;
        if (!isError) {
          existingDenom.amount += denomination;
        }
      } else {
        denominationBreakdown.set(denomination, {
          denomination,
          count: 1,
          amount: isError ? 0 : denomination,
        });
      }

      // 更新货币记录
      let currencyRecord = currencyCountRecords.get(currencyCode);
      if (!currencyRecord) {
        currencyRecord = {
          currencyCode,
          totalCount: 0,
          totalAmount: 0,
          errorCount: 0,
          denominationBreakdown: new Map(),
        };
        currencyCountRecords.set(currencyCode, currencyRecord);
      }

      currencyRecord.totalCount++;
      if (!isError) {
        currencyRecord.totalAmount += denomination;
      }
      if (isError) {
        currencyRecord.errorCount++;
      }

      // 更新货币记录的面额分布
      const currencyDenom =
        currencyRecord.denominationBreakdown.get(denomination);
      if (currencyDenom) {
        currencyDenom.count++;
        if (!isError) {
          currencyDenom.amount += denomination;
        }
      } else {
        currencyRecord.denominationBreakdown.set(denomination, {
          denomination,
          count: 1,
          amount: isError ? 0 : denomination,
        });
      }
    });

    session.denominationBreakdown = denominationBreakdown;
    session.currencyCountRecords = currencyCountRecords;
  }

  /**
   * 工具方法：获取单元格值
   */
  private getCellValue(
    row: ExcelJS.Row,
    colNumber?: number
  ): string | number | null {
    if (!colNumber) return null;
    const cell = row.getCell(colNumber);
    return cell.value as string | number | null;
  }

  /**
   * 解析面额值
   */
  private parseDenomination(value: string | number | null): number {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      // 移除货币符号和逗号
      const cleaned = value.replace(/[^0-9.-]/g, "");
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  /**
   * 解析状态值
   */
  private parseStatus(value?: string): CounterData["status"] {
    if (!value) return "completed";
    const lower = value.toLowerCase();
    if (lower.includes("error")) return "error";
    if (lower.includes("counting")) return "counting";
    if (lower.includes("paused")) return "paused";
    return "completed";
  }

  /**
   * 计算货币统计信息
   */
  private getCurrencyStats(sessionDataList: SessionData[]): Array<{
    currencyCode: string;
    totalAmount: number;
    totalCount: number;
    errorCount: number;
  }> {
    const currencyStatsMap = new Map<
      string,
      {
        currencyCode: string;
        totalAmount: number;
        totalCount: number;
        errorCount: number;
      }
    >();

    sessionDataList.forEach((session) => {
      if (session.currencyCountRecords) {
        session.currencyCountRecords.forEach((record, currencyCode) => {
          const existing = currencyStatsMap.get(currencyCode);
          if (existing) {
            existing.totalAmount += record.totalAmount;
            existing.totalCount += record.totalCount;
            existing.errorCount += record.errorCount;
          } else {
            currencyStatsMap.set(currencyCode, {
              currencyCode,
              totalAmount: record.totalAmount,
              totalCount: record.totalCount,
              errorCount: record.errorCount,
            });
          }
        });
      } else {
        // 兼容旧数据结构
        const currencyCode = session.currencyCode || "-";
        const existing = currencyStatsMap.get(currencyCode);
        if (existing) {
          existing.totalAmount += session.totalAmount || 0;
          existing.totalCount += session.totalCount;
          existing.errorCount += session.errorCount;
        } else {
          currencyStatsMap.set(currencyCode, {
            currencyCode,
            totalAmount: session.totalAmount || 0,
            totalCount: session.totalCount,
            errorCount: session.errorCount,
          });
        }
      }
    });

    return Array.from(currencyStatsMap.values());
  }

  /**
   * 计算多货币面额统计
   */
  private calculateMultiCurrencyDenominationStats(
    sessionDataList: SessionData[]
  ): Array<{
    currencyCode: string;
    denomination: number;
    count: number;
    amount: number;
    percentage: number;
  }> {
    const stats: Array<{
      currencyCode: string;
      denomination: number;
      count: number;
      amount: number;
      percentage: number;
    }> = [];

    const currencyTotals = new Map<string, number>();

    // 首先计算每种货币的总金额
    sessionDataList.forEach((session) => {
      if (session.currencyCountRecords) {
        session.currencyCountRecords.forEach((record, currencyCode) => {
          const current = currencyTotals.get(currencyCode) || 0;
          currencyTotals.set(currencyCode, current + record.totalAmount);
        });
      }
    });

    // 然后计算每个面额的统计
    sessionDataList.forEach((session) => {
      if (session.currencyCountRecords) {
        session.currencyCountRecords.forEach((record, currencyCode) => {
          const currencyTotal = currencyTotals.get(currencyCode) || 0;

          record.denominationBreakdown.forEach((detail, denomination) => {
            const percentage =
              currencyTotal > 0 ? (detail.amount / currencyTotal) * 100 : 0;

            const existing = stats.find(
              (s) =>
                s.currencyCode === currencyCode &&
                s.denomination === denomination
            );

            if (existing) {
              existing.count += detail.count;
              existing.amount += detail.amount;
              // 重新计算百分比
              existing.percentage =
                currencyTotal > 0 ? (existing.amount / currencyTotal) * 100 : 0;
            } else {
              stats.push({
                currencyCode,
                denomination,
                count: detail.count,
                amount: detail.amount,
                percentage,
              });
            }
          });
        });
      }
    });

    return stats.sort((a, b) => {
      // 先按货币代码排序，再按面额降序排序
      if (a.currencyCode !== b.currencyCode) {
        return a.currencyCode.localeCompare(b.currencyCode);
      }
      return b.denomination - a.denomination;
    });
  }

  /**
   * 验证导入的数据
   */
  private validateImportedData(sessions: SessionData[]): string[] {
    const errors: string[] = [];

    sessions.forEach((session, index) => {
      if (!session.id || !session.no) {
        errors.push(`Session ${index + 1}: Missing required fields (id, no)`);
      }

      if (!session.details || session.details.length === 0) {
        errors.push(`Session ${session.no}: No detail records found`);
      }

      if (session.totalCount !== (session.details?.length || 0)) {
        errors.push(`Session ${session.no}: Total count mismatch`);
      }
    });

    return errors;
  }

  /**
   * 移除重复的Session
   */
  private removeDuplicateSessions(sessions: SessionData[]): SessionData[] {
    const seen = new Set<string>();
    return sessions.filter((session) => {
      // 使用session ID和开始时间作为唯一标识
      const key = `${session.id}_${session.startTime}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * 文件名模式匹配
   */
  private matchesPattern(filename: string, pattern: string): boolean {
    // 简单的通配符匹配
    const regex = new RegExp(
      "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
      "i"
    );
    return regex.test(filename);
  }
}

// 导出单例实例
export const fileManager = new FileManager();

export interface ImportOptions {
  directory?: string; // 指定导入目录，默认使用defaultExportDir
  filePattern?: string; // 文件名匹配模式，如 "CounterSession_*.xlsx"
  validateData?: boolean; // 是否验证数据完整性，默认true
  mergeWithExisting?: boolean; // 是否与现有数据合并，默认false
  skipDuplicates?: boolean; // 是否跳过重复的Session，默认true
}

export interface ImportResult {
  success: boolean;
  cancelled?: boolean; // 表示用户是否取消了操作
  sessionData?: SessionData[];
  importedCount?: number;
  skippedCount?: number;
  errorCount?: number;
  errors?: string[];
  filePath?: string;
}

export interface ImportedFileInfo {
  filePath: string;
  filename: string;
  sessionCount: number;
  importedAt: string;
  fileSize: number;
  isValid: boolean;
  errors?: string[];
}
