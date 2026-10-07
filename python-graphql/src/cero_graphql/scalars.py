from typing import Final, NewType

import strawberry
from strawberry.types.scalar import ScalarDefinition

Millis = NewType("Millis", int)


def parse_millis(value: object) -> Millis:
    # bool is an int in Python, but not a number of milliseconds.
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError("Millis must be a whole number of milliseconds")
    return Millis(value)


MILLIS: Final[ScalarDefinition] = strawberry.scalar(
    name="Millis",
    description="Epoch milliseconds. Timestamps overflow GraphQL's 32-bit Int, hence a scalar.",
    serialize=int,  # Python ints have no 32-bit limit
    parse_value=parse_millis,
)
