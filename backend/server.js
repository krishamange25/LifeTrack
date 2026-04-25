const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = 5000;
const DB   = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

/* ── helpers ── */
function readDB()  { 
  try { 
    const data = JSON.parse(fs.readFileSync(DB,'utf8')); 
    return { users: [], goals: [], settings: {}, user: {}, ...data };
  } catch { 
    return { users: [], goals: [], settings: {}, user: {} }; 
  } 
}
function writeDB(d){ fs.writeFileSync(DB, JSON.stringify(d,null,2)); }

/* ── auth ── */
app.post('/api/signup', (req, res) => {
  const { email, password, name } = req.body;
  const d = readDB();
  if (d.users.find(u => u.email === email)) return res.status(400).json({ err: 'User already exists' });
  const newUser = { email, password, name, id: Date.now() + '' };
  d.users.push(newUser);
  writeDB(d);
  res.json({ ok: true, user: { email, name, id: newUser.id } });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const d = readDB();
  const user = d.users.find(u => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ err: 'Invalid credentials' });
  res.json({ ok: true, user: { email: user.email, name: user.name, id: user.id } });
});

/* ── health ── */
app.get('/api/health', (_,res) => res.json({ok:true}));

/* ── user ── */
app.get('/api/user',    (_,res)      => res.json(readDB().user));
app.post('/api/user',   (req,res)    => { const d=readDB(); d.user=req.body; writeDB(d); res.json({ok:true}); });

/* ── goals ── */
app.get('/api/goals',   (_,res)      => res.json({goals:readDB().goals}));
app.post('/api/goals',  (req,res)    => {
  const d=readDB();
  const g={...req.body, id: req.body.id||Date.now()+''};
  d.goals.push(g); writeDB(d); res.json(g);
});
app.put('/api/goals/:id', (req,res) => {
  const d=readDB();
  const i=d.goals.findIndex(g=>g.id===req.params.id);
  if(i<0) return res.status(404).json({err:'not found'});
  d.goals[i]={...d.goals[i],...req.body}; writeDB(d); res.json(d.goals[i]);
});
app.delete('/api/goals/:id', (req,res) => {
  const d=readDB();
  d.goals=d.goals.filter(g=>g.id!==req.params.id); writeDB(d); res.json({ok:true});
});

/* ── settings ── */
app.get('/api/settings',  (_,res)   => res.json(readDB().settings));
app.post('/api/settings', (req,res) => { const d=readDB(); d.settings=req.body; writeDB(d); res.json({ok:true}); });

/* ── insights (server-side calculation) ── */
app.get('/api/insights', (_,res) => {
  const {user,goals,settings} = readDB();
  const income   = user.income || 1;
  const savings  = user.savings || 0;
  const ratio    = savings / income;
  let score = 0;
  score += Math.min(ratio*200, 30);
  score += Math.min((user.emergencyMonths||0)*3, 20);
  if(user.tracksFinance) score += 10;
  if(user.hasApp)        score += 5;
  if(user.savesFirst)    score += 10;
  if(user.extraAction==='Invest') score += 15;
  else if(user.extraAction==='Save') score += 10;
  if(user.hasEmergency) score += 10;
  score = Math.min(Math.round(score), 100);

  const personality = user.extraAction==='Invest'||user.riskPref==='Growth' ? 'Investor'
    : ratio>=0.2||user.savesFirst ? 'Saver' : 'Spender';
  const emergency   = (user.emergencyMonths||0)>=6?'Strong':(user.emergencyMonths||0)>=3?'Moderate':'Weak';
  const aScore      = (user.hasApp?1:0)+(user.tracksFinance?1:0)+(user.extraAction==='Invest'?1:0);
  const awareness   = aScore>=3?'Advanced':aScore>=2?'Intermediate':'Beginner';

  const suggestions = [];
  if(ratio<0.2)       suggestions.push('Save at least 20% of your income monthly.');
  if((user.emergencyMonths||0)<3) suggestions.push('Build a 3–6 month emergency fund first.');
  if(user.extraAction==='Spend')  suggestions.push('Consider investing extra money instead of spending.');
  if(!suggestions.length)         suggestions.push('Your financial habits look great! Keep it up.');

  res.json({ score, personality, emergency, awareness, suggestions, totalGoals: goals.length });
});

/* ── MARKET DATA (Mock Live Feed from Real Base Prices) ── */
const BASE_MARKET = {
  NIFTYBEES: { name: 'NIFTYBEES', price: 271.09, change: -0.98, logo: 'NB', color: '#B91C1C', bg: '#FEE2E2' },
  TATAGOLD:  { name: 'TATAGOLD',  price: 14.54,  change: -0.07, logo: 'TG', color: '#0369A1', bg: '#E0F2FE' },
  MON100:    { name: 'Motilal-NASDAQ', price: 293.13, change: 1.12, logo: 'MN', color: '#047857', bg: '#ECFDF5' },
  MAFANG:    { name: 'Mirae Asset FANG+', price: 179.70, change: 3.38, logo: 'MA', color: '#6D28D9', bg: '#F5F3FF' },
  TATASTEEL: { name: 'Tata Steel', price: 210.07, change: -0.40, logo: 'TS', color: '#C2410C', bg: '#FFF7ED' },
  GROWW:     { name: 'Groww Nifty 50', price: 218.02, change: 0.13, logo: 'GW', color: '#15803D', bg: '#F0FDF4' }
};

app.get('/api/market', (req, res) => {
  // Simulate live fluctuations ±0.02%
  const liveData = Object.keys(BASE_MARKET).map(key => {
    const item = { ...BASE_MARKET[key] };
    const jitter = 1 + (Math.random() * 0.0004 - 0.0002);
    item.price = parseFloat((item.price * jitter).toFixed(2));
    return item;
  });
  res.json(liveData);
});

app.listen(PORT, () => console.log(`LifeTrack backend running on http://localhost:${PORT}`));
