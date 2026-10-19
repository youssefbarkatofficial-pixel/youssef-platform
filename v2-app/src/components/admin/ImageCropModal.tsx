import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  Upload,
  AlertTriangle,
  Move,
  Sparkles,
} from 'lucide-react';
import { Button, Spinner } from '../ui';
import {
  MediaType,
  MEDIA_SPECS,
  calculateBase64Bytes,
} from '../../lib/imageUpload';
import { saveUploadedMediaDoc } from '../../services/settings';

interface ImageCropModalProps {
  open: boolean;
  type: MediaType;
  title: string;
  initialFile?: File | null;
  onClose: () => void;
  onSaved: (dataUrl: string, sizeBytes: number) => void;
}

export default function ImageCropModal({
  open,
  type,
  title,
  initialFile,
  onClose,
  onSaved,
}: ImageCropModalProps) {
  const spec = MEDIA_SPECS[type];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewBytes, setPreviewBytes] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Mask dimensions
  // circle for logo, portrait (4:5) for youssefCutout, landscape (16:9) for heroBg
  const maskShape = type === 'logo' ? 'circle' : type === 'youssefCutout' ? 'portrait' : 'landscape';
  const maskWidth = 320;
  const maskHeight = maskShape === 'circle' ? 320 : maskShape === 'portrait' ? 400 : 200;

  // Load initial file when modal opens
  useEffect(() => {
    if (!open) {
      setImageSrc(null);
      setZoom(1.0);
      setPan({ x: 0, y: 0 });
      setPreviewDataUrl(null);
      setErrorMsg(null);
      return;
    }

    if (initialFile) {
      loadFile(initialFile);
    }
  }, [open, initialFile]);

  const loadFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('يُرجى اختيار ملف صورة صالح (PNG, WebP, JPEG).');
      return;
    }
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
        setImageSrc(dataUrl);
        setZoom(1.0);
        setPan({ x: 0, y: 0 });
      };
      img.onerror = () => {
        setErrorMsg('تعذر قراءة الصورة.');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Drag (Pan) Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!imageSrc) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (!imageSrc) return;
    e.preventDefault();
    const delta = e.deltaY * -0.002;
    setZoom((prev) => Math.min(3.0, Math.max(0.5, prev + delta)));
  };

  // Reset Pan and Zoom
  const handleReset = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Generate cropped output canvas
  const generateCroppedCanvas = useCallback((): HTMLCanvasElement | null => {
    if (!imageSrc || !imageRef.current) return null;
    const img = imageRef.current;

    // Create target output canvas scaled to spec maxDimension
    const canvas = document.createElement('canvas');
    let outW = maskWidth;
    let outH = maskHeight;

    // Scale up output resolution while keeping aspect ratio, bounded by spec.maxDimension
    const maxDim = spec.maxDimension;
    if (outW > outH) {
      outW = maxDim;
      outH = Math.round((maskHeight / maskWidth) * maxDim);
    } else {
      outH = maxDim;
      outW = Math.round((maskWidth / maskHeight) * maxDim);
    }

    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Background for non-alpha images (heroBg)
    if (!spec.preserveAlpha) {
      ctx.fillStyle = '#071326';
      ctx.fillRect(0, 0, outW, outH);
    } else {
      ctx.clearRect(0, 0, outW, outH);
    }

    // Clip to circle if circle mask
    if (maskShape === 'circle') {
      ctx.beginPath();
      ctx.arc(outW / 2, outH / 2, Math.min(outW, outH) / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
    }

    // Map screen mask coordinates to target output canvas
    const scaleFactor = outW / maskWidth;
    const drawW = img.width * zoom * scaleFactor;
    const drawH = img.height * zoom * scaleFactor;
    const drawX = (outW - drawW) / 2 + pan.x * scaleFactor;
    const drawY = (outH - drawH) / 2 + pan.y * scaleFactor;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    return canvas;
  }, [imageSrc, zoom, pan, maskWidth, maskHeight, maskShape, spec]);

  // Update live preview & size whenever zoom or pan changes
  useEffect(() => {
    if (!imageSrc) return;
    const timer = setTimeout(() => {
      const canvas = generateCroppedCanvas();
      if (!canvas) return;
      try {
        const quality = 0.88;
        const dataUrl = canvas.toDataURL('image/webp', quality);
        const bytes = calculateBase64Bytes(dataUrl);
        setPreviewDataUrl(dataUrl);
        setPreviewBytes(bytes);
      } catch {
        // ignore
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [imageSrc, zoom, pan, generateCroppedCanvas]);

  const handleSave = async () => {
    const canvas = generateCroppedCanvas();
    if (!canvas) {
      setErrorMsg('تعذر إنشاء الصورة المقصوصة.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      const quality = 0.88;
      let dataUrl = canvas.toDataURL('image/webp', quality);
      let bytes = calculateBase64Bytes(dataUrl);

      // Check maxBytes budget
      if (bytes > spec.maxBytes) {
        // Try gentle resize if slightly over
        const scale = Math.sqrt(spec.maxBytes / bytes) * 0.95;
        const reducedCanvas = document.createElement('canvas');
        reducedCanvas.width = Math.round(canvas.width * scale);
        reducedCanvas.height = Math.round(canvas.height * scale);
        const rCtx = reducedCanvas.getContext('2d');
        if (rCtx) {
          if (!spec.preserveAlpha) {
            rCtx.fillStyle = '#071326';
            rCtx.fillRect(0, 0, reducedCanvas.width, reducedCanvas.height);
          }
          rCtx.imageSmoothingEnabled = true;
          rCtx.imageSmoothingQuality = 'high';
          rCtx.drawImage(canvas, 0, 0, reducedCanvas.width, reducedCanvas.height);
          dataUrl = reducedCanvas.toDataURL('image/webp', 0.85);
          bytes = calculateBase64Bytes(dataUrl);
        }
      }

      if (bytes > spec.maxBytes) {
        throw new Error(
          `حجم الصورة (${Math.round(bytes / 1024)} KB) يتجاوز سقف باقة Spark (${Math.round(
            spec.maxBytes / 1024,
          )} KB). يُرجى تقليل التكبير أو اختيار ملف أصغر.`,
        );
      }

      // Save directly to Firestore platform_media & update mediaVersions
      await saveUploadedMediaDoc(type, dataUrl, bytes);
      onSaved(dataUrl, bytes);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'تعذر حفظ الصورة.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const kbSize = Math.round(previewBytes / 1024);
  const maxKb = Math.round(spec.maxBytes / 1024);
  const isOverSize = previewBytes > spec.maxBytes;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-2xl rounded-3xl border border-navy-700 bg-navy-950 p-6 shadow-2xl space-y-5 text-white max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-navy-800 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold-400" />
            <h3 className="text-lg font-bold text-white">
              {title} — تحريك وتكبير وقص فوري
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-navy-800 hover:text-white"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drop Zone / Image Viewport */}
        {!imageSrc ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-navy-700 p-12 text-center cursor-pointer hover:border-gold-500/50 hover:bg-navy-900/50 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadFile(f);
              }}
            />
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gold-500/10 text-gold-400">
              <Upload className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-200">
                اضغط هنا لاختيار صورة من جهازك
              </p>
              <p className="text-xs text-slate-400 mt-1">
                يدعم PNG الشفاف، WebP، و JPG — الحد الأقصى: {maxKb} KB
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Interactive Crop Viewport */}
            <div
              ref={containerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onWheel={handleWheel}
              className="relative mx-auto flex items-center justify-center overflow-hidden rounded-2xl bg-navy-900/80 border border-navy-800 cursor-grab active:cursor-grabbing select-none"
              style={{
                width: '100%',
                height: '420px',
                backgroundImage:
                  'linear-gradient(45deg, #0e1e36 25%, transparent 25%), linear-gradient(-45deg, #0e1e36 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #0e1e36 75%), linear-gradient(-45deg, transparent 75%, #0e1e36 75%)',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
              }}
            >
              {/* Image with transform */}
              <img
                ref={imageRef}
                src={imageSrc}
                alt=""
                draggable={false}
                className="max-w-none transition-none pointer-events-none select-none"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                }}
              />

              {/* Shaded Mask Overlay */}
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                aria-hidden="true"
              >
                {/* SVG Cutout Overlay with gold border */}
                <svg width="100%" height="100%" className="absolute inset-0">
                  <defs>
                    <mask id="cropMaskHole">
                      {/* White fills everything (opaque) */}
                      <rect width="100%" height="100%" fill="white" />
                      {/* Black cuts out hole (transparent) */}
                      {maskShape === 'circle' ? (
                        <circle cx="50%" cy="50%" r={maskWidth / 2} fill="black" />
                      ) : (
                        <rect
                          x={`calc(50% - ${maskWidth / 2}px)`}
                          y={`calc(50% - ${maskHeight / 2}px)`}
                          width={maskWidth}
                          height={maskHeight}
                          rx={maskShape === 'portrait' ? 24 : 16}
                          fill="black"
                        />
                      )}
                    </mask>
                  </defs>
                  {/* Dark backdrop masked by hole */}
                  <rect
                    width="100%" height="100%"
                    fill="rgba(5, 12, 24, 0.75)"
                    mask="url(#cropMaskHole)"
                  />
                </svg>

                {/* Visible Framing Border */}
                <div
                  className={`pointer-events-none absolute border-2 border-gold-400 shadow-glow transition-all ${
                    maskShape === 'circle' ? 'rounded-full' : maskShape === 'portrait' ? 'rounded-3xl' : 'rounded-2xl'
                  }`}
                  style={{ width: `${maskWidth}px`, height: `${maskHeight}px` }}
                >
                  {/* Rule of Thirds subtle lines */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-25 pointer-events-none">
                    <div className="border-e border-b border-gold-300/40" />
                    <div className="border-e border-b border-gold-300/40" />
                    <div className="border-b border-gold-300/40" />
                    <div className="border-e border-b border-gold-300/40" />
                    <div className="border-e border-b border-gold-300/40" />
                    <div className="border-b border-gold-300/40" />
                    <div className="border-e border-gold-300/40" />
                    <div className="border-e border-gold-300/40" />
                    <div />
                  </div>
                </div>

                {/* Pan Guide Indicator */}
                <div className="absolute bottom-2 start-2 pointer-events-none flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-[11px] text-slate-300 backdrop-blur-sm">
                  <Move className="h-3 w-3 text-gold-400" />
                  <span>اسحب للتحريك | عجلة الماوس للتكبير</span>
                </div>
              </div>
            </div>

            {/* Controls Row: Zoom Slider & Reset & Switch Image */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-navy-900/60 p-3 rounded-2xl border border-navy-800">
              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-navy-800 text-slate-300 hover:text-white"
                  title="تصغير"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.02"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1 accent-gold-500 h-1.5 bg-navy-700 rounded-lg cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3.0, z + 0.1))}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-navy-800 text-slate-300 hover:text-white"
                  title="تكبير"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <span className="text-xs font-mono font-bold text-gold-400 w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleReset}
                  className="text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>إعادة ضبط الموضع</span>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>تغيير الملف</span>
                </Button>
              </div>
            </div>

            {/* Info and Size Budget Status */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">الحجم التقديري بعد الضغط:</span>
                <span
                  className={`font-mono font-bold ${
                    isOverSize ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {kbSize} KB
                </span>
                <span className="text-slate-500">(الحد الأقصى: {maxKb} KB)</span>
              </div>
              <span className="text-slate-400">
                الأبعاد الأصلية: {naturalSize.width}×{naturalSize.height} px
              </span>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-navy-800 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            إلغاء
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void handleSave()}
            disabled={!imageSrc || saving || isOverSize}
          >
            {saving ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            <span>{saving ? 'جارٍ الضغط والحفظ...' : 'قص وحفظ فوري'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
