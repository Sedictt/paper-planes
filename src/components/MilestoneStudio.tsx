import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { fetchSkyStats } from '../lib/api';
import {
  buildMilestoneTemplates,
  getNextMilestone,
  renderMilestoneCardToCanvas,
  type MilestonePresetId,
  type MilestoneTheme,
} from '../lib/milestoneCardGenerator';
import type { ShareAspect, ShareCardStyle } from '../lib/shareCardGenerator';
import type { SkyStats } from '../types';

const THEME_OPTIONS: Array<{ id: MilestoneTheme; label: string; swatch: string }> = [
  { id: 'morning', label: 'Morning', swatch: 'linear-gradient(135deg, #566D91, #F3B192)' },
  { id: 'golden', label: 'Golden Hour', swatch: 'linear-gradient(135deg, #C7653A, #F6D89B)' },
  { id: 'dusk', label: 'Dusk', swatch: 'linear-gradient(135deg, #3B3963, #F4B57E)' },
  { id: 'midnight', label: 'Midnight', swatch: 'linear-gradient(135deg, #0D1328, #243254)' },
  { id: 'frog', label: 'Frog Pond', swatch: 'linear-gradient(135deg, #2C5834, #9ED16A)' },
  { id: 'minimal', label: 'Paper', swatch: 'linear-gradient(135deg, #ECE6DA, #DFD7C8)' },
];

const ASPECT_OPTIONS: Array<{ id: ShareAspect; label: string }> = [
  { id: 'square', label: '1:1' },
  { id: 'portrait', label: '4:5' },
  { id: 'landscape', label: '16:9' },
];

const PRESET_SHORT_LABELS: Record<MilestonePresetId, string> = {
  planes_flying: 'Planes',
  total_unfolds: 'Unfolds',
  single_plane_unfolds: 'Top Note',
  distance_countries: 'Reach',
  daily_launches: 'Today',
};

export function MilestoneStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [stats, setStats] = useState<SkyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedPreset, setSelectedPreset] = useState<MilestonePresetId>('planes_flying');
  const [useCustomPreview, setUseCustomPreview] = useState(false);
  const [customPlanes, setCustomPlanes] = useState('1000');
  const [customUnfolds, setCustomUnfolds] = useState('5000');
  const [customSingleReads, setCustomSingleReads] = useState('100');

  const [draftCopy, setDraftCopy] = useState('');
  const [theme, setTheme] = useState<MilestoneTheme>('golden');
  const [aspect, setAspect] = useState<ShareAspect>('square');
  const [cardStyle, setCardStyle] = useState<ShareCardStyle>('paper');

  const [copyPostState, setCopyPostState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [copyImgState, setCopyImgState] = useState<'idle' | 'copied' | 'error'>('idle');

  const loadStats = useCallback(async (fresh = false) => {
    if (fresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await fetchSkyStats(fresh);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load sky milestone stats.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadStats(false);
  }, [loadStats]);

  const effectiveStats = useMemo<SkyStats>(() => {
    const base: SkyStats = stats ?? {
      totalPlanes: 0,
      totalUnfolds: 0,
      totalDistanceKm: 0,
      countriesCount: 0,
      planesToday: 0,
      mostUnfoldedReads: 0,
      updatedAt: new Date().toISOString(),
    };
    if (!useCustomPreview) return base;

    const parseNum = (raw: string, fallback: number) => {
      const n = Number(raw.replace(/,/g, '').trim());
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
    };

    return {
      ...base,
      totalPlanes: parseNum(customPlanes, base.totalPlanes),
      totalUnfolds: parseNum(customUnfolds, base.totalUnfolds),
      mostUnfoldedReads: parseNum(customSingleReads, base.mostUnfoldedReads),
    };
  }, [stats, useCustomPreview, customPlanes, customUnfolds, customSingleReads]);

  const templates = useMemo(() => buildMilestoneTemplates(effectiveStats), [effectiveStats]);
  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === selectedPreset) ?? templates[0],
    [templates, selectedPreset]
  );

  // Sync editable post draft when preset or underlying stats change
  useEffect(() => {
    if (activeTemplate) {
      setDraftCopy(activeTemplate.postCopy);
    }
  }, [activeTemplate]);

  // Re-render canvas preview whenever template or visual options change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeTemplate) return;
    renderMilestoneCardToCanvas(canvas, activeTemplate, {
      aspect,
      theme,
      cardStyle,
    });
  }, [activeTemplate, aspect, theme, cardStyle]);

  const planesProgress = useMemo(
    () => getNextMilestone(effectiveStats.totalPlanes),
    [effectiveStats.totalPlanes]
  );
  const unfoldsProgress = useMemo(
    () => getNextMilestone(effectiveStats.totalUnfolds),
    [effectiveStats.totalUnfolds]
  );

  const handleCopyPost = async () => {
    try {
      await navigator.clipboard.writeText(draftCopy);
      setCopyPostState('copied');
      setTimeout(() => setCopyPostState('idle'), 2000);
    } catch {
      setCopyPostState('error');
      setTimeout(() => setCopyPostState('idle'), 2000);
    }
  };

  const handleDownloadCard = () => {
    const canvas = canvasRef.current;
    if (!canvas || !activeTemplate) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `paper-planes-${activeTemplate.id}.png`;
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
        setCopyImgState('error');
        setTimeout(() => setCopyImgState('idle'), 2000);
        return;
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopyImgState('copied');
      setTimeout(() => setCopyImgState('idle'), 2000);
    } catch {
      setCopyImgState('error');
      setTimeout(() => setCopyImgState('idle'), 2000);
    }
  };

  return (
    <div className="milestone-page">
      <div className="milestone-container">
        <header className="milestone-header">
          <div className="milestone-header-left">
            <a href="/" className="milestone-back-link">
              <ArrowLeft size={16} />
              <span>Back to the Sky</span>
            </a>
            <h1 className="milestone-title">Milestone Studio</h1>
            <p className="milestone-subtitle">
              Live sky numbers, social captions, and exportable cards.
            </p>
          </div>

          <div className="milestone-header-actions">
            <button
              type="button"
              className="milestone-btn"
              onClick={() => void loadStats(true)}
              disabled={refreshing || loading}
            >
              <RefreshCw size={15} className={refreshing ? 'spin' : undefined} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh Stats'}</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="milestone-error-banner" role="alert">
            <span>{error}</span>
            <button type="button" className="milestone-btn" onClick={() => void loadStats(true)}>
              Try Again
            </button>
          </div>
        )}

        {/* Live Sky Metrics */}
        <section aria-label="Live Sky Statistics" className="milestone-stats-grid">
          {loading && !stats ? (
            <>
              <div className="milestone-stat-card milestone-stat-skeleton" />
              <div className="milestone-stat-card milestone-stat-skeleton" />
              <div className="milestone-stat-card milestone-stat-skeleton" />
              <div className="milestone-stat-card milestone-stat-skeleton" />
            </>
          ) : (
            <>
              <div className="milestone-stat-card milestone-stat-featured">
                <span className="milestone-stat-label">Total Planes Flying</span>
                <strong className="milestone-stat-value tabular-nums">
                  {effectiveStats.totalPlanes.toLocaleString('en-US')}
                </strong>
                <div className="milestone-progress-wrap">
                  <div className="milestone-progress-meta tabular-nums">
                    <span>Next: {planesProgress.next.toLocaleString('en-US')}</span>
                    <span>{planesProgress.progressPct}%</span>
                  </div>
                  <div className="milestone-progress-track">
                    <div
                      className="milestone-progress-fill"
                      style={{ width: `${planesProgress.progressPct}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="milestone-stat-card milestone-stat-featured">
                <span className="milestone-stat-label">Total Unfolds</span>
                <strong className="milestone-stat-value tabular-nums">
                  {effectiveStats.totalUnfolds.toLocaleString('en-US')}
                </strong>
                <div className="milestone-progress-wrap">
                  <div className="milestone-progress-meta tabular-nums">
                    <span>Next: {unfoldsProgress.next.toLocaleString('en-US')}</span>
                    <span>{unfoldsProgress.progressPct}%</span>
                  </div>
                  <div className="milestone-progress-track">
                    <div
                      className="milestone-progress-fill"
                      style={{ width: `${unfoldsProgress.progressPct}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="milestone-stat-card">
                <span className="milestone-stat-label">Most-Unfolded Plane</span>
                <strong className="milestone-stat-value tabular-nums">
                  {effectiveStats.mostUnfoldedReads.toLocaleString('en-US')}
                </strong>
                <span className="milestone-stat-hint">unfolds on a single note</span>
              </div>

              <div className="milestone-stat-card">
                <span className="milestone-stat-label">Sky Reach</span>
                <strong className="milestone-stat-value tabular-nums">
                  {Math.round(effectiveStats.totalDistanceKm).toLocaleString('en-US')} km
                </strong>
                <span className="milestone-stat-hint tabular-nums">
                  across {effectiveStats.countriesCount.toLocaleString('en-US')} countries ·{' '}
                  {effectiveStats.planesToday.toLocaleString('en-US')} launched today
                </span>
              </div>

              <div className="milestone-stat-card">
                <span className="milestone-stat-label">Unique Visitors</span>
                <strong className="milestone-stat-value tabular-nums">
                  {(effectiveStats.uniqueVisitors ?? 0).toLocaleString('en-US')}
                </strong>
                <span className="milestone-stat-hint tabular-nums">
                  {(effectiveStats.visitorsToday ?? 0).toLocaleString('en-US')} active in the last
                  24h
                </span>
              </div>
            </>
          )}
        </section>

        {/* Studio Workspace: Copy Builder + Card Preview */}
        <section className="milestone-workspace">
          <div className="milestone-panel">
            <div className="milestone-panel-head">
              <h2 className="milestone-panel-title">Post Caption</h2>
              <button
                type="button"
                className={`milestone-toggle-pill ${useCustomPreview ? 'is-active' : ''}`}
                onClick={() => setUseCustomPreview((v) => !v)}
              >
                <SlidersHorizontal size={13} />
                <span>{useCustomPreview ? 'Simulating N' : 'Simulate N'}</span>
              </button>
            </div>

            {useCustomPreview && (
              <div className="milestone-custom-inputs">
                <label className="milestone-input-group">
                  <span>Planes Flying</span>
                  <input
                    type="number"
                    min={0}
                    value={customPlanes}
                    onChange={(e) => setCustomPlanes(e.target.value)}
                    className="milestone-number-input tabular-nums"
                  />
                </label>
                <label className="milestone-input-group">
                  <span>Total Unfolds</span>
                  <input
                    type="number"
                    min={0}
                    value={customUnfolds}
                    onChange={(e) => setCustomUnfolds(e.target.value)}
                    className="milestone-number-input tabular-nums"
                  />
                </label>
                <label className="milestone-input-group">
                  <span>Top Note</span>
                  <input
                    type="number"
                    min={0}
                    value={customSingleReads}
                    onChange={(e) => setCustomSingleReads(e.target.value)}
                    className="milestone-number-input tabular-nums"
                  />
                </label>
              </div>
            )}

            <div className="milestone-preset-tabs" role="group" aria-label="Milestone preset">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setSelectedPreset(tpl.id)}
                  className={`milestone-preset-tab ${selectedPreset === tpl.id ? 'is-active' : ''}`}
                >
                  {PRESET_SHORT_LABELS[tpl.id]}
                </button>
              ))}
            </div>

            <label className="milestone-textarea-label">
              <span className="sr-only">Post caption text</span>
              <textarea
                rows={7}
                value={draftCopy}
                onChange={(e) => setDraftCopy(e.target.value)}
                className="milestone-textarea"
              />
            </label>

            <div className="milestone-panel-actions">
              <span className="milestone-char-count tabular-nums">
                {draftCopy.length} chars
              </span>
              <button type="button" className="milestone-btn milestone-btn-primary" onClick={handleCopyPost}>
                {copyPostState === 'copied' ? <Check size={15} /> : <Copy size={15} />}
                <span>
                  {copyPostState === 'copied'
                    ? 'Copied Post!'
                    : copyPostState === 'error'
                      ? 'Copy Failed'
                      : 'Copy Post Text'}
                </span>
              </button>
            </div>
          </div>

          <div className="milestone-panel">
            <div className="milestone-panel-head">
              <h2 className="milestone-panel-title">Milestone Card</h2>
              <span className="milestone-panel-meta tabular-nums">
                {ASPECT_OPTIONS.find((a) => a.id === aspect)?.label} ·{' '}
                {cardStyle === 'paper' ? 'Paper' : 'Glass'}
              </span>
            </div>

            <div className="share-preview-stage milestone-canvas-stage">
              <canvas ref={canvasRef} className="share-preview-canvas milestone-preview-canvas" />
            </div>

            <div className="share-toolbar milestone-card-toolbar">
              <div className="share-swatch-row" role="group" aria-label="Backdrop">
                {THEME_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`share-swatch-btn ${theme === t.id ? 'active' : ''}`}
                    style={{ background: t.swatch }}
                    title={t.label}
                    aria-label={`${t.label} backdrop`}
                    aria-pressed={theme === t.id}
                  />
                ))}
              </div>

              <div className="milestone-toolbar-controls">
                <div className="share-segmented" role="group" aria-label="Aspect ratio">
                  {ASPECT_OPTIONS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAspect(a.id)}
                      className={`share-seg-btn ${aspect === a.id ? 'active' : ''}`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>

                <div className="share-segmented" role="group" aria-label="Card style">
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
              </div>
            </div>

            <div className="share-actions">
              <button
                type="button"
                onClick={handleCopyImage}
                className="share-secondary-btn milestone-share-btn"
              >
                {copyImgState === 'copied' ? <Check size={14} /> : <Copy size={14} />}
                <span>
                  {copyImgState === 'copied'
                    ? 'Copied!'
                    : copyImgState === 'error'
                      ? 'Unavailable'
                      : 'Copy Image'}
                </span>
              </button>
              <button
                type="button"
                onClick={handleDownloadCard}
                className="share-primary-btn milestone-share-btn"
              >
                <Download size={14} />
                <span>Download PNG</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
