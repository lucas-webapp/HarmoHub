// RÉÉCRIT AU RETRAIT DU CODE MORT DE L'ANCIEN SÉQUENCEUR (A2, 13/11, décision « réécriture courte » du 12/11) : il vérifiait que les boutons de zoom et de fermeture
// de la loupe « Séquenceur » (#seq-zoom-in-h … #seq-zoom-close) restaient dans la largeur d'un téléphone. La loupe a disparu avec l'ancien séquenceur. Ce que le banc
// garde : (1) la loupe et ses boutons n'existent plus ; (2) l'en-tête du séquenceur qui la remplace (l'onglet Rythme du panneau d'accord) ne déborde pas à 390 px.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('seq_zoom_header_overflow');
const { estBruitReseau } = require('./_harness');
const R = require('./_retrait_ancien');

plan(5);

(async () => {
    const browser = await chromium.launch();
    const errs = [];
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) errs.push('console: ' + m.text()); });
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.evaluate(() => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
        ] }] }));
        sessionStorage.setItem('cc_accueil_vu', '1');
    });
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(800);

    const loupe = await page.evaluate(() => ['seq-zoom-overlay', 'seq-zoom-in-h', 'seq-zoom-out-h', 'seq-zoom-in-v', 'seq-zoom-out-v', 'seq-zoom-close'].filter(id => !!document.getElementById(id)));
    check(loupe.length === 0, `la loupe du séquenceur et ses boutons de zoom n'existent plus (${loupe.join(', ') || 'aucun'})`);
    let r = await R.ouvrirRythmeTel(page);
    exiger(r.ok, `« Séquenceur » du panneau Lecture ouvre l'onglet Rythme (${r.detail})`);
    r = await R.tientTel(page);
    check(r.ok, `l'accord et ses huit croches tiennent dans la largeur, rien à zoomer (${r.detail})`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'la page ne défile pas de côté');
    check(errs.length === 0, `aucune erreur JavaScript (${errs.slice(0, 3).join(' | ') || 'rien'})`);
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
