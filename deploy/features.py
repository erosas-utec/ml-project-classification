"""Extracción de features de audio compartida entre el entrenamiento y la app.

Uso el MISMO código aquí y en el backend para garantizar que los MFCC que ve el
modelo en producción sean idénticos a los del notebook (misma sr, mismos 20 MFCC,
media + std = 40 features). Cualquier diferencia aquí rompería la paridad.
"""
import numpy as np
import librosa

SR = 22050        # misma frecuencia de muestreo del notebook (resamplea 44.1/48 kHz)
N_MFCC = 20       # mismos 20 coeficientes MFCC

# Orden EXACTO de las columnas tal como quedaron en data/features.csv
FEATURE_COLUMNS = ([f'mfcc_mean_{i}' for i in range(N_MFCC)] +
                   [f'mfcc_std_{i}' for i in range(N_MFCC)])


def extraer_features(fuente):
    """Recibe una ruta de audio o un objeto tipo archivo (BytesIO) y devuelve
    el vector de 40 features (media y std de los 20 MFCC)."""
    senal, sr = librosa.load(fuente, sr=SR)
    mfcc = librosa.feature.mfcc(y=senal, sr=sr, n_mfcc=N_MFCC)   # (20, n_ventanas)
    return np.concatenate([mfcc.mean(axis=1), mfcc.std(axis=1)])
