/**
 * Yerel durum. Sunucu verisi react-query'de; burada sadece onboarding ilerlemesi
 * ve kullanıcının seçtiği tercihler tutuluyor.
 *
 * Kalıcılık şart: bellekte tutulursa uygulama kapandığında onboarding sıfırlanır
 * ve kullanıcı 8 ekranı yeniden doldurur — bu kategoride en pahalı bırakma
 * sebeplerinden biri.
 *
 * NEDEN zustand/middleware (persist) KULLANILMIYOR:
 * zustand v5'te persist ile devtools aynı modülden geliyor ve devtools
 * `import.meta.env` okuyor. Bu ifade klasik script bundle'ında ve Hermes'te
 * çalışmıyor — web export'u "Cannot use 'import.meta' outside a module" ile
 * beyaz ekrana düşüyor. Kalıcılık zaten 20 satır; sihirli katman yerine
 * açıkça yazılıyor.
 *
 * AsyncStorage seçildi, SecureStore değil: burada sır yok (ad, doğum tarihi,
 * ton tercihi) ve SecureStore'un 2 KB değer sınırı var. Cihaz kimliği
 * (anon_id) ayrı — o lib/anon.ts içinde.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
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

/** Diske yazılan kısım. */
type Persisted = {
  draft: Draft;
  onboarded: boolean;
  /** reading_id → cihazdaki fincan fotoğrafının yerel yolu. */
  cupPhotos: Record<string, string>;
};

type State = Persisted & {
  /** Depo okundu mu — okunmadan yönlendirme yapılırsa onboarding bir kare geri gelir. */
  hydrated: boolean;
  set: (patch: Partial<Draft>) => void;
  finish: () => void;
  rememberCupPhoto: (readingId: string, uri: string) => void;
  reset: () => void;
};

const KEY = 'fal-draft-v1';
const BOS: Persisted = {
  draft: { timeKnown: true, tone: 'mistik' },
  onboarded: false,
  cupPhotos: {},
};

export const useDraft = create<State>((set) => ({
  ...BOS,
  hydrated: false,
  set: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  finish: () => set({ onboarded: true }),
  rememberCupPhoto: (readingId, uri) =>
    set((s) => ({ cupPhotos: { ...s.cupPhotos, [readingId]: uri } })),
  reset: () => set({ ...BOS }),
}));

function snapshot(s: State): Persisted {
  return { draft: s.draft, onboarded: s.onboarded, cupPhotos: s.cupPhotos };
}

/** Uygulama açılışında bir kez çağrılır (app/_layout.tsx). */
export async function hydrateDraft(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Persisted>;
      useDraft.setState({
        draft: { ...BOS.draft, ...(saved.draft ?? {}) },
        onboarded: !!saved.onboarded,
        cupPhotos: saved.cupPhotos ?? {},
      });
    }
  } catch {
    // Bozuk kayıt onboarding'i kilitlemesin: temiz başla.
  } finally {
    useDraft.setState({ hydrated: true });
  }
}

// Değişiklikleri diske yaz. Yazma hatası akışı durdurmaz — kalıcılık bir
// kolaylık, çalışma şartı değil.
let son = JSON.stringify(snapshot(useDraft.getState()));
useDraft.subscribe((s) => {
  const next = JSON.stringify(snapshot(s));
  if (next === son) return;
  son = next;
  AsyncStorage.setItem(KEY, next).catch(() => {});
});
