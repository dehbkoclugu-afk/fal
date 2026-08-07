"""
Sahte LLM sunucusu — Anthropic Messages API sözleşmesini taklit eder.

Amacı ürünü uçtan uca çalıştırabilmek: LLM anahtarı olmadan da fal üretimi,
kuyruk, tahmin ayıklama, vision etiketleme ve anti-tekrar yolları denenebilir.
Testlerde de, ilk kurulumda da para harcanmıyor.

scripts/dev.sh bunu LLM_API_KEY tanımlı değilse otomatik başlatıyor.
SADECE GELİŞTİRME İÇİN — ürettiği metinler sabit kalıplardır.
"""
import json, random
from fastapi import FastAPI, Request
import uvicorn

app = FastAPI()
IMGE = ["eşikte bekleyen bir kapı","dolunayda açılan bir yol","suya düşen bir anahtar",
        "kanadı yeni kurumuş bir kuş","iki yakayı bağlayan ince bir köprü"]

@app.post("/v1/messages")
async def messages(req: Request):
    body = await req.json()
    sys_txt = json.dumps(body.get("system",""), ensure_ascii=False)
    user_txt = "".join(c.get("text","") for m in body["messages"]
                       if m["role"]=="user" for c in (m["content"] if isinstance(m["content"],list) else []))
    if "metin" in sys_txt and "SADECE JSON" in sys_txt:        # doğrulama takip yorumu
        tuttu = "tuttu" in user_txt and "tutmadı" not in user_txt
        data = {"metin": ("Bunu görmek beni de şaşırtmadı — göstergeler bu yöne "
                          "işaret ediyordu. Aynı hat önümüzdeki haftalarda güçleniyor.")
                if tuttu else
                ("Tutmadığını söylemen değerli. Bu tür göstergeler gecikmeli "
                 "çalışabiliyor; pencereyi kapatmadan izlemeye devam edelim.")}
    elif "FARKLI paragraf" in sys_txt or "variants" in sys_txt:  # blok tohumlama
        kosul = ""
        for satir in user_txt.split("\n"):
            if satir.startswith("Koşul:"):
                kosul = satir.split(":", 1)[1].strip()
        acilar = ["bu koşul senin zeminini belirliyor", "burada bir gerilim var ama verimli",
                  "bu yerleşim sana zaman kazandırıyor", "burası senin tekrar eden dersin"]
        data = {"variants": [
            f"[{kosul}] {a}. Bu, gündelik hayatta kendini fark edilmeden kuran bir "
            f"örüntü olarak gösteriyor. Aceleye getirmediğin sürece lehine işliyor. "
            f"(yerel geliştirme metni, varyant {i+1})"
            for i, a in enumerate(acilar)]}
    elif "Sözlük:" in sys_txt and "labels" in sys_txt:          # vision etiketleme
        data = {"labels":[{"label":random.choice(["kuş","yol","kalp","göz","balık"]),
                           "confidence":round(random.uniform(0.45,0.9),2)}]}
    elif "kalıcı bilgi" in sys_txt or "items" in sys_txt:     # hafıza
        data = {"items":[]}
    elif "PARÇALAR" in user_txt or "parçaları" in sys_txt:    # hibrit stitch
        data = {"ozet":"Bugün zemin sağlam.","metin":"Telve durgun ama kenarda kıpırtı var.",
                "tavsiye":"Acele etme.","tahmin":{"konu":"genel","iddia":"Küçük bir haber gelecek",
                "pencere_gun":7,"guven":"orta"}}
    else:                                                      # normal fal
        im = random.choice(IMGE)
        data = {"ozet":f"Fincanında {im} var.",
                "bolumler":[{"baslik":"Yakın gelecek","metin":f"Sapın hemen sağında {im} duruyor; bu, ertelediğin bir konuşmanın kendiliğinden açılacağına işaret."},
                            {"baslik":"Zemin","metin":"Dipteki koyuluk geçmişin ağırlığı, ama kenara doğru inceliyor."}],
                "tahminler":[{"konu":"ask","iddia":f"Beklemediğin bir mesaj alacaksın ({random.randint(1,999)})","pencere_gun":10,"guven":"orta"},
                             {"konu":"is","iddia":f"Bir işbirliği önerisi gelecek ({random.randint(1,999)})","pencere_gun":14,"guven":"dusuk"}],
                "tavsiye":"Kapıyı aralık bırak.","sembol":"kuş",
                "paylasim_cumlesi":f"Fincanımda {im} çıktı."}
    txt = json.dumps(data, ensure_ascii=False)
    return {"content":[{"type":"text","text":txt[1:]}],   # prefill "{" telafisi
            "usage":{"input_tokens":520,"output_tokens":240,
                     "cache_read_input_tokens":400,"cache_creation_input_tokens":0}}


@app.post("/v1/embeddings")
async def embeddings(req: Request):
    """Deterministik sahte embedding — metne göre 384 boyut."""
    import hashlib
    body = await req.json()
    h = hashlib.sha256(body["input"].encode()).digest()
    vec = [((h[i % len(h)] ^ (i * 7 & 0xFF)) / 255.0) - 0.5 for i in range(384)]
    return {"data": [{"embedding": vec}]}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8899, log_level="error")
