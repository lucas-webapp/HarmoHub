const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(600);

    // Active l'affichage guitare (masqué par défaut, voir showGuitarViz/toggle-viz-guitar).
    const guitarShown = await page.evaluate(() => document.getElementById('toggle-viz-guitar').getAttribute('aria-pressed') === 'true');
    if (!guitarShown) await page.click('#toggle-viz-guitar');
    await page.waitForTimeout(200);

    // ============================================================
    // === A. Panneau live (Ajout) : accord "C" au piano, substitut "Em" à la guitare ===
    // ============================================================

    await page.waitForTimeout(150);
    check(await page.isHidden('#guitar-override-row'), "au départ (aucun substitut), le bandeau au-dessus du diagramme est masqué");

    const pianoLabelBefore = await page.evaluate(() => document.querySelector('#current-chord-display .chord-title').textContent);
    check(pianoLabelBefore === 'C', `le titre piano affiche bien l'accord réellement réglé (C) — obtenu ${pianoLabelBefore}`);

    // Le titre piano utilise bien le même "chip" bordé que le bandeau guitare (retour utilisateur :
    // "j'aime bien le visuel... peux-tu l'appliquer au piano également"), et depuis peu à la MÊME
    // taille (l'ancien modificateur "petit" a été retiré, voir plus bas).
    const pianoChipInfo = await page.evaluate(() => {
        const chip = document.querySelector('#current-chord-display .chord-chip');
        const title = chip && chip.querySelector('.chord-title');
        const notes = chip && chip.querySelector('.chord-notes');
        return {
            hasChip: !!chip,
            isSmall: chip ? chip.classList.contains('chord-chip-sm') : null,
            titleFontSize: title ? getComputedStyle(title).fontSize : null,
            notesHasBorderLeft: notes ? getComputedStyle(notes).borderLeftWidth !== '0px' : null,
        };
    });
    console.log('chip piano:', JSON.stringify(pianoChipInfo));
    check(pianoChipInfo.hasChip, 'le titre piano est bien enveloppé dans le même chip bordé que la guitare');
    check(pianoChipInfo.isSmall === false, "le chip piano N'A PAS le modificateur .chord-chip-sm (police plus grosse que la guitare)");
    check(pianoChipInfo.notesHasBorderLeft === true, 'une séparation (bordure) sépare bien le nom de l\'accord et ses notes, dans le chip piano');

    await page.click('#guitar-override-btn');
    await page.waitForTimeout(150);
    const inputVisible = await page.isVisible('.guitar-override-input');
    check(inputVisible, 'le clic sur le crayon ouvre bien une saisie au clavier');

    await page.fill('.guitar-override-input', 'Em');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    check(await page.isVisible('#guitar-override-row'), 'le bandeau au-dessus du diagramme guitare apparaît une fois le substitut défini');
    const overrideLabel = await page.evaluate(() => document.querySelector('#guitar-override-row .chord-title')?.textContent);
    check(overrideLabel === 'Em', `le bandeau affiche bien le nom de l'accord de substitution (Em) — obtenu ${overrideLabel}`);
    const overrideNotesCount = await page.evaluate(() => document.querySelectorAll('#guitar-override-row .chord-notes .chord-note').length);
    check(overrideNotesCount === 3, `le bandeau affiche bien les notes de l'accord de substitution (3 pour Em) — obtenu ${overrideNotesCount}`);
    // CONTRAT MIS À JOUR (retour utilisateur : "le titre... n'est pas aligné et n'est pas de la même
    // taille que le nom de l'accord au piano") : le chip guitare N'utilise PLUS .chord-chip-sm, même
    // taille que le titre piano.
    const chipIsSmall = await page.evaluate(() => !!document.querySelector('#guitar-override-row .chord-chip.chord-chip-sm'));
    check(!chipIsSmall, "le bandeau guitare N'utilise PLUS le chip petit (.chord-chip-sm) — même taille que le titre piano");
    const clearOutsideChip = await page.evaluate(() => {
        const chip = document.querySelector('#guitar-override-row .chord-chip');
        const clearBtn = document.getElementById('guitar-override-clear');
        return !!chip && !!clearBtn && !chip.contains(clearBtn);
    });
    const fontSizes = await page.evaluate(() => ({
        piano: parseFloat(getComputedStyle(document.querySelector('#current-chord-display .chord-title')).fontSize),
        guitar: parseFloat(getComputedStyle(document.querySelector('#guitar-override-row .chord-title')).fontSize),
    }));
    check(fontSizes.piano === fontSizes.guitar, `la police du titre piano est bien de la MÊME taille que celle du substitut guitare — obtenu piano=${fontSizes.piano}px, guitare=${fontSizes.guitar}px`);
    // CONTRAT MIS À JOUR (retour utilisateur, ordinateur : "la disposition n'est pas logique...
    // centre le nom de l'accord sur le diagramme : si accord de guitare en mode libre, décale le nom
    // de l'accord du piano au-dessus du diagramme piano et centré") : plus un titre unique partagé en
    // haut, mais deux titres, chacun centré au-dessus de SON diagramme — voir placeChordTitle.
    const placement = await page.evaluate(() => {
        const disp = document.getElementById('current-chord-display');
        const piano = document.getElementById('piano-viz').getBoundingClientRect();
        const dispChip = disp.querySelector('.chord-chip').getBoundingClientRect();
        const guitar = document.getElementById('guitar-viz').getBoundingClientRect();
        const overrideChip = document.querySelector('#guitar-override-row .chord-chip').getBoundingClientRect();
        return {
            dispInPianoCol: disp.parentElement.id === 'piano-col',
            pianoTitleCentered: Math.abs((dispChip.x + dispChip.width / 2) - (piano.x + piano.width / 2)) < 2,
            guitarTitleCentered: Math.abs((overrideChip.x + overrideChip.width / 2) - (guitar.x + guitar.width / 2)) < 2,
        };
    });
    console.log('placement:', JSON.stringify(placement));
    check(placement.dispInPianoCol, "le titre piano a bien déménagé au-dessus du diagramme piano (#piano-col) puisqu'un substitut guitare est actif");
    check(placement.pianoTitleCentered, 'le titre piano est bien centré sur SON diagramme (le piano), pas sur autre chose');
    check(placement.guitarTitleCentered, 'le titre du substitut guitare est bien centré sur SON diagramme (la guitare)');
    check(clearOutsideChip, "la croix « fermer » est bien HORS du cadre (rectangle) du chip, pas dedans");

    const pianoLabelAfter = await page.evaluate(() => document.querySelector('#current-chord-display .chord-title').textContent);
    check(pianoLabelAfter === 'C', `le titre piano N'A PAS changé (reste C) — un seul accord piano, le substitut ne concerne QUE la guitare — obtenu ${pianoLabelAfter}`);

    const btnActive = await page.evaluate(() => document.getElementById('guitar-override-btn').classList.contains('active'));
    check(btnActive, 'le bouton crayon est bien mis en évidence (actif) une fois un substitut défini');

    // ============================================================
    // === B. Le cadenas (même principe qu'avant) verrouille le doigté DU SUBSTITUT ===
    // ============================================================
    const lockVisible = await page.isVisible('#guitar-lock-btn');
    check(lockVisible, 'le cadenas est bien visible (Em est jouable à la guitare)');
    await page.click('#guitar-lock-btn');
    await page.waitForTimeout(150);
    const lockActive = await page.evaluate(() => document.getElementById('guitar-lock-btn').classList.contains('active'));
    check(lockActive, 'le cadenas se verrouille bien sur le doigté affiché (celui du substitut)');

    // ============================================================
    // === C. Ajoute l'accord dans la grille, vérifie la persistance ===
    // ============================================================
    await page.click('#save');
    await page.waitForTimeout(200);
    const saved = await page.evaluate(() => {
        const c = loadProgressionSections()[0].chords[0];
        return { root: c.root, quality: c.quality, guitarOverride: c.guitarOverride, guitarLock: c.guitarLock };
    });
    console.log('accord sauvegardé:', JSON.stringify(saved));
    check(saved.root === 'C' && saved.quality === 'maj', `l'accord PIANO sauvegardé reste bien C majeur — obtenu ${JSON.stringify(saved)}`);
    check(!!saved.guitarOverride && saved.guitarOverride.root === 'E' && saved.guitarOverride.quality === 'min', `le substitut GUITARE (Em) est bien sauvegardé séparément — obtenu ${JSON.stringify(saved.guitarOverride)}`);
    check(!!saved.guitarLock, `le verrou de doigté (posé sur le substitut) est bien sauvegardé — obtenu ${JSON.stringify(saved.guitarLock)}`);

    // Persistance après reload.
    await page.reload();
    await page.waitForTimeout(500);
    const afterReload = await page.evaluate(() => {
        const c = loadProgressionSections()[0].chords[0];
        return { guitarOverride: c.guitarOverride, guitarLock: c.guitarLock };
    });
    check(!!afterReload.guitarOverride && afterReload.guitarOverride.root === 'E', `le substitut survit bien à un reload — obtenu ${JSON.stringify(afterReload.guitarOverride)}`);
    check(JSON.stringify(afterReload.guitarLock) === JSON.stringify(saved.guitarLock), `le verrou de doigté survit bien à un reload — obtenu ${JSON.stringify(afterReload.guitarLock)}`);

    // ============================================================
    // === D. Simple aperçu (clic sur la case, PAS d'édition) : le bandeau doit refléter CET accord ===
    // ============================================================
    const guitarShown2 = await page.evaluate(() => document.getElementById('toggle-viz-guitar').getAttribute('aria-pressed') === 'true');
    if (!guitarShown2) await page.click('#toggle-viz-guitar');
    await page.waitForTimeout(150);
    const cell0 = await page.$('.grid-cell[data-index="0"]');
    await cell0.click({ position: { x: 30, y: 20 } });
    await page.waitForTimeout(250);
    check(await page.isVisible('#guitar-override-row'), "en simple aperçu (clic, pas d'édition), le bandeau reflète bien le substitut de CET accord");
    const previewLabel = await page.evaluate(() => document.querySelector('#guitar-override-row .chord-title')?.textContent);
    check(previewLabel === 'Em', `le bandeau en simple aperçu affiche bien "Em" — obtenu ${previewLabel}`);

    // ============================================================
    // === E. Retire le substitut (bouton ×) : le diagramme revient à l'accord réellement joué ===
    // ============================================================
    await page.click('#guitar-override-clear');
    await page.waitForTimeout(200);
    check(await page.isHidden('#guitar-override-row'), 'après avoir retiré le substitut, le bandeau redisparaît');
    const afterClear = await page.evaluate(() => loadProgressionSections()[0].chords[0].guitarOverride);
    check(afterClear === null, `le substitut est bien retiré des données sauvegardées — obtenu ${JSON.stringify(afterClear)}`);
    const dispBackInHeader = await page.evaluate(() => document.getElementById('current-chord-display').parentElement.classList.contains('chord-header-row'));
    check(dispBackInHeader, 'le titre piano revient bien en haut (.chord-header-row) une fois le substitut retiré — plus rien à répartir par diagramme');

    // ============================================================
    // === F. Accord non reconnu : message d'erreur, pas de substitut appliqué ===
    // ============================================================
    await page.click('#guitar-override-btn');
    await page.waitForTimeout(150);
    await page.fill('.guitar-override-input', 'XyzNotAChord');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const stillNoOverride = await page.evaluate(() => loadProgressionSections()[0].chords[0].guitarOverride);
    check(stillNoOverride === null, `un texte non reconnu n'applique aucun substitut — obtenu ${JSON.stringify(stillNoOverride)}`);

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
