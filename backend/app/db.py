from __future__ import annotations

from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import DATABASE_URL


class Base(DeclarativeBase):
    pass


connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

BACKEND_DIR = Path(__file__).resolve().parents[1]
ALEMBIC_CONFIG_PATH = BACKEND_DIR / "alembic.ini"
MIGRATIONS_DIR = BACKEND_DIR / "migrations"


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrate_database() -> None:
    """Apply the checked-in Alembic migrations to the configured database."""
    # Import models before Alembic loads its environment so metadata and the
    # migration target use the same table definitions as the application.
    from . import models  # noqa: F401
    from alembic import command
    from alembic.config import Config

    config = Config(str(ALEMBIC_CONFIG_PATH))
    # The app can be launched from the repository root or from backend/. Use
    # absolute paths so startup does not depend on the current working folder.
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    config.set_main_option("sqlalchemy.url", DATABASE_URL.replace("%", "%%"))
    command.upgrade(config, "head")


def create_tables() -> None:
    """Create tables directly for legacy tooling and migration bootstrapping."""
    # Import models before create_all so SQLAlchemy knows every mapped table.
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
