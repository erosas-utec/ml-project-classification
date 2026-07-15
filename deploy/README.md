---
title: Aliento
emoji: 🫁
colorFrom: blue
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
short_description: Analisis acustico de tos - demo educativo (UTEC)
---

# Detector de tos COVID — Web App (demo)

PWA que graba la tos del usuario y, con nuestro modelo del proyecto de Machine Learning
(SVM sobre 64 features: MFCC + descriptores espectrales), estima si es COVID positivo o negativo. Corre sobre el mismo
pipeline `librosa` + `scikit-learn` del notebook, así que la predicción es idéntica.

⚠️ **Demo educativo, no es un diagnóstico.** No reemplaza una prueba médica.

## Arquitectura

```
PWA (graba WAV en el navegador)  ──POST /predict──►  FastAPI (Render, Docker)
                                                       librosa → StandardScaler → SVM
                                                       └─ si hay consentimiento → Supabase
```

- **Frontend:** HTML/CSS/JS vanilla en `static/` (grabación WAV con Web Audio API, sin ffmpeg).
- **Backend:** `app.py` (FastAPI) sirve la PWA y expone `/predict` y `/health`.
- **Modelo:** `model/` (generado por `train_and_export.py`).
- **Persistencia (opcional):** Supabase (Postgres + Storage) para juntar tos y reentrenar.

## Archivos

| Archivo | Qué es |
|---|---|
| `app.py` | Backend FastAPI (predicción + guardado opcional) |
| `features.py` | Extracción de features (MFCC + espectrales, 64) compartida con el entrenamiento (garantiza paridad) |
| `train_and_export.py` | Entrena y exporta `model/model.joblib` + `scaler.joblib` + `meta.json` |
| `static/` | La PWA (index.html, app.js, style.css, manifest, sw.js, iconos) |
| `Dockerfile` | Imagen del backend (escucha `$PORT`, o 7860 por defecto) |
| `requirements.txt` | Dependencias con versiones fijas |
| `supabase_setup.sql` | Crea la tabla `coughs` en Supabase |

## Correr en local

```bash
cd deploy
python train_and_export.py            # genera la carpeta model/ (una sola vez)
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 7860
# abrir http://127.0.0.1:7860
```

## Desplegar en Render (gratis, sin tarjeta)

Hugging Face dejó de ofrecer Docker Spaces gratis (ahora requieren PRO). Se usa **Render**,
que mantiene el mismo backend Docker sin costo.

1. Entrar a [render.com](https://render.com) e iniciar sesión con GitHub.
2. **New → Web Service** → conectar el repositorio `erosas-utec/ml-project-classification`.
3. Configurar:
   - **Root Directory:** `deploy`
   - **Runtime:** Docker (lo detecta por el `Dockerfile`)
   - **Instance Type:** Free
   - **Health Check Path:** `/health`
4. **Create Web Service.** Render construye la imagen (~5-10 min) y publica en
   `https://<nombre>.onrender.com`. El backend escucha el puerto que Render asigna (`$PORT`).

> El servicio gratis se duerme tras 15 min de inactividad y despierta en ~1 min en la
> siguiente visita.

## Conectar Supabase (opcional, para guardar tos)

1. En el proyecto de [supabase.com](https://supabase.com): **SQL Editor** → pegar y
   ejecutar `supabase_setup.sql` (crea la tabla `coughs`).
2. **Storage** → crear un bucket **privado** llamado exactamente `coughs`.
3. En Render → el servicio → **Environment → Add Environment Variable**, agregar dos:
   - `SUPABASE_URL` → la Project URL.
   - `SUPABASE_SERVICE_KEY` → la **service_role key** (Supabase → Project Settings → API).
     Es secreta; solo va en el backend, nunca en el frontend.
4. Guardar (Render redepliega solo). Si el usuario marca el consentimiento, la tos se
   guarda en el bucket y se registra en la tabla `coughs`.

Sin estas variables la app funciona igual, solo que no guarda nada.

## Notas

- El primer acceso tras inactividad puede tardar ~1 min (el servicio free se duerme).
  Para evitarlo, el workflow `.github/workflows/keep-alive.yml` hace un ping a `/health`
  cada 10 minutos y mantiene el servicio despierto. Ademas, la pagina hace un ping al
  cargar, de modo que el servidor despierta mientras el usuario se prepara.
- La precisión en vivo será menor que en el test del paper (micrófono, ruido, otra forma
  de toser). Por eso se recogen datos con consentimiento: para mejorar el modelo.
