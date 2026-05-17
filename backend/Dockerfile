# Backend Dockerfile
FROM python:3.12-slim

WORKDIR /app/backend

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

ENV PYTHONUNBUFFERED=1

# Use shell form to dynamically read PORT from env
CMD exec uvicorn main:app --host 0.0.0.0 --port 8000