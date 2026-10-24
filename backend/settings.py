from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.5-flash-lite"
    database_url: str = f"sqlite:///{(BACKEND_DIR / 'data' / 'learn45.sqlite3').as_posix()}"
    uploads_dir: Path = BACKEND_DIR / "data" / "uploads"
    max_upload_mb: int = 30
    cors_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    return settings
