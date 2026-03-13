from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./banker.db"
    anthropic_api_key: str = ""
    data_dir: str = "./data"

    model_config = {"env_file": ".env"}


settings = Settings()
