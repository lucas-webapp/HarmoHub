// « Lorsqu'une petite barre est sélectionnée, je ne peux pas cliquer sur "supprimer sélection". »
// (capture d'écran : la barre en question fait une seule croche, ~14px à ce zoom).
//
// Mesuré AVANT correction, sur un TAP TACTILE réel centré pile sur cette barre de 14px : rien à
// reprocher au geste lui-même une fois qu'on l'amène dans le champ visible (0 sélection en dehors du
// viewport était un artefact de banc, pas le défaut). Le vrai défaut apparaît sur un tap légèrement
// IMPRÉCIS — inévitable au doigt sur une cible aussi étroite, largement sous les ~44px recommandés
// par Apple/Google : à quelques pixels du bord, `onSeqPointerUp` tombe sur une case VIDE (`!wasOn`),
// et `_noteSeqVoisine` ne regardait alors QUE la croche immédiatement adjacente (±1 croche en INDICE),
// pas en pixels réels — à ce zoom, ±1 croche pouvait valoir moins de 14px, bien en dessous de
// l'imprécision normale d'un doigt. Le tap ne sélectionnait donc RIEN : ni la note visée, ni aucune
// autre, et le bouton "supprimer sélection" restait à raison désactivé (this.seqSelections resté
// vide) — mais sans qu'aucun message ne dise pourquoi, d'où la confusion signalée.
//
// _noteSeqVoisine mesure maintenant une tolérance en PIXELS RÉELLEMENT RENDUS (plancher
// SEQ_TAP_TOLERANCE_MIN_PX, ou la largeur d'une croche si elle est plus grande — donc AUCUN
// changement à un zoom confortable, où une croche dépasse déjà ce plancher). Une seconde cause,
// indépendante, a été fermée en même temps : Safari iOS peut faire apparaître sa propre bulle de
// sélection native après un appui un peu long (le geste que l'appli utilise elle-même pour armer
// l'édition, voir SEQ_APPUI_LONG_MS) et cette bulle intercepterait alors le tap SUIVANT — d'où
// -webkit-touch-callout:none sur .seq-cell.
const { chromium, devices } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('tap imprécis sur une petite barre (mobile)');
plan(8);

const mk = (root, quality, octave, beats) => ({ root, quality, beats: beats || 4, inversion: 0, drop: 0, octave, bass: null, playStyle: 'held' });

(async () => {
    const browser = await chromium.launch();
    const errors = [];
    const iphone = devices['iPhone 13'];
    const ctx = await browser.newContext({ ...iphone });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate((c) => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'S', chords: c }] }));
        localStorage.removeItem('harmohubSeqDockHeight');
    }, [mk('C', 'min', 3, 4)]);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(500);
    await page.evaluate(() => { window.app.editChord(0, 0); window.app.toggleSequencer('continu'); });
    await page.waitForTimeout(500);
    // Réduit une voix à SA PLUS COURTE FORME POSSIBLE (une seule croche) : exactement le cas signalé,
    // la barre la plus étroite que l'appli puisse afficher.
    await page.evaluate(() => {
        window.app.pushSeqUndo();
        const chord = window.app.readChord();
        const { pattern } = window.app.getLiveSeqPattern(chord);
        for (let s = 1; s < pattern.length; s++) window.app.applySeqCell(0, s, false, false);
        window.app.renderSequencer();
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector('.seq-note[data-voice="0"]').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);

    const etatBarre = () => page.evaluate(() => {
        const bar = document.querySelector('.seq-note[data-voice="0"]');
        const btn = document.getElementById('seq-delete-selection');
        return { selections: window.app.seqSelections.length, selected: bar && bar.classList.contains('selected'), btnDisabled: btn && btn.disabled };
    });

    const r = await page.evaluate(() => document.querySelector('.seq-note[data-voice="0"]').getBoundingClientRect());
    console.log('largeur de la barre :', Math.round(r.width), 'px');
    if (!exiger(r.width > 0 && r.width < 20, `la barre mesure moins de 20px de large — reproduit bien le cas signalé (${Math.round(r.width)}px)`)) bilan();

    console.log('=== 1. Tap IMPRÉCIS, quelques pixels au-delà du bord — doit quand même sélectionner ===');
    const cy = r.top + r.height / 2;
    await page.touchscreen.tap(r.right + 12, cy);
    await page.waitForTimeout(400);
    const apres1 = await etatBarre();
    console.log(JSON.stringify(apres1));
    check(apres1.selections === 1 && apres1.selected, `un tap manqué de 12px sélectionne quand même la barre (${JSON.stringify(apres1)})`);
    check(!apres1.btnDisabled, "et le bouton « supprimer sélection » n'est plus désactivé");

    console.log('=== 2. Le bouton répond vraiment : la note disparaît pour de bon ===');
    const btnRect = await page.evaluate(() => document.getElementById('seq-delete-selection').getBoundingClientRect());
    await page.touchscreen.tap(btnRect.x + btnRect.width / 2, btnRect.y + btnRect.height / 2);
    await page.waitForTimeout(400);
    const apresSuppr = await page.evaluate(() => {
        const chord = window.app.readChord();
        const { pattern } = window.app.getLiveSeqPattern(chord);
        return { selections: window.app.seqSelections.length, voix0Presente: pattern.some(p => p.includes(0)) };
    });
    console.log(JSON.stringify(apresSuppr));
    check(apresSuppr.selections === 0 && !apresSuppr.voix0Presente, `la note est vraiment supprimée après le tap sur le bouton (${JSON.stringify(apresSuppr)})`);

    console.log('=== 3. Un tap VRAIMENT loin continue de créer une note, pas de repêchage abusif ===');
    // La note a été SUPPRIMÉE à l'étape 2 (étape 0 comprise, plus aucune case ON sur cette voix) : il
    // faut donc la reposer explicitement avant de la retailler, pas juste effacer 1..fin en supposant
    // l'étape 0 encore active comme au tout premier montage.
    await page.evaluate(() => {
        window.app.pushSeqUndo();
        const chord = window.app.readChord();
        const { pattern } = window.app.getLiveSeqPattern(chord);
        window.app.applySeqCell(0, 0, true, false);
        for (let s = 1; s < pattern.length; s++) window.app.applySeqCell(0, s, false, false);
        window.app.renderSequencer();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('.seq-note[data-voice="0"]').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    const r2 = await page.evaluate(() => document.querySelector('.seq-note[data-voice="0"]').getBoundingClientRect());
    const avantNb = await page.evaluate(() => document.querySelectorAll('.seq-note').length);
    await page.touchscreen.tap(r2.right + 200, r2.top + r2.height / 2);
    await page.waitForTimeout(400);
    const apresLoin = await page.evaluate(() => document.querySelectorAll('.seq-note').length);
    console.log('notes avant/après tap à 200px :', avantNb, '->', apresLoin);
    check(apresLoin === avantNb + 1, `un tap à 200px de toute note en crée bien une nouvelle plutôt que de repêcher au loin (${avantNb} -> ${apresLoin})`);

    console.log('=== 4. Une note CONFORTABLE (large) n\'est pas devenue "collante" au-delà de ce qu\'elle était ===');
    // Taillée à 10 croches dans un accord de 16 temps : assez large pour dépasser largement le
    // plancher de tolérance, et assez de place LIBRE ensuite dans le MÊME accord pour taper 60px plus
    // loin sans sortir de la zone visible d'un téléphone étroit (contrairement à une note qui
    // couvrirait l'accord entier, dont le bord droit peut tomber hors écran — piège qui a fait
    // échouer une première version de ce test : « rien » ne se produisait, faute de case sous le
    // point tapé, et non parce que le repêchage aurait été trop généreux).
    await page.evaluate((c) => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'S', chords: c }] }));
        localStorage.removeItem('harmohubSeqDockHeight');
    }, [mk('C', 'min', 3, 16)]);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(500);
    await page.evaluate(() => { window.app.editChord(0, 0); window.app.toggleSequencer('continu'); });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
        window.app.pushSeqUndo();
        const chord = window.app.readChord();
        const { pattern } = window.app.getLiveSeqPattern(chord);
        for (let s = 10; s < pattern.length; s++) window.app.applySeqCell(0, s, false, false);
        window.app.renderSequencer();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('.seq-note[data-voice="0"]').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    const r3 = await page.evaluate(() => document.querySelector('.seq-note[data-voice="0"]').getBoundingClientRect());
    const planchePx = await page.evaluate(() => window.app.constructor.SEQ_TAP_TOLERANCE_MIN_PX);
    console.log('largeur de la note large :', Math.round(r3.width), 'px — plancher de tolérance :', planchePx, 'px');
    if (!exiger(r3.width > planchePx + 60, `la note est assez large pour que +60px dépasse sa propre tolérance (${Math.round(r3.width)}px pour un plancher de ${planchePx}px)`)) bilan();
    const avantNb3 = await page.evaluate(() => document.querySelectorAll('.seq-note').length);
    await page.touchscreen.tap(r3.right + 60, r3.top + r3.height / 2);
    await page.waitForTimeout(400);
    const apres3 = await page.evaluate(() => document.querySelectorAll('.seq-note').length);
    check(apres3 === avantNb3 + 1,
        `à 60px d'une note déjà large, on crée toujours une note plutôt que de la repêcher à tort (${avantNb3} -> ${apres3})`);

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
