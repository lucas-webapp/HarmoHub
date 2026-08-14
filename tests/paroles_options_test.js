const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
const fs = require('fs');

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

const SAMPLE = {
    version: 1, song: 'Chanson Options', songId: 'opts-test-1', beatsPerBar: 4,
    sections: [{ title: 'Couplet', chords: [
        { symbol: 'C', beats: 4 }, { symbol: 'G', beats: 4 }, { symbol: 'Am', beats: 4 }, { symbol: 'F', beats: 4 },
    ] }],
};
const SAMPLE_PATH = 'sample_options.json';
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

    // === 1. Panneau d'options replié par défaut, s'ouvre au clic ===
    check(await page.isHidden('#options-panel'), "le panneau d'options est replié par défaut");
    await page.click('#btn-options');
    await page.waitForTimeout(100);
    check(await page.isVisible('#options-panel'), "le panneau d'options s'ouvre au clic sur ⚙ Options");

    // === 2. Taille de police : change la valeur, vérifie l'effet réel sur le texte ===
    const text = await page.$('.lyrics-text');
    await text.click();
    await page.keyboard.type('Ligne de test pour la police');
    await page.waitForTimeout(150);
    const fsBefore = await page.$eval('.lyrics-text', el => parseFloat(getComputedStyle(el).fontSize));
    await page.fill('#opt-font-size', '1.5');
    await page.dispatchEvent('#opt-font-size', 'input');
    await page.waitForTimeout(150);
    const fsAfter = await page.$eval('.lyrics-text', el => parseFloat(getComputedStyle(el).fontSize));
    console.log('font-size avant/après:', fsBefore, fsAfter);
    check(fsAfter > fsBefore, `la taille de police augmente bien après réglage — obtenu ${fsBefore} -> ${fsAfter}`);
    const valueLabel = await page.textContent('#opt-font-size-value');
    check(valueLabel === '150%', `le libellé affiche bien "150%" — obtenu "${valueLabel}"`);

    // === 3. Persistance de la préférence de police après rechargement (globale, pas liée au morceau) ===
    await page.reload();
    await page.waitForTimeout(300);
    const fsAfterReload = await page.$eval('#opt-font-size', el => el.value);
    check(fsAfterReload === '1.5', `la préférence de taille de police persiste après rechargement — obtenu ${fsAfterReload}`);

    // Réimporte (la page s'est rechargée, plus de morceau ouvert) pour la suite du test.
    await page.setInputFiles('#file-input', SAMPLE_PATH);
    await page.waitForTimeout(200);
    await (await page.$('.lyrics-text')).click();
    await page.keyboard.type('Premiere ligne');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Deuxieme ligne');
    await page.waitForTimeout(150);

    // === 4. Le numéro de mesure par ligne a été retiré (retour utilisateur) : plus de case ni de badge ===
    check(!(await page.$('#opt-show-measure-numbers')), "la case 'numéro de mesure au début de chaque ligne' n'existe plus");
    check(!(await page.$('.line-measure-num')), 'aucun badge de numéro de mesure par ligne ne subsiste');

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
