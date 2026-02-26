'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { DuplicateScoreMatch } from '@/services/duplicateScoreDetectionService';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DuplicateScoreOverrideResult {
  /** Whether the faculty chose to override */
  action: 'override' | 'cancel';
  /** Reason provided by faculty — required for override */
  reason: string;
}

interface DuplicateScoreOverrideDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Details of the existing duplicate score */
  duplicateMatch: DuplicateScoreMatch | null;
  /** The new score that is attempting to be saved */
  newScore: number;
  /** Max score for the new submission */
  newMaxScore: number;
  /** Callback when the faculty confirms override */
  onOverride: (reason: string) => void;
  /** Callback when the dialog is cancelled */
  onCancel: () => void;
  /** Whether the override is currently being processed */
  isLoading?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DuplicateScoreOverrideDialog({
  open,
  duplicateMatch,
  newScore,
  newMaxScore,
  onOverride,
  onCancel,
  isLoading = false,
}: DuplicateScoreOverrideDialogProps) {
  const [reason, setReason] = useState('');
  const [showReasonError, setShowReasonError] = useState(false);

  const handleOverride = () => {
    if (!reason.trim()) {
      setShowReasonError(true);
      return;
    }
    setShowReasonError(false);
    onOverride(reason.trim());
    setReason('');
  };

  const handleCancel = () => {
    setReason('');
    setShowReasonError(false);
    onCancel();
  };

  if (!duplicateMatch) return null;

  const newPercentage = newMaxScore > 0 ? Math.round((newScore / newMaxScore) * 100) : 0;
  const scoreDifference = newScore - duplicateMatch.existingScore;
  const isImprovement = scoreDifference > 0;

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
            <ShieldAlert className="h-5 w-5" />
            Duplicate Score Override
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            A score already exists for this student on this exam. As faculty, you
            can override the existing score. This action is audited.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 my-2">
          {/* Student & Exam Info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Student: <strong className="text-foreground">{duplicateMatch.studentId}</strong></span>
            <span className="text-muted-foreground">|</span>
            <span>Exam: <strong className="text-foreground">{duplicateMatch.examId}</strong></span>
          </div>

          {/* Score Comparison */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            {/* Existing Score */}
            <div className="bg-muted/50 border rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">
                Existing Score
              </p>
              <p className="text-2xl font-bold tabular-nums">
                {duplicateMatch.existingScore}/{duplicateMatch.existingMaxScore}
              </p>
              <Badge variant="secondary" className="mt-1">
                {duplicateMatch.existingPercentage}%
              </Badge>
              {duplicateMatch.recordedAt && (
                <p className="text-xs text-muted-foreground mt-2">
                  Recorded {new Date(duplicateMatch.recordedAt).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Arrow */}
            <ArrowRight className="h-5 w-5 text-muted-foreground" />

            {/* New Score */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
              <p className="text-xs text-amber-700 mb-1 font-medium uppercase tracking-wide">
                New Score
              </p>
              <p className="text-2xl font-bold tabular-nums">
                {newScore}/{newMaxScore}
              </p>
              <Badge
                variant={isImprovement ? 'default' : 'destructive'}
                className="mt-1"
              >
                {newPercentage}%
                {scoreDifference !== 0 && (
                  <span className="ml-1">
                    ({scoreDifference > 0 ? '+' : ''}{scoreDifference})
                  </span>
                )}
              </Badge>
            </div>
          </div>

          {/* Warning */}
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-sm">
              Overriding will replace the existing score. The original score will
              be preserved in the audit log. This action cannot be undone.
            </AlertDescription>
          </Alert>

          {/* Override Reason (required) */}
          <div className="space-y-2">
            <Label htmlFor="override-reason" className="text-sm font-medium">
              Override Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="override-reason"
              placeholder="Provide a reason for overriding the existing score (e.g., rescored exam, grading error correction, student appeal)..."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (e.target.value.trim()) setShowReasonError(false);
              }}
              className={showReasonError ? 'border-red-400 focus-visible:ring-red-400' : ''}
              rows={3}
            />
            {showReasonError && (
              <p className="text-sm text-red-500">
                A reason is required to override a duplicate score.
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-2">
          <AlertDialogCancel onClick={handleCancel} disabled={isLoading}>
            Cancel
          </AlertDialogCancel>
          <Button
            onClick={handleOverride}
            disabled={isLoading}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Overriding...
              </>
            ) : (
              'Override & Save New Score'
            )}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
