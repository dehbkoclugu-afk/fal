import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import { color } from '@/lib/theme';

export type RitualKind = 'coffee' | 'tarot' | 'natal' | 'dream' | 'daily';

function TarotGeometry() {
  return (
    <G>
      <Rect x="33" y="24" width="72" height="100" rx="7" fill={color.cezve} stroke={color.bakir} strokeWidth="2" transform="rotate(-9 69 74)" />
      <Rect x="37" y="22" width="72" height="100" rx="7" fill={color.cezveUst} stroke={color.cizgi} strokeWidth="2" transform="rotate(8 73 72)" />
      <Rect x="34" y="20" width="72" height="104" rx="7" fill={color.cezve} stroke={color.bakir} strokeWidth="2" />
      <Rect x="41" y="27" width="58" height="90" rx="4" fill="none" stroke={color.bakirSolgun} />
      <Circle cx="70" cy="72" r="18" fill="none" stroke={color.cini} strokeWidth="1.5" />
      {[0, 45, 90, 135].map((angle) => (
        <Line key={angle} x1="50" y1="72" x2="90" y2="72" stroke={color.bakir} strokeWidth="1" transform={`rotate(${angle} 70 72)`} />
      ))}
      <Circle cx="70" cy="72" r="5" fill={color.bakir} />
      <Circle cx="51" cy="39" r="2" fill={color.cini} />
      <Circle cx="89" cy="104" r="2" fill={color.cini} />
    </G>
  );
}

function NatalGeometry() {
  return (
    <G>
      <Circle cx="70" cy="72" r="54" fill={color.cezve} stroke={color.bakir} strokeWidth="2" />
      <Circle cx="70" cy="72" r="42" fill="none" stroke={color.cizgi} />
      <Circle cx="70" cy="72" r="25" fill="none" stroke={color.cini} strokeOpacity="0.7" />
      {Array.from({ length: 12 }).map((_, i) => (
        <Line key={i} x1="70" y1="18" x2="70" y2="30" stroke={color.kulKoyu} transform={`rotate(${i * 30} 70 72)`} />
      ))}
      <Path d="M46 85 L82 38 L94 91 L47 56 L91 56 Z" fill="none" stroke={color.cini} strokeOpacity="0.75" />
      <Circle cx="50" cy="51" r="4" fill={color.bakir} />
      <Circle cx="87" cy="45" r="3" fill={color.porselen} />
      <Circle cx="95" cy="79" r="4" fill={color.kiremit} />
      <Circle cx="61" cy="101" r="3" fill={color.porselen} />
      <Circle cx="43" cy="82" r="3" fill={color.bakir} />
    </G>
  );
}

function DreamGeometry() {
  return (
    <G>
      <Circle cx="70" cy="72" r="55" fill={color.cezve} stroke={color.cini} strokeOpacity="0.65" />
      <Path d="M78 35 A39 39 0 1 0 80 108 A31 31 0 1 1 78 35 Z" fill={color.porselen} />
      <Circle cx="35" cy="42" r="2.2" fill={color.bakir} />
      <Circle cx="105" cy="51" r="1.8" fill={color.porselen} />
      <Circle cx="103" cy="94" r="2.4" fill={color.bakir} />
      <Circle cx="42" cy="106" r="1.5" fill={color.cini} />
      <Line x1="28" y1="72" x2="38" y2="72" stroke={color.cini} />
      <Line x1="102" y1="72" x2="113" y2="72" stroke={color.cini} />
    </G>
  );
}

function CoffeeGeometry() {
  return (
    <G>
      <Path d="M33 47 H92 V82 C92 101 79 112 62 112 C45 112 33 101 33 82 Z" fill={color.cezve} stroke={color.bakir} strokeWidth="2" />
      <Path d="M92 58 C115 56 116 91 92 91" fill="none" stroke={color.bakir} strokeWidth="4" />
      <EllipseLike />
      <Path d="M49 67 C58 61 69 75 78 66 C72 84 56 88 49 67 Z" fill={color.kulKoyu} opacity="0.7" />
      <Line x1="26" y1="118" x2="106" y2="118" stroke={color.cizgi} strokeWidth="2" />
    </G>
  );
}

function EllipseLike() {
  return <Path d="M33 47 C33 37 92 37 92 47 C92 57 33 57 33 47 Z" fill={color.telve} stroke={color.bakir} strokeWidth="2" />;
}

export function RitualVisual({ kind, size = 180 }: { kind: RitualKind; size?: number }) {
  const visual = kind === 'tarot'
    ? <TarotGeometry />
    : kind === 'natal'
      ? <NatalGeometry />
      : kind === 'dream' || kind === 'daily'
        ? <DreamGeometry />
        : <CoffeeGeometry />;
  return (
    <View style={[styles.wrap, { width: size, height: size }]} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 140 140">{visual}</Svg>
    </View>
  );
}

export function TarotCardBack({ width, picked = false }: { width: number; picked?: boolean }) {
  const height = width * 1.6;
  return (
    <View style={{ width, height }} pointerEvents="none">
      <Svg width={width} height={height} viewBox="0 0 70 112">
        <Rect x="1" y="1" width="68" height="110" rx="6" fill={picked ? color.cezveUst : color.cezve} stroke={picked ? color.bakir : color.cizgi} strokeWidth="2" />
        <Rect x="7" y="7" width="56" height="98" rx="4" fill="none" stroke={color.bakirSolgun} />
        <Circle cx="35" cy="56" r="18" fill="none" stroke={color.cini} strokeOpacity="0.75" />
        {[0, 45, 90, 135].map((angle) => (
          <Line key={angle} x1="14" y1="56" x2="56" y2="56" stroke={color.bakir} strokeWidth="1" transform={`rotate(${angle} 35 56)`} />
        ))}
        <Circle cx="35" cy="56" r="5" fill={color.bakir} />
        <Circle cx="17" cy="20" r="2" fill={color.cini} />
        <Circle cx="53" cy="92" r="2" fill={color.cini} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { alignItems: 'center', justifyContent: 'center' } });
