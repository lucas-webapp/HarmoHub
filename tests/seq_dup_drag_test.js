// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4b, 12/11, décision « réécriture courte ») : il éprouvait la DUPLICATION d'une note par Alt+glisser (fantôme calé sur la grille, un seul instantané d'annulation, chevauchement ignoré) et le déplacement d'une note par son corps.
// Le petit séquenceur de l'inspecteur, qui portait ce geste, a quitté l'ordinateur avec sa porte « Séquenceur » ; le nouveau séquenceur n'a ni déplacement ni duplication de note (« outils crayon / gomme / sélection » disparus, cahier « Ce qui disparaît ») : une note y est faite de croches soudées, qu'on peint.
// Le banc vérifie désormais que l'ancienne porte n'existe plus ET que le geste du séquenceur du bloc « Vues » qui le remplace fonctionne : un glissé PEINT plusieurs croches d'une seule annulation, un clic pose une croche et Ctrl+Z la retire.
// De vrais gestes (souris, clavier) ; window.app sert à relire l'état. Voir tests/_retrait_ancien.js.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('seq_dup_drag');
const { estBruitReseau } = require('./_harness');
const R = require('./_retrait_ancien');

plan(5);

(async () => {
    const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) errs.push('console: ' + m.text()); });
    await p.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await p.evaluate(() => {
        const mk = (r, q) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('F', 'maj7'), mk('G', '7')] }] }));
        sessionStorage.setItem('cc_accueil_vu', '1');
    });
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);

    let r = await R.porteInspecteurAbsente(p, 0, 0);
    check(r.ok, `plus de porte « Séquenceur » ni de petit séquenceur dans l'inspecteur (${r.detail})`);
    r = await R.ouvrirNouveau(p);
    exiger(r.ok, `le séquenceur du bloc « Vues » s'ouvre par son bouton (${r.detail})`);
    r = await R.peindre(p, 0);
    check(r.ok, `un glissé peint plusieurs croches, d'une seule annulation (remplace la duplication au glissé) (${r.detail})`);
    r = await R.poserCroche(p, 1);
    check(r.ok, `un clic pose une croche, Ctrl+Z la retire (remplace le déplacement d'une note) (${r.detail})`);
    check(errs.length === 0, `aucune erreur JavaScript (${errs.slice(0, 3).join(' | ') || 'rien'})`);
    await b.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
