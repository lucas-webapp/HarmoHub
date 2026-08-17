// Tout élément que l'appli DÉPLACE doit revenir exactement à sa place — et la grille, elle, ne doit
// jamais bouger du tout.
//
// D'OÙ VIENT CE BANC. Il s'appelait grid_zoom_close_restore et gardait un vrai défaut : l'ancienne
// vue plein écran déménageait #progression-sections dans #grid-zoom-host, et en la refermant la
// grille se retrouvait dans .col-left au lieu de .history-section — la grille d'accords passait dans
// la colonne de gauche, sous les réglages. Cette vue a été supprimée, avec son hôte : le banc
// appelait donc app.openGridZoom()/closeGridZoom(), disparues, et mourait à sa mise en place.
//
// LE DÉFAUT, LUI, RESTE POSSIBLE : l'appli continue de déménager des éléments d'un parent à l'autre
// plutôt que de les dupliquer, précisément pour que leurs interactions déjà câblées les suivent
// (voir placeSequencer, placeChordTitle, placeGlobalTransport, openSeqZoom). Chaque déménagement est
// une occasion de ne pas revenir. On garde donc la question, sur les déménageurs qui existent
// vraiment aujourd'hui :
//   - #progression-sections : ne doit JAMAIS quitter .history-section, quoi qu'on ouvre. C'est la
//     garde directe du défaut d'origine, désormais gratuite puisque plus rien ne le déplace.
//   - #arp-sequencer : fait l'aller-retour carte Lecture <-> #seq-dock-host (volet sous la grille)
//     <-> #seq-zoom-host (vue agrandie). Trois hôtes, un seul élément, jamais dupliqué.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('retour à sa place');
plan(15);

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
            { root: 'G', quality: 'dom7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);

    const ou = () => page.evaluate(() => {
        const grille = document.getElementById('progression-sections');
        const ajout = document.getElementById('add-section');
        const seq = document.getElementById('arp-sequencer');
        return {
            grilleDansHistory: !!grille.closest('.history-section'),
            grilleDansColLeft: !!grille.closest('.col-left'),
            grilleDansColRight: !!grille.closest('.col-right'),
            // Ordre RÉEL des enfants de .history-section. On ne se contente pas de « la grille suit
            // l'en-tête » : la saisie rapide s'est glissée entre les deux depuis (voir #quick-add-panel,
            // déplacé sous le titre de la grille sur retour utilisateur « sa position n'est pas
            // logique »). Vérifier une adjacence directe reviendrait à figer un détail de mise en page ;
            // ce qui compte, c'est que l'ORDRE reste celui-là — en-tête, saisie, grille, bouton d'ajout.
            ordreHistory: [...grille.closest('.history-section').children]
                .map(e => e.id || e.className.split(' ')[0]),
            ajoutDansHistory: !!ajout.closest('.history-section'),
            // Un seul #arp-sequencer, toujours : le déménagement ne doit jamais devenir une copie.
            nbSequenceurs: document.querySelectorAll('#arp-sequencer, [id="arp-sequencer"]').length,
            parentSeq: seq.parentElement.id || seq.parentElement.className.split(' ')[0],
            symboles: [...document.querySelectorAll('#progression-sections .cell-sym')].map(e => e.textContent.trim()),
        };
    });

    console.log('=== Au repos : la grille vit dans .history-section, le séquenceur dans la carte Lecture ===');
    const repos = await ou();
    console.log(JSON.stringify(repos));
    if (!exiger(repos.grilleDansHistory && !repos.grilleDansColLeft && repos.nbSequenceurs === 1,
        'position initiale correcte : grille dans .history-section, un seul #arp-sequencer')) bilan();
    const hoteInitialSeq = repos.parentSeq;
    check(repos.symboles.length === 2, `les 2 accords sont bien là au départ — ${JSON.stringify(repos.symboles)}`);

    console.log('=== Ouvre le volet du séquenceur continu, édite un accord ===');
    await page.click('#grid-zoom');
    await page.waitForTimeout(700);
    await page.evaluate(() => window.app.editChordFromSequencer(0, 0));
    await page.waitForTimeout(500);
    const ouvert = await ou();
    console.log(JSON.stringify(ouvert));
    check(ouvert.parentSeq === 'seq-dock-host', `le séquenceur a bien rejoint le volet sous la grille — parent « ${ouvert.parentSeq} »`);
    check(ouvert.nbSequenceurs === 1, `il a été DÉPLACÉ, pas dupliqué — ${ouvert.nbSequenceurs} séquenceur(s) dans la page`);
    check(ouvert.grilleDansHistory && !ouvert.grilleDansColLeft,
        'la grille n\'a PAS bougé : elle reste dans .history-section (c\'est là que le défaut d\'origine la perdait)');

    console.log('=== Passe par la vue AGRANDIE, puis en revient ===');
    await page.click('#seq-zoom');
    await page.waitForTimeout(800);
    const agrandi = await ou();
    console.log(JSON.stringify(agrandi));
    check(agrandi.parentSeq === 'seq-zoom-host', `agrandi, le séquenceur est dans la fenêtre — parent « ${agrandi.parentSeq} »`);
    check(agrandi.nbSequenceurs === 1, `toujours un seul séquenceur — ${agrandi.nbSequenceurs}`);
    check(agrandi.grilleDansHistory, 'la grille reste en place même fenêtre agrandie ouverte');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
    const revenu = await ou();
    console.log(JSON.stringify(revenu));
    check(revenu.parentSeq === 'seq-dock-host',
        `en refermant la fenêtre, le séquenceur retourne dans le volet, pas ailleurs — parent « ${revenu.parentSeq} »`);

    console.log('=== Referme le volet : le séquenceur retrouve son hôte d\'origine ===');
    await page.click('#grid-zoom');
    await page.waitForTimeout(600);
    const ferme = await ou();
    console.log(JSON.stringify(ferme));
    check(ferme.parentSeq === hoteInitialSeq,
        `le séquenceur est revenu exactement à son hôte de départ (« ${hoteInitialSeq} ») — trouvé « ${ferme.parentSeq} »`);
    check(ferme.nbSequenceurs === 1, `toujours un seul séquenceur après tout l'aller-retour — ${ferme.nbSequenceurs}`);

    console.log('=== La grille et son bouton « Ajouter une partie » sont intacts après tout le parcours ===');
    check(ferme.grilleDansHistory, 'la grille est bien dans .history-section');
    check(ferme.grilleDansColRight && !ferme.grilleDansColLeft, 'elle est dans .col-right, et surtout PAS dans .col-left');
    const rang = (q) => ferme.ordreHistory.indexOf(q);
    console.log('ordre dans .history-section :', JSON.stringify(ferme.ordreHistory));
    check(rang('card-head') < rang('quick-add-panel')
        && rang('quick-add-panel') < rang('progression-sections')
        && rang('progression-sections') < rang('add-section'),
        `l'ordre de la section est intact : en-tête, saisie rapide, grille, bouton d'ajout — ${JSON.stringify(ferme.ordreHistory)}`);
    check(ferme.ajoutDansHistory, 'le bouton « Ajouter une partie » est là aussi');
    check(JSON.stringify(ferme.symboles) === JSON.stringify(repos.symboles),
        `le contenu de la grille est inchangé — ${JSON.stringify(ferme.symboles)}`);

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le parcours');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
