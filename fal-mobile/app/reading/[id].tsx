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
import React, { useEffect, useRef, useState } from 'react';
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
import { ArtSlot } from '@/components/ArtSlot';
import { ritualArt } from '@/lib/artAssets';
import { t } from '@/lib/i18n';
import { TarotReveal } from '@/components/TarotReveal';
import { NatalChartWheel } from '@/components/NatalChartWheel';
import { DreamSkyPanel } from '@/components/DreamSkyPanel';
import { RitualVisual } from '@/components/RitualVisual';
import {
  isReadingSlow,
  isWaitingKind,
  monotonicProgress,
  RITUAL_WAITING_MODELS,
  waitingStage,
} from '@/lib/ritualWaiting';

// Anahtarlar modül düzeyinde, METİN render anında.
//
// `t()`'yi modül gövdesinde çağırmak dili İÇE AKTARMA anında donduruyor:
// dil seçimi açılışta bir effect'te yapılıyor ve o ana kadar bu diziler
// çoktan Türkçe olarak kurulmuş oluyor. Tek dilli kurulumda görünmüyor,
// ikinci dil açıldığı gün bu ekranlar Türkçe kalıyor.
// Sonuç başlığı ritüele göre: hepsine "yorum" demek, kullanıcının hangi
// ritüelin sonucuna baktığını gizliyor.
const SONUC_ETIKET: Record<string, 'sonuc.kahveFali' | 'sonuc.tarot' | 'sonuc.natal' | 'sonuc.ruya' | 'sonuc.yorum'> = {
  coffee: 'sonuc.kahveFali',
  tarot: 'sonuc.tarot',
  natal: 'sonuc.natal',
  dream: 'sonuc.ruya',
};

const SIGN_GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];

export default function ReadingScreen() {
  const { id, kind: routeKind } = useLocalSearchParams<{ id: string; kind?: string }>();
  const router = useRouter();
  const [marker, setMarker] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [selectedNatalKey, setSelectedNatalKey] = useState('sun');
  const maxProgress = useRef(0.05);
  const cupPhotos = useDraft((s) => s.cupPhotos);
  const pushRegistered = useDraft((s) => s.pushRegistered);

  const { data, isError, refetch } = useQuery({
    queryKey: ['reading', id],
    queryFn: () => api.reading(id!),
    // Hazır olana kadar yokla. Sunucu ETA'yı da döndürüyor.
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === 'done' || s === 'failed' || s === 'blocked' ? false : 3000;
    },
    enabled: !!id,
  });

  const pending = !data || data.status === 'queued' || data.status === 'running';
  useEffect(() => {
    maxProgress.current = 0.05;
  }, [id]);
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [pending]);

  if (isError) {
    return (
      <Screen>
        <Text style={styles.err}>{t('sonuc.getirilemedi')}</Text>
        <Button label={t('ortak.tekrarDeneButon')} onPress={() => refetch()} />
        <Button label={t('ortak.geriDon')} variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  // --- 1. Bekleme ritüeli
  if (!data || data.status === 'queued' || data.status === 'running') {
    const waitingKind = isWaitingKind(data?.kind)
      ? data.kind
      : isWaitingKind(routeKind)
        ? routeKind
        : null;
    const p = monotonicProgress(maxProgress.current, data?.progress);
    maxProgress.current = p;
    const model = waitingKind ? RITUAL_WAITING_MODELS[waitingKind] : null;
    const stageIndex = waitingStage(p);
    const line = model ? t(model.stageKeys[stageIndex]) : t('sonuc.beklemeKaydi');
    const eta = data?.eta_seconds ?? 0;
    const remaining = eta
      ? Math.max(10, Math.ceil((eta * (1 - p)) / 10) * 10)
      : 0;
    const slow = isReadingSlow(data?.created_at, eta, now);
    return (
      <Screen style={styles.waitRoot}>
        <View accessible accessibilityLabel={model ? t(model.accessibilityKey) : t('sonuc.beklemeKaydi')} style={styles.waitAccessible}>
        <View style={styles.waitVisual}>
          <TelveRing size={240} value={Math.max(0.06, p)} mode="ritual" />
          {model ? <View style={styles.waitVisualInner}>
            <RitualVisual kind={model.visualKind} size={170} />
          </View> : null}
        </View>
        <Text style={styles.waitLine}>{line}</Text>
        <Text style={styles.waitStatus}>
          {slow
            ? t('sonuc.beklenendenUzun')
            : remaining
            ? t('sonuc.beklemeDurumSureli', { adim: stageIndex + 1, sure: remaining })
            : t('sonuc.beklemeDurum', { adim: stageIndex + 1 })}
        </Text>
        <Text style={styles.waitNote}>
          {pushRegistered ? t('sonuc.beklemeNot') : t('sonuc.beklemePushYok')}
        </Text>
        <Pressable onPress={() => router.replace('/(tabs)')} style={{ marginTop: space.xl }}>
          <Text style={styles.waitLink}>{t('ortak.anaEkranKucuk')}</Text>
        </Pressable>
        </View>
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
    const retry = async () => {
      if (data.kind === 'coffee') {
        router.replace('/ritual/coffee');
        return;
      }
      setRetrying(true);
      setRetryError(null);
      try {
        await api.retryReading(data.id);
        maxProgress.current = 0.05;
        await refetch();
      } catch (error) {
        setRetryError((error as Error).message || t('sonuc.yenidenDenenemedi'));
      } finally {
        setRetrying(false);
      }
    };
    return (
      <Screen>
        <Eyebrow style={styles.eyebrow}>{t('sonuc.olmadi')}</Eyebrow>
        <Text style={styles.failTitle}>{t('sonuc.okuyamadim')}</Text>
        <Text style={styles.failBody}>{t('sonuc.okuyamadimAciklama')}</Text>
        {retryError ? <Text style={styles.err}>{retryError}</Text> : null}
        <View style={{ flex: 1 }} />
        <Button
          label={data.kind === 'coffee' ? t('kahve.yenidenCek') : t('sonuc.ucretsizYenidenDene')}
          loading={retrying}
          onPress={retry}
        />
      </Screen>
    );
  }

  // --- 3. Sonuç
  const out = data.output_json!;
  const visibleText = (
    out?.ozet
    || out?.bolumler?.find((section) => section.metin?.trim())?.metin
    || out?.tavsiye
    || ''
  ).trim();
  if (!visibleText) {
    return (
      <Screen>
        <Text style={styles.err}>{t('sonuc.bosSonuc')}</Text>
        <Button label={t('ortak.anaEkran')} onPress={() => router.replace('/(tabs)')} />
      </Screen>
    );
  }
  const shareLine = (out.paylasim_cumlesi || out.ozet || '').trim();
  const predictions = [...(out.tahminler ?? [])].sort(
    (a, b) => Number(a.pencere_gun) - Number(b.pencere_gun),
  );
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
        {t(SONUC_ETIKET[data.kind] ?? 'sonuc.yorum')}
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

      {data.kind === 'tarot' && data.extra_json?.draw && (
        <TarotReveal draw={data.extra_json.draw} />
      )}

      {data.kind === 'natal' && data.extra_json?.chart && (
        <NatalChartWheel
          chart={data.extra_json.chart}
          selectedKey={selectedNatalKey}
          onSelectionChange={setSelectedNatalKey}
        />
      )}

      {data.kind === 'dream' && data.extra_json?.moon && data.extra_json?.dream_night && (
        <DreamSkyPanel
          moon={data.extra_json.moon}
          transits={data.extra_json.transits ?? []}
          night={data.extra_json.dream_night}
        />
      )}

      {data.kind === 'daily' && data.extra_json?.moon && data.extra_json?.sky_date && (
        <DreamSkyPanel
          moon={data.extra_json.moon}
          transits={data.extra_json.transits ?? []}
          night={data.extra_json.sky_date}
          mode="daily"
        />
      )}

      <Text style={styles.lead}>{out.ozet}</Text>

      {out.bolumler?.map((b, i) => (
        <View key={i} style={styles.section}>
          <ArtSlot id={ritualArt[data.kind] ?? 'daily'} strength="strong" />
          <View pointerEvents="none" style={styles.readingScrim} />
          <Eyebrow style={styles.sectionTitle}>{b.baslik}</Eyebrow>
          <Text style={styles.sectionBody}>{b.metin}</Text>
        </View>
      ))}

      {!!out.tavsiye && (
        <View style={styles.adviceBox}>
          <ArtSlot id={ritualArt[data.kind] ?? 'daily'} strength="strong" />
          <View pointerEvents="none" style={styles.readingScrim} />
          <Eyebrow style={styles.adviceLabel}>{t('sonuc.neYapmali')}</Eyebrow>
          <Text style={styles.advice}>{out.tavsiye}</Text>
        </View>
      )}

      {/* Tahminler defter kaydına geçiyor — kullanıcı burada "hesabı sorulacak"
          iddiaları görüyor. Ürünün ana farkının kullanıcıya göründüğü yer. */}
      {predictions.length > 0 && (
        <View style={styles.predBox}>
          <Eyebrow style={styles.predLabel}>{t('sonuc.defteryeYazildi')}</Eyebrow>
          {predictions.map((t, i) => (
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
      {!!shareLine && (
        <ShareCard
          line={shareLine}
          symbol={out.sembol}
          kind={data.kind}
          photoUri={data.kind === 'coffee' ? cupPhoto : undefined}
          natalChart={data.kind === 'natal' ? data.extra_json?.chart : undefined}
          selectedBodyKey={selectedNatalKey}
          computedDetail={
            data.kind === 'tarot'
              ? data.extra_json?.draw?.cards?.[0]?.name_tr
              : data.kind === 'dream' || data.kind === 'daily'
                ? data.extra_json?.moon?.ozet
                : data.kind === 'natal' && data.extra_json?.chart
                  ? `${t('harita.yukselen')} · ${SIGN_GLYPHS[Math.floor(data.extra_json.chart.ascendant / 30)]} ${Math.floor(data.extra_json.chart.ascendant % 30)}°`
                  : data.extra_json?.overlay?.[0]?.symbols?.[0]?.label
          }
        />
      )}

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
  waitAccessible: { alignItems: 'center', width: '100%' },
  waitVisual: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center' },
  waitVisualInner: { position: 'absolute' },
  waitLine: { ...type.oracle, color: color.porselen, marginTop: space.xl },
  waitStatus: { ...type.dataStrong, color: color.bakir, marginTop: space.sm },
  waitNote: { ...type.body, color: color.kul, marginTop: space.md, textAlign: 'center' },
  waitLink: { ...type.data, color: color.kulKoyu },

  lead: { ...type.oracleLead, color: color.porselen, marginTop: space.xl },

  section: {
    position: 'relative', overflow: 'hidden', marginTop: space.xl,
    padding: space.lg, borderRadius: radius.md,
    backgroundColor: color.cezve,
    borderWidth: 1,
    borderColor: color.cizgi,
  },
  // Result artwork remains visible, but it must never compete with long-form
  // copy. The extra local scrim affects reading cards only; artwork elsewhere
  // in the app keeps its original contrast.
  readingScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(22, 16, 14, 0.14)',
  },
  sectionTitle: { ...type.eyebrow, color: color.bakir },
  // Uzun yorum düz gövde kaydında; italik kâhin sesi özet/vurguda kalır.
  sectionBody: { ...type.body, color: color.porselen, marginTop: space.sm, lineHeight: 25 },

  adviceBox: {
    position: 'relative',
    overflow: 'hidden',
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
  predRow: {
    position: 'relative', overflow: 'hidden', flexDirection: 'row', gap: space.md,
    marginTop: space.md, padding: space.md, borderRadius: radius.sm,
    backgroundColor: color.cezve,
  },
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
