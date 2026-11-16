import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CloudRain,
  CloudSnow,
  Compass,
  Coffee,
  Flag,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
  Wind,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { IsometricWorldEngine, PALETTES } from './engine/IsometricWorldEngine';
import { fetchPlanesPool, flagPlaneNote, launchNewPlane, recordPlaneRead } from './lib/api';
import { soundscape } from './lib/soundscape';
import {
  BIOME_SPOTS,
  detectLocalTimeOfDay,
  type PaperPlaneNote,
  type PaperTint,
  type TimeMode,
  type TimeOfDay,
  type WeatherMode,
} from './types';

const TIME_OPTIONS: Array<{ id: TimeMode; label: string }> = [
  { id: 'auto', label: 'Sync' },
  { id: 'dawn', label: 'Dawn' },
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'dusk', label: 'Dusk' },
  { id: 'evening', label: 'Evening' },
  { id: 'midnight', label: 'Midnight' },
];

const PAPER_TINTS: Array<{ id: PaperTint; label: string; hex: string }> = [
  { id: 'cream', label: 'Warm Cream', hex: '#fbf6ec' },
  { id: 'rose', label: 'Blush Rose', hex: '#fdf0ef' },
  { id: 'sky', label: 'Sky Blue', hex: '#eef6fb' },
  { id: 'sage', label: 'Meadow Sage', hex: '#eff7f1' },
  { id: 'gold', label: 'Golden Hour', hex: '#fdf6e4' },
];

const STAMPS = ['AIRMAIL', 'UNSAID', '2 AM', 'LET GO', 'DRIFTING', 'HEART'];

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<IsometricWorldEngine | null>(null);

  const [planes, setPlanes] = useState<PaperPlaneNote[]>([]);
  const [timeMode, setTimeMode] = useState<TimeMode>('auto');
  const [weather, setWeather] = useState<WeatherMode>('clear');
  const [fireworks, setFireworks] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.05);
  const [isMuted, setIsMuted] = useState(true);

  // Modals: Read Unfolded Note, Compose Note, Support Modal, Command Menu (Cmd+K)
  const [selectedPlane, setSelectedPlane] = useState<PaperPlaneNote | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isCmdOpen, setIsCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');

  // Compose Form State
  const [composeText, setComposeText] = useState('');
  const [composeTint, setComposeTint] = useState<PaperTint>('cream');
  const [composeStamp, setComposeStamp] = useState('UNSAID');
  const [composeBiome, setComposeBiome] = useState('Downtown Crossing');
  const [composeError, setComposeError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Undo Toast State (per AGENTS.md Section 1: Undo Toasts for archive/flag actions)
  const [toast, setToast] = useState<{
    message: string;
    undoPlane?: PaperPlaneNote;
  } | null>(null);

  const activeTimeOfDay: TimeOfDay = useMemo(
    () => (timeMode === 'auto' ? detectLocalTimeOfDay() : timeMode),
    [timeMode]
  );

  const isMac = useMemo(
    () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform),
    []
  );

  // Initialize Isometric 2.5D Engine & Load Planes Pool
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new IsometricWorldEngine(
      canvasRef.current,
      (note) => {
        soundscape.playPaperWhoosh('unfold');
        setSelectedPlane({ ...note, reads: note.reads + 1 });
        setPlanes((prev) =>
          prev.map((p) => (p.id === note.id ? { ...p, reads: p.reads + 1 } : p))
        );
        recordPlaneRead(note.id);
      },
      (z) => setZoomLevel(z)
    );
    engineRef.current = engine;

    fetchPlanesPool()
      .then((initialPlanes) => {
        setPlanes(initialPlanes);
        engine.syncPlanes(initialPlanes);
      })
      .catch(() => {
        // Fallback already handled inside engine
      });

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Sync Engine state when Time, Weather, Fireworks, or Planes change
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.timeOfDay = activeTimeOfDay;
    eng.weather = weather;
    eng.fireworksActive = fireworks;
    eng.syncPlanes(planes);
  }, [activeTimeOfDay, weather, fireworks, planes]);

  // Global Keyboard Shortcuts (Cmd+K / Ctrl+K command palette, N to compose, Esc to close)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCmdOpen((v) => !v);
        setCmdQuery('');
        return;
      }
      if (e.key === 'Escape') {
        setSelectedPlane(null);
        setIsComposeOpen(false);
        setIsSupportOpen(false);
        setIsCmdOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Optimistic Fold & Launch Handler
  const handleFoldAndLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    setComposeError(null);
    const trimmed = composeText.trim();
    if (trimmed.length < 3) {
      setComposeError('Write at least a few words before folding your plane.');
      return;
    }

    setIsSubmitting(true);
    const idempotencyKey = `launch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Optimistic snapshot per AGENTS.md Section 1
    const prevPlanes = [...planes];
    const optimisticPlane: PaperPlaneNote = {
      id: `temp-${idempotencyKey}`,
      number: 200 + planes.length * 7,
      text: trimmed,
      biome: composeBiome,
      timeOfDay: activeTimeOfDay,
      paperTint: composeTint,
      stamp: composeStamp,
      reads: 1,
      distanceKm: 0.1,
      createdAt: 'Just now',
      flags: 0,
      isUserCreated: true,
    };

    try {
      const saved = await launchNewPlane({
        text: trimmed,
        biome: composeBiome,
        timeOfDay: activeTimeOfDay,
        paperTint: composeTint,
        stamp: composeStamp,
        idempotencyKey,
      });

      soundscape.playPaperWhoosh('launch');
      setPlanes([{ ...saved, isUserCreated: true }, ...prevPlanes]);
      setIsComposeOpen(false);
      setComposeText('');
      setToast({ message: `Plane #${saved.number} folded and launched into the ${PALETTES[activeTimeOfDay].label} sky.` });
      setTimeout(() => setToast(null), 4500);
    } catch (err) {
      // Roll back optimistic state & display server validation message
      setPlanes(prevPlanes);
      setComposeError(err instanceof Error ? err.message : 'Could not launch plane.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Catch a Random Drifting Plane
  const handleCatchRandomPlane = () => {
    if (planes.length === 0) return;
    const randomPlane = planes[Math.floor(Math.random() * planes.length)];
    soundscape.playPaperWhoosh('unfold');
    setSelectedPlane({ ...randomPlane, reads: randomPlane.reads + 1 });
    recordPlaneRead(randomPlane.id);
  };

  // Crumple / Flag a Note with Undo Toast (per AGENTS.md Undo Toasts rule)
  const handleFlagPlane = (plane: PaperPlaneNote) => {
    setSelectedPlane(null);
    setPlanes((prev) => prev.filter((p) => p.id !== plane.id));
    flagPlaneNote(plane.id, false);
    setToast({
      message: `Plane #${plane.number} folded away from your sky.`,
      undoPlane: plane,
    });
  };

  const handleUndoFlag = () => {
    if (!toast?.undoPlane) return;
    const restored = toast.undoPlane;
    setPlanes((prev) => [restored, ...prev]);
    flagPlaneNote(restored.id, true);
    setToast(null);
  };

  const toggleSound = () => {
    const muted = soundscape.toggleMute(weather);
    setIsMuted(muted);
  };

  const changeWeather = (w: WeatherMode) => {
    setWeather(w);
    soundscape.updateWeatherMix(w);
  };

  const toggleFireworks = () => {
    const next = !fireworks;
    setFireworks(next);
    if (next) engineRef.current?.triggerFireworkVolley();
  };

  return (
    <div className="app-shell">
      {/* Top HUD Header */}
      <header className="hud-header">
        <div className="brand-cluster">
          <div className="brand-logo" aria-hidden="true">
            <Send size={17} />
          </div>
          <div>
            <h1 className="brand-title">Paper Planes</h1>
            <div className="brand-subtitle">
              <span>
                {timeMode === 'auto'
                  ? `Local Sky · ${PALETTES[activeTimeOfDay].label}`
                  : `Preview · ${PALETTES[activeTimeOfDay].label}`}
              </span>
              <span>·</span>
              <span className="tabular-nums">{planes.length} drifting</span>
            </div>
          </div>
        </div>

        {/* Time of Day Sync Bar */}
        <div className="control-strip" role="group" aria-label="Time of Day">
          {TIME_OPTIONS.map((t) => (
            <button
              key={t.id}
              id={`time-btn-${t.id}`}
              type="button"
              onClick={() => setTimeMode(t.id)}
              className={`hud-btn ${timeMode === t.id ? 'active' : ''} ${
                t.id !== 'auto' && t.id !== 'dusk' && t.id !== 'midnight' ? 'hide-mobile' : ''
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Weather, Fireworks & Ambient Sound Bar */}
        <div className="control-strip" role="group" aria-label="Atmosphere and Weather">
          <button
            id="weather-clear-btn"
            type="button"
            onClick={() => changeWeather('clear')}
            className={`hud-btn ${weather === 'clear' ? 'active' : ''}`}
            title="Clear Sky"
          >
            <Sun size={14} />
            <span className="hide-mobile">Clear</span>
          </button>
          <button
            id="weather-rain-btn"
            type="button"
            onClick={() => changeWeather('rain')}
            className={`hud-btn ${weather === 'rain' ? 'active' : ''}`}
            title="Gentle Rain"
          >
            <CloudRain size={14} />
            <span className="hide-mobile">Rain</span>
          </button>
          <button
            id="weather-snow-btn"
            type="button"
            onClick={() => changeWeather('snow')}
            className={`hud-btn ${weather === 'snow' ? 'active' : ''}`}
            title="Winter Snow"
          >
            <CloudSnow size={14} />
            <span className="hide-mobile">Winter</span>
          </button>
          <button
            id="fireworks-toggle-btn"
            type="button"
            onClick={toggleFireworks}
            className={`hud-btn ${fireworks ? 'active' : ''}`}
            title="Harbor Fireworks"
          >
            <Sparkles size={14} />
            <span className="hide-mobile">Fireworks</span>
          </button>
          <button
            id="sound-toggle-btn"
            type="button"
            onClick={toggleSound}
            className={`hud-btn ${!isMuted ? 'active' : ''}`}
            title={isMuted ? 'Unmute Ambient Wind & Rain' : 'Mute Ambient Audio'}
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </div>

        {/* Primary CTA: Fold a Plane */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <button
            id="open-compose-cta"
            type="button"
            onClick={() => {
              setComposeError(null);
              setIsComposeOpen(true);
            }}
            className="primary-cta-btn"
          >
            <Plus size={16} />
            <span>Fold a Plane</span>
          </button>
        </div>
      </header>

      {/* Biome Quick-Jump Chips */}
      <nav className="biome-dock" aria-label="Biome Camera Locations">
        {BIOME_SPOTS.map((spot) => (
          <button
            key={spot.id}
            id={`biome-chip-${spot.id}`}
            type="button"
            onClick={() => engineRef.current?.focusBiome(spot.gx, spot.gy, spot.zoom)}
            className="biome-chip"
          >
            <Compass size={13} />
            <span>{spot.label}</span>
          </button>
        ))}
      </nav>

      {/* Right Camera Zoom Controls */}
      <aside className="camera-dock" aria-label="Zoom Controls">
        <div className="zoom-stack">
          <button
            id="zoom-in-btn"
            type="button"
            onClick={() => engineRef.current?.adjustZoom(0.2)}
            className="zoom-btn"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <div className="zoom-readout tabular-nums">{zoomLevel.toFixed(1)}x</div>
          <button
            id="zoom-out-btn"
            type="button"
            onClick={() => engineRef.current?.adjustZoom(-0.2)}
            className="zoom-btn"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
        </div>
        <button
          id="reset-camera-btn"
          type="button"
          onClick={() => engineRef.current?.focusBiome(12, 12, 1.05)}
          className="zoom-btn"
          style={{
            background: 'var(--bg-hud)',
            border: '1px solid var(--border-hud)',
            borderRadius: 'var(--radius-inner)',
          }}
          title="Reset Camera View"
          aria-label="Reset Camera View"
        >
          <RotateCcw size={15} />
        </button>
      </aside>

      {/* Main 2.5D Isometric Pixel Canvas */}
      <main className="world-canvas-container">
        <canvas ref={canvasRef} id="paper-planes-canvas" />
      </main>

      {/* Bottom Floating HUD & Support Button */}
      <footer className="bottom-hud">
        <div className="hud-pill">
          <Wind size={14} style={{ color: 'var(--accent-gold)' }} />
          <span>Click any drifting paper plane to unfold its letter</span>
          <button
            id="catch-random-btn"
            type="button"
            onClick={handleCatchRandomPlane}
            className="hud-btn active"
            style={{ marginLeft: '0.25rem', padding: '0.25em 0.65em', minHeight: '28px' }}
          >
            Catch Random ✈
          </button>
          <button
            id="open-cmd-palette-btn"
            type="button"
            onClick={() => setIsCmdOpen(true)}
            className="hud-btn hide-mobile"
            style={{ minHeight: '28px', padding: '0.2em 0.5em' }}
            title="Open Command Palette"
          >
            <kbd className="kbd-badge">{isMac ? '⌘K' : 'Ctrl+K'}</kbd>
          </button>
        </div>

        <button
          id="support-sky-btn"
          type="button"
          onClick={() => setIsSupportOpen(true)}
          className="support-btn"
        >
          <Coffee size={14} />
          <span>Support the Sky</span>
        </button>
      </footer>

      {/* =====================================================================
          1. UNFOLDED PAPER PLANE READER MODAL
          ===================================================================== */}
      <AnimatePresence>
        {selectedPlane && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedPlane(null);
            }}
          >
            <motion.div
              className="paper-sheet"
              data-tint={selectedPlane.paperTint}
              initial={{ scaleX: 0.22, scaleY: 0.08, rotate: -12, y: 40, opacity: 0 }}
              animate={{ scaleX: 1, scaleY: 1, rotate: 0, y: 0, opacity: 1 }}
              exit={{ scaleX: 0.15, scaleY: 0.06, rotate: 18, x: 140, y: -120, opacity: 0 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="unfolded-plane-title"
            >
              <div className="paper-header">
                <div className="paper-meta" id="unfolded-plane-title">
                  <svg
                    width="22"
                    height="16"
                    viewBox="0 0 12 9"
                    style={{ imageRendering: 'pixelated', flexShrink: 0 }}
                  >
                    <path d="M0 4 L11 0 L7 8 L5 5 L0 4 Z" fill="#d96b43" />
                    <path d="M5 5 L11 0 L6 6 Z" fill="#9e4728" />
                  </svg>
                  <span>
                    Folded at {PALETTES[selectedPlane.timeOfDay]?.label ?? 'Dusk'} ·{' '}
                    {selectedPlane.biome}
                  </span>
                </div>
                <div className="paper-stamp">
                  {selectedPlane.stamp} · #{selectedPlane.number}
                </div>
              </div>

              <div className="paper-body">
                <p className="paper-text">{selectedPlane.text}</p>
              </div>

              <div className="paper-footer">
                <div className="tabular-nums">
                  <span>Unfolded {selectedPlane.reads} times</span>
                  <span> · </span>
                  <span>Drifted {selectedPlane.distanceKm} km</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    id="crumple-report-btn"
                    type="button"
                    onClick={() => handleFlagPlane(selectedPlane)}
                    className="paper-Subtle-btn"
                    title="Hide or report spam plane"
                  >
                    <Flag size={12} />
                    <span>Hide</span>
                  </button>
                  <button
                    id="refold-release-btn"
                    type="button"
                    onClick={() => {
                      soundscape.playPaperWhoosh('launch');
                      setSelectedPlane(null);
                    }}
                    className="paper-btn"
                  >
                    <span>Refold &amp; Let Fly</span>
                    <Send size={13} />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          2. COMPOSE & FOLD NEW PAPER PLANE MODAL
          ===================================================================== */}
      <AnimatePresence>
        {isComposeOpen && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsComposeOpen(false);
            }}
          >
            <motion.form
              onSubmit={handleFoldAndLaunch}
              className="paper-sheet"
              data-tint={composeTint}
              initial={{ scale: 0.9, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scaleX: 0.12, scaleY: 0.05, rotate: 20, x: 160, y: -150, opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="compose-plane-title"
            >
              <div className="paper-header">
                <div className="paper-meta" id="compose-plane-title">
                  <span>Write an Anonymous Letter · 100% Unsaid &amp; Free</span>
                </div>
                <button
                  id="close-compose-btn"
                  type="button"
                  onClick={() => setIsComposeOpen(false)}
                  className="paper-Subtle-btn"
                >
                  Cancel ✕
                </button>
              </div>

              <textarea
                id="compose-note-textarea"
                className="paper-textarea"
                maxLength={320}
                placeholder="Write whatever is on your mind—an unsaid feeling towards someone, a quiet confession, or a gentle wish for the next stranger who unfolds this plane..."
                value={composeText}
                onChange={(e) => setComposeText(e.target.value)}
                autoFocus
              />

              {/* Paper Customization Row: Paper Tint, Stamp & Launch Point */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  marginTop: '0.5rem',
                }}
              >
                <div className="tint-picker" role="radiogroup" aria-label="Paper Color">
                  {PAPER_TINTS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setComposeTint(t.id)}
                      className={`tint-swatch ${composeTint === t.id ? 'selected' : ''}`}
                      style={{ backgroundColor: t.hex }}
                      title={t.label}
                      aria-label={t.label}
                    />
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <select
                    id="compose-stamp-select"
                    value={composeStamp}
                    onChange={(e) => setComposeStamp(e.target.value)}
                    className="paper-Subtle-btn"
                    aria-label="Paper Stamp"
                  >
                    {STAMPS.map((s) => (
                      <option key={s} value={s}>
                        Stamp: {s}
                      </option>
                    ))}
                  </select>

                  <select
                    id="compose-biome-select"
                    value={composeBiome}
                    onChange={(e) => setComposeBiome(e.target.value)}
                    className="paper-Subtle-btn"
                    aria-label="Launch Location"
                  >
                    <option value="Downtown Crossing">From: Downtown</option>
                    <option value="Cobblestone Village">From: Village</option>
                    <option value="Valley Waterfall">From: Valley</option>
                    <option value="Seaside Boardwalk">From: Seaside Pier</option>
                  </select>
                </div>
              </div>

              {composeError && (
                <div
                  role="alert"
                  style={{
                    marginTop: '0.65rem',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '6px',
                    background: 'rgba(224, 82, 82, 0.14)',
                    border: '1px solid rgba(224, 82, 82, 0.4)',
                    color: '#9e2a2b',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}
                >
                  {composeError}
                </div>
              )}

              <div className="paper-footer">
                <span className="tabular-nums">{composeText.length} / 320 chars</span>
                <button
                  id="submit-fold-launch-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className="paper-btn launch"
                >
                  <span>{isSubmitting ? 'Folding...' : 'Fold & Throw Into Sky'}</span>
                  <Send size={14} />
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          3. HOBBY SUSTAINABILITY & DONATION MODAL ("Support the Sky")
          ===================================================================== */}
      <AnimatePresence>
        {isSupportOpen && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsSupportOpen(false);
            }}
          >
            <motion.div
              className="paper-sheet"
              data-tint="gold"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="support-modal-title"
            >
              <div className="paper-header">
                <div className="paper-meta" id="support-modal-title">
                  <Coffee size={15} />
                  <span>Keeping Paper Planes Free &amp; Ad-Free Forever</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSupportOpen(false)}
                  className="paper-Subtle-btn"
                >
                  Close ✕
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '0.4rem 0' }}>
                <p className="paper-text" style={{ fontSize: '0.92rem', lineHeight: '1.65rem' }}>
                  Paper Planes is an indie hobby sanctuary built so anyone, anywhere can fold an unsaid thought and watch it drift across a cozy sky—with zero ads, zero trackers, and zero paywalls.
                </p>
                <p className="paper-text" style={{ fontSize: '0.88rem', lineHeight: '1.55rem', color: 'var(--paper-ink-muted)' }}>
                  All Golden Hour paper tints and stamps are unlocked for everyone! If this space brought you a quiet moment of peace, you can help cover domain &amp; server breeze costs via Ko-fi or Buy Me a Coffee.
                </p>
              </div>

              <div className="paper-footer">
                <span>100% Community Supported</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <a
                    href="https://ko-fi.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="paper-btn launch"
                    style={{ textDecoration: 'none' }}
                  >
                    <Coffee size={14} />
                    <span>Support on Ko-fi ☕</span>
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          4. COMMAND PALETTE (Cmd+K / Ctrl+K per AGENTS.md Section 1)
          ===================================================================== */}
      <AnimatePresence>
        {isCmdOpen && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsCmdOpen(false);
            }}
          >
            <motion.div
              className="cmd-dialog"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              role="dialog"
              aria-modal="true"
              aria-label="Command Menu"
            >
              <input
                type="text"
                className="cmd-input"
                placeholder="Type a command (e.g., Fold, Catch random, Midnight, Rain, Village)..."
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                autoFocus
              />
              <div className="cmd-list">
                {[
                  {
                    label: 'Fold & Launch a New Paper Plane',
                    hint: 'Compose',
                    action: () => {
                      setIsCmdOpen(false);
                      setIsComposeOpen(true);
                    },
                  },
                  {
                    label: 'Catch & Unfold a Random Paper Plane',
                    hint: 'Read',
                    action: () => {
                      setIsCmdOpen(false);
                      handleCatchRandomPlane();
                    },
                  },
                  {
                    label: 'Camera: Jump to Downtown Crossing',
                    hint: 'Biome',
                    action: () => {
                      setIsCmdOpen(false);
                      engineRef.current?.focusBiome(10, 7, 1.55);
                    },
                  },
                  {
                    label: 'Camera: Jump to Cobblestone Village',
                    hint: 'Biome',
                    action: () => {
                      setIsCmdOpen(false);
                      engineRef.current?.focusBiome(8, 14, 1.65);
                    },
                  },
                  {
                    label: 'Camera: Jump to Valley Waterfall',
                    hint: 'Biome',
                    action: () => {
                      setIsCmdOpen(false);
                      engineRef.current?.focusBiome(4, 4, 1.55);
                    },
                  },
                  {
                    label: 'Camera: Jump to Seaside Harbor & Lighthouse',
                    hint: 'Biome',
                    action: () => {
                      setIsCmdOpen(false);
                      engineRef.current?.focusBiome(17, 17, 1.5);
                    },
                  },
                  {
                    label: 'Atmosphere: Sync With Local Time',
                    hint: 'Time',
                    action: () => {
                      setIsCmdOpen(false);
                      setTimeMode('auto');
                    },
                  },
                  {
                    label: 'Atmosphere: Switch to Dusk (Golden Hour)',
                    hint: 'Time',
                    action: () => {
                      setIsCmdOpen(false);
                      setTimeMode('dusk');
                    },
                  },
                  {
                    label: 'Atmosphere: Switch to Midnight',
                    hint: 'Time',
                    action: () => {
                      setIsCmdOpen(false);
                      setTimeMode('midnight');
                    },
                  },
                  {
                    label: 'Weather: Toggle Rain Shower',
                    hint: 'Weather',
                    action: () => {
                      setIsCmdOpen(false);
                      changeWeather(weather === 'rain' ? 'clear' : 'rain');
                    },
                  },
                  {
                    label: 'Weather: Toggle Cozy Winter Snow',
                    hint: 'Weather',
                    action: () => {
                      setIsCmdOpen(false);
                      changeWeather(weather === 'snow' ? 'clear' : 'snow');
                    },
                  },
                  {
                    label: 'Event: Launch Seaside Fireworks',
                    hint: 'Event',
                    action: () => {
                      setIsCmdOpen(false);
                      toggleFireworks();
                    },
                  },
                ]
                  .filter((item) =>
                    item.label.toLowerCase().includes(cmdQuery.trim().toLowerCase())
                  )
                  .map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.action}
                      className="cmd-item"
                    >
                      <span>{item.label}</span>
                      <kbd className="kbd-badge">{item.hint}</kbd>
                    </button>
                  ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Undo / Status Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast-container"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            role="status"
          >
            <span>{toast.message}</span>
            {toast.undoPlane && (
              <button
                type="button"
                onClick={handleUndoFlag}
                className="hud-btn active"
                style={{ minHeight: '28px', padding: '0.2em 0.6em' }}
              >
                Undo
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
