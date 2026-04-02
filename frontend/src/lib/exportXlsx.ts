import * as XLSX from 'xlsx';

/** Write an array of sheet definitions to a single .xlsx file and trigger browser download. */
export function downloadXlsx(
  filename: string,
  sheets: Array<{
    name: string;
    rows: Record<string, string | number | null | undefined>[];
  }>
) {
  const wb = XLSX.utils.book_new();

  for (const { name, rows } of sheets) {
    if (rows.length === 0) {
      const ws = XLSX.utils.aoa_to_sheet([['No data available']]);
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
      continue;
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    // Auto-width approximation
    const cols = Object.keys(rows[0]).map(k => ({
      wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? '').length)) + 2,
    }));
    ws['!cols'] = cols;
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }

  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/** Format a number as Philippine Peso string for export cells. */
export function pesoStr(value: number | null | undefined): string {
  if (value == null) return '—';
  return `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

/** Format a percentage. */
export function pctStr(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${Number(value).toFixed(1)}%`;
}
