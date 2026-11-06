// SOUS-LOT « ÉDITEUR ET CLAVIER » (06/11) — les décisions du 05/11 sur les points ouverts des lots 8, 9c et 9d, avec de vrais gestes.
//
// CE QUE L'UTILISATEUR A DÉCIDÉ (CLAUDE-HARMOHUB.md, « Suite à faire ») :
//   (4) l'éditeur de notes SUIT la sélection : un clic sur une autre case de la grille l'y amène (avant : la case se sélectionnait, l'éditeur
//       gardait l'accord d'avant) ;
//   (5) une opération de partie (monter, dupliquer, supprimer) garde l'édition OUVERTE (avant : elle la terminait, l'éditeur montrait l'accord seul) ;
//   (7) la bande de la règle : « au plus cohérent, cela doit me faciliter l'usage » → opaque comme la bande d'intensité, verre allumé ;
//   (9) « se souvenir de mes derniers paramètres dans chaque morceau » → l'état ouvert / fermé du tiroir Clavier / Guitare est retenu PAR MORCEAU.
// Et le téléphone (< 900px) n'a pas bougé : ni l'éditeur (lot 10f), ni la mémoire du tiroir (il n'a pas de tiroir).
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable, bruit filtré (estBruitReseau).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('éditeur et clavier');
const { estBruitReseau } = require('./_harness');

plan(28);

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

    // ======================================================================================================
    console.log('\n=== A. L\'éditeur de notes suit la sélection (point 4) ===');
    let p = await ouvrir({ width: 1400, height: 900 });
    await p.click(cellule(0, 0)); await p.waitForTimeout(300);
    await p.click('#grid-zoom'); await p.waitForTimeout(900);
    let e = await edition(p);
    exiger(e.editeur && e.s === 0 && e.i === 0 && e.nom === 'Cmaj7', `l'éditeur s'ouvre sur l'accord choisi (${JSON.stringify(e)})`);
    await p.click(cellule(0, 2)); await p.waitForTimeout(500);
    e = await edition(p);
    check(e.editeur && e.s === 0 && e.i === 2 && e.nom === 'Emin7', `un clic sur une autre case de la grille y amène l'éditeur (${e.nom}, rang ${e.i})`);
    check(e.marquee === '0:2', `...et c'est elle que la grille marque « en édition » (${e.marquee})`);
    await p.click(cellule(1, 1)); await p.waitForTimeout(500);
    e = await edition(p);
    check(e.s === 1 && e.i === 1 && e.nom === 'Adom7' && e.marquee === '1:1', `une case d'une AUTRE partie aussi (${e.nom}, partie ${e.s})`);
    check(await p.evaluate(() => document.getElementById('root').value === 'A' && document.getElementById('quality').value === 'dom7'),
        'les réglages de l\'accord ouvert sont ceux de la nouvelle case (fondamentale, type)');
    await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(500);
    e = await edition(p);
    check(e.s === 1 && e.i === 0 && e.nom === 'Dmin7', `← (qui déplace la sélection) emmène aussi l'éditeur (${e.nom})`);

    // ======================================================================================================
    console.log('\n=== B. Une opération de partie garde l\'édition ouverte (point 5) ===');
    await parMenu(p, 2, 'monter');
    e = await edition(p);
    check(e.titres === 'B,A,C' && e.editeur && e.s === 0 && e.i === 0 && e.nom === 'Dmin7', `monter la partie : l'édition reste ouverte sur Dm7, à la nouvelle place de B (${JSON.stringify(e)})`);
    check(e.marquee === '0:0', `...la grille la marque toujours (${e.marquee})`);
    await parMenu(p, 1, 'dupliquer');
    e = await edition(p);
    check(e.titres === 'B,B (copie),A,C' && e.s === 1 && e.i === 0 && e.nom === 'Dmin7', `dupliquer la partie : l'édition passe sur la copie, devenue active, même accord (${JSON.stringify(e)})`);
    // Dupliquer une AUTRE partie que celle de l'accord ouvert : l'édition ne quitte pas son accord (sa partie recule d'un rang si la copie est avant).
    await p.click(cellule(3, 1)); await p.waitForTimeout(500); // Bm7, dans C
    await parMenu(p, 1, 'dupliquer');
    e = await edition(p);
    check(e.titres === 'B,B (copie),B (copie),A,C' && e.s === 4 && e.i === 1 && e.nom === 'Bmin7', `dupliquer une autre partie : l'édition reste sur Bm7, dans C repoussée d'un rang (${JSON.stringify(e)})`);
    await p.click(cellule(0, 1)); await p.waitForTimeout(500); // A7, dans B
    await parMenu(p, 1, 'supprimer');
    e = await edition(p);
    check(e.titres === 'B (copie),B (copie),A,C' && e.editeur && e.i != null && e.s === 0 && e.nom === 'Adom7', `supprimer la partie de l'accord ouvert : l'édition passe à la partie qui prend sa place, même rang (${JSON.stringify(e)})`);
    check(await p.evaluate(() => document.querySelectorAll('#arp-sequencer .seq-cell').length > 0), 'l\'éditeur montre toujours des notes à travailler');
    // Une annulation par opération : Ctrl+Z ramène la partie supprimée, et rien d'autre.
    await p.keyboard.press('Control+z'); await p.waitForTimeout(500);
    e = await edition(p);
    check(e.titres === 'B,B (copie),B (copie),A,C', `Ctrl+Z défait la suppression seule (${e.titres})`);

    console.log('\n--- Éditeur fermé : rien ne change ---');
    await p.click('#editeur-notes-fermer'); await p.waitForTimeout(500);
    await p.mouse.click(5, 450); await p.waitForTimeout(300); // à côté : l'édition se referme
    await p.click(cellule(0, 0)); await p.waitForTimeout(400);
    e = await edition(p);
    check(!e.editeur && e.i == null, `éditeur fermé, un clic sur une case ne fait que la sélectionner, comme avant (rang en édition : ${e.i})`);
    await p.close();

    // ======================================================================================================
    console.log('\n=== C. La règle de l\'éditeur est opaque, verre allumé (point 7) ===');
    p = await ouvrir({ width: 1400, height: 900 }, true);
    exiger(await p.evaluate(() => document.documentElement.getAttribute('data-glass') === '1'), 'le verre est allumé');
    await p.click(cellule(0, 0)); await p.waitForTimeout(300);
    await p.click('#grid-zoom'); await p.waitForTimeout(900);
    const fonds = await p.evaluate(() => {
        const r = document.querySelector('#arp-sequencer .seq-ruler-band');
        const b = document.querySelector('#arp-sequencer .seq-ruler-band ~ .seq-beat-label');
        return { regle: r ? getComputedStyle(r).backgroundColor : null, img: r ? getComputedStyle(r).backgroundImage : null, etiquette: b ? getComputedStyle(b).backgroundColor : null };
    });
    check(/^rgb\(\d+, \d+, \d+\)$/.test(fonds.regle || ''), `la bande de la règle est OPAQUE (${fonds.regle}) : translucide, les notes qui défilent dessous se devinaient à travers ses chiffres`);
    check(/gradient/.test(fonds.img || ''), 'elle garde son léger dégradé, comme la bande d\'intensité');
    // Rouvrir un accord JAMAIS ouvert (ici le premier de B, qui prend la place de A supprimée) écrit son motif résolu, mais ce n'est pas un geste
    // de l'utilisateur : rien ne s'empile, et le Ctrl+Z qui suit défait la suppression elle-même (avant, il ne défaisait que cette écriture).
    await parMenu(p, 1, 'supprimer');
    e = await edition(p);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(500);
    const apres = await edition(p);
    check(e.titres === 'B,C' && e.nom === 'Dmin7' && apres.titres === 'A,B,C', `accord jamais ouvert : un seul Ctrl+Z ramène la partie supprimée (${e.titres} → ${apres.titres})`);
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
    console.log('\n=== E. Le téléphone n\'a pas bougé (lot 10) ===');
    p = await ouvrir({ width: 860, height: 1000 });
    await p.click(cellule(0, 0)); await p.waitForTimeout(300);
    await p.click('#grid-zoom'); await p.waitForTimeout(900);
    const avant = await edition(p);
    await p.click(cellule(0, 2)); await p.waitForTimeout(500);
    e = await edition(p);
    check(avant.i === 0 && e.i === 0 && e.nom === 'Cmaj7', `au téléphone, « Séq. » garde l'accord d'avant quand on touche une autre case, comme avant (rang ${avant.i} puis ${e.i})`);
    await p.click('#grid-zoom'); await p.waitForTimeout(400);
    await p.click('#toggle-viz-guitar'); await p.waitForTimeout(300);
    check(await p.evaluate(() => localStorage.getItem('harmohubVuesParMorceau') === null), 'au téléphone, rien n\'est retenu par morceau (il n\'a pas de tiroir)');
    check(await p.evaluate(() => document.getElementById('vues-tiroir').hidden), '...et le tiroir n\'y apparaît pas');
    await p.close();

    check(erreurs.length === 0, 'aucune erreur (' + JSON.stringify(erreurs.slice(0, 3)) + ')');
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
