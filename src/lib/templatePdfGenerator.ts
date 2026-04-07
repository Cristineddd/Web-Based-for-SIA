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
  } else if (template.numQuestions === 150) {
    generateTemplate150(doc, template, logoData);
  }

  // Generate filename
  const filename = `${template.name.replace(/[^a-z0-9]/gi, "_")}_Answer_Sheet.pdf`;

  // Download the PDF
  doc.save(filename);
}

// 20 Questions - 2 sheets per page (stacked vertically)
function generateTemplate20(
  doc: jsPDF,
  template: TemplateData,
  logoData: string,
) {
  const pageWidth = 210;
  const pageHeight = 297;

  const sheetWidth = pageWidth;
  const sheetHeight = pageHeight / 2;

  // Top sheet
  drawMiniSheet(doc, 0, 0, sheetWidth, sheetHeight, template, 20, logoData);

  // Bottom sheet
  drawMiniSheet(
    doc,
    0,
    sheetHeight,
    sheetWidth,
    sheetHeight,
    template,
    20,
    logoData,
  );
}

// 50 Questions - 2 sheets per page (stacked vertically)
function generateTemplate50(
  doc: jsPDF,
  template: TemplateData,
  logoData: string,
) {
  const pageWidth = 210;
  const pageHeight = 297;

  const sheetWidth = pageWidth;
  const sheetHeight = pageHeight / 2;

  // Top sheet
  drawMiniSheet(doc, 0, 0, sheetWidth, sheetHeight, template, 50, logoData);

  // Bottom sheet
  drawMiniSheet(
    doc,
    0,
    sheetHeight,
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
  const bubbleSize = 3.5; // Answer bubble size - 13px equivalent
  const idBubbleSize = 3.0; // ID bubble size - 11px equivalent
  const markerSize = 8; // Corner squares - 30px equivalent (8mm ≈ 30px at 96dpi)
  const regMarkSize = 2.0; // Registration marks - small squares at each answer block
  const cornerInset = 2; // Distance from edge for corner markers

  // Header positioned IN BETWEEN the corner markers (slightly lower)
  let currentY = startY + cornerInset + 3;

  // Header with logo and text on same line - centered (consistent with full sheets)
  if (logoData) {
    const logoSize = 10;
    const hx = startX + (width - 55) / 2;
    doc.addImage(logoData, "PNG", hx, currentY, logoSize, logoSize);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(
      template.institutionName || "Gordon College",
      hx + logoSize + 3,
      currentY + 6,
    );
    currentY += logoSize + 2;
  } else {
    // Header without logo - centered
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    const centerX = startX + width / 2;
    doc.text(template.institutionName || "Gordon College", centerX, currentY + 5, {
      align: "center",
    });
    currentY += markerSize + 2;
  }

  // Exam Code (if provided)
  if (template.examCode) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    const centerX = startX + width / 2;
    doc.text(`Exam Code: ${template.examCode}`, centerX, currentY, {
      align: "center",
    });
    currentY += 4;
  }

  // Name and Date fields - consistent with full sheets
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");

  const fieldStartX = startX + margin;
  const fieldEndX = startX + width - margin;
  const usableW = fieldEndX - fieldStartX;
  const nameEnd = fieldStartX + usableW * 0.65;

  // Name field
  doc.text("Name:", fieldStartX, currentY);
  doc.line(fieldStartX + 11, currentY, nameEnd, currentY);

  // Date field
  doc.text("Date:", nameEnd + 3, currentY);
  doc.line(nameEnd + 13, currentY, fieldEndX, currentY);

  currentY += 4;

  // Student ZipGrade ID section with border (9 columns)
  const idTopY = currentY - 1;
  const idPadMini = 2;
  const idLabelWMini = 6;
  const idColSpacing = 4.8;
  const idContentWMini = idLabelWMini + 9 * idColSpacing; // 9 columns
  const idBorderWMini = idContentWMini + idPadMini * 2;
  const idBorderXMini = startX + margin;
  const idContentXMini = idBorderXMini + idPadMini;
  const idStartX = idContentXMini + idLabelWMini;

  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.text("Student ZipGrade ID", idContentXMini + 1, currentY + 2);
  currentY += 4.5; // Reduced from 5 to 4.5

  // Draw input boxes for writing Student ID (9 boxes)
  const idBoxWidth = 4.2;
  const idBoxHeight = 4.0; // Reduced from 4.5 to 4.0

  doc.setFont("helvetica", "normal");
  doc.setLineWidth(0.5);
  for (let i = 0; i < 9; i++) {
    const idBoxX = idStartX + i * idColSpacing - idBoxWidth / 2;
    doc.rect(idBoxX, currentY, idBoxWidth, idBoxHeight);
  }
  doc.setLineWidth(0.2);

  currentY += idBoxHeight + 2;

  const idRowSpacing = 4.0;
  const rowLabels = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

  doc.setFontSize(5.5);

  // Draw 9 columns for ID
  for (let col = 0; col < 9; col++) {
    const x = idStartX + col * idColSpacing;

    for (let row = 0; row < 10; row++) {
      const y = currentY + row * idRowSpacing;

      if (col === 0) {
        doc.setFont("helvetica", "bold");
        doc.text(rowLabels[row], idContentXMini + 1.5, y + 1.2);
      }

      drawBubble(doc, x, y, idBubbleSize);
    }
  }

  const idBottomYMini = currentY + 10 * idRowSpacing + 1;

  // Draw border around ID section
  doc.setLineWidth(0.5);
  doc.rect(idBorderXMini, idTopY, idBorderWMini, idBottomYMini - idTopY + 1);
  doc.setLineWidth(0.2);

  currentY = idBottomYMini + 3;

  // Answer section
  const choices = ["A", "B", "C", "D", "E"].slice(
    0,
    template.choicesPerQuestion,
  );
  const bubbleSpacing = 5.5; // Wider spacing between bubbles
  const ansRowH = 5.2; // More vertical space between rows
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

    // Registration mark at top-left of this block
    doc.setFillColor(0, 0, 0);
    doc.rect(bx, qY, regMarkSize, regMarkSize, "F");

    // Header row: A B C D (E) - with proper spacing
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    for (let i = 0; i < choices.length; i++) {
      doc.text(choices[i], bx + numW + i * bubbleSpacing, qY + 2.5, {
        align: "center",
      });
    }
    qY += 5; // Space after header before first question row

    // Question rows
    for (let q = startQ; q <= endQ; q++) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(q.toString(), bx + numW - 3, qY + 1.5, { align: "right" });
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
    // For 50 questions: 5 blocks arranged horizontally in a single row
    const blocks = [
      { startQ: 1, endQ: 10 },
      { startQ: 11, endQ: 20 },
      { startQ: 21, endQ: 30 },
      { startQ: 31, endQ: 40 },
      { startQ: 41, endQ: 50 },
    ];

    const blockWidth = (width - 2 * margin) / 5; // Divide width equally for 5 blocks

    // All 5 blocks in a single row
    for (let i = 0; i < 5; i++) {
      const bx = startX + margin + i * blockWidth;
      const endY = drawMiniQBlock(bx, currentY, blocks[i].startQ, blocks[i].endQ);
      if (endY > maxQY) maxQY = endY;
    }
  } else {
    // For 20 questions: 2 columns of 10 each, side by side (Q1-10 and Q11-20)
    const colWidth = (width - 2 * margin) / 2;

    for (let col = 0; col < 2; col++) {
      const startQ = col * 10 + 1;
      const endQ = Math.min((col + 1) * 10, questionsPerSheet);
      const bx = startX + margin + col * colWidth;
      const endY = drawMiniQBlock(bx, currentY, startQ, endQ);
      if (endY > maxQY) maxQY = endY;
    }
  }

  // Draw alignment markers - BLACK SQUARES - consistent positioning
  doc.setFillColor(0, 0, 0);
  const topMarkerY = startY + cornerInset; // Top corners near the edge
  const bottomMarkerY = startY + height - markerSize - cornerInset; // Bottom corners near the edge (consistent)

  // Top-left corner
  doc.rect(startX + cornerInset, topMarkerY, markerSize, markerSize, "F");
  // Top-right corner
  doc.rect(
    startX + width - markerSize - cornerInset,
    topMarkerY,
    markerSize,
    markerSize,
    "F",
  );
  // Bottom-left corner
  doc.rect(startX + cornerInset, bottomMarkerY, markerSize, markerSize, "F");
  // Bottom-right corner
  doc.rect(
    startX + width - markerSize - cornerInset,
    bottomMarkerY,
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
  // A4 = 210 x 297mm
  const margin = 10; // Consistent with mini sheets
  const markerSize = 8; // Corner squares - 30px equivalent
  const regMarkSize = 2.0; // Registration marks - small
  const cornerInset = 2; // Consistent with mini sheets
  const numChoices = template.choicesPerQuestion;
  const choices = ["A", "B", "C", "D", "E"].slice(0, numChoices);

  // Answer bubble settings - consistent with mini sheets
  const bubbleSize = 3.5; // 13px equivalent
  const bubbleGap = 5.5; // Wider spacing between bubbles (same as mini sheets)
  const rowH = 5.2; // More vertical space between rows (same as mini sheets)

  // ID bubble settings
  const idBubbleSize = 3.0; // 11px equivalent
  const idColGap = 4.8; // Same spacing
  const idRowH = 4.0;

  // Header positioned IN BETWEEN the corner markers (consistent with mini sheets)
  let currentY = startY + cornerInset + 3;
  const lx = startX + margin;
  const rx = startX + width - margin;
  const usableW = rx - lx;

  // Helper: draw a question block
  function drawQBlock(bx: number, by: number, startQ: number, endQ: number) {
    const numW = 10;
    let qY = by;

    // Registration mark at top-left of block
    doc.setFillColor(0, 0, 0);
    doc.rect(bx, qY, regMarkSize, regMarkSize, "F");

    // Header row: A B C D (E) - positioned with proper spacing
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    for (let i = 0; i < choices.length; i++) {
      doc.text(choices[i], bx + numW + i * bubbleGap, qY + 2.5, {
        align: "center",
      });
    }
    qY += 5; // Space after header before first question row

    // Question rows
    for (let q = startQ; q <= endQ; q++) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(q.toString(), bx + numW - 3, qY + 1.5, { align: "right" });
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

  const qBlockW = 10 + (numChoices - 1) * bubbleGap + bubbleSize;

  // Corner markers (top)
  doc.setFillColor(0, 0, 0);
  doc.rect(startX + cornerInset, startY + cornerInset, markerSize, markerSize, "F");
  doc.rect(
    startX + width - markerSize - cornerInset,
    startY + cornerInset,
    markerSize,
    markerSize,
    "F",
  );

  // Header
  if (logoData) {
    const logoSize = 10;
    const hx = startX + (width - 55) / 2;
    doc.addImage(logoData, "PNG", hx, currentY, logoSize, logoSize);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(
      template.institutionName || "Gordon College",
      hx + logoSize + 3,
      currentY + 6,
    );
    currentY += logoSize + 2;
  } else {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(
      template.institutionName || "Gordon College",
      startX + width / 2,
      currentY + 5,
      { align: "center" },
    );
    currentY += markerSize + 2;
  }

  // Exam Code
  if (template.examCode) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`Exam Code: ${template.examCode}`, startX + width / 2, currentY, {
      align: "center",
    });
    currentY += 4;
  }

  // Name and Date fields
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  const nameEnd = lx + usableW * 0.65;
  doc.text("Name:", lx, currentY);
  doc.line(lx + 11, currentY, nameEnd, currentY);
  doc.text("Date:", nameEnd + 3, currentY);
  doc.line(nameEnd + 13, currentY, rx, currentY);
  currentY += 4;

  // Student ZipGrade ID section - 9 columns consistent with mini sheets
  const idLabelW = 6;
  const idPad = 2;
  const idContentW = idLabelW + 9 * idColGap;
  const idBorderW = idContentW + idPad * 2;

  const idBorderX = lx;
  const idContentX = idBorderX + idPad;
  const idStartX = idContentX + idLabelW;

  const idTopY = currentY;
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "bold");
  doc.text("Student ZipGrade ID", idContentX + 1, currentY + 3);
  currentY += 5.5;

  // ID input boxes
  const idBoxW = 4.2;
  const idBoxH = 4.0;
  doc.setFont("helvetica", "normal");
  for (let i = 0; i < 9; i++) {
    doc.rect(idStartX + i * idColGap - idBoxW / 2, currentY, idBoxW, idBoxH);
  }
  currentY += idBoxH + 2;

  // ID bubble grid
  const rowLabels = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  doc.setFontSize(5.5);
  for (let row = 0; row < 10; row++) {
    const y = currentY + row * idRowH;
    doc.setFont("helvetica", "bold");
    doc.text(rowLabels[row], idContentX + 1.5, y + 1);
    doc.setFont("helvetica", "normal");
    for (let col = 0; col < 9; col++) {
      drawBubble(doc, idStartX + col * idColGap, y, idBubbleSize);
    }
  }

  const idBottomY = currentY + 10 * idRowH + 1.5;
  doc.setLineWidth(0.4);
  doc.rect(idBorderX, idTopY - 1, idBorderW, idBottomY - idTopY + 2);
  doc.setLineWidth(0.2);

  currentY = idBottomY + 3;

  // 100 questions: 5 cols, each column goes down (Q1-20, Q21-40, Q41-60, Q61-80, Q81-100)
  const totalGridW = 5 * qBlockW;
  const colGap = (usableW - totalGridW) / 6;
  const blockVGap = 10 * rowH + 10; // Vertical space between blocks

  const gridBlocks = [
    // Col 0: Q1-10, Q11-20 (down)
    { startQ: 1, endQ: 10, col: 0, row: 0 },
    { startQ: 11, endQ: 20, col: 0, row: 1 },
    // Col 1: Q21-30, Q31-40 (down)
    { startQ: 21, endQ: 30, col: 1, row: 0 },
    { startQ: 31, endQ: 40, col: 1, row: 1 },
    // Col 2: Q41-50, Q51-60 (down)
    { startQ: 41, endQ: 50, col: 2, row: 0 },
    { startQ: 51, endQ: 60, col: 2, row: 1 },
    // Col 3: Q61-70, Q71-80 (down)
    { startQ: 61, endQ: 70, col: 3, row: 0 },
    { startQ: 71, endQ: 80, col: 3, row: 1 },
    // Col 4: Q81-90, Q91-100 (down)
    { startQ: 81, endQ: 90, col: 4, row: 0 },
    { startQ: 91, endQ: 100, col: 4, row: 1 },
  ];

  let maxQY = currentY;
  gridBlocks.forEach((block) => {
    const bx = lx + colGap + block.col * (qBlockW + colGap);
    const by = currentY + block.row * blockVGap;
    const endY = drawQBlock(bx, by, block.startQ, block.endQ);
    if (endY > maxQY) maxQY = endY;
  });

  // Corner markers (bottom)
  doc.setFillColor(0, 0, 0);
  const bmY = startY + height - markerSize - cornerInset;
  doc.rect(startX + cornerInset, bmY, markerSize, markerSize, "F");
  doc.rect(
    startX + width - markerSize - cornerInset,
    bmY,
    markerSize,
    markerSize,
    "F",
  );

  // Footer
  doc.setFontSize(5);
  doc.setFont("helvetica", "italic");
  doc.text(
    "Do not fold, staple, or tear this answer sheet.",
    startX + width / 2,
    startY + height - 4,
    { align: "center" },
  );
}

// 150 Questions - Full page single sheet with 15 blocks of 10 questions each (5 cols × 3 rows)
function generateTemplate150(
  doc: jsPDF,
  template: TemplateData,
  logoData: string,
) {
  const pageWidth = 210;
  const pageHeight = 297;

  drawFullSheet150(doc, 0, 0, pageWidth, pageHeight, template, logoData);
}

// Draw full page sheet for 150 questions - ZipGrade style
function drawFullSheet150(
  doc: jsPDF,
  startX: number,
  startY: number,
  width: number,
  height: number,
  template: TemplateData,
  logoData: string,
) {
  const margin = 10; // Consistent with mini sheets
  const markerSize = 8; // Corner squares - 30px equivalent
  const regMarkSize = 2.0; // Registration marks - small (consistent)
  const cornerInset = 2; // Consistent with mini sheets
  const numChoices = template.choicesPerQuestion;
  const choices = ["A", "B", "C", "D", "E"].slice(0, numChoices);

  // Bubble settings - consistent with mini sheets
  const bubbleSize = 3.5; // 13px equivalent (same as others for consistency)
  const bubbleGap = 5.5; // Wider spacing between bubbles (same as mini sheets)
  const rowH = 5.2; // More vertical space between rows (same as mini sheets)

  // ID bubble settings
  const idBubbleSize = 3.0; // 11px equivalent
  const idColGap = 4.8;
  const idRowH = 4.0;

  let currentY = startY + cornerInset + 3; // Header positioned IN BETWEEN corner markers
  const lx = startX + margin;
  const rx = startX + width - margin;
  const usableW = rx - lx;

  // Helper: draw a question block
  function drawQBlock(bx: number, by: number, startQ: number, endQ: number) {
    const numW = 10;
    let qY = by;

    // Registration mark at top-left of block
    doc.setFillColor(0, 0, 0);
    doc.rect(bx, qY, regMarkSize, regMarkSize, "F");

    // Header row: A B C D (E) - positioned with proper spacing
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    for (let i = 0; i < choices.length; i++) {
      doc.text(choices[i], bx + numW + i * bubbleGap, qY + 2.5, {
        align: "center",
      });
    }
    qY += 5; // Space after header before first question row

    // Question rows
    for (let q = startQ; q <= endQ; q++) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(q.toString(), bx + numW - 3, qY + 1.5, { align: "right" });
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

  const qBlockW = 10 + (numChoices - 1) * bubbleGap + bubbleSize;

  // Corner markers (top)
  doc.setFillColor(0, 0, 0);
  doc.rect(startX + cornerInset, startY + cornerInset, markerSize, markerSize, "F");
  doc.rect(
    startX + width - markerSize - cornerInset,
    startY + cornerInset,
    markerSize,
    markerSize,
    "F",
  );

  // Header
  if (logoData) {
    const logoSize = 10;
    const hx = startX + (width - 55) / 2;
    doc.addImage(logoData, "PNG", hx, currentY, logoSize, logoSize);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(
      template.institutionName || "Gordon College",
      hx + logoSize + 3,
      currentY + 6,
    );
    currentY += logoSize + 2;
  } else {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(
      template.institutionName || "Gordon College",
      startX + width / 2,
      currentY + 5,
      { align: "center" },
    );
    currentY += markerSize + 2;
  }

  // Exam Code
  if (template.examCode) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`Exam Code: ${template.examCode}`, startX + width / 2, currentY, {
      align: "center",
    });
    currentY += 4;
  }

  // Name and Date fields
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  const nameEnd = lx + usableW * 0.65;
  doc.text("Name:", lx, currentY);
  doc.line(lx + 11, currentY, nameEnd, currentY);
  doc.text("Date:", nameEnd + 3, currentY);
  doc.line(nameEnd + 13, currentY, rx, currentY);
  currentY += 4;

  // Student ZipGrade ID - 9 columns consistent with mini sheets
  const idLabelW = 6;
  const idPad = 2;
  const idContentW = idLabelW + 9 * idColGap;
  const idBorderW = idContentW + idPad * 2;

  const idBorderX = lx;
  const idContentX = idBorderX + idPad;
  const idStartX = idContentX + idLabelW;

  const idTopY = currentY;
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "bold");
  doc.text("Student ZipGrade ID", idContentX + 1, currentY + 3);
  currentY += 5.5;

  // ID input boxes
  const idBoxW = 4.2;
  const idBoxH = 4.0;
  doc.setFont("helvetica", "normal");
  for (let i = 0; i < 9; i++) {
    doc.rect(idStartX + i * idColGap - idBoxW / 2, currentY, idBoxW, idBoxH);
  }
  currentY += idBoxH + 2;

  // ID bubble grid
  const rowLabels = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  doc.setFontSize(5.5);
  for (let row = 0; row < 10; row++) {
    const y = currentY + row * idRowH;
    doc.setFont("helvetica", "bold");
    doc.text(rowLabels[row], idContentX + 1.5, y + 1);
    doc.setFont("helvetica", "normal");
    for (let col = 0; col < 9; col++) {
      drawBubble(doc, idStartX + col * idColGap, y, idBubbleSize);
    }
  }

  const idBottomY = currentY + 10 * idRowH + 1.5;
  doc.setLineWidth(0.4);
  doc.rect(idBorderX, idTopY - 1, idBorderW, idBottomY - idTopY + 2);
  doc.setLineWidth(0.2);

  currentY = idBottomY + 3;

  // 150 questions: 5 cols, each column goes down (Q1-30, Q31-60, Q61-90, Q91-120, Q121-150)
  const totalGridW = 5 * qBlockW;
  const colGap = (usableW - totalGridW) / 6;
  const blockVGap = 10 * rowH + 10; // Vertical space between blocks

  const gridBlocks = [
    // Col 0: Q1-10, Q11-20, Q21-30 (down)
    { startQ: 1, endQ: 10, col: 0, row: 0 },
    { startQ: 11, endQ: 20, col: 0, row: 1 },
    { startQ: 21, endQ: 30, col: 0, row: 2 },
    // Col 1: Q31-40, Q41-50, Q51-60 (down)
    { startQ: 31, endQ: 40, col: 1, row: 0 },
    { startQ: 41, endQ: 50, col: 1, row: 1 },
    { startQ: 51, endQ: 60, col: 1, row: 2 },
    // Col 2: Q61-70, Q71-80, Q81-90 (down)
    { startQ: 61, endQ: 70, col: 2, row: 0 },
    { startQ: 71, endQ: 80, col: 2, row: 1 },
    { startQ: 81, endQ: 90, col: 2, row: 2 },
    // Col 3: Q91-100, Q101-110, Q111-120 (down)
    { startQ: 91, endQ: 100, col: 3, row: 0 },
    { startQ: 101, endQ: 110, col: 3, row: 1 },
    { startQ: 111, endQ: 120, col: 3, row: 2 },
    // Col 4: Q121-130, Q131-140, Q141-150 (down)
    { startQ: 121, endQ: 130, col: 4, row: 0 },
    { startQ: 131, endQ: 140, col: 4, row: 1 },
    { startQ: 141, endQ: 150, col: 4, row: 2 },
  ];

  let maxQY = currentY;
  gridBlocks.forEach((block) => {
    const bx = lx + colGap + block.col * (qBlockW + colGap);
    const by = currentY + block.row * blockVGap;
    const endY = drawQBlock(bx, by, block.startQ, block.endQ);
    if (endY > maxQY) maxQY = endY;
  });

  // Corner markers (bottom) - consistent positioning
  doc.setFillColor(0, 0, 0);
  const bmY = startY + height - markerSize - cornerInset;
  doc.rect(startX + cornerInset, bmY, markerSize, markerSize, "F");
  doc.rect(
    startX + width - markerSize - cornerInset,
    bmY,
    markerSize,
    markerSize,
    "F",
  );

  // Footer
  doc.setFontSize(5);
  doc.setFont("helvetica", "italic");
  doc.text(
    "Do not fold, staple, or tear this answer sheet.",
    startX + width / 2,
    startY + height - 4,
    { align: "center" },
  );
}
