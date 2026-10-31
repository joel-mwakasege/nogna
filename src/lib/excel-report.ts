import ExcelJS from 'exceljs';

export interface InvoiceExcelRow {
  issue_date: string;
  currency: string;
  customer_name: string;
  project_events?: string;
  location?: string;
  document_number: string;
  subtotal: number;
  tax_percent: number;
  tax_amount: number;
  total_amount: number;
  paid?: number;
  balance?: number;
  status: string;
}

interface ExportOptions {
  allInvoices: InvoiceExcelRow[];
  monthlyInvoices: InvoiceExcelRow[];
  dateFrom: string;
  dateTo: string;
  companyName?: string | null;
}

const NAVY = '44546A';
const LIGHT_BLUE = 'D9EAF7';
const PAID_GREEN = 'CCFFCC';
const OPEN_YELLOW = 'FFFFC0';
const WHITE = 'FFFFFF';
const BORDER = 'B7B7B7';
const DARK = '1C1C1C';

const moneyFormat = '#,##0.00;[Red]-#,##0.00;-';
const dateFormat = 'mmm d, yyyy';

const toExcelDate = (value: string) => {
  const date = new Date(value + (value.length === 10 ? 'T00:00:00' : ''));
  return Number.isNaN(date.getTime()) ? value : date;
};

const normalizeStatus = (row: InvoiceExcelRow) => {
  const balance = Number(row.balance || 0);
  const paid = Number(row.paid || 0);
  if (balance <= 0 && Number(row.total_amount || 0) > 0) return 'Paid';
  if (paid > 0) return 'Partially Paid';
  return 'Unpaid';
};

const applyBorder = (cell: ExcelJS.Cell) => {
  cell.border = {
    top: { style: 'thin', color: { argb: BORDER } },
    left: { style: 'thin', color: { argb: BORDER } },
    bottom: { style: 'thin', color: { argb: BORDER } },
    right: { style: 'thin', color: { argb: BORDER } },
  };
};

const styleTitle = (sheet: ExcelJS.Worksheet, range: string, text: string) => {
  sheet.mergeCells(range);
  const cell = sheet.getCell(range.split(':')[0]);
  cell.value = text;
  cell.font = { name: 'Arial', size: 16, bold: true, color: { argb: WHITE } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(cell.row).height = 26;
};

const styleHeaderRow = (row: ExcelJS.Row) => {
  row.height = 30;
  row.eachCell(cell => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    applyBorder(cell);
  });
};

const styleBody = (sheet: ExcelJS.Worksheet, firstRow: number, lastRow: number, lastCol: number) => {
  for (let r = firstRow; r <= lastRow; r += 1) {
    const row = sheet.getRow(r);
    row.height = 22;
    for (let c = 1; c <= lastCol; c += 1) {
      const cell = row.getCell(c);
      cell.font = { name: 'Arial', size: 10, color: { argb: DARK } };
      cell.alignment = { vertical: 'middle', wrapText: c >= 3 && c <= 5 };
      applyBorder(cell);
    }
  }
};

export async function exportInvoiceWorkbook(options: ExportOptions) {
  const { allInvoices, monthlyInvoices, dateFrom, dateTo, companyName } = options;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Nogna';
  workbook.company = companyName || 'Kilimanjaro Audio Visual Services';
  workbook.created = new Date();

  const company = (companyName || 'KILIMANJARO AUDIO VISUAL SERVICES').toUpperCase();

  // Sheet 1: master invoice register
  const main = workbook.addWorksheet('Invoice Main', {
    views: [{ state: 'frozen', ySplit: 5 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  main.columns = [
    { width: 15 }, { width: 24 }, { width: 26 }, { width: 20 }, { width: 18 },
    { width: 12 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 },
    { width: 18 }, { width: 16 },
  ];
  styleTitle(main, 'A1:L1', 'INVOICE MAIN');
  main.mergeCells('A2:L2');
  main.getCell('A2').value = company;
  main.getCell('A2').font = { name: 'Arial', size: 12, bold: true, color: { argb: NAVY } };
  main.getCell('A2').alignment = { horizontal: 'center' };
  main.mergeCells('A3:L3');
  main.getCell('A3').value = 'This is where we track all invoices and their reported payments.';
  main.getCell('A3').font = { name: 'Arial', size: 10, italic: true, color: { argb: '666666' } };
  main.getCell('A3').alignment = { horizontal: 'center' };

  const mainHeader = main.getRow(5);
  mainHeader.values = ['Invoice date','Company/Client','Project/Events','Location','Invoice number','Tax Rate (VAT)','Exclusive Amount','VAT Amount','Total Amount','Paid','Balance','Status'];
  styleHeaderRow(mainHeader);

  allInvoices.forEach(inv => {
    const row = main.addRow([
      toExcelDate(inv.issue_date), inv.customer_name, inv.project_events || '', inv.location || '',
      inv.document_number, Number(inv.tax_percent || 0) / 100, Number(inv.subtotal || 0),
      Number(inv.tax_amount || 0), Number(inv.total_amount || 0), Number(inv.paid || 0),
      Number(inv.balance || 0), normalizeStatus(inv),
    ]);
    row.getCell(1).numFmt = dateFormat;
    row.getCell(6).numFmt = '0.00%';
    for (let c = 7; c <= 11; c += 1) row.getCell(c).numFmt = moneyFormat;
    const status = row.getCell(12);
    status.font = { name: 'Arial', size: 10, bold: true, color: { argb: DARK } };
    status.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: normalizeStatus(inv) === 'Paid' ? PAID_GREEN : OPEN_YELLOW } };
  });
  const mainFirst = 6;
  const mainLast = Math.max(5, main.rowCount);
  if (mainLast >= mainFirst) styleBody(main, mainFirst, mainLast, 12);
  main.autoFilter = { from: 'A5', to: `L${mainLast}` };

  const mainTotalsRow = main.addRow(['','','','','','TOTALS',
    { formula: `SUM(G${mainFirst}:G${mainLast})` },
    { formula: `SUM(H${mainFirst}:H${mainLast})` },
    { formula: `SUM(I${mainFirst}:I${mainLast})` },
    { formula: `SUM(J${mainFirst}:J${mainLast})` },
    { formula: `SUM(K${mainFirst}:K${mainLast})` }, ''
  ]);
  mainTotalsRow.height = 24;
  mainTotalsRow.eachCell((cell, col) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    applyBorder(cell);
    if (col >= 7 && col <= 11) cell.numFmt = moneyFormat;
  });

  // Sheet 2: selected month/date-range ledger
  const ledger = workbook.addWorksheet('Sales Ledger', {
    views: [{ state: 'frozen', ySplit: 6 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ledger.columns = [
    { width: 15 }, { width: 18 }, { width: 26 }, { width: 20 }, { width: 18 },
    { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 16 },
  ];
  styleTitle(ledger, 'A1:J1', 'SALES LEDGER');
  ledger.mergeCells('A2:J2');
  ledger.getCell('A2').value = company;
  ledger.getCell('A2').font = { name: 'Arial', size: 12, bold: true, color: { argb: NAVY } };
  ledger.getCell('A2').alignment = { horizontal: 'center' };
  ledger.mergeCells('A3:J3');
  ledger.getCell('A3').value = `Report period: ${dateFrom} to ${dateTo}`;
  ledger.getCell('A3').font = { name: 'Arial', size: 10, bold: true, color: { argb: NAVY } };
  ledger.getCell('A3').alignment = { horizontal: 'center' };
  ledger.mergeCells('A4:J4');
  ledger.getCell('A4').value = 'This is where we track sales for the selected reporting period, including paid, partially paid and unpaid invoices.';
  ledger.getCell('A4').font = { name: 'Arial', size: 10, italic: true, color: { argb: '666666' } };
  ledger.getCell('A4').alignment = { horizontal: 'center' };

  const ledgerHeader = ledger.getRow(6);
  ledgerHeader.values = ['INVOICE DATE','INVOICE NO','CLIENT NAME','CURRENCY','EXCL','VAT','TOTAL','PAID','BALANCE','REMARKS'];
  styleHeaderRow(ledgerHeader);

  monthlyInvoices.forEach(inv => {
    const row = ledger.addRow([
      toExcelDate(inv.issue_date), inv.document_number, inv.customer_name, inv.currency,
      Number(inv.subtotal || 0), Number(inv.tax_amount || 0), Number(inv.total_amount || 0),
      Number(inv.paid || 0), Number(inv.balance || 0), normalizeStatus(inv),
    ]);
    row.getCell(1).numFmt = dateFormat;
    for (let c = 5; c <= 9; c += 1) row.getCell(c).numFmt = moneyFormat;
    const remarks = row.getCell(10);
    remarks.font = { name: 'Arial', size: 10, bold: true, color: { argb: DARK } };
    remarks.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: normalizeStatus(inv) === 'Paid' ? PAID_GREEN : OPEN_YELLOW } };
  });
  const ledgerFirst = 7;
  const ledgerLast = Math.max(6, ledger.rowCount);
  if (ledgerLast >= ledgerFirst) styleBody(ledger, ledgerFirst, ledgerLast, 10);
  ledger.autoFilter = { from: 'A6', to: `J${ledgerLast}` };

  const ledgerTotals = ledger.addRow(['','','','TOTALS',
    { formula: `SUM(E${ledgerFirst}:E${ledgerLast})` },
    { formula: `SUM(F${ledgerFirst}:F${ledgerLast})` },
    { formula: `SUM(G${ledgerFirst}:G${ledgerLast})` },
    { formula: `SUM(H${ledgerFirst}:H${ledgerLast})` },
    { formula: `SUM(I${ledgerFirst}:I${ledgerLast})` }, ''
  ]);
  ledgerTotals.height = 24;
  ledgerTotals.eachCell((cell, col) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    applyBorder(cell);
    if (col >= 5 && col <= 9) cell.numFmt = moneyFormat;
  });

  // A small summary block makes the exported file immediately usable.
  const summaryStart = ledgerTotals.number + 2;
  ledger.getCell(`D${summaryStart}`).value = 'PERIOD SUMMARY';
  ledger.getCell(`D${summaryStart}`).font = { name: 'Arial', bold: true, color: { argb: WHITE } };
  ledger.getCell(`D${summaryStart}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  const summary = [
    ['Total Invoiced', { formula: `SUM(G${ledgerFirst}:G${ledgerLast})` }],
    ['Total Paid', { formula: `SUM(H${ledgerFirst}:H${ledgerLast})` }],
    ['Outstanding', { formula: `SUM(I${ledgerFirst}:I${ledgerLast})` }],
  ];
  summary.forEach((item, index) => {
    const r = summaryStart + 1 + index;
    ledger.getCell(`D${r}`).value = item[0] as string;
    ledger.getCell(`E${r}`).value = item[1] as ExcelJS.CellValue;
    ledger.getCell(`E${r}`).numFmt = moneyFormat;
    for (let c = 4; c <= 5; c += 1) {
      const cell = ledger.getRow(r).getCell(c);
      applyBorder(cell);
      cell.font = { name: 'Arial', size: 10, bold: c === 4 };
      if (index === 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: OPEN_YELLOW } };
      else if (index === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PAID_GREEN } };
      else cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice-report-${dateFrom}-to-${dateTo}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
