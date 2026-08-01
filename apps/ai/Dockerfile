# Hugging Face Spaces (Docker SDK) and Render both build this image.
# Placing the AI service on HF Spaces keeps it off Render's 750 instance-hour
# budget, which is what makes the asymmetric-warming strategy work (ADR-004).
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# build-essential is needed to compile the Tree-sitter bindings on slim.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install .

COPY app ./app

# Grammars are compiled/loaded in the FastAPI lifespan hook rather than here,
# so /readyz only reports ready once parsing genuinely works.
EXPOSE 8000

HEALTHCHECK --interval=60s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://localhost:8000/healthz || exit 1

# One worker: on a free CPU instance more workers means more memory and more
# cold-start time, not more throughput.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
