/**
 * TelveRing — uygulamanın imza öğesi.
 *
 * Tek bir şekil, iki kayıtta iş görüyor:
 *   mode="ritual" → fal üretilirken fincan dairesi telveyle dolar (yavaş, sıcak)
 *   mode="ledger" → Kader Günlüğü'nde isabet oranı kadranı (sabit, klinik, çini mavi)
 *
 * Aynı geometrinin iki farklı sesle konuşması, ürünün "kehanet mistik / hesabı
 * klinik" tezinin görsel karşılığı. Tüm cesaret bu öğede harcanıyor; etrafındaki
 * her şey sessiz kalıyor.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Path,
  Skia,
  SweepGradient,
  Turbulence,
  vec,
} from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { color, motion } from '@/lib/theme';

type Props = {
  size?: number;
  /** 0-1. ritual modunda dolum, ledger modunda isabet oranı. */
  value: number;
  mode?: 'ritual' | 'ledger';
  /** ritual modunda nefes alma efekti — beklerken ekranın canlı durması için */
  breathing?: boolean;
};

export function TelveRing({ size = 260, value, mode = 'ritual', breathing = true }: Props) {
  const stroke = mode === 'ritual' ? 14 : 6;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;

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

  // Yay yolu: 12 yönünden saat yönünde. Fincan sapı referansı da 12'de.
  const arc = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const sweep = 360 * fill.value;
    p.addArc({ x: stroke / 2, y: stroke / 2, width: r * 2, height: r * 2 }, -90, sweep);
    return p;
  }, [fill]);

  const scale = useDerivedValue(() => [{ scale: breathe.value }], [breathe]);

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={{ flex: 1 }}>
        <Group transform={scale} origin={vec(cx, cy)}>
          {/* Boş fincan kenarı */}
          <Circle cx={cx} cy={cy} r={r} style="stroke" strokeWidth={stroke} color={color.cizgi} />

          {/* Dolan telve */}
          <Path path={arc} style="stroke" strokeWidth={stroke} strokeCap="round">
            {mode === 'ritual' ? (
              <SweepGradient
                c={vec(cx, cy)}
                colors={[color.bakirSolgun, color.bakir, '#E39A63', color.bakirSolgun]}
              />
            ) : (
              <SweepGradient c={vec(cx, cy)} colors={[color.cini, '#5A8FC7']} />
            )}
            {/* Telve dokusu: düz renk yerine tanecikli. Ritüelde fincanın içindeki
                tortuyu, defterde sadeliği korumak için sadece ritual modunda. */}
            {mode === 'ritual' && <Turbulence freqX={0.9} freqY={0.9} octaves={3} seed={7} />}
          </Path>
        </Group>
      </Canvas>
    </View>
  );
}
