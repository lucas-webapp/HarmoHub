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
    for (const sym of ['C', 'G']) {
        await page.fill('#quick-add-input', sym).catch(() => {});
        await page.click('#quick-add-btn').catch(() => {});
        await page.waitForTimeout(120);
    }

    const [download, newPage] = await Promise.all([
        page.waitForEvent('download', { timeout: 10000 }),
        context.waitForEvent('page', { timeout: 10000 }),
        ouvrirParoles(page),
    ]).catch(async () => {
        const nameInput = await page.$('input:visible');
        if (nameInput) { await nameInput.fill('Test Autoload'); await page.keyboard.press('Enter'); }
        return Promise.all([
            page.waitForEvent('download', { timeout: 10000 }),
            context.waitForEvent('page', { timeout: 10000 }),
            ouvrirParoles(page),
        ]);
    });
    check(!!download && !!newPage, "l'export déclenche bien le téléchargement + l'ouverture d'un onglet");
    await newPage.waitForLoadState();
    await newPage.waitForTimeout(300);

    // === 1. Auto-chargement : plus besoin de réimporter ===
    check(!(await newPage.isVisible('#empty-state')), "l'état vide n'apparaît PAS — le morceau se charge automatiquement");
    check(await newPage.isVisible('#toolbar'), 'la barre d\'outils apparaît directement, sans import manuel');
    const chipCount = await newPage.$$eval('.chord-chip', els => els.length);
    check(chipCount === 2, `les 2 accords du morceau apparaissent directement dans Paroles — obtenu ${chipCount}`);

    // Vérifie que la clé de transfert est bien consommée (pas de réimport fantôme à la prochaine visite
    // "normale" hors export, ex. un onglet ouvert à la main plus tard dans la session).
    const pendingKeyGone = await newPage.evaluate(() => localStorage.getItem('harmohub_lyrics_pending_import') === null);
    check(pendingKeyGone, "la clé de transfert est bien retirée après consommation (pas de réimport fantôme)");

    // === 2. Bouton retour vers HarmoHub ===
    const backLink = await newPage.$('a.btn-back');
    check(!!backLink, 'un lien "retour vers HarmoHub" est présent dans Paroles');
    const href = await backLink.evaluate(el => el.getAttribute('href'));
    check(href === 'index.html', `le lien de retour pointe bien vers index.html — obtenu "${href}"`);

    // Le bouton retour doit rester visible même après avoir défilé loin dans la page (sticky).
    await newPage.evaluate(() => window.scrollTo(0, 2000));
    await newPage.waitForTimeout(150);
    const backVisible = await backLink.isVisible();
    check(backVisible, 'le lien de retour reste visible après un défilement (sticky)');

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
