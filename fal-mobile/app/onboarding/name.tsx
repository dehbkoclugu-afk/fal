import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useDraft } from '@/lib/store';
import { color, space, type } from '@/lib/theme';
import { Eyebrow } from '@/components/Eyebrow';
import { t } from '@/lib/i18n';

/** İlk kanca: isim. Kişiselleşme burada başlıyor, kayıt ekranı yok. */
export default function Name() {
  const router = useRouter();
  const set = useDraft((s) => s.set);
  const [value, setValue] = useState('');

  return (
    <Screen>
      <Eyebrow style={styles.eyebrow}>{t('ob.isim.eyebrow')}</Eyebrow>
      <Text style={styles.q}>{t('ob.isim.soru')}</Text>
      <Text style={styles.sub}>{t('ob.isim.aciklama')}</Text>

      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={t('ob.isim.placeholder')}
        placeholderTextColor={color.kulKoyu}
        autoFocus
        autoCapitalize="words"
        maxLength={24}
        style={styles.input}
        returnKeyType="done"
        onSubmitEditing={() => value.trim() && router.push('/onboarding/birth')}
      />

      <View style={styles.spacer} />
      <Button
        label={t('ortak.devam')}
        disabled={value.trim().length < 2}
        onPress={() => {
          set({ firstName: value.trim() });
          router.push('/onboarding/birth');
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
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.bakir,
  },
  spacer: { flex: 1 },
});
