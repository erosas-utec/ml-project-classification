"""Backend FastAPI: sirve la PWA y expone /predict con nuestro modelo.

Carga una sola vez el SVM + el StandardScaler exportados por train_and_export.py.
En /predict recibe el audio grabado en el navegador, saca los MFCC con la MISMA
función que usé al entrenar (features.py) y devuelve la predicción.

Si el usuario da su consentimiento y hay Supabase configurado (variables de entorno),
guarda la grabación para ir juntando más datos. Si no hay Supabase, simplemente no
guarda nada; la app sigue funcionando igual.
"""
import io
import os
import json
import uuid
import mimetypes
import datetime
from pathlib import Path

import joblib
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from features import FEATURE_COLUMNS, cargar, features_de_senal

# Amplitud pico minima para considerar que hubo una tos. Se usa el PICO (no el RMS)
# porque una tos es un evento breve y fuerte: su pico no se diluye con la duracion.
PEAK_MIN = 0.04

# En Windows el registro a veces mapea .js a text/plain, y así los service workers
# no se registran (la PWA no instala). Fuerzo los MIME correctos para todos los entornos.
mimetypes.add_type('text/javascript', '.js')
mimetypes.add_type('application/manifest+json', '.webmanifest')
mimetypes.add_type('font/woff2', '.woff2')

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / 'model'

# Cargo modelo, scaler y metadatos una sola vez al arrancar
modelo = joblib.load(MODEL_DIR / 'model.joblib')
scaler = joblib.load(MODEL_DIR / 'scaler.joblib')
meta = json.loads((MODEL_DIR / 'meta.json').read_text(encoding='utf-8'))
CLASES = meta['clases']   # {'0': 'Negative', '1': 'Positive'}

app = FastAPI(title='Detector de tos COVID (demo educativo)')

# Precalentamiento: se fuerza la primera inicializacion de librosa en el arranque
# (y no en la primera peticion del usuario), para que /predict responda rapido.
try:
    import librosa as _lb
    _lb.feature.mfcc(y=np.zeros(16000, dtype='float32'), sr=16000, n_mfcc=4)
except Exception:
    pass


@app.get('/health')
def health():
    return {'status': 'ok', 'modelo': meta['modelo']}


# Nota: se define como funcion sincrona (no async) a proposito. FastAPI ejecuta los
# endpoints 'def' en un hilo aparte, de modo que el trabajo pesado de librosa no
# bloquea el bucle de eventos y el /health sigue respondiendo (evita reinicios en Render).
@app.post('/predict')
def predict(audio: UploadFile = File(...),
            consent: str = Form('false'),
            genero: str = Form(''),
            edad: str = Form('')):
    # Leo el audio que mandó el navegador y lo cargo
    audio_bytes = audio.file.read()
    try:
        senal = cargar(io.BytesIO(audio_bytes))
    except Exception as e:
        return JSONResponse(status_code=400,
                            content={'error': f'No pude leer el audio: {e}'})

    # Guarda de silencio: si no hubo un sonido fuerte (pico bajo), no fue una tos
    peak = float(np.max(np.abs(senal))) if senal.size else 0.0
    if peak < PEAK_MIN:
        return {'sin_tos': True}

    # Escalo y predigo (misma cadena que en el notebook)
    features = features_de_senal(senal)
    x = scaler.transform(features.reshape(1, -1))
    pred = int(modelo.predict(x)[0])
    prob_covid = float(modelo.predict_proba(x)[0][1])
    etiqueta = CLASES[str(pred)]

    # Si el usuario aceptó, guardo la grabación para mejorar el modelo (opcional)
    guardado = False
    if consent.lower() == 'true':
        guardado = guardar_en_supabase(audio_bytes, etiqueta, prob_covid, genero, edad)

    return {'prediction': etiqueta, 'probability_covid': round(prob_covid, 3),
            'guardado': guardado}


def guardar_en_supabase(audio_bytes, prediccion, prob, genero, edad):
    """Sube la grabación al bucket y registra el resultado. Silencioso si no hay
    Supabase configurado (así la app funciona igual en local sin base de datos)."""
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_KEY')
    if not url or not key:
        return False
    try:
        from supabase import create_client
        cliente = create_client(url, key)
        nombre = f'{datetime.datetime.utcnow():%Y%m%d}/{uuid.uuid4().hex}.wav'
        cliente.storage.from_('coughs').upload(
            nombre, audio_bytes, {'content-type': 'audio/wav'})
        cliente.table('coughs').insert({
            'prediction': prediccion,
            'probability': round(prob, 3),
            'consent': True,
            'genero': genero or None,
            'edad': int(edad) if str(edad).isdigit() else None,
            'audio_path': nombre,
        }).execute()
        return True
    except Exception as e:
        print('Aviso: no se pudo guardar en Supabase:', e)
        return False


# Sirvo la PWA (index.html y assets) desde la carpeta static.
# Va al final para que /health y /predict tengan prioridad sobre los estáticos.
app.mount('/', StaticFiles(directory=str(BASE_DIR / 'static'), html=True), name='static')
