const { chromium } = require('playwright')
const { ajouterAccord } = require('./_ajout');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
const { plan, check, bilan } = require('./_harness')('Cadenas : ajouter puis ouvrir un accord');

// 05/11 (sous-lot « Bancs fiables ») : cette sonde ne vérifiait rien (« sans verdict » à chaque relevé) et, depuis le lot 6c, plantait à
// l'ordinateur sur « Ajouter » (#save), masqué hors du mode Ajout du téléphone. Jouée sous le seuil (860px), là où la carte garde ce mode
// jusqu'au lot 10, elle vérifie désormais ce qu'elle préparait : l'accord ajouté au vrai clic, puis le double-clic qui l'ouvre, cadenas en vue.
(async () => {
    plan(2);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 860, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        localStorage.setItem('harmohubShowGuitar', '1');
        localStorage.removeItem('myProgression');
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);

    // Add a chord via real UI click, then double-click the grid cell to edit it
    await ajouterAccord(page, 'C'); // lot 10e : le geste d'ajout (la saisie), plus le bouton « Ajouter » de la carte
    await page.waitForTimeout(200);

    const cases = await page.evaluate(() => document.querySelectorAll('#progression-sections .grid-cell[data-index]').length);
    check(cases === 1, `« Ajouter » pose un accord dans la grille (${cases} case)`);

    // Double-clic sur le bas de la case (le centre porte le symbole) : l'accord s'ouvre en modification, le cadenas de la guitare en vue.
    const box = await page.locator('#progression-sections .grid-cell[data-index="0"]').boundingBox();
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height - 6);
    await page.waitForTimeout(450);
    // Point B de la refonte du séquenceur : le double-clic ouvre le panneau d'accord ; « Réglages du son » l'agrandit, c'est la Modification.
    await page.click('#pa-son-btn');
    await page.waitForTimeout(400);
    const ouvert = await page.evaluate(() => {
        const b = document.getElementById('guitar-lock-btn'); const r = b && b.getBoundingClientRect();
        return { ed: window.app.editingIndex, cadenas: !!r && r.width > 0 && r.height > 0 };
    });
    check(ouvert.ed === 0 && ouvert.cadenas, `le double-clic puis « Réglages du son » ouvrent l'accord, cadenas visible (édition ${ouvert.ed}, cadenas ${ouvert.cadenas})`);
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
