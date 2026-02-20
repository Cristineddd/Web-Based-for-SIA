/**
 * Upload Report Service
 * Generates summary reports and CSV exports for upload activities
 */

import { AuditLog } from '@/types/audit';

export interface UploadSummary {
  totalUploads: number;
  successfulUploads: number;
  failedUploads: number;
  successRate: number;
  totalBytes: number;
  invalidEntries: InvalidEntry[];
  period: {
    startDate: string;
    endDate: string;
  };
}

export interface InvalidEntry {
  timestamp: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  adminEmail: string;
  errorReason: string;
  ipAddress?: string;
}

export class UploadReportService {
  /**
   * Generate upload summary report from audit logs
   */
  static generateUploadSummary(logs: AuditLog[], dateRange?: { startDate: Date; endDate: Date }): UploadSummary {
    const uploadLogs = logs.filter(log => 
      log.activity === 'file_upload' || log.activity === 'student_import'
    );

    const successfulLogs = uploadLogs.filter(log => log.status === 'success');
    const failedLogs = uploadLogs.filter(log => log.status === 'failed');

    const invalidEntries: InvalidEntry[] = failedLogs.map(log => ({
      timestamp: log.timestamp,
      fileName: log.fileName || 'Unknown',
      fileType: log.fileType || 'Unknown',
      fileSize: log.fileSize || 0,
      adminEmail: log.adminEmail,
      errorReason: log.errorMessage || 'Unknown error',
      ipAddress: log.ipAddress,
    }));

    const totalBytes = successfulLogs.reduce((sum, log) => sum + (log.fileSize || 0), 0);

    const startDate = dateRange?.startDate || new Date(logs[logs.length - 1]?.timestamp || new Date());
    const endDate = dateRange?.endDate || new Date(logs[0]?.timestamp || new Date());

    return {
      totalUploads: uploadLogs.length,
      successfulUploads: successfulLogs.length,
      failedUploads: failedLogs.length,
      successRate: uploadLogs.length > 0 ? (successfulLogs.length / uploadLogs.length) * 100 : 0,
      totalBytes,
      invalidEntries,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };
  }

  /**
   * Generate CSV content from invalid entries
   */
  static generateInvalidEntriesCSV(invalidEntries: InvalidEntry[]): string {
    if (invalidEntries.length === 0) {
      return 'No invalid entries to export';
    }

    // CSV Header
    const headers = ['Timestamp', 'File Name', 'File Type', 'File Size (bytes)', 'Admin Email', 'Error Reason', 'IP Address'];
    const rows = invalidEntries.map(entry => [
      this.escapeCSV(entry.timestamp),
      this.escapeCSV(entry.fileName),
      this.escapeCSV(entry.fileType),
      entry.fileSize.toString(),
      this.escapeCSV(entry.adminEmail),
      this.escapeCSV(entry.errorReason),
      this.escapeCSV(entry.ipAddress || 'N/A'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    return csvContent;
  }

  /**
   * Download CSV file helper
   */
  static downloadCSV(csvContent: string, fileName: string = 'invalid-uploads.csv'): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Escape CSV values to handle commas and quotes
   */
  private static escapeCSV(value: string): string {
    if (!value) return '';
    const escaped = value.replace(/"/g, '""');
    if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
      return `"${escaped}"`;
    }
    return escaped;
  }

  /**
   * Format bytes to human readable format
   */
  static formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Get success percentage color
   */
  static getSuccessRateColor(successRate: number): string {
    if (successRate >= 95) return 'text-green-600';
    if (successRate >= 80) return 'text-yellow-600';
    return 'text-red-600';
  }
}
