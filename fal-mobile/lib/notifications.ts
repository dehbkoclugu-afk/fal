/**
 * Bildirim yönlendirmesi.
 *
 * Sunucu her bildirime nereye gidileceğini söyleyen bir yük koyuyordu
 * (`reading_id`, `prediction_id`, `deeplink`) ama uygulama tarafında bu yükü
 * OKUYAN kimse yoktu: bildirime dokunmak her zaman ana ekranı açıyordu.
 *
 * En pahalı kaybı doğrulama bildiriminde veriyordu. "Geçen hafta şunu
 * söylemiştim — tuttu mu?" bildirimine dokunan kullanıcı tam olarak cevap
 * vermeye geliyor; ana ekrana düşünce o tahmini kendisi aramak zorunda
 * kalıyor ve çoğu aramıyor. Ürünün ana farkı (söylediğinin hesabını tutmak)
 * kullanıcının cevap vermesine bağlı, yani bu iki dokunuş arasındaki fark
 * doğrudan tezin kendisi.
 *
 * WEB: expo-notifications'ın push tarafı web'de yok. Modül web'de sessizce
 * hiçbir şey yapmıyor — çağıran tarafın platform kontrolü yapması
 * gerekmesin diye.
 */
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

const WEB = Platform.OS === 'web';

/** Sunucunun bildirimle birlikte gönderdiği yük. */
type Yuk = {
  reading_id?: string;
  prediction_id?: string;
  deeplink?: 'verdict' | 'daily' | 'paywall';
};

/**
 * Uygulama AÇIKKEN gelen bildirim de görünsün.
 *
 * Varsayılan davranışta ön plandaki bildirim hiç gösterilmiyor. Fal
 * üretimi 30-120 saniye sürüyor ve kullanıcı bu sırada çoğunlukla
 * uygulamada bekliyor — "falın hazır" bildirimini görmesi gereken tek an
 * tam olarak burası.
 */
export function bildirimleriKur(): void {
  if (WEB) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,   // fal bildirimi sessiz olmalı; ses rahatsız edici
      shouldSetBadge: false,
    }),
  });
}

/** Yükten gidilecek yolu çıkarır. Bilinmiyorsa null — ana ekranda kal. */
export function hedefYol(yuk: Yuk | undefined | null): string | null {
  if (!yuk) return null;

  // Doğrulama: defteri aç ve SORULAN tahmini işaretle. Sadece defteri
  // açmak, uzun bir listede o tahmini aratmak demek.
  if (yuk.deeplink === 'verdict' && yuk.prediction_id) {
    return `/(tabs)/journal?vurgu=${encodeURIComponent(yuk.prediction_id)}`;
  }
  if (yuk.reading_id) return `/reading/${yuk.reading_id}`;
  if (yuk.deeplink === 'daily') return '/(tabs)';
  if (yuk.deeplink === 'paywall') return '/onboarding/paywall';
  if (yuk.deeplink === 'verdict') return '/(tabs)/journal';
  return null;
}

/**
 * Bildirim dokunuşlarını yönlendirir.
 *
 * İki yolu da kapsıyor ve ikisi de gerekli:
 *   - UYGULAMA KAPALIYKEN dokunma → `getLastNotificationResponseAsync`.
 *     Bu yol atlanırsa, bildirimle uygulamayı ilk kez açan kullanıcı —
 *     yani asıl hedef kitle — hiçbir zaman doğru ekrana gitmiyor.
 *   - UYGULAMA AÇIKKEN dokunma → dinleyici.
 */
export function useBildirimYonlendirme(hazir: boolean): void {
  const router = useRouter();
  const islenmis = useRef<string | null>(null);

  useEffect(() => {
    // `hazir` beklenmesi şart: yönlendirme, router ağacı kurulmadan
    // çağrılırsa sessizce kayboluyor ve kullanıcı yine ana ekranda kalıyor.
    if (WEB || !hazir) return;

    let canli = true;

    const git = (res: Notifications.NotificationResponse | null) => {
      if (!canli || !res) return;
      // Aynı bildirim hem soğuk açılışta hem dinleyiciden gelebiliyor.
      const kimlik = res.notification.request.identifier;
      if (islenmis.current === kimlik) return;
      islenmis.current = kimlik;

      const yol = hedefYol(res.notification.request.content.data as Yuk);
      if (yol) router.push(yol as never);
    };

    Notifications.getLastNotificationResponseAsync().then(git).catch(() => {});
    const abone = Notifications.addNotificationResponseReceivedListener(git);

    return () => {
      canli = false;
      abone.remove();
    };
  }, [hazir, router]);
}
