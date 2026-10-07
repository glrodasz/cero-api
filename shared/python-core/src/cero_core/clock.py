import time
from collections.abc import Callable

type Clock = Callable[[], int]
"""Tells the current time in epoch milliseconds. Injected so tests can control time."""


def system_clock() -> int:
    """The wall clock, in epoch milliseconds."""
    return time.time_ns() // 1_000_000
