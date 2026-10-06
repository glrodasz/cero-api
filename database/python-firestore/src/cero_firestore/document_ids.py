import re
from typing import Final

MAX_ID_BYTES: Final = 1_500
RESERVED_ID: Final = re.compile(r"__.*__", re.DOTALL)


def is_document_id(value: str) -> bool:
    """Whether `value` can name a Firestore document.

    Anything else (empty, a path with "/", "." or "..", a reserved `__name__`,
    or too long) makes the client or the server raise, while the storage port
    wants a malformed id to be simply "not found".
    See https://firebase.google.com/docs/firestore/quotas#collections_documents_and_fields
    """
    return (
        value not in ("", ".", "..")
        and "/" not in value
        and RESERVED_ID.fullmatch(value) is None
        and len(value.encode()) <= MAX_ID_BYTES
    )
