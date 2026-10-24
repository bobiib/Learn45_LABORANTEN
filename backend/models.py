from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Column, JSON, Text
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Learner(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = "Lea"
    weekly_goal_minutes: int = 120


class Topic(SQLModel, table=True):
    id: str = Field(primary_key=True)
    title: str
    subject: str = "Learning topic"
    description: str = ""
    progress: int = 0
    context: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class Source(SQLModel, table=True):
    id: str = Field(primary_key=True)
    topic_id: str = Field(foreign_key="topic.id", index=True)
    name: str
    kind: str
    size_bytes: int
    storage_path: str
    extracted_text: str = Field(default="", sa_column=Column(Text, nullable=False))
    added_at: datetime = Field(default_factory=utc_now)


class TopicNode(SQLModel, table=True):
    id: str = Field(primary_key=True)
    topic_id: str = Field(foreign_key="topic.id", index=True)
    label: str
    description: str
    prerequisites: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    progress: int = 0
    evidence: dict[str, int] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    ordinal: int = 0


class Question(SQLModel, table=True):
    id: str = Field(primary_key=True)
    topic_id: str = Field(foreign_key="topic.id", index=True)
    node_id: str = Field(foreign_key="topicnode.id", index=True)
    title: str
    prompt: str = Field(sa_column=Column(Text, nullable=False))
    stage: str
    question_type: str = "short-answer"
    content: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    mode: str = "Solo"
    duration_minutes: int = 5
    ordinal: int = 0


class Attempt(SQLModel, table=True):
    id: str = Field(primary_key=True)
    question_id: str = Field(foreign_key="question.id", index=True)
    answer: str = Field(sa_column=Column(Text, nullable=False))
    hints_used: int = 0
    tutor_used: bool = False
    difficulty: str | None = None
    review: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=utc_now, index=True)
