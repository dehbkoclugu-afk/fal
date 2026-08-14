/** Production mağaza paketi, fiyatsız/çalışmayan paywall ile çıkamaz. */
if (process.env.EAS_BUILD_PROFILE === 'production') {
  const key = process.env.EXPO_PUBLIC_RC_ANDROID_KEY?.trim();
  if (!key) {
    console.error('Production derlemesi durduruldu: EXPO_PUBLIC_RC_ANDROID_KEY eksik.');
    process.exit(1);
  }
}

console.log(`✓ ${process.env.EAS_BUILD_PROFILE ?? 'local'} build yapılandırması doğrulandı.`);
