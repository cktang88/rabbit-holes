# Tests

`node tests/run.js` runs every `tests/<game>.test.js`; `node tests/run.js vault ruin` runs only those.
It starts `python3 -m http.server 8765` if nothing is serving the repo.

Each file exports `{ page, tests }`. A test gets `{ page, eq, ok, near, throws }` and drives the game's real code in a browser:
prefer calling the game's pure logic through its debug handle (`window.__vault`, `window.__ruin`, …) with `page.evaluate`,
and use real mouse/keyboard input for interaction bugs (e.g. a win must not fire while a slider is merely swept past the answer).
localStorage is cleared once at the start of every test (reloads within a test keep it, so save/load and corrupted-save tests can `page.evaluate(() => localStorage.setItem(...))` then `page.reload()`), and any uncaught page error fails the test.
