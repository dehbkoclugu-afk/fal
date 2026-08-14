import type { ImageSourcePropType } from 'react-native';

export type ArtGroup = 'ritual' | 'topic' | 'state' | 'editorial';
export type ArtRatio = 'card' | 'hero' | 'share';
export type ArtSurface =
  | 'coffee-card' | 'tarot-card' | 'dream-card' | 'natal-card'
  | 'natal-topic' | 'natal-reveal' | 'paywall' | 'daily' | 'history'
  | 'ledger' | 'profile' | 'notification' | 'generic-card' | 'share';

export type ArtId =
  | 'coffee' | 'tarot' | 'natal' | 'dream' | 'daily' | 'verify'
  | 'ledger' | 'history' | 'prediction' | 'profile'
  | 'coffee-cup' | 'coffee-grounds' | 'coffee-saucer'
  | 'tarot-deck' | 'tarot-spread' | 'tarot-candle'
  | 'dream-moon' | 'dream-window' | 'dream-water'
  | 'natal-wheel' | 'natal-planets' | 'natal-aspects'
  | 'love' | 'money' | 'career' | 'self' | 'general'
  | 'free' | 'premium' | 'loading' | 'failed'
  | 'editorial-daily' | 'editorial-history' | 'editorial-ledger' | 'editorial-share';

export type ArtworkPair = Readonly<{ dark: ImageSourcePropType; light: ImageSourcePropType }>;
export type SemanticArt = Readonly<{
  id: ArtId;
  group: ArtGroup;
  key: string;
  ratio: ArtRatio;
  safeSide: 'left' | 'right';
  maxBytes: 300000 | 500000;
  surfaces: readonly ArtSurface[];
  dark: ImageSourcePropType;
  light: ImageSourcePropType;
}>;

const card = (definition: Omit<SemanticArt, 'ratio' | 'maxBytes'>): SemanticArt => ({ ...definition, ratio: 'card', maxBytes: 300000 });
const hero = (definition: Omit<SemanticArt, 'ratio' | 'maxBytes'>): SemanticArt => ({ ...definition, ratio: 'hero', maxBytes: 300000 });
const share = (definition: Omit<SemanticArt, 'ratio' | 'maxBytes'>): SemanticArt => ({ ...definition, ratio: 'share', maxBytes: 500000 });

/** Literal requires are mandatory for Metro's static asset graph. */
export const semanticArtwork: Record<ArtId, SemanticArt> = {
  coffee: card({ id: 'coffee', group: 'ritual', key: 'coffee', safeSide: 'left', surfaces: ['coffee-card', 'history', 'share'], dark: require('../assets/art/coffee-dark.webp'), light: require('../assets/art/coffee-light.webp') }),
  tarot: card({ id: 'tarot', group: 'ritual', key: 'tarot', safeSide: 'left', surfaces: ['tarot-card', 'history', 'share'], dark: require('../assets/art/tarot-dark.webp'), light: require('../assets/art/tarot-light.webp') }),
  natal: card({ id: 'natal', group: 'ritual', key: 'natal', safeSide: 'left', surfaces: ['natal-card', 'natal-reveal', 'paywall', 'share'], dark: require('../assets/art/natal-dark.webp'), light: require('../assets/art/natal-light.webp') }),
  dream: card({ id: 'dream', group: 'ritual', key: 'dream', safeSide: 'left', surfaces: ['dream-card', 'history', 'share'], dark: require('../assets/art/dream-dark.webp'), light: require('../assets/art/dream-light.webp') }),
  daily: card({ id: 'daily', group: 'editorial', key: 'daily-legacy', safeSide: 'left', surfaces: ['daily', 'generic-card', 'share'], dark: require('../assets/art/daily-dark.webp'), light: require('../assets/art/daily-light.webp') }),
  verify: card({ id: 'verify', group: 'editorial', key: 'verify', safeSide: 'left', surfaces: ['generic-card'], dark: require('../assets/art/verify-dark.webp'), light: require('../assets/art/verify-light.webp') }),
  ledger: card({ id: 'ledger', group: 'editorial', key: 'ledger-legacy', safeSide: 'left', surfaces: ['ledger', 'generic-card'], dark: require('../assets/art/ledger-dark.webp'), light: require('../assets/art/ledger-light.webp') }),
  history: card({ id: 'history', group: 'editorial', key: 'history-legacy', safeSide: 'left', surfaces: ['history', 'generic-card'], dark: require('../assets/art/history-dark.webp'), light: require('../assets/art/history-light.webp') }),
  prediction: card({ id: 'prediction', group: 'editorial', key: 'prediction', safeSide: 'left', surfaces: ['generic-card'], dark: require('../assets/art/prediction-dark.webp'), light: require('../assets/art/prediction-light.webp') }),
  profile: card({ id: 'profile', group: 'editorial', key: 'profile', safeSide: 'left', surfaces: ['profile', 'notification'], dark: require('../assets/art/profile-dark.webp'), light: require('../assets/art/profile-light.webp') }),

  'coffee-cup': card({ id: 'coffee-cup', group: 'ritual', key: 'coffee-cup', safeSide: 'left', surfaces: ['coffee-card'], dark: require('../assets/art/coffee-cup-dark.webp'), light: require('../assets/art/coffee-cup-light.webp') }),
  'coffee-grounds': card({ id: 'coffee-grounds', group: 'ritual', key: 'coffee-grounds', safeSide: 'left', surfaces: ['coffee-card'], dark: require('../assets/art/coffee-grounds-dark.webp'), light: require('../assets/art/coffee-grounds-light.webp') }),
  'coffee-saucer': card({ id: 'coffee-saucer', group: 'ritual', key: 'coffee-saucer', safeSide: 'left', surfaces: ['coffee-card'], dark: require('../assets/art/coffee-saucer-dark.webp'), light: require('../assets/art/coffee-saucer-light.webp') }),
  'tarot-deck': card({ id: 'tarot-deck', group: 'ritual', key: 'tarot-deck', safeSide: 'left', surfaces: ['tarot-card'], dark: require('../assets/art/tarot-deck-dark.webp'), light: require('../assets/art/tarot-deck-light.webp') }),
  'tarot-spread': card({ id: 'tarot-spread', group: 'ritual', key: 'tarot-spread', safeSide: 'left', surfaces: ['tarot-card'], dark: require('../assets/art/tarot-spread-dark.webp'), light: require('../assets/art/tarot-spread-light.webp') }),
  'tarot-candle': card({ id: 'tarot-candle', group: 'ritual', key: 'tarot-candle', safeSide: 'left', surfaces: ['tarot-card'], dark: require('../assets/art/tarot-candle-dark.webp'), light: require('../assets/art/tarot-candle-light.webp') }),
  'dream-moon': card({ id: 'dream-moon', group: 'ritual', key: 'dream-moon', safeSide: 'left', surfaces: ['dream-card'], dark: require('../assets/art/dream-moon-dark.webp'), light: require('../assets/art/dream-moon-light.webp') }),
  'dream-window': card({ id: 'dream-window', group: 'ritual', key: 'dream-window', safeSide: 'left', surfaces: ['dream-card'], dark: require('../assets/art/dream-window-dark.webp'), light: require('../assets/art/dream-window-light.webp') }),
  'dream-water': card({ id: 'dream-water', group: 'ritual', key: 'dream-water', safeSide: 'left', surfaces: ['dream-card'], dark: require('../assets/art/dream-water-dark.webp'), light: require('../assets/art/dream-water-light.webp') }),
  'natal-wheel': card({ id: 'natal-wheel', group: 'ritual', key: 'natal-wheel', safeSide: 'left', surfaces: ['natal-card', 'natal-reveal', 'share'], dark: require('../assets/art/natal-wheel-dark.webp'), light: require('../assets/art/natal-wheel-light.webp') }),
  'natal-planets': card({ id: 'natal-planets', group: 'ritual', key: 'natal-planets', safeSide: 'left', surfaces: ['natal-card', 'natal-reveal'], dark: require('../assets/art/natal-planets-dark.webp'), light: require('../assets/art/natal-planets-light.webp') }),
  'natal-aspects': card({ id: 'natal-aspects', group: 'ritual', key: 'natal-aspects', safeSide: 'left', surfaces: ['natal-card', 'natal-reveal'], dark: require('../assets/art/natal-aspects-dark.webp'), light: require('../assets/art/natal-aspects-light.webp') }),

  love: card({ id: 'love', group: 'topic', key: 'love', safeSide: 'left', surfaces: ['natal-topic'], dark: require('../assets/art/love-dark.webp'), light: require('../assets/art/love-light.webp') }),
  money: card({ id: 'money', group: 'topic', key: 'money', safeSide: 'left', surfaces: ['natal-topic'], dark: require('../assets/art/money-dark.webp'), light: require('../assets/art/money-light.webp') }),
  career: card({ id: 'career', group: 'topic', key: 'career', safeSide: 'left', surfaces: ['natal-topic'], dark: require('../assets/art/career-dark.webp'), light: require('../assets/art/career-light.webp') }),
  self: card({ id: 'self', group: 'topic', key: 'self', safeSide: 'left', surfaces: ['natal-topic'], dark: require('../assets/art/self-dark.webp'), light: require('../assets/art/self-light.webp') }),
  general: card({ id: 'general', group: 'topic', key: 'general', safeSide: 'left', surfaces: ['natal-topic'], dark: require('../assets/art/general-dark.webp'), light: require('../assets/art/general-light.webp') }),

  free: hero({ id: 'free', group: 'state', key: 'free', safeSide: 'left', surfaces: ['paywall'], dark: require('../assets/art/free-dark.webp'), light: require('../assets/art/free-light.webp') }),
  premium: hero({ id: 'premium', group: 'state', key: 'premium', safeSide: 'left', surfaces: ['paywall'], dark: require('../assets/art/premium-dark.webp'), light: require('../assets/art/premium-light.webp') }),
  loading: card({ id: 'loading', group: 'state', key: 'loading', safeSide: 'left', surfaces: ['natal-reveal', 'daily'], dark: require('../assets/art/loading-dark.webp'), light: require('../assets/art/loading-light.webp') }),
  failed: card({ id: 'failed', group: 'state', key: 'failed', safeSide: 'left', surfaces: ['daily', 'history'], dark: require('../assets/art/failed-dark.webp'), light: require('../assets/art/failed-light.webp') }),

  'editorial-daily': card({ id: 'editorial-daily', group: 'editorial', key: 'daily', safeSide: 'left', surfaces: ['daily'], dark: require('../assets/art/editorial-daily-dark.webp'), light: require('../assets/art/editorial-daily-light.webp') }),
  'editorial-history': card({ id: 'editorial-history', group: 'editorial', key: 'history', safeSide: 'left', surfaces: ['history'], dark: require('../assets/art/editorial-history-dark.webp'), light: require('../assets/art/editorial-history-light.webp') }),
  'editorial-ledger': card({ id: 'editorial-ledger', group: 'editorial', key: 'ledger', safeSide: 'left', surfaces: ['ledger'], dark: require('../assets/art/editorial-ledger-dark.webp'), light: require('../assets/art/editorial-ledger-light.webp') }),
  'editorial-share': share({ id: 'editorial-share', group: 'editorial', key: 'share', safeSide: 'left', surfaces: ['share'], dark: require('../assets/art/editorial-share-dark.webp'), light: require('../assets/art/editorial-share-light.webp') }),
};

export const artwork: Record<ArtId, ArtworkPair> = Object.fromEntries(
  Object.values(semanticArtwork).map((art) => [art.id, { dark: art.dark, light: art.light }]),
) as Record<ArtId, ArtworkPair>;

export function resolveArt(group: ArtGroup, key: string, surface: ArtSurface): SemanticArt {
  const match = Object.values(semanticArtwork).find(
    (art) => art.group === group && art.key === key && art.surfaces.includes(surface),
  );
  if (match) return match;
  if (group === 'topic' && semanticArtwork.general.surfaces.includes(surface)) return semanticArtwork.general;
  throw new Error(`Semantik art bulunamadı: ${group}/${key}/${surface}`);
}

export const ritualArt: Record<string, ArtId> = { coffee: 'coffee', tarot: 'tarot', natal: 'natal', dream: 'dream' };
const rowPool: readonly ArtId[] = ['history', 'coffee', 'tarot', 'natal', 'dream'];
const topicPool: readonly ArtId[] = ['prediction', 'verify', 'ledger', 'daily'];

/** Stable variety for legacy API-backed rows. New product surfaces use resolveArt. */
export function artForKey(key: string, pool: 'row' | 'topic' = 'row'): ArtId {
  const ids = pool === 'row' ? rowPool : topicPool;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ids[(hash >>> 0) % ids.length];
}
