import type jsPDF from 'jspdf';
import type { Training } from '../../types/database';
import type { TrainingExerciseRow } from './api';

function drawRink(doc: jsPDF, x: number, y: number, boxWidth: number, boxHeight: number) {
  const aspect = 2.4;
  let w = boxWidth;
  let h = w / aspect;
  if (h > boxHeight) {
    h = boxHeight;
    w = h * aspect;
  }
  const ox = x + (boxWidth - w) / 2;
  const oy = y + (boxHeight - h) / 2;
  const corner = h * 0.18;

  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(0.4);
  doc.roundedRect(ox, oy, w, h, corner, corner, 'S');

  doc.setDrawColor(200, 30, 30);
  doc.setLineWidth(0.6);
  doc.line(ox + w / 2, oy, ox + w / 2, oy + h);

  doc.setDrawColor(30, 60, 180);
  doc.setLineWidth(0.5);
  const blue1X = ox + w * 0.33;
  const blue2X = ox + w * 0.67;
  doc.line(blue1X, oy, blue1X, oy + h);
  doc.line(blue2X, oy, blue2X, oy + h);

  doc.setLineWidth(0.35);
  doc.circle(ox + w / 2, oy + h / 2, h * 0.16, 'S');
  doc.setFillColor(200, 30, 30);
  doc.circle(ox + w / 2, oy + h / 2, 0.5, 'F');

  const dotDX = w * 0.18;
  const dotDY = h * 0.26;
  const positions: [number, number][] = [
    [ox + dotDX, oy + h / 2 - dotDY],
    [ox + dotDX, oy + h / 2 + dotDY],
    [ox + w - dotDX, oy + h / 2 - dotDY],
    [ox + w - dotDX, oy + h / 2 + dotDY],
  ];
  doc.setDrawColor(200, 30, 30);
  for (const [px, py] of positions) {
    doc.circle(px, py, h * 0.09, 'S');
    doc.setFillColor(200, 30, 30);
    doc.circle(px, py, 0.45, 'F');
  }

  const goalLineOffset = w * 0.06;
  doc.setDrawColor(200, 30, 30);
  doc.setLineWidth(0.4);
  doc.line(ox + goalLineOffset, oy + h * 0.14, ox + goalLineOffset, oy + h * 0.86);
  doc.line(ox + w - goalLineOffset, oy + h * 0.14, ox + w - goalLineOffset, oy + h * 0.86);

  doc.setDrawColor(30, 60, 180);
  doc.setLineWidth(0.3);
  const creaseW = w * 0.045;
  const creaseH = h * 0.2;
  doc.roundedRect(ox + goalLineOffset, oy + h / 2 - creaseH / 2, creaseW, creaseH, creaseH * 0.4, creaseH * 0.4, 'S');
  doc.roundedRect(
    ox + w - goalLineOffset - creaseW,
    oy + h / 2 - creaseH / 2,
    creaseW,
    creaseH,
    creaseH * 0.4,
    creaseH * 0.4,
    'S',
  );

  doc.setDrawColor(0, 0, 0);
}

function fitLines(doc: jsPDF, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = doc.splitTextToSize(text, maxWidth);
  if (lines.length <= maxLines) return lines;
  const truncated = lines.slice(0, maxLines);
  truncated[maxLines - 1] = truncated[maxLines - 1].replace(/\s+$/, '') + '…';
  return truncated;
}

export async function exportTrainingPdf(training: Training, teamLabel: string, exercises: TrainingExerciseRow[]) {
  const { default: JsPDF } = await import('jspdf');
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const leftWidth = pageWidth * 0.55 - margin * 1.5;
  const rightX = margin + leftWidth + 6;
  const rightWidth = pageWidth - rightX - margin;

  let y = margin + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Trainingsplan', margin, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(teamLabel, margin, y);
  y += 5;
  const dateLabel = new Date(`${training.date}T00:00:00`).toLocaleDateString('de-CH', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  doc.text(
    `${dateLabel}${training.start_time ? ' · ' + training.start_time.slice(0, 5) + ' Uhr' : ''} · ${training.duration_minutes} Min.`,
    margin,
    y,
  );
  y += 6;

  if (training.notes) {
    doc.setFontSize(8.5);
    const lines = fitLines(doc, training.notes, leftWidth, 3);
    doc.text(lines, margin, y);
    y += lines.length * 3.6 + 3;
  }

  const availableHeight = pageHeight - margin - y;
  const exerciseFontSize = Math.max(6.5, Math.min(9, availableHeight / Math.max(exercises.length, 1) / 1.9));
  const lineHeight = exerciseFontSize * 0.42;

  doc.setFontSize(exerciseFontSize);
  let renderedCount = 0;
  for (const ex of exercises) {
    if (y > pageHeight - margin - lineHeight * 2) break;
    doc.setFont('helvetica', 'bold');
    doc.text(`${ex.duration_minutes}' – ${ex.exerciseTitle}`, margin, y);
    y += lineHeight;
    if (ex.notes) {
      doc.setFont('helvetica', 'normal');
      const noteLines = fitLines(doc, ex.notes, leftWidth - 3, 2);
      doc.text(noteLines, margin + 3, y);
      y += noteLines.length * lineHeight;
    }
    y += lineHeight * 0.4;
    renderedCount++;
  }
  if (renderedCount < exercises.length) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(180, 60, 60);
    doc.text(`+ ${exercises.length - renderedCount} weitere Übung(en) – siehe App`, margin, y);
    doc.setTextColor(0, 0, 0);
    y += lineHeight;
  }

  const rinkGap = 8;
  const rinkHeight = (pageHeight - margin * 2 - rinkGap) / 2;
  drawRink(doc, rightX, margin, rightWidth, rinkHeight);
  drawRink(doc, rightX, margin + rinkHeight + rinkGap, rightWidth, rinkHeight);

  const safeName = `training-${training.date}`.replace(/[\s/\\]+/g, '_');
  doc.save(`${safeName}.pdf`);
}
