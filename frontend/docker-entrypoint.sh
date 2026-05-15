#!/bin/sh
set -e

export PORT=${PORT:-4000}
# BACKEND_URL is the internal Cloud Run URL of the backend service.
# In production this is set as a Cloud Run environment variable.
# Locally, point directly at the backend container.
export BACKEND_URL=${BACKEND_URL:-http://localhost:8000}

# Substitute only $PORT and $BACKEND_URL; leave nginx's own $variables untouched.
envsubst '$PORT $BACKEND_URL' \
  < /etc/nginx/conf.d/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
