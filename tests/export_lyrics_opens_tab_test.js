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
const ouvrirParoles = (page) => page.click('#lyrics-btn');

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

    const [download, newPage] = await Promise.all([
        page.waitForEvent('download', { timeout: 10000 }),
        context.waitForEvent('page', { timeout: 10000 }),
        ouvrirParoles(page),
    ]).catch(async () => {
        const nameInput = await page.$('input:visible');
        if (nameInput) { await nameInput.fill('Test Onglet'); await page.keyboard.press('Enter'); }
        return Promise.all([
            page.waitForEvent('download', { timeout: 10000 }),
            context.waitForEvent('page', { timeout: 10000 }),
            ouvrirParoles(page),
        ]);
    });

    check(!!download, 'le téléchargement du JSON se déclenche toujours');
    check(!!newPage, "un nouvel onglet s'ouvre automatiquement après l'export");
    await newPage.waitForLoadState();
    check(newPage.url().includes('paroles.html'), `le nouvel onglet pointe bien vers paroles.html — obtenu ${newPage.url()}`);
    // Depuis l'ajout de l'auto-import (voir tryAutoImportFromHarmoHub dans paroles.js, tâche #82),
    // le nouvel onglet charge directement le morceau exporté au lieu d'afficher l'invite à importer —
    // ce test date d'avant cette fonctionnalité, l'assertion suit donc désormais le comportement voulu.
    const emptyStateVisible = await newPage.isVisible('#empty-state');
    check(!emptyStateVisible, "l'onglet Paroles charge directement le morceau exporté (pas d'état d'accueil, auto-import)");
    const toolbarVisible = await newPage.isVisible('#toolbar');
    check(toolbarVisible, "la barre d'outils Paroles est bien visible, le morceau est chargé automatiquement");

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
