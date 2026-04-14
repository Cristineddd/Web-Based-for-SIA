'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  X,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Save,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getExamById, Exam } from '@/services/examService';
import { AnswerKeyService } from '@/services/answerKeyService';
import { ScanningService } from '@/services/scanningService';
import { getClassById, getClasses, Class, Student } from '@/services/classService';
import { toast } from 'sonner';
import { BackButton } from '@/components/ui/BackButton';
import { AnswerChoice } from '@/types/scanning';
import { consumePendingImage } from '@/lib/omrImageStore';

interface OMRScannerProps {
  examId: string;
}

interface ScanResult {
  studentId: string;
  answers: string[];
  score: number;
  totalQuestions: number;
  percentage: number;
  letterGrade: string;
  timestamp: string;
}

export default function OMRScanner({ examId }: OMRScannerProps) {
  const { user } = useAuth();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement>(null);
  const autoScanTimerRef = useRef<number | null>(null);
  const isAutoCapturingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const fileUploadRef = useRef<HTMLInputElement>(null);
  
  // State
  const [exam, setExam] = useState<Exam | null>(null);
  const [answerKey, setAnswerKey] = useState<AnswerChoice[]>([]);
  const [classData, setClassData] = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'camera' | 'processing' | 'results'>('camera');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [, setProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [detectedAnswers, setDetectedAnswers] = useState<string[]>([]);
  const [detectedStudentId, setDetectedStudentId] = useState<string>('');
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);
  const [studentIdError, setStudentIdError] = useState<string | null>(null);
  const [multipleAnswerQuestions, setMultipleAnswerQuestions] = useState<number[]>([]);
  const [idDoubleShadeColumns, setIdDoubleShadeColumns] = useState<number[]>([]);
  const [rawIdDigits, setRawIdDigits] = useState<number[]>([]); // Raw digit array (-1 = unshaded)
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [markersDetected, setMarkersDetected] = useState(false);
  const [stabilizationProgress, setStabilizationProgress] = useState(0); // 0-100%
  const [alignmentError, setAlignmentError] = useState<string | null>(null);
  const liveOverlayRef = useRef<HTMLCanvasElement>(null);

  // 200-item two-pass scanning state
  const [scanPage, setScanPage] = useState<1 | 2>(1);
  const [page1Answers, setPage1Answers] = useState<string[]>([]);
  const [page1StudentId, setPage1StudentId] = useState<string>('');

  // Keep streamRef in sync with stream state
  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  // Load exam data
  useEffect(() => {
    async function loadExamData() {
      try {
        setLoading(true);
        const examData = await getExamById(examId);
        if (examData) {
          setExam(examData);
          
          // Load answer key
          const akResult = await AnswerKeyService.getAnswerKeyByExamId(examId);
          if (akResult.success && akResult.data) {
            setAnswerKey(akResult.data.answers);
          }
          
          // Load class data if exam has classId
          if ((examData as any).classId) {
            const cls = await getClassById((examData as any).classId);
            if (cls) {
              setClassData(cls);
            }
          }
          
          // Fallback: if no classId but has className, try to find class by name
          if (!(examData as any).classId && examData.className && user) {
            try {
              const allClasses = await getClasses(user.id);
              const matchedClass = allClasses.find(c => 
                c.class_name === examData.className || 
                `${c.class_name} - ${c.course_subject}${c.year ? ` ${c.year}` : ''}` === examData.className
              );
              if (matchedClass) {
                setClassData(matchedClass);
              }
            } catch (e) {
              console.warn('Could not find class by name:', e);
            }
          }
        }

        // Check for a pre-uploaded image (from ExamDetails upload button)
        const pendingUpload = consumePendingImage();
        if (pendingUpload) {
          setCapturedImage(pendingUpload);
          setMode('processing');
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error('Error loading exam:', error);
        toast.error('Failed to load exam data');
      } finally {
        setLoading(false);
      }
    }
    
    loadExamData();
  }, [examId]);

  // Auto-start camera when exam data is loaded
  useEffect(() => {
    if (!loading && exam && !stream && mode === 'camera') {
      startCamera();
    }
  }, [loading, exam]);

  // Cleanup camera and auto-scan on unmount
  useEffect(() => {
    return () => {
      if (autoScanTimerRef.current) {
        cancelAnimationFrame(autoScanTimerRef.current);
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Update video when stream changes
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(err => {
          console.error('Error playing video:', err);
        });
      };
    }
  }, [stream]);

  // Get the template type from question count
  const getTemplateType = (): 20 | 50 | 100 | 150 | 200 => {
    const numQ = exam?.num_items || 20;
    return numQ <= 20 ? 20 : numQ <= 50 ? 50 : numQ <= 100 ? 100 : numQ <= 150 ? 150 : 200;
  };

  // Start camera
  const startCamera = async () => {
    try {
      const templateType = getTemplateType();
      // Use higher resolution for larger templates with more dense bubbles
      const constraints: MediaTrackConstraints = templateType === 20
        ? { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
        : templateType === 50
        ? { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
        : (templateType === 100 || templateType === 150)
        ? { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
        : { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } };

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: constraints
      });
      
      setStream(mediaStream);
      setMode('camera');
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // Ensure video plays when metadata is loaded
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(err => {
            console.error('Error playing video:', err);
            toast.error('Could not start video playback');
          });
        };
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Could not access camera. Please check permissions.');
    }
  };

  // Stop camera and go back to exam page
  const stopCamera = () => {
    if (autoScanTimerRef.current) {
      cancelAnimationFrame(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    }
    isAutoCapturingRef.current = false;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCapturedImage(null);
    router.push(`/exams/${examId}`);
  };

  // Get the guide frame crop region as fractions of the video dimensions
  const getGuideCropRegion = (videoWidth: number, videoHeight: number): { x: number; y: number; w: number; h: number } => {
    const t = getTemplateType();
    // Paper aspect ratio (width / height):
    // - 20-item: quarter-page portrait → 105mm / 148.5mm
    // - 50-item: half-page landscape → 210mm / 148.5mm
    // - 100/150/200-item: full-page portrait → 210mm / 297mm
    const paperAspect = (t === 100 || t === 150 || t === 200) ? (210 / 297) : t === 20 ? (105 / 148.5) : (210 / 148.5);

    // Match the canvas overlay PAD=0.12 → fit inside 76% of each dimension
    const maxWfrac = 0.76;
    const maxHfrac = 0.76;

    // Fit aspect ratio inside the available box
    let guideW = maxWfrac;
    let guideH = guideW / (paperAspect * (videoWidth / videoHeight)); // in video-height fractions... recalc below

    // Work in pixel space then convert back to fractions
    const maxWpx = videoWidth * maxWfrac;
    const maxHpx = videoHeight * maxHfrac;
    let gwPx = maxWpx;
    let ghPx = gwPx / paperAspect;
    if (ghPx > maxHpx) {
      ghPx = maxHpx;
      gwPx = ghPx * paperAspect;
    }

    guideW = gwPx / videoWidth;
    guideH = ghPx / videoHeight;

    const x = (1 - guideW) / 2;
    const y = (1 - guideH) / 2;

    return { x, y, w: guideW, h: guideH };
  };

  // Capture photo from camera — cropped to the guide frame, then auto-process
  const captureAndProcess = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    if (isAutoCapturingRef.current) return; // prevent double-capture
    isAutoCapturingRef.current = true;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) { isAutoCapturingRef.current = false; return; }
    
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    
    // Calculate the crop region matching the guide overlay
    const crop = getGuideCropRegion(vw, vh);
    const sx = Math.round(crop.x * vw);
    const sy = Math.round(crop.y * vh);
    const sw = Math.round(crop.w * vw);
    const sh = Math.round(crop.h * vh);
    
    // Set canvas to the cropped size
    canvas.width = sw;
    canvas.height = sh;
    
    // Draw only the cropped region
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
    
    console.log(`[AutoCapture] Video: ${vw}x${vh}, Crop: x=${sx} y=${sy} w=${sw} h=${sh} (template=${getTemplateType()})`);
    
    const imageData = canvas.toDataURL('image/png');
    setCapturedImage(imageData);
    
    // Stop camera after capture — use streamRef for latest value
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    // Go directly to processing (skip review)
    setMode('processing');
  }, [exam]); // removed stream dependency — use ref instead

  // ── Lightweight marker detection for live video frames ──
  // Runs on a downscaled version of the guide-frame crop.
  // Uses an integral image for fast region averages and a stricter
  // uniformity + contrast check to reduce false positives.
  // Returns true if 4 dark squares are found in approximately the right positions.
  const detectMarkersInFrame = useCallback((): { found: boolean; markers: { tl:{x:number;y:number}; tr:{x:number;y:number}; bl:{x:number;y:number}; br:{x:number;y:number} } | null } => {
    if (!videoRef.current || !scanCanvasRef.current) return { found: false, markers: null };
    
    const video = videoRef.current;
    if (video.readyState < 2) return { found: false, markers: null }; // HAVE_CURRENT_DATA
    if (video.videoWidth === 0 || video.videoHeight === 0) return { found: false, markers: null };
    
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const crop = getGuideCropRegion(vw, vh);
    
    const scanCanvas = scanCanvasRef.current;
    const ctx = scanCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { found: false, markers: null };
    
    // Use 640px wide for better accuracy (increased from 480px)
    const targetW = 640;
    const scale = targetW / (crop.w * vw);
    const dw = Math.round(crop.w * vw * scale);
    const dh = Math.round(crop.h * vh * scale);

    
    scanCanvas.width = dw;
    scanCanvas.height = dh;
    
    ctx.drawImage(
      video,
      Math.round(crop.x * vw), Math.round(crop.y * vh),
      Math.round(crop.w * vw), Math.round(crop.h * vh),
      0, 0, dw, dh
    );
    
    const imgData = ctx.getImageData(0, 0, dw, dh);
    const pixels = imgData.data;
    
    // Convert to grayscale
    const gray = new Uint8Array(dw * dh);
    for (let i = 0; i < dw * dh; i++) {
      const idx = i * 4;
      gray[i] = Math.round(pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114);
    }

    // ── Build integral image for O(1) rectangular averages ──
    const integral = new Float32Array((dw + 1) * (dh + 1));
    for (let y = 0; y < dh; y++) {
      let rowSum = 0;
      for (let x = 0; x < dw; x++) {
        rowSum += gray[y * dw + x];
        integral[(y + 1) * (dw + 1) + (x + 1)] = integral[y * (dw + 1) + (x + 1)] + rowSum;
      }
    }
    const rectAvgLive = (x1: number, y1: number, x2: number, y2: number): number => {
      x1 = Math.max(0, Math.floor(x1)); y1 = Math.max(0, Math.floor(y1));
      x2 = Math.min(dw, Math.floor(x2)); y2 = Math.min(dh, Math.floor(y2));
      const area = (x2 - x1) * (y2 - y1);
      if (area <= 0) return 255;
      const sum = integral[y2 * (dw + 1) + x2] - integral[y1 * (dw + 1) + x2]
                - integral[y2 * (dw + 1) + x1] + integral[y1 * (dw + 1) + x1];
      return sum / area;
    };

    // Adaptive threshold: normalize global brightness to handle dark/bright scenes
    const globalBrightness = rectAvgLive(0, 0, dw, dh);
    // A "dark enough" marker: below 80% of global brightness (extremely relaxed for mobile)
    const darkThreshold = Math.min(160, globalBrightness * 0.80);

    // Get template type first
    const t = getTemplateType();
    
    // Marker size varies by template:
    // - 50/20-item (half-page): 8mm on 210mm paper → 3.8% of width
    // - 100/150-item (full-page): 8mm on 210mm paper → 3.8% of width
    const markerPct = t === 100 || t === 150 ? 0.038 : 0.038;
    const markerSize = Math.max(10, Math.round(dw * markerPct));
    const half = Math.floor(markerSize / 2);
    // Use fine step (1/3 of marker size) for better sub-pixel coverage
    const step = Math.max(2, Math.floor(markerSize / 3));
    
    // Search windows match the exact marker positions from templatePdfGenerator:
    //   50-item: half-page 210×148.5mm, markers at corners with 2mm inset
    //     topY ≈ 2/148.5 = 1.35%, bottomY ≈ 138.5/148.5 = 93.3%
    //   20-item: half-page 210×148.5mm, same positions
    //   100-item: full-page 210×297mm, topY ≈ 2/297 = 0.67%, bottomY ≈ 287/297 = 96.6%
    //   150-item: full-page 210×297mm, same positions as 100
    // X margins: markers at 2mm (0.95%) and 200mm (95.2%) from 210mm width
    let marginX: number, topH: number, botY1: number, botY2: number;
    if (t === 100 || t === 150 || t === 200) {
      // Full-page templates
      marginX = Math.round(dw * 0.25);  // search 0-25% and 75-100%
      topH    = Math.round(dh * 0.18);  // search 0-18% to cover 0.67%
      botY1   = Math.round(dh * 0.88);  // search 88-100% to cover 96.6%
      botY2   = dh;
    } else if (t === 50 || t === 20) {
      // Half-page templates (both have same marker positions)
      marginX = Math.round(dw * 0.25);  // search 0-25% and 75-100%
      topH    = Math.round(dh * 0.18);  // search 0-18% to cover 1.35%
      botY1   = Math.round(dh * 0.82);  // search 82-100% to cover 93.3%
      botY2   = dh;
    } else {
      // Fallback
      marginX = Math.round(dw * 0.25);
      topH    = Math.round(dh * 0.20);
      botY1   = Math.round(dh * 0.75);
      botY2   = dh;
    }
    
    const cornerRegions = [
      { name: 'TL', x1: 0,            y1: 0,    x2: marginX,      y2: topH },
      { name: 'TR', x1: dw - marginX, y1: 0,    x2: dw,           y2: topH },
      { name: 'BL', x1: 0,            y1: botY1, x2: marginX,     y2: botY2 },
      { name: 'BR', x1: dw - marginX, y1: botY1, x2: dw,          y2: botY2 },
    ];
    
    let cornersFound = 0;
    const foundCorners: string[] = [];
    // Best pixel position per corner in downscaled-crop space
    const bestPos: Record<string, { cx: number; cy: number }> = {};
    
    for (const region of cornerRegions) {
      let bestContrast = 0;
      let bestCx = (region.x1 + region.x2) / 2;
      let bestCy = (region.y1 + region.y2) / 2;

      for (let cy = region.y1 + half + 2; cy < region.y2 - half - 2; cy += step) {
        for (let cx = region.x1 + half + 2; cx < region.x2 - half - 2; cx += step) {
          // 1. Interior must be dark
          const inner = rectAvgLive(cx - half, cy - half, cx + half, cy + half);
          if (inner > darkThreshold) continue;

          // 2. Uniformity: all 4 quadrants of the marker must be consistently dark
          const q1 = rectAvgLive(cx - half, cy - half, cx, cy);
          const q2 = rectAvgLive(cx,         cy - half, cx + half, cy);
          const q3 = rectAvgLive(cx - half, cy,         cx, cy + half);
          const q4 = rectAvgLive(cx,         cy,         cx + half, cy + half);
          // Extremely relaxed uniformity — just ensure it's roughly consistent
          if (Math.max(q1, q2, q3, q4) - Math.min(q1, q2, q3, q4) > 120) continue;

          // 3. Check surrounding paper brightness (more lenient)
          const ringInner = Math.floor(half * 1.2);
          const ringOuter = Math.floor(half * 2.5);
          const tB = rectAvgLive(cx - ringOuter, cy - ringOuter, cx + ringOuter, cy - ringInner);
          const bB = rectAvgLive(cx - ringOuter, cy + ringInner, cx + ringOuter, cy + ringOuter);
          const lB = rectAvgLive(cx - ringOuter, cy - ringInner, cx - ringInner, cy + ringInner);
          const rB = rectAvgLive(cx + ringInner, cy - ringInner, cx + ringOuter, cy + ringInner);
          
          // Calculate average border brightness
          const borderAvg = (tB + bB + lB + rB) / 4;
          
          // Skip if border isn't brighter than center (not on paper)
          if (borderAvg <= inner) continue;

          // 4. Calculate contrast score
          const contrast = borderAvg - inner;
          
          // Require minimum contrast of 10 (extremely relaxed)
          if (contrast < 10) continue;
          
          if (contrast > bestContrast) {
            bestContrast = contrast;
            bestCx = cx;
            bestCy = cy;
          }
        }
      }

      // Extremely relaxed contrast threshold for live detection
      if (bestContrast > 10) {
        cornersFound++;
        foundCorners.push(region.name);
        bestPos[region.name] = { cx: bestCx, cy: bestCy };
      }
    }
    
    // Log EVERY frame for troubleshooting until detection works
    if (Math.random() < 0.3) {
      console.log(`[LiveScan] ${dw}x${dh} t=${t} found=${foundCorners.join(',') || 'none'} (${cornersFound}/4) markerSize=${markerSize} darkTh=${darkThreshold.toFixed(0)} globalBright=${globalBrightness.toFixed(0)}`);
    }
    
    // Accept 3 out of 4 corners (one may be occluded by finger/shadow)
    const allFound = cornersFound >= 3;

    if (allFound) {
      // Convert best positions from downscaled-crop space → fraction of full video element
      // crop.x/y/w/h are already fractions of the video dimensions
      const toFrac = (cx: number, cy: number) => ({
        x: crop.x + (cx / dw) * crop.w,
        y: crop.y + (cy / dh) * crop.h,
      });
      // For missing corners, estimate from found ones
      const defaultPos = (name: string) => {
        if (bestPos[name]) return bestPos[name];
        // Estimate from template geometry
        const isLeft = name.includes('L');
        const isTop = name.includes('T');
        return { cx: isLeft ? dw * 0.03 : dw * 0.97, cy: isTop ? dh * 0.03 : dh * 0.97 };
      };
      return {
        found: true,
        markers: {
          tl: toFrac(defaultPos('TL').cx, defaultPos('TL').cy),
          tr: toFrac(defaultPos('TR').cx, defaultPos('TR').cy),
          bl: toFrac(defaultPos('BL').cx, defaultPos('BL').cy),
          br: toFrac(defaultPos('BR').cx, defaultPos('BR').cy),
        },
      };
    }
    return { found: false, markers: null };
  }, [exam]);

  // ── Draw guide box overlay onto the canvas ──
  // Called every scan frame so it always reflects the current video layout.
  // Uses getBoundingClientRect() which is reliable even on mobile/h-auto videos.
  const drawOverlay = useCallback(() => {
    const canvas = liveOverlayRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const rect = video.getBoundingClientRect();
    const vw = Math.round(rect.width);
    const vh = Math.round(rect.height);
    if (vw === 0 || vh === 0) return;

    // Only resize the canvas if dimensions changed (avoids flicker)
    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw;
      canvas.height = vh;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, vw, vh);

    // Paper guide area — fit paper aspect ratio centered in the viewport
    const t = getTemplateType();
    const paperAspect = (t === 100 || t === 150 || t === 200) ? 210 / 297 : t === 20 ? 105 / 148.5 : 210 / 148.5;
    const PAD = 0.12;
    const maxW = vw * (1 - PAD * 2);
    const maxH = vh * (1 - PAD * 2);
    let gw = maxW;
    let gh = gw / paperAspect;
    if (gh > maxH) { gh = maxH; gw = gh * paperAspect; }
    const midX = vw / 2;
    const midY = vh / 2;

    const paperLeft = midX - gw / 2;
    const paperTop  = midY - gh / 2;

    // Marker positions as fractions of paper width/height —
    // Derived exactly from templatePdfGenerator.ts drawMiniSheet/drawFullSheet:
    //
    // Mini sheet (20 & 50-item): 210×148.5mm, markerSize=8mm, cornerInset=2mm
    //   X: left center = (2+4)/210 = 2.86%, right center = (200+4)/210 = 97.14%
    //   Y top: (2+4)/148.5 = 4.04%
    //   Y bot: (138.5+4)/148.5 = 95.96%
    //
    // Full sheet (100 & 150-item): 210×297mm, markerSize=8mm, cornerInset=2mm
    //   X: left center = (2+4)/210 = 2.86%, right center = (200+4)/210 = 97.14%
    //   Y top: (2+4)/297 = 2.02%
    //   Y bot: (287+4)/297 = 98.0%
    let mxL: number, mxR: number, myT: number, myB: number;
    if (t === 100 || t === 150 || t === 200) {
      // Full-page: 210x297mm
      mxL = 0.0286; mxR = 0.9714; myT = 0.0202; myB = 0.9798;
    } else if (t === 20) {
      // Quarter-page portrait: 105x148.5mm, marker center at x=6/105=5.71%, y=6/148.5=4.04%
      mxL = 0.0571; mxR = 0.9429; myT = 0.0404; myB = 0.9596;
    } else {
      // Half-page (50): 210x148.5mm
      mxL = 0.0286; mxR = 0.9714; myT = 0.0404; myB = 0.9596;
    }

    const boxSz = Math.round(Math.min(vw, vh) * 0.08);

    const guidePts = [
      { x: paperLeft + gw * mxL, y: paperTop + gh * myT }, // TL
      { x: paperLeft + gw * mxR, y: paperTop + gh * myT }, // TR
      { x: paperLeft + gw * mxL, y: paperTop + gh * myB }, // BL
      { x: paperLeft + gw * mxR, y: paperTop + gh * myB }, // BR
    ];

    // White outer stroke + dark inner stroke for visibility on any background
    ctx.lineWidth = 3;
    for (const p of guidePts) {
      const bx = Math.round(p.x - boxSz / 2);
      const by = Math.round(p.y - boxSz / 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.strokeRect(bx - 1, by - 1, boxSz + 2, boxSz + 2);
      ctx.strokeStyle = 'rgba(20,20,20,0.95)';
      ctx.strokeRect(bx, by, boxSz, boxSz);
    }
  }, [exam]);

  // ── Auto-scan loop: continuously check for markers in the video feed ──
  // For 100-item templates, we only detect markers but don't auto-capture (manual button instead)
  useEffect(() => {
    if (mode !== 'camera' || !stream || !exam) return;
    
    const templateType = getTemplateType();
    
    let frameCount = 0;
    let consecutiveDetections = 0;
    const REQUIRED_CONSECUTIVE = 5; // ~0.8 seconds of stable marker detection (reduced from 8)
    let cancelled = false;
    
    const scanLoop = () => {
      if (cancelled || isAutoCapturingRef.current) return;

      // Always redraw the overlay every frame
      drawOverlay();

      frameCount++;
      // Only run marker detection every 3rd frame (~10fps at 30fps video)
      if (frameCount % 3 === 0) {
        const result = detectMarkersInFrame();
        const detected = result.found;
        
        if (detected && result.markers) {
          consecutiveDetections++;
          setMarkersDetected(true);
          
          // All templates: auto-capture after stable detection
          const progress = Math.min(100, Math.round((consecutiveDetections / REQUIRED_CONSECUTIVE) * 100));
          setStabilizationProgress(progress);
          
          if (consecutiveDetections >= REQUIRED_CONSECUTIVE) {
            console.log(`[AutoScan] Markers stable — capturing! (${templateType}-item)`);
            captureAndProcess();
            return; // stop the loop
          }
        } else {
          consecutiveDetections = 0;
          setMarkersDetected(false);
          setStabilizationProgress(0);
        }
      }
      
      autoScanTimerRef.current = requestAnimationFrame(scanLoop);
    };
    
    // Start scanning after a brief delay to let the camera stabilize
    const startDelay = setTimeout(() => {
      autoScanTimerRef.current = requestAnimationFrame(scanLoop);
    }, 1000);
    
    return () => {
      cancelled = true;
      clearTimeout(startDelay);
      if (autoScanTimerRef.current) {
        cancelAnimationFrame(autoScanTimerRef.current);
        autoScanTimerRef.current = null;
      }
      setMarkersDetected(false);
      setStabilizationProgress(0);
    };
  }, [mode, stream, exam, detectMarkersInFrame, captureAndProcess, drawOverlay]);

  // Detects rotation angle up to ±30° using a weighted Sobel-edge histogram (Hough-inspired).
  // Uses 0.25° bins (241 bins total) for sub-degree accuracy.
  // Only edges with high magnitude vote, and votes are weighted by magnitude so strong
  // long edges (paper boundary, column separators) dominate over noise.
  const detectSkewAngle = (grayscale: Uint8Array, width: number, height: number): number => {
    const BINS = 241;              // –30° to +30° in 0.25° steps
    const CENTER = 120;            // bin index for 0°
    const SCALE = 4;               // bins per degree (1 / 0.25)
    const angleHist = new Float32Array(BINS);
    
    // Sample a grid of points; denser sampling = more accurate but slower.
    // Use ~200 sample rows (capped for large images).
    const step = Math.max(3, Math.floor(Math.min(width, height) / 200));
    // Edge magnitude threshold — only vote for genuinely strong edges (reduces noise)
    const EDGE_THRESH = 40;
    
    for (let y = step; y < height - step; y += step) {
      for (let x = step; x < width - step; x += step) {
        // 3×3 Sobel
        const gx = 
          -grayscale[(y - 1) * width + (x - 1)] - 2 * grayscale[y * width + (x - 1)] - grayscale[(y + 1) * width + (x - 1)] +
           grayscale[(y - 1) * width + (x + 1)] + 2 * grayscale[y * width + (x + 1)] + grayscale[(y + 1) * width + (x + 1)];
        
        const gy = 
          -grayscale[(y - 1) * width + (x - 1)] - 2 * grayscale[(y - 1) * width + x] - grayscale[(y - 1) * width + (x + 1)] +
           grayscale[(y + 1) * width + (x - 1)] + 2 * grayscale[(y + 1) * width + x] + grayscale[(y + 1) * width + (x + 1)];
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        if (magnitude < EDGE_THRESH) continue;
        
        // Derive rotation angle from edge direction
        // Horizontal edges (gy dominant): edge angle ≈ ±90° → paper rotated by (angle − 90°)
        // Vertical edges (gx dominant):  edge angle ≈ 0°/180° → paper rotated by edge angle
        const angle = Math.atan2(gy, gx) * 180 / Math.PI; // –180..+180
        let rotation: number;
        if (Math.abs(gx) >= Math.abs(gy)) {
          // Vertical edge
          rotation = angle;
          if (rotation > 90) rotation -= 180;
          if (rotation < -90) rotation += 180;
        } else {
          // Horizontal edge
          rotation = angle > 0 ? angle - 90 : angle + 90;
        }
        
        if (rotation < -30 || rotation > 30) continue;
        
        const binIdx = Math.round((rotation + 30) * SCALE);
        if (binIdx >= 0 && binIdx < BINS) {
          angleHist[binIdx] += magnitude; // weight by edge strength
        }
      }
    }
    
    // Gaussian-smooth the histogram (σ ≈ 2 bins = 0.5°) then find peak
    const smoothed = new Float32Array(BINS);
    const kernel = [0.06, 0.12, 0.22, 0.40, 0.22, 0.12, 0.06]; // σ≈1.5 bins, sum≈1.2→renorm below
    const kCenter = 3;
    for (let i = 0; i < BINS; i++) {
      let acc = 0;
      for (let k = 0; k < kernel.length; k++) {
        const j = i + k - kCenter;
        if (j >= 0 && j < BINS) acc += angleHist[j] * kernel[k];
      }
      smoothed[i] = acc;
    }

    let maxVal = 0, maxIdx = CENTER;
    for (let i = 0; i < BINS; i++) {
      if (smoothed[i] > maxVal) { maxVal = smoothed[i]; maxIdx = i; }
    }

    // Sub-bin parabolic interpolation for extra precision
    let subBin = maxIdx;
    if (maxIdx > 0 && maxIdx < BINS - 1) {
      const left = smoothed[maxIdx - 1], right = smoothed[maxIdx + 1];
      const denom = left - 2 * maxVal + right;
      if (Math.abs(denom) > 1e-6) subBin = maxIdx - (right - left) / (2 * denom);
    }

    const detectedAngle = (subBin - CENTER) / SCALE;
    
    const totalVotes = angleHist.reduce((a, b) => a + b, 0);
    const peakStrength = maxVal / (totalVotes || 1);
    
    console.log(`[Skew] Detected angle: ${detectedAngle.toFixed(2)}° (peak strength: ${(peakStrength * 100).toFixed(1)}%)`);
    
    // Require a meaningful peak to avoid spurious corrections
    if (peakStrength < 0.04) return 0;
    // Skip imperceptible sub-0.5° rotations (saves a canvas copy operation)
    if (Math.abs(detectedAngle) < 0.5) return 0;
    
    return detectedAngle;
  };

  // Rotate canvas by the given angle (in degrees)
  const rotateCanvas = (srcCanvas: HTMLCanvasElement, angle: number): HTMLCanvasElement => {
    if (Math.abs(angle) < 0.5) return srcCanvas;
    
    const ctx = srcCanvas.getContext('2d');
    if (!ctx) return srcCanvas;
    
    const w = srcCanvas.width;
    const h = srcCanvas.height;
    const rad = angle * Math.PI / 180;
    
    // Calculate new canvas size to fit rotated image
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const newW = Math.ceil(w * cos + h * sin);
    const newH = Math.ceil(w * sin + h * cos);
    
    const outCanvas = document.createElement('canvas');
    outCanvas.width = newW;
    outCanvas.height = newH;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return srcCanvas;
    
    // Fill with white (paper color) to avoid black edges
    outCtx.fillStyle = '#FFFFFF';
    outCtx.fillRect(0, 0, newW, newH);
    
    // Translate to center, rotate, then draw
    outCtx.translate(newW / 2, newH / 2);
    outCtx.rotate(-rad); // Negative to correct the skew
    outCtx.drawImage(srcCanvas, -w / 2, -h / 2);
    
    console.log(`[Skew] Rotated image by ${(-angle).toFixed(1)}° (${w}x${h} → ${newW}x${newH})`);
    
    return outCanvas;
  };

  // Apply skew correction to an image
  const correctSkew = (srcCanvas: HTMLCanvasElement): HTMLCanvasElement => {
    const ctx = srcCanvas.getContext('2d');
    if (!ctx) return srcCanvas;
    
    const w = srcCanvas.width;
    const h = srcCanvas.height;
    
    // Convert to grayscale for skew detection
    const imgData = ctx.getImageData(0, 0, w, h);
    const grayscale = new Uint8Array(w * h);
    for (let i = 0; i < imgData.data.length; i += 4) {
      grayscale[i / 4] = Math.round(
        0.299 * imgData.data[i] + 0.587 * imgData.data[i + 1] + 0.114 * imgData.data[i + 2]
      );
    }
    
    const angle = detectSkewAngle(grayscale, w, h);
    
    if (Math.abs(angle) < 0.5) {
      console.log('[Skew] No significant skew detected (< 0.5°)');
      return srcCanvas;
    }
    
    console.log(`[Skew] Correcting by ${angle.toFixed(2)}°`);
    return rotateCanvas(srcCanvas, angle);
  };

  // ─── IMAGE ENHANCEMENT: Adaptive brightness (white-level normalisation only) ───
  // Scales each pixel so the local paper-white maps to 245.
  //
  // KEY DESIGN DECISIONS to avoid the "blue inversion" artefact:
  //  1. Grid size is 96px — large enough that a tile containing mostly desk
  //     background still borrows the paper-white level from adjacent tiles via
  //     bilinear interpolation, instead of computing a tiny ~40 local white.
  //  2. safeWhite floor is 130 — we never divide by anything < 130, so even a
  //     tile that is 100% dark desk gets at most a 245/130 ≈ 1.88× boost,
  //     which is a gentle brightening rather than a wild 6× amplification.
  //  3. We use GRAYSCALE luminance (not max-channel) for the percentile sample
  //     so that a blue desk doesn't inflate only the blue reference level.
  const enhanceImage = (srcCanvas: HTMLCanvasElement): HTMLCanvasElement => {
    const ctx = srcCanvas.getContext('2d');
    if (!ctx) return srcCanvas;

    const w = srcCanvas.width;
    const h = srcCanvas.height;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = w;
    outCanvas.height = h;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return srcCanvas;
    outCtx.drawImage(srcCanvas, 0, 0);

    const imgData = outCtx.getImageData(0, 0, w, h);
    const d = imgData.data;

    // Build a luminance (grayscale) plane for percentile sampling only.
    // This ensures a blue/coloured background doesn't skew a single channel.
    const lum = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      lum[i] = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
    }

    // Large grid so dark-background tiles get a sensible white level from neighbours
    const gridSize = 96;
    const gW = Math.ceil(w / gridSize);
    const gH = Math.ceil(h / gridSize);
    const gridWhite = new Float32Array(gW * gH);

    for (let gy = 0; gy < gH; gy++) {
      for (let gx = 0; gx < gW; gx++) {
        const samples: number[] = [];
        const y1 = gy * gridSize, y2 = Math.min(h, (gy + 1) * gridSize);
        const x1 = gx * gridSize, x2 = Math.min(w, (gx + 1) * gridSize);
        for (let py = y1; py < y2; py += 3) {
          for (let px = x1; px < x2; px += 3) {
            samples.push(lum[py * w + px]);
          }
        }
        samples.sort((a, b) => a - b);
        // 90th percentile of luminance → local paper-white estimate
        gridWhite[gy * gW + gx] = samples.length > 0
          ? samples[Math.floor(samples.length * 0.90)]
          : 200;
      }
    }

    // Bilinear interpolation across grid cells
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const gxf = px / gridSize - 0.5;
        const gyf = py / gridSize - 0.5;
        const gx0 = Math.max(0, Math.floor(gxf));
        const gy0 = Math.max(0, Math.floor(gyf));
        const gx1 = Math.min(gW - 1, gx0 + 1);
        const gy1 = Math.min(gH - 1, gy0 + 1);
        const fx = Math.max(0, Math.min(1, gxf - gx0));
        const fy = Math.max(0, Math.min(1, gyf - gy0));

        const w00 = gridWhite[gy0 * gW + gx0];
        const w10 = gridWhite[gy0 * gW + gx1];
        const w01 = gridWhite[gy1 * gW + gx0];
        const w11 = gridWhite[gy1 * gW + gx1];
        const localWhite = w00 * (1 - fx) * (1 - fy) + w10 * fx * (1 - fy)
                         + w01 * (1 - fx) * fy        + w11 * fx * fy;

        // Floor at 130: caps boost at ~1.88× even for fully-dark tiles.
        // This prevents the blue-inversion artefact on dark desk backgrounds.
        const safeWhite = Math.max(130, localWhite);
        const scale = 245 / safeWhite;

        const i = (py * w + px) * 4;
        d[i]     = Math.min(255, Math.round(d[i]     * scale));
        d[i + 1] = Math.min(255, Math.round(d[i + 1] * scale));
        d[i + 2] = Math.min(255, Math.round(d[i + 2] * scale));
      }
    }

    outCtx.putImageData(imgData, 0, 0);
    console.log(`[Enhance] Adaptive brightness done: ${w}x${h}, grid=${gridSize}px, safeWhiteFloor=130`);
    return outCanvas;
  };

  // Process the captured image using OMR
  const processImage = useCallback(async () => {
    if (!capturedImage || !exam) return;
    
    setProcessing(true);
    setMode('processing');
    setAlignmentError(null); // Reset alignment error
    
    try {
      // Create an image element
      const img = new Image();
      img.src = capturedImage;
      
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      
      // Use the processing canvas to load the raw image
      const canvas = processingCanvasRef.current;
      if (!canvas) throw new Error('Canvas not available');
      
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      // Step 1: Apply skew correction (handles rotated sheets up to ±30°)
      console.log('[Preprocess] Starting skew correction...');
      const deskewedCanvas = correctSkew(canvas);
      
      // Step 2: Apply adaptive brightness enhancement (handles shadows / uneven lighting)
      console.log('[Enhance] Starting image enhancement...');
      const enhancedCanvas = enhanceImage(deskewedCanvas);
      
      // Update the displayed image with the enhanced version
      setCapturedImage(enhancedCanvas.toDataURL('image/png'));
      
      // Get image data from the enhanced canvas
      const enhCtx = enhancedCanvas.getContext('2d');
      if (!enhCtx) throw new Error('Enhanced canvas context not available');
      const imageData = enhCtx.getImageData(0, 0, enhancedCanvas.width, enhancedCanvas.height);
      
      console.log(`[OMR] Processing enhanced image: ${imageData.width}x${imageData.height}`);
      
      // Process the image to detect filled bubbles
      const { studentId, answers, multipleAnswers, idDoubleShades, rawIdDigits: detectedRawIdDigits, debugMarkers, markersFound, markerConfidence, bubbleHits } = await detectBubbles(imageData, exam.num_items, exam.choices_per_item);
      
      // Check for alignment issues based on marker detection quality
      if (!markersFound || markerConfidence < 0.5) {
        // Marker detection failed or is unreliable
        const missingMarkers = !markersFound;
        const lowConfidence = markerConfidence < 0.5;
        
        let alignmentMsg = 'Sheet alignment error. ';
        if (missingMarkers) {
          alignmentMsg += 'Could not detect all 4 corner markers. ';
        } else if (lowConfidence) {
          alignmentMsg += 'Corner markers were partially obscured or unclear. ';
        }
        alignmentMsg += 'Please ensure the answer sheet is flat, well-lit, and all 4 corner markers are visible. Retake the photo.';
        
        setAlignmentError(alignmentMsg);
        console.log(`[OMR] Alignment error: markersFound=${markersFound} confidence=${markerConfidence?.toFixed(2)}`);
      }
      
      // Build debug info string for UI display
      const dbgLines: string[] = [];
      dbgLines.push(`Image: ${imageData.width}×${imageData.height}`);
      if (debugMarkers) {
        dbgLines.push(`TL=(${Math.round(debugMarkers.topLeft.x)},${Math.round(debugMarkers.topLeft.y)})`);
        dbgLines.push(`TR=(${Math.round(debugMarkers.topRight.x)},${Math.round(debugMarkers.topRight.y)})`);
        dbgLines.push(`BL=(${Math.round(debugMarkers.bottomLeft.x)},${Math.round(debugMarkers.bottomLeft.y)})`);
        dbgLines.push(`BR=(${Math.round(debugMarkers.bottomRight.x)},${Math.round(debugMarkers.bottomRight.y)})`);
        const fw = Math.round(debugMarkers.topRight.x - debugMarkers.topLeft.x);
        const fh2 = Math.round(debugMarkers.bottomLeft.y - debugMarkers.topLeft.y);
        dbgLines.push(`Frame: ${fw}×${fh2}`);
        if (markerConfidence !== undefined) {
          dbgLines.push(`Conf: ${(markerConfidence * 100).toFixed(0)}%`);
        }
        // Show first ID bubble pixel position for verification
        const layout = getTemplateLayout(exam.num_items);
        const firstIdPx = mapToPixel(debugMarkers, layout.id.firstColNX, layout.id.firstRowNY);
        dbgLines.push(`ID0px=(${Math.round(firstIdPx.px)},${Math.round(firstIdPx.py)})`);
      }
      dbgLines.push(`ID=${studentId}`);
      setDebugInfo(dbgLines.join(' | '));
      
      // Draw debug overlay showing detected marker positions and ID bubble sample points
      // ── ZipGrade-style result overlay ──
      // Draw the scanned image, then paint:
      //   • Green border box around each of the 4 detected corner markers
      //   • A circle over every answered bubble: green=correct, red=wrong, yellow=multiple
      if (debugMarkers) {
        const overlayCanvas = document.createElement('canvas');
        overlayCanvas.width = enhancedCanvas.width;
        overlayCanvas.height = enhancedCanvas.height;
        const oCtx = overlayCanvas.getContext('2d');
        if (oCtx) {
          oCtx.drawImage(enhancedCanvas, 0, 0);

          const iw = enhancedCanvas.width;
          const ih = enhancedCanvas.height;
          // Square size ~2.8% of the shorter image dimension
          const boxSize = Math.max(16, Math.round(Math.min(iw, ih) * 0.028));

          // 1. Green squares with dark border at the 4 corner markers (ZipGrade style)
          const corners = [
            debugMarkers.topLeft,
            debugMarkers.topRight,
            debugMarkers.bottomLeft,
            debugMarkers.bottomRight,
          ];
          const border = Math.max(1, Math.round(boxSize * 0.15));
          for (const c of corners) {
            const bx = Math.round(c.x - boxSize / 2);
            const by = Math.round(c.y - boxSize / 2);
            // Dark border
            oCtx.fillStyle = '#15532c';
            oCtx.fillRect(bx - border, by - border, boxSize + border * 2, boxSize + border * 2);
            // Green fill
            oCtx.fillStyle = '#22c55e';
            oCtx.fillRect(bx, by, boxSize, boxSize);
          }

          // 2. Circles over answered bubbles
          const lineW = Math.max(2, Math.round(Math.min(iw, ih) * 0.004));
          for (const hit of bubbleHits) {
            const qIdx = hit.qIndex;
            const isMultiple = multipleAnswers.includes(qIdx + 1);
            const isCorrect = answerKey[qIdx] && hit.choice.toUpperCase() === answerKey[qIdx].toUpperCase();

            if (isMultiple) {
              oCtx.strokeStyle = '#facc15'; // yellow-400
            } else if (isCorrect) {
              oCtx.strokeStyle = '#22c55e'; // green-500
            } else {
              oCtx.strokeStyle = '#ef4444'; // red-500
            }
            oCtx.lineWidth = lineW;
            oCtx.beginPath();
            oCtx.ellipse(hit.px, hit.py, hit.rx * 1.15, hit.ry * 1.15, 0, 0, Math.PI * 2);
            oCtx.stroke();
          }

          // 3. Blue circles over detected ID bubbles
          if (detectedRawIdDigits && detectedRawIdDigits.length > 0) {
            const idLayout = getTemplateLayout(exam.num_items);
            const idBubbleR = Math.max(4, Math.round(Math.min(iw, ih) * 0.008));
            oCtx.lineWidth = lineW;
            for (let col = 0; col < 9; col++) {
              const digit = detectedRawIdDigits[col];
              if (digit < 0) continue; // unshaded (-1) or double-shade (-2)
              const nx = idLayout.id.firstColNX + col * idLayout.id.colSpacingNX;
              const ny = idLayout.id.firstRowNY + digit * idLayout.id.rowSpacingNY;
              const { px: idPx, py: idPy } = mapToPixel(debugMarkers, nx, ny);
              oCtx.strokeStyle = '#3b82f6'; // blue-500
              oCtx.beginPath();
              oCtx.ellipse(idPx, idPy, idBubbleR, idBubbleR, 0, 0, Math.PI * 2);
              oCtx.stroke();
            }
          }

          setCapturedImage(overlayCanvas.toDataURL('image/png'));
        }
      }

      setDetectedStudentId(studentId);
      setDetectedAnswers(answers);
      setMultipleAnswerQuestions(multipleAnswers);
      setIdDoubleShadeColumns(idDoubleShades);
      setRawIdDigits(detectedRawIdDigits || []); // Store raw digit array for UI display

      // Validate student ID against class roster
      // Consider alignment errors when classifying ID detection issues
      let idError: string | null = null;
      let matched: Student | null = null;

      // If there's an alignment error and ID detection issues, prioritize the alignment message
      const hasAlignmentIssue = !markersFound || markerConfidence < 0.5;
      
      if (idDoubleShades.length > 0) {
        // Check if this might be caused by alignment issues
        if (hasAlignmentIssue) {
          // Don't set idError - let alignment error take precedence
          // The alignment error message is more helpful
        } else {
          idError = `Student ID has multiple bubbles shaded in column(s): ${idDoubleShades.join(', ')}. Each column must have only one bubble shaded. Please ask the student to correct their answer sheet or manually edit the ID below.`;
        }
      } else if (!studentId || /^0+$/.test(studentId)) {
        if (hasAlignmentIssue) {
          // Alignment issue is likely the cause - don't duplicate the message
        } else {
          idError = 'No Student ID was detected. Please check if the student properly shaded their ID bubbles.';
        }
      } else if (!classData) {
        idError = 'No class is linked to this exam. Please go to exam settings and assign a class before scanning.';
      } else {
        const student = classData.students.find(s => s.student_id === studentId);
        if (student) {
          matched = student;
        } else {
          // If alignment is poor but ID was detected, warn that the ID might be misread
          if (hasAlignmentIssue) {
            idError = `Student ID "${studentId}" may have been misread due to alignment issues. The ID is not registered in class "${classData.class_name} - ${classData.course_subject}${classData.year ? ` ${classData.year}` : ''}". Try retaking the photo with better alignment.`;
          } else {
            idError = `Student ID "${studentId}" is not registered in class "${classData.class_name} - ${classData.course_subject}${classData.year ? ` ${classData.year}` : ''}". Please verify the student is enrolled in this class or check if the ID was shaded correctly.`;
          }
        }
      }
      
      setMatchedStudent(matched);
      setStudentIdError(idError);
      
      // Calculate score
      let score = 0;
      const totalQuestions = Math.min(answers.length, answerKey.length);
      
      for (let i = 0; i < totalQuestions; i++) {
        if (answers[i] && answerKey[i] && answers[i].toUpperCase() === answerKey[i].toUpperCase()) {
          score++;
        }
      }
      
      const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
      const letterGrade = calculateLetterGrade(percentage);
      
      const result: ScanResult = {
        studentId,
        answers,
        score,
        totalQuestions,
        percentage,
        letterGrade,
        timestamp: new Date().toISOString()
      };

      // ── 200-item two-pass handling ──
      if (exam.num_items > 150) {
        if (scanPage === 1) {
          // Store page-1 data and advance to page-2 scan
          setPage1Answers(answers);
          setPage1StudentId(studentId);
          setScanPage(2);
          setCapturedImage(null);
          isAutoCapturingRef.current = false;
          setMode('camera');
          startCamera();
          toast.info('Page 1 scanned! Now align and scan Page 2 (Questions 101–200).');
          return;
        } else {
          // Page 2: merge answers and re-score using full 200-item answer key
          const combined = [...page1Answers, ...answers];
          const combinedStudentId = page1StudentId || studentId; // prefer page-1 id
          let combinedScore = 0;
          const combinedTotal = Math.min(combined.length, answerKey.length);
          for (let i = 0; i < combinedTotal; i++) {
            if (combined[i] && answerKey[i] && combined[i].toUpperCase() === answerKey[i].toUpperCase()) {
              combinedScore++;
            }
          }
          const combinedPct = combinedTotal > 0 ? Math.round((combinedScore / combinedTotal) * 100) : 0;
          const combinedResult: ScanResult = {
            studentId: combinedStudentId,
            answers: combined,
            score: combinedScore,
            totalQuestions: combinedTotal,
            percentage: combinedPct,
            letterGrade: calculateLetterGrade(combinedPct),
            timestamp: new Date().toISOString()
          };
          setDetectedAnswers(combined);
          setDetectedStudentId(combinedStudentId);
          setScanResult(combinedResult);
          setMode('results');
          return;
        }
      }

      setScanResult(result);
      setMode('results');
      
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error('Failed to process image. Please try again with a clearer image.');
      isAutoCapturingRef.current = false;
      setMode('camera');
      startCamera();
    } finally {
      setProcessing(false);
    }
  }, [capturedImage, exam, answerKey, classData]);

  // Auto-trigger processImage when mode is 'processing' and capturedImage is ready
  useEffect(() => {
    if (mode === 'processing' && capturedImage && exam) {
      processImage();
    }
  }, [mode, capturedImage, exam, processImage]);

  // ─── CORNER MARKER DETECTION ───
  // Finds the 4 black alignment squares printed at the corners of every answer sheet.
  //
  // CHALLENGE: The paper may not fill the entire image — there can be dark desk/background
  // around the paper edges. The detector must find markers ON THE PAPER, not at image edges.
  //
  // IMPORTANT FOR 100-ITEM: The bottom markers are at ~75% of page height (Y=222 on 297mm page),
  // NOT at the page bottom. The marker frame aspect ratio is 197/215.5 ≈ 0.91 (wider than tall).
  //
  // STRATEGY:
  //   1. Scan the ENTIRE image for dark, uniform, square-shaped regions
  //   2. Require bright PAPER background around each candidate (rejects desk edges/shadows)
  //   3. Collect ALL good candidates across the whole image
  //   4. Pick the 4 candidates that form the best axis-aligned rectangle
  //      (top-left-most, top-right-most, bottom-left-most, bottom-right-most)
  //   5. For 100-item templates, prefer rectangles where bottom markers are at ~75% of image height
  const findCornerMarkers = (
    _binary: Uint8Array,
    width: number,
    height: number,
    grayscale?: Uint8Array,
    templateType?: 20 | 50 | 100 | 150
  ): {
    found: boolean;
    confidence: number;
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
    bottomRight: { x: number; y: number };
  } => {
    if (!grayscale) {
      return {
        found: false,
        confidence: 0,
        topLeft: { x: width * 0.05, y: height * 0.05 },
        topRight: { x: width * 0.95, y: height * 0.05 },
        bottomLeft: { x: width * 0.05, y: height * 0.95 },
        bottomRight: { x: width * 0.95, y: height * 0.95 },
      };
    }

    // Build integral image for fast region-sum queries
    const integral = new Float64Array((width + 1) * (height + 1));
    for (let y = 0; y < height; y++) {
      let rowSum = 0;
      for (let x = 0; x < width; x++) {
        rowSum += grayscale[y * width + x];
        integral[(y + 1) * (width + 1) + (x + 1)] = integral[y * (width + 1) + (x + 1)] + rowSum;
      }
    }

    // Fast average brightness of a rectangle using integral image
    const rectAvg = (x1: number, y1: number, x2: number, y2: number): number => {
      x1 = Math.max(0, Math.floor(x1));
      y1 = Math.max(0, Math.floor(y1));
      x2 = Math.min(width, Math.floor(x2));
      y2 = Math.min(height, Math.floor(y2));
      const area = (x2 - x1) * (y2 - y1);
      if (area <= 0) return 255;
      const sum = integral[y2 * (width + 1) + x2] - integral[y1 * (width + 1) + x2]
                 - integral[y2 * (width + 1) + x1] + integral[y1 * (width + 1) + x1];
      return sum / area;
    };

    // Estimate marker size based on image width.
    // Paper may not fill the entire image, so use a conservative estimate.
    // Real marker is 7mm on a 210mm page → 3.3% of page width.
    // If the paper fills 50-90% of the image, marker is 1.7-3% of image width.
    // Try sizes from ~1.5% to ~4% of image width.
    const baseSize = Math.round(width * 0.025); // ~2.5% of image width
    const sizes = [
      Math.max(8, Math.round(baseSize * 0.5)),
      Math.max(10, Math.round(baseSize * 0.7)),
      Math.max(12, baseSize),
      Math.round(baseSize * 1.3),
      Math.round(baseSize * 1.6),
      Math.round(baseSize * 2.0),
    ];

    console.log(`[OMR] Marker search: image=${width}x${height}, baseSize=${baseSize}px, sizes=[${sizes.join(',')}]`);

    // ── PHASE 1: Collect ALL dark square candidates across the ENTIRE image ──
    interface MarkerCandidate {
      x: number;
      y: number;
      score: number;
      size: number;
    }

    const candidates: MarkerCandidate[] = [];

    for (const size of sizes) {
      const half = Math.floor(size / 2);
      // Use 1/3 of marker size as step — finer than before (was 1/2) so we don't
      // accidentally stride over a marker that sits between two step positions.
      const step = Math.max(2, Math.floor(size / 3));

      for (let cy = half + 2; cy < height - half - 2; cy += step) {
        for (let cx = half + 2; cx < width - half - 2; cx += step) {
          // Interior brightness (the marker itself — must be dark)
          const innerAvg = rectAvg(cx - half, cy - half, cx + half, cy + half);
          if (innerAvg > 80) continue;

          // Uniformity: all 4 quadrants must be consistently dark
          const q1 = rectAvg(cx - half, cy - half, cx, cy);
          const q2 = rectAvg(cx, cy - half, cx + half, cy);
          const q3 = rectAvg(cx - half, cy, cx, cy + half);
          const q4 = rectAvg(cx, cy, cx + half, cy + half);
          const qMax = Math.max(q1, q2, q3, q4);
          const qMin = Math.min(q1, q2, q3, q4);
          if (qMax - qMin > 50) continue; // Not uniform → not a solid square

          // CRITICAL: The surrounding area must be BRIGHT (paper, not desk)
          // Sample a ring 1.5-3× the marker size around it
          const ringInner = Math.floor(half * 1.5);
          const ringOuter = Math.floor(half * 3);
          
          // Check all 4 sides for brightness
          // Corner markers sit near the paper edge, so 1-2 sides may extend into
          // dark desk/background. We require at least 2 of 4 sides to be bright paper.
          // This still rejects desk-edge shadows (0 bright sides) while allowing
          // real markers that are near paper edges.
          const topRing = rectAvg(cx - ringOuter, cy - ringOuter, cx + ringOuter, cy - ringInner);
          const botRing = rectAvg(cx - ringOuter, cy + ringInner, cx + ringOuter, cy + ringOuter);
          const leftRing = rectAvg(cx - ringOuter, cy - ringInner, cx - ringInner, cy + ringInner);
          const rightRing = rectAvg(cx + ringInner, cy - ringInner, cx + ringOuter, cy + ringInner);
          
          const brightThreshold = 150; // Paper should be bright
          const brightSides = (topRing > brightThreshold ? 1 : 0) +
                              (botRing > brightThreshold ? 1 : 0) +
                              (leftRing > brightThreshold ? 1 : 0) +
                              (rightRing > brightThreshold ? 1 : 0);
          
          // At least 2 of 4 sides must have bright paper background
          // (corner markers near paper edges may have desk on 2 sides)
          if (brightSides < 2) continue;

          // Border brightness: average of the ring
          const borderAvg = (topRing + botRing + leftRing + rightRing) / 4;
          const contrast = borderAvg - innerAvg;
          if (contrast < 60) continue;

          // Score: contrast × size bonus (larger markers score higher)
          const sizeBonus = size / baseSize;
          const score = contrast * sizeBonus;

          candidates.push({ x: cx, y: cy, score, size });
        }
      }
    }

    console.log(`[OMR] Found ${candidates.length} marker candidates`);

    // Remove overlapping candidates (keep highest score within each cluster)
    candidates.sort((a, b) => b.score - a.score);
    const merged: MarkerCandidate[] = [];
    const mergeRadius = baseSize * 2;
    
    for (const c of candidates) {
      const tooClose = merged.some(m => 
        Math.abs(m.x - c.x) < mergeRadius && Math.abs(m.y - c.y) < mergeRadius
      );
      if (!tooClose) {
        merged.push(c);
      }
    }

    console.log(`[OMR] After merge: ${merged.length} unique candidates`);
    for (const m of merged.slice(0, 8)) {
      console.log(`[OMR]   candidate: (${Math.round(m.x)},${Math.round(m.y)}) score=${m.score.toFixed(0)} size=${m.size}`);
    }

    // ── PHASE 2: Select the 4 candidates that form the best rectangle ──
    // For each candidate, compute which corner it would best serve based on position
    if (merged.length < 4) {
      console.log('[OMR] Not enough candidates, using fallback positions');
      return {
        found: false,
        confidence: merged.length / 4, // 0-0.75 if some markers found
        topLeft: { x: width * 0.1, y: height * 0.05 },
        topRight: { x: width * 0.9, y: height * 0.05 },
        bottomLeft: { x: width * 0.1, y: height * 0.85 },
        bottomRight: { x: width * 0.9, y: height * 0.85 },
      };
    }

    // ── Edge-proximity filter for ALL template types ──
    // Corner alignment markers must be near the edges of the captured image.
    // This is the single most effective way to reject interior section markers (■)
    // that also happen to look like dark squares surrounded by bright paper.
    //
    // How tight to make the margin depends on how much of the image the paper fills:
    //   20-item  guide = 75% frame width  → paper corners in outer ~12% of image
    //   50-item  guide = 55% frame width  → paper corners in outer ~22% of image
    //   100-item guide = 90% frame width  → paper corners in outer ~10% of image
    //
    // We use generous margins (2-2.5×) to accommodate rotation and alignment error:
    //   20-item  → 28% margin  (2.3× the expected 12%)
    //   50-item  → 32% margin  (1.5× the expected 22%)
    //   100-item → 28% margin  (2.8× the expected 10%)
    //
    // A "corner candidate" must be near at least one LEFT/RIGHT edge AND at
    // least one TOP/BOTTOM edge — so it occupies a corner quadrant of the image.
    let filteredCandidates = merged;
    {
      const edgeMarginX = templateType === 50 ? width * 0.32 : width * 0.28;
      const edgeMarginY = templateType === 50 ? height * 0.32 : height * 0.28;

      const edgeFiltered = merged.filter(c => {
        const nearH = c.x < edgeMarginX || c.x > width  - edgeMarginX;
        const nearV = c.y < edgeMarginY || c.y > height - edgeMarginY;
        return nearH && nearV;
      });

      console.log(`[OMR] Edge filter (${templateType}-item): ${merged.length} → ${edgeFiltered.length} candidates`);

      // Only apply if we still have at least 4 candidates
      if (edgeFiltered.length >= 4) {
        filteredCandidates = edgeFiltered;
      } else {
        console.log('[OMR] Edge filter too aggressive, keeping all candidates');
      }
    }

    // Try all combinations of 4 candidates (limit to top 12 to keep it fast)
    const topN = filteredCandidates.slice(0, 12);
    let bestCombo: { tl: MarkerCandidate; tr: MarkerCandidate; bl: MarkerCandidate; br: MarkerCandidate } | null = null;
    let bestRectScore = 0;

    for (let i = 0; i < topN.length; i++) {
      for (let j = i + 1; j < topN.length; j++) {
        for (let k = j + 1; k < topN.length; k++) {
          for (let l = k + 1; l < topN.length; l++) {
            const pts = [topN[i], topN[j], topN[k], topN[l]];
            
            // Sort into corners: TL has smallest x+y, TR has largest x-y, etc.
            const sorted = [...pts];
            const tl = sorted.reduce((a, b) => (a.x + a.y < b.x + b.y ? a : b));
            const br = sorted.reduce((a, b) => (a.x + a.y > b.x + b.y ? a : b));
            const tr = sorted.reduce((a, b) => (a.x - a.y > b.x - b.y ? a : b));
            const bl = sorted.reduce((a, b) => (a.y - a.x > b.y - b.x ? a : b));
            
            // All 4 must be different candidates
            const ids = new Set([tl, tr, bl, br]);
            if (ids.size < 4) continue;
            
            // Check that it forms a reasonable rectangle
            const topW = tr.x - tl.x;
            const botW = br.x - bl.x;
            const leftH = bl.y - tl.y;
            const rightH = br.y - tr.y;
            
            // All dimensions must be positive and significant
            if (topW < width * 0.2 || botW < width * 0.2) continue;
            if (leftH < height * 0.2 || rightH < height * 0.2) continue;
            
            // Width ratio and height ratio should be close to 1
            const wRatio = Math.min(topW, botW) / Math.max(topW, botW);
            const hRatio = Math.min(leftH, rightH) / Math.max(leftH, rightH);
            if (wRatio < 0.85 || hRatio < 0.85) continue;
            
            // Aspect ratio check - varies by template type
            // Template frames (marker center to marker center):
            // - 100/150-item: fw=198mm, fh=285mm → aspect ratio = 198/285 ≈ 0.69
            // - 20-item: fw=93mm, fh=136.5mm → aspect ratio = 93/136.5 ≈ 0.68 (portrait quarter-page)
            // - 50-item: fw=198mm, fh=136.5mm → aspect ratio = 198/136.5 ≈ 1.45 (landscape half-page)
            const avgW = (topW + botW) / 2;
            const avgH = (leftH + rightH) / 2;
            const aspect = avgW / avgH;

            // Apply template-specific aspect ratio constraints
            if (templateType === 100 || templateType === 150) {
              // Full-page templates: aspect ratio ~0.69 (allowing for rotation/perspective)
              if (aspect < 0.55 || aspect > 0.90) continue;
            } else if (templateType === 20) {
              // Quarter-page portrait (105x148.5mm): aspect ratio ~0.68
              if (aspect < 0.50 || aspect > 0.95) continue;
            } else if (templateType === 50) {
              // Half-page landscape (210x148.5mm): aspect ratio ~1.45
              if (aspect < 0.4 || aspect > 2.0) continue;
            }
            
            // Left edges should be roughly aligned (TL.x ≈ BL.x)
            const leftXDiff = Math.abs(tl.x - bl.x) / avgW;
            const rightXDiff = Math.abs(tr.x - br.x) / avgW;
            const topYDiff = Math.abs(tl.y - tr.y) / avgH;
            const botYDiff = Math.abs(bl.y - br.y) / avgH;
            // Allow more skew tolerance (up to 15% instead of 8%)
            if (leftXDiff > 0.15 || rightXDiff > 0.15 || topYDiff > 0.15 || botYDiff > 0.15) continue;
            
            // ── Scoring ──
            // Primary driver: area of the rectangle (larger = more likely to be
            // the true outer corner markers, not inner section squares).
            // Multiply by individual marker quality and rectangle regularity.
            const rectQuality = wRatio * hRatio;
            const areaFraction = (avgW * avgH) / (width * height); // 0–1

            // Aspect ratio bonus for matching expected paper dimensions
            let aspectBonus = 1.0;
            let expectedAspect = 1.0;
            
            if (templateType === 100 || templateType === 150) {
              expectedAspect = 0.69; // 198/285 for full-page
              const aspectDiff = Math.abs(aspect - expectedAspect);
              aspectBonus = Math.max(0.5, 1.0 - aspectDiff);
            } else if (templateType === 50 || templateType === 20) {
              expectedAspect = 1.45; // 198/136.5 for half-page
              const aspectDiff = Math.abs(aspect - expectedAspect) / 1.45; // normalize
              aspectBonus = Math.max(0.5, 1.0 - aspectDiff);
            }

            // Position bonus: prefer markers that are positioned correctly for the template
            let positionBonus = 1.0;
            const bottomY = (bl.y + br.y) / 2;
            const bottomYRatio = bottomY / height;
            
            if (templateType === 100 || templateType === 150) {
              // Full-page: bottom markers around 98% of height
              if (bottomYRatio > 0.95 && bottomYRatio < 0.99) {
                positionBonus = 1.2; // reward correct position
              } else if (bottomYRatio > 0.99) {
                positionBonus = 0.3; // penalize markers at very bottom edge
              } else if (bottomYRatio < 0.85) {
                positionBonus = 0.6; // penalize markers too high
              }
            } else if (templateType === 50 || templateType === 20) {
              // Half-page: bottom markers around 96% of height
              if (bottomYRatio > 0.93 && bottomYRatio < 0.99) {
                positionBonus = 1.2; // reward correct position
              } else if (bottomYRatio > 0.99) {
                positionBonus = 0.3; // penalize markers at very bottom edge
              } else if (bottomYRatio < 0.85) {
                positionBonus = 0.6; // penalize markers too high
              }
            }

            // Area is raised to the power of 2 so that a rectangle that is 10%
            // larger in each dimension (21% more area) scores ~44% better,
            // strongly preferring the outermost (correct) corner markers.
            const totalScore = (tl.score + tr.score + bl.score + br.score)
              * rectQuality
              * Math.pow(areaFraction, 2)
              * positionBonus
              * aspectBonus;
            
            if (totalScore > bestRectScore) {
              bestRectScore = totalScore;
              bestCombo = { tl, tr, bl, br };
            }
          }
        }
      }
    }

    if (bestCombo) {
      // Pixel-level refinement for each marker
      const refineMarker = (c: MarkerCandidate): { x: number; y: number } => {
        const half = Math.floor(c.size / 2);
        const refineR = Math.max(4, Math.floor(c.size / 3));
        let bestX = c.x, bestY = c.y, bestScore = 0;

        for (let cy = c.y - refineR; cy <= c.y + refineR; cy++) {
          for (let cx = c.x - refineR; cx <= c.x + refineR; cx++) {
            if (cx - half < 0 || cx + half >= width || cy - half < 0 || cy + half >= height) continue;
            const innerAvg = rectAvg(cx - half, cy - half, cx + half, cy + half);
            if (innerAvg > 80) continue;
            
            const ringInner = Math.floor(half * 1.5);
            const ringOuter = Math.floor(half * 3);
            const topRing = rectAvg(cx - ringOuter, cy - ringOuter, cx + ringOuter, cy - ringInner);
            const botRing = rectAvg(cx - ringOuter, cy + ringInner, cx + ringOuter, cy + ringOuter);
            const leftRing = rectAvg(cx - ringOuter, cy - ringInner, cx - ringInner, cy + ringInner);
            const rightRing = rectAvg(cx + ringInner, cy - ringInner, cx + ringOuter, cy + ringInner);
            const borderAvg = (topRing + botRing + leftRing + rightRing) / 4;
            
            const score = borderAvg - innerAvg;
            if (score > bestScore) {
              bestScore = score;
              bestX = cx;
              bestY = cy;
            }
          }
        }
        return { x: bestX, y: bestY };
      };

      const tl = refineMarker(bestCombo.tl);
      const tr = refineMarker(bestCombo.tr);
      const bl = refineMarker(bestCombo.bl);
      const br = refineMarker(bestCombo.br);

      console.log(`[OMR] Selected rectangle: TL=(${Math.round(tl.x)},${Math.round(tl.y)}) TR=(${Math.round(tr.x)},${Math.round(tr.y)}) BL=(${Math.round(bl.x)},${Math.round(bl.y)}) BR=(${Math.round(br.x)},${Math.round(br.y)}) rectScore=${bestRectScore.toFixed(0)}`);

      // Calculate confidence based on rectangle quality and individual marker scores
      // Normalize score: typical good score is 5000-20000, max out at ~1.0
      const avgMarkerScore = (bestCombo.tl.score + bestCombo.tr.score + bestCombo.bl.score + bestCombo.br.score) / 4;
      const normalizedMarkerScore = Math.min(1, avgMarkerScore / 200);
      
      // Check rectangle quality metrics
      const topW = tr.x - tl.x;
      const botW = br.x - bl.x;
      const leftH = bl.y - tl.y;
      const rightH = br.y - tr.y;
      const wRatio = Math.min(topW, botW) / Math.max(topW, botW);
      const hRatio = Math.min(leftH, rightH) / Math.max(leftH, rightH);
      const rectQuality = wRatio * hRatio;
      
      const confidence = Math.min(1, normalizedMarkerScore * rectQuality * 1.2);
      console.log(`[OMR] Marker confidence: ${(confidence * 100).toFixed(1)}% (markerScore=${avgMarkerScore.toFixed(0)}, rectQuality=${rectQuality.toFixed(2)})`);

      return {
        found: true,
        confidence,
        topLeft: tl,
        topRight: tr,
        bottomLeft: bl,
        bottomRight: br,
      };
    }

    // Fallback: pick the 4 candidates closest to each corner
    console.log('[OMR] No valid rectangle found, using corner-closest fallback');
    const pickClosest = (targetX: number, targetY: number) => {
      let best = merged[0];
      let bestDist = Infinity;
      for (const c of merged) {
        const dist = Math.sqrt(Math.pow(c.x - targetX, 2) + Math.pow(c.y - targetY, 2));
        if (dist < bestDist) {
          bestDist = dist;
          best = c;
        }
      }
      return { x: best.x, y: best.y };
    };

    return {
      found: false,
      confidence: 0.3, // Low confidence for fallback
      topLeft: pickClosest(0, 0),
      topRight: pickClosest(width, 0),
      bottomLeft: pickClosest(0, height),
      bottomRight: pickClosest(width, height),
    };
  };

  // ─── COORDINATE MAPPING ───
  const mapToPixel = (
    markers: {
      topLeft: { x: number; y: number };
      topRight: { x: number; y: number };
      bottomLeft: { x: number; y: number };
      bottomRight: { x: number; y: number };
    },
    nx: number,
    ny: number
  ): { px: number; py: number } => {
    const topX = markers.topLeft.x + nx * (markers.topRight.x - markers.topLeft.x);
    const topY = markers.topLeft.y + nx * (markers.topRight.y - markers.topLeft.y);
    const botX = markers.bottomLeft.x + nx * (markers.bottomRight.x - markers.bottomLeft.x);
    const botY = markers.bottomLeft.y + nx * (markers.bottomRight.y - markers.bottomLeft.y);
    return {
      px: topX + ny * (botX - topX),
      py: topY + ny * (botY - topY),
    };
  };

  // ─── TEMPLATE LAYOUT DEFINITIONS ───
  interface AnswerBlock {
    startQ: number;
    endQ: number;
    firstBubbleNX: number;
    firstBubbleNY: number;
    bubbleSpacingNX: number;
    rowSpacingNY: number;
  }

  interface TemplateLayout {
    id: {
      firstColNX: number;
      firstRowNY: number;
      colSpacingNX: number;
      rowSpacingNY: number;
    };
    answerBlocks: AnswerBlock[];
    bubbleDiameterNX: number;
    bubbleDiameterNY: number;
  }

  const getTemplateLayout = (numQuestions: number): TemplateLayout => {
    // For 200-item exams, each physical page is scanned as a 100-item sheet
    // (page 1 → Q1-100, page 2 → Q101-200). The layout is identical to 100-item.
    const effectiveQ = numQuestions > 150 ? 100 : numQuestions;
    const templateType = effectiveQ <= 20 ? 20 : effectiveQ <= 50 ? 50 : effectiveQ <= 100 ? 100 : 150;

    if (templateType === 20) {
      // Quarter-page portrait: 105 × 148.5 mm (each cell in the 2×2 grid)
      // Corner markers: TL center=(6,6), TR center=(99,6), BL center=(6,142.5), BR center=(99,142.5)
      // fw = 99 - 6 = 93, fh = 142.5 - 6 = 136.5
      //
      // colWidth = (105 - 2*10) / 2 = 42.5mm per column
      // ID: idStartX=18, from TL: 18-6=12; ID row 0 at currentY≈35.5, from TL: 29.5
      // Answer section: currentY≈79.5 after ID, first bubble at by+5=84.5, from TL: 78.5
      // Block 0 bx=10, first bubble x=20, from TL: 14
      // Block 1 bx=52.5, first bubble x=62.5, from TL: 56.5
      const fw = 93, fh = 136.5;

      return {
        id: {
          firstColNX: 12 / fw,
          firstRowNY: 29.5 / fh,
          colSpacingNX: 4.8 / fw,
          rowSpacingNY: 4.0 / fh,
        },
        answerBlocks: [
          {
            startQ: 1, endQ: 10,
            firstBubbleNX: 14 / fw, firstBubbleNY: 78.5 / fh,
            bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh,
          },
          {
            startQ: 11, endQ: 20,
            firstBubbleNX: 56.5 / fw, firstBubbleNY: 78.5 / fh,
            bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh,
          },
        ],
        bubbleDiameterNX: 3.5 / fw,
        bubbleDiameterNY: 3.5 / fh,
      };
    }

    if (templateType === 50) {
      // Half-page sheet 210 × 148.5 mm (half A4 - horizontal split)
      // Corner markers TL=(6,6) TR=(204,6) BL=(6,142.5) BR=(204,142.5)
      // fw = 198, fh = 136.5
      //
      // PDF layout trace (with logo + exam code — the normal printed sheet):
      //   currentY starts at 5 (startY + cornerInset + 3)
      //   +12 (logo 10mm + 2)          → 17
      //   +4  (exam code line)         → 21
      //   +4  (name/date line)         → 25
      //   +4.5 (ID label)              → 29.5  ← ID row 0 centres here
      //   +6  (idBoxHeight 4 + 2)      → 35.5  ← but boxes drawn at 29.5, bubbles at 35.5
      //   idBottomYMini = 35.5 + 40+1  → 76.5
      //   currentY = 76.5 + 3          → 79.5
      //   drawMiniQBlock: qY += 5 (header) → 84.5 ← Q1 first bubble
      //
      // ID row 0 at sheet-Y=35.5 → from TL(6): 29.5 → firstRowNY = 29.5/fh
      // Q1 bubble  at sheet-Y=84.5 → from TL(6): 78.5 → firstBubbleNY = 78.5/fh
      const fw = 198, fh = 136.5;
      
      // 5 blocks across: blockWidth = (210 - 2*10) / 5 = 38mm
      
      return {
        id: {
          firstColNX: 12 / fw,
          firstRowNY: 29.5 / fh,
          colSpacingNX: 4.8 / fw,  // 9 columns
          rowSpacingNY: 4.0 / fh,
        },
        answerBlocks: [
          // All 5 blocks in a single row
          {
            startQ: 1, endQ: 10,
            // bx = 10 + 0 * 38 = 10, first bubble at 10 + 10 = 20, from TL: 14
            firstBubbleNX: 14 / fw, firstBubbleNY: 78.5 / fh,
            bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh,
          },
          {
            startQ: 11, endQ: 20,
            // bx = 10 + 1 * 38 = 48, first bubble at 48 + 10 = 58, from TL: 52
            firstBubbleNX: 52 / fw, firstBubbleNY: 78.5 / fh,
            bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh,
          },
          {
            startQ: 21, endQ: 30,
            // bx = 10 + 2 * 38 = 86, first bubble at 86 + 10 = 96, from TL: 90
            firstBubbleNX: 90 / fw, firstBubbleNY: 78.5 / fh,
            bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh,
          },
          {
            startQ: 31, endQ: 40,
            // bx = 10 + 3 * 38 = 124, first bubble at 124 + 10 = 134, from TL: 128
            firstBubbleNX: 128 / fw, firstBubbleNY: 78.5 / fh,
            bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh,
          },
          {
            startQ: 41, endQ: 50,
            // bx = 10 + 4 * 38 = 162, first bubble at 162 + 10 = 172, from TL: 166
            firstBubbleNX: 166 / fw, firstBubbleNY: 78.5 / fh,
            bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh,
          },
        ],
        bubbleDiameterNX: 3.5 / fw,
        bubbleDiameterNY: 3.5 / fh,
      };
    }

    // 100‑question full page  210 × 297 mm
    //
    // UPDATED PDF LAYOUT (templatePdfGenerator.ts):
    //   margin=10, cornerInset=2, markerSize=8
    //   Top-left marker: rect(2, 2, 8, 8) → center at (6, 6)
    //   Top-right marker: rect(200, 2, 8, 8) → center at (204, 6)
    //   Bottom markers: center at (6, 291) & (204, 291)
    //   fw = 204 - 6 = 198, fh = 291 - 6 = 285
    //
    //   Header: currentY starts at cornerInset + 3 = 5
    //   After logo (10) + 2 = 17
    //   After exam code + 4 = 21
    //   After name/date + 4 = 25
    //   ID section: idStartX = margin + idPad + idLabelW = 10 + 2 + 6 = 18
    //   ID bubbles first row Y ≈ 36.5 (after boxes)
    //   ID bottom ≈ 78, grid starts at ≈ 81
    //
    //   bubbleGap=5.5, rowH=5.2, numW=10, bubbleSize=3.5
    //   qBlockW = 10 + 4*5.5 + 3.5 = 35.5mm
    //   colGap = (190 - 5*35.5) / 6 ≈ 2.08mm
    //   Block col 0: bx = 10 + 2.08 = 12.08, first bubble at 22.08
    //   Block col 1: bx = 12.08 + 35.5 + 2.08 = 49.66, first bubble at 59.66
    //   etc.
    //   blockVGap = 10 * 5.2 + 10 = 62mm
    //
    // NX = (pageX - 6) / fw, NY = (pageY - 6) / fh
    const fw = 198, fh = 285;
    
    // Calculate block positions
    // bubbleGap=5.5, rowH=5.2, numW=10, bubbleSize=3.5
    // qBlockW = 10 + 4*5.5 + 3.5 = 35.5mm
    // blockVGap = 10 * rowH + 10 = 62mm
    const qBlockW = 35.5;
    const colGap = 2.08;
    const numW = 10;
    const blockVGap = 62;
    
    // First bubble X positions for each column (from page left edge)
    const col0X = 10 + colGap + numW; // 22.08
    const col1X = 10 + colGap + (qBlockW + colGap) + numW; // 59.66
    const col2X = 10 + colGap + 2 * (qBlockW + colGap) + numW; // 97.24
    const col3X = 10 + colGap + 3 * (qBlockW + colGap) + numW; // 134.82
    const col4X = 10 + colGap + 4 * (qBlockW + colGap) + numW; // 172.4
    
    // Grid starts at Y ≈ 81, first bubble after header (+5) = 86
    const gridStartY = 81;
    const row0FirstBubbleY = gridStartY + 5; // 86
    const row1FirstBubbleY = gridStartY + blockVGap + 5; // 148
    
    if (templateType === 100) {
      return {
        id: {
          // idStartX = 18 → from TL marker: 18 - 6 = 12
          firstColNX: 12 / fw,
          // ID bubbles start at Y ≈ 36.5 → from TL marker: 36.5 - 6 = 30.5
          firstRowNY: 30.5 / fh,
          colSpacingNX: 4.8 / fw,
          rowSpacingNY: 4.0 / fh,
        },
        answerBlocks: [
          // Col 0: Q1-10, Q11-20 (down)
          { startQ: 1, endQ: 10, firstBubbleNX: (col0X - 6) / fw, firstBubbleNY: (row0FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
          { startQ: 11, endQ: 20, firstBubbleNX: (col0X - 6) / fw, firstBubbleNY: (row1FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
          // Col 1: Q21-30, Q31-40 (down)
          { startQ: 21, endQ: 30, firstBubbleNX: (col1X - 6) / fw, firstBubbleNY: (row0FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
          { startQ: 31, endQ: 40, firstBubbleNX: (col1X - 6) / fw, firstBubbleNY: (row1FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
          // Col 2: Q41-50, Q51-60 (down)
          { startQ: 41, endQ: 50, firstBubbleNX: (col2X - 6) / fw, firstBubbleNY: (row0FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
          { startQ: 51, endQ: 60, firstBubbleNX: (col2X - 6) / fw, firstBubbleNY: (row1FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
          // Col 3: Q61-70, Q71-80 (down)
          { startQ: 61, endQ: 70, firstBubbleNX: (col3X - 6) / fw, firstBubbleNY: (row0FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
          { startQ: 71, endQ: 80, firstBubbleNX: (col3X - 6) / fw, firstBubbleNY: (row1FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
          // Col 4: Q81-90, Q91-100 (down)
          { startQ: 81, endQ: 90, firstBubbleNX: (col4X - 6) / fw, firstBubbleNY: (row0FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
          { startQ: 91, endQ: 100, firstBubbleNX: (col4X - 6) / fw, firstBubbleNY: (row1FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
        ],
        bubbleDiameterNX: 3.5 / fw,
        bubbleDiameterNY: 3.5 / fh,
      };
    }
    
    // 150 Questions - Full page with 5 cols × 3 rows
    // Same layout as 100-item but with 3 rows
    const row2FirstBubbleY = gridStartY + 2 * blockVGap + 5; // 210
    
    return {
      id: {
        firstColNX: 12 / fw,
        firstRowNY: 30.5 / fh,
        colSpacingNX: 4.8 / fw,
        rowSpacingNY: 4.0 / fh,
      },
      answerBlocks: [
        // Col 0: Q1-10, Q11-20, Q21-30 (down)
        { startQ: 1, endQ: 10, firstBubbleNX: (col0X - 6) / fw, firstBubbleNY: (row0FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
        { startQ: 11, endQ: 20, firstBubbleNX: (col0X - 6) / fw, firstBubbleNY: (row1FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
        { startQ: 21, endQ: 30, firstBubbleNX: (col0X - 6) / fw, firstBubbleNY: (row2FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
        // Col 1: Q31-40, Q41-50, Q51-60 (down)
        { startQ: 31, endQ: 40, firstBubbleNX: (col1X - 6) / fw, firstBubbleNY: (row0FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
        { startQ: 41, endQ: 50, firstBubbleNX: (col1X - 6) / fw, firstBubbleNY: (row1FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
        { startQ: 51, endQ: 60, firstBubbleNX: (col1X - 6) / fw, firstBubbleNY: (row2FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
        // Col 2: Q61-70, Q71-80, Q81-90 (down)
        { startQ: 61, endQ: 70, firstBubbleNX: (col2X - 6) / fw, firstBubbleNY: (row0FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
        { startQ: 71, endQ: 80, firstBubbleNX: (col2X - 6) / fw, firstBubbleNY: (row1FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
        { startQ: 81, endQ: 90, firstBubbleNX: (col2X - 6) / fw, firstBubbleNY: (row2FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
        // Col 3: Q91-100, Q101-110, Q111-120 (down)
        { startQ: 91, endQ: 100, firstBubbleNX: (col3X - 6) / fw, firstBubbleNY: (row0FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
        { startQ: 101, endQ: 110, firstBubbleNX: (col3X - 6) / fw, firstBubbleNY: (row1FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
        { startQ: 111, endQ: 120, firstBubbleNX: (col3X - 6) / fw, firstBubbleNY: (row2FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
        // Col 4: Q121-130, Q131-140, Q141-150 (down)
        { startQ: 121, endQ: 130, firstBubbleNX: (col4X - 6) / fw, firstBubbleNY: (row0FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
        { startQ: 131, endQ: 140, firstBubbleNX: (col4X - 6) / fw, firstBubbleNY: (row1FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
        { startQ: 141, endQ: 150, firstBubbleNX: (col4X - 6) / fw, firstBubbleNY: (row2FirstBubbleY - 6) / fh, bubbleSpacingNX: 5.5 / fw, rowSpacingNY: 5.2 / fh },
      ],
      bubbleDiameterNX: 3.5 / fw,
      bubbleDiameterNY: 3.5 / fh,
    };
  };

  // ─── MAIN DETECTION PIPELINE ───
  const detectBubbles = async (
    imageData: ImageData,
    numQuestions: number,
    choicesPerQuestion: number
  ): Promise<{
    studentId: string;
    answers: string[];
    multipleAnswers: number[];
    idDoubleShades: number[];
    rawIdDigits: number[]; // Array of detected digits per column (-1 = unshaded)
    markersFound: boolean;
    markerConfidence: number;
    debugMarkers?: {
      topLeft: { x: number; y: number };
      topRight: { x: number; y: number };
      bottomLeft: { x: number; y: number };
      bottomRight: { x: number; y: number };
    };
    // Pixel coords of each detected answer bubble for overlay drawing
    bubbleHits: Array<{ px: number; py: number; rx: number; ry: number; choice: string; qIndex: number }>;
  }> => {
    const { data, width, height } = imageData;

    // 1. Convert to grayscale
    const rawGrayscale = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      rawGrayscale[i / 4] = Math.round(
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      );
    }

    // 1b. Global contrast stretch (2nd–98th percentile) for bubble sampling.
    // Simple and predictable — keeps paper white and ink black without the
    // per-tile inversion artefact that per-tile CLAHE caused on dark backgrounds.
    const sortSample: number[] = [];
    const sampleStep = Math.max(1, Math.floor(rawGrayscale.length / 10000));
    for (let i = 0; i < rawGrayscale.length; i += sampleStep) {
      sortSample.push(rawGrayscale[i]);
    }
    sortSample.sort((a, b) => a - b);
    const gMin = sortSample[Math.floor(sortSample.length * 0.02)];
    const gMax = sortSample[Math.floor(sortSample.length * 0.98)];
    const gRange = Math.max(1, gMax - gMin);

    const grayscale = new Uint8Array(width * height);
    for (let i = 0; i < rawGrayscale.length; i++) {
      grayscale[i] = Math.max(0, Math.min(255,
        Math.round(((rawGrayscale[i] - gMin) / gRange) * 255)
      ));
    }
    console.log(`[OMR] Contrast stretch: min=${gMin} max=${gMax} range=${gRange}`);

    // 2. Find corner alignment markers using RAW grayscale (before contrast normalization)
    // This avoids shadows/noise being amplified into false marker candidates
    const dummyBinary = new Uint8Array(0); // not used by new marker detector
    
    // Determine template type BEFORE finding markers (needed for position heuristics)
    const templateType = numQuestions <= 20 ? 20 : numQuestions <= 50 ? 50 : numQuestions <= 100 ? 100 : 150;
    
    const markers = findCornerMarkers(dummyBinary, width, height, rawGrayscale, templateType);
    console.log('[OMR] Corner markers found:', markers.found,
      'TL:', Math.round(markers.topLeft.x), Math.round(markers.topLeft.y),
      'BR:', Math.round(markers.bottomRight.x), Math.round(markers.bottomRight.y),
      'Template:', templateType);

    // 3. Use found markers (even if geometry check failed, the positions are better than raw margins)
    // Only fall back to image-edge margins if NO markers were found at all (all scores = 0)
    const fallbackMargin = templateType === 100 ? 0.04 : 0.02;
    const noMarkersAtAll = markers.topLeft.x === 0 && markers.topLeft.y === 0;
    const effectiveMarkers = noMarkersAtAll
      ? {
          topLeft: { x: width * fallbackMargin, y: height * fallbackMargin },
          topRight: { x: width * (1 - fallbackMargin), y: height * fallbackMargin },
          bottomLeft: { x: width * fallbackMargin, y: height * (1 - fallbackMargin) },
          bottomRight: { x: width * (1 - fallbackMargin), y: height * (1 - fallbackMargin) },
        }
      : {
          topLeft: markers.topLeft,
          topRight: markers.topRight,
          bottomLeft: markers.bottomLeft,
          bottomRight: markers.bottomRight,
        };

    // 4. Get template layout for this exam's question count
    const layout = getTemplateLayout(numQuestions);

    // 5. Detect student ID and answers using GRAYSCALE for bubble sampling
    const { studentId, doubleShadeColumns, rawIdDigits } = detectStudentIdFromImage(grayscale, width, height, effectiveMarkers, layout);
    const { answers, multipleAnswers, bubbleHits } = detectAnswersFromImage(
      grayscale, width, height, effectiveMarkers, layout, numQuestions, choicesPerQuestion
    );

    return { 
      studentId, 
      answers, 
      multipleAnswers, 
      idDoubleShades: doubleShadeColumns,
      rawIdDigits, // Include raw digit array for UI display
      markersFound: markers.found,
      markerConfidence: noMarkersAtAll ? 0 : markers.confidence,
      debugMarkers: effectiveMarkers,
      bubbleHits,
    };
  };

  // ─── BUBBLE SAMPLING (grayscale-based) ───
  // Returns a WEIGHTED MEAN BRIGHTNESS of the bubble interior (0-255).
  // LOWER value = DARKER = MORE LIKELY FILLED.
  //
  // Strategy:
  //  • Sample the inner 65% of the bubble radius (avoids the printed circle outline).
  //  • Weight pixels with a 2D Gaussian centred on the bubble centre so that
  //    a pencil mark anywhere inside — even if only at the centre — is detected,
  //    while edge noise from the printed circle is down-weighted.
  //  • Minimum-pool: return the min of the weighted mean and the darkest 10th-
  //    percentile brightness so that a small but very dark mark is not averaged away.
  const sampleBubbleAt = (
    grayscale: Uint8Array,
    imgW: number,
    imgH: number,
    cx: number,
    cy: number,
    radiusX: number,
    radiusY: number
  ): number => {
    const innerRX = radiusX * 0.65;
    const innerRY = radiusY * 0.65;
    // Gaussian σ = half the inner radius; weight falls to ~14% at the edge
    const sigX = innerRX * 0.5;
    const sigY = innerRY * 0.5;
    const step = Math.max(1, Math.floor(Math.min(innerRX, innerRY) / 5));

    let wSum = 0, sum = 0;
    const samples: number[] = [];

    for (let dy = -Math.ceil(innerRY); dy <= Math.ceil(innerRY); dy += step) {
      for (let dx = -Math.ceil(innerRX); dx <= Math.ceil(innerRX); dx += step) {
        if (innerRX > 0 && innerRY > 0 &&
            (dx * dx) / (innerRX * innerRX) + (dy * dy) / (innerRY * innerRY) > 1) continue;
        const px = Math.round(cx + dx);
        const py = Math.round(cy + dy);
        if (px < 0 || px >= imgW || py < 0 || py >= imgH) continue;
        const val = grayscale[py * imgW + px];
        // Gaussian weight (higher at centre, tapering to edges)
        const w = Math.exp(-0.5 * ((dx * dx) / (sigX * sigX + 1) + (dy * dy) / (sigY * sigY + 1)));
        sum += val * w;
        wSum += w;
        samples.push(val);
      }
    }

    if (wSum === 0) return 255;

    const weightedMean = sum / wSum;

    // Also compute the 10th-percentile brightness (darkest 10% of sampled pixels)
    // so that a small but solidly-filled centre patch is not diluted.
    samples.sort((a, b) => a - b);
    const p10 = samples.length > 0 ? samples[Math.floor(samples.length * 0.10)] : 255;

    // Return the lower (darker) of the two — catches both large-area fills and
    // concentrated centre-only fills (e.g. short pencil strokes).
    return Math.min(weightedMean, p10 * 0.85 + weightedMean * 0.15);
  };

  // ─── DETECT STUDENT ID ───
  // sampleBubbleAt returns RAW BRIGHTNESS (0-255): lower = darker = filled.
  // For each ID column (9 columns, digits 0-9), we find the DARKEST bubble.
  // Detection uses a robust approach:
  //   1. The darkest must be significantly darker than the MEDIAN of all 10 bubbles
  //   2. We use the gap between darkest and 2nd-darkest as additional confidence
  const detectStudentIdFromImage = (
    grayscale: Uint8Array,
    width: number,
    height: number,
    markers: {
      topLeft: { x: number; y: number };
      topRight: { x: number; y: number };
      bottomLeft: { x: number; y: number };
      bottomRight: { x: number; y: number };
    },
    layout: TemplateLayout
  ): { studentId: string; doubleShadeColumns: number[]; rawIdDigits: number[] } => {
    const { id } = layout;
    const idDigits: number[] = [];
    const doubleShadeColumns: number[] = [];

    const frameW = markers.topRight.x - markers.topLeft.x;
    const frameH = markers.bottomLeft.y - markers.topLeft.y;
    const bubbleRX = (layout.bubbleDiameterNX * frameW) / 2;
    const bubbleRY = (layout.bubbleDiameterNY * frameH) / 2;

    // ID bubbles are slightly smaller than answer bubbles
    const idBubbleRX = bubbleRX * (3.5 / 3.8);
    const idBubbleRY = bubbleRY * (3.5 / 3.8);

    console.log('[ID] BubbleR:', idBubbleRX.toFixed(1), 'x', idBubbleRY.toFixed(1));

    // Log the pixel position of the first and last ID bubbles for visual verification
    const firstIdPx = mapToPixel(markers, id.firstColNX, id.firstRowNY);
    const lastIdPx = mapToPixel(markers, id.firstColNX + 8 * id.colSpacingNX, id.firstRowNY + 9 * id.rowSpacingNY);
    console.log(`[ID] First bubble px=(${Math.round(firstIdPx.px)},${Math.round(firstIdPx.py)}), Last bubble px=(${Math.round(lastIdPx.px)},${Math.round(lastIdPx.py)})`);
    console.log(`[ID] Frame: TL=(${Math.round(markers.topLeft.x)},${Math.round(markers.topLeft.y)}) BR=(${Math.round(markers.bottomRight.x)},${Math.round(markers.bottomRight.y)}) size=${Math.round(frameW)}x${Math.round(frameH)}`);

    // Process 9 columns for 9-digit student IDs
    for (let col = 0; col < 9; col++) {
      const fills: number[] = []; // raw brightness values (lower = darker)

      for (let row = 0; row < 10; row++) {
        const nx = id.firstColNX + col * id.colSpacingNX;
        const ny = id.firstRowNY + row * id.rowSpacingNY;
        const { px, py } = mapToPixel(markers, nx, ny);
        const brightness = sampleBubbleAt(grayscale, width, height, px, py, idBubbleRX, idBubbleRY);
        fills.push(brightness);
      }

      // Sort ascending — lowest brightness = darkest = most filled
      const sorted = [...fills].sort((a, b) => a - b);
      const darkest = sorted[0];     // most filled
      const secondDark = sorted[1];  // second most filled
      // Use the upper quartile (index 7) as the "unfilled" reference
      // This is more robust than median — unfilled bubbles should be bright
      const upperQ = sorted[7];

      let detectedDigit: number | null = null; // null means no detection (unshaded column)
      let hasDetection = false;

      // ── Detection thresholds (calibrated for Gaussian-weighted sampler) ──
      //
      // sampleBubbleAt now returns a Gaussian-weighted mean blended with the p10
      // darkest sample, so filled bubbles appear darker than before.
      //
      // Tier 1 – Strong fill (clear dark mark):
      //   darkest < 68% of upper-quartile reference  → definite fill
      // Tier 2 – Light fill (light pencil / faded ink):
      //   darkest < 82% of upper-quartile  AND  gap to 2nd > 12% of reference
      //   → probably intentional (stands out from neighbours)
      const darkRatio = upperQ > 20 ? darkest / upperQ : 1;
      const gapFromSecond = secondDark - darkest;
      const gapRatio = upperQ > 20 ? gapFromSecond / upperQ : 0;

      if (darkRatio < 0.68) {
        detectedDigit = fills.indexOf(darkest);
        hasDetection = true;
      } else if (darkRatio < 0.82 && gapRatio > 0.12) {
        detectedDigit = fills.indexOf(darkest);
        hasDetection = true;
      }

      if (hasDetection && detectedDigit !== null) {
        // Double-shade: 2nd-darkest is also quite dark AND close to darkest
        const secondRatio = upperQ > 20 ? secondDark / upperQ : 1;
        const gapBetweenTopTwo = upperQ > 20 ? gapFromSecond / upperQ : 1;
        if (secondRatio < 0.76 && gapBetweenTopTwo < 0.09) {
          doubleShadeColumns.push(col + 1);
          console.log(`[ID] ⚠️ Col ${col} DOUBLE SHADE: darkest=${darkest.toFixed(0)} 2nd=${secondDark.toFixed(0)} upperQ=${upperQ.toFixed(0)}`);
          idDigits.push(-2);
          continue;
        }
      }

      // NULL LOGIC: If no bubble is shaded, use -1 placeholder (not '0')
      // This prevents unshaded columns from corrupting the ID (e.g., 9 digits → 10)
      // The digit '0' should ONLY appear if the '0' bubble is actually shaded
      const digitChar = hasDetection && detectedDigit !== null ? String(detectedDigit) : '_';
      
      console.log(`[ID] Col ${col}: brightness=[${fills.map(f => f.toFixed(0)).join(',')}] → ${digitChar} (darkest=${darkest.toFixed(0)} upperQ=${upperQ.toFixed(0)} ratio=${darkRatio.toFixed(2)} gap=${gapRatio.toFixed(2)})`);
      idDigits.push(hasDetection && detectedDigit !== null ? detectedDigit : -1); // -1 = unshaded, -2 = double-shade
    }

    // Convert digits to string, using '_' for unshaded (-1) and '?' for double-shade (-2)
    // Then strip placeholders and return only the cleanly detected digits
    const rawWithPlaceholders = idDigits.map(d => d === -1 ? '_' : d === -2 ? '?' : String(d)).join('');
    
    // For the final ID, exclude both unshaded (-1) and double-shaded (-2) columns
    const cleanId = idDigits.filter(d => d >= 0).map(d => String(d)).join('');
    
    console.log('[ID] Raw with placeholders:', rawWithPlaceholders);
    console.log('[ID] Clean ID:', cleanId, cleanId.length, 'digits', doubleShadeColumns.length > 0 ? `(double-shade: cols ${doubleShadeColumns.join(',')})` : '');
    
    // Return both the clean ID and the raw digit array for UI display
    return { studentId: cleanId, doubleShadeColumns, rawIdDigits: idDigits };
  };

  // ─── DETECT ANSWERS ───
  // sampleBubbleAt returns RAW BRIGHTNESS (0-255): lower = darker = filled.
  // For each question, the darkest choice wins if it's sufficiently darker than the rest.
  // Uses the BRIGHTEST bubble in the row as the "unfilled" reference — this is more
  // robust than using a median when there are only 4-5 choices.
  const detectAnswersFromImage = (
    grayscale: Uint8Array,
    width: number,
    height: number,
    markers: {
      topLeft: { x: number; y: number };
      topRight: { x: number; y: number };
      bottomLeft: { x: number; y: number };
      bottomRight: { x: number; y: number };
    },
    layout: TemplateLayout,
    numQuestions: number,
    choicesPerQuestion: number
  ): { answers: string[]; multipleAnswers: number[]; bubbleHits: Array<{ px: number; py: number; rx: number; ry: number; choice: string; qIndex: number }> } => {
    const answers = new Array<string>(numQuestions).fill('');
    const multipleAnswers: number[] = [];
    const bubbleHits: Array<{ px: number; py: number; rx: number; ry: number; choice: string; qIndex: number }> = [];
    const choiceLabels = 'ABCDEFGH'.slice(0, choicesPerQuestion).split('');

    const frameW = markers.topRight.x - markers.topLeft.x;
    const frameH = markers.bottomLeft.y - markers.topLeft.y;
    const bubbleRX = (layout.bubbleDiameterNX * frameW) / 2;
    const bubbleRY = (layout.bubbleDiameterNY * frameH) / 2;

    console.log(`[ANS] Frame: ${Math.round(frameW)}x${Math.round(frameH)}px, BubbleR: ${bubbleRX.toFixed(1)}x${bubbleRY.toFixed(1)}px`);

    for (const block of layout.answerBlocks) {
      const firstPx = mapToPixel(markers, block.firstBubbleNX, block.firstBubbleNY);
      console.log(`[ANS] Block Q${block.startQ}-${block.endQ}: firstBubble px=(${Math.round(firstPx.px)},${Math.round(firstPx.py)})`);

      for (let q = block.startQ; q <= block.endQ && q <= numQuestions; q++) {
        const qIndex = q - 1;
        const rowInBlock = q - block.startQ;

        const fills: { choice: string; brightness: number; px: number; py: number }[] = [];

        for (let c = 0; c < choicesPerQuestion; c++) {
          const nx = block.firstBubbleNX + c * block.bubbleSpacingNX;
          const ny = block.firstBubbleNY + rowInBlock * block.rowSpacingNY;
          const { px, py } = mapToPixel(markers, nx, ny);
          const brightness = sampleBubbleAt(grayscale, width, height, px, py, bubbleRX, bubbleRY);
          fills.push({ choice: choiceLabels[c], brightness, px, py });
        }

        // Sort ASCENDING by brightness — darkest (most filled) first
        const sorted = [...fills].sort((a, b) => a.brightness - b.brightness);
        const darkest = sorted[0].brightness;
        const secondDark = sorted.length >= 2 ? sorted[1].brightness : 255;
        const brightest = sorted[sorted.length - 1].brightness;

        let selectedChoice = '';

        // Use the brightest bubble as the "unfilled" reference.
        // For a row of N choices, at most 1 is filled — the brightest N-1 are unfilled.
        const ref = brightest;
        const darkRatio = ref > 20 ? darkest / ref : 1;
        const gapFromSecond = secondDark - darkest;
        const gapRatio = ref > 20 ? gapFromSecond / ref : 0;

        // ── Detection tiers (Gaussian-weighted sampler) ──
        // Tier 1 – Strong fill:   darkest < 68% of brightest  → definite mark
        // Tier 2 – Light fill:    darkest < 82% of brightest  AND gap to 2nd > 12%
        //          → intentional light mark (pen nearly dry, hard-pressure pencil, etc.)
        if (darkRatio < 0.68) {
          selectedChoice = sorted[0].choice;
        } else if (darkRatio < 0.82 && gapRatio > 0.12) {
          selectedChoice = sorted[0].choice;
        }

        // Check for multiple answers (flag but still use darkest)
        if (selectedChoice) {
          const secondRatio = ref > 20 ? secondDark / ref : 1;
          const gapBetweenTopTwo = ref > 20 ? gapFromSecond / ref : 1;
          // Multiple answers: 2nd darkest must be clearly filled (<70% of ref) AND very
          // close to the darkest (<7% gap). Stricter thresholds reduce false positives
          // from print noise / slight ink absorption near empty bubbles.
          if (secondRatio < 0.70 && gapBetweenTopTwo < 0.07) {
            multipleAnswers.push(q);
            console.log(`[MULTI] Q${q}: ${sorted.slice(0, 3).map(f => `${f.choice}=${f.brightness.toFixed(0)}`).join(', ')} ref=${ref.toFixed(0)}`);
          }
        }

        // Log first few questions per block + last for debugging
        if (q <= block.startQ + 2 || q === block.endQ) {
          console.log(`[ANS] Q${q}: ${fills.map(f => `${f.choice}=${f.brightness.toFixed(0)}`).join(', ')} → ${selectedChoice || '?'} (darkRatio=${darkRatio.toFixed(2)} gapRatio=${gapRatio.toFixed(2)} ref=${ref.toFixed(0)})`);
        }

        answers[qIndex] = selectedChoice;

        // Record bubble hit for overlay drawing
        if (selectedChoice) {
          const hit = fills.find(f => f.choice === selectedChoice);
          if (hit) bubbleHits.push({ px: hit.px, py: hit.py, rx: bubbleRX, ry: bubbleRY, choice: selectedChoice, qIndex });
        }
      }
    }
    return { answers, multipleAnswers, bubbleHits };
  };

  // Calculate letter grade
  const calculateLetterGrade = (percentage: number): string => {
    if (percentage >= 90) return 'A';
    if (percentage >= 85) return 'A-';
    if (percentage >= 80) return 'B+';
    if (percentage >= 75) return 'B';
    if (percentage >= 70) return 'C+';
    if (percentage >= 65) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  };

  // Get grade color
  const getGradeColor = (grade: string): string => {
    if (grade.startsWith('A')) return 'text-emerald-700 bg-emerald-100 border border-emerald-200';
    if (grade.startsWith('B')) return 'text-blue-700 bg-blue-100 border border-blue-200';
    if (grade.startsWith('C')) return 'text-amber-700 bg-amber-100 border border-amber-200';
    if (grade.startsWith('D')) return 'text-orange-700 bg-orange-100 border border-orange-200';
    return 'text-rose-700 bg-rose-100 border border-rose-200';
  };

  // Save scan result
  const saveScanResult = async () => {
    if (!scanResult || !user || !exam) return;

    // Block saving if student ID has errors
    if (studentIdError) {
      toast.error('Cannot save: Student ID is not registered in this class. Please correct the Student ID first.');
      return;
    }
    if (idDoubleShadeColumns.length > 0) {
      toast.error('Cannot save: Student ID has columns with multiple bubbles shaded. Please correct the Student ID first.');
      return;
    }

    // Block saving if no class is linked or student is not in the class
    if (!classData) {
      toast.error('Cannot save: No class is linked to this exam. Please assign a class to the exam first.');
      setStudentIdError('No class is linked to this exam. Please go to exam settings and assign a class before scanning.');
      return;
    }

    const student = classData.students.find(s => s.student_id === detectedStudentId);
    if (!student) {
      toast.error(`Cannot save: Student ID "${detectedStudentId}" is not registered in class "${classData.class_name} - ${classData.course_subject}${classData.year ? ` ${classData.year}` : ''}".`);
      setStudentIdError(`Student ID "${detectedStudentId}" is not registered in class "${classData.class_name} - ${classData.course_subject}${classData.year ? ` ${classData.year}` : ''}". Please verify the student is enrolled in this class.`);
      return;
    }
    
    setSaving(true);
    try {
      const isNullId = !detectedStudentId || detectedStudentId === '0000000000';
      
      const result = await ScanningService.saveScannedResult(
        examId,
        detectedStudentId || `NULL_${Date.now()}`,
        detectedAnswers as AnswerChoice[],
        answerKey,
        user.id,
        isNullId,
        exam.choicePoints
      );
      
      if (result.success) {
        toast.success('Scan saved successfully!');
        setRecentScans(prev => [scanResult, ...prev.slice(0, 9)]);
        
        // Reset for next scan
        setScanResult(null);
        setDetectedAnswers([]);
        setDetectedStudentId('');
        setMatchedStudent(null);
        setStudentIdError(null);
        setMultipleAnswerQuestions([]);
        setIdDoubleShadeColumns([]);
        setAlignmentError(null);
        setCapturedImage(null);
        // Reset 200-item two-pass state
        setScanPage(1);
        setPage1Answers([]);
        setPage1StudentId('');
        isAutoCapturingRef.current = false;
        setMode('camera');
        startCamera();
      } else {
        toast.error(result.error || 'Failed to save scan');
      }
    } catch (error) {
      console.error('Error saving scan:', error);
      toast.error('Failed to save scan result');
    } finally {
      setSaving(false);
    }
  };

  // Edit a single digit in the Student ID digit boxes
  const editIdDigit = (colIndex: number, newValue: string) => {
    // Only allow 0-9 or empty
    if (newValue !== '' && !/^[0-9]$/.test(newValue)) return;
    const newDigits = [...rawIdDigits];
    newDigits[colIndex] = newValue === '' ? -1 : parseInt(newValue, 10);
    setRawIdDigits(newDigits);
    // Clear double-shade flag for this column
    setIdDoubleShadeColumns(prev => prev.filter(c => c !== colIndex + 1));
    // Rebuild the detectedStudentId from the updated digits
    const newId = newDigits.filter(d => d >= 0).map(d => String(d)).join('');
    setDetectedStudentId(newId);
    // Re-validate
    if (!newId || /^0+$/.test(newId)) {
      setStudentIdError('No Student ID provided. Please enter a valid Student ID.');
      setMatchedStudent(null);
    } else if (!classData) {
      setStudentIdError('No class is linked to this exam.');
      setMatchedStudent(null);
    } else {
      const student = classData.students.find(s => s.student_id === newId);
      if (student) {
        setMatchedStudent(student);
        setStudentIdError(null);
      } else {
        setMatchedStudent(null);
        setStudentIdError(`Student ID "${newId}" is not registered in class "${classData.class_name} - ${classData.course_subject}${classData.year ? ` ${classData.year}` : ''}". Please verify the student is enrolled in this class or check if the ID was shaded correctly.`);
      }
    }
  };

  // Edit detected answer
  const editAnswer = (index: number, newValue: string) => {
    const upper = newValue.toUpperCase();
    if (upper.length <= 1 && /^[A-Z]?$/.test(upper)) {
      const choiceLimit = String.fromCharCode(64 + (exam?.choices_per_item || 4));
      if (!upper || upper <= choiceLimit) {
        const newAnswers = [...detectedAnswers];
        newAnswers[index] = upper;
        setDetectedAnswers(newAnswers);
        
        // Recalculate score
        let score = 0;
        const totalQuestions = Math.min(newAnswers.length, answerKey.length);
        for (let i = 0; i < totalQuestions; i++) {
          if (newAnswers[i] && answerKey[i] && newAnswers[i].toUpperCase() === answerKey[i].toUpperCase()) {
            score++;
          }
        }
        const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
        
        setScanResult(prev => prev ? {
          ...prev,
          answers: newAnswers,
          score,
          percentage,
          letterGrade: calculateLetterGrade(percentage)
        } : null);
      }
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  // No exam found
  if (!exam) {
    return (
      <div className="space-y-6">
        <BackButton href="/exams" asLink>
          Back to Exams
        </BackButton>
        <Card className="p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900">Exam Not Found</h2>
          <p className="text-gray-600 mt-2">The exam you're looking for doesn't exist.</p>
        </Card>
      </div>
    );
  }

  // No answer key
  if (answerKey.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="border border-gray-100 shadow-sm rounded-2xl bg-white overflow-hidden">
          {/* Top bar with back button */}
          <div className="flex items-center px-5 py-4 border-b border-gray-100">
            <BackButton href={`/exams/${examId}`} asLink className="text-sm font-medium text-gray-500 hover:text-gray-800 gap-1.5 px-0 py-0 hover:bg-transparent">
              Back to Exam
            </BackButton>
          </div>
          {/* Empty state body */}
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mb-5">
              <AlertCircle className="w-7 h-7 text-amber-500" />
            </div>
            <h2 className="text-[17px] font-bold text-[#1e293b] mb-2">Answer Key Required</h2>
            <p className="text-sm text-gray-400 max-w-xs leading-relaxed mb-6">
              Please set up the answer key before scanning papers.
            </p>
            <Link href={`/exams/${examId}/edit-key`}>
              <Button className="h-10 px-6 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl shadow-sm shadow-green-500/20 transition-all">
                Set Up Answer Key
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton href={`/exams/${examId}`} asLink className="p-2 hover:bg-gray-100 rounded-lg transition-colors" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Scan Answer Sheets</h1>
            <p className="text-gray-600">{exam.title} • {exam.num_items} questions</p>
          </div>
        </div>
        {recentScans.length > 0 && (
          <div className="text-sm text-gray-600">
            <CheckCircle className="w-4 h-4 inline mr-1 text-green-600" />
            {recentScans.length} scanned this session
          </div>
        )}
      </div>

      {/* Mode: Camera */}
      {mode === 'camera' && (
        <Card className="overflow-hidden">
          {/* 200-item: show which page we're scanning */}
          {getTemplateType() === 200 && (
            <div className="flex items-center justify-center gap-2 py-2 bg-emerald-800 text-white text-sm font-semibold">
              <span className="bg-white/20 rounded px-2 py-0.5">Page {scanPage} of 2</span>
              <span>{scanPage === 1 ? 'Scanning Questions 1–100' : 'Scanning Questions 101–200'}</span>
            </div>
          )}
          <div className="relative bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-auto block"
            />
            {/* Full-video canvas overlay — draws live green squares on detected corner markers */}
            <canvas
              ref={liveOverlayRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ mixBlendMode: 'normal' }}
            />
            {/* Status label + progress bar */}
            {(() => {
              const t = getTemplateType();
              const label = markersDetected
                ? stabilizationProgress >= 100
                  ? '✓ Capturing now...'
                  : `Hold steady... ${stabilizationProgress}%`
                : `Align ${t}-item sheet within the frame`;
              return (
                <>
                  {/* Progress bar */}
                  {markersDetected && stabilizationProgress < 100 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30 overflow-hidden">
                      <div
                        className="h-full bg-green-400 transition-all duration-150"
                        style={{ width: `${stabilizationProgress}%` }}
                      />
                    </div>
                  )}
                  {/* Capture button overlay — large, inside the camera frame for easy tap */}
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-3 pointer-events-none">
                    <div className="pointer-events-auto flex items-center gap-3">
                      <button
                        onClick={() => fileUploadRef.current?.click()}
                        className="bg-white/95 hover:bg-white text-gray-700 font-bold text-sm px-5 py-2.5 rounded-full shadow-lg border-2 border-gray-300 flex items-center gap-2 transition-all active:scale-95"
                      >
                        📁 Upload
                      </button>
                      <button
                        onClick={() => {
                          console.log('[ManualCapture] User tapped manual capture button');
                          captureAndProcess();
                        }}
                        className="bg-white/95 hover:bg-white text-emerald-800 font-bold text-sm px-5 py-2.5 rounded-full shadow-lg border-2 border-emerald-800/30 flex items-center gap-2 transition-all active:scale-95"
                      >
                        📷 Capture
                      </button>
                      <p className={`whitespace-nowrap text-white text-xs ${markersDetected ? 'bg-green-600/80' : 'bg-black/60'} px-3 py-1.5 rounded-full transition-colors duration-200`}>
                        {label}
                      </p>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
          <div className="p-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={stopCamera}>
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          </div>
          {/* Hidden file input for image upload */}
          <input
            ref={fileUploadRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                const dataUrl = ev.target?.result as string;
                stopCamera();
                setCapturedImage(dataUrl);
                setMode('processing');
              };
              reader.readAsDataURL(file);
              e.target.value = '';
            }}
          />
        </Card>
      )}

      {/* Mode: Processing */}
      {mode === 'processing' && (
        <Card className="p-12 text-center">
          <div className="space-y-6">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Scanning Document</h3>
              <p className="text-gray-600 mt-2">
                Straightening paper, enhancing image, and reading bubbles...
              </p>
            </div>
            <div className="max-w-xs mx-auto space-y-2">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-800 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
              <p className="text-xs text-gray-400">Brightness enhancement • Corner marker detection • OMR bubble reading</p>
            </div>
          </div>
        </Card>
      )}

      {/* Mode: Results */}
      {mode === 'results' && scanResult && (
        <div className="space-y-6">
          {/* Debug overlay image — shows marker positions & ID grid on scanned image */}
          {capturedImage && (
            <Card className="overflow-hidden">
              <div className="relative bg-gray-100">
                <img
                  src={capturedImage}
                  alt="Debug overlay"
                  className="w-full max-h-[50vh] object-contain mx-auto"
                />
              </div>
            </Card>
          )}

          {/* Sheet Alignment Error - CRITICAL */}
          {alignmentError && (
            <Card className="p-4 border-rose-300 bg-rose-50 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-rose-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-rose-900">Sheet Alignment Error</h4>
                  <p className="text-sm text-rose-700 mt-1">{alignmentError}</p>
                  <div className="mt-3 flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-rose-400 text-rose-700 hover:bg-rose-100"
                      onClick={() => {
                        setScanResult(null);
                        setDetectedAnswers([]);
                        setDetectedStudentId('');
                        setMatchedStudent(null);
                        setStudentIdError(null);
                        setMultipleAnswerQuestions([]);
                        setIdDoubleShadeColumns([]);
                        setCapturedImage(null);
                        setAlignmentError(null);
                        // Reset 200-item two-pass state
                        setScanPage(1);
                        setPage1Answers([]);
                        setPage1StudentId('');
                        isAutoCapturingRef.current = false;
                        setMode('camera');
                        startCamera();
                      }}
                    >
                      Retake Photo
                    </Button>
                  </div>
                  <p className="text-xs text-red-600 mt-3">
                    <strong>Tips:</strong> Ensure all 4 black corner markers are visible • Hold the camera steady • Avoid shadows on the paper • Keep the sheet flat
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Student ID Double Shade Error */}
          {idDoubleShadeColumns.length > 0 && (
            <Card className="p-4 border-amber-300 bg-amber-50 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-amber-900">Multiple Bubbles Shaded in Student ID</h4>
                  <p className="text-sm text-amber-800 mt-1">
                    Column(s) <strong>{idDoubleShadeColumns.join(', ')}</strong> of the Student ID have more than one bubble shaded. Each column must have only <strong>one digit</strong> selected.
                  </p>
                  <p className="text-xs text-amber-700 mt-2">
                    Please ask the student to properly shade only one bubble per column, or manually correct the Student ID below.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Student ID Not Found Error */}
          {studentIdError && idDoubleShadeColumns.length === 0 && (
            <Card className="p-4 border-rose-300 bg-rose-50 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-rose-900">Student ID Not Found</h4>
                  <p className="text-sm text-rose-700 mt-1">{studentIdError}</p>
                  <p className="text-xs text-rose-500 mt-2">
                    You must correct the Student ID before saving. Edit the ID field below or discard and re-scan.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Multiple Answers Warning */}
          {multipleAnswerQuestions.length > 0 && (
            <Card className="p-4 border-amber-300 bg-amber-50 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-amber-900">Multiple Answers Detected</h4>
                  <p className="text-sm text-amber-800 mt-1">
                    The following question(s) have more than one bubble shaded: <strong>
                    {multipleAnswerQuestions.map(q => `#${q}`).join(', ')}
                    </strong>
                  </p>
                  <p className="text-xs text-amber-600 mt-2">
                    Only one answer per question is allowed. The system selected the darkest bubble, but please verify and correct if needed. Remind the student to shade only one bubble per question.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Score Summary */}
          <Card className="p-4 sm:p-6">
            <div className="flex flex-col gap-4">
              {/* Top row: student info + grade */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                    (studentIdError || idDoubleShadeColumns.length > 0) ? 'bg-rose-100' : matchedStudent ? 'bg-emerald-100' : 'bg-slate-100'
                  }`}>
                    <User className={`w-6 h-6 ${
                      (studentIdError || idDoubleShadeColumns.length > 0) ? 'text-rose-500' : matchedStudent ? 'text-emerald-600' : 'text-slate-500'
                    }`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">Student ID</p>
                    <input
                      type="text"
                      value={detectedStudentId}
                      onChange={(e) => {
                        const newId = e.target.value;
                        setDetectedStudentId(newId);
                        setIdDoubleShadeColumns([]);
                        setRawIdDigits([]);
                        if (!newId || /^0+$/.test(newId)) {
                          setStudentIdError('No Student ID provided. Please enter a valid Student ID.');
                          setMatchedStudent(null);
                        } else if (!classData) {
                          setStudentIdError('No class is linked to this exam. Please go to exam settings and assign a class before scanning.');
                          setMatchedStudent(null);
                        } else {
                          const student = classData.students.find(s => s.student_id === newId);
                          if (student) {
                            setMatchedStudent(student);
                            setStudentIdError(null);
                          } else {
                            setMatchedStudent(null);
                            setStudentIdError(`Student ID "${newId}" is not registered in class "${classData.class_name} - ${classData.course_subject}${classData.year ? ` ${classData.year}` : ''}". Please verify the student is enrolled in this class or check if the ID was shaded correctly.`);
                          }
                        }
                      }}
                      className={`text-lg font-bold bg-transparent border-b-2 transition-colors focus:outline-none w-full max-w-[180px] ${
                        (studentIdError || idDoubleShadeColumns.length > 0)
                          ? 'text-rose-700 border-rose-300 focus:border-rose-500'
                          : 'text-slate-800 border-transparent hover:border-slate-300 focus:border-emerald-600'
                      }`}
                      placeholder="Enter Student ID"
                    />
                    {matchedStudent && (
                      <p className="text-xs text-emerald-700 font-semibold mt-0.5 truncate">
                        {matchedStudent.first_name} {matchedStudent.last_name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`inline-block px-3 py-1.5 rounded-lg text-2xl font-bold ${getGradeColor(scanResult.letterGrade)}`}>
                    {scanResult.letterGrade}
                  </div>
                  <p className="text-slate-500 text-sm font-medium mt-1">
                    {scanResult.score}/{scanResult.totalQuestions} ({scanResult.percentage}%)
                  </p>
                </div>
              </div>

              {/* Digit boxes: editable, one per column */}
              {rawIdDigits.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">
                    Scanned ID Columns — tap a box to correct it:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {rawIdDigits.map((digit, idx) => {
                      const isUnshaded = digit === -1;
                      const hasDoubleShade = digit === -2;
                      return (
                        <div key={idx} className="flex flex-col items-center gap-0.5">
                          <span className="text-[10px] text-gray-400">{idx + 1}</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={hasDoubleShade || isUnshaded ? '' : String(digit)}
                            placeholder={hasDoubleShade ? '?' : '–'}
                            onChange={(e) => editIdDigit(idx, e.target.value)}
                            className={`w-8 h-9 text-center text-sm font-bold rounded border-2 focus:outline-none focus:ring-2 transition-colors ${
                              hasDoubleShade
                                ? 'border-amber-400 bg-amber-50 text-amber-700 placeholder-amber-400 focus:ring-amber-200'
                                : isUnshaded
                                  ? 'border-gray-200 bg-gray-50 text-gray-400 placeholder-gray-300 focus:ring-gray-200'
                                  : 'border-emerald-500 bg-emerald-50 text-emerald-700 focus:ring-emerald-200'
                            }`}
                            title={
                              hasDoubleShade
                                ? `Column ${idx + 1}: Multiple bubbles — tap to fix`
                                : isUnshaded
                                  ? `Column ${idx + 1}: No bubble shaded — tap to fill`
                                  : `Column ${idx + 1}: Digit ${digit}`
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-3 rounded border-2 border-emerald-500 bg-emerald-50" />
                      Detected
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-3 rounded border-2 border-amber-400 bg-amber-50" />
                      Double-shaded
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-3 rounded border-2 border-gray-200 bg-gray-50" />
                      Unshaded
                    </span>
                  </div>
                </div>
              )}

              {debugInfo && (
                <p className="text-xs text-gray-400 font-mono break-all">{debugInfo}</p>
              )}
            </div>
          </Card>

          {/* Answer Comparison */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Answer Comparison</h3>
            
            {(() => {
              const halfPoint = Math.ceil(detectedAnswers.length / 2);
              const firstRow = detectedAnswers.slice(0, halfPoint);
              const secondRow = detectedAnswers.slice(halfPoint);
              
              return (
                <div className="space-y-6">
                  <div>
                    <p className="text-sm font-semibold text-slate-500 mb-2">Questions 1-{halfPoint}</p>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                      {firstRow.map((answer, i) => {
                        const isCorrect = answerKey[i] && answer.toUpperCase() === answerKey[i].toUpperCase();
                        const hasMultiple = multipleAnswerQuestions.includes(i + 1);
                        return (
                          <div key={i} className="text-center">
                            <span className={`text-xs block mb-1 ${hasMultiple ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>{i + 1}</span>
                            <div className="relative">
                              <input
                                type="text"
                                value={answer}
                                onChange={(e) => editAnswer(i, e.target.value)}
                                maxLength={1}
                                className={`w-10 h-10 text-center font-bold rounded-lg border-2 transition-colors ${
                                  hasMultiple
                                    ? 'border-amber-500 bg-amber-50 text-amber-700 ring-2 ring-amber-200'
                                    : isCorrect 
                                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                                      : answer 
                                        ? 'border-rose-500 bg-rose-50 text-rose-700'
                                        : 'border-gray-200 bg-gray-50 text-gray-400'
                                }`}
                              />
                              {hasMultiple && (
                                <AlertTriangle className="absolute -top-2 -right-2 w-4 h-4 text-amber-500" />
                              )}
                              {answerKey[i] && !isCorrect && (
                                <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-emerald-600 font-semibold">
                                  {answerKey[i]}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {secondRow.length > 0 && (
                    <div className="pt-4 border-t border-gray-100">
                      <p className="text-sm font-semibold text-slate-500 mb-2">Questions {halfPoint + 1}-{detectedAnswers.length}</p>
                      <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                        {secondRow.map((answer, i) => {
                          const actualIndex = halfPoint + i;
                          const isCorrect = answerKey[actualIndex] && answer.toUpperCase() === answerKey[actualIndex].toUpperCase();
                          const hasMultiple = multipleAnswerQuestions.includes(actualIndex + 1);
                          return (
                            <div key={actualIndex} className="text-center">
                              <span className={`text-xs block mb-1 ${hasMultiple ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>{actualIndex + 1}</span>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={answer}
                                  onChange={(e) => editAnswer(actualIndex, e.target.value)}
                                  maxLength={1}
                                  className={`w-10 h-10 text-center font-bold rounded-lg border-2 transition-colors ${
                                    hasMultiple
                                      ? 'border-amber-500 bg-amber-50 text-amber-700 ring-2 ring-amber-200'
                                      : isCorrect 
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                                        : answer 
                                          ? 'border-rose-500 bg-rose-50 text-rose-700'
                                          : 'border-gray-200 bg-gray-50 text-gray-400'
                                  }`}
                                />
                                {hasMultiple && (
                                  <AlertTriangle className="absolute -top-2 -right-2 w-4 h-4 text-amber-500" />
                                )}
                                {answerKey[actualIndex] && !isCorrect && (
                                  <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-emerald-600 font-semibold">
                                    {answerKey[actualIndex]}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            <div className="flex items-center gap-4 mt-6 pt-4 border-t border-gray-100 text-sm flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 bg-emerald-50 border-2 border-emerald-500 rounded" />
                <span className="text-slate-600">Correct</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 bg-rose-50 border-2 border-rose-500 rounded" />
                <span className="text-slate-600">Incorrect</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 bg-gray-50 border-2 border-gray-200 rounded" />
                <span className="text-slate-500">No answer detected</span>
              </div>
              {multipleAnswerQuestions.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 bg-amber-50 border-2 border-amber-500 rounded relative">
                    <AlertTriangle className="absolute -top-1 -right-1 w-3 h-3 text-amber-500" />
                  </div>
                  <span className="text-amber-700 font-medium">Multiple answers</span>
                </div>
              )}
            </div>
          </Card>

          <div className="flex justify-center gap-4">
            <Button variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors" onClick={() => {
              setScanResult(null);
              setDetectedAnswers([]);
              setDetectedStudentId('');
              setMatchedStudent(null);
              setStudentIdError(null);
              setMultipleAnswerQuestions([]);
              setIdDoubleShadeColumns([]);
              setRawIdDigits([]); // Clear raw ID digit display
              setAlignmentError(null);
              setCapturedImage(null);
              // Reset 200-item two-pass state
              setScanPage(1);
              setPage1Answers([]);
              setPage1StudentId('');
              isAutoCapturingRef.current = false;
              setMode('camera');
              startCamera();
            }}>
              <X className="w-4 h-4 mr-2" />
              Discard & Scan Again
            </Button>
            <Button 
              onClick={() => {
                if (idDoubleShadeColumns.length > 0) {
                  toast.error('Student ID has multiple bubbles shaded. Please correct the ID before saving.');
                  return;
                }
                if (studentIdError) {
                  toast.error('Please correct the Student ID before saving. The student must be registered in this class.');
                  return;
                }
                saveScanResult();
              }}
              disabled={saving || !!studentIdError || idDoubleShadeColumns.length > 0}
              className={`transition-colors ${(studentIdError || idDoubleShadeColumns.length > 0) ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20'}`}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Result
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Recent Scans */}
      {recentScans.length > 0 && mode === 'camera' && (
        <Card className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Scans This Session</h3>
          <div className="space-y-2">
            {recentScans.map((scan, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium">{scan.studentId}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-gray-600">{scan.score}/{scan.totalQuestions}</span>
                  <span className={`px-2 py-1 rounded text-sm font-bold ${getGradeColor(scan.letterGrade)}`}>
                    {scan.letterGrade}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Hidden canvases for processing */}
      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={processingCanvasRef} className="hidden" />
      <canvas ref={scanCanvasRef} className="hidden" />
    </div>
  );
}
