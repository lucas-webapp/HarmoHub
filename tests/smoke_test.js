const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(800);

    console.log('--- After load ---');
    console.log('Errors so far:', JSON.stringify(errors, null, 2));

    const ids = await page.$$eval('button[id]', (els) => els.map(e => e.id));
    console.log('Button ids:', ids.slice(0, 40));

    await page.waitForTimeout(500);
    await browser.close();
    console.log('--- Final errors ---');
    console.log(JSON.stringify(errors, null, 2));
    process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
