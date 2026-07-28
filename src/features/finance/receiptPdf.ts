import type jsPDF from 'jspdf';
import type { ReceiptRow } from './api';

interface LoadedImage {
  dataUrl: string;
  format: string;
  width: number;
  height: number;
}

function mimeToFormat(mime: string): string {
  if (mime.includes('png')) return 'PNG';
  if (mime.includes('webp')) return 'WEBP';
  return 'JPEG';
}

async function loadImage(url: string): Promise<LoadedImage | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('Bild konnte nicht geladen werden.'));
      img.src = dataUrl;
    });
    return { dataUrl, format: mimeToFormat(blob.type), width, height };
  } catch {
    return null;
  }
}

function addReceiptPage(doc: jsPDF, receipt: ReceiptRow, bookingNumber: number, isFirstPage: boolean, image: LoadedImage | null) {
  if (!isFirstPage) doc.addPage();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 20;

  doc.setFontSize(16);
  doc.text(`Beleg Nr. ${bookingNumber}`, 14, y);
  y += 10;

  doc.setFontSize(11);
  doc.text(`Datum: ${new Date(`${receipt.date}T00:00:00`).toLocaleDateString('de-CH')}`, 14, y);
  y += 7;
  doc.text(`Typ: ${receipt.type === 'income' ? 'Einnahme' : 'Ausgabe'}`, 14, y);
  y += 7;
  doc.text(`Betrag: ${receipt.type === 'income' ? '+' : '-'}CHF ${receipt.amount.toFixed(2)}`, 14, y);
  y += 7;
  doc.text(
    `Empfänger: ${receipt.recipient_name} (${receipt.recipient_type === 'company' ? 'Firma' : 'Person'})`,
    14,
    y,
  );
  y += 7;
  if (receipt.notes) {
    const lines = doc.splitTextToSize(`Notizen: ${receipt.notes}`, pageWidth - 28);
    doc.text(lines, 14, y);
    y += lines.length * 6;
  }
  y += 6;

  if (image) {
    const maxWidth = pageWidth - 28;
    const maxHeight = pageHeight - y - 14;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    doc.addImage(image.dataUrl, image.format, 14, y, image.width * scale, image.height * scale);
  } else if (receipt.photo_path) {
    doc.setFontSize(10);
    doc.setTextColor(180, 60, 60);
    doc.text('(Foto konnte nicht geladen werden)', 14, y);
    doc.setTextColor(0, 0, 0);
  } else {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('Kein Foto vorhanden.', 14, y);
    doc.setTextColor(0, 0, 0);
  }
}

function safeFileName(name: string): string {
  return name.replace(/[\s/\\]+/g, '_');
}

export async function exportReceiptPdf(receipt: ReceiptRow, bookingNumber: number) {
  const { default: JsPDF } = await import('jspdf');
  const doc = new JsPDF();
  const image = receipt.photoUrl ? await loadImage(receipt.photoUrl) : null;
  addReceiptPage(doc, receipt, bookingNumber, true, image);
  doc.save(`${safeFileName(`beleg-${bookingNumber}-${receipt.recipient_name}`)}.pdf`);
}

export async function exportAllReceiptsPdf(
  rows: (ReceiptRow & { bookingNumber: number })[],
  teamName: string,
  season: string,
) {
  const { default: JsPDF } = await import('jspdf');
  const doc = new JsPDF();
  for (let i = 0; i < rows.length; i++) {
    const receipt = rows[i];
    const image = receipt.photoUrl ? await loadImage(receipt.photoUrl) : null;
    addReceiptPage(doc, receipt, receipt.bookingNumber, i === 0, image);
  }
  doc.save(`${safeFileName(`belege-${teamName}-${season}`)}.pdf`);
}
