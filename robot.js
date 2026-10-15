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
  p.on('console', m => console.log(m.text()));
  p.on('pageerror', e => console.log('PAGE ERROR', e.message));
  const res = await p.goto(SITE + path + (process.env.QS ? '?' + process.env.QS : ''), { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (!res || res.status() !== 200) { console.log('HTTP', res && res.status()); process.exit(1); }
  await p.waitForFunction(() => document.body.dataset.done === '1', { timeout: 40 * 60 * 1000, polling: 2000 });
  console.log('==== DONE', JSON.stringify(await p.evaluate(() => window.ROBOT_SUMMARY)));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
