// #seq-play : un seul bouton, deux sens selon la vue où on le regarde.
//   - séquenceur COMPACT (dans le module Ajouter/Modifier) : joue le seul accord en cours, même si
//     une plage à boucler est définie ailleurs.
//   - séquenceur CONTINU (volet sous la grille) ou vue agrandie : joue TOUTE la plage à boucler.
// Voir seqLoopRangeActive dans renderSequencer : `!!this.loopRange && (this.seqMode === 'continu' ||
// this.seqZoomOpen)`.
//
// Ce banc appelait app.openGridZoom() + app.editChordFromGridZoom() pour atteindre la seconde
// moitié : disparues avec la vue plein écran, il mourait donc juste après avoir vérifié la première.
// Le contrat n'a pas changé — seule la vue qui l'active a changé de nom (loupe grille -> mode
// 'continu' du volet). On y rebranche, et on passe par les VRAIS boutons plutôt que par des appels
// de méthode : c'est le câblage du bouton qui est en cause ici, pas la logique qu'il appelle.
//
// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11, décision « réécriture courte ») : #seq-play et ses deux sens ont disparu (pas de Lecture propre au séquenceur, décision du 11/11) : la plage à boucler se tire dans la règle, et la barre de lecture de l'appli la joue. Ce que la sonde gardait n'existe plus à l'ordinateur avec
// l'éditeur de notes ; elle vérifie désormais que l'ancienne porte a disparu ET que le geste du séquenceur du bloc « Vues » qui le remplace fonctionne
// (de vrais gestes ; voir tests/_retrait_ancien.js).
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('seqplay_looprange');
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
    r = await R.sansLecturePropre(p);
    check(r.ok, `pas de Lecture / Stop propres au séquenceur : la barre de lecture de l'appli joue (${r.detail})`);
    r = await R.plageBoucle(p);
    check(r.ok, `la plage à boucler se tire sur la règle et se retire d'un clic (${r.detail})`);
    r = await R.teteLecture(p);
    check(r.ok, `pendant la lecture, la croche qui sonne s'allume au séquenceur (${r.detail})`);
    check(errs.length === 0, `aucune erreur JavaScript (${errs.slice(0, 3).join(' | ') || 'rien'})`);
    await b.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
