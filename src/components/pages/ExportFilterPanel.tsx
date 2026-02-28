'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Fuse from 'fuse.js';
import { useDebounce } from '@/hooks/useDebounce';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
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
  Download,
  FileText,
  FileSpreadsheet,
  Table2,
  Filter,
  RotateCcw,
  Eye,
  Save,
  Trash2,
  BookmarkPlus,
  CheckCircle2,
  XCircle,
  Users,
  TrendingUp,
  CalendarDays,
  Search,
  SlidersHorizontal,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ExportDataRow {
  studentId: string;
  studentName: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  grade: string;
  date: string;
  email?: string;
}

export type ExportFormat = 'PDF' | 'Excel' | 'CSV';

export interface ExportFilterState {
  searchQuery: string;
  gradeFilter: string;
  statusFilter: string;
  dateFrom: string;
  dateTo: string;
  minPercentage: number | '';
  maxPercentage: number | '';
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: ExportFilterState;
  createdAt: string;
}

interface ExportFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** The export format that was initially selected (PDF/Excel/CSV) */
  format: ExportFormat | null;
  /** Full unfiltered student results */
  data: ExportDataRow[];
  /** Current passing threshold */
  passingThreshold: number;
  /** Called with the filtered rows when user confirms export */
  onExport: (rows: ExportDataRow[], format: ExportFormat) => void;
  /** Context labels for the header */
  className?: string;
  examTitle?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PRESETS_STORAGE_KEY = 'gc-export-filter-presets';

const DEFAULT_FILTERS: ExportFilterState = {
  searchQuery: '',
  gradeFilter: 'all',
  statusFilter: 'all',
  dateFrom: '',
  dateTo: '',
  minPercentage: '',
  maxPercentage: '',
};

const GRADE_OPTIONS = ['all', 'A', 'B+', 'B', 'C', 'D', 'F'] as const;
const STATUS_OPTIONS = [
  { value: 'all', label: 'All Students' },
  { value: 'pass', label: 'Passing Only' },
  { value: 'fail', label: 'Failing Only' },
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function getGradeColorClass(grade: string): string {
  switch (grade) {
    case 'A': return 'bg-green-100 text-green-700';
    case 'B+':
    case 'B': return 'bg-lime-100 text-lime-700';
    case 'C': return 'bg-yellow-100 text-yellow-700';
    case 'D': return 'bg-orange-100 text-orange-700';
    case 'F': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ExportFilterPanel({
  isOpen,
  onClose,
  format,
  data,
  passingThreshold,
  onExport,
  className: classLabel,
  examTitle,
}: ExportFilterPanelProps) {
  // ── Filter state ──────────────────────────────────────────────────────
  const [filters, setFilters] = useState<ExportFilterState>({ ...DEFAULT_FILTERS });
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(format || 'PDF');
  const [presetName, setPresetName] = useState('');
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([]);
  const [showSavePreset, setShowSavePreset] = useState(false);

  // Sync format from parent when dialog opens
  useEffect(() => {
    if (format) setSelectedFormat(format);
  }, [format]);

  // Load saved presets from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
      if (stored) setSavedPresets(JSON.parse(stored));
    } catch {
      /* ignore parse errors */
    }
  }, []);

  // Reset filters when dialog opens
  useEffect(() => {
    if (isOpen) {
      setFilters({ ...DEFAULT_FILTERS });
      setShowSavePreset(false);
      setPresetName('');
    }
  }, [isOpen]);

  // ── Debounced search ──────────────────────────────────────────────────
  const debouncedSearch = useDebounce(filters.searchQuery, 200);

  // ── Fuse index ────────────────────────────────────────────────────────
  const fuse = useMemo(
    () =>
      new Fuse(data, {
        keys: [
          { name: 'studentId', weight: 0.4 },
          { name: 'studentName', weight: 0.5 },
          { name: 'grade', weight: 0.1 },
        ],
        threshold: 0.35,
        distance: 100,
        minMatchCharLength: 1,
      }),
    [data],
  );

  // ── Filtered rows (same logic as ExamScoresTable) ─────────────────────
  const filteredRows = useMemo(() => {
    let rows = data;

    // 1. Fuzzy text search
    if (debouncedSearch.trim()) {
      const results = fuse.search(debouncedSearch);
      const matchedIds = new Set(results.map((r) => r.item.studentId));
      rows = rows.filter((r) => matchedIds.has(r.studentId));
    }

    // 2. Grade filter
    if (filters.gradeFilter !== 'all') {
      rows = rows.filter((r) => r.grade === filters.gradeFilter);
    }

    // 3. Status filter
    if (filters.statusFilter === 'pass') {
      rows = rows.filter((r) => r.percentage >= passingThreshold);
    } else if (filters.statusFilter === 'fail') {
      rows = rows.filter((r) => r.percentage < passingThreshold);
    }

    // 4. Date range
    if (filters.dateFrom) {
      const fromTs = new Date(filters.dateFrom).getTime();
      rows = rows.filter((r) => {
        if (!r.date || r.date === 'N/A') return false;
        const d = new Date(r.date).getTime();
        return !isNaN(d) && d >= fromTs;
      });
    }
    if (filters.dateTo) {
      const toTs = new Date(filters.dateTo).getTime() + 86400000;
      rows = rows.filter((r) => {
        if (!r.date || r.date === 'N/A') return false;
        const d = new Date(r.date).getTime();
        return !isNaN(d) && d < toTs;
      });
    }

    // 5. Score range
    if (filters.minPercentage !== '') {
      const min = Number(filters.minPercentage);
      if (!isNaN(min)) rows = rows.filter((r) => r.percentage >= min);
    }
    if (filters.maxPercentage !== '') {
      const max = Number(filters.maxPercentage);
      if (!isNaN(max)) rows = rows.filter((r) => r.percentage <= max);
    }

    return rows;
  }, [data, debouncedSearch, fuse, filters, passingThreshold]);

  // ── Statistics on filtered data ───────────────────────────────────────
  const filteredStats = useMemo(() => {
    if (filteredRows.length === 0) {
      return { total: 0, passCount: 0, failCount: 0, avg: 0, highest: 0, lowest: 0 };
    }
    const percentages = filteredRows.map((r) => r.percentage);
    const passCount = percentages.filter((p) => p >= passingThreshold).length;
    return {
      total: filteredRows.length,
      passCount,
      failCount: filteredRows.length - passCount,
      avg: Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length),
      highest: Math.max(...percentages),
      lowest: Math.min(...percentages),
    };
  }, [filteredRows, passingThreshold]);

  // ── Active filter count ───────────────────────────────────────────────
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.searchQuery.trim()) count++;
    if (filters.gradeFilter !== 'all') count++;
    if (filters.statusFilter !== 'all') count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.minPercentage !== '') count++;
    if (filters.maxPercentage !== '') count++;
    return count;
  }, [filters]);

  // ── Filter helpers ────────────────────────────────────────────────────
  const updateFilter = useCallback(<K extends keyof ExportFilterState>(
    key: K,
    value: ExportFilterState[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  // ── Preset management ─────────────────────────────────────────────────
  const persistPresets = useCallback((presets: FilterPreset[]) => {
    setSavedPresets(presets);
    try {
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
    } catch {
      /* storage full – ignore */
    }
  }, []);

  const savePreset = useCallback(() => {
    const name = presetName.trim();
    if (!name) return;
    const preset: FilterPreset = {
      id: generateId(),
      name,
      filters: { ...filters },
      createdAt: new Date().toISOString(),
    };
    persistPresets([preset, ...savedPresets]);
    setPresetName('');
    setShowSavePreset(false);
  }, [presetName, filters, savedPresets, persistPresets]);

  const loadPreset = useCallback((preset: FilterPreset) => {
    setFilters({ ...preset.filters });
  }, []);

  const deletePreset = useCallback(
    (id: string) => {
      persistPresets(savedPresets.filter((p) => p.id !== id));
    },
    [savedPresets, persistPresets],
  );

  // ── Export handler ────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    onExport(filteredRows, selectedFormat);
    onClose();
  }, [filteredRows, selectedFormat, onExport, onClose]);

  // ── Format visuals ────────────────────────────────────────────────────
  const formatConfig = {
    PDF: { icon: FileText, color: 'text-red-500', btnColor: 'bg-red-500 hover:bg-red-600', borderColor: 'border-red-300' },
    Excel: { icon: FileSpreadsheet, color: 'text-green-600', btnColor: 'bg-green-600 hover:bg-green-700', borderColor: 'border-green-300' },
    CSV: { icon: Table2, color: 'text-green-700', btnColor: 'bg-green-700 hover:bg-green-800', borderColor: 'border-green-400' },
  };

  if (!isOpen || !format) return null;

  const FormatIcon = formatConfig[selectedFormat].icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-gray-100 ${formatConfig[selectedFormat].color}`}>
              <FormatIcon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg">Export to {selectedFormat}</span>
              {classLabel && examTitle && (
                <p className="text-sm font-normal text-gray-500 mt-0.5">
                  {classLabel} — {examTitle}
                </p>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Summary bar */}
        <div className="flex items-center gap-3 px-1 py-2 border-b">
          <Badge variant="secondary" className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {filteredRows.length} of {data.length} students
          </Badge>
          {activeFilterCount > 0 && (
            <Badge variant="outline" className="flex items-center gap-1 text-amber-600 border-amber-300">
              <Filter className="w-3 h-3" />
              {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
            </Badge>
          )}
          {filteredRows.length < data.length && (
            <span className="text-xs text-gray-500 ml-auto">
              {data.length - filteredRows.length} student{data.length - filteredRows.length > 1 ? 's' : ''} excluded
            </span>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="filters" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="filters" className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              Preview
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {filteredRows.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="presets" className="flex items-center gap-1.5">
              <BookmarkPlus className="w-3.5 h-3.5" />
              Presets
              {savedPresets.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                  {savedPresets.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Filters Tab ──────────────────────────────────────────── */}
          <TabsContent value="filters" className="flex-1 overflow-y-auto pr-1 space-y-4 pb-2">
            {/* Search */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" />
                Search Students
              </Label>
              <Input
                placeholder="Search by name or ID..."
                value={filters.searchQuery}
                onChange={(e) => updateFilter('searchQuery', e.target.value)}
                className="h-9"
              />
            </div>

            {/* Grade + Status row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">Grade</Label>
                <Select
                  value={filters.gradeFilter}
                  onValueChange={(v) => updateFilter('gradeFilter', v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADE_OPTIONS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g === 'all' ? 'All Grades' : `Grade ${g}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">Status</Label>
                <Select
                  value={filters.statusFilter}
                  onValueChange={(v) => updateFilter('statusFilter', v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date range */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                Date Range
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-gray-400">From</span>
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => updateFilter('dateFrom', e.target.value)}
                    className="h-9"
                  />
                </div>
                <div>
                  <span className="text-xs text-gray-400">To</span>
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => updateFilter('dateTo', e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            </div>

            {/* Score range */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Score Range (%)
              </Label>
              <div className="px-1">
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[
                    filters.minPercentage === '' ? 0 : Number(filters.minPercentage),
                    filters.maxPercentage === '' ? 100 : Number(filters.maxPercentage),
                  ]}
                  onValueChange={([min, max]) => {
                    updateFilter('minPercentage', min === 0 ? '' : min);
                    updateFilter('maxPercentage', max === 100 ? '' : max);
                  }}
                  className="my-2"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{filters.minPercentage === '' ? '0' : filters.minPercentage}%</span>
                  <span>{filters.maxPercentage === '' ? '100' : filters.maxPercentage}%</span>
                </div>
              </div>
            </div>

            {/* Clear filters button */}
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-gray-500 hover:text-gray-700 w-full"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Clear all filters ({activeFilterCount})
              </Button>
            )}

            {/* Quick stats of filtered selection */}
            <div className="grid grid-cols-3 gap-3 pt-2 border-t">
              <div className="text-center p-2.5 bg-blue-50 rounded-lg">
                <p className="text-lg font-bold text-blue-700">{filteredStats.avg}%</p>
                <p className="text-xs text-blue-600">Avg Score</p>
              </div>
              <div className="text-center p-2.5 bg-green-50 rounded-lg">
                <p className="text-lg font-bold text-green-700">{filteredStats.passCount}</p>
                <p className="text-xs text-green-600">Passing</p>
              </div>
              <div className="text-center p-2.5 bg-red-50 rounded-lg">
                <p className="text-lg font-bold text-red-700">{filteredStats.failCount}</p>
                <p className="text-xs text-red-600">Failing</p>
              </div>
            </div>
          </TabsContent>

          {/* ── Preview Tab ──────────────────────────────────────────── */}
          <TabsContent value="preview" className="flex-1 overflow-hidden flex flex-col">
            {filteredRows.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10">
                <Filter className="w-10 h-10 mb-3 opacity-50" />
                <p className="text-sm font-medium">No students match current filters</p>
                <p className="text-xs mt-1">Adjust filters to include students in the export</p>
              </div>
            ) : (
              <>
                {/* Stats row */}
                <div className="flex items-center gap-4 py-2 text-sm">
                  <span className="flex items-center gap-1 text-gray-600">
                    <Users className="w-3.5 h-3.5" />
                    <strong>{filteredRows.length}</strong> students
                  </span>
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {filteredStats.passCount} passed
                  </span>
                  <span className="flex items-center gap-1 text-red-600">
                    <XCircle className="w-3.5 h-3.5" />
                    {filteredStats.failCount} failed
                  </span>
                  <span className="text-gray-500 ml-auto text-xs">
                    Range: {filteredStats.lowest}% – {filteredStats.highest}%
                  </span>
                </div>

                {/* Scrollable table */}
                <div className="flex-1 overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-10 text-xs">#</TableHead>
                        <TableHead className="text-xs">Student ID</TableHead>
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs text-center">Score</TableHead>
                        <TableHead className="text-xs text-center">%</TableHead>
                        <TableHead className="text-xs text-center">Grade</TableHead>
                        <TableHead className="text-xs text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.slice(0, 100).map((row, idx) => {
                        const isPassing = row.percentage >= passingThreshold;
                        return (
                          <TableRow key={row.studentId + idx} className="text-xs">
                            <TableCell className="text-gray-400">{idx + 1}</TableCell>
                            <TableCell className="font-mono text-gray-700">
                              {row.studentId}
                            </TableCell>
                            <TableCell>{row.studentName}</TableCell>
                            <TableCell className="text-center">
                              {row.score}/{row.totalQuestions}
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {row.percentage}%
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className={`text-xs px-1.5 py-0 ${getGradeColorClass(row.grade)}`}
                              >
                                {row.grade}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {isPassing ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mx-auto" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-red-400 mx-auto" />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {filteredRows.length > 100 && (
                    <p className="text-xs text-center text-gray-400 py-2">
                      Showing first 100 of {filteredRows.length} rows. All rows will be included in the export.
                    </p>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* ── Presets Tab ───────────────────────────────────────────── */}
          <TabsContent value="presets" className="flex-1 overflow-y-auto space-y-4 pb-2">
            {/* Save current filters */}
            <div className="p-3 border rounded-lg bg-gray-50 space-y-2">
              <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" />
                Save Current Filters
              </p>
              {activeFilterCount === 0 ? (
                <p className="text-xs text-gray-400">
                  Apply at least one filter before saving a preset.
                </p>
              ) : showSavePreset ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Preset name..."
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && savePreset()}
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <Button size="sm" onClick={savePreset} disabled={!presetName.trim()}>
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowSavePreset(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSavePreset(true)}
                  className="w-full"
                >
                  <BookmarkPlus className="w-3.5 h-3.5 mr-1.5" />
                  Save as Preset ({activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''})
                </Button>
              )}
            </div>

            {/* Saved presets list */}
            {savedPresets.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-gray-400 py-10">
                <BookmarkPlus className="w-10 h-10 mb-3 opacity-50" />
                <p className="text-sm font-medium">No saved presets</p>
                <p className="text-xs mt-1">
                  Apply filters and save them for quick reuse
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-medium">
                  Saved Presets ({savedPresets.length})
                </p>
                {savedPresets.map((preset) => {
                  const filterDescriptions: string[] = [];
                  if (preset.filters.searchQuery)
                    filterDescriptions.push(`Search: "${preset.filters.searchQuery}"`);
                  if (preset.filters.gradeFilter !== 'all')
                    filterDescriptions.push(`Grade ${preset.filters.gradeFilter}`);
                  if (preset.filters.statusFilter !== 'all')
                    filterDescriptions.push(
                      preset.filters.statusFilter === 'pass' ? 'Passing' : 'Failing',
                    );
                  if (preset.filters.dateFrom || preset.filters.dateTo)
                    filterDescriptions.push(
                      `Date: ${preset.filters.dateFrom || '∞'} – ${preset.filters.dateTo || '∞'}`,
                    );
                  if (preset.filters.minPercentage !== '' || preset.filters.maxPercentage !== '')
                    filterDescriptions.push(
                      `Score: ${preset.filters.minPercentage || 0}% – ${preset.filters.maxPercentage || 100}%`,
                    );

                  return (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {preset.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {filterDescriptions.join(' • ') || 'No filters'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => loadPreset(preset)}
                          className="h-7 text-xs"
                        >
                          Apply
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deletePreset(preset.id)}
                          className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <DialogFooter className="border-t pt-4 gap-2 sm:gap-0">
          {/* Format picker */}
          <div className="flex items-center gap-2 mr-auto">
            <span className="text-xs text-gray-500">Format:</span>
            {(['PDF', 'Excel', 'CSV'] as ExportFormat[]).map((fmt) => {
              const cfg = formatConfig[fmt];
              const FmtIcon = cfg.icon;
              const isActive = selectedFormat === fmt;
              return (
                <Button
                  key={fmt}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedFormat(fmt)}
                  className={
                    isActive
                      ? `${cfg.btnColor} text-white h-8`
                      : `${cfg.borderColor} ${cfg.color} h-8 hover:opacity-80`
                  }
                >
                  <FmtIcon className="w-3.5 h-3.5 mr-1" />
                  {fmt}
                </Button>
              );
            })}
          </div>

          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={filteredRows.length === 0}
            className={`${formatConfig[selectedFormat].btnColor} text-white flex items-center gap-2`}
          >
            <Download className="w-4 h-4" />
            Export {filteredRows.length} Student{filteredRows.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
