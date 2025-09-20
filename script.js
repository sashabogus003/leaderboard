const API_BASE = "/api/stats";

// ===== Константы и фолбэки (чтобы не падать, если что-то не задано в index.html) =====
const DEFAULT_START = 1756072800;  // сек
const DEFAULT_END   = 1759265999;  // сек (30.09.2025 23:59:59 МСК = 20:59:59 UTC)
const START_TS = (typeof startTime !== "undefined") ? startTime : DEFAULT_START;
const END_TS   = (typeof endTime   !== "undefined") ? endTime   : DEFAULT_END;
const RACE_END_MS = (typeof raceEnd !== "undefined") ? raceEnd : (END_TS * 1000);

// Призы на места 1-20
const PRIZES = [2000,1500,750,500,400,300,200,125,125,100,0,0,0,0,0,0,0,0,0,0];

let lastTop = null;          // предыдущие топ-20 для сравнения
let REFRESH_MS = 60_000;
let isFirstRender = true;

// ======== таймер ========
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
  setInterval(tick, 1000);
}

// ======== утилиты ========
async function fetchWithTimeout(url, opts={}, timeout=10000){
  const ctrl = new AbortController();
  const id = setTimeout(()=>ctrl.abort(), timeout);
  try{
    const res = await fetch(url, {...opts, signal: ctrl.signal});
    if(!res.ok) throw new Error(res.status+" "+res.statusText);
    return await res.json();
  } finally { clearTimeout(id); }
}

// нормализация полей (на случай, если у Shuffle имена ключей чуть другие)
function normalizePlayers(list){
  return (Array.isArray(list) ? list : []).map(p => ({
    username: (p.username ?? p.name ?? p.user ?? "—"),
    wagerAmount: Number(p.wagerAmount ?? p.wager ?? p.wagered ?? 0)
  }));
}

function sortTop20(list){
  return [...list].sort((a,b)=> (b.wagerAmount||0) - (a.wagerAmount||0)).slice(0,20);
}

function fmtMoney(n){
  return '$' + Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2});
}

function saveCache(payload){ try{localStorage.setItem('leaderboardCache', JSON.stringify(payload));}catch{} }
function loadCache(){ try{const raw = localStorage.getItem('leaderboardCache'); return raw? JSON.parse(raw): null;}catch{return null;} }

// ======== анимация роста значения ========
function animateValue(el, from, to, durationMs=1500){
  if(from === to){ el.textContent = fmtMoney(to); return; }
  el.classList.add('flash-up');                   // зелёная подсветка на время анимации
  const start = performance.now();
  const delta = to - from;
  function ease(t){ return t<.5 ? 2*t*t : -1+(4-2*t)*t; } // easeInOutQuad
  function frame(now){
    const t = Math.min(1, (now - start)/durationMs);
    const v = from + delta * ease(t);
    el.textContent = fmtMoney(v);
    if(t < 1){ requestAnimationFrame(frame); }
    else{
      el.textContent = fmtMoney(to);
      el.classList.remove('flash-up');            // вернуть обычный цвет
    }
  }
  requestAnimationFrame(frame);
}

// ======== рендер ========
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
      <div class="prize">${PRIZES[i] ? fmtMoney(PRIZES[i]) : ""}</div>
    `;
    box.appendChild(card);

    // анимация суммы, если выросла
    const amountEl = card.querySelector('.amount');
    if(prev!=null && prev !== cur && cur > prev){
      animateValue(amountEl, prev, cur, 1800);
    } else {
      amountEl.textContent = fmtMoney(cur);
    }
  });

  isFirstRender = false;
}

function renderRows(players, prevMap){
  const tbody = document.getElementById('tbody');
  if(!tbody) return;
  tbody.innerHTML = '';

  if(!players || players.length === 0){
    tbody.innerHTML = '<tr><td colspan="4">Нет данных</td></tr>';
    return;
  }

  players.forEach((p, idx)=>{
    const tr = document.createElement('tr');

    const prev = prevMap && prevMap.has(p.username) ? Number(prevMap.get(p.username)) : null;
    const cur  = Number(p.wagerAmount||0);

    tr.innerHTML = `
      <td class="place">${idx+4}</td>
      <td class="name">${p.username ?? '—'}</td>
      <td class="amount">${fmtMoney(prev!=null ? prev : cur)}</td>
      <td class="prize">${PRIZES[idx+3] ? fmtMoney(PRIZES[idx+3]) : '-'}</td>
    `;
    tbody.appendChild(tr);

    // анимация роста
    const amountEl = tr.querySelector('.amount');
    if(prev!=null && prev !== cur && cur > prev){
      animateValue(amountEl, prev, cur, 1800);
    } else {
      amountEl.textContent = fmtMoney(cur);
    }
  });
}

// ======== обновление ========
async function update(){
  const url = `${API_BASE}?startTime=${START_TS}&endTime=${END_TS}`;
  try{
    const payload = await fetchWithTimeout(url);

    // найдём массив игроков при любом оформлении
    // поддерживаем: [ ... ] ИЛИ { data:[ ... ] } ИЛИ { data:{ players:[ ... ] } }
    const raw = Array.isArray(payload) ? payload : payload?.data;
    const list = Array.isArray(raw) ? raw : (raw && raw.players) ? raw.players : [];
    if(!Array.isArray(list)) throw new Error('INVALID_RESPONSE_SHAPE');

    // нормализуем поля
    const data = normalizePlayers(list);

    // top-20
    const top = sortTop20(data);

    // карта предыдущих значений для анимации
    const prevMap = lastTop
      ? new Map(lastTop.map(x => [x.username, x.wagerAmount]))
      : null;

    renderTop3(top.slice(0,3), prevMap);
    renderRows(top.slice(3), prevMap);

    // время последнего обновления (если сервер прислал)
    const ts = Array.isArray(payload) ? null : payload?.ts ?? null;
    if(ts){
      const el = document.getElementById('lastUpdate');
      if(el) el.textContent = 'Последнее обновление: ' + new Date(ts).toLocaleTimeString();
    }

    // кешируем ровно список игроков (нормализованный), чтобы фронт всегда понимал формат
    saveCache({ data, ts });
    lastTop = top;
    REFRESH_MS = 60_000;

    // полезные логи для дебага
    console.log('[LB] OK, players:', data.length);
  }catch(err){
    console.error('[LB] Fetch error:', err);

    const cache = loadCache();
    if(cache && Array.isArray(cache.data)){
      const data = cache.data;
      const top = sortTop20(data);
      const prevMap = lastTop
        ? new Map(lastTop.map(x => [x.username, x.wagerAmount]))
        : null;

      renderTop3(top.slice(0,3), prevMap);
      renderRows(top.slice(3), prevMap);

      if(cache.ts){
        const el = document.getElementById('lastUpdate');
        if(el) el.textContent = 'Последнее обновление: ' + new Date(cache.ts).toLocaleTimeString();
      }
      lastTop = top;
      console.log('[LB] Used cached data:', data.length);
    }else{
      const tbody = document.getElementById('tbody');
      if(tbody){
        tbody.innerHTML = '<tr><td colspan="4">Загрузка данных...</td></tr>';
      }
      const top3 = document.getElementById('top3');
      if(top3){
        top3.innerHTML = `
          <div class="top3-card skeleton">Загрузка...</div>
          <div class="top3-card skeleton">Загрузка...</div>
          <div class="top3-card skeleton">Загрузка...</div>
        `;
      }
    }
    REFRESH_MS = 10_000;
  }
  setTimeout(update, REFRESH_MS);
}

// ======== старт ========
document.addEventListener('DOMContentLoaded', ()=>{
  startCountdown(RACE_END_MS);   // мс
  update();
});
