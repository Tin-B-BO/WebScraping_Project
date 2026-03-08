from __future__ import annotations
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, EmailStr

# request from main.py to retrieve following data
class SearchRequest(BaseModel):
    query: str = ""
    allergens: Optional[List[str]] = None
    cursor_created_at: Optional[datetime] = None  # cursor for polling new recipes

# ====================================================================================
# Auth
# ====================================================================================
class SignupRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    allergens: List[str] = Field(default_factory=list)


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class CurrentUserOut(BaseModel):
    id: int
    username: str
    email: str
    allergens: List[str] = Field(default_factory=list)


class UpdateAllergensRequest(BaseModel):
    allergens: List[str] = Field(default_factory=list)

class PasswordUpdate(BaseModel):
    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)

# ====================================================================================
# Saved Recipes
# ====================================================================================
class IsRecipeSavedOut(BaseModel):
    saved: bool


class SavedStatusOut(BaseModel):
    ok: bool
    saved: bool


class SavedListOut(BaseModel):
    items: List[dict] = Field(default_factory=list)


# ====================================================================================
# Recent Searches
# ====================================================================================
class RecentClickedRequest(BaseModel):
    query: str = ""
    recipe_id: int


class RecentListOut(BaseModel):
    items: List[dict] = Field(default_factory=list)

