import type { PaperPlaneNote, PaperTint } from '../types';

export type ShareAspect = 'square' | 'portrait' | 'landscape';
export type ShareTheme =
  | 'morning'
  | 'dusk'
  | 'midnight'
  | 'island'
  | 'frog'
  | 'golden'
  | 'minimal';
export type ShareCardStyle = 'paper' | 'glass';

export interface ShareCardOptions {
  aspect: ShareAspect;
  theme: ShareTheme;
  cardStyle: ShareCardStyle;
  showMeta: boolean;
  islandSnapshot?: HTMLImageElement | null;
}

const ASPECT_DIMS: Record<ShareAspect, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  landscape: { w: 1200, h: 675 },
};

const TINT_BG: Record<PaperTint, string> = {
  cream: '#FAF5EB',
  rose: '#FAF0EE',
  sky: '#EEF5FA',
  sage: '#F0F7EE',
  gold: '#FBF6E8',
};

const THEME_BG: Record<
  Exclude<ShareTheme, 'island'>,
  { top: string; mid: string; bottom: string; glow: string; isLight?: boolean }
> = {
  morning: {
    top: '#566D91',
    mid: '#D8A99A',
    bottom: '#9CB0CB',
    glow: 'rgba(244, 223, 179, 0.45)',
  },
  dusk: {
    top: '#3B3963',
    mid: '#C77A74',
    bottom: '#766E96',
    glow: 'rgba(244, 181, 126, 0.4)',
  },
  midnight: {
    top: '#0D1328',
    mid: '#1B2645',
    bottom: '#243254',
    glow: 'rgba(138, 168, 216, 0.25)',
  },
  frog: {
    top: '#2C5834',
    mid: '#5D9438',
    bottom: '#9ED16A',
    glow: 'rgba(235, 248, 178, 0.35)',
  },
  golden: {
    top: '#C7653A',
    mid: '#E8965A',
    bottom: '#F6D89B',
    glow: 'rgba(255, 245, 204, 0.48)',
  },
  minimal: {
    top: '#ECE6DA',
    mid: '#E6DFD1',
    bottom: '#DFD7C8',
    glow: 'rgba(255, 255, 255, 0.5)',
    isLight: true,
  },
};

function splitNoteTitleAndBody(plane: PaperPlaneNote): { title: string; body: string } {
  const raw = plane.text.trim();
  if (plane.title?.trim()) {
    return { title: plane.title.trim(), body: raw };
  }
  const nlIdx = raw.indexOf('\n');
  if (nlIdx > 0 && nlIdx < 72) {
    return { title: raw.slice(0, nlIdx).trim(), body: raw.slice(nlIdx + 1).trim() };
  }
  const sentenceMatch = raw.match(/^(.+?[.!?])\s+(.+)$/s);
  if (sentenceMatch && sentenceMatch[1].length <= 72) {
    return { title: sentenceMatch[1].trim(), body: sentenceMatch[2].trim() };
  }
  return { title: `Plane #${plane.number}`, body: raw };
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/);
    if (!words[0]) {
      lines.push('');
      continue;
    }
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = `${current} ${words[i]}`;
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
  }
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawPaperPlaneIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  fill: string,
  foldFill: string
) {
  const s = size / 24;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);

  ctx.beginPath();
  ctx.moveTo(1.5, 1.5);
  ctx.lineTo(22.5, 10.2);
  ctx.lineTo(13.2, 13.4);
  ctx.lineTo(10.0, 22.5);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(1.5, 1.5);
  ctx.lineTo(13.2, 13.4);
  ctx.lineTo(10.0, 22.5);
  ctx.lineTo(8.8, 14.0);
  ctx.closePath();
  ctx.fillStyle = foldFill;
  ctx.fill();

  ctx.restore();
}

function drawDuckFloatieFrog(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Subtle drop shadow under frog
  ctx.fillStyle = 'rgba(20, 42, 24, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 52, 46, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Stubby frog legs
  ctx.fillStyle = '#5C8C32';
  ctx.fillRect(-24, 30, 16, 18);
  ctx.fillRect(8, 30, 16, 18);

  // Frog torso
  ctx.fillStyle = '#6EA63C';
  ctx.fillRect(-24, -14, 48, 36);
  ctx.fillStyle = '#DBE2A8';
  ctx.fillRect(-16, -6, 32, 22);

  // Frog head + snout
  ctx.fillStyle = '#74AE3F';
  ctx.fillRect(-28, -44, 56, 32);

  // Golden-tan eye domes + dark eyes
  ctx.fillStyle = '#ECC37C';
  ctx.fillRect(-26, -56, 18, 16);
  ctx.fillRect(8, -56, 18, 16);
  ctx.fillStyle = '#241812';
  ctx.fillRect(-21, -50, 10, 6);
  ctx.fillRect(11, -50, 10, 6);

  // Pastel-pink voxel bow on top-right of head
  ctx.fillStyle = '#E88AE0';
  ctx.fillRect(-2, -68, 16, 14);
  ctx.fillRect(18, -64, 16, 14);
  ctx.fillStyle = '#CF6AC8';
  ctx.fillRect(10, -64, 10, 10);

  // Yellow duck swim floatie ring
  ctx.fillStyle = '#F2B838';
  drawRoundedRect(ctx, -40, 8, 80, 24, 8);
  ctx.fill();
  ctx.fillStyle = '#D99624';
  ctx.fillRect(-38, 24, 76, 8);

  // Duck head & orange beak on left side of floatie
  ctx.fillStyle = '#F4C44E';
  ctx.fillRect(-46, -12, 26, 24);
  ctx.fillStyle = '#E06D2C';
  ctx.fillRect(-60, -2, 16, 10);
  ctx.fillStyle = '#241812';
  ctx.fillRect(-40, -6, 5, 5);

  // Chubby frog arm draped over floatie
  ctx.fillStyle = '#7DB844';
  ctx.fillRect(20, 2, 14, 22);

  ctx.restore();
}

function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  options: ShareCardOptions
) {
  if (options.theme === 'island' && options.islandSnapshot) {
    const img = options.islandSnapshot;
    const imgRatio = img.width / Math.max(1, img.height);
    const canvasRatio = w / h;
    let drawW = w;
    let drawH = h;
    let drawX = 0;
    let drawY = 0;

    if (imgRatio > canvasRatio) {
      drawH = h;
      drawW = h * imgRatio;
      drawX = (w - drawW) / 2;
    } else {
      drawW = w;
      drawH = w / imgRatio;
      drawY = (h - drawH) / 2;
    }

    ctx.save();
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();

    // Subtle atmospheric vignette so the note card reads effortlessly
    const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.18, w * 0.5, h * 0.5, w * 0.72);
    vig.addColorStop(0, 'rgba(10, 14, 28, 0.08)');
    vig.addColorStop(1, 'rgba(10, 14, 28, 0.36)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
    return;
  }

  const theme = THEME_BG[options.theme === 'island' ? 'morning' : options.theme];
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, theme.top);
  bgGrad.addColorStop(0.55, theme.mid);
  bgGrad.addColorStop(1, theme.bottom);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  const glowGrad = ctx.createRadialGradient(w * 0.8, h * 0.28, 10, w * 0.8, h * 0.28, w * 0.65);
  glowGrad.addColorStop(0, theme.glow);
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle lily pads for Frog Pond theme
  if (options.theme === 'frog') {
    ctx.fillStyle = 'rgba(196, 232, 132, 0.16)';
    for (const [lx, ly, lr] of [
      [w * 0.14, h * 0.18, 46],
      [w * 0.86, h * 0.22, 34],
      [w * 0.18, h * 0.84, 54],
    ]) {
      ctx.beginPath();
      ctx.arc(lx, ly, lr, 0.3, Math.PI * 2 - 0.1);
      ctx.lineTo(lx, ly);
      ctx.closePath();
      ctx.fill();
    }
  }
}

export function renderShareCardToCanvas(
  canvas: HTMLCanvasElement,
  plane: PaperPlaneNote,
  options: ShareCardOptions
): void {
  const { w, h } = ASPECT_DIMS[options.aspect];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. Render Backdrop
  drawBackdrop(ctx, w, h, options);

  // 2. Measure Card & Typography
  const isLandscape = options.aspect === 'landscape';
  const cardW = w * 0.84;
  const padX = isLandscape ? 58 : 64;
  const padY = isLandscape ? 46 : 56;
  const innerW = cardW - padX * 2;

  const { title, body } = splitNoteTitleAndBody(plane);

  const titleSize = isLandscape ? 36 : 42;
  const titleLineH = Math.round(titleSize * 1.24);
  const bodySize = isLandscape ? 25 : 29;
  const bodyLineH = Math.round(bodySize * 1.52);

  ctx.font = `800 ${titleSize}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  const titleLines = wrapLines(ctx, title, innerW);

  ctx.font = `400 ${bodySize}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  const bodyLines = wrapLines(ctx, body, innerW);

  const titleBlockH = titleLines.length * titleLineH;
  const gapTitleBody = 18;
  const bodyBlockH = bodyLines.length * bodyLineH;
  const footerDividerGap = 34;
  const footerH = options.showMeta ? 64 : 50;

  const cardH = Math.min(
    h - 110,
    padY * 2 + titleBlockH + gapTitleBody + bodyBlockH + footerDividerGap + footerH
  );
  const cardX = (w - cardW) / 2;
  const cardY = (h - cardH) / 2;

  const isGlass = options.cardStyle === 'glass';
  const isLightBackdrop = options.theme === 'minimal';

  // 3. Draw Card Surface (Paper OR Frosted Glass)
  if (isGlass) {
    // Capture blurred backdrop into offscreen canvas for true frosted glass refraction
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const octx = offscreen.getContext('2d');
    if (octx) {
      octx.filter = 'blur(26px) saturate(1.18)';
      octx.drawImage(canvas, 0, 0);
    }

    ctx.save();
    ctx.shadowColor = 'rgba(8, 12, 24, 0.32)';
    ctx.shadowBlur = 44;
    ctx.shadowOffsetY = 18;
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 12);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.01)';
    ctx.fill();
    ctx.restore();

    ctx.save();
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 12);
    ctx.clip();
    ctx.drawImage(offscreen, 0, 0);
    ctx.fillStyle = isLightBackdrop ? 'rgba(255, 255, 255, 0.56)' : 'rgba(14, 20, 36, 0.48)';
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.restore();

    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 12);
    ctx.strokeStyle = isLightBackdrop ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.32)';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.save();
    ctx.shadowColor = 'rgba(10, 14, 28, 0.28)';
    ctx.shadowBlur = 48;
    ctx.shadowOffsetY = 20;
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 10);
    ctx.fillStyle = TINT_BG[plane.paperTint] ?? TINT_BG.cream;
    ctx.fill();
    ctx.restore();

    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 10);
    ctx.strokeStyle = 'rgba(43, 33, 24, 0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 4. Typography Colors
  const useLightText = isGlass && !isLightBackdrop;
  const titleColor = useLightText ? '#FFFDF7' : '#1A1410';
  const bodyColor = useLightText ? 'rgba(255, 253, 247, 0.8)' : 'rgba(26, 20, 16, 0.72)';
  const dividerColor = useLightText ? 'rgba(255, 255, 255, 0.18)' : 'rgba(43, 33, 24, 0.1)';
  const metaPrimary = useLightText ? '#FFFDF7' : '#2B2118';
  const metaSecondary = useLightText ? 'rgba(255, 253, 247, 0.65)' : 'rgba(43, 33, 24, 0.56)';
  const brandColor = useLightText ? 'rgba(255, 253, 247, 0.9)' : 'rgba(26, 20, 16, 0.78)';

  let cursorY = cardY + padY + titleSize * 0.85;
  ctx.fillStyle = titleColor;
  ctx.font = `800 ${titleSize}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  for (const line of titleLines) {
    ctx.fillText(line, cardX + padX, cursorY);
    cursorY += titleLineH;
  }

  cursorY += gapTitleBody;
  ctx.fillStyle = bodyColor;
  ctx.font = `400 ${bodySize}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  for (const line of bodyLines) {
    ctx.fillText(line, cardX + padX, cursorY);
    cursorY += bodyLineH;
  }

  // 5. Card Footer Divider + Origin / Minimalist Watermark
  const dividerY = cardY + cardH - padY - footerH + 10;
  ctx.beginPath();
  ctx.moveTo(cardX + padX, dividerY);
  ctx.lineTo(cardX + cardW - padX, dividerY);
  ctx.strokeStyle = dividerColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const rowCenterY = dividerY + (footerH - 10) * 0.62;

  if (options.showMeta) {
    ctx.fillStyle = metaPrimary;
    ctx.font = '700 20px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(`${plane.biome} · #${plane.number}`, cardX + padX, rowCenterY - 4);

    ctx.fillStyle = metaSecondary;
    ctx.font = '500 17px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(`${plane.reads} unfolds · ${plane.distanceKm} km`, cardX + padX, rowCenterY + 20);
  }

  const brandLabel = 'paper planes';
  ctx.font = '700 19px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const brandW = ctx.measureText(brandLabel).width;
  const iconSize = 22;
  const rightEdge = cardX + cardW - padX;
  drawPaperPlaneIcon(
    ctx,
    rightEdge - brandW - iconSize - 10,
    rowCenterY - iconSize / 2 + 2,
    iconSize,
    '#E88B52',
    '#B85D28'
  );
  ctx.fillStyle = brandColor;
  ctx.fillText(brandLabel, rightEdge - brandW, rowCenterY + 8);

  // 6. Mascot Peek for Frog Pond theme
  if (options.theme === 'frog') {
    const frogScale = isLandscape ? 1.15 : 1.45;
    drawDuckFloatieFrog(ctx, cardX + cardW - 68, cardY + cardH - 16, frogScale);
  }
}
