// SOUS-LOT « ÉDITEUR ET CLAVIER » (06/11) — les décisions du 05/11 sur les points ouverts des lots 8, 9c et 9d, avec de vrais gestes.
//
// CE QUE L'UTILISATEUR A DÉCIDÉ (CLAUDE-HARMOHUB.md, « Suite à faire ») :
//   (4) l'éditeur de notes SUIT la sélection : un clic sur une autre case de la grille l'y amène (avant : la case se sélectionnait, l'éditeur
//       gardait l'accord d'avant) ;
//   (5) une opération de partie (monter, dupliquer, supprimer) garde l'édition OUVERTE (avant : elle la terminait, l'éditeur montrait l'accord seul) ;
//   (7) la bande de la règle : « au plus cohérent, cela doit me faciliter l'usage » → opaque comme la bande d'intensité, verre allumé ;
//   (9) « se souvenir de mes derniers paramètres dans chaque morceau » → l'état ouvert / fermé du tiroir Clavier / Guitare est retenu PAR MORCEAU.
// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11) : A, B, C valent pour le séquenceur du bloc « Vues » (l'éditeur de notes a quitté l'ordinateur).
// Et le téléphone (< 900px) n'a pas bougé : ni l'éditeur (lot 10f), ni la mémoire du tiroir (il n'a pas de tiroir).
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable, bruit filtré (estBruitReseau).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('éditeur et clavier');
const { estBruitReseau } = require('./_harness');
const R = require('./_retrait_ancien');

plan(23);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = (verre) => {
    const mk = (r, q) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' });
    const S1 = [
        { title: 'A', chords: [mk('C', 'maj7'), mk('G', 'dom7'), mk('E', 'min7')] },
        { title: 'B', chords: [mk('D', 'min7'), mk('A', 'dom7')] },
        { title: 'C', chords: [mk('F', 'maj7'), mk('B', 'min7')] },
    ];
    const S2 = [{ title: 'Refrain', chords: [mk('A', 'min7'), mk('D', 'dom7')] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([
        { id: 's1', name: 'Premier', savedAt: Date.now(), sections: S1 },
        { id: 's2', name: 'Second', savedAt: Date.now(), sections: S2 },
    ]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S1 }));
    localStorage.removeItem('harmohubVuesParMorceau');
    localStorage.removeItem('harmohubShowGuitar');
    localStorage.removeItem('harmohubShowPiano');
    localStorage.removeItem('harmohubSeqVoix');
    if (verre) localStorage.setItem('harmohub.glass.v1', '1'); else localStorage.removeItem('harmohub.glass.v1');
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport, verre = false) => {
        const p = await nav.newPage({ viewport });
        p.on('dialog', d => d.accept()); // « Supprimer « B » et ses 2 accord(s) ? »
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html?nocache=${Date.now()}`, { waitUntil: 'load' });
        await p.evaluate(graine, verre);
        await p.reload({ waitUntil: 'load' });
        await p.waitForTimeout(900);
        return p;
    };
    const cellule = (s, i) => `#progression-sections .grid-cell[data-section="${s}"][data-index="${i}"]`;
    // Ce que l'éditeur travaille : l'accord ouvert (partie, rang, nom), la case marquée « en édition » dans la grille, et l'éditeur lui-même.
    const edition = (p) => p.evaluate(() => {
        const a = window.app;
        const sec = loadProgressionSections()[a.activeSection];
        const d = sec && a.editingIndex != null ? sec.chords[a.editingIndex] : null;
        const marquee = document.querySelector('#progression-sections .grid-cell.editing');
        return {
            s: a.activeSection, i: a.editingIndex, nom: d ? d.root + d.quality : null,
            marquee: marquee ? `${marquee.dataset.section}:${marquee.dataset.index}` : null,
            editeur: !!a._editeurNotesActif && !!document.querySelector('#arp-sequencer .seq-grid-continuous'),
            titres: loadProgressionSections().map(x => x.title).join(','),
        };
    });
    const parMenu = async (p, n, action) => {
        await p.click(`.prog-section:nth-child(${n}) .prog-section-menu`); await p.waitForTimeout(150);
        await p.click(`#partie-menu [data-partie-action="${action}"]`); await p.waitForTimeout(500);
    };

    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11) : « Éditeur de notes » n'existe plus à l'ordinateur. Les points 4, 5 et 7 valent pour le séquenceur du
    // bloc « Vues », qui ne met aucun accord en modification : il montre la partie de l'accord choisi et suit la sélection (4), suit la partie déplacée, dupliquée
    // ou supprimée (5), et sa barre d'outils reste opaque verre allumé (7).
    // Ce que montre le séquenceur : les accords de la partie (noms de la règle, dans l'ordre) et l'accord choisi ; et ce que le morceau en dit.
    const sq = (p) => p.evaluate(() => {
        const a = window.app, sec = loadProgressionSections()[a.activeSection];
        const n = document.querySelector('#sq-grille .sq-nom.choisi');
        return {
            noms: [...document.querySelectorAll('#sq-grille .sq-nom')].map(x => x.firstChild.textContent.trim()).join(' '),
            choisi: n ? +n.dataset.c : null, s: a.activeSection, sel: a.selectedIndex, edition: a.editingIndex,
            titres: loadProgressionSections().map(x => x.title).join(','), partie: sec ? sec.title : null,
        };
    });
    console.log('\n=== A. Le séquenceur suit la sélection (point 4) ===');
    let p = await ouvrir({ width: 1400, height: 900 });
    let r = await R.porteAbsente(p);
    check(r.ok, `l'éditeur de notes n'a plus de porte à l'ordinateur (${r.detail})`);
    await p.click(cellule(0, 0)); await p.waitForTimeout(300);
    r = await R.ouvrirNouveau(p);
    exiger(r.ok, `le séquenceur s'ouvre par son bouton du bloc « Vues » (${r.detail})`);
    let e = await sq(p);
    check(e.noms === 'Cmaj7 G7 Em7' && e.choisi === 0 && e.edition == null, `il montre la partie de l'accord choisi, sans le mettre en modification (${JSON.stringify(e)})`);
    await p.click(cellule(0, 2)); await p.waitForTimeout(500);
    e = await sq(p);
    check(e.choisi === 2, `un clic sur une autre case de la grille l'y amène (accord ${e.choisi})`);
    await p.click(cellule(1, 1)); await p.waitForTimeout(500);
    e = await sq(p);
    check(e.noms === 'Dm7 A7' && e.choisi === 1, `une case d'une AUTRE partie : il montre cette partie et choisit l'accord (${e.noms}, ${e.choisi})`);
    await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(500);
    e = await sq(p);
    check(e.noms === 'Dm7 A7' && e.choisi === 0, `← (qui déplace la sélection) l'emmène aussi (${e.choisi})`);

    // ======================================================================================================
    console.log('\n=== B. Une opération de partie : le séquenceur suit la partie (point 5) ===');
    await parMenu(p, 2, 'monter');
    e = await sq(p);
    check(e.titres === 'B,A,C' && e.partie === 'B' && e.noms === 'Dm7 A7' && e.choisi === 0, `monter la partie : il montre toujours B, à sa nouvelle place, Dm7 choisi (${JSON.stringify(e)})`);
    await parMenu(p, 1, 'supprimer');
    e = await sq(p);
    const ACCORDS = { A: 'Cmaj7 G7 Em7', B: 'Dm7 A7', C: 'Fmaj7 Bm7' };
    check(e.titres === 'A,C' && e.noms === ACCORDS[e.partie], `supprimer la partie montrée : il passe à la partie qui prend sa place, rien de périmé (${JSON.stringify(e)})`);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(500);
    e = await sq(p);
    check(e.titres === 'B,A,C' && e.noms === ACCORDS[e.partie], `Ctrl+Z ramène la partie supprimée, d'une seule annulation, et le séquenceur montre la partie active (${e.titres}, ${e.partie} : ${e.noms})`);
    await R.cliquer(p, '#sq-fermer', 400);
    await p.click(cellule(0, 0)); await p.waitForTimeout(400);
    e = await sq(p);
    check(e.edition == null && await p.evaluate(() => document.getElementById('sequenceur').hidden), `séquenceur fermé, un clic sur une case ne fait que la sélectionner (en modification : ${e.edition})`);
    await p.close();

    // ======================================================================================================
    console.log('\n=== C. La barre d\'outils du séquenceur est opaque, verre allumé (point 7) ===');
    p = await ouvrir({ width: 1400, height: 900 }, true);
    exiger(await p.evaluate(() => document.documentElement.getAttribute('data-glass') === '1'), 'le verre est allumé');
    await p.click(cellule(0, 0)); await p.waitForTimeout(300);
    r = await R.ouvrirNouveau(p);
    exiger(r.ok, `séquenceur ouvert (${r.detail})`);
    const fond = await p.evaluate(() => getComputedStyle(document.querySelector('#sequenceur .sq-outils')).backgroundColor);
    check(/^rgb\(\d+, \d+, \d+\)$/.test(fond), `la barre d'outils, collée en haut quand il défile, est OPAQUE (${fond}) : les notes qui passent dessous ne traversent pas ses boutons`);
    await p.close();

    // ======================================================================================================
    console.log('\n=== D. Le tiroir Clavier / Guitare se souvient de chaque morceau (point 9) ===');
    p = await ouvrir({ width: 1400, height: 900 });
    const tiroir = () => p.evaluate(() => ({ ouvert: !document.getElementById('vues-tiroir').hidden, piano: window.app.showPianoViz(), guitare: window.app.showGuitarViz(), id: getCurrentSongId() }));
    const ouvrirMorceau = async (id) => { await p.click('#tb-titre'); await p.waitForTimeout(150); await p.click(`#tb-menu .tb-mi-morceau[data-song-id="${id}"]`); await p.waitForTimeout(600); };
    let t = await tiroir();
    exiger(t.id === 's1' && t.ouvert && t.piano && !t.guitare, `au départ, le clavier seul, morceau « Premier » (${JSON.stringify(t)})`);
    await p.click('#toggle-viz-guitar'); await p.waitForTimeout(300);
    await ouvrirMorceau('s2');
    t = await tiroir();
    check(t.id === 's2' && t.ouvert && t.piano && t.guitare, `un morceau jamais réglé garde l'état du moment (${JSON.stringify(t)})`);
    await p.click('#vues-fermer'); await p.waitForTimeout(300);
    await ouvrirMorceau('s1');
    t = await tiroir();
    check(t.id === 's1' && t.ouvert && t.piano && t.guitare, `retour à « Premier » : clavier ET guitare, comme on les y avait laissés (${JSON.stringify(t)})`);
    await ouvrirMorceau('s2');
    t = await tiroir();
    check(t.id === 's2' && !t.ouvert, `retour à « Second » : tiroir fermé, comme on l'y avait laissé (${JSON.stringify(t)})`);
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(900);
    await ouvrirMorceau('s1');
    t = await tiroir();
    check(t.ouvert && t.piano && t.guitare, `après un rechargement de la page aussi (${JSON.stringify(t)})`);
    check(await p.evaluate(() => !/vues|showPiano|showGuitar/i.test(localStorage.getItem('harmohubSongs'))), 'les morceaux enregistrés n\'ont pas changé d\'un octet : la mémoire est une table de l\'appareil');
    await p.close();

    // ======================================================================================================
    console.log('\n=== E. Le téléphone : l\'éditeur y est une feuille, le tiroir n\'y est pas (lot 10f) ===');
    p = await ouvrir({ width: 860, height: 1000 });
    await p.click(cellule(0, 0)); await p.waitForTimeout(300);
    await p.click('#grid-zoom'); await p.waitForTimeout(900);
    const avant = await edition(p);
    // La feuille recouvre la grille : on change d'accord par la zone de l'accord voisin, dans l'éditeur (le geste de l'éditeur, comme à l'ordinateur).
    const zone = await p.locator('#arp-sequencer .seq-ctx-nav[data-target-index="1"]').boundingBox();
    await p.mouse.click(zone.x + 8, zone.y + 8); await p.waitForTimeout(600);
    e = await edition(p);
    check(avant.i === 0 && e.i === 1 && e.nom === 'Gdom7', `au téléphone, la zone de l'accord voisin amène l'éditeur dessus (rang ${avant.i} puis ${e.i}, ${e.nom})`);
    await p.click('#editeur-notes-fermer'); await p.waitForTimeout(400);
    await p.click('#toggle-viz-guitar'); await p.waitForTimeout(300);
    check(await p.evaluate(() => localStorage.getItem('harmohubVuesParMorceau') === null), 'au téléphone, rien n\'est retenu par morceau (il n\'a pas de tiroir)');
    check(await p.evaluate(() => document.getElementById('vues-tiroir').hidden), '...et le tiroir n\'y apparaît pas');
    await p.close();

    check(erreurs.length === 0, 'aucune erreur (' + JSON.stringify(erreurs.slice(0, 3)) + ')');
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
