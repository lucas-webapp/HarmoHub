// La conduite de voix s'efface dans la loupe grille, et revient en sortant.
// Retour utilisateur : « lorsque j'active le mode loupe+séquenceur, les barres du voice leading
// restent affichées et je ne peux pas l'enlever ». Deux causes cumulées, mesurées :
//   - le panneau vit DANS #progression-sections, déplacé en entier dans la loupe par openGridZoom :
//     il suivait donc la grille sans qu'on l'ait demandé ;
//   - le bouton #toggle-voice-leading, lui, reste derrière l'en-tête de la loupe — un clic à sa
//     place tombe sur .settings-header. Impossible de le refermer sans quitter la loupe.
// Choix : le séquenceur épinglé tient déjà ce rôle dans la loupe (mêmes voix, en plus fin, sur
// l'accord travaillé). On MASQUE sans éteindre : le réglage survit à l'aller-retour.
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
            loupe: window.app.gridZoomOpen,
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

    console.log('\n=== B. Dans la loupe grille, elles s\'effacent ===');
    await page.click('#grid-zoom');
    await page.waitForTimeout(800);
    v = await vue();
    check(v.loupe, 'la loupe grille est ouverte');
    check(!v.barresVisibles && !v.barresDansLeDom,
        'les barres ne sont plus là — le séquenceur épinglé tient ce rôle dans la loupe');
    check(v.reglageActif,
        'mais le RÉGLAGE reste actif : on masque, on n\'éteint pas');

    console.log('\n=== C. Avec le séquenceur épinglé, toujours rien ===');
    await page.evaluate(() => window.app.editChordFromGridZoom(0, 0));
    await page.waitForTimeout(700);
    v = await vue();
    check(!v.barresVisibles, 'toujours aucune barre une fois un accord chargé dans la loupe');
    check(await page.evaluate(() => document.getElementById('arp-sequencer').offsetParent !== null),
        '...et le séquenceur épinglé, lui, est bien affiché');

    console.log('\n=== D. En refermant la loupe, elles reviennent d\'elles-mêmes ===');
    await page.click('#grid-zoom-close');
    await page.waitForTimeout(800);
    v = await vue();
    check(!v.loupe, 'la loupe est refermée');
    check(v.barresVisibles,
        'les barres sont revenues sans rien avoir à recliquer — le réglage n\'a pas été perdu en route');

    console.log('\n=== E. Et le bouton fonctionne toujours normalement ===');
    check(await page.evaluate(() => {
        const b = document.getElementById('toggle-voice-leading');
        const r = b.getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!(el && (el === b || b.contains(el)));
    }), 'le bouton est de nouveau atteignable hors loupe');
    await page.click('#toggle-voice-leading');
    await page.waitForTimeout(600);
    v = await vue();
    check(!v.reglageActif && !v.barresVisibles, 'un second clic les referme pour de bon');

    await browser.close();
    check(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' — ' + errs[0] : ''));
    console.log(`\n=== ${PASS} PASS / ${FAIL} FAIL ===`);
    process.exit(FAIL ? 1 : 0);
})();
