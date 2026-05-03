#!/bin/bash
set -e

PORT="${PORT:-8000}"
cd "$(dirname "$0")"

echo "==> Running Django migrations..."
python manage.py migrate --run-syncdb

echo "==> Ensuring admin superuser exists..."
python manage.py ensure_superuser

echo "==> Collecting static files..."
python manage.py collectstatic --noinput --clear

echo "==> Starting Django on port $PORT..."
exec python manage.py runserver "0.0.0.0:$PORT"
