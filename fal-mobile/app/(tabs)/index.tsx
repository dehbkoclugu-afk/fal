/**
 * Ana ekran.
 *
 * Hiyerarşi kasıtlı:
 *   1. Bekleyen doğrulama varsa EN ÜSTE çıkar. "Geçen hafta şunu söylemiştim,
 *      tuttu mu?" sorusu bu kategorinin en yüksek etkileşimli öğesi — kullanıcı
 *      kendi hakkındaki bir iddianın hesabını görmeye geliyor.
 *   2. Günün yorumu, fincan formunda tek büyük daire. Kart yığını değil:
 *      yukarıdan bakılan bir fincan.
 *   3. Ritüeller, düşük kontrastlı ızgara. Jeton fiyatları görünür — sürpriz
 *      ücret yok.
 *   4. Streak en altta ince bir satır. Oyunlaştırmayı öne çıkarmak bu üründe
 *      güveni azaltıyor.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/Screen';
import { TelveRing } from '@/components/TelveRing';
import { api } from '@/lib/api';
import { useDraft } from '@/lib/store';
import { color, radius, space, type } from '@/lib/theme';
import { Eyebrow } from '@/components/Eyebrow';

// Fiyatlar sunucudan (/v1/me → prices) geliyor; buradakiler sadece sunucu
// yanıtı gelmeden önceki gösterim. Sabit fiyat yazmak, fiyat değiştiğinde
// kullanıcıya yanlış rakam gösterip 402 ile karşılaştırır.
const RITUALS = [
  { key: 'coffee', title: 'Kahve falı', note: 'fincanını çek', route: '/ritual/coffee' },
  { key: 'tarot', title: 'Tarot', note: 'kartını seç', route: '/ritual/tarot' },
  { key: 'natal', title: 'Doğum haritası', note: 'karakter çözümü', route: '/ritual/natal' },
  { key: 'dream', title: 'Rüya yorumu', note: 'yakında', route: null },
] as const;

const VARSAYILAN_FIYAT: Record<string, number> = { coffee: 3, tarot: 1, natal: 5 };

export default function Home() {
  const router = useRouter();
  const qc = useQueryClient();
  const draftName = useDraft((s) => s.draft.firstName);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: api.me });
  const { data: acc } = useQuery({ queryKey: ['accuracy'], queryFn: api.accuracy });

  // Günün yorumu: history(1) son YAPILAN falı döndürüyor — geçen haftaki
  // kahve falı da olabilir. "Bugün" kartı gerçekten bugüne ait olmalı,
  // o yüzden ayrı uçtan isteniyor (ücretsiz, günde bir üretiliyor).
  const { data: daily } = useQuery({
    queryKey: ['daily'],
    queryFn: api.daily,
    enabled: !!me?.has_birth_data,
    staleTime: 60 * 60 * 1000,
  });
  const { data: dailyReading } = useQuery({
    queryKey: ['reading', daily?.reading_id],
    queryFn: () => api.reading(daily!.reading_id),
    enabled: !!daily?.reading_id,
    refetchInterval: (q) => (q.state.data?.status === 'done' ? false : 5000),
  });

  const verdict = useMutation({
    mutationFn: ({ id, v }: { id: string; v: 'hit' | 'partial' | 'miss' }) => api.verdict(id, v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accuracy'] });
      qc.invalidateQueries({ queryKey: ['me'] });   // doğrulama jeton kazandırıyor
    },
  });

  const name = me?.first_name ?? draftName;
  const coins = me?.coins ?? 0;
  const abone = !!me?.entitlement;
  const pending = acc?.awaiting_verdict?.[0];
  const today =
    dailyReading?.status === 'done'
      ? { id: dailyReading.id, ozet: dailyReading.output_json?.ozet ?? '' }
      : null;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.hello}>{name ? `${name}` : 'merhaba'}</Text>
        <Text style={styles.coins}>{abone ? 'sınırsız' : `${coins} jeton`}</Text>
      </View>

      {/* 1. Bekleyen doğrulama */}
      {pending && (
        <View style={styles.verifyBox}>
          <Eyebrow style={styles.verifyLabel}>hesabı sorulacak</Eyebrow>
          <Text style={styles.verifyClaim}>{pending.claim}</Text>
          <View style={styles.verifyActions}>
            {(['hit', 'partial', 'miss'] as const).map((v) => (
              <Pressable
                key={v}
                onPress={() => verdict.mutate({ id: pending.id, v })}
                style={styles.verifyBtn}
              >
                <Text style={styles.verifyBtnText}>
                  {v === 'hit' ? 'tuttu' : v === 'partial' ? 'kısmen' : 'tutmadı'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* 2. Günün yorumu — fincan formu */}
      <Pressable
        style={styles.cup}
        onPress={() => today && router.push(`/reading/${today.id}`)}
        accessibilityRole="button"
      >
        <TelveRing size={250} value={today ? 1 : 0.25} mode="ritual" breathing={!today} />
        <View style={styles.cupInner} pointerEvents="none">
          <Eyebrow style={styles.cupLabel}>bugün</Eyebrow>
          <Text style={styles.cupText} numberOfLines={4}>
            {today?.ozet ?? 'Günün yorumu hazırlanıyor. Birazdan burada olacak.'}
          </Text>
        </View>
      </Pressable>

      {/* 3. Ritüeller */}
      <Eyebrow style={styles.sectionLabel}>ritüeller</Eyebrow>
      <View style={styles.grid}>
        {RITUALS.map((r) => {
          const off = !r.route;
          const fiyat = me?.prices?.[r.key] ?? VARSAYILAN_FIYAT[r.key];
          return (
            <Pressable
              key={r.key}
              disabled={off}
              onPress={() => r.route && router.push(r.route as any)}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed, off && styles.tileOff]}
            >
              <Text style={styles.tileTitle}>{r.title}</Text>
              <Text style={styles.tileNote}>{r.note}</Text>
              {!off && (
                <Text style={styles.tileCoins}>
                  {abone ? 'dahil' : `${fiyat} jeton`}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* 4. İsabet özeti — defter kaydına köprü */}
      {acc?.overall?.score != null && (
        <Pressable style={styles.scoreRow} onPress={() => router.push('/(tabs)/journal')}>
          <TelveRing size={44} value={(acc.overall.score ?? 0) / 100} mode="ledger" breathing={false} />
          <View style={{ flex: 1 }}>
            <Eyebrow style={styles.scoreLabel}>isabet oranın</Eyebrow>
            <Text style={styles.scoreValue}>
              %{acc.overall.score} · {acc.overall.total} tahmin
            </Text>
          </View>
          <Text style={styles.scoreArrow}>defter →</Text>
        </Pressable>
      )}

      {/* Seri en altta, ince bir satır. Oyunlaştırmayı öne çıkarmak bu üründe
          güveni azaltıyor — bu yüzden kasıtlı olarak sessiz. */}
      {(me?.streak?.count ?? 0) > 1 && (
        <Text style={styles.streak}>
          {me!.streak.count} gündür buradasın
          {[7, 30, 100].includes(me!.streak.count) ? ' · jeton kazandın' : ''}
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  hello: { ...type.title, color: color.porselen },
  coins: { ...type.data, color: color.bakir },

  verifyBox: {
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.cini,
    backgroundColor: color.cezve,
  },
  verifyLabel: { ...type.eyebrow, color: color.cini },
  verifyClaim: { ...type.bodyStrong, color: color.porselen, marginTop: space.sm },
  verifyActions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  verifyBtn: {
    flex: 1,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderColor: color.cizgi,
    alignItems: 'center',
  },
  verifyBtnText: { ...type.dataStrong, color: color.porselen, fontSize: 12 },

  cup: { alignItems: 'center', justifyContent: 'center', marginTop: space.xl },
  cupInner: { position: 'absolute', width: 170, alignItems: 'center' },
  cupLabel: { ...type.eyebrow, color: color.kul },
  cupText: { ...type.oracle, color: color.porselen, textAlign: 'center', fontSize: 15, lineHeight: 24 },

  sectionLabel: { ...type.eyebrow, color: color.kulKoyu, marginTop: space.xxl, marginBottom: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: {
    width: '47.5%',
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.cezve,
    borderWidth: 1,
    borderColor: color.cizgi,
    minHeight: 104,
    justifyContent: 'space-between',
  },
  tilePressed: { backgroundColor: color.cezveUst },
  tileOff: { opacity: 0.4 },
  tileTitle: { ...type.bodyStrong, color: color.porselen },
  tileNote: { ...type.data, color: color.kulKoyu, fontSize: 11 },
  tileCoins: { ...type.data, color: color.bakir, fontSize: 11 },

  streak: {
    ...type.data,
    color: color.kulKoyu,
    fontSize: 11,
    marginTop: space.lg,
    textAlign: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.xxl,
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: color.cizgi,
  },
  scoreLabel: { ...type.eyebrow, color: color.kul },
  scoreValue: { ...type.dataStrong, color: color.porselen, marginTop: 2 },
  scoreArrow: { ...type.data, color: color.kulKoyu, fontSize: 11 },
});
