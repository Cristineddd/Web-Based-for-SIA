'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Download,
  Calendar,
} from 'lucide-react';
import { AuditLogger } from '@/services/auditLogger';
import { UploadReportService, type UploadSummary } from '@/services/uploadReportService';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const DATE_RANGES = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'All time', days: null },
];

export default function UploadSummaryReport() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDateRange, setSelectedDateRange] = useState('30');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUploadSummary();
  }, [selectedDateRange, user]);

  const fetchUploadSummary = async () => {
    try {
      setLoading(true);
      setError(null);

      const days = selectedDateRange === 'all' ? null : parseInt(selectedDateRange);
      const startDateObj = days
        ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        : undefined;
      const endDateObj = new Date();

      const logs = await AuditLogger.getLogs({
        startDate: startDateObj?.toISOString(),
        endDate: endDateObj.toISOString(),
        limit: 1000,
      });

      const dateRange = startDateObj && endDateObj
        ? {
            startDate: startDateObj,
            endDate: endDateObj,
          }
        : undefined;

      const reportSummary = UploadReportService.generateUploadSummary(logs, dateRange);
      setSummary(reportSummary);
    } catch (err) {
      console.error('Error fetching upload summary:', err);
      setError('Failed to load upload summary');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvalidEntries = () => {
    if (!summary || summary.invalidEntries.length === 0) {
      return;
    }

    const csv = UploadReportService.generateInvalidEntriesCSV(summary.invalidEntries);
    const timestamp = new Date().toISOString().split('T')[0];
    UploadReportService.downloadCSV(csv, `invalid-uploads-${timestamp}.csv`);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Upload Summary Report</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Loading report...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Upload Summary Report</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No upload data available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const successRateColor = UploadReportService.getSuccessRateColor(summary.successRate);

  return (
    <div className="space-y-6">
      {/* Header with Date Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Upload Summary Report</h2>
          <p className="text-muted-foreground mt-1">
            Period: {new Date(summary.period.startDate).toLocaleDateString()} to{' '}
            {new Date(summary.period.endDate).toLocaleDateString()}
          </p>
        </div>
        <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
          <SelectTrigger className="w-[200px]">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGES.map((range) => (
              <SelectItem
                key={range.label}
                value={range.days ? range.days.toString() : 'all'}
              >
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Uploads */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Uploads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalUploads}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {UploadReportService.formatBytes(summary.totalBytes)}
            </p>
          </CardContent>
        </Card>

        {/* Successful Uploads */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              Successful
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.successfulUploads}</div>
            <p className="text-xs text-muted-foreground mt-1">uploads completed</p>
          </CardContent>
        </Card>

        {/* Failed Uploads */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary.failedUploads}</div>
            <p className="text-xs text-muted-foreground mt-1">uploads failed</p>
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${successRateColor}`}>
              {summary.successRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">overall success</p>
          </CardContent>
        </Card>
      </div>

      {/* Invalid Entries Table */}
      {summary.failedUploads > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Invalid Upload Entries ({summary.invalidEntries.length})</CardTitle>
                <CardDescription>Files that failed to upload or validation errors</CardDescription>
              </div>
              <Button
                onClick={handleDownloadInvalidEntries}
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>File Name</TableHead>
                    <TableHead>File Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Admin Email</TableHead>
                    <TableHead>Error Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.invalidEntries.map((entry, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-sm">
                        {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{entry.fileName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.fileType}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {UploadReportService.formatBytes(entry.fileSize)}
                      </TableCell>
                      <TableCell className="text-sm">{entry.adminEmail}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">{entry.errorReason}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Message */}
      {summary.failedUploads === 0 && summary.totalUploads > 0 && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            All uploads in this period were successful! No invalid entries.
          </AlertDescription>
        </Alert>
      )}

      {summary.totalUploads === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No uploads found for this period.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
