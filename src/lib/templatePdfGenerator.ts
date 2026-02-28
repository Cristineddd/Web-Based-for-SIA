import jsPDF from "jspdf";

interface TemplateData {
  name: string;
  description: string;
  numQuestions: number;
  choicesPerQuestion: number;
  examName?: string;
  className?: string;
  examCode?: string;
  answerKey?: string[]; // e.g. ['A','C','B', ...]
  institutionName?: string;
  logoUrl?: string;
}

// Load Logo (dynamically from URL or fallback to /gclogo.png)
async function loadLogo(logoUrl?: string): Promise<string> {
  const urlToFetch = logoUrl || "/gclogo.png";

  try {
    console.log(`Attempting to fetch logo from: ${urlToFetch}`);
    const response = await fetch(urlToFetch);
    console.log("Fetch response:", response.status, response.statusText);

    if (!response.ok) {
      if (logoUrl) {
        // If dynamic logo fails, try fallback
        console.warn("Dynamic logo fetch failed, trying fallback...");
        return loadLogo();
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    console.log("Blob loaded, size:", blob.size);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error(`Failed to load logo from ${urlToFetch}:`, error);
    if (logoUrl) {
      // Final attempt at fallback
      return loadLogo();
    }
    console.error("Continuing without logo...");
    return "";
  }
}

// Helper function to draw a circle (for answer bubbles)
function drawBubble(
  doc: jsPDF,
  x: number,
  y: number,
  size: number,
  filled = false,
) {
  doc.setDrawColor(0, 0, 0);
  if (filled) {
    doc.setFillColor(0, 0, 0);
    doc.circle(x, y, size * 0.5, "FD");
  } else {
    doc.setFillColor(255, 255, 255);
    doc.circle(x, y, size * 0.5, "FD");
  }
}

export async function generateTemplatePDF(template: TemplateData) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Load logo (dynamically or fallback)
  const logoData = await loadLogo(template.logoUrl);

  // Choose layout based on number of questions
  if (template.numQuestions === 20) {
    generateTemplate20(doc, template, logoData);
  } else if (template.numQuestions === 50) {
    generateTemplate50(doc, template, logoData);
  } else if (template.numQuestions === 100) {
    generateTemplate100(doc, template, logoData);
  }

  // Generate filename
  const filename = `${template.name.replace(/[^a-z0-9]/gi, "_")}_Answer_Sheet.pdf`;

  // Download the PDF
  doc.save(filename);
}

// 20 Questions - 4 mini sheets per page (2x2 grid)
function generateTemplate20(
  doc: jsPDF,
  template: TemplateData,
  logoData: string,
) {
  const pageWidth = 210;
  const pageHeight = 297;

  // Create 4 mini sheets in a 2x2 grid
  const sheetWidth = pageWidth / 2;
  const sheetHeight = pageHeight / 2;

  const positions = [
    { x: 0, y: 0 }, // Top left
    { x: sheetWidth, y: 0 }, // Top right
    { x: 0, y: sheetHeight }, // Bottom left
    { x: sheetWidth, y: sheetHeight }, // Bottom right
  ];

  positions.forEach((pos) => {
    drawMiniSheet(
      doc,
      pos.x,
      pos.y,
      sheetWidth,
      sheetHeight,
      template,
      20,
      logoData,
    );
  });
}

// 50 Questions - 2 sheets per page (side by side)
function generateTemplate50(
  doc: jsPDF,
  template: TemplateData,
  logoData: string,
) {
  const pageWidth = 210;
  const pageHeight = 297;

  const sheetWidth = pageWidth / 2;
  const sheetHeight = pageHeight;

  // Left sheet
  drawMiniSheet(doc, 0, 0, sheetWidth, sheetHeight, template, 50, logoData);

  // Right sheet
  drawMiniSheet(
    doc,
    sheetWidth,
    0,
    sheetWidth,
    sheetHeight,
    template,
    50,
    logoData,
  );
}

// 100 Questions - Full page single sheet
function generateTemplate100(
  doc: jsPDF,
  template: TemplateData,
  logoData: string,
) {
  const pageWidth = 210;
  const pageHeight = 297;

  drawFullSheet(doc, 0, 0, pageWidth, pageHeight, template, logoData);
}

// Draw a mini sheet (for 20 and 50 questions)
function drawMiniSheet(
  doc: jsPDF,
  startX: number,
  startY: number,
  width: number,
  height: number,
  template: TemplateData,
  questionsPerSheet: number,
  logoData: string,
) {
  const margin = 10; // 10mm margin
  const bubbleSize = 3.2; // Bubble size
  const markerSize = 4;

  let currentY = startY + margin + 5; // Top margin

  // Header with logo and text on same line - centered
  if (logoData) {
    const logoSize = 6;
    const textWidth = 25; // Approximate width of "Gordon College" text
    const totalWidth = logoSize + 2 + textWidth; // logo + gap + text
    const headerStartX = startX + (width - totalWidth) / 2;

    // Add logo
    doc.addImage(
      logoData,
      "PNG",
      headerStartX,
      currentY - 1,
      logoSize,
      logoSize,
    );

    // Add text next to logo
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    const textX = headerStartX + logoSize + 2;
    const textY = currentY + 3; // Vertically center with logo
    doc.text(template.institutionName || "Gordon College", textX, textY);

    currentY += logoSize + 3;
  } else {
    // Header without logo - centered
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    const centerX = startX + width / 2;
    doc.text(template.institutionName || "Gordon College", centerX, currentY, {
      align: "center",
    });
    currentY += 4;
  }

  // Exam Code (if provided)
  if (template.examCode) {
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    const centerX = startX + width / 2;
    doc.text(`Exam Code: ${template.examCode}`, centerX, currentY, {
      align: "center",
    });
    currentY += 3.5;
  }

  // Save the Y position for top black squares (aligned with Name/Date)
  const topBlackSquareY = currentY - 2;

  // Name and Date fields side by side
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");

  const fieldStartX = startX + margin + 1;
  const fieldMidX = startX + width / 2;
  const fieldEndX = startX + width - margin - 1;

  // Name field (left side)
  doc.text("Name:", fieldStartX, currentY);
  doc.line(fieldStartX + 8, currentY, fieldMidX - 1, currentY);

  // Date field (right side)
  doc.text("Date:", fieldMidX + 1, currentY);
  doc.line(fieldMidX + 7, currentY, fieldEndX, currentY);

  currentY += 4;

  // Student ZipGrade ID section with border
  const idTopY = currentY - 1;
  const idPadMini = 2;
  const idLabelWMini = 6;
  const idColSpacing = 4.5;
  const idContentWMini = idLabelWMini + 10 * idColSpacing;
  const idBorderWMini = idContentWMini + idPadMini * 2;
  const idBorderXMini = startX + margin;
  const idContentXMini = idBorderXMini + idPadMini;
  const idStartX = idContentXMini + idLabelWMini;

  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.text("Student ZipGrade ID", idContentXMini + 1, currentY + 2);
  currentY += 5;

  // Draw input boxes for writing Student ID
  const idBoxWidth = 4;
  const idBoxHeight = 4;

  doc.setFont("helvetica", "normal");
  for (let i = 0; i < 10; i++) {
    const idBoxX = idStartX + i * idColSpacing - idBoxWidth / 2;
    doc.rect(idBoxX, currentY, idBoxWidth, idBoxHeight);
  }

  currentY += idBoxHeight + 2;

  const idRowSpacing = 3.5;
  const rowLabels = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

  doc.setFontSize(6);

  // Draw 10 columns for ID
  for (let col = 0; col < 10; col++) {
    const x = idStartX + col * idColSpacing;

    for (let row = 0; row < 10; row++) {
      const y = currentY + row * idRowSpacing;

      if (col === 0) {
        doc.setFont("helvetica", "bold");
        doc.text(rowLabels[row], idContentXMini + 1, y + 1);
      }

      drawBubble(doc, x, y, bubbleSize);
    }
  }

  const idBottomYMini = currentY + 10 * idRowSpacing + 1;

  // Draw border around ID section
  doc.setLineWidth(0.4);
  doc.rect(idBorderXMini, idTopY, idBorderWMini, idBottomYMini - idTopY + 1);
  doc.setLineWidth(0.2);

  currentY = idBottomYMini + 3;

  // Answer section
  const choices = ["A", "B", "C", "D", "E"].slice(
    0,
    template.choicesPerQuestion,
  );
  const bubbleSpacing = 4.8;
  const ansRowH = 4.5;
  const numW = 10; // space for question numbers before bubbles

  let maxQY = currentY; // Track the maximum Y position for black squares

  // Helper: draw a question block for mini sheets
  function drawMiniQBlock(
    bx: number,
    by: number,
    startQ: number,
    endQ: number,
  ) {
    let qY = by;

    // Header row: ■ A B C D (E)
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(0, 0, 0);
    doc.rect(bx + 1.5, qY, 2, 2, "F");
    for (let i = 0; i < choices.length; i++) {
      doc.text(choices[i], bx + numW + i * bubbleSpacing, qY + 1.5, {
        align: "center",
      });
    }
    qY += 4;

    // Question rows
    for (let q = startQ; q <= endQ; q++) {
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.text(q.toString(), bx + numW - 3, qY + 1, { align: "right" });
      doc.setFont("helvetica", "normal");
      const correctLetter = template.answerKey?.[q - 1]?.toUpperCase();
      for (let i = 0; i < choices.length; i++) {
        const isFilled = correctLetter ? choices[i] === correctLetter : false;
        drawBubble(
          doc,
          bx + numW + i * bubbleSpacing,
          qY,
          bubbleSize,
          isFilled,
        );
      }
      qY += ansRowH;
    }
    return qY;
  }

  if (questionsPerSheet === 50) {
    // For 50 questions: 2 cols
    // Col 0: Q1-10, Q11-20, Q21-30
    // Col 1: Q31-40, Q41-50
    const blocks = [
      { startQ: 1, endQ: 10, col: 0, row: 0 },
      { startQ: 11, endQ: 20, col: 0, row: 1 },
      { startQ: 21, endQ: 30, col: 0, row: 2 },
      { startQ: 31, endQ: 40, col: 1, row: 0 },
      { startQ: 41, endQ: 50, col: 1, row: 1 },
    ];

    const colWidth = (width - 2 * margin) / 2;
    const blockVGap = 10 * ansRowH + 7;

    blocks.forEach((block) => {
      const bx = startX + margin + block.col * colWidth;
      const by = currentY + block.row * blockVGap;
      const endY = drawMiniQBlock(bx, by, block.startQ, block.endQ);
      if (endY > maxQY) maxQY = endY;
    });
  } else {
    // For 20 questions: 2 columns of 10 each
    const colWidth = (width - 2 * margin) / 2;

    for (let col = 0; col < 2; col++) {
      const startQ = col * 10 + 1;
      const endQ = Math.min((col + 1) * 10, questionsPerSheet);
      const bx = startX + margin + col * colWidth;
      const endY = drawMiniQBlock(bx, currentY, startQ, endQ);
      if (endY > maxQY) maxQY = endY;
    }
  }

  // Draw alignment markers - BLACK SQUARES - aligned with content
  doc.setFillColor(0, 0, 0);
  const inset = 5; // Distance from edge
  const bottomBlackSquareY = maxQY + 2; // Aligned with bottom of content

  // Top-left corner (aligned with Name/Date line)
  doc.rect(startX + inset, topBlackSquareY, markerSize, markerSize, "F");
  // Top-right corner (aligned with Name/Date line)
  doc.rect(
    startX + width - markerSize - inset,
    topBlackSquareY,
    markerSize,
    markerSize,
    "F",
  );
  // Bottom-left corner (aligned with bottom numbers)
  doc.rect(startX + inset, bottomBlackSquareY, markerSize, markerSize, "F");
  // Bottom-right corner (aligned with bottom numbers)
  doc.rect(
    startX + width - markerSize - inset,
    bottomBlackSquareY,
    markerSize,
    markerSize,
    "F",
  );

  // Border around sheet
  doc.rect(startX, startY, width, height);
}

// Draw full page sheet (for 100 questions) - ZipGrade style
function drawFullSheet(
  doc: jsPDF,
  startX: number,
  startY: number,
  width: number,
  height: number,
  template: TemplateData,
  logoData: string,
) {
  // A4 = 210 x 297mm, usable ~190 x 277mm
  const margin = 10;
  const markerSize = 7;
  const inset = 3;
  const numChoices = template.choicesPerQuestion;
  const choices = ["A", "B", "C", "D", "E"].slice(0, numChoices);

  // Answer bubble settings
  const bubbleSize = 3.8;
  const bubbleGap = 5.0; // center-to-center between A, B, C, D, E
  const rowH = 4.8; // vertical row spacing

  // ID bubble settings (smaller/tighter)
  const idBubbleSize = 3.5;
  const idColGap = 4.5; // center-to-center between ID columns
  const idRowH = 4.8;

  let currentY = startY + margin + 2;
  const lx = startX + margin;
  const rx = startX + width - margin;
  const usableW = rx - lx; // ~190mm

  // ── Helper: draw a question block. Returns Y after last row ──
  function drawQBlock(bx: number, by: number, startQ: number, endQ: number) {
    const numW = 12; // space for number text (enough for 3 digits + gap)
    let qY = by;

    // Header row: ■ A B C D (E)
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(0, 0, 0);
    doc.rect(bx + 2, qY, 2.5, 2.5, "F");
    for (let i = 0; i < choices.length; i++) {
      doc.text(choices[i], bx + numW + i * bubbleGap, qY + 2, {
        align: "center",
      });
    }
    qY += 4.5;

    // Question rows
    for (let q = startQ; q <= endQ; q++) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text(q.toString(), bx + numW - 4, qY + 1.2, { align: "right" });
      doc.setFont("helvetica", "normal");
      const correctLetter = template.answerKey?.[q - 1]?.toUpperCase();
      for (let i = 0; i < choices.length; i++) {
        const isFilled = correctLetter ? choices[i] === correctLetter : false;
        drawBubble(doc, bx + numW + i * bubbleGap, qY, bubbleSize, isFilled);
      }
      qY += rowH;
    }
    return qY;
  }

  // Block width = numW(12) + bubbles span
  const qBlockW = 12 + (numChoices - 1) * bubbleGap + bubbleSize;

  // ── CORNER MARKERS (top) ──
  doc.setFillColor(0, 0, 0);
  doc.rect(startX + inset, startY + inset, markerSize, markerSize, "F");
  doc.rect(
    startX + width - markerSize - inset,
    startY + inset,
    markerSize,
    markerSize,
    "F",
  );

  // ── HEADER ──
  if (logoData) {
    const logoSize = 12;
    const hx = startX + (width - 63) / 2;
    doc.addImage(logoData, "PNG", hx, currentY - 2, logoSize, logoSize);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(
      template.institutionName || "Gordon College",
      hx + logoSize + 3,
      currentY + 6,
    );
    currentY += logoSize + 4;
  } else {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(
      template.institutionName || "Gordon College",
      startX + width / 2,
      currentY + 4,
      { align: "center" },
    );
    currentY += 10;
  }

  // Exam Code (if provided)
  if (template.examCode) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Exam Code: ${template.examCode}`, startX + width / 2, currentY, {
      align: "center",
    });
    currentY += 5;
  }

  // ── FIELDS: Name ___ Date ___ ──
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const nameEnd = lx + usableW * 0.62;
  doc.text("Name:", lx, currentY);
  doc.line(lx + 13, currentY, nameEnd, currentY);
  doc.text("Date:", nameEnd + 4, currentY);
  doc.line(nameEnd + 16, currentY, rx, currentY);
  currentY += 5;

  // ════════════════════════════════════════════
  // TOP SECTION: [ID box] [Q41-50] [Q71-80]
  // ════════════════════════════════════════════

  // ID grid: 8mm labels + 10 cols × 4.2mm = 50mm content + 4mm padding = 54mm border
  const idLabelW = 8;
  const idPad = 3;
  const idContentW = idLabelW + 10 * idColGap;
  const idBorderW = idContentW + idPad * 2;

  // Layout: ID box starts at lx, Q blocks fill remaining space evenly
  const idBorderX = lx;
  const idContentX = idBorderX + idPad;
  const idStartX = idContentX + idLabelW;

  // Position Q41-50 and Q71-80 in remaining space
  const afterIdX = idBorderX + idBorderW;
  const remainW = rx - afterIdX;
  const topGap = (remainW - 2 * qBlockW) / 2; // center the 2 blocks in remaining space
  const b41x = afterIdX + topGap / 2;
  const b71x = b41x + qBlockW + topGap;

  // ── STUDENT ZIPGRADE ID ──
  const idTopY = currentY;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Student ZipGrade ID", idContentX + 1, currentY + 3.5);
  currentY += 7;

  // ID input boxes
  const idBoxW = 4.5;
  const idBoxH = 5;
  doc.setFont("helvetica", "normal");
  for (let i = 0; i < 10; i++) {
    doc.rect(idStartX + i * idColGap - idBoxW / 2, currentY, idBoxW, idBoxH);
  }
  currentY += idBoxH + 3;

  // ID bubble grid
  const idBubbleY = currentY;
  const rowLabels = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  doc.setFontSize(7);
  for (let row = 0; row < 10; row++) {
    const y = currentY + row * idRowH;
    doc.setFont("helvetica", "bold");
    doc.text(rowLabels[row], idContentX + 2, y + 1.2);
    doc.setFont("helvetica", "normal");
    for (let col = 0; col < 10; col++) {
      drawBubble(doc, idStartX + col * idColGap, y, idBubbleSize);
    }
  }

  // ID border
  const idBottomY = currentY + 10 * idRowH + 2;
  doc.setLineWidth(0.4);
  doc.rect(idBorderX, idTopY - 1, idBorderW, idBottomY - idTopY + 2);
  doc.setLineWidth(0.2);

  // ── Q41-50 and Q71-80 aligned to ID bubble rows ──
  drawQBlock(b41x, idBubbleY, 41, 50);
  drawQBlock(b71x, idBubbleY, 71, 80);

  currentY = idBottomY + 4;

  // ════════════════════════════════════════════
  // BOTTOM: 4 cols × 2 rows
  // ════════════════════════════════════════════
  const totalGridW = 4 * qBlockW;
  const colGap = (usableW - totalGridW) / 5;
  const blockVGap = 10 * rowH + 8;

  const gridBlocks = [
    { startQ: 1, endQ: 10, col: 0, row: 0 },
    { startQ: 21, endQ: 30, col: 1, row: 0 },
    { startQ: 51, endQ: 60, col: 2, row: 0 },
    { startQ: 81, endQ: 90, col: 3, row: 0 },
    { startQ: 11, endQ: 20, col: 0, row: 1 },
    { startQ: 31, endQ: 40, col: 1, row: 1 },
    { startQ: 61, endQ: 70, col: 2, row: 1 },
    { startQ: 91, endQ: 100, col: 3, row: 1 },
  ];

  let maxQY = currentY;
  gridBlocks.forEach((block) => {
    const bx = lx + colGap + block.col * (qBlockW + colGap);
    const by = currentY + block.row * blockVGap;
    const endY = drawQBlock(bx, by, block.startQ, block.endQ);
    if (endY > maxQY) maxQY = endY;
  });

  // ── CORNER MARKERS (bottom) ──
  doc.setFillColor(0, 0, 0);
  const bmY = maxQY + 3;
  doc.rect(startX + inset, bmY, markerSize, markerSize, "F");
  doc.rect(
    startX + width - markerSize - inset,
    bmY,
    markerSize,
    markerSize,
    "F",
  );

  // Footer
  doc.setFontSize(6);
  doc.setFont("helvetica", "italic");
  doc.text(
    "Do not fold, staple, or tear this answer sheet.",
    startX + width / 2,
    startY + height - 5,
    { align: "center" },
  );
}
