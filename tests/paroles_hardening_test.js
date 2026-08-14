const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
const fs = require('fs');

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

const SAMPLE = {
    version: 1,
    song: 'Chanson Robuste',
    songId: 'song-abc-123',
    beatsPerBar: 4,
    sections: [
        { title: 'Couplet', chords: [{ symbol: 'C', beats: 4 }, { symbol: 'G', beats: 4 }] },
    ],
};
const SAMPLE_PATH = 'sample_hardening.json';
fs.writeFileSync(SAMPLE_PATH, JSON.stringify(SAMPLE, null, 2));

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 }, acceptDownloads: true });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('dialog', async d => { await d.accept(); });

    await page.goto(`${BASE}/paroles.html`);
    await page.waitForTimeout(300);

    // === 1. Import + statut d'enregistrement ===
    await page.setInputFiles('#file-input', SAMPLE_PATH);
    await page.waitForTimeout(200);
    check(await page.isVisible('#btn-export-text'), 'le bouton "Exporter en texte" apparaît après import');

    const textEls = await page.$$('.lyrics-text');
    await textEls[0].click();
    await page.keyboard.type('Bonjour le monde');
    await page.waitForTimeout(600); // laisse le debounce + l'écriture localStorage se faire

    const status1 = await page.textContent('#save-status');
    console.log('statut après frappe:', status1);
    check(/Enregistré/.test(status1), `le statut affiche bien "Enregistré" après une modification — obtenu "${status1}"`);

    // === 2. Clé de session basée sur songId (pas juste le nom) ===
    const storedKeys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('harmohub_lyrics_v1_')));
    console.log('clés localStorage:', JSON.stringify(storedKeys));
    check(storedKeys.some(k => k.includes('id-song-abc-123')), `la session est bien stockée sous une clé basée sur songId — obtenu ${JSON.stringify(storedKeys)}`);

    // === 3. Réimport : les paroles doivent revenir (même songId) ===
    await page.setInputFiles('#file-input', SAMPLE_PATH);
    await page.waitForTimeout(300);
    const restoredText = await page.$eval('.lyrics-text', el => el.textContent);
    check(restoredText.includes('Bonjour le monde'), 'les paroles sont bien restaurées après réimport (clé par songId)');

    // === 4. Bouton réinitialiser une partie ===
    check(await page.isVisible('.btn-reset-section'), 'le bouton "Réinitialiser" est présent par partie');
    await page.click('.btn-reset-section');
    await page.waitForTimeout(300);
    const textAfterReset = await page.$eval('.lyrics-text', el => el.textContent);
    check(textAfterReset.trim() === '', `le texte est bien vidé après réinitialisation — obtenu "${textAfterReset}"`);

    // === 5. Export texte ===
    // Retape un peu de texte + pose un accord pour un export non trivial.
    await (await page.$('.lyrics-text')).click();
    await page.keyboard.type('Nouvelles paroles ici');
    await page.waitForTimeout(200);
    const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 5000 }),
        page.click('#btn-export-text'),
    ]);
    const dlPath = await download.path();
    const txt = fs.readFileSync(dlPath, 'utf8');
    console.log('export texte:\n' + txt);
    check(txt.includes('Chanson Robuste'), "l'export texte contient bien le titre du morceau");
    check(txt.includes('Accords : C, G'), "l'export texte liste bien les accords de la partie");
    check(txt.includes('Nouvelles paroles ici'), "l'export texte contient bien les paroles tapées");

    // === 6. Session corrompue : avertissement visible, pas de plantage ===
    await page.evaluate(() => {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('harmohub_lyrics_v1_id-'));
        keys.forEach(k => localStorage.setItem(k, '{ ceci n\'est pas du JSON valide'));
    });
    await page.setInputFiles('#file-input', SAMPLE_PATH);
    await page.waitForTimeout(300);
    const bannerVisible = await page.isVisible('.banner-error');
    check(bannerVisible, "un bandeau d'erreur visible apparaît quand la session sauvegardée est corrompue (pas juste la console)");
    check(errors.length === 0, `aucune erreur JS non gérée (page toujours fonctionnelle) — obtenu ${JSON.stringify(errors)}`);
    const stillWorks = await page.isVisible('#toolbar');
    check(stillWorks, "l'outil reste utilisable malgré la session corrompue (repart d'une page vierge)");

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
