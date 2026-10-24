import ExcelJS from "exceljs";
import { parseCsv } from "./csv";

export interface Sheet {
  name: string;
  rows: string[][];
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("").trim();
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("text" in v) return String(v.text).trim();
    return "";
  }
  return String(v).trim();
}

/** Read a CSV or .xlsx upload into plain rows of text, one entry per sheet. */
export async function readSheets(file: File): Promise<Sheet[]> {
  const isXlsx = /\.xlsx$/i.test(file.name) || file.type.includes("spreadsheetml");
  if (!isXlsx) {
    if (/\.xls$/i.test(file.name)) throw new Error("Old .xls files aren't supported. Save the report as .xlsx or .csv.");
    return [{ name: file.name, rows: parseCsv(await file.text()) }];
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as ExcelJS.Buffer);
  return wb.worksheets.map((ws) => {
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (c, col) => {
        cells[col - 1] = cellText(c.value);
      });
      rows.push(Array.from(cells, (x) => x ?? ""));
    });
    return { name: ws.name, rows };
  });
}
