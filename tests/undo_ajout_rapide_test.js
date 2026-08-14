// Ctrl+Z juste après un ajout rapide.
// Le champ se vide après un ajout réussi mais garde le focus (pour enchaîner) : le garde-fou
// « on ne détourne pas les raccourcis quand l'utilisateur tape » court-circuitait alors l'annulation
// de l'appli, au profit de l'annulation de TEXTE du navigateur — sur un champ vide, donc sans le
// moindre effet. Il fallait cliquer ailleurs d'abord. Un champ vide n'a rien à annuler.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(c, l) { if (c) { PASS++; console.log('PASS - ' + l); } else { FAIL++; console.log('FAIL - ' + l); } }

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    const nb = () => page.evaluate(() => JSON.parse(localStorage.getItem('myProgression') || '{"sections":[]}')
        .sections.reduce((a, s) => a + s.chords.length, 0));

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(1000);

    console.log('\n=== A. Annuler sans avoir à cliquer ailleurs ===');
    await page.fill('#quick-add-input', 'C/Am/F/G');
    await page.click('#quick-add-btn');
    await page.waitForTimeout(800);
    check(await page.evaluate(() => document.activeElement.id === 'quick-add-input'),
        'le focus reste dans le champ après l\'ajout (c\'est voulu : on enchaîne)');
    check(await nb() === 4, '4 accords ajoutés');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(700);
    check(await nb() === 0, 'Ctrl+Z annule l\'ajout sans avoir à cliquer ailleurs d\'abord');
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(700);
    check(await nb() === 4, 'Ctrl+Maj+Z rétablit');

    console.log('\n=== B. Un champ NON vide garde l\'annulation de texte du navigateur ===');
    await page.click('#quick-add-input');
    await page.type('#quick-add-input', 'Dm7');
    await page.waitForTimeout(300);
    const avant = await nb();
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(600);
    check(await nb() === avant, 'la grille n\'est PAS touchée tant qu\'il y a du texte à annuler');
    check((await page.inputValue('#quick-add-input')) !== 'Dm7', 'c\'est bien le texte tapé qui a été annulé');

    console.log('\n=== C. Les autres raccourcis gardent leur garde-fou ===');
    await page.fill('#quick-add-input', '');
    await page.click('#quick-add-input');
    await page.keyboard.press(' ');
    await page.waitForTimeout(400);
    check((await page.inputValue('#quick-add-input')) === ' ',
        'l\'espace reste une espace dans le champ, elle ne déclenche pas la lecture');
    check(!(await page.evaluate(() => window.app.isPlaying)), 'aucune lecture démarrée par cette espace');
    await page.fill('#quick-add-input', '');

    console.log('\n=== D. Hors du champ, rien ne change ===');
    await page.mouse.click(700, 620);
    await page.waitForTimeout(400);
    const n0 = await nb();
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(700);
    check(await nb() !== n0 || n0 === 0, 'Ctrl+Z fonctionne toujours normalement hors d\'un champ');

    await browser.close();
    check(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' — ' + errs[0] : ''));
    console.log(`\n=== ${PASS} PASS / ${FAIL} FAIL ===`);
    process.exit(FAIL ? 1 : 0);
})();
