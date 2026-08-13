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
          : { message: line, url: uri },
      );
    } catch {
      setError(t('paylas.hata'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {/* Yakalanan alan. Ekranda da görünüyor: kullanıcı ne paylaşacağını
          önceden görmezse paylaşma oranı düşüyor. */}
      <View ref={cardRef} collapsable={false} style={styles.card}>
        <ArtSlot id={ritualArt[kind] ?? 'daily'} strength="strong" />
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
        ) : (
          <View style={[styles.photo, styles.photoFallback]}>
            <Text style={styles.symbolBig}>{symbol || '☾'}</Text>
          </View>
        )}

        <View style={styles.body}>
          <Eyebrow style={styles.eyebrow}>{baslik(kind)}</Eyebrow>
          <Text style={styles.line} numberOfLines={4}>
            {line}
          </Text>
          {!!symbol && photoUri ? (
            <Text style={styles.symbol}>{t('paylas.cikanSembol', { sembol: symbol })}</Text>
          ) : null}
          {!!computedDetail && <Text style={styles.computed}>{computedDetail}</Text>}
        </View>

        <View style={styles.footer}>
          {/* i18n-ignore: marka adı çevrilmiyor */}
          <Text style={styles.brand}>telve</Text>
          <Text style={styles.disclaimer}>{t('ortak.eglenceAmacli')}</Text>
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
    aspectRatio: 4 / 5,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: color.cezve,
    borderWidth: 1,
    borderColor: color.cizgi,
  },
  photo: { width: '100%', flex: 1.15 },
  photoFallback: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolBig: { ...type.oracle, color: color.bakir, fontSize: 56 },
  body: { paddingHorizontal: space.lg, paddingTop: space.lg, flex: 1 },
  eyebrow: { ...type.eyebrow, color: color.bakir },
  line: { ...type.oracleLead, color: color.porselen, marginTop: space.sm },
  symbol: { ...type.data, color: color.kulKoyu, fontSize: 11, marginTop: space.md },
  computed: { ...type.data, color: color.cini, fontSize: 10, marginTop: space.sm },
  footer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
  },
  // Watermark: paylaşılan görselde markanın göründüğü tek yer.
  brand: { ...type.dataStrong, color: color.bakir, letterSpacing: 2 },
  // Mağaza kuralı ve uyum gereği kartta da bulunmak zorunda.
  disclaimer: { ...type.data, color: color.kulKoyu, fontSize: 10 },
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
