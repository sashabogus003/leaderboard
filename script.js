const startTime = 1756072800; // 25.08.2025 UTC
const endTime   = Math.floor(new Date("2025-09-30T20:59:59Z").getTime() / 1000); // 30.09.2025 23:59:59 МСК
const API_BASE = "/api/stats";
const PRIZES = [2000,1500,750,500,400,300,200,125,125,100,0,0,0,0,0];
const REFRESH_MS = 60_000;
const CACHE_KEY = "shuffle_leaderboard_cache_v1";

let lastData = null;

const fmtMoney = (n)=> '$' + Number(n || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

function loadCache(){ try{const raw=localStorage.getItem(CACHE_KEY);if(!raw)return null;const parsed=JSON.parse(raw);if(!parsed||!Array.isArray(parsed.data))return null;return parsed;}catch(e){return null;} }
function saveCache(data){ try{localStorage.setItem(CACHE_KEY, JSON.stringify({ts: Date.now(), data}));}catch(e){} }

function sortTop15(list){ return [...list].sort((a,b)=> (b.wagerAmount||0) - (a.wagerAmount||0)).slice(0,15); }

function renderRows(rows, prevMap){
  const tbody=document.getElementById('tbody');
  tbody.innerHTML='';
  if(!rows||!rows.length){tbody.innerHTML='<tr><td colspan="5">Нет данных</td></tr>';return;}
  rows.forEach((u,i)=>{
    const tr=document.createElement('tr');
    const prev = prevMap && prevMap[u.username] != null ? Number(prevMap[u.username]) : null;
    const cur  = Number(u.wagerAmount||0);
    tr.innerHTML = `
      <td class="place">${i+1}</td>
      <td class="name">${escapeHtml(u.username ?? '—')}</td>
      <td class="amount">${fmtMoney(prev!=null ? prev : cur)}</td>
      <td class="deposit">${fmtMoney(u.deposit || 0)}</td>
      <td class="prize">${PRIZES[i] ? fmtMoney(PRIZES[i]) : '-'}</td>
    `;
    tbody.appendChild(tr);
    if(prev!=null && prev!==cur){
      const cell = tr.querySelector('.amount');
      animateValue(cell, prev, cur, 3000);
    }
  });
}

function escapeHtml(str){return String(str).replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'}[s]));}

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
    if(!res.ok){throw new Error(`${res.status} ${res.statusText}`);}
    return await res.json();
  } finally{ clearTimeout(id); }
}

async function update(){
  const url=`${API_BASE}?startTime=${startTime}&endTime=${endTime}`;
  try{
    const data=await fetchWithTimeout(url);
    if(!Array.isArray(data)) throw new Error("INVALID_RESPONSE");
    const top=sortTop15(data);
    const prevMap = lastData ? Object.fromEntries(lastData.map(x=>[x.username, x.wagerAmount])) : null;
    renderRows(top, prevMap);
    saveCache(top);
    lastData = top;
  }catch(err){
    console.error("Fetch error:",err);
    const cache=loadCache();
    if(cache&&Array.isArray(cache.data)&&cache.data.length){
      renderRows(cache.data, null);
      lastData = cache.data;
    } else {
      const tbody=document.getElementById('tbody');
      tbody.innerHTML='<tr><td colspan="5">Ошибка загрузки</td></tr>';
    }
  }
}

function updateTimer(){
  const now = Math.floor(Date.now()/1000);
  const diff = endTime - now;
  const el = document.getElementById("timer");
  if(diff <= 0){ el.textContent = "Гонка завершена!"; return; }
  const d = Math.floor(diff/86400);
  const h = Math.floor((diff%86400)/3600);
  const m = Math.floor((diff%3600)/60);
  const s = diff%60;
  el.textContent = `До конца: ${d}д ${h}ч ${m}м ${s}с`;
}

setInterval(updateTimer,1000);
updateTimer();

const bootCache=loadCache();
if(bootCache&&bootCache.data){ lastData = bootCache.data; renderRows(bootCache.data, null); }
update();
setInterval(update, REFRESH_MS);
