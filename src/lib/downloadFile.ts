export function downloadTextFile(filename: string, content: string, mimeType = 'text/csv;charset=utf-8') {
  // BOM voranstellen, damit Excel die Datei als UTF-8 erkennt statt als ANSI
  // (sonst werden ü/ä/ö/Ü/Ä/Ö beim Öffnen falsch dargestellt).
  const withBom = mimeType.includes('csv') ? `\uFEFF${content}` : content;
  const blob = new Blob([withBom], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
