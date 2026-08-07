/**
 * Fal sonuç ekranı — bekleme ritüelinden yorum metnine.
 *
 * Üç durum var ve üçü de farklı ekran:
 *   1. queued/running → telve halkası dolar, sayaç değil. Sayaç göstermek
 *      beklemeyi teknik bir gecikmeye çevirir; halka onu ritüele çevirir.
 *   2. blocked (kriz)  → yorum YOK. Destek mesajı ve yönlendirme.
 *      guardrail.BLOCK_CRISIS bu ekranı üretiyor; asla fal gösterilmiyor.
 *   3. done            → fincan overlay + yorum. Metin serif italik (kâhin sesi),
 *      bölüm etiketleri monospace (defter sesi).
 */
import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/Button';
import { CupOverlay } from '@/components/CupOverlay';
import { Screen } from '@/components/Screen';
import { ShareCard } from '@/components/ShareCard';
import { TelveRing } from '@/components/TelveRing';
import { api } from '@/lib/api';
import { useDraft } from '@/lib/store';
import { color, radius, space, type } from '@/lib/theme';
import { Eyebrow } from '@/components/Eyebrow';
import { t } from '@/lib/i18n';

const WAITING_LINES = [
  t('sonuc.bekleme1'),
  t('sonuc.bekleme2'),
  t('sonuc.bekleme3'),
  t('sonuc.bekleme4'),
];

export default function ReadingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [marker, setMarker] = useState<string | null>(null);
  const cupPhotos = useDraft((s) => s.cupPhotos);

  const { data, isError } = useQuery({
    queryKey: ['reading', id],
    queryFn: () => api.reading(id!),
    // Hazır olana kadar yokla. Sunucu ETA'yı da döndürüyor.
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === 'done' || s === 'failed' || s === 'blocked' ? false : 3000;
    },
    enabled: !!id,
  });

  if (isError) {
    return (
      <Screen>
        <Text style={styles.err}>{t('sonuc.getirilemedi')}</Text>
        <Button label={t('ortak.geriDon')} variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  // --- 1. Bekleme ritüeli
  if (!data || data.status === 'queued' || data.status === 'running') {
    const p = data?.progress ?? 0.05;
    const line = WAITING_LINES[Math.min(WAITING_LINES.length - 1, Math.floor(p * WAITING_LINES.length))];
    return (
      <Screen style={styles.waitRoot}>
        <TelveRing size={280} value={Math.max(0.06, p)} mode="ritual" />
        <Text style={styles.waitLine}>{line}</Text>
        <Text style={styles.waitNote}>{t('sonuc.beklemeNot')}</Text>
        <Pressable onPress={() => router.replace('/(tabs)')} style={{ marginTop: space.xl }}>
          <Text style={styles.waitLink}>{t('ortak.anaEkranKucuk')}</Text>
        </Pressable>
      </Screen>
    );
  }

  // --- 2. Kriz akışı: fal üretilmedi, üretilmeyecek
  if (data.status === 'blocked') {
    return (
      <Screen scroll>
        <Text style={styles.careTitle}>{t('sonuc.krizBaslik')}</Text>
        <Text style={styles.careBody}>{data.output_json?.ozet ?? ''}</Text>

        <View style={styles.helpBox}>
          <Pressable onPress={() => Linking.openURL('tel:112')} style={styles.helpRow}>
            <Text style={styles.helpNum}>112</Text>
            <Text style={styles.helpLabel}>{t('sonuc.acilYardim')}</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('tel:183')} style={styles.helpRow}>
            <Text style={styles.helpNum}>183</Text>
            <Text style={styles.helpLabel}>{t('sonuc.destekHatti')}</Text>
          </Pressable>
        </View>

        <Button label={t('ortak.anaEkran')} variant="ghost" onPress={() => router.replace('/(tabs)')} />
      </Screen>
    );
  }

  // --- Fotoğraf reddi (bulanık, fincan bulunamadı vb.)
  if (data.status === 'failed') {
    return (
      <Screen>
        <Eyebrow style={styles.eyebrow}>{t('sonuc.olmadi')}</Eyebrow>
        <Text style={styles.failTitle}>{t('sonuc.okuyamadim')}</Text>
        <Text style={styles.failBody}>{t('sonuc.okuyamadimAciklama')}</Text>
        <View style={{ flex: 1 }} />
        <Button label={t('kahve.yenidenCek')} onPress={() => router.replace('/ritual/coffee')} />
      </Screen>
    );
  }

  // --- 3. Sonuç
  const out = data.output_json!;
  const markers = data.extra_json?.overlay ?? [];

  // Fotoğraf cihazda kalıyor: sunucu ham görüntüyü işledikten hemen sonra
  // siliyor (KVKK kararı, bkz. fal-backend README bölüm 8). Overlay'i çizmek
  // için gereken tek şey yerel dosya yolu — sunucuya imzalı URL yazdırmaya
  // gerek yok, hem maliyet hem hukuki risk düşüyor.
  const cupPhoto = cupPhotos[id!];

  // Ölçek: bbox'lar cup_vision'ın çalıştığı boyutta (uzun kenar 1280'e
  // indirilmiş). Sabit 1280×1280 varsaymak kare olmayan her fotoğrafta
  // işaretleri kaydırır — gerçek boyut quality içinde geliyor.
  const q = data.extra_json?.cup?.quality;

  return (
    <Screen scroll>
      <Eyebrow style={styles.eyebrow}>
        {data.kind === 'coffee' ? t('sonuc.kahveFali') : data.kind === 'tarot' ? t('sonuc.tarot') : t('sonuc.yorum')}
      </Eyebrow>

      {data.kind === 'coffee' && cupPhoto && markers.length > 0 && q && (
        <View style={{ marginTop: space.md }}>
          <CupOverlay
            photoUri={cupPhoto}
            markers={markers}
            srcWidth={q.width}
            srcHeight={q.height}
            selectedId={marker}
            onSelect={setMarker}
          />
        </View>
      )}

      <Text style={styles.lead}>{out.ozet}</Text>

      {out.bolumler?.map((b, i) => (
        <View key={i} style={styles.section}>
          <Eyebrow style={styles.sectionTitle}>{b.baslik}</Eyebrow>
          <Text style={styles.sectionBody}>{b.metin}</Text>
        </View>
      ))}

      {!!out.tavsiye && (
        <View style={styles.adviceBox}>
          <Eyebrow style={styles.adviceLabel}>{t('sonuc.neYapmali')}</Eyebrow>
          <Text style={styles.advice}>{out.tavsiye}</Text>
        </View>
      )}

      {/* Tahminler defter kaydına geçiyor — kullanıcı burada "hesabı sorulacak"
          iddiaları görüyor. Ürünün ana farkının kullanıcıya göründüğü yer. */}
      {out.tahminler?.length > 0 && (
        <View style={styles.predBox}>
          <Eyebrow style={styles.predLabel}>{t('sonuc.defteryeYazildi')}</Eyebrow>
          {out.tahminler.map((t, i) => (
            <View key={i} style={styles.predRow}>
              <Text style={styles.predWindow}>{t.pencere_gun}g</Text>
              <Text style={styles.predClaim}>{t.iddia}</Text>
            </View>
          ))}
          <Text style={styles.predNote}>{t('sonuc.tahminNotu')}</Text>
        </View>
      )}

      {/* Paylaşım: viral döngünün tek mekanik parçası. Watermark'lı, Story
          ölçüsünde bir görsel üretiliyor — ekran görüntüsü almak yerine. */}
      <ShareCard
        line={out.paylasim_cumlesi || out.ozet}
        symbol={out.sembol}
        kind={data.kind}
        photoUri={data.kind === 'coffee' ? cupPhoto : undefined}
      />

      <Button
        label={t('sonuc.gunlugeGit')}
        variant="ghost"
        style={{ marginTop: space.xl }}
        onPress={() => router.replace('/(tabs)/journal')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...type.eyebrow, color: color.kul },

  waitRoot: { alignItems: 'center', justifyContent: 'center' },
  waitLine: { ...type.oracle, color: color.porselen, marginTop: space.xl },
  waitNote: { ...type.body, color: color.kul, marginTop: space.md, textAlign: 'center' },
  waitLink: { ...type.data, color: color.kulKoyu },

  lead: { ...type.oracleLead, color: color.porselen, marginTop: space.xl },

  section: { marginTop: space.xl },
  sectionTitle: { ...type.eyebrow, color: color.bakir },
  sectionBody: { ...type.oracle, color: color.porselen, marginTop: space.sm },

  adviceBox: {
    marginTop: space.xl,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.cezve,
    borderLeftWidth: 2,
    borderLeftColor: color.bakir,
  },
  adviceLabel: { ...type.eyebrow, color: color.kul },
  advice: { ...type.bodyStrong, color: color.porselen, marginTop: space.sm },

  predBox: { marginTop: space.xxl, borderTopWidth: 1, borderTopColor: color.cizgi, paddingTop: space.lg },
  predLabel: { ...type.eyebrow, color: color.cini },
  predRow: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  predWindow: { ...type.dataStrong, color: color.kulKoyu, width: 32 },
  predClaim: { ...type.data, color: color.porselen, flex: 1 },
  predNote: { ...type.data, color: color.kulKoyu, fontSize: 11, marginTop: space.lg },

  careTitle: { ...type.title, color: color.porselen, marginTop: space.xl },
  careBody: { ...type.body, color: color.porselen, marginTop: space.lg },
  helpBox: { marginTop: space.xl, gap: space.md },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.cizgi,
  },
  helpNum: { ...type.figure, color: color.cini, fontSize: 26 },
  helpLabel: { ...type.body, color: color.kul },

  failTitle: { ...type.title, color: color.porselen, marginTop: space.sm },
  failBody: { ...type.body, color: color.kul, marginTop: space.md },
  err: { ...type.body, color: color.kiremit, marginBottom: space.lg },
});
