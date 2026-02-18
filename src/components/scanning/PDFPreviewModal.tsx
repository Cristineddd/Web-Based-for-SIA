"use client";

import { Card } from "@/components/ui/card";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfDataUri: string | null;
  onDownload: () => void;
  title: string;
}

export function PDFPreviewModal({
  isOpen,
  onClose,
  pdfDataUri,
  onDownload,
  title,
}: PDFPreviewModalProps) {
  if (!isOpen || !pdfDataUri) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 md:p-8">
      <Card className="w-full h-full max-w-5xl flex flex-col bg-background border-2 border-primary overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/50">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-foreground">
              Preview: {title}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-background rounded-md transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-muted relative p-4 overflow-auto flex items-center justify-center">
          <iframe
            src={pdfDataUri}
            className="w-full h-full rounded-sm border shadow-lg bg-white"
            title="PDF Preview"
          />
        </div>

        {/* Footer info */}
        <div className="p-3 border-t text-center text-xs text-muted-foreground bg-muted/30">
          This is a preview representation of the final answer sheet. Alignment
          may vary slightly on certain browsers.
        </div>
      </Card>
    </div>
  );
}
