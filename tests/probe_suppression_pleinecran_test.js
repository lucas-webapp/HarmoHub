
//
// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11, décision « réécriture courte ») : le plein écran du séquenceur et sa suppression de notes ont disparu (pas de loupe) ; on efface le rythme d'un accord par « Effacer », toute la partie restant à l'écran. Ce que la sonde gardait n'existe plus à l'ordinateur avec
// l'éditeur de notes ; elle vérifie désormais que l'ancienne porte a disparu ET que le geste du séquenceur du bloc « Vues » qui le remplace fonctionne
// (de vrais gestes ; voir tests/_retrait_ancien.js).
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('probe_suppression_pleinecran');
const { estBruitReseau } = require('./_harness');
const R = require('./_retrait_ancien');

plan(5);

(async () => {
    const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) errs.push('console: ' + m.text()); });
    await p.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await p.evaluate(() => {
        const mk = (r, q) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
        const c = []; for (let i = 0; i < 8; i++) c.push(mk(['C', 'A', 'F', 'G'][i % 4], i % 2 ? 'min7' : 'maj7'));
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: c }] }));
        sessionStorage.setItem('cc_accueil_vu', '1');
    });
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);

    let r = await R.porteAbsente(p);
    check(r.ok, `l'ancienne porte a disparu de l'ordinateur (${r.detail})`);
    r = await R.ouvrirNouveau(p);
    exiger(r.ok, `le séquenceur s'ouvre par son bouton du bloc « Vues » (${r.detail})`);
    r = await R.toutePartie(p);
    check(r.ok, `toute la partie est à l'écran, sans zoom ni défilement de côté (${r.detail})`);
    r = await R.effacerAccord(p, 1);
    check(r.ok, `Effacer vide le rythme de l'accord choisi, Ctrl+Z le rend (${r.detail})`);
    check(errs.length === 0, `aucune erreur JavaScript (${errs.slice(0, 3).join(' | ') || 'rien'})`);
    await b.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
