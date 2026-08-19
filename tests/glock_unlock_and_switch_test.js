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
async function clickCellSafe(page, section, index) {
    const box = await cellBox(page, section, index);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 6);
    await page.waitForTimeout(250);
}

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => localStorage.removeItem('myProgression'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);
    if (!(await page.evaluate(() => window.app.showGuitarViz()))) { await page.click('#toggle-viz-guitar'); await page.waitForTimeout(150); }

    const addChord = async (root, quality) => {
        await page.selectOption('#root', root);
        await page.selectOption('#quality', quality);
        await page.waitForTimeout(80);
        await page.click('#save');
        await page.waitForTimeout(150);
    };
    await addChord('C', 'maj');
    await addChord('G', 'maj7');

    // Lock chord 0 — flèches/cadenas vivent maintenant dans la fenêtre d'édition manuelle (voir
    // #guitar-edit-btn).
    await dblclickCellSafe(page, 0, 0);
    await page.click('#guitar-edit-btn');
    await page.waitForTimeout(120);
    await page.click('#guitar-next');
    await page.waitForTimeout(120);
    await page.click('#guitar-lock-btn');
    await page.waitForTimeout(150);
    const lockedShape0 = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[0].guitarLock);
    check(!!lockedShape0, "accord 0 verrouillé");

    // Referme la fenêtre d'édition manuelle (fenêtre modale : "Fermer" du panneau, juste en dessous,
    // n'est pas cliquable tant qu'elle reste ouverte).
    await page.click('#guitar-edit-close');
    await page.waitForTimeout(120);

    // Switch (real single click, sticky edit mode off -> use double click again) directly to chord 1, edit and preview it WITHOUT locking
    await page.click('#accord-close');
    await page.waitForTimeout(150);
    await dblclickCellSafe(page, 0, 1);
    await page.waitForTimeout(150);
    const lockedAtChord1 = await page.evaluate(() => document.getElementById('guitar-lock-btn').classList.contains('active'));
    check(!lockedAtChord1, "accord 1 (jamais verrouillé) montre bien le cadenas OUVERT en édition");

    // Go back to chord 0, verify STILL locked (survives the round trip through chord 1 + all the autoplay/stopAll churn)
    await page.click('#accord-close');
    await page.waitForTimeout(150);
    await dblclickCellSafe(page, 0, 0);
    await page.waitForTimeout(150);
    const stillLocked0 = await page.evaluate(() => document.getElementById('guitar-lock-btn').classList.contains('active'));
    check(stillLocked0, "accord 0 : toujours verrouillé après un aller-retour par l'accord 1 (avec lecture automatique)");
    const shown0 = await page.evaluate(() => window.app.guitarFingerings[window.app.guitarFingeringIndex].map(f => f ? f.fret : null));
    check(JSON.stringify(shown0) === JSON.stringify(lockedShape0), "accord 0 : bon doigté toujours affiché après l'aller-retour");

    // Now UNLOCK it via a real click, verify it clears and persists as unlocked
    await page.click('#guitar-edit-btn');
    await page.waitForTimeout(120);
    await page.click('#guitar-lock-btn');
    await page.waitForTimeout(150);
    const nowUnlockedBtn = await page.evaluate(() => document.getElementById('guitar-lock-btn').classList.contains('active'));
    check(!nowUnlockedBtn, "accord 0 : bouton cadenas repasse bien à OUVERT après un second clic (déverrouillage)");
    const savedAfterUnlock = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[0].guitarLock);
    check(savedAfterUnlock === null, "accord 0 : guitarLock bien remis à null dans le stockage après déverrouillage");
    await page.click('#guitar-edit-close');
    await page.waitForTimeout(120);

    // Close, click elsewhere, come back: should STAY unlocked (not resurrect)
    await page.click('#accord-close');
    await page.waitForTimeout(150);
    await dblclickCellSafe(page, 0, 1);
    await page.waitForTimeout(150);
    await page.click('#accord-close');
    await page.waitForTimeout(150);
    await dblclickCellSafe(page, 0, 0);
    await page.waitForTimeout(150);
    const staysUnlocked = await page.evaluate(() => document.getElementById('guitar-lock-btn').classList.contains('active'));
    check(!staysUnlocked, "accord 0 : reste bien déverrouillé après d'autres allers-retours (ne ressuscite pas)");

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
