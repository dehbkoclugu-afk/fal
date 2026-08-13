"""LLM çıktısının kullanıcıya görünür içerik garantisi."""

import pytest

from app.core import pipeline


def test_bos_ozet_ilk_bolumden_dolduruluyor():
    out = pipeline._normalize_output({
        "ozet": "  ",
        "bolumler": [{"baslik": "Bugün", "metin": "  Bir haber geliyor.  "}],
        "tavsiye": "",
        "paylasim_cumlesi": "",
    })

    assert out["ozet"] == "Bir haber geliyor."
    assert out["paylasim_cumlesi"] == "Bir haber geliyor."


def test_bos_bolumler_ve_tahminler_ayiklaniyor():
    out = pipeline._normalize_output({
        "ozet": "Özet",
        "bolumler": [{"baslik": "Boş", "metin": " "}, None],
        "tahminler": [{"iddia": ""}, {"iddia": "Mesaj gelecek", "pencere_gun": 7}],
        "tavsiye": None,
    })

    assert out["bolumler"] == []
    assert [t["iddia"] for t in out["tahminler"]] == ["Mesaj gelecek"]


def test_gorunur_metni_olmayan_cikti_reddediliyor():
    with pytest.raises(pipeline.ReadingRejected) as exc:
        pipeline._normalize_output({
            "ozet": "",
            "bolumler": [],
            "tahminler": [{"iddia": "Belirsiz tahmin"}],
            "tavsiye": " ",
        })

    assert exc.value.code == "empty_output"

