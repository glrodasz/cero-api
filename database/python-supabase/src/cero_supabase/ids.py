"""Ids are uuid columns, and Postgres refuses to compare a uuid with anything else:
PostgREST answers 400 (error 22P02).

A malformed id cannot match a row anyway, so the repositories drop it before it
reaches the database: it is "not found", never an error.
"""

import re
from collections.abc import Iterable
from typing import Final

UUID_PATTERN: Final = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.IGNORECASE
)


def is_uuid(value: str) -> bool:
    return UUID_PATTERN.fullmatch(value) is not None


def only_uuids(values: Iterable[str]) -> list[str]:
    """The well-formed ids among `values`."""
    return [value for value in values if is_uuid(value)]
