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
    check(!!(await page.$('.grid-cell[data-index="0"]')) && !!(await page.$('.grid-cell[data-index="1"]')), 'les 2 accords sont bien présents dans la grille');

    // loadProgression() reconstruit la grille (nouveaux nœuds DOM) à chaque action : nouveau handle à
    // chaque fois plutôt que de réutiliser une référence qui se détacherait.
    const cell1 = () => page.$('.grid-cell[data-index="0"]');
    const cell2 = () => page.$('.grid-cell[data-index="1"]');

    // ============================================================
    // === A. Pipette d'ACCORD (nom + voicing) — copyChordIdentity/pasteChordIdentity ===
    // ============================================================

    // Distingue le voicing de l'accord 1 : monte son octave 2 fois via le menu contextuel.
    for (let i = 0; i < 2; i++) {
        await (await cell1()).click({ button: 'right' });
        await page.waitForTimeout(150);
        await page.click('[data-ctx-action="octave-up"]');
        await page.waitForTimeout(150);
    }
    const before = await page.evaluate(() => {
        const s = loadProgressionSections()[0].chords;
        return { root1: s[0].root, octave1: s[0].octave, root2: s[1].root, octave2: s[1].octave };
    });
    console.log('avant pipette accord:', JSON.stringify(before));
    check(before.root1 !== before.root2 && String(before.octave1) !== String(before.octave2),
        `accords 1 et 2 bien distincts au départ (fondamentale ET octave) — obtenu ${JSON.stringify(before)}`);

    // "Coller l'accord" invisible tant que rien n'a été copié.
    await (await cell2()).click({ button: 'right' });
    await page.waitForTimeout(150);
    check(await page.isHidden('[data-ctx-action="paste-identity"]'), "« Coller l'accord » invisible tant qu'aucun accord n'a été copié");
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    // Copie l'accord 1 (C, octave relevée), colle sur l'accord 2 (G).
    await (await cell1()).click({ button: 'right' });
    await page.waitForTimeout(150);
    check(await page.isVisible('[data-ctx-action="copy-identity"]'), "« Copier l'accord » visible sur un accord");
    await page.click('[data-ctx-action="copy-identity"]');
    await page.waitForTimeout(150);

    await (await cell2()).click({ button: 'right' });
    await page.waitForTimeout(150);
    check(await page.isVisible('[data-ctx-action="paste-identity"]'), "« Coller l'accord » apparaît une fois un accord copié");
    await page.click('[data-ctx-action="paste-identity"]');
    await page.waitForTimeout(150);

    const afterIdentity = await page.evaluate(() => {
        const s = loadProgressionSections()[0].chords;
        return { root1: s[0].root, octave1: s[0].octave, root2: s[1].root, octave2: s[1].octave, beats1: s[0].beats, beats2: s[1].beats };
    });
    console.log('après collage accord:', JSON.stringify(afterIdentity));
    check(afterIdentity.root2 === afterIdentity.root1,
        `contrairement à l'ancienne pipette voicing, la FONDAMENTALE est bien recopiée aussi (accord 2 devient ${afterIdentity.root2}, comme l'accord 1) — obtenu ${JSON.stringify(afterIdentity)}`);
    check(String(afterIdentity.octave2) === String(afterIdentity.octave1),
        `l'octave (voicing) de l'accord 2 correspond bien à celle copiée sur l'accord 1 — obtenu ${JSON.stringify(afterIdentity)}`);
    check(String(afterIdentity.beats2) === '4' && String(afterIdentity.beats1) === '4',
        `la durée (beats) n'est PAS touchée par la pipette d'accord — obtenu beats1=${afterIdentity.beats1}, beats2=${afterIdentity.beats2}`);

    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
    const afterUndoIdentity = await page.evaluate(() => {
        const s = loadProgressionSections()[0].chords;
        return { root2: s[1].root, octave2: s[1].octave };
    });
    check(afterUndoIdentity.root2 === before.root2 && String(afterUndoIdentity.octave2) === String(before.octave2),
        `Ctrl+Z restaure bien la fondamentale ET l'octave d'origine de l'accord 2 — obtenu ${JSON.stringify(afterUndoIdentity)}, attendu root=${before.root2}/octave=${before.octave2}`);

    // ============================================================
    // === B. Pipette de RYTHME (motif + durée) — copyChordRhythm/pasteChordRhythm ===
    // ============================================================

    // Prépare un rythme + une durée distincts sur l'accord 1 (2 mesures, motif "peint" à la main),
    // directement en base pour un test fiable et rapide (équivalent à ce que produirait le séquenceur).
    const rhythmBefore = await page.evaluate(() => {
        const sections = loadProgressionSections();
        const c1 = sections[0].chords[0];
        c1.beats = 8; // 2 mesures, contre 4 (1 mesure) sur l'accord 2
        c1.seqEdited = true;
        c1.arpPattern = '0;0t;;1;;;2;;0;0t;;1;;;2;;'.split(';').slice(0, 32).join(';'); // motif quelconque distinctif
        c1.intensityPerStep = { 0: 40, 3: 90 };
        saveProgressionSections(sections);
        const before2 = sections[0].chords[1];
        return { root1: c1.root, quality1: c1.quality, beats1: c1.beats, root2: before2.root, quality2: before2.quality, beats2: before2.beats };
    });
    console.log('rythme préparé sur accord 1:', JSON.stringify(rhythmBefore));
    check(rhythmBefore.beats1 === 8 && rhythmBefore.beats2 !== 8, `durées bien distinctes avant la pipette rythme — obtenu ${JSON.stringify(rhythmBefore)}`);

    // "Coller le rythme" invisible tant que rien n'a été copié (nouvelle session de presse-papier).
    await (await cell2()).click({ button: 'right' });
    await page.waitForTimeout(150);
    check(await page.isHidden('[data-ctx-action="paste-rhythm"]'), "« Coller le rythme » invisible tant qu'aucun rythme n'a été copié");
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    await (await cell1()).click({ button: 'right' });
    await page.waitForTimeout(150);
    check(await page.isVisible('[data-ctx-action="copy-rhythm"]'), '« Copier le rythme » visible sur un accord');
    await page.click('[data-ctx-action="copy-rhythm"]');
    await page.waitForTimeout(150);

    await (await cell2()).click({ button: 'right' });
    await page.waitForTimeout(150);
    check(await page.isVisible('[data-ctx-action="paste-rhythm"]'), '« Coller le rythme » apparaît une fois un rythme copié');
    await page.click('[data-ctx-action="paste-rhythm"]');
    await page.waitForTimeout(150);

    const afterRhythm = await page.evaluate(() => {
        const s = loadProgressionSections()[0].chords;
        return {
            root1: s[0].root, quality1: s[0].quality, beats1: s[0].beats,
            root2: s[1].root, quality2: s[1].quality, beats2: s[1].beats,
            seqEdited2: s[1].seqEdited, arpPattern2: s[1].arpPattern,
        };
    });
    console.log('après collage rythme:', JSON.stringify(afterRhythm));
    check(String(afterRhythm.beats2) === '8', `la DURÉE de l'accord 2 est bien recopiée (8 temps, comme l'accord 1) — obtenu ${afterRhythm.beats2}`);
    check(afterRhythm.root2 !== afterRhythm.root1 && afterRhythm.root2 === rhythmBefore.root2,
        `la fondamentale de l'accord 2 n'est PAS touchée par la pipette rythme (« sans changer les notes ») — obtenu root2=${afterRhythm.root2}, attendu ${rhythmBefore.root2}`);
    check(afterRhythm.quality2 === rhythmBefore.quality2,
        `la qualité de l'accord 2 n'est PAS touchée non plus — obtenu ${afterRhythm.quality2}, attendu ${rhythmBefore.quality2}`);
    check(afterRhythm.seqEdited2 === true, "l'accord 2 est bien marqué seqEdited après collage du rythme");
    check(!!afterRhythm.arpPattern2 && afterRhythm.arpPattern2.length > 0, "l'accord 2 a bien reçu un arpPattern non vide");

    // Persistance après reload.
    await page.reload();
    await page.waitForTimeout(500);
    const afterReload = await page.evaluate(() => {
        const s = loadProgressionSections()[0].chords;
        return { beats2: s[1].beats, seqEdited2: s[1].seqEdited, arpPattern2: s[1].arpPattern };
    });
    check(String(afterReload.beats2) === '8' && afterReload.seqEdited2 === true && afterReload.arpPattern2 === afterRhythm.arpPattern2,
        `le rythme collé (durée + motif) est bien persisté après reload — obtenu ${JSON.stringify(afterReload)}`);

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
