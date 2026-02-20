'use client';

import React, { useState, useEffect } from 'react';
import { InvalidRecordLogger, InvalidRecordLog, InvalidRecordSummary } from '@/services/invalidRecordLogger';
import { useToast } from '@/hooks/use-toast';

interface FilterOptions {
  recordType?: 'grade' | 'attendance' | 'report';
  entityId?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export default function InvalidRecordsFeedback() {
  const { toast } = useToast();
  const [invalidRecords, setInvalidRecords] = useState<InvalidRecordLog[]>([]);
  const [summary, setSummary] = useState<InvalidRecordSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  // Fetch invalid records on component mount and when filters change
  useEffect(() => {
    fetchInvalidRecords();
    fetchSummary();
  }, [filters]);

  const fetchInvalidRecords = async () => {
    setLoading(true);
    try {
      const result = await InvalidRecordLogger.queryInvalidRecords({
        record_type: filters.recordType,
        entity_id: filters.entityId,
        user_id: filters.userId,
        from_date: filters.dateFrom,
        to_date: filters.dateTo,
        limit_results: 100,
      });

      if (result.success && result.data) {
        setInvalidRecords(result.data);
        setCurrentPage(1);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to fetch invalid records',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching invalid records:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch invalid records',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const result = await InvalidRecordLogger.getInvalidRecordsSummary();
      if (result.success && result.data) {
        setSummary(result.data);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
    setFilters({ ...filters, [key]: value || undefined });
  };

  const clearFilters = () => {
    setFilters({});
  };

  const getPaginatedRecords = () => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return invalidRecords.slice(startIndex, endIndex);
  };
    const totalPages = Math.ceil(invalidRecords.length / pageSize);

  const getRecordTypeColor = (type: string) => {
    switch (type) {
      case 'grade':
        return 'bg-blue-100 text-blue-800';
      case 'attendance':
        return 'bg-purple-100 text-purple-800';
      case 'report':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getErrorSeverity = (message: string) => {
    if (message.toLowerCase().includes('required') || message.toLowerCase().includes('not found')) {
      return 'error';
    }
    return 'warning';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-3xl font-bold">Invalid Records Feedback</h1>
        <p className="text-gray-600 mt-1">
          Review and manage rejected records due to validation errors
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="text-sm font-medium text-gray-600">Total Invalid Records</div>
            <div className="text-3xl font-bold mt-2">{summary.total_invalid_records}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="text-sm font-medium text-gray-600">Grade Records</div>
            <div className="text-3xl font-bold mt-2 text-blue-600">{summary.by_type.grade}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="text-sm font-medium text-gray-600">Attendance Records</div>
            <div className="text-3xl font-bold mt-2 text-purple-600">{summary.by_type.attendance}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="text-sm font-medium text-gray-600">Report Records</div>
            <div className="text-3xl font-bold mt-2 text-green-600">{summary.by_type.report}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
        <h2 className="text-lg font-semibold">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Record Type</label>
            <select
              value={filters.recordType || ''}
              onChange={(e) => handleFilterChange('recordType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All Types</option>
              <option value="grade">Grade</option>
              <option value="attendance">Attendance</option>
              <option value="report">Report</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entity ID</label>
            <input
              type="text"
              value={filters.entityId || ''}
              onChange={(e) => handleFilterChange('entityId', e.target.value)}
              placeholder="Student/Class/Exam ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>
        <button
          onClick={clearFilters}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md text-sm font-medium hover:bg-gray-300 transition"
        >
          Clear Filters
        </button>
      </div>

      {/* Invalid Records List */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">
            Invalid Records ({invalidRecords.length})
          </h2>
        </div>

        {loading ? (
          <div className="px-6 py-8 text-center">
            <div className="inline-block">
              <div className="animate-spin h-8 w-8 border-4 border-gray-200 border-t-blue-600 rounded-full"></div>
            </div>
            <p className="text-gray-600 mt-2">Loading records...</p>
          </div>
        ) : invalidRecords.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-gray-600">No invalid records found</p>
          </div>
        ) : (
          <>
            <div className="divide-y">
              {getPaginatedRecords().map((record) => (
                <div key={record.id} className="p-6 hover:bg-gray-50 transition">
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRecordTypeColor(record.record_type)}`}>
                          {record.record_type.toUpperCase()}
                        </span>
                        <span className="text-sm font-medium text-gray-700">
                          Entity: {record.entity_id}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Attempted: {new Date(record.attempted_at).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        User: {record.user_email || record.user_id}
                      </p>
                    </div>
                    <button
                      onClick={() => setExpandedRecord(expandedRecord === record.id ? null : record.id)}
                      className="px-4 py-2 bg-blue-50 text-blue-600 rounded-md text-sm font-medium hover:bg-blue-100 transition"
                    >
                      {expandedRecord === record.id ? 'Hide' : 'Details'}
                    </button>
                  </div>

                  {/* Rejection Reason */}
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm font-medium text-red-800">{record.rejection_reason}</p>
                  </div>

                  {/* Validation Errors Summary */}
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Validation Errors ({record.validation_errors.length})
                    </p>
                    <div className="space-y-1">
                      {record.validation_errors.slice(0, 3).map((error, idx) => (
                        <div key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            getErrorSeverity(error.message) === 'error'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {error.field}
                          </span>
                          <span className="flex-1">{error.message}</span>
                        </div>
                      ))}
                      {record.validation_errors.length > 3 && (
                        <p className="text-sm text-gray-500">
                          +{record.validation_errors.length - 3} more error{record.validation_errors.length - 3 !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedRecord === record.id && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-md border border-gray-200 space-y-4">
                      {/* Record Data */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Attempted Record Data</h4>
                        <pre className="text-xs bg-white p-3 rounded border border-gray-300 overflow-auto max-h-40 text-gray-700">
                          {JSON.stringify(record.record_data, null, 2)}
                        </pre>
                      </div>

                      {/* All Validation Errors */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">All Validation Errors</h4>
                        <div className="space-y-2 max-h-40 overflow-auto">
                          {record.validation_errors.map((error, idx) => (
                            <div key={idx} className="text-xs bg-white p-2 rounded border border-gray-200">
                              <p className="font-semibold text-gray-800">{error.field}</p>
                              <p className="text-gray-600">{error.message}</p>
                              {error.value !== undefined && (
                                <p className="text-gray-500 text-xs mt-1">
                                  Value: {JSON.stringify(error.value)}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Metadata */}
                      {record.metadata && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Metadata</h4>
                          <pre className="text-xs bg-white p-3 rounded border border-gray-300 overflow-auto max-h-40 text-gray-700">
                            {JSON.stringify(record.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, invalidRecords.length)} of {invalidRecords.length}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-2 rounded-md text-sm ${
                          currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Most Common Errors */}
      {summary && summary.most_common_errors.length > 0 && (
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Most Common Validation Errors</h2>
          <div className="space-y-3">
            {summary.most_common_errors.map((error) => (
              <div key={error.field} className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-gray-700">{error.field}</p>
                  <p className="text-sm text-gray-600">{error.count} occurrences</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${error.percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-12">{error.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
