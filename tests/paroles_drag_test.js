const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
const fs = require('fs');

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

const SAMPLE = {
    version: 1, song: 'Chanson Drag', songId: 'drag-test-1', beatsPerBar: 4,
    sections: [{ title: 'Couplet', chords: [{ symbol: 'C', beats: 4 }, { symbol: 'G', beats: 4 }] }],
};
const SAMPLE_PATH = 'sample_drag.json';
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

    const text = await page.$('.lyrics-text');
    await text.click();
    await page.keyboard.type('Une ligne de texte assez longue pour glisser dedans');
    await page.waitForTimeout(150);

    // Pose l'accord C vers le début de la ligne.
    const chipC = await page.$('.chord-chip:nth-child(1)');
    await chipC.click();
    await page.waitForTimeout(80);
    const box1 = await page.evaluate(() => {
        const r = document.querySelector('.lyrics-text').getBoundingClientRect();
        return { x: r.left + r.width * 0.08, y: r.top + r.height / 2 };
    });
    await page.mouse.click(box1.x, box1.y);
    await page.waitForTimeout(150);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    const posBefore = await page.evaluate(() => {
        const pill = document.querySelector('.lyric-pill');
        const r = pill.getBoundingClientRect();
        return { left: r.left, placementId: pill.dataset.placementId };
    });
    console.log('position avant glisser:', JSON.stringify(posBefore));

    // Glisse la pastille vers la droite (~70% de la largeur du texte).
    const targetBox = await page.evaluate(() => {
        const r = document.querySelector('.lyrics-text').getBoundingClientRect();
        return { x: r.left + r.width * 0.75, y: r.top + r.height / 2 };
    });
    const pillHandle = await page.$('.lyric-pill');
    const pillBox = await pillHandle.boundingBox();
    await page.mouse.move(pillBox.x + pillBox.width / 2, pillBox.y + pillBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(pillBox.x + 40, pillBox.y, { steps: 5 }); // dépasse le seuil de 6px
    await page.mouse.move(targetBox.x, targetBox.y, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    const pillCountAfterDrag = await page.$$eval('.lyric-pill', els => els.length);
    check(pillCountAfterDrag === 1, `toujours une seule pastille après le glisser (pas de doublon) — obtenu ${pillCountAfterDrag}`);

    const posAfter = await page.evaluate(() => {
        const pill = document.querySelector('.lyric-pill');
        const r = pill.getBoundingClientRect();
        return { left: r.left, placementId: pill.dataset.placementId };
    });
    console.log('position après glisser:', JSON.stringify(posAfter));
    check(posAfter.left > posBefore.left + 100, `la pastille s'est bien déplacée vers la droite — obtenu ${posBefore.left.toFixed(1)} -> ${posAfter.left.toFixed(1)}`);
    check(posAfter.placementId === posBefore.placementId, "le glisser garde le MÊME id d'emplacement (pas une suppression + recréation)");

    // Vérifie que le déplacement a bien créé une étape d'annulation.
    const undoDisabled = await page.isDisabled('#btn-undo');
    check(!undoDisabled, 'le glisser a bien créé une étape Annuler');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
    const posAfterUndo = await page.evaluate(() => {
        const pill = document.querySelector('.lyric-pill');
        const r = pill.getBoundingClientRect();
        return { left: r.left };
    });
    check(Math.abs(posAfterUndo.left - posBefore.left) < 2, `Ctrl+Z annule bien le glisser — position restaurée à ${posAfterUndo.left.toFixed(1)} (attendu ~${posBefore.left.toFixed(1)})`);
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(150);

    // Un simple CLIC (sans glisser) sur la pastille doit toujours la "ramasser" (comportement existant).
    const pillHandle2 = await page.$('.lyric-pill');
    await pillHandle2.click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(100);
    const pillCountAfterClick = await page.$$eval('.lyric-pill', els => els.length);
    check(pillCountAfterClick === 0, `un simple clic (sans glisser) continue de "ramasser" la pastille — obtenu ${pillCountAfterClick} restante(s)`);
    const armedAfterClick = await page.evaluate(() => !!state.armed);
    check(armedAfterClick, "l'accord ramassé par un simple clic est bien réarmé");

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
