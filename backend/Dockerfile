FROM python:3.11-slim

WORKDIR /app

# Install uv (fast installer)
RUN pip install uv --no-cache-dir

# Copy dependency manifest first for layer caching
COPY pyproject.toml ./
RUN uv pip install --system -e . --no-cache

# Copy application source
COPY app/ ./app/

# Expose API port
EXPOSE 8000

# Start server — PORT env var is injected by Render/Railway/Fly.io
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
