'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, XCircle, AlertTriangle } from 'lucide-react';
import { ValidationError } from '@/services/recordValidationGuardService';

// === Types ===

interface GradeValidationFeedbackProps {
  /** Validation errors returned by RecordValidationGuardService */
  errors: ValidationError[];
  /** Optional title override */
  title?: string;
  /** Whether to render in compact (inline) or full (card) mode */
  variant?: 'inline' | 'card';
  /** Optional callback to dismiss the feedback */
  onDismiss?: () => void;
}

// ─── Field display names for human-readable messages ─────────────────────────

const FIELD_LABELS: Record<string, string> = {
  student_id: 'Student ID',
  exam_id: 'Exam ID',
  class_id: 'Class ID',
  score: 'Score',
  max_score: 'Max Score',
  grade_letter: 'Letter Grade',
  recorded_by: 'Recorded By',
  percentage: 'Percentage',
  examId: 'Exam ID',
  studentId: 'Student ID',
  userId: 'User ID',
  answers: 'Answers',
  answerKey: 'Answer Key',
};

function getFieldLabel(field: string): string {
  return FIELD_LABELS[field] || field;
}

function getSeverityIcon(severity: 'error' | 'warning') {
  return severity === 'error' ? (
    <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
  ) : (
    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function GradeValidationFeedback({
  errors,
  title,
  variant = 'card',
  onDismiss,
}: GradeValidationFeedbackProps) {
  if (!errors || errors.length === 0) return null;

  const errorCount = errors.filter((e) => e.severity === 'error').length;
  const warningCount = errors.filter((e) => e.severity === 'warning').length;

  const heading =
    title ||
    `Validation failed — ${errorCount} error${errorCount !== 1 ? 's' : ''}${
      warningCount > 0 ? `, ${warningCount} warning${warningCount !== 1 ? 's' : ''}` : ''
    }`;

  if (variant === 'inline') {
    return (
      <div className="text-sm space-y-1">
        {errors.map((err, i) => (
          <div key={i} className="flex items-start gap-1.5">
            {getSeverityIcon(err.severity)}
            <span className={err.severity === 'error' ? 'text-red-700' : 'text-amber-700'}>
              <strong>{getFieldLabel(err.field)}:</strong> {err.message}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <Alert className="border-red-200 bg-red-50">
      <AlertCircle className="h-4 w-4 text-red-600" />
      <AlertDescription>
        <div className="space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="font-semibold text-red-800 text-sm">{heading}</p>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-red-400 hover:text-red-600 text-xs underline"
              >
                Dismiss
              </button>
            )}
          </div>

          {/* Error list */}
          <ul className="space-y-1.5">
            {errors.map((err, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {getSeverityIcon(err.severity)}
                <div>
                  <Badge
                    variant={err.severity === 'error' ? 'destructive' : 'outline'}
                    className="text-[10px] px-1.5 py-0 mr-1.5"
                  >
                    {getFieldLabel(err.field)}
                  </Badge>
                  <span className={err.severity === 'error' ? 'text-red-700' : 'text-amber-700'}>
                    {err.message}
                  </span>
                  {err.value !== undefined && err.value !== null && (
                    <span className="text-muted-foreground ml-1 text-xs">
                      (received: {JSON.stringify(err.value)})
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </AlertDescription>
    </Alert>
  );
}
