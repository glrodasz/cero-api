from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    """Base of every request and response body: camelCase in JSON, snake_case in Python.

    FastAPI serialises responses by alias. Unknown fields are ignored
    (Pydantic's default), so clients cannot sneak in an `id`.
    """

    model_config = ConfigDict(
        alias_generator=to_camel, validate_by_alias=True, validate_by_name=True
    )
