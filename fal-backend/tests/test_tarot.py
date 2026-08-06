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
