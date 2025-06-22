import { app, dialog, shell } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import jsPDF from 'jspdf';
import ExcelJS from 'exceljs';
import { formatCurrency, formatDenomination } from './utils.js';


declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => void;
    lastAutoTable: {
      finalY: number;
    };
  }
}

// 使用类型定义而不是导入，避免模块导入问题
interface SessionData {
  id: number;
  no: number;
  startTime: string;
  endTime?: string;
  status: 'counting' | 'completed' | 'error' | 'paused';
  totalCount: number;
  totalAmount: number;
  errorCount: number;
  machineMode?: string;
  currencyCode?: string;
  denominationBreakdown: Map<number, { count: number; amount: number }>;
  details?: Array<{
    no: number;
    timestamp: string;
    denomination: number;
    currencyCode?: string;
    serialNumber?: string;
    errorCode?: string;
    status: string;
  }>;
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
    await this.createDenominationSheet(workbook, sessionDataList);
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
    let coverY = 32;
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
    const totalAmount = sessionDataList.reduce((sum, session) => sum + session.totalAmount, 0);
    const completedSessions = sessionDataList.filter(s => s.status === 'completed').length;
    const errorSessions = sessionDataList.filter(s => s.status === 'error').length;

    pdf.autoTable({
      startY: currentY + 5,
      head: [['Item', 'Value', 'Unit']],
      body: [
        ['Total Sessions', totalSessions, ''],
        ['Total Notes', totalCount, 'notes'],
        ['Total Amount', formatCurrency(totalAmount), ''],
        ['Completed Sessions', completedSessions, ''],
        ['Error Sessions', errorSessions, ''],
        ['Success Rate', ((completedSessions / totalSessions) * 100).toFixed(2), '%'],
        ['Avg. Session Amount', formatCurrency(totalAmount / totalSessions), ''],
      ],
      margin: { left: 15, right: 15 },
      theme: 'grid',
      styles: { font: 'helvetica', fontStyle: 'normal', fontSize: 10, cellPadding: 3, textColor: 60 },
      headStyles: { fillColor: [44, 130, 201], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [230, 245, 255] }
    });
    currentY = (pdf as any).lastAutoTable.finalY + 10;

    // 面额统计
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.setTextColor(44, 130, 201);
    pdf.text('Denomination Statistics', 15, currentY);

    const denominationStats = this.calculateDenominationStats(sessionDataList);

    pdf.autoTable({
      startY: currentY + 5,
      head: [['Denomination', 'Count', 'Amount', 'Percentage']],      
      body: denominationStats.map(stat => [
        formatDenomination(stat.denomination),
        stat.count,
        formatCurrency(stat.amount),
        `${stat.percentage.toFixed(2)}%`
      ]),
      theme: 'striped',
      margin: { left: 15, right: 15 },
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 2 },
      headStyles: { fillColor: [44, 130, 201], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 250, 255] }
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
          formatCurrency(session.totalAmount),
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
    let sessionPageNumbers: number[] = [];
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
        `Start: ${session.startTime}   |   Notes: ${session.totalCount}   |   Amount: ${formatCurrency(session.totalAmount)}   ${session.errorCount ? `|   Errors: ${session.errorCount}` : ''}`,
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
      const errCount = session.details!.filter(d => d.status === 'error' || (d.errorCode && d.errorCode !== 'E0')).length;      const breakdown = Array.from(session.denominationBreakdown.entries())
        .map(([denom, detail]) => `${formatDenomination(denom)}×${detail.count}`).join(', ');
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
    const totalAmount = sessionDataList.reduce((sum, session) => sum + session.totalAmount, 0);
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
        totalAmount: session.totalAmount.toFixed(2),
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
   * 创建面额统计工作表
   */
  private async createDenominationSheet(workbook: any, sessionDataList: SessionData[]): Promise<void> {
    const worksheet = workbook.addWorksheet('Denomination');
    const denominationStats = this.calculateDenominationStats(sessionDataList);

    worksheet.columns = [
      { header: 'Denomination', key: 'denomination', width: 10 },
      { header: 'Count', key: 'count', width: 12 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Percentage', key: 'percentage', width: 10 },
    ];    denominationStats.forEach(stat => {
      worksheet.addRow({
        denomination: formatDenomination(stat.denomination),
        count: stat.count,
        amount: stat.amount.toFixed(2),
        percentage: `${stat.percentage.toFixed(2)}%`
      });
    });

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  }

  /**
   * 创建纸币详细信息工作表
   */
  private async createBanknoteDetailsSheet(workbook: any, sessionDataList: SessionData[]): Promise<void> {
    const worksheet = workbook.addWorksheet('Banknote Details');

    worksheet.columns = [
      { header: 'Session No.', key: 'sessionNo', width: 12 },
      { header: 'Note No.', key: 'noteNo', width: 8 },
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'Denomination', key: 'denomination', width: 12 },
      { header: 'Currency Code', key: 'currencyCode', width: 12 },
      { header: 'Serial Number', key: 'serialNumber', width: 20 },
      { header: 'Error Code', key: 'errorCode', width: 10 },
      { header: 'Status', key: 'status', width: 10 },
    ];

    const allBanknoteDetails: any[] = [];

    sessionDataList.forEach(session => {
      if (session.details && session.details.length > 0) {
        session.details.forEach(detail => {
          allBanknoteDetails.push({
            sessionNo: session.no,
            noteNo: detail.no,
            timestamp: detail.timestamp,
            denomination: formatDenomination(detail.denomination),
            currencyCode: detail.currencyCode || 'CNY',
            serialNumber: detail.serialNumber || '-',
            errorCode: detail.errorCode && detail.errorCode !== 'E0' ? detail.errorCode : '-',
            status: (detail.status === 'error' || (detail.errorCode && detail.errorCode !== 'E0')) ? 'Error' : 'OK',
          });
        });
      }
    });

    worksheet.addRows(allBanknoteDetails);

    // 自动调整列宽
    worksheet.columns.forEach((column: any) => {
      const maxLength = column.values.reduce((max: number, value: any) => {
        return Math.max(max, String(value).length);
      }, 0);
      column.width = maxLength + 2; // 加一些额外的空间
    });

    // 都设置为左对齐，垂直居中
    // worksheet.properties.defaultRowHeight = 20;
    worksheet.eachRow((row: any) => {
      // row.height = 20; // 设置行高
      row.alignment = { vertical: 'middle', horizontal: 'left' }; // 垂直居中，水平左对齐
    });

    // 标题行样式到status列后结束
    worksheet.getRow(1).eachCell((cell: any, colNumber: number) => {
      if (colNumber <= 8) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A90E2' } };
        cell.font = { ...cell.font, color: { argb: 'FFFFFFFF' } };
      }
    });

    // 状态列条件格式
    worksheet.getColumn('status').eachCell((cell: any, rowNumber: number) => {
      if (rowNumber > 1) {
        const status = cell.value as string;
        if (status === 'OK') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6FFE6' } };
          cell.font = { color: { argb: 'FF006600' } };
        } else if (status === 'Error') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE6E6' } };
          cell.font = { color: { argb: 'FFCC0000' }, bold: true };
        }
      }
    });
  }

  /**
   * 计算面额统计
   */
  private calculateDenominationStats(sessionDataList: SessionData[]): Array<{
    denomination: number;
    count: number;
    amount: number;
    percentage: number;
  }> {
    const denominationMap = new Map<number, { count: number; amount: number }>();

    sessionDataList.forEach(session => {
      session.denominationBreakdown.forEach((detail, denomination) => {
        const existing = denominationMap.get(denomination) || { count: 0, amount: 0 };
        denominationMap.set(denomination, {
          count: existing.count + detail.count,
          amount: existing.amount + detail.amount
        });
      });
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
