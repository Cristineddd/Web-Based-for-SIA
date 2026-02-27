'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Search,
  FileText,
  FileSpreadsheet,
  Table2,
  Mail,
  Archive,
  Trash2,
  RefreshCw,
  Loader2,
  ClipboardList,
  Calendar,
  Filter,
  ChevronDown,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  ReportHistoryService,
  type ReportHistoryEntry,
  type ReportFormat,
  type ReportType,
  type ArchiveStats,
} from '@/services/reportHistoryService';
import { QueryDocumentSnapshot } from 'firebase/firestore';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(ts: { toDate: () => Date } | undefined): string {
  if (!ts) return '—';
  const d = ts.toDate();
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatBadge(format: ReportFormat) {
  switch (format) {
    case 'PDF':
      return { label: 'PDF', icon: FileText, color: 'bg-red-100 text-red-700' };
    case 'Excel':
      return { label: 'Excel', icon: FileSpreadsheet, color: 'bg-green-100 text-green-700' };
    case 'CSV':
      return { label: 'CSV', icon: Table2, color: 'bg-blue-100 text-blue-700' };
    case 'Email':
      return { label: 'Email', icon: Mail, color: 'bg-purple-100 text-purple-700' };
    case 'Batch':
      return { label: 'Batch', icon: Archive, color: 'bg-orange-100 text-orange-700' };
    default:
      return { label: format, icon: FileText, color: 'bg-gray-100 text-gray-700' };
  }
}

function reportTypeLabel(type: ReportType): string {
  switch (type) {
    case 'class-results': return 'Class Results';
    case 'exam-scores': return 'Exam Scores';
    case 'class-summary': return 'Class Summary';
    case 'student-roster': return 'Student Roster';
    case 'batch-export': return 'Batch Export';
    case 'email-delivery': return 'Email Delivery';
    default: return type;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ReportHistory() {
  const { user } = useAuth();

  // Data
  const [entries, setEntries] = useState<ReportHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [stats, setStats] = useState<ArchiveStats | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterFormat, setFilterFormat] = useState<ReportFormat | 'all'>('all');
  const [filterType, setFilterType] = useState<ReportType | 'all'>('all');
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d' | '90d' | '1y'>('all');

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Cleanup
  const [cleaningUp, setCleaningUp] = useState(false);

  // ── Fetch reports ───────────────────────────────────────────────────────

  const fetchReports = useCallback(
    async (append = false) => {
      if (!user?.instructorId) return;

      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        let startDate: Date | undefined;
        if (dateRange !== 'all') {
          startDate = new Date();
          const daysMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
          startDate.setDate(startDate.getDate() - daysMap[dateRange]);
        }

        const result = await ReportHistoryService.queryReports({
          instructorId: user.instructorId,
          format: filterFormat !== 'all' ? filterFormat : undefined,
          reportType: filterType !== 'all' ? filterType : undefined,
          searchTerm: search.trim() || undefined,
          startDate,
          lastDoc: append ? lastDoc ?? undefined : undefined,
          pageSize: 20,
        });

        if (append) {
          setEntries((prev) => [...prev, ...result.entries]);
        } else {
          setEntries(result.entries);
        }
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
      } catch (err) {
        console.error('Error fetching report history:', err);
        toast.error('Failed to load report history');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user?.instructorId, filterFormat, filterType, dateRange, search, lastDoc],
  );

  // Fetch stats once
  useEffect(() => {
    if (!user?.instructorId) return;
    ReportHistoryService.getStats(user.instructorId)
      .then(setStats)
      .catch(() => {});
  }, [user?.instructorId]);

  // Refetch when filters change
  useEffect(() => {
    fetchReports(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.instructorId, filterFormat, filterType, dateRange]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => fetchReports(false), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    try {
      await ReportHistoryService.deleteReport(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success('Report entry deleted');
    } catch {
      toast.error('Failed to delete');
    }
    setDeleteTarget(null);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    try {
      await ReportHistoryService.deleteReports(ids);
      setEntries((prev) => prev.filter((e) => !selectedIds.has(e.id!)));
      setSelectedIds(new Set());
      toast.success(`Deleted ${ids.length} report entries`);
    } catch {
      toast.error('Failed to delete selected entries');
    }
    setBulkDeleteOpen(false);
  };

  const handleCleanup = async () => {
    if (!user?.instructorId) return;
    setCleaningUp(true);
    try {
      const deleted = await ReportHistoryService.cleanupExpired(user.instructorId);
      if (deleted > 0) {
        toast.success(`Cleaned up ${deleted} expired report entries`);
        fetchReports(false);
      } else {
        toast.info('No expired entries to clean up');
      }
    } catch {
      toast.error('Cleanup failed');
    } finally {
      setCleaningUp(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entries.map((e) => e.id!)));
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      {stats && stats.totalReports > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3 border">
            <p className="text-xs text-muted-foreground">Total Reports</p>
            <p className="text-2xl font-bold text-foreground">{stats.totalReports}</p>
          </Card>
          <Card className="p-3 border">
            <p className="text-xs text-muted-foreground">PDF Reports</p>
            <p className="text-2xl font-bold text-red-600">{stats.byFormat['PDF'] || 0}</p>
          </Card>
          <Card className="p-3 border">
            <p className="text-xs text-muted-foreground">Excel Reports</p>
            <p className="text-2xl font-bold text-green-600">{stats.byFormat['Excel'] || 0}</p>
          </Card>
          <Card className="p-3 border">
            <p className="text-xs text-muted-foreground">Emails Sent</p>
            <p className="text-2xl font-bold text-purple-600">{stats.byFormat['Email'] || 0}</p>
          </Card>
        </div>
      )}

      {/* Search & Filters */}
      <Card className="p-4 border">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search reports by class, exam, or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Format filter */}
          <Select value={filterFormat} onValueChange={(v) => setFilterFormat(v as ReportFormat | 'all')}>
            <SelectTrigger className="w-[130px]">
              <Filter className="w-4 h-4 mr-1.5" />
              <SelectValue placeholder="Format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Formats</SelectItem>
              <SelectItem value="PDF">PDF</SelectItem>
              <SelectItem value="Excel">Excel</SelectItem>
              <SelectItem value="CSV">CSV</SelectItem>
              <SelectItem value="Email">Email</SelectItem>
              <SelectItem value="Batch">Batch</SelectItem>
            </SelectContent>
          </Select>

          {/* Type filter */}
          <Select value={filterType} onValueChange={(v) => setFilterType(v as ReportType | 'all')}>
            <SelectTrigger className="w-[160px]">
              <ClipboardList className="w-4 h-4 mr-1.5" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="class-results">Class Results</SelectItem>
              <SelectItem value="exam-scores">Exam Scores</SelectItem>
              <SelectItem value="class-summary">Class Summary</SelectItem>
              <SelectItem value="batch-export">Batch Export</SelectItem>
              <SelectItem value="email-delivery">Email Delivery</SelectItem>
            </SelectContent>
          </Select>

          {/* Date range */}
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as typeof dateRange)}>
            <SelectTrigger className="w-[130px]">
              <Calendar className="w-4 h-4 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selected
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Selected
            </Button>
          </div>
        )}
      </Card>

      {/* Table */}
      {loading ? (
        <Card className="p-8 border">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading report history...</span>
          </div>
        </Card>
      ) : entries.length === 0 ? (
        <Card className="p-8 border">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center mb-4">
              <BarChart3 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">No Reports Found</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {search || filterFormat !== 'all' || filterType !== 'all'
                ? 'No reports match your current filters. Try adjusting your search or filters.'
                : 'Report history will appear here after you export exam results as PDF, Excel, or CSV.'}
            </p>
          </div>
        </Card>
      ) : (
        <Card className="border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === entries.length && entries.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4"
                  />
                </TableHead>
                <TableHead>Report</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="hidden md:table-cell">Format</TableHead>
                <TableHead className="hidden lg:table-cell">Students</TableHead>
                <TableHead className="hidden lg:table-cell">Size</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const badge = formatBadge(entry.format);
                const BadgeIcon = badge.icon;
                return (
                  <TableRow key={entry.id} className={selectedIds.has(entry.id!) ? 'bg-muted/30' : ''}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(entry.id!)}
                        onChange={() => toggleSelect(entry.id!)}
                        className="w-4 h-4"
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground text-sm">{entry.title}</p>
                        {entry.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{entry.description}</p>
                        )}
                        {entry.examTitle && (
                          <p className="text-xs text-muted-foreground">{entry.examTitle}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">{reportTypeLabel(entry.reportType)}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="secondary" className={`${badge.color} text-xs gap-1`}>
                        <BadgeIcon className="w-3 h-3" />
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {entry.studentCount ?? '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {formatBytes(entry.fileSizeBytes)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(entry.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(entry.id!)}
                        className="text-muted-foreground hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Load More / Cleanup footer */}
          <div className="flex items-center justify-between p-3 border-t bg-muted/20">
            <div className="flex items-center gap-2">
              {hasMore && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchReports(true)}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 mr-1" />
                  )}
                  Load More
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                Showing {entries.length} report{entries.length !== 1 ? 's' : ''}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCleanup}
              disabled={cleaningUp}
              className="text-muted-foreground"
            >
              {cleaningUp ? (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
              )}
              Cleanup Expired
            </Button>
          </div>
        </Card>
      )}

      {/* Single delete dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report Entry</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the report from your history. The originally exported file is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete dialog */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} Report Entries</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the selected reports from your history. Originally exported files are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete All Selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
