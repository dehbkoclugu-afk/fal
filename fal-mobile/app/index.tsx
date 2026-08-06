import { Redirect } from 'expo-router';
import { useDraft } from '@/lib/store';

/**
 * Giriş kapısı. Onboarding'i bitiren kullanıcı doğrudan ana ekrana gider.
 * Not: kalıcı hâl için useDraft'ı SecureStore'a bağla (şu an bellekte).
 */
export default function Index() {
  const onboarded = useDraft((s) => s.onboarded);
  return <Redirect href={onboarded ? '/(tabs)' : '/onboarding/name'} />;
}
