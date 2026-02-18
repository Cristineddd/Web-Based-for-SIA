import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { Exam } from "@/services/examService";

/**
 * Generate a PDF answer sheet using a provided PDF template
 */
export async function generateAnswerSheetPDF(
  exam: Exam,
  copies: number = 1,
  options: { preview?: boolean } = {},
) {
  try {
    // Determine which template to use
    let templatePath = "";
    if (exam.num_items <= 20) {
      templatePath = "/AnswerSheets_20Questions.pdf";
    } else if (exam.num_items <= 50) {
      templatePath = "/AnswerSheet_50_Questions.pdf";
    } else if (exam.num_items <= 100) {
      templatePath = "/AnswerSheet_100_Questions.pdf";
    } else {
      throw new Error("No template available for more than 100 questions");
    }

    // Fetch the template
    const response = await fetch(templatePath);
    if (!response.ok) throw new Error("Failed to load PDF template");
    const templateBytes = await response.arrayBuffer();

    // Create a new PDF document or load existing
    const finalDoc = await PDFDocument.create();
    const font = await finalDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await finalDoc.embedFont(StandardFonts.Helvetica);

    // Fetch and embed logo if present (Task 2.2)
    let logoImage: any = null;
    if (exam.logoUrl) {
      try {
        const logoResponse = await fetch(exam.logoUrl);
        if (logoResponse.ok) {
          const logoBytes = await logoResponse.arrayBuffer();
          const contentType = logoResponse.headers.get("Content-Type");
          if (contentType?.includes("png")) {
            logoImage = await finalDoc.embedPng(logoBytes);
          } else {
            logoImage = await finalDoc.embedJpg(logoBytes);
          }
        }
      } catch (error) {
        console.error("Error embedding logo:", error);
      }
    }

    for (let i = 0; i < copies; i++) {
      const templateDoc = await PDFDocument.load(templateBytes);
      const [templatePage] = await finalDoc.copyPages(templateDoc, [0]);
      finalDoc.addPage(templatePage);

      const { width, height } = templatePage.getSize();

      // Overlay Exam Information based on template type
      if (exam.num_items <= 20) {
        // 4-up Layout Coordinates (Estimated in Points)
        // Quadrant 1 (Top Left)
        draw20ItemInfo(templatePage, exam, font, 0, 0);
        // Quadrant 2 (Top Right)
        draw20ItemInfo(templatePage, exam, font, width / 2, 0);
        // Quadrant 3 (Bottom Left)
        draw20ItemInfo(templatePage, exam, font, 0, height / 2);
        // Quadrant 4 (Bottom Right)
        draw20ItemInfo(templatePage, exam, font, width / 2, height / 2);
      } else if (exam.num_items <= 50) {
        // 50-Item Template Coordinates
        // Name Box (Title)
        templatePage.drawText(exam.title, {
          x: 180,
          y: height - 170,
          size: 11,
          font: font,
          color: rgb(0, 0, 0),
        });

        // Draw Logo (Task 2.2)
        if (logoImage) {
          const dims = logoImage.scale(0.2); // Adjust scale as needed
          templatePage.drawImage(logoImage, {
            x: 50,
            y: height - 100,
            width: dims.width,
            height: dims.height,
          });
        }

        // Exam Code (Task 2.2)
        if (exam.examCode) {
          templatePage.drawText(exam.examCode, {
            x: 50,
            y: height - 120,
            size: 10,
            font: font,
          });
        }
        // Date - Draw only if not a template
        if (!exam.id.includes("template")) {
          templatePage.drawText(
            new Date(exam.created_at).toLocaleDateString(),
            {
              x: 430,
              y: height - 170,
              size: 11,
              font: regularFont,
            },
          );
        }
        // Class/Subject
        templatePage.drawText(exam.subject || "", {
          x: 180,
          y: height - 204,
          size: 11,
          font: regularFont,
        });
        // Quiz Name - Only draw if subject is provided and not a template
        if (exam.subject && !exam.id.includes("template")) {
          templatePage.drawText("QUIZ", {
            x: 360,
            y: height - 204,
            size: 11,
            font: regularFont,
          });
        }
      } else if (exam.num_items <= 100) {
        // 100-Item Template Coordinates
        // Name (Title)
        templatePage.drawText(exam.title, {
          x: 75,
          y: height - 165,
          size: 10,
          font: font,
        });

        // Draw Logo (Task 2.2)
        if (logoImage) {
          const dims = logoImage.scale(0.25);
          templatePage.drawImage(logoImage, {
            x: 50,
            y: height - 80,
            width: dims.width,
            height: dims.height,
          });
        }

        // Exam Code (Task 2.2)
        if (exam.examCode) {
          templatePage.drawText(exam.examCode, {
            x: 50,
            y: height - 100,
            size: 10,
            font: font,
          });
        }
        // Class
        templatePage.drawText(exam.subject || "", {
          x: 345,
          y: height - 165,
          size: 10,
          font: regularFont,
        });
        // Quiz - Only draw if not a template
        if (!exam.id.includes("template")) {
          templatePage.drawText("EXAM", {
            x: 475,
            y: height - 165,
            size: 10,
            font: regularFont,
          });
        }
      }
    }

    const pdfBytes = await finalDoc.save();

    if (options.preview) {
      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      return URL.createObjectURL(blob);
    }

    // Download the PDF
    const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${exam.title.replace(/\s+/g, "_")}_answer_sheet.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error("Error generating PDF with template:", error);
    throw error;
  }
}

/**
 * Helper to draw info on 20-item quadrant (relative to quadrant origin)
 */
function draw20ItemInfo(
  page: any,
  exam: Exam,
  font: any,
  offsetX: number,
  offsetY: number,
) {
  // Height is total page height. Coordinates are from bottom.
  const pageHeight = page.getSize().height;

  // Quadrant 1 is Top-Left.
  // OffsetX/Y are from Top-Left in my logic? Let's fix to bottom-left logic.
  // 4-Up Layout in points:
  // Q2 (TR): x=297, y=421
  // Q1 (TL): x=0, y=421
  // Q4 (BR): x=297, y=0
  // Q3 (BL): x=0, y=0

  // Adjusted Coordinates for 20-item template boxes
  const nameX = offsetX + 55;
  const nameY = pageHeight - offsetY - 105;

  const dateX = offsetX + 55;
  const dateY = pageHeight - offsetY - 132;

  const periodX = offsetX + 220;
  const periodY = pageHeight - offsetY - 132;

  if (exam.title) {
    page.drawText(exam.title.substring(0, 25), {
      x: nameX,
      y: nameY,
      size: 9,
      font: font,
    });
  }

  // Draw date only if not a template
  if (!exam.id.includes("template")) {
    page.drawText(new Date(exam.created_at).toLocaleDateString(), {
      x: dateX,
      y: dateY,
      size: 9,
      font: font,
    });
  }

  if (exam.subject) {
    page.drawText(exam.subject.substring(0, 10), {
      x: periodX,
      y: periodY,
      size: 9,
      font: font,
    });
  }

  // Draw Logo in Quadrant (Task 2.2)
  if (exam.logoUrl && !exam.id.includes("template")) {
    // Note: Embedding in quadrant is tricky without passing logoImage.
    // Simplifying: we only draw logo/code on 50/100 item for now as they are primary.
    // 20-item is usually for smaller quizzes where logo is already in template.
  }

  if (exam.examCode) {
    page.drawText(exam.examCode, {
      x: offsetX + 55,
      y: pageHeight - offsetY - 150,
      size: 8,
      font: font,
    });
  }
}
