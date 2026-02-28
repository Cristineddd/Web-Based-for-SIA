"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Download,
  Eye,
  Trash2,
  Search,
  Filter,
  Archive,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateTemplatePDF } from "@/lib/templatePdfGenerator";
import {
  InstructorSettingsService,
  InstructorSettings,
} from "@/services/instructorSettingsService";

interface Template {
  id: string;
  name: string;
  description: string;
  numQuestions: number;
  choicesPerQuestion: number;
  layout: "single" | "double" | "quad";
  includeStudentId: boolean;
  studentIdLength: number;
  createdBy: string;
  instructorId?: string;
  classId?: string;
  className?: string;
  examId?: string;
  examName?: string;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
}

interface Class {
  id: string;
  class_name: string;
}

interface Exam {
  id: string;
  title: string;
}

// Pagination constants
const ITEMS_PER_PAGE = 9; // 3x3 grid

// Helper function to format dates (handles Firestore Timestamps and strings)
const formatDate = (dateValue: unknown): string => {
  if (!dateValue) return "N/A";

  try {
    // Handle Firestore Timestamp objects
    if (
      typeof dateValue === "object" &&
      dateValue !== null &&
      "toDate" in dateValue
    ) {
      return (dateValue as { toDate: () => Date })
        .toDate()
        .toLocaleDateString();
    }

    // Handle string dates
    if (typeof dateValue === "string") {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return "N/A";
      return date.toLocaleDateString();
    }

    // Handle Date objects
    if (dateValue instanceof Date) {
      return dateValue.toLocaleDateString();
    }

    // Handle seconds (Firestore timestamp as plain object)
    if (
      typeof dateValue === "object" &&
      "seconds" in (dateValue as Record<string, unknown>)
    ) {
      const seconds = (dateValue as { seconds: number }).seconds;
      return new Date(seconds * 1000).toLocaleDateString();
    }

    return "N/A";
  } catch {
    return "N/A";
  }
};

export default function Templates() {
  const { user } = useAuth();
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(
    null,
  );
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [templateToArchive, setTemplateToArchive] = useState<Template | null>(
    null,
  );
  const [templates, setTemplates] = useState<Template[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState<InstructorSettings | null>(null);

  // Search and Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClass, setFilterClass] = useState<string>("all");
  const [filterExam, setFilterExam] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [showArchived, setShowArchived] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch classes and exams on mount
  useEffect(() => {
    if (user?.id) {
      fetchClassesAndExams();
      fetchTemplates();
      fetchBranding();
    }
  }, [user?.id]);

  const fetchBranding = async () => {
    if (!user?.id) return;
    const settings = await InstructorSettingsService.getSettings(user.id);
    setBranding(settings);
  };

  const fetchClassesAndExams = async () => {
    if (!user?.instructorId) {
      console.log("No instructorId found, skipping class/exam fetch");
      return;
    }

    try {
      // Fetch classes for current instructor only
      const classesQuery = query(
        collection(db, "classes"),
        where("instructorId", "==", user.instructorId),
      );
      const classesSnapshot = await getDocs(classesQuery);
      const fetchedClasses = classesSnapshot.docs.map((doc) => ({
        id: doc.id,
        class_name: doc.data().class_name || "Unnamed Class",
      }));
      setClasses(fetchedClasses);

      // Fetch exams for current instructor only
      const examsQuery = query(
        collection(db, "exams"),
        where("instructorId", "==", user.instructorId),
      );
      const examsSnapshot = await getDocs(examsQuery);
      const fetchedExams = examsSnapshot.docs.map((doc) => ({
        id: doc.id,
        title: doc.data().title || "Unnamed Exam",
      }));
      setExams(fetchedExams);
    } catch (error) {
      console.error("Error fetching classes/exams:", error);
    }
  };

  const fetchTemplates = async () => {
    if (!user?.instructorId) {
      console.log("No instructorId found, skipping template fetch");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Query templates filtered by current user's instructorId
      const templatesQuery = query(
        collection(db, "templates"),
        where("instructorId", "==", user.instructorId),
      );
      const templatesSnapshot = await getDocs(templatesQuery);
      const fetchedTemplates = templatesSnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as Template,
      );
      setTemplates(fetchedTemplates);
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and search logic
  const filteredTemplates = useMemo(() => {
    let result = templates;

    // Filter archived/active
    result = result.filter((t) =>
      showArchived ? t.isArchived : !t.isArchived,
    );

    // Search by name or description
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.className?.toLowerCase().includes(query) ||
          t.examName?.toLowerCase().includes(query),
      );
    }

    // Filter by class
    if (filterClass && filterClass !== "all") {
      result = result.filter((t) => t.classId === filterClass);
    }

    // Filter by exam
    if (filterExam && filterExam !== "all") {
      result = result.filter((t) => t.examId === filterExam);
    }

    // Filter by date (created from)
    if (filterDateFrom) {
      const fromDate = new Date(filterDateFrom);
      fromDate.setHours(0, 0, 0, 0);
      result = result.filter((t) => {
        const createdAt = t.createdAt ? new Date(t.createdAt) : null;
        return createdAt && createdAt >= fromDate;
      });
    }

    // Sort by createdAt descending (newest first)
    result.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    return result;
  }, [
    templates,
    searchQuery,
    filterClass,
    filterExam,
    filterDateFrom,
    showArchived,
  ]);

  // Pagination logic
  const totalPages = Math.ceil(filteredTemplates.length / ITEMS_PER_PAGE);
  const paginatedTemplates = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTemplates.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredTemplates, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterClass, filterExam, filterDateFrom, showArchived]);

  const clearFilters = () => {
    setSearchQuery("");
    setFilterClass("all");
    setFilterExam("all");
    setFilterDateFrom("");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery ||
    filterClass !== "all" ||
    filterExam !== "all" ||
    filterDateFrom;

  const handlePreview = (template: Template) => {
    setPreviewTemplate(template);
    setShowPreview(true);
  };

  const handleDownload = async (template: Template) => {
    try {
      toast.info("📄 Generating PDF...");
      await generateTemplatePDF({
        name: template.name,
        description: template.description,
        numQuestions: template.numQuestions,
        choicesPerQuestion: template.choicesPerQuestion,
        examName: template.examName,
        className: template.className,
        institutionName: branding?.institutionName,
        logoUrl: branding?.logoUrl,
      });
      toast.success(`✅ Downloaded ${template.name}`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    }
  };

  const confirmDelete = (template: Template) => {
    setTemplateToDelete(template);
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!templateToDelete) return;

    try {
      await deleteDoc(doc(db, "templates", templateToDelete.id));
      setTemplates((prev) => prev.filter((t) => t.id !== templateToDelete.id));
      toast.success(`"${templateToDelete.name}" deleted successfully`);
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Failed to delete template");
    } finally {
      setShowDeleteDialog(false);
      setTemplateToDelete(null);
    }
  };

  // Archive functions
  const confirmArchive = (template: Template) => {
    setTemplateToArchive(template);
    setShowArchiveDialog(true);
  };

  const handleArchive = async () => {
    if (!templateToArchive || !user?.id) return;

    try {
      await updateDoc(doc(db, "templates", templateToArchive.id), {
        isArchived: true,
        archivedAt: serverTimestamp(),
        archivedBy: user.id,
      });

      // Update local state
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === templateToArchive.id
            ? {
                ...t,
                isArchived: true,
                archivedAt: new Date().toISOString(),
                archivedBy: user.id,
              }
            : t,
        ),
      );

      toast.success(`"${templateToArchive.name}" archived successfully`);
    } catch (error) {
      console.error("Error archiving template:", error);
      toast.error("Failed to archive template");
    } finally {
      setShowArchiveDialog(false);
      setTemplateToArchive(null);
    }
  };

  const handleRestore = async (template: Template) => {
    if (!user?.id) return;

    try {
      await updateDoc(doc(db, "templates", template.id), {
        isArchived: false,
        archivedAt: null,
        archivedBy: null,
      });

      // Update local state
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === template.id
            ? {
                ...t,
                isArchived: false,
                archivedAt: undefined,
                archivedBy: undefined,
              }
            : t,
        ),
      );

      toast.success(`"${template.name}" restored successfully`);
    } catch (error) {
      console.error("Error restoring template:", error);
      toast.error("Failed to restore template");
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Answer Sheet Templates
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage templates generated from exams. Templates are
            created automatically when you create an exam.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive className="w-4 h-4 mr-2" />
            {showArchived ? "Viewing Archived" : "View Archived"}
          </Button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <Card className="p-4 border">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, description, class, or exam..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter Toggle Button */}
          <Button
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <span className="ml-2 px-1.5 py-0.5 bg-primary-foreground text-primary rounded-full text-xs">
                Active
              </span>
            )}
          </Button>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Filter by Class */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Filter by Class
              </Label>
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger>
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.class_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filter by Exam */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Filter by Exam
              </Label>
              <Select value={filterExam} onValueChange={setFilterExam}>
                <SelectTrigger>
                  <SelectValue placeholder="All Exams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Exams</SelectItem>
                  {exams.map((exam) => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {exam.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Created On/After
              </Label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Results Summary */}
      {!loading && templates.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {paginatedTemplates.length} of {filteredTemplates.length}{" "}
            templates
            {hasActiveFilters &&
              ` (filtered from ${templates.filter((t) => (showArchived ? t.isArchived : !t.isArchived)).length} total)`}
            {showArchived && " (archived)"}
          </span>
          {totalPages > 1 && (
            <span>
              Page {currentPage} of {totalPages}
            </span>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <Card className="p-8 border text-center">
          <p className="text-muted-foreground">Loading templates...</p>
        </Card>
      ) : filteredTemplates.length === 0 ? (
        <Card className="p-8 border text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
            {templates.length === 0 ? (
              <>
                <h3 className="font-semibold text-lg mb-2">
                  No templates generated yet
                </h3>
                <p className="text-muted-foreground mb-4">
                  Templates are automatically created when you create an exam.
                  Go to the Exams page to create your first exam.
                </p>
              </>
            ) : hasActiveFilters ? (
              <>
                <h3 className="font-semibold text-lg mb-2">
                  No templates match your filters
                </h3>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your search or filter criteria.
                </p>
                <Button variant="outline" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
              </>
            ) : (
              <>
                <h3 className="font-semibold text-lg mb-2">
                  {showArchived
                    ? "No archived templates"
                    : "No active templates"}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {showArchived
                    ? "Archived templates will appear here."
                    : "Templates are automatically generated when exams are created."}
                </p>
              </>
            )}
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedTemplates.map((template) => (
              <Card
                key={template.id}
                className={`p-6 border hover:shadow-md hover:border-primary/30 transition-all ${template.isArchived ? "opacity-75 bg-muted/30" : ""}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    {template.isArchived && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
                        Archived
                      </span>
                    )}
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                      {template.numQuestions} Questions
                    </span>
                  </div>
                </div>

                <h3 className="font-semibold text-foreground mb-2">
                  {template.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                  {template.description || "No description"}
                </p>

                {/* Created/Updated info */}
                <div className="text-xs text-muted-foreground mb-4">
                  {template.createdAt && (
                    <span>Created: {formatDate(template.createdAt)}</span>
                  )}
                  {template.updatedAt && (
                    <span className="ml-2">
                      • Updated: {formatDate(template.updatedAt)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Choices:</span>
                    <span>
                      A-{String.fromCharCode(64 + template.choicesPerQuestion)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Items:</span>
                    <span>{template.numQuestions}</span>
                  </div>
                </div>

                {/* Show linked class/exam */}
                {(template.className || template.examName) && (
                  <div className="mb-4 p-2 bg-blue-50 rounded text-xs space-y-1">
                    {template.className && (
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-blue-700">
                          Class:
                        </span>
                        <span className="text-blue-600">
                          {template.className}
                        </span>
                      </div>
                    )}
                    {template.examName && (
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-blue-700">Exam:</span>
                        <span className="text-blue-600">
                          {template.examName}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handlePreview(template)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Preview
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleDownload(template)}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                </div>

                {/* Archive/Restore Buttons */}
                <div className="flex gap-2">
                  {!template.isArchived ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      onClick={() => confirmArchive(template)}
                    >
                      <Archive className="w-4 h-4 mr-1" />
                      Archive
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => handleRestore(template)}
                      >
                        <Archive className="w-4 h-4 mr-1" />
                        Restore
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => confirmDelete(template)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ),
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Template Preview: {previewTemplate?.name}</DialogTitle>
            <DialogDescription>
              Preview of how the answer sheet will look when printed (A4 size)
            </DialogDescription>
          </DialogHeader>

          <div
            className="border rounded-lg p-4 bg-gray-200 overflow-auto"
            style={{ maxHeight: "65vh" }}
          >
            {previewTemplate &&
              (() => {
                const numQ = previewTemplate.numQuestions;
                const numC = previewTemplate.choicesPerQuestion;
                const choiceLetters = ["A", "B", "C", "D", "E"].slice(0, numC);

                // Reusable: question block component
                const QBlock = ({
                  startQ,
                  endQ,
                }: {
                  startQ: number;
                  endQ: number;
                }) => (
                  <div>
                    {/* Header: ■ A B C D */}
                    <div className="flex items-center gap-[2px] mb-[2px]">
                      <div className="w-[6px] h-[6px] bg-black flex-shrink-0"></div>
                      <div className="w-[14px]"></div>
                      {choiceLetters.map((c) => (
                        <div
                          key={c}
                          className="w-[10px] text-center text-[6px] font-bold leading-none"
                        >
                          {c}
                        </div>
                      ))}
                    </div>
                    {/* Rows */}
                    {Array.from({ length: endQ - startQ + 1 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-[2px] mb-[1px]"
                      >
                        <div className="w-[6px]"></div>
                        <div className="w-[14px] text-right text-[6px] font-bold leading-none pr-[2px]">
                          {startQ + i}
                        </div>
                        {choiceLetters.map((_, j) => (
                          <div
                            key={j}
                            className="w-[10px] h-[10px] rounded-full border border-gray-800 bg-white flex-shrink-0"
                          ></div>
                        ))}
                      </div>
                    ))}
                  </div>
                );

                // Reusable: ID section
                const IdSection = ({ small }: { small?: boolean }) => (
                  <div
                    className={`border border-black ${small ? "p-1" : "p-1.5"}`}
                  >
                    <div
                      className={`${small ? "text-[6px]" : "text-[7px]"} font-bold mb-0.5`}
                    >
                      Student ZipGrade ID
                    </div>
                    {/* Input boxes */}
                    <div className="flex gap-[2px] mb-[2px]">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div
                          key={i}
                          className={`${small ? "w-[8px] h-[7px]" : "w-[10px] h-[8px]"} border border-black`}
                        ></div>
                      ))}
                    </div>
                    {/* Bubble grid */}
                    <div className="flex gap-[1px] items-start">
                      <div className="flex flex-col">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                          <div
                            key={n}
                            className={`${small ? "h-[8px] text-[5px]" : "h-[10px] text-[6px]"} flex items-center font-bold w-[8px] justify-end pr-[1px]`}
                          >
                            {n}
                          </div>
                        ))}
                      </div>
                      {Array.from({ length: 10 }).map((_, col) => (
                        <div key={col} className="flex flex-col">
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((row) => (
                            <div
                              key={row}
                              className={`${small ? "w-[7px] h-[7px] m-[0.5px]" : "w-[9px] h-[9px] m-[0.5px]"} rounded-full border border-gray-800 bg-white`}
                            ></div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                );

                // Reusable: mini sheet (for 20Q and 50Q)
                const MiniSheet = ({
                  questions,
                  sheetW,
                  sheetH,
                }: {
                  questions: number;
                  sheetW: string;
                  sheetH: string;
                }) => (
                  <div
                    className="bg-white border border-black relative"
                    style={{ width: sheetW, height: sheetH, padding: "6px" }}
                  >
                    {/* Corner markers */}
                    <div className="absolute top-[4px] left-[4px] w-[5px] h-[5px] bg-black"></div>
                    <div className="absolute top-[4px] right-[4px] w-[5px] h-[5px] bg-black"></div>
                    <div className="absolute bottom-[4px] left-[4px] w-[5px] h-[5px] bg-black"></div>
                    <div className="absolute bottom-[4px] right-[4px] w-[5px] h-[5px] bg-black"></div>

                    {/* Header */}
                    <div className="flex items-center justify-center gap-1 mb-1">
                      {branding?.logoUrl ? (
                        <img
                          src={branding.logoUrl}
                          className="w-[10px] h-[10px] object-contain"
                          alt="logo"
                        />
                      ) : (
                        <div className="w-[10px] h-[10px] bg-green-700 rounded-full flex items-center justify-center text-white text-[5px] font-bold">
                          G
                        </div>
                      )}
                      <span className="text-[7px] font-bold">
                        {branding?.institutionName || "Gordon College"}
                      </span>
                    </div>

                    {/* Name/Date */}
                    <div className="flex gap-1 mb-1 text-[5px]">
                      <div className="flex-1">
                        <span className="font-semibold">Name:</span>
                        <div className="border-b border-black mt-[1px]"></div>
                      </div>
                      <div className="flex-1">
                        <span className="font-semibold">Date:</span>
                        <div className="border-b border-black mt-[1px]"></div>
                      </div>
                    </div>

                    {/* ID Section */}
                    <div className="mb-1">
                      <IdSection small />
                    </div>

                    {/* Answer blocks */}
                    {questions === 20 ? (
                      <div className="flex gap-2 mt-1">
                        <QBlock startQ={1} endQ={10} />
                        <QBlock startQ={11} endQ={20} />
                      </div>
                    ) : (
                      <div className="flex gap-1 mt-1">
                        <div className="space-y-1">
                          <QBlock startQ={1} endQ={10} />
                          <QBlock startQ={11} endQ={20} />
                          <QBlock startQ={21} endQ={30} />
                        </div>
                        <div className="space-y-1">
                          <QBlock startQ={31} endQ={40} />
                          <QBlock startQ={41} endQ={50} />
                        </div>
                      </div>
                    )}
                  </div>
                );

                if (numQ === 20) {
                  // 20Q: 4 mini sheets in 2x2 grid
                  return (
                    <div
                      className="mx-auto bg-white border border-gray-400 shadow-lg"
                      style={{
                        width: "420px",
                        aspectRatio: "210/297",
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gridTemplateRows: "1fr 1fr",
                      }}
                    >
                      <MiniSheet questions={20} sheetW="100%" sheetH="100%" />
                      <MiniSheet questions={20} sheetW="100%" sheetH="100%" />
                      <MiniSheet questions={20} sheetW="100%" sheetH="100%" />
                      <MiniSheet questions={20} sheetW="100%" sheetH="100%" />
                    </div>
                  );
                } else if (numQ === 50) {
                  // 50Q: 2 side by side
                  return (
                    <div
                      className="mx-auto bg-white border border-gray-400 shadow-lg"
                      style={{
                        width: "420px",
                        aspectRatio: "210/297",
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                      }}
                    >
                      <MiniSheet questions={50} sheetW="100%" sheetH="100%" />
                      <MiniSheet questions={50} sheetW="100%" sheetH="100%" />
                    </div>
                  );
                } else {
                  // 100Q: Full page
                  return (
                    <div
                      className="mx-auto bg-white border border-gray-400 shadow-lg relative"
                      style={{
                        width: "420px",
                        aspectRatio: "210/297",
                        padding: "10px",
                      }}
                    >
                      {/* Corner markers */}
                      <div className="absolute top-[4px] left-[4px] w-[8px] h-[8px] bg-black"></div>
                      <div className="absolute top-[4px] right-[4px] w-[8px] h-[8px] bg-black"></div>
                      <div className="absolute bottom-[4px] left-[4px] w-[8px] h-[8px] bg-black"></div>
                      <div className="absolute bottom-[4px] right-[4px] w-[8px] h-[8px] bg-black"></div>

                      {/* Header */}
                      <div className="flex items-center justify-center gap-1.5 mb-1.5">
                        {branding?.logoUrl ? (
                          <img
                            src={branding.logoUrl}
                            className="w-[14px] h-[14px] object-contain"
                            alt="logo"
                          />
                        ) : (
                          <div className="w-[14px] h-[14px] bg-green-700 rounded-full flex items-center justify-center text-white text-[7px] font-bold">
                            G
                          </div>
                        )}
                        <span className="text-[11px] font-bold">
                          {branding?.institutionName || "Gordon College"}
                        </span>
                      </div>

                      {/* Name/Date */}
                      <div className="flex gap-3 mb-2 text-[7px]">
                        <div className="flex-[3]">
                          <span className="font-bold">Name:</span>
                          <div className="border-b border-black mt-[1px] ml-1"></div>
                        </div>
                        <div className="flex-[2]">
                          <span className="font-bold">Date:</span>
                          <div className="border-b border-black mt-[1px] ml-1"></div>
                        </div>
                      </div>

                      {/* Top section: ID + Q41-50 + Q71-80 */}
                      <div className="flex gap-2 mb-2 items-start">
                        <div className="flex-shrink-0">
                          <IdSection />
                        </div>
                        <div className="flex gap-2 mt-3">
                          <QBlock startQ={41} endQ={50} />
                          <QBlock startQ={71} endQ={80} />
                        </div>
                      </div>

                      {/* Bottom: 4 cols x 2 rows */}
                      <div className="flex gap-2 mb-1">
                        <QBlock startQ={1} endQ={10} />
                        <QBlock startQ={21} endQ={30} />
                        <QBlock startQ={51} endQ={60} />
                        <QBlock startQ={81} endQ={90} />
                      </div>
                      <div className="flex gap-2">
                        <QBlock startQ={11} endQ={20} />
                        <QBlock startQ={31} endQ={40} />
                        <QBlock startQ={61} endQ={70} />
                        <QBlock startQ={91} endQ={100} />
                      </div>

                      {/* Footer */}
                      <div className="absolute bottom-[6px] left-0 right-0 text-center text-[5px] text-gray-500 italic">
                        Do not fold, staple, or tear this answer sheet.
                      </div>
                    </div>
                  );
                }
              })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
            <Button
              onClick={() => previewTemplate && handleDownload(previewTemplate)}
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>&quot;{templateToDelete?.name}&quot;</strong>? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-amber-600">
              Archive Template
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to archive{" "}
              <strong>&quot;{templateToArchive?.name}&quot;</strong>? You can
              restore it later from the archived templates view.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowArchiveDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleArchive}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Archive className="w-4 h-4 mr-2" />
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Guidelines Card */}
      <Card className="p-6 border bg-blue-50/50">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Template Guidelines
        </h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <span className="text-blue-600 font-bold">•</span>
            <span>
              Templates are automatically created when you create an exam in the
              Exams page
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-600 font-bold">•</span>
            <span>
              Templates include alignment markers (black squares) for optical
              scanning accuracy
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-600 font-bold">•</span>
            <span>
              Student ID section uses bubble format for easy scanning and
              validation
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-600 font-bold">•</span>
            <span>
              Print on standard Letter (8.5" x 11") white paper for best results
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-600 font-bold">•</span>
            <span>
              Instruct students to use #2 pencils and fill bubbles completely
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-600 font-bold">•</span>
            <span>
              Archived templates are preserved for audit purposes and log
              integrity
            </span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
