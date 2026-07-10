# Dashboard Web

PROJEX dashboard app with a Vite/React frontend and FastAPI backend.

## Local Development

Install frontend dependencies:

```bash
npm install
```

Run the frontend:

```bash
npm run dev -- --host 0.0.0.0
```

Run the backend:

```bash
cd backend
./venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Frontend defaults to `http://localhost:5173`.
Backend defaults to `http://127.0.0.1:8000`.

## Docker

Build and run both services:

```bash
docker compose up --build
```

Open:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:8000
```

Stop both services:

```bash
docker compose down
```

The Compose setup uses these images:

```text
lamisfaa/dashboard-web-frontend:latest
lamisfaa/dashboard-web-backend:latest
```

Backend secrets should stay in `backend/.env` locally or be provided as environment variables in production. Do not commit real API keys, OAuth secrets, SMTP passwords, or local database files.
