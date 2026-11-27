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
    'tags have subject (incl. physics, maths, simulation, history, art) and vibe groups': async ({ page, ok }) => {
      const g = await page.evaluate(() => ({ s: RH_TAGLIST.filter(t => t.g === 'subject').map(t => t.id), v: RH_TAGLIST.filter(t => t.g === 'vibe').length }));
      for (const t of ['physics', 'maths', 'simulation', 'history', 'art']) ok(g.s.includes(t), 'missing subject ' + t);
      ok(g.s.length >= 10 && g.v >= 5);
      ok(await page.evaluate(() => RH_CATALOG.every(x => x.tags.some(t => RH_TAGLIST.find(g => g.id === t).g === 'subject'))), 'every experiment needs a subject');
    },
    'default view: one row per tag (10+), no round sections': async ({ page, ok, eq }) => {
      const n = await page.$$eval('.railsec', s => s.length); ok(n >= 10, 'rows ' + n);
      eq(await page.evaluate(() => RH_TAGLIST.length), n);
      ok(!(await page.content()).match(/Round (two|three|four)/), 'round headings still present');
    },
    'tag chips combine (AND); URL records them; clear resets': async ({ page, ok, eq }) => {
      await page.click('#tags [data-tag="earth"]'); await page.click('#vibes [data-tag="pretty"]');
      ok(page.url().includes('tags=earth%2Cpretty') || page.url().includes('tags=earth,pretty'), page.url());
      const ids = [...new Set((await cards(page)).map(c => c[0]))].sort();
      const want = await page.evaluate(() => RH_CATALOG.filter(x => x.tags.includes('earth') && x.tags.includes('pretty')).map(x => x.id).sort());
      eq(ids, want); ok(ids.length >= 2);
      await page.click('[data-clear]'); ok(!page.url().includes('tags='));
    },
    'See all on a row shows just that tag': async ({ page, eq }) => {
      await page.click('#tag-detective .seeall');
      const ids = [...new Set((await cards(page)).map(c => c[0]))].sort();
      eq(ids, await page.evaluate(() => RH_CATALOG.filter(x => x.tags.includes('detective')).map(x => x.id).sort()));
    },
    'tag on a card filters to that tag; search narrows; no-match message': async ({ page, ok }) => {
      // click the maths tag on whichever card carries one (the catalogue changes as games are replaced)
      await page.click('article.card .t[data-tag="maths"]');
      const ids = [...new Set((await cards(page)).map(c => c[0]))];
      const maths = await page.evaluate(() => RH_CATALOG.filter(x => x.tags.includes('maths')).map(x => x.id));
      ok(ids.length > 2 && ids.every(id => maths.includes(id)), ids.join());
      await page.fill('#q', 'zzzz-nothing'); await page.waitForTimeout(300);
      ok(await page.isVisible('.empty'));
      await page.click('#tags [data-clear]'); await page.fill('#q', 'wolves'); await page.waitForTimeout(300);
      const b = [...new Set((await cards(page)).map(c => c[0]))]; ok(b.includes('island'), 'wolves should find the island: ' + b);
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
    'search keeps a space typed between words (multi-word search)': async ({ page, eq }) => {
      await page.click('#q'); await page.keyboard.type('bee ', { delay: 30 }); await page.waitForTimeout(300);
      await page.keyboard.type('keep', { delay: 30 }); await page.waitForTimeout(300);
      eq(await page.inputValue('#q'), 'bee keep');
    },
    'deep link to a similar view on a phone scrolls the results into view': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(page.url().split('#')[0] + '#like=nand'); await page.reload(); await page.waitForTimeout(600);
      const top = await page.evaluate(() => document.querySelector('#view h2').getBoundingClientRect().top);
      ok(top >= 0 && top < 844, 'similar view heading off-screen at ' + top);
    },
    'mobile: filter bar fits, no horizontal page scroll': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page scrolls sideways');
    },
  },
};
