// Changer de morceau ne doit rien laisser traîner de l'ancien dans le panneau Accord.
// Retour utilisateur, capture à l'appui : « lorsque j'ouvre le séquenceur et que je change de
// morceau, le séquenceur avec les anciens accords reste en place et je ne peux pas l'enlever » —
// trois rangées A#3/D#3/F#2 sous une grille de Dm7/F/Em7, sans rapport avec quoi que ce soit à
// l'écran. Le séquenceur n'était pas le coupable : il montrait fidèlement le panneau Accord, resté
// sur l'accord du morceau PRÉCÉDENT parce que loadSong ne le remettait jamais à neuf.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés.

let PASS = 0, FAIL = 0;
function check(c, l) { if (c) { PASS++; console.log('PASS - ' + l); } else { FAIL++; console.log('FAIL - ' + l); } }

const mk = (root, q) => ({ root, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} });

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|fonts\.googleapis|fonts\.gstatic/.test(m.text())) errs.push('console: ' + m.text()); });

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(600);
    await page.evaluate((mkSrc) => {
        const mk = eval('(' + mkSrc + ')');
        const un = [{ title: 'A', chords: [mk('A#', 'min7'), mk('G', 'maj')] }];
        const deux = [{ title: 'B', chords: [mk('D', 'min7'), mk('F', 'maj7')] }];
        localStorage.setItem('harmohubSongs', JSON.stringify([
            { id: 's1', name: 'UN', savedAt: 1, sections: un },
            { id: 's2', name: 'DEUX', savedAt: 2, sections: deux },
        ]));
        localStorage.setItem('harmohubCurrentSongId', 's1');
        localStorage.setItem('myProgression', JSON.stringify({ sections: un }));
    }, mk.toString());
    await page.reload();
    await page.waitForTimeout(900);

    // Ce que le séquenceur montre RÉELLEMENT à l'écran, et ce que le panneau contient.
    const vue = () => page.evaluate(() => {
        const c = window.app.readChord();
        return {
            rangees: [...document.querySelectorAll('#arp-sequencer .seq-label')].map(e => e.textContent.trim()),
            accordDuPanneau: c ? c.root + c.quality : null,
            seqOpen: window.app.seqOpen,
            editingIndex: window.app.editingIndex,
            motifSurMesure: window.app.seqTouched,
            notesLibres: window.app.extraNotes.length,
        };
    });

    console.log('\n=== A. Le séquenceur ouvert sur un accord du morceau UN ===');
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.app.toggleSequencer('compact'));
    await page.waitForTimeout(600);
    let v = await vue();
    check(v.seqOpen && v.rangees.length >= 3, `le séquenceur est ouvert et garni — ${JSON.stringify(v.rangees)}`);
    check(v.accordDuPanneau === 'A#min7', `le panneau porte bien l'accord ouvert — ${v.accordDuPanneau}`);
    const rangeesAvant = JSON.stringify(v.rangees);

    console.log('\n=== B. On passe au morceau DEUX ===');
    await page.evaluate(() => { window.hasUnsavedChanges = false; window.app.loadSong('s2'); });
    await page.waitForTimeout(900);
    v = await vue();
    check(v.accordDuPanneau !== 'A#min7',
        `le panneau ne garde PAS l'accord du morceau précédent — obtenu ${v.accordDuPanneau}`);
    check(JSON.stringify(v.rangees) !== rangeesAvant,
        `...et le séquenceur ne montre plus ses notes — ${JSON.stringify(v.rangees)} au lieu de ${rangeesAvant}`);
    // La vraie exigence : ce qui s'affiche correspond à ce que dit le panneau. C'est CE lien qui
    // était rompu, et c'est lui qui rendait la vue incompréhensible.
    const attendu = await page.evaluate(() => {
        const c = window.app.readChord();
        return c.getSeqDisplayNotes ? c.getSeqDisplayNotes(window.app.useFlatsForRoot(c.root)).slice().reverse() : null;
    });
    if (attendu) {
        check(JSON.stringify(v.rangees) === JSON.stringify(attendu),
            `le séquenceur affiche exactement les notes de l'accord du panneau — ${JSON.stringify(v.rangees)} vs ${JSON.stringify(attendu)}`);
    }
    check(v.motifSurMesure === false,
        'le motif rythmique repart du style de jeu, il ne suit pas le morceau précédent');
    check(v.notesLibres === 0, 'aucune note libre héritée de l\'ancien morceau');

    console.log('\n=== C. Et il reste refermable ===');
    // Le bouton icône de l'en-tête a disparu (voir portes_sequenceur_test) : la porte de la carte
    // Accord s'appelle « Séquenceur » et reste visible en permanence, séquenceur ouvert ou fermé.
    check(await page.evaluate(() => document.getElementById('seq-zoom').offsetParent !== null),
        'le bouton qui le referme est bien atteignable');
    await page.evaluate(() => window.app.toggleSequencer('compact'));
    await page.waitForTimeout(500);
    check(!(await page.evaluate(() => window.app.seqOpen)), 'un clic le referme');

    console.log('\n=== D. Un morceau vierge (« + ») ne garde rien non plus ===');
    await page.evaluate(() => { window.hasUnsavedChanges = false; window.app.loadSong('s1'); });
    await page.waitForTimeout(700);
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(300);
    check((await vue()).accordDuPanneau === 'A#min7', 'accord chargé avant le nouveau morceau');
    await page.evaluate(() => { window.hasUnsavedChanges = false; return window.app.newSong(true); });
    await page.waitForTimeout(800);
    v = await vue();
    check(v.accordDuPanneau !== 'A#min7',
        `un morceau vierge repart d'un panneau neuf — obtenu ${v.accordDuPanneau}`);

    console.log('\n=== E. Refermer un accord, DANS le même morceau, ne remet rien à zéro ===');
    // Contrat volontairement différent : rester sur l'accord qu'on vient de fermer permet d'en
    // ajouter une variante sans tout resaisir (voir exitEditMode). Ce n'est incohérent que d'un
    // morceau à l'autre.
    await page.evaluate(() => { window.hasUnsavedChanges = false; window.app.loadSong('s1'); });
    await page.waitForTimeout(700);
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(300);
    await page.click('#accord-close');
    await page.waitForTimeout(500);
    check((await vue()).accordDuPanneau === 'A#min7',
        'après « Fermer », l\'accord reste sous la main pour enchaîner une variante');

    await browser.close();
    check(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' — ' + errs[0] : ''));
    console.log(`\n=== ${PASS} PASS / ${FAIL} FAIL ===`);
    process.exit(FAIL ? 1 : 0);
})();
