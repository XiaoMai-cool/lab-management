import * as XLSX from 'xlsx';

/**
 * 导出数据为 Excel (.xlsx) 文件
 * @param data 数据数组
 * @param filename 文件名（不含扩展名）
 * @param sheetName 工作表名称
 */
export function downloadExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName = 'Sheet1'
) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // 自动调整列宽
  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    ws['!cols'] = headers.map((h) => {
      const maxLen = Math.max(
        h.length,
        ...data.map((row) => {
          const val = row[h];
          return val === null || val === undefined ? 0 : String(val).length;
        })
      );
      return { wch: Math.min(maxLen + 2, 40) };
    });
  }

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function downloadMultiSheetExcel(
  sheets: { name: string; data: Record<string, unknown>[] }[],
  filename: string
) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.data);
    if (sheet.data.length > 0) {
      const headers = Object.keys(sheet.data[0]);
      ws['!cols'] = headers.map((h) => {
        const maxLen = Math.max(
          h.length,
          ...sheet.data.map((row) => {
            const val = row[h];
            return val === null || val === undefined ? 0 : String(val).length;
          })
        );
        return { wch: Math.min(maxLen + 2, 40) };
      });
    }
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
