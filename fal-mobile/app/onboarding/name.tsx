import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useDraft } from '@/lib/store';
import { color, space, type } from '@/lib/theme';

/** İlk kanca: isim. Kişiselleşme burada başlıyor, kayıt ekranı yok. */
export default function Name() {
  const router = useRouter();
  const set = useDraft((s) => s.set);
  const [value, setValue] = useState('');

  return (
    <Screen>
      <Text style={styles.eyebrow}>Başlarken</Text>
      <Text style={styles.q}>Sana ne diyeyim?</Text>
      <Text style={styles.sub}>
        Yorumlarda adını kullanacağım. Soyadına, e-postaya, şifreye gerek yok.
      </Text>

      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="adın"
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
        label="Devam et"
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
