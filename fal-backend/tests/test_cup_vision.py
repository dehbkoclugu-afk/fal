"""
Kahve falı görüntü hattı testleri.

Sentetik fincanlarla çalışıyor: gerçek fotoğraf setiyle kalibrasyon ayrı bir iş
(bkz. fal-backend/README bölüm 7). Buradaki testlerin işi eşiklerin ve konum
semantiğinin regresyona uğramadığını garanti etmek — özellikle "sap = kişinin
kendisi, karşısı = başkaları" haritası, çünkü yorumun tamamı buna dayanıyor.
"""

from __future__ import annotations

import cv2
import numpy as np
import pytest

from app.core import cup_vision as cv


def sentetik_fincan(size: int = 900, lekeler: list[tuple[int, int, int]] | None = None,
                    blur: int = 0, parlaklik: int = 0) -> bytes:
    """Beyaz porselen fincan + koyu telve lekeleri üretir.

    lekeler: (cx, cy, yarıçap) — görüntü merkezine göre mutlak piksel.
    """
    img = np.full((size, size, 3), 235, np.uint8)          # açık masa yüzeyi
    c = size // 2
    r = int(size * 0.40)
    cv2.circle(img, (c, c), r, (250, 250, 248), -1)        # fincan içi
    cv2.circle(img, (c, c), r, (205, 200, 195), 6)         # fincan kenarı

    for (x, y, rr) in (lekeler or []):
        cv2.circle(img, (x, y), rr, (48, 36, 30), -1)

    # Laplacian varyansını gerçekçi tutmak için hafif doku
    noise = np.random.default_rng(0).normal(0, 4, img.shape).astype(np.int16)
    img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    if blur:
        img = cv2.GaussianBlur(img, (blur | 1, blur | 1), 0)
    if parlaklik:
        img = np.clip(img.astype(np.int16) + parlaklik, 0, 255).astype(np.uint8)

    return cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 92])[1].tobytes()


def varsayilan_lekeler(size: int = 900) -> list[tuple[int, int, int]]:
    c = size // 2
    return [
        (c, c - 250, 34),        # üstte (rim/upper) — sap yönü
        (c + 210, c + 40, 46),   # sağda
        (c - 190, c + 90, 30),   # solda
        (c, c + 240, 52),        # altta (bottom)
    ]


# ------------------------------------------------------------------ kalite kapısı

def test_gecerli_fincan_kabul_ediliyor():
    res = cv.analyze_cup(sentetik_fincan(lekeler=varsayilan_lekeler()))
    assert res.ok, f"geçerli fincan reddedildi: {res.reason}"
    assert res.blobs


def test_kucuk_fotograf_reddediliyor():
    res = cv.analyze_cup(sentetik_fincan(size=320, lekeler=[(160, 120, 20)]))
    assert not res.ok and res.reason == "low_resolution"


def test_bulanik_fotograf_reddediliyor():
    res = cv.analyze_cup(sentetik_fincan(lekeler=varsayilan_lekeler(), blur=45))
    assert not res.ok and res.reason == "blurry"


def test_karanlik_fotograf_reddediliyor():
    res = cv.analyze_cup(sentetik_fincan(lekeler=varsayilan_lekeler(),
                                         parlaklik=-200))
    assert not res.ok and res.reason == "too_dark"


def test_beyaz_fincan_beyaz_masa_reddedilmiyor():
    """Regresyon: parlaklık eşiği 225'te bırakılırsa beyaz porselen + beyaz masa
    kombinasyonu (global ortalama ~235) geçerli fotoğrafları reddeder.
    Eşik 243'e çekildi; bu test onu sabitliyor."""
    data = sentetik_fincan(lekeler=varsayilan_lekeler(), parlaklik=3)
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    ortalama = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).mean()
    # Eski eşiğin (225) altında kalırsa test bir şey kanıtlamaz.
    assert 225 < ortalama < cv.MAX_MEAN_BRIGHTNESS, (
        f"test kurgusu geçersiz: ortalama {ortalama:.1f}, 225-243 bandında olmalı")
    ok, reason, _ = cv.quality_gate(img)
    assert ok, f"parlak ama geçerli fotoğraf reddedildi: {reason}"


def test_asiri_pozlanmis_reddediliyor():
    img = np.full((900, 900, 3), 252, np.uint8)
    ok, reason, _ = cv.quality_gate(img)
    assert not ok and reason in ("overexposed", "blurry")


def test_telvesiz_fincan_reddediliyor():
    res = cv.analyze_cup(sentetik_fincan(lekeler=[]))
    assert not res.ok
    assert res.reason in ("no_grounds", "cup_not_found")


def test_bozuk_veri_cokmuyor():
    res = cv.analyze_cup(b"bu bir jpeg degil")
    assert not res.ok and res.reason == "decode_failed"


def test_her_red_sebebinin_turkce_mesaji_var():
    """Reddedilen kullanıcıya ne yapacağını söylemek zorundayız; rehberli
    yeniden çekim akışı kabul oranını %35 redden %8'e indiren şey."""
    for reason in ("low_resolution", "blurry", "too_dark", "overexposed",
                   "cup_not_found", "no_grounds"):
        assert reason in cv.REJECT_MESSAGES_TR
        assert len(cv.REJECT_MESSAGES_TR[reason]) > 20


# --------------------------------------------------------------- konum semantiği

def test_bolge_haritasi_ust_alt():
    assert cv._region_of(0.05) == "rim"
    assert cv._region_of(0.30) == "upper"
    assert cv._region_of(0.50) == "middle"
    assert cv._region_of(0.70) == "lower"
    assert cv._region_of(0.95) == "bottom"


def test_sap_referansli_yon_haritasi():
    """Sap = kişinin kendisi, karşısı = başkaları. Bu eşleme bozulursa
    yorumun tamamı yanlış kişiye atfedilir."""
    assert cv._side_of(0) == "handle"
    assert cv._side_of(350) == "handle"
    assert cv._side_of(90) == "right"
    assert cv._side_of(180) == "opposite"
    assert cv._side_of(270) == "left"


def test_sap_acisi_yonleri_donduruyor():
    """Kullanıcı fincanı sapı 90°'ye gelecek şekilde tutarsa, oradaki leke
    'handle' olarak işaretlenmeli."""
    lekeler = varsayilan_lekeler()
    duz = cv.analyze_cup(sentetik_fincan(lekeler=lekeler), handle_angle_deg=0.0)
    donuk = cv.analyze_cup(sentetik_fincan(lekeler=lekeler), handle_angle_deg=90.0)
    assert duz.ok and donuk.ok
    duz_acilar = sorted(b.clock_angle for b in duz.blobs)
    donuk_acilar = sorted(b.clock_angle for b in donuk.blobs)
    assert duz_acilar != donuk_acilar


def test_ustteki_leke_rim_veya_upper():
    size = 900
    res = cv.analyze_cup(sentetik_fincan(size=size, lekeler=varsayilan_lekeler(size)))
    assert res.ok
    en_ustteki = min(res.blobs, key=lambda b: b.cy)
    assert en_ustteki.region in ("rim", "upper")


# ------------------------------------------------------------- şekil metrikleri

def test_uzun_form_yol_ipucu_veriyor():
    assert "yol" in cv._shape_hint(solidity=0.5, elongation=4.0,
                                   circularity=0.2, area_ratio=0.03)


def test_yuvarlak_kucuk_form_nokta_ipucu_veriyor():
    h = cv._shape_hint(solidity=0.95, elongation=1.05,
                       circularity=0.9, area_ratio=0.01)
    assert "yuvarlak" in h


def test_bloblar_vision_modeline_hazir():
    """Her bölge ayrı kırpma olarak gider — fincanın tamamını göndermekten
    hem daha doğru hem ~5x ucuz."""
    res = cv.analyze_cup(sentetik_fincan(lekeler=varsayilan_lekeler()))
    assert res.ok
    for b in res.blobs:
        assert b.crop_b64, "kırpma üretilmemiş"
        assert len(b.bbox) == 4 and all(v >= 0 for v in b.bbox)
        assert b.hint


def test_blob_sayisi_sinirli():
    """Çok fazla sembol yorumu sulandırır; MAX_BLOBS tavanı uygulanmalı."""
    rng = np.random.default_rng(1)
    c = 450
    cok = [(int(c + rng.integers(-250, 250)), int(c + rng.integers(-250, 250)), 20)
           for _ in range(40)]
    res = cv.analyze_cup(sentetik_fincan(lekeler=cok))
    if res.ok:
        assert len(res.blobs) <= cv.MAX_BLOBS


def test_overlay_bloblarla_ayni_kimlikleri_tasiyor():
    """Mobilde CupOverlay bu bbox'ları dokunulabilir işaret olarak basıyor;
    kimlikler ayrışırsa kullanıcı yanlış sembole dokunur."""
    res = cv.analyze_cup(sentetik_fincan(lekeler=varsayilan_lekeler()))
    assert res.ok
    assert [o["id"] for o in res.overlay] == [b.id for b in res.blobs]
    for o in res.overlay:
        assert set(o) >= {"id", "bbox", "region", "side"}


def test_llm_context_piksel_koordinati_sizdirmiyor():
    """Token tasarrufu ve gizlilik: LLM'e giden bağlamda ham koordinat ve
    kırpma olmamalı."""
    res = cv.analyze_cup(sentetik_fincan(lekeler=varsayilan_lekeler()))
    assert res.ok
    ctx = res.llm_context()
    metin = str(ctx)
    assert "bbox" not in metin and "crop_b64" not in metin
    assert ctx["bolge_sayisi"] == len(res.blobs)


def test_analiz_json_serilestirilebilir():
    import json
    res = cv.analyze_cup(sentetik_fincan(lekeler=varsayilan_lekeler()))
    assert res.ok
    json.dumps(res.to_dict())
