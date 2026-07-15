"""Extracción de features de audio compartida entre el entrenamiento y la app.

Se usa el MISMO código aquí y en el backend para garantizar que las características
que ve el modelo en producción sean idénticas a las del notebook. El vector final
tiene 64 dimensiones: 40 de MFCC (media y std de 20 coeficientes) más 24 descriptores
espectrales (contraste, cruces por cero, centroide, ancho de banda, rolloff y RMS),
todos resumidos con media y desviación estándar. El orden coincide exactamente con
`data/features.csv` + `data/features_espectral.csv`. Cualquier diferencia rompería la paridad.
"""
import numpy as np
import librosa

SR = 22050        # misma frecuencia de muestreo del notebook (resamplea 44.1/48 kHz)
N_MFCC = 20       # mismos 20 coeficientes MFCC

# Orden EXACTO de las columnas: MFCC (40) + descriptores espectrales (24) = 64
FEATURE_COLUMNS = (
    [f'mfcc_mean_{i}' for i in range(N_MFCC)] + [f'mfcc_std_{i}' for i in range(N_MFCC)] +
    [f'contrast_mean_{i}' for i in range(7)] + [f'contrast_std_{i}' for i in range(7)] +
    ['zcr_mean', 'zcr_std', 'cent_mean', 'cent_std', 'bw_mean', 'bw_std',
     'roll_mean', 'roll_std', 'rms_mean', 'rms_std']
)


def cargar(fuente):
    """Carga un audio (ruta o BytesIO) y lo remuestrea a SR."""
    senal, _ = librosa.load(fuente, sr=SR)
    return senal


def _ms(x):
    """Media y desviación estándar por fila (concatenadas)."""
    return np.concatenate([x.mean(axis=1), x.std(axis=1)])


def features_de_senal(senal):
    """Vector de 64 features (MFCC + descriptores espectrales) a partir de la senal."""
    mfcc = librosa.feature.mfcc(y=senal, sr=SR, n_mfcc=N_MFCC)
    contrast = librosa.feature.spectral_contrast(y=senal, sr=SR)
    zcr = librosa.feature.zero_crossing_rate(y=senal)
    cent = librosa.feature.spectral_centroid(y=senal, sr=SR)
    bw = librosa.feature.spectral_bandwidth(y=senal, sr=SR)
    roll = librosa.feature.spectral_rolloff(y=senal, sr=SR)
    rms = librosa.feature.rms(y=senal)
    return np.concatenate([_ms(mfcc), _ms(contrast), _ms(zcr), _ms(cent),
                           _ms(bw), _ms(roll), _ms(rms)])


def extraer_features(fuente):
    """Carga y extrae en un paso (lo usa train_and_export para la paridad)."""
    return features_de_senal(cargar(fuente))
