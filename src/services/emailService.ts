/**
 * Email Service
 *
 * Server-side email delivery using Nodemailer.
 * SMTP credentials are configured once via environment variables
 * (.env.local) — no per-instructor setup needed.
 *
 * Required env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS
 * Optional:
 *   SMTP_FROM_NAME, SMTP_FROM_EMAIL
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface EmailResult {
  success: boolean;
  to: string;
  messageId?: string;
  error?: string;
}

// ─── Singleton transporter ──────────────────────────────────────────────────

let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (_transporter) return _transporter;

  const options: SMTPTransport.Options = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  };

  _transporter = nodemailer.createTransport(options);
  return _transporter;
}

function getFromAddress(): string {
  const name = process.env.SMTP_FROM_NAME || 'GC SMART CHECK';
  const email = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@gordoncollege.edu.ph';
  return `"${name}" <${email}>`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Check whether SMTP credentials are present in env vars. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Test the SMTP connection. Throws on failure. */
export async function verifyConnection(): Promise<boolean> {
  const t = getTransporter();
  await t.verify();
  return true;
}

/** Send a single email. */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const transporter = getTransporter();

  try {
    const info = await transporter.sendMail({
      from: getFromAddress(),
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
        encoding: a.encoding,
      })),
    });

    return { success: true, to: message.to, messageId: info.messageId };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[EmailService] Failed to send to ${message.to}:`, errorMessage);
    return { success: false, to: message.to, error: errorMessage };
  }
}

// ─── Email Queue ────────────────────────────────────────────────────────────

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2_000;
const CONCURRENCY = 3;

/**
 * Send a batch of emails with concurrency and retry logic.
 * Returns one EmailResult per message.
 */
export async function processEmailQueue(
  messages: EmailMessage[],
): Promise<EmailResult[]> {
  interface QueueItem extends EmailMessage {
    attempts: number;
  }

  const pending: QueueItem[] = messages.map((m) => ({ ...m, attempts: 0 }));
  const results: EmailResult[] = [];

  async function processOne(item: QueueItem): Promise<void> {
    item.attempts++;
    const result = await sendEmail(item);

    if (result.success) {
      results.push(result);
    } else if (item.attempts < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return processOne(item);
    } else {
      results.push(result);
    }
  }

  // Process in batches of CONCURRENCY
  const queue = [...pending];
  while (queue.length > 0) {
    const batch = queue.splice(0, CONCURRENCY);
    await Promise.all(batch.map(processOne));
  }

  return results;
}
