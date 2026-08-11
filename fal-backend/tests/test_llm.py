import pytest


@pytest.mark.asyncio
async def test_complete_gemini_payload_and_response(monkeypatch):
    from app.core import llm

    captured = {}

    class Response:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return {
                "candidates": [{"content": {"parts": [{"text": '{"ok": true}'}]}}],
                "usageMetadata": {"promptTokenCount": 12, "candidatesTokenCount": 4},
            }

    class Client:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, **kwargs):
            captured.update(url=url, **kwargs)
            return Response()

    monkeypatch.setattr(llm, "API_KEY", "test-key")
    monkeypatch.setattr(llm.httpx, "AsyncClient", Client)

    result = await llm.complete(
        system=[{"type": "text", "text": "Sistem"}],
        user="Fal üret",
        tier="small",
        images=[{"data": "aW1hZ2U=", "media_type": "image/jpeg"}],
    )

    assert result.data == {"ok": True}
    assert result.in_tokens == 12 and result.out_tokens == 4
    assert captured["headers"]["x-goog-api-key"] == "test-key"
    assert captured["url"].endswith(":generateContent")
    assert captured["json"]["system_instruction"]["parts"][0]["text"] == "Sistem"
    assert captured["json"]["contents"][0]["parts"][0]["inline_data"]["data"] == "aW1hZ2U="
    assert captured["json"]["generationConfig"]["responseMimeType"] == "application/json"
