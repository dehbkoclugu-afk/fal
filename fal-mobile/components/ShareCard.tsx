/**
 * ShareCard — paylaşılabilir sonuç görseli.
 *
 * Neden ekran görüntüsü yetmez: kullanıcı ekran görüntüsü aldığında saat,
 * pil, sekme çubuğu ve yarım kalan metin de gider. Paylaşım oranı düşer,
 * paylaşılan görselde marka görünmez. Kontrollü bir kart üretmek bu
 * kategoride en ucuz kazanılan organik kanal.
 *
 * Tasarım: Instagram Story oranında (9:16) değil, 4:5 kare-uzun. Sebep:
 * 4:5 hem feed'de hem Story'de kırpılmadan duruyor; 9:16 feed'de kesiliyor.
 *
 * Kart iki kayıtta da konuşuyor (bkz. lib/theme): kehanet cümlesi serif
 * italik, altbilgi monospace.
 */
import React, { useRef, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { captureRef } from 'react-native-view-shot';
import * as Haptics from 'expo-haptics';

import { color, radius, space, type } from '@/lib/theme';
import { Eyebrow } from '@/components/Eyebrow';
import { ArtSlot } from '@/components/ArtSlot';
import { ritualArt } from '@/lib/artAssets';
import { RitualVisual, type RitualKind } from '@/components/RitualVisual';
import { t } from '@/lib/i18n';

type Props = {
  line: string;
  symbol?: string;
  kind: string;
  photoUri?: string;
  computedDetail?: string;
};

// Anahtar tutuluyor, metin render anında üretiliyor: modül gövdesindeki t()
// dili içe aktarma anında dondurur.
//
// `kind` gevşek tiplenmiş ve bilinmeyen değer için karşılığı var: rüya
// ritüeli eklendiğinde bu eşleme güncellenmemişti ve paylaşım görselinin
// başlığı BOŞ çıkıyordu. Sunucu yeni bir ritüel türü gönderdiğinde görsel
// başlıksız kalmasın.
const BASLIK_ANAHTAR = {
  coffee: 'sonuc.kahveFali',
  tarot: 'tarot.eyebrow',
  natal: 'natal.eyebrow',
  dream: 'sonuc.ruya',
  daily: 'paylas.gununYorumu',
} as const;

const baslik = (k: string) =>
  t(k in BASLIK_ANAHTAR ? BASLIK_ANAHTAR[k as keyof typeof BASLIK_ANAHTAR]
                        : 'sonuc.yorum');

export function ShareCard({ line, symbol, kind, photoUri, computedDetail }: Props) {
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const safeLine = line.trim();
  const safeSymbol = symbol?.trim();
  const safeComputedDetail = computedDetail?.trim();
  const visualKind: RitualKind = kind === 'tarot' || kind === 'natal' || kind === 'dream' || kind === 'daily'
    ? kind
    : 'coffee';

  const share = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 0.95,
        // Story/feed için yeterli çözünürlük; daha yükseği dosyayı büyütüp
        // paylaşım sayfasının açılmasını yavaşlatıyor.
        result: 'tmpfile',
      });
      await Share.share(
        Platform.OS === 'ios'
          ? { url: uri }
          : { message: safeLine, url: uri },
      );
    } catch {
      setError(t('paylas.hata'));
    } finally {
      setBusy(false);
    }
  };

  if (!safeLine) return null;

  return (
    <View style={styles.wrap}>
      {/* Yakalanan alan. Ekranda da görünüyor: kullanıcı ne paylaşacağını
          önceden görmezse paylaşma oranı düşüyor. */}
      <View ref={cardRef} collapsable={false} style={styles.card}>
        <ArtSlot id={ritualArt[kind] ?? 'daily'} strength="strong" />

        {/*
          Üst alanın yüksekliği sabit. `symbol` her zaman tek karakter değil;
          sunucu "Doğan güneş" gibi bir başlık da gönderebiliyor. Önceki
          sürüm bunu 56pt sınırsız metin olarak çizdiği için Android'de kartın
          gövdesi ve altbilgisi birbirinin üstüne taşıyordu.
        */}
        <View style={styles.media}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
          ) : safeSymbol ? (
            <Text
              style={styles.symbolTitle}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {safeSymbol}
            </Text>
          ) : (
            <RitualVisual kind={visualKind} size={96} />
          )}
        </View>

        <View style={styles.body}>
          <Eyebrow style={styles.eyebrow}>{baslik(kind)}</Eyebrow>
          <Text
            style={styles.line}
            numberOfLines={4}
            adjustsFontSizeToFit
            minimumFontScale={0.68}
          >
            {safeLine}
          </Text>
          <View style={styles.details}>
            {!!safeSymbol && photoUri ? (
              <Text style={styles.symbol} numberOfLines={1} ellipsizeMode="tail">
                {t('paylas.cikanSembol', { sembol: safeSymbol })}
              </Text>
            ) : null}
            {!!safeComputedDetail && (
              <Text style={styles.computed} numberOfLines={1} ellipsizeMode="tail">
                {safeComputedDetail}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.footer}>
          {/* i18n-ignore: marka adı çevrilmiyor */}
          <Text style={styles.brand} numberOfLines={1}>telve</Text>
          <Text style={styles.disclaimer} numberOfLines={1}>{t('ortak.eglenceAmacli')}</Text>
        </View>
      </View>

      <Pressable onPress={share} disabled={busy} style={styles.btn}>
        <Text style={styles.btnLabel}>{busy ? t('paylas.hazirlaniyor') : t('paylas.buton')}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.xxl },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    aspectRatio: 4 / 5,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: color.cezve,
    borderWidth: 1,
    borderColor: color.cizgi,
  },
  media: {
    height: '34%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: space.lg,
  },
  photo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  symbolTitle: {
    ...type.oracle,
    width: '100%',
    color: color.bakir,
    fontSize: 30,
    lineHeight: 34,
    textAlign: 'center',
  },
  body: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  eyebrow: { ...type.eyebrow, color: color.bakir },
  line: {
    ...type.oracleLead,
    flex: 1,
    minHeight: 0,
    color: color.porselen,
    marginTop: space.sm,
    fontSize: 22,
    lineHeight: 29,
  },
  details: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.xs,
  },
  symbol: { ...type.data, flex: 1, minWidth: 0, color: color.kulKoyu, fontSize: 10 },
  computed: { ...type.data, flexShrink: 1, minWidth: 0, color: color.cini, fontSize: 10 },
  footer: {
    height: 44,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  // Watermark: paylaşılan görselde markanın göründüğü tek yer.
  brand: { ...type.dataStrong, color: color.bakir, letterSpacing: 2 },
  // Mağaza kuralı ve uyum gereği kartta da bulunmak zorunda.
  disclaimer: { ...type.data, flexShrink: 1, color: color.kulKoyu, fontSize: 10, textAlign: 'right' },
  btn: {
    marginTop: space.md,
    paddingVertical: space.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: color.cizgi,
    borderRadius: radius.md,
  },
  btnLabel: { ...type.dataStrong, color: color.bakir, letterSpacing: 1 },
  error: { ...type.data, color: color.kiremit, fontSize: 11, marginTop: space.sm },
});
