import type jsPDF from 'jspdf';
import type { Training, SeasonPlanningCategory } from '../../types/database';
import type { TrainingExerciseRow } from './api';
import { addMinutesToTime } from '../../lib/dates';
import { SEASON_CATEGORY_NAMES } from '../seasonplanning/categories';

export interface TrainingPdfSeasonFocus {
  category: SeasonPlanningCategory;
  content: string;
}

export interface TrainingPdfExtras {
  absentPlayerNames: string[];
  seasonFocuses: TrainingPdfSeasonFocus[];
  showExerciseDescriptions: boolean;
}

const EXERCISE_COLORS: [number, number, number][] = [
  [186, 153, 14], // Club-Gold
  [0, 112, 87], // Club-Grün
];

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

interface LoadedImage {
  dataUrl: string;
  ratio: number;
}

function loadImageAsDataUrl(url: string): Promise<LoadedImage | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.85), ratio: img.naturalWidth / img.naturalHeight });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function exportTrainingPdf(
  training: Training,
  teamLabel: string,
  exercises: TrainingExerciseRow[],
  extras: TrainingPdfExtras,
) {
  const { default: JsPDF } = await import('jspdf');
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const colGap = 8;
  const colWidth = (contentWidth - colGap) / 2;
  let y = margin;

  function ensureSpace(needed: number) {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  function drawTwoColumnSection(leftLabel: string, leftText: string, rightLabel: string, rightText: string) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const leftLines: string[] = leftText ? doc.splitTextToSize(leftText, colWidth) : [];
    const rightLines: string[] = rightText ? doc.splitTextToSize(rightText, colWidth) : [];
    const maxLines = Math.max(leftLines.length, rightLines.length);
    ensureSpace(5 + maxLines * 4 + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(leftLabel, margin, y);
    doc.text(rightLabel, margin + colWidth + colGap, y);

    const textY = y + 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    if (leftLines.length) doc.text(leftLines, margin, textY);
    if (rightLines.length) doc.text(rightLines, margin + colWidth + colGap, textY);

    y = textY + maxLines * 4 + 6;
  }

  const [exerciseImages, logo] = await Promise.all([
    Promise.all(
      exercises.map((ex) => {
        const images = ex.media.filter((m) => m.type === 'image' && m.url);
        return Promise.all(images.map((m) => loadImageAsDataUrl(m.url as string)));
      }),
    ),
    loadImageAsDataUrl('/logo-bulldozers_farbig.png'),
  ]);

  // Kopfbereich
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  const dateLabel = new Date(`${training.date}T00:00:00`).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  doc.text(`Trainingsdatum: ${dateLabel}`, margin, y + 6);
  doc.setFontSize(12);
  const timeLine = training.start_time
    ? `${training.start_time.slice(0, 5)} – ${training.duration_minutes} Minuten`
    : `${training.duration_minutes} Minuten`;
  doc.text(timeLine, margin, y + 13);

  if (logo) {
    const logoWidth = 20;
    const logoHeight = logoWidth / logo.ratio;
    doc.addImage(logo.dataUrl, 'JPEG', pageWidth - margin - logoWidth, y - 2, logoWidth, logoHeight);
  }
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(teamLabel, margin, y);
  y += 8;

  // Notizen / Informationen
  drawTwoColumnSection('Notizen', training.notes ?? '', 'Informationen', training.information ?? '');

  // Abmeldungen / Saisonplanung Schwerpunkte
  const absencesText =
    extras.absentPlayerNames.length > 0 ? extras.absentPlayerNames.join(', ') : 'Niemand abgemeldet.';
  const seasonFocusText =
    extras.seasonFocuses.length > 0
      ? extras.seasonFocuses.map((f) => `${SEASON_CATEGORY_NAMES[f.category]}: ${f.content}`).join('\n')
      : 'Keine Schwerpunkte hinterlegt.';
  drawTwoColumnSection('Abmeldungen', absencesText, 'Saisonplanung Schwerpunkte', seasonFocusText);

  // Übungen
  const showDescriptions = extras.showExerciseDescriptions;
  const imageColWidth = 60;
  const textAreaWidth = contentWidth - imageColWidth - colGap;
  const subGap = 6;
  const subColWidth = (textAreaWidth - subGap) / 2;
  const descX = margin;
  const notesX = showDescriptions ? margin + subColWidth + subGap : margin;
  const notesWidth = showDescriptions ? subColWidth : textAreaWidth;
  const imageX = margin + textAreaWidth + colGap;
  const lineH = 3.8;
  const minImageHeight = 38;

  let cursorClock = training.start_time;

  exercises.forEach((ex, i) => {
    const startClock = cursorClock;
    const endClock = cursorClock ? addMinutesToTime(cursorClock, ex.duration_minutes) : null;
    if (cursorClock) cursorClock = endClock;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const descLines: string[] =
      showDescriptions && ex.exerciseDescription ? doc.splitTextToSize(ex.exerciseDescription, subColWidth) : [];
    const notesLines: string[] = ex.notes ? doc.splitTextToSize(ex.notes, notesWidth) : [];
    const coachingQuestionLines: string[] = ex.exerciseCoachingQuestions
      ? doc.splitTextToSize(ex.exerciseCoachingQuestions, contentWidth)
      : [];
    const textBlockHeight = 5 + Math.max(descLines.length, notesLines.length) * lineH;
    const images = exerciseImages[i].filter((img): img is LoadedImage => img !== null);
    const bodyHeight = Math.max(textBlockHeight, images.length > 0 ? minImageHeight : 0);
    const coachingQuestionsHeight = coachingQuestionLines.length
      ? 5 + coachingQuestionLines.length * lineH + 3
      : 0;
    const titleHeight = 7;
    const blockHeight = titleHeight + bodyHeight + coachingQuestionsHeight + 8;

    ensureSpace(blockHeight);

    const color = EXERCISE_COLORS[i % EXERCISE_COLORS.length];
    const timeText =
      startClock && endClock
        ? `${startClock.slice(0, 5)} – ${endClock.slice(0, 5)} Uhr – ${ex.duration_minutes} Minuten`
        : `${ex.duration_minutes} Minuten`;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const timeTextWidth = doc.getTextWidth(timeText);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(color[0], color[1], color[2]);
    const maxTitleWidth = contentWidth - timeTextWidth - 6;
    const titleText = `Übung ${i + 1}: ${ex.exerciseTitle}`;
    const titleLines: string[] = doc.splitTextToSize(titleText, maxTitleWidth);
    doc.text(titleLines[0] + (titleLines.length > 1 ? '…' : ''), margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(timeText, margin + contentWidth, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += titleHeight;

    const bodyTop = y;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    if (showDescriptions) doc.text('Beschreibung:', descX, y);
    doc.text('Notizen:', notesX, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const textY = y + 5;
    if (descLines.length) doc.text(descLines, descX, textY);
    if (notesLines.length) doc.text(notesLines, notesX, textY);

    if (images.length > 0) {
      const imgGap = 2;
      const slotWidth = (imageColWidth - imgGap * (images.length - 1)) / images.length;
      images.forEach((img, imgIndex) => {
        let drawW = slotWidth;
        let drawH = drawW / img.ratio;
        if (drawH > bodyHeight) {
          drawH = bodyHeight;
          drawW = drawH * img.ratio;
        }
        const slotX = imageX + imgIndex * (slotWidth + imgGap);
        doc.addImage(img.dataUrl, 'JPEG', slotX + (slotWidth - drawW) / 2, bodyTop, drawW, drawH);
      });
    }

    y = bodyTop + bodyHeight;

    if (coachingQuestionLines.length) {
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text('Coachingfragen:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(coachingQuestionLines, margin, y + 5);
      y += 5 + coachingQuestionLines.length * lineH;
    }

    y += 8;
  });

  // Eisfeld-Skizzen am Ende
  ensureSpace(50);
  const rinkGap = 10;
  const rinkWidth = (contentWidth - rinkGap) / 2;
  const rinkHeight = 42;
  drawRink(doc, margin, y, rinkWidth, rinkHeight);
  drawRink(doc, margin + rinkWidth + rinkGap, y, rinkWidth, rinkHeight);

  const safeName = `training-${training.date}`.replace(/[\s/\\]+/g, '_');
  doc.save(`${safeName}.pdf`);
}
