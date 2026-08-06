/**
 * API istemcisi. Tüm istekler x-anon-id taşır.
 */
import Constants from 'expo-constants';
import { getAnonId } from './anon';

const BASE = (Constants.expoConfig?.extra as any)?.apiUrl ?? 'http://10.0.2.2:8000';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const anon = await getAnonId();
  const isForm = init.body instanceof FormData;
  const res = await fetch(`${BASE}/v1${path}`, {
    ...init,
    headers: {
      'x-anon-id': anon,
      ...(isForm ? {} : { 'content-type': 'application/json' }),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let code = 'unknown';
    let message = 'Bir şeyler ters gitti. Tekrar dene.';
    try {
      const body = await res.json();
      const d = body?.detail ?? body;
      code = d?.code ?? code;
      message = d?.message ?? (typeof d === 'string' ? d : message);
    } catch {}
    throw new ApiError(res.status, code, message);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

// ---------------------------------------------------------------- tipler

export type Teaser = { yukselen: string; gunes: string; ay: string; ay_fazi: string };

export type Prediction = {
  id: string;
  claim: string;
  topic: string;
  window_end: string;
};

export type Section = { baslik: string; metin: string };

export type ReadingOutput = {
  ozet: string;
  bolumler: Section[];
  tahminler: { konu: string; iddia: string; pencere_gun: number; guven: string }[];
  tavsiye: string;
  sembol?: string;
  paylasim_cumlesi?: string;
};

export type CupMarker = {
  id: string;
  bbox: [number, number, number, number];
  region: string;
  side: string;
};

export type Reading = {
  id: string;
  kind: 'coffee' | 'tarot' | 'natal' | 'daily';
  status: 'queued' | 'running' | 'done' | 'failed' | 'blocked';
  block_reason?: string | null;
  output_json?: ReadingOutput | null;
  extra_json?: { overlay?: CupMarker[]; draw?: any; transits?: any[] } | null;
  eta_seconds: number;
  progress?: number;
  created_at: string;
};

export type Accuracy = {
  overall: { total: number; hits: number; partials: number; score: number | null } | null;
  by_topic: { topic: string; total: number; hits: number }[];
  awaiting_verdict: Prediction[];
};

// ---------------------------------------------------------------- uçlar

export const api = {
  saveProfile: (p: Record<string, unknown>) =>
    request<{ ok: true; teaser: Teaser | null }>('/profile', {
      method: 'PUT',
      body: JSON.stringify(p),
    }),

  coffee: (photoUri: string, question: string, handleAngle: number) => {
    const form = new FormData();
    form.append('photo', { uri: photoUri, name: 'cup.jpg', type: 'image/jpeg' } as any);
    form.append('question', question);
    form.append('handle_angle', String(handleAngle));
    return request<{ reading_id: string; eta_seconds: number }>('/readings/coffee', {
      method: 'POST',
      body: form,
    });
  },

  tarot: (spread: string, question: string) =>
    request<{ reading_id: string; eta_seconds: number }>('/readings/tarot', {
      method: 'POST',
      body: JSON.stringify({ spread, question }),
    }),

  reading: (id: string) => request<Reading>(`/readings/${id}`),

  history: (limit = 20) =>
    request<{ id: string; kind: string; ozet: string; created_at: string }[]>(
      `/readings?limit=${limit}`,
    ),

  verdict: (predictionId: string, verdict: 'hit' | 'miss' | 'partial') =>
    request<{ ok: true; coins_earned: number }>(`/predictions/${predictionId}/verdict`, {
      method: 'POST',
      body: JSON.stringify({ verdict }),
    }),

  accuracy: () => request<Accuracy>('/me/accuracy'),
};
