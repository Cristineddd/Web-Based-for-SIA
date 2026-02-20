import jsPDF from 'jspdf';

interface Exam {
  id: string;
  title: string;
  subject: string;
  num_items: number;
  choices_per_item: number;
  student_id_length?: number;
}

    if (exam.num_items <= 20) {
      templatePath = isStandard
        ? "/Standard_20_Items.pdf"
        : "/AnswerSheets_20Questions.pdf";
    } else if (exam.num_items <= 50) {
      templatePath = isStandard
        ? "/Standard_50_Items.pdf"
        : "/AnswerSheet_50_Questions.pdf";
    } else if (exam.num_items <= 100) {
      templatePath = isStandard
        ? "/Standard_100_Items.pdf"
        : "/AnswerSheet_100_Questions.pdf";
    } else {
      throw new Error("No template available for more than 100 questions");
    }

    let yPos = margin;

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

    for (let i = 0; i < copies; i++) {
      const templateDoc = await PDFDocument.load(templateBytes);
      const [templatePage] = await finalDoc.copyPages(templateDoc, [0]);
      finalDoc.addPage(templatePage);

      const { width, height } = templatePage.getSize();

      // Overlay Exam Information based on template type
      if (exam.num_items <= 20) {
        if (isStandard) {
          const qWidth = width / 2;
          const qHeight = height / 2;
          // Standardized 20-item 4-up Layout
          draw20ItemInfo(templatePage, exam, font, 0, qHeight, true);
          draw20ItemInfo(templatePage, exam, font, qWidth, qHeight, true);
          draw20ItemInfo(templatePage, exam, font, 0, 0, true);
          draw20ItemInfo(templatePage, exam, font, qWidth, 0, true);
        } else {
          // Legacy 20-item 4-up Layout
          draw20ItemInfo(templatePage, exam, font, 0, 0, false);
          draw20ItemInfo(templatePage, exam, font, width / 2, 0, false);
          draw20ItemInfo(templatePage, exam, font, 0, height / 2, false);
          draw20ItemInfo(
            templatePage,
            exam,
            font,
            width / 2,
            height / 2,
            false,
          );
        }
      } else if (exam.num_items <= 50) {
        if (isStandard) {
          // Standardized 50-Item Template Coordinates
          templatePage.drawText(exam.title || "", {
            x: 215,
            y: height - 157,
            size: 11,
            font: font,
            color: rgb(0, 0, 0),
          });
          if (exam.created_at && !exam.id.includes("template")) {
            templatePage.drawText(
              new Date(exam.created_at).toLocaleDateString(),
              {
                x: 450,
                y: height - 157,
                size: 10,
                font: regularFont,
              },
            );
          }
          templatePage.drawText(exam.subject || "", {
            x: 180,
            y: height - 188,
            size: 10,
            font: regularFont,
          });
          if (exam.title && !exam.id.includes("template")) {
            templatePage.drawText("QUIZ", {
              x: 365,
              y: height - 188,
              size: 10,
              font: font,
            });
          }
          if (logoImage) {
            const dims = logoImage.scale(0.3);
            templatePage.drawImage(logoImage, {
              x: width / 2 - dims.width / 2,
              y: height - 75,
              width: dims.width,
              height: dims.height,
            });
          }
        } else {
          // Legacy 50-Item Template Coordinates
          templatePage.drawText(exam.title, {
            x: 180,
            y: height - 170,
            size: 11,
            font: font,
            color: rgb(0, 0, 0),
          });
          if (logoImage) {
            const dims = logoImage.scale(0.2);
            templatePage.drawImage(logoImage, {
              x: 50,
              y: height - 100,
              width: dims.width,
              height: dims.height,
            });
          }
          if (exam.examCode) {
            templatePage.drawText(exam.examCode, {
              x: 50,
              y: height - 120,
              size: 10,
              font: font,
            });
          }
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
          templatePage.drawText(exam.subject || "", {
            x: 180,
            y: height - 204,
            size: 11,
            font: regularFont,
          });
          if (exam.subject && !exam.id.includes("template")) {
            templatePage.drawText("QUIZ", {
              x: 360,
              y: height - 204,
              size: 11,
              font: regularFont,
            });
          }
        }
      } else if (exam.num_items <= 100) {
        if (isStandard) {
          // Standardized 100-Item Template Coordinates
          templatePage.drawText(exam.title || "", {
            x: 180,
            y: height - 146,
            size: 11,
            font: font,
          });
          templatePage.drawText(exam.subject || "", {
            x: 350,
            y: height - 146,
            size: 10,
            font: regularFont,
          });
          if (exam.title && !exam.id.includes("template")) {
            templatePage.drawText("EXAM", {
              x: 475,
              y: height - 146,
              size: 10,
              font: font,
            });
          }
          if (logoImage) {
            const dims = logoImage.scale(0.3);
            templatePage.drawImage(logoImage, {
              x: width / 2 - dims.width / 2,
              y: height - 75,
              width: dims.width,
              height: dims.height,
            });
          }
        } else {
          // Legacy 100-Item Template Coordinates
          templatePage.drawText(exam.title, {
            x: 75,
            y: height - 165,
            size: 10,
            font: font,
          });
          if (logoImage) {
            const dims = logoImage.scale(0.25);
            templatePage.drawImage(logoImage, {
              x: 50,
              y: height - 80,
              width: dims.width,
              height: dims.height,
            });
          }
          if (exam.examCode) {
            templatePage.drawText(exam.examCode, {
              x: 50,
              y: height - 100,
              size: 10,
              font: font,
            });
          }
          templatePage.drawText(exam.subject || "", {
            x: 345,
            y: height - 165,
            size: 10,
            font: regularFont,
          });
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
  isStandard: boolean = false,
) {
  const pageHeight = page.getSize().height;

  if (isStandard) {
    // Standardized 20-item Layout (PNG-based)
    // Name Box
    if (exam.title) {
      page.drawText(exam.title.substring(0, 30), {
        x: offsetX + 75,
        y: offsetY + 316,
        size: 9,
        font: font,
      });
    }

    // Date
    if (exam.created_at && !exam.id.includes("template")) {
      page.drawText(new Date(exam.created_at).toLocaleDateString(), {
        x: offsetX + 50,
        y: offsetY + 291,
        size: 8,
        font: font,
      });
    }

    // Period / Subject
    if (exam.subject) {
      page.drawText(exam.subject.substring(0, 15), {
        x: offsetX + 165,
        y: offsetY + 291,
        size: 8,
        font: font,
      });
    }

    // Exam Code / Version
    if (exam.examCode && !exam.id.includes("template")) {
      page.drawText(exam.examCode, {
        x: offsetX + 130,
        y: offsetY + 45,
        size: 8,
        font: font,
      });
    }
  } else {
    // Legacy 20-item 4-Up Layout
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

    if (exam.examCode) {
      page.drawText(exam.examCode, {
        x: offsetX + 55,
        y: pageHeight - offsetY - 150,
        size: 8,
        font: font,
      });
    }
  }
}
