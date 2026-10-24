from collections.abc import Generator
from pathlib import Path

from sqlalchemy import inspect
from sqlalchemy.engine import make_url
from sqlmodel import Session, SQLModel, create_engine

from settings import get_settings


def make_database_engine():
    settings = get_settings()
    url = make_url(settings.database_url)
    if url.drivername.startswith("sqlite") and url.database and url.database != ":memory:":
        Path(url.database).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
    connect_args = {"check_same_thread": False} if url.drivername.startswith("sqlite") else {}
    return create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)


engine = make_database_engine()


def create_db_and_tables() -> None:
    from models import Attempt, Learner, Question, Source, Topic, TopicNode  # noqa: F401

    SQLModel.metadata.create_all(engine)
    # Keep existing local MVP databases usable as the question model grows.
    # create_all creates new tables but does not add columns to an existing table.
    columns = {column["name"] for column in inspect(engine).get_columns("question")}
    with engine.begin() as connection:
        if "question_type" not in columns:
            connection.exec_driver_sql("ALTER TABLE question ADD COLUMN question_type VARCHAR NOT NULL DEFAULT 'short-answer'")
        if "content" not in columns:
            connection.exec_driver_sql("ALTER TABLE question ADD COLUMN content JSON NOT NULL DEFAULT '{}'")
    with Session(engine) as session:
        if session.get(Learner, 1) is None:
            session.add(Learner(id=1, name="Lea", weekly_goal_minutes=120))
            session.commit()


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
