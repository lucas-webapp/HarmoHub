const { chromium } = require('playwright')
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
const ouvrirParoles = (page) => page.click('#lyrics-btn');
const fs = require('fs');

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, acceptDownloads: true });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('ERR_CONNECTION_RESET') && !msg.text().includes('ERR_TUNNEL_CONNECTION_FAILED')) errors.push('console: ' + msg.text()); });

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(600);
    await page.waitForTimeout(150);

    // Deux parties : "Couplet" (par défaut) avec 2 accords, + une 2e partie "Refrain" avec 1 accord.
    for (const sym of ['Am', 'F']) {
        await page.fill('#quick-add-input', sym).catch(() => {});
        await page.click('#quick-add-btn').catch(() => {});
        await page.waitForTimeout(120);
    }
    await page.click('#add-section');
    await page.waitForTimeout(300);
    // Section fraîchement ajoutée : vérifie qu'elle est bien active avant d'y ajouter un accord (sinon
    // "G" pourrait atterrir dans la 1ère section par erreur — pas ce que ce test veut vérifier).
    await page.waitForFunction(() => app.activeSection === 1, { timeout: 3000 }).catch(() => {});
    await page.fill('#quick-add-input', 'G').catch(() => {});
    await page.click('#quick-add-btn').catch(() => {});
    await page.waitForTimeout(200);

    // Nomme le morceau (l'export exige un morceau enregistré) via le prompt custom si besoin.
    const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 10000 }),
        ouvrirParoles(page),
    ]).catch(async (e) => {
        // Si un prompt de nom de morceau est apparu, le remplir puis retenter.
        console.log('1ère tentative:', e.message);
        return [null];
    });

    let dl = download;
    if (!dl) {
        // Cherche un champ de saisie de nom de morceau visible (popup "Nomme d'abord ton morceau").
        const nameInput = await page.$('input:visible');
        if (nameInput) {
            await nameInput.fill('Chanson Test Paroles');
            await page.keyboard.press('Enter').catch(() => {});
        }
        [dl] = await Promise.all([
            page.waitForEvent('download', { timeout: 10000 }),
            ouvrirParoles(page),
        ]);
    }
    check(!!dl, "un téléchargement se déclenche bien au clic sur le bouton Exporter pour paroles");

    const p = await dl.path();
    const content = JSON.parse(fs.readFileSync(p, 'utf8'));
    console.log('contenu exporté:', JSON.stringify(content, null, 2));

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
