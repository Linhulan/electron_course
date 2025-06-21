import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SessionData } from './serialization';

// Export format types
export type ExportFormat = 'excel' | 'pdf';

// Export options interface
export interface ConvertOptions {
  format: ExportFormat;
  outputPath?: string;
  filename?: string;
  includeCharts?: boolean;
  customTemplate?: string;
}

// Export result interface
export interface ConvertResult {
  success: boolean;
  filePath: string;
  error?: string;
  fileSize?: number;
}

// Denomination summary interface
interface DenominationSummary {
  denomination: number;
  count: number;
  amount: number;
  percentage: number;
}

export async function convertSessionData(
  sessionDataList: SessionData[],
  options: ConvertOptions
): Promise<ConvertResult> {
  try {
    const filename = options.filename || `session_report_${new Date().toISOString().split('T')[0]}`;
    const outputPath = options.outputPath || './exports';

    // Ensure output directory exists
    await ensureDirectoryExists(outputPath);

    let filePath: string;

    switch (options.format) {
      case 'excel':
        filePath = await exportToExcel(sessionDataList, outputPath, filename);
        break;
      case 'pdf':
        filePath = await exportToPDF(sessionDataList, outputPath, filename);
        break;
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }

    // Get file size
    const fileSize = await getFileSize(filePath);

    return {
      success: true,
      filePath,
      fileSize
    };

  } catch (error) {
    console.error('Export failed:', error);
    return {
      success: false,
      filePath: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Export to Excel (browser-compatible version)
 */
async function exportToExcel(
  sessionDataList: SessionData[],
  _outputPath: string,
  filename: string
): Promise<string> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();

  // Set workbook properties
  workbook.creator = 'Session Data Exporter';
  workbook.lastModifiedBy = 'System';
  workbook.created = new Date();
  workbook.modified = new Date();
  await createSummarySheet(workbook, sessionDataList);
  await createDetailSheet(workbook, sessionDataList);
  await createDenominationSheet(workbook, sessionDataList);
  await createBanknoteDetailsSheet(workbook, sessionDataList);

  // Generate buffer and trigger download in browser
  const buffer = await workbook.xlsx.writeBuffer();
  
  if (typeof window !== 'undefined') {
    // Browser environment - trigger download
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return `downloads/${filename}.xlsx`;
  } else {
    // Fallback for non-browser environments
    console.warn('File system operations not supported in this environment');
    return `downloads/${filename}.xlsx`;
  }
}

/**
 * Create summary worksheet (Excel, not used in PDF)
 */
async function createSummarySheet(workbook: any, sessionDataList: SessionData[]) {
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

async function createDetailSheet(workbook: any, sessionDataList: SessionData[]) {
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
      status: getStatusText(session.status),
      totalCount: session.totalCount,
      totalAmount: session.totalAmount.toFixed(2),
      errorCount: session.errorCount,
      machineMode: session.machineMode || '-'
    });
  });

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

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

async function createDenominationSheet(workbook: any, sessionDataList: SessionData[]) {
  const worksheet = workbook.addWorksheet('Denomination');

  const denominationStats = calculateDenominationStats(sessionDataList);

  worksheet.columns = [
    { header: 'Denomination', key: 'denomination', width: 10 },
    { header: 'Count', key: 'count', width: 12 },
    { header: 'Amount', key: 'amount', width: 12 },
    { header: 'Percentage', key: 'percentage', width: 10 },
  ];

  denominationStats.forEach(stat => {
    worksheet.addRow({
      denomination: `¥${stat.denomination}`,
      count: stat.count,
      amount: stat.amount.toFixed(2),
      percentage: `${stat.percentage.toFixed(2)}%`
    });
  });

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
}

/**
 * Export to PDF - All tables and summaries use autoTable, all English, improved style, add TOC if multiple sessions
 */
async function exportToPDF(
  sessionDataList: SessionData[],
  _outputPath: string,
  filename: string,
): Promise<string> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  // --- Cover page ---
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

  // Add a Table of Contents page if there are multiple sessions
  // --- Statistics page ---
  // pdf.addPage();
  let currentY = coverY + 40;

  // Place a named destination for summary
  pdf.text('', 0, currentY, { // The text is empty, but this sets the cursor for .addPageMark below
    // no options
  });
  // (jsPDF does not have true named destinations; we'll use page numbers for navigation)

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.setTextColor(44, 130, 201);
  pdf.text('Summary Statistics', 15, currentY);

  const totalSessions = sessionDataList.length;
  const totalCount = sessionDataList.reduce((sum, session) => sum + session.totalCount, 0);
  const totalAmount = sessionDataList.reduce((sum, session) => sum + session.totalAmount, 0);
  const completedSessions = sessionDataList.filter(s => s.status === 'completed').length;
  const errorSessions = sessionDataList.filter(s => s.status === 'error').length;

  autoTable(pdf, {
    startY: currentY + 5,
    head: [['Item', 'Value', 'Unit']],
    body: [
      ['Total Sessions', totalSessions, ''],
      ['Total Notes', totalCount, 'notes'],
      ['Total Amount', totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2}), 'CNY'],
      ['Completed Sessions', completedSessions, ''],
      ['Error Sessions', errorSessions, ''],
      ['Success Rate', ((completedSessions / totalSessions) * 100).toFixed(2), '%'],
      ['Avg. Session Amount', (totalAmount / totalSessions).toFixed(2), 'CNY'],
    ],
    margin: { left: 15, right: 15 },
    theme: 'grid',
    styles: { font: 'helvetica', fontStyle: 'normal', fontSize: 10, cellPadding: 3, textColor: 60 },
    headStyles: { fillColor: [44, 130, 201], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [230, 245, 255] }
  });
  currentY = (pdf as any).lastAutoTable.finalY + 10;

  // --- Denomination Table ---
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.setTextColor(44, 130, 201);
  pdf.text('Denomination Statistics', 15, currentY);

  const denominationStats = calculateDenominationStats(sessionDataList);

  autoTable(pdf, {
    startY: currentY + 5,
    head: [['Denomination', 'Count', 'Amount', 'Percentage']],
    body: denominationStats.map(stat => [
      `¥${stat.denomination}`,
      stat.count,
      stat.amount.toLocaleString(undefined, {minimumFractionDigits: 2}),
      `${stat.percentage.toFixed(2)}%`
    ]),
    theme: 'striped',
    margin: { left: 15, right: 15 },
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 2 },
    headStyles: { fillColor: [44, 130, 201], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 250, 255] }
  });
  currentY = (pdf as any).lastAutoTable.finalY + 10;

  // --- Session List Table ---
  pdf.addPage();
  currentY = 15;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.setTextColor(44, 130, 201);
  pdf.text('Session Overview', 15, currentY);

  autoTable(pdf, {
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
        session.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2}),
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
  currentY = (pdf as any).lastAutoTable.finalY + 12;

  // --- Session Detail Sections ---
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
      `Start: ${session.startTime}   |   Notes: ${session.totalCount}   |   Amount: ¥${session.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}   ${session.errorCount ? `|   Errors: ${session.errorCount}` : ''}`,
      12,
      currentY + 7
    );
    currentY += 15;

    autoTable(pdf, {
      startY: currentY,
      head: [['No.', 'Timestamp', 'Denomination', 'Currency', 'Serial No.', 'Error Code', 'Status']],
      body: (session.details ?? []).map(detail => [
        detail.no,
        detail.timestamp,
        `¥${detail.denomination}`,
        detail.currencyCode,
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
      didParseCell: function (data) {
        // Highlight abnormal rows
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
        addPageFooter(pdf, pdf.getNumberOfPages(), sessionDataList.length, filename);
      }
    });
    currentY = (pdf as any).lastAutoTable.finalY + 8;

    // Session stats row
    const okCount = session.details!.filter(d => d.status !== 'error' && (!d.errorCode || d.errorCode === 'E0')).length;
    const errCount = session.details!.filter(d => d.status === 'error' || (d.errorCode && d.errorCode !== 'E0')).length;
    const breakdown = Array.from(session.denominationBreakdown.entries())
      .map(([denom, detail]) => `¥${denom}×${detail.count}`).join(', ');
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

  // --- Footer ---
  pdf.setFontSize(10);
  pdf.setTextColor(120, 120, 120);
  pdf.text(
    `Report generated at ${new Date().toLocaleString()}`,
    105,
    290,
    { align: 'center' }
  );
  pdf.text(
    `Contains ${totalSessions} sessions, a total of ${totalCount} notes`,
    105,
    295,
    { align: 'center' }
  );
  // Save PDF
  if (typeof window !== 'undefined') {
    pdf.save(`${filename}.pdf`);
    return `downloads/${filename}.pdf`;
  } else {
    // Node write file (omitted)
    return `downloads/${filename}.pdf`;
  }
}

function addPageFooter(pdf: jsPDF, pageNumber: number, totalSessions: number, filename: string) {
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
 * Calculate denomination statistics
 */
function calculateDenominationStats(sessionDataList: SessionData[]): DenominationSummary[] {
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
 * Get status text in English
 */
function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    'counting': 'Counting',
    'completed': 'Completed',
    'error': 'Error',
    'paused': 'Paused'
  };
  return statusMap[status] || status;
}

/**
 * Ensure directory exists (dummy, for browser)
 */
async function ensureDirectoryExists(dirPath: string): Promise<void> {
  // Simplified: assume exists or managed by caller
  console.log(`Ensuring directory exists: ${dirPath}`);
}

/**
 * Get file size (dummy, for browser)
 */
async function getFileSize(_filePath: string): Promise<number> {
  // Simplified: return 0
  return 0;
}

/**
 * Quick export function - Excel
 */
export async function exportSessionsToExcel(
  sessionDataList: SessionData[],
  filename?: string
): Promise<ConvertResult> {
  return convertSessionData(sessionDataList, {
    format: 'excel',
    filename: filename || `sessions_${Date.now()}`
  });
}

/**
 * Quick export function - PDF
 */
export async function exportSessionsToPDF(
  sessionDataList: SessionData[],
  filename?: string,
  includeCharts = false
): Promise<ConvertResult> {
  return convertSessionData(sessionDataList, {
    format: 'pdf',
    filename: filename || `sessions_${Date.now()}`,
    includeCharts
  });
}

async function createBanknoteDetailsSheet(workbook: any, sessionDataList: SessionData[]) {
  const worksheet = workbook.addWorksheet('Banknote Details');

  worksheet.columns = [
    { header: 'Session No.', key: 'sessionNo', width: 12 },
    { header: 'Session ID', key: 'sessionId', width: 10 },
    { header: 'Note No.', key: 'noteNo', width: 8 },
    { header: 'Timestamp', key: 'timestamp', width: 20 },
    { header: 'Denomination', key: 'denomination', width: 12 },
    { header: 'Currency Code', key: 'currencyCode', width: 12 },
    { header: 'Serial Number', key: 'serialNumber', width: 20 },
    { header: 'Error Code', key: 'errorCode', width: 10 },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Session Start Time', key: 'sessionStartTime', width: 20 },
  ];

  // Collect all banknote details from all sessions
  const allBanknoteDetails: any[] = [];
  
  sessionDataList.forEach(session => {
    if (session.details && session.details.length > 0) {
      session.details.forEach(detail => {
        allBanknoteDetails.push({
          sessionNo: session.no,
          sessionId: session.id,
          noteNo: detail.no,
          timestamp: detail.timestamp,
          denomination: `¥${detail.denomination}`,
          currencyCode: detail.currencyCode || 'CNY',
          serialNumber: detail.serialNumber || '-',
          errorCode: detail.errorCode && detail.errorCode !== 'E0' ? detail.errorCode : '-',
          status: (detail.status === 'error' || (detail.errorCode && detail.errorCode !== 'E0')) ? 'Error' : 'OK',
          sessionStartTime: session.startTime
        });
      });
    }
  });

  // Add all rows to worksheet
  worksheet.addRows(allBanknoteDetails);

  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A90E2' } };
  worksheet.getRow(1).font = { ...worksheet.getRow(1).font, color: { argb: 'FFFFFFFF' } };

  // Style status column with conditional formatting
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

  // Style denomination column
  worksheet.getColumn('denomination').eachCell((cell: any, rowNumber: number) => {
    if (rowNumber > 1) {
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center' };
    }
  });

  // Style serial number column - highlight if present
  worksheet.getColumn('serialNumber').eachCell((cell: any, rowNumber: number) => {
    if (rowNumber > 1 && cell.value && cell.value !== '-') {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
      cell.font = { bold: true };
    }
  });

  // Add alternating row colors for better readability
  for (let i = 2; i <= worksheet.rowCount; i++) {
    if (i % 2 === 0) {
      worksheet.getRow(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
    }
  }

  // Add summary at the top (insert rows)
  worksheet.insertRow(1, []);
  worksheet.insertRow(1, []);
  worksheet.insertRow(1, ['Banknote Details Summary']);
  worksheet.insertRow(2, [`Total Banknotes: ${allBanknoteDetails.length}`]);
  worksheet.insertRow(3, [`OK Notes: ${allBanknoteDetails.filter(note => note.status === 'OK').length}`]);
  worksheet.insertRow(4, [`Error Notes: ${allBanknoteDetails.filter(note => note.status === 'Error').length}`]);
  worksheet.insertRow(5, [`Notes with Serial Numbers: ${allBanknoteDetails.filter(note => note.serialNumber !== '-').length}`]);
  
  // Style summary section
  worksheet.getCell('A1').font = { bold: true, size: 14 };
  worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E5BBA' } };
  worksheet.getCell('A1').font = { ...worksheet.getCell('A1').font, color: { argb: 'FFFFFFFF' } };
  
  for (let i = 2; i <= 5; i++) {
    worksheet.getCell(`A${i}`).font = { bold: true };
    worksheet.getCell(`A${i}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
  }

  // Adjust header row (now at row 7)
  worksheet.getRow(7).font = { bold: true };
  worksheet.getRow(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A90E2' } };
  worksheet.getRow(7).font = { ...worksheet.getRow(7).font, color: { argb: 'FFFFFFFF' } };
}