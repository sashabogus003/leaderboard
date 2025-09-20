const API_BASE = "/api/stats";
let lastData = null;
let REFRESH_MS = 60_000;
let isFirstRender = true;

// таймер обратного отсчёта
function startCountdown(endTime) {
  function updateCountdown() {
    const now = new Date().getTime();
    const distance = endTime - now;

    if (distance < 0) {
      document.getElementById("countdown").innerHTML = "Гонка завершена!";
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    document.getElementById("countdown").innerHTML =
      `До конца гонки: ${days}д ${hours}ч ${minutes}м ${seconds}с`;
  }
  updateCountdown();
  setInterval(updateCountdown, 1000);
}

// загрузка с таймаутом
async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 10000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal,
  });
  clearTimeout(id);
  return response.json();
}

// сортировка топа
function sortTop20(data) {
  return data
    .sort((a, b) => b.wagerAmount - a.wagerAmount)
    .slice(0, 20);
}

// рендер топ-3
function renderTop3(players) {
  const top3Container = document.getElementById("top3");

  if (!players || players.length < 3) {
    top3Container.innerHTML = `
      <div class="top3-card skeleton">Загрузка...</div>
      <div class="top3-card skeleton">Загрузка...</div>
      <div class="top3-card skeleton">Загрузка...</div>
    `;
    return;
  }

  top3Container.innerHTML = "";

  players.forEach((player, index) => {
    const card = document.createElement("div");
    card.classList.add("top3-card");

    if (index === 0) card.classList.add("top1");
    if (index === 1) card.classList.add("top2");
    if (index === 2) card.classList.add("top3-place");

    if (isFirstRender) {
      card.classList.add("animate-in");
    }

    card.innerHTML = `
      <div class="place">#${index + 1}</div>
      <div class="name">${player.username}</div>
      <div class="amount">$${player.wagerAmount.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
      <div class="prize">${player.prize ? `$${player.prize.toLocaleString()}` : ""}</div>
    `;

    top3Container.appendChild(card);
  });

  isFirstRender = false;
}

// рендер таблицы
function renderRows(players) {
  const tbody = document.getElementById("tbody");
  tbody.innerHTML = "";

  players.forEach((player, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="place">${idx + 4}</td>
      <td class="name">${player.username}</td>
      <td class="amount">$${player.wagerAmount.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
      <td class="prize">${player.prize ? `$${player.prize.toLocaleString()}` : "-"}</td>
    `;
    tbody.appendChild(tr);
  });
}

// кэш
function saveCache(payload) {
  localStorage.setItem("leaderboardCache", JSON.stringify(payload));
}
function loadCache() {
  const raw = localStorage.getItem("leaderboardCache");
  return raw ? JSON.parse(raw) : null;
}

// обновление данных
async function update() {
  const url = `${API_BASE}?startTime=${startTime}&endTime=${endTime}`;
  try {
    const payload = await fetchWithTimeout(url);

    let topRaw = null;
    let ts = null;

    if (Array.isArray(payload)) {
      topRaw = payload;
    } else if (payload.data && Array.isArray(payload.data)) {
      topRaw = payload.data;
      ts = payload.ts || null;
    }

    if (!topRaw) throw new Error("INVALID_RESPONSE");

    const top = sortTop20(topRaw);

    renderTop3(top.slice(0, 3));
    renderRows(top.slice(3));

    if (ts) {
      document.getElementById("lastUpdate").textContent =
        "Последнее обновление: " + new Date(ts).toLocaleTimeString();
    }

    saveCache({ data: topRaw, ts });
    lastData = top;
    REFRESH_MS = 60_000;
  } catch (err) {
    console.error("Fetch error:", err);
    const cache = loadCache();
    if (cache && cache.data) {
      renderTop3(cache.data.slice(0, 3));
      renderRows(cache.data.slice(3));
      if (cache.ts) {
        document.getElementById("lastUpdate").textContent =
          "Последнее обновление: " + new Date(cache.ts).toLocaleTimeString();
      }
      lastData = cache.data;
    } else {
      const tbody = document.getElementById("tbody");
      tbody.innerHTML = '<tr><td colspan="4">Загрузка данных...</td></tr>';
    }
    REFRESH_MS = 10_000;
  }

  setTimeout(update, REFRESH_MS);
}

// старт
document.addEventListener("DOMContentLoaded", () => {
  startCountdown(raceEnd);
  update();
});
