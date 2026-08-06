import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { color, font } from '@/lib/theme';

/**
 * Sekme etiketleri ikon yerine küçük mono metin.
 * Sebep: ikonlar bu kategoride hep aynı (ay, yıldız, kart) ve jenerik
 * duruyor. Mono etiketler defter kaydı estetiğiyle tutarlı ve ayırt edici.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: color.telve },
        tabBarStyle: {
          backgroundColor: color.telve,
          borderTopColor: color.cizgi,
          borderTopWidth: 1,
          height: 62,
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
      <Tabs.Screen name="index" options={{ title: 'bugün' }} />
      <Tabs.Screen name="journal" options={{ title: 'defter' }} />
      <Tabs.Screen name="profile" options={{ title: 'profil' }} />
    </Tabs>
  );
}
