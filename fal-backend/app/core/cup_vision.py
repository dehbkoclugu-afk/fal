"""
Kahve falı görüntü hattı.

Fark yaratan nokta: fotoğrafı süs olarak alıp jenerik metin basmıyoruz.
Fincandaki gerçek telve bölgelerini buluyor, konumlandırıyor, geleneksel
fincan bölge şemasına oturtuyor ve sonucu fotoğraf üzerinde işaretliyoruz.

Hat:
  1. Kalite kapısı        (bulanık/karanlık fotoğrafı baştan reddet)
  2. Fincan tespiti       (elips fit — iç bölgeyi izole et)
  3. Telve binarizasyonu  (adaptif eşik + morfoloji)
  4. Bölge çıkarımı       (contour + şekil metrikleri + konum semantiği)
  5. Kırpma               (her bölge vision modeline ayrı gider → sembol etiketi)
  6. Overlay JSON         (uygulamada dokunulabilir işaretler)

Sadece OpenCV + numpy gerekir. GPU yok, sunucu maliyeti ~0.
"""

from __future__ import annotations

import base64
import math
from dataclasses import dataclass, asdict, field
from typing import Any

import cv2
import numpy as np

# --- Kalite eşikleri (sahada ayarla; TR'de orta segment Android kameralar baz alındı)
MIN_SIDE = 480
MIN_LAPLACIAN_VAR = 45.0      # bunun altı "bulanık"
MIN_MEAN_BRIGHTNESS = 45.0
# Dikkat: beyaz porselen fincan + beyaz masa + gündüz ışığı kombinasyonu global
# ortalamayı 235'e kadar çıkarabiliyor ve bu tamamen geçerli bir fotoğraf.
# Eşiği 225'te tutarsan gerçek kullanıcıların %10-15'ini boşuna reddedersin.
# Doğrusu: global parlaklığı gevşek tut, gerçek kararı fincan içi kontrastına bırak.
MAX_MEAN_BRIGHTNESS = 243.0
MIN_BLOB_AREA_RATIO = 0.0018  # fincan alanına oranla; gürültü filtresi
MAX_BLOB_AREA_RATIO = 0.28    # bundan büyükse telve değil, gölge/arka plan
MAX_BLOBS = 9                 # LLM'e giden sembol sayısı — fazlası yorumu sulandırır


@dataclass
class Blob:
    """Fincan içinde tespit edilen tek telve bölgesi."""
    id: str
    area_ratio: float          # fincan iç alanına oran
    cx: float                  # normalize merkez (0-1, fincan bbox içinde)
    cy: float
    region: str                # rim | upper | middle | lower | bottom
    clock_angle: float         # sap referanslı saat açısı (0-360)
    side: str                  # handle | opposite | left | right
    solidity: float            # dolgunluk — parçalı mı, kompakt mı
    elongation: float          # uzunluk/genişlik — "yol" mu "nokta" mı
    circularity: float
    hint: str                  # geometriden çıkan ön tahmin (vision modeline ipucu)
    bbox: list[int]            # [x, y, w, h] — orijinal foto koordinatları
    crop_b64: str = ""         # vision modeline gidecek kırpma
    symbols: list[dict] = field(default_factory=list)  # vision modeli doldurur


@dataclass
class CupAnalysis:
    ok: bool
    reason: str = ""
    quality: dict[str, Any] = field(default_factory=dict)
    cup_bbox: list[int] = field(default_factory=list)
    blobs: list[Blob] = field(default_factory=list)
    coverage: float = 0.0      # telve yoğunluğu — yorumun tonunu belirler
    overlay: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        # crop_b64 yalnızca geçici vision-model girdisidir. DB'ye yazmak
        # ham görüntü parçalarını kalıcılaştırır; bbox ve etiketler yeterli.
        clean_blobs = []
        for blob in self.blobs:
            clean = asdict(blob)
            clean.pop("crop_b64", None)
            clean_blobs.append(clean)
        return {
            "ok": self.ok,
            "reason": self.reason,
            "quality": self.quality,
            "cup_bbox": self.cup_bbox,
            "blobs": clean_blobs,
            "coverage": self.coverage,
            "overlay": self.overlay,
        }

    def llm_context(self) -> dict:
        """LLM'e giden hâl. Kırpmalar ve piksel koordinatları çıkarılır (token tasarrufu)."""
        return {
            "telve_yogunlugu": round(self.coverage, 3),
            "bolge_sayisi": len(self.blobs),
            "bolgeler": [
                {
                    "id": b.id,
                    "konum": b.region,
                    "yon": b.side,
                    "buyukluk": ("büyük" if b.area_ratio > 0.06
                                 else "orta" if b.area_ratio > 0.02 else "küçük"),
                    "sekil_ipucu": b.hint,
                    "tespit_edilen": [s["label"] for s in b.symbols[:2]],
                }
                for b in self.blobs
            ],
        }


# ------------------------------------------------------------------ 1. kalite kapısı

def quality_gate(img: np.ndarray) -> tuple[bool, str, dict]:
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brightness = float(gray.mean())
    metrics = {"width": w, "height": h, "sharpness": round(lap_var, 1),
               "brightness": round(brightness, 1)}

    if min(h, w) < MIN_SIDE:
        return False, "low_resolution", metrics
    if lap_var < MIN_LAPLACIAN_VAR:
        return False, "blurry", metrics
    if brightness < MIN_MEAN_BRIGHTNESS:
        return False, "too_dark", metrics
    if brightness > MAX_MEAN_BRIGHTNESS:
        return False, "overexposed", metrics
    return True, "", metrics


# Kullanıcıya gösterilecek TR mesajlar — rehberli yeniden çekim akışı
REJECT_MESSAGES_TR = {
    "low_resolution": "Fotoğraf çok küçük. Fincanı yakından, çerçeveyi doldurarak çek.",
    "blurry": "Fotoğraf bulanık çıkmış. Elini sabitle, fincanın içine odaklan.",
    "too_dark": "Ortam karanlık. Pencere kenarına git veya ışığı aç.",
    "overexposed": "Işık fazla parlıyor. Doğrudan ışığın altından çekil.",
    "cup_not_found": "Fincanı bulamadım. Fincanı tam ortada, yukarıdan bakacak şekilde çek.",
    "no_grounds": "Fincanın içinde telve göremedim. İçini yukarıdan net çek.",
}


# ------------------------------------------------------------- 2. fincan tespiti

def detect_cup(img: np.ndarray) -> tuple[np.ndarray, list[int]] | tuple[None, None]:
    """Fincan iç bölgesi için maske ve bbox döner.

    Yaklaşım: Hough çemberi önce denenir (yukarıdan çekilen fincan ağzı ≈ daire).
    Bulunamazsa en büyük parlak/kapalı contour'a elips fit edilir.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.medianBlur(gray, 7)
    h, w = gray.shape
    min_r, max_r = int(min(h, w) * 0.18), int(min(h, w) * 0.55)

    circles = cv2.HoughCircles(
        blur, cv2.HOUGH_GRADIENT, dp=1.2, minDist=min(h, w) // 2,
        param1=110, param2=55, minRadius=min_r, maxRadius=max_r,
    )
    mask = np.zeros((h, w), np.uint8)
    if circles is not None:
        # int() zorunlu: np.int64 JSON'a serileşmez ve pipeline'daki
        # json.dumps(..., default=str) onu SESSİZCE "136" string'ine çevirir.
        # extra_json'a string koordinat yazılırsa mobildeki CupOverlay
        # ölçeklemesi NaN üretir ve işaretler yanlış yere düşer.
        x, y, r = (int(v) for v in np.round(circles[0][0]))
        # Kenar gölgesinden kaçınmak için yarıçapı %88'e çek
        r_in = int(r * 0.88)
        cv2.circle(mask, (x, y), r_in, 255, -1)
        return mask, [max(0, x - r_in), max(0, y - r_in), 2 * r_in, 2 * r_in]

    # Yedek plan: Otsu + en büyük contour
    _, th = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    cnts, _ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return None, None
    c = max(cnts, key=cv2.contourArea)
    if cv2.contourArea(c) < 0.08 * h * w:
        return None, None
    if len(c) >= 5:
        ellipse = cv2.fitEllipse(c)
        (ex, ey), (ea, eb), ang = ellipse
        cv2.ellipse(mask, ((ex, ey), (ea * 0.88, eb * 0.88), ang), 255, -1)
    else:
        cv2.drawContours(mask, [c], -1, 255, -1)
    x, y, bw, bh = (int(v) for v in cv2.boundingRect(c))
    return mask, [x, y, bw, bh]


# ------------------------------------------------------- 3. telve binarizasyonu

def segment_grounds(img: np.ndarray, cup_mask: np.ndarray) -> np.ndarray:
    """Telve = fincan içindeki koyu bölgeler. Adaptif eşik, aydınlatma farkını tolere eder."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.bilateralFilter(gray, 9, 60, 60)      # kenar koru, gürültü at

    th = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, blockSize=41, C=9,
    )
    th = cv2.bitwise_and(th, th, mask=cup_mask)

    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    th = cv2.morphologyEx(th, cv2.MORPH_OPEN, k, iterations=1)
    th = cv2.morphologyEx(th, cv2.MORPH_CLOSE, k, iterations=2)
    return th


# --------------------------------------------------- 4-5. bölge çıkarımı + kırpma

def _region_of(cy_norm: float) -> str:
    """Geleneksel fincan şeması: ağza yakın = yakın gelecek, dip = geçmiş/kalıcı."""
    if cy_norm < 0.18:
        return "rim"
    if cy_norm < 0.38:
        return "upper"
    if cy_norm < 0.62:
        return "middle"
    if cy_norm < 0.82:
        return "lower"
    return "bottom"


def _side_of(angle: float) -> str:
    """Sap 0 derece kabul edilir. Sap tarafı = kişinin kendisi, karşısı = başkaları."""
    if angle < 45 or angle >= 315:
        return "handle"
    if angle < 135:
        return "right"
    if angle < 225:
        return "opposite"
    return "left"


def _shape_hint(solidity: float, elongation: float, circularity: float,
                area_ratio: float) -> str:
    """Geometriden ön tahmin. Vision modeline ipucu olarak verilir, karar ona bırakılır."""
    if elongation > 3.2 and solidity < 0.6:
        return "uzun ince hat (yol / çizgi / yılan)"
    if elongation > 2.4:
        return "uzamış form (yol / balık / kuş kanadı)"
    if circularity > 0.72 and area_ratio < 0.02:
        return "küçük yuvarlak (nokta / göz / para)"
    if circularity > 0.68:
        return "yuvarlak kütle (ay / yüzük / para)"
    if solidity < 0.55:
        return "dağınık/parçalı form (dal / saç / karmaşa)"
    if area_ratio > 0.1:
        return "büyük kütle (dağ / bulut / gölge)"
    return "belirsiz kompakt form"


def extract_blobs(img: np.ndarray, binary: np.ndarray, cup_bbox: list[int],
                  handle_angle_deg: float = 0.0,
                  crop_size: int = 224) -> tuple[list[Blob], float]:
    cx0, cy0, cw, ch = cup_bbox
    cup_area = max(1.0, math.pi * (cw / 2) * (ch / 2))
    center = (cx0 + cw / 2, cy0 + ch / 2)

    cnts, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    total_ink = 0.0
    cand: list[tuple[float, Blob]] = []

    for i, c in enumerate(cnts):
        area = cv2.contourArea(c)
        total_ink += area
        ratio = area / cup_area
        if ratio < MIN_BLOB_AREA_RATIO or ratio > MAX_BLOB_AREA_RATIO:
            continue

        x, y, w, h = cv2.boundingRect(c)
        M = cv2.moments(c)
        if M["m00"] == 0:
            continue
        bcx, bcy = M["m10"] / M["m00"], M["m01"] / M["m00"]

        hull_area = cv2.contourArea(cv2.convexHull(c)) or 1.0
        solidity = area / hull_area
        perim = cv2.arcLength(c, True) or 1.0
        circularity = 4 * math.pi * area / (perim ** 2)
        if len(c) >= 5:
            (_, _), (ma, mi), _ = cv2.fitEllipse(c)
            elong = max(ma, mi) / max(1e-6, min(ma, mi))
        else:
            elong = max(w, h) / max(1, min(w, h))

        # Sap referanslı saat açısı
        ang = (math.degrees(math.atan2(bcy - center[1], bcx - center[0]))
               - handle_angle_deg) % 360
        cy_norm = (bcy - cy0) / max(1, ch)
        cx_norm = (bcx - cx0) / max(1, cw)

        pad = int(0.18 * max(w, h))
        x1, y1 = max(0, x - pad), max(0, y - pad)
        x2, y2 = min(img.shape[1], x + w + pad), min(img.shape[0], y + h + pad)
        crop = img[y1:y2, x1:x2]
        if crop.size == 0:
            continue
        crop = cv2.resize(crop, (crop_size, crop_size), interpolation=cv2.INTER_AREA)
        ok, enc = cv2.imencode(".jpg", crop, [int(cv2.IMWRITE_JPEG_QUALITY), 82])
        crop_b64 = base64.b64encode(enc.tobytes()).decode() if ok else ""

        # float()/int(): OpenCV ve numpy türleri extra_json'a sızmasın (bkz.
        # detect_cup içindeki not — default=str onları string'e çevirir).
        blob = Blob(
            id=f"b{i}",
            area_ratio=round(float(ratio), 4),
            cx=round(float(cx_norm), 3), cy=round(float(cy_norm), 3),
            region=_region_of(cy_norm),
            clock_angle=round(float(ang), 1),
            side=_side_of(ang),
            solidity=round(float(solidity), 3),
            elongation=round(float(elong), 2),
            circularity=round(float(circularity), 3),
            hint=_shape_hint(solidity, elong, circularity, ratio),
            bbox=[int(x), int(y), int(w), int(h)],
            crop_b64=crop_b64,
        )
        # Sıralama skoru: büyük + ağza yakın olan yoruma daha çok konu olur
        score = ratio * (1.6 if blob.region in ("rim", "upper") else 1.0)
        cand.append((score, blob))

    cand.sort(key=lambda t: -t[0])
    blobs = [b for _, b in cand[:MAX_BLOBS]]
    coverage = float(min(1.0, total_ink / cup_area))
    return blobs, coverage


# ------------------------------------------------------------------ orkestrasyon

def analyze_cup(image_bytes: bytes, handle_angle_deg: float = 0.0) -> CupAnalysis:
    buf = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if img is None:
        return CupAnalysis(ok=False, reason="decode_failed")

    # Uzun kenarı 1280'e indir — kalite yeterli, işlem 4-5x hızlı
    h, w = img.shape[:2]
    if max(h, w) > 1280:
        s = 1280 / max(h, w)
        img = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)

    ok, reason, metrics = quality_gate(img)
    if not ok:
        return CupAnalysis(ok=False, reason=reason, quality=metrics)

    mask, bbox = detect_cup(img)
    if mask is None:
        return CupAnalysis(ok=False, reason="cup_not_found", quality=metrics)

    binary = segment_grounds(img, mask)
    blobs, coverage = extract_blobs(img, binary, bbox, handle_angle_deg)
    if not blobs:
        return CupAnalysis(ok=False, reason="no_grounds", quality=metrics,
                           cup_bbox=bbox, coverage=coverage)

    overlay = [
        {
            "id": b.id,
            "bbox": b.bbox,
            "region": b.region,
            "side": b.side,
            "hint": b.hint,
            "symbols": b.symbols[:3],
        }
        for b in blobs
    ]
    return CupAnalysis(ok=True, quality=metrics, cup_bbox=bbox,
                       blobs=blobs, coverage=coverage, overlay=overlay)


# ----------------------------------------------- sembol sözlüğü (vision modeli için)

# Vision modeline "şu listeden seç" demek, serbest bırakmaktan çok daha tutarlı sonuç verir.
SYMBOL_LEXICON_TR = [
    "kuş", "balık", "yol", "kalp", "göz", "el", "yüzük", "anahtar", "merdiven",
    "ağaç", "dağ", "köprü", "kapı", "pencere", "yılan", "at", "kedi", "köpek",
    "bebek", "insan yüzü", "iki insan", "çanta", "mektup", "para", "taç",
    "gemi", "uçak", "araba", "ev", "çiçek", "yıldız", "ay", "güneş", "bulut",
    "gözyaşı", "zincir", "kılıç", "haç", "hilal", "harf", "sayı", "çember",
    "üçgen", "kelebek", "örümcek", "kuyruk", "kanat", "saç", "aynada yüz",
]
