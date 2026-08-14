const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(600);
    await page.waitForTimeout(150);
    for (const sym of ['C', 'D', 'E']) {
        await page.fill('#quick-add-input', sym).catch(() => {});
        await page.click('#quick-add-btn').catch(() => {});
        await page.waitForTimeout(120);
    }
    const roots = async () => (await page.evaluate(() => loadProgressionSections()[0].chords.map(c => c.root)));
    console.log('accords de départ:', await roots());

    // === 1. Copie l'accord 0 (C), colle SANS resélectionner : doit atterrir à la FIN de la partie ===
    // Clique près du HAUT de la case (pas sur .cell-sym, le nom de l'accord au centre — un clic PILE
    // dessus ouvrirait l'édition inline du texte au lieu de simplement sélectionner/écouter, voir le
    // titre de la case : "cliquer le nom pour le modifier").
    const cell0 = () => page.$('.grid-cell[data-index="0"]');
    await (await cell0()).click({ position: { x: 30, y: 20 } });
    await page.waitForTimeout(150);
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(150);

    const afterCopy = await roots();
    check(afterCopy.length === 3, `aucun accord ajouté par la simple copie — obtenu ${JSON.stringify(afterCopy)}`);

    await page.keyboard.press('Control+v');
    await page.waitForTimeout(200);
    const afterPasteDefault = await roots();
    console.log('après collage SANS sélection préalable:', JSON.stringify(afterPasteDefault));
    check(afterPasteDefault.length === 4 && afterPasteDefault[3] === 'C', `collage par défaut à la FIN de la partie — obtenu ${JSON.stringify(afterPasteDefault)}`);
    check(afterPasteDefault[1] === 'D', `l'accord copié n'est PAS inséré juste derrière l'original (D reste en 2e position) — obtenu ${JSON.stringify(afterPasteDefault)}`);

    // Annule le collage pour repartir propre.
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
    check((await roots()).length === 3, 'Ctrl+Z annule bien le collage précédent');

    // === 2. Copie l'accord 0 à nouveau, sélectionne ENSUITE l'accord 1 (D), colle : doit atterrir juste derrière D ===
    await (await cell0()).click({ position: { x: 30, y: 20 } });
    await page.waitForTimeout(150);
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(150);
    const cell1 = () => page.$('.grid-cell[data-index="1"]');
    await (await cell1()).click({ position: { x: 30, y: 20 } });
    await page.waitForTimeout(150);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(200);
    const afterPasteSelected = await roots();
    console.log('après collage avec sélection de D (index1):', JSON.stringify(afterPasteSelected));
    check(afterPasteSelected.length === 4 && afterPasteSelected[2] === 'C' && afterPasteSelected[1] === 'D', `collage juste derrière l'accord sélectionné (D) — obtenu ${JSON.stringify(afterPasteSelected)}`);

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
