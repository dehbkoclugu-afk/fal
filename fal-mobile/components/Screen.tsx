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
    paddingTop: space.lg,
    paddingBottom: space.xl,
    paddingHorizontal: space.lg,
  };

  if (scroll) {
    return (
      <View style={styles.bg}>
        {/*
          Safe-area boşlukları ScrollView içeriğinin parçası olursa yalnızca
          listenin başında/sonunda işe yarar. Kullanıcı kaydırınca metin yine
          şeffaf Android durum ve gezinme çubuklarının altına girer. Boşlukları
          viewport'un dışında tutarak kaydırılan alanı sistem çubuklarının
          arasında fiziksel olarak sınırlıyoruz.
        */}
        {safeTop && insets.top > 0 ? <View style={{ height: insets.top }} /> : null}
        <ScrollView
          style={styles.content}
          contentContainerStyle={[pad, style]}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {safeBottom && insets.bottom > 0 ? <View style={{ height: insets.bottom }} /> : null}
      </View>
    );
  }
  return (
    <View style={styles.bg}>
      {safeTop && insets.top > 0 ? <View style={{ height: insets.top }} /> : null}
      <View style={[styles.content, pad, style]}>{children}</View>
      {safeBottom && insets.bottom > 0 ? <View style={{ height: insets.bottom }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: color.telve },
  content: { flex: 1, backgroundColor: color.telve },
});
