const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/image', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('URL не указан');

  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    res.set('Content-Type', 'image/jpeg');
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).send('Ошибка загрузки изображения');
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Proxy server running at http://localhost:${PORT}/image?url=<URL>`);
});
