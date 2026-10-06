"""Ids are UUIDs in Postgres but opaque strings in the core.

A string that is not a UUID can never match a row, so it is "not found"
rather than an error (asyncpg would refuse to send it).
"""

from collections.abc import Iterable
from uuid import UUID


def parse_id(value: str) -> UUID | None:
    try:
        return UUID(value)
    except ValueError:
        return None


def parse_ids(values: Iterable[str]) -> list[UUID]:
    """The well-formed ids among `values`."""
    return [uuid for value in values if (uuid := parse_id(value)) is not None]
