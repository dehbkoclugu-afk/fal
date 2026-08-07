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
import citiesData from '@/data/cities.json';
import { Eyebrow } from '@/components/Eyebrow';
import { t } from '@/lib/i18n';

type City = { name: string; lat: number; lon: number };
const CITIES = citiesData as City[];

// İlk açılışta gösterilen kısayollar — nüfusa göre, arama yapmadan seçilebilsin.
// i18n-ignore: bunlar çeviri metni değil, data/cities.json'a arama anahtarı
const POPULER = ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana'];
const ONE_CIKANLAR = POPULER.map((n) => CITIES.find((c) => c.name === n)!).filter(Boolean);

export default function Place() {
  const router = useRouter();
  const set = useDraft((s) => s.set);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<City | null>(null);

  const results = useMemo(() => {
    if (!q.trim()) return ONE_CIKANLAR;
    const n = q.trim().toLocaleLowerCase('tr');
    // Önce baştan eşleşenler, sonra içinde geçenler: "maraş" yazan kullanıcı
    // Kahramanmaraş'ı bulabilmeli.
    const bas = CITIES.filter((c) => c.name.toLocaleLowerCase('tr').startsWith(n));
    const ic = CITIES.filter(
      (c) => !bas.includes(c) && c.name.toLocaleLowerCase('tr').includes(n),
    );
    return [...bas, ...ic].slice(0, 8);
  }, [q]);

  return (
    <Screen>
      <Eyebrow style={styles.eyebrow}>{t('ob.yer.eyebrow')}</Eyebrow>
      <Text style={styles.q}>{t('ob.yer.soru')}</Text>
      <Text style={styles.sub}>{t('ob.yer.aciklama')}</Text>

      <TextInput
        value={picked ? picked.name : q}
        onChangeText={(t) => {
          setPicked(null);
          setQ(t);
        }}
        placeholder={t('ob.yer.ara')}
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
          renderItem={({ item }: { item: City }) => (
            <Pressable onPress={() => setPicked(item)} style={styles.item}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemCoord}>
                {item.lat.toFixed(2)}° {item.lon.toFixed(2)}°
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>{t('ob.yer.bulunamadi')}</Text>
          }
        />
      )}

      <View style={styles.spacer} />
      <Button
        label={t('ob.yer.devam')}
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
