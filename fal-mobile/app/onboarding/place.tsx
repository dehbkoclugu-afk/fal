import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useDraft } from '@/lib/store';
import { color, space, type } from '@/lib/theme';

/**
 * Doğum yeri.
 *
 * Bootstrap kararı: harici geocoding API'ye para vermiyoruz. Türkiye'nin 81 ili
 * gömülü liste olarak yeterli — hedef pazar TR. Uluslararası pazara açılınca
 * Nominatim (ücretsiz, rate limitli) veya Photon eklenir.
 */
const CITIES: { name: string; lat: number; lon: number }[] = [
  { name: 'İstanbul', lat: 41.0082, lon: 28.9784 },
  { name: 'Ankara', lat: 39.9334, lon: 32.8597 },
  { name: 'İzmir', lat: 38.4237, lon: 27.1428 },
  { name: 'Bursa', lat: 40.1826, lon: 29.0665 },
  { name: 'Antalya', lat: 36.8969, lon: 30.7133 },
  { name: 'Adana', lat: 37.0, lon: 35.3213 },
  { name: 'Konya', lat: 37.8746, lon: 32.4932 },
  { name: 'Gaziantep', lat: 37.0662, lon: 37.3833 },
  { name: 'Kayseri', lat: 38.7312, lon: 35.4787 },
  { name: 'Trabzon', lat: 41.0027, lon: 39.7168 },
  { name: 'Diyarbakır', lat: 37.9144, lon: 40.2306 },
  { name: 'Samsun', lat: 41.2867, lon: 36.33 },
  { name: 'Eskişehir', lat: 39.7767, lon: 30.5206 },
  { name: 'Erzurum', lat: 39.9, lon: 41.27 },
  { name: 'Van', lat: 38.4891, lon: 43.4089 },
  // TODO: 81 ilin tamamını data/cities.json olarak ekle
];

export default function Place() {
  const router = useRouter();
  const set = useDraft((s) => s.set);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<(typeof CITIES)[number] | null>(null);

  const results = useMemo(() => {
    if (!q.trim()) return CITIES.slice(0, 6);
    const n = q.toLocaleLowerCase('tr');
    return CITIES.filter((c) => c.name.toLocaleLowerCase('tr').startsWith(n)).slice(0, 8);
  }, [q]);

  return (
    <Screen>
      <Text style={styles.eyebrow}>2 / 3 · doğum verisi</Text>
      <Text style={styles.q}>Nerede doğdun?</Text>
      <Text style={styles.sub}>Yükselen burcun doğduğun yerin enlemine göre değişiyor.</Text>

      <TextInput
        value={picked ? picked.name : q}
        onChangeText={(t) => {
          setPicked(null);
          setQ(t);
        }}
        placeholder="şehir ara"
        placeholderTextColor={color.kulKoyu}
        autoFocus
        style={styles.input}
      />

      {!picked && (
        <FlatList
          data={results}
          keyExtractor={(c) => c.name}
          keyboardShouldPersistTaps="handled"
          style={{ marginTop: space.md }}
          renderItem={({ item }) => (
            <Pressable onPress={() => setPicked(item)} style={styles.item}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemCoord}>
                {item.lat.toFixed(2)}° {item.lon.toFixed(2)}°
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>Bu isimde şehir yok. Yazımı kontrol et.</Text>
          }
        />
      )}

      <View style={styles.spacer} />
      <Button
        label="Haritamı çiz"
        disabled={!picked}
        onPress={() => {
          set({ placeName: picked!.name, lat: picked!.lat, lon: picked!.lon, tzName: 'Europe/Istanbul' });
          router.push('/onboarding/reveal');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...type.eyebrow, color: color.kul, marginTop: space.xl },
  q: { ...type.title, color: color.porselen, marginTop: space.sm },
  sub: { ...type.body, color: color.kul, marginTop: space.sm },
  input: {
    ...type.oracleLead,
    color: color.porselen,
    marginTop: space.xl,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.bakir,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.cizgi,
  },
  itemName: { ...type.bodyStrong, color: color.porselen },
  itemCoord: { ...type.data, color: color.kulKoyu, fontSize: 11 },
  empty: { ...type.body, color: color.kul, paddingVertical: space.lg },
  spacer: { flex: 1 },
});
