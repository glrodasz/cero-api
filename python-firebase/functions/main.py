"""The module Firebase loads: every function it exports is deployed.

The function itself lives in the `cero_firebase` package (`../src`), where the
workspace's linters, type checker and tests reach it; `requirements.txt`
installs that package, and the code it reuses, into `venv/`.
"""

from cero_firebase import api

__all__ = ["api"]
