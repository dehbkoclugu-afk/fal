"""
Jeton fiyatları ve harcama tavanı.

Ayrı dosyada tutulmasının sebebi: worker'ın iade (refund) yapmak için bu tabloya
ihtiyacı var, ama `app.main`'i import etmesi gerekmemeli — bu import worker
sürecinde tüm FastAPI uygulamasını ayağa kaldırır.
"""

from __future__ import annotations

COIN_PRICES = {"coffee": 3, "tarot": 1, "natal": 5, "daily": 0}

# Kumar döngüsü önlemi ve aynı zamanda iade/chargeback önlemi.
# Kaldırma: günde sınırsız harcama, bu kategoride iade dalgası demek.
DAILY_SPEND_CAP = 25
