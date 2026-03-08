# TrustyRecipe

Allergen-aware recipe discovery platform with:
- React frontend
- FastAPI backend
- Scrapy multi-source scraping pipeline
- NLP enrichment for allergen detection and protein-type classification
- PostgreSQL persistence

## Overview
TrustyRecipe helps users search recipes while filtering out allergens.  
When a user searches, the API:
1. returns existing matching recipes from PostgreSQL,
2. starts background scraping if results are below target,
3. enriches new recipes via NLP in the Scrapy pipeline,
4. supports polling for newly scraped results.

Authenticated users can also:
- save recipes,
- update allergen preferences,
- view recent searches,
- view personalised profile data.

## Tech Stack
- Frontend: React 19, Vite, React Router
- Backend: FastAPI, Uvicorn, SQLAlchemy
- Scraping: Scrapy
- NLP: spaCy (`en_core_web_sm`) + rule-based matchers
- Database: PostgreSQL (`psycopg2`)
- Auth: JWT bearer tokens + bcrypt password hashing
- Containerisation: Docker / docker compose

## Core Features
- Account signup/login with JWT access token
- Allergen-aware search with server-side filtering
- Background scrape orchestration across multiple spiders:
  - AllRecipes
  - Food Network
  - Serious Eats
- NLP enrichment on ingest:
  - `detect_allergens(...)`
  - `detect_protein_type(...)`
- Popular recipes based on view counts
- Saved recipes
- Recent searches (with representative recipe previews)

## Local Development Setup

### 1) Backend + Scraper dependencies
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

### 2) Start FastAPI
From repository root:
```powershell
python -m uvicorn backend.api_app.main:app --reload --port 8000
```

API docs:
- Swagger UI: `http://127.0.0.1:8000/docs`

### 3) Start Frontend
```powershell
cd frontend
npm install
npm run dev
```

Frontend runs on Vite default port (usually `5173`).

## Docker Setup (API)
Build and run API container:
```powershell
docker compose up --build
```

Current compose file exposes:
- `127.0.0.1:8000 -> container:8000`

Note:
- Compose file currently defines the API service only.
- PostgreSQL must be available via `DATABASE_URL` (external DB or separate container).

## API Summary

Auth:
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/current-user`
- `POST /api/current-user/update-password`

Search and recipes:
- `POST /api/search`
- `POST /api/popular`
- `GET /api/recipes/{recipe_id}`
- `POST /api/recipes/{recipe_id}/view`

User data:
- `PUT /api/me/allergens`
- `GET /api/me/saved`
- `GET /api/me/saved/{recipe_id}`
- `POST /api/me/saved/{recipe_id}`
- `DELETE /api/me/saved/{recipe_id}`
- `GET /api/me/recent`

## Authentication Model
- Backend returns JWT access token at login/signup.
- Frontend stores token in `localStorage` as `access_token`.
- API client sends token via `Authorization: Bearer <token>`.
- No cookie-based auth flow is implemented in frontend code.
