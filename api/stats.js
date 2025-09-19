export default async function handler(req, res) {
  const { startTime, endTime } = req.query;

  const url = `https://affiliate.shuffle.com/stats/${process.env.SHUFFLE_KEY}?startTime=${startTime}&endTime=${endTime}`;

  try {
    const r = await fetch(url);
    const data = await r.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Ошибка запроса" });
  }
}

