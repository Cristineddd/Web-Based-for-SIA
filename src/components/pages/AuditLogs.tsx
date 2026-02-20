/**
 * Audit Logs Viewer Component
 * Allows admins to view and monitor all logged activities
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Badge } from '@/components/ui/badge';
import { AuditLogger } from '@/services/auditLogger';
import { AuditLog, ActivityType } from '@/types/audit';
import { useAuth } from '@/contexts/AuthContext';
import {
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const ACTIVITY_TYPES: ActivityType[] = [
  'file_upload',
  'file_delete',
  'file_download',
  'student_import',
  'answer_key_upload',
  'exam_created',
  'exam_deleted',
  'admin_action',
  'settings_changed',
];

export default function AuditLogsViewer() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'success' | 'failed'>('all');
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      // Get all logs (in a real app, this would be paginated)
      const allLogs = await AuditLogger.getLogs({ limit: 200 });
      setLogs(allLogs);
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Filter logs based on search and selected filters
    let filtered = logs;

    if (searchQuery) {
      filtered = filtered.filter(
        (log) =>
          log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.adminEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.fileName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.entityName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedActivity !== 'all') {
      filtered = filtered.filter((log) => log.activity === selectedActivity);
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter((log) => log.status === selectedStatus);
    }

    setFilteredLogs(filtered);
  }, [logs, searchQuery, selectedActivity, selectedStatus]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="outline" className="bg-green-50 text-green-700">Success</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-50 text-red-700">Failed</Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Pending</Badge>;
      default:
        return null;
    }
  };

  const getActivityBadge = (activity: ActivityType) => {
    const colors: Record<ActivityType, string> = {
      file_upload: 'bg-blue-50 text-blue-700',
      file_delete: 'bg-red-50 text-red-700',
      file_download: 'bg-purple-50 text-purple-700',
      student_import: 'bg-indigo-50 text-indigo-700',
      answer_key_upload: 'bg-teal-50 text-teal-700',
      exam_created: 'bg-green-50 text-green-700',
      exam_deleted: 'bg-red-50 text-red-700',
      admin_action: 'bg-orange-50 text-orange-700',
      settings_changed: 'bg-gray-50 text-gray-700',
    };

    const labels: Record<ActivityType, string> = {
      file_upload: 'File Upload',
      file_delete: 'File Delete',
      file_download: 'File Download',
      student_import: 'Student Import',
      answer_key_upload: 'Answer Key',
      exam_created: 'Exam Created',
      exam_deleted: 'Exam Deleted',
      admin_action: 'Admin Action',
      settings_changed: 'Settings Changed',
    };

    return (
      <Badge variant="outline" className={colors[activity]}>
        {labels[activity]}
      </Badge>
    );
  };

  const downloadLogs = () => {
    const csv = [
      ['Timestamp', 'Admin', 'Activity', 'Description', 'Status', 'File', 'File Size', 'Error'],
      ...filteredLogs.map((log) => [
        new Date(log.timestamp).toLocaleString(),
        log.adminEmail,
        log.activity,
        log.description,
        log.status,
        log.fileName || '-',
        log.fileSize ? `${(log.fileSize / 1024).toFixed(2)} KB` : '-',
        log.errorMessage || '-',
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!user) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You must be logged in to view audit logs.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Audit Logs</h1>
        <p className="text-muted-foreground mt-1">
          Monitor all upload and administrative activities
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Successful
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {logs.filter((l) => l.status === 'success').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {logs.filter((l) => l.status === 'failed').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              File Uploads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {logs.filter((l) => l.activity === 'file_upload').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search by email, file, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="activity">Activity Type</Label>
              <Select
                value={selectedActivity}
                onValueChange={(value) => setSelectedActivity(value as ActivityType | 'all')}
              >
                <SelectTrigger id="activity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Activities</SelectItem>
                  {ACTIVITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace('_', ' ').toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={selectedStatus}
                onValueChange={(value) => setSelectedStatus(value as 'all' | 'success' | 'failed')}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={downloadLogs}
                variant="outline"
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Download CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log ({filteredLogs.length})</CardTitle>
          <CardDescription>
            All uploads and administrative activities with timestamp and admin ID
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading audit logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No activities found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>File/Entity</TableHead>
                    <TableHead>Size</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        <span className="text-xs">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-sm">{log.adminEmail}</TableCell>
                      <TableCell>{getActivityBadge(log.activity)}</TableCell>
                      <TableCell className="text-sm">{log.description}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.status)}
                          {getStatusBadge(log.status)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.fileName || log.entityName || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.fileSize ? `${(log.fileSize / 1024).toFixed(2)} KB` : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Details Card */}
      {filteredLogs.some((log) => log.errorMessage) && (
        <Card>
          <CardHeader>
            <CardTitle>Failed Activities Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredLogs
                .filter((log) => log.status === 'failed')
                .map((log) => (
                  <div
                    key={log.id}
                    className="p-4 border rounded-lg bg-red-50"
                  >
                    <p className="font-medium text-red-900">{log.description}</p>
                    <p className="text-sm text-red-800 mt-1">
                      {log.adminEmail} - {new Date(log.timestamp).toLocaleString()}
                    </p>
                    <p className="text-sm text-red-700 mt-2">
                      <strong>Error:</strong> {log.errorMessage}
                    </p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
