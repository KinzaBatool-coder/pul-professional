"""Single source of truth for supported languages."""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Language:
    code: str
    name: str
    native: str
    rtl: bool
    whisper: str                       # language hint for speech recognition
    nllb: str | None                   # NLLB code (None = unsupported offline)
    gtts: str                          # backup TTS language
    voices: dict = field(default_factory=dict)   # Edge neural voices by gender
    note: str = ""                     # shown to the user when relevant


LANGUAGES: dict[str, Language] = {
    "en": Language("en", "English", "English", False, "en", "eng_Latn", "en",
                   {"f": "en-US-AriaNeural", "m": "en-US-GuyNeural"}),
    "ur": Language("ur", "Urdu", "اردو", True, "ur", "urd_Arab", "ur",
                   {"f": "ur-PK-UzmaNeural", "m": "ur-PK-AsadNeural"}),
    "skr": Language("skr", "Saraiki", "سرائیکی", True, "ur", None, "ur",
                    {"f": "ur-PK-UzmaNeural", "m": "ur-PK-AsadNeural"},
                    note="No dedicated Saraiki voice or speech model exists yet. "
                         "Voice input is recognised as Urdu and the output is read "
                         "by an Urdu voice, so the accent will be approximate."),
}
