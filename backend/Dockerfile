# Backend Dockerfile
FROM python:3.12-slim

WORKDIR /app/backend

COPY requirements.txt .
COPY queryargus ./queryargus
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir --no-deps -e ./queryargus

COPY . .

EXPOSE 8000

ENV PYTHONUNBUFFERED=1

# Use shell form to dynamically read PORT from env
CMD exec uvicorn main:app --host 0.0.0.0 --port 8000