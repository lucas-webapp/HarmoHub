const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) {
    if (cond) { PASS++; console.log('PASS - ' + label); }
    else { FAIL++; console.log('FAIL - ' + label); }
}

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().includes('CONNECTION') && !msg.text().includes('TUNNEL')) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            mk('C', 'maj7', 4), mk('G', 'maj', 4),
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4b, 12/11) : le petit séquenceur de l'inspecteur, où Ctrl+C / Ctrl+V copiaient le motif, a quitté l'ordinateur. Le
    // séquenceur du bloc « Vues » copie et colle le motif par ses boutons « Copier » et « Coller » (cahier, section D). Ce que le banc gardait reste vrai et est éprouvé
    // EN ENTIER, par de vrais clics : c'est le MOTIF qui se copie (croches et intensités), pas l'accord entier, et il se colle sur un autre accord.
    console.log('=== Le séquenceur du bloc Vues copie le MOTIF d\'un accord et le colle sur un autre ===');
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(200);
    const R = require('./_retrait_ancien');
    const ouvert = await R.ouvrirNouveau(page);
    check(ouvert.ok, `le séquenceur du bloc « Vues » s'ouvre par son bouton (${ouvert.detail})`);
    const noButtons = await page.evaluate(() => !document.getElementById('seq-pipette') && !document.getElementById('seq-copy-pattern') && !document.getElementById('seq-paste-pattern') && !document.getElementById('seq-paintbrush'));
    check(noButtons, 'aucun bouton pinceau / pipette de l\'ancien séquenceur');
    // Motif distinctif sur l'accord 0 : la basse seule, sur les croches 0 et 3, la première en « fort ».
    await R.cliquer(page, '#sq-grille .sq-nom[data-c="0"]');
    await R.cliquer(page, '#sq-effacer');
    const e0 = await R.lire(page, 0);
    const basse = e0.positions[0];
    for (const k of [0, 3]) await R.cliquer(page, `#sq-grille .sq-case[data-c="0"][data-v="${basse}"][data-k="${k}"]`);
    await R.cliquer(page, '#sq-intensite');
    await R.cliquer(page, `#sq-grille .sq-case[data-c="0"][data-v="${basse}"][data-k="0"]`);
    await R.cliquer(page, '#sq-intensite');
    const source = await R.lire(page, 0);
    await R.cliquer(page, '#sq-copier');
    check(await page.evaluate(() => window.app.clipboard === null || window.app.clipboard === undefined), 'Copier (séquenceur) ne touche pas au presse-papier « accord entier »');
    await R.cliquer(page, '#sq-grille .sq-nom[data-c="1"]');
    await R.cliquer(page, '#sq-coller', 400);
    const cible = await R.lire(page, 1);
    console.log(JSON.stringify({ source, cible }));
    check(source.pos[0] === '0,3' && cible.pos[0] === '0,3' && cible.pos.slice(1).every(x => x === ''), `Coller pose le motif de l'accord 0 sur l'accord 1 — « ${source.pos.join('|')} » → « ${cible.pos.join('|')} »`);
    check(/0:0=fort/.test(source.niveaux) && cible.niveaux === source.niveaux, `l'intensité par croche est collée aussi — « ${cible.niveaux} »`);
    await R.cliquer(page, '#vue-sequenceur', 300);

    console.log('=== Séquenceur FERMÉ : Ctrl+C/Ctrl+V retombent sur le comportement grille (accord entier) ===');
    await page.evaluate(() => { window.app.exitEditMode && window.app.exitEditMode(); window.app.selectChord(0, 0); });
    await page.waitForTimeout(100);
    await page.keyboard.down('Control');
    await page.keyboard.press('c');
    await page.keyboard.up('Control');
    await page.waitForTimeout(50);
    const wholeClip = await page.evaluate(() => window.app.clipboard);
    check(Array.isArray(wholeClip) && wholeClip.length === 1 && wholeClip[0].root === 'C', 'Ctrl+C séquenceur fermé copie bien tout l\'accord sélectionné (comportement grille inchangé)');

    const beforeCount = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.length);
    await page.keyboard.down('Control');
    await page.keyboard.press('v');
    await page.keyboard.up('Control');
    await page.waitForTimeout(100);
    const afterCount = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.length);
    check(afterCount === beforeCount + 1, 'Ctrl+V séquenceur fermé insère bien une copie de l\'accord entier (comportement grille inchangé)');

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
