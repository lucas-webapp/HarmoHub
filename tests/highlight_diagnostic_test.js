// La mise en évidence d'un accord dans la grille doit SURVIVRE à l'ouverture du volet du séquenceur :
// l'accord sélectionné garde son cadre, celui en édition garde le sien, et les deux ne se confondent
// pas.
//
// CE FICHIER N'ÉTAIT PAS UN BANC. Il affichait deux JSON et se terminait sans aucune assertion ni
// code de sortie : il ne pouvait rien signaler, jamais. Il cherchait en plus ses cases dans
// #grid-zoom-host — l'hôte de l'ancienne vue plein écran, dont l'identifiant a zéro occurrence dans
// l'appli — donc ses deux mesures ne rapportaient que « MISSING ». Le sujet, lui, mérite un banc : le
// volet du séquenceur ne recouvre plus la grille, la grille reste visible pendant qu'on y travaille,
// et c'est justement pour ça que sa mise en évidence doit rester juste.
//
// Deux états DISTINCTS à ne pas mélanger (voir selectChord / editChord) :
//   - .selected : un simple clic. L'accord est montré (diagrammes, écoute), rien n'est en cours de
//     modification.
//   - .editing  : un double-clic ou « Modifier ». C'est l'accord que les réglages vont changer.
// Depuis que l'ouverture du volet charge l'accord sélectionné (voir toggleSequencer), les deux
// coexistent sur la MÊME case dans ce scénario — et c'est ce cumul qu'il faut vérifier, sinon rien
// n'empêcherait un futur rendu de perdre l'un des deux en silence.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('mise en évidence dans la grille');
plan(10);

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
            { root: 'D', quality: 'min', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
            { root: 'E', quality: 'min', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);

    // On lit la case dans la grille RÉELLE (#progression-sections), qui ne déménage plus nulle part.
    const cases = () => page.evaluate(() => [0, 1, 2].map((i) => {
        const c = document.querySelector(`#progression-sections .grid-cell[data-section="0"][data-index="${i}"]`);
        if (!c) return { absente: true };
        const cs = getComputedStyle(c);
        return {
            selected: c.classList.contains('selected'),
            editing: c.classList.contains('editing'),
            fond: cs.backgroundColor,
            bordure: cs.borderColor,
            // Une case mise en évidence doit l'être VISUELLEMENT, pas seulement dans son attribut
            // class : un jour où la règle CSS disparaîtrait, la classe seule ne prouverait rien.
            contour: cs.outlineStyle + ' ' + cs.outlineWidth,
        };
    }));
    const neutre = (c) => !c.selected && !c.editing;

    console.log('=== Scénario A : accord SÉLECTIONNÉ (simple clic), puis ouverture du volet ===');
    await page.click('.grid-cell[data-index="1"]', { position: { x: 40, y: 40 } });
    await page.waitForTimeout(400);
    const a1 = await cases();
    console.log('après le clic simple :', JSON.stringify(a1));
    if (!exiger(a1[1].selected && !a1[1].editing, 'le simple clic pose bien .selected sur la case 1, sans .editing')) bilan();
    check(neutre(a1[0]) && neutre(a1[2]), 'les autres cases restent neutres après le clic simple');
    const fondNeutre = a1[0].fond;
    check(a1[1].fond !== fondNeutre,
        `la case sélectionnée se distingue VISUELLEMENT des autres (${a1[1].fond} vs ${fondNeutre})`);

    await page.click('#grid-zoom');
    await page.waitForTimeout(700);
    const a2 = await cases();
    console.log('volet ouvert :', JSON.stringify(a2));
    // Depuis la réparation de toggleSequencer, ouvrir le volet charge l'accord sélectionné : la case
    // porte alors les DEUX états. Ce qui ne doit pas arriver, c'est qu'elle perde sa mise en évidence.
    check(a2[1].selected || a2[1].editing,
        'la case garde sa mise en évidence après l\'ouverture du volet — elle ne redevient pas neutre');
    check(a2[1].editing, 'et elle est bien passée en édition, l\'accord sélectionné étant chargé (voir toggleSequencer)');
    check(a2[1].fond !== fondNeutre,
        `elle reste visuellement distincte des cases voisines (${a2[1].fond} vs ${a2[0].fond})`);
    check(neutre(a2[0]) && neutre(a2[2]), 'aucune case voisine n\'a attrapé la mise en évidence au passage');

    console.log('=== Scénario B : accord DÉJÀ en édition avant l\'ouverture du volet ===');
    await page.click('#grid-zoom');                                  // referme
    await page.waitForTimeout(300);
    await page.evaluate(() => window.app.editChord(0, 2));
    await page.waitForTimeout(300);
    const b1 = await cases();
    exiger(b1[2].editing, 'l\'accord 2 est bien en édition avant l\'ouverture');
    await page.click('#grid-zoom');
    await page.waitForTimeout(700);
    const b2 = await cases();
    console.log('volet ouvert sur l\'accord déjà en édition :', JSON.stringify(b2));
    check(b2[2].editing, 'il reste en édition après l\'ouverture du volet');
    check(!b2[0].editing && !b2[1].editing, 'et il est le SEUL en édition — le cadre d\'édition ne se duplique pas');

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
