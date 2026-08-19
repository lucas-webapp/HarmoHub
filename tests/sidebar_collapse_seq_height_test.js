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
const { plan, check, bilan } = creerHarnais('repli du panneau de gauche : la hauteur auto du séquenceur suit');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

(async () => {
    plan(9);
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
    await page.evaluate(() => { window.app.editChord(0, 0); window.app.toggleSequencer('continu'); });
    await page.waitForTimeout(600);

    console.log('=== A. Hauteur AUTOMATIQUE (jamais réglée à la main) : suit le repli du panneau ===');
    const avant = await page.evaluate(() => ({
        colRightWidth: document.querySelector('.col-right').getBoundingClientRect().width,
        hostHeight: document.getElementById('seq-dock-host').style.height,
        seqDockHeight: window.app.seqDockHeight,
    }));
    check(!avant.seqDockHeight, 'la hauteur n\'a jamais été réglée à la main pour ce test (avant) — comportement automatique visé');

    await page.evaluate(() => document.getElementById('toggle-sidebar').click());
    await page.waitForTimeout(500);
    const apres = await page.evaluate(() => ({
        colRightWidth: document.querySelector('.col-right').getBoundingClientRect().width,
        hostHeight: document.getElementById('seq-dock-host').style.height,
        // Recalcule ce que la hauteur automatique DEVRAIT valoir MAINTENANT, pour comparer au lieu de
        // deviner un chiffre — la valeur exacte dépend de la mise en page mesurée, pas d'une constante.
        attendu: `${window.app.hauteurVoletSequenceur()}px`,
    }));
    check(apres.colRightWidth > avant.colRightWidth + 200,
        `.col-right a bien regagné une largeur substantielle en repliant le panneau — ${avant.colRightWidth.toFixed(0)} -> ${apres.colRightWidth.toFixed(0)}`);
    check(apres.hostHeight === apres.attendu,
        `la hauteur du volet suit désormais la nouvelle largeur, sans redéclencher de rendu manuel — obtenu ${apres.hostHeight}, attendu ${apres.attendu}`);
    check(apres.hostHeight !== avant.hostHeight || apres.attendu === avant.hostHeight,
        `cohérent : si la hauteur recalculée diffère de l'ancienne, le volet a bien changé — avant ${avant.hostHeight}, après ${apres.hostHeight}`);

    console.log('\n=== B. Hauteur RÉGLÉE À LA MAIN (poignée) : jamais écrasée par un repli de panneau ===');
    await page.evaluate(() => document.getElementById('toggle-sidebar').click()); // ré-affiche le panneau
    await page.waitForTimeout(400);
    await page.evaluate(() => {
        window.app.seqDockHeight = 260;
        localStorage.setItem('harmohubSeqDockHeight', '260');
        window.app.renderSequencer();
    });
    await page.waitForTimeout(300);
    const manuelAvant = await page.$eval('#seq-dock-host', el => el.style.height);
    check(manuelAvant === '260px', `la hauteur manuelle est bien appliquée avant le repli — ${manuelAvant}`);
    await page.evaluate(() => document.getElementById('toggle-sidebar').click());
    await page.waitForTimeout(500);
    const manuelApres = await page.$eval('#seq-dock-host', el => el.style.height);
    check(manuelApres === '260px', `...et reste EXACTEMENT la même après le repli — le choix de l'utilisateur prime — ${manuelApres}`);

    console.log('\n=== C. Non-régression : le pied de colonne reste collé en bas, comme avant ce correctif ===');
    const dock = await page.evaluate(() => {
        const el = document.getElementById('footer-dock');
        const r = el.getBoundingClientRect();
        return { bottom: r.bottom, innerHeight: window.innerHeight, parent: el.parentElement.className };
    });
    check(dock.parent === 'col-right', `le pied de colonne est bien déplacé dans .col-right, panneau masqué — ${dock.parent}`);
    check(Math.abs((dock.innerHeight - dock.bottom) - 20) < 3,
        `...et reste collé à ~20px du bas de la fenêtre — écart mesuré ${(dock.innerHeight - dock.bottom).toFixed(0)}px`);

    check(errors.length === 0, 'aucune erreur JavaScript' + (errors.length ? ' — ' + errors[0] : ''));

    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
