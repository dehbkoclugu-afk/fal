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
import { ArtSlot } from '@/components/ArtSlot';
import { t, tarih } from '@/lib/i18n';
import { artForKey, ritualArt } from '@/lib/artAssets';

// Fiyatlar sunucudan (/v1/me → prices) geliyor; buradakiler sadece sunucu
// yanıtı gelmeden önceki gösterim. Sabit fiyat yazmak, fiyat değiştiğinde
// kullanıcıya yanlış rakam gösterip 402 ile karşılaştırır.
const RITUALS = [
  { key: 'coffee', title: 'ritual.kahve', note: 'ritual.kahveNot', route: '/ritual/coffee' },
  { key: 'tarot', title: 'ritual.tarot', note: 'ritual.tarotNot', route: '/ritual/tarot' },
  { key: 'natal', title: 'ritual.natal', note: 'ritual.natalNot', route: '/ritual/natal' },
  { key: 'dream', title: 'ritual.ruya', note: 'ritual.ruyaNot', route: '/ritual/dream' },
] as const;

const VARSAYILAN_FIYAT: Record<string, number> = { coffee: 3, tarot: 1, natal: 5, dream: 2 };

export default function Home() {
  const router = useRouter();
  const qc = useQueryClient();
  const draftName = useDraft((s) => s.draft.firstName);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: api.me });
  const { data: acc } = useQuery({ queryKey: ['accuracy'], queryFn: api.accuracy });

  // Geçmiş fallar. Sunucu ucu ve istemci fonksiyonu vardı ama hiçbir ekran
  // çağırmıyordu: kullanıcı jeton ödeyip ürettiği yorumu bir kez okuyup bir
  // daha ulaşamıyordu. Burada son üçü, tamamı /gecmis ekranında.
  const { data: gecmis } = useQuery({ queryKey: ['history'], queryFn: () => api.history(10) });

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
  const ent = me?.entitlement ?? null;
  const abone = !!ent;
  // Kotalı katmanda "sınırsız" yazmak yalan olur ve kullanıcı 402'ye toslar.
  const kotaVar = !!ent && ent.quota_left !== null;
  const bakiyeMetni = !ent
    ? t('ortak.jeton', { n: coins })
    : kotaVar
      ? t('ana.kalanFal', { n: ent.quota_left!, tier: ent.tier_tr })
      : ent.tier_tr;
  const pending = acc?.awaiting_verdict?.[0];
  const dailySummary = dailyReading?.output_json?.ozet?.trim() ?? '';
  const dailyEmpty = dailyReading?.status === 'done' && !dailySummary;
  const today = dailyReading?.status === 'done' && dailySummary
    ? { id: dailyReading.id, ozet: dailySummary }
    : null;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.hello}>{name ? `${name}` : t('ana.merhaba')}</Text>
        <Text style={styles.coins}>{bakiyeMetni}</Text>
      </View>

      {/* 1. Bekleyen doğrulama */}
      {pending && (
        <View style={styles.verifyBox}>
          <ArtSlot id="verify" strength="strong" />
          <Eyebrow style={styles.verifyLabel}>{t('ana.hesabiSorulacak')}</Eyebrow>
          <Text style={styles.verifyClaim}>{pending.claim}</Text>
          <View style={styles.verifyActions}>
            {(['hit', 'partial', 'miss'] as const).map((v) => (
              <Pressable
                key={v}
                onPress={() => verdict.mutate({ id: pending.id, v })}
                style={styles.verifyBtn}
              >
                <Text style={styles.verifyBtnText}>
                  {v === 'hit' ? t('ana.tuttu') : v === 'partial' ? t('ana.kismen') : t('ana.tutmadi')}
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
        <ArtSlot id="daily" strength="strong" />
        <TelveRing size={220} value={today ? 1 : 0.25} mode="ritual" breathing={!today} />
        <View style={styles.cupInner} pointerEvents="none">
          <Eyebrow style={styles.cupLabel}>{t('ana.bugun')}</Eyebrow>
          <Text style={styles.cupText} numberOfLines={4}>
            {today?.ozet ?? (dailyEmpty
              ? t('ana.gunlukHazirlanamadi')
              : t('ana.gunlukHazirlaniyor'))}
          </Text>
        </View>
      </Pressable>

      {/* 3. Ritüeller */}
      <Eyebrow style={styles.sectionLabel}>{t('ana.ritueller')}</Eyebrow>
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
              <ArtSlot id={ritualArt[r.key]} strength="card" />
              <Text style={styles.tileTitle}>{t(r.title)}</Text>
              <Text style={styles.tileNote}>{t(r.note)}</Text>
              {!off && (
                <Text style={styles.tileCoins}>
                  {abone && (!kotaVar || (ent!.quota_left ?? 0) > 0)
                    ? t('ana.dahil')
                    : t('ortak.jeton', { n: fiyat })}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* 4. Geçmiş fallar — üretilen içerik erişilebilir kalsın */}
      {!!gecmis?.length && (
        <>
          <Pressable style={styles.gecmisBaslik} onPress={() => router.push('/gecmis')}>
            <Eyebrow style={styles.sectionLabelSatir}>{t('ana.gecmis')}</Eyebrow>
            <Text style={styles.scoreArrow}>{t('ana.gecmisOk')}</Text>
          </Pressable>
          {gecmis.slice(0, 3).map((r) => (
            <Pressable
              key={r.id}
              onPress={() => router.push(`/reading/${r.id}`)}
              style={({ pressed }) => [styles.gecmisSatir, pressed && styles.gecmisBasili]}
            >
              <ArtSlot id={ritualArt[r.kind] ?? artForKey(r.id)} strength="strong" />
              <Text style={styles.gecmisOzet} numberOfLines={1}>{r.ozet}</Text>
              <Text style={styles.gecmisTarih}>{tarih(r.created_at)}</Text>
            </Pressable>
          ))}
        </>
      )}

      {/* 5. İsabet özeti — defter kaydına köprü */}
      {acc?.overall?.score != null && (
        <Pressable style={styles.scoreRow} onPress={() => router.push('/(tabs)/journal')}>
          <ArtSlot id="ledger" strength="strong" />
          <TelveRing size={44} value={(acc.overall.score ?? 0) / 100} mode="ledger" breathing={false} />
          <View style={{ flex: 1 }}>
            <Eyebrow style={styles.scoreLabel}>{t('ana.isabetOranin')}</Eyebrow>
            <Text style={styles.scoreValue}>
              {t('ana.isabetOzet', { score: acc.overall.score ?? 0, total: acc.overall.total })}
            </Text>
          </View>
          <Text style={styles.scoreArrow}>{t('ana.defterOk')}</Text>
        </Pressable>
      )}

      {/* Seri en altta, ince bir satır. Oyunlaştırmayı öne çıkarmak bu üründe
          güveni azaltıyor — bu yüzden kasıtlı olarak sessiz. */}
      {(me?.streak?.count ?? 0) > 1 && (
        <Text style={styles.streak}>
          {t('ana.seri', { n: me!.streak.count })}
          {[7, 30, 100].includes(me!.streak.count) ? t('ana.seriOdul') : ''}
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
    position: 'relative',
    overflow: 'hidden',
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

  cup: {
    alignItems: 'center', justifyContent: 'center', marginTop: space.xl,
    width: 220, height: 220, alignSelf: 'center', borderRadius: radius.full,
    overflow: 'hidden', backgroundColor: color.cezve,
  },
  cupInner: { position: 'absolute', width: 170, alignItems: 'center' },
  cupLabel: { ...type.eyebrow, color: color.kul },
  cupText: { ...type.oracle, color: color.porselen, textAlign: 'center', fontSize: 15, lineHeight: 24 },

  sectionLabel: { ...type.eyebrow, color: color.kulKoyu, marginTop: space.xxl, marginBottom: space.md },
  sectionLabelSatir: { ...type.eyebrow, color: color.kulKoyu },
  gecmisBaslik: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.xxl,
    marginBottom: space.sm,
  },
  gecmisSatir: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    marginBottom: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: color.cizgi,
  },
  gecmisBasili: { backgroundColor: color.cezve },
  gecmisOzet: { ...type.oracle, color: color.kul, flex: 1, fontSize: 15 },
  gecmisTarih: { ...type.data, color: color.kulKoyu, fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: {
    position: 'relative',
    overflow: 'hidden',
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
    position: 'relative',
    overflow: 'hidden',
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
