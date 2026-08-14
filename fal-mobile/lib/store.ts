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
import { cleanupStoredCupPhotos, existingCupPhotos } from './cupPhotos';

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
  /** OTA/bundle ile kalıcı state sözleşmesini aynı sürümde tutar. */
  storageVersion: 2;
  draft: Draft;
  onboarded: boolean;
  /** Expo token backend'e başarıyla kaydedildi; izin tek başına yeterli değil. */
  pushRegistered: boolean;
  /** reading_id → cihazdaki fincan fotoğrafının yerel yolu. */
  cupPhotos: Record<string, string>;
};

type State = Persisted & {
  /** Depo okundu mu — okunmadan yönlendirme yapılırsa onboarding bir kare geri gelir. */
  hydrated: boolean;
  set: (patch: Partial<Draft>) => void;
  finish: () => void;
  setPushRegistered: (registered: boolean) => void;
  rememberCupPhoto: (readingId: string, uri: string) => void;
  reset: () => void;
};

export const BUNDLE_STATE_VERSION = 2;
const KEY = 'fal-draft-v2';
const LEGACY_KEY = 'fal-draft-v1';
const BOS: Persisted = {
  storageVersion: BUNDLE_STATE_VERSION,
  draft: { timeKnown: true, tone: 'mistik' },
  onboarded: false,
  pushRegistered: false,
  cupPhotos: {},
};

export const useDraft = create<State>((set) => ({
  ...BOS,
  hydrated: false,
  set: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  finish: () => set({ onboarded: true }),
  setPushRegistered: (pushRegistered) => set({ pushRegistered }),
  rememberCupPhoto: (readingId, uri) =>
    set((s) => ({ cupPhotos: { ...s.cupPhotos, [readingId]: uri } })),
  reset: () => set({ ...BOS }),
}));

function snapshot(s: State): Persisted {
  return {
    storageVersion: BUNDLE_STATE_VERSION,
    draft: s.draft,
    onboarded: s.onboarded,
    pushRegistered: s.pushRegistered,
    cupPhotos: s.cupPhotos,
  };
}

/** Uygulama açılışında bir kez çağrılır (app/_layout.tsx). */
export async function hydrateDraft(): Promise<void> {
  try {
    await cleanupStoredCupPhotos().catch(() => {});
    const current = await AsyncStorage.getItem(KEY);
    const legacy = current ? null : await AsyncStorage.getItem(LEGACY_KEY);
    const raw = current ?? legacy;
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Persisted>;
      const cupPhotos = await existingCupPhotos(saved.cupPhotos ?? {})
        .catch(() => saved.cupPhotos ?? {});
      useDraft.setState({
        draft: { ...BOS.draft, ...(saved.draft ?? {}) },
        onboarded: !!saved.onboarded,
        pushRegistered: !!saved.pushRegistered,
        cupPhotos,
      });
      if (legacy) {
        await AsyncStorage.setItem(KEY, JSON.stringify({
          storageVersion: BUNDLE_STATE_VERSION,
          draft: { ...BOS.draft, ...(saved.draft ?? {}) },
          onboarded: !!saved.onboarded,
          pushRegistered: !!saved.pushRegistered,
          cupPhotos,
        }));
        await AsyncStorage.removeItem(LEGACY_KEY);
      }
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
