# 🚀 StudyCoach — AI Life Assistant for Students

A full-stack AI-powered study coach that runs **100% locally** using Ollama.

## Stack
| Layer | Tech |
|---|---|
| Frontend | Vanilla HTML/CSS/JS (dark theme, streaming UI) |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| AI | Ollama (local LLM — no API key needed) |

---

## 📦 Prerequisites

1. **Node.js** → https://nodejs.org (v18+)
2. **PostgreSQL** → https://www.postgresql.org/download/windows/
3. **Ollama** → https://ollama.com/download

---

## 🛠 Setup (Step by step)

### 1. Install & pull a model in Ollama

Open PowerShell:
```powershell
ollama pull llama3
```

### 2. Start Ollama with CORS enabled

```powershell
$env:OLLAMA_ORIGINS="*"; ollama serve
```
Keep this window open.

### 3. Create the PostgreSQL database

Open pgAdmin or psql and run:
```sql
CREATE DATABASE studycoach;
```

### 4. Configure the backend

Edit `backend/.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=studycoach
DB_USER=postgres
DB_PASSWORD=your_postgres_password

OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3

PORT=3001
FRONTEND_URL=http://localhost:5500
```

### 5. Install backend dependencies

```powershell
cd backend
npm install
```

### 6. Start the backend

```powershell
npm start
```

You should see:
```
✅  Database ready
🚀  StudyCoach backend running at http://localhost:3001
📡  Ollama:  http://localhost:11434
🧠  Model:   llama3
🗄️   DB:      studycoach @ localhost
```

The backend **automatically creates all database tables** on first run.

### 7. Open the frontend

Open `frontend/index.html` directly in your browser.
Or use VS Code Live Server for a better experience.

---

## 🗂 Project Structure

```
studycoach/
├── backend/
│   ├── server.js          ← Express app entry point
│   ├── .env               ← Your config (DB, Ollama, port)
│   ├── package.json
│   ├── db/
│   │   ├── index.js       ← PostgreSQL connection pool
│   │   └── schema.sql     ← Database tables (auto-applied)
│   └── routes/
│       ├── ai.js          ← Ollama streaming SSE route
│       ├── plans.js       ← CRUD for study plans
│       ├── sessions.js    ← Timer session logging
│       └── stats.js       ← Aggregated user stats
└── frontend/
    └── index.html         ← Full single-page app
```

---

## 🌐 API Endpoints

| Method | URL | Description |
|---|---|---|
| POST | /api/ai/generate | Stream AI plan (SSE) |
| GET | /api/ai/status | Check Ollama status |
| GET | /api/plans | Get all saved plans |
| POST | /api/plans | Save a new plan |
| GET | /api/plans/:id | Get a single plan |
| DELETE | /api/plans/:id | Delete a plan |
| POST | /api/sessions | Log a timer session |
| GET | /api/sessions | Get recent sessions |
| GET | /api/stats | Get user stats |
| GET | /api/stats/weekly | Get weekly activity |

---

## 🔧 Troubleshooting

**"Backend offline" in the UI**
→ Make sure `npm start` is running in the backend folder.

**"Ollama offline"**
→ Run `$env:OLLAMA_ORIGINS="*"; ollama serve` in PowerShell.

**Database connection error**
→ Check your `.env` password matches your PostgreSQL password.
→ Make sure PostgreSQL service is running (check Windows Services).

**Model not found**
→ Run `ollama pull llama3` to download the model first.

---

## 🎯 Features

- **3 AI Modes** — Lazy / Balanced / Hardcore (different prompt per mode)
- **Live streaming** — response appears token by token like ChatGPT
- **Save plans to PostgreSQL** — persisted across sessions
- **My Plans view** — browse, expand, copy, delete saved plans
- **Study timer** — Pomodoro with circular progress ring, auto-logs sessions to DB
- **Stats dashboard** — total plans, sessions, minutes studied, weekly bar chart
- **Ollama status** — live green/red indicator
