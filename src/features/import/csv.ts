/** Minimal RFC 4180 CSV reader: quoted fields, escaped quotes, CRLF/LF, BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Turn rows into objects keyed by lower-cased, trimmed header. Returns null if no row matches `isHeader`. */
export function toRecords(
  rows: string[][],
  isHeader: (cells: string[]) => boolean,
): Record<string, string>[] | null {
  const at = rows.findIndex(isHeader);
  if (at < 0) return null;
  const headers = rows[at].map((h) => h.trim().toLowerCase());
  return rows.slice(at + 1).map((r) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h) rec[h] = (r[i] ?? "").trim();
    });
    return rec;
  });
}
