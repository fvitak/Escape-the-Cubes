export type SlimeAnim = 'idle' | 'walk' | 'run' | 'dead';
export type SlimeKind = 'blue' | 'green' | 'red';

export interface SlimeSheetConfig {
  key: string;
  url: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
}

const BASE = '/images/craftpix-net-424234-free-slime-sprite-sheets-pixel-art';
const CANDIDATES = [16, 24, 32, 48, 64, 96, 128];

const SHEETS: Array<{ key: string; url: string }> = [
  { key: 'blue-idle', url: `${BASE}/Blue_Slime/Idle.png` },
  { key: 'blue-walk', url: `${BASE}/Blue_Slime/walk.png` },
  { key: 'blue-run', url: `${BASE}/Blue_Slime/Run.png` },
  { key: 'blue-dead', url: `${BASE}/Blue_Slime/Dead.png` },

  { key: 'green-idle', url: `${BASE}/Green_Slime/Idle.png` },
  { key: 'green-walk', url: `${BASE}/Green_Slime/Walk.png` },
  { key: 'green-run', url: `${BASE}/Green_Slime/Run.png` },
  { key: 'green-dead', url: `${BASE}/Green_Slime/Dead.png` },

  { key: 'red-idle', url: `${BASE}/Red_Slime/Idle.png` },
  { key: 'red-walk', url: `${BASE}/Red_Slime/Walk.png` },
  { key: 'red-run', url: `${BASE}/Red_Slime/Run.png` },
  { key: 'red-dead', url: `${BASE}/Red_Slime/Dead.png` }
];

export async function detectSlimeSheets(): Promise<SlimeSheetConfig[]> {
  const result: SlimeSheetConfig[] = [];

  for (const sheet of SHEETS) {
    const { width, height } = await readImageSize(sheet.url);
    const frameSize = detectFrameSize(width, height);
    result.push({
      key: sheet.key,
      url: sheet.url,
      frameWidth: frameSize,
      frameHeight: frameSize,
      frameCount: (width / frameSize) * (height / frameSize)
    });
  }

  return result;
}

function detectFrameSize(width: number, height: number): number {
  const valid = CANDIDATES.filter((size) => width % size === 0 && height % size === 0 && (width / size) * (height / size) >= 4);

  if (valid.length === 0) {
    throw new Error(`Unable to detect frame size for sheet ${width}x${height}`);
  }

  let best = valid[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const size of valid) {
    const cols = width / size;
    const rows = height / size;
    const frameCount = cols * rows;
    // Prefer single-row sheets first, then frame counts close to 8.
    const rowPenalty = rows === 1 ? 0 : rows * 100;
    const score = rowPenalty + Math.abs(frameCount - 8);
    if (score < bestScore) {
      bestScore = score;
      best = size;
    }
  }

  return best;
}

function readImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    image.src = url;
  });
}

export function animKey(kind: SlimeKind, anim: SlimeAnim): string {
  return `slime-${kind}-${anim}`;
}
