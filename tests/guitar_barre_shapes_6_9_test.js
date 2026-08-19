// « J'ai remarqué qu'aucun accord n'est proposé pour l'accord Am6, il est bien jouable à la
// guitare. J'ai remarqué ce point sur un accord avec une 9ème également. »
//
// Cause : guitarFingeringsForChord ne consulte les formes « communément enseignées »
// (commonGuitarShapes) que pour les 5 qualités de BARRE_QUALITIES (maj/min/dom7/maj7/min7) — tout le
// reste retombe sur le solveur exact (solveGuitarFingerings), qui exige la voix EXACTE que produit le
// voicing par défaut (empilement de tierces à l'octave 3). Cette voix précise n'a simplement pas de
// doigté tenable (GUITAR_MAX_SPAN/GUITAR_MAX_FINGERS) pour une bonne moitié des tons en position
// fondamentale — pas un accord réellement injouable à la guitare, juste CETTE disposition précise des
// notes. Am6/Bm6/Fm6... par exemple : 0 doigté avant, alors que la forme de barré usuelle (dérivée de
// Em6/Am6 « à vide », bien connues) les joue sans problème.
//
// Correctif : ajout de gabarits de barré pour '6', 'm6' et 'dom9' (BARRE_TEMPLATES), dérivés des
// formes ouvertes Em6/Am6/E6/A6 (archi-connues) et E9 (la forme funk classique) — chaque note
// vérifiée une à une contre CHORD_INTERVALS ci-dessous, comme le veut le commentaire d'en-tête des
// gabarits existants. Pas de forme A pour dom9 (voir le commentaire dans script.js : risque
// d'omettre la tierce, qui donne son caractère « dominant » à l'accord — mieux vaut laisser le
// solveur exact tenter sa chance qu'une forme fausse).
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, plan, bilan } = require('./_harness')('gabarits de barré 6/m6/dom9 (Am6 et accords à 9e)');

const ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const QUALITIES = ['6', 'm6', 'dom9'];
plan(ROOTS.length * QUALITIES.length * 3 + 2);

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now());
    await page.waitForTimeout(300);

    // Cas signalé tel quel, tel qu'un accord fraîchement choisi dans le panneau (racine A, m6,
    // octave/renversement par défaut) : avant le correctif, 0 doigté proposé.
    if (!(await page.evaluate(() => document.getElementById('toggle-viz-guitar').getAttribute('aria-pressed') === 'true'))) {
        await page.click('#toggle-viz-guitar');
    }
    await page.click('#toggle-complex-quality');
    await page.waitForTimeout(150);
    const am6 = await page.evaluate(() => {
        document.getElementById('root').value = 'A';
        document.getElementById('quality').value = 'm6';
        window.app.refreshPreview();
        return window.app.guitarFingerings.length;
    });
    check(am6 > 0, `Am6 fraîchement choisi dans le panneau propose bien au moins un doigté (${am6}) — c'est le cas signalé`);

    // Vérification systématique, pour les 12 tons : au moins une forme communément enseignée, dont
    // TOUTES les notes appartiennent réellement à l'accord (pas de note étrangère faute de forme
    // fausse) et qui couvre bien TOUS les degrés essentiels (aucun oubli, en particulier pas la
    // tierce du dom9 — voir le commentaire d'en-tête).
    for (const quality of QUALITIES) {
        for (const root of ROOTS) {
            const res = await page.evaluate(({ root, quality }) => {
                const shapes = commonGuitarShapes(root, quality);
                const intervals = CHORD_INTERVALS[quality];
                const rootPc = NOTES.indexOf(root);
                const expectedRoles = new Set(intervals.map(iv => iv.role));
                const perShape = shapes.map(shape => {
                    const byString = shapeToByString(shape, root, quality);
                    const allMatch = byString.every(e => {
                        if (!e) return true;
                        const pc = ((e.midi % 12) + 12) % 12;
                        return intervals.some(iv => (((rootPc + iv.semi) % 12) + 12) % 12 === pc);
                    });
                    const rolesPresent = new Set(byString.filter(e => e).map(e => e.role));
                    const hasAllEssentials = [...expectedRoles].every(r => rolesPresent.has(r));
                    return { allMatch, hasAllEssentials };
                });
                return { nShapes: shapes.length, allMatch: perShape.every(p => p.allMatch), allEssentials: perShape.every(p => p.hasAllEssentials) };
            }, { root, quality });
            check(res.nShapes > 0, `${root}${quality} : au moins une forme communément enseignée (avant : 0 pour la plupart des tons)`);
            check(res.allMatch, `${root}${quality} : toutes les notes des formes proposées appartiennent bien à l'accord`);
            check(res.allEssentials, `${root}${quality} : chaque forme couvre bien tous les degrés essentiels (racine, tierce, 6e/9e)`);
        }
    }

    check(errors.length === 0, 'aucune erreur JavaScript');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
