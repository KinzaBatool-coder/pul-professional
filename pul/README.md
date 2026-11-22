# Pul پُل — AI Voice Translator (English · Urdu · Saraiki)

Type or speak in one language, get the translation as **text and AI voice** in another.
Any direction works: English ⇄ Urdu ⇄ Saraiki.

```
Mic ──▶ Whisper (speech→text) ──▶ Claude / NLLB (translation) ──▶ Edge neural voice (text→speech)
```

## Project structure
```
pul/
├── main.py                  # entry point
├── requirements.txt         # core dependencies
├── requirements-offline.txt # optional offline EN<->UR engine
├── .env.example             # settings template
├── app/
│   ├── config.py            # environment settings
│   ├── languages.py         # languages, voices, codes
│   ├── factory.py           # FastAPI app setup
│   ├── api/routes.py        # /api/translate, /api/speak, /api/languages, /api/health
│   └── services/
│       ├── stt.py           # Whisper speech recognition
│       ├── translator.py    # Claude translation + NLLB fallback
│       └── tts.py           # Edge voices + gTTS backup
└── static/
    ├── index.html
    ├── css/styles.css
    └── js/ (app.js, api.js, recorder.js)
```

## Setup (Python 3.10+)
```bash
python -m venv venv
venv\Scripts\activate            # Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
copy .env.example .env           # Mac/Linux: cp .env.example .env
# open .env and put your ANTHROPIC_API_KEY
python main.py
```
Open **http://localhost:8000** (Chrome or Edge). Mic works only on localhost/https.

## Why translation is now accurate
The old version used a small offline model (NLLB-600M) which fails on short words like "hello"
and does not know Saraiki at all. Translation now uses Claude, which handles greetings, full
sentences and Saraiki. Without an API key the app falls back to NLLB for English ⇄ Urdu only.

## Saraiki — honest limits
* **Text translation:** supported through Claude.
* **Voice input:** Whisper has no Saraiki model, so speech is recognised as Urdu. Close, but not perfect.
* **Voice output:** no Saraiki neural voice exists in Edge/Google; an Urdu voice reads the Saraiki text.
For best Saraiki results use typed input. A true Saraiki voice would need a custom-trained TTS model.

## Tips
| Problem | Fix |
|---|---|
| Urdu speech recognised badly | `WHISPER_MODEL=medium` (or `large-v3` with GPU: `WHISPER_DEVICE=cuda`) |
| No voice | Edge voices need internet; gTTS backup is used automatically if Edge fails |
| Slow first start | Whisper downloads once; set `WHISPER_MODEL=base` for speed |
| Offline mode | `pip install -r requirements-offline.txt` and `TRANSLATOR=nllb` (no Saraiki) |

## API
`POST /api/translate` — form: `src`, `dst` (`en|ur|skr`), `text` or `audio`, `speak`, `gender`, `rate`
→ `{transcript, translation, audio, engine, warnings, ms}`
`POST /api/speak` — form: `text`, `lang`, `gender`, `rate` → `{audio}`
