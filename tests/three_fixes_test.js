const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.
//
// CE FICHIER N'ÉTAIT PAS UN BANC : neuf verdicts en console.log, sans compteur ni code de sortie.
//
// SA SECTION 1 VISAIT DES BOUTONS DISPARUS. L'export/import de bibliothèque avait deux boutons
// dédiés dans le bandeau du haut (#quick-library-export / #quick-library-import) : zéro occurrence
// dans l'appli aujourd'hui. Ils ont été fondus dans les boutons du module Morceau — #song-export
// ouvre un petit menu « Ce morceau / Toute la bibliothèque » (voir openTransferScopeMenu), #song-import
// déclenche le même choix de fichier. C'était le motif signalé par l'utilisateur (« plusieurs options
// se recroisent ») : deux portes vers exactement la même chose. Le banc attendait donc un
// téléchargement déclenché par un bouton inexistant, expirait au bout de dix secondes, et ses sept
// verdicts suivants — sections 2 et 3, sans aucun rapport — n'étaient jamais atteints.
const { check, exiger, plan, bilan } = require('./_harness')('trois correctifs');
const R = require('./_retrait_ancien');
plan(14);

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1400, height: 1400 }, acceptDownloads: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_CERT_AUTHORITY_INVALID|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);

    console.log('=== 1. Export/import de la bibliothèque, depuis le module Morceau ===');
    let r = await page.evaluate(() => ({
        exportBtn: !!document.getElementById('song-export'),
        importBtn: !!document.getElementById('song-import'),
        input: !!document.getElementById('song-import-input'),
        anciensBoutons: !!document.getElementById('quick-library-export') || !!document.getElementById('quick-library-import'),
    }));
    console.log(JSON.stringify(r));
    if (!exiger(r.exportBtn && r.importBtn && r.input, 'les boutons export/import et leur champ de fichier caché sont bien là')) bilan();
    check(!r.anciensBoutons, "et les anciens boutons du bandeau du haut ne subsistent pas en double");

    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Test', chords: [mk('C', 'maj', 4)] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(() => window.app.createNewSongFromCurrentState('Quick Export Test'));
    await page.waitForTimeout(250);

    // « Exporter… » ouvre d'abord un choix de portée : un clic ne télécharge donc plus directement. LOT 3 : le geste est désormais
    // titre du morceau → « Exporter… » (l'ancienne flèche de la carte Morceau est masquée sur ordinateur) ; le code derrière est le même.
    await page.click('#tb-titre');
    await page.click('#tb-menu [data-tb-action="exporter"]');
    await page.waitForTimeout(300);
    const menu = await page.evaluate(() => {
        const m = document.getElementById('backup-scope-menu');
        return { visible: m && !m.hidden, portees: m ? [...m.querySelectorAll('button')].map(b => b.dataset.backupScope) : [] };
    });
    console.log(JSON.stringify(menu));
    check(menu.visible && menu.portees.join(',') === 'song,library',
        `le bouton propose bien les deux portées avant d'exporter — ${JSON.stringify(menu.portees)}`);

    const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 10000 }),
        page.click('#backup-scope-menu button[data-backup-scope="library"]'),
    ]);
    console.log('export téléchargé :', download.suggestedFilename());
    check(download.suggestedFilename().endsWith('.json'),
        `« Toute la bibliothèque » déclenche bien un téléchargement JSON — ${download.suggestedFilename()}`);

    // Vrai clic sur « Importer… » du menu du morceau (et non un .click() du script sur un bouton masqué) : le champ de fichier caché doit
    // recevoir l'appel.
    await page.evaluate(() => {
        const input = document.getElementById('song-import-input');
        window.__importClique = false;
        window.__importOrig = input.click;
        input.click = () => { window.__importClique = true; };
    });
    await page.click('#tb-titre');
    await page.click('#tb-menu [data-tb-action="importer"]');
    const importCable = await page.evaluate(() => {
        const input = document.getElementById('song-import-input');
        input.click = window.__importOrig;
        return window.__importClique;
    });
    check(importCable, "l'entrée « Importer… » du menu déclenche bien le champ de fichier caché");

    console.log('=== 2. Resizing a chord in the grid extends with HELD notes, not the looped preset ===');
    await page.evaluate(() => {
        // playStyle croche (8e notes) sur un accord d'1 mesure : préréglage rythmique, pas tenu
        const mk = (root, quality, beats, playStyle) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Test', chords: [mk('C', 'maj', 4, 'croche_maintenu')] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    r = await page.evaluate(() => {
        const app = window.app;
        // vérifie que le préréglage d'1 mesure est bien rythmique (pas juste tenu de bout en bout) AVANT
        const dataBefore = JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[0];
        const chordBefore = new Chord(dataBefore.root, dataBefore.quality, 4, 0, 'none', 4, null);
        const before = app.resolveSeqPatternForData(chordBefore, dataBefore);
        // étire l'accord de 4 à 16 temps (1 -> 4 mesures) via le clavier (resizeSelectedChord)
        app.selectedIndex = 0;
        app.activeSection = 0;
        app.resizeSelectedChord(12, 0); // +12 temps = 4 mesures au total
        const dataAfter = JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[0];
        const chordAfter = new Chord(dataAfter.root, dataAfter.quality, dataAfter.beats, 0, 'none', 4, null);
        const after = app.resolveSeqPatternForData(chordAfter, dataAfter);
        return {
            beatsBefore: 4, beatsAfter: dataAfter.beats,
            beforeHadRhythm: before.tie.some((t, i) => i > 0 && t.length === 0 && before.pattern[i].length > 0), // ré-attaque en cours de route -> rythmique (croche_maintenu ne laisse jamais de silence, mais ré-attaque)
            // zone ajoutée (temps 16 au-delà, index 16..63) : chaque voix doit être ON et TIED partout après le tout premier pas ajouté
            addedZoneAllOn: after.pattern.slice(16).every(s => s.length > 0),
            addedZoneAllTied: after.tie.slice(17).every((t, i) => t.length === after.pattern[18 + i - 1]?.length || t.length > 0),
            originalZoneUnchanged: JSON.stringify(after.pattern.slice(0, 16)) === JSON.stringify(before.pattern),
        };
    });
    console.log(JSON.stringify(r));
    if (!exiger(r.beforeHadRhythm, "le motif d'origine est bien RYTHMIQUE et non déjà tenu de bout en bout (sans quoi la suite ne prouverait rien)")) bilan();
    check(r.beatsAfter === 16, `l'accord est bien passé à 4 mesures — ${r.beatsAfter} temps`);
    check(r.addedZoneAllOn, 'la zone AJOUTÉE est entièrement tenue : ni silence ni croches recopiées du préréglage');
    check(r.originalZoneUnchanged, "et le rythme de la première mesure n'a pas été touché au passage");

    console.log('--- Same check via the mouse-drag resize path (onResizeEnd) ---');
    await page.evaluate(() => {
        const mk = (root, quality, beats, playStyle) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Test', chords: [mk('C', 'maj', 4, 'croche_maintenu'), mk('D', 'min', 4, 'held')] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    r = await page.evaluate(() => {
        const app = window.app;
        app.activeSection = 0;
        app.resize = { section: 0, index: 0, edge: 'right', startBeats: 4, startPrevBeats: null, lastDelta: 8 };
        // simule directement la fin d'un glissé (mouse) ayant déjà porté data.beats à 12 temps (3 mesures)
        const sections = JSON.parse(localStorage.getItem('myProgression'));
        sections.sections[0].chords[0].beats = 12;
        localStorage.setItem('myProgression', JSON.stringify(sections));
        app.onResizeEnd();
        const dataAfter = JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[0];
        const chordAfter = new Chord(dataAfter.root, dataAfter.quality, dataAfter.beats, 0, 'none', 4, null);
        const after = app.resolveSeqPatternForData(chordAfter, dataAfter);
        return { beatsAfter: dataAfter.beats, addedZoneAllOn: after.pattern.slice(16).every(s => s.length > 0) };
    });
    console.log(JSON.stringify(r));
    check(r.beatsAfter === 12 && r.addedZoneAllOn,
        `le chemin du glissé à la souris étend lui aussi en notes tenues — ${r.beatsAfter} temps, zone ajoutée tenue : ${r.addedZoneAllOn}`);

    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4b, 12/11, décision « réécriture courte ») : le petit séquenceur de l'inspecteur, où l'on étirait une note par son
    // BORD et où un glissé depuis son MILIEU ne devait plus la couper, a quitté l'ordinateur. Le séquenceur du bloc « Vues » n'a ni poignée de bord ni déplacement
    // (cahier, « Ce qui disparaît ») : une note longue est faite de croches soudées, qu'on peint d'un glissé. Le banc vérifie que la porte a disparu ET que ces gestes-là
    // fonctionnent : peindre plusieurs croches d'une seule annulation (remplace l'étirement au bord), poser une croche sur une case vide (non-régression d'origine).
    console.log('=== 3. Plus de petit séquenceur ; une note longue se peint, une case vide se remplit ===');
    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Test', chords: [mk('C', 'maj7', 4)] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(600);
    const porte = await R.porteInspecteurAbsente(page, 0, 0);
    check(porte.ok, `plus de porte « Séquenceur » ni de petit séquenceur dans l'inspecteur (${porte.detail})`);
    await R.ouvrirNouveau(page);
    const peint = await R.peindre(page, 0);
    check(peint.ok, `un glissé peint une note longue (croches soudées), d'une seule annulation — remplace l'étirement par le bord (${peint.detail})`);
    const pose = await R.poserCroche(page, 0);
    check(pose.ok, `poser une croche sur une case VIDE la remplit bien, Ctrl+Z la retire (${pose.detail})`);

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
