const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.
const fs = require('fs');

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

const SAMPLE = {
    version: 1,
    song: 'Ma Chanson Test',
    beatsPerBar: 4,
    sections: [
        { title: 'Couplet', chords: [{ symbol: 'C', beats: 4 }, { symbol: 'G', beats: 4 }, { symbol: 'Am', beats: 4 }, { symbol: 'F', beats: 4 }] },
        { title: 'Refrain', chords: [{ symbol: 'F', beats: 4 }, { symbol: 'C', beats: 4 }] },
    ],
};
const SAMPLE_PATH = 'sample_paroles_export.json';
fs.writeFileSync(SAMPLE_PATH, JSON.stringify(SAMPLE, null, 2));

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', msg => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console: ' + msg.text()); });
    page.on('dialog', async d => { console.log('dialog:', d.message()); await d.accept(); });

    await page.goto(`${BASE}/paroles.html`);
    await page.waitForTimeout(300);

    // === 1. État initial ===
    check(await page.isVisible('#empty-state'), "l'état vide s'affiche avant tout import");
    check(!(await page.isVisible('#toolbar')), 'la barre d\'outils est cachée avant import');

    // === 2. Import ===
    await page.setInputFiles('#file-input', SAMPLE_PATH);
    await page.waitForTimeout(300);
    check(!(await page.isVisible('#empty-state')), "l'état vide disparaît après import");
    check(await page.isVisible('#toolbar'), "la barre d'outils apparaît après import");
    const songName = await page.textContent('#song-name');
    check(songName.includes('Ma Chanson Test'), `le nom du morceau est affiché — obtenu "${songName}"`);

    const sectionCount = await page.$$eval('.section-block', els => els.length);
    check(sectionCount === 2, `2 parties affichées — obtenu ${sectionCount}`);
    const chipCounts = await page.$$eval('.section-block', els => els.map(el => el.querySelectorAll('.chord-chip').length));
    console.log('chipCounts:', JSON.stringify(chipCounts));
    check(chipCounts[0] === 4 && chipCounts[1] === 2, `nombre de pastilles d'accords correct par partie — obtenu ${JSON.stringify(chipCounts)}`);

    // === 3. Armement + pose en mode syllabe ===
    // Écrit des paroles dans la 1ère partie.
    const text0 = await page.$('.lyrics-wrap:nth-of-type(1) .lyrics-text, .section-block:nth-child(1) .lyrics-text');
    const textEls = await page.$$('.lyrics-text');
    await textEls[0].click();
    await page.keyboard.type('Hello darkness my old friend');
    await page.waitForTimeout(200);

    // Re-requête les pastilles à chaque étape : armChord()/placeArmedAt() reconstruisent le pool
    // (renderPool -> pool.innerHTML = '') à chaque action, un handle Playwright gardé d'avant devient
    // un élément détaché (son .className resterait figé sur l'ancien état, pas le nouveau).
    const chip = (si, i) => page.$(`.section-block:nth-child(${si}) .chord-chip:nth-child(${i})`);

    await (await chip(1, 1)).click();
    await page.waitForTimeout(100);
    const armedClass = await (await chip(1, 1)).evaluate(el => el.className);
    check(armedClass.includes('armed'), "le 1er accord cliqué devient 'armé' (classe armed)");
    const hintVisible = await page.isVisible('#armed-hint');
    check(hintVisible, "l'indice d'armement s'affiche");

    // Clique au milieu du mot "darkness" pour poser l'accord.
    const wordBox = await page.evaluate(() => {
        const textEl = document.querySelectorAll('.lyrics-text')[0];
        const idx = textEl.textContent.indexOf('darkness') + 3; // vise "kness", en plein milieu du mot
        const range = document.createRange();
        const node = textEl.firstChild;
        range.setStart(node, idx);
        range.collapse(true);
        const rect = range.getClientRects()[0] || range.getBoundingClientRect();
        return { x: rect.left, y: rect.top + rect.height / 2 };
    });
    await page.mouse.click(wordBox.x, wordBox.y);
    await page.waitForTimeout(200);

    const pillsAfterPlace = await page.$$eval('.section-block:nth-child(1) .lyric-pill', els => els.length);
    check(pillsAfterPlace === 1, `une pastille apparaît après la pose — obtenu ${pillsAfterPlace}`);
    // CONTRAT MIS À JOUR. Poser ne désarme toujours pas — on garde toujours quelque chose en main —
    // mais c'est désormais l'accord SUIVANT de la partie qui s'arme, et non le même (voir prefs.chain
    // dans paroles.js). Les accords d'une grille se posent dans l'ordre où on les joue : enchaîner
    // fait tomber le coût d'un accord de deux clics à un seul, mesuré 16 clics -> 9 sur huit accords.
    // Le mode tampon d'origine reste accessible en décochant « Enchaîner les accords » (testé plus bas
    // dans paroles_stamp_test.js).
    const chipPlacedClass = await (await chip(1, 1)).evaluate(el => el.className);
    const chipNextClass = await (await chip(1, 2)).evaluate(el => el.className);
    check(chipPlacedClass.includes('placed') && !chipPlacedClass.includes('armed'),
        "l'accord posé passe en 'placed' et rend la main");
    check(chipNextClass.includes('armed'), "...et c'est l'accord SUIVANT de la partie qui s'arme tout seul");
    check(await page.isVisible('#armed-hint'), "l'indice d'armement reste affiché après la pose (on peut en reposer d'autres)");
    await page.keyboard.press('Escape'); // termine explicitement ce tampon avant de passer au mode libre
    await page.waitForTimeout(100);

    // === 4. Mode libre ===
    await page.click('#mode-free');
    await page.waitForTimeout(100);
    check((await page.getAttribute('#mode-free', 'class')).includes('active'), 'le mode "libre" est bien actif après clic');
    await (await chip(1, 2)).click();
    await page.waitForTimeout(100);
    const wrapBox = await page.$eval('.section-block:nth-child(1) .lyrics-wrap', el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width * 0.9, y: r.top + 5 }; });
    await page.mouse.click(wrapBox.x, wrapBox.y);
    await page.waitForTimeout(200);
    const freePillCount = await page.$$eval('.section-block:nth-child(1) .lyric-pill', els => els.length);
    check(freePillCount === 2, `2 pastilles au total après la pose libre — obtenu ${freePillCount}`);

    // === 5. Suppression d'une pastille ===
    const delBtn = await page.$('.section-block:nth-child(1) .lyric-pill .pill-del');
    await delBtn.click();
    await page.waitForTimeout(200);
    const afterDelCount = await page.$$eval('.section-block:nth-child(1) .lyric-pill', els => els.length);
    check(afterDelCount === 1, `1 pastille restante après suppression — obtenu ${afterDelCount}`);

    // === 6. Échap annule un armement ===
    await (await chip(1, 3)).click();
    await page.waitForTimeout(100);
    check((await (await chip(1, 3)).evaluate(el => el.className)).includes('armed'), 'le 3e accord est bien armé avant test Échap');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    check(!(await (await chip(1, 3)).evaluate(el => el.className)).includes('armed'), "Échap désarme bien l'accord en cours");

    // === 7. Cliquer un accord DÉJÀ armé le garde armé, et le bouton « Arrêter » le relâche ===
    // Depuis l'enchaînement, un accord peut être armé sans qu'on l'ait cliqué : recliquer dessus veut
    // dire « c'est bien celui-là », plus jamais « laisse tomber » — sans quoi on cliquait l'accord
    // voulu, puis dans le texte, et rien ne se posait.
    await (await chip(1, 3)).click();
    await page.waitForTimeout(80);
    await (await chip(1, 3)).click();
    await page.waitForTimeout(80);
    check((await (await chip(1, 3)).evaluate(el => el.className)).includes('armed'),
        'recliquer un accord déjà armé le laisse armé au lieu de le relâcher');
    check(await page.isVisible('#hint-stop'), 'un bouton « Arrêter » est proposé (seule sortie possible au doigt)');
    await page.click('#hint-stop');
    await page.waitForTimeout(120);
    check(!(await (await chip(1, 3)).evaluate(el => el.className)).includes('armed'),
        '...et ce bouton relâche bien l\'accord en main');
    check(!(await page.isVisible('#armed-hint')), "l'indice disparaît après Échap");

    // === 7. Persistance : réimporte le même fichier, vérifie que la pastille posée est toujours là ===
    // Attend PLUS LONGTEMPS que le délai anti-rebond de saveSession (350ms) : chaque action ci-dessus
    // annule la sauvegarde encore en attente de la précédente (voir clearTimeout dans saveSession), donc
    // seule celle programmée par la TOUTE DERNIÈRE action a une chance d'aboutir — sans cette marge, le
    // réimport peut se déclencher avant qu'elle n'ait eu le temps de s'écrire, selon la charge machine.
    await page.waitForTimeout(500);
    await page.setInputFiles('#file-input', SAMPLE_PATH);
    await page.waitForTimeout(300);
    const pillsAfterReimport = await page.$$eval('.section-block:nth-child(1) .lyric-pill', els => els.length);
    check(pillsAfterReimport === 1, `après réimport du même morceau, la pastille posée est bien restaurée — obtenu ${pillsAfterReimport}`);
    const textAfterReimport = await page.$eval('.lyrics-text', el => el.textContent);
    check(textAfterReimport.includes('Hello darkness'), 'les paroles tapées sont bien restaurées après réimport');

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
