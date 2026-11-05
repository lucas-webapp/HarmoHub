const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

// CONTRAT CHANGÉ (1) : les six boutons d'export (PDF, MIDI, MP3, Paroles, sauvegarde, import MIDI)
// avaient fusionné dans un seul bouton « Fichier » qui ouvre un menu de lignes nommées — six icônes
// muettes de 26px alignées côte à côte se ressemblaient toutes et ne disaient pas ce qu'elles
// faisaient.
// CONTRAT CHANGÉ (2) : Paroles est ressorti de ce menu dans son propre bouton (#lyrics-btn), retour
// utilisateur — "il n'a pas trop sa place dans le bouton fichiers".
const actionFichier = async (page, id) => {
    await page.click('#file-menu-btn');
    await page.waitForSelector(`[data-file-action="${id}"]`, { timeout: 3000 });
    await page.click(`[data-file-action="${id}"]`);
};
// CONTRAT CHANGÉ (3), refonte lot 4b : sur ORDINATEUR l'onglet Paroles ouvre la vue INTÉGRÉE (dans la page, sans fichier ni nouvel onglet) ;
// le banc était passé au format téléphone, qui gardait l'export (fichier .json téléchargé + page ouverte dans un nouvel onglet).
// CONTRAT CHANGÉ (4), refonte lot 10b : le téléphone a lui aussi la vue intégrée, au-dessus de sa barre de lecture. Le geste « fichier + nouvel
// onglet » n'existe plus à aucune largeur (le fichier .json reste produit par l'export intégral du menu Fichier). Ce que les accords deviennent
// chez Paroles passe par le MÊME dépôt qu'avant (harmohub_lyrics_pending_import, voir donneesParoles) : le banc garde le format téléphone et son
// geste — l'onglet Paroles —, nomme le morceau par la vue quand il n'a pas de nom (les paroles lui sont attachées), et rend le cadre de la vue.
const ouvrirParoles = async (page) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await page.waitForTimeout(150);
    await page.click('#lyrics-btn');
    await page.waitForTimeout(400);
    if (await page.isVisible('#vue-paroles-vide')) {
        await page.click('#vue-paroles-nommer');
        const champ = await page.waitForSelector('input:visible', { timeout: 3000 });
        await champ.fill('Chanson Test Paroles');
        await page.keyboard.press('Enter');
    }
    for (let i = 0; i < 80; i++) {
        const cadre = page.frames().find(f => /paroles\.html\?integre=1/.test(f.url()));
        if (cadre && await cadre.evaluate(() => document.readyState === 'complete' && document.querySelectorAll('.chord-chip').length > 0)) return cadre;
        await page.waitForTimeout(100);
    }
    return null;
};
// Le dépôt est CONSOMMÉ par la vue dès son chargement : on le relit au moment où HarmoHub l'écrit (lecture seule, rien n'est déclenché).
const ESPION_DEPOT = () => { const ecrire = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'harmohub_lyrics_pending_import' && window === window.top) window.__depotParoles = v; return ecrire.apply(this, arguments); }; };

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(600);
    await page.waitForTimeout(150);
    await page.fill('#quick-add-input', 'C').catch(() => {});
    await page.click('#quick-add-btn').catch(() => {});
    await page.waitForTimeout(150);

    // CHANGÉ DE SENS AU LOT 10b (voir l'en-tête) : ni téléchargement ni nouvel onglet — Paroles s'ouvre DANS la page, au-dessus de la barre de lecture.
    let onglets = 0, fichiers = 0;
    context.on('page', () => { onglets++; });
    page.on('download', () => { fichiers++; });
    const cadre = await ouvrirParoles(page);
    check(fichiers === 0, `plus de fichier .json téléchargé en ouvrant Paroles — il reste à l'export intégral (${fichiers})`);
    check(onglets === 0 && !!cadre, `pas de nouvel onglet : Paroles s'ouvre en vue intégrée, dans la page (${onglets} onglet)`);
    check(!!cadre && /paroles\.html\?integre=1/.test(cadre.url()), `la vue charge bien paroles.html, en mode intégré — obtenu ${cadre && cadre.url()}`);
    // Depuis l'ajout de l'auto-import (voir tryAutoImportFromHarmoHub dans paroles.js, tâche #82), Paroles charge directement le morceau au lieu
    // d'afficher l'invite à importer — dans la vue comme jadis dans l'onglet.
    const emptyStateVisible = await cadre.isVisible('#empty-state');
    check(!emptyStateVisible, "la vue Paroles charge directement le morceau (pas d'état d'accueil, auto-import)");
    const toolbarVisible = await cadre.isVisible('#toolbar');
    check(toolbarVisible, "la barre d'outils Paroles est bien visible, le morceau est chargé automatiquement");

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
