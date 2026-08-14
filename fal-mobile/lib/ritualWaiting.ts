import type { Anahtar } from './i18n';

export type WaitingKind = 'coffee' | 'tarot' | 'natal' | 'dream' | 'daily';

export type RitualWaitingModel = Readonly<{
  kind: WaitingKind;
  visualKind: WaitingKind;
  keyword: 'fincan' | 'deste' | 'gökyüzü' | 'gece';
  titleKey: Anahtar;
  accessibilityKey: Anahtar;
  stageKeys: readonly [Anahtar, Anahtar, Anahtar, Anahtar];
  retryRoute: string;
}>;

export const RITUAL_WAITING_MODELS: Record<WaitingKind, RitualWaitingModel> = {
  coffee: {
    kind: 'coffee', visualKind: 'coffee', keyword: 'fincan', titleKey: 'sonuc.kahveFali', accessibilityKey: 'sonuc.bekleme.a11yCoffee',
    stageKeys: ['sonuc.bekleme.coffee1', 'sonuc.bekleme.coffee2', 'sonuc.bekleme.coffee3', 'sonuc.bekleme.coffee4'],
    retryRoute: '/ritual/coffee',
  },
  tarot: {
    kind: 'tarot', visualKind: 'tarot', keyword: 'deste', titleKey: 'sonuc.tarot', accessibilityKey: 'sonuc.bekleme.a11yTarot',
    stageKeys: ['sonuc.bekleme.tarot1', 'sonuc.bekleme.tarot2', 'sonuc.bekleme.tarot3', 'sonuc.bekleme.tarot4'],
    retryRoute: '/ritual/tarot',
  },
  natal: {
    kind: 'natal', visualKind: 'natal', keyword: 'gökyüzü', titleKey: 'sonuc.natal', accessibilityKey: 'sonuc.bekleme.a11yNatal',
    stageKeys: ['sonuc.bekleme.natal1', 'sonuc.bekleme.natal2', 'sonuc.bekleme.natal3', 'sonuc.bekleme.natal4'],
    retryRoute: '/ritual/natal',
  },
  dream: {
    kind: 'dream', visualKind: 'dream', keyword: 'gece', titleKey: 'sonuc.ruya', accessibilityKey: 'sonuc.bekleme.a11yDream',
    stageKeys: ['sonuc.bekleme.dream1', 'sonuc.bekleme.dream2', 'sonuc.bekleme.dream3', 'sonuc.bekleme.dream4'],
    retryRoute: '/ritual/dream',
  },
  daily: {
    kind: 'daily', visualKind: 'daily', keyword: 'gökyüzü', titleKey: 'ana.bugun', accessibilityKey: 'sonuc.bekleme.a11yDaily',
    stageKeys: ['sonuc.bekleme.daily1', 'sonuc.bekleme.daily2', 'sonuc.bekleme.daily3', 'sonuc.bekleme.daily4'],
    retryRoute: '/(tabs)',
  },
};

export function isWaitingKind(value: unknown): value is WaitingKind {
  return typeof value === 'string' && value in RITUAL_WAITING_MODELS;
}

/** Sunucu kısa süreli daha düşük progress döndürse bile halka geri gitmez. */
export function monotonicProgress(previous: number, incoming: number | undefined): number {
  const safe = Number.isFinite(incoming) ? Number(incoming) : 0.05;
  return Math.max(previous, Math.min(0.95, Math.max(0.05, safe)));
}

export function waitingStage(progress: number): number {
  return Math.min(3, Math.floor(Math.max(0, progress) * 4));
}

export function isReadingSlow(createdAt: string | undefined, etaSeconds: number | undefined, now: number): boolean {
  if (!createdAt || !etaSeconds) return false;
  const elapsed = Math.max(0, (now - new Date(createdAt).getTime()) / 1000);
  return elapsed > Math.max(60, etaSeconds + 30);
}

export type ReadingSurface = 'queued' | 'running' | 'slow' | 'failed' | 'done';

export function readingSurface(status: 'queued' | 'running' | 'failed' | 'done', slow: boolean): ReadingSurface {
  if ((status === 'queued' || status === 'running') && slow) return 'slow';
  return status;
}
