# Imagen del backend (FastAPI). Funciona en cualquier host de contenedores.
# Escucha el puerto de la variable PORT si existe (p. ej. Render) o 7860 por defecto.
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
# Forma shell para que ${PORT} se expanda (Render inyecta PORT; si no existe, usa 7860)
CMD uvicorn app:app --host 0.0.0.0 --port ${PORT:-7860}
