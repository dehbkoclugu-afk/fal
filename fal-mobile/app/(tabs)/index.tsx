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

const RITUALS = [
  { key: 'coffee', title: 'Kahve falı', note: 'fincanını çek', coins: 3, route: '/ritual/coffee' },
  { key: 'tarot', title: 'Tarot', note: 'kartını seç', coins: 1, route: '/ritual/tarot' },
  { key: 'natal', title: 'Doğum haritası', note: 'karakter çözümü', coins: 5, route: '/ritual/natal' },
  { key: 'dream', title: 'Rüya yorumu', note: 'yakında', coins: 0, route: null },
] as const;

export default function Home() {
  const router = useRouter();
  const qc = useQueryClient();
  const name = useDraft((s) => s.draft.firstName);
  const coins = useDraft((s) => s.coins);

  const { data: acc } = useQuery({ queryKey: ['accuracy'], queryFn: api.accuracy });
  const { data: history } = useQuery({ queryKey: ['history'], queryFn: () => api.history(1) });

  const verdict = useMutation({
    mutationFn: ({ id, v }: { id: string; v: 'hit' | 'partial' | 'miss' }) => api.verdict(id, v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accuracy'] });
    },
  });

  const pending = acc?.awaiting_verdict?.[0];
  const today = history?.[0];

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.hello}>{name ? `${name}` : 'merhaba'}</Text>
        <Text style={styles.coins}>{coins} jeton</Text>
      </View>

      {/* 1. Bekleyen doğrulama */}
      {pending && (
        <View style={styles.verifyBox}>
          <Text style={styles.verifyLabel}>hesabı sorulacak</Text>
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
          <Text style={styles.cupLabel}>bugün</Text>
          <Text style={styles.cupText} numberOfLines={4}>
            {today?.ozet ?? 'Günün yorumu hazırlanıyor. Birazdan burada olacak.'}
          </Text>
        </View>
      </Pressable>

      {/* 3. Ritüeller */}
      <Text style={styles.sectionLabel}>ritüeller</Text>
      <View style={styles.grid}>
        {RITUALS.map((r) => {
          const off = !r.route;
          return (
            <Pressable
              key={r.key}
              disabled={off}
              onPress={() => r.route && router.push(r.route as any)}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed, off && styles.tileOff]}
            >
              <Text style={styles.tileTitle}>{r.title}</Text>
              <Text style={styles.tileNote}>{r.note}</Text>
              {!off && <Text style={styles.tileCoins}>{r.coins} jeton</Text>}
            </Pressable>
          );
        })}
      </View>

      {/* 4. İsabet özeti — defter kaydına köprü */}
      {acc?.overall?.score != null && (
        <Pressable style={styles.scoreRow} onPress={() => router.push('/(tabs)/journal')}>
          <TelveRing size={44} value={(acc.overall.score ?? 0) / 100} mode="ledger" breathing={false} />
          <View style={{ flex: 1 }}>
            <Text style={styles.scoreLabel}>isabet oranın</Text>
            <Text style={styles.scoreValue}>
              %{acc.overall.score} · {acc.overall.total} tahmin
            </Text>
          </View>
          <Text style={styles.scoreArrow}>defter →</Text>
        </Pressable>
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
