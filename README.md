# Clasificación de COVID-19 a partir del sonido de la tos

Proyecto del curso **Machine Learning** — Maestría en AI/DS, UTEC (Prof. Cristian López Del Alamo).

**Integrantes:** Roger Reátegui Soto, Erick Rosas Pisfil, Yemar Puma Huamán

El objetivo es clasificar pacientes como COVID positivo o negativo usando únicamente el sonido de su tos (dataset COSWARA + Virufy: 1207 negativos, 150 positivos).

## Contenido del repositorio

| Archivo / carpeta | Qué es |
|---|---|
| `covid_cough_classification.ipynb` | Notebook principal con todo el flujo: limpieza → MFCC → 5 modelos → K-fold CV → test final |
| `data/features.csv` | Features MFCC ya extraídas (40 por audio) — permite reproducir los experimentos **sin necesidad de los audios** |
| `results/` | Tablas de métricas de cada experimento (CSV) |
| `figures/` | Figuras generadas por el notebook (para el paper) |
| `requirements.txt` | Versiones exactas de las librerías |

## Cómo reproducir

1. Instalar dependencias: `pip install -r requirements.txt`
2. Abrir y ejecutar `covid_cough_classification.ipynb` de arriba hacia abajo ("Run All").
   - Si `data/features.csv` existe (está en el repo), el notebook lo usa directo y **no necesita los audios**.
   - Para regenerar las features desde cero, borrar `data/features.csv` y colocar el dataset en `../Proyecto_clasificacion/cough_sounds/cleaned_data/` (o ajustar `DATA_DIR` en la primera celda de código).

**Semilla:** todo el proyecto usa `SEED = 42` (en `numpy`, el split train/test, el K-fold y todos los modelos), así que los resultados son 100% replicables.

## Metodología (resumen)

- **Features:** 20 MFCC por audio (librosa, resampleo a 22050 Hz), resumidos con media y desviación estándar → vector de 40 features por audio.
- **Limpieza:** etiqueta tomada de la carpeta (hay typos "Postive" en nombres), se conservan los 48 mp3 positivos, se descarta la carpeta `Unknown` (sin etiqueta).
- **Split:** 80% train / 20% test, estratificado y **a nivel de paciente** (las grabaciones de un mismo paciente nunca se reparten entre train y test).
- **Validación:** `StratifiedGroupKFold` de 5 folds sobre el train para todas las pruebas de hiperparámetros.
- **Métricas:** Accuracy, Balanced Accuracy y Precision/Recall/F1 de la clase positiva (dataset desbalanceado 89/11).
- **Modelos:** Regresión Logística, SVM, Árbol de Decisión, KNN y Random Forest (método avanzado).

## Resultados

Mejor configuración de cada modelo (validación cruzada de 5 folds sobre el train; métricas de la clase positiva):

| Modelo | Mejor config | Accuracy | Balanced acc | Precision | Recall | F1 |
|---|---|---|---|---|---|---|
| **SVM** | kernel=rbf, C=10 | 0.905 | 0.615 | 0.522 | 0.255 | **0.339** |
| KNN | k=3, uniform | 0.906 | 0.588 | 0.531 | 0.195 | 0.283 |
| Árbol de Decisión | gini, sin límite | 0.858 | 0.581 | 0.229 | 0.238 | 0.233 |
| Regresión Logística | C=1 | 0.900 | 0.537 | 0.399 | 0.089 | 0.142 |
| Random Forest | 200 árboles, sin límite | 0.908 | 0.520 | 0.600 | 0.040 | 0.074 |

**Mejor modelo: SVM (RBF, C=10).** En el conjunto de test (20%): **accuracy 0.879**, balanced accuracy 0.694. Detecta 20 de 48 casos positivos (recall 42%) y 235 de 242 negativos (97%).

> El accuracy alto es engañoso por el desbalance 89/11 (predecir "todo negativo" ya da ~89%); por eso el mejor modelo se elige por F1/recall de la clase positiva. Detalle completo en la sección de conclusiones del notebook.

## Dataset

Los audios **no están en el repo** (tamaño y licencia). Provienen de las colecciones [COSWARA](https://github.com/iiscleap/Coswara-Data) y [Virufy](https://virufy.org/); la carpeta esperada es `cough_sounds/cleaned_data/{Negative,Positive,Unknown}`.
