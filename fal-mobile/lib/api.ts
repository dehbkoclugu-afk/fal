/**
 * API istemcisi. Tüm istekler x-anon-id taşır.
 */
import Constants from 'expo-constants';
import { getAnonId } from './anon';
import { aktifDil, hataMetni } from './i18n';

// Öncelik: build zamanı env → app.json extra → Android emülatör varsayılanı.
// EXPO_PUBLIC_API_URL, dev/staging/prod'u tek app.json ile ayırmayı sağlıyor;
// adresi app.json'a gömmek her ortam için ayrı build demek.
const BASE =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra as any)?.apiUrl ??
  'http://10.0.2.2:8000';

export class ApiError extends Error {
  /**
   * `message` seçili dilde — sunucunun Türkçe metni değil. Sunucudan geleni
   * `sunucuMetni` altında saklıyoruz; log/hata ayıklama için lazım oluyor.
   */
  constructor(
    public status: number,
    public code: string,
    message: string,
    public sunucuMetni?: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const anon = await getAnonId();
  const isForm = init.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${BASE}/v1${path}`, {
      ...init,
      headers: {
        'x-anon-id': anon,
        ...(isForm ? {} : { 'content-type': 'application/json' }),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    // React Native'in "Network request failed" gibi geliştirici metinleri
    // kullanıcıya sızmasın. Bütün API çağrıları tek sınırdan geçiyor.
    throw new ApiError(0, 'network', hataMetni('network'));
  }
  if (!res.ok) {
    let code = 'unknown';
    let sunucuMetni: string | undefined;
    try {
      const body = await res.json();
      const d = body?.detail ?? body;
      code = d?.code ?? code;
      sunucuMetni = d?.message ?? (typeof d === 'string' ? d : undefined);
    } catch {}
    throw new ApiError(res.status, code, hataMetni(code, sunucuMetni), sunucuMetni);
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
  kind: 'coffee' | 'tarot' | 'natal' | 'dream' | 'daily';
  status: 'queued' | 'running' | 'done' | 'failed' | 'blocked';
  block_reason?: string | null;
  output_json?: ReadingOutput | null;
  extra_json?: {
    overlay?: CupMarker[];
    /** cup_vision'ın işlediği görüntünün boyutu — overlay ölçeklemesi buna dayanır. */
    cup?: { quality?: { width: number; height: number }; coverage?: number };
    draw?: any;
    transits?: any[];
  } | null;
  eta_seconds: number;
  progress?: number;
  created_at: string;
};

export type Accuracy = {
  overall: { total: number; hits: number; partials: number; score: number | null } | null;
  by_topic: { topic: string; total: number; hits: number }[];
  awaiting_verdict: Prediction[];
};

export type Me = {
  first_name: string | null;
  tone: string | null;
  locale: string;
  has_birth_data: boolean;
  coins: number;
  daily_spend_left: number;
  prices: Record<string, number>;
  entitlement: {
    tier: 'star' | 'fate' | 'yearly';
    tier_tr: string;
    expires_at: string;
    will_renew: boolean;
    ads_free: boolean;
    /** null = sınırsız katman */
    monthly_quota: number | null;
    quota_left: number | null;
  } | null;
  streak: { count: number; last_day: string | null };
  push_optin: boolean;
};

export type NextTransit = {
  transit: {
    code: string;
    exact_at: string;
    severity: number;
    house: number | null;
    metin: string;
  } | null;
};

// ---------------------------------------------------------------- uçlar

export const api = {
  /**
   * Dil her zaman gönderiliyor — çağıranın hatırlamasına bırakılmıyor.
   *
   * Sunucudaki guardrail kriz kaynaklarını (acil yardım numaraları) kayıtlı
   * dilden okuyor. Alan boş kalırsa varsayılana, yani Türkiye'nin
   * numaralarına düşüyor: ikinci dil açıldığı gün başka ülkedeki kullanıcı
   * arayacağı numarayı yanlış görür. Tek bir unutulmuş alan, katmanın
   * tamamını sessizce işlevsiz bırakıyor.
   */
  saveProfile: (p: Record<string, unknown>) =>
    request<{ ok: true; teaser: Teaser | null }>('/profile', {
      method: 'PUT',
      body: JSON.stringify({ locale: aktifDil().code, ...p }),
    }),

  coffee: async (photoUri: string, question: string, handleAngle: number) => {
    // RN 0.86 FormData artık `{ uri, name, type } as any` nesnesini her ağ
    // katmanında kabul etmiyor. Yerel URI'yi gerçek Blob'a çevirince standart
    // FormDataPart üretiliyor ve Android native köprüsü dosyayı taşıyabiliyor.
    let photo: Blob;
    try {
      photo = await (await fetch(photoUri)).blob();
    } catch {
      throw new ApiError(0, 'photo_unreadable', hataMetni('photo_unreadable'));
    }
    const form = new FormData();
    form.append('photo', photo, 'cup.jpg');
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
    request<{ ok: true; coins_earned: number; yorum: string | null }>(
      `/predictions/${predictionId}/verdict`,
      { method: 'POST', body: JSON.stringify({ verdict }) },
    ),

  /**
   * Paywall hunisi. Ölçülmeden fiyat testi yapılamaz.
   * Hata yutuluyor: analitik çağrısı kullanıcı akışını asla durdurmamalı.
   */
  paywallEvent: (
    placement: 'onboarding' | 'reading_gate' | 'home_banner' | 'profile',
    variant: string,
    action: 'view' | 'dismiss' | 'start_trial' | 'purchase',
    priceShown?: string,
  ) =>
    request<void>('/events/paywall', {
      method: 'POST',
      body: JSON.stringify({
        placement,
        variant,
        action,
        price_shown: priceShown ?? null,
      }),
    }).catch(() => undefined),

  accuracy: () => request<Accuracy>('/me/accuracy'),

  me: () => request<Me>('/me'),

  nextTransit: () => request<NextTransit>('/me/next-transit'),

  natal: (focus = 'genel') =>
    request<{ reading_id: string; eta_seconds: number }>('/readings/natal', {
      method: 'POST',
      body: JSON.stringify({ focus }),
    }),

  /**
   * Rüya yorumu.
   *
   * `dreamDate` rüyanın GÖRÜLDÜĞÜ gece (YYYY-AA-GG). Kullanıcı rüyayı
   * sabah anlatıyor ama gökyüzü bağlamı o gecenin Ay'ına ait olmalı —
   * Ay iki buçuk günde burç değiştiriyor.
   */
  dream: (dream: string, dreamDate?: string) =>
    request<{ reading_id: string; eta_seconds: number }>('/readings/dream', {
      method: 'POST',
      body: JSON.stringify({ dream, dream_date: dreamDate ?? null }),
    }),

  daily: () =>
    request<{ reading_id: string; eta_seconds: number; cached?: boolean }>(
      '/readings/daily',
      { method: 'POST' },
    ),

  registerPush: (token: string, activeHour: number) =>
    request<{ ok: true }>('/me/push-token', {
      method: 'PUT',
      body: JSON.stringify({
        push_token: token,
        push_optin: true,
        active_hour: activeHour,
      }),
    }),

  rewardCoins: () =>
    request<{ ok: true; coins: number }>('/coins/reward', { method: 'POST' }),

  /** KVKK silme talebi — uygulama içinden çalışır durumda olmak zorunda. */
  deleteAccount: () => request<{ ok: true }>('/me', { method: 'DELETE' }),
};
