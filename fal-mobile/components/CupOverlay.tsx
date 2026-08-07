/**
 * CupOverlay — fotoğraf üzerinde tespit edilen telve bölgelerini işaretler.
 *
 * Bu bileşen ürünün en önemli ekranı. "Uygulama fotoğrafa gerçekten baktı"
 * hissini üreten tek şey burada: yorum metni bir bölgeye atıf yapıyor,
 * kullanıcı o bölgeye dokunuyor, fotoğrafta yeri işaretleniyor.
 *
 * Paylaşılan ekran görüntüsü de bu olacak — o yüzden markerlar temiz ve
 * okunur olmalı, fotoğrafı boğmamalı.
 *
 * Backend'den gelen bbox koordinatları, cup_vision.py'nin çalıştığı ölçekte
 * (uzun kenar 1280'e indirilmiş hâl). srcWidth/srcHeight ile ölçekliyoruz.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';

import { color, radius, space, type } from '@/lib/theme';
import type { CupMarker } from '@/lib/api';
import { Eyebrow } from '@/components/Eyebrow';

type Props = {
  photoUri: string;
  markers: CupMarker[];
  /** cup_vision'ın işlediği görüntü boyutu (extra_json.cup.quality içinden) */
  srcWidth: number;
  srcHeight: number;
  /** Metinde geçen bölge id'si — yorumdan tıklandığında dışarıdan seçilir */
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
};

const REGION_TR: Record<string, string> = {
  rim: 'ağız — çok yakın',
  upper: 'üst — yakın günler',
  middle: 'orta — şu an',
  lower: 'alt — süregelen',
  bottom: 'dip — kalıcı, geçmiş',
};

const SIDE_TR: Record<string, string> = {
  handle: 'sap tarafı — sen',
  opposite: 'karşı taraf — başkaları',
  left: 'sol — geride kalan',
  right: 'sağ — gelen',
};

export function CupOverlay({
  photoUri,
  markers,
  srcWidth,
  srcHeight,
  selectedId,
  onSelect,
}: Props) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const scale = box.w > 0 ? box.w / srcWidth : 0;

  const tap = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect?.(selectedId === id ? null : id);
  };

  const active = markers.find((m) => m.id === selectedId);

  return (
    <View>
      <View
        style={styles.frame}
        onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        <Image
          source={{ uri: photoUri }}
          style={{ width: '100%', aspectRatio: srcWidth / srcHeight }}
          contentFit="cover"
          transition={220}
        />

        {scale > 0 &&
          markers.map((m, i) => {
            const [x, y, w, h] = m.bbox;
            const cx = (x + w / 2) * scale;
            const cy = (y + h / 2) * scale;
            const d = Math.max(28, Math.min(w, h) * scale * 1.5);
            const on = selectedId === m.id;
            return (
              <Animated.View
                key={m.id}
                entering={FadeIn.delay(200 + i * 130).duration(420)}
                style={[
                  styles.markerWrap,
                  { left: cx - d / 2, top: cy - d / 2, width: d, height: d },
                ]}
              >
                <Pressable
                  onPress={() => tap(m.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${REGION_TR[m.region] ?? m.region} bölgesi`}
                  style={[styles.marker, { width: d, height: d, borderRadius: d / 2 }, on && styles.markerOn]}
                >
                  <Text style={[styles.markerNo, on && { color: color.telve }]}>{i + 1}</Text>
                </Pressable>
              </Animated.View>
            );
          })}
      </View>

      {/* Seçili bölgenin konum anlamı. Fal metnine değil, geleneksel şemaya dayanır. */}
      {active ? (
        <Animated.View entering={FadeIn.duration(180)} style={styles.caption}>
          <Eyebrow style={styles.captionKey}>{REGION_TR[active.region] ?? active.region}</Eyebrow>
          <Text style={styles.captionVal}>{SIDE_TR[active.side] ?? active.side}</Text>
        </Animated.View>
      ) : (
        <Text style={styles.hint}>İşaretlere dokun, fincanın neresi olduğunu göster</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.cezve,
    borderWidth: 1,
    borderColor: color.cizgi,
  },
  markerWrap: { position: 'absolute' },
  marker: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: color.bakir,
    backgroundColor: 'rgba(22,16,14,0.55)',
  },
  markerOn: { backgroundColor: color.bakir, borderColor: color.porselen },
  markerNo: { ...type.dataStrong, color: color.bakir, fontSize: 12 },
  caption: {
    marginTop: space.md,
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderTopColor: color.cizgi,
  },
  captionKey: { ...type.eyebrow, color: color.bakir },
  captionVal: { ...type.data, color: color.kul, marginTop: 2 },
  hint: { ...type.data, color: color.kulKoyu, marginTop: space.md, fontSize: 11 },
});
