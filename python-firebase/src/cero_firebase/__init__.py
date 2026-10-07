"""The Cero API as a Cloud Function for Firebase, in Python: python-fastapi's app on Firestore.

`functions/main.py`, the module Firebase loads, exports `api` from here.
"""

from cero_firebase.function import api

__all__ = ["api"]
