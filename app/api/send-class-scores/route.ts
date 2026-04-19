/**
 * POST /api/send-class-scores
 *
 * Sends each student their complete class score record across exams.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  isEmailConfigured,
  processEmailQueue,
  sendEmail,
  type EmailMessage,
} from '@/services/emailService';
import {
  classScoreSummaryEmail,
  classScoreSummaryText,
  facultyDeliveryEmail,
  facultyDeliveryText,
  type ClassScoreRecord,
  type ClassScoreSummaryEmailData,
  type FacultyDeliveryStudentStatus,
} from '@/services/emailTemplateService';
import { GC_FULL_NAME } from '@/lib/gcBranding';

interface StudentClassScorePayload {
  studentId: string;
  studentName: string;
  email: string;
  examRecords: ClassScoreRecord[];
}

interface SendClassScoresBody {
  className: string;
  passingThreshold: number;
  students: StudentClassScorePayload[];
  course?: string;
  instructorName?: string;
  instructorEmail?: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!isEmailConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error:
            'SMTP is not configured. Add SMTP_USER and SMTP_PASS to your .env.local file.',
        },
        { status: 503 },
      );
    }

    const body: SendClassScoresBody = await request.json();

    if (!body.className) {
      return NextResponse.json(
        { success: false, error: 'className is required.' },
        { status: 400 },
      );
    }

    if (!body.students?.length) {
      return NextResponse.json(
        { success: false, error: 'No students provided.' },
        { status: 400 },
      );
    }

    const messages: EmailMessage[] = body.students.map((student) => {
      const emailData: ClassScoreSummaryEmailData = {
        studentName: student.studentName,
        studentId: student.studentId,
        className: body.className,
        course: body.course,
        passingThreshold: body.passingThreshold,
        examRecords: student.examRecords || [],
        instructorName: body.instructorName,
      };

      return {
        to: student.email,
        subject: `${GC_FULL_NAME} — ${body.className} Score Summary`,
        html: classScoreSummaryEmail(emailData),
        text: classScoreSummaryText(emailData),
      };
    });

    const results = await processEmailQueue(messages);
    const sentCount = results.filter((result) => result.success).length;
    const failedCount = results.filter((result) => !result.success).length;

    if (body.instructorEmail && body.instructorName) {
      const deliveryStudents: FacultyDeliveryStudentStatus[] = body.students.map(
        (student, index) => {
          const result = results[index];
          return {
            studentName: student.studentName,
            studentId: student.studentId,
            status: result?.success ? 'Sent' : 'Failed',
            error: result?.success ? undefined : result?.error,
          };
        },
      );

      const reportDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      await sendEmail({
        to: body.instructorEmail,
        subject: `${GC_FULL_NAME} — ${body.className} Score Delivery Report`,
        html: facultyDeliveryEmail({
          instructorName: body.instructorName,
          examTitle: 'Class Score Summary',
          className: body.className,
          subject: body.course,
          date: reportDate,
          total: body.students.length,
          sent: sentCount,
          failed: failedCount,
          students: deliveryStudents,
        }),
        text: facultyDeliveryText({
          instructorName: body.instructorName,
          examTitle: 'Class Score Summary',
          className: body.className,
          subject: body.course,
          date: reportDate,
          total: body.students.length,
          sent: sentCount,
          failed: failedCount,
          students: deliveryStudents,
        }),
      });
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      failed: failedCount,
      total: body.students.length,
      results: results.map((result) => ({
        to: result.to,
        success: result.success,
        error: result.error || null,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API /send-class-scores] Error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
