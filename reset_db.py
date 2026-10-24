"""Reset all local backend development data to its initial state."""

import argparse
import shutil
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
VENV_PYTHON = BACKEND_DIR / ".venv" / "bin" / "python"
if VENV_PYTHON.is_file() and Path(sys.prefix).resolve() != VENV_PYTHON.parent.parent.resolve():
    import os

    os.execv(str(VENV_PYTHON), [str(VENV_PYTHON), __file__, *sys.argv[1:]])

sys.path.insert(0, str(BACKEND_DIR))

try:
    from db import create_db_and_tables, engine  # noqa: E402
    from settings import get_settings  # noqa: E402
    from sqlalchemy.engine import make_url  # noqa: E402
except ModuleNotFoundError as error:
    if error.name in {"sqlalchemy", "sqlmodel", "pydantic_settings"}:
        raise SystemExit(
            "Backend dependencies are missing. From the repository root, set them up with:\n"
            "  python3 -m venv backend/.venv\n"
            "  backend/.venv/bin/python -m pip install -r backend/requirements.txt\n"
            "Then run: python3 reset_db.py"
        ) from error
    raise


def local_data_paths() -> tuple[Path, Path]:
    data_dir = (BACKEND_DIR / "data").resolve()
    settings = get_settings()
    url = make_url(settings.database_url)
    if not url.drivername.startswith("sqlite") or not url.database or url.database == ":memory:":
        raise SystemExit("Refusing to reset: DATABASE_URL must point to a local SQLite file.")

    database_path = Path(url.database).expanduser()
    if not database_path.is_absolute():
        database_path = Path.cwd() / database_path
    database_path = database_path.resolve()
    if database_path == data_dir or not database_path.is_relative_to(data_dir):
        raise SystemExit(f"Refusing to reset database outside {data_dir}: {database_path}")

    uploads_dir = settings.uploads_dir.expanduser().resolve()
    if uploads_dir == data_dir or not uploads_dir.is_relative_to(data_dir):
        raise SystemExit(f"Refusing to clear uploads outside {data_dir}: {uploads_dir}")
    if database_path.is_relative_to(uploads_dir):
        raise SystemExit("Refusing to reset: the database file cannot be inside the uploads directory.")
    return database_path, uploads_dir


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Delete local backend development records and uploads, then recreate the starter learner."
    )
    parser.add_argument("--yes", action="store_true", help="skip the interactive RESET confirmation")
    args = parser.parse_args()

    database_path, uploads_dir = local_data_paths()
    if not args.yes:
        print("This permanently deletes all backend development records and uploaded source files:")
        print(f"  Database: {database_path}")
        print(f"  Uploads:  {uploads_dir}")
        if input("Type RESET to continue: ").strip() != "RESET":
            raise SystemExit("Reset cancelled.")

    engine.dispose()
    for path in (database_path, Path(f"{database_path}-wal"), Path(f"{database_path}-shm")):
        path.unlink(missing_ok=True)
    if uploads_dir.exists():
        shutil.rmtree(uploads_dir)
    uploads_dir.mkdir(parents=True, exist_ok=True)

    create_db_and_tables()
    print("Development data reset. The starter learner has been recreated.")


if __name__ == "__main__":
    main()
