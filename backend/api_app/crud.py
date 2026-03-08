from __future__ import annotations

import random
import re
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Set
from sqlalchemy import case, delete, func, or_, select
from sqlalchemy.orm import Session
from .models import RecentSearch, Recipe, ScrapeCache


# ====================================================================================
# global constants
# ====================================================================================

MEAT_BUCKETS = [
    "poultry",
    "pork",
    "red_meat",
    "seafood",
    "preserved_meat",
    "vegetables",
    "others",
]

RECENT_MAX_PER_USER = 8


def _utcnow() -> datetime:
    """returns current utc time."""
    # keep all internal timestamps timezone-aware and consistent
    return datetime.now(timezone.utc)


# ====================================================================================
# 1) search logic and helpers
# ====================================================================================

def matches_query_rules(title: str, query: str) -> bool:
    """applies keyword match rules for normalized query text"""
    # normalize title and preserve word boundaries
    normalized_title = re.sub(r"[^a-z0-9]+", " ", (title or "").lower()).strip()

    # tokenize and stem query keywords.
    query_words = re.findall(r"[a-z0-9]+", (query or "").lower())
    suffixes = r"(ies$|ing$|ed$|es$|s$|'s$)"
    query_keywords = [re.sub(suffixes, "", word) for word in query_words if len(word) >= 2]

    if not query_keywords:
        return True
    if not normalized_title:
        return False

    # require 1 match for single-word query, otherwise require at least 2 matches
    required_matches = 1 if len(query_keywords) == 1 else 2

    # count how many query keywords appear in normalized title text
    matched_keyword_count = 0
    for keyword in query_keywords:
        # allow common word endings so "fry" can match "fried/frying", etc
        pattern = rf"\b{re.escape(keyword)}(y|ied|ies|ing|ed|es|s|'s)?\b"
        if re.search(pattern, normalized_title):
            matched_keyword_count += 1

    # pass only when matched keywords reach required threshold
    return matched_keyword_count >= required_matches


def build_base_query(query: str):
    """builds a broad recipe query that matches titles by any query keyword; strict matching is applied later"""
    # start with base recipe select; filters are appended only when query has keywords
    base_query = select(Recipe)
    if not query:
        return base_query

    # extract alphanumeric words, ignore 1-char noise, and cap count to control query cost
    query_tokens = [token for token in re.findall(r"[a-z0-9]+", query.lower()) if len(token) >= 2][:8]

    # build OR conditions so any keyword hit can pass this broad db stage.
    title_match_conditions = []
    for query_token in query_tokens:
        # stem simple suffixes so singular/plural/verb forms map to similar roots
        token_stem = re.sub(r"(ies$|ing$|ed$|es$|s$|'s$)", "", query_token)
        # postgres regex boundaries: \m start-of-word, \M end-of-word.
        title_pattern = rf"\m{re.escape(token_stem)}(y|ied|ies|ing|ed|es|s|'s)?\M"
        title_match_conditions.append(Recipe.title.op("~*")(title_pattern))

    if title_match_conditions:
        # apply broad OR filter; stricter rules are enforced later in apply_recipe_filters
        base_query = base_query.where(or_(*title_match_conditions))

    return base_query


def apply_recipe_filters(recipes: List[Recipe], avoid_allergens: List[str], query: str = "") -> List[Recipe]:
    """filters recipes by allergen exclusions and strict query matching"""
    # build a clean allergen set used for overlap checks
    avoid_allergen_set = {allergen for allergen in (avoid_allergens or []) if allergen}
    filtered_results = recipes
    if avoid_allergen_set:
        # keep only recipes that do not contain any avoided allergens.
        filtered_results = [
            recipe
            for recipe in filtered_results
            if {a for a in (recipe.detected_allergens or []) if a}.isdisjoint(avoid_allergen_set)
        ]
    if query:
        # after allergen filtering, keep only recipes with titles that pass strict query keyword rules
        filtered_results = [recipe for recipe in filtered_results if matches_query_rules(recipe.title, query)]
    return filtered_results


def fetch_existing_recipes(db: Session, *, query: str, avoid_allergens: List[str], cap: int = 15000) -> List[Recipe]:  
    """fetches existing recipes, then applies allergen and strict-match filtering."""
    # build broad title query for existing recipes in database
    recipe_query = build_base_query(query)
    # fetch capped recipes from db before in-memory allergen filtering
    fetched_recipes = db.execute(
        recipe_query.order_by(Recipe.id.asc()).limit(max(1, int(cap))) # cap limits how many recipes are pulled
    ).scalars().all()
    # apply allergen and strict keyword filters on fetched recipes
    return apply_recipe_filters(fetched_recipes, avoid_allergens, query=query)


def count_filtered_recipes(db: Session, *, query: str, avoid_allergens: List[str], cap: int = 15000) -> int:
    """returns filtered recipe count used by search flow to control pending state and scraping behavior."""
    return len(fetch_existing_recipes(db, query=query, avoid_allergens=avoid_allergens, cap=cap))


def get_balanced_recipes(recipes: List[Recipe], *, total: int, query: str = "", avoid: Optional[List[str]] = None) -> List[Recipe]:
    """returns recipes balanced across protein buckets, with stable order for the same query and allergen inputs"""
    if total <= 0 or not recipes:
        return []

    # create a stable seed from query and avoid list so repeated calls keep same ordering
    avoid_allergens_list = avoid or []
    normalized_avoid_key = ",".join(sorted(set(a.strip().lower() for a in avoid_allergens_list if a)))
    stable_seed = hash(f"q={(query or '').strip().lower()}|a={normalized_avoid_key}")
    randomizer = random.Random(stable_seed)

    recipes_by_bucket = {bucket: [] for bucket in MEAT_BUCKETS}
    for recipe in recipes:
        # fall back to "others" if protein type is missing/unknown.
        protein_type = (getattr(recipe, "protein_type", "others") or "others").strip()
        bucket_name = protein_type if protein_type in recipes_by_bucket else "others"
        recipes_by_bucket[bucket_name].append(recipe)

    for bucket in recipes_by_bucket:
        # shuffle each bucket before round-robin distribution.
        randomizer.shuffle(recipes_by_bucket[bucket])

    balanced_selection: List[Recipe] = []
    active_buckets = [bucket for bucket in MEAT_BUCKETS if recipes_by_bucket[bucket]]

    while len(balanced_selection) < total and active_buckets:
        # pick one from each non-empty bucket per cycle
        for bucket in list(active_buckets):
            if recipes_by_bucket[bucket]:
                balanced_selection.append(recipes_by_bucket[bucket].pop(0))
                if len(balanced_selection) >= total:
                    break
            else:
                active_buckets.remove(bucket)
        else:
            continue
        break
    return balanced_selection


# ====================================================================================
# 2) scrape cache helpers
# ====================================================================================

def record_scrape_query(db: Session, *, query: str) -> Optional[str]:
    """records query as seen in scrape cache and updates last_seen_at"""
    if not query:
        return None

    now = _utcnow()
    # update existing row or create a new cache row for this query key
    scrape_cache_entry = db.execute(select(ScrapeCache).where(ScrapeCache.key == query)).scalar_one_or_none()
    # update last_seen_at if query exists in cache; otherwise create first cache entry
    if scrape_cache_entry:
        scrape_cache_entry.last_seen_at = now
    else:
        db.add(ScrapeCache(key=query, last_seen_at=now, last_started_at=None))
    db.commit()
    return query


def should_scrape_and_mark_ttl(db: Session, key: str, *, ttl_seconds: int) -> bool:
    """returns True when scrape can start for this key based on ttl, and updates last_started_at when True"""
    # key is the normalized search query string stored in the scrape cache table
    if not key:
        return False

    now = _utcnow()
    # scraping can start again for the current search keyword (key) once last_started_at is older than this cutoff time
    cutoff = now - timedelta(seconds=max(1, int(ttl_seconds)))
    # load the query cache record with last_started_at and last_seen_at times, if it exists
    scrape_cache_entry = db.execute(select(ScrapeCache).where(ScrapeCache.key == key)).scalar_one_or_none()
    if not scrape_cache_entry:
        # for a new query key, allow scraping now and set its start timestamp
        db.add(ScrapeCache(key=key, last_seen_at=now, last_started_at=now))
        db.commit()
        return True

    if scrape_cache_entry.last_started_at is None or scrape_cache_entry.last_started_at <= cutoff:
        # if ttl passed or scrape never started, allow a new scrape and update start time
        scrape_cache_entry.last_started_at = now
        db.commit()
        return True

    return False


def cleanup_scrape_query_cache(db: Session, *, retention_seconds: int) -> int:
    """deletes expired scrape cache keyword/s (key) based on retention time and returns how many rows were deleted"""
    # compute oldest allowed timestamp based on retention window
    cutoff = _utcnow() - timedelta(seconds=retention_seconds)
    # use last_started_at when present; otherwise fall back to last_seen_at
    relevant_time = case(
        (ScrapeCache.last_started_at.isnot(None), ScrapeCache.last_started_at),
        else_=ScrapeCache.last_seen_at,
    )
    # delete rows whose chosen timestamp is older than cutoff
    delete_result = db.execute(delete(ScrapeCache).where(relevant_time < cutoff))
    db.commit()
    # return how many cache rows were removed
    return delete_result.rowcount or 0


# ====================================================================================
# 3) polling/incremental fetch
# ====================================================================================

def get_newest_match_timestamp(db: Session, *, query: str, avoid_allergens: List[str]) -> datetime:
    """returns newest timestamp from recipes that match current query and allergen filters"""
    # build query from search text and sort newest first
    recipe_query = build_base_query(query)
    fetched_recipes = db.execute(
        recipe_query.order_by(Recipe.created_at.desc()).limit(800)
    ).scalars().all()
    # apply allergen and strict keyword rules after db fetch
    filtered_recipes = apply_recipe_filters(fetched_recipes, avoid_allergens, query=query)
    # return newest timestamp if any match exists; otherwise return current utc time as fallback cursor
    return filtered_recipes[0].created_at if filtered_recipes else _utcnow()


def fetch_recipes_since_cursor(
    db: Session,
    *,
    query: str,
    avoid_allergens: List[str],
    cursor_timestamp: datetime,
    limit: int,
) -> List[Recipe]:
    """
    fetches recipes created after cursor_timestamp for the current query, applies allergen and 
    strict keyword filters, and returns up to the requested limit.
    """
    if cursor_timestamp is None:
        return []

    # fetch recipes created after the cursor so polling returns only new items
    recipe_query = (
        build_base_query(query)
        .where(Recipe.created_at > cursor_timestamp)
        .order_by(Recipe.created_at.asc())
        .limit(800)
    )
    fetched_recipes = db.execute(recipe_query).scalars().all()
    # apply allergen and strict keyword filters, then cap response size by limit
    filtered_recipes = apply_recipe_filters(fetched_recipes, avoid_allergens, query=query)
    return filtered_recipes[:limit]


# ====================================================================================
# 4) popular recipes
# ====================================================================================

def get_popular_recipes(db: Session, *, avoid_allergens: List[str], limit: int, min_views: int) -> List[Recipe]:
    """Returns popular recipes grouped by descending view levels, with random order inside each level"""
    # Get unique view counts, ordered from highest to lowest.
    view_levels_desc = db.execute(
        select(Recipe.views).where(Recipe.views >= min_views).distinct().order_by(Recipe.views.desc())
    ).scalars().all()

    selected_pop_recipes: List[Recipe] = []
    selected_recipe_ids: Set[int] = set()

    # Process one view level at a time and stop once reached the maximum limit
    for view_level_count in view_levels_desc:
        slots_left = limit - len(selected_pop_recipes)
        if slots_left <= 0:
            break

        # Get random recipes at this view count and fetch extra in case filters remove many
        view_count_query = (
            select(Recipe)
            .where(Recipe.views == view_level_count)
            .order_by(func.random())
            .limit(max(slots_left * 5, 100))
        )
        filtered_pop_recipes = apply_recipe_filters(db.execute(view_count_query).scalars().all(), avoid_allergens)

        # Keep insertion order while preventing duplicates across view levels
        for recipe in filtered_pop_recipes:
            if recipe.id not in selected_recipe_ids:
                selected_pop_recipes.append(recipe)
                selected_recipe_ids.add(recipe.id)
            if len(selected_pop_recipes) >= limit:
                break

    return selected_pop_recipes


# ====================================================================================
# 5) recent searches
# ====================================================================================

def get_all_recent_recipe_ids(db: Session, user_id: int) -> Set[int]:
    """Returns all non-null recipe IDs saved in recent searches for the current user"""
    recent_recipe_ids = db.execute(
        select(RecentSearch.recipe_id).where(RecentSearch.user_id == user_id, RecentSearch.recipe_id.isnot(None))
    ).scalars().all()
    return {int(recipe_id) for recipe_id in recent_recipe_ids if recipe_id is not None}


def get_random_recent_recipe_id(items: List[Dict], avoid_allergens: List[str], *, exclude_ids: Optional[Set[int]] = None) -> Optional[int]:
    """Picks one random recipe ID from serialized items after allergen and exclusion filtering"""
    # Normalize filters once so we can reuse them in the helper
    avoid_allergen_set = {allergen for allergen in (avoid_allergens or []) if allergen}
    blocked_recipe_ids = exclude_ids or set()

    # Return recipe IDs that are present, not blocked, and allergen-safe
    def collect_eligible_ids(current_blocked_ids: Set[int]) -> List[int]:
        return [
            int(item["id"])
            for item in (items or [])
            if item.get("id")
            and int(item["id"]) not in current_blocked_ids
            and {a for a in (item.get("detected_allergens") or []) if a}.isdisjoint(avoid_allergen_set)
        ]

    eligible_recipe_ids = collect_eligible_ids(blocked_recipe_ids)
    if not eligible_recipe_ids and blocked_recipe_ids:
        # If exclusions remove everything, retry without exclusions as a fallback
        eligible_recipe_ids = collect_eligible_ids(set())

    return random.choice(eligible_recipe_ids) if eligible_recipe_ids else None


def save_latest_recent_search(db: Session, *, user_id: int, query: str, recipe_id: Optional[int]) -> None:
    """Saves a recent search at the top and caps history size per user"""
    if not query or recipe_id is None:
        return
    normalized_recipe_id = int(recipe_id)

    # Remove older duplicates
    db.execute(
        delete(RecentSearch).where(RecentSearch.user_id == user_id, RecentSearch.recipe_id == normalized_recipe_id)
    )
    db.execute(delete(RecentSearch).where(RecentSearch.user_id == user_id, RecentSearch.query == query))

    # Insert the latest interaction after removing duplicates
    db.add(RecentSearch(user_id=user_id, query=query, recipe_id=normalized_recipe_id))
    db.commit()

    # Keep only the newest 
    excess_recent_ids = db.execute(
        select(RecentSearch.id)
        .where(RecentSearch.user_id == user_id)
        .order_by(RecentSearch.created_at.desc())
        .offset(RECENT_MAX_PER_USER)
    ).scalars().all()

    if excess_recent_ids:
        db.execute(delete(RecentSearch).where(RecentSearch.id.in_(excess_recent_ids)))
        db.commit()


# ====================================================================================
# 6) serializers
# ====================================================================================

def serialize_recipe_summary(recipe: Recipe) -> Dict:
    """Serializes a recipe into a summary payload for preview recipe cards and lists"""
    created_at = recipe.created_at
    return {
        "id": recipe.id,
        "title": recipe.title,
        "url": recipe.url,
        "source": recipe.source,
        "image_url": recipe.image_url,
        "detected_allergens": recipe.detected_allergens or [],
        "prep_time": recipe.prep_time,
        "cook_time": recipe.cook_time,
        "total_time": recipe.total_time,
        "servings": recipe.servings,
        "views": getattr(recipe, "views", 0) or 0,
        "protein_type": getattr(recipe, "protein_type", "others"),
        "created_at": created_at.isoformat() if created_at else None,
    }


def serialize_recipe_details(recipe: Recipe) -> Dict:
    """serializes full recipe details for recipe detail page"""
    serialized = serialize_recipe_summary(recipe)
    serialized.update(
        {
            "ingredients": recipe.ingredients or [],
            "instructions": recipe.instructions or [],
            "title_norm": getattr(recipe, "title_norm", None),
        }
    )
    return serialized
