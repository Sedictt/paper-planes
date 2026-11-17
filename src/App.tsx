import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bug,
  Clock,
  Coffee,
  Compass,
  Flag,
  MessageSquare,
  Music,
  Plus,
  RotateCcw,
  Search,
  Send,
  Settings,
  Share2,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
  Wind,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { WorldFallback } from './components/WorldFallback';
import { CustomCursor } from './components/CustomCursor';
import { CountryCombobox } from './components/CountryCombobox';
import { ShareCardModal } from './components/ShareCardModal';
import { IsometricWorldEngine, PALETTES } from './engine/IsometricWorldEngine';
import type { GraphicsQuality } from './engine/ThreeWorldEngine';
import {
  fetchDetectedRegion,
  fetchPlanesPool,
  fetchRandomPlane,
  flagPlaneNote,
  launchNewPlane,
  recordPlaneRead,
  removePlaneFromPoolCache,
  restorePlaneInPoolCache,
  submitFeedback,
} from './lib/api';
import { getCountryName, getCountryOptions } from './lib/countries';
import {
  MUSIC_TRACKS,
  soundscape,
  type MusicTrackId,
  type MusicTrackInfo,
} from './lib/soundscape';
import { detectWebGLSupport } from './lib/webgl';
import {
  BIOME_SPOTS,
  detectLocalTimeOfDay,
  type PaperPlaneNote,
  type PaperTint,
  type TimeMode,
  type TimeOfDay,
  type WeatherMode,
} from './types';

const FROG_LINES = [
  'ribbit~',
  'nice breeze today!',
  'my duck floatie is ready.',
  'i like my pink bow!',
  'splish splash~',
  'the shrine is so cozy...',
  'did a wish fly by?',
  '*happy frog noises*',
  '10/10 pond vibes.',
  'croak!',
  'catching clouds today~',
  'stay hydrated!',
];

const TIME_OPTIONS: Array<{ id: TimeMode; label: string }> = [
  { id: 'auto', label: 'Sync with Local' },
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

function removeCanvas(container: HTMLElement, canvas: HTMLCanvasElement): void {
  if (canvas.parentNode === container) {
    container.removeChild(canvas);
  }
}

export function App() {
  const canvasContainerRef = useRef<HTMLElement | null>(null);
  const engineRef = useRef<IsometricWorldEngine | null>(null);
  const timeMenuRef = useRef<HTMLDivElement | null>(null);
  const recentCaughtIdsRef = useRef<string[]>([]);

  const [planes, setPlanes] = useState<PaperPlaneNote[]>([]);
  const [timeMode, setTimeMode] = useState<TimeMode>('auto');
  const [isTimeMenuOpen, setIsTimeMenuOpen] = useState(false);
  const [weather, setWeather] = useState<WeatherMode>('clear');
  const [fireworks, setFireworks] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.05);
  const [activeBiomeId, setActiveBiomeId] = useState<string>('overview');
  const [isMuted, setIsMuted] = useState(true);
  const [isMusicMenuOpen, setIsMusicMenuOpen] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<MusicTrackInfo>(() =>
    soundscape.getCurrentTrack()
  );
  const [autoCycleMusic, setAutoCycleMusic] = useState(() => soundscape.getAutoCycle());
  const [musicVolume, setMusicVolume] = useState(() => soundscape.getMusicVolume());
  const [ambienceVolume, setAmbienceVolume] = useState(() => soundscape.getAmbienceVolume());
  const musicMenuRef = useRef<HTMLDivElement | null>(null);

  // WebGL 2 is required by the three.js world. Track unavailability separately
  // so the page can explain itself instead of unmounting to a blank screen.
  const [worldError, setWorldError] = useState<{ message: string; detail?: string } | null>(
    null
  );
  const [engineAttempt, setEngineAttempt] = useState(0);

  // Modals: Read Unfolded Note, Compose Note, Support Modal, Command Menu (Cmd+K)
  const [selectedPlane, setSelectedPlane] = useState<PaperPlaneNote | null>(null);
  const [sharePlane, setSharePlane] = useState<PaperPlaneNote | null>(null);
  const [islandSnapshotUrl, setIslandSnapshotUrl] = useState<string | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [feedbackMode, setFeedbackMode] = useState<'feedback' | 'bug' | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackReplyTo, setFeedbackReplyTo] = useState('');
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>('high');
  const [volumetricIntensity, setVolumetricIntensity] = useState(1.35);
  const [bloomEnabled, setBloomEnabled] = useState(true);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const [frogLine, setFrogLine] = useState<string | null>(null);
  const frogBubbleRef = useRef<HTMLDivElement>(null);
  const frogTimerRef = useRef<number | null>(null);
  const [isCmdOpen, setIsCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [cmdIndex, setCmdIndex] = useState(0);

  // Region Filter & Compose State
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [regionFallbackCountry, setRegionFallbackCountry] = useState<string | null>(null);

  // Compose Form State
  const [composeTitle, setComposeTitle] = useState('');
  const [composeText, setComposeText] = useState('');
  const [composeTint, setComposeTint] = useState<PaperTint>('cream');
  const [composeError, setComposeError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const composeBodyRef = useRef<HTMLTextAreaElement | null>(null);

  const countryOptions = useMemo(() => getCountryOptions(detectedCountry), [detectedCountry]);

  // Undo / Status Toast State
  const [toast, setToast] = useState<{
    message: string;
    undoPlane?: PaperPlaneNote;
  } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = (
    next: { message: string; undoPlane?: PaperPlaneNote },
    autoDismissMs = 4500
  ) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(next);
    if (autoDismissMs > 0) {
      toastTimerRef.current = window.setTimeout(() => {
        toastTimerRef.current = null;
        setToast(null);
      }, autoDismissMs);
    }
  };

  const [autoTimeTick, setAutoTimeTick] = useState(0);
  useEffect(() => {
    if (timeMode !== 'auto') return;
    const id = window.setInterval(() => setAutoTimeTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, [timeMode]);

  const activeTimeOfDay: TimeOfDay = useMemo(
    () => (timeMode === 'auto' ? detectLocalTimeOfDay() : timeMode),
    [timeMode, autoTimeTick]
  );

  const isMac = useMemo(
    () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform),
    []
  );

  // Initialize Isometric 2.5D Engine & Load Planes Pool
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    // Three.js needs WebGL 2; bail out before the renderer throws and takes
    // the whole React tree down with it.
    const support = detectWebGLSupport();
    if (!support.supported) {
      setWorldError({ message: support.reason, detail: support.detail });
      return;
    }

    // React StrictMode mounts, cleans up, then mounts again in development.
    // engine.destroy() releases the GL context, and a canvas handed a dead
    // context returns it forever — so each engine gets its own canvas.
    const canvas = document.createElement('canvas');
    canvas.id = 'paper-planes-canvas';
    container.appendChild(canvas);

    let engine: IsometricWorldEngine;
    try {
      engine = new IsometricWorldEngine(
        canvas,
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
    } catch (error) {
      console.error('[Paper Planes] WebGL world failed to start:', error);
      removeCanvas(container, canvas);
      setWorldError({
        message: 'Your browser could not start the WebGL 2 renderer, so the sky stays closed.',
        detail: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    engineRef.current = engine;
    setWorldError(null);

    fetchDetectedRegion().then((country) => {
      if (country) {
        setDetectedCountry(country);
      }
    });

    return () => {
      engine.destroy();
      engineRef.current = null;
      removeCanvas(container, canvas);
    };
  }, [engineAttempt]);

  // Fetch planes whenever the active region filter changes (or on initial mount)
  useEffect(() => {
    const activeCountry = selectedCountry || undefined;
    fetchPlanesPool(false, activeCountry)
      .then(({ planes: nextPlanes, fallbackUsed }) => {
        setPlanes(nextPlanes);
        setRegionFallbackCountry(fallbackUsed && activeCountry ? activeCountry : null);
        engineRef.current?.syncPlanes(nextPlanes);
      })
      .catch(() => {
        showToast({
          message: 'Sky is offline right now — showing local sanctuary.',
        });
      });
  }, [selectedCountry]);

  // Sync Engine state when Time, Weather, Fireworks, Graphics, or Planes change
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.timeOfDay = activeTimeOfDay;
    eng.weather = weather;
    eng.fireworksActive = fireworks;
    eng.setGraphicsQuality(graphicsQuality);
    eng.setVolumetricIntensity(volumetricIntensity);
    eng.setBloomEnabled(bloomEnabled);
    eng.syncPlanes(planes);
  }, [activeTimeOfDay, weather, fireworks, graphicsQuality, volumetricIntensity, bloomEnabled, planes]);

  // Close Time Popover on outside click
  useEffect(() => {
    if (!isTimeMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (timeMenuRef.current && !timeMenuRef.current.contains(e.target as Node)) {
        setIsTimeMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [isTimeMenuOpen]);

  // Close Graphics Settings Popover on outside click
  useEffect(() => {
    if (!isSettingsOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [isSettingsOpen]);

  // Close Music Popover on outside click
  useEffect(() => {
    if (!isMusicMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (musicMenuRef.current && !musicMenuRef.current.contains(e.target as Node)) {
        setIsMusicMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [isMusicMenuOpen]);

  // Sync soundscape state (e.g. when auto-cycle advances to next track)
  useEffect(() => {
    return soundscape.subscribe(() => {
      setIsMuted(soundscape.getMuted());
      setCurrentTrack(soundscape.getCurrentTrack());
      setAutoCycleMusic(soundscape.getAutoCycle());
      setMusicVolume(soundscape.getMusicVolume());
      setAmbienceVolume(soundscape.getAmbienceVolume());
    });
  }, []);

  // Frog NPC speech bubble: pops on frog click + occasional ambient line
  useEffect(() => {
    const showFrogLine = () => {
      setFrogLine((prev) => {
        const pool = FROG_LINES.filter((l) => l !== prev);
        return pool[Math.floor(Math.random() * pool.length)] ?? FROG_LINES[0];
      });
      if (frogTimerRef.current) window.clearTimeout(frogTimerRef.current);
      frogTimerRef.current = window.setTimeout(() => setFrogLine(null), 3200);
    };

    window.addEventListener('paperplanes:frog-click', showFrogLine);
    const ambientId = window.setInterval(() => {
      if (Math.random() < 0.65) showFrogLine();
    }, 24000);

    return () => {
      window.removeEventListener('paperplanes:frog-click', showFrogLine);
      window.clearInterval(ambientId);
      if (frogTimerRef.current) window.clearTimeout(frogTimerRef.current);
    };
  }, []);

  // Keep frog speech bubble anchored above the 3D frog while panning/zooming
  useEffect(() => {
    if (!frogLine) return;
    let rafId = 0;
    const syncPos = () => {
      rafId = requestAnimationFrame(syncPos);
      const el = frogBubbleRef.current;
      const pos = engineRef.current?.getFrogScreenPosition();
      if (el && pos) {
        el.style.transform = `translate3d(${pos.x}px, ${pos.y - 10}px, 0) translate(-50%, -100%)`;
      }
    };
    syncPos();
    return () => cancelAnimationFrame(rafId);
  }, [frogLine]);

  // Global Keyboard Shortcuts (Cmd+K / Ctrl+K, N to compose, Esc to close)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCmdOpen((v) => {
          soundscape.playUiSfx(v ? 'close' : 'open');
          return !v;
        });
        setCmdQuery('');
        setCmdIndex(0);
        return;
      }
      if (e.key === 'Escape') {
        setSelectedPlane(null);
        setIsComposeOpen(false);
        setIsSupportOpen(false);
        setFeedbackMode(null);
        setIsCmdOpen(false);
        setIsTimeMenuOpen(false);
        setIsMusicMenuOpen(false);
        return;
      }

      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (!isTyping && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setComposeError(null);
        setIsComposeOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Optimistic Fold & Launch Handler
  const handleFoldAndLaunch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    setComposeError(null);
    const trimmedTitle = composeTitle.trim();
    const trimmed = composeText.trim();
    if (trimmed.length < 3) {
      setComposeError('Write at least a few words before folding your plane.');
      return;
    }

    setIsSubmitting(true);
    const idempotencyKey = `launch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const prevPlanes = [...planes];

    const launchBiome =
      BIOME_SPOTS.find((spot) => spot.id === activeBiomeId)?.label ?? 'A-Frame Cottage';
    const originCountry = detectedCountry ?? undefined;

    try {
      const saved = await launchNewPlane({
        ...(trimmedTitle ? { title: trimmedTitle } : {}),
        text: trimmed,
        biome: launchBiome,
        timeOfDay: activeTimeOfDay,
        paperTint: composeTint,
        countryCode: originCountry,
        idempotencyKey,
      });

      soundscape.playPaperWhoosh('launch');
      soundscape.playUiSfx('success');
      if (!selectedCountry || selectedCountry === originCountry) {
        setPlanes([{ ...saved, isUserCreated: true }, ...prevPlanes].slice(0, 15));
        if (selectedCountry === originCountry) {
          setRegionFallbackCountry(null);
        }
      }
      setIsComposeOpen(false);
      setComposeTitle('');
      setComposeText('');
      showToast({
        message: `Plane #${saved.number} folded and launched into the ${PALETTES[activeTimeOfDay].label} sky.`,
      });
    } catch (err) {
      setPlanes(prevPlanes);
      setComposeError(err instanceof Error ? err.message : 'Could not launch plane.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Catch a Random Drifting Plane from the database sky (fallback to local pool if offline)
  const handleCatchRandomPlane = async () => {
    let picked: PaperPlaneNote | null = null;
    let fallbackUsed = false;
    const activeCountry = selectedCountry || undefined;
    try {
      const result = await fetchRandomPlane(recentCaughtIdsRef.current, activeCountry);
      picked = result.plane;
      fallbackUsed = result.fallbackUsed;
    } catch {
      if (planes.length > 0) {
        picked = planes[Math.floor(Math.random() * planes.length)];
      }
    }
    if (!picked) return;

    recentCaughtIdsRef.current = [...recentCaughtIdsRef.current, picked.id].slice(-15);
    soundscape.playPaperWhoosh('unfold');
    setSelectedPlane({ ...picked, reads: picked.reads + 1 });
    setPlanes((prev) =>
      prev.map((p) => (p.id === picked.id ? { ...p, reads: p.reads + 1 } : p))
    );
    if (fallbackUsed && activeCountry) {
      showToast({
        message: `No planes from ${getCountryName(activeCountry)} yet — caught a global plane instead.`,
      });
    }
    recordPlaneRead(picked.id);
  };

  // Crumple / Flag a Note with Undo Toast
  const handleFlagPlane = (plane: PaperPlaneNote) => {
    soundscape.playUiSfx('flag');
    setSelectedPlane(null);
    setPlanes((prev) => prev.filter((p) => p.id !== plane.id));
    removePlaneFromPoolCache(plane.id);
    showToast(
      {
        message: `Plane #${plane.number} folded away from your sky.`,
        undoPlane: plane,
      },
      0
    );
    flagPlaneNote(plane.id, false).catch((err) => {
      setPlanes((prev) => (prev.some((p) => p.id === plane.id) ? prev : [plane, ...prev]));
      restorePlaneInPoolCache(plane);
      showToast({
        message: err instanceof Error ? err.message : 'Could not fold plane away right now.',
      });
    });
  };

  const handleUndoFlag = () => {
    if (!toast?.undoPlane) return;
    soundscape.playUiSfx('success');
    const restored = toast.undoPlane;
    setPlanes((prev) => (prev.some((p) => p.id === restored.id) ? prev : [restored, ...prev]));
    restorePlaneInPoolCache(restored);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
    flagPlaneNote(restored.id, true).catch((err) => {
      setPlanes((prev) => prev.filter((p) => p.id !== restored.id));
      removePlaneFromPoolCache(restored.id);
      showToast({
        message: err instanceof Error ? err.message : 'Could not restore plane right now.',
      });
    });
  };

  const toggleSound = () => {
    const muted = soundscape.toggleMute(weather);
    setIsMuted(muted);
  };

  const selectMusicTrack = (trackId: MusicTrackId) => {
    soundscape.selectTrack(trackId, weather);
    soundscape.playUiSfx('select');
  };

  const nextMusicTrack = () => {
    soundscape.nextTrack(weather);
    soundscape.playUiSfx('select');
  };

  const handleRetryWorld = () => {
    setWorldError(null);
    setEngineAttempt((attempt) => attempt + 1);
  };

  const changeWeather = (w: WeatherMode) => {
    setWeather(w);
    soundscape.updateWeatherMix(w);
    soundscape.playUiSfx('select');
  };

  const toggleFireworks = () => {
    const next = !fireworks;
    setFireworks(next);
    soundscape.playUiSfx(next ? 'fireworks' : 'tap');
    if (next) engineRef.current?.triggerFireworkVolley();
  };

  const focusBiomeSpot = (spotId: string, gx: number, gy: number, zoom: number) => {
    setActiveBiomeId(spotId);
    soundscape.playUiSfx('camera');
    engineRef.current?.focusBiome(gx, gy, zoom);
  };

  const openFeedbackModal = (mode: 'feedback' | 'bug') => {
    setIsSupportOpen(false);
    setFeedbackError(null);
    setFeedbackMode(mode);
    soundscape.playUiSfx('open');
  };

  const handleSubmitFeedback = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!feedbackMode || isSendingFeedback) return;

    const trimmed = feedbackMessage.trim();
    if (trimmed.length < 5) {
      setFeedbackError('Please write at least a few words before sending.');
      return;
    }

    setIsSendingFeedback(true);
    setFeedbackError(null);
    try {
      await submitFeedback({
        kind: feedbackMode,
        message: trimmed,
        replyTo: feedbackReplyTo.trim() || undefined,
        context:
          feedbackMode === 'bug'
            ? {
                biome: activeBiomeId,
                timeOfDay: engineRef.current?.timeOfDay,
                viewport: `${window.innerWidth}x${window.innerHeight}`,
              }
            : undefined,
      });
      const wasBug = feedbackMode === 'bug';
      setFeedbackMode(null);
      setFeedbackMessage('');
      setFeedbackReplyTo('');
      soundscape.playUiSfx('success');
      showToast({
        message: wasBug
          ? 'Bug report sent. Thank you for helping fix Paper Planes!'
          : 'Feedback sent. Thank you for sharing your thoughts!',
      });
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Could not send your message right now.');
    } finally {
      setIsSendingFeedback(false);
    }
  };

  const commandItems = useMemo(
    () => [
      {
        label: 'Fold & Launch a New Paper Plane',
        hint: 'N',
        action: () => {
          setIsCmdOpen(false);
          setComposeError(null);
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
      ...BIOME_SPOTS.map((spot) => ({
        label: `Camera: Jump to ${spot.label}`,
        hint: 'Biome',
        action: () => {
          setIsCmdOpen(false);
          focusBiomeSpot(spot.id, spot.gx, spot.gy, spot.zoom);
        },
      })),
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
      {
        label: isMuted ? 'Audio: Play Music & Ambience' : 'Audio: Mute Music & Ambience',
        hint: 'Audio',
        action: () => {
          setIsCmdOpen(false);
          toggleSound();
        },
      },
      {
        label: 'Music: Next Background Track',
        hint: 'Music',
        action: () => {
          setIsCmdOpen(false);
          nextMusicTrack();
        },
      },
    ],
    [planes, weather, fireworks, isMuted]
  );

  const filteredCommands = useMemo(() => {
    const q = cmdQuery.trim().toLowerCase();
    if (!q) return commandItems;
    return commandItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) || item.hint.toLowerCase().includes(q)
    );
  }, [commandItems, cmdQuery]);

  const timeButtonLabel =
    timeMode === 'auto' ? 'Sync' : PALETTES[activeTimeOfDay].label;

  return (
    <div className="app-shell">
      {/* Main 2.5D Isometric Pixel Canvas */}
      <main className="world-canvas-container" ref={canvasContainerRef} />

      {/* WebGL 2 unavailable / renderer failed: explain instead of a blank page */}
      {worldError && (
        <WorldFallback
          message={worldError.message}
          detail={worldError.detail}
          onRetry={handleRetryWorld}
        />
      )}

      {/* Unified Non-Overlapping Game HUD */}
      <div className="hud-overlay">
        {/* Top Floating Game Corners */}
        <header className="hud-header">
          <div className="brand-cluster">
            <h1 className="brand-title">Paper Planes</h1>
            <div className="brand-subtitle">
              <span>{PALETTES[activeTimeOfDay].label}</span>
              <span>·</span>
              <span className="tabular-nums">{planes.length} drifting</span>
              {selectedCountry && !regionFallbackCountry && (
                <>
                  <span>·</span>
                  <span>{getCountryName(selectedCountry)}</span>
                </>
              )}
            </div>
            {regionFallbackCountry && (
              <div className="region-fallback-pill" role="status">
                No planes from {getCountryName(regionFallbackCountry)} yet · showing Global sky
              </div>
            )}
          </div>

          <div className="header-actions">
            {/* Region Filter Combobox */}
            <CountryCombobox
              value={selectedCountry}
              onChange={setSelectedCountry}
              options={countryOptions}
              detectedCountry={detectedCountry}
            />
            {/* Compact Time-of-Day Popover */}
            <div className="popover-anchor" ref={timeMenuRef}>
              <div className="control-strip">
                <button
                  id="time-menu-trigger"
                  type="button"
                  onClick={() =>
                    setIsTimeMenuOpen((v) => {
                      soundscape.playUiSfx(v ? 'close' : 'open');
                      return !v;
                    })
                  }
                  className={`hud-btn ${isTimeMenuOpen ? 'active' : ''}`}
                  aria-expanded={isTimeMenuOpen}
                  aria-haspopup="menu"
                  aria-label={`Time of Day: ${timeButtonLabel}`}
                  title={`Time of Day: ${timeButtonLabel}`}
                >
                  <Clock size={14} />
                </button>
              </div>

              <AnimatePresence>
                {isTimeMenuOpen && (
                  <motion.div
                    className="popover-menu"
                    role="menu"
                    aria-label="Time of Day"
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {TIME_OPTIONS.map((t) => (
                      <button
                        key={t.id}
                        id={`time-btn-${t.id}`}
                        type="button"
                        role="menuitemradio"
                        aria-checked={timeMode === t.id}
                        onClick={() => {
                          setTimeMode(t.id);
                          setIsTimeMenuOpen(false);
                          soundscape.playUiSfx('select');
                        }}
                        className={`popover-item ${timeMode === t.id ? 'active' : ''}`}
                      >
                        <span>{t.label}</span>
                        {timeMode === t.id && <span className="popover-dot" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Ambient Sound Toggle */}
            <div className="control-strip">
              <button
                id="sound-toggle-btn"
                type="button"
                onClick={toggleSound}
                className={`hud-btn ${!isMuted ? 'active' : ''}`}
                title={isMuted ? 'Play Music & Ambient Audio' : 'Mute Audio'}
                aria-label={isMuted ? 'Play Music & Ambient Audio' : 'Mute Audio'}
              >
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            </div>

            {/* Background Music Selector */}
            <div className="popover-anchor" ref={musicMenuRef}>
              <div className="control-strip">
                <button
                  id="music-menu-btn"
                  type="button"
                  onClick={() =>
                    setIsMusicMenuOpen((v) => {
                      soundscape.playUiSfx(v ? 'close' : 'open');
                      return !v;
                    })
                  }
                  className={`hud-btn ${isMusicMenuOpen || !isMuted ? 'active' : ''}`}
                  aria-expanded={isMusicMenuOpen}
                  aria-haspopup="dialog"
                  title={`Soundtrack: ${currentTrack.title} (${currentTrack.mood})`}
                  aria-label={`Background Music: ${currentTrack.title}`}
                >
                  <Music size={14} />
                </button>
              </div>

              <AnimatePresence>
                {isMusicMenuOpen && (
                  <motion.div
                    className="popover-menu music-popover"
                    role="dialog"
                    aria-label="Background Music"
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="music-popover-header">
                      <div>
                        <div className="settings-label">Soundtrack</div>
                        <div className="music-now-playing">
                          {isMuted ? 'Paused' : `Playing · ${currentTrack.mood}`}
                        </div>
                      </div>
                      <button
                        id="music-next-btn"
                        type="button"
                        onClick={nextMusicTrack}
                        className="music-icon-btn"
                        title="Next Track"
                        aria-label="Next Track"
                      >
                        <SkipForward size={13} />
                      </button>
                    </div>

                    <div className="music-track-list" role="listbox" aria-label="Music Tracks">
                      {MUSIC_TRACKS.map((track) => {
                        const isActive = currentTrack.id === track.id;
                        return (
                          <button
                            key={track.id}
                            id={`music-track-${track.id}`}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onClick={() => selectMusicTrack(track.id)}
                            className={`music-track-item ${isActive ? 'active' : ''}`}
                            title={track.description}
                          >
                            <span className="music-track-meta">
                              <span className="music-track-title">{track.title}</span>
                              <span className="music-track-mood">{track.mood}</span>
                            </span>
                            {isActive && <span className="popover-dot" />}
                          </button>
                        );
                      })}
                    </div>

                    <div className="music-controls-divider" />

                    <div className="settings-section">
                      <div className="settings-row">
                        <span className="settings-label">Music</span>
                        <span className="settings-value tabular-nums">
                          {Math.round(musicVolume * 100)}%
                        </span>
                      </div>
                      <input
                        id="music-volume-slider"
                        type="range"
                        min={0}
                        max={1}
                        step={0.02}
                        value={musicVolume}
                        onChange={(e) => soundscape.setMusicVolume(parseFloat(e.target.value))}
                        className="settings-slider"
                        aria-label="Music Volume"
                      />
                    </div>

                    <div className="settings-section">
                      <div className="settings-row">
                        <span className="settings-label">Wind &amp; Rain</span>
                        <span className="settings-value tabular-nums">
                          {Math.round(ambienceVolume * 100)}%
                        </span>
                      </div>
                      <input
                        id="ambience-volume-slider"
                        type="range"
                        min={0}
                        max={1}
                        step={0.02}
                        value={ambienceVolume}
                        onChange={(e) => soundscape.setAmbienceVolume(parseFloat(e.target.value))}
                        className="settings-slider"
                        aria-label="Ambience Volume"
                      />
                    </div>

                    <div className="settings-section">
                      <div className="settings-row">
                        <span className="settings-label">Auto-Cycle Tracks</span>
                        <button
                          id="music-autocycle-btn"
                          type="button"
                          onClick={() => {
                            soundscape.setAutoCycle(!autoCycleMusic);
                            soundscape.playUiSfx('tap');
                          }}
                          className={`settings-seg-btn ${autoCycleMusic ? 'active' : ''}`}
                          style={{ padding: '0.2rem 0.6rem' }}
                          aria-pressed={autoCycleMusic}
                        >
                          {autoCycleMusic ? 'On' : 'Off'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Graphics Settings Menu */}
            <div className="popover-anchor" ref={settingsMenuRef}>
              <div className="control-strip">
                <button
                  id="graphics-settings-btn"
                  type="button"
                  onClick={() =>
                    setIsSettingsOpen((v) => {
                      soundscape.playUiSfx(v ? 'close' : 'open');
                      return !v;
                    })
                  }
                  className={`hud-btn ${isSettingsOpen ? 'active' : ''}`}
                  aria-expanded={isSettingsOpen}
                  aria-haspopup="dialog"
                  title="Graphics Settings"
                  aria-label="Graphics Settings"
                >
                  <Settings size={14} />
                </button>
              </div>

              <AnimatePresence>
                {isSettingsOpen && (
                  <motion.div
                    className="popover-menu settings-popover"
                    role="dialog"
                    aria-label="Graphics Settings"
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="settings-section">
                      <span className="settings-label">Graphics Quality</span>
                      <div className="settings-segmented" role="group" aria-label="Graphics Quality">
                        {(['low', 'medium', 'high'] as const).map((q) => (
                          <button
                            key={q}
                            id={`quality-btn-${q}`}
                            type="button"
                            onClick={() => {
                              setGraphicsQuality(q);
                              soundscape.playUiSfx('tap');
                            }}
                            className={`settings-seg-btn ${graphicsQuality === q ? 'active' : ''}`}
                          >
                            {q.charAt(0).toUpperCase() + q.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="settings-section">
                      <div className="settings-row">
                        <label htmlFor="volumetric-slider" className="settings-label">
                          Volumetric Light
                        </label>
                        <span className="settings-value tabular-nums">
                          {Math.round(volumetricIntensity * 100)}%
                        </span>
                      </div>
                      <input
                        id="volumetric-slider"
                        type="range"
                        min={0}
                        max={2}
                        step={0.05}
                        value={volumetricIntensity}
                        onChange={(e) => setVolumetricIntensity(parseFloat(e.target.value))}
                        className="settings-slider"
                      />
                    </div>

                    <div className="settings-row">
                      <span className="settings-label">Bloom Glow</span>
                      <button
                        id="bloom-toggle-btn"
                        type="button"
                        role="switch"
                        aria-checked={bloomEnabled}
                        onClick={() => {
                          setBloomEnabled((v) => !v);
                          soundscape.playUiSfx('tap');
                        }}
                        className={`settings-seg-btn ${bloomEnabled ? 'active' : ''}`}
                        style={{ paddingInline: '0.75rem' }}
                      >
                        {bloomEnabled ? 'On' : 'Off'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Primary CTA: Fold a Plane */}
            <button
              id="open-compose-cta"
              type="button"
              onClick={() => {
                setComposeError(null);
                setIsComposeOpen(true);
                soundscape.playUiSfx('open');
              }}
              className="primary-cta-btn"
            >
              <Plus size={15} />
              <span>Fold a Plane</span>
            </button>
          </div>
        </header>

        {/* Middle Layer: Unobstructed Sky + Compact Right Camera Controls */}
        <div className="hud-middle">
          <div />

          <aside className="camera-dock" aria-label="Zoom Controls">
            <div className="zoom-stack">
              <button
                id="zoom-in-btn"
                type="button"
                onClick={() => {
                  soundscape.playUiSfx('zoomIn');
                  engineRef.current?.adjustZoom(0.2);
                }}
                className="zoom-btn"
                title="Zoom In"
                aria-label="Zoom In"
              >
                <ZoomIn size={15} />
              </button>
              <button
                id="zoom-out-btn"
                type="button"
                onClick={() => {
                  soundscape.playUiSfx('zoomOut');
                  engineRef.current?.adjustZoom(-0.2);
                }}
                className="zoom-btn"
                title="Zoom Out"
                aria-label="Zoom Out"
              >
                <ZoomOut size={15} />
              </button>
            </div>
            <button
              id="reset-camera-btn"
              type="button"
              onClick={() => focusBiomeSpot('overview', 5.5, 5.5, 1.6)}
              className="zoom-btn standalone"
              title="Reset Camera View"
              aria-label="Reset Camera View"
            >
              <RotateCcw size={14} />
            </button>
          </aside>
        </div>

        {/* Bottom Floating Game Actions */}
        <footer className="bottom-hud">
          <button
            id="catch-random-btn"
            type="button"
            onClick={handleCatchRandomPlane}
            className="catch-cta-btn"
          >
            <Wind size={15} />
            <span>Catch a Plane</span>
          </button>

          <div className="bottom-hud-actions">
            <button
              id="feedback-hud-btn"
              type="button"
              onClick={() => openFeedbackModal('feedback')}
              className="support-btn icon-only"
              title="Send Feedback"
              aria-label="Send Feedback"
            >
              <MessageSquare size={14} />
            </button>

            <button
              id="report-bug-hud-btn"
              type="button"
              onClick={() => openFeedbackModal('bug')}
              className="support-btn icon-only"
              title="Report a Bug"
              aria-label="Report a Bug"
            >
              <Bug size={14} />
            </button>

            <button
              id="support-sky-btn"
              type="button"
              onClick={() => {
                setIsSupportOpen(true);
                soundscape.playUiSfx('open');
              }}
              className="support-btn"
            >
              <Coffee size={14} />
              <span>Support</span>
            </button>
          </div>
        </footer>
      </div>

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
              initial={{ scale: 0.94, y: 14, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: -20, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="unfolded-plane-title"
            >
              {(() => {
                const raw = selectedPlane.text.trim();
                const nlIdx = raw.indexOf('\n');
                const sentenceMatch = raw.match(/^(.+?[.!?])\s+(.+)$/s);
                let noteTitle = selectedPlane.title?.trim() || '';
                let noteBody = raw;
                if (!noteTitle) {
                  if (nlIdx > 0 && nlIdx < 72) {
                    noteTitle = raw.slice(0, nlIdx).trim();
                    noteBody = raw.slice(nlIdx + 1).trim();
                  } else if (sentenceMatch && sentenceMatch[1].length <= 72) {
                    noteTitle = sentenceMatch[1].trim();
                    noteBody = sentenceMatch[2].trim();
                  } else {
                    noteTitle = `Plane #${selectedPlane.number}`;
                  }
                }
                return (
                  <div className="paper-body">
                    <h2 className="paper-title" id="unfolded-plane-title">
                      {noteTitle}
                    </h2>
                    <p className="paper-text">{noteBody}</p>
                  </div>
                );
              })()}

              <div className="paper-signature-row">
                <div className="paper-actions">
                  <button
                    id="share-plane-btn"
                    type="button"
                    onClick={() => {
                      soundscape.playUiSfx('open');
                      setIslandSnapshotUrl(engineRef.current?.captureSnapshotDataUrl() ?? null);
                      setSharePlane(selectedPlane);
                      setSelectedPlane(null);
                    }}
                    className="paper-subtle-btn"
                    title="Create shareable card"
                    aria-label="Share note card"
                  >
                    <Share2 size={13} />
                    <span>Share</span>
                  </button>
                  <button
                    id="refold-release-btn"
                    type="button"
                    onClick={() => {
                      soundscape.playPaperWhoosh('launch');
      soundscape.playUiSfx('success');
                      setSelectedPlane(null);
                    }}
                    className="paper-pill-cta"
                  >
                    <Send size={12} />
                    <span>Refold &amp; Let Fly</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shareable Screenshot Card Generator */}
      <ShareCardModal
        plane={sharePlane}
        islandSnapshotUrl={islandSnapshotUrl}
        onClose={() => setSharePlane(null)}
      />

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
                  <span>Write an Anonymous Letter · Free &amp; Unsaid</span>
                </div>
                <button
                  id="close-compose-btn"
                  type="button"
                  onClick={() => {
                    setIsComposeOpen(false);
                    soundscape.playUiSfx('close');
                  }}
                  className="paper-subtle-btn"
                  aria-label="Close compose dialog"
                >
                  <span>Cancel</span>
                  <X size={13} />
                </button>
              </div>

              <div className="paper-compose-fields">
                <textarea
                  id="compose-title-input"
                  className="paper-title-input"
                  rows={1}
                  maxLength={80}
                  placeholder="Write a title (optional)..."
                  aria-label="Letter title"
                  value={composeTitle}
                  onChange={(e) => {
                    setComposeTitle(e.target.value.replace(/\r?\n/g, ' '));
                    e.target.style.height = 'auto';
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleFoldAndLaunch();
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      composeBodyRef.current?.focus();
                    }
                  }}
                  autoFocus
                />

                <textarea
                  ref={composeBodyRef}
                  id="compose-note-textarea"
                  className="paper-textarea"
                  maxLength={320}
                  placeholder="Write whatever is on your mind—an unsaid feeling towards someone, a quiet confession, or a gentle wish for the next stranger who unfolds this plane..."
                  aria-label="Letter body"
                  value={composeText}
                  onChange={(e) => setComposeText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleFoldAndLaunch();
                    }
                  }}
                />
              </div>

              {/* Paper Customization Row: Paper Tint */}
              <div className="paper-controls-row">
                <div className="tint-picker" role="radiogroup" aria-label="Paper Color">
                  {PAPER_TINTS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setComposeTint(t.id);
                        soundscape.playUiSfx('select');
                      }}
                      className={`tint-swatch ${composeTint === t.id ? 'selected' : ''}`}
                      style={{ backgroundColor: t.hex }}
                      title={t.label}
                      aria-label={t.label}
                    />
                  ))}
                </div>
              </div>

              {composeError && (
                <div role="alert" className="compose-error">
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
              if (e.target === e.currentTarget) {
                setIsSupportOpen(false);
                soundscape.playUiSfx('close');
              }
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
                  <span>Support Paper Planes</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSupportOpen(false)}
                  className="paper-subtle-btn"
                  aria-label="Close support dialog"
                >
                  <span>Close</span>
                  <X size={13} />
                </button>
              </div>

              <div className="paper-support-copy">
                <p className="paper-text">
                  I built Paper Planes as a hobby project. I&apos;ve always wanted to make something
                  for people like me, a place to write down unsaid thoughts or rants and just throw
                  them away.
                </p>
                <p className="paper-text muted">
                  I don&apos;t even know how many people will use it, but if it somehow becomes a
                  place for people to let their thoughts out, that would mean a lot to me.
                </p>
                <p className="paper-text muted">
                  Right now, everything runs on free tiers. Someday I&apos;d love to move it to its
                  own domain and database, so any tip toward that is much appreciated. It&apos;s
                  completely free to use, though I&apos;m not sure how long I can keep it running,
                  so enjoy it while it&apos;s here.
                </p>
                <p className="paper-text muted">
                  If you have any feedback or suggestions, feel free to send them my way!
                </p>
              </div>

              <div className="paper-footer">
                <span>100% community supported</span>
                <div className="paper-actions">
                  <button
                    type="button"
                    onClick={() => openFeedbackModal('feedback')}
                    className="paper-subtle-btn"
                  >
                    <MessageSquare size={13} />
                    <span>Feedback</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openFeedbackModal('bug')}
                    className="paper-subtle-btn"
                  >
                    <Bug size={13} />
                    <span>Report a Bug</span>
                  </button>
                  <a
                    href="https://ko-fi.com/sedddict"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="paper-btn launch"
                  >
                    <Coffee size={14} />
                    <span>Support on Ko-fi</span>
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          4. FEEDBACK & BUG REPORT MODAL
          ===================================================================== */}
      <AnimatePresence>
        {feedbackMode && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setFeedbackMode(null);
                soundscape.playUiSfx('close');
              }
            }}
          >
            <motion.form
              className="paper-sheet"
              data-tint="cream"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onSubmit={handleSubmitFeedback}
              role="dialog"
              aria-modal="true"
              aria-labelledby="feedback-modal-title"
            >
              <div className="paper-header">
                <div className="paper-meta" id="feedback-modal-title">
                  {feedbackMode === 'bug' ? <Bug size={15} /> : <MessageSquare size={15} />}
                  <span>{feedbackMode === 'bug' ? 'Report a Bug' : 'Send Feedback'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFeedbackMode(null);
                    soundscape.playUiSfx('close');
                  }}
                  className="paper-subtle-btn"
                  aria-label="Close feedback dialog"
                >
                  <span>Cancel</span>
                  <X size={13} />
                </button>
              </div>

              <textarea
                id="feedback-message-textarea"
                className="paper-textarea"
                maxLength={1200}
                placeholder={
                  feedbackMode === 'bug'
                    ? 'What happened, and what did you expect to happen?'
                    : 'Share a suggestion, idea, or note...'
                }
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmitFeedback();
                  }
                }}
                autoFocus
              />

              <input
                id="feedback-reply-input"
                type="email"
                className="paper-input"
                maxLength={120}
                placeholder="Your email (optional, if you'd like a reply)"
                value={feedbackReplyTo}
                onChange={(e) => setFeedbackReplyTo(e.target.value)}
              />

              {feedbackError && (
                <div role="alert" className="compose-error">
                  {feedbackError}
                </div>
              )}

              <div className="paper-footer">
                <span className="tabular-nums">{feedbackMessage.length} / 1200 chars</span>
                <button
                  id="submit-feedback-btn"
                  type="submit"
                  disabled={isSendingFeedback}
                  className="paper-btn launch"
                >
                  <span>
                    {isSendingFeedback
                      ? 'Sending...'
                      : feedbackMode === 'bug'
                        ? 'Send Bug Report'
                        : 'Send Feedback'}
                  </span>
                  <Send size={14} />
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          4. COMMAND PALETTE (Cmd+K / Ctrl+K)
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
              <div className="cmd-input-row">
                <Search size={15} />
                <input
                  type="text"
                  className="cmd-input"
                  placeholder="Type a command (Fold, Catch, Midnight, Rain, Village)..."
                  value={cmdQuery}
                  onChange={(e) => {
                    setCmdQuery(e.target.value);
                    setCmdIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (filteredCommands.length === 0) return;
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setCmdIndex((i) => (i + 1) % filteredCommands.length);
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setCmdIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      const chosen = filteredCommands[cmdIndex] ?? filteredCommands[0];
                      chosen?.action();
                    }
                  }}
                  autoFocus
                />
              </div>
              <div className="cmd-list">
                {filteredCommands.length === 0 ? (
                  <div className="cmd-empty">No matching commands found.</div>
                ) : (
                  filteredCommands.map((item, idx) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.action}
                      onMouseEnter={() => setCmdIndex(idx)}
                      className={`cmd-item ${idx === cmdIndex ? 'highlighted' : ''}`}
                    >
                      <span>{item.label}</span>
                      <kbd className="kbd-badge">{item.hint}</kbd>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Undo / Status Toast */}
      <AnimatePresence>
        {toast && (
          <div className="toast-wrapper">
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
                  className="hud-btn active compact"
                >
                  Undo
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Frog NPC Floating Speech Bubble */}
      <AnimatePresence>
        {frogLine && (() => {
          const initPos = engineRef.current?.getFrogScreenPosition();
          return (
            <div
              ref={frogBubbleRef}
              className="frog-speech-anchor"
              aria-live="polite"
              style={
                initPos
                  ? { transform: `translate3d(${initPos.x}px, ${initPos.y - 10}px, 0) translate(-50%, -100%)` }
                  : undefined
              }
            >
              <motion.div
                key={frogLine}
                className="frog-speech-bubble"
                initial={{ opacity: 0, y: 6, scale: 0.88 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.92 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              >
                <span>{frogLine}</span>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      <CustomCursor />
    </div>
  );
}
