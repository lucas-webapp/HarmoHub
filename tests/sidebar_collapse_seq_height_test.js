// Retour utilisateur : « J'ai testé l'appli sur un autre écran. Comme tu peux le voir, les boutons
// fichiers, accords, etc... Ne sont pas descendus en bas de page et je perds de la place sur le
// séquenceur. [...] cela marche bien avec le volet de gauche non masqué, les boutons se mettent en
// bas. »
// Débogué : le pied de colonne (#footer-dock, Ajouter/À la suite/Annuler) reste TOUJOURS collé au bas
// de .col-right, dans n'importe quel format d'écran testé (une douzaine, du 1024x600 au 3440x1440,
// panneau masqué ou non) — ce n'est PAS lui le défaut. Le vrai coupable : la hauteur AUTOMATIQUE du
// volet séquenceur continu (#seq-dock-host, voir hauteurVoletSequenceur/placeLibreDansLaColonne) est
// calculée UNE FOIS à l'ouverture à partir de la largeur de .col-right À CE MOMENT-LÀ, et n'est
// recalculée qu'aux endroits qui appellent renderSequencer() — masquer le panneau de gauche
// (applySidebarCollapsed) ne le faisait PAS. Résultat mesuré : .col-right passe de 930px à 1306px de
// large en repliant le panneau, mais #seq-dock-host restait figé à sa hauteur d'avant (303px des deux
// côtés) — c'est la grille d'accords (seule flex:1 de la colonne) qui absorbait seule toute la largeur
// regagnée, jamais le séquenceur : exactement « je perds de la place sur le séquenceur ».
// Corrigé en appelant renderSequencer() (qui rappelle placeSequencer() puis
// ajusterHauteurVoletAuContenu()) à la fin de applySidebarCollapsed() — même réflexe que closeSeqZoom()
// un peu plus haut dans le fichier, sur le même principe.
const { chromium } = require('playwright')
const creerHarnais = require('./_harness');
const { plan, check, bilan } = creerHarnais('inspecteur ouvert ou fermé (autrefois : repli du panneau) : la hauteur auto du séquenceur suit');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

(async () => {
    plan(8);
    const browser = await chromium.launch();
    // Format assez étroit pour que les diagrammes/en-têtes puissent réellement se réarranger entre les
    // deux largeurs de .col-right (panneau visible vs masqué) — c'est ce réarrangement qui fait bouger
    // la hauteur disponible, pas seulement la largeur en elle-même.
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
        const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 0, octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            mk('C', 'maj7', 4), mk('A', 'min7', 4), mk('F', 'maj7', 4), mk('G', '7', 4),
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.evaluate(() => { window.app.editChord(0, 0); window.app.toggleSequencer('continu'); }); // l'accord ouvert = l'inspecteur ouvert (lot 6c)
    await page.waitForTimeout(600);

    // LOT 6c : le panneau de gauche ne se replie plus — il n'existe plus sur ordinateur. Ce qui change désormais la largeur de .col-right, c'est
    // l'INSPECTEUR « son de l'accord » (344px à droite de la grille), qui s'ouvre avec un accord et se ferme par sa croix. Le défaut gardé ici est
    // le même : une colonne qui change de largeur sans que la hauteur automatique du volet séquenceur la suive.
    const ouvrirInspecteur = async (i) => {
        await page.click(`#progression-sections .grid-cell[data-index="${i}"]`); await page.waitForTimeout(300);
        await page.click('#bulle-accord [data-bulle="son"]'); await page.waitForTimeout(500);
    };
    const fermerInspecteur = async () => { await page.click('#accord-close'); await page.waitForTimeout(500); };

    console.log('=== A. Hauteur AUTOMATIQUE (jamais réglée à la main) : suit la fermeture de l\'inspecteur ===');
    const avant = await page.evaluate(() => ({
        colRightWidth: document.querySelector('.col-right').getBoundingClientRect().width,
        hostHeight: document.getElementById('seq-dock-host').style.height,
        seqDockHeight: window.app.seqDockHeight,
    }));
    check(!avant.seqDockHeight, 'la hauteur n\'a jamais été réglée à la main pour ce test (avant) — comportement automatique visé');

    await fermerInspecteur();
    const apres = await page.evaluate(() => ({
        colRightWidth: document.querySelector('.col-right').getBoundingClientRect().width,
        hostHeight: document.getElementById('seq-dock-host').style.height,
        seqOuvert: window.app.seqOpen,
        // Recalcule ce que la hauteur automatique DEVRAIT valoir MAINTENANT, pour comparer au lieu de
        // deviner un chiffre — la valeur exacte dépend de la mise en page mesurée, pas d'une constante.
        attendu: `${window.app.hauteurVoletSequenceur()}px`,
    }));
    check(apres.seqOuvert, 'le séquenceur continu reste ouvert quand on ferme l\'inspecteur');
    // Refonte du séquenceur (point C, 11/11) : l'inspecteur FLOTTE au bord droit au lieu de réserver une colonne (« il recadre l'écran à chaque fois ») —
    // .col-right ne change donc plus de largeur en l'ouvrant ou en le fermant, et c'est ce que ce banc tient désormais (la hauteur auto, plus bas, reste juste).
    check(Math.abs(apres.colRightWidth - avant.colRightWidth) <= 1,
        `.col-right garde exactement sa largeur, inspecteur ouvert puis fermé — ${avant.colRightWidth.toFixed(0)} -> ${apres.colRightWidth.toFixed(0)}`);
    check(apres.hostHeight === apres.attendu,
        `la hauteur du volet suit la nouvelle largeur — obtenu ${apres.hostHeight}, attendu ${apres.attendu}`);

    console.log('\n=== B. Hauteur RÉGLÉE À LA MAIN (poignée) : jamais écrasée par l\'inspecteur ===');
    await page.evaluate(() => {
        window.app.seqDockHeight = 260;
        localStorage.setItem('harmohubSeqDockHeight', '260');
        window.app.renderSequencer();
    });
    await page.waitForTimeout(300);
    const manuelAvant = await page.$eval('#seq-dock-host', el => el.style.height);
    check(manuelAvant === '260px', `la hauteur manuelle est bien appliquée — ${manuelAvant}`);
    await ouvrirInspecteur(1);
    const manuelOuvert = await page.$eval('#seq-dock-host', el => el.style.height);
    await fermerInspecteur();
    const manuelApres = await page.$eval('#seq-dock-host', el => el.style.height);
    check(manuelOuvert === '260px' && manuelApres === '260px', `...et reste EXACTEMENT la même, inspecteur ouvert puis fermé — le choix de l'utilisateur prime — ${manuelOuvert} / ${manuelApres}`);

    console.log('\n=== C. Non-régression : la colonne de la grille reste collée en bas ===');
    const bas = await page.evaluate(() => {
        // REFONTE, LOT 2 : le « bas » est le HAUT de la barre de lecture (60px). Lot 6c : le pied de colonne d'autrefois (#footer-dock) vivait dans le
        // bandeau de gauche, qui n'est plus sur ordinateur ; c'est la colonne de la grille elle-même qui borde le bas, à ~20px de la barre.
        const c = document.querySelector('.col-right').getBoundingClientRect();
        // LOT 8 : le clavier est ouvert par défaut, et son tiroir épinglé s'intercale AU-DESSUS de la barre de lecture : la colonne s'arrête alors à ~20px du
        // tiroir, qui est lui-même collé à la barre. Sans diagramme, c'est la barre qui borde.
        const tiroir = document.getElementById('vues-tiroir');
        const borne = (tiroir && !tiroir.hidden ? tiroir : document.getElementById('barre-lecture')).getBoundingClientRect();
        return { bottom: c.bottom, haut: borne.top };
    });
    check(Math.abs((bas.haut - bas.bottom) - 20) < 3,
        `la colonne de la grille s'arrête à ~20px de la barre de lecture du bas — écart mesuré ${(bas.haut - bas.bottom).toFixed(0)}px`);

    check(errors.length === 0, 'aucune erreur JavaScript' + (errors.length ? ' — ' + errors[0] : ''));

    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
