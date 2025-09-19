let cache = null;
let cacheTime = 0;

export default async function handler(req, res) {
  const { startTime, endTime } = req.query;
  const now = Date.now();

  // Если кэш свежий (меньше минуты) → отдаем его
  if (cache && (now - cacheTime < 60 * 1000)) {
    return res.status(200).json(cache);
  }

  const url = `https://affiliate.shuffle.com/stats/${process.env.SHUFFLE_KEY}?startTime=${startTime}&endTime=${endTime}`;

  try {
    const r = await fetch(url);
    const data = await r.json();

    // Сохраняем в кэш
    cache = data;
    cacheTime = now;

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Ошибка запроса" });
  }
}
