/* ─── STATE ─────────────────────────────────── */
let state = {
  currentAge: 28, monthlySavings: 15000, netWorth: 200000,
  annualReturn: 10, inflationOn: false, inflationRate: 5,
  zoom: 'full', milestones: [], modalIdx: null
};

const CAT_ICONS = {
  House:'🏠', Vehicle:'🚗', Business:'💼', Education:'🎓',
  Health:'❤️', Travel:'✈️', Family:'👨‍👩‍👧', Security:'🛡️'
};

const TEMPLATES = {
  apartment: { title:'Buy Apartment', age:35, cost:7500000, category:'House' },
  business:  { title:'Start Business', age:38, cost:3000000, category:'Business' },
  studies:   { title:'Higher Studies', age:26, cost:1500000, category:'Education' },
  emergency: { title:'Emergency Fund', age:30, cost:500000,  category:'Security' },
  trip:      { title:'Dream Trip',     age:32, cost:300000,  category:'Travel' },
  car:       { title:'Buy a Car',      age:30, cost:1200000, category:'Vehicle' }
};

/* ─── INIT ──────────────────────────────────── */
function init() {
  const saved = localStorage.getItem('lt_milestones');
  if (saved) state.milestones = JSON.parse(saved);
  syncSliders();
  document.getElementById('inflation-toggle').addEventListener('change', () => {
    const on = document.getElementById('inflation-toggle').checked;
    state.inflationOn = on;
    document.getElementById('inflation-slider-group').style.display = on ? 'block' : 'none';
    document.getElementById('val-inflation').style.display = on ? 'inline' : 'none';
    updateProjection();
  });
  updateProjection();
}

function syncSliders() {
  setSliderFill('sl-age', state.currentAge, 18, 60);
  setSliderFill('sl-savings', state.monthlySavings, 1000, 200000);
  setSliderFill('sl-networth', state.netWorth, 0, 10000000);
  setSliderFill('sl-return', state.annualReturn, 1, 30);
  setSliderFill('sl-inflation', state.inflationRate, 1, 15);
  document.getElementById('val-age').textContent = state.currentAge;
  document.getElementById('val-savings').textContent = fmt(state.monthlySavings);
  document.getElementById('val-networth').textContent = fmt(state.netWorth);
  document.getElementById('val-return').textContent = state.annualReturn + '%';
  document.getElementById('val-inflation').textContent = state.inflationRate + '%';
  document.getElementById('sl-age').value = state.currentAge;
  document.getElementById('sl-savings').value = state.monthlySavings;
  document.getElementById('sl-networth').value = state.netWorth;
  document.getElementById('sl-return').value = state.annualReturn;
}

function setSliderFill(id, val, min, max) {
  const pct = ((val - min) / (max - min)) * 100;
  document.getElementById(id).style.setProperty('--val', pct + '%');
}

/* ─── SLIDER UPDATE ─────────────────────────── */
function updateSlider(key, val) {
  val = parseFloat(val);
  if (key === 'age')      { state.currentAge = val; document.getElementById('val-age').textContent = val; setSliderFill('sl-age', val, 18, 60); }
  if (key === 'savings')  { state.monthlySavings = val; document.getElementById('val-savings').textContent = fmt(val); setSliderFill('sl-savings', val, 1000, 200000); }
  if (key === 'networth') { state.netWorth = val; document.getElementById('val-networth').textContent = fmt(val); setSliderFill('sl-networth', val, 0, 10000000); }
  if (key === 'return')   { state.annualReturn = val; document.getElementById('val-return').textContent = val + '%'; setSliderFill('sl-return', val, 1, 30); }
  if (key === 'inflation'){ state.inflationRate = val; document.getElementById('val-inflation').textContent = val + '%'; setSliderFill('sl-inflation', val, 1, 15); }
  updateProjection();
}

/* ─── PROJECTION ENGINE ─────────────────────── */
function buildProjection() {
  const startAge = state.currentAge;
  const endAge = 80;
  const r = state.annualReturn / 100;
  const infl = state.inflationOn ? state.inflationRate / 100 : 0;
  const netR = (1 + r) / (1 + infl) - 1;
  const monthly = state.monthlySavings;

  // Sort milestones by age
  const sorted = [...state.milestones].sort((a, b) => a.age - b.age);

  let balance = state.netWorth;
  const points = [];     // { age, balance }
  const drawdowns = [];  // { age, amount, idx }

  for (let age = startAge; age <= endAge; age++) {
    // Apply annual growth + monthly contributions
    const monthlyRate = netR / 12;
    for (let m = 0; m < 12; m++) {
      balance = balance * (1 + monthlyRate) + monthly;
    }
    // Apply drawdowns for this age
    sorted.forEach((ms, i) => {
      if (ms.age === age) {
        const cost = state.inflationOn
          ? ms.cost * Math.pow(1 + infl, age - startAge)
          : ms.cost;
        if (balance >= cost) {
          balance -= cost;
          drawdowns.push({ age, amount: cost, idx: i, canAfford: true });
        } else {
          drawdowns.push({ age, amount: cost, idx: i, canAfford: false });
        }
      }
    });
    points.push({ age, balance: Math.max(0, balance) });
  }
  return { points, drawdowns };
}

function getMilestoneStatus(ms, drawdowns) {
  const dd = drawdowns.find(d => d.idx === state.milestones.indexOf(ms));
  if (!dd) {
    // estimate balance at target age without running full sim
    const proj = buildProjection();
    const pt = proj.points.find(p => p.age === ms.age);
    if (!pt) return 'on-track';
    const cost = ms.cost;
    if (pt.balance >= cost * 1.1) return 'on-track';
    if (pt.balance >= cost * 0.85) return 'close';
    return 'at-risk';
  }
  return dd.canAfford ? 'on-track' : 'at-risk';
}

/* ─── MAIN UPDATE ───────────────────────────── */
function updateProjection() {
  const { points, drawdowns } = buildProjection();
  updateStats(points, drawdowns);
  drawChart(points, drawdowns);
  renderTimeline(drawdowns);
  renderMilestoneCards(drawdowns);
  renderInsights(points, drawdowns);
  renderSmartInsights(points, drawdowns);
}

/* ─── STATS CARDS ───────────────────────────── */
function updateStats(points, drawdowns) {
  const finalPt = points[points.length - 1];
  const finalWealth = finalPt ? finalPt.balance : 0;
  document.getElementById('stat-wealth').textContent = fmtCr(finalWealth);
  document.getElementById('stat-savings').textContent = fmt(state.monthlySavings);

  const total = state.milestones.length;
  let onTrack = 0;
  state.milestones.forEach((ms, i) => {
    const dd = drawdowns.find(d => d.idx === i);
    if (!dd || dd.canAfford) onTrack++;
  });
  document.getElementById('stat-ontrack').textContent = total ? `${onTrack} / ${total}` : '0 / 0';
  document.getElementById('stat-ontrack-sub').textContent = total ? `${onTrack} achievable` : 'Add milestones';

  const totalCost = state.milestones.reduce((s, m) => s + m.cost, 0);
  document.getElementById('stat-totalcost').textContent = fmt(totalCost);
}

/* ─── CHART ─────────────────────────────────── */
function drawChart(points, drawdowns) {
  const canvas = document.getElementById('projectionChart');
  const wrap   = canvas.parentElement;
  canvas.width  = wrap.clientWidth  || 800;
  canvas.height = wrap.clientHeight || 300;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const pad = { top: 30, right: 30, bottom: 40, left: 70 };

  // Zoom filter
  let visPoints = points;
  if (state.zoom === '10') visPoints = points.filter(p => p.age <= state.currentAge + 10);
  if (state.zoom === '5')  visPoints = points.filter(p => p.age <= state.currentAge + 5);
  if (!visPoints.length) return;

  const maxBal = Math.max(...visPoints.map(p => p.balance), 1);
  const minAge = visPoints[0].age, maxAge = visPoints[visPoints.length - 1].age;
  const xS = age => pad.left + ((age - minAge) / (maxAge - minAge || 1)) * (W - pad.left - pad.right);
  const yS = v   => H - pad.bottom - (v / maxBal) * (H - pad.top - pad.bottom);

  ctx.clearRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = '#F3F4F6'; ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = pad.top + ((H - pad.top - pad.bottom) / 5) * i;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    const label = fmtCr(maxBal * (1 - i / 5));
    ctx.fillStyle = '#9CA3AF'; ctx.font = '600 10px Inter'; ctx.textAlign = 'right';
    ctx.fillText(label, pad.left - 6, y + 4);
  }

  // Age labels
  ctx.fillStyle = '#9CA3AF'; ctx.textAlign = 'center';
  visPoints.filter((_, i) => i % 5 === 0).forEach(p => {
    ctx.fillText(p.age, xS(p.age), H - pad.bottom + 16);
  });

  // Gradient fill
  const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
  grad.addColorStop(0, 'rgba(79,70,229,.18)');
  grad.addColorStop(1, 'rgba(79,70,229,0)');
  ctx.beginPath();
  ctx.moveTo(xS(visPoints[0].age), H - pad.bottom);
  visPoints.forEach(p => ctx.lineTo(xS(p.age), yS(p.balance)));
  ctx.lineTo(xS(visPoints[visPoints.length - 1].age), H - pad.bottom);
  ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // Line
  ctx.beginPath(); ctx.strokeStyle = '#4F46E5'; ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  visPoints.forEach((p, i) => i === 0 ? ctx.moveTo(xS(p.age), yS(p.balance)) : ctx.lineTo(xS(p.age), yS(p.balance)));
  ctx.stroke();

  // Drawdown markers
  drawdowns.filter(d => d.age >= minAge && d.age <= maxAge).forEach(d => {
    const x = xS(d.age), y = yS(visPoints.find(p => p.age === d.age)?.balance || 0);
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = d.canAfford ? '#059669' : '#E11D48';
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke();
  });
}

/* ─── TIMELINE ──────────────────────────────── */
function renderTimeline(drawdowns) {
  const container = document.getElementById('timeline-dots');
  container.innerHTML = '';
  const MIN = 20, MAX = 80;
  const agePct = age => ((age - MIN) / (MAX - MIN)) * 100;

  state.milestones.forEach((ms, i) => {
    const age = Math.min(Math.max(ms.age, MIN), MAX);
    const dd = drawdowns.find(d => d.idx === i);
    const status = dd ? (dd.canAfford ? 'on-track' : 'at-risk') : 'on-track';
    const dot = document.createElement('div');
    dot.className = `tl-dot ${status}`;
    dot.style.left = agePct(age) + '%';
    dot.innerHTML = `
      <div class="tl-dot-age">${age}</div>
      <div class="tl-dot-circle"></div>
      <div class="tl-dot-label">${CAT_ICONS[ms.category] || '📌'} ${ms.title}</div>`;
    dot.onclick = () => openModal(i, drawdowns);
    container.appendChild(dot);
  });
}

/* ─── MILESTONE CARDS ───────────────────────── */
function renderMilestoneCards(drawdowns) {
  const grid = document.getElementById('milestones-grid');
  const empty = document.getElementById('empty-state');
  grid.innerHTML = '';
  if (!state.milestones.length) { grid.appendChild(empty); return; }

  state.milestones.forEach((ms, i) => {
    const dd = drawdowns.find(d => d.idx === i);
    const status = dd ? (dd.canAfford ? 'on-track' : 'at-risk') : 'on-track';
    const statusClose = !dd && ms.cost > 0 ? checkClose(ms, i) : status;
    const finalStatus = dd ? (dd.canAfford ? 'on-track' : 'at-risk') : statusClose;
    const labels = { 'on-track': 'On Track', 'close': 'Close', 'at-risk': 'At Risk' };

    const card = document.createElement('div');
    card.className = `milestone-card ${finalStatus}`;
    card.innerHTML = `
      <button class="mc-delete" onclick="event.stopPropagation();deleteMilestone(${i})">✕</button>
      <div class="mc-top">
        <span class="mc-cat-icon">${CAT_ICONS[ms.category] || '📌'}</span>
        <span class="mc-status-badge ${finalStatus}">${labels[finalStatus]}</span>
      </div>
      <div class="mc-title">${ms.title}</div>
      <div class="mc-cat">${ms.category}</div>
      <div class="mc-bottom">
        <div class="mc-cost">${fmt(ms.cost)}</div>
        <div class="mc-age">Age ${ms.age}</div>
      </div>`;
    card.onclick = () => openModal(i, drawdowns);
    grid.appendChild(card);
  });
}

function checkClose(ms, idx) {
  const { points } = buildProjection();
  const pt = points.find(p => p.age === ms.age);
  if (!pt) return 'on-track';
  if (pt.balance >= ms.cost * 1.1) return 'on-track';
  if (pt.balance >= ms.cost * 0.85) return 'close';
  return 'at-risk';
}

/* ─── MODAL ─────────────────────────────────── */
function openModal(idx, drawdowns) {
  state.modalIdx = idx;
  const ms = state.milestones[idx];
  const dd = drawdowns ? drawdowns.find(d => d.idx === idx) : null;
  const { points } = buildProjection();
  const pt = points.find(p => p.age === ms.age);
  const balance = pt ? pt.balance : 0;
  const status = dd ? (dd.canAfford ? 'on-track' : 'at-risk') : checkClose(ms, idx);
  const statusLabels = { 'on-track': '✅ On Track', 'close': '⚠️ Close', 'at-risk': '🔴 At Risk' };

  document.getElementById('modal-icon').textContent = CAT_ICONS[ms.category] || '📌';
  document.getElementById('modal-title').textContent = ms.title;
  document.getElementById('modal-cat').textContent = ms.category;
  document.getElementById('modal-age').textContent = `Age ${ms.age}`;
  document.getElementById('modal-cost').textContent = fmt(ms.cost);
  document.getElementById('modal-status').textContent = statusLabels[status];
  document.getElementById('modal-balance').textContent = fmt(balance);

  let insight = '';
  if (status === 'on-track') {
    insight = `✅ You are on track! Projected balance of ${fmt(balance)} will comfortably cover ${fmt(ms.cost)}.`;
  } else if (status === 'close') {
    const gap = ms.cost - balance;
    const yrs = Math.max(1, ms.age - state.currentAge);
    const extra = Math.ceil(gap / (yrs * 12));
    insight = `⚠️ Almost there! You may need approximately +${fmt(extra)}/month to secure this goal.`;
  } else {
    const gap = ms.cost - balance;
    const yrs = Math.max(1, ms.age - state.currentAge);
    const extra = Math.ceil(gap / (yrs * 12));
    insight = `🔴 At Risk — shortfall of ${fmt(gap)}. Consider saving +${fmt(extra)}/month or adjusting the target age.`;
  }
  document.getElementById('modal-insight').textContent = insight;
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  state.modalIdx = null;
}

function deleteMilestoneFromModal() {
  if (state.modalIdx !== null) { deleteMilestone(state.modalIdx); closeModal(); }
}

/* ─── INSIGHTS ──────────────────────────────── */
function renderInsights(points, drawdowns) {
  // Next goal
  const now = state.currentAge;
  const upcoming = state.milestones.filter(m => m.age > now).sort((a, b) => a.age - b.age);
  const nextGoal = upcoming[0];
  if (nextGoal) {
    document.getElementById('ig-nextgoal').textContent = nextGoal.title;
    document.getElementById('ig-nextgoal-sub').textContent = `${CAT_ICONS[nextGoal.category]} Age ${nextGoal.age} · ${fmt(nextGoal.cost)}`;
  } else {
    document.getElementById('ig-nextgoal').textContent = state.milestones.length ? 'All past' : '—';
    document.getElementById('ig-nextgoal-sub').textContent = 'No upcoming milestones';
  }

  // Highest cost
  if (state.milestones.length) {
    const highest = [...state.milestones].sort((a, b) => b.cost - a.cost)[0];
    document.getElementById('ig-highest').textContent = highest.title;
    document.getElementById('ig-highest-sub').textContent = `${CAT_ICONS[highest.category]} ${fmt(highest.cost)}`;
  } else {
    document.getElementById('ig-highest').textContent = '—';
    document.getElementById('ig-highest-sub').textContent = 'Add milestones to see';
  }

  // Plan health
  if (!state.milestones.length) {
    document.getElementById('ig-health').textContent = '—';
    document.getElementById('ig-health-sub').textContent = 'Add milestones to evaluate';
  } else {
    const total = state.milestones.length;
    let ok = 0;
    state.milestones.forEach((ms, i) => {
      const dd = drawdowns.find(d => d.idx === i);
      if (!dd || dd.canAfford) ok++;
    });
    const pct = Math.round((ok / total) * 100);
    const label = pct >= 80 ? '💚 Excellent' : pct >= 50 ? '🟡 Fair' : '🔴 Needs Work';
    document.getElementById('ig-health').textContent = label;
    document.getElementById('ig-health-sub').textContent = `${ok}/${total} goals achievable (${pct}%)`;
  }
}

function renderSmartInsights(points, drawdowns) {
  const box = document.getElementById('smart-insights');
  const items = [];

  if (!state.milestones.length) {
    box.innerHTML = '<div class="insight-item neutral">📊 Add milestones and configure your profile to see smart insights.</div>';
    return;
  }

  let allOk = true;
  state.milestones.forEach((ms, i) => {
    const dd = drawdowns.find(d => d.idx === i);
    const pt = points.find(p => p.age === ms.age);
    const bal = pt ? pt.balance : 0;
    const cost = ms.cost;

    if (dd && !dd.canAfford) {
      allOk = false;
      const gap = cost - bal;
      const yrs = Math.max(1, ms.age - state.currentAge);
      const extra = Math.ceil(gap / (yrs * 12));
      items.push({ cls: 'bad', msg: `🔴 Need +${fmt(extra)}/month for "${ms.title}" (age ${ms.age})` });
    } else if (!dd && bal < cost * 1.05) {
      allOk = false;
      const gap = Math.max(0, cost - bal);
      const yrs = Math.max(1, ms.age - state.currentAge);
      const extra = Math.ceil(gap / (yrs * 12));
      if (extra > 0) items.push({ cls: 'warn', msg: `⚠️ Tight on "${ms.title}" — consider saving +${fmt(extra)}/month` });
    } else {
      items.push({ cls: 'good', msg: `✅ "${ms.title}" at age ${ms.age} is achievable` });
    }
  });

  if (allOk) items.unshift({ cls: 'good', msg: '🎉 All milestones are achievable with your current plan!' });

  const finalPt = points[points.length - 1];
  if (finalPt && finalPt.balance > 10000000) {
    items.push({ cls: 'good', msg: `💰 Projected final corpus: ${fmtCr(finalPt.balance)} by age 80` });
  }

  box.innerHTML = items.map(it => `<div class="insight-item ${it.cls}">${it.msg}</div>`).join('');
}

/* ─── MILESTONE CRUD ────────────────────────── */
function addMilestone() {
  const title = document.getElementById('m-title').value.trim();
  const age   = parseInt(document.getElementById('m-age').value);
  const cost  = parseFloat(document.getElementById('m-cost').value);
  const cat   = document.getElementById('m-cat').value;

  if (!title) { showToast('Enter a milestone title'); return; }
  if (!age || age < 20 || age > 80) { showToast('Age must be between 20 and 80'); return; }
  if (!cost || cost <= 0) { showToast('Enter a valid cost'); return; }

  state.milestones.push({ title, age, cost, category: cat });
  saveMilestones();
  document.getElementById('m-title').value = '';
  document.getElementById('m-age').value = '';
  document.getElementById('m-cost').value = '';
  showToast(`✅ "${title}" added!`);
  updateProjection();
}

function deleteMilestone(idx) {
  const name = state.milestones[idx].title;
  state.milestones.splice(idx, 1);
  saveMilestones();
  showToast(`Removed "${name}"`);
  updateProjection();
}

function clearAllMilestones() {
  if (!state.milestones.length) { showToast('No milestones to clear'); return; }
  state.milestones = [];
  saveMilestones();
  showToast('All milestones cleared');
  updateProjection();
}

function saveMilestones() {
  localStorage.setItem('lt_milestones', JSON.stringify(state.milestones));
}

function useTemplate(key) {
  const t = TEMPLATES[key];
  document.getElementById('m-title').value = t.title;
  document.getElementById('m-age').value = t.age;
  document.getElementById('m-cost').value = t.cost;
  document.getElementById('m-cat').value = t.category;
  showToast(`Template loaded: ${t.title}`);
  document.getElementById('add-milestone-panel').scrollIntoView({ behavior: 'smooth' });
}

/* ─── ZOOM ──────────────────────────────────── */
function setZoom(z) {
  state.zoom = z;
  ['full','10','5'].forEach(id => document.getElementById(`zoom-${id}`).classList.remove('active'));
  document.getElementById(`zoom-${z}`).classList.add('active');
  updateProjection();
}

/* ─── NAV ───────────────────────────────────── */
function smoothScroll(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

function toggleMobileSidebar() {
  document.getElementById('sidebar').classList.toggle('mobile-open');
}

/* ─── FORMAT ────────────────────────────────── */
function fmt(n) {
  if (!n && n !== 0) return '₹0';
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr';
  if (n >= 100000)   return '₹' + (n / 100000).toFixed(2) + ' L';
  return '₹' + n.toLocaleString('en-IN');
}
function fmtCr(n) {
  if (!n && n !== 0) return '₹0';
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr';
  if (n >= 100000)   return '₹' + (n / 100000).toFixed(2) + ' L';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

/* ─── TOAST ─────────────────────────────────── */
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ─── RESIZE ────────────────────────────────── */
window.addEventListener('resize', () => {
  const { points, drawdowns } = buildProjection();
  drawChart(points, drawdowns);
});

/* ─── BOOT ──────────────────────────────────── */
window.addEventListener('DOMContentLoaded', init);