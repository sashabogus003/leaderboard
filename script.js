const startTime = 1756072800; // 25.08.2025 UTC
const endTime   = 1759276799; // 30.09.2025 UTC
const API_BASE = "/api/stats"; // скрытый API
const PRIZES = [2000,1500,750,500,400,300,200,125,125,100,0,0,0,0,0];

function fmtMoney(n){
  return '$' + Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function sortTop15(list){
  return [...list].sort((a,b)=>(b.wagerAmount||0)-(a.wagerAmount||0)).slice(0,15);
}

function renderRows(rows){
  const tbody=document.getElementById('tbody');
  tbody.innerHTML='';
  rows.forEach((u,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${i+1}</td>
      <td>${u.username ?? '—'}</td>
      <td>${fmtMoney(u.wagerAmount)}</td>
      <td>${fmtMoney(u.deposit)}</td>
      <td>${PRIZES[i] ? fmtMoney(PRIZES[i]) : '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function update(){
  try{
    const res = await fetch(`${API_BASE}?startTime=${startTime}&endTime=${endTime}`);
    const data = await res.json();
    renderRows(sortTop15(data));
  }catch(err){
    console.error("Ошибка:", err);
    document.getElementById('tbody').innerHTML='<tr><td colspan="5">Ошибка загрузки</td></tr>';
  }
}

function updateTimer(){
  const now = Math.floor(Date.now()/1000);
  let left = endTime - now;
  const timerEl = document.getElementById("timer");
  if(left <= 0){
    timerEl.textContent = "⏰ Лидерборд завершён!";
    return;
  }
  const d = Math.floor(left/86400);
  left %= 86400;
  const h = Math.floor(left/3600);
  left %= 3600;
  const m = Math.floor(left/60);
  const s = left % 60;
  timerEl.textContent = `До конца: ${d}д ${h}ч ${m}м ${s}с`;
}

update();
setInterval(update, 60000);
setInterval(updateTimer, 1000);
updateTimer();
