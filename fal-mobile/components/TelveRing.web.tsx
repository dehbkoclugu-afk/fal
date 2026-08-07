/**
 * TelveRing — web sürümü.
 *
 * Neden ayrı dosya: @shopify/react-native-skia web'de CanvasKit WASM'ı
 * yüklenmeden çalışmıyor (`Skia.Path` undefined → reveal ekranı beyaz kalıyor).
 * WASM ~6 MB; web PWA'da açılış süresi doğrudan dönüşüme yazıldığı için onu
 * indirmek yerine aynı geometriyi react-native-svg ile çiziyoruz.
 *
 * Metro `.web.tsx` uzantısını web hedefinde otomatik seçiyor — native tarafta
 * Skia sürümü (telve dokusu, Turbulence) olduğu gibi kalıyor.
 *
 * Görsel fark: web'de tanecikli doku yok, gradyan var. Kabul edilen ödün;
 * dolum, nefes ve iki kayıt (ritual/ledger) korunuyor.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { color, motion } from '@/lib/theme';

const ACircle = Animated.createAnimatedComponent(Circle);

type Props = {
  size?: number;
  /** 0-1. ritual modunda dolum, ledger modunda isabet oranı. */
  value: number;
  mode?: 'ritual' | 'ledger';
  breathing?: boolean;
};

export function TelveRing({ size = 260, value, mode = 'ritual', breathing = true }: Props) {
  const stroke = mode === 'ritual' ? 14 : 6;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const cevre = 2 * Math.PI * r;

  const fill = useSharedValue(0);
  const breathe = useSharedValue(1);

  useEffect(() => {
    fill.value = withTiming(Math.max(0, Math.min(1, value)), {
      duration: mode === 'ritual' ? motion.ritual : motion.settle,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, mode]);

  useEffect(() => {
    if (mode !== 'ritual' || !breathing) return;
    breathe.value = withRepeat(
      withTiming(1.03, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [mode, breathing]);

  // Dolum: strokeDashoffset ile. Yay 12 yönünden başlasın diye -90° döndürülüyor.
  const props = useAnimatedProps(() => ({
    strokeDashoffset: cevre * (1 - fill.value),
  }));

  const kabuk = useAnimatedProps(() => ({
    // Nefes efekti: yarıçapı oynatmak yerine ölçek, SVG'de r'yi animasyonlamak
    // her karede yeniden layout tetikliyor.
    transform: [{ scale: breathe.value }] as any,
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[{ flex: 1 }, kabuk as any]}>
        <Svg width={size} height={size}>
          <Defs>
            {/* Diziye açıkça yazılıyor: react-native-svg'nin LinearGradient'ı
                children olarak Stop dizisi bekliyor, Fragment kabul etmiyor. */}
            <LinearGradient id="telve" x1="0" y1="0" x2="1" y2="1">
              {(mode === 'ritual'
                ? [
                    { o: '0', c: color.bakirSolgun },
                    { o: '0.5', c: color.bakir },
                    { o: '1', c: '#E39A63' },
                  ]
                : [
                    { o: '0', c: color.cini },
                    { o: '1', c: '#5A8FC7' },
                  ]
              ).map((s) => (
                <Stop key={s.o} offset={s.o} stopColor={s.c} />
              ))}
            </LinearGradient>
          </Defs>

          {/* Boş fincan kenarı */}
          <Circle cx={c} cy={c} r={r} stroke={color.cizgi} strokeWidth={stroke} fill="none" />

          {/* Dolan telve */}
          <ACircle
            cx={c}
            cy={c}
            r={r}
            stroke="url(#telve)"
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${cevre} ${cevre}`}
            animatedProps={props}
            transform={`rotate(-90 ${c} ${c})`}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}
