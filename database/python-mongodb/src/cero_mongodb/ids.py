"""Ids are ObjectIds in MongoDB but opaque strings in the core.

A string that is not an ObjectId can never match a document, so it is
"not found" rather than an error.
"""

from collections.abc import Iterable

from bson import ObjectId


def parse_id(value: str) -> ObjectId | None:
    return ObjectId(value) if ObjectId.is_valid(value) else None


def parse_ids(values: Iterable[str]) -> list[ObjectId]:
    """The well-formed ids among `values`."""
    return [ObjectId(value) for value in values if ObjectId.is_valid(value)]
