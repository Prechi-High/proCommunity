FROM python:3.11-slim-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY *.py .

ENV PYTHONUNBUFFERED=1 \
    WHISPER_MODEL_SIZE=tiny \
    WHISPER_DEVICE=cpu \
    WHISPER_COMPUTE_TYPE=int8 \
    ASR_REDIS_ENV=production

USER nobody
CMD ["python", "worker.py"]
