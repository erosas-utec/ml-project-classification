# Clasificación de COVID-19 a partir del sonido de la tos

Proyecto del curso **Machine Learning** — Maestría en DS/AI, UTEC (Prof. Cristian López Del Alamo).

**Integrantes:** Roger Reátegui Soto, Erick Rosas Pisfil, Yemar Puma Huamán

El objetivo es clasificar pacientes como COVID positivo o negativo usando únicamente el sonido de su tos (dataset COSWARA + Virufy: 1207 negativos, 150 positivos).

## Contenido del repositorio

| Archivo / carpeta | Qué es |
|---|---|
| `covid_cough_classification.ipynb` | Notebook principal: limpieza → MFCC → 5 modelos → K-fold CV → mejora (umbral) → test |
| `data/features.csv`, `data/features_delta.csv` | Features MFCC (y deltas) precomputadas — reproducen los experimentos **sin necesidad de los audios** |
| `results/` | Tablas de métricas de cada experimento (CSV) |
| `figures/` | Figuras generadas por el notebook |
| `paper/` | Informe IEEE en LaTeX (`main.tex`, `main.pdf`, `figures/`) — ver `paper/README.md` |
| `deploy/` | Web app (FastAPI + PWA «Aliento») para Hugging Face Spaces — ver `deploy/README.md` |
| `insumos_originales/` | Material provisto para el proyecto: dataset (`cough_sounds/`), enunciado (`proyecto_lineamientos.pdf`) y plantilla IEEE (`ieee/`). **El audio no se versiona** (tamaño y licencia). |
| `requirements.txt` | Versiones exactas de las librerías |

## Cómo reproducir

1. Instalar dependencias: `pip install -r requirements.txt`
2. Ejecutar `covid_cough_classification.ipynb` de arriba hacia abajo ("Run All").
   - Con `data/features.csv` y `data/features_delta.csv` presentes (están en el repo), el notebook los usa directo y **no necesita los audios**.
   - Para regenerar las features desde cero, borrar esos dos CSV; el audio está en `insumos_originales/cough_sounds/cleaned_data/`.

**Semilla:** todo el proyecto usa `SEED = 42` (en `numpy`, el split train/test, el K-fold y todos los modelos); los resultados son reproducibles.

## Flujo de trabajo (sincronización end-to-end)

Cadena de dependencias entre las piezas del proyecto:

```
insumos_originales/cough_sounds  ->  notebook  ->  data/*.csv + results/*.csv + figures/*.png
                                                        |
        +-----------------------------------------------+------------------------------------+
        v                                               v                                    v
 deploy/train_and_export.py                     figures/ (se copian a paper/)        results/ (números del paper)
        v                                               v
 deploy/model/*.joblib                          paper/main.tex -> paper/main.pdf
        v
 app FastAPI (deploy/) -> Hugging Face Space
```

**Si editas el notebook (p. ej. para mejorar las métricas) y cambian los resultados, sincroniza así:**

1. Ejecuta el notebook completo (Run All) → regenera `data/`, `results/` y `figures/`.
2. Si cambió el modelo que usa la app: `cd deploy && python train_and_export.py` → regenera `deploy/model/`.
3. Actualiza el paper: `cp figures/*.png paper/figures/` y ajusta los números de las tablas de `paper/main.tex` con los nuevos valores de `results/*.csv`; recompila (Overleaf o `pdflatex`).
4. `git add -A && git commit && git push`.

Todo es determinista (`SEED=42`, split a nivel de paciente), de modo que reproducir el notebook da exactamente los mismos números.

## Metodología (resumen)

- **Features:** 20 MFCC por audio (librosa, resampleo a 22050 Hz), resumidos con media y desviación estándar → 40 features por audio.
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

**Mejor modelo: SVM (RBF, C=10).** Se exploraron PCA/LDA, `class_weight` y deltas de MFCC (no mejoraron el F1 en CV). La estrategia que sí mejoró fue el **ajuste del umbral de decisión (0.5 → 0.25)**. En el conjunto de test:

| Métrica (test) | Base (umbral 0.5) | Mejorado (umbral 0.25) |
|---|---|---|
| Recall (positivos) | 0.417 | **0.500** |
| F1 (positivos) | 0.533 | **0.558** |
| Balanced accuracy | 0.694 | **0.721** |
| Accuracy | 0.879 | 0.869 |

El modelo mejorado detecta 24 de 48 positivos y 228 de 242 negativos. El accuracy por sí solo es engañoso con el desbalance 89/11; por eso la selección prioriza el F1/recall de la clase positiva.

## Demo (web app)

**Demo en vivo: https://ml-project-classification.onrender.com**

La carpeta `deploy/` contiene «Aliento», una web app (FastAPI + PWA) que graba una tos y estima el riesgo con el modelo entrenado. Es un **demo educativo, no un diagnóstico**. Instrucciones de despliegue en `deploy/README.md`.

## Dataset

Los audios provienen de las colecciones [COSWARA](https://github.com/iiscleap/Coswara-Data) y [Virufy](https://virufy.org/) y están en `insumos_originales/cough_sounds/cleaned_data/{Negative,Positive,Unknown}`. **No se versionan en el repo** (tamaño y licencia); los CSV de features sí, para poder reproducir sin el audio.
