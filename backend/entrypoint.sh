#!/bin/sh
# Linsiq entrypoint — handles database setup and starts the API
set -e

echo "=== Linsiq API Starting ==="

# Create database tables if they don't exist
echo "Setting up database..."
python -c "
from db.database import engine, Base
Base.metadata.create_all(bind=engine)
print('Database tables created/verified.')
"

echo "Starting uvicorn..."
# Use PORT env var (set by Render), default to 8000 for local
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1
