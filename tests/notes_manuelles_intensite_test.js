// L'ÉDITEUR DE NOTES : NOTES MANUELLES ET BANDE D'INTENSITÉ (refonte, lot 9d), avec de vrais gestes.
// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11, « réécriture courte ») : voir le bloc ordinateur plus bas ; les parties téléphone restent jusqu'à l'étape 4c.
//
// CE QUE DEMANDE LA MAQUETTE VALIDÉE (docs/refonte.md) : « Notes ajoutées à la main en pointillés + pastille ambre sur la case + « Revenir à
// l'automatique » dans l'inspecteur. Bande d'intensité (le « mode studio » actuel) sous les notes. » Décisions du 05/11 : les barres des accords
// voisins s'affichent, pâles et non modifiables ; une croche réglée à la main passe en ambre ; les pointillés valent partout à l'ordinateur
// (éditeur, petit séquenceur de l'inspecteur, accords voisins).
//
// CE QUE LE BANC TIENT :
//   A. la porte Intensité : le bouton du mode studio, même logo, rangé après Voix, à la jauge, allumé en bleu ;
//   B. la bande collée en bas de la vue (en haut comme en bas du défilement), qui s'ajoute aux 170px de notes du réduit, « Int. » dans la
//      gouttière, les voisins pâles et sans clic, à leur vraie valeur, l'ambre d'une croche réglée ;
//   C. le glissé sur une barre : ambre aussitôt, écrit dans le morceau dès le relâchement (Ctrl+S juste après le garde), UNE annulation par
//      geste, double-clic compris ;
//   D. un clic sur la bande, entre deux barres, ne dessine rien dans la case cachée dessous ;
//   E. la barre de la note choisie est cerclée de blanc ;
//   F. une note posée à la main : pointillés, presque vide, la pastille ambre de la case en direct, les notes libres des voisins en pointillés ;
//   G. « Revenir à l'automatique » depuis l'inspecteur, éditeur ouvert : la note et la pastille s'en vont, Ctrl+Z les rend, Ctrl+Y les reprend ;
//   H. la gomme sur la note manuelle : la pastille s'éteint en direct ;
//   I. le petit séquenceur de l'inspecteur : mêmes pointillés, rangée d'intensité d'avant (ni bande, ni voisins) ;
//   J. la bande est mémorisée par appareil ;
//   K. le téléphone n'a pas bougé (lot 10) : ni pointillés, ni bande collée, « Studio » et « Mode studio » à leur place d'avant.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('éditeur de notes : notes manuelles et intensité');
const R = require('./_retrait_ancien');
const { estBruitReseau } = require('./_harness');

plan(12);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
// C (48 52 55) en cours ; F 2e renversement avec un FA4 ajouté à la main (une doublure : elle ne renomme pas l'accord) et sa première croche
// réglée à 30 % ; G7 joué à 90 % ; Cadd9.
const graine = () => {
    const mk = (r, q, octave, inversion = 0) => ({ root: r, quality: q, beats: 4, inversion, drop: 'none', octave, bass: null, playStyle: 'held' });
    const S = [{ title: 'Couplet', chords: [mk('C', 'maj', 3), mk('F', 'maj', 2, 2), mk('G', 'dom7', 2, 1), mk('C', 'add9', 3)] }];
    S[0].chords[1].extraNotes = [{ note: 'F', octave: 4 }];
    S[0].chords[1].intensityPerStep = { 0: 30 };
    S[0].chords[2].intensity = 90;
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    localStorage.removeItem('harmohubSeqDockHeight');
    localStorage.removeItem('harmohubSeqAjuster');
    localStorage.removeItem('harmohubSeqVoix');
    localStorage.removeItem('harmohubStudioMode');
    sessionStorage.setItem('cc_accueil_vu', '1');
};
const AMBRE = 'rgb(224, 179, 106)';

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport, reseme = true) => {
        const p = await nav.newPage({ viewport });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        if (reseme) await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const clic = async (p, sel, ms = 500) => { await p.click(sel); await p.waitForTimeout(ms); };
    const caseGrille = (i) => `#progression-sections .chord-grid[data-section="0"] .grid-cell[data-index="${i}"]`;
    // Amène un élément de la bande défilante sous les yeux (ce que ferait la molette), puis donne son centre.
    const centre = async (p, sel) => {
        const el = await p.$(sel);
        await el.evaluate(e => e.scrollIntoView({ block: 'center', inline: 'nearest' }));
        await p.waitForTimeout(150);
        const b = await el.boundingBox();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
    };
    const cliquerEn = async (p, pt, ms = 500) => { await p.mouse.move(pt.x, pt.y); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(ms); };
    const sauve = (p, i) => p.evaluate((i) => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[i], i);
    const pastilles = (p) => p.evaluate(() => [...document.querySelectorAll('#progression-sections .cell-perso')].map(e => +e.closest('.grid-cell').dataset.index));
    const manuelles = (p) => p.evaluate(() => [...document.querySelectorAll('#arp-sequencer .seq-note.manuelle')].map(n => ({ bord: getComputedStyle(n).borderTopStyle, fond: getComputedStyle(n).backgroundColor })));
    const bande = (p) => p.evaluate(() => {
        const sc = document.querySelector('#arp-sequencer .seq-scroll');
        const b = sc.querySelector('.seq-vel-band');
        const rs = sc.getBoundingClientRect();
        // Le bas de ce qu'on VOIT des notes : le bord de la vue, ou la fin de la grille si on est tout en bas (sous elle, la marge de la vue est vide).
        const basGrille = sc.querySelector('.seq-grid').getBoundingClientRect().bottom;
        return { present: !!b, bas: b ? Math.round(b.getBoundingClientRect().bottom) : null, basVue: Math.round(Math.min(rs.top + sc.clientTop + sc.clientHeight, basGrille)), haut: sc.clientHeight, scrollTop: sc.scrollTop, scrollMax: sc.scrollHeight - sc.clientHeight };
    });

    // ======================================================================================================
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11, « réécriture courte ») : à l'ordinateur, la bande d'intensité séparée et le mode studio comme mode à
    // part ont disparu avec l'éditeur de notes (cahier, « Ce qui disparaît ») ; leur logo est repris par le bouton Intensité du séquenceur du bloc « Vues », où un
    // clic fait tourner normal → fort → doux → enlevée. Les notes ajoutées à la main sont les NOTES LIBRES, en pointillés.
    console.log('\n=== A. Ordinateur : Intensité et notes libres au séquenceur ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    let r = await R.porteAbsente(p);
    check(r.ok, `l'éditeur de notes et sa bande d'intensité ont quitté l'ordinateur (${r.detail})`);
    r = await R.ouvrirNouveau(p);
    exiger(r.ok, `le séquenceur s'ouvre (${r.detail})`);
    check(await p.evaluate(() => document.querySelector('#sq-intensite svg').innerHTML.includes('M5 21v-6') && !document.querySelector('.seq-studio-band, #seq-intensite-bande')), 'le bouton Intensité porte le logo du mode studio ; plus de bande séparée');
    r = await R.intensite(p, 0);
    check(r.ok, `Intensité allumée, un clic passe la note en « fort » (${r.detail})`);
    r = await R.noteLibre(p);
    check(r.ok, `une note ajoutée à la main est une ligne en pointillés (${r.detail})`);
    check(await p.evaluate(() => getComputedStyle(document.querySelector('#sq-grille .sq-etiq.libre')).borderStyle.includes('dashed')), 'sa ligne est dessinée en pointillés');
    await p.close();

    // ======================================================================================================
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11, « réécriture courte ») : la feuille « Notes » du téléphone, sa bande d'intensité collée et ses notes
    // en pointillés ont disparu avec elle. Ce qui les remplace dans l'onglet Rythme : Intensité (un toucher passe la note en « fort ») et la note ajoutée à la
    // main, une ligne libre en pointillés — comme à l'ordinateur (partie A).
    console.log('\n=== K. Le téléphone : Intensité et note libre dans l\'onglet Rythme ===');
    p = await nav.newPage({ viewport: { width: 860, height: 900 }, hasTouch: true, isMobile: true });
    p.on('pageerror', e => erreurs.push(e.message));
    await p.goto(`${BASE}/index.html`); await p.evaluate(graine); await p.reload(); await p.waitForTimeout(900);
    r = await R.porteTelephoneAbsente(p, 0);
    check(r.ok, `ni « Notes » ni petit séquenceur au téléphone (${r.detail})`);
    await p.tap(caseGrille(1)); await p.waitForTimeout(400); // choisir F (un toucher), l'accord qui porte la note ajoutée à la main
    r = await R.ouvrirRythmeTel(p);
    const surF = await p.evaluate(() => [window.app._bulle.index, window.app.selectedIndex].join(','));
    exiger(r.ok && surF === '1,1', `(${surF}) ` + `« Séquenceur » du panneau Lecture ouvre l'onglet Rythme sur F (${r.detail})`);
    const libre = await p.evaluate(() => [...document.querySelectorAll('#pa-rythme #sq-grille .sq-etiq.libre')].map(e => getComputedStyle(e).borderStyle));
    check(libre.length >= 1, `la note ajoutée à la main a sa ligne (${libre.length})`);
    check(libre.every(s => s.includes('dashed')), `en pointillés (${libre.join(' ')})`);
    await p.tap('#pa-quel [data-bulle="prec"]'); await p.waitForTimeout(500); // ‹ : retour sur C, joué à intensité normale (F a sa première croche à 30 %)
    r = await R.intensiteTel(p);
    check(r.ok, `Intensité : toucher une note la passe en « fort » (${r.detail})`);
    await p.close();

    check(erreurs.length === 0, `aucune erreur dans la page (${erreurs.length}${erreurs.length ? ' : ' + erreurs.slice(0, 2).join(' | ') : ''})`);
    await nav.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
