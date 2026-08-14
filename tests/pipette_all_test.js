const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(600);
    for (const sym of ['C', 'G']) {
        await page.fill('#quick-add-input', sym).catch(() => {});
        await page.click('#quick-add-btn').catch(() => {});
        await page.waitForTimeout(120);
    }
    const cell1 = () => page.$('.grid-cell[data-index="0"]');
    const cell2 = () => page.$('.grid-cell[data-index="1"]');

    // Distingue complètement l'accord 1 : octave relevée + durée/rythme personnalisés en base.
    for (let i = 0; i < 2; i++) {
        await (await cell1()).click({ button: 'right' });
        await page.waitForTimeout(150);
        await page.click('[data-ctx-action="octave-up"]');
        await page.waitForTimeout(150);
    }
    const before = await page.evaluate(() => {
        const sections = loadProgressionSections();
        const c1 = sections[0].chords[0];
        c1.beats = 8;
        c1.seqEdited = true;
        c1.arpPattern = '0;0t;;1;;;2;;';
        c1.intensity = 60;
        saveProgressionSections(sections);
        const s = loadProgressionSections()[0].chords;
        return { root1: s[0].root, octave1: s[0].octave, beats1: s[0].beats, arp1: s[0].arpPattern,
                 root2: s[1].root, octave2: s[1].octave, beats2: s[1].beats };
    });
    console.log('avant pipette tout:', JSON.stringify(before));
    check(before.root1 !== before.root2 && String(before.octave1) !== String(before.octave2) && before.beats1 !== before.beats2,
        `accords 1 et 2 bien distincts sur tous les plans avant la pipette — obtenu ${JSON.stringify(before)}`);

    // "Coller tout" invisible tant que rien n'a été copié.
    await (await cell2()).click({ button: 'right' });
    await page.waitForTimeout(150);
    check(await page.isHidden('[data-ctx-action="paste-all"]'), "« Coller tout » invisible tant que rien n'a été copié");
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    await (await cell1()).click({ button: 'right' });
    await page.waitForTimeout(150);
    check(await page.isVisible('[data-ctx-action="copy-all"]'), '« Copier tout » visible sur un accord');
    await page.click('[data-ctx-action="copy-all"]');
    await page.waitForTimeout(150);

    await (await cell2()).click({ button: 'right' });
    await page.waitForTimeout(150);
    check(await page.isVisible('[data-ctx-action="paste-all"]'), '« Coller tout » apparaît une fois un accord copié');
    await page.click('[data-ctx-action="paste-all"]');
    await page.waitForTimeout(150);

    const after = await page.evaluate(() => {
        const s = loadProgressionSections()[0].chords;
        return { root1: s[0].root, octave1: s[0].octave, beats1: s[0].beats, arp1: s[0].arpPattern, intensity1: s[0].intensity,
                 root2: s[1].root, octave2: s[1].octave, beats2: s[1].beats, arp2: s[1].arpPattern, intensity2: s[1].intensity };
    });
    console.log('après collage tout:', JSON.stringify(after));
    check(after.root2 === after.root1, `la fondamentale de l'accord 2 est bien recopiée — obtenu ${after.root2}, attendu ${after.root1}`);
    check(String(after.octave2) === String(after.octave1), `l'octave est bien recopiée — obtenu ${after.octave2}, attendu ${after.octave1}`);
    check(String(after.beats2) === String(after.beats1), `la durée est bien recopiée — obtenu ${after.beats2}, attendu ${after.beats1}`);
    check(after.arp2 === after.arp1, `le motif du séquenceur est bien recopié tel quel (mêmes voix, aucun redimensionnement nécessaire) — obtenu ${JSON.stringify(after.arp2)}, attendu ${JSON.stringify(after.arp1)}`);
    check(String(after.intensity2) === String(after.intensity1), `l'intensité est bien recopiée — obtenu ${after.intensity2}, attendu ${after.intensity1}`);

    // La position dans la grille (index) n'a pas bougé : toujours 2 accords, dans le même ordre.
    const roots = await page.evaluate(() => loadProgressionSections()[0].chords.map(c => c.root));
    check(roots.length === 2, `toujours exactement 2 accords (écrase EN PLACE, ne duplique pas) — obtenu ${JSON.stringify(roots)}`);

    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
    const afterUndo = await page.evaluate(() => {
        const s = loadProgressionSections()[0].chords;
        return { root2: s[1].root, octave2: s[1].octave, beats2: s[1].beats };
    });
    check(afterUndo.root2 === before.root2 && String(afterUndo.octave2) === String(before.octave2) && afterUndo.beats2 === before.beats2,
        `Ctrl+Z restaure bien complètement l'accord 2 d'origine — obtenu ${JSON.stringify(afterUndo)}`);

    // Persistance après reload.
    await page.keyboard.press('Control+y').catch(() => {}); // au cas où (pas garanti), on revalide via un nouveau collage
    await (await cell2()).click({ button: 'right' });
    await page.waitForTimeout(150);
    await page.click('[data-ctx-action="paste-all"]');
    await page.waitForTimeout(150);
    await page.reload();
    await page.waitForTimeout(500);
    const afterReload = await page.evaluate(() => loadProgressionSections()[0].chords[1].root);
    check(afterReload === before.root1, `l'accord collé (pipette tout) est bien persisté après reload — obtenu ${afterReload}, attendu ${before.root1}`);

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
