FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY . .

# Expose port (Render sets $PORT env var)
ENV PYTHONUNBUFFERED=1

# Use $PORT env var (Render sets this), fallback to 8000 for local
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
