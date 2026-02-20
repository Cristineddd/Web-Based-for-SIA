'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StudentIDValidationService } from '@/services/studentIDValidationService';

interface StudentIDValidatorProps {
  studentId: string;
  onValidationChange: (isValid: boolean, errors: string[]) => void;
  showFeedback?: boolean;
}

export function StudentIDValidator({
  studentId,
  onValidationChange,
  showFeedback = true,
}: StudentIDValidatorProps) {
  const [validation, setValidation] = useState<{
    isValid: boolean;
    isEmpty: boolean;
    isDuplicate: boolean;
    error?: string;
  } | null>(null);

  useEffect(() => {
    const validateId = async () => {
      if (!showFeedback) return;

      try {
        const result = await StudentIDValidationService.validateStudentId(studentId);
        setValidation({
          isValid: result.isValid,
          isEmpty: result.isEmpty || false,
          isDuplicate: result.isDuplicate || false,
          error: result.error,
        });
        onValidationChange(result.isValid, result.error ? [result.error] : []);
      } catch (error) {
        const errorMsg = (error as Error).message;
        setValidation({
          isValid: false,
          isEmpty: false,
          isDuplicate: false,
          error: errorMsg,
        });
        onValidationChange(false, [errorMsg]);
      }
    };

    // Debounce validation
    const timer = setTimeout(() => {
      validateId();
    }, 500);

    return () => clearTimeout(timer);
  }, [studentId, showFeedback, onValidationChange]);

  if (!showFeedback || !validation) {
    return null;
  }

  return (
    <div className="space-y-2">
      {validation.isValid && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Student ID is valid and available
          </AlertDescription>
        </Alert>
      )}

      {!validation.isValid && validation.isEmpty && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Student ID is required and cannot be empty
          </AlertDescription>
        </Alert>
      )}

      {!validation.isValid && validation.isDuplicate && (
        <Alert className="border-orange-200 bg-orange-50">
          <XCircle className="w-4 h-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            {validation.error || 'This Student ID already exists in the system'}
          </AlertDescription>
        </Alert>
      )}

      {!validation.isValid && !validation.isEmpty && !validation.isDuplicate && validation.error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {validation.error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/**
 * Batch validation component for imports
 */
interface StudentIDBatchValidatorProps {
  records: Array<{
    student_id?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  }>;
  onValidationComplete: (result: {
    isValid: boolean;
    validRecords: any[];
    invalidRecords: any[];
    errors: string[];
  }) => void;
  isValidating?: boolean;
}

export function StudentIDBatchValidator({
  records,
  onValidationComplete,
  isValidating = false,
}: StudentIDBatchValidatorProps) {
  const [validationState, setValidationState] = useState<{
    isValid: boolean;
    validRecords: any[];
    invalidRecords: any[];
    errors: string[];
  } | null>(null);

  useEffect(() => {
    const validateBatch = async () => {
      try {
        const result = await StudentIDValidationService.validateStudentRecordsBatch(records);
        setValidationState(result);
        onValidationComplete(result);
      } catch (error) {
        const errorMsg = (error as Error).message;
        const result = {
          isValid: false,
          validRecords: [],
          invalidRecords: records.map((record, idx) => ({
            ...record,
            _rowIndex: idx + 1,
            _errors: [errorMsg],
          })),
          errors: [errorMsg],
        };
        setValidationState(result);
        onValidationComplete(result);
      }
    };

    if (records.length > 0 && !isValidating) {
      validateBatch();
    }
  }, [records, isValidating, onValidationComplete]);

  if (!validationState) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <div className="text-sm text-blue-600 font-medium">Total Records</div>
          <div className="text-2xl font-bold text-blue-900">{records.length}</div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg border border-green-200">
          <div className="text-sm text-green-600 font-medium">Valid</div>
          <div className="text-2xl font-bold text-green-900">{validationState.validRecords.length}</div>
        </div>
        <div className="bg-red-50 p-3 rounded-lg border border-red-200">
          <div className="text-sm text-red-600 font-medium">Invalid</div>
          <div className="text-2xl font-bold text-red-900">{validationState.invalidRecords.length}</div>
        </div>
        <div className={`p-3 rounded-lg border ${validationState.isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className={`text-sm font-medium ${validationState.isValid ? 'text-green-600' : 'text-red-600'}`}>
            Status
          </div>
          <div className={`text-lg font-bold ${validationState.isValid ? 'text-green-900' : 'text-red-900'}`}>
            {validationState.isValid ? 'Ready' : 'Issues'}
          </div>
        </div>
      </div>

      {/* Errors Summary */}
      {validationState.errors.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <AlertDescription>
            <div className="text-red-800 font-semibold mb-2">
              Found {validationState.errors.length} validation error(s):
            </div>
            <ul className="list-disc list-inside space-y-1">
              {validationState.errors.slice(0, 5).map((error, idx) => (
                <li key={idx} className="text-sm text-red-700">
                  {error}
                </li>
              ))}
              {validationState.errors.length > 5 && (
                <li className="text-sm text-red-700">
                  ...and {validationState.errors.length - 5} more
                </li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Invalid Records Details */}
      {validationState.invalidRecords.length > 0 && (
        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <h4 className="font-semibold text-red-900 mb-3">Problem Records:</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {validationState.invalidRecords.map((record, idx) => (
              <div key={idx} className="bg-white p-2 rounded border border-red-200">
                <div className="text-sm font-medium text-red-900">
                  Row {record._rowIndex}: {record.student_id || 'NO_ID'}
                </div>
                <ul className="text-xs text-red-700 space-y-1 mt-1">
                  {record._errors?.map((error: string, errorIdx: number) => (
                    <li key={errorIdx} className="flex items-start gap-2">
                      <span className="text-red-500 mt-1">•</span>
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
