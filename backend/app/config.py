from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://signallens:signallens@localhost:5432/signallens"
    cors_origins: str = "http://localhost:3000"
    environment: str = "development"  # development | staging | production
    seed_on_start: bool = True  # False in prod
    real_ingestion_mode: bool = False  # Hide seeded mock risk signals from read APIs
    redis_url: str = "redis://localhost:6379/0"
    anthropic_api_key: str = ""
    anthropic_extraction_model: str = "claude-sonnet-4-6"
    anthropic_summary_model: str = "claude-haiku-4-5-20251001"
    anthropic_copilot_model: str = "claude-opus-4-8"
    openai_api_key: str = ""
    openai_embedding_model: str = "text-embedding-3-small"
    secret_key: str = "dev-secret-change-in-prod"  # JWT signing
    clickhouse_url: str = ""  # optional
    sentry_dsn: str = ""  # optional
    alert_webhook_url: str = ""  # optional fallback webhook for alerts
    alert_from_email: str = "alerts@signallens.local"
    smtp_host: str = ""  # optional; when unset, email alerts are logged only
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    log_level: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


settings = Settings()
