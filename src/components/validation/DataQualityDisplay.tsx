/**
 * Data Quality Display Component
 * Shows duplicates and inconsistencies with visual feedback and admin actions
 */

import React, { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataQualityResult } from '@/services/dataQualityService';

interface DataQualityDisplayProps {
  result: DataQualityResult;
  onProceed?: () => void;
  onCancel?: () => void;
  allowOverride?: boolean;
}

export function DataQualityDisplay({
  result,
  onProceed,
  onCancel,
  allowOverride = true,
}: DataQualityDisplayProps) {
  const [expandedDuplicates, setExpandedDuplicates] = useState<Set<number>>(new Set());
  const [expandedInconsistencies, setExpandedInconsistencies] = useState<Set<number>>(new Set());

  const toggleDuplicate = (index: number) => {
    const newSet = new Set(expandedDuplicates);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setExpandedDuplicates(newSet);
  };

  const toggleInconsistency = (index: number) => {
    const newSet = new Set(expandedInconsistencies);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setExpandedInconsistencies(newSet);
  };

  if (result.isClean) {
    return (
      <Alert className="bg-green-50 border-green-200">
        <CheckCircle2 className="w-5 h-5 text-green-600" />
        <AlertTitle className="text-green-800">Data Quality Check Passed</AlertTitle>
        <AlertDescription className="text-green-700">
          ✓ All records are clean with no duplicates or inconsistencies detected.
        </AlertDescription>
      </Alert>
    );
  }

  const canProceed = result.summary.highSeverityCount === 0;
  const bgColor = canProceed ? 'bg-yellow-50' : 'bg-red-50';
  const borderColor = canProceed ? 'border-yellow-200' : 'border-red-200';
  const titleColor = canProceed ? 'text-yellow-800' : 'text-red-800';
  const descColor = canProceed ? 'text-yellow-700' : 'text-red-700';

  return (
    <div className="space-y-4">
      <Alert className={`${bgColor} border ${borderColor}`}>
        <AlertTriangle className={`w-5 h-5 ${canProceed ? 'text-yellow-600' : 'text-red-600'}`} />
        <AlertTitle className={titleColor}>
          Data Quality Issues Detected
        </AlertTitle>
        <AlertDescription className={descColor}>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between">
              <span>Total Issues:</span>
              <span className="font-semibold">{result.totalIssues}</span>
            </div>
            
            {result.summary.duplicateCount > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>Duplicates:</span>
                <span className="font-semibold">{result.summary.duplicateCount}</span>
              </div>
            )}
            
            {result.summary.inconsistencyCount > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>Inconsistencies:</span>
                <span className="font-semibold">{result.summary.inconsistencyCount}</span>
              </div>
            )}

            {result.summary.highSeverityCount > 0 && (
              <div className="flex justify-between text-red-600 font-semibold">
                <span>🔴 High Severity:</span>
                <span>{result.summary.highSeverityCount}</span>
              </div>
            )}

            {result.summary.mediumSeverityCount > 0 && (
              <div className="flex justify-between text-yellow-600">
                <span>🟡 Medium Severity:</span>
                <span>{result.summary.mediumSeverityCount}</span>
              </div>
            )}

            {result.summary.lowSeverityCount > 0 && (
              <div className="flex justify-between text-blue-600">
                <span>🔵 Low Severity:</span>
                <span>{result.summary.lowSeverityCount}</span>
              </div>
            )}
          </div>
        </AlertDescription>
      </Alert>

      {/* Duplicates Section */}
      {result.duplicates.length > 0 && (
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            Duplicates Found ({result.duplicates.length})
          </h3>

          {result.duplicates.map((duplicate, idx) => (
            <div
              key={idx}
              className="border border-orange-200 rounded p-3 bg-orange-50"
            >
              <button
                onClick={() => toggleDuplicate(idx)}
                className="w-full flex items-center justify-between hover:bg-orange-100 p-2 rounded transition-colors"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-600 mt-1" />
                  <div className="text-left">
                    <div className="font-semibold text-orange-900">{duplicate.message}</div>
                    <div className="text-sm text-orange-700 mt-1">
                      Type: {duplicate.type} | Severity: {duplicate.severity}
                    </div>
                  </div>
                </div>
                {expandedDuplicates.has(idx) ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>

              {expandedDuplicates.has(idx) && (
                <div className="mt-3 ml-6 p-3 bg-white rounded border border-orange-100">
                  <div className="text-sm text-orange-900">
                    <div className="font-semibold mb-2">Affected Records:</div>
                    {duplicate.records.map((record, ridx) => (
                      <div key={ridx} className="py-2 border-t border-orange-100 first:border-t-0">
                        <div>
                          <span className="text-xs font-semibold text-orange-700">
                            Row {record.rowIndex ? record.rowIndex + 1 : '?'}:
                          </span>
                          {record.student_id && (
                            <span className="ml-2 text-sm">ID: {record.student_id}</span>
                          )}
                        </div>
                        {record.first_name && record.last_name && (
                          <div className="text-sm">
                            {record.first_name} {record.last_name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Inconsistencies Section */}
      {result.inconsistencies.length > 0 && (
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            Inconsistencies Found ({result.inconsistencies.length})
          </h3>

          {result.inconsistencies.map((inconsistency, idx) => (
            <div
              key={idx}
              className={`border rounded p-3 ${
                inconsistency.severity === 'high'
                  ? 'border-red-200 bg-red-50'
                  : inconsistency.severity === 'medium'
                  ? 'border-yellow-200 bg-yellow-50'
                  : 'border-blue-200 bg-blue-50'
              }`}
            >
              <button
                onClick={() => toggleInconsistency(idx)}
                className="w-full flex items-center justify-between hover:opacity-75 p-2 rounded transition-colors"
              >
                <div className="flex items-start gap-2 text-left">
                  <AlertCircle
                    className={`w-4 h-4 mt-1 ${
                      inconsistency.severity === 'high'
                        ? 'text-red-600'
                        : inconsistency.severity === 'medium'
                        ? 'text-yellow-600'
                        : 'text-blue-600'
                    }`}
                  />
                  <div>
                    <div className="font-semibold">
                      Row {inconsistency.rowIndex + 1} - {inconsistency.field}
                    </div>
                    <div className="text-sm mt-1">{inconsistency.issue}</div>
                    {inconsistency.suggestion && (
                      <div className="text-sm font-semibold mt-1">
                        Suggestion: {inconsistency.suggestion}
                      </div>
                    )}
                  </div>
                </div>
                {expandedInconsistencies.has(idx) ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t">
        {onCancel && (
          <Button onClick={onCancel} variant="outline">
            Cancel
          </Button>
        )}

        {onProceed && (
          <Button
            onClick={onProceed}
            disabled={!canProceed && !allowOverride}
            className={
              canProceed || allowOverride
                ? 'bg-orange-600 hover:bg-orange-700'
                : 'opacity-50 cursor-not-allowed'
            }
          >
            {canProceed ? 'Proceed with Import' : 'Fix Issues Before Importing'}
          </Button>
        )}

        {!canProceed && allowOverride && (
          <Button
            onClick={onProceed}
            variant="outline"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            Override & Import (Not Recommended)
          </Button>
        )}
      </div>
    </div>
  );
}
