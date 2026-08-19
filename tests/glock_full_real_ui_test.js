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
    const x = box.x + box.width / 2;
    const y = box.y + box.height - 6; // avoid the centered chord-symbol text (inline-rename trap)
    await page.mouse.dblclick(x, y);
    await page.waitForTimeout(250);
}
async function clickCellSafe(page, section, index) {
    const box = await cellBox(page, section, index);
    const x = box.x + box.width / 2;
    const y = box.y + box.height - 6;
    await page.mouse.click(x, y);
    await page.waitForTimeout(250);
}

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => localStorage.removeItem('myProgression'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);

    // Enable guitar view via a REAL click (not localStorage tampering)
    const guitarWasOn = await page.evaluate(() => window.app.showGuitarViz());
    if (!guitarWasOn) {
        await page.click('#toggle-viz-guitar');
        await page.waitForTimeout(350);
    }
    check(await page.evaluate(() => window.app.showGuitarViz()), "vue guitare activée via clic réel");

    // Add 3 different chords via real UI: C maj, A min7, D7 (chosen for multiple fingering options)
    const addChord = async (root, quality) => {
        await page.selectOption('#root', root);
        await page.selectOption('#quality', quality);
        await page.waitForTimeout(100);
        await page.click('#save');
        await page.waitForTimeout(150);
    };
    await addChord('C', 'maj');
    await addChord('A', 'min7');
    await addChord('D', 'dom7');
    await page.waitForTimeout(200);

    const chordCount = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.length);
    check(chordCount === 3, "3 accords bien ajoutés (C maj, A min7, D7) — trouvé " + chordCount);

    const lockedShapes = {};

    // For each chord: real double-click to edit, cycle to a non-default fingering, lock it, close.
    for (let i = 0; i < 3; i++) {
        await dblclickCellSafe(page, 0, i);
        const editingIndex = await page.evaluate(() => window.app.editingIndex);
        const appMode = await page.evaluate(() => window.app.appMode);
        check(editingIndex === i && appMode === 'edit', `accord ${i} : double-clic réel entre bien en édition (editingIndex=${editingIndex})`);

        const nFingerings = await page.evaluate(() => window.app.guitarFingerings.length);
        console.log(`  accord ${i} : ${nFingerings} doigtés disponibles`);
        check(nFingerings > 0, `accord ${i} : au moins un doigté de guitare proposé`);

        // Cycle to fingering #1 (or last one) via a REAL click on guitar-next, if more than 1 available
        if (nFingerings > 1) {
            const navVisible = await page.isVisible('#guitar-next');
            check(navVisible, `accord ${i} : bouton "doigté suivant" visible quand plusieurs doigtés existent`);
            await page.click('#guitar-next');
            await page.waitForTimeout(120);
        }
        const idxBeforeLock = await page.evaluate(() => window.app.guitarFingeringIndex);

        // Real click on the lock button
        const lockVisible = await page.isVisible('#guitar-lock-btn');
        check(lockVisible, `accord ${i} : bouton cadenas visible`);
        await page.click('#guitar-lock-btn');
        await page.waitForTimeout(150);

        const lockActive = await page.evaluate(() => document.getElementById('guitar-lock-btn').classList.contains('active'));
        check(lockActive, `accord ${i} : bouton cadenas ACTIF juste après le clic réel`);

        const savedLock = await page.evaluate((idx) => {
            const sections = JSON.parse(localStorage.getItem('myProgression')).sections;
            return sections[0].chords[idx].guitarLock;
        }, i);
        console.log(`  accord ${i} : verrou sauvegardé =`, JSON.stringify(savedLock));
        check(!!savedLock, `accord ${i} : verrou bien écrit dans localStorage`);
        lockedShapes[i] = savedLock;

        // Close edit via real click on "Fermer"
        await page.click('#accord-close');
        await page.waitForTimeout(150);
    }

    // Now, in Ajout mode (not editing), single-click (real) each chord to preview it, and verify
    // the guitar diagram + lock button show THAT chord's own locked shape, not a stale one.
    await page.evaluate(() => { window.app.appMode = 'add'; window.app.editingIndex = null; window.app.loadProgression(); });
    await page.waitForTimeout(150);

    for (let i = 0; i < 3; i++) {
        await clickCellSafe(page, 0, i);
        await page.waitForTimeout(200);
        const shownFingering = await page.evaluate(() => {
            const f = window.app.guitarFingerings[window.app.guitarFingeringIndex];
            return f ? f.map(x => x ? x.fret : null) : null;
        });
        const btnActive = await page.evaluate(() => document.getElementById('guitar-lock-btn').classList.contains('active'));
        console.log(`  aperçu accord ${i} : montré =`, JSON.stringify(shownFingering), 'attendu =', JSON.stringify(lockedShapes[i]), 'cadenas actif =', btnActive);
        check(JSON.stringify(shownFingering) === JSON.stringify(lockedShapes[i]), `aperçu (simple clic réel) accord ${i} : montre bien SON PROPRE doigté verrouillé`);
        check(btnActive, `aperçu (simple clic réel) accord ${i} : cadenas affiché actif`);
    }

    // Reload the whole page and re-check persistence across a fresh load, again via real clicks only
    await page.reload({ waitUntil: 'load' });
    // 300ms ne suffisaient pas : l'appli finit de s'initialiser APRÈS `load` (audio, diagrammes de
    // doigté), et ce point de contrôle lisait parfois un état encore incomplet. Symptôme mesuré : le
    // MÊME code passait 33/33, puis 29/33, puis 31/33 d'un essai à l'autre — instabilité du banc, pas
    // du produit. Attente portée à un délai où les trois essais concordent.
    await page.waitForTimeout(900);
    for (let i = 0; i < 3; i++) {
        await dblclickCellSafe(page, 0, i);
        await page.waitForTimeout(150);
        const btnActive = await page.evaluate(() => document.getElementById('guitar-lock-btn').classList.contains('active'));
        const shownFingering = await page.evaluate(() => {
            const f = window.app.guitarFingerings[window.app.guitarFingeringIndex];
            return f ? f.map(x => x ? x.fret : null) : null;
        });
        check(btnActive, `après rechargement complet, accord ${i} : cadenas actif en édition`);
        check(JSON.stringify(shownFingering) === JSON.stringify(lockedShapes[i]), `après rechargement complet, accord ${i} : bon doigté affiché en édition`);
        await page.click('#accord-close');
        await page.waitForTimeout(120);
    }

    check(pageErrors.length === 0, "aucune erreur JS pendant tout le scénario — " + JSON.stringify(pageErrors));

    await page.screenshot({ path: 'glock_full_test_final.png' });

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
