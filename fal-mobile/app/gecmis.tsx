/**
 * Geçmiş fallar.
 *
 * NEDEN VAR: sunucuda `GET /v1/readings` ucu ve istemcide `api.history()`
 * yazılmıştı ama hiçbir ekran onu çağırmıyordu. Sonuç: kullanıcı jeton
 * ödeyip ürettiği yorumu bir kez okuyor ve bir daha ulaşamıyor. Bildirimi
 * kaçırdıysa o fal tamamen erişilemez oluyordu.
 *
 * Bu aynı zamanda ürünün "seni hatırlıyorum" tezinin görünür tarafı:
 * kullanıcı kendi geçmişini göremiyorsa, uygulamanın onu hatırladığına dair
 * tek kanıtı yorumun içine gömülü cümleler oluyor.
 *
 * KAYIT: bu ekran defter değil, arşiv. Kader Günlüğü tahminlerin klinik
 * muhasebesi (mono, cetvel çizgileri); burası okunmuş falların rafı, o yüzden
 * ritüel tarafının sıcak sesini koruyor — özet metni serif italik.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { api } from '@/lib/api';
import { color, radius, space, type } from '@/lib/theme';
import { Eyebrow } from '@/components/Eyebrow';
import { ArtSlot } from '@/components/ArtSlot';
import { artForKey } from '@/lib/artAssets';
import { t, tarih } from '@/lib/i18n';

/** Ritüel adı — sonuç ekranındaki etiketlerle aynı kalmalı. */
const KIND_ANAHTAR = {
  coffee: 'sonuc.kahveFali',
  tarot: 'sonuc.tarot',
  natal: 'sonuc.natal',
  dream: 'sonuc.ruya',
  daily: 'ana.bugun',
} as const;

const ritualAdi = (k: string) =>
  k in KIND_ANAHTAR ? t(KIND_ANAHTAR[k as keyof typeof KIND_ANAHTAR]) : t('sonuc.yorum');

export default function Gecmis() {
  const router = useRouter();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['history'],
    queryFn: () => api.history(50),
  });

  return (
    <Screen scroll>
      <Eyebrow style={styles.eyebrow}>{t('gecmis.eyebrow')}</Eyebrow>

      {isError ? <Text style={styles.hata}>{t('gecmis.getirilemedi')}</Text> : null}

      {!isLoading && !isError && data?.length === 0 && (
        <View style={styles.bos}>
          <ArtSlot id="daily" strength="strong" />
          <Text style={styles.bosBaslik}>{t('gecmis.bos')}</Text>
          <Text style={styles.bosMetin}>{t('gecmis.bosMetin')}</Text>
          <Button
            label={t('gecmis.ilkFal')}
            style={{ marginTop: space.xl }}
            onPress={() => router.replace('/(tabs)')}
          />
        </View>
      )}

      {data?.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => router.push(`/reading/${r.id}`)}
          style={({ pressed }) => [styles.satir, pressed && styles.satirBasili]}
        >
          <ArtSlot id={artForKey(r.id)} strength="strong" />
          <View style={styles.ust}>
            <Eyebrow style={styles.tur}>{ritualAdi(r.kind)}</Eyebrow>
            <Text style={styles.tarih}>{tarih(r.created_at)}</Text>
          </View>
          {/* Özet, yorumun kullanıcının hatırladığı ilk cümlesi — listede
              onu göstermek "hangisiydi bu" sorusunu tek bakışta çözüyor. */}
          <Text style={styles.ozet} numberOfLines={2}>{r.ozet}</Text>
        </Pressable>
      ))}

      <View style={{ height: space.xxl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...type.eyebrow, color: color.kul, marginTop: space.lg },
  hata: { ...type.data, color: color.kiremit, marginTop: space.lg, fontSize: 12 },

  bos: {
    position: 'relative', overflow: 'hidden', marginTop: space.xxl,
    alignItems: 'flex-start', padding: space.lg, borderRadius: radius.md,
  },
  bosBaslik: { ...type.title, color: color.porselen, fontSize: 22 },
  bosMetin: { ...type.body, color: color.kul, marginTop: space.sm },

  satir: {
    position: 'relative',
    overflow: 'hidden',
    marginTop: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.cizgi,
    backgroundColor: color.cezve,
  },
  satirBasili: { backgroundColor: color.cezveUst },
  ust: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tur: { ...type.eyebrow, color: color.bakir, fontSize: 10 },
  tarih: { ...type.data, color: color.kulKoyu, fontSize: 11 },
  ozet: { ...type.oracle, color: color.porselen, marginTop: space.sm, fontSize: 16 },
});
