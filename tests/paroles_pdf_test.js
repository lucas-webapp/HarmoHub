const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
const fs = require('fs');

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

const SAMPLE = {
    version: 1, song: 'Chanson PDF Test', songId: 'pdf-test-1', beatsPerBar: 4,
    sections: [
        { title: 'Couplet', chords: [{ symbol: 'C', beats: 4 }, { symbol: 'G', beats: 4 }, { symbol: 'Am', beats: 4 }, { symbol: 'F', beats: 4 }] },
        { title: 'Refrain', chords: [{ symbol: 'F', beats: 4 }, { symbol: 'C', beats: 4 }] },
    ],
};
const SAMPLE_PATH = 'sample_pdf.json';
fs.writeFileSync(SAMPLE_PATH, JSON.stringify(SAMPLE, null, 2));

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

    await page.goto(`${BASE}/paroles.html`);
    await page.waitForTimeout(300);
    await page.setInputFiles('#file-input', SAMPLE_PATH);
    await page.waitForTimeout(200);

    const text1 = await page.$('.section-block:nth-child(1) .lyrics-text');
    await text1.click();
    await page.keyboard.type('Premiere ligne du couplet');
    await page.waitForTimeout(150);

    // Pose un accord sur cette ligne.
    const chip = await page.$('.section-block:nth-child(1) .chord-chip:nth-child(1)');
    await chip.click();
    await page.waitForTimeout(80);
    const box = await page.evaluate(() => {
        const el = document.querySelectorAll('.lyrics-text')[0];
        const r = el.getBoundingClientRect();
        return { x: r.left + 10, y: r.top + r.height / 2 };
    });
    await page.mouse.click(box.x, box.y);
    await page.waitForTimeout(150);
    await page.keyboard.press('Escape');

    // Vérifie que le bouton existe bien et n'est plus "Imprimer".
    const btn = await page.$('#btn-export-pdf');
    check(!!btn, 'le bouton #btn-export-pdf existe (remplace #btn-print)');
    const oldBtn = await page.$('#btn-print');
    check(!oldBtn, "l'ancien #btn-print n'existe plus");

    // Déclenche l'export PDF et attend le téléchargement.
    const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 45000 }), // le sandbox de test bloque les polices Google (ERR_CONNECTION_RESET), ce qui ralentit html2canvas le temps que la requête échoue — sans rapport avec une vraie connexion internet
        page.click('#btn-export-pdf'),
    ]);
    check(!!download, "l'export PDF déclenche bien un téléchargement");
    const suggestedName = download.suggestedFilename();
    check(suggestedName.includes('Chanson PDF Test') && suggestedName.endsWith('.pdf'), `le nom du fichier est correct — obtenu "${suggestedName}"`);

    const savePath = 'exported_test.pdf';
    await download.saveAs(savePath);
    const stats = fs.statSync(savePath);
    check(stats.size > 1000, `le PDF généré n'est pas vide — obtenu ${stats.size} octets`);

    // Le mode pdf-export-mode doit être retiré après l'export (pas de résidu visuel).
    await page.waitForTimeout(200);
    const hasExportModeAfter = await page.evaluate(() => document.body.classList.contains('pdf-export-mode'));
    check(!hasExportModeAfter, "la classe .pdf-export-mode est bien retirée après l'export");
    const btnReenabled = !(await page.isDisabled('#btn-export-pdf'));
    check(btnReenabled, "le bouton d'export est réactivé après l'export");

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
