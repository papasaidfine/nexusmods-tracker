#!/bin/bash
cd /home/lchen/src/nexusmods-tracker/backend
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
