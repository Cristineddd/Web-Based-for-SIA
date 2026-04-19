/**
 * Email Templates
 *
 * GC-branded HTML email templates for sending exam results to students.
 */

import {
  GC_FULL_NAME,
  GC_SYSTEM_NAME,
  GC_TAGLINE,
  GC_ADDRESS,
  GC_PRIMARY_HEX,
  GC_GOLD_HEX,
  GC_TEXT_DARK_HEX,
  GC_TEXT_MUTED_HEX,
  GC_GREEN_LIGHT_HEX,
} from '@/lib/gcBranding';

// ─── Helpers ────────────────────────────────────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return '#15803d';
    case 'B+': case 'B': return '#4d7c0f';
    case 'C': return '#a16207';
    case 'D': return '#c2410c';
    case 'F': return '#dc2626';
    default: return GC_TEXT_MUTED_HEX;
  }
}

function statusLabel(pct: number, threshold: number) {
  return pct >= threshold
    ? { text: 'PASSED', color: '#15803d' }
    : { text: 'FAILED', color: '#dc2626' };
}

// ─── Base Layout ────────────────────────────────────────────────────────────

function baseLayout(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f4f6;">
<tr><td align="center" style="padding:24px 16px;">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
  <tr><td style="background:${GC_PRIMARY_HEX};padding:28px 32px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${esc(GC_FULL_NAME)}</h1>
    <p style="margin:4px 0 0;color:${GC_GOLD_HEX};font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">${esc(GC_TAGLINE)}</p>
  </td></tr>
  <tr><td style="height:3px;background:${GC_GOLD_HEX};font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr><td style="padding:32px;color:${GC_TEXT_DARK_HEX};font-size:14px;line-height:1.6;">${body}</td></tr>
  <tr><td style="background:${GC_GREEN_LIGHT_HEX};padding:20px 32px;border-top:1px solid #e5e7eb;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td style="font-size:12px;color:${GC_TEXT_MUTED_HEX};line-height:1.5;">
        <strong style="color:${GC_PRIMARY_HEX};">${esc(GC_SYSTEM_NAME)}</strong><br/>${esc(GC_FULL_NAME)} &bull; ${esc(GC_ADDRESS)}
      </td>
      <td align="right" style="font-size:11px;color:${GC_TEXT_MUTED_HEX};">
        This is an automated message.<br/>Please do not reply to this email.
      </td>
    </tr></table>
  </td></tr>
</table>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">
  <tr><td align="center" style="padding:16px;font-size:11px;color:#9ca3af;">
    &copy; ${new Date().getFullYear()} ${esc(GC_FULL_NAME)}. All rights reserved.
  </td></tr>
</table>

</td></tr></table>
</body></html>`;
}

// ─── Student Score Email ────────────────────────────────────────────────────

export interface StudentScoreEmailData {
  studentName: string;
  studentId: string;
  className: string;
  examTitle: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  grade: string;
  date: string;
  passingThreshold: number;
  instructorName?: string;
  subject?: string;
}

/** GC-branded HTML email with a student's individual exam score. */
export function studentScoreEmail(data: StudentScoreEmailData): string {
  const { text: statusText, color: statusColor } = statusLabel(data.percentage, data.passingThreshold);

  const body = `
    <p style="margin:0 0 6px;">Dear <strong>${esc(data.studentName)}</strong>,</p>
    <p style="margin:0 0 20px;color:${GC_TEXT_MUTED_HEX};">
      Here are your exam results for <strong>${esc(data.examTitle)}</strong>
      in <strong>${esc(data.className)}</strong>.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
      style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="padding-bottom:16px;border-bottom:1px solid #e5e7eb;" colspan="2">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
              <td>
                <span style="font-size:36px;font-weight:700;color:${GC_PRIMARY_HEX};">${data.score}</span>
                <span style="font-size:18px;color:${GC_TEXT_MUTED_HEX};">/ ${data.totalQuestions}</span>
              </td>
              <td align="right">
                <span style="display:inline-block;padding:6px 16px;border-radius:20px;font-size:14px;font-weight:700;color:#fff;background:${statusColor};">
                  ${statusText}
                </span>
              </td>
            </tr></table>
          </td></tr>
          <tr>
            <td style="padding-top:16px;" width="50%">
              <span style="display:block;font-size:11px;color:${GC_TEXT_MUTED_HEX};text-transform:uppercase;letter-spacing:0.5px;">Percentage</span>
              <span style="display:block;font-size:20px;font-weight:700;color:${GC_TEXT_DARK_HEX};">${data.percentage}%</span>
            </td>
            <td style="padding-top:16px;" width="50%">
              <span style="display:block;font-size:11px;color:${GC_TEXT_MUTED_HEX};text-transform:uppercase;letter-spacing:0.5px;">Grade</span>
              <span style="display:block;font-size:20px;font-weight:700;color:${gradeColor(data.grade)};">${esc(data.grade)}</span>
            </td>
          </tr>
          <tr>
            <td style="padding-top:12px;" width="50%">
              <span style="display:block;font-size:11px;color:${GC_TEXT_MUTED_HEX};text-transform:uppercase;letter-spacing:0.5px;">Student ID</span>
              <span style="display:block;font-size:14px;color:${GC_TEXT_DARK_HEX};font-family:monospace;">${esc(data.studentId)}</span>
            </td>
            <td style="padding-top:12px;" width="50%">
              <span style="display:block;font-size:11px;color:${GC_TEXT_MUTED_HEX};text-transform:uppercase;letter-spacing:0.5px;">Date</span>
              <span style="display:block;font-size:14px;color:${GC_TEXT_DARK_HEX};">${esc(data.date)}</span>
            </td>
          </tr>
          <tr>
            <td style="padding-top:12px;" width="50%">
              <span style="display:block;font-size:11px;color:${GC_TEXT_MUTED_HEX};text-transform:uppercase;letter-spacing:0.5px;">Passing Score</span>
              <span style="display:block;font-size:14px;color:${GC_TEXT_DARK_HEX};">${data.passingThreshold}%</span>
            </td>
            <td style="padding-top:12px;" width="50%">
              ${data.subject ? `
                <span style="display:block;font-size:11px;color:${GC_TEXT_MUTED_HEX};text-transform:uppercase;letter-spacing:0.5px;">Subject</span>
                <span style="display:block;font-size:14px;color:${GC_TEXT_DARK_HEX};">${esc(data.subject)}</span>
              ` : ''}
            </td>
          </tr>
        </table>
      </td></tr>
    </table>

    ${data.instructorName ? `
    <p style="margin:16px 0 0;font-size:13px;color:${GC_TEXT_MUTED_HEX};">
      — ${esc(data.instructorName)}, Instructor
    </p>` : ''}`;

  return baseLayout(body);
}

/** Plain-text fallback for the student score email. */
export function studentScoreText(data: StudentScoreEmailData): string {
  const status = data.percentage >= data.passingThreshold ? 'PASSED' : 'FAILED';
  return [
    GC_SYSTEM_NAME,
    '',
    `Dear ${data.studentName},`,
    '',
    `Here are your exam results for "${data.examTitle}" in ${data.className}:`,
    '',
    `  Score:       ${data.score} / ${data.totalQuestions}`,
    `  Percentage:  ${data.percentage}%`,
    `  Grade:       ${data.grade}`,
    `  Status:      ${status}`,
    `  Date:        ${data.date}`,
    '',
    `Passing threshold: ${data.passingThreshold}%`,
    data.subject ? `Subject: ${data.subject}` : '',
    data.instructorName ? `Instructor: ${data.instructorName}` : '',
    '',
    '---',
    `${GC_FULL_NAME} | ${GC_ADDRESS}`,
    'This is an automated message. Please do not reply.',
  ]
    .filter(Boolean)
    .join('\n');
}

// ─── Faculty Delivery Report Email ───────────────────────────────────────────

export interface FacultyDeliveryStudentStatus {
  studentName: string;
  studentId: string;
  status: 'Sent' | 'Failed';
  error?: string;
}

export interface FacultyDeliveryEmailData {
  instructorName: string;
  examTitle: string;
  className: string;
  total: number;
  sent: number;
  failed: number;
  date: string;
  subject?: string;
  students: FacultyDeliveryStudentStatus[];
}

function deliveryStatusBadge(sent: number, failed: number) {
  if (failed === 0) {
    return { text: 'DELIVERY COMPLETE', color: '#15803d' };
  }
  if (sent === 0) {
    return { text: 'DELIVERY FAILED', color: '#dc2626' };
  }
  return { text: 'PARTIAL DELIVERY', color: '#b45309' };
}

export function facultyDeliveryEmail(data: FacultyDeliveryEmailData): string {
  const { text: statusText, color: statusColor } = deliveryStatusBadge(
    data.sent,
    data.failed,
  );

  const maxRows = 100;
  const visibleStudents = data.students.slice(0, maxRows);
  const hiddenCount = Math.max(0, data.students.length - maxRows);

  const studentRowsHtml = visibleStudents
    .map((student) => {
      const isSent = student.status === 'Sent';
      const statusBg = isSent ? '#dcfce7' : '#fee2e2';
      const statusFg = isSent ? '#166534' : '#b91c1c';
      const errorNote = student.error
        ? `<div style="margin-top:2px;color:#9ca3af;font-size:11px;">${esc(student.error)}</div>`
        : '';

      return `
        <tr>
          <td style="padding:10px 12px;border-top:1px solid #e5e7eb;">
            <div style="font-size:13px;color:${GC_TEXT_DARK_HEX};font-weight:600;">${esc(student.studentName)}</div>
            <div style="font-size:11px;color:${GC_TEXT_MUTED_HEX};font-family:monospace;">${esc(student.studentId)}</div>
            ${errorNote}
          </td>
          <td align="right" style="padding:10px 12px;border-top:1px solid #e5e7eb;">
            <span style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;background:${statusBg};color:${statusFg};">
              ${esc(student.status)}
            </span>
          </td>
        </tr>
      `;
    })
    .join('');

  const body = `
    <p style="margin:0 0 6px;">Dear <strong>${esc(data.instructorName)}</strong>,</p>
    <p style="margin:0 0 20px;color:${GC_TEXT_MUTED_HEX};">
      Here is the delivery report for <strong>${esc(data.examTitle)}</strong>
      in <strong>${esc(data.className)}</strong>.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
      style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <tr><td style="padding:20px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="padding-bottom:16px;border-bottom:1px solid #e5e7eb;" colspan="2">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
              <td>
                <span style="font-size:36px;font-weight:700;color:${GC_PRIMARY_HEX};">${data.sent}</span>
                <span style="font-size:18px;color:${GC_TEXT_MUTED_HEX};">/ ${data.total}</span>
              </td>
              <td align="right">
                <span style="display:inline-block;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;color:#fff;background:${statusColor};">
                  ${statusText}
                </span>
              </td>
            </tr></table>
          </td></tr>
          <tr>
            <td style="padding-top:14px;" width="50%">
              <span style="display:block;font-size:11px;color:${GC_TEXT_MUTED_HEX};text-transform:uppercase;letter-spacing:0.5px;">Sent</span>
              <span style="display:block;font-size:20px;font-weight:700;color:#166534;">${data.sent}</span>
            </td>
            <td style="padding-top:14px;" width="50%">
              <span style="display:block;font-size:11px;color:${GC_TEXT_MUTED_HEX};text-transform:uppercase;letter-spacing:0.5px;">Failed</span>
              <span style="display:block;font-size:20px;font-weight:700;color:#b91c1c;">${data.failed}</span>
            </td>
          </tr>
          <tr>
            <td style="padding-top:10px;" width="50%">
              <span style="display:block;font-size:11px;color:${GC_TEXT_MUTED_HEX};text-transform:uppercase;letter-spacing:0.5px;">Date</span>
              <span style="display:block;font-size:14px;color:${GC_TEXT_DARK_HEX};">${esc(data.date)}</span>
            </td>
            <td style="padding-top:10px;" width="50%">
              ${
                data.subject
                  ? `
                <span style="display:block;font-size:11px;color:${GC_TEXT_MUTED_HEX};text-transform:uppercase;letter-spacing:0.5px;">Subject</span>
                <span style="display:block;font-size:14px;color:${GC_TEXT_DARK_HEX};">${esc(data.subject)}</span>
              `
                  : ''
              }
            </td>
          </tr>
        </table>
      </td></tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
      style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="padding:12px 12px;background:#f8fafc;border-bottom:1px solid #e5e7eb;font-size:12px;color:${GC_TEXT_MUTED_HEX};text-transform:uppercase;letter-spacing:0.5px;font-weight:700;">
          Student Recipients
        </td>
      </tr>
      ${studentRowsHtml || `
      <tr>
        <td style="padding:12px;font-size:13px;color:${GC_TEXT_MUTED_HEX};">No students were included in this send request.</td>
      </tr>`}
    </table>
    ${
      hiddenCount > 0
        ? `<p style="margin:10px 0 0;font-size:12px;color:${GC_TEXT_MUTED_HEX};">+ ${hiddenCount} more student(s) not shown in this email.</p>`
        : ''
    }

    <p style="margin:16px 0 0;font-size:13px;color:${GC_TEXT_MUTED_HEX};">
      — ${esc(data.instructorName)}, Instructor
    </p>
  `;

  return baseLayout(body);
}

export function facultyDeliveryText(data: FacultyDeliveryEmailData): string {
  const maxRows = 100;
  const visibleStudents = data.students.slice(0, maxRows);
  const hiddenCount = Math.max(0, data.students.length - maxRows);

  return [
    GC_SYSTEM_NAME,
    '',
    `Dear ${data.instructorName},`,
    '',
    `Delivery report for "${data.examTitle}" (${data.className})`,
    `Date: ${data.date}`,
    data.subject ? `Subject: ${data.subject}` : '',
    '',
    `Sent: ${data.sent}`,
    `Failed: ${data.failed}`,
    `Total: ${data.total}`,
    '',
    'Students:',
    ...visibleStudents.map((student) =>
      `- ${student.studentName} (${student.studentId}) — ${student.status}${student.error ? ` [${student.error}]` : ''}`,
    ),
    hiddenCount > 0 ? `... and ${hiddenCount} more student(s)` : '',
    '',
    '---',
    `${GC_FULL_NAME} | ${GC_ADDRESS}`,
    'This is an automated message. Please do not reply.',
  ]
    .filter(Boolean)
    .join('\n');
}

// ─── Class Score Summary Email ───────────────────────────────────────────────

export interface ClassScoreRecord {
  examId: string;
  examTitle: string;
  subject: string;
  score: number | null;
  totalQuestions: number;
  percentage: number | null;
  grade: string;
  status: 'Passed' | 'Failed' | 'Not Taken';
  date: string;
}

export interface ClassScoreSummaryEmailData {
  studentName: string;
  studentId: string;
  className: string;
  course?: string;
  passingThreshold: number;
  examRecords: ClassScoreRecord[];
  instructorName?: string;
}

export function classScoreSummaryEmail(data: ClassScoreSummaryEmailData): string {
  const attempted = data.examRecords.filter((record) => record.percentage !== null);
  const passedCount = attempted.filter((record) => record.status === 'Passed').length;
  const failedCount = attempted.filter((record) => record.status === 'Failed').length;
  const notTakenCount = data.examRecords.length - attempted.length;
  const average =
    attempted.length > 0
      ? Math.round(
          attempted.reduce(
            (sum, record) => sum + Number(record.percentage ?? 0),
            0,
          ) / attempted.length,
        )
      : null;

  const examRows = data.examRecords
    .map((record) => {
      const statusBg =
        record.status === 'Passed'
          ? '#dcfce7'
          : record.status === 'Failed'
            ? '#fee2e2'
            : '#f3f4f6';
      const statusFg =
        record.status === 'Passed'
          ? '#166534'
          : record.status === 'Failed'
            ? '#b91c1c'
            : '#4b5563';

      const scoreDisplay =
        record.score === null
          ? 'Not Taken'
          : `${record.score}/${record.totalQuestions} (${record.percentage}%)`;

      const gradeDisplay = record.score === null ? '—' : record.grade;

      return `
        <tr>
          <td style="padding:10px 12px;border-top:1px solid #e5e7eb;">
            <div style="font-size:13px;color:${GC_TEXT_DARK_HEX};font-weight:600;">${esc(record.examTitle)}</div>
            <div style="font-size:11px;color:${GC_TEXT_MUTED_HEX};">${esc(record.subject)}</div>
          </td>
          <td style="padding:10px 12px;border-top:1px solid #e5e7eb;font-size:12px;color:${GC_TEXT_DARK_HEX};">
            ${esc(scoreDisplay)}
          </td>
          <td style="padding:10px 12px;border-top:1px solid #e5e7eb;font-size:12px;color:${gradeColor(record.grade)};font-weight:700;">
            ${esc(gradeDisplay)}
          </td>
          <td align="right" style="padding:10px 12px;border-top:1px solid #e5e7eb;">
            <span style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;background:${statusBg};color:${statusFg};">
              ${esc(record.status)}
            </span>
          </td>
        </tr>
      `;
    })
    .join('');

  const body = `
    <p style="margin:0 0 6px;">Dear <strong>${esc(data.studentName)}</strong>,</p>
    <p style="margin:0 0 20px;color:${GC_TEXT_MUTED_HEX};">
      Here is your complete score record for <strong>${esc(data.className)}</strong>.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
      style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <tr><td style="padding:20px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding-bottom:12px;" width="50%">
              <span style="display:block;font-size:11px;color:${GC_TEXT_MUTED_HEX};text-transform:uppercase;letter-spacing:0.5px;">Student ID</span>
              <span style="display:block;font-size:14px;color:${GC_TEXT_DARK_HEX};font-family:monospace;">${esc(data.studentId)}</span>
            </td>
            <td style="padding-bottom:12px;" width="50%">
              <span style="display:block;font-size:11px;color:${GC_TEXT_MUTED_HEX};text-transform:uppercase;letter-spacing:0.5px;">Passing Threshold</span>
              <span style="display:block;font-size:14px;color:${GC_TEXT_DARK_HEX};">${data.passingThreshold}%</span>
            </td>
          </tr>
          <tr>
            <td style="padding-top:6px;" width="50%">
              <span style="display:block;font-size:11px;color:${GC_TEXT_MUTED_HEX};text-transform:uppercase;letter-spacing:0.5px;">Average (Taken Exams)</span>
              <span style="display:block;font-size:20px;font-weight:700;color:${GC_PRIMARY_HEX};">${average === null ? '—' : `${average}%`}</span>
            </td>
            <td style="padding-top:6px;" width="50%">
              <span style="display:block;font-size:11px;color:${GC_TEXT_MUTED_HEX};text-transform:uppercase;letter-spacing:0.5px;">Exam Summary</span>
              <span style="display:block;font-size:13px;color:${GC_TEXT_DARK_HEX};">${passedCount} Passed • ${failedCount} Failed • ${notTakenCount} Not Taken</span>
            </td>
          </tr>
          ${
            data.course
              ? `<tr>
            <td style="padding-top:8px;" colspan="2">
              <span style="display:block;font-size:11px;color:${GC_TEXT_MUTED_HEX};text-transform:uppercase;letter-spacing:0.5px;">Course</span>
              <span style="display:block;font-size:13px;color:${GC_TEXT_DARK_HEX};">${esc(data.course)}</span>
            </td>
          </tr>`
              : ''
          }
        </table>
      </td></tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
      style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="padding:12px;background:#f8fafc;border-bottom:1px solid #e5e7eb;font-size:12px;color:${GC_TEXT_MUTED_HEX};text-transform:uppercase;letter-spacing:0.5px;font-weight:700;">
          Exam Score Breakdown
        </td>
      </tr>
      ${examRows || `
      <tr>
        <td style="padding:12px;font-size:13px;color:${GC_TEXT_MUTED_HEX};">No exam records available.</td>
      </tr>`}
    </table>

    ${
      data.instructorName
        ? `<p style="margin:16px 0 0;font-size:13px;color:${GC_TEXT_MUTED_HEX};">— ${esc(data.instructorName)}, Instructor</p>`
        : ''
    }
  `;

  return baseLayout(body);
}

export function classScoreSummaryText(data: ClassScoreSummaryEmailData): string {
  const attempted = data.examRecords.filter((record) => record.percentage !== null);
  const average =
    attempted.length > 0
      ? Math.round(
          attempted.reduce(
            (sum, record) => sum + Number(record.percentage ?? 0),
            0,
          ) / attempted.length,
        )
      : null;

  return [
    GC_SYSTEM_NAME,
    '',
    `Dear ${data.studentName},`,
    '',
    `Here is your complete score record for ${data.className}.`,
    `Student ID: ${data.studentId}`,
    `Passing threshold: ${data.passingThreshold}%`,
    `Average (taken exams): ${average === null ? 'N/A' : `${average}%`}`,
    data.course ? `Course: ${data.course}` : '',
    '',
    'Exam Breakdown:',
    ...data.examRecords.map((record) => {
      const scoreDisplay =
        record.score === null
          ? 'Not Taken'
          : `${record.score}/${record.totalQuestions} (${record.percentage}%)`;
      const gradeDisplay = record.score === null ? '-' : record.grade;
      return `- ${record.examTitle} [${record.subject}] — ${scoreDisplay}, Grade: ${gradeDisplay}, Status: ${record.status}`;
    }),
    data.instructorName ? `Instructor: ${data.instructorName}` : '',
    '',
    '---',
    `${GC_FULL_NAME} | ${GC_ADDRESS}`,
    'This is an automated message. Please do not reply.',
  ]
    .filter(Boolean)
    .join('\n');
}
