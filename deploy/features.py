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


def cargar(fuente):
    """Carga un audio (ruta o BytesIO) y lo remuestrea a SR."""
    senal, _ = librosa.load(fuente, sr=SR)
    return senal


def features_de_senal(senal):
    """Vector de 40 features (media y std de los 20 MFCC) a partir de la senal."""
    mfcc = librosa.feature.mfcc(y=senal, sr=SR, n_mfcc=N_MFCC)   # (20, n_ventanas)
    return np.concatenate([mfcc.mean(axis=1), mfcc.std(axis=1)])


def extraer_features(fuente):
    """Carga y extrae en un paso (misma salida de siempre; lo usa train_and_export)."""
    return features_de_senal(cargar(fuente))
