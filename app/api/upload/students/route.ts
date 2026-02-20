/**
 * Student File Upload API Endpoint
 * POST /api/upload/students
 * Handles file upload, parsing, and validation of student data
 */

import { NextRequest, NextResponse } from 'next/server';
import { StudentFileUploadService, MAX_FILE_SIZE_BYTES } from '@/services/studentFileUploadService';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

/**
 * POST /api/upload/students
 * Upload and parse student file (CSV or Excel)
 *
 * Request body (multipart/form-data):
 * - file: File (required) - CSV, XLSX, or XLS file
 *
 * Response:
 * - 200: { success: true, students: ParsedStudent[], rowCount: number }
 * - 400: { error: string } - Invalid file format or validation error
 * - 413: { error: string } - File too large
 * - 500: { error: string } - Server error
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided. Please upload a CSV or Excel file.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `File size exceeds 10MB limit. Received: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
        },
        { status: 413 }
      );
    }

    // Validate and parse file
    const parseResult = await StudentFileUploadService.parseFile(file);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error || 'Failed to parse file' },
        { status: 400 }
      );
    }

    if (parseResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'No student records found in file' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        students: parseResult.students,
        rowCount: parseResult.rowCount,
        fileName: file.name,
        fileSize: file.size,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in file upload endpoint:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown server error';

    return NextResponse.json(
      { error: `Server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/upload/students
 * CORS preflight request handler
 */
export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}
