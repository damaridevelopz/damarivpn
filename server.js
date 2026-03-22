const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
};

async function fetchAndRewrite(url) {
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  const response = await axios.get(url, {
    timeout: 15000,
    headers: HEADERS,
    maxRedirects: 5,
    decompress: true,
  });

  const $ = cheerio.load(response.data);

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript')) return;
    try { $(el).attr('href', '/proxy?url=' + encodeURIComponent(new URL(href, url).href)); } catch {}
  });

  $('form[action]').each((_, el) => {
    const action = $(el).attr('action');
    if (!action) return;
    try { $(el).attr('action', '/proxy?url=' + encodeURIComponent(new URL(action, url).href)); } catch {}
  });

  $('img[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (!src || src.startsWith('data:')) return;
    try { $(el).attr('src', new URL(src, url).href); } catch {}
  });

  $('link[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('data:')) return;
    try { $(el).attr('href', new URL(href, url).href); } catch {}
  });

  $('script[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (!src || src.startsWith('data:')) return;
    try { $(el).attr('src', new URL(src, url).href); } catch {}
  });

  const hostname = new URL(url).hostname;
  $('body').append(`
    <div id="damari-bar" style="position:fixed;bottom:0;left:0;right:0;z-index:999999;background:#2A5C40;color:#F5F0E8;font-family:'Space Mono',monospace;font-size:12px;display:flex;align-items:center;gap:12px;padding:8px 16px;border-top:2px solid #3A7D5A;">
      <span style="font-weight:700;letter-spacing:0.08em;color:#A8D5B5;">DAMARI<span style="color:#F5F0E8">VPN</span></span>
      <span style="color:#A8D5B5;font-size:10px;">● PROXYING: ${hostname}</span>
      <div style="flex:1"></div>
      <input id="d-url" type="text" placeholder="Enter new URL..." style="font-family:'Space Mono',monospace;font-size:11px;background:#1A3C28;border:1px solid #3A7D5A;color:#F5F0E8;border-radius:6px;padding:4px 10px;width:260px;outline:none;" />
      <button onclick="dGo()" style="font-family:'Space Mono',monospace;font-size:11px;background:#3A7D5A;color:#F5F0E8;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;">GO</button>
      <a href="/" style="color:#A8D5B5;font-size:10px;text-decoration:none;">✕ EXIT</a>
    </div>
    <div style="height:46px"></div>
    <script>
      function dGo(){var u=document.getElementById('d-url').value.trim();if(!u)return;if(!/^https?:\\/\\//i.test(u))u='https://'+u;window.location.href='/proxy?url='+encodeURIComponent(u);}
      document.getElementById('d-url').addEventListener('keydown',function(e){if(e.key==='Enter')dGo();});
    </script>
  `);

  return $.html();
}

function errMsg(err) {
  if (err.response) return 'Site returned error ' + err.response.status;
  if (err.code === 'ECONNREFUSED') return 'Connection refused by site';
  if (err.code === 'ENOTFOUND') return 'Site not found — check the URL';
  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') return 'Request timed out';
  return err.message || 'Unknown error';
}

// POST /fetch — called by the frontend
app.post('/fetch', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL provided' });
  try {
    const html = await fetchAndRewrite(url);
    res.set('Content-Type', 'text/html').send(html);
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

// GET /proxy?url=... — handles link clicks inside proxied pages
app.get('/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.redirect('/');
  try {
    const html = await fetchAndRewrite(url);
    res.set('Content-Type', 'text/html').send(html);
  } catch (err) {
    res.status(500).send(`<html><body style="font-family:monospace;padding:2rem;background:#F5F0E8;">
      <h2 style="color:#2A5C40;">DamariVPN</h2>
      <p style="color:#922B21;">⚠ ${errMsg(err)}</p>
      <a href="/" style="color:#2A5C40;">← Back</a>
    </body></html>`);
  }
});

// GET / — serve homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`DamariVPN running on http://localhost:${PORT}`));
