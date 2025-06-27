import { dialog, shell } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import jsPDF from 'jspdf';
import ExcelJS from 'exceljs';
import { formatAmount, formatCurrency, formatDenomination } from './utils.js';


declare module 'jspdf' {
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
  id: number;
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
  id: number;
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
  fileType: 'excel' | 'pdf';
  size: number;
  createdAt: string;
  sessionCount: number;
}

export interface ExportOptions {
  format?: 'excel' | 'pdf';
  filename?: string;
  useDefaultDir?: boolean;
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
  sessionDataList.forEach(session => {
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
    const isDev = process.env.NODE_ENV === 'development';
    let projectRoot: string;

    if (isDev) {
      // 开发环境：使用当前工作目录
      projectRoot = process.cwd();
    } else {
      // 生产环境：使用可执行文件的目录
      projectRoot = path.dirname(process.execPath);
    }

    const dataDir = path.join(projectRoot, 'Data');

    this.config = {
      defaultExportDir: dataDir,
      maxHistoryFiles: 50,
      autoCleanOldFiles: true,
      cleanupDays: 30
    };

    this.historyFile = path.join(dataDir, 'export-history.json');
    this.initializeDirectories();
  }
  /**
   * 初始化必要的目录
   */
  private async initializeDirectories(): Promise<void> {
    try {
      console.log('Initializing FileManager directories...');
      console.log('Default export directory:', this.config.defaultExportDir);
      console.log('History file path:', this.historyFile);

      await fs.mkdir(this.config.defaultExportDir, { recursive: true });
      await fs.mkdir(path.dirname(this.historyFile), { recursive: true });

      console.log('FileManager directories initialized successfully');
    } catch (error) {
      console.error('Failed to initialize directories:', error);
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
      const filename = options.filename || this.generateFilename('excel');
      const filePath = await this.getExportPath(filename, 'excel', options.useDefaultDir);

      if (!filePath) {
        return { success: false, error: 'User cancelled export' };
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
        fileType: 'excel',
        size: stats.size,
        createdAt: new Date().toISOString(),
        sessionCount: sessionData.length
      };

      // 添加到历史记录
      await this.addToHistory(fileInfo);

      // 可选：导出后打开文件
      if (options.openAfterExport) {
        await shell.openPath(filePath);
      }

      return { success: true, filePath, fileInfo };
    } catch (error) {
      console.error('Excel export failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
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
      const filename = options.filename || this.generateFilename('pdf');
      const filePath = await this.getExportPath(filename, 'pdf', options.useDefaultDir);

      if (!filePath) {
        return { success: false, error: 'User cancelled export' };
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
        fileType: 'pdf',
        size: stats.size,
        createdAt: new Date().toISOString(),
        sessionCount: sessionData.length
      };

      // 添加到历史记录
      await this.addToHistory(fileInfo);

      // 可选：导出后打开文件
      if (options.openAfterExport) {
        await shell.openPath(filePath);
      }

      return { success: true, filePath, fileInfo };
    } catch (error) {
      console.error('PDF export failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 获取导出历史记录
   */
  async getExportHistory(): Promise<ExportFileInfo[]> {
    try {
      const data = await fs.readFile(this.historyFile, 'utf-8');
      const history: ExportFileInfo[] = JSON.parse(data);

      // 清理不存在的文件
      const validHistory = await this.cleanupHistory(history);
      return validHistory;
    } catch (error) {
      console.log('No export history found or failed to read:', error);
      return [];
    }
  }

  /**
   * 打开文件
   */
  async openFile(filePath: string): Promise<boolean> {
    try {
      const result = await shell.openPath(filePath);
      return result === '';
    } catch (error) {
      console.error('Failed to open file:', error);
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
      console.error('Failed to delete file:', error);
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
      console.error('Failed to set default export directory:', error);
      return false;
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 生成文件名
   */
  private generateFilename(format: 'excel' | 'pdf'): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    const extension = format === 'excel' ? 'xlsx' : 'pdf';
    return `currency-report-${timestamp}-${time}.${extension}`;
  }

  /**
   * 获取导出路径
   */
  private async getExportPath(
    filename: string,
    format: 'excel' | 'pdf',
    useDefaultDir = true
  ): Promise<string | null> {
    if (useDefaultDir) {
      return path.join(this.config.defaultExportDir, filename);
    }

    // 显示保存对话框
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(this.config.defaultExportDir, filename),
      filters: [
        format === 'excel'
          ? { name: 'Excel Files', extensions: ['xlsx'] }
          : { name: 'PDF Files', extensions: ['pdf'] }
      ]
    });

    return result.canceled ? null : result.filePath || null;
  }

  private addPageFooter(pdf: jsPDF, pageNumber: number, totalSessions: number, filename: string) {
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
  private async generateExcelBuffer(sessionDataList: SessionData[]): Promise<Buffer> {
    // const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();

    // 设置工作簿属性
    workbook.creator = 'Currency Counter';
    workbook.lastModifiedBy = 'System';
    workbook.created = new Date();
    workbook.modified = new Date();

    // 创建各个工作表
    await this.createBanknoteDetailsSheet(workbook, sessionDataList);
    
    // 创建统一的面额统计工作表（包含所有货币的独立表格）
    await this.createUnifiedDenominationSheet(workbook, sessionDataList);
    
    if (sessionDataList.length > 1) {
      await this.createSummarySheet(workbook, sessionDataList);
      await this.createDetailSheet(workbook, sessionDataList);
    }

    return await workbook.xlsx.writeBuffer() as unknown as Buffer;
  }
  /**
   * 生成 PDF buffer - 集成完整的导出逻辑
   */
  private async generatePDFBuffer(sessionDataList: SessionData[]): Promise<Buffer> {
    const { jsPDF } = await import('jspdf');
    const { applyPlugin } = await import('jspdf-autotable');
    applyPlugin(jsPDF);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const filename = this.generateFilename('pdf').replace('.pdf', '');

    // 封面页
    const coverY = 32;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(40, 64, 134);
    pdf.text('Currency Counter Session Report', 105, coverY, { align: 'center' });

    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(120, 120, 120);
    pdf.text('Data Export Overview', 105, coverY + 12, { align: 'center' });

    pdf.setDrawColor(40, 64, 134);
    pdf.setLineWidth(1.2);
    pdf.line(60, coverY + 18, 150, coverY + 18);

    pdf.setFontSize(10);
    pdf.setTextColor(110, 110, 110);
    pdf.text(`Export Time: ${new Date().toLocaleString()}`, 105, coverY + 28, { align: 'center' });

    // 统计信息
    let currentY = coverY + 40;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.setTextColor(44, 130, 201);
    pdf.text('Summary Statistics', 15, currentY);

    const totalSessions = sessionDataList.length;
    const totalCount = sessionDataList.reduce((sum, session) => sum + session.totalCount, 0);
    const completedSessions = sessionDataList.filter(s => s.status === 'completed').length;
    const errorSessions = sessionDataList.filter(s => s.status === 'error').length;

    pdf.autoTable({
      startY: currentY + 5,
      head: [['Item', 'Value', 'Unit']],
      body: [
        ['Total Sessions', totalSessions, ''],
        ['Total Notes', totalCount, 'notes'],
        ['Total Currency', getCountries(sessionDataList).join(', '), countCountries(sessionDataList)],
        ['Completed Sessions', completedSessions, ''],
        ['Error Sessions', errorSessions, ''],
      ],
      margin: { left: 15, right: 15 },
      theme: 'grid',
      styles: { font: 'helvetica', fontStyle: 'normal', fontSize: 10, cellPadding: 3, textColor: 60 },
      headStyles: { fillColor: [44, 130, 201], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [230, 245, 255] }
    });
    currentY = (pdf as any).lastAutoTable.finalY + 10;

    // 货币统计 (如果有多种货币)
    const currencyStats = this.getCurrencyStats(sessionDataList);
    if (currencyStats.length > 1) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(15);
      pdf.setTextColor(44, 130, 201);
      pdf.text('Currency Distribution', 15, currentY);

      pdf.autoTable({
        startY: currentY + 5,
        head: [['Currency', 'Notes', 'Amount', 'Error Count', 'Percentage']],
        body: currencyStats.map(stat => [
          stat.currencyCode,
          stat.totalCount,
          formatCurrency(stat.totalAmount, { currency: stat.currencyCode }),
          stat.errorCount,
          `${stat.percentage.toFixed(2)}%`
        ]),
        theme: 'striped',
        margin: { left: 15, right: 15 },
        styles: { font: 'helvetica', fontSize: 10, cellPadding: 2 },
        headStyles: { fillColor: [44, 130, 201], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 250, 255] }
      });
      currentY = (pdf as any).lastAutoTable.finalY + 10;
    }

    // 面额统计 (每个货币单独表格)
    const multiCurrencyDenominationStats = this.calculateMultiCurrencyDenominationStats(sessionDataList);
    
    // 按货币分组
    const currencyGroups = new Map<string, Array<{
      currencyCode: string;
      denomination: number;
      count: number;
      amount: number;
      percentage: number;
    }>>();
    
    multiCurrencyDenominationStats.forEach(stat => {
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

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.setTextColor(44, 130, 201);
      pdf.text(`${currencyCode} Currency Statistics`, 15, currentY);

      // 计算合计
      const totalCount = stats.reduce((sum, stat) => sum + stat.count, 0);
      const totalAmount = stats.reduce((sum, stat) => sum + stat.amount, 0);

      // 准备表格数据（包含合计行）
      const tableBody = [
        ...stats.map(stat => [
          formatDenomination(stat.denomination, { currency: stat.currencyCode }),
          stat.count,
          formatAmount(stat.amount, { currency: stat.currencyCode }),
          `${stat.percentage.toFixed(2)}%`
        ]),
        // 合计行
        [
          'Total',
          totalCount,
          formatAmount(totalAmount, { currency: currencyCode }),
          '100.00%'
        ]
      ];

      pdf.autoTable({
        startY: currentY + 5,
        head: [['Denomination', 'Count', 'Amount', 'Percentage']],
        body: tableBody,
        theme: 'striped',
        margin: { left: 20, right: 20 },
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.5 },
        headStyles: { fillColor: [44, 130, 201], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 250, 255] },
        didParseCell: function (data: any) {
          // 合计行样式
          if (data.row.section === 'body' && data.row.index === tableBody.length - 1) {
            data.cell.styles.fillColor = [220, 235, 255];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [44, 130, 201];
          }
        }
      });
      
      currentY = (pdf as any).lastAutoTable.finalY + 15;
    });

    // 会话概览
    pdf.addPage();
    currentY = 15;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.setTextColor(44, 130, 201);
    pdf.text('Session Overview', 15, currentY);

    pdf.autoTable({
      startY: currentY + 5,
      head: [['No.', 'Start Time', 'Note Count', 'Amount', 'Error Count', 'Duration']],
      body: sessionDataList.map(session => {
        const duration = session.endTime && session.startTime
          ? Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000 / 60)
          : 0;
        return [
          session.no,
          new Date(session.startTime).toLocaleString(),
          session.totalCount,
          formatCurrency(session.totalAmount || 0),
          session.errorCount || 0,
          duration > 0 ? `${duration} min` : '-'
        ];
      }),
      theme: 'striped',
      margin: { left: 10, right: 10 },
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 2 },
      headStyles: { fillColor: [40, 64, 134], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 240, 250] }
    });

    // 详细会话信息
    const sessionPageNumbers: number[] = [];
    sessionDataList.forEach((session, idx) => {
      if (currentY > 210 || idx === 0) {
        pdf.addPage();
        currentY = 20;
      }
      sessionPageNumbers.push(pdf.getNumberOfPages());

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.setTextColor(44, 130, 201);
      pdf.text(`Session #${session.no} Details`, 12, currentY);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(60, 60, 60);
      pdf.text(
        `Start: ${session.startTime}   |   Notes: ${session.totalCount}   |   Amount: ${formatCurrency(session.totalAmount || 0)}   ${session.errorCount ? `|   Errors: ${session.errorCount}` : ''}`,
        12,
        currentY + 7
      );
      currentY += 15;

      if (session.details && session.details.length > 0) {
        pdf.autoTable({
          startY: currentY,
          head: [['No.', 'Timestamp', 'Denomination', 'Currency', 'Serial No.', 'Error Code', 'Status']],          body: session.details.map(detail => [
            detail.no,
            detail.timestamp,
            formatDenomination(detail.denomination),
            detail.currencyCode || 'CNY',
            detail.serialNumber || '-',
            detail.errorCode && detail.errorCode !== 'E0' ? detail.errorCode : '-',
            (detail.status === 'error' || (detail.errorCode && detail.errorCode !== 'E0')) ? 'Abnormal' : 'OK'
          ]),
          styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.5 },
          headStyles: { fillColor: [44, 130, 201], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 248, 255] },
          margin: { left: 10, right: 10 },
          showHead: 'everyPage',
          theme: 'striped',
          didParseCell: function (data: any) {
            if (
              data.row.section === 'body' &&
              Array.isArray(data.row.raw) &&
              data.row.raw[6] === 'Abnormal'
            ) {
              data.cell.styles.textColor = [220, 53, 69];
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [255, 245, 245];
            }
          },
          didDrawPage: () => {
            this.addPageFooter(pdf, pdf.getNumberOfPages(), sessionDataList.length, filename);
          }
        });
      }
      currentY = (pdf as any).lastAutoTable.finalY + 8;

      // Session stats row
      const okCount = session.details!.filter(d => d.status !== 'error' && (!d.errorCode || d.errorCode === 'E0')).length;
      const errCount = session.details!.filter(d => d.status === 'error' || (d.errorCode && d.errorCode !== 'E0')).length;
      
      // 安全地处理 denominationBreakdown
      let breakdown = 'N/A';
      if (session.denominationBreakdown) {
        breakdown = Array.from(session.denominationBreakdown.entries())
          .map(([denom, detail]) => `${formatDenomination(denom)}×${detail.count}`).join(', ');
      } else if (session.currencyCountRecords) {
        const allBreakdowns: string[] = [];
        session.currencyCountRecords.forEach((record, currencyCode) => {
          const currencyBreakdown = Array.from(record.denominationBreakdown.entries())
            .map(([denom, detail]) => `${currencyCode}:${formatDenomination(denom)}×${detail.count}`);
          allBreakdowns.push(...currencyBreakdown);
        });
        breakdown = allBreakdowns.join(', ');
      }
      
      pdf.setFontSize(9);
      pdf.setTextColor(110, 110, 110);
      pdf.text(
        `Summary: OK: ${okCount}   |   Abnormal: ${errCount}   |   Denomination Distribution: ${breakdown}`,
        12,
        currentY
      );
      currentY += 10;
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

    return Buffer.from(pdf.output('arraybuffer'));
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
      console.error('Failed to add to history:', error);
    }
  }

  /**
   * 从历史记录中移除
   */
  private async removeFromHistory(filePath: string): Promise<void> {
    try {
      const history = await this.getExportHistory();
      const filteredHistory = history.filter(item => item.filePath !== filePath);
      await fs.writeFile(this.historyFile, JSON.stringify(filteredHistory, null, 2));
    } catch (error) {
      console.error('Failed to remove from history:', error);
    }
  }

  /**
   * 清理无效的历史记录
   */
  private async cleanupHistory(history: ExportFileInfo[]): Promise<ExportFileInfo[]> {
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
      await fs.writeFile(this.historyFile, JSON.stringify(validHistory, null, 2));
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
   * 创建摘要工作表
   */
  private async createSummarySheet(workbook: any, sessionDataList: SessionData[]): Promise<void> {
    const worksheet = workbook.addWorksheet('Summary');

    worksheet.columns = [
      { header: 'Item', key: 'item', width: 20 },
      { header: 'Value', key: 'value', width: 15 },
      { header: 'Unit', key: 'unit', width: 10 },
    ];

    const totalSessions = sessionDataList.length;
    const totalCount = sessionDataList.reduce((sum, session) => sum + session.totalCount, 0);
    const totalAmount = sessionDataList.reduce((sum, session) => sum + (session.totalAmount || 0), 0);
    const completedSessions = sessionDataList.filter(s => s.status === 'completed').length;
    const errorSessions = sessionDataList.filter(s => s.status === 'error').length;

    const summaryData = [
      { item: 'Total Sessions', value: totalSessions, unit: '' },
      { item: 'Total Count', value: totalCount, unit: 'notes' },
      { item: 'Total Amount', value: totalAmount.toFixed(2), unit: 'CNY' },
      { item: 'Completed Sessions', value: completedSessions, unit: '' },
      { item: 'Error Sessions', value: errorSessions, unit: '' },
      { item: 'Success Rate', value: ((completedSessions / totalSessions) * 100).toFixed(2), unit: '%' },
      { item: 'Average Amount Per Session', value: (totalAmount / totalSessions).toFixed(2), unit: 'CNY' },
    ];

    worksheet.addRows(summaryData);
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  }

  /**
   * 创建详细信息工作表
   */
  private async createDetailSheet(workbook: any, sessionDataList: SessionData[]): Promise<void> {
    const worksheet = workbook.addWorksheet('Details');

    worksheet.columns = [
      { header: 'Session ID', key: 'id', width: 10 },
      { header: 'Session No.', key: 'no', width: 12 },
      { header: 'Start Time', key: 'startTime', width: 20 },
      { header: 'End Time', key: 'endTime', width: 20 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Total Count', key: 'totalCount', width: 12 },
      { header: 'Total Amount', key: 'totalAmount', width: 12 },
      { header: 'Error Count', key: 'errorCount', width: 10 },
      { header: 'Machine Mode', key: 'machineMode', width: 12 },
    ];

    sessionDataList.forEach(session => {
      worksheet.addRow({
        id: session.id,
        no: session.no,
        startTime: session.startTime,
        endTime: session.endTime || '-',
        status: this.getStatusText(session.status),
        totalCount: session.totalCount,
        totalAmount: (session.totalAmount || 0).toFixed(2),
        errorCount: session.errorCount,
        machineMode: session.machineMode || '-'
      });
    });

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // 状态列条件格式
    worksheet.getColumn('status').eachCell((cell: any, rowNumber: number) => {
      if (rowNumber > 1) {
        const status = cell.value as string;
        if (status === 'Completed') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6FFE6' } };
        } else if (status === 'Error') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE6E6' } };
        }
      }
    });
  }

  /**
   * 创建统一的面额统计工作表（所有货币在一个Sheet中，每个货币独立表格）
   */
  private async createUnifiedDenominationSheet(workbook: any, sessionDataList: SessionData[]): Promise<void> {
    const worksheet = workbook.addWorksheet('Denomination Statistics');
    const multiCurrencyDenominationStats = this.calculateMultiCurrencyDenominationStats(sessionDataList);
    
    // 按货币分组
    const currencyGroups = new Map<string, Array<{
      currencyCode: string;
      denomination: number;
      count: number;
      amount: number;
      percentage: number;
    }>>();
    
    multiCurrencyDenominationStats.forEach(stat => {
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
        color: { argb: 'FFFFFFFF' },
        name: 'Calibri'
      };
      titleCell.fill = { 
        type: 'gradient', 
        gradient: 'angle', 
        degree: 90,
        stops: [
          { position: 0, color: { argb: 'FF1B4F72' } },
          { position: 1, color: { argb: 'FF2874A6' } }
        ]
      };
      titleCell.alignment = { 
        vertical: 'middle', 
        horizontal: 'center',
        wrapText: false
      };
      titleCell.border = {
        top: { style: 'medium', color: { argb: 'FF1B4F72' } },
        left: { style: 'medium', color: { argb: 'FF1B4F72' } },
        bottom: { style: 'medium', color: { argb: 'FF1B4F72' } },
        right: { style: 'medium', color: { argb: 'FF1B4F72' } }
      };
      worksheet.mergeCells(currentRow, 1, currentRow, 4);
      worksheet.getRow(currentRow).height = 30;
      currentRow += 1;

      // 表头 - 专业的渐变设计
      const headerRow = worksheet.getRow(currentRow);
      headerRow.values = ['💸 Denomination', '📊 Count', '💵 Amount', '📈 Percentage'];
      headerRow.font = { 
        bold: true, 
        color: { argb: 'FFFFFFFF' },
        size: 11,
        name: 'Calibri'
      };
      headerRow.height = 25;
      
      // 设置表头样式
      headerRow.eachCell((cell: any, colNumber: number) => {
        if (colNumber <= 4) {
          cell.fill = { 
            type: 'gradient', 
            gradient: 'angle', 
            degree: 90,
            stops: [
              { position: 0, color: { argb: 'FF1B4F72' } },
              { position: 1, color: { argb: 'FF3498DB' } }
            ]
          };
          cell.border = {
            top: { style: 'medium', color: { argb: 'FF1B4F72' } },
            left: { style: 'thin', color: { argb: 'FF85C1E9' } },
            bottom: { style: 'medium', color: { argb: 'FF1B4F72' } },
            right: { style: 'thin', color: { argb: 'FF85C1E9' } }
          };
          cell.alignment = { 
            vertical: 'middle', 
            horizontal: 'center',
            wrapText: false
          };
        }
      });
      currentRow++;

      // 添加面额数据 - 交替行颜色和精美样式
      stats.forEach((stat, statIndex) => {
        const dataRow = worksheet.getRow(currentRow);
        dataRow.values = [
          formatDenomination(stat.denomination, { currency: stat.currencyCode }),
          stat.count,
          formatCurrency(stat.amount, { currency: stat.currencyCode }),
          `${stat.percentage.toFixed(2)}%`
        ];
        dataRow.height = 22;
        
        // 设置数据行样式 - 交替背景色
        const isEvenRow = statIndex % 2 === 0;
        dataRow.eachCell((cell: any, colNumber: number) => {
          if (colNumber <= 4) {
            // 交替行颜色
            cell.fill = { 
              type: 'pattern', 
              pattern: 'solid', 
              fgColor: { argb: isEvenRow ? 'FFFBFCFD' : 'FFF8F9FA' }
            };
            
            // 精细边框
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE5E8EC' } },
              left: { style: 'thin', color: { argb: 'FFE5E8EC' } },
              bottom: { style: 'thin', color: { argb: 'FFE5E8EC' } },
              right: { style: 'thin', color: { argb: 'FFE5E8EC' } }
            };
            
            // 字体和对齐
            cell.font = { 
              name: 'Calibri', 
              size: 10,
              color: { argb: 'FF2C3E50' }
            };
            
            // 根据列内容设置对齐方式
            if (colNumber === 1) { // Denomination
              cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
              cell.font = { ...cell.font, bold: true };
            } else if (colNumber === 2 || colNumber === 4) { // Count, Percentage
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
            } else { // Amount
              cell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
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
        '🎯 Total',
        totalCount,
        formatCurrency(totalAmount, { currency: currencyCode }),
        '100.00%'
      ];
      totalRow.height = 28;
      
      // 设置合计行样式 - 渐变和特殊效果
      totalRow.eachCell((cell: any, colNumber: number) => {
        if (colNumber <= 4) {
          cell.fill = { 
            type: 'gradient', 
            gradient: 'angle', 
            degree: 90,
            stops: [
              { position: 0, color: { argb: 'FFE8F4FD' } },
              { position: 1, color: { argb: 'FFDBEAFE' } }
            ]
          };
          cell.font = { 
            bold: true, 
            color: { argb: 'FF1B4F72' },
            size: 11,
            name: 'Calibri'
          };
          cell.border = {
            top: { style: 'medium', color: { argb: 'FF2874A6' } },
            left: { style: 'thin', color: { argb: 'FF2874A6' } },
            bottom: { style: 'medium', color: { argb: 'FF2874A6' } },
            right: { style: 'thin', color: { argb: 'FF2874A6' } }
          };
          
          // 根据列内容设置对齐方式
          if (colNumber === 1) { // Total label
            cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          } else if (colNumber === 2 || colNumber === 4) { // Count, Percentage
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else { // Amount
            cell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
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
    worksheet.views = [{
      state: 'frozen',
      xSplit: 0,
      ySplit: 0,
      topLeftCell: 'A1',
      activeCell: 'A1'
    }];

    // 设置打印属性
    worksheet.pageSetup = {
      paperSize: 9, // A4
      orientation: 'portrait',
      horizontalCentered: true,
      verticalCentered: false,
      margins: {
        left: 0.7,
        right: 0.7,
        top: 0.75,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3
      }
    };
  }

  /**
   * 创建纸币详细信息工作表 - 美化版本
   */
  private async createBanknoteDetailsSheet(workbook: any, sessionDataList: SessionData[]): Promise<void> {
    const worksheet = workbook.addWorksheet('💵 Banknote Details');

    // 设置列定义
    worksheet.columns = [
      { header: '🔢 Session No.', key: 'sessionNo', width: 12 },
      { header: '📝 Note No.', key: 'noteNo', width: 8 },
      { header: '⏰ Timestamp', key: 'timestamp', width: 18 },
      { header: '💸 Denomination', key: 'denomination', width: 12 },
      { header: '🌍 Currency', key: 'currencyCode', width: 10 },
      { header: '🔍 Serial Number', key: 'serialNumber', width: 22 },
      { header: '⚠️ Error Code', key: 'errorCode', width: 10 },
      { header: '✅ Status', key: 'status', width: 8 },
    ];

    const allBanknoteDetails: Array<{
      sessionNo: number;
      noteNo: number;
      timestamp: string;
      denomination: string;
      currencyCode: string;
      serialNumber: string;
      errorCode: string;
      status: string;
    }> = [];

    sessionDataList.forEach(session => {
      if (session.details && session.details.length > 0) {
        session.details.forEach(detail => {
          allBanknoteDetails.push({
            sessionNo: session.no,
            noteNo: detail.no,
            timestamp: detail.timestamp,
            denomination: formatDenomination(detail.denomination, { currency: detail.currencyCode }),
            currencyCode: detail.currencyCode || 'CNY',
            serialNumber: detail.serialNumber || '-',
            errorCode: detail.errorCode && detail.errorCode !== 'E0' ? detail.errorCode : '-',
            status: (detail.status === 'error' || (detail.errorCode && detail.errorCode !== 'E0')) ? 'Error' : 'OK',
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
      color: { argb: 'FFFFFFFF' },
      size: 11,
      name: 'Calibri'
    };

    headerRow.eachCell((cell: any, colNumber: number) => {
      if (colNumber <= 8) {
        cell.fill = { 
          type: 'gradient', 
          gradient: 'angle', 
          degree: 90,
          stops: [
            { position: 0, color: { argb: 'FF1B4F72' } },
            { position: 1, color: { argb: 'FF3498DB' } }
          ]
        };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF1B4F72' } },
          left: { style: 'thin', color: { argb: 'FF85C1E9' } },
          bottom: { style: 'medium', color: { argb: 'FF1B4F72' } },
          right: { style: 'thin', color: { argb: 'FF85C1E9' } }
        };
        cell.alignment = { 
          vertical: 'middle', 
          horizontal: 'center',
          wrapText: false
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
            type: 'pattern', 
            pattern: 'solid', 
            fgColor: { argb: isEvenRow ? 'FFFBFCFD' : 'FFF8F9FA' }
          };
          
          // 精细边框
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E8EC' } },
            left: { style: 'thin', color: { argb: 'FFE5E8EC' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E8EC' } },
            right: { style: 'thin', color: { argb: 'FFE5E8EC' } }
          };
          
          // 字体设置
          cell.font = { 
            name: 'Calibri', 
            size: 10,
            color: { argb: 'FF2C3E50' }
          };
          
          // 根据列内容设置对齐方式和特殊样式
          if (colNumber === 1 || colNumber === 2) { // Session No, Note No
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { ...cell.font, bold: true };
          } else if (colNumber === 3) { // Timestamp
            cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            cell.font = { ...cell.font, size: 9 };
          } else if (colNumber === 4 || colNumber === 5) { // Denomination, Currency
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            cell.font = { ...cell.font, bold: true };
          } else if (colNumber === 6) { // Serial Number - 简单优化：等宽字体和加粗
            cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            cell.font = { 
              name: 'Consolas', // 等宽字体便于读取冠字号
              size: 10, 
              bold: true, 
              color: { argb: 'FF2C3E50' } 
            };
          } else if (colNumber === 7) { // Error Code
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            // 错误代码特殊颜色
            if (cell.value && cell.value !== '-') {
              cell.font = { ...cell.font, bold: true, color: { argb: 'FFDC3545' } };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF5F5' } };
            }
          } else if (colNumber === 8) { // Status
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { ...cell.font, bold: true };
          }
        }
      });
    });

    // 状态列特殊条件格式 - 增强版
    worksheet.getColumn('status').eachCell((cell: any, rowNumber: number) => {
      if (rowNumber > 1) {
        const status = cell.value as string;
        if (status === 'OK') {
          cell.fill = { 
            type: 'gradient', 
            gradient: 'angle', 
            degree: 90,
            stops: [
              { position: 0, color: { argb: 'FFE8F5E8' } },
              { position: 1, color: { argb: 'FFD4F3D4' } }
            ]
          };
          cell.font = { 
            bold: true,
            color: { argb: 'FF28A745' },
            name: 'Calibri',
            size: 10
          };
          cell.border = {
            ...cell.border,
            top: { style: 'thin', color: { argb: 'FF28A745' } },
            bottom: { style: 'thin', color: { argb: 'FF28A745' } }
          };
        } else if (status === 'Error') {
          cell.fill = { 
            type: 'gradient', 
            gradient: 'angle', 
            degree: 90,
            stops: [
              { position: 0, color: { argb: 'FFFEF2F2' } },
              { position: 1, color: { argb: 'FFFECACA' } }
            ]
          };
          cell.font = { 
            bold: true,
            color: { argb: 'FFDC3545' },
            name: 'Calibri',
            size: 10
          };
          cell.border = {
            ...cell.border,
            top: { style: 'thin', color: { argb: 'FFDC3545' } },
            bottom: { style: 'thin', color: { argb: 'FFDC3545' } }
          };
        }
      }
    });

    // 启用自动筛选和高级功能
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: allBanknoteDetails.length + 1, column: 8 }
    };
    
    // 冻结首行（表头）
    worksheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 1 }
    ];
    
    // 设置打印选项
    worksheet.pageSetup = {
      paperSize: 9, // A4
      orientation: 'landscape', // 横向打印
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.5,
        right: 0.5,
        top: 0.75,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3
      }
    };
    
    // 设置打印标题（每页都显示表头）
    worksheet.pageSetup.printTitlesRow = '1:1';
  }

  /**
   * 计算面额统计 - 兼容旧版本数据结构
   */
  private calculateDenominationStats(sessionDataList: SessionData[]): Array<{
    denomination: number;
    count: number;
    amount: number;
    percentage: number;
  }> {
    const denominationMap = new Map<number, { count: number; amount: number }>();

    sessionDataList.forEach(session => {
      // 兼容旧版本：优先使用 denominationBreakdown
      if (session.denominationBreakdown) {
        session.denominationBreakdown.forEach((detail, denomination) => {
          const existing = denominationMap.get(denomination) || { count: 0, amount: 0 };
          denominationMap.set(denomination, {
            count: existing.count + detail.count,
            amount: existing.amount + detail.amount
          });
        });
      } else if (session.currencyCountRecords) {
        // 新版本：从 currencyCountRecords 中提取
        session.currencyCountRecords.forEach((record) => {
          record.denominationBreakdown.forEach((detail, denomination) => {
            const existing = denominationMap.get(denomination) || { count: 0, amount: 0 };
            denominationMap.set(denomination, {
              count: existing.count + detail.count,
              amount: existing.amount + detail.amount
            });
          });
        });
      }
    });

    const totalAmount = Array.from(denominationMap.values()).reduce((sum, item) => sum + item.amount, 0);

    return Array.from(denominationMap.entries())
      .map(([denomination, data]) => ({
        denomination,
        count: data.count,
        amount: data.amount,
        percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0
      }))
      .sort((a, b) => b.denomination - a.denomination);
  }

  /**
   * 计算多货币面额统计
   */
  private calculateMultiCurrencyDenominationStats(sessionDataList: SessionData[]): Array<{
    currencyCode: string;
    denomination: number;
    count: number;
    amount: number;
    percentage: number;
  }> {
    const denominationMap = new Map<string, { count: number; amount: number }>();
    const currencyTotals = new Map<string, number>();

    sessionDataList.forEach(session => {
      // 优先使用新的 currencyCountRecords 结构
      if (session.currencyCountRecords && session.currencyCountRecords.size > 0) {
        session.currencyCountRecords.forEach((record, currencyCode) => {
          record.denominationBreakdown.forEach((detail, denomination) => {
            const key = `${currencyCode}-${denomination}`;
            const existing = denominationMap.get(key) || { count: 0, amount: 0 };
            denominationMap.set(key, {
              count: existing.count + detail.count,
              amount: existing.amount + detail.amount
            });
            
            // 累计每种货币的总金额
            const currencyTotal = currencyTotals.get(currencyCode) || 0;
            currencyTotals.set(currencyCode, currencyTotal + detail.amount);
          });
        });
      } else {
        // 兼容旧版本数据结构
        const currencyCode = session.currencyCode || 'CNY';
        if (session.denominationBreakdown) {
          session.denominationBreakdown.forEach((detail, denomination) => {
            const key = `${currencyCode}-${denomination}`;
            const existing = denominationMap.get(key) || { count: 0, amount: 0 };
            denominationMap.set(key, {
              count: existing.count + detail.count,
              amount: existing.amount + detail.amount
            });
            
            // 累计每种货币的总金额
            const currencyTotal = currencyTotals.get(currencyCode) || 0;
            currencyTotals.set(currencyCode, currencyTotal + detail.amount);
          });
        }
      }
    });

    return Array.from(denominationMap.entries())
      .map(([key, data]) => {
        const [currencyCode, denominationStr] = key.split('-');
        const denomination = parseInt(denominationStr);
        const currencyTotal = currencyTotals.get(currencyCode) || 0;
        return {
          currencyCode,
          denomination,
          count: data.count,
          amount: data.amount,
          percentage: currencyTotal > 0 ? (data.amount / currencyTotal) * 100 : 0
        };
      })
      .sort((a, b) => {
        // 先按货币代码排序，再按面额降序排序
        if (a.currencyCode !== b.currencyCode) {
          return a.currencyCode.localeCompare(b.currencyCode);
        }
        return b.denomination - a.denomination;
      });
  }

  /**
   * 获取货币统计信息
   */
  private getCurrencyStats(sessionDataList: SessionData[]): Array<{
    currencyCode: string;
    totalCount: number;
    totalAmount: number;
    errorCount: number;
    percentage: number;
  }> {
    const currencyMap = new Map<string, { count: number; amount: number; errorCount: number }>();
    
    sessionDataList.forEach(session => {
      // 优先使用新的 currencyCountRecords 结构
      if (session.currencyCountRecords && session.currencyCountRecords.size > 0) {
        session.currencyCountRecords.forEach((record, currencyCode) => {
          const existing = currencyMap.get(currencyCode) || { count: 0, amount: 0, errorCount: 0 };
          currencyMap.set(currencyCode, {
            count: existing.count + record.totalCount,
            amount: existing.amount + record.totalAmount,
            errorCount: existing.errorCount + record.errorCount
          });
        });
      } else {
        // 兼容旧版本数据结构
        const currencyCode = session.currencyCode || 'CNY';
        const existing = currencyMap.get(currencyCode) || { count: 0, amount: 0, errorCount: 0 };
        currencyMap.set(currencyCode, {
          count: existing.count + session.totalCount,
          amount: existing.amount + (session.totalAmount || 0),
          errorCount: existing.errorCount + (session.errorCount || 0)
        });
      }
    });

    const totalAmount = Array.from(currencyMap.values()).reduce((sum, item) => sum + item.amount, 0);
    
    return Array.from(currencyMap.entries()).map(([currencyCode, data]) => ({
      currencyCode,
      totalCount: data.count,
      totalAmount: data.amount,
      errorCount: data.errorCount,
      percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0
    })).sort((a, b) => b.totalAmount - a.totalAmount);
  }

  /**
   * 获取状态文本
   */
  private getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      'counting': 'Counting',
      'completed': 'Completed',
      'error': 'Error',
      'paused': 'Paused'
    };
    return statusMap[status] || status;
  }


}

// 导出单例实例
export const fileManager = new FileManager();
