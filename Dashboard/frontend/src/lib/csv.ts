export type CsvValue = string | number | null | undefined;

function escapeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) return '';

  const text = String(value);

  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function buildCsv(rows: CsvValue[][]): string {
  return rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n');
}

export function downloadCsv(filename: string, rows: CsvValue[][]): void {
  const blob = new Blob([`\uFEFF${buildCsv(rows)}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
