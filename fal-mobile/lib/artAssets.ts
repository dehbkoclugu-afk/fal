import type { ImageSourcePropType } from 'react-native';

export type ArtId =
  | 'coffee'
  | 'tarot'
  | 'natal'
  | 'dream'
  | 'daily'
  | 'verify'
  | 'ledger'
  | 'history'
  | 'prediction'
  | 'profile';

export type ArtworkPair = Readonly<{
  dark: ImageSourcePropType;
  light: ImageSourcePropType;
}>;

/**
 * Metro needs literal require() calls. Keeping every pair here makes missing
 * light/dark editions a compile-time-visible review problem instead of a
 * runtime network surprise.
 */
export const artwork: Record<ArtId, ArtworkPair> = {
  coffee: {
    dark: require('../assets/art/coffee-dark.webp'),
    light: require('../assets/art/coffee-light.webp'),
  },
  tarot: {
    dark: require('../assets/art/tarot-dark.webp'),
    light: require('../assets/art/tarot-light.webp'),
  },
  natal: {
    dark: require('../assets/art/natal-dark.webp'),
    light: require('../assets/art/natal-light.webp'),
  },
  dream: {
    dark: require('../assets/art/dream-dark.webp'),
    light: require('../assets/art/dream-light.webp'),
  },
  daily: {
    dark: require('../assets/art/daily-dark.webp'),
    light: require('../assets/art/daily-light.webp'),
  },
  verify: {
    dark: require('../assets/art/verify-dark.webp'),
    light: require('../assets/art/verify-light.webp'),
  },
  ledger: {
    dark: require('../assets/art/ledger-dark.webp'),
    light: require('../assets/art/ledger-light.webp'),
  },
  history: {
    dark: require('../assets/art/history-dark.webp'),
    light: require('../assets/art/history-light.webp'),
  },
  prediction: {
    dark: require('../assets/art/prediction-dark.webp'),
    light: require('../assets/art/prediction-light.webp'),
  },
  profile: {
    dark: require('../assets/art/profile-dark.webp'),
    light: require('../assets/art/profile-light.webp'),
  },
};

export const ritualArt: Record<string, ArtId> = {
  coffee: 'coffee',
  tarot: 'tarot',
  natal: 'natal',
  dream: 'dream',
};

const rowPool: readonly ArtId[] = ['history', 'coffee', 'tarot', 'natal', 'dream'];
const topicPool: readonly ArtId[] = ['prediction', 'verify', 'ledger', 'daily'];

/** Stable variety for API-backed rows without shipping remote artwork. */
export function artForKey(key: string, pool: 'row' | 'topic' = 'row'): ArtId {
  const ids = pool === 'row' ? rowPool : topicPool;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ids[(hash >>> 0) % ids.length];
}
