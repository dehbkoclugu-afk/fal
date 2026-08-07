import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import {
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
} from '@expo-google-fonts/newsreader';
import { Karla_400Regular, Karla_500Medium, Karla_700Bold } from '@expo-google-fonts/karla';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { dilSec, uygulaYon } from '@/lib/i18n';
import { hydrateDraft, useDraft } from '@/lib/store';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';

import { color } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 60_000 } },
});

export default function RootLayout() {
  const [ready] = useFonts({
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium,
    Karla_400Regular,
    Karla_500Medium,
    Karla_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  // Dili açılışta bir kez belirle. RTL (Arapça) düzen yönünü değiştiriyor ve
  // native'de bu ancak yeniden başlatmayla uygulanıyor — o yüzden render
  // başlamadan önce yapılmak zorunda.
  const [dilHazir, setDilHazir] = useState(false);
  useEffect(() => {
    (async () => {
      const kayitli = await AsyncStorage.getItem('dil');
      const d = dilSec(kayitli ?? undefined);
      uygulaYon(d.rtl);
      setDilHazir(true);
    })();
  }, []);

  // Kalıcı taslağı depodan oku. Splash yazı tipleriyle birlikte bunu da
  // bekliyor: okunmadan yönlendirme yapılırsa mevcut kullanıcı bir kare
  // boyunca onboarding'e düşer.
  useEffect(() => {
    hydrateDraft();
  }, []);
  const hydrated = useDraft((s) => s.hydrated);

  useEffect(() => {
    if (ready && hydrated) SplashScreen.hideAsync();
  }, [ready, hydrated]);

  if (!ready || !hydrated || !dilHazir) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.telve }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: color.telve },
              animation: 'fade',
            }}
          >
            <Stack.Screen name="reading/[id]" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="ritual/coffee" options={{ animation: 'slide_from_bottom' }} />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
