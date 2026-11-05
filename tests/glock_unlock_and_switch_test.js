const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
const { plan, check, bilan } = require('./_harness')('Cadenas : déverrouiller et changer d\'accord');

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

// Le scénario est joué DEUX FOIS (05/11, sous-lot « Bancs fiables ») : tel quel, puis « fil principal chargé ». Ce banc rougissait une fois
// sur deux à cinq, sous charge seulement — un VRAI défaut, tracé : une croche en retard de l'écoute de l'accord 1 (Tone.Draw garde sa propre
// file, que stopAll ne vidait pas) passait par le verrou vivant juste après l'ouverture de l'accord 0 et effaçait son cadenas. Corrigé dans
// schedulePlayback (génération de lecture). La seconde passe retarde chaque image de 150ms (requestAnimationFrame différé, comme sur un
// appareil occupé) : la croche en retard y arrive À COUP SÛR — sans la correction, 4 FAIL trois fois sur trois ; le défaut ne dépend plus du
// hasard de la charge pour se montrer.
async function scenario(browser, retardImages) {
    const tag = retardImages ? '[images retardées] ' : '';
    // LOT 6c : sur ordinateur (≥ 900px), il n'y a plus de mode Ajout ni de carte Accord à préparer — QUEL accord se règle dans la bulle, COMMENT il
    // sonne dans l'inspecteur, qui n'existe qu'en modification. Ce banc éprouve une FONCTION de la carte (le même code), pas sa mise en page :
    // il se joue donc sous le seuil (860px), où la carte garde son mode Ajout jusqu'au lot 10. DETTE : à reprendre au lot 10 (docs/dette-tests.md).
    const page = await browser.newPage({ viewport: { width: 860, height: 950 } });
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
    if (retardImages) await page.addInitScript((d) => {
        const raf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (cb) => raf(() => setTimeout(() => cb(performance.now()), d));
    }, retardImages);

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

    // Lock chord 0
    await dblclickCellSafe(page, 0, 0);
    await page.click('#guitar-next');
    await page.waitForTimeout(120);
    await page.click('#guitar-lock-btn');
    await page.waitForTimeout(150);
    const lockedShape0 = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[0].guitarLock);
    check(!!lockedShape0, tag + "accord 0 verrouillé");

    // Switch (real single click, sticky edit mode off -> use double click again) directly to chord 1, edit and preview it WITHOUT locking
    await page.click('#accord-close');
    await page.waitForTimeout(150);
    await dblclickCellSafe(page, 0, 1);
    await page.waitForTimeout(150);
    const lockedAtChord1 = await page.evaluate(() => document.getElementById('guitar-lock-btn').classList.contains('active'));
    check(!lockedAtChord1, tag + "accord 1 (jamais verrouillé) montre bien le cadenas OUVERT en édition");

    // Go back to chord 0, verify STILL locked (survives the round trip through chord 1 + all the autoplay/stopAll churn)
    await page.click('#accord-close');
    await page.waitForTimeout(150);
    await dblclickCellSafe(page, 0, 0);
    await page.waitForTimeout(150);
    const stillLocked0 = await page.evaluate(() => document.getElementById('guitar-lock-btn').classList.contains('active'));
    check(stillLocked0, tag + "accord 0 : toujours verrouillé après un aller-retour par l'accord 1 (avec lecture automatique)");
    const shown0 = await page.evaluate(() => window.app.guitarFingerings[window.app.guitarFingeringIndex].map(f => f ? f.fret : null));
    check(JSON.stringify(shown0) === JSON.stringify(lockedShape0), tag + "accord 0 : bon doigté toujours affiché après l'aller-retour");

    // Now UNLOCK it via a real click, verify it clears and persists as unlocked
    await page.click('#guitar-lock-btn');
    await page.waitForTimeout(150);
    const nowUnlockedBtn = await page.evaluate(() => document.getElementById('guitar-lock-btn').classList.contains('active'));
    check(!nowUnlockedBtn, tag + "accord 0 : bouton cadenas repasse bien à OUVERT après un second clic (déverrouillage)");
    const savedAfterUnlock = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[0].guitarLock);
    check(savedAfterUnlock === null, tag + "accord 0 : guitarLock bien remis à null dans le stockage après déverrouillage");

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
    check(!staysUnlocked, tag + "accord 0 : reste bien déverrouillé après d'autres allers-retours (ne ressuscite pas)");

    await page.close();
}

(async () => {
    plan(14);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    await scenario(browser, 0);
    await scenario(browser, 150);
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
