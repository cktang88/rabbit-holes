module.exports = {
  page: 'index.html',
  tests: {
    'every card links to a page that exists and has a thumbnail': async ({ page, ok }) => {
      const cards = await page.$$eval('a.card', as => as.map(a => [a.getAttribute('href'), a.querySelector('img') && a.querySelector('img').getAttribute('src')]));
      ok(cards.length >= 28, 'expected 28+ cards, got ' + cards.length);
      for (const [href, img] of cards) {
        ok(href.endsWith('/index.html'), 'link must be explicit index.html: ' + href);
        for (const u of [href, img]) { const r = await page.request.get(new URL(u, page.url()).href); ok(r.ok(), 'missing ' + u); }
      }
    },
  },
};
