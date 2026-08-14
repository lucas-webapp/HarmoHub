const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => localStorage.removeItem('myProgression'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);

    // Add 2 chords
    await page.evaluate(() => { window.app.saveCurrent(); });
    await page.waitForTimeout(100);
    await page.evaluate(() => { window.app.saveCurrent(); });
    await page.waitForTimeout(100);

    // Set a loop range covering BOTH chords (whole grid), then edit chord 0 in the COMPACT sequencer
    await page.evaluate(() => { window.app.setLoopRange(0, 0, 0, 1); });
    await page.waitForTimeout(100);
    await page.evaluate(() => { window.app.editChord(0, 0); });
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.app.toggleSequencer(); });
    await page.waitForTimeout(200);

    console.log('gridZoomOpen:', await page.evaluate(() => window.app.gridZoomOpen));
    console.log('seqZoomOpen:', await page.evaluate(() => window.app.seqZoomOpen));
    console.log('loopRange:', await page.evaluate(() => JSON.stringify(window.app.loopRange)));

    // Wrap playCurrent/playProgression to see which gets called
    await page.evaluate(() => {
        window.__calls = [];
        const origCur = window.app.playCurrent.bind(window.app);
        window.app.playCurrent = function(...a) { window.__calls.push('playCurrent'); return origCur(...a); };
        const origProg = window.app.playProgression.bind(window.app);
        window.app.playProgression = function(...a) { window.__calls.push('playProgression'); return origProg(...a); };
    });

    await page.click('#seq-play');
    await page.waitForTimeout(200);
    const calls = await page.evaluate(() => window.__calls);
    console.log('calls after clicking #seq-play (compact, hors loupe):', JSON.stringify(calls));
    check(calls.includes('playCurrent') && !calls.includes('playProgression'), "hors loupe, #seq-play appelle playCurrent() (jamais playProgression) même avec une plage à boucler active");

    const btnClass = await page.evaluate(() => document.getElementById('seq-play').classList.contains('btn-loop-range'));
    check(!btnClass, "hors loupe, #seq-play n'affiche pas le style/la plage à boucler");

    await page.evaluate(() => { window.app.stopAll(); window.__calls = []; });
    await page.waitForTimeout(100);

    // Now open the grid loupe (pinned sequencer) and verify the SAME button DOES honor loopRange there
    await page.evaluate(() => { window.app.openGridZoom(); });
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.app.editChordFromGridZoom(0, 0); });
    await page.waitForTimeout(200);
    console.log('gridZoomOpen now:', await page.evaluate(() => window.app.gridZoomOpen));

    await page.click('#seq-play');
    await page.waitForTimeout(200);
    const calls2 = await page.evaluate(() => window.__calls);
    console.log('calls after clicking #seq-play (loupe grille, plage active):', JSON.stringify(calls2));
    check(calls2.includes('playProgression'), "EN loupe grille, #seq-play honore bien la plage à boucler (playProgression)");

    await page.evaluate(() => { window.app.stopAll(); });

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
