# Clasificación de COVID-19 a partir del sonido de la tos

Proyecto del curso **Machine Learning** — Maestría en DS/AI, UTEC (Prof. Cristian López Del Alamo).

**Integrantes:** Roger Reátegui Soto, Erick Rosas Pisfil, Yemar Puma Huamán

El objetivo es clasificar pacientes como COVID positivo o negativo usando únicamente el sonido de su tos (dataset COSWARA + Virufy: 1207 negativos, 150 positivos).

## Contenido del repositorio

| Archivo / carpeta | Qué es |
|---|---|
| `covid_cough_classification.ipynb` | Notebook principal: limpieza, extracción de features, cinco modelos con validación cruzada, estrategias de mejora y evaluación en test |
| `data/*.csv` | Features precomputadas (MFCC, espectrales y deltas) — reproducen los experimentos **sin necesidad de los audios** |
| `results/` | Tablas de métricas de cada experimento (CSV) |
| `figures/` | Figuras generadas por el notebook |
| `paper/` | Informe IEEE en LaTeX (`main.tex`, `main.pdf`, `figures/`) — ver `paper/README.md` |
| `docs/` | Página de arquitectura y pipeline (GitHub Pages) |
| `deploy/` | Web app (FastAPI + PWA «Aliento»), desplegada en Render — ver `deploy/README.md` |
| `insumos_originales/` | Material provisto: dataset (`cough_sounds/`) y enunciado (`proyecto_lineamientos.pdf`). **El audio no se versiona** (tamaño y licencia). |
| `requirements.txt` | Versiones exactas de las librerías |

## Cómo reproducir

1. Instalar dependencias: `pip install -r requirements.txt`
2. Ejecutar `covid_cough_classification.ipynb` de arriba hacia abajo ("Run All").
   - Con `data/features.csv` y `data/features_delta.csv` presentes (están en el repo), el notebook los usa directo y **no necesita los audios**.
   - Para regenerar las features desde cero, borrar esos dos CSV; el audio está en `insumos_originales/cough_sounds/cleaned_data/`.

**Semilla:** todo el proyecto usa `SEED = 42` (en `numpy`, el split train/test, el K-fold y todos los modelos); los resultados son reproducibles.

## Cómo se conecta todo

El notebook es la fuente de verdad: procesa los audios y genera `data/*.csv`, `results/*.csv` y `figures/*.png`. De ahí salen los números y las figuras del paper (`paper/`) y el modelo que usa la web app (`deploy/train_and_export.py` → `deploy/model/`). Como todo es determinista (`SEED=42`, split a nivel de paciente), volver a correr el notebook produce los mismos resultados.

## Metodología (resumen)

- **Features:** 20 MFCC + descriptores espectrales (contraste, cruces por cero, centroide, ancho de banda, rolloff, RMS) por audio (librosa, resampleo a 22050 Hz), resumidos con media y desviación estándar → 64 features por audio.
- **Limpieza:** etiqueta tomada de la carpeta (hay typos "Postive"), se conservan los 48 mp3 positivos, se descarta `Unknown` (sin etiqueta).
- **Split:** 80% train / 20% test, estratificado y **a nivel de paciente** (las grabaciones de un mismo paciente nunca se reparten entre train y test → sin fuga de datos).
- **Validación:** `StratifiedGroupKFold` de 5 folds sobre el train.
- **Métricas:** Accuracy, Balanced Accuracy y Precision/Recall/F1 de la clase positiva (desbalance 89/11).
- **Modelos:** Regresión Logística, SVM, Árbol de Decisión, KNN y Random Forest (método adicional).

## Resultados

Mejor configuración de cada modelo (validación cruzada de 5 folds; métricas de la clase positiva):

| Modelo | Mejor config | Accuracy | Balanced acc | Precision | Recall | F1 |
|---|---|---|---|---|---|---|
| **SVM** | kernel=rbf, C=10 | 0.905 | 0.615 | 0.522 | 0.255 | **0.339** |
| KNN | k=3 | 0.906 | 0.588 | 0.531 | 0.195 | 0.283 |
| Árbol de Decisión | gini, sin límite | 0.858 | 0.581 | 0.229 | 0.238 | 0.233 |
| Regresión Logística | C=1 | 0.900 | 0.537 | 0.399 | 0.089 | 0.142 |
| Random Forest | 200 árboles | 0.908 | 0.520 | 0.600 | 0.040 | 0.074 |

**Mejor modelo: SVM (RBF, C=10).** Se exploraron PCA/LDA, `class_weight` y deltas de MFCC (no mejoraron el F1 en CV). Las estrategias que sí mejoraron fueron **enriquecer el vector con descriptores espectrales** (40 → 64 features, F1 en CV 0.339 → 0.375) y el **ajuste del umbral de decisión (0.5 → 0.33)**. En el conjunto de test:

| Métrica (test) | Base (40 MFCC, umbral 0.5) | Final (64 feats, umbral 0.33) |
|---|---|---|
| Recall (positivos) | 0.417 | **0.604** |
| F1 (positivos) | 0.533 | **0.690** |
| Balanced accuracy | 0.694 | **0.788** |
| Accuracy | 0.879 | **0.910** |

El modelo final detecta 29 de 48 positivos y 235 de 242 negativos. El accuracy por sí solo es engañoso con el desbalance 89/11; por eso la selección prioriza el F1/recall de la clase positiva.

## Enlaces

- **Notebook:** [covid_cough_classification.ipynb](https://github.com/erosas-utec/ml-project-classification/blob/main/covid_cough_classification.ipynb)
- **App en vivo:** https://ml-project-classification.onrender.com
- **Arquitectura y pipeline (interactivo):** https://erosas-utec.github.io/ml-project-classification/

La carpeta `deploy/` contiene «Aliento», una web app (FastAPI + PWA) que graba una tos y estima el riesgo con el modelo entrenado. Es un **demo educativo, no un diagnóstico**. Instrucciones de despliegue en `deploy/README.md`.

## Dataset

Los audios provienen de las colecciones [COSWARA](https://github.com/iiscleap/Coswara-Data) y [Virufy](https://virufy.org/) y están en `insumos_originales/cough_sounds/cleaned_data/{Negative,Positive,Unknown}`. **No se versionan en el repo** (tamaño y licencia); los CSV de features sí, para poder reproducir sin el audio.
