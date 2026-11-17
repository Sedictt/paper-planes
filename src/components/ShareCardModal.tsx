import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Download, X } from 'lucide-react';
import type { PaperPlaneNote } from '../types';
import {
  renderShareCardToCanvas,
  type ShareAspect,
  type ShareCardStyle,
  type ShareTheme,
} from '../lib/shareCardGenerator';

interface ShareCardModalProps {
  plane: PaperPlaneNote | null;
  islandSnapshotUrl?: string | null;
  onClose: () => void;
}

const THEME_OPTIONS: Array<{ id: ShareTheme; label: string; swatch: string }> = [
  { id: 'island', label: 'Island', swatch: 'linear-gradient(135deg, #4B8B7B, #78B943)' },
  { id: 'frog', label: 'Frog Pond', swatch: 'linear-gradient(135deg, #2C5834, #9ED16A)' },
  { id: 'morning', label: 'Morning', swatch: 'linear-gradient(135deg, #566D91, #F3B192)' },
  { id: 'golden', label: 'Golden Hour', swatch: 'linear-gradient(135deg, #C7653A, #F6D89B)' },
  { id: 'dusk', label: 'Dusk', swatch: 'linear-gradient(135deg, #3B3963, #F4B57E)' },
  { id: 'midnight', label: 'Midnight', swatch: 'linear-gradient(135deg, #0D1328, #243254)' },
  { id: 'minimal', label: 'Paper', swatch: 'linear-gradient(135deg, #ECE6DA, #DFD7C8)' },
];

const ASPECT_OPTIONS: Array<{ id: ShareAspect; label: string }> = [
  { id: 'square', label: '1:1' },
  { id: 'portrait', label: '4:5' },
  { id: 'landscape', label: '16:9' },
];

export function ShareCardModal({ plane, islandSnapshotUrl, onClose }: ShareCardModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [aspect, setAspect] = useState<ShareAspect>('square');
  const [theme, setTheme] = useState<ShareTheme>('island');
  const [cardStyle, setCardStyle] = useState<ShareCardStyle>('glass');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [snapshotImg, setSnapshotImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!islandSnapshotUrl) {
      setSnapshotImg(null);
      return;
    }
    const img = new Image();
    img.onload = () => setSnapshotImg(img);
    img.src = islandSnapshotUrl;
  }, [islandSnapshotUrl]);

  useEffect(() => {
    if (!plane || !canvasRef.current) return;
    renderShareCardToCanvas(canvasRef.current, plane, {
      aspect,
      theme,
      cardStyle,
      showMeta: false,
      islandSnapshot: snapshotImg,
    });
  }, [plane, aspect, theme, cardStyle, snapshotImg]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || !plane) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `paper-plane-${plane.number}.png`;
    a.click();
  };

  const handleCopyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png')
      );
      if (!blob || !navigator.clipboard || typeof ClipboardItem === 'undefined') {
        setCopyState('error');
        setTimeout(() => setCopyState('idle'), 2000);
        return;
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  };

  return (
    <AnimatePresence>
      {plane && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            className="share-modal-card"
            initial={{ scale: 0.96, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 8, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Share Note"
          >
            <div className="share-modal-header">
              <h2 className="share-modal-title">Share Note</h2>
              <button
                type="button"
                onClick={onClose}
                className="share-close-btn"
                aria-label="Close share preview"
              >
                <X size={15} />
              </button>
            </div>

            <div className="share-preview-stage">
              <canvas ref={canvasRef} className="share-preview-canvas" />
            </div>

            <div className="share-toolbar">
              <div className="share-swatch-row" role="group" aria-label="Backdrop">
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTheme(opt.id)}
                    className={`share-swatch-btn ${theme === opt.id ? 'active' : ''}`}
                    title={opt.label}
                    aria-label={`${opt.label} backdrop`}
                    aria-pressed={theme === opt.id}
                    style={{ background: opt.swatch }}
                  />
                ))}
              </div>

              <div className="share-segmented" role="group" aria-label="Card Style">
                <button
                  type="button"
                  onClick={() => setCardStyle('paper')}
                  className={`share-seg-btn ${cardStyle === 'paper' ? 'active' : ''}`}
                >
                  Paper
                </button>
                <button
                  type="button"
                  onClick={() => setCardStyle('glass')}
                  className={`share-seg-btn ${cardStyle === 'glass' ? 'active' : ''}`}
                >
                  Glass
                </button>
              </div>

              <div className="share-segmented" role="group" aria-label="Aspect Ratio">
                {ASPECT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAspect(opt.id)}
                    className={`share-seg-btn ${aspect === opt.id ? 'active' : ''}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="share-actions">
              <button
                id="share-copy-img-btn"
                type="button"
                onClick={handleCopyImage}
                className="share-secondary-btn"
              >
                {copyState === 'copied' ? <Check size={14} /> : <Copy size={14} />}
                <span>
                  {copyState === 'copied'
                    ? 'Copied'
                    : copyState === 'error'
                      ? 'Save PNG instead'
                      : 'Copy Image'}
                </span>
              </button>
              <button
                id="share-download-png-btn"
                type="button"
                onClick={handleDownload}
                className="share-primary-btn"
              >
                <Download size={14} />
                <span>Save PNG</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
