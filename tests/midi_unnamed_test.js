// Import MIDI, étape 5 : les cases « à nommer ».
// Deux exigences de l'utilisateur, à vérifier ensemble : la case ne doit PAS porter un nom inventé,
// et les notes réellement jouées doivent quand même s'entendre. On vérifie aussi le cycle de vie du
// repère : il doit disparaître dès qu'on nomme la case, et nulle part ailleurs dans l'appli l'accord
// de remplissage ne doit réapparaître sous son vrai nom.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

// Pose dans la grille deux cases : un do majeur normal, et une case « à nommer » portant une mélodie.
const SEED = `
window._seed = () => {
    const melodie = [60, 62, 64, 65, 67, 69, 71, 72].map((m, i) => ({
        note: { midi: m, startStep: i * 2, endStep: i * 2 + 2 }, fromStep: i * 2, toStep: i * 2 + 2, steps: 2,
    }));
    const bar = { index: 0, startStep: 0, endStep: 16, sounding: melodie, attacks: melodie.map(s => s.note) };
    const opts = { beats: 4, stepsPerBar: 16, instrument: 'piano' };
    const inconnue = buildImportedChordData(bar, analyzeSegmentHarmony(bar), opts);

    const accords = plaqueBar([60, 64, 67]);
    const connue = buildImportedChordData(accords, analyzeSegmentHarmony(accords), opts);

    saveProgressionSections([{ title: 'Import', chords: [connue, inconnue] }]);
    window.app.loadProgression();
    return { connue, inconnue };
};
function plaqueBar(midis) {
    const sounding = midis.map(m => ({ note: { midi: m, startStep: 0, endStep: 16 }, fromStep: 0, toStep: 16, steps: 16 }));
    return { index: 0, startStep: 0, endStep: 16, sounding, attacks: sounding.map(s => s.note) };
}
`;

(async () => {
    const browser = await chromium.launch();
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(700);
    await page.addScriptTag({ content: SEED });

    const seeded = await page.evaluate(() => window._seed());
    await page.waitForTimeout(300);

    // ============================================================
    // === A. Les données elles-mêmes ===
    // ============================================================
    check(seeded.inconnue.unnamed === true, `la mesure mélodique est marquée à nommer — unnamed=${seeded.inconnue.unnamed}`);
    check(seeded.connue.unnamed === false, `la mesure d'accord plaqué ne l'est pas — unnamed=${seeded.connue.unnamed}`);

    // ============================================================
    // === B. Ce qu'on LIT dans la grille ===
    // ============================================================
    const grille = await page.evaluate(() => {
        const cells = [...document.querySelectorAll('.grid-cell[data-index]')];
        return cells.map(c => ({
            index: c.dataset.index,
            texte: c.querySelector('.cell-sym').textContent.trim(),
            marquee: c.classList.contains('cell-unnamed'),
            bord: getComputedStyle(c).borderTopStyle,
            couleurTexte: getComputedStyle(c.querySelector('.cell-sym')).color,
            italique: getComputedStyle(c.querySelector('.cell-sym')).fontStyle,
        }));
    });
    check(grille[0] && grille[0].texte === 'C', `la case reconnue affiche son accord — obtenu « ${grille[0] && grille[0].texte} »`);
    check(grille[1] && grille[1].texte === 'à nommer',
        `la case incertaine affiche « à nommer » et NON le do de remplissage — obtenu « ${grille[1] && grille[1].texte} »`);
    check(grille[1] && grille[1].marquee && grille[1].bord === 'dashed' && grille[1].italique === 'italic',
        `...et se distingue visuellement d'un accord posé — ${JSON.stringify(grille[1])}`);
    check(grille[0] && grille[0].bord !== 'dashed',
        `la case normale, elle, garde son bord plein — obtenu ${grille[0] && grille[0].bord}`);

    // ============================================================
    // === C. Les notes réellement jouées s'entendent quand même ===
    // ============================================================
    const sonne = await page.evaluate(() => {
        const data = loadProgressionSections()[0].chords[1];
        const chord = new Chord(data.root, data.quality, beatsFromData(data), data.inversion, data.drop, octaveFromData(data), data.bass, null, data.extraNotes);
        const midis = chord.getSeqMidiNotes();
        const { pattern, tie } = window.app.resolveSeqPatternForData(chord, data);
        const joue = [];
        for (let v = 0; v < midis.length; v++) {
            let s = 0;
            while (s < pattern.length) {
                if (!pattern[s].includes(v)) { s++; continue; }
                const start = s; s++;
                while (s < pattern.length && pattern[s].includes(v) && tie[s].includes(v)) s++;
                joue.push([midis[v], start, s]);
            }
        }
        joue.sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));
        return joue;
    });
    const attendu = JSON.stringify([60, 62, 64, 65, 67, 69, 71, 72].map((m, i) => [m, i * 2, i * 2 + 2]));
    check(JSON.stringify(sonne) === attendu,
        `la case « à nommer » joue EXACTEMENT les notes enregistrées — obtenu ${JSON.stringify(sonne)}`);

    // ============================================================
    // === D. Nulle part ailleurs l'accord de remplissage ne réapparaît sous son vrai nom ===
    // ============================================================
    const ailleurs = await page.evaluate(() => {
        const app = window.app;
        const data = loadProgressionSections()[0].chords[1];
        const useFlats = false;
        return {
            symbole: chordSymbolForData(data, useFlats),
            // Le PDF exporté ne doit pas non plus annoncer un do majeur là où il n'y en a pas.
            pdf: app.buildPrintExportHtml().gridInner.includes('à nommer'),
            // Export vers l'outil compagnon Paroles : même exigence.
            paroles: (() => {
                const sections = loadProgressionSections();
                return sections[0].chords.map(h => chordSymbolForData(h, false));
            })(),
        };
    });
    check(ailleurs.symbole === 'à nommer', `la fonction d'affichage centrale rend bien « à nommer » — obtenu ${ailleurs.symbole}`);
    check(ailleurs.pdf === true,
        `le PDF exporté porte lui aussi la mention plutôt qu'un accord inventé — obtenu ${ailleurs.pdf}`);
    check(JSON.stringify(ailleurs.paroles) === JSON.stringify(['C', 'à nommer']),
        `l'export vers Paroles ne réintroduit pas non plus l'accord de remplissage — obtenu ${JSON.stringify(ailleurs.paroles)}`);

    // ============================================================
    // === E. Cycle de vie : nommer la case fait disparaître le repère ===
    // ============================================================
    // On passe par le VRAI chemin de l'utilisateur : viser le symbole, taper le nom, valider.
    // CONTRAT CHANGÉ : c'était un simple clic. Le symbole ouvrait sa retape dès le PREMIER clic, ce
    // qui faisait cohabiter trois gestes dans une case de 83x56px au téléphone. Désormais : premier
    // clic = sélectionner (partout), second clic rapproché = renommer si l'on a visé le symbole.
    // Nommer une case « à nommer » demande donc un double-clic, comme renommer n'importe quel autre
    // accord — et c'est bien l'intérêt : un seul geste à retenir, pas un cas particulier de plus.
    const cellSym = await page.$('.grid-cell[data-index="1"] .cell-sym');
    const box = await cellSym.boundingBox();
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(250);
    const enEdition = await page.$('.cell-sym-input');
    check(!!enEdition, 'double-cliquer le nom d\'une case « à nommer » ouvre bien la saisie');
    if (enEdition) {
        await enEdition.fill('Dm7');
        await enEdition.press('Enter');
        await page.waitForTimeout(350);
    }
    const apres = await page.evaluate(() => {
        const data = loadProgressionSections()[0].chords[1];
        const cell = document.querySelector('.grid-cell[data-index="1"]');
        return {
            unnamed: data.unnamed,
            root: data.root, quality: data.quality,
            texte: cell.querySelector('.cell-sym').textContent.trim(),
            marquee: cell.classList.contains('cell-unnamed'),
            extras: (data.extraNotes || []).length,
        };
    });
    check(apres.unnamed === undefined && apres.marquee === false,
        `une fois nommée, la case n'est plus marquée — unnamed=${apres.unnamed}, classe=${apres.marquee}`);
    check(apres.texte === 'Dm7' && apres.root === 'D' && apres.quality === 'min7',
        `...et porte le nom saisi — obtenu « ${apres.texte} » (${apres.root}${apres.quality})`);
    check(apres.extras === 8,
        `...sans perdre au passage les notes enregistrées — ${apres.extras} notes libres conservées`);

    // ============================================================
    // === F. La pipette d'accord efface aussi le repère ===
    // ============================================================
    const pipette = await page.evaluate(() => {
        const app = window.app;
        // Remet une case à nommer en place, puis y applique l'identité d'un accord existant.
        const sections = loadProgressionSections();
        sections[0].chords[1].unnamed = true;
        saveProgressionSections(sections);
        app.copyChordIdentity(0, 0);
        app.pasteChordIdentity(0, 1);
        const d = loadProgressionSections()[0].chords[1];
        return { unnamed: d.unnamed, symbole: chordSymbolForData(d, false) };
    });
    check(pipette.unnamed === undefined && pipette.symbole !== 'à nommer',
        `appliquer un accord à la pipette lève aussi le repère — ${JSON.stringify(pipette)}`);

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 || errors.length > 0 ? 1 : 0);
})();
