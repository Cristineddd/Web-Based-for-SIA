/**
 * POST /api/send-results
 *
 * Sends GC-branded exam result emails to students.
 * Each student receives their own individual score notification.
 * SMTP is configured via environment variables (.env.local).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  sendEmail,
  processEmailQueue,
  isEmailConfigured,
  type EmailMessage,
} from '@/services/emailService';
import {
  studentScoreEmail,
  studentScoreText,
  type StudentScoreEmailData,
} from '@/services/emailTemplateService';
import { GC_FULL_NAME } from '@/lib/gcBranding';

// ─── Request body ───────────────────────────────────────────────────────────

interface StudentPayload {
  studentId: string;
  studentName: string;
  email: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  grade: string;
  date: string;
}

interface SendResultsBody {
  className: string;
  examTitle: string;
  passingThreshold: number;
  students: StudentPayload[];
  instructorName?: string;
  instructorEmail?: string;
  subject?: string;
}

// ─── Handler ────────────────────────────────────────────────────────────────

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

    const body: SendResultsBody = await request.json();

    if (!body.students?.length) {
      return NextResponse.json(
        { success: false, error: 'No students provided.' },
        { status: 400 },
      );
    }

    if (!body.className || !body.examTitle) {
      return NextResponse.json(
        { success: false, error: 'className and examTitle are required.' },
        { status: 400 },
      );
    }

    // Build one email per student
    const messages: EmailMessage[] = body.students.map((s) => {
      const scoreData: StudentScoreEmailData = {
        studentName: s.studentName,
        studentId: s.studentId,
        className: body.className,
        examTitle: body.examTitle,
        score: s.score,
        totalQuestions: s.totalQuestions,
        percentage: s.percentage,
        grade: s.grade,
        date: s.date,
        passingThreshold: body.passingThreshold,
        instructorName: body.instructorName,
        subject: body.subject,
      };

      return {
        to: s.email,
        subject: `${GC_FULL_NAME} — Your ${body.examTitle} Results`,
        html: studentScoreEmail(scoreData),
        text: studentScoreText(scoreData),
      };
    });

    // Send to all students
    const results = await processEmailQueue(messages);

    const sentCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    // Optional: send a delivery confirmation to the instructor
    if (body.instructorEmail && body.instructorName && sentCount > 0) {
      await sendEmail({
        to: body.instructorEmail,
        subject: `${body.examTitle} — Delivery Report (${sentCount} sent)`,
        html: `<p>Hi ${body.instructorName},</p>
               <p>${sentCount} student(s) received their <strong>${body.examTitle}</strong> results for <strong>${body.className}</strong>.</p>
               ${failedCount > 0 ? `<p style="color:red;">${failedCount} email(s) failed to deliver.</p>` : ''}
               <p style="color:#6b7280;font-size:13px;">— Gordon College SIA</p>`,
        text: `${sentCount} student(s) received their ${body.examTitle} results for ${body.className}. ${failedCount > 0 ? `${failedCount} failed.` : ''}`,
      });
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      failed: failedCount,
      total: body.students.length,
      results: results.map((r) => ({
        to: r.to,
        success: r.success,
        error: r.error || null,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API /send-results] Error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
