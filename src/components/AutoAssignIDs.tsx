'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { StudentIDService, StudentIDConfig } from '@/services/studentIDService';
import { useToast } from '@/hooks/use-toast';

interface AutoAssignIDsProps {
  students: Array<{ index: number; first_name: string; last_name: string; student_id?: string }>;
  onAssign: (ids: Array<{ index: number; student_id: string }>) => void;
  onCancel?: () => void;
}

export function AutoAssignIDs({ students, onAssign, onCancel }: AutoAssignIDsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [idConfig, setIdConfig] = useState<StudentIDConfig>({
    format: 'YEARLY_SEQUENCE',
    length: 4,
    startFrom: 1,
  });
  const [previewIDs, setPreviewIDs] = useState<string[]>([]);
  const { toast } = useToast();

  // Filter students that need IDs
  const studentsNeedingIds = students.filter((s) => !s.student_id || s.student_id.trim() === '');

  const handleAutoAssign = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Auto-assign IDs
      const result = await StudentIDService.autoAssignIDs(
        studentsNeedingIds.map((s) => ({
          student_id: s.student_id || '',
          first_name: s.first_name,
          last_name: s.last_name,
        })),
        idConfig
      );

      if (!result.success) {
        setError(result.error || 'Failed to auto-assign IDs');
        return;
      }

      if (result.conflicts && result.conflicts.length > 0) {
        setError(
          `Found ${result.conflicts.length} conflicting ID(s): ${result.conflicts.map((c) => c.studentId).join(', ')}`
        );
        return;
      }

      if (result.ids && result.ids.length > 0) {
        // Map generated IDs to student indices
        const assignments = studentsNeedingIds.map((student, idx) => ({
          index: student.index,
          student_id: result.ids![idx],
        }));

        setPreviewIDs(result.ids);
        setSuccess(`Successfully generated ${result.ids.length} student IDs`);

        // Call the callback after a short delay to let user see success message
        setTimeout(() => {
          onAssign(assignments);
          toast({
            title: 'Success',
            description: `Auto-assigned ${result.ids!.length} student IDs`,
          });
        }, 1500);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePreview = () => {
    const preview = StudentIDService.generateTemporaryIDs(studentsNeedingIds.length, idConfig);
    setPreviewIDs(preview);
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent" />
          Auto-Assign Student IDs
        </CardTitle>
        <CardDescription>
          Generate temporary IDs for {studentsNeedingIds.length} student(s) without IDs
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ID Format Configuration */}
        <div className="space-y-4">
          <h3 className="font-semibold">ID Format Configuration</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="format">Format</Label>
              <select
                id="format"
                value={idConfig.format}
                onChange={(e) =>
                  setIdConfig({
                    ...idConfig,
                    format: e.target.value as StudentIDConfig['format'],
                  })
                }
                className="w-full px-3 py-2 border rounded-md bg-background text-sm"
              >
                <option value="YEARLY_SEQUENCE">Yearly Sequence (2026-0001)</option>
              </select>
            </div>

            <div>
              <Label htmlFor="length">Sequence Digits</Label>
              <Input
                id="length"
                type="number"
                value={idConfig.length}
                onChange={(e) =>
                  setIdConfig({
                    ...idConfig,
                    length: Math.max(4, parseInt(e.target.value) || 4),
                  })
                }
                min="4"
                max="4"
                disabled
                className="text-sm"
              />
            </div>

            <div>
              <Label htmlFor="startFrom">Start From</Label>
              <Input
                id="startFrom"
                type="number"
                value={idConfig.startFrom || 1}
                onChange={(e) =>
                  setIdConfig({
                    ...idConfig,
                    startFrom: Math.max(1, parseInt(e.target.value) || 1),
                  })
                }
                min="1"
                className="text-sm"
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        {previewIDs.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold">Preview ({previewIDs.length} IDs)</h3>
            <div className="bg-muted p-3 rounded-md max-h-40 overflow-y-auto">
              <div className="grid grid-cols-4 gap-2 text-sm font-mono">
                {previewIDs.slice(0, 20).map((id, idx) => (
                  <div key={idx} className="p-2 bg-background rounded">
                    {id}
                  </div>
                ))}
                {previewIDs.length > 20 && (
                  <div className="col-span-4 text-center text-muted-foreground">
                    ... and {previewIDs.length - 20} more
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleGeneratePreview}
            disabled={loading}
          >
            Preview IDs
          </Button>
          <Button
            onClick={handleAutoAssign}
            disabled={loading || studentsNeedingIds.length === 0}
          >
            {loading ? 'Assigning...' : 'Auto-Assign IDs'}
          </Button>
        </div>

        {/* Information */}
        <div className="text-sm text-muted-foreground p-3 bg-muted rounded">
          <p>
            <strong>Note:</strong> This will auto-generate unique IDs for {studentsNeedingIds.length} student(s).
            The system checks for conflicts with existing student records.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
