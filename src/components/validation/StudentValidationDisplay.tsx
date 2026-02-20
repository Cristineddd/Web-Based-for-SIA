/**
 * Student Validation Error Display Component
 * Shows missing and invalid fields with visual feedback
 */

import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { StudentValidationError } from '@/services/studentFieldValidationService';

interface StudentValidationDisplayProps {
  rowIndex: number;
  status: 'valid' | 'invalid' | 'incomplete';
  errors?: StudentValidationError[];
  missingFields?: string[];
  studentName?: string;
}

export function StudentValidationDisplay({
  rowIndex,
  status,
  errors = [],
  missingFields = [],
  studentName = `Row ${rowIndex + 1}`,
}: StudentValidationDisplayProps) {
  if (status === 'valid') {
    return (
      <div className="flex items-center gap-2 p-2 rounded bg-green-50 border border-green-200">
        <CheckCircle2 className="w-4 h-4 text-green-600" />
        <span className="text-sm text-green-700">{studentName} - Valid</span>
      </div>
    );
  }

  const bgColor = status === 'incomplete' ? 'bg-yellow-50' : 'bg-red-50';
  const borderColor = status === 'incomplete' ? 'border-yellow-200' : 'border-red-200';
  const titleColor = status === 'incomplete' ? 'text-yellow-800' : 'text-red-800';
  const descColor = status === 'incomplete' ? 'text-yellow-700' : 'text-red-700';
  const Icon = status === 'incomplete' ? AlertCircle : AlertTriangle;
  const iconColor = status === 'incomplete' ? 'text-yellow-600' : 'text-red-600';

  return (
    <Alert className={`${bgColor} border ${borderColor}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-4 h-4 ${iconColor} mt-0.5`} />
        <div className="flex-1">
          <AlertTitle className={titleColor}>
            {studentName}
          </AlertTitle>
          <AlertDescription className={descColor}>
            {missingFields.length > 0 && (
              <div className="mt-2">
                <div className="font-semibold text-sm mb-1">Missing required fields:</div>
                <ul className="list-disc list-inside space-y-1">
                  {missingFields.map((field, idx) => (
                    <li key={idx} className="text-sm">
                      {field}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {errors.length > 0 && (
              <div className="mt-2">
                <div className="font-semibold text-sm mb-1">Validation errors:</div>
                <ul className="list-disc list-inside space-y-1">
                  {errors.map((error, idx) => (
                    <li key={idx} className="text-sm">
                      {error.field}: {error.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
}

interface BulkValidationSummaryProps {
  total: number;
  valid: number;
  invalid: number;
  missingFieldsByType: Record<string, number>;
}

export function BulkValidationSummary({
  total,
  valid,
  invalid,
  missingFieldsByType,
}: BulkValidationSummaryProps) {
  const successRate = total > 0 ? Math.round((valid / total) * 100) : 0;

  return (
    <Alert className={successRate === 100 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}>
      <div className="flex items-start gap-3">
        {successRate === 100 ? (
          <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
        ) : (
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
        )}
        <div className="flex-1">
          <AlertTitle className={successRate === 100 ? 'text-green-800' : 'text-yellow-800'}>
            Validation Summary
          </AlertTitle>
          <AlertDescription className={successRate === 100 ? 'text-green-700' : 'text-yellow-700'}>
            <div className="mt-2 space-y-2">
              <div className="flex justify-between">
                <span>Total Records:</span>
                <span className="font-semibold">{total}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Valid:</span>
                <span className="font-semibold">{valid} ({successRate}%)</span>
              </div>
              {invalid > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Invalid:</span>
                  <span className="font-semibold">{invalid}</span>
                </div>
              )}

              {Object.keys(missingFieldsByType).length > 0 && (
                <div className="mt-3 pt-3 border-t border-yellow-200">
                  <div className="font-semibold text-sm mb-2">Missing Fields Breakdown:</div>
                  <ul className="space-y-1 text-sm">
                    {Object.entries(missingFieldsByType).map(([field, count]) => (
                      <li key={field} className="flex justify-between">
                        <span>{field}:</span>
                        <span className="font-semibold">{count} records</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
}
