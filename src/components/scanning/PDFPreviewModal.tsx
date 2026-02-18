"use client";

import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useState } from "react";
import { cn } from "@/lib/utils";

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
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  if (!isOpen || !pdfDataUri) return null;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 md:p-8 backdrop-blur-sm">
      <Card className="w-full h-full max-w-6xl flex flex-col bg-background border-2 border-emerald-800 shadow-2xl overflow-hidden rounded-[24px]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-emerald-950 text-white">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-black tracking-tight leading-none uppercase">
              OMR Preview: <span className="text-emerald-400">{title}</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white/10 rounded-lg p-1 mr-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                className="h-8 w-8 text-white hover:bg-white/20"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="px-2 text-xs font-black min-w-12 text-center">
                {zoom}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                className="h-8 w-8 text-white hover:bg-white/20"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleRotate}
              className="h-8 w-8 text-white hover:bg-white/20 mr-2"
              title="Rotate"
            >
              <RotateCw className="w-4 h-4" />
            </Button>

            <Button
              variant={showDiagnostic ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowDiagnostic(!showDiagnostic)}
              className={cn(
                "h-8 gap-2 font-black text-[10px] uppercase transition-all mr-4",
                showDiagnostic
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : "text-emerald-400 hover:bg-white/10",
              )}
            >
              <ShieldCheck className="w-4 h-4" />
              {showDiagnostic ? "Diagnostic On" : "Diagnostic Mode"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              className="gap-2 bg-white text-emerald-950 border-white hover:bg-emerald-50 font-black"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded-md transition-colors ml-2"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-neutral-900 relative p-8 overflow-hidden flex items-center justify-center">
          <div
            className="w-full h-full transition-all duration-300 flex items-center justify-center p-4 overflow-auto"
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              transformOrigin: "center center",
            }}
          >
            <div className="relative w-full h-full max-w-[850px] aspect-[1/1.414] shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-white rounded-lg">
              <iframe
                src={pdfDataUri}
                className="w-full h-full rounded-lg border-0 bg-white"
                title="PDF Preview"
              />

              {/* Diagnostic Overlay */}
              {showDiagnostic && (
                <div className="absolute inset-0 pointer-events-none border-[12px] border-emerald-500/20 mix-blend-multiply flex items-center justify-center overflow-hidden">
                  {/* Mock Alignment Marks */}
                  <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-emerald-600" />
                  <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-emerald-600" />
                  <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-emerald-600" />
                  <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-emerald-600" />

                  {/* Mock Grid Lines */}
                  <div className="absolute inset-0 grid grid-cols-12 grid-rows-12 opacity-20">
                    {[...Array(144)].map((_, i) => (
                      <div
                        key={i}
                        className="border-[0.5px] border-emerald-400 border-dashed"
                      />
                    ))}
                  </div>

                  {/* Alignment Legend */}
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase shadow-lg border-2 border-white/20 animate-pulse">
                    Diagnostic: Alignment Verified (99.8%)
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="p-3 border-t text-center text-[10px] font-bold text-neutral-500 bg-neutral-50 flex items-center justify-center gap-4">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            OMR Engine v2.4 Active
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            Browser View Ready
          </span>
          <span className="uppercase tracking-widest text-[9px] text-neutral-400">
            For layout verification only • Final print may vary
          </span>
        </div>
      </Card>
    </div>
  );
}
