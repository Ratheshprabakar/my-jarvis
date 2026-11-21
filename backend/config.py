"""
Application configuration loaded from environment variables.
Copy .env.example → .env and fill in your credentials.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Agora
    agora_app_id: str = "your_app_id"
    # Leave empty ("") if your project is in Testing Mode (no certificate generated).
    # Only set this when you have enabled App Certificate in the Agora console.
    agora_app_certificate: str = ""
    agora_customer_id: str = ""
    agora_customer_secret: str = ""
    agora_agent_uid: int = 10001

    # LLM: "managed" = Agora-hosted OpenAI (works out of the box).
    # "custom" = your OpenAI-compatible URL (CURSOR_API_URL + CURSOR_API_KEY).
    # Note: Cursor Cloud API is agents-only — it is NOT OpenAI chat completions.
    llm_mode: str = "managed"
    cursor_api_url: str = "https://api.openai.com/v1/chat/completions"
    cursor_api_key: str = ""
    cursor_model: str = "gpt-4o-mini"

    # TTS: "managed" = Agora-hosted MiniMax (reliable). "murf" = Murf Falcon BYOK.
    # Falcon streaming voice IDs are names like Natalie / Matthew (not en-US-natalie).
    tts_mode: str = "managed"
    murf_api_key: str = ""
    murf_voice_id: str = "Natalie"
    murf_style: str = "Conversational"
    murf_model: str = "falcon-2.1"

    # Backend public URL (must be reachable by Agora for tool calls)
    backend_public_url: str = "http://localhost:8000"

    # Google Calendar (OAuth)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/google/callback"
    # Optional: paste refresh token instead of going through browser OAuth
    google_refresh_token: str = ""
    google_calendar_id: str = "primary"
    google_calendar_timezone: str = "Asia/Kolkata"

    # Demo employee context
    demo_employee_name: str = "Alex Johnson"
    demo_employee_role: str = "Senior Software Engineer"
    demo_employee_team: str = "Platform Engineering"


@lru_cache
def get_settings() -> Settings:
    return Settings()
