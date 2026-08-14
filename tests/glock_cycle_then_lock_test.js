const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

async function cellBox(page, section, index) {
    const sel = `.grid-cell[data-section="${section}"][data-index="${index}"]`;
    await page.waitForSelector(sel);
    return page.locator(sel).boundingBox();
}
async function dblclickCellSafe(page, section, index) {
    const box = await cellBox(page, section, index);
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height - 6);
    await page.waitForTimeout(250);
}

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality, octave) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Section', chords: [
            mk('C#', 'min', 4), mk('G#', 'min', 3), mk('D#', 'min', 3), mk('C#', 'min', 3),
        ] }] }));
        localStorage.setItem('harmohubShowGuitar', '1');
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);

    await dblclickCellSafe(page, 0, 2); // D#m
    const nFingerings = await page.evaluate(() => window.app.guitarFingerings.length);
    console.log('D#m fingerings:', nFingerings);
    check(nFingerings >= 2, "au moins 2 doigtés pour tester la navigation");

    // Lock fingering #0 (the one shown by default)
    const shape0 = await page.evaluate(() => window.app.guitarFingerings[0].map(f => f ? f.fret : null));
    await page.click('#guitar-lock-btn');
    await page.waitForTimeout(150);
    console.log('locked to shape0:', JSON.stringify(shape0));
    check(await page.evaluate(() => document.getElementById('guitar-lock-btn').classList.contains('active')), "verrouillé sur le doigté 0");

    // Now browse to fingering #1 via real click on "next" WHILE locked
    await page.click('#guitar-next');
    await page.waitForTimeout(150);
    const idxAfterNext = await page.evaluate(() => window.app.guitarFingeringIndex);
    console.log('index after next (while locked):', idxAfterNext);
    const lockStillActiveWhileBrowsing = await page.evaluate(() => document.getElementById('guitar-lock-btn').classList.contains('active'));
    console.log('lock button state while browsing a DIFFERENT (non-locked) fingering:', lockStillActiveWhileBrowsing);
    const savedLockStillShape0 = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[2].guitarLock);
    check(JSON.stringify(savedLockStillShape0) === JSON.stringify(shape0), "le verrou enregistré reste bien celui du doigté 0, même en prévisualisant un autre doigté");

    // Now click lock button WHILE browsing fingering #1 (not the locked one) -- what happens?
    const shapeAtIdx1BeforeClick = await page.evaluate(() => window.app.guitarFingerings[window.app.guitarFingeringIndex].map(f => f ? f.fret : null));
    await page.click('#guitar-lock-btn');
    await page.waitForTimeout(150);
    const lockAfterClickWhileBrowsing = await page.evaluate(() => document.getElementById('guitar-lock-btn').classList.contains('active'));
    const savedAfterClickWhileBrowsing = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[2].guitarLock);
    console.log('after clicking lock while browsing fingering#' + idxAfterNext + ' (' + JSON.stringify(shapeAtIdx1BeforeClick) + '):');
    console.log('  lock button active now:', lockAfterClickWhileBrowsing);
    console.log('  saved guitarLock now:', JSON.stringify(savedAfterClickWhileBrowsing));
    console.log('  (was previously locked to shape0=' + JSON.stringify(shape0) + ')');

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
