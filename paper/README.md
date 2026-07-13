# Paper IEEE

Informe del proyecto en formato IEEE (plantilla `IEEEtran`, conference, dos columnas), en español.

## Archivos
- `main.tex` — fuente del paper.
- `IEEEtran.cls` — clase de la plantilla IEEE.
- `figures/` — figuras generadas por el notebook.
- `main.pdf` — versión compilada (4 páginas).

## Cómo compilar

**Opción A — Overleaf (recomendada):** crear un proyecto nuevo, subir esta carpeta completa (`main.tex`, `IEEEtran.cls`, `figures/`) y compilar con pdfLaTeX.

**Opción B — LaTeX local:** con una distribución instalada (TeX Live / MiKTeX):

```
pdflatex main.tex
pdflatex main.tex
```

(Dos pasadas para resolver las referencias cruzadas.)

Las figuras y tablas provienen de la corrida del notebook `covid_cough_classification.ipynb`; los valores son reproducibles con la semilla fija (`SEED=42`).
