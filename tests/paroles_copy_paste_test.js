const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.
//
// Couvre la demande utilisateur du 12/08 : "peux tu me permettre de copier coller rapidement du
// texte dans ce module en respectant les passages à la ligne du texte copié ? J'aimerais également
// pouvoir copier le texte écrit dans le module, si je veux le mettre dans un word à part."
const fs = require('fs');

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

const SAMPLE = {
    version: 1,
    song: 'Chanson Copier-Coller',
    beatsPerBar: 4,
    sections: [
        { title: 'Couplet', chords: [{ symbol: 'C', beats: 4 }, { symbol: 'G', beats: 4 }] },
    ],
};
const SAMPLE_PATH = 'sample_copy_paste.json';
fs.writeFileSync(SAMPLE_PATH, JSON.stringify(SAMPLE, null, 2));

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1000, height: 900 } });
    // Nécessaire pour lire/écrire le presse-papiers OS depuis la page (navigator.clipboard) — sans
    // ça Chromium refuse silencieusement, et Ctrl+V/le bouton copier ne feraient jamais rien ici.
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', msg => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_PROXY_CONNECTION_FAILED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console: ' + msg.text()); });

    await page.goto(`${BASE}/paroles.html`);
    await page.waitForTimeout(300);
    await page.setInputFiles('#file-input', SAMPLE_PATH);
    await page.waitForTimeout(300);

    console.log('--- A. Coller du texte multi-lignes respecte les passages à la ligne ---');
    const textEl = (await page.$$('.lyrics-text'))[0];
    await textEl.click();
    const collé = 'Premier vers\nDeuxième vers\nTroisième vers';
    await page.evaluate((s) => navigator.clipboard.writeText(s), collé);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(200);
    const innerTextApresColle = await textEl.evaluate(el => el.innerText);
    console.log('texte après collage:', JSON.stringify(innerTextApresColle));
    const lignes = innerTextApresColle.split('\n').map(l => l.trim()).filter(Boolean);
    check(lignes.length === 3, `les 3 lignes collées sont bien séparées — obtenu ${lignes.length} ligne(s)`);
    check(lignes[0] === 'Premier vers' && lignes[1] === 'Deuxième vers' && lignes[2] === 'Troisième vers',
        `le contenu de chaque ligne est intact — obtenu ${JSON.stringify(lignes)}`);

    console.log('--- B. Coller un texte avec mise en forme ne garde que le texte brut ---');
    await textEl.evaluate(el => { el.innerHTML = ''; });
    await textEl.click();
    await page.evaluate(async () => {
        const item = new ClipboardItem({
            'text/plain': new Blob(['Sans mise en forme'], { type: 'text/plain' }),
            'text/html': new Blob(['<span style="color:red;font-family:Georgia;font-size:32px;background:yellow">Sans mise en forme</span>'], { type: 'text/html' }),
        });
        await navigator.clipboard.write([item]);
    });
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(200);
    const styleApresColle = await textEl.evaluate(el => {
        const span = el.querySelector('span[style]');
        return { hasStyledSpan: !!span, text: el.innerText.trim() };
    });
    console.log('après collage avec mise en forme:', JSON.stringify(styleApresColle));
    check(!styleApresColle.hasStyledSpan, 'aucune mise en forme collée (pas de span stylé injecté)');
    check(styleApresColle.text === 'Sans mise en forme', `le texte lui-même est bien collé — obtenu "${styleApresColle.text}"`);

    console.log('--- C. Bouton copier : reprend le presse-papiers avec le texte du module ---');
    // Repart d'un texte connu, propre, pour vérifier le contenu copié sans ambiguïté.
    await textEl.evaluate(el => { el.innerHTML = ''; });
    await textEl.click();
    await page.keyboard.type('Refrain qui revient');
    await page.waitForTimeout(200);

    check(await page.isVisible('#btn-copy-text'), 'le bouton "copier le texte" est bien visible une fois un morceau chargé');
    // Vide le presse-papiers d'abord, pour être sûr que ce qui suit vient bien du clic, pas d'un
    // résidu du collage précédent.
    await page.evaluate(() => navigator.clipboard.writeText(''));
    await page.click('#btn-copy-text');
    await page.waitForTimeout(200);
    const presseP = await page.evaluate(() => navigator.clipboard.readText());
    console.log('presse-papiers après clic:', JSON.stringify(presseP));
    check(presseP.includes('Chanson Copier-Coller'), 'le texte copié contient bien le titre du morceau');
    check(presseP.includes('Couplet'), 'le texte copié contient bien le nom de la partie');
    check(presseP.includes('Accords : C, G'), 'le texte copié contient bien les accords de la partie');
    check(presseP.includes('Refrain qui revient'), 'le texte copié contient bien les paroles tout juste tapées');

    console.log('--- D. Une bannière confirme la copie ---');
    const bannerText = await page.evaluate(() => {
        const b = document.querySelector('.banner');
        return b ? b.textContent : null;
    });
    console.log('bannière:', bannerText);
    check(!!bannerText && /copié/i.test(bannerText), `une bannière de confirmation apparaît — obtenu ${JSON.stringify(bannerText)}`);

    console.log('--- E. Le contenu copié est identique à celui du fichier .txt téléchargé ---');
    const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 5000 }),
        page.click('#btn-export-text'),
    ]);
    const p = await download.path();
    const fichierTxt = fs.readFileSync(p, 'utf8');
    check(fichierTxt === presseP, 'le fichier téléchargé et le presse-papiers contiennent EXACTEMENT le même texte');

    console.log('Errors:', JSON.stringify(errors));
    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
