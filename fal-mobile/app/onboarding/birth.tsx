import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useDraft } from '@/lib/store';
import { color, space, type } from '@/lib/theme';

/**
 * Doğum tarihi + saat.
 *
 * "Bilmiyorum" seçeneği şart: kullanıcıların yaklaşık üçte biri doğum saatini
 * bilmiyor ve zorunlu alan yaparsan onları burada kaybediyorsun. Backend
 * time_known=false geldiğinde ev konumlarını yorumdan çıkarıyor.
 */
export default function Birth() {
  const router = useRouter();
  const set = useDraft((s) => s.set);
  const [date, setDate] = useState('');   // GG.AA.YYYY
  const [time, setTime] = useState('');   // SS:DD
  const [unknown, setUnknown] = useState(false);

  const dateOk = /^\d{2}\.\d{2}\.\d{4}$/.test(date);
  const timeOk = unknown || /^\d{2}:\d{2}$/.test(time);

  const maskDate = (t: string) => {
    const d = t.replace(/\D/g, '').slice(0, 8);
    const parts = [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean);
    setDate(parts.join('.'));
  };
  const maskTime = (t: string) => {
    const d = t.replace(/\D/g, '').slice(0, 4);
    setTime(d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d);
  };

  const next = () => {
    const [dd, mm, yyyy] = date.split('.');
    set({
      birthDate: `${yyyy}-${mm}-${dd}`,
      birthTime: unknown ? '12:00' : time,
      timeKnown: !unknown,
    });
    router.push('/onboarding/place');
  };

  return (
    <Screen>
      <Text style={styles.eyebrow}>1 / 3 · doğum verisi</Text>
      <Text style={styles.q}>Ne zaman doğdun?</Text>
      <Text style={styles.sub}>
        Gezegen konumlarını gerçek gökyüzü verisinden hesaplıyorum, o yüzden tarih ve
        saat gerekiyor.
      </Text>

      <Text style={styles.label}>Tarih</Text>
      <TextInput
        value={date}
        onChangeText={maskDate}
        placeholder="14.06.1993"
        placeholderTextColor={color.kulKoyu}
        keyboardType="number-pad"
        autoFocus
        style={styles.input}
      />

      <Text style={styles.label}>Saat</Text>
      <TextInput
        value={unknown ? '' : time}
        onChangeText={maskTime}
        placeholder={unknown ? 'bilinmiyor' : '04:30'}
        placeholderTextColor={color.kulKoyu}
        keyboardType="number-pad"
        editable={!unknown}
        style={[styles.input, unknown && styles.inputOff]}
      />

      <Pressable onPress={() => setUnknown((v) => !v)} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked: unknown }}>
        <View style={[styles.box, unknown && styles.boxOn]} />
        <Text style={styles.checkText}>Doğum saatimi bilmiyorum</Text>
      </Pressable>

      <View style={styles.spacer} />
      <Button label="Devam et" disabled={!dateOk || !timeOk} onPress={next} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...type.eyebrow, color: color.kul, marginTop: space.xl },
  q: { ...type.title, color: color.porselen, marginTop: space.sm },
  sub: { ...type.body, color: color.kul, marginTop: space.sm },
  label: { ...type.eyebrow, color: color.kulKoyu, marginTop: space.xl },
  input: {
    ...type.oracleLead,
    color: color.porselen,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.cizgi,
  },
  inputOff: { color: color.kulKoyu },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg },
  box: { width: 18, height: 18, borderWidth: 1, borderColor: color.kul },
  boxOn: { backgroundColor: color.bakir, borderColor: color.bakir },
  checkText: { ...type.body, color: color.kul },
  spacer: { flex: 1 },
});
