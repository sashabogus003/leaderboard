const startTime = 1756072800; 
const endTime   = 1759265999; 
const API_BASE = "/api/stats";
const PRIZES = [2000,1500,750,500,400,300,200,125,125,100,0,0,0,0,0,0,0,0,0,0];
let REFRESH_MS = 60_000;
const CACHE_KEY = 'shuffle_leaderboard_cache_v3';

let lastData = null;

const fmtMoney = (n)=> '$' + Number(n || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

function loadCache(){ try{const raw=localStorage.getItem(CACHE_KEY);if(!raw)return null;const parsed=JSON.parse(raw);if(!parsed||!Array.isArray(parsed.data))return null;return parsed;}catch(e){return null;} }
function saveCache(data){ try{localStorage.setItem(CACHE_KEY, JSON.stringify({ts: Date.now(), data}));}catch(e){} }

function sortTop20(list){ return [...list].sort((a,b)=> (b.wagerAmount||0) - (a.wagerAmount||0)).slice(0,20); }

function renderTop3(players){
  const container = document.getElementById('top3');
  container.innerHTML = '';
  players.forEach((p,i)=>{
    const extraClass = (i === 2) ? 'top3-place' : `top${i+1}`;
    const card = document.createElement('div');
    card.className = `top3-card ${extraClass}`;
    card.innerHTML = `
      <div class="place">#${i+1}</div>
      <div class="name">${escapeHtml(p.username ?? '—')}</div>
      <div class="amount">${fmtMoney(p.wagerAmount)}</div>
      <div class="prize">${PRIZES[i] ? fmtMoney(PRIZES[i]) : '-'}</div>
    `;
    container.appendChild(card);
  });
}

function renderRows(rows, prevMap){
  const tbody=document.getElementById('tbody');
  tbody.innerHTML='';
  if(!rows||!rows.length){tbody.innerHTML='<tr><td colspan="4">Нет данных</td></tr>';return;}
  rows.forEach((u,i)=>{
    const tr=document.createElement('tr');
    const prev = prevMap && prevMap[u.username] != null ? Number(prevMap[u.username]) : null;
    const cur  = Number(u.wagerAmount||0);
    tr.innerHTML = `
      <td class="place">${i+4}</td>
      <td class="name">${escapeHtml(u.username ?? '—')}</td>
      <td class="amount">${fmtMoney(prev!=null ? prev : cur)}</td>
      <td class="prize">${PRIZES[i+3] ? fmtMoney(PRIZES[i+3]) : '-'}</td>
    `;
    tbody.appendChild(tr);
    if(prev!=null && prev!==cur){
      const cell = tr.querySelector('.amount');
      animateValue(cell, prev, cur, 3000);
    }
  });
}

function escapeHtml(str){return String(str).replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));}

function animateValue(el, from, to, durationMs){
  const start = performance.now();
  const delta = to - from;
  function easeInOutQuad(t){ return t<.5 ? 2*t*t : -1+(4-2*t)*t; }
  function frame(now){
    const t = Math.min(1, (now - start)/durationMs);
    const v = from + delta * easeInOutQuad(t);
    el.textContent = fmtMoney(v);
    if(t < 1) requestAnimationFrame(frame); else el.textContent = fmtMoney(to);
  }
  requestAnimationFrame(frame);
}

async function fetchWithTimeout(url, opts={}, timeoutMs=8000){
  const ctrl=new AbortController();
  const id=setTimeout(()=>ctrl.abort(), timeoutMs);
  try{
    const res=await fetch(url,{...(opts||{}),signal:ctrl.signal});
    if(!res.ok){let msg=`${res.status} ${res.statusText}`; try{const j=await res.json(); if(j&&j.message)msg=j.message;}catch{} throw new Error(msg);} 
    return await res.json();
  } finally{ clearTimeout(id); }
}

async function update(){
  const url=`${API_BASE}?startTime=${startTime}&endTime=${endTime}`;
  try{
    const data=await fetchWithTimeout(url);
    if(!Array.isArray(data)) throw new Error('INVALID_RESPONSE');
    const top=sortTop20(data);
    const prevMap = lastData ? Object.fromEntries(lastData.map(x=>[x.username, x.wagerAmount])) : null;

    renderTop3(top.slice(0,3));
    renderRows(top.slice(3), prevMap);

    if (!lastData || JSON.stringify(lastData) !== JSON.stringify(top)) {
      document.getElementById("lastUpdate").textContent =
        "Последнее обновление: " + new Date().toLocaleTimeString();
    }

    saveCache(top);
    lastData = top;
    REFRESH_MS = 60_000;
  }catch(err){
    console.error('Fetch error:',err);
    const cache=loadCache();
    if(cache&&Array.isArray(cache.data)&&cache.data.length){
      renderTop3(cache.data.slice(0,3));
      renderRows(cache.data.slice(3), null);
      lastData = cache.data;
    } else {
      const tbody=document.getElementById('tbody');
      tbody.innerHTML='<tr><td colspan="4">Загрузка данных...</td></tr>';
    }
    REFRESH_MS = 10_000;
  }

  setTimeout(update, REFRESH_MS);
}

function updateCountdown(){
  const now=Math.floor(Date.now()/1000);
  const diff=endTime-now;
  const el=document.getElementById('countdown');
  if(diff>0){
    const d=Math.floor(diff/86400);
    const h=Math.floor((diff%86400)/3600);
    const m=Math.floor((diff%3600)/60);
    const s=diff%60;
    el.textContent=`До конца гонки: ${d}д ${h}ч ${m}м ${s}с`;
  } else {
    el.textContent="Гонка завершена!";
  }
}

updateCountdown();
setInterval(updateCountdown,1000);

const bootCache=loadCache();
if(bootCache&&bootCache.data){ 
  lastData = bootCache.data; 
  renderTop3(bootCache.data.slice(0,3));
  renderRows(bootCache.data.slice(3), null); 
  document.getElementById("lastUpdate").textContent =
    "Последнее обновление: " + new Date().toLocaleTimeString();
}
update();
