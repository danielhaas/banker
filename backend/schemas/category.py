from pydantic import BaseModel


class CategoryCreate(BaseModel):
    name: str
    parent_id: int | None = None
    icon: str | None = None
    color: str | None = None


class CategoryOut(BaseModel):
    id: int
    name: str
    parent_id: int | None
    icon: str | None
    color: str | None

    model_config = {"from_attributes": True}
