FROM python:3.13-slim

# Keep all app code under a single working directory.
WORKDIR /app

# install OS-level build/runtime libraries used by Scrapy dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libxml2-dev libxslt1-dev \
    zlib1g-dev \
    libffi-dev \
    libssl-dev \
    curl \
  && rm -rf /var/lib/apt/lists/*

# copy dependency spec first to maximize Docker layer cache reuse
COPY requirements.txt /app/requirements.txt

# install Python dependencies and the spaCy English model used by NLP services
RUN pip install --no-cache-dir -r /app/requirements.txt
RUN python -m spacy download en_core_web_sm

# copy application source code
COPY backend /app/backend
COPY scraper /app/scraper
COPY services /app/services

# allow imports from both service roots
ENV PYTHONPATH=/app/backend:/app/scraper

# FastAPI port
EXPOSE 8000

# start the API with Uvicorn
CMD ["python", "-m", "uvicorn", "backend.api_app.main:app", "--host", "0.0.0.0", "--port", "8000"]
