let cache = { ts: 0, data: null };

export default async function handler(req, res) {
  const { startTime, endTime } = req.query;
  const now = Date.now();

  // если кэш свежее минуты → отдаём его
  if (cache.data && (now - cache.ts < 60_000)) {
    return res.status(200).json(cache.data);
  }

  const url = `https://affiliate.shuffle.com/stats/${process.env.SHUFFLE_KEY}?startTime=${startTime}&endTime=${endTime}`;

  try {
    const r = await fetch(url);
    if (!r.ok) {
      throw new Error(`Ошибка ${r.status}`);
    }
    const data = await r.json();

    // сохраняем данные в кэш
    cache = { ts: now, data };

    res.status(200).json(data);
  } catch (err) {
    console.error("API error:", err);

    // если в кэше что-то есть — отдаём его даже при ошибке
    if (cache.data) {
      return res.status(200).json(cache.data);
    }

    res.status(500).json({ error: "Ошибка запроса и нет кэша" });
  }
}
