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

plan(17);

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

    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11, « réécriture courte ») : la feuille plein écran « Séq. » / « Notes » du téléphone a disparu avec sa
    // porte (#grid-zoom), ses outils (crayon, gomme, sélection), son calque Voix et sa bande d'intensité. Le séquenceur du téléphone est celui de l'onglet Rythme
    // du panneau d'accord, ouvert par « Séquenceur » du panneau Lecture (banc sequenceur_telephone). Ce qui reste vérifié ici, par de vrais gestes : l'ancienne
    // porte n'existe plus, la nouvelle ouvre le séquenceur sans toucher à l'affichage de la grille, un toucher pose / enlève une croche (crayon et gomme),
    // Intensité (bande d'intensité), la barre de lecture joue sous le panneau (E), × referme (F), 320 px tient (G). Le calque Voix n'a pas de remplaçant
    // au téléphone (il a disparu le 11/11 à l'ordinateur : couleurs des rôles dans le séquenceur, vérifiées par calque_voix).
    console.log('\n=== A. Plus de feuille « Séq. » : « Séquenceur » ouvre l\'onglet Rythme ===');
    let p = await ouvrir(nav, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, erreurs);
    let r = await R.porteTelephoneAbsente(p);
    check(r.ok, `ni « Séq. » ni petit séquenceur au téléphone (${r.detail})`);
    r = await R.ouvrirRythmeTel(p);
    exiger(r.ok, `« Séquenceur » du panneau Lecture ouvre l'onglet Rythme (${r.detail})`);
    let f = await feuille(p);
    check(f.densite === 'normal' && f.modifie === false && !f.ouvert, `la grille garde l'affichage de l'appareil, morceau non modifié, pas de feuille (${f.densite})`);

    console.log('\n=== D. Intensité (remplace la bande d\'intensité) ===');
    r = await R.intensiteTel(p);
    check(r.ok, `Intensité : toucher une note la passe en « fort » (${r.detail})`);

    console.log('\n=== B. Toucher pose, retoucher enlève (remplace crayon et gomme) ===');
    r = await R.poserCrocheTel(p);
    check(r.ok, `une croche posée puis enlevée au doigt (${r.detail})`);

    console.log('\n=== E. La barre de lecture reste utilisable ===');
    r = await R.teteLectureTel(p);
    check(r.ok, `Lecture joue sous le panneau, la croche qui sonne s'allume, Stop l'éteint (${r.detail})`);

    console.log('\n=== F. × referme ===');
    r = await R.fermerRythmeTel(p);
    check(r.ok, `× referme le panneau et rend le séquenceur à sa place (${r.detail})`);
    // La GARDE des appels de programme (toggleSequencer, appelé par l'ancien code et par des bancs d'avant) : ce n'est pas un geste de l'utilisateur — aucun
    // geste n'y mène plus —, c'est le filet qui empêche l'ancien séquenceur de se rouvrir au téléphone. Appelé exprès ici, dans ses deux modes.
    const garde = [];
    for (const mode of ['continu', 'compact']) {
        await p.evaluate((m) => window.app.toggleSequencer(m), mode); await p.waitForTimeout(500);
        garde.push(await p.evaluate(() => ({ ancien: window.app.seqOpen, rythme: !!(window.app._bulle && window.app._bulle.rythme) })));
        await p.tap('#panneau-accord [data-bulle="fermer"]'); await p.waitForTimeout(400);
    }
    check(garde.every(g => !g.ancien && g.rythme), `un appel de programme n'ouvre plus l'ancien séquenceur au téléphone : il ouvre l'onglet Rythme (${JSON.stringify(garde)})`);
    await p.context().close();

    console.log('\n=== G. 320px : tout tient ===');
    p = await ouvrir(nav, { viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true }, erreurs);
    r = await R.ouvrirRythmeTel(p);
    exiger(r.ok, `ouvert à 320 px (${r.detail})`);
    // 13/11, PLEIN ÉCRAN : toute la partie est montrée et la GRILLE défile de côté ; ce qui doit tenir à 320 px, ce sont les huit croches de l'accord du panneau.
    const larg = await p.evaluate(() => { const g = document.getElementById('sq-grille'); const i = window.app._bulle.index; const cs = [...g.querySelectorAll(`.sq-case[data-r][data-c="${i}"]`)]; return { droite: Math.max(...cs.map(c => c.getBoundingClientRect().right)), page: document.documentElement.scrollWidth, n: cs.length }; });
    check(larg.n === 32 && larg.droite <= 320 && larg.page <= 320, `les huit croches de l'accord du panneau tiennent (bord droit ${Math.round(larg.droite)}, page ${larg.page})`);
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
    r = await R.ouvrirNouveau(p);
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
