from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSON
from .db import Base

# returns current utc timestamp for default created_at fields.
def utcnow():
    return datetime.now(timezone.utc)

# stores scraped recipe content and derived metadata used by search/filtering.
class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String(600), unique=True, nullable=False, index=True)
    source = Column(String(60), nullable=False, default="unknown")
    title = Column(String(300), nullable=False, default="")
    ingredients = Column(JSON, nullable=False, default=list)
    instructions = Column(JSON, nullable=False, default=list)
    title_norm = Column(String(500), nullable=False, default="", index=True)
    protein_type = Column(String(60), nullable=False, default="others", index=True)
    image_url = Column(String(1000), nullable=True)
    prep_time = Column(String(80), nullable=True)
    cook_time = Column(String(80), nullable=True)
    total_time = Column(String(80), nullable=True)
    servings = Column(String(80), nullable=True)
    detected_allergens = Column(JSON, nullable=False, default=list)
    views = Column(Integer, nullable=False, default=0, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, index=True)


# stores app user credentials and allergen preferences.
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(60), unique=True, nullable=False, index=True)
    email = Column(String(200), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    allergens = Column(JSON, nullable=False, default=list)


# join table for user's saved recipes
class SavedRecipe(Base):
    __tablename__ = "saved_recipes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, index=True)


# stores recent searches per user with one representative recipe id.
class RecentSearch(Base):
    __tablename__ = "recent_searches"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    query = Column(String(300), nullable=False)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, index=True)


# tracks scrape ttl state for each normalised query key
class ScrapeCache(Base):
    __tablename__ = "scrape_cache"

    id = Column(Integer, primary_key=True)
    key = Column(String(500), nullable=False, unique=True, index=True)
    # null means query was seen but scraping has not started yet
    last_started_at = Column(DateTime(timezone=True), nullable=True, default=None)
    # updated on every search request for this key
    last_seen_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, index=True)