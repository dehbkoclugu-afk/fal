import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';

import type { NatalChart, NatalChartBody } from '@/lib/api';
import { Eyebrow } from '@/components/Eyebrow';
import { color, radius, space, type } from '@/lib/theme';
import { t } from '@/lib/i18n';

const SIZE = 328;
const C = SIZE / 2;
const R = 150;
const BODY_R = 104;
const ASPECT_R = 82;

const SIGNS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
const BODY_GLYPH: Record<string, string> = {
  sun: '☉', moon: '☽', mercury: '☿', venus: '♀', mars: '♂',
  jupiter: '♃', saturn: '♄', uranus: '♅', neptune: '♆', pluto: '♇',
  node: '☊', chiron: '⚷',
};

function point(lon: number, radius: number) {
  const a = ((lon - 90) * Math.PI) / 180;
  return { x: C + Math.cos(a) * radius, y: C + Math.sin(a) * radius };
}

export function NatalChartWheel({ chart, compact = false }: { chart: NatalChart; compact?: boolean }) {
  const { width } = useWindowDimensions();
  const renderSize = Math.min(SIZE, width - space.lg * 2 - space.md * 2);
  const bodies = useMemo(() => Object.values(chart.bodies), [chart.bodies]);
  const [selectedKey, setSelectedKey] = useState('sun');
  const selected: NatalChartBody | undefined = chart.bodies[selectedKey] ?? bodies[0];
  const timeUnknown = !!chart.meta?.time_unknown;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Eyebrow style={styles.label}>{t('harita.hesaplanmis')}</Eyebrow>
        <Text style={styles.engine}>{chart.meta?.ephe === 'swieph' ? 'SWISS EPHEMERIS' : 'MOSHIER'}</Text>
      </View>

      <View style={styles.wheelWrap} accessibilityLabel={t('harita.erisilebilir')}>
        <Svg width={renderSize} height={renderSize} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Circle cx={C} cy={C} r={R} fill={color.cezve} stroke={color.cizgi} strokeWidth={1} />
          <Circle cx={C} cy={C} r={126} fill="none" stroke={color.bakir} strokeOpacity={0.42} />
          <Circle cx={C} cy={C} r={ASPECT_R} fill="none" stroke={color.cizgi} />

          {SIGNS.map((glyph, i) => {
            const edge = point(i * 30, R);
            const inner = point(i * 30, 126);
            const label = point(i * 30 + 15, 138);
            return (
              <G key={glyph}>
                <Line x1={inner.x} y1={inner.y} x2={edge.x} y2={edge.y} stroke={color.cizgi} strokeOpacity={0.7} />
                <SvgText x={label.x} y={label.y + 5} fill={color.kul} fontSize={15} textAnchor="middle">{glyph}</SvgText>
              </G>
            );
          })}

          {!timeUnknown && chart.houses.map((cusp, i) => {
            const a = point(cusp, ASPECT_R);
            const b = point(cusp, 126);
            const n = point(cusp + 7, 92);
            return (
              <G key={`h${i}`}>
                <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color.cini} strokeOpacity={0.68} />
                <SvgText x={n.x} y={n.y + 3} fill={color.kulKoyu} fontSize={8} textAnchor="middle">{i + 1}</SvgText>
              </G>
            );
          })}

          {chart.aspects.filter((a) => a.strength >= 0.55).slice(0, 14).map((a, i) => {
            const first = chart.bodies[a.a];
            const second = chart.bodies[a.b];
            if (!first || !second) return null;
            const p1 = point(first.lon, ASPECT_R);
            const p2 = point(second.lon, ASPECT_R);
            const hard = ['square', 'opposition', 'conjunction'].includes(a.kind);
            return <Line key={`${a.a}-${a.b}-${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={hard ? color.kiremit : color.cini} strokeOpacity={0.22 + a.strength * 0.48} />;
          })}

          {bodies.map((b, index) => {
            const p = point(b.lon, BODY_R + (index % 2 ? 10 : 0));
            const on = b.key === selected?.key;
            return (
              <G key={b.key}>
                {on ? <Circle cx={p.x} cy={p.y} r={13} fill={color.bakir} /> : null}
                <SvgText x={p.x} y={p.y + 5} fill={on ? color.telve : color.porselen} fontSize={17} textAnchor="middle">
                  {BODY_GLYPH[b.key] ?? '•'}
                </SvgText>
              </G>
            );
          })}

          <SvgText x={C} y={C - 5} fill={color.kulKoyu} fontSize={9} textAnchor="middle">{t('harita.yukselen')}</SvgText>
          <SvgText x={C} y={C + 14} fill={color.porselen} fontSize={14} textAnchor="middle">
            {timeUnknown ? '—' : `${SIGNS[Math.floor(chart.ascendant / 30)]} ${Math.floor(chart.ascendant % 30)}°`}
          </SvgText>
        </Svg>
      </View>

      {!compact && <View style={styles.bodyGrid}>
        {bodies.slice(0, 10).map((b) => {
          const on = b.key === selected?.key;
          return (
            <Pressable
              key={b.key}
              onPress={() => setSelectedKey(b.key)}
              style={[styles.bodyChip, on && styles.bodyChipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.bodyGlyph, on && styles.bodyGlyphOn]}>{BODY_GLYPH[b.key] ?? '•'}</Text>
              <Text style={[styles.bodyName, on && styles.bodyNameOn]}>{b.name_tr}</Text>
            </Pressable>
          );
        })}
      </View>}

      {!compact && selected ? (
        <View style={styles.detail}>
          <View style={{ flex: 1 }}>
            <Eyebrow style={styles.detailKey}>{selected.name_tr}</Eyebrow>
            <Text style={styles.detailValue}>
              {selected.sign_tr} · {selected.degree_in_sign.toFixed(1)}°
              {selected.house ? ` · ${selected.house}. ev` : ''}
              {selected.retrograde ? ` · ${t('harita.retro')}` : ''}
            </Text>
          </View>
          <Text style={styles.detailGlyph}>{BODY_GLYPH[selected.key] ?? '•'}</Text>
        </View>
      ) : null}

      {!compact && timeUnknown ? <Text style={styles.note}>{t('harita.saatYok')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.lg, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: color.cizgi, backgroundColor: color.cezve },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { ...type.eyebrow, color: color.bakir },
  engine: { ...type.data, color: color.kulKoyu, fontSize: 8, letterSpacing: 0.8 },
  wheelWrap: { alignItems: 'center', marginTop: space.sm },
  bodyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.sm },
  bodyChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: color.cizgi, borderRadius: radius.full, paddingVertical: 5, paddingHorizontal: 8 },
  bodyChipOn: { borderColor: color.bakir, backgroundColor: color.cezveUst },
  bodyGlyph: { color: color.kul, fontSize: 14 },
  bodyGlyphOn: { color: color.bakir },
  bodyName: { ...type.data, color: color.kul, fontSize: 9 },
  bodyNameOn: { color: color.porselen },
  detail: { flexDirection: 'row', alignItems: 'center', marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: color.cizgi },
  detailKey: { ...type.eyebrow, color: color.bakir },
  detailValue: { ...type.dataStrong, color: color.porselen, marginTop: 3 },
  detailGlyph: { color: color.bakir, fontSize: 28 },
  note: { ...type.data, color: color.kulKoyu, fontSize: 10, lineHeight: 15, marginTop: space.md },
});
