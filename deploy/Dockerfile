# Imagen para Hugging Face Spaces (SDK: docker). HF espera el puerto 7860.
FROM python:3.12-slim

WORKDIR /app

# libsndfile para leer los WAV con soundfile. No instalo ffmpeg a propósito:
# el navegador manda WAV (PCM), así que no hace falta decodificar formatos comprimidos.
RUN apt-get update && apt-get install -y --no-install-recommends libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
