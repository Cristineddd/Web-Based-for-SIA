/**
 * Validation Action Log Component
 * Displays audit trail of validation actions with filtering and timestamps
 */

'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  AlertCircle,
  Clock,
  Download,
  Eye,
  Calendar,
} from 'lucide-react';

export interface ValidationActionLog {
  id?: string;
  adminId: string;
  adminEmail: string;
  timestamp: string;
  actionType: string;
  actionStatus: 'success' | 'failed' | 'warning' | 'info';
  targetType: 'single_record' | 'bulk_records' | 'class' | 'student';
  targetId?: string;
  targetName?: string;
  recordsProcessed: number;
  recordsSuccessful: number;
  recordsFailed: number;
  validationErrors?: string[];
  qualityIssues?: {
    duplicates?: number;
    inconsistencies?: number;
    typos?: number;
    other?: number;
  };
  details?: string;
}

interface ValidationActionLogViewerProps {
  logs?: ValidationActionLog[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export default function ValidationActionLogViewer({
  logs = [],
  isLoading = false,
  onRefresh,
}: ValidationActionLogViewerProps) {
  const [filteredLogs, setFilteredLogs] = useState<ValidationActionLog[]>(logs);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<ValidationActionLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Action type colors
  const actionTypeColors: Record<string, string> = {
    field_validation: 'bg-blue-100 text-blue-800',
    bulk_validation: 'bg-purple-100 text-purple-800',
    quality_check: 'bg-yellow-100 text-yellow-800',
    duplicate_detection: 'bg-red-100 text-red-800',
    mark_official: 'bg-green-100 text-green-800',
    mark_pending: 'bg-orange-100 text-orange-800',
    validation_reset: 'bg-pink-100 text-pink-800',
    override_validation: 'bg-indigo-100 text-indigo-800',
  };

  // Status icons and colors
  const statusConfig: Record<string, { icon: React.ReactNode; color: string }> = {
    success: {
      icon: <CheckCircle className="w-4 h-4 text-green-600" />,
      color: 'bg-green-50 border-green-200',
    },
    warning: {
      icon: <AlertCircle className="w-4 h-4 text-yellow-600" />,
      color: 'bg-yellow-50 border-yellow-200',
    },
    failed: {
      icon: <AlertCircle className="w-4 h-4 text-red-600" />,
      color: 'bg-red-50 border-red-200',
    },
    info: {
      icon: <Clock className="w-4 h-4 text-blue-600" />,
      color: 'bg-blue-50 border-blue-200',
    },
  };

  useEffect(() => {
    let filtered = [...logs];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.adminEmail.toLowerCase().includes(term) ||
          log.targetName?.toLowerCase().includes(term) ||
          log.targetId?.toLowerCase().includes(term) ||
          log.details?.toLowerCase().includes(term)
      );
    }

    // Filter by action type
    if (selectedActionType !== 'all') {
      filtered = filtered.filter((log) => log.actionType === selectedActionType);
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter((log) => log.actionStatus === selectedStatus);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    setFilteredLogs(filtered);
  }, [logs, searchTerm, selectedActionType, selectedStatus]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getActionTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      field_validation: 'Field Validation',
      bulk_validation: 'Bulk Validation',
      quality_check: 'Quality Check',
      duplicate_detection: 'Duplicate Detection',
      mark_official: 'Mark Official',
      mark_pending: 'Mark Pending',
      validation_reset: 'Reset Validation',
      override_validation: 'Override Validation',
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      success: 'Success',
      warning: 'Warning',
      failed: 'Failed',
      info: 'Info',
    };
    return labels[status] || status;
  };

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'Admin Email', 'Action Type', 'Status', 'Target', 'Processed', 'Successful'],
      ...filteredLogs.map((log) => [
        formatDate(log.timestamp),
        log.adminEmail,
        getActionTypeLabel(log.actionType),
        getStatusLabel(log.actionStatus),
        log.targetName || log.targetId || 'N/A',
        log.recordsProcessed,
        log.recordsSuccessful,
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const element = document.createElement('a');
    element.setAttribute('href', `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`);
    element.setAttribute('download', `validation-logs-${new Date().toISOString().split('T')[0]}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Validation Action Log</CardTitle>
          <CardDescription>
            Audit trail of all validation actions with timestamp and admin information
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <Input
                placeholder="Search by email, name, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Action Type</label>
              <Select value={selectedActionType} onValueChange={setSelectedActionType}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="field_validation">Field Validation</SelectItem>
                  <SelectItem value="bulk_validation">Bulk Validation</SelectItem>
                  <SelectItem value="quality_check">Quality Check</SelectItem>
                  <SelectItem value="duplicate_detection">Duplicate Detection</SelectItem>
                  <SelectItem value="mark_official">Mark Official</SelectItem>
                  <SelectItem value="mark_pending">Mark Pending</SelectItem>
                  <SelectItem value="validation_reset">Reset Validation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button
                onClick={onRefresh}
                variant="outline"
                size="sm"
                disabled={isLoading}
                className="flex-1"
              >
                Refresh
              </Button>
              <Button onClick={exportLogs} variant="outline" size="sm" className="flex-1">
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Logs Table */}
          <div className="border rounded-lg overflow-hidden">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No validation logs found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Action Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead className="text-right">Processed</TableHead>
                    <TableHead className="text-right">Successful</TableHead>
                    <TableHead className="text-center">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log, idx) => (
                    <TableRow key={`${log.id}-${idx}`} className="hover:bg-muted/50">
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          {formatDate(log.timestamp)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{log.adminEmail}</span>
                          <span className="text-xs text-muted-foreground">{log.adminId}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={actionTypeColors[log.actionType] || ''}>
                          {getActionTypeLabel(log.actionType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {statusConfig[log.actionStatus]?.icon}
                          <span className="text-sm">{getStatusLabel(log.actionStatus)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.targetName ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{log.targetName}</span>
                            {log.targetId && (
                              <span className="text-xs text-muted-foreground">{log.targetId}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-medium">{log.recordsProcessed}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-medium text-green-600">
                          {log.recordsSuccessful}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedLog(log);
                            setShowDetails(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="bg-muted">
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground mb-1">Total Actions</div>
                <div className="text-2xl font-bold">{filteredLogs.length}</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50">
              <CardContent className="pt-4">
                <div className="text-sm text-green-700 mb-1">Successful</div>
                <div className="text-2xl font-bold text-green-700">
                  {filteredLogs.filter((l) => l.actionStatus === 'success').length}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-yellow-50">
              <CardContent className="pt-4">
                <div className="text-sm text-yellow-700 mb-1">Warnings</div>
                <div className="text-2xl font-bold text-yellow-700">
                  {filteredLogs.filter((l) => l.actionStatus === 'warning').length}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-red-50">
              <CardContent className="pt-4">
                <div className="text-sm text-red-700 mb-1">Failed</div>
                <div className="text-2xl font-bold text-red-700">
                  {filteredLogs.filter((l) => l.actionStatus === 'failed').length}
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Validation Action Details</DialogTitle>
            <DialogDescription>
              Complete information about this validation action
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
                  <p className="text-sm mt-1">{formatDate(selectedLog.timestamp)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Admin Email</label>
                  <p className="text-sm mt-1">{selectedLog.adminEmail}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Action Type</label>
                  <p className="text-sm mt-1">
                    <Badge className={actionTypeColors[selectedLog.actionType] || ''}>
                      {getActionTypeLabel(selectedLog.actionType)}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <p className="text-sm mt-1">
                    <div className="flex items-center gap-2">
                      {statusConfig[selectedLog.actionStatus]?.icon}
                      {getStatusLabel(selectedLog.actionStatus)}
                    </div>
                  </p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Target</label>
                  <p className="text-sm mt-1">
                    {selectedLog.targetName || selectedLog.targetId || 'N/A'} (
                    {selectedLog.targetType})
                  </p>
                </div>

                {selectedLog.details && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Details</label>
                    <p className="text-sm mt-1">{selectedLog.details}</p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-xs text-blue-600 mb-1">Processed</p>
                    <p className="text-lg font-bold text-blue-900">
                      {selectedLog.recordsProcessed}
                    </p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-xs text-green-600 mb-1">Successful</p>
                    <p className="text-lg font-bold text-green-900">
                      {selectedLog.recordsSuccessful}
                    </p>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg">
                    <p className="text-xs text-red-600 mb-1">Failed</p>
                    <p className="text-lg font-bold text-red-900">
                      {selectedLog.recordsFailed}
                    </p>
                  </div>
                </div>

                {selectedLog.validationErrors && selectedLog.validationErrors.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Errors</label>
                    <ul className="text-sm mt-2 space-y-1 list-disc list-inside">
                      {selectedLog.validationErrors.map((error, idx) => (
                        <li key={idx} className="text-red-600">
                          {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedLog.qualityIssues && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Quality Issues
                    </label>
                    <div className="text-sm mt-2 space-y-1">
                      {selectedLog.qualityIssues.duplicates && (
                        <p>
                          Duplicates: <span className="font-medium">{selectedLog.qualityIssues.duplicates}</span>
                        </p>
                      )}
                      {selectedLog.qualityIssues.inconsistencies && (
                        <p>
                          Inconsistencies: <span className="font-medium">{selectedLog.qualityIssues.inconsistencies}</span>
                        </p>
                      )}
                      {selectedLog.qualityIssues.typos && (
                        <p>
                          Typos: <span className="font-medium">{selectedLog.qualityIssues.typos}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
