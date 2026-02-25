'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import { InvalidRecordLogger, type InvalidRecordLog } from '@/services/invalidRecordLogger';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Search, AlertCircle, Download, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

export default function ValidationLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<InvalidRecordLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'grade' | 'attendance' | 'report'>('all');

  useEffect(() => {
    fetchLogs();
  }, [user]);

  const fetchLogs = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const fetchedLogs = await InvalidRecordLogger.getInvalidRecords({
        user_id: user.id,
        limit_results: 100,
      });
      setLogs(fetchedLogs);
    } catch (error) {
      console.error('Error fetching validation logs:', error);
      toast.error('Failed to load validation logs');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.entity_id.toLowerCase().includes(search.toLowerCase()) ||
      log.rejection_reason.toLowerCase().includes(search.toLowerCase()) ||
      (log.user_email && log.user_email.toLowerCase().includes(search.toLowerCase()));

    const matchesType = filterType === 'all' || log.record_type === filterType;

    return matchesSearch && matchesType;
  });

  const downloadLogs = () => {
    const csvContent = [
      ['Timestamp', 'Type', 'Student ID', 'Reason', 'Errors', 'User'],
      ...filteredLogs.map(log => [
        log.attempted_at,
        log.record_type,
        log.entity_id,
        log.rejection_reason,
        log.validation_errors.map(e => `${e.field}: ${e.message}`).join('; '),
        log.user_email || log.user_id
      ])
    ].map(row => row.join(',')).join('\\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation-logs-${new Date().toISOString()}.csv`;
    a.click();
    toast.success('Logs exported successfully');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Validation Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review invalid student data attempts and validation errors
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchLogs} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button onClick={downloadLogs} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by Student ID, reason, or user..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterType('all')}
                size="sm"
              >
                All
              </Button>
              <Button
                variant={filterType === 'grade' ? 'default' : 'outline'}
                onClick={() => setFilterType('grade')}
                size="sm"
              >
                Students
              </Button>
              <Button
                variant={filterType === 'attendance' ? 'default' : 'outline'}
                onClick={() => setFilterType('attendance')}
                size="sm"
              >
                Attendance
              </Button>
              <Button
                variant={filterType === 'report' ? 'default' : 'outline'}
                onClick={() => setFilterType('report')}
                size="sm"
              >
                Reports
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Invalid Attempts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{logs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Student Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {logs.filter(l => l.record_type === 'grade').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today's Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {logs.filter(l => {
                const logDate = new Date(l.attempted_at);
                const today = new Date();
                return logDate.toDateString() === today.toDateString();
              }).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Most Common Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold">Invalid ID Format</p>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Invalid Record Attempts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search || filterType !== 'all'
                ? 'No logs match your filters'
                : 'No invalid attempts logged yet'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Errors</TableHead>
                    <TableHead className="hidden md:table-cell">User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">
                        {format(new Date(log.attempted_at), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.record_type === 'grade' ? 'default' : 'secondary'}>
                          {log.record_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.entity_id}</TableCell>
                      <TableCell className="text-sm">{log.rejection_reason}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {log.validation_errors.slice(0, 2).map((err, idx) => (
                            <div key={idx} className="text-xs text-muted-foreground">
                              <span className="font-semibold">{err.field}:</span> {err.message}
                            </div>
                          ))}
                          {log.validation_errors.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{log.validation_errors.length - 2} more
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs">
                        {log.user_email || log.user_id}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
