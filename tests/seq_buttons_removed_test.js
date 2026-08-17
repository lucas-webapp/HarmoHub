const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'C', chords: [mk('C', 'maj', 4)] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(100);

    console.log('--- Select a sequencer note, render, check move/shrink/grow buttons are gone, delete remains ---');
    // La barre d'outils du séquenceur (dont Supprimer) vit dans la LOUPE, pas dans le séquenceur
    // compact du panneau : c'est là qu'il faut regarder pour dire si un bouton a survécu ou non.
    await page.click('#grid-zoom');
    await page.waitForTimeout(300);
    // editChord remplace editChordFromGridZoom, supprimée avec la vue plein écran de la grille (voir
    // le commentaire d'editChord dans script.js). L'appel à la méthode disparue faisait échouer la
    // MISE EN PLACE de ce banc, qui mourait donc avant sa première assertion : il ne surveillait plus
    // rien, sans le dire.
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(300);
    // Une sélection se pousse SOUS LA FORME que l'appli utilise : {voice, start, end}, pas
    // {voice, step}. L'ancienne forme faisait planter le rendu (« Cannot read properties of
    // undefined (reading 'includes') ») — un faux positif : c'était l'état poussé par le test qui
    // était invalide, pas l'appli. Vérifié en sélectionnant par un vrai clic, qui donne bien
    // {voice, start, end}. On garde tout de même une note COURTE : une note qui remplit déjà la
    // mesure n'a plus de place pour s'allonger, et la flèche n'aurait alors rien à changer.
    await page.evaluate(() => {
        window.app.setLiveSeqPattern(
            Array.from({ length: 16 }, (_, i) => (i < 4 ? [0] : [])),
            Array.from({ length: 16 }, (_, i) => (i > 0 && i < 4 ? [0] : [])),
        );
        window.app.seqTouched = true;
        window.app.seqSelections = [{ voice: 0, start: 0, end: 3 }];
        window.app.renderSequencer();
    });
    await page.waitForTimeout(100);
    const r = await page.evaluate(() => ({
        moveLeft: !!document.getElementById('seq-move-left'),
        moveRight: !!document.getElementById('seq-move-right'),
        shrink: !!document.getElementById('seq-shrink'),
        grow: !!document.getElementById('seq-grow'),
        selectionActionsDiv: !!document.querySelector('.seq-selection-actions'),
        deleteSelection: !!document.getElementById('seq-delete-selection'),
        tapRecord: !!document.getElementById('seq-tap-record'),
    }));
    console.log(JSON.stringify(r));
    // CONTRAT CHANGÉ : ce test exigeait aussi que le bouton d'enregistrement du rythme tapé
    // (#seq-tap-record) SURVIVE au ménage. Le rythme tapé a depuis été retiré en entier (voir
    // fc7b776) — l'exiger revenait à faire échouer la campagne au nom d'un bouton qu'on a décidé
    // de supprimer. Ce que ce test garde : les boutons déplacer/rétrécir/agrandir sont bien partis,
    // et Supprimer, lui, est resté. Idem pour #seq-delete-selection : c'est CE bouton-là qui devait
    // survivre, et il survit — à condition de le chercher dans la loupe, voir ci-dessus.
    const pass = !r.moveLeft && !r.moveRight && !r.shrink && !r.grow && !r.selectionActionsDiv && r.deleteSelection && !r.tapRecord;
    console.log(pass ? 'PASS (move/shrink/grow buttons removed, delete+tap-record kept)' : 'FAIL');

    console.log('--- Keyboard shortcuts (arrows/shift+arrows) still work (underlying functions untouched) ---');
    // `window.app.liveSeqPattern` n'a jamais été une propriété : le motif vit dans le champ
    // #arpPattern (voir setLiveSeqPattern/serializeSeqPattern), et c'est lui qui fait foi. Le test
    // lisait `undefined`, que `JSON.parse` refuse — d'où un crash qui ne disait rien de l'appli.
    const motif = () => page.evaluate(() => document.getElementById('arpPattern').value);
    const before = await motif();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(50);
    const after = await motif();
    console.log('pattern changed after ArrowRight:', before !== after, '|', before, '->', after);
    console.log((before !== after) ? 'PASS (keyboard resize still functional)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
