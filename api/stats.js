import fetch from 'node-fetch';

let cache = {
  data: null,
  ts: null,
  expiry: 0
};

export default async function handler(req, res) {
  const { startTime, endTime } = req.query;

  // если есть кэш и он ещё живой → отдаем его
  if (cache.data && Date.now() < cache.expiry) {
    return res.status(200).json({ data: cache.data, ts: cache.ts });
  }

  try {
    const url = `https://api.shuffle.com/stats?startTime=${startTime}&endTime=${endTime}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.SHUFFLE_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Ошибка API: ${response.status}`);
    }

    const json = await response.json();

    // сохраняем в кэш
    cache.data = json;
    cache.ts = Date.now();
    cache.expiry = Date.now() + 60 * 1000; // кэш на 1 минуту

    return res.status(200).json({ data: cache.data, ts: cache.ts });
  } catch (err) {
    console.error("Ошибка при запросе Shuffle:", err.message);

    if (cache.data) {
      // отдаём старый кэш, даже если API упало
      return res.status(200).json({ data: cache.data, ts: cache.ts });
    }

    return res.status(500).json({ message: "Ошибка запроса и нет кэша" });
  }
}
