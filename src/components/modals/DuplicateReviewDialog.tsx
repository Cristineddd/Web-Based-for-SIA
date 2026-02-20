'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  AlertTriangle,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { DuplicateMatch } from '@/services/duplicateDetectionService';

interface DuplicateReviewDialogProps {
  open: boolean;
  duplicates: DuplicateMatch[];
  totalRecords: number;
  onProceed: (skippedRecords: string[]) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DuplicateReviewDialog({
  open,
  duplicates,
  totalRecords,
  onProceed,
  onCancel,
  isLoading = false,
}: DuplicateReviewDialogProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [selectedToSkip, setSelectedToSkip] = useState<Set<number>>(new Set());

  const handleToggleSkip = (index: number) => {
    const newSet = new Set(selectedToSkip);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedToSkip(newSet);
  };

  const handleSkipAll = () => {
    setSelectedToSkip(new Set(duplicates.map((_, i) => i)));
  };

  const handleSkipNone = () => {
    setSelectedToSkip(new Set());
  };

  const handleProceed = () => {
    const skippedRecords = Array.from(selectedToSkip).map(
      idx => duplicates[idx].uploadRecord.student_id
    );
    onProceed(skippedRecords);
  };

  const getSeverityIcon = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high':
        return <AlertOctagon className="h-5 w-5 text-red-600" />;
      case 'medium':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'low':
        return <AlertCircle className="h-5 w-5 text-blue-600" />;
    }
  };

  const getSeverityLabel = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high':
        return 'High - Exact ID Match';
      case 'medium':
        return 'Medium - Email Match';
      case 'low':
        return 'Low - Name Similarity';
    }
  };

  const getSeverityColor = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">
            Duplicate Records Detected
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base mt-2">
            Found <strong>{duplicates.length}</strong> potential duplicate{' '}
            {duplicates.length === 1 ? 'record' : 'records'} out of{' '}
            <strong>{totalRecords}</strong> total records in your upload.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 my-4">
          {/* Summary Alert */}
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              Please review each duplicate below. You can choose to skip duplicates
              (don't import them) or proceed to import all flagged records.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSkipAll}
              disabled={selectedToSkip.size === duplicates.length}
            >
              Skip All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSkipNone}
              disabled={selectedToSkip.size === 0}
            >
              Skip None
            </Button>
            <div className="ml-auto text-sm text-gray-600 flex items-center">
              {selectedToSkip.size > 0 && (
                <span>
                  {selectedToSkip.size} record{selectedToSkip.size !== 1 ? 's' : ''}{' '}
                  selected to skip
                </span>
              )}
            </div>
          </div>

          {/* Duplicates List */}
          <div className="space-y-3">
            {duplicates.map((duplicate, index) => (
              <Card
                key={index}
                className={`cursor-pointer transition-colors ${
                  selectedToSkip.has(index)
                    ? 'bg-gray-100 border-gray-300'
                    : 'hover:bg-gray-50'
                }`}
              >
                <CardHeader
                  className="pb-3 cursor-pointer"
                  onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getSeverityIcon(duplicate.severity)}
                        <Badge variant={getSeverityColor(duplicate.severity)}>
                          {getSeverityLabel(duplicate.severity)}
                        </Badge>
                        {duplicate.severity === 'low' && (
                          <span className="text-xs text-gray-600">
                            {(duplicate.confidence * 100).toFixed(0)}% match
                          </span>
                        )}
                      </div>
                      <CardTitle className="text-base">
                        {duplicate.uploadRecord.student_id}
                      </CardTitle>
                      <CardDescription>
                        {duplicate.uploadRecord.first_name}{' '}
                        {duplicate.uploadRecord.last_name}
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedToSkip.has(index)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleSkip(index);
                        }}
                        className="h-5 w-5 rounded border-gray-300"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedIndex(expandedIndex === index ? null : index);
                        }}
                      >
                        {expandedIndex === index ? (
                          <ChevronUp className="h-5 w-5 text-gray-600" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-600" />
                        )}
                      </button>
                    </div>
                  </div>
                </CardHeader>

                {expandedIndex === index && (
                  <CardContent className="space-y-4 border-t pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Existing Record */}
                      <div>
                        <h4 className="font-semibold text-sm mb-2 text-gray-700">
                          Existing Record
                        </h4>
                        <div className="bg-gray-50 p-3 rounded space-y-2 text-sm">
                          <div>
                            <span className="text-gray-600">Student ID:</span>
                            <p className="font-mono text-gray-900">
                              {duplicate.existingStudent.student_id}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Name:</span>
                            <p className="text-gray-900">
                              {duplicate.existingStudent.first_name}{' '}
                              {duplicate.existingStudent.last_name}
                            </p>
                          </div>
                          {duplicate.existingStudent.email && (
                            <div>
                              <span className="text-gray-600">Email:</span>
                              <p className="text-gray-900 break-all">
                                {duplicate.existingStudent.email}
                              </p>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-600">Created:</span>
                            <p className="text-gray-900 text-xs">
                              {new Date(
                                duplicate.existingStudent.created_at
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Upload Record */}
                      <div>
                        <h4 className="font-semibold text-sm mb-2 text-gray-700">
                          Upload Record
                        </h4>
                        <div className="bg-blue-50 p-3 rounded space-y-2 text-sm">
                          <div>
                            <span className="text-gray-600">Student ID:</span>
                            <p className="font-mono text-gray-900">
                              {duplicate.uploadRecord.student_id}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Name:</span>
                            <p className="text-gray-900">
                              {duplicate.uploadRecord.first_name}{' '}
                              {duplicate.uploadRecord.last_name}
                            </p>
                          </div>
                          {duplicate.uploadRecord.email && (
                            <div>
                              <span className="text-gray-600">Email:</span>
                              <p className="text-gray-900 break-all">
                                {duplicate.uploadRecord.email}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Match Reason */}
                    <Alert className="bg-blue-50 border-blue-200">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800 text-sm">
                        {duplicate.matchType === 'student_id' &&
                          'This record has the same Student ID as an existing student.'}
                        {duplicate.matchType === 'email' &&
                          'This record has the same email as an existing student.'}
                        {duplicate.matchType === 'name_combination' &&
                          'This record has a very similar name to an existing student.'}
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>

          {/* Info Message */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Uncheck records you want to import anyway. Checked records will be
              skipped.
            </AlertDescription>
          </Alert>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleProceed}
            disabled={isLoading}
            className={selectedToSkip.size === duplicates.length ? 'opacity-75' : ''}
          >
            {isLoading ? 'Processing...' : 'Proceed with Import'}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
