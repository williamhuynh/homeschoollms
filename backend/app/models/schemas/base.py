from pydantic import BaseModel, Field, ConfigDict
from bson import ObjectId
from datetime import datetime, date
from typing import Any
from pydantic_core import core_schema

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, handler=None, info=None):  # Updated to handle Pydantic v2 validation
        if isinstance(v, ObjectId):
            return v
        if isinstance(v, str):
            if not ObjectId.is_valid(v):
                raise ValueError("Invalid ObjectId")
            return ObjectId(v)
        raise TypeError("Expected ObjectId or str")

    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler):
        """Pydantic v2 core schema with serialization support to str."""
        return core_schema.no_info_plain_validator_function(
            cls.validate,
            serialization=core_schema.plain_serializer_function_ser_schema(
                lambda v: str(v),
                return_schema=core_schema.str_schema(),
            ),
        )

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema: Any) -> Any:
        field_schema.update(type="string")
        return field_schema

class MongoBaseModel(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Pydantic v2 configuration
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={
            ObjectId: str,
            date: lambda d: d.isoformat(),  # Convert date to ISO format string
        },
    )
