const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  const base = 'http://127.0.0.1:8081'
  console.log('goto', base)
  await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });

  await page.waitForSelector('#playlistButtons');
  // wait for playlist buttons to be populated
  try {
    await page.waitForFunction(() => document.querySelectorAll('#playlistButtons button.playlist-btn').length > 0, { timeout: 10000 });
  } catch (e) {
    console.warn('playlist buttons did not populate in time')
  }

  const buttons = await page.$$eval('#playlistButtons button.playlist-btn', btns => btns.map(b => b.textContent.trim()));
  console.log('Playlists buttons:', buttons);

  // click playlist index 1 if exists
  if (buttons.length > 1) {
    await page.click('#playlistButtons button.playlist-btn:nth-child(2)');
    console.log('Clicked external playlist button index 1');
  } else {
    console.log('Not enough playlist buttons');
  }

  // give player time to render internal tabs
  await page.waitForTimeout(1000);

  const tabExists = await page.$('.tabs .nav li[data-index="1"]') !== null;
  console.log('Internal tab exists (index1):', tabExists);

  // wait for external song list items
  try {
    await page.waitForSelector('#songList li', { timeout: 5000 });
  } catch (e) {
    console.warn('External song list items not found')
  }
  const songCount = await page.$$eval('#songList li', els => els.length);
  console.log('External songList count:', songCount);

  // click external song index 1
  if (songCount > 1) {
    await page.click('#songList li:nth-child(2)');
    console.log('Clicked external song index 1');
  } else {
    console.log('Not enough songs to click');
  }

  // capture snapshots of internal playlist DOM and audio src over time
  for (let t = 0; t < 12; t++) {
    const snapshot = await page.evaluate(() => {
      const playlists = Array.from(document.querySelectorAll('.playlist ol')).map((ol, idx) => {
        const items = Array.from(ol.querySelectorAll('li')).map((li, i) => ({ i, class: li.className, text: li.textContent.trim().slice(0, 80) }));
        return { idx, length: items.length, items };
      });
      const active = Array.from(document.querySelectorAll('.playlist ol li')).map((li, i) => ({ i, class: li.className })).filter(x => x.class && x.class.includes('active'));
      const audio = document.querySelector('#MusicPlayerRoot audio');
      return { playlists, active, audioSrc: audio ? audio.src : null };
    });
    console.log('SNAPSHOT', t, JSON.stringify(snapshot, null, 2));
    await page.waitForTimeout(400);
  }

  await browser.close();
  console.log('done');
})().catch(err => { console.error(err); process.exit(1); });
