import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { color } from '@/lib/theme';
import { useDraft } from '@/lib/store';

/**
 * Giriş kapısı. Onboarding'i bitiren kullanıcı doğrudan ana ekrana gider.
 *
 * hydrated beklenmek zorunda: kalıcı depo asenkron okunuyor, ilk karede
 * onboarded her zaman false. Beklemeden yönlendirilirse mevcut kullanıcı
 * uygulamayı her açtığında bir an onboarding'e düşer.
 */
export default function Index() {
  const hydrated = useDraft((s) => s.hydrated);
  const onboarded = useDraft((s) => s.onboarded);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: color.telve, justifyContent: 'center' }}>
        <ActivityIndicator color={color.bakir} />
      </View>
    );
  }
  return <Redirect href={onboarded ? '/(tabs)' : '/onboarding/name'} />;
}
