import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, font, space } from '@/lib/theme';
import { t } from '@/lib/i18n';

/**
 * Sekme etiketleri ikon yerine küçük mono metin.
 * Sebep: ikonlar bu kategoride hep aynı (ay, yıldız, kart) ve jenerik
 * duruyor. Mono etiketler defter kaydı estetiğiyle tutarlı ve ayırt edici.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: color.telve },
        tabBarStyle: {
          backgroundColor: color.telve,
          borderTopColor: color.cizgi,
          borderTopWidth: 1,
          // Sabit 62px yükseklik Android'in üç tuşlu gezinme alanını hesaba
          // katmıyordu; etiketler sistem çubuğunun altında kalıyordu.
          height: 62 + insets.bottom,
          paddingTop: space.xs,
          paddingBottom: insets.bottom + space.xs,
        },
        tabBarActiveTintColor: color.bakir,
        tabBarInactiveTintColor: color.kulKoyu,
        tabBarLabelStyle: {
          fontFamily: font.monoRegular,
          fontSize: 11,
          letterSpacing: 0.8,
        },
        tabBarIcon: () => null,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('ana.bugun') }} />
      <Tabs.Screen name="journal" options={{ title: 'defter' }} />
      <Tabs.Screen name="profile" options={{ title: t('profil.eyebrow') }} />
    </Tabs>
  );
}
