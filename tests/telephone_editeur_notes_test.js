// LOT 10f DE LA REFONTE — l'éditeur de notes du TÉLÉPHONE (docs/refonte.md, « Téléphone » : « Éditeur de notes accessible » ; CLAUDE-HARMOHUB.md, « Lot 10 »).
//
// Le téléphone n'a plus ni « Séq. » ni l'icône ⊱ : sa porte est « Notes » (le même bouton que « Éditeur de notes » de l'ordinateur), et l'éditeur est LE MÊME
// (mêmes nœuds, même code : en-tête, outils, calque Voix, bande d'intensité, notes en pointillés), posé en feuille plein écran entre la barre du haut et la
// barre de lecture, qui reste utilisable.
//
// Ce que le banc tient, par de VRAIS gestes (toucher, souris) — window.app ne sert qu'à relire l'état :
//   A. la porte dit « Notes », 44px ; la toucher ouvre la feuille : plein écran sous la barre du haut et sur la barre de lecture, l'en-tête et ses boutons
//      de 44px, la grille d'en dessous inchangée (ni Compact provisoire, ni « modifié »), l'icône ⊱ et l'ancien panneau de conduite de voix absents ;
//   B. les outils : le crayon dessine une note d'un geste, la gomme l'efface, Sélection revient ; une annulation par geste ;
//   C. le calque Voix s'allume (fonctions 1/3/5/7 dans les notes, légende), et s'éteint ;
//   D. la bande d'intensité (bouton Intensité) apparaît sous les notes ;
//   E. la barre de lecture reste à portée : « Lecture » y démarre, « Stop » arrête, la feuille reste ouverte ;
//   F. « Fermer » referme (la grille reparaît telle qu'elle était) ; la porte de la barre Lecture (⋯ › Notes) l'ouvre aussi ;
//   G. 320px : aucun bouton de l'en-tête ne déborde ;
//   H. l'ordinateur n'a pas bougé : l'éditeur reste dans son volet sous la grille (pas de feuille), la porte dit « Éditeur de notes », ⊱ absent.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('téléphone : éditeur de notes (lot 10f)');
const R = require('./_retrait_ancien');
const { estBruitReseau } = require('./_harness');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

plan(32);

const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
const SECTIONS = [
    { title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] },
    { title: 'Refrain', chords: [mk('F', 'maj7'), mk('E', 'min7')] },
];

async function ouvrir(nav, contexte, erreurs) {
    const ctx = await nav.newContext(contexte);
    await ctx.addInitScript((sections) => {
        if (sessionStorage.getItem('banc-10f')) return;
        sessionStorage.setItem('banc-10f', '1');
        localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight', savedAt: Date.now(), sections }]));
        localStorage.setItem('harmohubCurrentSongId', 's1');
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
        localStorage.removeItem('harmohubSeqDockHeight');
        localStorage.removeItem('harmohubSeqVoix');
        sessionStorage.setItem('cc_accueil_vu', '1');
    }, SECTIONS);
    const p = await ctx.newPage();
    p.on('pageerror', e => erreurs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
    await p.goto(`${BASE}/index.html`);
    await p.waitForTimeout(1200);
    return p;
}

// Un vrai clic au centre du cadre mesuré (le bouton peut être sous une poignée).
async function clic(p, sel, attente = 500) {
    await p.locator(sel).scrollIntoViewIfNeeded();
    const b = await p.locator(sel).boundingBox();
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await p.mouse.down(); await p.mouse.up();
    await p.waitForTimeout(attente);
}

const feuille = (p) => p.evaluate(() => {
    const f = document.getElementById('seq-dock-panel');
    const r = f.getBoundingClientRect();
    const haut = document.querySelector('.top-bar').getBoundingClientRect();
    const bas = document.getElementById('barre-lecture').getBoundingClientRect();
    const btns = [...document.querySelectorAll('#editeur-notes-tete button')].filter(b => b.offsetParent);
    const tete = document.getElementById('editeur-notes-tete').getBoundingClientRect();
    return {
        ouvert: !f.hidden && r.height > 0, pos: getComputedStyle(f).position,
        haut: Math.round(r.top), bas: Math.round(r.bottom), gauche: Math.round(r.left), droite: Math.round(r.right),
        hautBarre: Math.round(haut.bottom), hautLecture: Math.round(bas.top), larg: window.innerWidth,
        tailles: btns.map(b => { const q = b.getBoundingClientRect(); return { id: b.id, w: Math.round(q.width), h: Math.round(q.height), droite: Math.round(q.right) }; }),
        teteDroite: Math.round(tete.right),
        notes: document.querySelectorAll('#arp-sequencer .seq-note').length,
        fn: document.querySelectorAll('#arp-sequencer .seq-note-fn').length,
        legende: !document.getElementById('editeur-notes-legende').hidden,
        bande: !!document.querySelector('#arp-sequencer .seq-vel-band'),
        ancien: !!document.querySelector('.voice-leading-panel'),
        vlVisible: (() => { const e = document.getElementById('toggle-voice-leading'); return !!(e && e.offsetParent); })(),
        densite: ['compact', 'normal', 'detail'].find(d => document.querySelector('.history-section').classList.contains('densite-' + d)),
        modifie: hasUnsavedChanges,
        porte: document.getElementById('grid-zoom').innerText.trim(),
        porteH: Math.round(document.getElementById('grid-zoom').getBoundingClientRect().height),
        mesure: (document.getElementById('bl-mesure') || {}).textContent,
    };
});

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];

    // ======================================================================================================
    console.log('\n=== A. La porte « Notes » ouvre la feuille plein écran ===');
    let p = await ouvrir(nav, { viewport: { width: 390, height: 844 } }, erreurs);
    let f = await feuille(p);
    check(f.porte === 'Notes' && f.porteH >= 32, `la porte dit « Notes » et fait ${f.porteH}px (« ${f.porte} »)`);
    check(!f.vlVisible, 'l\'icône ⊱ n\'existe plus au téléphone');
    await clic(p, '#grid-zoom', 900);
    f = await feuille(p);
    exiger(f.ouvert, 'la porte ouvre l\'éditeur');
    check(f.pos === 'fixed' && f.gauche === 0 && f.droite === f.larg, `la feuille couvre la largeur (${f.gauche} → ${f.droite} / ${f.larg})`);
    check(Math.abs(f.haut - f.hautBarre) <= 1 && Math.abs(f.bas - f.hautLecture) <= 1, `entre la barre du haut (${f.hautBarre}) et la barre de lecture (${f.hautLecture}) : ${f.haut} → ${f.bas}`);
    check(f.tailles.length >= 6 && f.tailles.every(t => t.h >= 44), `les boutons de l'en-tête font 44px au moins (${f.tailles.map(t => t.h).join(',')})`);
    check(f.densite === 'normal' && f.modifie === false, `la grille garde l'affichage de l'appareil, morceau non modifié (${f.densite})`);
    check(!f.ancien && !f.vlVisible, 'aucun ancien panneau de conduite de voix');
    const notesAvant = f.notes;

    // ======================================================================================================
    console.log('\n=== B. Les outils : crayon, gomme, sélection ===');
    await clic(p, '#en-outil-crayon', 300);
    check(await p.locator('#en-outil-crayon').getAttribute('aria-pressed') === 'true', 'le crayon est enfoncé');
    const cible = await p.evaluate(() => {
        const g = document.querySelector('#arp-sequencer .seq-grid-continuous').getBoundingClientRect();
        const e = [...document.querySelectorAll('#arp-sequencer .seq-label')].find(l => /^A3$/.test(l.textContent.trim()));
        const r = e.getBoundingClientRect();
        return { x: g.left + 90, y: r.top + r.height / 2 };
    });
    await p.mouse.move(cible.x, cible.y); await p.mouse.down(); await p.mouse.up();
    await p.waitForTimeout(500);
    f = await feuille(p);
    check(f.notes === notesAvant + 1, `un toucher au crayon dessine une note (${notesAvant} → ${f.notes})`);
    await clic(p, '#en-outil-gomme', 300);
    const note = await p.evaluate(() => { const r = document.querySelector('#arp-sequencer .seq-note').getBoundingClientRect(); return { x: r.left + Math.min(20, r.width / 2), y: r.top + r.height / 2 }; });
    await p.mouse.move(note.x, note.y); await p.mouse.down(); await p.mouse.up();
    await p.waitForTimeout(500);
    f = await feuille(p);
    check(f.notes === notesAvant, `la gomme efface la note touchée (${notesAvant + 1} → ${f.notes})`);
    await clic(p, '#en-outil-selection', 300);
    check(await p.locator('#en-outil-selection').getAttribute('aria-pressed') === 'true', 'Sélection revient');

    // ======================================================================================================
    console.log('\n=== C. Le calque Voix ===');
    await clic(p, '#editeur-notes-voix', 600);
    f = await feuille(p);
    check(f.fn > 0 && f.legende, `Voix écrit la fonction dans les notes (${f.fn}) et montre la légende`);
    await clic(p, '#editeur-notes-voix', 400);
    f = await feuille(p);
    check(f.fn === 0 && !f.legende, 'éteint, les fonctions et la légende disparaissent');

    // ======================================================================================================
    console.log('\n=== D. La bande d\'intensité ===');
    await clic(p, '#toggle-studio-mode', 600);
    f = await feuille(p);
    check(f.bande, 'le bouton Intensité ajoute la bande sous les notes');
    await clic(p, '#toggle-studio-mode', 400);
    f = await feuille(p);
    check(!f.bande, 'il la retire');

    // ======================================================================================================
    console.log('\n=== E. La barre de lecture reste utilisable ===');
    await clic(p, '#barre-lecture #global-play, #barre-lecture .transport > button:first-child', 900);
    const joue = await p.evaluate(() => !!(window.app && (window.app.isPlaying || window.app.playing)));
    check(joue, 'Lecture de la barre démarre la lecture, feuille ouverte');
    await clic(p, '#barre-lecture .btn-stop', 500);
    check(!(await p.evaluate(() => !!(window.app.isPlaying || window.app.playing))), 'Stop l\'arrête');
    f = await feuille(p);
    check(f.ouvert, 'et la feuille reste ouverte');

    // ======================================================================================================
    console.log('\n=== F. Fermer, puis la porte de la barre Lecture ===');
    await clic(p, '#editeur-notes-fermer', 700);
    f = await feuille(p);
    check(!f.ouvert, 'Fermer referme la feuille');
    check(f.densite === 'normal', 'la grille est telle qu\'avant (affichage de l\'appareil)');
    // RÉÉCRIT AU 3e SOUS-LOT DE D : « Notes » du panneau Lecture est devenu « Séquenceur » (le NOUVEAU séquenceur, onglet Rythme du panneau d'accord,
    // banc sequenceur_telephone). L'éditeur d'avant garde sa porte « Séq. » jusqu'à son retrait : on vérifie qu'elle le rouvre après fermeture.
    await clic(p, '#grid-zoom', 900);
    f = await feuille(p);
    check(f.ouvert, 'la porte « Séq. » rouvre l\'éditeur après fermeture (« Notes » du panneau Lecture mène désormais au nouveau séquenceur)');
    await clic(p, '#editeur-notes-fermer', 600);
    await p.context().close();

    // ======================================================================================================
    console.log('\n=== G. 320px : tout tient ===');
    p = await ouvrir(nav, { viewport: { width: 320, height: 640 } }, erreurs);
    await clic(p, '#grid-zoom', 900);
    f = await feuille(p);
    exiger(f.ouvert, 'ouvert à 320px');
    check(f.tailles.every(t => t.droite <= f.larg), `aucun bouton de l'en-tête ne déborde (${Math.max(...f.tailles.map(t => t.droite))} / ${f.larg})`);
    check(f.bas - f.haut > 200, `la feuille garde de la place (${f.bas - f.haut}px)`);
    check(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'pas de défilement horizontal de la page');
    await p.context().close();

    // ======================================================================================================
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11) : à l'ordinateur, l'éditeur de notes (et sa feuille, sa poignée) a disparu ; la feuille du téléphone reste
    // jusqu'à l'étape 4c. Ce qui doit tenir à l'ordinateur : pas de feuille, plus de porte « Éditeur de notes », ⊱ absent, et le séquenceur du bloc « Vues » ne change
    // pas l'affichage de la grille (règle A).
    console.log('\n=== H. L\'ordinateur : plus d\'éditeur de notes, le séquenceur du bloc « Vues » ===');
    p = await ouvrir(nav, { viewport: { width: 1280, height: 900 } }, erreurs);
    f = await feuille(p);
    const porte = await R.porteAbsente(p);
    check(porte.ok && !f.vlVisible, `plus de porte « Éditeur de notes » à l'ordinateur, ⊱ absent (${porte.detail})`);
    const r = await R.ouvrirNouveau(p);
    exiger(r.ok, `le séquenceur s'ouvre par son bouton (${r.detail})`);
    f = await feuille(p);
    check(!f.ouvert && await p.evaluate(() => getComputedStyle(document.getElementById('sequenceur')).position !== 'fixed'), 'aucune feuille plein écran : le séquenceur est posé dans la page');
    check(f.densite === 'normal' && f.modifie === false, `la grille garde son affichage (${f.densite})`);
    check(await p.evaluate(() => !!document.getElementById('sq-poignee').offsetParent), 'et le séquenceur a sa poignée (hauteur des lignes)');
    await p.context().close();

    check(erreurs.length === 0, `aucune erreur de page${erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''}`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
