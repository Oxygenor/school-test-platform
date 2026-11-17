'use client';

import type { HelperError, HelperResponse } from './types';

/** Транспорт помічника. Окремий інтерфейс — щоб UI можна було тестувати з імітацією API. */
export interface HelperApi {
  ask(body: Record<string, unknown>): Promise<HelperResponse | HelperError>;
}

export function createFetchApi(getToken: () => string | null): HelperApi {
  return {
    async ask(body) {
      try {
        const res = await fetch('/api/ai-prep', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-prep-token': getToken() ?? '' },
          body: JSON.stringify(body),
        });
        let data: HelperResponse | HelperError | null = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
        if (data && typeof data === 'object' && 'ok' in data) return data;
        if (res.status === 413) return { ok: false, error: 'Фото завелике. Спробуй зробити знімок ближче.', retryable: false };
        return { ok: false, error: 'Помічник не відповів. Спробуй ще раз.', retryable: true };
      } catch {
        return { ok: false, error: 'Немає з’єднання з інтернетом. Твоє повідомлення збережено — спробуй ще раз.', retryable: true };
      }
    },
  };
}

export const MAX_SOURCE_FILE_BYTES = 15 * 1024 * 1024;
const TARGET_BASE64 = 2_800_000;

export interface PreparedImage {
  dataUrl: string;
  base64: string;
  mediaType: 'image/jpeg';
}

async function loadBitmap(file: File): Promise<{ w: number; h: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      return { w: bmp.width, h: bmp.height, draw: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h) };
    } catch {
      /* fallback нижче */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('decode'));
      i.src = url;
    });
    return { w: img.naturalWidth, h: img.naturalHeight, draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h) };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Готує одне фото для моделі: JPEG, довша сторона до 1568 px (цього досить
 * для читабельності формул і позначень), розмір у межах ліміту сервера.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Це не зображення. Обери фото.');
  if (file.size > MAX_SOURCE_FILE_BYTES) throw new Error('Фото завелике (понад 15 МБ). Обери інше або зроби знімок ще раз.');
  let bmp;
  try {
    bmp = await loadBitmap(file);
  } catch {
    throw new Error('Не вдалося відкрити це фото. Спробуй інший формат (JPEG або PNG).');
  }
  for (const [edge, quality] of [
    [1568, 0.88],
    [1568, 0.75],
    [1200, 0.72],
  ] as const) {
    const scale = Math.min(1, edge / Math.max(bmp.w, bmp.h));
    const w = Math.max(1, Math.round(bmp.w * scale));
    const h = Math.max(1, Math.round(bmp.h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Не вдалося обробити фото.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    bmp.draw(ctx, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    if (base64.length <= TARGET_BASE64) return { dataUrl, base64, mediaType: 'image/jpeg' };
  }
  throw new Error('Фото завелике навіть після стиснення. Зроби знімок ближче до задачі.');
}
