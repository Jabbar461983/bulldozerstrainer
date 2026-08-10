function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Bild konnte nicht geladen werden.'));
    img.src = src;
  });
}

export async function svgToJpegBlob(svgEl: SVGSVGElement, scale = 2): Promise<Blob> {
  const viewBox = svgEl.viewBox.baseVal;
  const width = viewBox.width * scale;
  const height = viewBox.height * scale;

  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  // Auswahl-Markierungen und Zieh-Griffe sind nur Editor-Hilfsmittel und
  // sollen nicht im exportierten Bild landen.
  clone.querySelectorAll('[data-sketch-ui="true"]').forEach((el) => el.remove());

  const svgString = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas wird nicht unterstützt.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Export fehlgeschlagen.'))),
        'image/jpeg',
        0.92,
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
