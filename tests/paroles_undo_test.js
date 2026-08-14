const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
const fs = require('fs');

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

const SAMPLE = {
    version: 1, song: 'Chanson Undo', songId: 'undo-test-1', beatsPerBar: 4,
    sections: [{ title: 'Couplet', chords: [{ symbol: 'C', beats: 4 }, { symbol: 'G', beats: 4 }] }],
};
const SAMPLE_PATH = 'sample_undo.json';
fs.writeFileSync(SAMPLE_PATH, JSON.stringify(SAMPLE, null, 2));

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('dialog', async d => { await d.accept(); });

    await page.goto(`${BASE}/paroles.html`);
    await page.waitForTimeout(300);
    await page.setInputFiles('#file-input', SAMPLE_PATH);
    await page.waitForTimeout(200);

    // === 1. Boutons désactivés au départ ===
    check(await page.isDisabled('#btn-undo'), 'le bouton Annuler est désactivé, rien à annuler au départ');
    check(await page.isDisabled('#btn-redo'), 'le bouton Rétablir est désactivé au départ');

    // === 2. Taper du texte -> Annuler doit s'activer, puis le vider ===
    const text = await page.$('.lyrics-text');
    await text.click();
    await page.keyboard.type('Un peu de texte');
    await page.waitForTimeout(150);
    check(!(await page.isDisabled('#btn-undo')), "le bouton Annuler s'active après une frappe");

    await page.click('#btn-undo');
    await page.waitForTimeout(150);
    const textAfterUndo = await page.$eval('.lyrics-text', el => el.textContent);
    check(textAfterUndo === '', `le texte est bien vidé après Annuler — obtenu "${textAfterUndo}"`);
    check(!(await page.isDisabled('#btn-redo')), 'le bouton Rétablir est actif après un Annuler');

    // === 3. Rétablir doit ramener le texte ===
    await page.click('#btn-redo');
    await page.waitForTimeout(150);
    const textAfterRedo = await page.$eval('.lyrics-text', el => el.textContent);
    check(textAfterRedo === 'Un peu de texte', `Rétablir ramène bien le texte — obtenu "${textAfterRedo}"`);

    // === 4. Pose d'accord + Ctrl+Z (raccourci clavier) ===
    const chip1 = await page.$('.chord-chip:nth-child(1)');
    await chip1.click();
    await page.waitForTimeout(80);
    const box = await page.evaluate(() => {
        const r = document.querySelector('.lyrics-text').getBoundingClientRect();
        return { x: r.left + 10, y: r.top + r.height / 2 };
    });
    await page.mouse.click(box.x, box.y);
    await page.waitForTimeout(150);
    let pillCount = await page.$$eval('.lyric-pill', els => els.length);
    check(pillCount === 1, `un accord est bien posé — obtenu ${pillCount}`);

    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
    pillCount = await page.$$eval('.lyric-pill', els => els.length);
    check(pillCount === 0, `Ctrl+Z retire bien l'accord posé — obtenu ${pillCount}`);

    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(150);
    pillCount = await page.$$eval('.lyric-pill', els => els.length);
    check(pillCount === 1, `Ctrl+Maj+Z (rétablir) repose bien l'accord — obtenu ${pillCount}`);

    // === 5. Réarmer un accord déjà posé depuis la réserve NE le retire PLUS de sa position (mode
    // "tampon" — un même accord peut être posé plusieurs fois, voir armChord/placeArmedAt) ===
    const chipAfterPlace = await page.$('.chord-chip.placed');
    check(!!chipAfterPlace, "l'accord posé apparaît bien comme 'placed' dans la réserve");
    await chipAfterPlace.click(); // arme pour poser un exemplaire de PLUS, ne touche pas l'existant
    await page.waitForTimeout(100);
    let pillCountStillThere = await page.$$eval('.lyric-pill', els => els.length);
    check(pillCountStillThere === 1, "réarmer un accord déjà posé depuis la réserve ne retire PAS sa pastille existante");
    await page.keyboard.press('Escape'); // désarme sans avoir reposé de second exemplaire
    await page.waitForTimeout(100);

    // === 5bis. Cliquer directement sur la PASTILLE posée (pas sa croix) la "ramasse" pour la déplacer ===
    const pillBody = await page.$('.lyric-pill');
    await pillBody.click({ position: { x: 5, y: 5 } }); // évite la croix .pill-del, à droite
    await page.waitForTimeout(100);
    let pillCountArmed = await page.$$eval('.lyric-pill', els => els.length);
    check(pillCountArmed === 0, "cliquer sur la pastille posée elle-même la retire bien de sa position (ramassée)");
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
    const pillCountRecovered = await page.$$eval('.lyric-pill', els => els.length);
    check(pillCountRecovered === 1, `un seul Ctrl+Z récupère l'accord "ramassé puis abandonné" (Échap) — obtenu ${pillCountRecovered}`);

    // === 6. Réinitialiser une partie + Annuler ===
    await page.click('.btn-reset-section');
    await page.waitForTimeout(150);
    let textAfterReset = await page.$eval('.lyrics-text', el => el.textContent);
    check(textAfterReset === '', 'le texte est bien vidé après Réinitialiser');
    await page.click('#btn-undo');
    await page.waitForTimeout(150);
    const textAfterUndoReset = await page.$eval('.lyrics-text', el => el.textContent);
    check(textAfterUndoReset === 'Un peu de texte', `Annuler restaure bien le texte après un Réinitialiser — obtenu "${textAfterUndoReset}"`);
    const pillsAfterUndoReset = await page.$$eval('.lyric-pill', els => els.length);
    check(pillsAfterUndoReset === 1, "Annuler restaure aussi l'accord posé après un Réinitialiser");

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
