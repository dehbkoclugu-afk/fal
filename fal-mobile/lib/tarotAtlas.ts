import type { ImageSourcePropType } from 'react-native';

export type TarotCardKey =
  | `major_${number}`
  | `wands_${number}`
  | `cups_${number}`
  | `swords_${number}`
  | `pentacles_${number}`;

export const tarotAtlas: ImageSourcePropType = require('../assets/tarot/rws-atlas.webp');
export const TAROT_ATLAS_COLUMNS = 13;
export const TAROT_ATLAS_ROWS = 6;

const SUIT_OFFSET: Record<string, number> = {
  wands: 22,
  cups: 36,
  swords: 50,
  pentacles: 64,
};

export function tarotCardIndex(key: TarotCardKey): number {
  const [family, rawRank] = key.split('_');
  const rank = Number(rawRank);
  const index = family === 'major' ? rank : (SUIT_OFFSET[family] ?? -100) + rank - 1;
  if (!Number.isInteger(index) || index < 0 || index >= 78) {
    throw new Error(`Bilinmeyen tarot kartı: ${key}`);
  }
  return index;
}
