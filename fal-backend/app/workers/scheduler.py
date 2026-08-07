"""
Zamanlayıcı.

NEDEN CRONTAB DEĞİL: Plan yedi ayrı crontab satırı öngörüyordu ve bu
satırlar elle yazılıyordu. Biri unutulursa hiçbir şey uyarmıyor — sadece o
iş hiç çalışmıyor. En kötü ihtimal `ask_verdicts`: tahmin doğrulama sorusu
gitmezse Kader Günlüğü hiç dolmaz ve ürünün ana farkı olan "söylediğinin
hesabını tutuyor" iddiası sessizce ölür. Kimse fark etmez, çünkü uygulama
çalışıyor görünür.

Zamanlama artık uygulamanın parçası: tek bir süreç, tek komutla başlıyor.

TASARIM: "SAATİ GELDİ Mİ" DEĞİL, "BUGÜN ÇALIŞTI MI"
Klasik zamanlayıcı HH:MM'i yakalamaya çalışır; süreç o dakikada yeniden
başlıyorsa iş atlanır. Tek küçük VPS'te yeniden başlatma ve kısa kesinti
olağan. Bu yüzden kural şu: işin bugünkü saati GEÇTİYSE ve bugün henüz
çalışmadıysa, çalıştır. Öğlen 12:00'de kapalı olan sunucu 12:40'ta
açıldığında doğrulama sorusu yine gidiyor — bir gün kaybedilmiyor.

Son çalışma zamanı Redis'te tutuluyor: süreç yeniden başlasa da aynı iş
gün içinde iki kez çalışmıyor. Redis zaten kuyruk için gerekli, yeni bir
bağımlılık yok.
"""

from __future__ import annotations

import logging
import os
import time
import traceback
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Callable
from zoneinfo import ZoneInfo

from redis import Redis

from . import tasks

log = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# İşlerin takvim günü bu saat dilimine göre belirleniyor. Ana pazar Türkiye;
# "günlük yorum sabah hazır olsun" gibi kararlar buradaki güne dayanıyor.
TZ = ZoneInfo(os.getenv("SCHEDULER_TZ", "Europe/Istanbul"))

# Son çalışma kaydı bu kadar yaşıyor. Bir günden uzun ama sonsuz değil:
# aylarca kapalı kalmış bir kurulumda eski kayıtlar kendiliğinden düşsün.
KAYIT_TTL = 60 * 60 * 72


@dataclass(frozen=True)
class Is:
    ad: str
    fn: Callable[[], object]
    saat: int | None          # None = her saat başı
    dakika: int = 0
    aciklama: str = ""


# Saatler README'deki cron planıyla aynı; tek fark, artık tek yerde ve
# çalıştığı doğrulanabiliyor.
ISLER: list[Is] = [
    Is("nightly_transits", tasks.nightly_transits, 3, 0,
       "7 günlük transit taraması"),
    Is("purge_assets", tasks.purge_assets, 4, 0,
       "süresi geçen fincan fotoğraflarını sil (KVKK)"),
    Is("purge_deleted_users", tasks.purge_deleted_users, 4, 30,
       "silme talebini kalıcı hale getir (KVKK)"),
    Is("winback", tasks.winback, 5, 0,
       "iptal etmiş kullanıcılara teklif"),
    Is("queue_daily", tasks.queue_daily, 6, 30,
       "günlük yorumları önceden üret"),
    Is("ask_verdicts", tasks.ask_verdicts, 12, 0,
       "penceresi kapanan tahminler için doğrulama sorusu"),
    # Saatte bir: her kullanıcıya kendi active_hour'unda gidiyor ve
    # kullanıcılar farklı saat dilimlerinde. Tek toplu gönderimden hem daha
    # az rahatsız edici hem açılma oranı yüksek.
    Is("send_daily_push", tasks.send_daily_push, None, 0,
       "kullanıcının aktif saatine göre günlük bildirim"),
]


def _anahtar(ad: str, damga: str) -> str:
    return f"sched:{ad}:{damga}"


def _damga(is_: Is, simdi: datetime) -> str:
    """İşin içinde bulunduğu pencerenin kimliği.

    Günlük işlerde takvim günü, saatlik işlerde gün + saat. Aynı pencerede
    ikinci kez çalıştırma bu damgayla engelleniyor.
    """
    if is_.saat is None:
        return simdi.strftime("%Y-%m-%d-%H")
    return simdi.strftime("%Y-%m-%d")


def _zamani_geldi(is_: Is, simdi: datetime) -> bool:
    if is_.saat is None:
        return simdi.minute >= is_.dakika
    return (simdi.hour, simdi.minute) >= (is_.saat, is_.dakika)


def calistir_bekleyenleri(r: Redis, simdi: datetime | None = None) -> list[str]:
    """Bu turda çalışması gereken işleri çalıştırır, çalışanların adını döner.

    Bir işin patlaması diğerlerini durdurmuyor: tek bir hatalı sorgu yüzünden
    o gün hiçbir bakım işinin çalışmaması, hatanın kendisinden daha pahalı.
    """
    simdi = simdi or datetime.now(TZ)
    calisan: list[str] = []

    for is_ in ISLER:
        if not _zamani_geldi(is_, simdi):
            continue
        anahtar = _anahtar(is_.ad, _damga(is_, simdi))
        # SET NX: iki zamanlayıcı süreci aynı anda kalksa bile iş bir kez
        # çalışır. Kilidi işten ÖNCE alıyoruz; iş yarıda patlarsa o pencerede
        # tekrar denenmiyor. Bakım işleri için doğru taraf bu — yarım kalmış
        # bir işi döngüde yeniden denemek, hata durumunda sağlayıcıya yüz
        # kere istek atmak demek.
        if not r.set(anahtar, simdi.isoformat(), nx=True, ex=KAYIT_TTL):
            continue
        basla = time.monotonic()
        try:
            sonuc = is_.fn()
            log.info("sched: %s tamam (%.1fs) %s", is_.ad,
                     time.monotonic() - basla, f"→ {sonuc}" if sonuc is not None else "")
            calisan.append(is_.ad)
        except Exception:
            # Hatayı yutmuyoruz, log'a tam iz bırakıyoruz; ama döngü sürüyor.
            log.error("sched: %s PATLADI\n%s", is_.ad, traceback.format_exc())
            calisan.append(is_.ad)

    return calisan


def sonraki_uyanis(simdi: datetime) -> float:
    """Bir sonraki dakika başına kadar kaç saniye var.

    Dakikada bir uyanmak yeterli: en sık iş saatte bir çalışıyor. Daha sık
    uyanmak boşuna CPU, daha seyrek uyanmak zamanlamayı kaydırıyor.
    """
    sonraki = (simdi + timedelta(minutes=1)).replace(second=0, microsecond=0)
    return max(1.0, (sonraki - simdi).total_seconds())


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    r = Redis.from_url(REDIS_URL)

    log.info("zamanlayıcı başladı · saat dilimi %s · %d iş", TZ, len(ISLER))
    for is_ in ISLER:
        ne_zaman = "her saat" if is_.saat is None else f"{is_.saat:02d}:{is_.dakika:02d}"
        log.info("  %-20s %-9s %s", is_.ad, ne_zaman, is_.aciklama)

    while True:
        simdi = datetime.now(TZ)
        try:
            calistir_bekleyenleri(r, simdi)
        except Exception:
            # Redis düşse bile zamanlayıcı ölmemeli; bağlantı geri geldiğinde
            # devam etsin.
            log.error("sched: tur başarısız\n%s", traceback.format_exc())
        time.sleep(sonraki_uyanis(datetime.now(TZ)))


if __name__ == "__main__":
    main()
