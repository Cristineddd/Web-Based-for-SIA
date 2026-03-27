import { NextRequest, NextResponse } from "next/server";
import { saveLocalFile } from "@/lib/file-storage";
import { AuditLogger } from "@/services/auditLogger";

// This function handles POST requests to /api/upload
export async function POST(request: NextRequest) {
  // Parse form data once, outside the try block so it's accessible in catch
  let file: File | null = null;
  let adminId: string | null = null;
  let adminEmail: string | null = null;
  let requestMetadata: ReturnType<typeof AuditLogger.getRequestMetadata>;

  try {
    //  Parse the incoming form data
    const formData = await request.formData();

    // Gets the file from the form data (must match the key used in frontend)
    file = formData.get("file") as File | null;

    // Get admin ID from headers (sent from frontend)
    adminId = request.headers.get("x-admin-id");
    adminEmail = request.headers.get("x-admin-email");
    requestMetadata = AuditLogger.getRequestMetadata(request);

    // Checks if the file is valid before uploading
    if (!file) {
      // Log failed upload attempt
      if (adminId && adminEmail) {
        await AuditLogger.logFileUpload(
          adminId,
          adminEmail,
          "unknown",
          "unknown",
          0,
          "",
          false,
          "No file provided",
          requestMetadata.ipAddress,
          requestMetadata.userAgent
        );
      }
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // These are the only file types that are allowed to be uploaded in Students
    const allowedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
      "application/vnd.ms-excel", // xls
      "text/csv", // csv
    ];

    // Checks if the file type is allowed
    if (!allowedTypes.includes(file.type)) {
      // Log rejected file type
      if (adminId && adminEmail) {
        await AuditLogger.logFileUpload(
          adminId,
          adminEmail,
          file.name,
          file.type,
          file.size,
          "",
          false,
          `File type not allowed: ${file.type}`,
          requestMetadata.ipAddress,
          requestMetadata.userAgent
        );
      }
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 },
      );
    }

    // Save the file using our helper
    // We'll save it to a 'documents' folder inside public/uploads (Can be changed)
    const filePath = await saveLocalFile(file, "documents");

    // Log successful file upload
    if (adminId && adminEmail) {
      await AuditLogger.logFileUpload(
        adminId,
        adminEmail,
        file.name,
        file.type,
        file.size,
        filePath,
        true,
        undefined,
        requestMetadata.ipAddress,
        requestMetadata.userAgent
      );
    }

    // Return success response with the path
    return NextResponse.json({
      success: true,
      filePath: filePath,
      message: "File uploaded successfully",
    });
  } catch (error) {
    // Log error
    if (adminId && adminEmail && file) {
      await AuditLogger.logFileUpload(
        adminId,
        adminEmail,
        file.name,
        file.type,
        file.size,
        "",
        false,
        error instanceof Error ? error.message : "Unknown error during upload",
        requestMetadata.ipAddress,
        requestMetadata.userAgent
      );
    }

    console.error("Error handling upload:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

