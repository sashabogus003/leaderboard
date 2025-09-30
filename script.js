const API_BASE = "/api/stats";
const REFRESH_MS = 60_000;

// ЛОКАЛЬНЫЕ переменные (не трогаем const из index.html)
let API_START = typeof startTime === 'number' ? startTime : 0;          // сек
let API_END   = typeof endTime   === 'number' ? endTime   : 0;          // сек
let COUNTDOWN_END_MS = typeof raceEnd === 'number' ? raceEnd : (API_END * 1000);

let lastTop = null;
let isFirstRender = true;
let nextUpdateTimer = null;
let countdown = REFRESH_MS / 1000;

// ===== таймер гонки =====
function startCountdown(endTimeMs){
  function tick(){
    const now = Date.now();
    const diff = endTimeMs - now;
    const el = document.getElementById('countdown');
    if(!el) return;
    if(diff <= 0){ el.textContent = "Гонка завершена!"; return; }
    const d = Math.floor(diff/86400000);
    const h = Math.floor((diff%86400000)/3600000);
    const m = Math.floor((diff%3600000)/60000);
    const s = Math.floor((diff%60000)/1000);
    el.textContent = `До конца гонки: ${d}д ${h}ч ${m}м ${s}с`;
  }
  tick();
  if (window.__raceCountdown) clearInterval(window.__raceCountdown);
  window.__raceCountdown = setInterval(tick, 1000);
}

// ===== утилиты =====
async function fetchWithTimeout(url, opts={}, timeout=10000){
  const ctrl = new AbortController();
  const id = setTimeout(()=>ctrl.abort(), timeout);
  try{
    const res = await fetch(url, {...opts, signal: ctrl.signal});
    if(!res.ok) throw new Error(res.status+" "+res.statusText);
    return await res.json();
  } finally { clearTimeout(id); }
}
function sortTop20(list){ return [...list].sort((a,b)=> (b.wagerAmount||0) - (a.wagerAmount||0)).slice(0,20); }
function fmtMoney(n){ return '$' + Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}); }

function saveCache(payload){ try{localStorage.setItem('leaderboardCache', JSON.stringify(payload));}catch{} }
function loadCache(){ try{const raw = localStorage.getItem('leaderboardCache'); return raw? JSON.parse(raw): null;}catch{return null;} }

function saveLastTop(top){ try{ localStorage.setItem('lastTop', JSON.stringify(top)); }catch{} }
function loadLastTop(){ try{ const raw = localStorage.getItem('lastTop'); return raw ? JSON.parse(raw) : null; }catch{return null;} }

// ===== статус / обратный отсчёт обновления =====
function setStatus(type, text){
  const box = document.getElementById('updateStatus');
  if(!box) return;
  box.className = `update-status ${type}`;
  const next = box.querySelector('.next-update') || (()=>{ const s=document.createElement('div'); s.className='next-update'; box.appendChild(s); return s; })();
  box.firstChild && (box.firstChild.nodeType === 3) ? (box.firstChild.nodeValue = text) : (box.innerHTML = `${text}<div class="next-update"></div>`);
}
function startUpdateCountdown(){
  const box = document.getElementById('updateStatus');
  if(!box) return;
  const span = box.querySelector('.next-update');
  clearInterval(nextUpdateTimer);
  countdown = REFRESH_MS/1000;
  if(span) span.textContent = `Следующее обновление через ${countdown}с`;
  nextUpdateTimer = setInterval(()=>{
    countdown--;
    if(countdown < 0){ clearInterval(nextUpdateTimer); return; }
    if(span) span.textContent = `Следующее обновление через ${countdown}с`;
  }, 1000);
}

// ===== анимация роста =====
function animateValue(el, from, to, durationMs=1800){
  if(from === to){ el.textContent = fmtMoney(to); return; }
  el.classList.add('flash-up');
  const start = performance.now();
  const delta = to - from;
  const ease = t => t<.5 ? 2*t*t : -1+(4-2*t)*t;
  function frame(now){
    const t = Math.min(1, (now - start)/durationMs);
    const v = from + delta * ease(t);
    el.textContent = fmtMoney(v);
    if(t < 1){ requestAnimationFrame(frame); }
    else { el.textContent = fmtMoney(to); el.classList.remove('flash-up'); }
  }
  requestAnimationFrame(frame);
}

// ===== рендер =====
function renderTop3(players, prevMap){
  const box = document.getElementById('top3');
  if(!box) return;

  if(!players || players.length < 3){
    box.innerHTML = `
      <div class="top3-card skeleton">Загрузка...</div>
      <div class="top3-card skeleton">Загрузка...</div>
      <div class="top3-card skeleton">Загрузка...</div>
    `;
    return;
  }

  box.innerHTML = '';
  players.forEach((p, i)=>{
    const card = document.createElement('div');
    card.className = 'top3-card ' + (i===0?'top1': i===1?'top2':'top3-place');
    if(isFirstRender) card.classList.add('animate-in');

    const prev = prevMap && prevMap.has(p.username) ? Number(prevMap.get(p.username)) : null;
    const cur  = Number(p.wagerAmount||0);

    card.innerHTML = `
      <div class="place">#${i+1}</div>
      <div class="name">${p.username ?? '—'}</div>
      <div class="amount">${fmtMoney(prev!=null ? prev : cur)}</div>
      <div class="prize">${typeof PRIZES !== 'undefined' && PRIZES[i] ? fmtMoney(PRIZES[i]) : ""}</div>
    `;
    box.appendChild(card);

    const amountEl = card.querySelector('.amount');
    if(prev!=null && cur > prev){ animateValue(amountEl, prev, cur, 1800); } else { amountEl.textContent = fmtMoney(cur); }
  });

  isFirstRender = false;
}
function renderRows(players, prevMap){
  const tbody = document.getElementById('tbody');
  if(!tbody) return;
  tbody.innerHTML = '';

  players.forEach((p, idx)=>{
    const tr = document.createElement('tr');
    const prev = prevMap && prevMap.has(p.username) ? Number(prevMap.get(p.username)) : null;
    const cur  = Number(p.wagerAmount||0);
    tr.innerHTML = `
      <td class="place">${idx+4}</td>
      <td class="name">${p.username ?? '—'}</td>
      <td class="amount">${fmtMoney(prev!=null ? prev : cur)}</td>
      <td class="prize">${typeof PRIZES !== 'undefined' && PRIZES[idx+3] ? fmtMoney(PRIZES[idx+3]) : '-'}</td>
    `;
    tbody.appendChild(tr);

    const amountEl = tr.querySelector('.amount');
    if(prev!=null && cur > prev){ animateValue(amountEl, prev, cur, 1800); } else { amountEl.textContent = fmtMoney(cur); }
  });
}

// ===== обновление =====
async function update(){
  setStatus('wait', '⏳ Обновление данных...');
  const url = `${API_BASE}?startTime=${API_START}&endTime=${API_END}`;
  try{
    const payload = await fetchWithTimeout(url);
    const data = Array.isArray(payload) ? payload : payload.data;
    const ts   = Array.isArray(payload) ? Date.now() : (payload.ts || Date.now());
    if(!Array.isArray(data)) throw new Error('INVALID_RESPONSE');

    const top = sortTop20(data);
    const prevMap = lastTop ? new Map(lastTop.map(x => [x.username, x.wagerAmount])) : null;

    renderTop3(top.slice(0,3), prevMap);
    renderRows(top.slice(3), prevMap);

    const lu = document.getElementById('lastUpdate');
    if(lu) lu.textContent = 'Последнее обновление: ' + new Date(ts).toLocaleTimeString();

    saveCache({ data, ts });
    lastTop = top;
    saveLastTop(lastTop);

    setStatus('ok', '✅ Успешно обновлено в ' + new Date(ts).toLocaleTimeString());
    startUpdateCountdown();
  }catch(err){
    console.error('Fetch error:', err);
    const cache = loadCache();
    if(cache && Array.isArray(cache.data)){
      const top = sortTop20(cache.data);
      const prevMap = lastTop ? new Map(lastTop.map(x => [x.username, x.wagerAmount])) : null;
      renderTop3(top.slice(0,3), prevMap);
      renderRows(top.slice(3), prevMap);
      const lu = document.getElementById('lastUpdate');
      if(lu && cache.ts) lu.textContent = 'Последнее обновление: ' + new Date(cache.ts).toLocaleTimeString();
      lastTop = top;
    }else{
      const tbody = document.getElementById('tbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="4">Загрузка данных...</td></tr>';
      const top3 = document.getElementById('top3');
      if (top3) top3.innerHTML = `
        <div class="top3-card skeleton">Загрузка...</div>
        <div class="top3-card skeleton">Загрузка...</div>
        <div class="top3-card skeleton">Загрузка...</div>`;
    }
    setStatus('err', '❌ Ошибка обновления, показаны кэш-данные (если были)');
    startUpdateCountdown();
  }
}

// ===== races.json =====
async function setupRaceSelectorIfAny(){
  const select = document.getElementById('raceSelect');
  if(!select) return false;

  try{
    const res = await fetch('races.json', { cache: 'no-store' });
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    if(!Array.isArray(data) || data.length === 0) throw new Error('Пустой races.json');

    // сортировка по окончанию
    data.sort((a,b)=> (a.end||0) - (b.end||0));
    select.innerHTML = data.map(r => `<option value="${r.id}">${r.name}</option>`).join('');

    const nowSec = Math.floor(Date.now()/1000);
    let current = data.find(r => (r.start <= nowSec && nowSec <= r.end)) || data[data.length-1];

    // 🔥 ЛОГИ ДЛЯ ПРОВЕРКИ
    console.log("Все гонки:", data);
    console.log("Сейчас:", nowSec);
    console.log("Выбрана гонка:", current);

    applyRaceLocal(current);
    select.value = current.id;

    select.addEventListener('change', (e)=>{
      const chosen = data.find(r => r.id === e.target.value);
      if (!chosen) return;
      console.log("Выбрана вручную:", chosen);
      applyRaceLocal(chosen);
    });

    return true;
  }catch(err){
    console.warn('Ошибка с races.json:', err);
    return false;
  }
}

function applyRaceLocal(race){
  if (race) {
    API_START = Number(race.start)||0;
    API_END   = Number(race.end)||0;
  }
  COUNTDOWN_END_MS = (API_END||0) * 1000;
  startCountdown(COUNTDOWN_END_MS);
  update();
}

// ===== старт =====
document.addEventListener('DOMContentLoaded', async ()=>{
  lastTop = loadLastTop();
  const hadSelector = await setupRaceSelectorIfAny();

  if (!hadSelector){
    COUNTDOWN_END_MS = typeof raceEnd === 'number' ? raceEnd : (API_END * 1000);
    startCountdown(COUNTDOWN_END_MS);
    update();
  }

  setInterval(update, REFRESH_MS);
});
