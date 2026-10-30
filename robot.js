// Photo Card BD robot — opens a page on photocardbd.com in headless Chrome and waits for it to finish.
// All card drawing and posting logic lives on the site; this only provides a browser on a schedule.
// The key (secret DC_ROBOT_KEY) is sent only to photocardbd.com, never to fonts/CDNs.
const puppeteer = require('puppeteer-core');
const SITE = 'https://photocardbd.com/';
(async () => {
  const path = process.argv[2];                 // e.g. daily-card/robot.php
  const key = process.env.DC_ROBOT_KEY;
  if (!path || !key) { console.log('missing path/key'); process.exit(1); }
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--lang=bn-BD'] });
  const p = await b.newPage();
  await p.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 PhotoCardBD-Robot');
  await p.setRequestInterception(true);
  p.on('request', r => {
    if (r.url().startsWith(SITE)) r.continue({ headers: Object.assign({}, r.headers(), { 'x-robot-key': key }) });
    else r.continue();
  });
  // খবরের ছবি আসল ব্রাউজারের মতো খুলে আনা (অনেক নিউজ সাইট সার্ভার থেকে ছবি নিতে দেয় না) → data: URL
  await p.exposeFunction('robotImage', async url => {
    console.log('image fetch', url);
    if (!/^https?:\/\//i.test(url)) return '';
    const t = await b.newPage();
    try {
      await t.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36');
      const r = await t.goto(url, { waitUntil: 'load', timeout: 30000 });
      if (!r || !r.ok()) { console.log('image HTTP', r && r.status(), url); return ''; }
      const ct = (r.headers()['content-type'] || '').split(';')[0];
      if (!/^image\//.test(ct)) { console.log('not an image', ct, url); return ''; }
      const buf = await r.buffer();
      if (buf.length > 12 * 1024 * 1024) return '';
      return 'data:' + ct + ';base64,' + buf.toString('base64');
    } catch (e) { console.log('image error', e.message); return ''; } finally { await t.close(); }
  });
  // ছবির ঠিকানা না থাকলে: খবরের পাতা খুলে og:image / twitter:image / প্রথম বড় ছবি
  await p.exposeFunction('robotOgImage', async url => {
    if (!/^https?:\/\//i.test(url)) return '';
    const t = await b.newPage();
    try {
      await t.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36');
      await t.setRequestInterception(true);
      t.on('request', q => ['image', 'media', 'font', 'stylesheet'].includes(q.resourceType()) ? q.abort() : q.continue());
      const r = await t.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (!r || !r.ok()) { console.log('page HTTP', r && r.status(), url); return ''; }
      const src = await t.evaluate(() => {
        // একাধিক og:image থাকলে (কিছু সাইটে প্লাগইন WhatsApp-এর আইকন ঢোকায়) — সাইটের নিজের ছবি নেওয়া, .svg আইকন বাদ
        const ok = u => u && !/\.svg(\?|$)/i.test(u);
        const all = [...document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"], link[rel="image_src"]')].map(e => e.content || e.href || '').filter(ok);
        const own = all.find(u => { try { return new URL(u, location.href).hostname.replace(/^www\./, '') === location.hostname.replace(/^www\./, ''); } catch (e) { return false; } });
        const img = document.querySelector('article img, .entry-content img, img.wp-post-image');
        return own || all[0] || (img && (img.dataset.src || img.src)) || '';
      });
      console.log('og image', src || '(none)', url);
      return src;
    } catch (e) { console.log('page error', e.message); return ''; } finally { await t.close(); }
  });
  p.on('console', m => console.log(m.text()));
  p.on('pageerror', e => console.log('PAGE ERROR', e.message));
  const res = await p.goto(SITE + path + (process.env.QS ? '?' + process.env.QS : ''), { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (!res || res.status() !== 200) { console.log('HTTP', res && res.status()); process.exit(1); }
  await p.waitForFunction(() => document.body.dataset.done === '1', { timeout: 40 * 60 * 1000, polling: 2000 });
  console.log('==== DONE', JSON.stringify(await p.evaluate(() => window.ROBOT_SUMMARY)));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
