/**
 * CoinGate — jeton yetmediğinde gösterilen çıkış yolu.
 *
 * Bu bileşen olmadan ücretsiz kullanıcının jetonu bittiğinde tek seçeneği
 * ödemek oluyor ve akış orada tıkanıyor. Bu kategoride ücretsiz kullanıcıların
 * ~%97'si hiç ödemiyor; onlara da bir yol bırakmak hem geliri (ödüllü reklam
 * eCPM'i) hem retention'ı koruyor.
 *
 * Sıra kasıtlı: önce ücretsiz yol (reklam), sonra abonelik. Tersi, ödemeye
 * zorlanmış hissi veriyor ve bu üründe rating'i düşürüyor.
 *
 * Reklam SDK'sı yoksa (Expo Go, web, henüz eklenmemiş üretim derlemesi)
 * reklam seçeneği HİÇ gösterilmiyor — çalışmayan buton göstermek daha kötü.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Eyebrow } from '@/components/Eyebrow';
import { api } from '@/lib/api';
import * as ads from '@/lib/ads';
import { color, radius, space, type } from '@/lib/theme';

type Props = {
  /** Ritüel türü — fiyat ve bakiye sunucudan okunuyor. */
  kind: 'coffee' | 'tarot' | 'natal';
};

const VARSAYILAN: Record<string, number> = { coffee: 3, tarot: 1, natal: 5 };

export function CoinGate({ kind }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  // Fiyat ve bakiye sunucudan: çağıran ekranlara sabit sayı geçirmek,
  // fiyat değiştiğinde kullanıcıya yanlış rakam göstermek demek.
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: api.me });
  const gerekli = me?.prices?.[kind] ?? VARSAYILAN[kind];
  const mevcut = me?.coins ?? 0;
  const [busy, setBusy] = useState(false);
  const [not, setNot] = useState<string | null>(null);

  const reklamVar = ads.available();

  const izle = async () => {
    setBusy(true);
    setNot(null);
    const r = await ads.showRewarded();
    setBusy(false);
    if (r.ok) {
      qc.invalidateQueries({ queryKey: ['me'] });
      setNot(`+1 jeton · toplam ${r.coins}`);
      return;
    }
    setNot(
      r.reason === 'cap'
        ? 'Bugünlük ödül hakkın doldu. Yarın devam edelim.'
        : r.reason === 'not_loaded'
          ? 'Reklam henüz hazır değil, birazdan tekrar dene.'
          : r.reason === 'dismissed'
            ? 'Video tamamlanmadı.'
            : 'Şu an reklam gösteremiyorum.',
    );
  };

  return (
    <View style={styles.kutu}>
      <Eyebrow style={styles.baslik}>jeton gerekiyor</Eyebrow>
      <Text style={styles.metin}>
        Bu ritüel {gerekli} jeton. Şu an {mevcut} jetonun var.
      </Text>

      {reklamVar && (
        <Pressable onPress={izle} disabled={busy} style={styles.birincil}>
          <Text style={styles.birincilText}>
            {busy ? 'reklam yükleniyor…' : 'Reklam izle · +1 jeton'}
          </Text>
        </Pressable>
      )}

      <Pressable onPress={() => router.push('/onboarding/paywall')}>
        <Text style={styles.ikincil}>
          {reklamVar ? 'veya sınırsız kullan' : 'Sınırsız kullan'}
        </Text>
      </Pressable>

      {not ? <Text style={styles.not}>{not}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  kutu: {
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.cezve,
    borderWidth: 1,
    borderColor: color.cizgi,
  },
  baslik: { ...type.eyebrow, color: color.bakir },
  metin: { ...type.body, color: color.porselen, marginTop: space.sm },
  birincil: {
    marginTop: space.lg,
    paddingVertical: space.md,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.bakir,
  },
  birincilText: { ...type.dataStrong, color: color.bakir, letterSpacing: 1 },
  ikincil: {
    ...type.data,
    color: color.kul,
    fontSize: 12,
    marginTop: space.md,
    textAlign: 'center',
  },
  not: {
    ...type.data,
    color: color.kulKoyu,
    fontSize: 11,
    marginTop: space.md,
    textAlign: 'center',
  },
});
