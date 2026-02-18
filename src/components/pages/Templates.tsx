"use client";

import { Card } from "@/components/ui/card";
import { Download, Eye, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { type ExamTemplate } from "@/services/templateService";
import { BatchService } from "@/services/batchService";
import { generateAnswerSheetPDF } from "@/lib/pdfGenerator";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PDFPreviewModal } from "@/components/scanning/PDFPreviewModal";
import { useAuth } from "@/contexts/AuthContext";

// ... (PRESET_TEMPLATES stays the same)

const PRESET_TEMPLATES: ExamTemplate[] = [
  {
    id: "preset-20",
    name: "20-Item Template",
    description: "Perfect for quizzes and short tests",
    num_items: 20,
    choices_per_item: 4,
    student_id_length: 6,
    createdBy: "system",
    createdAt: new Date(),
  },
  {
    id: "preset-50",
    name: "50-Item Template",
    description: "Ideal for midterm examinations",
    num_items: 50,
    choices_per_item: 4,
    student_id_length: 6,
    createdBy: "system",
    createdAt: new Date(),
  },
  {
    id: "preset-100",
    name: "100-Item Template",
    description: "Comprehensive final exam format",
    num_items: 100,
    choices_per_item: 4,
    student_id_length: 6,
    createdBy: "system",
    createdAt: new Date(),
  },
];

export default function Templates() {
  const { user } = useAuth();
  const [customTemplates, setCustomTemplates] = useState<ExamTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] =
    useState<string>("preset-20");
  const [previewDataUri, setPreviewDataUri] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTitle, setPreviewTitle] = useState("");

  const allTemplates = [...PRESET_TEMPLATES, ...customTemplates];
  const selectedTemplate =
    allTemplates.find((t) => t.id === selectedTemplateId) ||
    PRESET_TEMPLATES[0];

  useEffect(() => {
    // Only fetch common data if needed, but we remove customTemplates logic as requested.
    setCustomTemplates([]);
  }, [user?.id]);

  const [exportingReport, setExportingReport] = useState(false);

  const handleExportReport = async () => {
    if (!user?.id) return;
    try {
      setExportingReport(true);
      const result = await BatchService.getBatchesByUserId(user.id);
      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to fetch batches");
      }

      const batches = result.data;
      if (batches.length === 0) {
        toast.info("No batches found to export");
        return;
      }

      // Generate CSV
      const headers = [
        "ID",
        "Exam Code",
        "Sheet Count",
        "Date",
        "Time",
        "Timezone",
      ];
      const csvRows = [
        headers.join(","),
        ...batches.map((batch) =>
          [
            batch.id,
            batch.examCode,
            batch.sheetCount,
            new Date(batch.timestamp).toLocaleDateString(),
            new Date(batch.timestamp).toLocaleTimeString(),
            Intl.DateTimeFormat().resolvedOptions().timeZone,
          ].join(","),
        ),
      ];

      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `batch_report_${new Date().toISOString().split("T")[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Batch report exported successfully");
    } catch (error) {
      console.error("Error exporting report:", error);
      toast.error("Failed to export batch report");
    } finally {
      setExportingReport(false);
    }
  };

  const handleDownload = async (template: ExamTemplate) => {
    try {
      const dummyExam = {
        id: "template-download",
        title: "",
        subject: "",
        num_items: template.num_items,
        choices_per_item: template.choices_per_item,
        student_id_length: template.student_id_length,
        logoUrl: template.logoUrl,
        examCode: template.examCode,
        created_at: new Date().toISOString(),
        answer_keys: [],
        generated_sheets: [],
      };
      await generateAnswerSheetPDF(dummyExam as any, 1);

      // Log template generation (Task 3.2)
      if (user?.id) {
        await BatchService.recordBatch(
          dummyExam.id,
          dummyExam.examCode || "TEMPLATE",
          1,
          user.id,
        );
      }

      toast.success("Template download started");
    } catch (error) {
      console.error("Error downloading template:", error);
      toast.error("Failed to download template");
    }
  };

  const handlePreview = async (template: ExamTemplate) => {
    try {
      const dummyExam = {
        id: "template-preview",
        title: "",
        subject: "",
        num_items: template.num_items,
        choices_per_item: template.choices_per_item,
        student_id_length: template.student_id_length,
        logoUrl: template.logoUrl,
        examCode: template.examCode,
        created_at: new Date().toISOString(),
        answer_keys: [],
        generated_sheets: [],
      };

      const dataUri = await generateAnswerSheetPDF(dummyExam as any, 1, {
        preview: true,
      });
      if (dataUri) {
        setPreviewDataUri(dataUri as string);
        setPreviewTitle(template.name);
        setShowPreview(true);

        // Log template generation (Task 3.2)
        if (user?.id) {
          await BatchService.recordBatch(
            dummyExam.id,
            dummyExam.examCode || "TEMPLATE_PREVIEW",
            1,
            user.id,
          );
        }
      }
    } catch (error) {
      console.error("Error generating preview:", error);
      toast.error("Failed to generate preview");
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8 bg-[#F9F9F9] min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-[#1A4D2E]">
            Answer Sheet Templates
          </h1>
          <p className="text-muted-foreground text-sm">
            Download the official Gordon College answer sheet templates
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExportReport}
          disabled={exportingReport}
          className="flex items-center gap-2 border-[#1A4D2E] text-[#1A4D2E] hover:bg-[#1A4D2E] hover:text-white transition-colors"
        >
          <FileText className="w-4 h-4" />
          {exportingReport ? "Exporting..." : "Export Batch Report"}
        </Button>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {allTemplates.map((template) => (
          <Card
            key={template.id}
            className={`p-6 bg-white border-2 transition-all cursor-pointer flex flex-col items-center text-center group ${
              selectedTemplateId === template.id
                ? "border-[#1A4D2E] shadow-lg"
                : "border-[#E5E5E5]"
            }`}
            onClick={() => setSelectedTemplateId(template.id!)}
          >
            {/* Refined Thumbnail mimicking actual PDF */}
            <div className="w-full aspect-[3/4] bg-white border border-[#D5CABD] rounded-lg mb-6 flex flex-col p-3 relative overflow-hidden text-[6px] text-left">
              {/* Header Area */}
              <div className="flex justify-between items-start mb-2 border-b pb-1">
                <div className="space-y-0.5">
                  <div className="w-16 h-1 bg-gray-300 rounded-px" />
                  <div className="w-10 h-1 bg-gray-200 rounded-px" />
                </div>
                <div className="flex gap-2">
                  <div className="w-8 h-1 bg-gray-200 rounded-px" />
                  <div className="w-8 h-1 bg-gray-200 rounded-px" />
                </div>
              </div>

              {/* Student ID Area */}
              <div className="mb-3">
                <div className="w-12 h-1 bg-gray-400 mb-1 rounded-px" />
                <div className="flex gap-0.5">
                  {[...Array(template.student_id_length || 6)].map((_, col) => (
                    <div key={col} className="flex flex-col gap-0.5">
                      {[...Array(10)].map((_, i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-[3px] text-gray-300"
                        >
                          {i}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Answers Area */}
              <div className="flex-1 border-t pt-2 overflow-hidden">
                <div className="w-10 h-1 bg-gray-400 mb-2 rounded-px" />
                <div
                  className={`grid gap-x-2 gap-y-1 ${template.num_items > 50 ? "grid-cols-4" : template.num_items > 25 ? "grid-cols-3" : "grid-cols-2"}`}
                >
                  {[...Array(Math.min(template.num_items, 40))].map((_, i) => (
                    <div key={i} className="flex items-center gap-0.5">
                      <span className="w-2 font-mono text-gray-400">
                        {i + 1}
                      </span>
                      <div className="flex gap-0.5">
                        {[...Array(template.choices_per_item)].map((_, j) => (
                          <div
                            key={j}
                            className="w-1.5 h-1.5 rounded-full border border-gray-300 flex items-center justify-center text-[3px] text-gray-400"
                          >
                            {String.fromCharCode(65 + j)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {template.num_items > 40 && (
                  <div className="mt-1 text-center text-gray-400 italic">
                    and {template.num_items - 40} more...
                  </div>
                )}
              </div>

              {selectedTemplateId === template.id && (
                <div className="absolute inset-0 bg-[#1A4D2E]/5 rounded-lg border-2 border-[#1A4D2E]/30" />
              )}

              {/* Overlay Label */}
              <div className="absolute top-2 right-2 bg-[#1A4D2E]/90 text-white px-1.5 py-0.5 rounded text-[8px] font-bold shadow-sm">
                {template.num_items} ITEMS
              </div>
            </div>

            <h3 className="text-lg font-bold text-[#1A4D2E] mb-2">
              {template.name}
            </h3>
            <p className="text-xs text-muted-foreground mb-6 h-8 line-clamp-2">
              {template.description}
            </p>

            <div className="flex gap-2 w-full mt-auto">
              <Button
                variant="outline"
                className="flex-1 text-[#1A4D2E] border-[#D1D1D1] hover:bg-gray-50 text-xs font-bold"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreview(template);
                }}
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
              <Button
                className="flex-1 bg-[#1A4D2E] hover:bg-[#143D24] text-white text-xs font-bold"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(template);
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Template Configuration */}
      <Card className="p-8 border-none bg-white shadow-sm">
        <h2 className="text-xl font-bold text-[#1A4D2E] mb-6">
          Template Configuration
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Left Column: Number of Questions */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#1A4D2E]">
              Number of Questions
            </h3>
            <div className="flex items-center gap-4">
              <div className="px-6 py-2 bg-gray-50 border rounded-md font-bold text-lg text-[#1A4D2E]">
                {selectedTemplate.num_items}
              </div>
              <span className="text-sm text-muted-foreground italic">
                Questions will be formatted in{" "}
                {selectedTemplate.num_items > 50 ? "3 columns" : "2 columns"}
              </span>
            </div>
          </div>

          {/* Right Column: Answer Options */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#1A4D2E]">Answer Options</h3>
            <div className="flex items-center gap-2">
              {[...Array(selectedTemplate.choices_per_item)].map((_, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full border-2 border-[#1A4D2E] flex items-center justify-center text-xs font-bold text-[#1A4D2E]"
                >
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
              <span className="ml-4 text-sm text-muted-foreground">
                Multiple Choice (A-
                {String.fromCharCode(64 + selectedTemplate.choices_per_item)})
              </span>
            </div>
          </div>
        </div>

        {/* Branding toggle / Info if custom */}
        {selectedTemplate.logoUrl && (
          <div className="mt-8 pt-8 border-t flex items-center gap-4 text-sm">
            <span className="font-bold text-[#1A4D2E]">Included branding:</span>
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              School Logo
            </div>
            {selectedTemplate.examCode && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                {selectedTemplate.examCode}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* PDF Preview Modal */}
      <PDFPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        pdfDataUri={previewDataUri}
        onDownload={() => {
          handleDownload(selectedTemplate);
          setShowPreview(false);
        }}
        title={previewTitle}
      />
    </div>
  );
}
