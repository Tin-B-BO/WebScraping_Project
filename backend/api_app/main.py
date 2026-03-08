from __future__ import annotations

import re
import sys
import time
from pathlib import Path
from typing import Optional

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .auth import create_access_token, decode_token, hash_password, verify_password
from .db import Base, SessionLocal, engine, get_db
from .models import RecentSearch, Recipe, SavedRecipe, User
from . import crud
from .scraper_runner import run_all_spiders
from .schemas import (
    CurrentUserOut,
    IsRecipeSavedOut,
    LoginRequest,
    PasswordUpdate,
    RecentListOut,
    SavedListOut,
    SavedStatusOut,
    SearchRequest,
    SignupRequest,
    TokenOut,
    UpdateAllergensRequest,
)

# setup project root for imports to ensure modules are found correctly.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

app = FastAPI(title="Recipe API")

# ensure database tables are created.
Base.metadata.create_all(bind=engine)

# configure cors for frontend access.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ====================================================================================
# global constants and configuration
# ====================================================================================
TARGET_TOTAL = 180  # target number of recipes per search query
POLL_BATCH_SIZE = 20  # number of new recipes returned per poll request
SCRAPE_TTL_SECONDS = 2000  # cooldown before allowing the same query to trigger a new scrape
SCRAPE_RETENTION_SECONDS = 3000  # keep scrape cache entries before removes old rows
POLL_MAX_LOOPS = 2  # max background loops while trying to scrape target results
POLL_SLEEP_SECONDS = 8  # delay between background loops

bearer = HTTPBearer(auto_error=False)

# ====================================================================================
# 1) authentication helpers and routes
# ====================================================================================

def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    # require a token and a valid decoded subject id.
    if not (creds and (sub := decode_token(creds.credentials))):
        return None
    # safely handle non-integer subject values.
    try:
        return db.get(User, int(sub))
    except (ValueError, TypeError):
        return None


def require_user(u: Optional[User] = Depends(get_current_user)) -> User:
    if u:
        return u
    raise HTTPException(401, "Unauthorized")


@app.post("/api/auth/signup", response_model=TokenOut)
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    """Registers a new user and returns an access token."""
    username = (req.username or "").strip()
    email = (req.email or "").strip().lower()
    if not username or not req.password:
        raise HTTPException(400, "Username and password required")

    # check user exists or not
    if db.execute(select(User).where((User.username == username) | (User.email == email))).scalar():
        raise HTTPException(400, "User already exists")

    # create user, store, then issue token
    u = User(
        username=username,
        email=email,
        password_hash=hash_password(req.password),
        allergens=[a for a in (req.allergens or []) if a],
    )
    db.add(u)
    db.commit()
    db.refresh(u)

    token = create_access_token(sub=str(u.id))
    return {"access_token": token, "token_type": "bearer"}


@app.post("/api/auth/login", response_model=TokenOut)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Verifies credentials and returns a JWT"""
    username = (req.username or "").strip()
    u = db.execute(select(User).where(User.username == username)).scalar_one_or_none()

    # deny login if user is missing or password check fails
    if not u or not verify_password(req.password, u.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(sub=str(u.id))
    return {"access_token": token, "token_type": "bearer"}


@app.post("/api/current-user/update-password")
def update_current_user_password(req: PasswordUpdate, u: User = Depends(require_user), db: Session = Depends(get_db)):
    """Updates the authenticated user's password after verifying the old password"""
    # validate current password before updating
    if not verify_password(req.old_password, u.password_hash):
        raise HTTPException(400, "Incorrect old password")

    # reject reusing the same password
    if req.old_password == req.new_password:
        raise HTTPException(400, "New password must be different from the old one")

    u.password_hash = hash_password(req.new_password) # hash and update the new password
    db.commit() 
    return {"ok": True, "message": "Password updated successfully"}


@app.get("/api/auth/current-user", response_model=CurrentUserOut)
def get_current_user_profile(u: User = Depends(require_user)):
    """Returns the current authenticated user's profile."""
    return {"id": u.id, "username": u.username, "email": u.email, "allergens": u.allergens or []}

# ====================================================================================
# 2) search flow
# ====================================================================================

def scrape_until_target(query: str, avoid: list[str]) -> None:
    """Background task: loops scrapers until 180 recipes"""
    if not query:
        return

    for _ in range(POLL_MAX_LOOPS):
        # open/close session per loop iteration.
        with SessionLocal() as db:
            filtered_results_count = crud.count_filtered_recipes(db, query=query, avoid_allergens=avoid or [])

        # stop once enough safe recipes exist.
        if filtered_results_count >= TARGET_TOTAL:
            return

        # request only the remaining number needed to reach target.
        run_all_spiders(query, max_items=TARGET_TOTAL - filtered_results_count)
        # pause between loops to avoid hammering scraper repeatedly.
        time.sleep(POLL_SLEEP_SECONDS)


@app.post("/api/search")
def search(
    req: SearchRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    u: Optional[User] = Depends(get_current_user),
):
    """Main search endpoint: handles initial results, polling, and background scraping"""
    # normalise query text for scraper input.
    query_raw = " ".join((req.query or "").lower().split())
    q_raw = re.findall(r"[a-z0-9]+", (req.query or "").lower())
    query = " ".join([re.sub(r"(ies$|ing$|ed$|es$|s$|'s$)", "", k) for k in q_raw if len(k) >= 2])
    # use allergens from request first; if missing, use the logged-in user's saved allergens
    avoid = ((u.allergens or []) if u else []) if req.allergens is None else (req.allergens or [])

    # update scrape cache bookkeeping
    crud.record_scrape_query(db, query=query) if query else None
    crud.cleanup_scrape_query_cache(db, retention_seconds=SCRAPE_RETENTION_SECONDS)

    # incremental polling path where frontend asks for recipes created after the last cursor
    cursor_timestamp = req.cursor_created_at
    if cursor_timestamp is not None:
        # fetch only the next batch newer than cursor_timestamp
        new_recipes = crud.fetch_recipes_since_cursor(
            db, query=query, avoid_allergens=avoid, cursor_timestamp=cursor_timestamp, limit=POLL_BATCH_SIZE
        )
        # serialize db rows into api response objects
        serialized_new_recipes = [crud.serialize_recipe_summary(r) for r in new_recipes]
        # recompute total filtered results to decide if polling should continue
        filtered_results_count = crud.count_filtered_recipes(db, query=query, avoid_allergens=avoid)
        pending = bool(query) and (filtered_results_count < TARGET_TOTAL)
        # move cursor forward to the newest created_at from this batch
        next_cursor = req.cursor_created_at
        if new_recipes:
            latest_timestamp = max([r.created_at for r in new_recipes if r.created_at])
            next_cursor = latest_timestamp.isoformat() if latest_timestamp else next_cursor
        # return incremental items and next cursor for the next poll call
        return {
            "items": serialized_new_recipes,
            "pending": pending,
            "scrape_started": False,
            "scrape_blocked": False, "cursor_created_at": next_cursor,
        }
    # initial search load, fetching existing recipes
    existing_recipes = crud.fetch_existing_recipes(db, query=query, avoid_allergens=avoid)
    target_count = min(TARGET_TOTAL, len(existing_recipes))
    # return stable balanced ordering across protein types
    balanced_recipes = crud.get_balanced_recipes(existing_recipes, total=target_count, query=query, avoid=avoid)
    serialized_existing_recipes = [crud.serialize_recipe_summary(r) for r in balanced_recipes]

    pending = bool(query) and (len(existing_recipes) < TARGET_TOTAL)
    scrape_started = False
    scrape_blocked = False

    # trigger background scrape if results are below target and ttl allows
    if query and pending:
        allowed = crud.should_scrape_and_mark_ttl(db, query, ttl_seconds=SCRAPE_TTL_SECONDS)
        if allowed:
            background_tasks.add_task(scrape_until_target, query_raw, avoid)
            scrape_started = True
        else:
            scrape_blocked = True

    # send newest matching recipe created_at as the next poll cursor
    next_poll_cursor = crud.get_newest_match_timestamp(db, query=query, avoid_allergens=avoid).isoformat()

    # for Recent Section
    # save this query in recents and attach one random filtered recipe id for dashboard preview cards.
    if u and query:
        exclude = crud.get_all_recent_recipe_ids(db, user_id=u.id)
        picked_id = crud.get_random_recent_recipe_id(serialized_existing_recipes, avoid, exclude_ids=exclude)
        crud.save_latest_recent_search(db, user_id=u.id, query=query, recipe_id=picked_id)

    return {
        "items": serialized_existing_recipes,
        "pending": pending,
        "scrape_started": scrape_started,
        "scrape_blocked": scrape_blocked, "cursor_created_at": next_poll_cursor,
    }


# ====================================================================================
# 3) recipe details and views
# ====================================================================================

@app.get("/api/recipes/{recipe_id}")
def recipe_details(recipe_id: int, db: Session = Depends(get_db)):
    """Returns full metadata for a single recipe."""
    recipe = db.execute(select(Recipe).where(Recipe.id == recipe_id)).scalar_one_or_none()
    if not recipe:
        return {"error": "Recipe not found"}
    return crud.serialize_recipe_details(recipe)


@app.post("/api/recipes/{recipe_id}/view")
def recipe_view(recipe_id: int, db: Session = Depends(get_db)):
    """Increments recipe views so popular ranking can use higher-view recipes first"""
    update_result = db.execute(update(Recipe).where(Recipe.id == recipe_id).values(views=Recipe.views + 1))
    db.commit()
    if (update_result.rowcount or 0) == 0:
        return {"ok": False, "error": "Recipe not found"}
    return {"ok": True}


# ====================================================================================
# 4) saved recipes and profile
# ====================================================================================

@app.get("/api/me/saved", response_model=SavedListOut)
def list_saved(u: User = Depends(require_user), db: Session = Depends(get_db)):
    """Returns the list of recipes saved by the user"""
    saved_recipes = db.execute(
        select(Recipe)
        .join(SavedRecipe, SavedRecipe.recipe_id == Recipe.id)
        .where(SavedRecipe.user_id == u.id)
        .order_by(SavedRecipe.created_at.desc())
        .limit(60)
    ).scalars().all()
    return {"items": [crud.serialize_recipe_summary(r) for r in saved_recipes]}


@app.get("/api/me/saved/{recipe_id}", response_model=IsRecipeSavedOut)
def is_saved(recipe_id: int, u: User = Depends(require_user), db: Session = Depends(get_db)):
    """Checks if a specific recipe is in the user's saved recipes list"""
    saved_exists = db.execute(
        select(SavedRecipe).where(SavedRecipe.user_id == u.id, SavedRecipe.recipe_id == recipe_id)
    ).scalar_one_or_none() is not None
    return {"saved": saved_exists}


@app.post("/api/me/saved/{recipe_id}", response_model=SavedStatusOut)
def save_recipe(recipe_id: int, u: User = Depends(require_user), db: Session = Depends(get_db)):
    """Adds a recipe to the user's saved recipes list"""
    # verify target recipe exists before creating saved link.
    recipe_exists = db.execute(select(Recipe.id).where(Recipe.id == recipe_id)).scalar_one_or_none()
    if not recipe_exists:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # avoid duplicate saved recipes for the same user and recipe
    existing = db.execute(
        select(SavedRecipe).where(SavedRecipe.user_id == u.id, SavedRecipe.recipe_id == recipe_id)
    ).scalar_one_or_none()
    if existing:
        return {"ok": True, "saved": True}

    # insert new saved entry for current user and recipe.
    db.add(SavedRecipe(user_id=u.id, recipe_id=recipe_id))
    db.commit()
    return {"ok": True, "saved": True}


@app.delete("/api/me/saved/{recipe_id}", response_model=SavedStatusOut)
def unsave_recipe(recipe_id: int, u: User = Depends(require_user), db: Session = Depends(get_db)):
    """Removes a recipe from the user's saved recipes list."""
    # find saved entry for current user and recipe pair.
    saved_entry = db.execute(
        select(SavedRecipe).where(SavedRecipe.user_id == u.id, SavedRecipe.recipe_id == recipe_id)
    ).scalar_one_or_none()
    # if no saved entry exists, return success as already unsaved
    if not saved_entry:
        return {"ok": True, "saved": False}
    # delete saved entry and commit change.
    db.delete(saved_entry)
    db.commit()
    return {"ok": True, "saved": False}


@app.put("/api/me/allergens", response_model=CurrentUserOut)
def update_allergens(req: UpdateAllergensRequest, u: User = Depends(require_user), db: Session = Depends(get_db)):
    """Updates the user's personal allergen list."""
    u.allergens = [a.strip().lower() for a in (req.allergens or []) if a.strip()]
    db.add(u)
    db.commit()
    db.refresh(u)
    return {"id": u.id, "username": u.username, "email": u.email, "allergens": u.allergens or []}

# ====================================================================================
# 5) popular recipes section
# ====================================================================================

@app.post("/api/popular")
def popular(req: SearchRequest, db: Session = Depends(get_db)):
    """Returns top recipes balanced by protein types, based on view counts"""
    # apply optional allergen exclusions from request.
    avoid = req.allergens or []
    # fetch high-view recipes using tiered selection and allergen filtering.
    popular_recipes = crud.get_popular_recipes(
        db, avoid_allergens=avoid, limit=40, min_views=5
    )
    # serialize recipe rows for frontend cards.
    serialized_popular_recipes = [crud.serialize_recipe_summary(r) for r in popular_recipes]
    # return popular recipe list.
    return {"items": serialized_popular_recipes}


# ====================================================================================
# 6) recent searches section
# ====================================================================================

@app.get("/api/me/recent", response_model=RecentListOut)
def list_recent(u: User = Depends(require_user), db: Session = Depends(get_db)):
    """Returns the user's search history with the randomly picked preview recipes"""
    # fetch latest recent-search entries that have a recipe id
    recent_search_entries = db.execute(
        select(RecentSearch)
        .where(RecentSearch.user_id == u.id, RecentSearch.recipe_id.isnot(None))
        .order_by(RecentSearch.created_at.desc())
        .limit(8)
    ).scalars().all()

    # collect recipe ids and load related recipe rows in one query
    recent_recipe_ids = [r.recipe_id for r in recent_search_entries if r.recipe_id]
    recent_recipes = db.execute(select(Recipe).where(Recipe.id.in_(recent_recipe_ids))).scalars().all()
    # map recipes by id for fast lookup while building output
    recipes_by_id = {x.id: x for x in recent_recipes}

    # build final response items with recent query and timestamp fields
    recent_items = []
    for rs in recent_search_entries:
        recipe = recipes_by_id.get(rs.recipe_id)
        if not recipe:
            continue
        serialized_recent_recipe = crud.serialize_recipe_summary(recipe)
        serialized_recent_recipe["search_query"] = rs.query
        serialized_recent_recipe["searched_at"] = rs.created_at.isoformat()
        recent_items.append(serialized_recent_recipe)
    return {"items": recent_items}
