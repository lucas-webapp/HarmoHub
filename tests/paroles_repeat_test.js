const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
const fs = require('fs');

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

const SAMPLE = {
    version: 1, song: 'Chanson Repeat', songId: 'repeat-test-1', beatsPerBar: 4,
    sections: [{ title: 'Couplet', chords: [{ symbol: 'C', beats: 4 }, { symbol: 'G', beats: 4 }, { symbol: 'Am', beats: 4 }, { symbol: 'F', beats: 4 }] }],
};
const SAMPLE_PATH = 'sample_repeat.json';
fs.writeFileSync(SAMPLE_PATH, JSON.stringify(SAMPLE, null, 2));

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/paroles.html`);
    await page.waitForTimeout(300);
    await page.setInputFiles('#file-input', SAMPLE_PATH);
    await page.waitForTimeout(200);

    // === 1. Mesures calculées correctement (4 accords x 4 temps / 4 temps par mesure = 4 mesures) ===
    const measuresText = await page.textContent('.section-measures');
    check(measuresText.trim() === '4 mesures', `le nombre de mesures est bien calculé — obtenu "${measuresText.trim()}"`);

    // === 2. Répétition par défaut = ×1, bouton "-" désactivé ===
    let repeatValue = await page.textContent('.repeat-value');
    check(repeatValue.trim() === '× 1', `répétition par défaut ×1 — obtenu "${repeatValue.trim()}"`);
    const minusDisabled = await page.isDisabled('.repeat-btn:nth-child(1)');
    check(minusDisabled, 'le bouton "-" est désactivé à ×1 (pas de répétition négative)');

    // === 3. Cliquer "+" 3 fois -> ×4 ===
    for (let i = 0; i < 3; i++) await page.click('.repeat-btn:nth-child(3)');
    await page.waitForTimeout(100);
    repeatValue = await page.textContent('.repeat-value');
    check(repeatValue.trim() === '× 4', `3 clics sur "+" donnent bien ×4 — obtenu "${repeatValue.trim()}"`);
    const minusEnabled = !(await page.isDisabled('.repeat-btn:nth-child(1)'));
    check(minusEnabled, 'le bouton "-" est réactivé une fois au-dessus de ×1');

    // === 4. Ctrl+Z annule un cran de répétition ===
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(100);
    repeatValue = await page.textContent('.repeat-value');
    check(repeatValue.trim() === '× 3', `Ctrl+Z annule bien UN cran de répétition — obtenu "${repeatValue.trim()}"`);

    // === 5. Persistance après réimport ===
    await page.click('.repeat-btn:nth-child(3)'); // repasse à ×4
    await page.waitForTimeout(500); // laisse le temps au debounce d'enregistrer
    await page.setInputFiles('#file-input', SAMPLE_PATH);
    await page.waitForTimeout(300);
    repeatValue = await page.textContent('.repeat-value');
    check(repeatValue.trim() === '× 4', `le nombre de répétitions est bien conservé après réimport — obtenu "${repeatValue.trim()}"`);

    // === 6. Plus de case à cocher "numéro de mesure" dans les options ===
    await page.click('#btn-options');
    await page.waitForTimeout(100);
    const measureNumCheckbox = await page.$('#opt-show-measure-numbers');
    check(!measureNumCheckbox, "la case 'numéro de mesure au début de chaque ligne' a bien disparu des options");
    const noMeasureNumBadge = await page.$('.line-measure-num');
    check(!noMeasureNumBadge, 'aucun badge de numéro de mesure par ligne ne subsiste dans le DOM');

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
