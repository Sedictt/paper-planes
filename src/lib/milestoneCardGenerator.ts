import type { SkyStats } from '../types';
import {
  ASPECT_DIMS,
  THEME_BG,
  drawDuckFloatieFrog,
  drawPaperPlaneIcon,
  drawRoundedRect,
  wrapLines,
  type ShareAspect,
  type ShareCardStyle,
  type ShareTheme,
} from './shareCardGenerator';

export type MilestoneTheme = Exclude<ShareTheme, 'island'>;

export type MilestonePresetId =
  | 'planes_flying'
  | 'total_unfolds'
  | 'single_plane_unfolds'
  | 'distance_countries'
  | 'daily_launches';

export interface MilestoneTemplate {
  id: MilestonePresetId;
  label: string;
  eyebrow: string;
  heroValue: string;
  heroUnit: string;
  headline: string;
  secondaryPill: string;
  postCopy: string;
}

export interface MilestoneProgress {
  current: number;
  previous: number;
  next: number;
  progressPct: number;
}

export const MILESTONE_THRESHOLDS = [
  50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000,
] as const;

/**
 * Computes the next milestone target and progress percentage for a given counter.
 */
export function getNextMilestone(value: number): MilestoneProgress {
  const safe = Math.max(0, Math.floor(value));
  let previous = 0;
  for (const threshold of MILESTONE_THRESHOLDS) {
    if (safe < threshold) {
      const span = Math.max(1, threshold - previous);
      const progressPct = Math.min(100, Math.max(0, Math.round(((safe - previous) / span) * 100)));
      return { current: safe, previous, next: threshold, progressPct };
    }
    previous = threshold;
  }
  const step = 1_000_000;
  const next = Math.ceil((safe + 1) / step) * step;
  const prev = next - step;
  const progressPct = Math.min(100, Math.max(0, Math.round(((safe - prev) / step) * 100)));
  return { current: safe, previous: prev, next, progressPct };
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/**
 * Generates ready-to-post social media milestone drafts and card copy from live sky stats.
 */
export function buildMilestoneTemplates(stats: SkyStats): MilestoneTemplate[] {
  const planesFmt = stats.totalPlanes.toLocaleString('en-US');
  const unfoldsFmt = stats.totalUnfolds.toLocaleString('en-US');
  const mostReadsFmt = stats.mostUnfoldedReads.toLocaleString('en-US');
  const distFmt = Math.round(stats.totalDistanceKm).toLocaleString('en-US');
  const countriesFmt = stats.countriesCount.toLocaleString('en-US');
  const todayFmt = stats.planesToday.toLocaleString('en-US');

  const countryLabel = pluralize(stats.countriesCount, 'country', 'countries');
  const planeWord = pluralize(stats.totalPlanes, 'paper plane', 'paper planes');
  const unfoldWord = pluralize(stats.totalUnfolds, 'time', 'times');
  const singleUnfoldWord = pluralize(stats.mostUnfoldedReads, 'time', 'times');
  const todayPlaneWord = pluralize(stats.planesToday, 'paper plane', 'paper planes');

  return [
    {
      id: 'planes_flying',
      label: 'Planes Flying',
      eyebrow: 'SKY MILESTONE',
      heroValue: planesFmt,
      heroUnit: 'PAPER PLANES FLYING',
      headline: `Today we reached ${planesFmt} ${planeWord} drifting across the sky.`,
      secondaryPill: `${unfoldsFmt} unfolds · ${countriesFmt} ${countryLabel}`,
      postCopy: `Today we reached ${planesFmt} ${planeWord} flying across the sky ✈️✨\n\nAnonymous notes drifting from ${countriesFmt} ${countryLabel} — fold a thought and let it fly, or catch a stranger's note.`,
    },
    {
      id: 'total_unfolds',
      label: 'Total Unfolds',
      eyebrow: 'COMMUNITY MILESTONE',
      heroValue: unfoldsFmt,
      heroUnit: 'PAPER PLANES UNFOLDED',
      headline: `Paper planes have been unfolded ${unfoldsFmt} ${unfoldWord} across the sky.`,
      secondaryPill: `${planesFmt} planes flying · ${distFmt} km drifted`,
      postCopy: `Paper planes have been unfolded ${unfoldsFmt} ${unfoldWord} 💌\n\nEvery unfold is someone pausing to read a stranger's quiet note.`,
    },
    {
      id: 'single_plane_unfolds',
      label: 'Most Unfolded Plane',
      eyebrow: 'DRIFT RECORD',
      heroValue: mostReadsFmt,
      heroUnit: 'UNFOLDS ON ONE PLANE',
      headline: `A single paper plane has been unfolded ${mostReadsFmt} ${singleUnfoldWord}!`,
      secondaryPill: `${unfoldsFmt} total unfolds · ${planesFmt} planes flying`,
      postCopy: `A paper plane has now been unfolded ${mostReadsFmt} ${singleUnfoldWord} ✈️\n\nSomeone's little note keeps catching the breeze and finding new hands across ${countriesFmt} ${countryLabel}.`,
    },
    {
      id: 'distance_countries',
      label: 'Distance & Countries',
      eyebrow: 'GLOBAL BREEZE',
      heroValue: `${distFmt} km`,
      heroUnit: `ACROSS ${countriesFmt} ${countryLabel.toUpperCase()}`,
      headline: `Our paper planes have drifted ${distFmt} km across ${countriesFmt} ${countryLabel}.`,
      secondaryPill: `${planesFmt} planes · ${unfoldsFmt} unfolds`,
      postCopy: `Together, our paper planes have drifted ${distFmt} km across ${countriesFmt} ${countryLabel} 🌍✈️\n\nLeave a quiet wish in the sky and see where the wind takes it.`,
    },
    {
      id: 'daily_launches',
      label: 'Today in the Sky',
      eyebrow: 'LAST 24 HOURS',
      heroValue: todayFmt,
      heroUnit: 'LAUNCHED TODAY',
      headline: `${todayFmt} ${todayPlaneWord} took flight in the last 24 hours.`,
      secondaryPill: `${planesFmt} total flying · ${unfoldsFmt} unfolds`,
      postCopy: `${todayFmt} new ${todayPlaneWord} took flight in the last 24 hours 🌅✈️\n\nNow at ${planesFmt} total planes drifting in the sky.`,
    },
  ];
}

export interface MilestoneCardRenderOptions {
  aspect: ShareAspect;
  theme: MilestoneTheme;
  cardStyle: ShareCardStyle;
}

/**
 * Renders a high-resolution social milestone card onto the target canvas.
 */
export function renderMilestoneCardToCanvas(
  canvas: HTMLCanvasElement,
  template: MilestoneTemplate,
  options: MilestoneCardRenderOptions
): void {
  const { w, h } = ASPECT_DIMS[options.aspect];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const palette = THEME_BG[options.theme];
  const isLightBackdrop = Boolean(palette.isLight);

  // 1. Atmospheric sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, palette.top);
  grad.addColorStop(0.54, palette.mid);
  grad.addColorStop(1, palette.bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 2. Soft horizon glow
  const glowGrad = ctx.createRadialGradient(w * 0.5, h * 0.34, 10, w * 0.5, h * 0.34, w * 0.72);
  glowGrad.addColorStop(0, palette.glow);
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle stars on midnight theme
  if (options.theme === 'midnight') {
    ctx.fillStyle = 'rgba(255, 248, 224, 0.55)';
    for (let i = 0; i < 42; i++) {
      const sx = ((i * 197 + 41) % 97) * (w / 97);
      const sy = ((i * 313 + 73) % 83) * (h / 110);
      const sr = (i % 3) * 0.8 + 0.8;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Subtle paper-plane watermark silhouettes in the sky
  drawPaperPlaneIcon(
    ctx,
    w * 0.12,
    h * 0.14,
    38,
    isLightBackdrop ? 'rgba(60, 48, 36, 0.08)' : 'rgba(255, 248, 232, 0.14)',
    isLightBackdrop ? 'rgba(60, 48, 36, 0.05)' : 'rgba(255, 248, 232, 0.08)'
  );
  drawPaperPlaneIcon(
    ctx,
    w * 0.84,
    h * 0.2,
    26,
    isLightBackdrop ? 'rgba(60, 48, 36, 0.07)' : 'rgba(255, 248, 232, 0.12)',
    isLightBackdrop ? 'rgba(60, 48, 36, 0.04)' : 'rgba(255, 248, 232, 0.06)'
  );

  // 3. Card container
  const isLandscape = options.aspect === 'landscape';
  const cardPadX = isLandscape ? 88 : 96;
  const cardW = w - cardPadX * 2;
  const cardH = isLandscape ? h - 130 : h - 220;
  const cardX = cardPadX;
  const cardY = (h - cardH) / 2 - 14;
  const isGlass = options.cardStyle === 'glass';

  ctx.save();
  ctx.shadowColor = isLightBackdrop ? 'rgba(42, 34, 24, 0.14)' : 'rgba(8, 10, 20, 0.36)';
  ctx.shadowBlur = 44;
  ctx.shadowOffsetY = 20;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 28);
  if (isGlass) {
    ctx.fillStyle = isLightBackdrop ? 'rgba(255, 252, 246, 0.72)' : 'rgba(24, 20, 17, 0.44)';
  } else {
    ctx.fillStyle = '#FAF5EB';
  }
  ctx.fill();
  ctx.restore();

  ctx.save();
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.strokeStyle = isGlass
    ? isLightBackdrop
      ? 'rgba(44, 36, 29, 0.16)'
      : 'rgba(255, 248, 230, 0.24)'
    : 'rgba(44, 36, 29, 0.1)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  const innerPadX = isLandscape ? 64 : 68;
  const innerW = cardW - innerPadX * 2;
  const centerX = w / 2;

  const inkPrimary = isGlass && !isLightBackdrop ? '#FAF5EB' : '#2C241D';
  const inkMuted = isGlass && !isLightBackdrop ? 'rgba(250, 245, 235, 0.72)' : '#6E5E4F';
  const accentColor = isGlass && !isLightBackdrop ? '#F2C968' : '#D97C36';

  // 4. Eyebrow badge
  ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = accentColor;
  ctx.fillText(template.eyebrow, centerX, cardY + (isLandscape ? 58 : 82));

  // 5. Big hero number
  const heroFontSize = isLandscape ? 104 : 134;
  ctx.font = `800 ${heroFontSize}px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = inkPrimary;
  ctx.fillText(template.heroValue, centerX, cardY + (isLandscape ? 148 : 210));

  // 6. Hero unit label
  ctx.font = '700 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = accentColor;
  ctx.fillText(template.heroUnit, centerX, cardY + (isLandscape ? 216 : 302));

  // 7. Divider line
  const divY = cardY + (isLandscape ? 256 : 360);
  ctx.strokeStyle = isGlass && !isLightBackdrop ? 'rgba(255, 248, 230, 0.16)' : 'rgba(145, 122, 96, 0.24)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cardX + innerPadX + 40, divY);
  ctx.lineTo(cardX + cardW - innerPadX - 40, divY);
  ctx.stroke();

  // 8. Headline copy
  const bodyFontSize = isLandscape ? 28 : 34;
  const bodyLineH = Math.round(bodyFontSize * 1.42);
  ctx.font = `500 ${bodyFontSize}px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = inkPrimary;
  const headlineLines = wrapLines(ctx, template.headline, innerW - 24).slice(0, 3);
  const startBodyY = divY + (isLandscape ? 46 : 64);
  headlineLines.forEach((line, idx) => {
    ctx.fillText(line, centerX, startBodyY + idx * bodyLineH);
  });

  // 9. Secondary stats pill
  const pillY = cardY + cardH - (isLandscape ? 62 : 76);
  ctx.font = '600 21px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const pillTextW = ctx.measureText(template.secondaryPill).width;
  const pillW = Math.min(innerW, pillTextW + 52);
  const pillH = 44;
  const pillX = centerX - pillW / 2;

  drawRoundedRect(ctx, pillX, pillY - pillH / 2, pillW, pillH, 999);
  ctx.fillStyle = isGlass && !isLightBackdrop ? 'rgba(255, 248, 230, 0.1)' : 'rgba(44, 36, 29, 0.06)';
  ctx.fill();

  ctx.fillStyle = inkMuted;
  ctx.fillText(template.secondaryPill, centerX, pillY + 1);

  // Frog mascot accent on frog theme
  if (options.theme === 'frog') {
    drawDuckFloatieFrog(ctx, cardX + cardW - 76, cardY + cardH - 58, isLandscape ? 0.44 : 0.56);
  }

  // 10. Footer watermark
  ctx.font = '600 21px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = isLightBackdrop ? 'rgba(44, 36, 29, 0.58)' : 'rgba(250, 245, 235, 0.72)';
  ctx.fillText('paper planes', centerX, h - (isLandscape ? 34 : 58));
}
