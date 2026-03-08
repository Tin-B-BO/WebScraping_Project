# scraper/recipes/pipelines.py

from __future__ import annotations

from sqlalchemy import create_engine, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import sessionmaker

from backend.api_app.db import Base
from backend.api_app.models import Recipe

from services.nlp.allergen_model import detect_allergens
from services.nlp.preprocess import clean_raw_fields, normalize_title_for_storage
from services.nlp.protein_types import detect_protein_type


class PostgresRecipePipeline:
    def __init__(self, database_url: str):
        if not database_url:
            raise RuntimeError("DATABASE_URL missing in Scrapy settings")

        # create engine and ensure recipe table exists
        self.engine = create_engine(database_url, future=True)
        Base.metadata.create_all(bind=self.engine)

        # session factory used for each processed item
        self.SessionLocal = sessionmaker(
            bind=self.engine,
            autoflush=False,
            autocommit=False,
            future=True,
        )

    @classmethod
    def from_crawler(cls, crawler):
        return cls(crawler.settings.get("DATABASE_URL"))

    def process_item(self, item, spider):
        db = self.SessionLocal()
        try:
            # skip records without a usable url
            url = (item.get("url") or "").strip()
            if not url:
                return item
            # skip if current url already exists in db
            exists = db.execute(select(Recipe.id).where(Recipe.url == url)).scalar_one_or_none()
            if exists:
                return item

            # normalize raw title/ingredients/instructions before enrichment
            title_raw, ing_raw, ins_raw = clean_raw_fields(
                item.get("title", ""),
                item.get("ingredients_raw", []) or [],
                item.get("instructions_raw", []) or [],
            )

            # keep only structurally valid recipe items
            if not title_raw or len(ing_raw) < 1 or len(ins_raw) < 1:
                return item

            # enrich with normalized title and inferred fields
            title_norm = normalize_title_for_storage(title_raw)
            protein_type = detect_protein_type(title_raw, ing_raw)
            allergens_found = detect_allergens(title_raw, ing_raw, ins_raw)

            # insert recipe and ignore duplicates by url
            insert_recipe_query = insert(Recipe).values(
                url=url,
                source=item.get("source", "unknown"),
                title=title_raw,
                ingredients=ing_raw,
                instructions=ins_raw,
                title_norm=title_norm,
                protein_type=protein_type,
                detected_allergens=allergens_found,
                image_url=item.get("image_url"),
                prep_time=item.get("prep_time"),
                cook_time=item.get("cook_time"),
                total_time=item.get("total_time"),
                servings=item.get("servings"),
                views=0,
            )

            insert_recipe_query = insert_recipe_query.on_conflict_do_nothing(index_elements=["url"])
            db.execute(insert_recipe_query)
            db.commit()
            return item

        except Exception:
            # rollback on any db or preprocessing failure
            db.rollback()
            return item

        finally:
            # close session for this item
            db.close()
