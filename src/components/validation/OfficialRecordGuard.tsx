/**
 * Official Record Guard Component
 * Displays validation status and prevents interaction with unvalidated records
 * Shows clear visual indicators for official vs. unvalidated students
 */

'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface ValidationStatusProps {
  status: 'official' | 'unvalidated' | 'pending';
  validationDate?: string;
  validatedBy?: string;
  studentId?: string;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

/**
 * Badge component showing validation status
 */
export const ValidationStatusBadge: React.FC<ValidationStatusProps> = ({
  status,
  validationDate,
  validatedBy,
  studentId,
  size = 'md',
  showDetails = false,
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'official':
        return {
          color: 'bg-green-100 text-green-800 border-green-300',
          icon: CheckCircle2,
          label: 'Official Record',
          description: 'This student record has been validated and marked as official',
        };
      case 'pending':
        return {
          color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
          icon: Clock,
          label: 'Pending Validation',
          description: 'This record is pending validation and review',
        };
      case 'unvalidated':
        return {
          color: 'bg-red-100 text-red-800 border-red-300',
          icon: AlertCircle,
          label: 'Unvalidated',
          description: 'This student record has not been validated. Cannot be used in modules.',
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-300',
          icon: AlertCircle,
          label: 'Unknown Status',
          description: 'Validation status unknown',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-2',
    lg: 'text-base px-4 py-2',
  };

  return (
    <div className="flex flex-col gap-2">
      <Badge
        variant="outline"
        className={`${config.color} ${sizeClasses[size]} flex items-center gap-2 w-fit`}
      >
        <Icon className="w-4 h-4" />
        {config.label}
      </Badge>

      {showDetails && (
        <div className="ml-4 text-xs text-gray-600 space-y-1">
          {validationDate && (
            <div>
              <span className="font-semibold">Validated on:</span>{' '}
              {new Date(validationDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          )}
          {validatedBy && (
            <div>
              <span className="font-semibold">Validated by:</span> {validatedBy}
            </div>
          )}
          {studentId && (
            <div>
              <span className="font-semibold">Student ID:</span> {studentId}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Alert component for unvalidated records
 */
export const UnvalidatedRecordAlert: React.FC<{
  studentId: string;
  studentName: string;
  onReview?: () => void;
}> = ({ studentId, studentName, onReview }) => {
  return (
    <Alert className="border-red-300 bg-red-50">
      <AlertCircle className="h-4 w-4 text-red-600" />
      <AlertDescription className="text-red-800">
        <strong>{studentName}</strong> (ID: {studentId}) is an unvalidated record and cannot be used
        in exams, classes, or reports. Please validate this record first.{' '}
        {onReview && (
          <button
            onClick={onReview}
            className="ml-2 font-semibold underline hover:no-underline"
          >
            Review & Validate
          </button>
        )}
      </AlertDescription>
    </Alert>
  );
};

/**
 * Status summary component
 */
export const ValidationStatusSummary: React.FC<{
  officialCount: number;
  unvalidatedCount: number;
  pendingCount: number;
  showPercentage?: boolean;
}> = ({ officialCount, unvalidatedCount, pendingCount, showPercentage = true }) => {
  const total = officialCount + unvalidatedCount + pendingCount;
  const officialPercentage = total > 0 ? Math.round((officialCount / total) * 100) : 0;

  return (
    <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span className="font-semibold">Official</span>
        </div>
        <p className="text-2xl font-bold text-green-600">{officialCount}</p>
        {showPercentage && (
          <p className="text-xs text-gray-500">{officialPercentage}% of total</p>
        )}
      </div>

      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-5 h-5 text-yellow-600" />
          <span className="font-semibold">Pending</span>
        </div>
        <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
        {showPercentage && (
          <p className="text-xs text-gray-500">{total > 0 ? Math.round((pendingCount / total) * 100) : 0}% of total</p>
        )}
      </div>

      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="font-semibold">Unvalidated</span>
        </div>
        <p className="text-2xl font-bold text-red-600">{unvalidatedCount}</p>
        {showPercentage && (
          <p className="text-xs text-gray-500">{total > 0 ? Math.round((unvalidatedCount / total) * 100) : 0}% of total</p>
        )}
      </div>
    </div>
  );
};

/**
 * Decorator component for student records showing validation status
 */
export const StudentRecordDecorator: React.FC<{
  validationStatus?: 'official' | 'unvalidated' | 'pending';
  children: React.ReactNode;
}> = ({ validationStatus = 'unvalidated', children }) => {
  const isUnvalidated = validationStatus === 'unvalidated';
  const isOfficial = validationStatus === 'official';

  return (
    <div
      className={`relative rounded-md p-3 ${
        isUnvalidated
          ? 'bg-red-50 border border-red-200'
          : isOfficial
            ? 'bg-green-50 border border-green-200'
            : 'bg-yellow-50 border border-yellow-200'
      }`}
    >
      {isUnvalidated && (
        <div className="absolute top-2 right-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
        </div>
      )}
      {isOfficial && (
        <div className="absolute top-2 right-2">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
        </div>
      )}
      {children}
    </div>
  );
};
