const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
const fs = require('fs');

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

const SAMPLE = {
    version: 1, song: 'Chanson Flush', songId: 'flush-test-1', beatsPerBar: 4,
    sections: [{ title: 'Couplet', chords: [{ symbol: 'C', beats: 4 }] }],
};
const SAMPLE_PATH = 'sample_flush.json';
fs.writeFileSync(SAMPLE_PATH, JSON.stringify(SAMPLE, null, 2));

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page1 = await context.newPage();

    await page1.goto(`${BASE}/paroles.html`);
    await page1.waitForTimeout(300);
    await page1.setInputFiles('#file-input', SAMPLE_PATH);
    await page1.waitForTimeout(200);
    const t = await page1.$('.lyrics-text');
    await t.click();
    await page1.keyboard.type('Texte tapé juste avant fermeture');

    // Ferme la page à peine 100ms après la frappe — BIEN avant les 350ms du délai anti-rebond normal.
    await page1.waitForTimeout(100);
    // runBeforeUnload:true — par défaut Playwright saute complètement "beforeunload" lors d'un
    // page.close() programmatique ; il faut explicitement demander de le déclencher pour se rapprocher
    // d'une vraie fermeture d'onglet par l'utilisateur.
    await page1.close({ runBeforeUnload: true });

    // Nouvelle page, MÊME contexte (même origine -> même localStorage) : vérifie que le texte a bien
    // été sauvegardé malgré la fermeture quasi immédiate.
    const page2 = await context.newPage();
    await page2.goto(`${BASE}/paroles.html`);
    await page2.waitForTimeout(300);
    await page2.setInputFiles('#file-input', SAMPLE_PATH);
    await page2.waitForTimeout(300);
    const restored = await page2.$eval('.lyrics-text', el => el.textContent);
    console.log('texte restauré après fermeture quasi immédiate:', JSON.stringify(restored));
    check(restored.includes('Texte tapé juste avant fermeture'), "la sauvegarde est forcée à la fermeture de l'onglet (beforeunload), même moins de 350ms après la frappe");

    await browser.close();
    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    process.exit(FAIL > 0 ? 1 : 0);
})();
