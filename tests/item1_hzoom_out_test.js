// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4b, 12/11, décision « réécriture courte ») : ce banc dézoomait le petit séquenceur de l'inspecteur jusqu'à sa butée
// (#seq-zoom-out-h-inline, « should now show MORE bars/page ») et n'imprimait qu'un relevé, sans verdict. Le petit séquenceur, ses zooms et ses pages ont quitté
// l'ordinateur — « pas de zoom, pas de loupe : toute la partie tient à l'écran » (docs/refonte-sequenceur.md, section D). Il vérifie désormais, avec un verdict, que
// la porte a disparu de l'inspecteur ET que le séquenceur du bloc « Vues » montre en entier un accord long (quatre mesures, ce que le dézoom servait à voir).
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('item1_hzoom_out');
const { estBruitReseau } = require('./_harness');
const R = require('./_retrait_ancien');

plan(4);

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) errs.push('console: ' + m.text()); });
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.evaluate(() => {
        const sections = [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj7', beats: 16, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' },
        ]}];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
        sessionStorage.setItem('cc_accueil_vu', '1');
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(800);

    let r = await R.porteInspecteurAbsente(page, 0, 0);
    check(r.ok, `plus de porte « Séquenceur » ni de petit séquenceur dans l'inspecteur (${r.detail})`);
    r = await R.ouvrirNouveau(page);
    exiger(r.ok, `le séquenceur du bloc « Vues » s'ouvre par son bouton (${r.detail})`);
    r = await R.toutePartie(page);
    const croches = await page.evaluate(() => new Set([...document.querySelectorAll('#sq-grille .sq-case[data-c="0"]')].map(c => c.dataset.k)).size);
    check(r.ok && croches === 32, `l'accord de quatre mesures tient en entier à l'écran, sans zoom : ${croches} croches sur 32 (${r.detail})`);
    check(errs.length === 0, `aucune erreur JavaScript (${errs.slice(0, 3).join(' | ') || 'rien'})`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
