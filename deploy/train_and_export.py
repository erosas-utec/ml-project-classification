"""Entrena el modelo final y lo exporta a disco para la app.

Reuso las features ya calculadas en data/features.csv (las mismas del notebook) y
ajusto el StandardScaler + el SVM ganador (RBF, C=10). Para la app entreno con
TODOS los datos etiquetados (el paper mantiene su split 80/20); así el modelo en
producción aprovecha toda la información disponible.

Guardo model.joblib, scaler.joblib y meta.json en deploy/model/.
Al final hago una verificación de paridad: extraigo las features de un audio real
en vivo y confirmo que coinciden con las de features.csv.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from features import FEATURE_COLUMNS, SR, N_MFCC, extraer_features

SEED = 42
REPO_ROOT = Path(__file__).resolve().parent.parent
FEATURES_CSV = REPO_ROOT / 'data' / 'features.csv'
MODEL_DIR = Path(__file__).resolve().parent / 'model'


def main():
    df = pd.read_csv(FEATURES_CSV, dtype={'id_paciente': str})
    X = df[FEATURE_COLUMNS].values
    y = df['y'].values
    print(f'Datos: {len(df)} audios ({y.mean():.1%} positivos)')

    # Escalo y entreno el SVM ganador con TODOS los datos etiquetados
    scaler = StandardScaler().fit(X)
    modelo = SVC(kernel='rbf', C=10, gamma='scale', probability=True, random_state=SEED)
    modelo.fit(scaler.transform(X), y)
    print(f'Accuracy en entrenamiento (referencia, no es test): '
          f'{modelo.score(scaler.transform(X), y):.3f}')

    # Guardo modelo, scaler y metadatos
    MODEL_DIR.mkdir(exist_ok=True)
    joblib.dump(modelo, MODEL_DIR / 'model.joblib')
    joblib.dump(scaler, MODEL_DIR / 'scaler.joblib')
    meta = {'sr': SR, 'n_mfcc': N_MFCC, 'feature_columns': FEATURE_COLUMNS,
            'seed': SEED, 'clases': {'0': 'Negative', '1': 'Positive'},
            'modelo': 'SVC(kernel=rbf, C=10)'}
    (MODEL_DIR / 'meta.json').write_text(json.dumps(meta, indent=2), encoding='utf-8')
    print(f'Guardado en {MODEL_DIR}')

    # --- Verificación de paridad: features en vivo vs features.csv ---
    fila = df.iloc[0]
    audio_path = (REPO_ROOT / fila['ruta']).resolve()
    if audio_path.exists():
        vivo = extraer_features(str(audio_path))
        csv = fila[FEATURE_COLUMNS].values.astype(float)
        diferencia = np.abs(vivo - csv).max()
        print(f'\nParidad ({fila["archivo"]}): diferencia máxima features = {diferencia:.2e}',
              '-> OK' if diferencia < 1e-4 else '-> REVISAR')
        pred = modelo.predict(scaler.transform(vivo.reshape(1, -1)))[0]
        prob = modelo.predict_proba(scaler.transform(vivo.reshape(1, -1)))[0][1]
        print(f'Predicción de ese audio: {meta["clases"][str(pred)]} '
              f'(prob COVID={prob:.3f}, etiqueta real={meta["clases"][str(fila["y"])]})')
    else:
        print(f'\n(No encontré el audio {audio_path} para la paridad; se omite.)')


if __name__ == '__main__':
    main()
