import React from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, space } from '@/lib/theme';

export function Screen({
  children,
  scroll = false,
  safeTop = true,
  safeBottom = true,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  safeTop?: boolean;
  safeBottom?: boolean;
  style?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  const pad = {
    paddingTop: (safeTop ? insets.top : 0) + space.lg,
    paddingBottom: (safeBottom ? insets.bottom : 0) + space.xl,
    paddingHorizontal: space.lg,
  };

  if (scroll) {
    return (
      <ScrollView
        style={styles.bg}
        contentContainerStyle={[pad, style]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }
  return <View style={[styles.bg, pad, style]}>{children}</View>;
}

const styles = StyleSheet.create({ bg: { flex: 1, backgroundColor: color.telve } });
