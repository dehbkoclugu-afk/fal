/**
 * Kader Günlüğü — ürünün ana farkının yaşadığı ekran.
 *
 * Bu ekran kasıtlı olarak MİSTİK DEĞİL. Ritüel ekranları sıcak, serif, yavaş;
 * burası monospace, hairline cetvel, tablo. Çünkü burada yapılan iş kehanet
 * değil muhasebe: yapılmış iddiaların hesabı görülüyor.
 *
 * Rakiplerin hiçbirinde bu yok. Aynı zamanda Apple'ın 4.3(b) reddine karşı en
 * güçlü argüman: bu ekran, uygulamayı "başka bir burç uygulaması" olmaktan
 * çıkaran şey.
 *
 * Dürüstlük kuralı: tutmayan tahminler gizlenmiyor, aynı listede duruyor.
 * Oranı şişirmek kısa vadede iyi görünür, güveni öldürür.
 */
import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocalSearchParams } from 'expo-router';

import { PredictionRow } from '@/components/PredictionRow';
import { TelveRing } from '@/components/TelveRing';
import { api } from '@/lib/api';
import { color, radius, space, type } from '@/lib/theme';
import { Eyebrow } from '@/components/Eyebrow';
import { t } from '@/lib/i18n';

// Backend sabit dağarcığa indirgiyor (core/pricing.TOPICS); buradaki
// karşılıklar onunla birebir eşleşmeli, yoksa panel ham anahtar gösterir.
//
// Değerler ANAHTAR, metin değil: modül gövdesinde t() çağırmak dili içe
// aktarma anında donduruyor (dil seçimi açılışta bir effect'te yapılıyor).
const KONU_ANAHTAR = {
  ask: 'konu.ask',
  para: 'konu.para',
  kariyer: 'konu.kariyer',
  aile: 'konu.aile',
  saglik: 'konu.saglik',
  kendim: 'konu.kendim',
  genel: 'konu.genel',
} as const;

const konuAdi = (k: string) =>
  k in KONU_ANAHTAR ? t(KONU_ANAHTAR[k as keyof typeof KONU_ANAHTAR]) : k;

export default function Journal() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  /**
   * Doğrulama bildiriminden gelen tahmin.
   *
   * Bildirim "geçen hafta şunu söylemiştim — tuttu mu?" diyor; kullanıcı
   * tam olarak o tahmine cevap vermeye geliyor. Defteri açıp onu listede
   * aratmak, gelen kullanıcının yarısını kaybetmek demek. Vurgulanan satır
   * listenin başına alınıyor.
   */
  const { vurgu } = useLocalSearchParams<{ vurgu?: string }>();

  const { data, isRefetching, refetch } = useQuery({
    queryKey: ['accuracy'],
    queryFn: api.accuracy,
  });

  // Takip yorumu: kullanıcı cevap verdikten sonra karşılık görmezse
  // doğrulama mekaniği bir ankete dönüşüyor. Tutmayan tahminde dürüst
  // davranmak da burada oluyor — ürünün güven iddiası bu paragrafta.
  const [yorum, setYorum] = useState<string | null>(null);

  const verdict = useMutation({
    mutationFn: ({ id, v }: { id: string; v: 'hit' | 'partial' | 'miss' }) => api.verdict(id, v),
    onSuccess: (res) => {
      setYorum(res.yorum ?? null);
      qc.invalidateQueries({ queryKey: ['accuracy'] });
      qc.invalidateQueries({ queryKey: ['me'] });   // doğrulama jeton kazandırıyor
    },
  });

  const o = data?.overall;
  const score = o?.score ?? null;
  const answered = o ? o.hits + o.partials : 0;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: insets.top + space.lg,
        paddingBottom: insets.bottom + space.xxl,
        paddingHorizontal: space.lg,
      }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={color.bakir} />
      }
    >
      <Eyebrow style={styles.eyebrow}>{t('gunluk.eyebrow')}</Eyebrow>

      {/* Doğrulama sonrası karşılık */}
      {yorum ? (
        <Pressable onPress={() => setYorum(null)} style={styles.yorumKutu}>
          <Eyebrow style={styles.yorumLabel}>{t('gunluk.cevabinIcin')}</Eyebrow>
          <Text style={styles.yorumMetin}>{yorum}</Text>
          <Text style={styles.yorumKapat}>{t('ortak.kapat')}</Text>
        </Pressable>
      ) : null}

      {/* İsabet paneli */}
      <View style={styles.panel}>
        <TelveRing size={92} value={(score ?? 0) / 100} mode="ledger" breathing={false} />
        <View style={styles.panelText}>
          {score != null ? (
            <>
              <Text style={styles.figure}>%{score}</Text>
              <Text style={styles.figureNote}>
                {t('gunluk.ozet', { total: o!.total, hits: o!.hits, partials: o!.partials })}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.figureEmpty}>—</Text>
              <Text style={styles.figureNote}>{t('gunluk.henuzYok')}</Text>
            </>
          )}
        </View>
      </View>

      {/* Konu kırılımı — hangi alanda isabet yüksek */}
      {!!data?.by_topic?.length && (
        <>
          <Eyebrow style={styles.sectionLabel}>{t('gunluk.konuyaGore')}</Eyebrow>
          <View style={styles.topics}>
            {data.by_topic.map((t) => {
              const pct = t.total ? Math.round((t.hits / t.total) * 100) : 0;
              return (
                <View key={t.topic} style={styles.topicRow}>
                  <Text style={styles.topicName}>{konuAdi(t.topic)}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.topicPct}>%{pct}</Text>
                  <Text style={styles.topicCount}>{t.total}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Cevap bekleyenler */}
      {!!data?.awaiting_verdict?.length && (
        <>
          <Eyebrow style={styles.sectionLabel}>{t('gunluk.cevabiniBekliyorum')}</Eyebrow>
          {[...data.awaiting_verdict]
            .sort((a, b) => (b.id === vurgu ? 1 : 0) - (a.id === vurgu ? 1 : 0))
            .map((p) => (
              <PredictionRow
                key={p.id}
                claim={p.claim}
                topic={p.topic}
                dueAt={p.window_end}
                verdict="pending"
                vurgulu={p.id === vurgu}
                onVerdict={(v) => verdict.mutate({ id: p.id, v })}
              />
            ))}
        </>
      )}

      {answered === 0 && !data?.awaiting_verdict?.length && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('gunluk.defterBos')}</Text>
          <Text style={styles.emptyBody}>{t('gunluk.defterBosMetin')}</Text>
        </View>
      )}

      <Text style={styles.foot}>{t('gunluk.aciklama')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  yorumKutu: {
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.cezve,
    borderLeftWidth: 2,
    borderLeftColor: color.cini,
  },
  yorumLabel: { ...type.eyebrow, color: color.cini },
  yorumMetin: { ...type.oracle, color: color.porselen, marginTop: space.sm },
  yorumKapat: { ...type.data, color: color.kulKoyu, fontSize: 11, marginTop: space.md },
  root: { flex: 1, backgroundColor: color.telve },
  eyebrow: { ...type.eyebrow, color: color.kul },

  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    marginTop: space.lg,
    paddingVertical: space.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: color.cizgi,
  },
  panelText: { flex: 1 },
  figure: { ...type.figure, color: color.cini },
  figureEmpty: { ...type.figure, color: color.kulKoyu },
  figureNote: { ...type.data, color: color.kul, marginTop: space.xs },

  sectionLabel: { ...type.eyebrow, color: color.kulKoyu, marginTop: space.xxl, marginBottom: space.md },

  topics: { gap: space.md },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  topicName: { ...type.data, color: color.porselen, width: 62 },
  barTrack: { flex: 1, height: 3, backgroundColor: color.cizgi },
  barFill: { height: 3, backgroundColor: color.cini },
  topicPct: { ...type.dataStrong, color: color.porselen, width: 40, textAlign: 'right' },
  topicCount: { ...type.data, color: color.kulKoyu, width: 24, textAlign: 'right', fontSize: 11 },

  empty: { marginTop: space.xxl },
  emptyTitle: { ...type.title, color: color.porselen, fontSize: 22 },
  emptyBody: { ...type.body, color: color.kul, marginTop: space.md },

  foot: { ...type.data, color: color.kulKoyu, fontSize: 10, marginTop: space.xxl, lineHeight: 16 },
});
