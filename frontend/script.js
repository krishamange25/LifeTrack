/* ── CONFIG ─── */
const API='http://localhost:5000/api';
let backendOnline=false;

/* ── ICONS ─── */
const CAT_ICONS={House:'🏠',Vehicle:'🚗',Business:'💼',Education:'🎓',Health:'❤️',Travel:'✈️',Family:'👨‍👩‍👧',Security:'🛡️'};

/* ── API BRIDGE ─── */
async function checkBackend(){
  try{await fetch(API+'/health',{signal:AbortSignal.timeout(1500)});backendOnline=true;}catch{backendOnline=false;}
  updateBadge();return backendOnline;
}
async function apiFetch(method,path,body){
  const opts={method,headers:{'Content-Type':'application/json'}};
  if(body)opts.body=JSON.stringify(body);
  const r=await fetch(API+path,{...opts,signal:AbortSignal.timeout(2000)});
  return r.json();
}
async function apiGet(path){return apiFetch('GET',path);}
async function apiPost(path,body){return apiFetch('POST',path,body);}
async function apiPut(path,body){return apiFetch('PUT',path,body);}
async function apiDel(path){return apiFetch('DELETE',path);}

function ls(k){try{return JSON.parse(localStorage.getItem(k));}catch{return null;}}
function lsSet(k,v){localStorage.setItem(k,JSON.stringify(v));}

async function loadUser(){
  if(backendOnline){try{const d=await apiGet('/user');if(d)return d;}catch{}}
  return ls('lt_user')||{};
}
async function saveUser(d){
  lsSet('lt_user',d);
  if(backendOnline){try{await apiPost('/user',d);}catch{}}
}
async function loadGoals(){
  if(backendOnline){try{const d=await apiGet('/goals');if(d?.goals)return d.goals;}catch{}}
  return ls('lt_goals')||[];
}
async function saveGoal(g){
  const goals=await loadGoals();
  if(!g.id)g.id=Date.now()+'';
  const idx=goals.findIndex(x=>x.id===g.id);
  if(idx>=0)goals[idx]=g;else goals.push(g);
  lsSet('lt_goals',goals);
  if(backendOnline){try{idx>=0?await apiPut('/goals/'+g.id,g):await apiPost('/goals',g);}catch{}}
  return g;
}
async function deleteGoal(id){
  let goals=await loadGoals();
  goals=goals.filter(g=>g.id!==id);
  lsSet('lt_goals',goals);
  if(backendOnline){try{await apiDel('/goals/'+id);}catch{}}
}
async function loadSettings(){
  if(backendOnline){try{const d=await apiGet('/settings');if(d)return d;}catch{}}
  return ls('lt_settings')||{age:28,savings:15000,netWorth:200000,ret:10,inflOn:false,inflRate:5};
}
async function saveSettings(s){
  lsSet('lt_settings',s);
  if(backendOnline){try{await apiPost('/settings',s);}catch{}}
}

/* ── AUTH ─── */
async function signup(name, email, password) {
  try {
    const res = await apiPost('/signup', { name, email, password });
    if (res.ok) {
      return { ok: true };
    }
    return { ok: false, err: res.err };
  } catch (e) {
    return { ok: false, err: 'Backend offline' };
  }
}

async function login(email, password) {
  try {
    const res = await apiPost('/login', { email, password });
    if (res.ok) {
      lsSet('lt_auth', res.user);
      return { ok: true };
    }
    return { ok: false, err: res.err };
  } catch (e) {
    // Offline simulation for demo if needed, but let's stick to real flow
    return { ok: false, err: 'Backend offline' };
  }
}

function logout() {
  localStorage.removeItem('lt_auth');
  location.href = 'login.html';
}

function getAuth() {
  return ls('lt_auth');
}

function checkAuth() {
  const auth = getAuth();
  const protectedPages = ['dashboard.html', 'goals.html', 'insights.html', 'onboarding.html'];
  const currentPage = location.pathname.split('/').pop();
  
  if (!auth && protectedPages.includes(currentPage)) {
    location.href = 'login.html';
  }
}

/* ── BADGE ─── */
function updateBadge(){
  document.querySelectorAll('.conn-badge').forEach(b=>{
    b.className='conn-badge '+(backendOnline?'online':'offline');
    b.innerHTML=`<span class="conn-dot"></span>${backendOnline?'Backend Connected':'Offline Mode'}`;
  });
}

/* ── PROJECTION ENGINE ─── */
function buildProjection(settings,goals){
  const {age:startAge=28,savings=15000,netWorth=200000,ret=10,inflOn=false,inflRate=5}=settings;
  const netR=inflOn?(1+ret/100)/(1+inflRate/100)-1:ret/100;
  const mr=netR/12;
  let bal=netWorth;
  const pts=[],dds=[];
  const sorted=[...goals].sort((a,b)=>a.age-b.age);
  for(let age=startAge;age<=80;age++){
    for(let m=0;m<12;m++)bal=bal*(1+mr)+savings;
    sorted.forEach(g=>{
      if(g.age===age){
        const cost=inflOn?g.cost*Math.pow(1+inflRate/100,age-startAge):g.cost;
        dds.push({id:g.id,age,cost,canAfford:bal>=cost});
        if(bal>=cost)bal-=cost;
      }
    });
    pts.push({age,bal:Math.max(0,bal)});
  }
  return{pts,dds};
}
function goalStatus(g,dds,settings,pts){
  const dd=dds.find(d=>d.id===g.id);
  if(dd)return dd.canAfford?'on-track':'at-risk';
  const pt=pts.find(p=>p.age===g.age);
  const cost=settings.inflOn?g.cost*Math.pow(1+settings.inflRate/100,g.age-settings.age):g.cost;
  if(!pt||pt.bal<cost*.75)return'at-risk';
  if(pt.bal<cost*1.1)return'close';
  return'on-track';
}

/* ── FINANCIAL SCORE ─── */
function calcScore(u){
  let s=0;
  const ratio=(u.savings||0)/Math.max(u.income||1,1);
  s+=Math.min(ratio*200,30);
  s+=Math.min((u.emergencyMonths||0)*3,20);
  if(u.tracksFinance)s+=10;
  if(u.hasApp)s+=5;
  if(u.savesFirst)s+=10;
  if(u.extraAction==='Invest')s+=15;
  else if(u.extraAction==='Save')s+=10;
  if(u.hasEmergency)s+=10;
  return Math.min(Math.round(s),100);
}
function calcPersonality(u){
  if((u.extraAction==='Invest')||(u.riskPref==='Growth'))return'Investor';
  const ratio=(u.savings||0)/Math.max(u.income||1,1);
  if(ratio>=0.2||u.savesFirst)return'Saver';
  return'Spender';
}
function emergencyLabel(m){return m>=6?'Strong':m>=3?'Moderate':'Weak';}
function awarenessLabel(u){
  const s=(u.hasApp?1:0)+(u.tracksFinance?1:0)+(u.extraAction==='Invest'?1:0);
  return s>=3?'Advanced':s>=2?'Intermediate':'Beginner';
}

/* ── DRAW CHART ─── */
function drawChart(canvasId,pts,dds,zoom,startAge){
  const canvas=document.getElementById(canvasId);if(!canvas)return;
  const W=canvas.parentElement.clientWidth||800,H=canvas.parentElement.clientHeight||280;
  canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d');
  let vp=pts;
  if(zoom==='10')vp=pts.filter(p=>p.age<=startAge+10);
  if(zoom==='5')vp=pts.filter(p=>p.age<=startAge+5);
  if(!vp.length)return;
  const pad={t:24,r:20,b:36,l:68};
  const maxB=Math.max(...vp.map(p=>p.bal),1);
  const minA=vp[0].age,maxA=vp[vp.length-1].age;
  const xS=a=>pad.l+((a-minA)/(maxA-minA||1))*(W-pad.l-pad.r);
  const yS=v=>H-pad.b-(v/maxB)*(H-pad.t-pad.b);
  ctx.clearRect(0,0,W,H);
  for(let i=0;i<=4;i++){
    const y=pad.t+((H-pad.t-pad.b)/4)*i;
    ctx.strokeStyle='#F3F4F6';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
    ctx.fillStyle='#9CA3AF';ctx.font='600 10px Inter';ctx.textAlign='right';
    ctx.fillText(fmt(maxB*(1-i/4)),pad.l-5,y+4);
  }
  vp.filter((_,i)=>i%5===0).forEach(p=>{
    ctx.fillStyle='#9CA3AF';ctx.font='600 10px Inter';ctx.textAlign='center';
    ctx.fillText(p.age,xS(p.age),H-pad.b+14);
  });
  const g=ctx.createLinearGradient(0,pad.t,0,H-pad.b);
  g.addColorStop(0,'rgba(79,70,229,.15)');g.addColorStop(1,'rgba(79,70,229,0)');
  ctx.beginPath();ctx.moveTo(xS(vp[0].age),H-pad.b);
  vp.forEach(p=>ctx.lineTo(xS(p.age),yS(p.bal)));
  ctx.lineTo(xS(vp[vp.length-1].age),H-pad.b);ctx.closePath();
  ctx.fillStyle=g;ctx.fill();
  ctx.beginPath();ctx.strokeStyle='#4F46E5';ctx.lineWidth=2.5;ctx.lineJoin='round';
  vp.forEach((p,i)=>i?ctx.lineTo(xS(p.age),yS(p.bal)):ctx.moveTo(xS(p.age),yS(p.bal)));
  ctx.stroke();
  dds.filter(d=>d.age>=minA&&d.age<=maxA).forEach(d=>{
    const pt=vp.find(p=>p.age===d.age);if(!pt)return;
    ctx.beginPath();ctx.arc(xS(d.age),yS(pt.bal),6,0,Math.PI*2);
    ctx.fillStyle=d.canAfford?'#059669':'#E11D48';ctx.strokeStyle='#fff';ctx.lineWidth=2;
    ctx.fill();ctx.stroke();
  });
}

/* ── TIMELINE ─── */
function renderTimeline(containerId,goals,dds,pts,settings){
  const c=document.getElementById(containerId);if(!c)return;
  c.innerHTML='';
  goals.forEach(g=>{
    const age=Math.min(Math.max(g.age,20),80);
    const pct=((age-20)/60)*100;
    const st=goalStatus(g,dds,settings,pts);
    const d=document.createElement('div');
    d.className=`tl-dot ${st}`;d.style.left=pct+'%';
    d.innerHTML=`<div class="tl-age-tag">${age}</div><div class="tl-circle"></div><div class="tl-name">${CAT_ICONS[g.category]||'📌'} ${g.title}</div>`;
    c.appendChild(d);
  });
}

/* ── FORMAT ─── */
function fmt(n){
  if(!n&&n!==0)return'₹0';
  if(n>=10000000)return'₹'+(n/10000000).toFixed(2)+' Cr';
  if(n>=100000)return'₹'+(n/100000).toFixed(2)+' L';
  return'₹'+Math.round(n).toLocaleString('en-IN');
}

/* ── TOAST ─── */
let toastT;
function showToast(msg,type='success'){
  let t=document.getElementById('toast');
  if(!t){t=document.createElement('div');t.id='toast';document.body.appendChild(t);}
  t.textContent=msg;t.className=`toast show ${type}`;
  clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2800);
}

/* ── SLIDER FILL ─── */
function fillSlider(el,val,min,max){
  const pct=((val-min)/(max-min))*100;
  el.style.setProperty('--v',pct+'%');
}

/* ── NAVBAR INIT ─── */
function initNavbar(){
  checkAuth();
  checkBackend();
  setInterval(()=>{if(backendOnline)checkBackend();},30000);
  
  const auth = getAuth();
  const navRight = document.querySelector('.nav-right');
  if (auth && navRight) {
    const profileHtml = `
      <div class="user-profile" style="display:flex; align-items:center; gap:10px; margin-left:10px;">
        <div style="text-align:right;">
          <div style="font-size:0.8rem; font-weight:700; color:var(--text);">${auth.name}</div>
          <button onclick="logout()" style="font-size:0.7rem; color:var(--rose); background:none; border:none; padding:0; cursor:pointer; font-weight:600;">Logout</button>
        </div>
        <div style="width:32px; height:32px; border-radius:50%; background:var(--indigo-l); color:var(--indigo); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.8rem; border:1px solid var(--indigo-m);">
          ${auth.name[0]}
        </div>
      </div>
    `;
    const cta = navRight.querySelector('.nav-cta');
    if (cta && location.pathname.includes('index.html')) {
      cta.textContent = 'Go to Dashboard';
      cta.href = 'dashboard.html';
    }
    navRight.insertAdjacentHTML('beforeend', profileHtml);
  }

  document.querySelector('.nav-burger')?.addEventListener('click',()=>{
    document.querySelector('.nav-links')?.classList.toggle('open');
  });
  
  // Initialize animations
  initAnimations();
}

function initAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        if (entry.target.classList.contains('stat-card')) {
          const valEl = entry.target.querySelector('.stat-val');
          if (valEl && !valEl.dataset.animated) animateCounter(valEl);
        }
      }
    });
  }, { threshold: 0.1 });

  const elements = document.querySelectorAll('.page, .page-narrow, .ob-wrap, .card, .stat-card, .welcome-card, .goal-card, .insight-item, .hero h1, .hero p, .step-card, .ob-card, .sidebar, .reveal-right, .slide-item');
  elements.forEach((el, i) => {
    if (!el.classList.contains('reveal') && !el.classList.contains('reveal-right') && !el.classList.contains('slide-item')) {
      el.classList.add('reveal');
      el.classList.add(`stagger-${(i % 5) + 1}`);
    }
    observer.observe(el);
    
    // Premium Tilt effect for cards
    const isInteractive = el.classList.contains('card') || el.classList.contains('stat-card') || el.classList.contains('goal-card') || el.classList.contains('ob-card');
    if (isInteractive) {
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const xc = rect.width / 2;
        const yc = rect.height / 2;
        const dx = x - xc;
        const dy = y - yc;
        el.style.transform = `translateY(-10px) rotateY(${dx / 25}deg) rotateX(${-dy / 25}deg) scale(1.02)`;
        el.style.transition = 'transform 0.1s ease-out';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
        el.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      });
    }
  });
}

function animateCounter(el) {
  const text = el.textContent;
  const match = text.match(/[\d,.]+/);
  if (!match) return;
  
  const target = parseFloat(match[0].replace(/,/g, ''));
  const prefix = text.substring(0, match.index);
  const suffix = text.substring(match.index + match[0].length);
  
  let current = 0;
  const duration = 1500;
  const start = performance.now();
  
  el.dataset.animated = "true";
  
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    const val = current + (target - current) * eased;
    
    el.textContent = prefix + (val >= 100000 ? (val / 100000).toFixed(1) + 'L' : Math.floor(val).toLocaleString('en-IN')) + suffix;
    
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = text; // ensure final text is exact
  }
  requestAnimationFrame(step);
}

/* ── SIP CALCULATOR ── */
function runSipCalc() {
  const p = parseFloat(document.getElementById('sip-amount')?.value) || 0;
  const r = parseFloat(document.getElementById('sip-return')?.value) || 0;
  const n = parseFloat(document.getElementById('sip-years')?.value) || 0;
  
  if (p <= 0 || n <= 0) return;

  const monthlyRate = r / 12 / 100;
  const months = n * 12;
  
  // SIP Formula: M = P × ({[1 + i]^n – 1} / i) × (1 + i)
  const maturity = p * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
  const invested = p * months;
  const gain = maturity - invested;

  const resEl = document.getElementById('sip-result');
  const gainEl = document.getElementById('sip-gain');
  
  if (resEl) resEl.textContent = fmt(Math.round(maturity));
  if (gainEl) gainEl.textContent = fmt(Math.round(gain));
}

const MARKET_FALLBACK = [
  { name: 'NIFTYBEES', price: 271.09, change: -0.98, logo: 'NB', color: '#B91C1C', bg: '#FEE2E2' },
  { name: 'TATAGOLD',  price: 14.54,  change: -0.07, logo: 'TG', color: '#0369A1', bg: '#E0F2FE' },
  { name: 'MON100',    price: 293.13, change: 1.12, logo: 'MN', color: '#047857', bg: '#ECFDF5' },
  { name: 'MAFANG',    price: 179.70, change: 3.38, logo: 'MA', color: '#6D28D9', bg: '#F5F3FF' },
  { name: 'TATASTEEL', price: 210.07, change: -0.40, logo: 'TS', color: '#C2410C', bg: '#FFF7ED' },
  { name: 'GROWW',     price: 218.02, change: 0.13, logo: 'GW', color: '#15803D', bg: '#F0FDF4' }
];

/* ── MARKET FEED ── */
async function initMarketFeed() {
  const listEl = document.getElementById('market-list');
  if (!listEl) return;

  const fetchMarket = async () => {
    try {
      const res = await fetch(`${API}/market`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      renderMarket(data);
    } catch {
      // Fallback to static real data if backend is offline or CORS blocked
      renderMarket(MARKET_FALLBACK, true);
    }
  };

  const renderMarket = (data, isFallback = false) => {
    let html = data.map(item => `
      <div class="market-item">
        <div class="market-left">
          <div class="market-logo" style="background:${item.bg}; color:${item.color}">${item.logo}</div>
          <div class="market-name">${item.name}</div>
        </div>
        <div class="market-right">
          <div class="market-price">₹${item.price}</div>
          <div class="market-trend ${item.change >= 0 ? 'trend-up' : 'trend-down'}">
            ${item.change >= 0 ? '+' : ''}${item.change}%
          </div>
        </div>
      </div>
    `).join('');
    
    if (isFallback) {
      html = '<div class="insight-item neutral" style="font-size:0.7rem; padding:4px 8px; margin-bottom:8px">💡 Showing daily market snapshot (Live Feed Offline)</div>' + html;
    }
    listEl.innerHTML = html;
  };

  fetchMarket();
  setInterval(fetchMarket, 5000); // Polling every 5s for "live" feel
}

/* ── NEWS FEED ── */
async function initNewsFeed() {
  const listEl = document.getElementById('news-feed');
  if (!listEl) return;

  try {
    const res = await fetch(`${API}/news`);
    const data = await res.json();
    listEl.innerHTML = data.map(item => `
      <a href="${item.link}" target="_blank" style="text-decoration:none; display:block">
        <div class="insight-item neutral" style="cursor:pointer; margin-bottom:12px; transition:all 0.2s; border:1px solid transparent;" onmouseover="this.style.borderColor='var(--indigo-m)'; this.style.background='var(--indigo-l)'" onmouseout="this.style.borderColor='transparent'; this.style.background='var(--bg)'">
          <div style="font-weight:700; color:var(--text); font-size:0.95rem; margin-bottom:4px">${item.title}</div>
          <div style="font-size:0.8rem; color:var(--muted)">${item.summary}</div>
        </div>
      </a>
    `).join('');
  } catch {
    listEl.innerHTML = '<div class="insight-item warn">⚠️ Failed to load latest news (Backend Offline)</div>';
  }
}

/* ── BOOT ─── */
window.addEventListener('DOMContentLoaded',()=>{
  initNavbar();
  const page=document.body.dataset.page;
  if(page==='landing')initLanding();
  else if(page==='login')initLogin();
  else if(page==='onboarding')initOnboarding();
  else if(page==='dashboard')initDashboard();
  else if(page==='goals')initGoals();
  else if(page==='insights')initInsights();
});

/* ── PAGE: LANDING ─── */
function initLanding(){}

/* ── PAGE: LOGIN ─── */
function initLogin() {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const showSignup = document.getElementById('show-signup');
  const showLogin = document.getElementById('show-login');

  showSignup?.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
  });

  showLogin?.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.style.display = 'none';
    loginForm.style.display = 'block';
  });

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('l-email').value;
    const password = document.getElementById('l-pass').value;
    const res = await login(email, password);
    if (res.ok) {
      showToast('Login successful!');
      setTimeout(() => location.href = 'dashboard.html', 500);
    } else {
      showToast(res.err || 'Login failed', 'err');
    }
  });

  signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('s-name').value;
    const email = document.getElementById('s-email').value;
    const password = document.getElementById('s-pass').value;
    const res = await signup(name, email, password);
    if (res.ok) {
      showToast('Signup successful! Please log in.');
      signupForm.style.display = 'none';
      loginForm.style.display = 'block';
      // Clear signup fields
      document.getElementById('s-name').value = '';
      document.getElementById('s-email').value = '';
      document.getElementById('s-pass').value = '';
      // Pre-fill login email
      document.getElementById('l-email').value = email;
    } else {
      showToast(res.err || 'Signup failed', 'err');
    }
  });
}

/* ── PAGE: LANDING ─── */
function initLanding(){}

/* ── PAGE: ONBOARDING ─── */
function initOnboarding(){
  let step=1;const total=5;
  const data={};
  const show=()=>{
    document.querySelectorAll('.ob-step').forEach(s=>s.classList.remove('active'));
    document.getElementById('step'+step)?.classList.add('active');
    document.getElementById('ob-bar').style.width=(step/total*100)+'%';
    document.getElementById('ob-step-lbl').textContent=`Step ${step} of ${total}`;
    document.getElementById('ob-back').style.visibility=step>1?'visible':'hidden';
    document.getElementById('ob-next').textContent=step===total?'Finish 🎉':'Next →';
  };
  document.getElementById('ob-next').addEventListener('click',()=>{
    collectStep(step,data);
    if(step===total){saveUser(data).then(()=>{showToast('Profile saved!');setTimeout(()=>location.href='dashboard.html',800);});return;}
    step++;show();
  });
  document.getElementById('ob-back').addEventListener('click',()=>{if(step>1){step--;show();}});
  show();
}
function collectStep(step,data){
  const get=id=>{const el=document.getElementById(id);return el?el.value:''};
  const getR=name=>{const el=document.querySelector(`input[name="${name}"]:checked`);return el?el.value:''};
  if(step===1){data.name=get('ob-name');data.age=+get('ob-age');data.city=get('ob-city');data.occupation=get('ob-occ');}
  if(step===2){data.income=+get('ob-income');data.expenses=+get('ob-expenses');data.netWorth=+get('ob-networth');data.savings=+get('ob-savings');}
  if(step===3){data.tracksFinance=getR('track')==='Yes';data.hasApp=getR('app')==='Yes';data.checkFreq=getR('freq');}
  if(step===4){data.savesFirst=getR('saveFirst')==='Yes';data.extraAction=getR('extra');data.hasEmergency=getR('emerg')==='Yes';data.emergencyMonths=+get('ob-months');}
  if(step===5){data.mainGoal=get('ob-goal');data.riskPref=getR('risk');data.priority=getR('priority');}
}

/* ── PAGE: DASHBOARD ─── */
async function initDashboard(){
  const[user,goals,settings]=await Promise.all([loadUser(),loadGoals(),loadSettings()]);
  // welcome
  const name=user.name||'Friend';
  const personality=calcPersonality(user);
  const score=calcScore(user);
  document.getElementById('wd-name').textContent=`Welcome, ${name} 👋`;
  document.getElementById('wd-personality').textContent=`Financial personality: ${personality}`;
  document.getElementById('wd-pill').textContent=personality;
  // stats
  const{pts,dds}=buildProjection(settings,goals);
  const finalBal=pts[pts.length-1]?.bal||0;
  const totalGoals=goals.length;
  const onTrack=goals.filter(g=>goalStatus(g,dds,settings,pts)==='on-track').length;
  document.getElementById('s-wealth').textContent=fmt(finalBal);
  document.getElementById('s-savings').textContent=fmt(settings.savings);
  document.getElementById('s-ontrack').textContent=totalGoals?`${onTrack}/${totalGoals}`:'—';
  document.getElementById('s-score').textContent=score+'/100';
  // what-if sliders
  const sIds=[['sl-age','lbl-age',settings.age,18,60,v=>{settings.age=+v;refresh();}],
    ['sl-sav','lbl-sav',settings.savings,1000,200000,v=>{settings.savings=+v;refresh();}],
    ['sl-nw','lbl-nw',settings.netWorth,0,10000000,v=>{settings.netWorth=+v;refresh();}],
    ['sl-ret','lbl-ret',settings.ret,1,30,v=>{settings.ret=+v;refresh();}]];
  sIds.forEach(([sid,lid,val,min,max,cb])=>{
    const sl=document.getElementById(sid),lb=document.getElementById(lid);
    if(!sl)return;sl.value=val;lb.textContent=sid.includes('age')?val:sid.includes('ret')?val+'%':fmt(val);
    fillSlider(sl,val,min,max);
    sl.addEventListener('input',()=>{fillSlider(sl,+sl.value,min,max);lb.textContent=sid.includes('age')?sl.value:sid.includes('ret')?sl.value+'%':fmt(+sl.value);cb(sl.value);});
  });
  const inflTog=document.getElementById('infl-tog');
  if(inflTog){inflTog.checked=settings.inflOn;inflTog.addEventListener('change',()=>{settings.inflOn=inflTog.checked;document.getElementById('infl-grp').style.display=inflTog.checked?'block':'none';refresh();});}
  document.getElementById('infl-grp').style.display=settings.inflOn?'block':'none';
  const inflSl=document.getElementById('sl-infl');
  if(inflSl){inflSl.value=settings.inflRate;fillSlider(inflSl,settings.inflRate,1,15);inflSl.addEventListener('input',()=>{settings.inflRate=+inflSl.value;document.getElementById('lbl-infl').textContent=inflSl.value+'%';fillSlider(inflSl,+inflSl.value,1,15);refresh();});}
  let zoom='full';
  document.querySelectorAll('.zoom-btn').forEach(btn=>btn.addEventListener('click',()=>{zoom=btn.dataset.zoom;document.querySelectorAll('.zoom-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');refresh();}));
  function refresh(){
    const{pts,dds}=buildProjection(settings,goals);
    drawChart('projChart',pts,dds,zoom,settings.age);
    renderInsights(goals,pts,dds,settings);
    saveSettings(settings);
  }
  refresh();
  runSipCalc();
  initMarketFeed();
}
function renderInsights(goals,pts,dds,settings){
  const box=document.getElementById('insight-box');if(!box)return;
  const items=[];
  if(!goals.length){box.innerHTML='<div class="insight-item neutral">📊 Add goals on the Goals page to see smart insights.</div>';return;}
  let allOk=true;
  goals.forEach(g=>{
    const st=goalStatus(g,dds,settings,pts);
    const pt=pts.find(p=>p.age===g.age);
    const bal=pt?.bal||0;
    const cost=settings.inflOn?g.cost*Math.pow(1+settings.inflRate/100,g.age-settings.age):g.cost;
    if(st==='at-risk'){allOk=false;const gap=Math.max(0,cost-bal);const yrs=Math.max(1,g.age-settings.age);items.push({cls:'bad',msg:`🔴 Need +${fmt(Math.ceil(gap/yrs/12))}/month for "${g.title}"`});}
    else if(st==='close'){allOk=false;items.push({cls:'warn',msg:`⚠️ "${g.title}" is close — consider saving a bit more`});}
    else items.push({cls:'good',msg:`✅ "${g.title}" at age ${g.age} is on track`});
  });
  if(allOk)items.unshift({cls:'good',msg:'🎉 All milestones are achievable with your current plan!'});
  box.innerHTML=items.map(i=>`<div class="insight-item ${i.cls}">${i.msg}</div>`).join('');
}

/* ── PAGE: GOALS ─── */
async function initGoals(){
  const[settings,user]=await Promise.all([loadSettings(),loadUser()]);
  let goals=await loadGoals();
  const render=async()=>{
    goals=await loadGoals();
    const{pts,dds}=buildProjection(settings,goals);
    renderTimeline('tl-dots',goals,dds,pts,settings);
    const grid=document.getElementById('goals-grid');
    if(!goals.length){grid.innerHTML='<div class="empty-state"><div class="ei">🎯</div><p>No goals yet. Add one above or use a template.</p></div>';return;}
    grid.innerHTML='';
    goals.forEach(g=>{
      const st=goalStatus(g,dds,settings,pts);
      const pt=pts.find(p=>p.age===g.age);
      const lbl={' on-track':'On Track','close':'Close','at-risk':'At Risk'};
      const card=document.createElement('div');card.className=`goal-card ${st}`;
      card.innerHTML=`<button class="gc-del" onclick="removeGoal('${g.id}')">✕</button>
        <div class="gc-top"><span class="gc-icon">${CAT_ICONS[g.category]||'📌'}</span><span class="status-badge ${st}">${{' on-track':'On Track','close':'Close','at-risk':'At Risk'}[' '+st]||st}</span></div>
        <div class="gc-title">${g.title}</div><div class="gc-cat">${g.category}</div>
        <div class="gc-row"><div class="gc-cost">${fmt(g.cost)}</div><div class="gc-age">Age ${g.age}</div></div>
        <div class="gc-edit-sliders">
          <div class="slider-grp"><label>Target Age <span class="sv" id="sv-age-${g.id}">${g.age}</span></label><input type="range" id="sl-age-${g.id}" min="20" max="80" value="${g.age}" /></div>
          <div class="slider-grp"><label>Cost <span class="sv" id="sv-cost-${g.id}">${fmt(g.cost)}</span></label><input type="range" id="sl-cost-${g.id}" min="10000" max="20000000" step="10000" value="${g.cost}" /></div>
        </div>`;
      grid.appendChild(card);
      const ageSl=document.getElementById(`sl-age-${g.id}`);const costSl=document.getElementById(`sl-cost-${g.id}`);
      fillSlider(ageSl,g.age,20,80);fillSlider(costSl,g.cost,10000,20000000);
      ageSl.addEventListener('input',async()=>{g.age=+ageSl.value;document.getElementById(`sv-age-${g.id}`).textContent=g.age;fillSlider(ageSl,g.age,20,80);await saveGoal(g);await render();});
      costSl.addEventListener('input',async()=>{g.cost=+costSl.value;document.getElementById(`sv-cost-${g.id}`).textContent=fmt(g.cost);fillSlider(costSl,g.cost,10000,20000000);await saveGoal(g);await render();});
    });
  };
  window.removeGoal=async(id)=>{await deleteGoal(id);showToast('Goal removed');render();};
  document.getElementById('add-goal-btn')?.addEventListener('click',async()=>{
    const t=document.getElementById('g-title').value.trim();
    const a=+document.getElementById('g-age').value;
    const c=+document.getElementById('g-cost').value;
    const cat=document.getElementById('g-cat').value;
    if(!t){showToast('Enter a title','warn');return;}
    if(!a||a<20||a>80){showToast('Age must be 20–80','warn');return;}
    if(!c||c<=0){showToast('Enter a valid cost','warn');return;}
    await saveGoal({id:Date.now()+'',title:t,age:a,cost:c,category:cat});
    showToast('✅ Goal added!');
    document.getElementById('g-title').value='';document.getElementById('g-age').value='';document.getElementById('g-cost').value='';
    await render();
  });
  document.querySelectorAll('.tpl-btn').forEach(btn=>btn.addEventListener('click',()=>{
    const t=btn.dataset;
    document.getElementById('g-title').value=t.title;document.getElementById('g-age').value=t.age;
    document.getElementById('g-cost').value=t.cost;document.getElementById('g-cat').value=t.cat;
    showToast('Template loaded: '+t.title);
  }));
  await render();
}

/* ── PAGE: INSIGHTS ─── */
async function initInsights(){
  const[user,goals,settings]=await Promise.all([loadUser(),loadGoals(),loadSettings()]);
  const score=calcScore(user);const personality=calcPersonality(user);
  const em=emergencyLabel(user.emergencyMonths||0);const awareness=awarenessLabel(user);
  const scoreColor=score>=70?'green':score>=45?'amber':'rose';
  document.getElementById('ins-personality').textContent=personality;
  document.getElementById('ins-personality').className=`personality-badge ${personality.toLowerCase()}`;
  document.getElementById('ins-score-val').textContent=score+'/100';
  document.getElementById('ins-score-bar').style.width=score+'%';
  document.getElementById('ins-score-bar').className=`score-bar ${scoreColor}`;
  document.getElementById('ins-emergency').textContent=em;
  document.getElementById('ins-awareness').textContent=awareness;
  const{pts,dds}=buildProjection(settings,goals);
  const suggestions=[];
  if((user.savings||0)<(user.income||1)*0.2)suggestions.push({cls:'warn',msg:'💡 Try to save at least 20% of your income monthly.'});
  if((user.emergencyMonths||0)<3)suggestions.push({cls:'bad',msg:'🛡️ Build an emergency fund covering 3–6 months of expenses first.'});
  if(user.extraAction==='Spend')suggestions.push({cls:'warn',msg:'📈 Consider investing extra money instead of spending it.'});
  goals.forEach(g=>{
    const st=goalStatus(g,dds,settings,pts);
    if(st==='at-risk')suggestions.push({cls:'bad',msg:`🔴 "${g.title}" is at risk. Increase savings or push the target age.`});
  });
  if(!suggestions.length)suggestions.push({cls:'good',msg:'🎉 Your financial plan looks strong. Keep it up!'});
  // Conflict detection
  const atRisk=goals.filter(g=>goalStatus(g,dds,settings,pts)==='at-risk');
  const conflictEl=document.getElementById('ins-conflicts');
  if(atRisk.length>=2){
    conflictEl.innerHTML=`<div class="insight-item bad">⚠️ You cannot comfortably afford <strong>${atRisk.map(g=>g.title).join(' + ')}</strong> simultaneously with current savings.</div>`;
  } else conflictEl.innerHTML='<div class="insight-item good">✅ No major goal conflicts detected.</div>';
  // Lifestyle projection
  const lpEl=document.getElementById('ins-lifestyle');
  const lifeItems=goals.map(g=>{const st=goalStatus(g,dds,settings,pts);return`<span class="status-badge ${st}" style="margin:4px">${CAT_ICONS[g.category]||'📌'} ${g.title} @ ${g.age}</span>`;});
  lpEl.innerHTML=lifeItems.length?lifeItems.join(''):'<span class="insight-item neutral">Add goals to see lifestyle projection.</span>';
  document.getElementById('ins-suggestions').innerHTML=suggestions.map(s=>`<div class="insight-item ${s.cls}">${s.msg}</div>`).join('');
  initNewsFeed();
}
