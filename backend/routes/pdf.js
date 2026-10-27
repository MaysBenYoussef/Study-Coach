const express  = require('express');
const router   = express.Router();
const fetch    = require('node-fetch');
const { requireAuth } = require('../middleware/auth');
require('dotenv').config();

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const PDF_MODEL  = process.env.PDF_MODEL  || process.env.OLLAMA_MODEL || 'llama3';

function extractText(base64) {
  try {
    const raw = Buffer.from(base64, 'base64').toString('latin1');
    const texts = [];
    const re = /BT([\s\S]*?)ET/g;
    let m;
    while ((m = re.exec(raw)) !== null) {
      const sr = /\(([^)]{1,200})\)/g;
      let s;
      while ((s = sr.exec(m[1])) !== null) {
        const c = s[1].replace(/\\[nrt]/g,' ').replace(/[^\x20-\x7E]/g,' ').trim();
        if (c.length > 3) texts.push(c);
      }
    }
    let result = texts.join(' ').replace(/\s{3,}/g,'\n').trim();
    if (result.length < 80) {
      result = raw.replace(/[^\x20-\x7E\n]/g,' ').replace(/\s{4,}/g,'\n')
        .split('\n').filter(l => l.trim().length > 25).join('\n');
    }
    return result.slice(0, 3500);
  } catch(e) { throw new Error('Lecture PDF impossible : ' + e.message); }
}

async function callOllama(prompt, isJson) {
  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), 300000);
  try {
    const r = await fetch(`${OLLAMA_URL}/api/chat`, {
      method:'POST', headers:{'Content-Type':'application/json'}, signal:ctrl.signal,
      body: JSON.stringify({ model:PDF_MODEL, messages:[{role:'user',content:prompt}], stream:false, options:{temperature:0.2,num_predict:isJson?1024:1500,num_ctx:4096} })
    });
    if (!r.ok) throw new Error('Ollama erreur ' + r.status);
    const d = await r.json();
    return d.message?.content || '';
  } finally { clearTimeout(t); }
}

router.post('/process', requireAuth, async (req, res) => {
  res.setHeader('Content-Type','application/json');
  const { pdf, mode } = req.body;
  if (!pdf)  return res.status(400).json({ success:false, error:'PDF manquant.' });
  if (!mode) return res.status(400).json({ success:false, error:'Mode manquant.' });

  let text;
  try { text = extractText(pdf); }
  catch(err) { return res.status(400).json({ success:false, error:err.message }); }

  if (text.trim().length < 50)
    return res.status(400).json({ success:false, error:"PDF vide ou scan image. Seuls les PDFs texte sont supportés." });

  try {
    if (mode === 'summary') {
      const prompt = "Résume ce cours en français. Sois concis.\n\nCOURS:\n" + text +
        "\n\nFORMAT:\n## Concepts clés\n- (5 notions)\n\n## Points essentiels\n1. ...\n\n## Résumé en 2 phrases\n...";
      const result = await callOllama(prompt, false);
      if (!result || result.trim().length < 20) return res.status(500).json({ success:false, error:'Réponse vide. Réessaie.' });
      return res.json({ success:true, result });
    } else if (mode === 'quiz') {
      const prompt = "Génère 5 questions QCM sur ce cours. Réponds UNIQUEMENT avec du JSON valide.\n\nCOURS:\n" + text +
        '\n\nJSON:\n[{"question":"Q?","options":["A","B","C","D"],"answer":0}]\n\n5 objets. answer=index 0-3. En français.';
      const raw = await callOllama(prompt, true);
      if (!raw || raw.trim().length < 10) return res.status(500).json({ success:false, error:'Réponse vide. Réessaie.' });
      let quiz;
      try {
        const match = raw.match(/\[[\s\S]*\]/);
        if (!match) throw new Error('Pas de JSON.');
        quiz = JSON.parse(match[0]);
        if (!Array.isArray(quiz)) throw new Error('Pas un tableau.');
        quiz = quiz.filter(q => q.question && Array.isArray(q.options) && q.options.length >= 2 && typeof q.answer === 'number').slice(0,10);
        if (!quiz.length) throw new Error('Aucune question valide.');
      } catch(e) {
        console.error('Quiz parse:', e.message, raw.slice(0,300));
        return res.status(500).json({ success:false, error:'Quiz mal formaté. Réessaie.' });
      }
      return res.json({ success:true, quiz });
    } else {
      return res.status(400).json({ success:false, error:'Mode invalide.' });
    }
  } catch(err) {
    console.error('PDF error:', err.message);
    if (err.name === 'AbortError') return res.status(504).json({ success:false, error:'Timeout 5min. Ajoute PDF_MODEL=llama3 dans .env.' });
    return res.status(500).json({ success:false, error:err.message });
  }
});

module.exports = router;
