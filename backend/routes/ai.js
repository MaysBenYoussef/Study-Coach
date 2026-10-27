const express  = require('express');
const router   = express.Router();
const fetch    = require('node-fetch');
const { requireAuth } = require('../middleware/auth');
require('dotenv').config();

const OLLAMA_URL   = process.env.OLLAMA_URL   || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3:8b';

const MODE_PROMPTS = {
  lazy: `Tu es un coach d'étude bienveillant. MODE LAZY : séances 20-25 min max, 3+ pauses/jour, zéro pression, langage doux.`,
  balanced: `Tu es un coach d'étude sage. MODE BALANCED : Pomodoro 25/5, rappel actif, répétition espacée. Planning réaliste.`,
  hardcore: `Tu es un coach intense. MODE HARDCORE : blocs 50 min, rappel actif uniquement, discipline maximale. Énergie élevée.`
};

router.post('/generate', requireAuth, async (req, res) => {
  const { situation, mode } = req.body;
  if (!situation || !mode) return res.status(400).json({ error: 'situation et mode requis' });

  const prompt = `Situation de l'étudiant : ${situation}\n\nCrée un plan d'étude personnalisé avec :\n1. Planning jour par jour (créneaux précis)\n2. Techniques adaptées\n3. Conseils de régularité\n4. Message motivant final\n\nSois précis et pratique.`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: MODE_PROMPTS[mode] || MODE_PROMPTS.balanced },
          { role: 'user', content: prompt }
        ],
        stream: true
      })
    });
    if (!ollamaRes.ok) { send({ error: `Ollama erreur ${ollamaRes.status}` }); return res.end(); }
    let full = '';
    for await (const chunk of ollamaRes.body) {
      for (const line of chunk.toString().split('\n').filter(l => l.trim())) {
        try {
          const d = JSON.parse(line);
          if (d.message?.content) { full += d.message.content; send({ token: d.message.content }); }
          if (d.done) send({ done: true, full, model: OLLAMA_MODEL });
        } catch {}
      }
    }
  } catch (err) { send({ error: err.message }); }
  finally { res.end(); }
});

router.get('/status', requireAuth, async (req, res) => {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) throw new Error('bad status');
    const data = await r.json();
    res.json({ online: true, model: OLLAMA_MODEL, available_models: (data.models || []).map(m => m.name) });
  } catch {
    res.json({ online: false, model: OLLAMA_MODEL, available_models: [] });
  }
});

module.exports = router;
