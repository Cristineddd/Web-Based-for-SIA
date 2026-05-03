import jsPDF from "jspdf";

interface TemplateData {
  name: string;
  description: string;
  numQuestions: number;
  choicesPerQuestion: number;
  examName?: string;
  className?: string;
  examCode?: string;
  courseCode?: string;
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

/**
 * Draw a shading guidelines panel at (px, py) with the given width.
 * Shows: correct fill, erasure correction, wrong examples, and reminders.
 * Used by both full-page and mini-sheet templates (rotated 90° for side margins).
 */
function drawShadingGuide(
  doc: jsPDF,
  px: number,
  py: number,
  panelW: number,
  bubbleSize: number,
) {
  // Adaptive layout: label column is 45% of width, bubbles fill the rest
  const labelW = Math.min(24, panelW * 0.45);
  const bStartX = px + labelW;
  const remaining = panelW - labelW;
  const bSpacing = Math.min(4.5, remaining / 5.5);
  // Bubble radius scales down if spacing is tight (never larger than bubbleSize/2)
  const bR = Math.min(bubbleSize * 0.5, bSpacing * 0.42);
  const lineH = bR * 2 + 1.8;

  const colLabels = ["A", "B", "C", "D", "E"];

  const items: Array<{
    label: string;
    bubbles: Array<{ filled: boolean; partial?: boolean }>;
  }> = [
    { label: "Correct", bubbles: [{ filled: false }, { filled: true }, { filled: false }, { filled: false }, { filled: false }] },
    { label: "Wrong", bubbles: [{ filled: false }, { filled: false, partial: true }, { filled: false }, { filled: false }, { filled: false }] },
    { label: "Wrong", bubbles: [{ filled: true }, { filled: true }, { filled: false }, { filled: false }, { filled: false }] },
    { label: "Erase OK", bubbles: [{ filled: false }, { filled: false }, { filled: false }, { filled: true }, { filled: false }] },
  ];

  const reminders = [
    "Use No. 2 pencil or dark pen.",
    "Fill bubble completely.",
    "Erase stray marks fully.",
  ];

  let gy = py;

  // Title
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "bold");
  doc.text("SHADING GUIDE", px + panelW / 2, gy, { align: "center" });
  gy += 4;

  // Thin rule
  doc.setLineWidth(0.15);
  doc.setDrawColor(0);
  doc.line(px, gy, px + panelW, gy);
  gy += 2;

  // Column headers A B C D E
  doc.setFontSize(5);
  doc.setFont("helvetica", "bold");
  for (let i = 0; i < 5; i++) {
    doc.text(colLabels[i], bStartX + i * bSpacing, gy + 1.5, { align: "center" });
  }
  gy += 3.5;

  // Example rows
  for (const item of items) {
    doc.setFontSize(4.8);
    doc.setFont("helvetica", "normal");
    doc.text(item.label, px, gy + bR + 0.3, { baseline: "middle" });

    for (let i = 0; i < item.bubbles.length; i++) {
      const bx = bStartX + i * bSpacing;
      const by = gy + bR;
      const b = item.bubbles[i];

      doc.setDrawColor(0);
      if (b.filled) {
        doc.setFillColor(0, 0, 0);
        doc.circle(bx, by, bR, "FD");
      } else if (b.partial) {
        // Empty outline with grey centre — represents a faint/partial mark
        doc.setFillColor(255, 255, 255);
        doc.circle(bx, by, bR, "FD");
        doc.setFillColor(170, 170, 170);
        doc.circle(bx, by, bR * 0.55, "F");
      } else {
        doc.setFillColor(255, 255, 255);
        doc.circle(bx, by, bR, "FD");
      }
    }
    gy += lineH;
  }

  gy += 1;
  doc.setLineWidth(0.15);
  doc.line(px, gy, px + panelW, gy);
  gy += 2;

  // Reminder bullets
  doc.setFontSize(4.5);
  doc.setFont("helvetica", "normal");
  for (const r of reminders) {
    doc.text(`\u2022 ${r}`, px, gy);
    gy += 3.2;
  }
}

/** Build the jsPDF document for a template without saving/downloading. */
async function buildTemplateDoc(template: TemplateData): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const logoData = await loadLogo(template.logoUrl);

  if (template.numQuestions === 20) {
    generateTemplate20(doc, template, logoData);
  } else if (template.numQuestions === 50) {
    generateTemplate50(doc, template, logoData);
  } else if (template.numQuestions === 100) {
    generateTemplate100(doc, template, logoData);
  } else if (template.numQuestions === 150) {
    generateTemplate150(doc, template, logoData);
  } else if (template.numQuestions === 200) {
    generateTemplate200(doc, template, logoData);
  }

  return doc;
}

/** Generate and immediately download the PDF. */
export async function generateTemplatePDF(template: TemplateData) {
  const doc = await buildTemplateDoc(template);
  const filename = `${template.name.replace(/[^a-z0-9]/gi, "_")}_Answer_Sheet.pdf`;
  doc.save(filename);
}

/** Generate the PDF and return an object URL (blob) for preview / printing. */
export async function getTemplatePDFBlobUrl(template: TemplateData): Promise<string> {
  const doc = await buildTemplateDoc(template);
  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
}

// 20 Questions - 2 sheets per page (stacked vertically)
function generateTemplate20(
  doc: jsPDF,
  template: TemplateData,
  logoData: string,
) {
  const pageWidth = 210;
  const pageHeight = 297;

  const sheetWidth = pageWidth / 2;
  const sheetHeight = pageHeight / 2;

  // 4 sheets in a 2×2 grid
  // Top-left
  drawMiniSheet(doc, 0, 0, sheetWidth, sheetHeight, template, 20, logoData);
  // Top-right
  drawMiniSheet(doc, sheetWidth, 0, sheetWidth, sheetHeight, template, 20, logoData);
  // Bottom-left
  drawMiniSheet(doc, 0, sheetHeight, sheetWidth, sheetHeight, template, 20, logoData);
  // Bottom-right
  drawMiniSheet(doc, sheetWidth, sheetHeight, sheetWidth, sheetHeight, template, 20, logoData);
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
    doc.text(`Exam Code: ${template.examCode}`, centerX, currentY, { align: "center" });
    currentY += 4;
  }

  // Name and Date fields - consistent with full sheets
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");

  const fieldStartX = startX + margin;
  const fieldEndX = startX + width - margin;
  const usableW = fieldEndX - fieldStartX;

  if (questionsPerSheet === 50) {
    // 50-item: Name / Date / Course Code all on one line
    const nameEnd50 = fieldStartX + usableW * 0.40;
    const dateEnd50 = nameEnd50 + usableW * 0.22;
    doc.text("Name:", fieldStartX, currentY);
    doc.line(fieldStartX + 11, currentY, nameEnd50, currentY);
    doc.text("Date:", nameEnd50 + 3, currentY);
    doc.line(nameEnd50 + 13, currentY, dateEnd50, currentY);
    doc.text("Course Code:", dateEnd50 + 3, currentY);
    doc.line(dateEnd50 + 24, currentY, fieldEndX, currentY);
  } else {
    // 20-item: Name / Date only (Course Code is above shading guide in right panel)
    const nameEnd = fieldStartX + usableW * 0.65;
    doc.text("Name:", fieldStartX, currentY);
    doc.line(fieldStartX + 11, currentY, nameEnd, currentY);
    doc.text("Date:", nameEnd + 3, currentY);
    doc.line(nameEnd + 13, currentY, fieldEndX, currentY);
  }

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

  // Shading guide — placed to the right of the ID section
  const miniGuideX = idBorderXMini + idBorderWMini + 4;
  const miniGuideW = startX + width - margin - miniGuideX;
  if (miniGuideW >= 20) {
    let guideStartY = idTopY + 4;
    if (questionsPerSheet !== 50) {
      // 20-item: show Course Code fill-in above the shading guide
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      const ccLabelW = doc.getTextWidth("Course Code:");
      doc.text("Course Code:", miniGuideX, idTopY + 4);
      doc.setLineWidth(0.2);
      doc.line(miniGuideX + ccLabelW + 1, idTopY + 4, miniGuideX + miniGuideW, idTopY + 4);
      guideStartY = idTopY + 8;
    }

    drawShadingGuide(doc, miniGuideX, guideStartY, miniGuideW, 2.5);
  }

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
// questionOffset: added to every question number (0 for Q1-100, 100 for Q101-200)
function drawFullSheet(
  doc: jsPDF,
  startX: number,
  startY: number,
  width: number,
  height: number,
  template: TemplateData,
  logoData: string,
  questionOffset: number = 0,
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

  // Exam Code (if provided)
  if (template.examCode) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`Exam Code: ${template.examCode}`, startX + width / 2, currentY, { align: "center" });
    currentY += 4;
  }

  // Name / Date / Course Code on one line
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  const nameEnd = lx + usableW * 0.40;
  const dateEnd = nameEnd + usableW * 0.22;
  doc.text("Name:", lx, currentY);
  doc.line(lx + 11, currentY, nameEnd, currentY);
  doc.text("Date:", nameEnd + 3, currentY);
  doc.line(nameEnd + 13, currentY, dateEnd, currentY);
  doc.text("Course Code:", dateEnd + 3, currentY);
  doc.line(dateEnd + 23, currentY, rx, currentY);
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

  // Shading guide — placed to the right of the ID section, aligned with ID top
  const guideX = idBorderX + idBorderW + 4;
  const guideW = rx - guideX;
  
  // Page indicator (for 200-item exams) - positioned above the shading guide
  if (template.numQuestions === 200) {
    const pageIndicatorBubbleSize = 3.5;
    const pageIndicatorSpacing = 6;
    
    // Position above shading guide
    const indicatorX = guideX;
    const indicatorY = idTopY + 1;
    
    doc.setFontSize(5);
    doc.setFont("helvetica", "normal");
    
    // 1st page indicator
    doc.text("1st page", indicatorX, indicatorY);
    const page1BubbleX = indicatorX + 12;
    drawBubble(doc, page1BubbleX, indicatorY - 1, pageIndicatorBubbleSize, questionOffset === 0);
    drawBubble(doc, page1BubbleX + pageIndicatorSpacing, indicatorY - 1, pageIndicatorBubbleSize, false);
    
    // 2nd page indicator - position to the right of 1st page
    const page2X = page1BubbleX + pageIndicatorSpacing + 5;
    doc.text("2nd page", page2X, indicatorY);
    const page2BubbleX = page2X + 12;
    drawBubble(doc, page2BubbleX, indicatorY - 1, pageIndicatorBubbleSize, false);
    drawBubble(doc, page2BubbleX + pageIndicatorSpacing, indicatorY - 1, pageIndicatorBubbleSize, questionOffset === 100);
  }
  
  drawShadingGuide(doc, guideX, idTopY + 8, guideW, 3.0);

  currentY = idBottomY + 3;

  // 100 questions: 5 cols, each column goes down (Q1-20, Q21-40, Q41-60, Q61-80, Q81-100)
  const totalGridW = 5 * qBlockW;
  const colGap = (usableW - totalGridW) / 6;
  const blockVGap = 10 * rowH + 10; // Vertical space between blocks

  const o = questionOffset;
  const gridBlocks = [
    // Col 0: Q1-10, Q11-20 (down)
    { startQ: 1 + o, endQ: 10 + o, col: 0, row: 0 },
    { startQ: 11 + o, endQ: 20 + o, col: 0, row: 1 },
    // Col 1: Q21-30, Q31-40 (down)
    { startQ: 21 + o, endQ: 30 + o, col: 1, row: 0 },
    { startQ: 31 + o, endQ: 40 + o, col: 1, row: 1 },
    // Col 2: Q41-50, Q51-60 (down)
    { startQ: 41 + o, endQ: 50 + o, col: 2, row: 0 },
    { startQ: 51 + o, endQ: 60 + o, col: 2, row: 1 },
    // Col 3: Q61-70, Q71-80 (down)
    { startQ: 61 + o, endQ: 70 + o, col: 3, row: 0 },
    { startQ: 71 + o, endQ: 80 + o, col: 3, row: 1 },
    // Col 4: Q81-90, Q91-100 (down)
    { startQ: 81 + o, endQ: 90 + o, col: 4, row: 0 },
    { startQ: 91 + o, endQ: 100 + o, col: 4, row: 1 },
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

  // Exam Code (if provided)
  if (template.examCode) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`Exam Code: ${template.examCode}`, startX + width / 2, currentY, { align: "center" });
    currentY += 4;
  }

  // Name / Date / Course Code on one line
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  const nameEnd = lx + usableW * 0.40;
  const dateEnd = nameEnd + usableW * 0.22;
  doc.text("Name:", lx, currentY);
  doc.line(lx + 11, currentY, nameEnd, currentY);
  doc.text("Date:", nameEnd + 3, currentY);
  doc.line(nameEnd + 13, currentY, dateEnd, currentY);
  doc.text("Course Code:", dateEnd + 3, currentY);
  doc.line(dateEnd + 23, currentY, rx, currentY);
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

  // Shading guide — placed to the right of the ID section, aligned with ID top
  const guideX = idBorderX + idBorderW + 4;
  const guideW = rx - guideX;
  drawShadingGuide(doc, guideX, idTopY + 9, guideW, 3.0);

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

// 200 Questions - 2-page answer sheet (Q1-100 on page 1, Q101-200 on page 2)
function generateTemplate200(
  doc: jsPDF,
  template: TemplateData,
  logoData: string,
) {
  const pageWidth = 210;
  const pageHeight = 297;

  // Page 1: Q1–100 (no offset)
  drawFullSheet(doc, 0, 0, pageWidth, pageHeight, template, logoData, 0);

  // Page 2: Q101–200
  doc.addPage();
  drawFullSheet(doc, 0, 0, pageWidth, pageHeight, template, logoData, 100);
}
