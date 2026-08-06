import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Slot, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { color, motion, space } from '@/lib/theme';

/** Onboarding adım sırası — ilerleme çubuğu bunu okur. */
const STEPS = ['name', 'birth', 'place', 'reveal', 'about-you', 'tone', 'notifications', 'paywall'];

export default function OnboardingLayout() {
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const current = STEPS.findIndex((s) => path.includes(s));
  const pct = ((current < 0 ? 0 : current) + 1) / STEPS.length;

  const w = useSharedValue(pct);
  React.useEffect(() => {
    w.value = withTiming(pct, { duration: motion.settle });
  }, [pct]);
  const bar = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));

  return (
    <View style={styles.root}>
      <View style={[styles.track, { marginTop: insets.top + space.sm }]}>
        <Animated.View style={[styles.fill, bar]} />
      </View>
      <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.telve },
  track: {
    height: 2,
    marginHorizontal: space.lg,
    backgroundColor: color.cizgi,
  },
  fill: { height: 2, backgroundColor: color.bakir },
});
