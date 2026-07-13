"""Sube esta carpeta (deploy/) como un Space de Hugging Face y lo deja publico.

Pasos previos (una sola vez):
    pip install huggingface_hub
    huggingface-cli login        # pega un token de HF con rol "Write"

Luego, desde la raiz del repo:
    python deploy/deploy_to_hf.py

Crea (o actualiza) el Space erosas-utec/aliento con SDK Docker y sube el
contenido de deploy/. Hugging Face construye la imagen automaticamente.
"""
from pathlib import Path
from huggingface_hub import create_repo, upload_folder

REPO_ID = "erosas-utec/aliento"          # usuario / nombre del Space (cambiar el nombre si se desea)
DEPLOY_DIR = Path(__file__).resolve().parent

# 1) Crear el Space (si ya existe, no falla)
create_repo(REPO_ID, repo_type="space", space_sdk="docker",
            private=False, exist_ok=True)

# 2) Subir el contenido de deploy/ a la raiz del Space
upload_folder(
    repo_id=REPO_ID,
    repo_type="space",
    folder_path=str(DEPLOY_DIR),
    commit_message="Deploy Aliento",
    ignore_patterns=["deploy_to_hf.py", "**/__pycache__/**", "*.pyc"],
)

url_publica = "https://" + REPO_ID.replace("/", "-") + ".hf.space"
print("Subida completa. Hugging Face esta construyendo la imagen Docker.")
print("  Panel del Space: https://huggingface.co/spaces/" + REPO_ID)
print("  URL publica:     " + url_publica)
