#!/usr/bin/env python3
"""Load a JSON array of history objects into the stories table.

Put the array in scripts/stories.json (or pass another file), then:

    python3 -m venv .venv
    .venv/bin/pip install -r scripts/requirements.txt
    npm run db:tunnel
    .venv/bin/python scripts/import_stories.py

Re-running updates a story that already has the same slug. Media rows are left
alone. Pass --status draft to keep new rows off the public site, or --dry-run
to validate without writing.

Fields that have no column (reelVoiceover, visualDisclosure) are not stored.
location and timeline are appended to the article body.
"""

from __future__ import annotations

import argparse
import calendar
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = Path(__file__).resolve().parent / "stories.json"
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class StoryError(Exception):
    pass


def main() -> int:
    parser = argparse.ArgumentParser(description="Import stories from a JSON array.")
    parser.add_argument(
        "path",
        nargs="?",
        default=str(DEFAULT_INPUT),
        help=f"JSON file with an array of stories (default: {DEFAULT_INPUT.name})",
    )
    parser.add_argument("--status", choices=("draft", "published"), default="published")
    parser.add_argument("--dry-run", action="store_true", help="Validate only, do not write")
    args = parser.parse_args()

    items = load_items(Path(args.path))
    if not items:
        print("No stories in the file.")
        return 1

    prepared: list[dict] = []
    errors = 0
    for index, item in enumerate(items, start=1):
        try:
            prepared.append(prepare(item, args.status))
        except StoryError as error:
            errors += 1
            label = item.get("slug") if isinstance(item, dict) else None
            print(f"skip #{index} ({label or 'no slug'}): {error}", file=sys.stderr)

    if errors:
        print(f"{errors} story(ies) failed validation.", file=sys.stderr)
        return 1

    if args.dry_run:
        for story in prepared:
            print(f"ok {story['slug']}  {story['title']}")
        print(f"dry-run: {len(prepared)} story(ies) valid, nothing written")
        return 0

    try:
        import pymysql
    except ImportError:
        print(
            "pymysql is not installed. From the backend directory, run:\n"
            "  python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt\n"
            "  .venv/bin/python scripts/import_stories.py",
            file=sys.stderr,
        )
        return 1

    try:
        connection = connect(pymysql)
    except Exception as error:  # noqa: BLE001 — surface the driver error as-is
        print(f"database: {error}", file=sys.stderr)
        print("Is the SSH tunnel running? Start it with: npm run db:tunnel", file=sys.stderr)
        return 1

    inserted = 0
    updated = 0
    try:
        with connection.cursor() as cursor:
            for story in prepared:
                existed = upsert(cursor, story)
                if existed:
                    updated += 1
                    print(f"updated {story['slug']}")
                else:
                    inserted += 1
                    print(f"inserted {story['slug']}")
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    print(f"done: inserted={inserted} updated={updated}")
    return 0


def load_items(path: Path) -> list:
    if not path.is_file():
        raise SystemExit(f"File not found: {path}\nPut a JSON array in scripts/stories.json")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise SystemExit(f"{path}: invalid JSON ({error})") from error

    if isinstance(data, dict) and isinstance(data.get("stories"), list):
        data = data["stories"]
    elif isinstance(data, dict):
        data = [data]
    if not isinstance(data, list):
        raise SystemExit(f"{path}: expected a JSON array of story objects")
    return data


def prepare(item: object, status: str) -> dict:
    if not isinstance(item, dict):
        raise StoryError("each entry must be an object")

    slug = text(item.get("slug"), "slug")
    title = text(item.get("title"), "title")
    summary = text(item.get("excerpt") or item.get("summary"), "excerpt")
    event_date = parse_date(text(item.get("eventDate"), "eventDate"))
    story_type = optional_text(item.get("type"))

    if not SLUG_RE.fullmatch(slug) or len(slug) > 191:
        raise StoryError("slug can use lowercase letters, numbers, and hyphens")
    require_len(title, 191, "title")
    require_len(summary, 10000, "excerpt")
    if story_type and len(story_type) > 191:
        raise StoryError("type is too long")

    body = build_body(item)
    if not body:
        raise StoryError("story needs at least one section")
    if len(body) > 200:
        raise StoryError("story has too many sections")

    sources = build_sources(item.get("sources") or [])
    notes = []
    if optional_text(item.get("reelVoiceover")):
        notes.append("reelVoiceover")
    if optional_text(item.get("visualDisclosure")):
        notes.append("visualDisclosure")
    if notes:
        print(f"note {slug}: not stored ({', '.join(notes)})")

    return {
        "slug": slug,
        "title": title,
        "summary": summary,
        "body": json.dumps(body, ensure_ascii=False),
        "event_date": event_date,
        "type": story_type,
        "status": status,
        "sources": sources,
    }


def build_body(item: dict) -> list[dict]:
    blocks: list[dict] = []
    sections = item.get("story") or []
    if not isinstance(sections, list):
        raise StoryError("story must be an array")

    for section in sections:
        if not isinstance(section, dict):
            raise StoryError("each story section must be an object")
        heading = optional_text(section.get("heading"))
        paragraph = optional_text(section.get("text"))
        if heading:
            require_len(heading, 20000, "heading")
            blocks.append({"type": "heading", "text": heading})
        if paragraph:
            require_len(paragraph, 20000, "paragraph")
            blocks.append({"type": "paragraph", "text": paragraph})
        if not heading and not paragraph:
            raise StoryError("each story section needs a heading or text")

    timeline = item.get("timeline") or []
    if timeline:
        if not isinstance(timeline, list):
            raise StoryError("timeline must be an array")
        blocks.append({"type": "heading", "text": "Timeline"})
        for entry in timeline:
            if not isinstance(entry, dict):
                raise StoryError("each timeline entry must be an object")
            date = optional_text(entry.get("date")) or ""
            event = optional_text(entry.get("event")) or ""
            line = " — ".join(part for part in (date, event) if part)
            if not line:
                raise StoryError("each timeline entry needs a date or event")
            blocks.append({"type": "paragraph", "text": line})

    location = optional_text(item.get("location"))
    if location:
        blocks.append({"type": "heading", "text": "Location"})
        blocks.append({"type": "paragraph", "text": location})

    return blocks


def build_sources(raw: object) -> list[dict]:
    if not isinstance(raw, list):
        raise StoryError("sources must be an array")
    if len(raw) > 50:
        raise StoryError("too many sources")

    sources = []
    seen: set[str] = set()
    for source in raw:
        if not isinstance(source, dict):
            raise StoryError("each source must be an object")
        url = text(source.get("url"), "source url")
        if not url.startswith(("http://", "https://")) or len(url) > 512:
            raise StoryError(f"source URL must be http(s) and at most 512 characters: {url}")
        if url in seen:
            raise StoryError(f"duplicate source URL: {url}")
        seen.add(url)

        if source.get("title") and source.get("publisher"):
            title = text(source.get("title"), "source title")
            publisher = text(source.get("publisher"), "source publisher")
        else:
            name = text(source.get("name") or source.get("title"), "source name")
            title, publisher = split_source_name(name, url)

        require_len(title, 191, "source title")
        require_len(publisher, 191, "source publisher")
        sources.append({"title": title, "url": url, "publisher": publisher})
    return sources


def split_source_name(name: str, url: str) -> tuple[str, str]:
    for separator in (" — ", " – ", " - "):
        if separator in name:
            publisher, title = (part.strip() for part in name.split(separator, 1))
            if publisher and title:
                return title, publisher
    host = urlparse(url).hostname or ""
    if host.startswith("www."):
        host = host[4:]
    return name, host or name


def upsert(cursor, story: dict) -> bool:
    cursor.execute("SELECT id FROM stories WHERE slug = %s", (story["slug"],))
    existing = cursor.fetchone()

    if existing:
        story_id = existing["id"]
        cursor.execute(
            """
            UPDATE stories
            SET title = %s,
                summary = %s,
                body = %s,
                event_date = %s,
                type = %s,
                status = %s,
                published_at = IF(%s = 'published', COALESCE(published_at, NOW(3)), NULL),
                updated_at = NOW(3)
            WHERE id = %s
            """,
            (
                story["title"],
                story["summary"],
                story["body"],
                story["event_date"],
                story["type"],
                story["status"],
                story["status"],
                story_id,
            ),
        )
    else:
        cursor.execute(
            """
            INSERT INTO stories (
                slug, title, summary, body, event_date, type,
                status, published_at, created_at, updated_at
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s,
                IF(%s = 'published', NOW(3), NULL),
                NOW(3), NOW(3)
            )
            """,
            (
                story["slug"],
                story["title"],
                story["summary"],
                story["body"],
                story["event_date"],
                story["type"],
                story["status"],
                story["status"],
            ),
        )
        story_id = cursor.lastrowid

    cursor.execute("DELETE FROM story_sources WHERE story_id = %s", (story_id,))
    for source in story["sources"]:
        cursor.execute(
            """
            INSERT INTO story_sources (story_id, title, url, publisher)
            VALUES (%s, %s, %s, %s)
            """,
            (story_id, source["title"], source["url"], source["publisher"]),
        )
    return existing is not None


def connect(pymysql):
    load_env(ROOT / ".env")
    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        raise SystemExit("DATABASE_URL is missing. Copy backend/.env.example to backend/.env.")

    parsed = urlparse(database_url)
    if parsed.scheme not in ("mysql", "mysql2"):
        raise SystemExit("DATABASE_URL must start with mysql://")
    if not parsed.hostname or not parsed.path or parsed.path == "/":
        raise SystemExit("DATABASE_URL is missing a host or database name")

    return pymysql.connect(
        host=parsed.hostname,
        port=parsed.port or 3306,
        user=unquote(parsed.username or ""),
        password=unquote(parsed.password or ""),
        database=unquote(parsed.path.lstrip("/")),
        charset="utf8mb4",
        autocommit=False,
        cursorclass=pymysql.cursors.DictCursor,
    )


def load_env(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        os.environ.setdefault(key.strip(), value)


def parse_date(value: str) -> str:
    match = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", value)
    if not match:
        raise StoryError("eventDate must be YYYY-MM-DD")
    year, month, day = (int(part) for part in match.groups())
    if month < 1 or month > 12 or day < 1 or day > calendar.monthrange(year, month)[1]:
        raise StoryError("eventDate is not a real calendar date")
    return f"{year:04d}-{month:02d}-{day:02d}"


def text(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise StoryError(f"{label} is required")
    return value.strip()


def optional_text(value: object) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise StoryError("expected a string")
    cleaned = value.strip()
    return cleaned or None


def require_len(value: str, limit: int, label: str) -> None:
    if len(value) > limit:
        raise StoryError(f"{label} is too long")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except BrokenPipeError:
        raise SystemExit(0) from None
