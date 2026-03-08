import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.environ["DATABASE_URL"]

# sqlalchemy engine manages db connections.
engine = create_engine(DATABASE_URL, future=True)
# session factory used per-request in fastapi dependencies.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)

# base class for sqlalchemy models.
Base = declarative_base()

def get_db():
    # open one db session for the request and always close it.
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
