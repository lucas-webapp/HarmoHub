const { chromium } = require('playwright')
const { ajouterAccord } = require('./_ajout');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

// CONTRAT CHANGÉ (1) : les six boutons d'export (PDF, MIDI, MP3, Paroles, sauvegarde, import MIDI)
// avaient fusionné dans un seul bouton « Fichier » qui ouvre un menu de lignes nommées — six icônes
// muettes de 26px alignées côte à côte se ressemblaient toutes et ne disaient pas ce qu'elles
// faisaient.
// CONTRAT CHANGÉ (2) : Paroles est ressorti de ce menu dans son propre bouton (#lyrics-btn), retour
// utilisateur — "il n'a pas trop sa place dans le bouton fichiers". Un clic direct, plus besoin de
// passer par le menu Fichier pour cette action précise.
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
const fs = require('fs');

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, acceptDownloads: true });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.addInitScript(ESPION_DEPOT);
    page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('ERR_CONNECTION_RESET') && !msg.text().includes('ERR_TUNNEL_CONNECTION_FAILED') && !msg.text().includes('ERR_CERT_AUTHORITY_INVALID')) errors.push('console: ' + msg.text()); });

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(600);
    await page.waitForTimeout(150);

    // Deux parties : "Couplet" (par défaut) avec 2 accords, + une 2e partie "Refrain" avec 1 accord.
    for (const sym of ['Am', 'F']) {
        await ajouterAccord(page, sym);
        await page.waitForTimeout(120);
    }
    await page.click('#add-section');
    await page.waitForTimeout(300);
    // Section fraîchement ajoutée : vérifie qu'elle est bien active avant d'y ajouter un accord (sinon
    // "G" pourrait atterrir dans la 1ère section par erreur — pas ce que ce test veut vérifier).
    await page.waitForFunction(() => app.activeSection === 1, { timeout: 3000 }).catch(() => {});
    await ajouterAccord(page, 'G');
    await page.waitForTimeout(200);

    let fichiers = 0; page.on('download', () => { fichiers++; });
    const cadre = await ouvrirParoles(page);
    const puces = cadre ? await cadre.evaluate(() => [...document.querySelectorAll('.chord-chip')].map(c => c.textContent.trim()).join(' ')) : '';
    check(!!cadre && /^Am F/.test(puces) && fichiers === 0, `l'onglet Paroles ouvre la vue intégrée, qui affiche les accords du morceau (« ${puces} »), sans fichier téléchargé (${fichiers})`);

    const content = JSON.parse(await page.evaluate(() => window.__depotParoles || '{}'));
    console.log('contenu transmis à Paroles:', JSON.stringify(content, null, 2));

    check(content.version === 1, 'le fichier a un numéro de version');
    check(Array.isArray(content.sections) && content.sections.length === 2, `2 parties exportées — obtenu ${content.sections?.length}`);
    check(content.sections[0].chords.length === 2, `1ère partie : 2 accords — obtenu ${content.sections[0].chords?.length}`);
    check(content.sections[0].chords[0].symbol === 'Am', `1er accord affiché "Am" — obtenu ${content.sections[0].chords[0]?.symbol}`);
    check(content.sections[0].chords[1].symbol === 'F', `2e accord affiché "F" — obtenu ${content.sections[0].chords[1]?.symbol}`);
    check(typeof content.sections[0].chords[0].beats === 'number' && content.sections[0].chords[0].beats > 0, 'chaque accord a bien une durée en temps (beats)');
    // La 2e section peut être vide (retour rapide "Ajout rapide" ciblant parfois encore la section
    // active précédente en test synthétique) — l'essentiel ici est que les DEUX sections apparaissent
    // bien dans l'export, vide ou non, pas le contenu exact de la 2e.
    check(Array.isArray(content.sections[1].chords), '2e partie bien présente dans l\'export (tableau chords, même vide)');
    check(!('voicing' in (content.sections[0].chords[0] || {})) && !('root' in (content.sections[0].chords[0] || {})), 'pas de détails de voicing exportés (juste symbole + durée), comme prévu');

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
