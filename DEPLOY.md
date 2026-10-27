# 🚀 Déployer StudyCoach en ligne

## Architecture déployée
```
Frontend (Vercel/Netlify) ←→ Backend (Railway) ←→ Supabase (cloud)
                                    ↓
                              Ollama (local chez toi)
```

> ⚠️ Ollama tourne toujours en local. Le backend Railway s'y connecte via ton IP publique ou un tunnel ngrok.

---

## Étape 1 — Déployer le Backend sur Railway

1. Va sur **[railway.app](https://railway.app)** → connecte-toi avec GitHub
2. Clique **New Project → Deploy from GitHub repo**
3. Upload ou push le dossier `backend/` dans un repo GitHub
4. Railway détecte automatiquement Node.js et lance `npm start`

**Configure les variables d'environnement dans Railway :**

Dans ton projet Railway → **Variables** → ajoute ces variables :

```
SUPABASE_URL       = https://lwthglqkahuoojvfzyoc.supabase.co
SUPABASE_ANON_KEY  = eyJhbG...  (ta clé anon Supabase)
OLLAMA_URL         = http://TON_IP_PUBLIQUE:11434   (voir note ci-dessous)
OLLAMA_MODEL       = qwen3:8b
PORT               = 3001
FRONTEND_URL       = *
```

**Exposer Ollama sur Internet (option A — ngrok) :**
```powershell
# Installe ngrok : https://ngrok.com/download
ngrok http 11434
# Copie l'URL https://xxxx.ngrok.io et mets-la dans OLLAMA_URL
```

**Option B — IP fixe (si tu as une IP publique) :**
```powershell
# Lance Ollama accessible depuis l'extérieur
$env:OLLAMA_HOST="0.0.0.0"; $env:OLLAMA_ORIGINS="*"; ollama serve
# Mets ton IP publique dans OLLAMA_URL : http://TON_IP:11434
```

Railway te donnera une URL comme : `https://studycoach-backend.railway.app`

---

## Étape 2 — Déployer le Frontend sur Vercel

1. Va sur **[vercel.com](https://vercel.com)** → connecte GitHub
2. **New Project → Import** ton repo frontend
3. Dans les settings : **Root Directory = frontend/**
4. Framework Preset : **Other**
5. Clique **Deploy**

**Puis mets à jour `frontend/config.js` avec ton URL Railway :**
```javascript
const STUDYCOACH_BACKEND = 'https://studycoach-backend.railway.app';
```

Vercel te donnera une URL comme : `https://studycoach.vercel.app`

---

## Option alternative — Déployer les deux sur Railway

Railway peut aussi servir le frontend statique depuis le backend Express.
Le fichier `server.js` sert déjà `frontend/` comme static. Il suffit de :
1. Mettre `frontend/` et `backend/` dans le même repo
2. Déployer depuis la racine du projet
3. Une seule URL pour tout !

---

## 🏠 Lancer en local (développement)

```powershell
# Terminal 1 — Ollama
$env:OLLAMA_ORIGINS="*"; ollama serve

# Terminal 2 — Backend
cd backend
npm install
npm start

# Puis ouvrir frontend/index.html dans le navigateur
```

---

## Changer de modèle

Dans `backend/.env` (ou Railway Variables) :
```
OLLAMA_MODEL=qwen3:8b       # Recommandé — rapide + intelligent
OLLAMA_MODEL=llama3         # Alternative — bonne qualité
OLLAMA_MODEL=mistral        # Léger et rapide
OLLAMA_MODEL=deepseek-r1    # Excellent pour le raisonnement
```

Puis : `ollama pull qwen3:8b`
