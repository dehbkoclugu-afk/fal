"""
Tarot motoru.

İki tasarım kararı önemli:
1) Çekim kriptografik rastgele, ama SEED saklanır. Kullanıcı aynı açılımı tekrar
   açtığında aynı kartları görür — "uygulama uyduruyor" hissini yok eden detay.
2) Kart anlamları LLM'e uydurulmaz; buradaki anahtar kelimeler + data/tarot_corpus.json
   içindeki uzun anlamlar RAG olarak verilir.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass, asdict

MAJORS_TR: list[tuple[int, str, str, str]] = [
    # (no, TR ad, düz anahtar kelimeler, ters anahtar kelimeler)
    (0, "Joker", "yeni başlangıç, cesaret, saflık, atlayış", "dikkatsizlik, hazırsızlık, risk"),
    (1, "Büyücü", "irade, yaratma gücü, girişim", "manipülasyon, dağınık enerji"),
    (2, "Azize", "sezgi, sır, iç ses", "bastırılmış sezgi, gizlenen bilgi"),
    (3, "İmparatoriçe", "bereket, doğurganlık, şefkat", "tıkanmış üretim, aşırı sahiplenme"),
    (4, "İmparator", "otorite, yapı, sınır", "katılık, baskı, kontrol kaybı"),
    (5, "Başrahip", "gelenek, öğreti, rehber", "dogma, sorgusuz uyum"),
    (6, "Aşıklar", "birleşme, seçim, uyum", "uyumsuzluk, yanlış seçim"),
    (7, "Savaş Arabası", "kararlılık, ilerleme, zafer", "yön kaybı, dağılma"),
    (8, "Güç", "iç güç, sabır, şefkatli hakimiyet", "öfke, kontrolsüzlük"),
    (9, "Ermiş", "içe dönüş, arayış, bilgelik", "yalnızlaşma, kaçış"),
    (10, "Kader Çarkı", "döngü, şans, dönüm noktası", "aksilik, direnç"),
    (11, "Adalet", "denge, doğruluk, sonuç", "haksızlık, önyargı"),
    (12, "Asılan Adam", "bekleme, bakış değişimi, fedakârlık", "boşa geçen süre, inat"),
    (13, "Ölüm", "dönüşüm, bitiş ve yeni sayfa", "geçmişe tutunma, tıkanmış değişim"),
    (14, "Denge", "ölçü, uyum, sabırlı karışım", "aşırılık, dengesizlik"),
    (15, "Şeytan", "bağımlılık, arzu, zincir", "zincirden kurtulma, farkındalık"),
    (16, "Kule", "ani sarsıntı, yıkım, gerçeğin ortaya çıkışı", "ertelenmiş kriz, korku"),
    (17, "Yıldız", "umut, şifa, ilham", "umutsuzluk, inanç kaybı"),
    (18, "Ay", "yanılsama, korku, bilinçaltı", "sisin dağılması, açığa çıkan sır"),
    (19, "Güneş", "netlik, sevinç, başarı", "gecikmiş sevinç, gölgede kalma"),
    (20, "Mahkeme", "uyanış, hesaplaşma, çağrı", "erteleme, iç hesap görmeme"),
    (21, "Dünya", "tamamlanma, bütünlük, ödül", "yarım kalan döngü"),
]

SUITS_TR = {
    "wands": ("Asalar", "ateş, girişim, tutku, hareket"),
    "cups": ("Kupalar", "su, duygu, ilişki, sezgi"),
    "swords": ("Kılıçlar", "hava, akıl, iletişim, çatışma"),
    "pentacles": ("Tılsımlar", "toprak, para, iş, beden"),
}

RANKS_TR = {
    1: ("As", "başlangıç, saf potansiyel"),
    2: ("İki", "denge, ikilem, ortaklık"),
    3: ("Üç", "büyüme, ilk sonuç"),
    4: ("Dört", "durağanlık, güvenlik, sıkışma"),
    5: ("Beş", "kayıp, çatışma, sınav"),
    6: ("Altı", "toparlanma, geçiş, uyum"),
    7: ("Yedi", "değerlendirme, sabır, sınama"),
    8: ("Sekiz", "hız, ustalık, akış"),
    9: ("Dokuz", "yoğunlaşma, eşiğe gelme"),
    10: ("On", "doyum veya yük, döngü sonu"),
    11: ("Uşak", "haber, öğrenme, acemilik"),
    12: ("Şövalye", "hareket, atılım, aşırılık"),
    13: ("Kraliçe", "içselleştirilmiş ustalık, besleyici güç"),
    14: ("Kral", "dışa dönük ustalık, otorite"),
}


@dataclass
class Card:
    key: str
    name_tr: str
    arcana: str          # major | minor
    suit: str | None
    rank: int | None
    reversed: bool
    keywords: str
    element: str | None


def build_deck() -> list[Card]:
    deck: list[Card] = []
    for no, name, up, _down in MAJORS_TR:
        deck.append(Card(f"major_{no}", name, "major", None, no, False, up, None))
    for suit, (suit_tr, suit_desc) in SUITS_TR.items():
        element = suit_desc.split(",")[0]
        for rank, (rank_tr, rank_desc) in RANKS_TR.items():
            deck.append(Card(
                key=f"{suit}_{rank}",
                name_tr=f"{suit_tr} {rank_tr}",
                arcana="minor", suit=suit, rank=rank, reversed=False,
                keywords=f"{rank_desc} / {suit_desc}",
                element=element,
            ))
    return deck  # 22 + 56 = 78


DECK = build_deck()

SPREADS: dict[str, list[str]] = {
    "single": ["Günün kartı"],
    "three_card": ["Geçmiş", "Şimdi", "Gelecek"],
    "situation": ["Durum", "Engel", "Tavsiye", "Sonuç"],
    "love_five": ["Sen", "O", "Aranızdaki bağ", "Engel", "Gidişat"],
    "celtic_cross": [
        "Mevcut durum", "Karşıt güç", "Bilinçli hedef", "Bilinçaltı temel",
        "Geçmiş etki", "Yaklaşan", "Senin duruşun", "Çevre etkisi",
        "Umut ve korku", "Sonuç",
    ],
}


def new_seed() -> str:
    return secrets.token_hex(16)


def draw(spread: str = "three_card", seed: str | None = None,
         reversal_chance: float = 0.35) -> dict:
    """Deterministik çekim. Aynı seed → aynı kartlar (kullanıcı arşivi için şart)."""
    import random

    if spread not in SPREADS:
        spread = "three_card"
    seed = seed or new_seed()
    rng = random.Random(seed)

    positions = SPREADS[spread]
    idxs = rng.sample(range(len(DECK)), len(positions))
    cards = []
    for pos, i in zip(positions, idxs):
        c = DECK[i]
        rev = rng.random() < reversal_chance
        rev_kw = ""
        if c.arcana == "major":
            rev_kw = MAJORS_TR[c.rank][3]
        cards.append({
            "position": pos,
            "key": c.key,
            "name_tr": c.name_tr,
            "arcana": c.arcana,
            "suit": SUITS_TR[c.suit][0] if c.suit else None,
            "reversed": rev,
            "keywords": (rev_kw or f"tersi: {c.keywords}") if rev else c.keywords,
            "element": c.element,
        })
    return {"spread": spread, "seed": seed, "cards": cards}


def llm_context(drawn: dict) -> dict:
    """LLM'e giden sıkıştırılmış hâl."""
    return {
        "acilim": drawn["spread"],
        "kartlar": [
            f"{c['position']}: {c['name_tr']}"
            f"{' (ters)' if c['reversed'] else ''} — {c['keywords']}"
            for c in drawn["cards"]
        ],
    }


if __name__ == "__main__":
    d = draw("love_five")
    print(d["seed"])
    for line in llm_context(d)["kartlar"]:
        print(" -", line)
    # Aynı seed ile tekrar üretilebilirlik kontrolü
    assert draw("love_five", d["seed"]) == d
    print("deterministik: OK, deste boyutu:", len(DECK))
