// Ce que font le clic et le double-clic sur une case de la grille.
// CONTRAT INVERSÉ : le symbole ouvrait la retape de son texte dès le PREMIER clic. Trois gestes
// différents cohabitaient donc dans une case de 83x56px au téléphone — renommer au centre, changer
// la durée sur les bords, sélectionner dans ce qui restait — et il fallait viser pour obtenir celui
// qu'on voulait. Désormais : premier clic = sélectionner, PARTOUT ; second clic rapproché = renommer
// si l'on a visé le symbole, ouvrir le panneau sinon. Le geste fréquent est uniforme, le rare ciblé.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

// Un point de la case qui n'est NI le symbole NI une poignée de durée.
const pointNu = (page, idx) => page.evaluate((i) => {
    const c = document.querySelector(`.grid-cell[data-index="${i}"]`);
    const r = c.getBoundingClientRect();
    for (let j = 0; j < 9; j++) for (let k = 0; k < 21; k++) {
        const x = r.left + 2 + (r.width - 4) * k / 20, y = r.top + 2 + (r.height - 4) * j / 8;
        const el = document.elementFromPoint(x, y);
        if (el && String(el.className).includes('grid-cell')) return { x, y };
    }
    return null;
}, idx);
const centreSymbole = (page, idx) => page.evaluate((i) => {
    const s = document.querySelector(`.grid-cell[data-index="${i}"] .cell-sym`).getBoundingClientRect();
    return { x: s.left + s.width / 2, y: s.top + s.height / 2 };
}, idx);

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(900);
    await page.fill('#quick-add-input', 'C/Am/F');
    await page.click('#quick-add-btn');
    await page.waitForTimeout(700);

    const etat = () => page.evaluate(() => ({
        sel: window.app.selectedIndex, ed: window.app.editingIndex,
        retape: !!document.querySelector('.cell-sym-input'),
    }));

    console.log('=== 1. Le PREMIER clic fait la même chose partout : sélectionner ===');
    const sym = await centreSymbole(page, 1), nu = await pointNu(page, 1);
    await page.mouse.click(sym.x, sym.y);
    await page.waitForTimeout(500);
    let e = await etat();
    check(e.sel === 1 && !e.retape, `clic sur le SYMBOLE : sélectionne, sans ouvrir la retape (${JSON.stringify(e)})`);

    await page.evaluate(() => { window.app.selectedIndex = null; window.app.loadProgression(); });
    await page.waitForTimeout(400);
    await page.mouse.click(nu.x, nu.y);
    await page.waitForTimeout(500);
    e = await etat();
    check(e.sel === 1 && !e.retape, `clic sur une zone NUE : exactement pareil (${JSON.stringify(e)})`);

    console.log('=== 2. Le SECOND clic dépend de ce qu\'on a visé ===');
    await page.mouse.dblclick(sym.x, sym.y);
    await page.waitForTimeout(700);
    e = await etat();
    check(e.retape, 'double-clic sur le SYMBOLE : ouvre la retape du texte');
    check(e.ed === null, '...et n\'ouvre PAS le panneau au passage');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    await page.evaluate(() => { if (window.app.editingIndex != null) window.app.exitEditMode(); window.app.loadProgression(); });
    await page.waitForTimeout(400);
    const nu2 = await pointNu(page, 2);
    await page.mouse.dblclick(nu2.x, nu2.y);
    await page.waitForTimeout(700);
    e = await etat();
    check(e.ed === 2, `double-clic sur une zone NUE : ouvre le panneau (${JSON.stringify(e)})`);
    check(!e.retape, '...sans laisser de champ de retape orphelin');
    // Le séparateur « · » a disparu : l'intitulé est une PASTILLE encadrée (#accord-title-label) et
    // le symbole vit à côté (#accord-title-sym). On éprouve donc les deux morceaux séparément, ce qui
    // dit mieux ce qu'on veut vraiment — un état nommé ET un sujet nommé.
    const annonce = await page.evaluate(() => ({
        etat: (document.getElementById('accord-title-label').textContent || '').trim(),
        sujet: (document.getElementById('accord-title-sym').textContent || '').trim(),
    }));
    check(annonce.etat === 'Modifier' && annonce.sujet.length > 0,
        `et le panneau annonce bien l'état et son sujet — « ${annonce.etat} » sur « ${annonce.sujet} »`);
    // Le bouton « Fermer » du bas de colonne a été supprimé ; c'est la croix de l'en-tête du
    // panneau qui porte désormais la fin de modification (voir updateSaveButtons).
    check(await page.evaluate(() => document.getElementById('accord-close').hidden === false),
        'le bouton Fermer est visible');

    console.log('=== 3. Pendant la retape, le double-clic reste au champ ===');
    // Il y avait un rattrapage qui ouvrait le panneau au second double-clic — hérité du temps où le
    // premier clic ouvrait déjà le champ. Il volait le geste universel « double-clic = sélectionner
    // un mot » pendant qu'on tapait.
    await page.evaluate(() => { if (window.app.editingIndex != null) window.app.exitEditMode(); window.app.loadProgression(); });
    await page.waitForTimeout(400);
    const sym0 = await centreSymbole(page, 0);
    await page.mouse.dblclick(sym0.x, sym0.y);
    await page.waitForTimeout(600);
    check((await etat()).retape, 'retape ouverte');
    await page.mouse.dblclick(sym0.x, sym0.y);
    await page.waitForTimeout(600);
    e = await etat();
    check(e.retape && e.ed === null, `un double-clic DANS le champ n'ouvre pas le panneau (${JSON.stringify(e)})`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
