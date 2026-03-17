/**
 * Student Import Handler
 * Manages student imports with comprehensive validation
 * Prevents duplicates and missing IDs
 */

'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { StudentIDValidationService } from '@/services/studentIDValidationService';
import { StudentService } from '@/services/studentService';
import { DuplicateDetectionService } from '@/services/duplicateDetectionService';
import { DuplicateReviewDialog, DuplicateReviewResolution } from './modals/DuplicateReviewDialog';
import { StudentIDBatchValidator } from './StudentIDValidator';

interface StudentImportHandlerProps {
  onImportComplete?: (importedStudents: any[]) => void;
  onImportError?: (errors: string[]) => void;
}

export function StudentImportHandler({
  onImportComplete,
  onImportError,
}: StudentImportHandlerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRecords, setParsedRecords] = useState<any[]>([]);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [duplicateDetectionResult, setDuplicateDetectionResult] = useState<any>(null);
  const [showDuplicateReview, setShowDuplicateReview] = useState(false);
  const [skippedRecords, setSkippedRecords] = useState<Set<string>>(new Set());

  /**
   * Parse Excel/CSV file
   */
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setValidationResult(null);
    setParsedRecords([]);
    setImportProgress(0);

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
          toast.error('No data found in file');
          return;
        }

        // Normalize column names
        const normalizedRecords = data.map((row: any) => ({
          student_id: row['Student ID'] || row['student_id'] || row['ID'] || row['id'] || '',
          first_name: row['First Name'] || row['first_name'] || row['First'] || row['first'] || '',
          last_name: row['Last Name'] || row['last_name'] || row['Last'] || row['last'] || '',
          email: row['Email'] || row['email'] || row['E-mail'] || '',
          grade: row['Grade'] || row['grade'] || row['Year'] || row['year'] || '',
          section: row['Section'] || row['section'] || row['Block'] || row['block'] || '',
        }));

        setParsedRecords(normalizedRecords);
        toast.success(`Parsed ${data.length} records from file`);
      };
      reader.readAsArrayBuffer(selectedFile);
    } catch (error) {
      toast.error(`Error reading file: ${(error as Error).message}`);
    }
  };

  /**
   * Handle validation completion
   */
  const handleValidationComplete = async (result: any) => {
    console.log('[StudentImportHandler] Validation complete:', result);
    setValidationResult(result);
    
    // After validation passes, check for duplicates
    if (result.isValid) {
      try {
        console.log('[StudentImportHandler] Starting duplicate detection for', result.validRecords.length, 'records');
        const duplicateResult = await DuplicateDetectionService.detectDuplicates(
          result.validRecords
        );

        console.log('[StudentImportHandler] Duplicate detection result:', {
          hasDuplicates: duplicateResult.hasDuplicates,
          totalRecords: duplicateResult.totalRecords,
          duplicateCount: duplicateResult.duplicateCount,
          potentialDuplicatesCount: duplicateResult.potentialDuplicates.length,
        });

        // Also check for duplicates within the batch itself
        const internalDuplicates = DuplicateDetectionService.findInternalDuplicates(
          result.validRecords
        );

        console.log('[StudentImportHandler] Internal duplicates found:', internalDuplicates.length);

        const allDuplicates = [
          ...duplicateResult.potentialDuplicates,
          ...internalDuplicates,
        ];

        if (allDuplicates.length > 0) {
          console.log('[StudentImportHandler] Showing duplicate review dialog with', allDuplicates.length, 'duplicates');
          setDuplicateDetectionResult({
            ...duplicateResult,
            potentialDuplicates: allDuplicates,
          });
          setShowDuplicateReview(true);
          toast.warning(`Found ${allDuplicates.length} potential duplicate record(s). Please review.`);
        } else {
          console.log('[StudentImportHandler] No duplicates found, ready to import');
        }
      } catch (error) {
        console.error('[StudentImportHandler] Error detecting duplicates:', error);
        toast.error('Error checking for duplicates. Please proceed with caution.');
      }
    }
  };

  /**
   * Import validated students (after duplicate review)
   */
  const handleImport = async (resolution?: DuplicateReviewResolution) => {
    if (!validationResult?.isValid) {
      toast.error('Please fix validation errors before importing');
      return;
    }

    setImporting(true);
    setImportProgress(0);
    const importedStudents: any[] = [];
    const errors: string[] = [];

    try {
      const appliedResolution: DuplicateReviewResolution = resolution || {
        skippedStudentIds: Array.from(skippedRecords),
        editedStudentIds: [],
        mergedStudentIds: [],
      };

      const skipSet = new Set(appliedResolution.skippedStudentIds);
      const editMap = new Map(appliedResolution.editedStudentIds.map((e) => [e.from, e.to]));
      const mergeMap = new Map(appliedResolution.mergedStudentIds.map((m) => [m.from, m.into]));

      for (const merge of appliedResolution.mergedStudentIds) {
        try {
          const uploadRecord = validationResult.validRecords.find(
            (record: any) => record.student_id === merge.from
          );

          if (!uploadRecord) {
            errors.push(`${merge.from}: merge source not found in upload`);
            continue;
          }

          const existing = await StudentService.getStudentById(merge.into);
          if (!existing) {
            errors.push(`${merge.from}: merge target "${merge.into}" does not exist`);
            continue;
          }

          const updates: Record<string, string> = {};
          if (!existing.first_name && uploadRecord.first_name) updates.first_name = uploadRecord.first_name;
          if (!existing.last_name && uploadRecord.last_name) updates.last_name = uploadRecord.last_name;
          if (!existing.email && uploadRecord.email) updates.email = uploadRecord.email;
          if (!existing.grade && uploadRecord.grade) updates.grade = uploadRecord.grade;
          if (!existing.section && uploadRecord.section) updates.section = uploadRecord.section;

          if (Object.keys(updates).length > 0) {
            await StudentService.updateStudent(existing.student_id, updates);
          }
        } catch (error) {
          errors.push(`${merge.from}: failed to merge - ${(error as Error).message}`);
        }
      }

      const recordsToImport = validationResult.validRecords
        .filter((record: any) => !skipSet.has(record.student_id) && !mergeMap.has(record.student_id))
        .map((record: any) => ({
          ...record,
          student_id: (editMap.get(record.student_id) || record.student_id).trim(),
        }));

      for (const edit of appliedResolution.editedStudentIds) {
        const format = StudentIDValidationService.validateStudentIdFormat(edit.to);
        if (!format.isValid) {
          errors.push(`${edit.from}: ${format.error || 'Invalid edited ID format'}`);
        }
      }

      const seenResolvedIds = new Set<string>();
      recordsToImport.forEach((record: any) => {
        if (seenResolvedIds.has(record.student_id)) {
          errors.push(`${record.student_id}: duplicate after conflict resolution`);
          return;
        }
        seenResolvedIds.add(record.student_id);
      });

      if (errors.length > 0) {
        toast.error('Conflict resolution contains invalid actions.');
        onImportError?.(errors);
        setImporting(false);
        return;
      }

      const totalRecords = recordsToImport.length;

      for (let i = 0; i < recordsToImport.length; i++) {
        const record = recordsToImport[i];

        try {
          // Double-check for duplicates before importing
          const existingStudent = await StudentService.getStudentById(record.student_id);
          if (existingStudent) {
            errors.push(
              `${record.student_id}: Already exists - ${existingStudent.first_name} ${existingStudent.last_name} (created: ${new Date(existingStudent.created_at).toLocaleDateString()})`
            );
            continue;
          }

          // Validate again before importing
          const finalValidation = await StudentIDValidationService.validateStudentRecord(
            record.student_id,
            record.first_name,
            record.last_name,
            record.grade,
            record.section
          );

          if (!finalValidation.isValid) {
            errors.push(`${record.student_id}: ${finalValidation.errors.join('; ')}`);
            continue;
          }

          // Create student
          const student = await StudentService.createStudent(
            record.student_id,
            record.first_name,
            record.last_name,
            record.email,
            'import', // system user
            record.section,
            record.grade
          );

          importedStudents.push(student);
          setImportProgress(Math.round(((i + 1) / totalRecords) * 100));
        } catch (error) {
          errors.push(`${record.student_id}: ${(error as Error).message}`);
        }
      }

      if (importedStudents.length > 0) {
        toast.success(`Successfully imported ${importedStudents.length} students`);
        onImportComplete?.(importedStudents);
      }

      if (appliedResolution.skippedStudentIds.length > 0) {
        toast.info(
          `Skipped ${appliedResolution.skippedStudentIds.length} record${appliedResolution.skippedStudentIds.length !== 1 ? 's' : ''} due to duplicate detection`
        );
      }

      if (appliedResolution.mergedStudentIds.length > 0) {
        toast.info(
          `Merged ${appliedResolution.mergedStudentIds.length} record${appliedResolution.mergedStudentIds.length !== 1 ? 's' : ''} into existing records`
        );
      }

      if (errors.length > 0) {
        toast.warning(`Import completed with ${errors.length} errors`);
        onImportError?.(errors);
      }

      // Reset form
      setFile(null);
      setParsedRecords([]);
      setValidationResult(null);
      setImportProgress(0);
      setDuplicateDetectionResult(null);
      setSkippedRecords(new Set());
    } catch (error) {
      const errorMsg = `Import failed: ${(error as Error).message}`;
      toast.error(errorMsg);
      onImportError?.([errorMsg]);
    } finally {
      setImporting(false);
    }
  };

  /**
   * Handle duplicate review completion
   */
  const handleDuplicateReviewComplete = (resolution: DuplicateReviewResolution) => {
    setSkippedRecords(new Set(resolution.skippedStudentIds));
    setShowDuplicateReview(false);
    
    if (resolution.skippedStudentIds.length > 0) {
      toast.info(
        `${resolution.skippedStudentIds.length} record${resolution.skippedStudentIds.length !== 1 ? 's' : ''} marked to skip`
      );
    }

    if (resolution.editedStudentIds.length > 0) {
      toast.info(
        `${resolution.editedStudentIds.length} record${resolution.editedStudentIds.length !== 1 ? 's' : ''} set to edit before import`
      );
    }

    if (resolution.mergedStudentIds.length > 0) {
      toast.info(
        `${resolution.mergedStudentIds.length} record${resolution.mergedStudentIds.length !== 1 ? 's' : ''} set to merge`
      );
    }
    
    // Proceed with import using selected manual resolutions.
    handleImport(resolution);
  };

  return (
    <div className="space-y-4 p-6 border rounded-lg bg-gray-50">
      <h3 className="font-semibold text-lg">Import Students</h3>

      {/* Duplicate Review Dialog */}
      {duplicateDetectionResult && (
        <DuplicateReviewDialog
          open={showDuplicateReview}
          duplicates={duplicateDetectionResult.potentialDuplicates}
          totalRecords={validationResult?.parsedCount || duplicateDetectionResult.totalRecords}
          onProceed={handleDuplicateReviewComplete}
          onCancel={() => {
            setShowDuplicateReview(false);
            setDuplicateDetectionResult(null);
            setValidationResult(null);
            setParsedRecords([]);
          }}
          isLoading={importing}
        />
      )}

      {/* File Upload */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            disabled={importing}
            className="flex-1"
          />
          {file && <CheckCircle className="w-5 h-5 text-green-600" />}
        </div>

        {file && (
          <Alert className="border-blue-200 bg-blue-50">
            <AlertCircle className="w-4 h-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              File loaded: <strong>{file.name}</strong> ({parsedRecords.length} records)
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Validation Results */}
      {parsedRecords.length > 0 && (
        <StudentIDBatchValidator
          records={parsedRecords}
          onValidationComplete={handleValidationComplete}
          isValidating={false}
        />
      )}

      {/* Import Button */}
      {validationResult?.isValid && parsedRecords.length > 0 && !showDuplicateReview && (
        <Button
          onClick={() => handleImport()}
          disabled={importing}
          className="w-full"
          size="lg"
        >
          {importing ? (
            <>
              <div className="animate-spin mr-2">⟳</div>
              Importing ({importProgress}%)
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Import {validationResult.validRecords.length - skippedRecords.size} Students
            </>
          )}
        </Button>
      )}

      {/* Required Format Info */}
      <div className="mt-6 p-4 bg-white border rounded">
        <h4 className="font-semibold mb-2">Required File Format:</h4>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>📋 Column headers: <code className="bg-gray-100 px-2 py-1">Student ID</code>, <code className="bg-gray-100 px-2 py-1">First Name</code>, <code className="bg-gray-100 px-2 py-1">Last Name</code>, <code className="bg-gray-100 px-2 py-1">Email</code> (optional)</li>
          <li>✓ Student ID must be unique and not empty</li>
          <li>✓ Student ID format: <code className="bg-gray-100 px-2 py-1">YYYY-XXXX</code> (example: <code className="bg-gray-100 px-2 py-1">2026-0001</code>)</li>
          <li>✓ Sequence must be between 0001 and 9999</li>
          <li>✓ First and Last names are required</li>
        </ul>
      </div>
    </div>
  );
}
