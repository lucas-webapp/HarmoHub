// Deux séquenceurs, deux usages (retour utilisateur : « le petit séquenceur de modification rapide
// affiche des notes chromatiques, ça n'était pas le but... je voulais le garder comme avant : pas de
// séquenceur continu mais seulement durée de l'accord, afficher uniquement les notes jouées... le
// séquenceur continu en grand permettra un réglage à l'échelle du morceau »).
//  - PETIT (panneau Accord)  : durée de l'accord seule, une ligne par VOIX jouée, aucun contexte ;
//  - AGRANDI (#seq-zoom)     : vue continue, demi-tons absolus, toute la partie.
//
// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11, décision « réécriture courte ») : les deux séquenceurs d'avant (petit simplifié, grand chromatique) deviennent UN séquenceur, une ligne par voix ; le petit de l'inspecteur reste jusqu'à l'étape 4b. Ce que la sonde gardait n'existe plus à l'ordinateur avec
// l'éditeur de notes ; elle vérifie désormais que l'ancienne porte a disparu ET que le geste du séquenceur du bloc « Vues » qui le remplace fonctionne
// (de vrais gestes ; voir tests/_retrait_ancien.js).
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('probe_deux_sequenceurs');
const { estBruitReseau } = require('./_harness');
const R = require('./_retrait_ancien');

plan(6);

(async () => {
    const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) errs.push('console: ' + m.text()); });
    await p.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await p.evaluate(() => {
        const mk = (r, q) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
        const c = []; for (let i = 0; i < 4; i++) c.push(mk(['C', 'A', 'F', 'G'][i % 4], i % 2 ? 'min7' : 'maj7'));
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: c }] }));
        sessionStorage.setItem('cc_accueil_vu', '1');
    });
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);

    let r = await R.porteAbsente(p);
    check(r.ok, `l'ancienne porte a disparu de l'ordinateur (${r.detail})`);
    r = await R.ouvrirNouveau(p);
    exiger(r.ok, `le séquenceur s'ouvre par son bouton du bloc « Vues » (${r.detail})`);
    r = await R.lignesParVoix(p);
    check(r.ok, `une ligne par voix, pas par demi-ton (${r.detail})`);
    r = await R.poserCroche(p, 1);
    check(r.ok, `un clic pose une croche, Ctrl+Z la retire (${r.detail})`);
    r = await R.motif(p);
    check(r.ok, `un motif (Arpège ↑) s'applique à toute la partie (${r.detail})`);
    check(errs.length === 0, `aucune erreur JavaScript (${errs.slice(0, 3).join(' | ') || 'rien'})`);
    await b.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
