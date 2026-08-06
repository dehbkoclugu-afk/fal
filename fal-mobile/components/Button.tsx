import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

import { color, radius, space, type } from '@/lib/theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({ label, onPress, variant = 'primary', disabled, loading, style }: Props) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={() => {
        if (off) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.ghost,
        pressed && !off && styles.pressed,
        off && styles.off,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? color.telve : color.porselen} />
      ) : (
        <Text style={[styles.label, variant === 'primary' ? styles.labelPrimary : styles.labelGhost]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  primary: { backgroundColor: color.bakir },
  ghost: { borderWidth: 1, borderColor: color.cizgi },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  off: { opacity: 0.4 },
  label: type.button,
  labelPrimary: { color: color.telve },
  labelGhost: { color: color.porselen },
});
