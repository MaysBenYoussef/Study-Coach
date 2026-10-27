require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const { initDB } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

app.use(express.json({ limit: '20mb' }));

const aiLimiter = rateLimit({ windowMs: 60*1000, max: 10, message: { error: 'Trop de requêtes.' } });

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/plans',    require('./routes/plans'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/stats',    require('./routes/stats'));
app.use('/api/ai',       aiLimiter, require('./routes/ai'));
app.use('/api/pdf',      aiLimiter, require('./routes/pdf'));
app.use('/api/adaptive', require('./routes/adaptive'));
app.use('/api/admin',    require('./routes/admin'));

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.use(express.static(path.join(__dirname, '../frontend')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

async function start() {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`\n🚀  StudyCoach  →  http://localhost:${PORT}`);
      console.log(`☁️   Supabase    →  ${process.env.SUPABASE_URL}`);
      console.log(`🤖  Ollama      →  ${process.env.OLLAMA_URL || 'http://localhost:11434'}`);
      console.log(`🧠  Modèle IA   →  ${process.env.OLLAMA_MODEL || 'qwen3:8b'}`);
      console.log(`📄  Modèle PDF  →  ${process.env.PDF_MODEL || 'llama3'}\n`);
    });
  } catch(err) {
    console.error('Erreur démarrage:', err.message);
    process.exit(1);
  }
}
start();
