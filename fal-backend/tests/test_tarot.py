"""Tarot destesi ve çekim determinizmi."""

from __future__ import annotations

import pytest

from app.core import tarot


def test_deste_78_kart_ve_tekil():
    deck = tarot.build_deck()
    assert len(deck) == 78
    assert len({c.name_tr for c in deck}) == 78


def test_deste_22_major_56_minor():
    deck = tarot.build_deck()
    majors = [c for c in deck if c.arcana == "major"]
    assert len(majors) == 22
    assert len(deck) - len(majors) == 56


def test_ayni_seed_ayni_cekim():
    """Arşiv özelliği buna bağlı: kullanıcı geçmiş falını açtığında AYNI
    kartları görmeli. Seed kaydedilip çekim yeniden üretilebiliyor."""
    a = tarot.draw("three_card", seed="deneme-123")
    b = tarot.draw("three_card", seed="deneme-123")
    assert a == b


def test_farkli_seed_farkli_cekim():
    a = tarot.draw("three_card", seed="a")
    b = tarot.draw("three_card", seed="b")
    assert a != b


def test_seedsiz_cekim_rastgele():
    draws = {str(tarot.draw("three_card")) for _ in range(12)}
    assert len(draws) > 1, "seed verilmeden yapılan çekimler aynı çıkıyor"


@pytest.mark.parametrize("spread", list(tarot.SPREADS))
def test_her_acilim_dogru_sayida_ve_tekrarsiz_kart(spread):
    drawn = tarot.draw(spread, seed="sabit")
    cards = drawn["cards"]
    assert len(cards) == len(tarot.SPREADS[spread])
    isimler = [c["name_tr"] for c in cards]
    assert len(isimler) == len(set(isimler)), "aynı kart iki pozisyonda çıkamaz"


@pytest.mark.parametrize("spread", list(tarot.SPREADS))
def test_pozisyon_etiketleri_acilimla_esleşiyor(spread):
    drawn = tarot.draw(spread, seed="sabit")
    assert [c["position"] for c in drawn["cards"]] == tarot.SPREADS[spread]


def test_ters_kart_uretiliyor():
    """Ters kart olasılığı sıfırlanmışsa açılımın yarısı anlam kaybeder."""
    tersler = sum(
        1 for i in range(60)
        for c in tarot.draw("three_card", seed=f"s{i}")["cards"] if c["reversed"]
    )
    assert tersler > 0


def test_llm_context_kart_ve_pozisyon_iceriyor():
    ctx = tarot.llm_context(tarot.draw("three_card", seed="x"))
    assert ctx
    metin = str(ctx)
    for c in tarot.draw("three_card", seed="x")["cards"]:
        assert c["name_tr"] in metin


def test_bilinmeyen_acilim_uc_karta_dusuyor():
    """Kütüphane seviyesinde savunmacı davranış: çekim asla patlamaz.
    Sıkı doğrulama API sınırında (TarotIn.spread) yapılır — bkz. test_api."""
    drawn = tarot.draw("olmayan_acilim", seed="x")
    assert drawn["spread"] == "three_card"
    assert len(drawn["cards"]) == 3


def test_seed_cikti_icinde_kayitli():
    """extra_json'a yazılıp sonra yeniden üretilebilmesi için."""
    drawn = tarot.draw("three_card", seed="kayitli-seed")
    assert drawn.get("seed") == "kayitli-seed"


def test_new_seed_benzersiz():
    assert len({tarot.new_seed() for _ in range(50)}) == 50


def test_gorsel_deste_secimi_gercek_cekimi_belirliyor():
    a = tarot.draw("three_card", seed="masa-42", selections=[2, 8, 11])
    b = tarot.draw("three_card", seed="masa-42", selections=[2, 8, 11])
    c = tarot.draw("three_card", seed="masa-42", selections=[1, 8, 11])
    assert a == b
    assert a["cards"] != c["cards"]
    assert a["selections"] == [2, 8, 11]


@pytest.mark.parametrize("selections", ([1, 1, 2], [0, 1], [0, 1, 12]))
def test_gecersiz_gorsel_secim_reddediliyor(selections):
    with pytest.raises(ValueError):
        tarot.draw("three_card", seed="masa", selections=list(selections))


# ------------------------------------------------------------- kart korpusu

def test_korpus_tum_minorleri_kapsiyor():
    """Eksik kart şablona düşer ve geleneksel anlamı ıskalayabilir."""
    from app.core.tarot import MINOR_CORPUS, RANKS_TR, SUITS_TR

    assert len(MINOR_CORPUS) == 56
    for suit in SUITS_TR:
        for rank in RANKS_TR:
            k = f"{suit}_{rank}"
            assert k in MINOR_CORPUS, k
            assert MINOR_CORPUS[k]["duz"] and MINOR_CORPUS[k]["ters"], k


def test_minor_kartlar_karta_ozel_anlam_tasiyor():
    """Regresyon: anlamlar suit × rank şablonundan üretiliyordu. Kılıçlar On
    şablonda "doyum veya yük" çıkıyordu; geleneksel anlamı "dip nokta,
    ihanet". Aynı rank'in farklı suit'lerde aynı metni taşımaması gerekiyor."""
    from app.core.tarot import DECK

    kartlar = {c.key: c for c in DECK}
    assert "dip nokta" in kartlar["swords_10"].keywords
    assert "çıraklık" in kartlar["pentacles_8"].keywords

    # Aynı rank, farklı suit → farklı anlam
    for rank in (1, 5, 10, 14):
        metinler = {kartlar[f"{s}_{rank}"].keywords.split(" / ")[0]
                    for s in ("wands", "cups", "swords", "pentacles")}
        assert len(metinler) == 4, f"rank {rank} şablondan geliyor: {metinler}"


def test_ters_minor_karta_ozel_anlam_veriyor():
    from app.core.tarot import MINOR_CORPUS, draw

    bulundu = False
    for i in range(60):
        for c in draw("celtic_cross", seed=f"s{i}")["cards"]:
            if c["reversed"] and c["arcana"] == "minor":
                assert c["keywords"] == MINOR_CORPUS[c["key"]]["ters"], c["name_tr"]
                bulundu = True
    assert bulundu, "60 çekimde tek ters minör kart çıkmadı"


def test_korpus_yoksa_akis_kirilmiyor(monkeypatch):
    """Korpus dosyası silinse bile deste kurulmalı — şablona düşer."""
    import app.core.tarot as t

    monkeypatch.setattr(t, "MINOR_CORPUS", {})
    deck = t.build_deck()
    assert len(deck) == 78
    assert all(c.keywords for c in deck)
