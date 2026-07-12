---
title: Detector De Tos COVID
emoji: 🫁
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# Detector de tos COVID — Web App (demo)

PWA que graba la tos del usuario y, con nuestro modelo del proyecto de Machine Learning
(SVM sobre features MFCC), estima si es COVID positivo o negativo. Corre sobre el mismo
pipeline `librosa` + `scikit-learn` del notebook, así que la predicción es idéntica.

⚠️ **Demo educativo, no es un diagnóstico.** No reemplaza una prueba médica.

## Arquitectura

```
PWA (graba WAV en el navegador)  ──POST /predict──►  FastAPI (HF Spaces, Docker)
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
| `features.py` | Extracción MFCC compartida con el entrenamiento (garantiza paridad) |
| `train_and_export.py` | Entrena y exporta `model/model.joblib` + `scaler.joblib` + `meta.json` |
| `static/` | La PWA (index.html, app.js, style.css, manifest, sw.js, iconos) |
| `Dockerfile` | Imagen para HF Spaces (puerto 7860) |
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

## Desplegar en Hugging Face Spaces (gratis)

1. Crear un Space nuevo: **SDK = Docker**, hardware **CPU basic (free)**.
2. Subir el contenido de esta carpeta `deploy/` al git del Space (este README, con su
   cabecera YAML, debe quedar en la raíz del Space). Incluir la carpeta `model/` ya
   generada.
3. HF construye la imagen y publica en `https://<usuario>-<space>.hf.space`.

## Conectar Supabase (opcional, para guardar tos)

1. Crear un proyecto en [supabase.com](https://supabase.com) (free, sin tarjeta).
2. **SQL Editor** → pegar y ejecutar `supabase_setup.sql`.
3. **Storage** → crear un bucket **privado** llamado exactamente `coughs`.
4. En el Space de HF → **Settings → Variables and secrets**, agregar dos *Secrets*:
   - `SUPABASE_URL` → la Project URL.
   - `SUPABASE_SERVICE_KEY` → la **service_role key** (Settings → API). Es secreta;
     solo va en el backend, nunca en el frontend.
5. Reiniciar el Space. A partir de ahí, si el usuario marca el consentimiento, la tos se
   guarda en el bucket y se registra en la tabla `coughs`.

Sin estos secrets la app funciona igual, solo que no guarda nada.

## Notas

- El primer acceso tras inactividad puede tardar unos segundos (el Space free se duerme
  a las 48 h y Supabase pausa a los 7 días; ambos despiertan solos).
- La precisión en vivo será menor que en el test del paper (micrófono, ruido, otra forma
  de toser). Por eso se recogen datos con consentimiento: para mejorar el modelo.
