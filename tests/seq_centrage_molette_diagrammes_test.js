// Trois défauts signalés ensemble sur la vue plein écran, et trois causes distinctes.
//
// 1. « Lorsque je sélectionne une barre dans le séquenceur, elle n'est pas du tout centrée [...] elle
//    apparaît à la base du séquenceur. » La vue continue affiche TOUJOURS les soixante demi-tons de
//    l'étendue (voir .seq-cell-free), dont la moitié seulement tient à l'écran — et scrollTop restait à
//    0, c'est-à-dire tout en haut, sur les notes les plus AIGUËS. Un accord en octave 3 se retrouvait
//    donc collé en bas de la bande. Mesuré avant correction : barre à 66 % de la hauteur, scrollTop à 0.
//    Il existait bien un centrage, mais sur le seul axe HORIZONTAL (centrerSurAccordEdite).
//
// 2. « Lorsque je scroll verticalement, le défilement se fait par à-coups et n'est pas très fluide. Sur
//    GarageBand le défilement est doux. » Ce n'était pas une animation à ajouter, c'était l'animation du
//    navigateur qu'on retirait : le gestionnaire de molette faisait preventDefault() puis
//    `scrollTop += e.deltaY`, remplaçant le défilement natif — animé, avec inertie — par un saut sec de
//    la valeur brute du cran, ~100px d'un coup. Le banc vérifie donc que l'appli NE PREND PLUS la main
//    sur l'axe vertical, et qu'une vraie molette fait bien défiler la bande (et non la page).
//
// 3. « Il y a des problèmes d'affichage des diagrammes d'accords. » Masquer le piano ne masquait que
//    #piano-viz ; sa COLONNE #piano-col restait dans la rangée flex avec sa `width: 100%` — mesuré,
//    165px de large pour 0px de haut — et poussait le diagramme de guitare jusqu'à le faire DÉBORDER de
//    sa carte (carte 1029→1273, guitare 1152→1338). Guitare seule affichée : diagramme décentré et
//    coupé à droite.
//
// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11, décision « réécriture courte ») : le centrage vertical, la molette et les diagrammes du plein écran ont disparu avec lui : le séquenceur montre toutes ses lignes et toute la partie, et suit l'accord choisi (que les diagrammes montrent). Ce que la sonde gardait n'existe plus à l'ordinateur avec
// l'éditeur de notes ; elle vérifie désormais que l'ancienne porte a disparu ET que le geste du séquenceur du bloc « Vues » qui le remplace fonctionne
// (de vrais gestes ; voir tests/_retrait_ancien.js).
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('seq_centrage_molette_diagrammes');
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
    r = await R.suitSelection(p);
    check(r.ok, `le séquenceur suit l'accord choisi dans la grille (${r.detail})`);
    r = await R.couleursRoles(p);
    check(r.ok, `les notes gardent les couleurs de leur rôle (${r.detail})`);
    check(errs.length === 0, `aucune erreur JavaScript (${errs.slice(0, 3).join(' | ') || 'rien'})`);
    await b.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
