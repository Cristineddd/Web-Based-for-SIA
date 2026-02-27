import jsPDF from 'jspdf';
import {
  GC_FULL_NAME,
  GC_SYSTEM_NAME,
  GC_PRIMARY,
  GC_GOLD,
  GC_TEXT_MUTED,
  loadGCLogoBase64,
} from '@/lib/gcBranding';

interface Exam {
  id: string;
  title: string;
  subject: string;
  num_items: number;
  choices_per_item: number;
  student_id_length?: number;
}

export async function generateAnswerSheetPDF(exam: Exam, copies: number = 1) {
  const logoBase64 = await loadGCLogoBase64();
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const bubbleRadius = 3;
  const bubbleSpacing = 8;

  for (let copy = 0; copy < copies; copy++) {
    if (copy > 0) {
      doc.addPage();
    }

    // ── GC Brand bar + logo header ──
    doc.setFillColor(...GC_PRIMARY);
    doc.rect(0, 0, pageWidth, 3, 'F');
    doc.setFillColor(...GC_GOLD);
    doc.rect(0, 3, pageWidth, 0.6, 'F');

    let yPos = 8;

    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', margin, yPos - 2, 10, 10);
      } catch { /* skip logo */ }
    }
    const logoOffset = logoBase64 ? 13 : 0;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GC_PRIMARY);
    doc.text(GC_FULL_NAME, margin + logoOffset, yPos + 2);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GC_TEXT_MUTED);
    doc.text(GC_SYSTEM_NAME, margin + logoOffset, yPos + 6);
    doc.setTextColor(0);

    yPos = 22;

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(exam.title, margin, yPos);
    yPos += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Subject: ${exam.subject}`, margin, yPos);
    doc.text(`Items: ${exam.num_items}`, pageWidth - margin - 30, yPos);
    yPos += 10;

    // Student Name field
    doc.setFontSize(10);
    doc.text('Name:', margin, yPos);
    doc.line(margin + 15, yPos, pageWidth / 2 - 10, yPos);
    
    doc.text('Date:', pageWidth / 2, yPos);
    doc.line(pageWidth / 2 + 15, yPos, pageWidth - margin, yPos);
    yPos += 10;

    // Student ID Section
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Student ID', margin, yPos);
    yPos += 6;

    // Student ID bubbles
    const idStartX = margin;
    const idLength = exam.student_id_length ?? 8;
    for (let digit = 0; digit < idLength; digit++) {
      const x = idStartX + digit * (bubbleSpacing + bubbleRadius * 2);
      
      // Column header
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(String(digit + 1), x + bubbleRadius - 1, yPos);
      
      // Draw bubbles for 0-9
      for (let num = 0; num < 10; num++) {
        const bubbleY = yPos + 4 + num * bubbleSpacing;
        doc.circle(x + bubbleRadius, bubbleY, bubbleRadius);
        
        // Number label
        doc.setFontSize(6);
        doc.text(String(num), x + bubbleRadius - 1, bubbleY + 1);
      }
    }

    yPos += 4 + 10 * bubbleSpacing + 8;

    // Divider line
    doc.setDrawColor(200);
    doc.line(margin, yPos - 3, pageWidth - margin, yPos - 3);
    doc.setDrawColor(0);

    // Answer Section
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Answers', margin, yPos);
    yPos += 6;

    // Calculate columns for answers
    const choiceLabels = 'ABCDEF'.slice(0, exam.choices_per_item).split('');
    const answerColumnWidth = 8 + exam.choices_per_item * bubbleSpacing;
    const maxColumns = Math.floor((pageWidth - 2 * margin) / answerColumnWidth);
    const columnsToUse = Math.min(maxColumns, 5);
    const itemsPerColumn = Math.ceil(exam.num_items / columnsToUse);
    
    const answerStartY = yPos;
    const availableHeight = pageHeight - yPos - margin - 10;
    const rowHeight = Math.min(bubbleSpacing, availableHeight / itemsPerColumn);

    for (let item = 1; item <= exam.num_items; item++) {
      const column = Math.floor((item - 1) / itemsPerColumn);
      const row = (item - 1) % itemsPerColumn;
      
      const x = margin + column * answerColumnWidth;
      const y = answerStartY + row * rowHeight;

      // Item number
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      const itemText = String(item);
      doc.text(itemText, x, y + 2);

      // Choice bubbles
      doc.setFont('helvetica', 'normal');
      choiceLabels.forEach((label, choiceIndex) => {
        const bubbleX = x + 8 + choiceIndex * bubbleSpacing;
        doc.circle(bubbleX, y, bubbleRadius);
        doc.setFontSize(6);
        doc.text(label, bubbleX - 1, y + 1);
      });
    }

    // Footer — GC Branding
    doc.setFillColor(...GC_GOLD);
    doc.rect(0, pageHeight - 3, pageWidth, 0.5, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...GC_TEXT_MUTED);
    doc.text(
      `${GC_FULL_NAME} \u2022 ${GC_SYSTEM_NAME} | ${new Date().toLocaleDateString()}`,
      margin,
      pageHeight - 5
    );
    doc.text(
      `Page ${copy + 1} of ${copies}`,
      pageWidth - margin - 25,
      pageHeight - 5
    );
    doc.setTextColor(0);
  }

  // Download the PDF
  doc.save(`${exam.title.replace(/\s+/g, '_')}_answer_sheet.pdf`);
}
