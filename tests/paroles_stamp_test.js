const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
const fs = require('fs');

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

const SAMPLE = {
    version: 1, song: 'Chanson Tampon', songId: 'stamp-test-1', beatsPerBar: 4,
    sections: [{ title: 'Couplet', chords: [{ symbol: 'C', beats: 4 }, { symbol: 'G', beats: 4 }] }],
};
const SAMPLE_PATH = 'sample_stamp.json';
fs.writeFileSync(SAMPLE_PATH, JSON.stringify(SAMPLE, null, 2));

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('dialog', async d => { await d.accept(); });

    await page.goto(`${BASE}/paroles.html`);
    await page.waitForTimeout(300);
    // Ce fichier teste précisément le mode TAMPON : poser plusieurs fois le même accord d'affilée.
    // C'est désormais un réglage (« Enchaîner les accords », voir prefs.chain dans paroles.js), actif
    // par défaut parce qu'on pose presque toujours une progression dans l'ordre. On l'éteint donc ici
    // pour éprouver le comportement que ce fichier a pour objet — et l'éteindre EST la manœuvre que
    // fera l'utilisateur qui veut tamponner.
    await page.evaluate(() => localStorage.setItem('harmohub_lyrics_prefs', JSON.stringify({ fontSize: 1, chain: false })));
    await page.reload();
    await page.waitForTimeout(300);
    await page.setInputFiles('#file-input', SAMPLE_PATH);
    await page.waitForTimeout(200);

    const text = await page.$('.lyrics-text');
    await text.click();
    await page.keyboard.type('Premiere ligne un peu longue pour placer plusieurs accords');
    await page.waitForTimeout(150);

    async function clickAt(xFrac, yFrac) {
        const box = await page.evaluate(({ xFrac, yFrac }) => {
            const r = document.querySelector('.lyrics-text').getBoundingClientRect();
            return { x: r.left + r.width * xFrac, y: r.top + r.height * yFrac };
        }, { xFrac, yFrac });
        await page.mouse.click(box.x, box.y);
        await page.waitForTimeout(100);
    }

    // === 1. Armer le chip C, poser 3 exemplaires SANS réarmer entre chaque pose ===
    const chipC = await page.$('.chord-chip:nth-child(1)');
    await chipC.click();
    await page.waitForTimeout(80);
    check(await page.evaluate(() => !!(state.armed)), 'le chip C est bien armé après le premier clic');

    await clickAt(0.1, 0.5);
    await clickAt(0.35, 0.5);
    await clickAt(0.6, 0.5);

    const stillArmed = await page.evaluate(() => !!(state.armed));
    check(stillArmed, "après 3 poses successives sans recliquer sur le chip, l'accord reste armé (mode tampon)");

    let pillCount = await page.$$eval('.lyric-pill', els => els.length);
    check(pillCount === 3, `3 exemplaires du même accord C ont bien été posés dans le texte — obtenu ${pillCount}`);

    const placements = await page.evaluate(() => state.song.sections[0]._placements.map(p => ({ chordIndex: p.chordIndex, id: p.id })));
    const ids = new Set(placements.map(p => p.id));
    check(placements.length === 3 && placements.every(p => p.chordIndex === 0), 'les 3 emplacements référencent bien le même chordIndex (0, l\'accord C)');
    check(ids.size === 3, `chaque exemplaire posé a bien un id UNIQUE — obtenu ${JSON.stringify(placements)}`);

    // === 2. Désarme : le chip reste juste "placed" (retour utilisateur : "je n'ai pas besoin du
    // nombre de fois que j'ai utilisé un accord" — le compteur affiché a été retiré) ===
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    const chipLabel = await page.$eval('.chord-chip:nth-child(1)', el => el.textContent.trim());
    const chipIsPlaced = await page.$eval('.chord-chip:nth-child(1)', el => el.classList.contains('placed'));
    check(chipLabel === 'C' && chipIsPlaced, `le chip affiche juste le symbole, sans compteur, et reste marqué "placed" — obtenu "${chipLabel}"`);

    // === 3. Retirer un exemplaire précis (croix d'une seule pastille) ne touche pas les 2 autres ===
    const pills = await page.$$('.lyric-pill');
    check(pills.length === 3, 'toujours 3 pastilles avant suppression ciblée');
    const delBtn = await pills[0].$('.pill-del');
    await delBtn.click();
    await page.waitForTimeout(120);
    pillCount = await page.$$eval('.lyric-pill', els => els.length);
    check(pillCount === 2, `la croix d'UNE pastille ne retire QUE cet exemplaire précis — obtenu ${pillCount} restant(s)`);
    const chipStillPlacedAfterDel = await page.$eval('.chord-chip:nth-child(1)', el => el.classList.contains('placed'));
    check(chipStillPlacedAfterDel, 'le chip reste "placed" après suppression ciblée (2 exemplaires restent posés)');

    // === 4. Cliquer sur le CORPS d'une pastille restante la ramasse pour la déplacer (sans affecter l'autre) ===
    const remainingPills = await page.$$('.lyric-pill');
    await remainingPills[0].click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(100);
    pillCount = await page.$$eval('.lyric-pill', els => els.length);
    check(pillCount === 1, `cliquer le corps d'une pastille la ramasse (retire CET exemplaire, laisse l'autre) — obtenu ${pillCount}`);
    const armedAfterPickup = await page.evaluate(() => state.armed);
    check(!!armedAfterPickup && armedAfterPickup.ci === 0, "l'accord ramassé est bien réarmé pour être replacé");

    // Le replacer ailleurs
    await clickAt(0.8, 0.5);
    await page.waitForTimeout(100);
    pillCount = await page.$$eval('.lyric-pill', els => els.length);
    check(pillCount === 2, `l'exemplaire ramassé peut être reposé ailleurs, on retrouve bien 2 pastilles au total — obtenu ${pillCount}`);
    const stillArmedAfterReplace = await page.evaluate(() => !!(state.armed));
    check(stillArmedAfterReplace, 'après ce replacement, on reste encore en mode tampon (armé)');
    await page.keyboard.press('Escape');

    // === 5. Persistance après rechargement : les exemplaires multiples et leurs ids survivent ===
    // (le rechargement lui-même ne réouvre pas le morceau — seule la session enregistrée en
    // localStorage, retrouvée par songId, persiste ; on réimporte donc le même fichier pour la
    // retrouver, comme le ferait un utilisateur revenant sur la page.)
    await page.reload();
    await page.waitForTimeout(300);
    await page.setInputFiles('#file-input', SAMPLE_PATH);
    await page.waitForTimeout(300);
    const pillCountAfterReload = await page.$$eval('.lyric-pill', els => els.length);
    check(pillCountAfterReload === 2, `après rechargement, les 2 exemplaires restants sont bien retrouvés — obtenu ${pillCountAfterReload}`);
    const idsAfterReload = await page.evaluate(() => state.song.sections[0]._placements.map(p => p.id));
    check(idsAfterReload.every(Boolean) && new Set(idsAfterReload).size === idsAfterReload.length, 'les ids uniques sont bien préservés après rechargement');

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
