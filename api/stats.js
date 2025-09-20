let cache = {
  data: null,
  ts: null,
  expiry: 0
};

export default async function handler(req, res) {
  // 🚫 запрещаем внешнее кеширование, чтобы не было 304
  res.setHeader("Cache-Control", "no-store");

  const { startTime, endTime } = req.query;

  // ✅ если есть кеш и он ещё не протух
  if (cache.data && Date.now() < cache.expiry) {
    return res.status(200).json({ data: cache.data, ts: cache.ts });
  }

  try {
    const url = `https://affiliate.shuffle.com/stats/${process.env.SHUFFLE_KEY}?startTime=${startTime}&endTime=${endTime}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Ошибка API: ${response.status}`);
    }

    const json = await response.json();

    // 🗃 обновляем кеш
    cache.data = json;
    cache.ts = Date.now();
    cache.expiry = Date.now() + 60 * 1000; // 1 минута

    return res.status(200).json({ data: cache.data, ts: cache.ts });
  } catch (err) {
    console.error("Ошибка при запросе Shuffle:", err.message);

    // ✅ если был кеш даже протухший — вернём его
    if (cache.data) {
      return res.status(200).json({ data: cache.data, ts: cache.ts, stale: true });
    }

    // ❌ если кеша совсем нет — тогда ошибка
    return res.status(500).json({ message: "Ошибка запроса и нет кэша" });
  }
}
