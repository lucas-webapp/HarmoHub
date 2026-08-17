// La conduite de voix et le séquenceur partagent la même zone : ouvrir l'un ferme l'autre.
// Retour utilisateur d'origine : « lorsque j'active le mode loupe+séquenceur, les barres du voice
// leading restent affichées et je ne peux pas l'enlever ». Deux causes, mesurées à l'époque : le
// panneau vivait DANS #progression-sections, déplacé en entier dans la loupe plein écran, donc il
// suivait la grille sans qu'on l'ait demandé ; et le bouton #toggle-voice-leading se retrouvait
// derrière l'en-tête de cette loupe, impossible à recliquer.
//
// CONTRAT MIS À JOUR (deux fois, d'où ce préambule un peu long).
// 1. La loupe plein écran n'existe plus : c'est le VOLET du séquenceur continu, ancré sous la grille,
//    qui a pris sa place (#grid-zoom -> toggleSequencer('continu')). gridZoomOpen a disparu avec
//    elle ; l'état se lit désormais sur seqMode.
// 2. Le choix « on MASQUE sans éteindre, le réglage survit à l'aller-retour » a été abandonné. Les
//    deux panneaux s'ÉTEIGNENT mutuellement, et c'est écrit dans le code des deux côtés :
//    toggleSequencer fait `voiceLeadingOpen = false`, toggleVoiceLeadingPanel referme le séquenceur.
//    Ce banc réclamait encore l'ancien comportement — il exigeait donc de l'appli quelque chose
//    qu'elle avait délibérément cessé de faire. Les sections B, D et E ont été réécrites sur le
//    contrat réel, et vérifiées (13/13).
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police vient de Google Fonts, injoignable derrière le proxy du bac à sable : bruit filtré.

let PASS = 0, FAIL = 0;
function check(c, l) { if (c) { PASS++; console.log('PASS - ' + l); } else { FAIL++; console.log('FAIL - ' + l); } }

const mk = (root, q) => ({ root, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} });

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|fonts\.googleapis|fonts\.gstatic/.test(m.text())) errs.push('console: ' + m.text()); });

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(500);
    await page.evaluate((s) => {
        const mk = eval('(' + s + ')');
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet',
            chords: [mk('C', 'maj'), mk('A', 'min7'), mk('F', 'maj7'), mk('G', 'dom7')] }] }));
    }, mk.toString());
    await page.reload();
    await page.waitForTimeout(900);

    const vue = () => page.evaluate(() => {
        const vl = document.querySelector('.voice-leading-panel');
        return {
            reglageActif: window.app.voiceLeadingOpen,
            // gridZoomOpen a disparu avec la vue plein écran de la grille : le volet continu, qui
            // l'a remplacée, se lit sur seqMode (voir toggleSequencer).
            volet: window.app.seqMode === 'continu',
            barresVisibles: !!(vl && vl.offsetParent !== null),
            barresDansLeDom: !!vl,
        };
    });

    console.log('\n=== A. Hors loupe, la conduite de voix s\'affiche normalement ===');
    check(!(await vue()).barresDansLeDom, 'aucune barre au départ');
    await page.click('#toggle-voice-leading');
    await page.waitForTimeout(600);
    let v = await vue();
    check(v.reglageActif && v.barresVisibles, 'un clic affiche bien les barres');

    console.log('\n=== B. En ouvrant le volet continu, elles s\'effacent ===');
    await page.click('#grid-zoom');
    await page.waitForTimeout(800);
    v = await vue();
    check(v.volet, 'le volet du séquenceur continu est ouvert');
    check(!v.barresVisibles && !v.barresDansLeDom,
        'les barres ne sont plus là — le séquenceur continu tient ce rôle dans cette zone');
    // CONTRAT MIS À JOUR. Ce banc exigeait « le RÉGLAGE reste actif : on masque, on n'éteint pas ».
    // Ce n'est plus vrai, et le changement est explicite dans toggleSequencer : les deux panneaux
    // partagent la même zone, on n'en montre jamais deux, et chacun ÉTEINT l'autre
    // (`if (vlVientDEtreFerme) this.voiceLeadingOpen = false`) — symétriquement,
    // toggleVoiceLeadingPanel referme le séquenceur. Garder l'ancienne exigence, c'était réclamer un
    // comportement que l'appli a délibérément abandonné.
    check(!v.reglageActif,
        'et le réglage est bien ÉTEINT, pas seulement masqué : les deux panneaux se ferment l\'un l\'autre');

    console.log('\n=== C. Avec un accord chargé dans le volet, toujours rien ===');
    // editChord remplace editChordFromGridZoom, supprimée avec la vue plein écran de la grille (voir
    // le commentaire d'editChord dans script.js). L'appel à la méthode disparue faisait échouer la
    // MISE EN PLACE de ce banc, qui mourait donc avant sa première assertion : il ne surveillait plus
    // rien, sans le dire.
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(700);
    v = await vue();
    check(!v.barresVisibles, 'toujours aucune barre une fois un accord chargé dans le volet');
    check(await page.evaluate(() => document.getElementById('arp-sequencer').offsetParent !== null),
        '...et le séquenceur continu, lui, est bien affiché');

    console.log('\n=== D. En refermant le volet, les barres ne reviennent PAS toutes seules ===');
    await page.click('#grid-zoom'); // même bouton pour refermer : #grid-zoom est une bascule
    await page.waitForTimeout(800);
    v = await vue();
    check(!v.volet, 'le volet est refermé');
    // Suite directe du contrat corrigé en B : le réglage ayant été ÉTEINT, il n'y a rien à restaurer.
    check(!v.barresVisibles && !v.reglageActif,
        'aucune barre ne revient d\'elle-même — le réglage avait été éteint, pas mis en veille');

    console.log('\n=== E. Et le bouton fonctionne toujours normalement ===');
    check(await page.evaluate(() => {
        const b = document.getElementById('toggle-voice-leading');
        const r = b.getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!(el && (el === b || b.contains(el)));
    }), 'le bouton est de nouveau atteignable, volet refermé');
    await page.click('#toggle-voice-leading');
    await page.waitForTimeout(600);
    v = await vue();
    check(v.reglageActif && v.barresVisibles, 'un clic les RALLUME (le réglage était éteint, voir B)');
    await page.click('#toggle-voice-leading');
    await page.waitForTimeout(600);
    v = await vue();
    check(!v.reglageActif && !v.barresVisibles, '...et un second clic les referme pour de bon');

    await browser.close();
    check(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' — ' + errs[0] : ''));
    console.log(`\n=== ${PASS} PASS / ${FAIL} FAIL ===`);
    process.exit(FAIL ? 1 : 0);
})();
