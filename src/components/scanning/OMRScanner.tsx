'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft,
  X,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Save,
  User,
  Camera
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getExamById, Exam } from '@/services/examService';
import { AnswerKeyService } from '@/services/answerKeyService';
import { ScanningService } from '@/services/scanningService';
import { getClassById, getClasses, Class, Student } from '@/services/classService';
import { toast } from 'sonner';
import { AnswerChoice } from '@/types/scanning';

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
                `${c.class_name} - ${c.section_block}` === examData.className
              );
              if (matchedClass) {
                setClassData(matchedClass);
              }
            } catch (e) {
              console.warn('Could not find class by name:', e);
            }
          }
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
  const getTemplateType = (): 20 | 50 | 100 => {
    const numQ = exam?.num_items || 20;
    return numQ <= 20 ? 20 : numQ <= 50 ? 50 : 100;
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
    // These match the CSS guide overlay exactly
    // 100-item uses a tighter frame (90%) to minimize background inclusion
    const guideWidthFraction = t === 20 ? 0.75 : t === 50 ? 0.55 : 0.90;
    const paperAspect = t === 20 ? (105 / 148.5) : t === 50 ? (105 / 297) : (210 / 297); // width / height

    // In normalized coordinates (0-1 of video):
    let guideW = guideWidthFraction; // fraction of video width
    let guideH = (guideW * videoWidth) / (paperAspect * videoHeight); // fraction of video height

    // If the guide is taller than the video, clamp to video height and recalculate width
    if (guideH > 0.95) {
      guideH = 0.95;
      guideW = (guideH * videoHeight * paperAspect) / videoWidth;
    }

    // Center the crop
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
  // Returns true if 4 dark squares are found in approximately the right positions.
  const detectMarkersInFrame = useCallback((): boolean => {
    if (!videoRef.current || !scanCanvasRef.current) return false;
    
    const video = videoRef.current;
    if (video.readyState < 2) return false; // HAVE_CURRENT_DATA
    if (video.videoWidth === 0 || video.videoHeight === 0) return false;
    
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const crop = getGuideCropRegion(vw, vh);
    
    const scanCanvas = scanCanvasRef.current;
    const ctx = scanCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    
    // Use ~320px wide for better detection accuracy
    const targetW = 320;
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
    
    // Marker is ~3.3% of paper width → ~10px at 320px wide
    const markerSize = Math.max(6, Math.round(dw * 0.035));
    const half = Math.floor(markerSize / 2);
    const step = Math.max(2, Math.floor(markerSize / 3));
    
    const avgBrightness = (x1: number, y1: number, x2: number, y2: number): number => {
      x1 = Math.max(0, Math.floor(x1));
      y1 = Math.max(0, Math.floor(y1));
      x2 = Math.min(dw, Math.floor(x2));
      y2 = Math.min(dh, Math.floor(y2));
      if (x2 <= x1 || y2 <= y1) return 255;
      let sum = 0, count = 0;
      for (let py = y1; py < y2; py += 2) {
        for (let px = x1; px < x2; px += 2) {
          sum += gray[py * dw + px];
          count++;
        }
      }
      return count > 0 ? sum / count : 255;
    };
    
    // Define search regions for each corner.
    // For rotated sheets (up to ~30°), markers may shift from their expected positions.
    // Expand search regions to accommodate rotation.
    // For 100-item: bottom markers are at ~75% of page height, not at the page bottom.
    // The guide frame crops the full page, so bottom markers are at ~75% of frame height.
    const t = getTemplateType();
    // Increase margin for rotated sheets - markers can shift horizontally
    const margin = Math.round(dw * 0.30); // 30% of width for horizontal search (increased from 20%)
    const topH = Math.round(dh * 0.30);   // top 30% for top markers (increased from 20%)
    
    // Bottom markers: for 100-item, they're at ~75% down (markers at Y=222 on 297mm page)
    // Search from 50% to 95% of frame height for 100-item, bottom 40% for others
    const botY1 = t === 100 ? Math.round(dh * 0.50) : Math.round(dh * 0.60);
    const botY2 = t === 100 ? Math.round(dh * 0.95) : dh;
    
    const cornerRegions = [
      { name: 'TL', x1: 0, y1: 0, x2: margin, y2: topH },
      { name: 'TR', x1: dw - margin, y1: 0, x2: dw, y2: topH },
      { name: 'BL', x1: 0, y1: botY1, x2: margin, y2: botY2 },
      { name: 'BR', x1: dw - margin, y1: botY1, x2: dw, y2: botY2 },
    ];
    
    let cornersFound = 0;
    const foundCorners: string[] = [];
    
    for (const region of cornerRegions) {
      let found = false;
      for (let cy = region.y1 + half + 1; cy < region.y2 - half - 1 && !found; cy += step) {
        for (let cx = region.x1 + half + 1; cx < region.x2 - half - 1 && !found; cx += step) {
          // Check if this spot is dark (potential marker)
          const inner = avgBrightness(cx - half, cy - half, cx + half, cy + half);
          if (inner > 100) continue; // relaxed from 90
          
          // Check surrounding brightness (should be paper = bright)
          const ring = Math.max(half + 2, Math.floor(half * 1.8));
          const topB = avgBrightness(cx - ring, Math.max(0, cy - ring), cx + ring, cy - half);
          const botB = avgBrightness(cx - ring, cy + half, cx + ring, Math.min(dh, cy + ring));
          const leftB = avgBrightness(Math.max(0, cx - ring), cy - half, cx - half, cy + half);
          const rightB = avgBrightness(cx + half, cy - half, Math.min(dw, cx + ring), cy + half);
          
          // At least 2 of 4 sides must be bright (paper)
          const brightCount = (topB > 130 ? 1 : 0) + (botB > 130 ? 1 : 0) + 
                              (leftB > 130 ? 1 : 0) + (rightB > 130 ? 1 : 0);
          if (brightCount < 2) continue;
          
          const borderAvg = (topB + botB + leftB + rightB) / 4;
          if (borderAvg - inner > 40) { // relaxed from 50
            found = true;
          }
        }
      }
      if (found) {
        cornersFound++;
        foundCorners.push(region.name);
      }
    }
    
    // Log periodically for debugging (every ~2 seconds at 6fps)
    if (Math.random() < 0.08) {
      console.log(`[LiveScan] ${dw}x${dh} markerSize=${markerSize} found=${foundCorners.join(',')||'none'} (${cornersFound}/4)`);
    }
    
    return cornersFound >= 4;
  }, [exam]);

  // ── Auto-scan loop: continuously check for markers in the video feed ──
  // For 100-item templates, we only detect markers but don't auto-capture (manual button instead)
  useEffect(() => {
    if (mode !== 'camera' || !stream || !exam) return;
    
    const templateType = getTemplateType();
    const isManualCapture = templateType === 100; // 100-item uses manual capture button
    
    let frameCount = 0;
    let consecutiveDetections = 0;
    // Need ~12-18 consecutive detections to trigger capture (2-3 seconds at 6fps)
    // This gives users time to stabilize their phone before auto-capture
    const REQUIRED_CONSECUTIVE = 15; // ~2.5 seconds of stable marker detection
    let cancelled = false;
    
    const scanLoop = () => {
      if (cancelled || isAutoCapturingRef.current) return;
      
      frameCount++;
      // Only scan every 5th frame (~6fps at 30fps video) to save CPU
      if (frameCount % 5 === 0) {
        const detected = detectMarkersInFrame();
        
        if (detected) {
          consecutiveDetections++;
          setMarkersDetected(true);
          
          // For manual capture mode (100-item), just show that markers are detected
          // For auto-capture mode (20/50-item), track stabilization and auto-capture
          if (isManualCapture) {
            // Keep markers detected state but don't auto-capture
            setStabilizationProgress(100); // Show as ready
          } else {
            // Update stabilization progress (0-100%)
            const progress = Math.min(100, Math.round((consecutiveDetections / REQUIRED_CONSECUTIVE) * 100));
            setStabilizationProgress(progress);
            
            if (consecutiveDetections >= REQUIRED_CONSECUTIVE) {
              console.log(`[AutoScan] Markers stable for ${(consecutiveDetections / 6).toFixed(1)}s — capturing!`);
              captureAndProcess();
              return; // stop the loop
            }
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
  }, [mode, stream, exam, detectMarkersInFrame, captureAndProcess]);

  // ─── SKEW DETECTION AND CORRECTION ───
  // Detects rotation angle up to ±30° and corrects it using Hough-like line detection
  // on the edges of the paper/markers.
  const detectSkewAngle = (grayscale: Uint8Array, width: number, height: number): number => {
    // Use Sobel edge detection to find strong horizontal/vertical edges
    // Then accumulate angles in a histogram to find dominant angle
    
    const angleHist = new Float32Array(121); // -30 to +30 degrees in 0.5° steps
    const centerAngle = 60; // Index 60 = 0 degrees
    
    // Sample a grid of points and measure local edge direction
    const step = Math.max(4, Math.floor(Math.min(width, height) / 100));
    
    for (let y = step; y < height - step; y += step) {
      for (let x = step; x < width - step; x += step) {
        // Sobel gradients
        const gx = 
          -grayscale[(y - 1) * width + (x - 1)] - 2 * grayscale[y * width + (x - 1)] - grayscale[(y + 1) * width + (x - 1)] +
          grayscale[(y - 1) * width + (x + 1)] + 2 * grayscale[y * width + (x + 1)] + grayscale[(y + 1) * width + (x + 1)];
        
        const gy = 
          -grayscale[(y - 1) * width + (x - 1)] - 2 * grayscale[(y - 1) * width + x] - grayscale[(y - 1) * width + (x + 1)] +
          grayscale[(y + 1) * width + (x - 1)] + 2 * grayscale[(y + 1) * width + x] + grayscale[(y + 1) * width + (x + 1)];
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        
        // Only consider strong edges
        if (magnitude < 50) continue;
        
        // Calculate angle in degrees (-90 to +90)
        let angle = Math.atan2(gy, gx) * 180 / Math.PI;
        
        // We're interested in angles close to 0 (horizontal) or 90 (vertical)
        // which correspond to paper edges. Normalize to -30 to +30 range.
        // Horizontal edges: angle ≈ 90 or -90 → paper rotation
        // Vertical edges: angle ≈ 0 or 180 → paper rotation
        
        // For horizontal edges (gy dominant): rotation = angle - 90 (or + 90)
        // For vertical edges (gx dominant): rotation = angle
        
        let rotation: number;
        if (Math.abs(gx) > Math.abs(gy)) {
          // Vertical edge - angle should be near 0 or ±180
          rotation = angle;
          if (rotation > 90) rotation -= 180;
          if (rotation < -90) rotation += 180;
        } else {
          // Horizontal edge - angle should be near ±90
          rotation = angle > 0 ? angle - 90 : angle + 90;
        }
        
        // Clamp to ±30° range
        if (rotation < -30 || rotation > 30) continue;
        
        // Add to histogram with weighted magnitude
        const histIdx = Math.round((rotation + 30) * 2); // -30 → 0, 0 → 60, +30 → 120
        if (histIdx >= 0 && histIdx < 121) {
          angleHist[histIdx] += magnitude;
        }
      }
    }
    
    // Find the peak in the histogram (with smoothing)
    let maxVal = 0;
    let maxIdx = centerAngle;
    
    for (let i = 2; i < 119; i++) {
      // Gaussian smoothing kernel
      const smoothed = angleHist[i - 2] * 0.1 + angleHist[i - 1] * 0.2 + 
                       angleHist[i] * 0.4 + angleHist[i + 1] * 0.2 + angleHist[i + 2] * 0.1;
      if (smoothed > maxVal) {
        maxVal = smoothed;
        maxIdx = i;
      }
    }
    
    const detectedAngle = (maxIdx - centerAngle) / 2; // Convert back to degrees
    
    // Only return angle if there's significant evidence
    const totalVotes = angleHist.reduce((a, b) => a + b, 0);
    const peakStrength = maxVal / (totalVotes || 1);
    
    console.log(`[Skew] Detected angle: ${detectedAngle.toFixed(1)}° (peak strength: ${(peakStrength * 100).toFixed(1)}%)`);
    
    // If peak is weak, don't rotate
    if (peakStrength < 0.05) {
      return 0;
    }
    
    // If angle is very small (< 1°), skip rotation
    if (Math.abs(detectedAngle) < 1) {
      return 0;
    }
    
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
    
    if (Math.abs(angle) < 1) {
      console.log('[Skew] No significant skew detected');
      return srcCanvas;
    }
    
    return rotateCanvas(srcCanvas, angle);
  };

  // ─── IMAGE ENHANCEMENT: Adaptive brightness (no perspective warp) ───
  // Normalizes lighting across the image to handle shadows and uneven illumination.
  // Does NOT warp or distort the image — perspective correction is handled by
  // the 4-corner marker system in detectBubbles.
  const enhanceImage = (srcCanvas: HTMLCanvasElement): HTMLCanvasElement => {
    const ctx = srcCanvas.getContext('2d');
    if (!ctx) return srcCanvas;
    
    const w = srcCanvas.width;
    const h = srcCanvas.height;
    
    // Work on a copy so we don't mutate the source
    const outCanvas = document.createElement('canvas');
    outCanvas.width = w;
    outCanvas.height = h;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return srcCanvas;
    outCtx.drawImage(srcCanvas, 0, 0);
    
    const imgData = outCtx.getImageData(0, 0, w, h);
    const d = imgData.data;
    
    // Adaptive brightness enhancement using a local grid
    // Each grid cell finds the local "paper white" level and scales up so paper → 245
    const gridSize = 48; // larger grid = smoother transitions between cells
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
            const i = (py * w + px) * 4;
            samples.push(Math.max(d[i], d[i + 1], d[i + 2]));
          }
        }
        samples.sort((a, b) => a - b);
        // Use 85th percentile as "local paper white" (avoids being pulled up by specular highlights)
        gridWhite[gy * gW + gx] = samples.length > 0 ? samples[Math.floor(samples.length * 0.85)] : 200;
      }
    }
    
    // Apply with bilinear interpolation between grid cells for smooth result
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        // Find the four surrounding grid cells and interpolate
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
        const localWhite = w00 * (1 - fx) * (1 - fy) + w10 * fx * (1 - fy) + w01 * (1 - fx) * fy + w11 * fx * fy;
        
        const safeWhite = Math.max(80, localWhite);
        const scale = 245 / safeWhite;
        
        const i = (py * w + px) * 4;
        d[i] = Math.min(255, Math.round(d[i] * scale));
        d[i + 1] = Math.min(255, Math.round(d[i + 1] * scale));
        d[i + 2] = Math.min(255, Math.round(d[i + 2] * scale));
      }
    }
    
    outCtx.putImageData(imgData, 0, 0);
    console.log(`[Enhance] Applied adaptive brightness: ${w}x${h}, grid=${gridSize}px`);
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
      const { studentId, answers, multipleAnswers, idDoubleShades, rawIdDigits: detectedRawIdDigits, debugMarkers, markersFound, markerConfidence } = await detectBubbles(imageData, exam.num_items, exam.choices_per_item);
      
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
      if (debugMarkers) {
        const debugCanvas = document.createElement('canvas');
        debugCanvas.width = enhancedCanvas.width;
        debugCanvas.height = enhancedCanvas.height;
        const dCtx = debugCanvas.getContext('2d');
        if (dCtx) {
          dCtx.drawImage(enhancedCanvas, 0, 0);
          
          // Draw marker positions as large red circles with crosshairs
          const markerPoints = [
            { label: 'TL', ...debugMarkers.topLeft },
            { label: 'TR', ...debugMarkers.topRight },
            { label: 'BL', ...debugMarkers.bottomLeft },
            { label: 'BR', ...debugMarkers.bottomRight },
          ];
          for (const mp of markerPoints) {
            // Filled red dot
            dCtx.fillStyle = 'rgba(255, 0, 0, 0.6)';
            dCtx.beginPath();
            dCtx.arc(mp.x, mp.y, 12, 0, Math.PI * 2);
            dCtx.fill();
            // White crosshair for visibility
            dCtx.strokeStyle = '#FFFFFF';
            dCtx.lineWidth = 2;
            dCtx.beginPath();
            dCtx.moveTo(mp.x - 25, mp.y);
            dCtx.lineTo(mp.x + 25, mp.y);
            dCtx.moveTo(mp.x, mp.y - 25);
            dCtx.lineTo(mp.x, mp.y + 25);
            dCtx.stroke();
            // Red outline circle
            dCtx.strokeStyle = '#FF0000';
            dCtx.lineWidth = 3;
            dCtx.beginPath();
            dCtx.arc(mp.x, mp.y, 20, 0, Math.PI * 2);
            dCtx.stroke();
            // Label with background
            dCtx.fillStyle = '#FF0000';
            dCtx.font = 'bold 20px sans-serif';
            dCtx.fillText(mp.label, mp.x + 24, mp.y - 12);
          }
          
          // Draw connecting lines between markers (bright green, thick)
          dCtx.strokeStyle = '#00FF00';
          dCtx.lineWidth = 2;
          dCtx.setLineDash([10, 5]);
          dCtx.beginPath();
          dCtx.moveTo(debugMarkers.topLeft.x, debugMarkers.topLeft.y);
          dCtx.lineTo(debugMarkers.topRight.x, debugMarkers.topRight.y);
          dCtx.lineTo(debugMarkers.bottomRight.x, debugMarkers.bottomRight.y);
          dCtx.lineTo(debugMarkers.bottomLeft.x, debugMarkers.bottomLeft.y);
          dCtx.closePath();
          dCtx.stroke();
          dCtx.setLineDash([]);

          // Draw ID bubble sample positions as blue dots with column/row annotations
          // This lets us verify the grid is properly aligned with the ID bubbles
          // We use 9 columns for 9-digit student IDs
          const layout = getTemplateLayout(exam.num_items);
          for (let col = 0; col < 9; col++) {
            for (let row = 0; row < 10; row++) {
              const nx = layout.id.firstColNX + col * layout.id.colSpacingNX;
              const ny = layout.id.firstRowNY + row * layout.id.rowSpacingNY;
              // Bilinear interpolation (same as mapToPixel)
              const topX = debugMarkers.topLeft.x + nx * (debugMarkers.topRight.x - debugMarkers.topLeft.x);
              const topY = debugMarkers.topLeft.y + nx * (debugMarkers.topRight.y - debugMarkers.topLeft.y);
              const botX = debugMarkers.bottomLeft.x + nx * (debugMarkers.bottomRight.x - debugMarkers.bottomLeft.x);
              const botY = debugMarkers.bottomLeft.y + nx * (debugMarkers.bottomRight.y - debugMarkers.bottomLeft.y);
              const px = topX + ny * (botX - topX);
              const py = topY + ny * (botY - topY);
              
              // Use bright cyan for visibility, larger dots
              dCtx.fillStyle = 'rgba(0, 200, 255, 0.8)';
              dCtx.beginPath();
              dCtx.arc(px, py, 5, 0, Math.PI * 2);
              dCtx.fill();
              dCtx.strokeStyle = '#000000';
              dCtx.lineWidth = 1;
              dCtx.stroke();
            }
            // Label each column at the top
            const nx0 = layout.id.firstColNX + col * layout.id.colSpacingNX;
            const ny0 = layout.id.firstRowNY - layout.id.rowSpacingNY * 0.8; // slightly above first row
            const topX0 = debugMarkers.topLeft.x + nx0 * (debugMarkers.topRight.x - debugMarkers.topLeft.x);
            const topY0 = debugMarkers.topLeft.y + nx0 * (debugMarkers.topRight.y - debugMarkers.topLeft.y);
            const botX0 = debugMarkers.bottomLeft.x + nx0 * (debugMarkers.bottomRight.x - debugMarkers.bottomLeft.x);
            const botY0 = debugMarkers.bottomLeft.y + nx0 * (debugMarkers.bottomRight.y - debugMarkers.bottomLeft.y);
            const labelPx = topX0 + ny0 * (botX0 - topX0);
            const labelPy = topY0 + ny0 * (botY0 - topY0);
            dCtx.fillStyle = '#FFFF00';
            dCtx.font = 'bold 12px sans-serif';
            dCtx.fillText(`C${col}`, labelPx - 6, labelPy);
          }
          
          setCapturedImage(debugCanvas.toDataURL('image/png'));
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
            idError = `Student ID "${studentId}" may have been misread due to alignment issues. The ID is not registered in class "${classData.class_name} - ${classData.section_block}". Try retaking the photo with better alignment.`;
          } else {
            idError = `Student ID "${studentId}" is not registered in class "${classData.class_name} - ${classData.section_block}". Please verify the student is enrolled in this class or check if the ID was shaded correctly.`;
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
    templateType?: 20 | 50 | 100
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
      const step = Math.max(3, Math.floor(size / 2));

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

    // For 100-item templates, pre-filter candidates to those near edges
    // This removes false positives from section markers (■) inside the sheet
    let filteredCandidates = merged;
    if (templateType === 100) {
      // For 100-item, the paper fills most of the image
      // True corner markers should be in the outer 35% of image width/height
      // (allowing for some paper rotation/offset)
      const edgeMarginX = width * 0.35;
      const edgeMarginY = height * 0.35;
      
      filteredCandidates = merged.filter(c => {
        const nearLeftEdge = c.x < edgeMarginX;
        const nearRightEdge = c.x > width - edgeMarginX;
        const nearTopEdge = c.y < edgeMarginY;
        const nearBottomEdge = c.y > height - edgeMarginY;
        
        // Must be near at least one horizontal AND one vertical edge
        const nearHorizontalEdge = nearLeftEdge || nearRightEdge;
        const nearVerticalEdge = nearTopEdge || nearBottomEdge;
        
        return nearHorizontalEdge && nearVerticalEdge;
      });
      
      console.log(`[OMR] 100-item edge filter: ${merged.length} → ${filteredCandidates.length} candidates`);
      
      // If edge filtering removed too many, fall back to all candidates
      if (filteredCandidates.length < 4) {
        console.log('[OMR] Edge filter too aggressive, using all candidates');
        filteredCandidates = merged;
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
            // 100-item: marker frame is 197mm wide x 215.5mm tall → aspect ≈ 0.91
            // 20/50-item: marker frame is more square-ish
            const avgW = (topW + botW) / 2;
            const avgH = (leftH + rightH) / 2;
            const aspect = avgW / avgH;
            
            // For 100-item, the marker frame aspect ratio is ~0.91 (fw/fh = 197/215.5)
            // Enforce stricter aspect ratio for 100-item templates
            if (templateType === 100) {
              // 100-item should have aspect ratio 0.7-1.1 (allowing for rotation/perspective)
              if (aspect < 0.7 || aspect > 1.1) continue;
            } else {
              // Other templates: allow wider range
              if (aspect < 0.4 || aspect > 2.0) continue;
            }
            
            // Left edges should be roughly aligned (TL.x ≈ BL.x)
            const leftXDiff = Math.abs(tl.x - bl.x) / avgW;
            const rightXDiff = Math.abs(tr.x - br.x) / avgW;
            const topYDiff = Math.abs(tl.y - tr.y) / avgH;
            const botYDiff = Math.abs(bl.y - br.y) / avgH;
            // Allow more skew tolerance (up to 15% instead of 8%)
            if (leftXDiff > 0.15 || rightXDiff > 0.15 || topYDiff > 0.15 || botYDiff > 0.15) continue;
            
            // Score: product of individual marker scores × rectangle quality
            const rectQuality = wRatio * hRatio;
            
            // For 100-item templates, add aspect ratio bonus - prefer rectangles closer to expected 0.91
            let aspectBonus = 1.0;
            if (templateType === 100) {
              // Target aspect is 0.91, penalize deviation
              const expectedAspect = 0.91;
              const aspectDiff = Math.abs(aspect - expectedAspect);
              aspectBonus = Math.max(0.5, 1.0 - aspectDiff); // Penalty increases with distance from 0.91
            }
            
            // For 100-item templates, check if bottom markers are at approximately
            // the right position (should be around 70-80% down from top markers if paper fills most of frame)
            // The key insight: bottom markers should NOT be at the image bottom
            let positionBonus = 1.0;
            if (templateType === 100) {
              // Check if bottom markers are in the expected vertical range
              // If paper fills frame, bottom markers should be at ~75% of image height
              // But if there's background below, they could be higher
              const bottomY = (bl.y + br.y) / 2;
              const topY = (tl.y + tr.y) / 2;
              const markerFrameHeight = bottomY - topY;
              
              // For 100-item, the marker frame should be taller than wide (aspect ~0.91)
              // If the frame height is less than ~60% of image height, likely wrong markers
              const frameHeightRatio = markerFrameHeight / height;
              
              // Bottom markers should be in the range 50-90% of image height
              // (They can't be at the very bottom because there's page content below)
              const bottomYRatio = bottomY / height;
              
              // Prefer rectangles where:
              // 1. Bottom markers are NOT at the very bottom of the image (< 95%)
              // 2. The frame height is at least 40% of the image
              if (bottomYRatio > 0.95) {
                positionBonus = 0.3; // Penalize if bottom markers are at image edge
              } else if (bottomYRatio < 0.50) {
                positionBonus = 0.5; // Penalize if bottom markers are too high
              } else if (frameHeightRatio < 0.35) {
                positionBonus = 0.4; // Penalize very small frames
              } else {
                // Good position - bonus based on how close to expected
                positionBonus = 1.0 + (frameHeightRatio * 0.5); // Prefer larger frames
              }
            }
            
            // Prefer larger rectangles but with position bonus and aspect bonus for 100-item
            const areaBonus = avgW * avgH / (width * height);
            const totalScore = (tl.score + tr.score + bl.score + br.score) * rectQuality * areaBonus * positionBonus * aspectBonus;
            
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
    const templateType = numQuestions <= 20 ? 20 : numQuestions <= 50 ? 50 : 100;

    if (templateType === 20) {
      // Mini sheet 105 × 148.5 mm
      // Marker centers: TL (7, 19)  BR (98, 126)  →  frame 91 × 107 mm
      const fw = 91, fh = 107;
      return {
        id: {
          firstColNX: 11 / fw,
          firstRowNY: 15 / fh,
          colSpacingNX: 4.5 / fw,
          rowSpacingNY: 3.5 / fh,
        },
        answerBlocks: [
          {
            startQ: 1, endQ: 10,
            firstBubbleNX: 13 / fw, firstBubbleNY: 58 / fh,
            bubbleSpacingNX: 4.8 / fw, rowSpacingNY: 4.5 / fh,
          },
          {
            startQ: 11, endQ: 20,
            firstBubbleNX: 55.5 / fw, firstBubbleNY: 58 / fh,
            bubbleSpacingNX: 4.8 / fw, rowSpacingNY: 4.5 / fh,
          },
        ],
        bubbleDiameterNX: 3.2 / fw,
        bubbleDiameterNY: 3.2 / fh,
      };
    }

    if (templateType === 50) {
      // Half-page sheet 105 × 297 mm
      // Marker centers: TL (7, 19)  BR (98, 230)  →  frame 91 × 211 mm
      const fw = 91, fh = 211;
      return {
        id: {
          firstColNX: 11 / fw,
          firstRowNY: 15 / fh,
          colSpacingNX: 4.5 / fw,
          rowSpacingNY: 3.5 / fh,
        },
        answerBlocks: [
          // Left column: Q1–10, Q11–20, Q21–30
          {
            startQ: 1, endQ: 10,
            firstBubbleNX: 13 / fw, firstBubbleNY: 58 / fh,
            bubbleSpacingNX: 4.8 / fw, rowSpacingNY: 4.5 / fh,
          },
          {
            startQ: 11, endQ: 20,
            firstBubbleNX: 13 / fw, firstBubbleNY: 110 / fh,
            bubbleSpacingNX: 4.8 / fw, rowSpacingNY: 4.5 / fh,
          },
          {
            startQ: 21, endQ: 30,
            firstBubbleNX: 13 / fw, firstBubbleNY: 162 / fh,
            bubbleSpacingNX: 4.8 / fw, rowSpacingNY: 4.5 / fh,
          },
          // Right column: Q31–40, Q41–50
          {
            startQ: 31, endQ: 40,
            firstBubbleNX: 55.5 / fw, firstBubbleNY: 58 / fh,
            bubbleSpacingNX: 4.8 / fw, rowSpacingNY: 4.5 / fh,
          },
          {
            startQ: 41, endQ: 50,
            firstBubbleNX: 55.5 / fw, firstBubbleNY: 110 / fh,
            bubbleSpacingNX: 4.8 / fw, rowSpacingNY: 4.5 / fh,
          },
        ],
        bubbleDiameterNX: 3.2 / fw,
        bubbleDiameterNY: 3.2 / fh,
      };
    }

    // 100‑question full page  210 × 297 mm
    //
    // PDF LAYOUT TRACE (with logo + exam code):
    //   Top markers: rect(3,3,7,7) & rect(200,3,7,7) → centers at (6.5, 6.5) & (203.5, 6.5)
    //   currentY = 12 → +logoSize(12)+4 = 28 → +examCode(5) = 33 → +Name/Date(5) = 38
    //   idTopY = 38, +7 → 45 (ID boxes), +idBoxH(5)+3 = 53 → idBubbleY = 53
    //   ID first bubble column: idStartX = 10(margin)+3(pad)+8(label) = 21
    //   ID bottom = 53 + 10*4.8 + 2 = 103, +4 → gridStartY = 107
    //   Grid row 0: by=107, header+4.5 → first bubble at 111.5
    //   Grid row 1: by=107+56=163, header+4.5 → first bubble at 167.5
    //   Row 1 last qY = 163 + 4.5 + 10*4.8 = 215.5
    //   bmY = 215.5 + 3 = 218.5 → bottom marker centers at (6.5, 222) & (203.5, 222)
    //
    //   fw = 203.5 - 6.5 = 197  ✓
    //   fh = 222 - 6.5 = 215.5
    //
    // All NY values are (pageY - 6.5) / fh
    // All NX values are (pageX - 6.5) / fw
    //
    // EXACT COORDINATE DERIVATION from drawFullSheet():
    //   margin=10, inset=3, markerSize=7, lx=10, rx=200, usableW=190
    //   bubbleGap=5.0, rowH=4.8, numW=12 (space for question numbers)
    //   qBlockW = 12 + (5-1)*5.0 + 3.8 = 35.8mm
    //   colGap = (190 - 4*35.8) / 5 = 9.36mm
    //
    // Top section (Q41-50, Q71-80):
    //   idBorderW = (8 + 10*4.5) + 2*3 = 59mm, afterIdX = 10+59 = 69mm
    //   remainW = 200-69 = 131mm, topGap = (131 - 2*35.8)/2 = 29.7mm
    //   b41x = 69 + 29.7/2 = 83.85mm → first bubble at 83.85+12 = 95.85mm page
    //   b71x = 83.85 + 35.8 + 29.7 = 149.35mm → first bubble at 161.35mm page
    //
    // Bottom grid (4 cols × 2 rows):
    //   col0: bx = 10 + 9.36 = 19.36mm → first bubble at 31.36mm page
    //   col1: bx = 10 + 9.36 + 45.16 = 64.52mm → first bubble at 76.52mm page
    //   col2: bx = 10 + 9.36 + 90.32 = 109.68mm → first bubble at 121.68mm page
    //   col3: bx = 10 + 9.36 + 135.48 = 154.84mm → first bubble at 166.84mm page
    //
    // NX = (pageX - 6.5) / fw, NY = (pageY - 6.5) / fh
    const fw = 197, fh = 215.5;
    return {
      id: {
        // idStartX=21 page mm → (21 - 6.5) = 14.5 mm from TL marker center
        firstColNX: 14.5 / fw,
        // idBubbleY=53 page mm → (53 - 6.5) = 46.5 mm from TL marker center
        firstRowNY: 46.5 / fh,
        colSpacingNX: 4.5 / fw,
        rowSpacingNY: 4.8 / fh,
      },
      answerBlocks: [
        // Top row (beside ID section) — aligned to idBubbleY
        // drawQBlock header at Y=53, +4.5 → first bubble Y = 57.5 → NY = 51/fh
        {
          startQ: 41, endQ: 50,
          // b41x=83.85, first bubble = 83.85+12 = 95.85 → NX = (95.85-6.5)/fw = 89.35/fw
          firstBubbleNX: 89.35 / fw,
          firstBubbleNY: 51 / fh,
          bubbleSpacingNX: 5.0 / fw,
          rowSpacingNY: 4.8 / fh,
        },
        {
          startQ: 71, endQ: 80,
          // b71x=149.35, first bubble = 149.35+12 = 161.35 → NX = (161.35-6.5)/fw = 154.85/fw
          firstBubbleNX: 154.85 / fw,
          firstBubbleNY: 51 / fh,
          bubbleSpacingNX: 5.0 / fw,
          rowSpacingNY: 4.8 / fh,
        },
        // Bottom grid – row 0: by=107, header+4.5 → first bubble at Y=111.5 → NY = 105/fh
        {
          startQ: 1, endQ: 10,
          // col0: bx=19.36, first bubble = 31.36 → NX = 24.86/fw
          firstBubbleNX: 24.86 / fw,
          firstBubbleNY: 105 / fh,
          bubbleSpacingNX: 5.0 / fw,
          rowSpacingNY: 4.8 / fh,
        },
        {
          startQ: 21, endQ: 30,
          // col1: bx=64.52, first bubble = 76.52 → NX = 70.02/fw
          firstBubbleNX: 70.02 / fw,
          firstBubbleNY: 105 / fh,
          bubbleSpacingNX: 5.0 / fw,
          rowSpacingNY: 4.8 / fh,
        },
        {
          startQ: 51, endQ: 60,
          // col2: bx=109.68, first bubble = 121.68 → NX = 115.18/fw
          firstBubbleNX: 115.18 / fw,
          firstBubbleNY: 105 / fh,
          bubbleSpacingNX: 5.0 / fw,
          rowSpacingNY: 4.8 / fh,
        },
        {
          startQ: 81, endQ: 90,
          // col3: bx=154.84, first bubble = 166.84 → NX = 160.34/fw
          firstBubbleNX: 160.34 / fw,
          firstBubbleNY: 105 / fh,
          bubbleSpacingNX: 5.0 / fw,
          rowSpacingNY: 4.8 / fh,
        },
        // Bottom grid – row 1: by=163, header+4.5 → first bubble at Y=167.5 → NY = 161/fh
        {
          startQ: 11, endQ: 20,
          firstBubbleNX: 24.86 / fw,
          firstBubbleNY: 161 / fh,
          bubbleSpacingNX: 5.0 / fw,
          rowSpacingNY: 4.8 / fh,
        },
        {
          startQ: 31, endQ: 40,
          firstBubbleNX: 70.02 / fw,
          firstBubbleNY: 161 / fh,
          bubbleSpacingNX: 5.0 / fw,
          rowSpacingNY: 4.8 / fh,
        },
        {
          startQ: 61, endQ: 70,
          firstBubbleNX: 115.18 / fw,
          firstBubbleNY: 161 / fh,
          bubbleSpacingNX: 5.0 / fw,
          rowSpacingNY: 4.8 / fh,
        },
        {
          startQ: 91, endQ: 100,
          firstBubbleNX: 160.34 / fw,
          firstBubbleNY: 161 / fh,
          bubbleSpacingNX: 5.0 / fw,
          rowSpacingNY: 4.8 / fh,
        },
      ],
      bubbleDiameterNX: 3.8 / fw,
      bubbleDiameterNY: 3.8 / fh,
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
  }> => {
    const { data, width, height } = imageData;

    // 1. Convert to grayscale
    const rawGrayscale = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      rawGrayscale[i / 4] = Math.round(
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      );
    }

    // 1b. Contrast normalization — stretches the histogram to use the full 0-255 range
    // This helps when the image has poor lighting (shadows, dim environment)
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
      grayscale[i] = Math.max(0, Math.min(255, Math.round(((rawGrayscale[i] - gMin) / gRange) * 255)));
    }
    console.log(`[OMR] Contrast normalization: min=${gMin} max=${gMax} range=${gRange}`);

    // 2. Find corner alignment markers using RAW grayscale (before contrast normalization)
    // This avoids shadows/noise being amplified into false marker candidates
    const dummyBinary = new Uint8Array(0); // not used by new marker detector
    
    // Determine template type BEFORE finding markers (needed for position heuristics)
    const templateType = numQuestions <= 20 ? 20 : numQuestions <= 50 ? 50 : 100;
    
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
    const { answers, multipleAnswers } = detectAnswersFromImage(
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
      debugMarkers: effectiveMarkers 
    };
  };

  // ─── BUBBLE SAMPLING (grayscale-based) ───
  // Returns the MEAN BRIGHTNESS of the bubble interior (0-255).
  // LOWER value = DARKER = MORE LIKELY FILLED.
  // 
  // We sample only the interior of the bubble and return raw brightness.
  // Detection functions compare bubbles WITHIN the same column/question —
  // the filled bubble will simply be much darker than unfilled ones.
  const sampleBubbleAt = (
    grayscale: Uint8Array,
    imgW: number,
    imgH: number,
    cx: number,
    cy: number,
    radiusX: number,
    radiusY: number
  ): number => {
    // Sample the center of the bubble using an elliptical mask
    // Use inner 50% to safely avoid the printed circle outline
    let sum = 0, count = 0;
    const innerRX = radiusX * 0.50;
    const innerRY = radiusY * 0.50;
    const step = Math.max(1, Math.floor(Math.min(innerRX, innerRY) / 4));

    for (let dy = -Math.ceil(innerRY); dy <= Math.ceil(innerRY); dy += step) {
      for (let dx = -Math.ceil(innerRX); dx <= Math.ceil(innerRX); dx += step) {
        if (innerRX > 0 && innerRY > 0 && (dx * dx) / (innerRX * innerRX) + (dy * dy) / (innerRY * innerRY) > 1) continue;
        const px = Math.round(cx + dx);
        const py = Math.round(cy + dy);
        if (px >= 0 && px < imgW && py >= 0 && py < imgH) {
          sum += grayscale[py * imgW + px];
          count++;
        }
      }
    }

    // Also sample the exact center cross pattern for extra precision
    // This catches small-pencil fills that are concentrated at center
    for (let r = 0; r <= Math.floor(innerRX * 0.7); r++) {
      for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
        const px = Math.round(cx + dx);
        const py = Math.round(cy + dy);
        if (px >= 0 && px < imgW && py >= 0 && py < imgH) {
          sum += grayscale[py * imgW + px];
          count++;
        }
      }
    }

    if (count === 0) return 255; // default = bright = unfilled
    return sum / count; // raw brightness: low = dark = filled
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

      // Detection criteria (calibrated to 70% threshold):
      // 1. The darkest bubble must be < 70% of the upper quartile brightness (30%+ drop)
      //    This is stricter to avoid false positives from noise/dots
      // 2. OR: the gap between darkest and 2nd-darkest must be > 15% of upper quartile
      //    AND darkest < 85% of upper quartile (clear separation indicates intentional mark)
      const darkRatio = upperQ > 20 ? darkest / upperQ : 1;
      const gapFromSecond = secondDark - darkest;
      const gapRatio = upperQ > 20 ? gapFromSecond / upperQ : 0;

      // Primary detection: darkest must be significantly darker than unfilled (30% drop = 70% threshold)
      if (darkRatio < 0.70) {
        // Strong detection: darkest is much darker than unfilled
        detectedDigit = fills.indexOf(darkest);
        hasDetection = true;
      } else if (darkRatio < 0.85 && gapRatio > 0.15) {
        // Moderate detection: darkest is somewhat dark AND clearly separated from 2nd
        // Requires stronger gap (15% instead of 12%) to avoid light mark false positives
        detectedDigit = fills.indexOf(darkest);
        hasDetection = true;
      }

      if (hasDetection && detectedDigit !== null) {
        // Check for double-shade: is the 2nd-darkest ALSO significantly dark?
        const secondRatio = upperQ > 20 ? secondDark / upperQ : 1;
        const gapBetweenTopTwo = upperQ > 20 ? gapFromSecond / upperQ : 1;
        // Double shade if 2nd is also quite dark AND close to the darkest
        if (secondRatio < 0.75 && gapBetweenTopTwo < 0.08) {
          doubleShadeColumns.push(col + 1);
          console.log(`[ID] ⚠️ Col ${col} DOUBLE SHADE: darkest=${darkest.toFixed(0)} 2nd=${secondDark.toFixed(0)} upperQ=${upperQ.toFixed(0)}`);
        }
      }

      // NULL LOGIC: If no bubble is shaded, use '_' placeholder (not '0')
      // This prevents unshaded columns from corrupting the ID (e.g., 9 digits → 10)
      // The digit '0' should ONLY appear if the '0' bubble is actually shaded
      const digitChar = hasDetection && detectedDigit !== null ? String(detectedDigit) : '_';
      
      console.log(`[ID] Col ${col}: brightness=[${fills.map(f => f.toFixed(0)).join(',')}] → ${digitChar} (darkest=${darkest.toFixed(0)} upperQ=${upperQ.toFixed(0)} ratio=${darkRatio.toFixed(2)} gap=${gapRatio.toFixed(2)})`);
      idDigits.push(hasDetection && detectedDigit !== null ? detectedDigit : -1); // -1 = unshaded
    }

    // Convert digits to string, using '_' for unshaded columns (-1)
    // Then strip leading/trailing underscores and collapse to just the detected digits
    const rawWithPlaceholders = idDigits.map(d => d === -1 ? '_' : String(d)).join('');
    
    // For the final ID, we have two options:
    // 1. Keep placeholders to show which columns were unshaded (for debugging/validation)
    // 2. Strip placeholders and return only the detected digits
    // We'll strip them to get a clean ID, but log both versions
    const cleanId = idDigits.filter(d => d !== -1).map(d => String(d)).join('');
    
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
  ): { answers: string[]; multipleAnswers: number[] } => {
    const answers = new Array<string>(numQuestions).fill('');
    const multipleAnswers: number[] = [];
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

        const fills: { choice: string; brightness: number }[] = [];

        for (let c = 0; c < choicesPerQuestion; c++) {
          const nx = block.firstBubbleNX + c * block.bubbleSpacingNX;
          const ny = block.firstBubbleNY + rowInBlock * block.rowSpacingNY;
          const { px, py } = mapToPixel(markers, nx, ny);
          const brightness = sampleBubbleAt(grayscale, width, height, px, py, bubbleRX, bubbleRY);
          fills.push({ choice: choiceLabels[c], brightness });
        }

        // Sort ASCENDING by brightness — darkest (most filled) first
        const sorted = [...fills].sort((a, b) => a.brightness - b.brightness);
        const darkest = sorted[0].brightness;
        const secondDark = sorted.length >= 2 ? sorted[1].brightness : 255;
        const brightest = sorted[sorted.length - 1].brightness;

        let selectedChoice = '';

        // Use the brightest bubble as the "unfilled" reference
        // For a 5-choice question, at most 1 is filled, so the brightest is a good reference
        const ref = brightest;
        const darkRatio = ref > 20 ? darkest / ref : 1;
        const gapFromSecond = secondDark - darkest;
        const gapRatio = ref > 20 ? gapFromSecond / ref : 0;

        // Detection with 70% threshold (calibrated to avoid false positives from noise):
        // Primary: darkest must be < 70% of brightest (30%+ drop) - clear intentional mark
        // Secondary: darkest < 85% of brightest AND strong gap from 2nd (15%+)
        //            This catches lighter but intentional marks that stand out
        if (darkRatio < 0.70) {
          selectedChoice = sorted[0].choice;
        } else if (darkRatio < 0.85 && gapRatio > 0.15) {
          // Stricter gap requirement (was 0.10) to distinguish from noise
          selectedChoice = sorted[0].choice;
        }

        // Check for multiple answers
        if (selectedChoice) {
          const secondRatio = ref > 20 ? secondDark / ref : 1;
          const gapBetweenTopTwo = ref > 20 ? gapFromSecond / ref : 1;
          // Multiple answers: 2nd darkest is also quite dark (<75%) AND close to darkest (<8% gap)
          // Stricter thresholds to reduce false positives from background noise
          if (secondRatio < 0.75 && gapBetweenTopTwo < 0.08) {
            multipleAnswers.push(q);
            console.log(`[MULTI] Q${q}: ${sorted.slice(0, 3).map(f => `${f.choice}=${f.brightness.toFixed(0)}`).join(', ')} ref=${ref.toFixed(0)}`);
          }
        }

        // Log first few questions per block + last for debugging
        if (q <= block.startQ + 2 || q === block.endQ) {
          console.log(`[ANS] Q${q}: ${fills.map(f => `${f.choice}=${f.brightness.toFixed(0)}`).join(', ')} → ${selectedChoice || '?'} (darkRatio=${darkRatio.toFixed(2)} gapRatio=${gapRatio.toFixed(2)} ref=${ref.toFixed(0)})`);
        }

        answers[qIndex] = selectedChoice;
      }
    }
    return { answers, multipleAnswers };
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
    if (grade.startsWith('A')) return 'text-green-600 bg-green-100';
    if (grade.startsWith('B')) return 'text-lime-600 bg-lime-100';
    if (grade.startsWith('C')) return 'text-yellow-600 bg-yellow-100';
    if (grade.startsWith('D')) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
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
      toast.error(`Cannot save: Student ID "${detectedStudentId}" is not registered in class "${classData.class_name} - ${classData.section_block}".`);
      setStudentIdError(`Student ID "${detectedStudentId}" is not registered in class "${classData.class_name} - ${classData.section_block}". Please verify the student is enrolled in this class.`);
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
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#1a472a] mx-auto" />
          <p className="text-gray-600">Loading scanner...</p>
        </div>
      </div>
    );
  }

  // No exam found
  if (!exam) {
    return (
      <div className="space-y-6">
        <Link href="/exams" className="inline-flex items-center gap-2 text-gray-600 hover:text-[#1a472a]">
          <ArrowLeft className="w-5 h-5" />
          Back to Exams
        </Link>
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
        <Link href={`/exams/${examId}`} className="inline-flex items-center gap-2 text-gray-600 hover:text-[#1a472a]">
          <ArrowLeft className="w-5 h-5" />
          Back to Exam
        </Link>
        <Card className="p-12 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900">Answer Key Required</h2>
          <p className="text-gray-600 mt-2">Please set up the answer key before scanning papers.</p>
          <Link href={`/exams/${examId}/edit-key`}>
            <Button className="mt-4 bg-[#1a472a] hover:bg-[#2d6b47]">
              Set Up Answer Key
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/exams/${examId}`} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#1a472a]">Scan Answer Sheets</h1>
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
          {/* 
            Camera container: always use the native video stream aspect ratio.
            The guide overlay inside adapts its shape to match the paper template.
          */}
          <div className="relative bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-auto block"
            />
            {/* Camera overlay guide — adapts to template */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Semi-transparent overlay around the guide */}
              {(() => {
                const t = getTemplateType();
                // Paper aspect ratios (width:height)
                // 20-item: 105 x 148.5mm  → ~0.707
                // 50-item: 105 x 297mm    → ~0.354
                // 100-item: 210 x 297mm   → ~0.707
                // Guide occupies most of the view, with padding
                const guideStyle = t === 20
                  ? { width: '75%', aspectRatio: '105 / 148.5' }   // landscape-ish small card
                  : t === 50
                  ? { width: '55%', aspectRatio: '105 / 297' }     // tall narrow
                  : { width: '90%', aspectRatio: '210 / 297' };    // A4 portrait — tight fit to minimize background
                const borderColor = markersDetected ? 'border-green-400' : 'border-white/60';
                const cornerColor = markersDetected ? 'border-green-400' : 'border-white';
                const isManualCapture = t === 100; // 100-item uses manual capture
                // Show different labels based on template type and marker detection
                const label = isManualCapture
                  ? markersDetected
                    ? '✓ Ready — tap Capture below'
                    : 'Align sheet and tap Capture when ready'
                  : markersDetected
                    ? stabilizationProgress >= 100
                      ? '✓ Capturing now...'
                      : `Hold steady... ${stabilizationProgress}%`
                    : t === 20
                    ? 'Align answer sheet within the frame'
                    : `Align ${t}-item sheet within the frame`;
                return (
                  <div className="relative" style={guideStyle}>
                    <div className={`absolute inset-0 border-2 ${borderColor} rounded-lg transition-colors duration-200`} />
                    {/* Corner brackets */}
                    <div className={`absolute top-1 left-1 w-6 h-6 border-t-2 border-l-2 ${cornerColor} rounded-tl transition-colors duration-200`} />
                    <div className={`absolute top-1 right-1 w-6 h-6 border-t-2 border-r-2 ${cornerColor} rounded-tr transition-colors duration-200`} />
                    <div className={`absolute bottom-1 left-1 w-6 h-6 border-b-2 border-l-2 ${cornerColor} rounded-bl transition-colors duration-200`} />
                    <div className={`absolute bottom-1 right-1 w-6 h-6 border-b-2 border-r-2 ${cornerColor} rounded-br transition-colors duration-200`} />
                    {/* Stabilization progress bar when markers detected (only for auto-capture modes) */}
                    {!isManualCapture && markersDetected && stabilizationProgress < 100 && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30 rounded-b-lg overflow-hidden">
                        <div 
                          className="h-full bg-green-400 transition-all duration-150"
                          style={{ width: `${stabilizationProgress}%` }}
                        />
                      </div>
                    )}
                    {/* Label */}
                    <p className={`absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-white text-xs ${markersDetected ? 'bg-green-600/80' : 'bg-black/60'} px-3 py-1.5 rounded-full transition-colors duration-200`}>
                      {label}
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
          <div className="p-4 flex justify-center gap-3">
            {/* Capture button for 100-item (manual capture) */}
            {getTemplateType() === 100 && (
              <Button 
                onClick={captureAndProcess}
                disabled={!markersDetected}
                className={`${markersDetected ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'}`}
              >
                <Camera className="w-4 h-4 mr-2" />
                Capture
              </Button>
            )}
            <Button variant="outline" onClick={stopCamera}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
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
                <div className="h-full bg-[#1a472a] rounded-full animate-pulse" style={{ width: '60%' }} />
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
            <Card className="p-4 border-red-400 bg-red-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-red-700 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-red-900">Sheet Alignment Error</h4>
                  <p className="text-sm text-red-800 mt-1">{alignmentError}</p>
                  <div className="mt-3 flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-red-400 text-red-700 hover:bg-red-200"
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
            <Card className="p-4 border-orange-300 bg-orange-50">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-orange-800">Multiple Bubbles Shaded in Student ID</h4>
                  <p className="text-sm text-orange-700 mt-1">
                    Column(s) <strong>{idDoubleShadeColumns.join(', ')}</strong> of the Student ID have more than one bubble shaded. Each column must have only <strong>one digit</strong> selected.
                  </p>
                  <p className="text-xs text-orange-600 mt-2">
                    Please ask the student to properly shade only one bubble per column, or manually correct the Student ID below.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Student ID Not Found Error */}
          {studentIdError && idDoubleShadeColumns.length === 0 && (
            <Card className="p-4 border-red-300 bg-red-50">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-red-800">Student ID Not Found</h4>
                  <p className="text-sm text-red-700 mt-1">{studentIdError}</p>
                  <p className="text-xs text-red-600 mt-2">
                    You must correct the Student ID before saving. Edit the ID field below or discard and re-scan.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Multiple Answers Warning */}
          {multipleAnswerQuestions.length > 0 && (
            <Card className="p-4 border-yellow-300 bg-yellow-50">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-yellow-800">Multiple Answers Detected</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    The following question(s) have more than one bubble shaded: <strong>
                    {multipleAnswerQuestions.map(q => `#${q}`).join(', ')}
                    </strong>
                  </p>
                  <p className="text-xs text-yellow-600 mt-2">
                    Only one answer per question is allowed. The system selected the darkest bubble, but please verify and correct if needed. Remind the student to shade only one bubble per question.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Score Summary */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  (studentIdError || idDoubleShadeColumns.length > 0) ? 'bg-red-100' : matchedStudent ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <User className={`w-8 h-8 ${
                    (studentIdError || idDoubleShadeColumns.length > 0) ? 'text-red-600' : matchedStudent ? 'text-green-600' : 'text-gray-600'
                  }`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={detectedStudentId}
                      onChange={(e) => {
                        const newId = e.target.value;
                        setDetectedStudentId(newId);
                        // Clear double-shade error when user manually edits
                        setIdDoubleShadeColumns([]);
                        setRawIdDigits([]); // Clear raw digits when manually editing
                        // Re-validate student ID on change
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
                            setStudentIdError(`Student ID "${newId}" is not registered in class "${classData.class_name} - ${classData.section_block}". Please verify the student is enrolled in this class or check if the ID was shaded correctly.`);
                          }
                        }
                      }}
                      className={`text-xl font-bold bg-transparent border-b transition-colors focus:outline-none ${
                        (studentIdError || idDoubleShadeColumns.length > 0)
                          ? 'text-red-700 border-red-300 hover:border-red-400 focus:border-red-500'
                          : 'text-gray-900 border-transparent hover:border-gray-300 focus:border-[#1a472a]'
                      }`}
                      placeholder="Enter Student ID"
                    />
                    {matchedStudent && (
                      <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded">
                        {matchedStudent.first_name} {matchedStudent.last_name}
                      </span>
                    )}
                  </div>
                  {/* Student ID Digit Boxes - Visual display of each scanned column */}
                  {rawIdDigits.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-1">Scanned ID Columns (9 digits):</p>
                      <div className="flex gap-1">
                        {rawIdDigits.map((digit, idx) => {
                          const isUnshaded = digit === -1;
                          const hasDoubleShade = idDoubleShadeColumns.includes(idx + 1);
                          return (
                            <div
                              key={idx}
                              className={`w-7 h-8 flex items-center justify-center text-sm font-bold rounded border-2 ${
                                hasDoubleShade
                                  ? 'border-yellow-500 bg-yellow-100 text-yellow-700'
                                  : isUnshaded
                                    ? 'border-gray-300 bg-gray-200 text-gray-400'
                                    : 'border-green-500 bg-green-50 text-green-700'
                              }`}
                              title={
                                hasDoubleShade
                                  ? `Column ${idx + 1}: Multiple bubbles shaded`
                                  : isUnshaded
                                    ? `Column ${idx + 1}: No bubble shaded`
                                    : `Column ${idx + 1}: Digit ${digit}`
                              }
                            >
                              {hasDoubleShade ? '?' : isUnshaded ? '–' : digit}
                            </div>
                          );
                        })}
                      </div>
                      {rawIdDigits.some(d => d === -1) && (
                        <p className="text-xs text-gray-500 mt-1">
                          <span className="inline-block w-3 h-3 bg-gray-200 border border-gray-300 rounded mr-1 align-middle"></span>
                          Grey boxes = no bubble shaded in that column
                        </p>
                      )}
                    </div>
                  )}
                  <p className="text-gray-600 mt-1">Student ID</p>
                  {debugInfo && (
                    <p className="text-xs text-gray-400 mt-1 font-mono break-all">{debugInfo}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className={`inline-block px-4 py-2 rounded-lg text-2xl font-bold ${getGradeColor(scanResult.letterGrade)}`}>
                  {scanResult.letterGrade}
                </div>
                <p className="text-gray-600 mt-1">
                  {scanResult.score}/{scanResult.totalQuestions} ({scanResult.percentage}%)
                </p>
              </div>
            </div>
          </Card>

          {/* Answer Comparison */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Answer Comparison</h3>
            
            {(() => {
              const halfPoint = Math.ceil(detectedAnswers.length / 2);
              const firstRow = detectedAnswers.slice(0, halfPoint);
              const secondRow = detectedAnswers.slice(halfPoint);
              
              return (
                <div className="space-y-6">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Questions 1-{halfPoint}</p>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                      {firstRow.map((answer, i) => {
                        const isCorrect = answerKey[i] && answer.toUpperCase() === answerKey[i].toUpperCase();
                        const hasMultiple = multipleAnswerQuestions.includes(i + 1);
                        return (
                          <div key={i} className="text-center">
                            <span className={`text-xs block mb-1 ${hasMultiple ? 'text-yellow-600 font-bold' : 'text-gray-500'}`}>{i + 1}</span>
                            <div className="relative">
                              <input
                                type="text"
                                value={answer}
                                onChange={(e) => editAnswer(i, e.target.value)}
                                maxLength={1}
                                className={`w-10 h-10 text-center font-bold rounded-lg border-2 transition-colors ${
                                  hasMultiple
                                    ? 'border-yellow-500 bg-yellow-50 text-yellow-700 ring-2 ring-yellow-300'
                                    : isCorrect 
                                      ? 'border-green-500 bg-green-50 text-green-700' 
                                      : answer 
                                        ? 'border-red-500 bg-red-50 text-red-700'
                                        : 'border-gray-300 bg-gray-50 text-gray-500'
                                }`}
                              />
                              {hasMultiple && (
                                <AlertTriangle className="absolute -top-2 -right-2 w-4 h-4 text-yellow-600" />
                              )}
                              {answerKey[i] && !isCorrect && (
                                <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-green-600 font-medium">
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
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium text-gray-500 mb-2">Questions {halfPoint + 1}-{detectedAnswers.length}</p>
                      <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                        {secondRow.map((answer, i) => {
                          const actualIndex = halfPoint + i;
                          const isCorrect = answerKey[actualIndex] && answer.toUpperCase() === answerKey[actualIndex].toUpperCase();
                          const hasMultiple = multipleAnswerQuestions.includes(actualIndex + 1);
                          return (
                            <div key={actualIndex} className="text-center">
                              <span className={`text-xs block mb-1 ${hasMultiple ? 'text-yellow-600 font-bold' : 'text-gray-500'}`}>{actualIndex + 1}</span>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={answer}
                                  onChange={(e) => editAnswer(actualIndex, e.target.value)}
                                  maxLength={1}
                                  className={`w-10 h-10 text-center font-bold rounded-lg border-2 transition-colors ${
                                    hasMultiple
                                      ? 'border-yellow-500 bg-yellow-50 text-yellow-700 ring-2 ring-yellow-300'
                                      : isCorrect 
                                        ? 'border-green-500 bg-green-50 text-green-700' 
                                        : answer 
                                          ? 'border-red-500 bg-red-50 text-red-700'
                                          : 'border-gray-300 bg-gray-50 text-gray-500'
                                  }`}
                                />
                                {hasMultiple && (
                                  <AlertTriangle className="absolute -top-2 -right-2 w-4 h-4 text-yellow-600" />
                                )}
                                {answerKey[actualIndex] && !isCorrect && (
                                  <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-green-600 font-medium">
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
            <div className="flex items-center gap-4 mt-6 pt-4 border-t text-sm flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-100 border-2 border-green-500 rounded" />
                <span className="text-gray-600">Correct</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-100 border-2 border-red-500 rounded" />
                <span className="text-gray-600">Incorrect</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-100 border-2 border-gray-300 rounded" />
                <span className="text-gray-600">No answer detected</span>
              </div>
              {multipleAnswerQuestions.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-100 border-2 border-yellow-500 rounded relative">
                    <AlertTriangle className="absolute -top-1 -right-1 w-3 h-3 text-yellow-600" />
                  </div>
                  <span className="text-yellow-700">Multiple answers</span>
                </div>
              )}
            </div>
          </Card>

          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={() => {
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
              className={`${(studentIdError || idDoubleShadeColumns.length > 0) ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#1a472a] hover:bg-[#2d6b47]'}`}
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