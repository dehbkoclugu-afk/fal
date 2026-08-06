/**
 * Yerel durum. Sunucu verisi react-query'de; burada sadece onboarding ilerlemesi
 * ve kullanıcının seçtiği tercihler tutuluyor.
 */
import { create } from 'zustand';

export type Tone = 'nazik' | 'dobra' | 'mistik' | 'bilimsel';

type Draft = {
  firstName?: string;
  birthDate?: string;      // YYYY-MM-DD
  birthTime?: string;      // HH:MM
  timeKnown: boolean;
  placeName?: string;
  lat?: number;
  lon?: number;
  tzName?: string;
  relationshipStatus?: string;
  focusTopic?: string;
  tone: Tone;
};

type State = {
  draft: Draft;
  onboarded: boolean;
  coins: number;
  set: (patch: Partial<Draft>) => void;
  finish: () => void;
  setCoins: (n: number) => void;
};

export const useDraft = create<State>((set) => ({
  draft: { timeKnown: true, tone: 'mistik' },
  onboarded: false,
  coins: 0,
  set: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  finish: () => set({ onboarded: true }),
  setCoins: (n) => set({ coins: n }),
}));
