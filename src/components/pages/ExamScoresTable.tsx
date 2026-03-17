"use client";

import React, { useState, useMemo, useCallback } from "react";
import Fuse from "fuse.js";
import StudentSearchCombobox, {
  type SearchableStudent,
} from "@/components/ui/StudentSearchCombobox";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  CheckCircle2,
  XCircle,
  Users,
  TrendingUp,
  TrendingDown,
  BarChart3,
  SlidersHorizontal,
  Filter,
  RotateCcw,
  CalendarDays,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ExamScoreRow {
  studentId: string;
  studentName: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  grade: string;
  date: string;
  email?: string;
}

export type SortColumn =
  | "studentId"
  | "studentName"
  | "score"
  | "percentage"
  | "grade"
  | "date";
export type SortDirection = "asc" | "desc";

interface ExamScoresTableProps {
  /** The rows to display — must already be populated from Firebase */
  data: ExamScoreRow[];
  /** Whether data is currently loading */
  loading?: boolean;
  /** Exam title shown in the empty state */
  examTitle?: string;
  /** Callback when a row's "View" button is clicked */
  onViewStudent?: (row: ExamScoreRow) => void;
  /** Callback when "Export" is clicked, with the currently-visible (filtered+sorted) rows */
  onExport?: (rows: ExamScoreRow[]) => void;
  /** Current passing threshold percentage (0–100). Default 60. */
  passingThreshold?: number;
  /** Called when instructor changes the threshold inline. Parent should persist this. */
  onThresholdChange?: (newThreshold: number) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/** Letter grade → sort ordinal (A = 1, F = 6) for deterministic sorting */
function gradeOrdinal(grade: string): number {
  switch (grade) {
    case "A":
      return 1;
    case "B+":
      return 2;
    case "B":
      return 3;
    case "C":
      return 4;
    case "D":
      return 5;
    case "F":
      return 6;
    default:
      return 7;
  }
}

function getGradeColorClass(grade: string): string {
  switch (grade) {
    case "A":
      return "bg-green-100 text-green-700 border-green-200";
    case "B+":
    case "B":
      return "bg-lime-100 text-lime-700 border-lime-200";
    case "C":
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "D":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "F":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

/** Parse a date string like "Jan 5, 2026" into a comparable timestamp */
function parseDateStr(d: string): number {
  const ts = Date.parse(d);
  return isNaN(ts) ? 0 : ts;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ExamScoresTable({
  data,
  loading = false,
  examTitle = "Exam",
  onViewStudent,
  onExport,
  passingThreshold = 60,
  onThresholdChange,
}: ExamScoresTableProps) {
  // ── State ───────────────────────────────────────────────────────────────
  const [sortColumn, setSortColumn] = useState<SortColumn>("studentName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [showThresholdConfig, setShowThresholdConfig] = useState(false);
  const [localThreshold, setLocalThreshold] = useState(passingThreshold);

  // ── Advanced filter state ───────────────────────────────────────────────
  const [showFilters, setShowFilters] = useState(false);
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minPercentage, setMinPercentage] = useState("");
  const [maxPercentage, setMaxPercentage] = useState("");

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (gradeFilter !== "all") count++;
    if (statusFilter !== "all") count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    if (minPercentage) count++;
    if (maxPercentage) count++;
    return count;
  }, [
    gradeFilter,
    statusFilter,
    dateFrom,
    dateTo,
    minPercentage,
    maxPercentage,
  ]);

  const clearAllFilters = useCallback(() => {
    setGradeFilter("all");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setMinPercentage("");
    setMaxPercentage("");
    setSearchQuery("");
    setCurrentPage(1);
  }, []);

  // Sync local threshold when parent updates
  React.useEffect(() => {
    setLocalThreshold(passingThreshold);
  }, [passingThreshold]);

  // ── Pass/Fail statistics (recomputed whenever data or threshold change) ─
  const stats = useMemo(() => {
    if (data.length === 0) {
      return {
        total: 0,
        passCount: 0,
        failCount: 0,
        passRate: 0,
        failRate: 0,
        avgPercentage: 0,
        highestPercentage: 0,
        lowestPercentage: 0,
        medianPercentage: 0,
      };
    }

    const passCount = data.filter(
      (r) => r.percentage >= passingThreshold,
    ).length;
    const failCount = data.length - passCount;
    const percentages = data.map((r) => r.percentage);
    const sorted = [...percentages].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 !== 0
        ? sorted[mid]
        : Math.round((sorted[mid - 1] + sorted[mid]) / 2);

    const avg = percentages.reduce((a, b) => a + b, 0) / percentages.length;

    return {
      total: data.length,
      passCount,
      failCount,
      passRate: Math.round((passCount / data.length) * 100),
      failRate: Math.round((failCount / data.length) * 100),
      avgPercentage: Math.round(avg),
      highestPercentage: Math.max(...percentages),
      lowestPercentage: Math.min(...percentages),
      medianPercentage: median,
    };
  }, [data, passingThreshold]);

  // ── Sorting logic ───────────────────────────────────────────────────────
  const handleSort = useCallback(
    (column: SortColumn) => {
      if (sortColumn === column) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortColumn(column);
        setSortDirection("asc");
      }
      setCurrentPage(1); // reset to first page on re-sort
    },
    [sortColumn],
  );

  // ── Fuse index for fuzzy search ─────────────────────────────────────────
  const fuse = useMemo(
    () =>
      new Fuse(data, {
        keys: [
          { name: "studentId", weight: 0.4 },
          { name: "studentName", weight: 0.5 },
          { name: "grade", weight: 0.1 },
        ],
        threshold: 0.35,
        distance: 100,
        minMatchCharLength: 1,
      }),
    [data],
  );

  // Debounce the search query for performance
  const debouncedSearchQuery = useDebounce(searchQuery, 200);

  // Searchable students for the combobox suggestions
  const searchableStudents: SearchableStudent[] = useMemo(
    () =>
      data.map((r) => ({
        studentId: r.studentId,
        studentName: r.studentName,
        email: r.email,
      })),
    [data],
  );

  // ── Filtered + sorted rows (memoised) ──────────────────────────────────
  const processedRows = useMemo(() => {
    // 1. Fuzzy text search filter
    let rows = data;
    if (debouncedSearchQuery.trim()) {
      const fuseResults = fuse.search(debouncedSearchQuery);
      const matchedIds = new Set(fuseResults.map((r) => r.item.studentId));
      rows = rows.filter((r) => matchedIds.has(r.studentId));
    }

    // 2. Grade filter
    if (gradeFilter !== "all") {
      rows = rows.filter((r) => r.grade === gradeFilter);
    }

    // 3. Status filter (pass/fail)
    if (statusFilter === "pass") {
      rows = rows.filter((r) => r.percentage >= passingThreshold);
    } else if (statusFilter === "fail") {
      rows = rows.filter((r) => r.percentage < passingThreshold);
    }

    // 4. Date range filter
    if (dateFrom) {
      const fromTs = new Date(dateFrom).getTime();
      rows = rows.filter((r) => {
        if (!r.date || r.date === "N/A") return false;
        const d = new Date(r.date).getTime();
        return !isNaN(d) && d >= fromTs;
      });
    }
    if (dateTo) {
      const toTs = new Date(dateTo).getTime() + 86400000; // include end date
      rows = rows.filter((r) => {
        if (!r.date || r.date === "N/A") return false;
        const d = new Date(r.date).getTime();
        return !isNaN(d) && d < toTs;
      });
    }

    // 5. Score range filter
    if (minPercentage !== "") {
      const min = Number(minPercentage);
      if (!isNaN(min)) rows = rows.filter((r) => r.percentage >= min);
    }
    if (maxPercentage !== "") {
      const max = Number(maxPercentage);
      if (!isNaN(max)) rows = rows.filter((r) => r.percentage <= max);
    }

    // 2. Sort
    const sorted = [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case "studentId":
          cmp = a.studentId.localeCompare(b.studentId);
          break;
        case "studentName":
          cmp = a.studentName.localeCompare(b.studentName);
          break;
        case "score":
          cmp = a.score - b.score;
          break;
        case "percentage":
          cmp = a.percentage - b.percentage;
          break;
        case "grade":
          cmp = gradeOrdinal(a.grade) - gradeOrdinal(b.grade);
          break;
        case "date":
          cmp = parseDateStr(a.date) - parseDateStr(b.date);
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [
    data,
    debouncedSearchQuery,
    fuse,
    sortColumn,
    sortDirection,
    gradeFilter,
    statusFilter,
    dateFrom,
    dateTo,
    minPercentage,
    maxPercentage,
    passingThreshold,
  ]);

  // ── Pagination ──────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(processedRows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return processedRows.slice(start, start + pageSize);
  }, [processedRows, safePage, pageSize]);

  // Keep currentPage in sync if processedRows shrinks
  if (safePage !== currentPage) {
    // Will be corrected on next render
    setCurrentPage(safePage);
  }

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  /** Build visible page number buttons (max ~7 buttons shown) */
  const pageNumbers = useMemo(() => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push("ellipsis");
      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, safePage]);

  // ── Sort indicator ──────────────────────────────────────────────────────
  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return (
        <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground/50" />
      );
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-3.5 w-3.5 text-[#1a472a]" />
    ) : (
      <ArrowDown className="ml-1 h-3.5 w-3.5 text-[#1a472a]" />
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── Pass / Fail Statistics Panel ─────────────────────────────────── */}
      {!loading && data.length > 0 && (
        <div className="space-y-3">
          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Total */}
            <Card className="p-4 border">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-medium text-muted-foreground">
                  Total
                </span>
              </div>
              <p className="text-2xl font-bold text-[#1a472a]">{stats.total}</p>
            </Card>

            {/* Passed */}
            <Card className="p-4 border border-green-200 bg-green-50/50">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-green-700">
                  Passed
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-green-700">
                  {stats.passCount}
                </p>
                <Badge
                  variant="outline"
                  className="bg-green-100 text-green-700 border-green-300 text-xs"
                >
                  {stats.passRate}%
                </Badge>
              </div>
            </Card>

            {/* Failed */}
            <Card className="p-4 border border-red-200 bg-red-50/50">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4 text-red-600" />
                <span className="text-xs font-medium text-red-700">Failed</span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-red-700">
                  {stats.failCount}
                </p>
                <Badge
                  variant="outline"
                  className="bg-red-100 text-red-700 border-red-300 text-xs"
                >
                  {stats.failRate}%
                </Badge>
              </div>
            </Card>

            {/* Highest */}
            <Card className="p-4 border">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-medium text-muted-foreground">
                  Highest
                </span>
              </div>
              <p className="text-2xl font-bold text-[#1a472a]">
                {stats.highestPercentage}%
              </p>
            </Card>

            {/* Lowest */}
            <Card className="p-4 border">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-orange-500" />
                <span className="text-xs font-medium text-muted-foreground">
                  Lowest
                </span>
              </div>
              <p className="text-2xl font-bold text-[#1a472a]">
                {stats.total >= 2 ? `${stats.lowestPercentage}%` : "—"}
              </p>
            </Card>

            {/* Median */}
            <Card className="p-4 border">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-violet-500" />
                <span className="text-xs font-medium text-muted-foreground">
                  Median
                </span>
              </div>
              <p className="text-2xl font-bold text-[#1a472a]">
                {stats.total >= 2 ? `${stats.medianPercentage}%` : "—"}
              </p>
            </Card>
          </div>

          {/* Pass/fail visual bar + threshold config toggle */}
          <Card className="p-4 border">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Visual pass/fail ratio bar */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Pass / Fail Ratio (threshold: {passingThreshold}%)
                  </span>
                  <button
                    onClick={() => setShowThresholdConfig(!showThresholdConfig)}
                    className="inline-flex items-center gap-1 text-xs text-[#1a472a] hover:text-[#2d6b47] font-medium"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    {showThresholdConfig ? "Hide" : "Adjust"} Threshold
                  </button>
                </div>
                <div className="flex h-4 rounded-full overflow-hidden bg-gray-100">
                  {stats.passRate > 0 && (
                    <div
                      className="bg-green-500 transition-all duration-300 flex items-center justify-center"
                      style={{ width: `${stats.passRate}%` }}
                    >
                      {stats.passRate >= 15 && (
                        <span className="text-[10px] font-bold text-white">
                          {stats.passRate}%
                        </span>
                      )}
                    </div>
                  )}
                  {stats.failRate > 0 && (
                    <div
                      className="bg-red-400 transition-all duration-300 flex items-center justify-center"
                      style={{ width: `${stats.failRate}%` }}
                    >
                      {stats.failRate >= 15 && (
                        <span className="text-[10px] font-bold text-white">
                          {stats.failRate}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-green-700 font-medium">
                    {stats.passCount} passed
                  </span>
                  <span className="text-[10px] text-red-600 font-medium">
                    {stats.failCount} failed
                  </span>
                </div>
              </div>
            </div>

            {/* Inline threshold config */}
            {showThresholdConfig && (
              <div className="mt-4 pt-3 border-t">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="text-sm font-medium text-foreground whitespace-nowrap">
                    Passing Threshold:
                  </label>
                  <div className="flex items-center gap-3 flex-1">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={localThreshold}
                      onChange={(e) =>
                        setLocalThreshold(Number(e.target.value))
                      }
                      className="flex-1 accent-[#1a472a]"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={localThreshold}
                      onChange={(e) =>
                        setLocalThreshold(
                          Math.max(
                            0,
                            Math.min(100, Number(e.target.value) || 0),
                          ),
                        )
                      }
                      className="w-16 px-2 py-1 border rounded text-center text-sm"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <Button
                    size="sm"
                    disabled={localThreshold === passingThreshold}
                    onClick={() => onThresholdChange?.(localThreshold)}
                    className="bg-[#1a472a] hover:bg-[#2d6b47] text-white"
                  >
                    Apply
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Students scoring ≥ {localThreshold}% will be marked as
                  passing.
                  {onThresholdChange
                    ? " This change will be saved to your settings."
                    : " Connect threshold persistence to save changes."}
                </p>
              </div>
            )}
          </Card>
        </div>
      )}
      <Card className="border overflow-hidden">
        {/* Toolbar: search + filters + page-size + export */}
        <CardHeader className="pb-3 px-4 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">
              Scores{" "}
              <span className="text-muted-foreground font-normal text-sm ml-2">
                ({processedRows.length} student
                {processedRows.length !== 1 ? "s" : ""})
              </span>
            </CardTitle>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Fuzzy Search with Autocomplete */}
              <div className="w-full sm:w-auto flex-1 sm:flex-none">
                <StudentSearchCombobox
                  students={searchableStudents}
                  value={searchQuery}
                  onChange={(q) => {
                    setSearchQuery(q);
                    setCurrentPage(1);
                  }}
                  placeholder="Search student…"
                  showResultCount
                  filteredCount={processedRows.length}
                  className="w-full sm:w-[260px]"
                />
              </div>

              {/* Advanced Filters toggle */}
              <Button
                variant={showFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={
                  showFilters
                    ? "bg-primary text-primary-foreground"
                    : "bg-background"
                }
              >
                <Filter className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <Badge className="ml-1.5 bg-amber-500 text-white text-[10px] px-1.5 py-0 h-4 min-w-[16px] rounded-full">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>

              {/* Page size selector */}
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[70px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Export button (calls parent handler with current visible rows) */}
              {onExport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onExport(processedRows)}
                  className="hidden sm:flex"
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  Export
                </Button>
              )}
            </div>
          </div>

          {/* ── Advanced Filters Panel ────────────────────────────────────── */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-[#1a472a] flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4" />
                  Advanced Filters
                </h4>
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 text-xs"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Clear All ({activeFilterCount})
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Grade Filter */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Grade
                  </label>
                  <Select
                    value={gradeFilter}
                    onValueChange={(v) => {
                      setGradeFilter(v);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All Grades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Grades</SelectItem>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="B+">B+</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                      <SelectItem value="C">C</SelectItem>
                      <SelectItem value="D">D</SelectItem>
                      <SelectItem value="F">F</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Status
                  </label>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => {
                      setStatusFilter(v);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pass">Pass Only</SelectItem>
                      <SelectItem value="fail">Fail Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date From */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    <CalendarDays className="w-3 h-3 inline mr-1" />
                    From
                  </label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    <CalendarDays className="w-3 h-3 inline mr-1" />
                    To
                  </label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Min Percentage */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Min Score %
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="0"
                    value={minPercentage}
                    onChange={(e) => {
                      setMinPercentage(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Max Percentage */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Max Score %
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="100"
                    value={maxPercentage}
                    onChange={(e) => {
                      setMaxPercentage(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {/* Active filter summary */}
              {activeFilterCount > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {gradeFilter !== "all" && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      Grade: {gradeFilter}
                      <button
                        onClick={() => setGradeFilter("all")}
                        className="ml-0.5 hover:text-red-600"
                      >
                        ×
                      </button>
                    </Badge>
                  )}
                  {statusFilter !== "all" && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      Status: {statusFilter === "pass" ? "Pass" : "Fail"}
                      <button
                        onClick={() => setStatusFilter("all")}
                        className="ml-0.5 hover:text-red-600"
                      >
                        ×
                      </button>
                    </Badge>
                  )}
                  {dateFrom && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      From: {dateFrom}
                      <button
                        onClick={() => setDateFrom("")}
                        className="ml-0.5 hover:text-red-600"
                      >
                        ×
                      </button>
                    </Badge>
                  )}
                  {dateTo && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      To: {dateTo}
                      <button
                        onClick={() => setDateTo("")}
                        className="ml-0.5 hover:text-red-600"
                      >
                        ×
                      </button>
                    </Badge>
                  )}
                  {minPercentage && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      Min: {minPercentage}%
                      <button
                        onClick={() => setMinPercentage("")}
                        className="ml-0.5 hover:text-red-600"
                      >
                        ×
                      </button>
                    </Badge>
                  )}
                  {maxPercentage && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      Max: {maxPercentage}%
                      <button
                        onClick={() => setMaxPercentage("")}
                        className="ml-0.5 hover:text-red-600"
                      >
                        ×
                      </button>
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {/* ── Table ─────────────────────────────────────────────────────── */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#fffde7] hover:bg-[#fffde7] border-b-2 border-slate-100">
                  <TableHead className="w-[50px] text-[#857b01] font-bold py-4">
                    #
                  </TableHead>
                  <TableHead>
                    <button
                      className="inline-flex items-center text-[#857b01] font-bold hover:text-[#5e5700] transition-colors"
                      onClick={() => handleSort("studentId")}
                    >
                      Student ID
                      <SortIcon column="studentId" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="inline-flex items-center text-[#857b01] font-bold hover:text-[#5e5700] transition-colors"
                      onClick={() => handleSort("studentName")}
                    >
                      Student Name
                      <SortIcon column="studentName" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="inline-flex items-center text-[#857b01] font-bold hover:text-[#5e5700] transition-colors"
                      onClick={() => handleSort("score")}
                    >
                      Score
                      <SortIcon column="score" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="inline-flex items-center text-[#857b01] font-bold hover:text-[#5e5700] transition-colors"
                      onClick={() => handleSort("percentage")}
                    >
                      Percentage
                      <SortIcon column="percentage" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="inline-flex items-center text-[#857b01] font-bold hover:text-[#5e5700] transition-colors"
                      onClick={() => handleSort("grade")}
                    >
                      Grade
                      <SortIcon column="grade" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="inline-flex items-center text-[#857b01] font-bold hover:text-[#5e5700] transition-colors"
                      onClick={() => handleSort("date")}
                    >
                      Date
                      <SortIcon column="date" />
                    </button>
                  </TableHead>
                  <TableHead className="text-[#857b01] font-bold">
                    Status
                  </TableHead>
                  {onViewStudent && (
                    <TableHead className="text-[#857b01] font-bold text-center">
                      Actions
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>

              <TableBody>
                {/* Loading */}
                {loading && (
                  <TableRow>
                    <TableCell
                      colSpan={onViewStudent ? 9 : 8}
                      className="h-32 text-center text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-[#1a472a] border-t-transparent rounded-full animate-spin" />
                        Loading results…
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {/* Empty */}
                {!loading && processedRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={onViewStudent ? 9 : 8}
                      className="h-40 text-center text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="w-12 h-12 opacity-40" />
                        {searchQuery ? (
                          <>
                            <p className="font-medium">No matching students</p>
                            <p className="text-sm">
                              Try a different search term.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-medium">
                              No results for {examTitle}
                            </p>
                            <p className="text-sm">
                              Scan answer sheets to generate grades.
                            </p>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {/* Data rows */}
                {!loading &&
                  paginatedRows.map((row, idx) => {
                    const globalIdx = (safePage - 1) * pageSize + idx + 1;
                    return (
                      <TableRow
                        key={row.studentId}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="text-muted-foreground">
                          {globalIdx}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {row.studentId}
                        </TableCell>
                        <TableCell className="font-medium text-[#1a472a]">
                          {row.studentName}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {row.score} / {row.totalQuestions}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {/* mini bar — green if passing, red if failing */}
                            <div className="hidden sm:block w-16 h-2 rounded-full bg-gray-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  row.percentage >= passingThreshold
                                    ? "bg-green-500"
                                    : "bg-red-400"
                                }`}
                                style={{
                                  width: `${Math.min(row.percentage, 100)}%`,
                                }}
                              />
                            </div>
                            <span className="text-sm">{row.percentage}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={getGradeColorClass(row.grade)}
                          >
                            {row.grade}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {row.date}
                        </TableCell>
                        <TableCell>
                          {row.percentage >= passingThreshold ? (
                            <Badge
                              variant="outline"
                              className="bg-green-50 text-green-700 border-green-200 gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Pass
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-red-50 text-red-700 border-red-200 gap-1"
                            >
                              <XCircle className="w-3 h-3" />
                              Fail
                            </Badge>
                          )}
                        </TableCell>
                        {onViewStudent && (
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onViewStudent(row)}
                            >
                              View
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>

          {/* ── Pagination ────────────────────────────────────────────────── */}
          {!loading && processedRows.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t px-4 py-3">
              {/* Info text */}
              <p className="text-sm text-muted-foreground">
                Showing {(safePage - 1) * pageSize + 1}–
                {Math.min(safePage * pageSize, processedRows.length)} of{" "}
                {processedRows.length} results
              </p>

              {/* Page buttons */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={safePage <= 1}
                  onClick={() => goToPage(1)}
                  aria-label="First page"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={safePage <= 1}
                  onClick={() => goToPage(safePage - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {pageNumbers.map((p, i) =>
                  p === "ellipsis" ? (
                    <span
                      key={`e-${i}`}
                      className="px-1 text-muted-foreground text-sm"
                    >
                      …
                    </span>
                  ) : (
                    <Button
                      key={p}
                      variant={p === safePage ? "default" : "outline"}
                      size="icon"
                      className={`h-8 w-8 ${
                        p === safePage
                          ? "bg-[#1a472a] text-white hover:bg-[#2d6b47]"
                          : ""
                      }`}
                      onClick={() => goToPage(p)}
                    >
                      {p}
                    </Button>
                  ),
                )}

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={safePage >= totalPages}
                  onClick={() => goToPage(safePage + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={safePage >= totalPages}
                  onClick={() => goToPage(totalPages)}
                  aria-label="Last page"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
