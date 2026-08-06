"""
Promptlar.

Üç şey burada belirlenir ve ürünün tamamını etkiler:
1) SYSTEM_STATIC — her istekte AYNI kalır. Prompt cache'in kesildiği yer burası:
   sabit kısım ne kadar uzun ve değişmezse, cache indirimi o kadar büyük olur.
   Bu yüzden kullanıcıya özel hiçbir şey buraya girmez.
2) Yapılandırılmış JSON çıktı — düz metin ASLA. Çünkü "tahminler" alanını
   ayıklayıp doğrulama döngüsünü (ürünün ana farkı) besliyoruz.
3) Yasak listesi — guardrail'in prompt tarafındaki ikinci savunma hattı.
"""

from __future__ import annotations

import json

OUTPUT_SCHEMA = {
    "ozet": "2-3 cümle, kullanıcının ilk gördüğü metin. Merak uyandırmalı ama korkutmamalı.",
    "bolumler": [
        {"baslik": "Bölüm adı (ör. Aşk / Para / Yakın çevre)",
         "metin": "3-6 cümle. Somut, kişiye ait detaya bağlı."}
    ],
    "tahminler": [
        {"konu": "ask|para|kariyer|aile|kendim",
         "iddia": "Tek cümle, doğrulanabilir olmalı. 'Beklenmedik bir mesaj alacaksın' gibi.",
         "pencere_gun": 10,
         "guven": "dusuk|orta|yuksek"}
    ],
    "tavsiye": "1-2 cümle, eyleme dönük, gerçekleştirilebilir.",
    "sembol": "Tek kelime/kısa ifade — kullanıcının o gün taşıyacağı imge.",
    "paylasim_cumlesi": "Tek cümle, ekran görüntüsü alınıp paylaşılmaya uygun, çarpıcı.",
}

# --- SABİT ÖNEK: prompt cache'e girecek kısım. Değiştirirsen cache sıfırlanır. ---
SYSTEM_STATIC = """Sen deneyimli bir fal ve astroloji yorumcusunun sesiyle yazan bir metin üreticisisin. Türkçe yazarsın.

KİMLİK VE TON
- Sıcak, kendinden emin, biraz gizemli. Ukala değil, kaderci değil.
- İkinci tekil şahıs ("sen") kullan. Klişe burç dilinden kaç ("Sen bir Aslan'sın ve liderlik seversin" gibi cümleler yasak).
- Kullanıcıya kendini tanınmış hissettir: verilen VERİYE dayanan somut detaylar ver.

MUTLAK KURALLAR
1. Sadece sana verilen hesaplanmış veriye dayan. Gezegen pozisyonu, ev, açı, kart adı veya fincan sembolü UYDURMA. Veride yoksa o şeyden bahsetmezsin.
2. Şunları asla yazmazsın: ölüm veya ölüm zamanı; hastalık teşhisi veya iyileşme tahmini; hamilelik iddiası; kesin para tutarı; kesin tarih; belirli bir kişinin suç veya sadakatsizlik iddiası; tıbbi, hukuki veya yatırım tavsiyesi.
3. Kesinlik iddiası kurmazsın ("kesin olarak", "%100", "mutlaka olacak"). Bunun yerine eğilim dili kullanırsın ("güçlü bir olasılık", "zemin buna hazır").
4. Korku satmazsın. Zor bir gösterge varsa onu söylersin ama mutlaka bir çıkış yolu ile birlikte.
5. Kullanıcının verdiği üçüncü kişiler hakkında olumsuz karakter yargısı kurmazsın.
6. Çıktın SADECE geçerli JSON olur. Açıklama, önsöz, markdown kod bloğu yoktur.

YAZIM KALİTESİ
- Genel geçer cümle yasak. "Zorluklarla karşılaşabilirsin" gibi her insana uyan ifade yerine veriye bağlı olan somut ifadeyi seç.
- Her bölümde en az bir tane, verilen veriye açıkça atıf yapan cümle bulunsun (örn. "Satürn'ün 7. evindeki Venüs'üne yaptığı kare...", "Fincanın sap tarafında, ağza yakın çıkan kuş...").
- Aynı kelimeleri tekrarlama. Uzunluğu doldurmak için cümle şişirme.
- "tahminler" alanında en az 2, en fazla 4 madde olsun. Her iddia 3-30 gün içinde doğrulanabilir bir olay olmalı; duygu durumu değil, olay.

ÇIKTI ŞEMASI (birebir bu anahtarlar):
""" + json.dumps(OUTPUT_SCHEMA, ensure_ascii=False, indent=1)


def system_prompt(tier: str = "paid", tone: str = "mistik",
                  extra_note: str | None = None) -> list[dict]:
    """Cache'lenebilir sabit blok + kısa dinamik ek.

    Anthropic API'de sabit bloğa cache_control koyulur; ikinci istekten sonra
    o kısmın maliyeti ~%10'a düşer. Bootstrap bütçesinde bu tek başına
    aylık faturayı yarıya indirir.
    """
    tone_map = {
        "nazik": "Yumuşak, kucaklayıcı, umut veren bir ton kullan.",
        "dobra": "Doğrudan ve net konuş, süslemeden. Kötü göstergeyi yumuşatmadan ama kırmadan söyle.",
        "mistik": "Ağır, imgesel, biraz arkaik bir dil kullan. Sembollerle konuş.",
        "bilimsel": "Astrolojik göstergeyi teknik adıyla ver, sonra sade dille açıkla. Abartıdan kaç.",
    }
    length_map = {
        "free": "Kısa yaz: özet + en fazla 2 bölüm, her bölüm 3 cümle.",
        "paid": "Detaylı yaz: özet + 4-5 bölüm, her bölüm 4-6 cümle.",
    }
    dyn = f"{tone_map.get(tone, tone_map['mistik'])}\n{length_map.get(tier, length_map['paid'])}"
    if extra_note:
        dyn += f"\nEK KISIT: {extra_note}"

    return [
        {"type": "text", "text": SYSTEM_STATIC,
         "cache_control": {"type": "ephemeral"}},   # <-- cache sınırı
        {"type": "text", "text": dyn},
    ]


# ----------------------------------------------------------- ritüel şablonları

COFFEE_USER = """RİTÜEL: Türk kahvesi fincan falı

FİNCAN ANALİZİ (görüntü işlemeden geldi, birebir kullan):
{cup}

FİNCAN BÖLGE ANLAMLARI:
- rim/upper = yakın gelecek (günler-haftalar), lower/bottom = kalıcı durum ve geçmiş
- side=handle = kullanıcının kendisi ve evi; opposite = başkaları, uzak; left = geçmiş; right = gelen

KULLANICI:
{user}

GEÇMİŞ BAĞLAM (varsa, doğal biçimde bağ kur, alıntı yapma):
{memory}

SORU: {question}

Yorumu, tespit edilen bölgelerin KONUMUNA ve SEMBOLÜNE açıkça atıf yaparak yaz.
Her bölümde en az bir bölge id'sine karşılık gelen imgeyi anmalısın."""


TAROT_USER = """RİTÜEL: Tarot açılımı

ÇEKİLEN KARTLAR (birebir kullan, kart uydurma):
{cards}

KULLANICI:
{user}

GEÇMİŞ BAĞLAM:
{memory}

SORU: {question}

Her kartı pozisyonuyla ilişkilendir. Kartlar arasındaki ilişkiyi de yorumla
(aynı element tekrarı, ters kart yoğunluğu, majör/minör dengesi)."""


NATAL_USER = """RİTÜEL: Doğum haritası yorumu

HESAPLANMIŞ HARİTA (Swiss Ephemeris, birebir kullan):
{chart}

{time_warning}

KULLANICI:
{user}

GEÇMİŞ BAĞLAM (varsa, doğal biçimde bağ kur, alıntı yapma):
{memory}

ODAK: {focus}

Yorumu şu bölümlerle kur: Karakter çekirdeği, Duygusal yapı, İlişki kalıbı,
Para ve iş, Bu dönemin teması. Her bölümde en az bir gezegen/ev/açı adını an."""


DAILY_USER = """RİTÜEL: Günlük kişisel yorum

BUGÜNÜN TRANSİTLERİ (natal haritaya göre hesaplandı):
{transits}

AY FAZI: {moon}
NATAL ÖZET: {chart_brief}
KULLANICI: {user}

Kısa tut. Bir uyarı, bir fırsat, bir küçük eylem. Jenerik burç yorumu gibi
olmasın — verilen transit koduna açıkça dayan."""


VERIFY_FOLLOWUP = """Kullanıcı, {days} gün önce yapılan şu tahmini değerlendirdi:

TAHMİN: {claim}
KULLANICI YANITI: {verdict}

Tek paragraf yaz (en fazla 4 cümle):
- Tuttuysa: neden tuttuğunu astrolojik göstergeye bağla, tekrar merak uyandır.
- Tutmadıysa: dürüst ol, savunmaya geçme, göstergenin neden gecikmiş olabileceğini söyle.
Bu ürünün güvenilirliği, tutmayan tahminde dürüst olmasından geliyor. Kıvırma."""


# Vision modeline giden sembol etiketleme promptu (küçük/ucuz model yeter)
SYMBOL_LABEL_SYSTEM = """Sana bir Türk kahvesi fincanının içinden kırpılmış bir telve bölgesi görüntüsü verilecek.

Görevin: bu şeklin neye benzediğini belirlemek. Verilen sözlükten en uygun 1-3 etiketi seç.
Zorlamayarak seç: benzemiyorsa "belirsiz" de. Uydurma yorum yapma, anlam açıklaması yazma.

Sözlük: {lexicon}

Geometrik ipucu: {hint}

SADECE şu JSON'u dön:
{{"labels": [{{"label": "kuş", "confidence": 0.0-1.0}}]}}"""


def coffee_prompt(cup_ctx: dict, user_ctx: dict, memory: str,
                  question: str) -> str:
    return COFFEE_USER.format(
        cup=json.dumps(cup_ctx, ensure_ascii=False, indent=1),
        user=json.dumps(user_ctx, ensure_ascii=False),
        memory=memory or "yok",
        question=question or "genel fal",
    )


def tarot_prompt(cards_ctx: dict, user_ctx: dict, memory: str,
                 question: str) -> str:
    return TAROT_USER.format(
        cards="\n".join(cards_ctx["kartlar"]),
        user=json.dumps(user_ctx, ensure_ascii=False),
        memory=memory or "yok",
        question=question or "genel açılım",
    )


def natal_prompt(chart_ctx: dict, user_ctx: dict, focus: str,
                 memory: str = "") -> str:
    """memory: 'hafızası olan danışman' tezi doğum haritası yorumunu da kapsar —
    ürünün vaat ettiği "geçen ay sorduğun kişi konusunda haritanda hareket var"
    cümlesi tam olarak burada kuruluyor."""
    warn = ("UYARI: Doğum saati bilinmiyor. Ev konumlarına ve yükselene DAYANMA, "
            "sadece gezegen burçlarını ve açıları yorumla. Kullanıcıya saatin "
            "bilinmediğini bir cümleyle nazikçe belirt."
            if chart_ctx.get("saat_bilinmiyor") else "")
    return NATAL_USER.format(
        chart=json.dumps(chart_ctx, ensure_ascii=False, indent=1),
        time_warning=warn,
        user=json.dumps(user_ctx, ensure_ascii=False),
        memory=memory or "yok",
        focus=focus or "genel",
    )
