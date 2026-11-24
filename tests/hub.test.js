const cards = page => page.$$eval('article.card', as => as.map(a => [a.dataset.id, a.querySelector('a.cover').getAttribute('href'), a.querySelector('img').getAttribute('src')]));
module.exports = {
  page: 'index.html',
  tests: {
    'every catalogue entry has a card, a real page and a thumbnail': async ({ page, ok, eq }) => {
      const cs = await cards(page), ids = [...new Set(cs.map(c => c[0]))];
      const n = await page.evaluate(() => RH_CATALOG.length);
      eq(ids.length, n, 'unique cards'); ok(n >= 28);
      for (const [, href, img] of cs) {
        ok(href.endsWith('/index.html'), 'explicit index.html: ' + href);
        for (const u of [href, img]) { const r = await page.request.get(new URL(u, page.url()).href); ok(r.ok(), 'missing ' + u); }
      }
    },
    'catalogue: 10+ tags, every entry tagged 2+ times, every tag has 3+ experiments': async ({ page, eq }) => {
      const bad = await page.evaluate(() => { const tags = new Set(RH_TAGLIST.map(t => t.id));
        return [...RH_CATALOG.flatMap(x => [...(x.tags.length >= 2 ? [] : [x.id + ':needs 2+ tags']), ...x.tags.filter(t => !tags.has(t)).map(t => x.id + ':' + t), ...(['20-min', 'rabbit-hole'].includes(x.time) ? [] : [x.id + ':time']), ...([1, 2, 3].includes(x.diff) ? [] : [x.id + ':diff'])]),
          ...RH_TAGLIST.filter(t => RH_CATALOG.filter(x => x.tags.includes(t.id)).length < 3).map(t => t.id + ':fewer than 3 experiments')]; });
      eq(bad, []);
    },
    'default view: one row per tag (10+), no round sections': async ({ page, ok, eq }) => {
      const n = await page.$$eval('.railsec', s => s.length); ok(n >= 10, 'rows ' + n);
      eq(await page.evaluate(() => RH_TAGLIST.length), n);
      ok(!(await page.content()).match(/Round (two|three|four)/), 'round headings still present');
    },
    'tag chips combine (AND); URL records them; clear resets': async ({ page, ok, eq }) => {
      await page.click('#tags [data-tag="water"]'); await page.click('#tags [data-tag="pretty"]');
      ok(page.url().includes('tags=water%2Cpretty') || page.url().includes('tags=water,pretty'), page.url());
      const ids = [...new Set((await cards(page)).map(c => c[0]))].sort();
      const want = await page.evaluate(() => RH_CATALOG.filter(x => x.tags.includes('water') && x.tags.includes('pretty')).map(x => x.id).sort());
      eq(ids, want); ok(ids.length >= 2);
      await page.click('[data-clear]'); ok(!page.url().includes('tags='));
    },
    'See all on a row shows just that tag': async ({ page, eq }) => {
      await page.click('#tag-detective .seeall');
      const ids = [...new Set((await cards(page)).map(c => c[0]))].sort();
      eq(ids, await page.evaluate(() => RH_CATALOG.filter(x => x.tags.includes('detective')).map(x => x.id).sort()));
    },
    'tag on a card filters to that tag; search narrows; no-match message': async ({ page, ok }) => {
      await page.click('#tags [data-tag="quick"]');
      await page.click('article.card[data-id="ruin"] .t[data-tag="wait-what"]');
      const ids = [...new Set((await cards(page)).map(c => c[0]))];
      ok(ids.includes('ruin') && ids.includes('polarizer') && ids.includes('lock-flight'), ids.join());
      await page.fill('#q', 'zzzz-nothing'); await page.waitForTimeout(300);
      ok(await page.isVisible('.empty'));
      await page.click('#tags [data-clear]'); await page.fill('#q', 'bee'); await page.waitForTimeout(300);
      const b = [...new Set((await cards(page)).map(c => c[0]))]; ok(b.includes('swarm'), 'bee should find swarm: ' + b);
    },
    'search finds by words in description': async ({ page, eq }) => {
      await page.fill('#q', 'gravity'); await page.waitForTimeout(300);
      const ids = [...new Set((await cards(page)).map(c => c[0]))];
      eq(ids.includes('slingshot'), true);
    },
    'similar view shows the item plus six others with reasons; deep link works': async ({ page, ok, eq }) => {
      await page.goto(page.url().split('#')[0] + '#like=ant-mind'); await page.waitForTimeout(300);
      const ids = (await cards(page)).map(c => c[0]);
      eq(ids[0], 'ant-mind'); eq(ids.length, 7); ok(!ids.slice(1).includes('ant-mind'));
      eq(await page.$$eval('.why', w => w.length), 6);
    },
    'clicking a card body opens the experiment': async ({ page, ok }) => {
      await Promise.all([page.waitForNavigation(), page.click('article.card[data-id="vault"] .thumb')]);
      ok(page.url().includes('/vault/index.html'));
    },
    'mobile: filter bar fits, no horizontal page scroll': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page scrolls sideways');
    },
  },
};
