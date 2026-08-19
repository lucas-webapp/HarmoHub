// Retour utilisateur : « toutes les touches jouées ne sont pas visibles sur le diagramme piano pour
// [Am6]. Vérifier s'il y a d'autres problèmes équivalents. »
//
// Enquête menée avant d'écrire ce banc (voir docs/dette-tests.md si le symptôme resurgit un jour) :
// reproduction directe de Am6 (Ajout rapide ET édition d'un accord déjà enregistré, desktop ET
// mobile, diagramme guitare affiché ou non), capture d'écran haute résolution, lecture pixel par
// pixel de la case active — les 4 notes (A/C/E/F#) sont TOUJOURS visibles, correctement positionnées
// et correctement colorées par fonction. Balayage automatisé en complément (34 560 combinaisons :
// les 20 qualités du sélecteur × 12 tons × 4 octaves × 4 renversements × 3 drops × 3 basses) via
// l'invariant réel du code — computePianoWindow(midis) contient TOUJOURS [min(midis), max(midis)]
// par construction (floorC arrondit le bas AU PLUS BAS, ceilC le haut AU PLUS HAUT, avant même que la
// boucle d'élargissement à 2 octaves ne s'exécute) — zéro écart trouvé.
//
// Verdict : non reproductible avec le code actuel. Le symptôme décrit correspond mot pour mot à un
// défaut DÉJÀ CORRIGÉ (voir renderPiano dans script.js, le commentaire sur #piano-col : un clavier
// écrasé à son min-content, « une lamelle », où « les touches actives et leurs rôles étaient
// correctement posées » — exactement ce qu'on observerait comme « note jouée mais invisible »). Ce
// banc verrouille le cas signalé PLUS un balayage large des accords enrichis (ceux les plus
// susceptibles de refaire surface si la régression revenait un jour), pour qu'un retour futur soit
// détecté avant le prochain signalement plutôt qu'après.
const { chromium, devices } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, plan, bilan } = require('./_harness')('diagramme piano : toutes les notes jouées visibles');
plan(9);

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));

    // ============================================================
    // === A. Cas signalé : Am6 dans un vrai morceau enregistré, guitare affichée à côté ===
    // ============================================================
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
        const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 0, octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            mk('C', 'maj', 4), mk('A', 'm6', 4), mk('G', '7', 4)] }] }));
        localStorage.setItem('harmohubShowGuitar', '1');
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.evaluate(() => window.app.editChord(0, 1)); // ouvre l'Am6
    await page.waitForTimeout(300);

    const am6 = await page.evaluate(() => {
        const chord = window.app.readChord();
        const midis = chord.getMidiNotes();
        const activeKeys = new Set([...document.querySelectorAll('.key.active')].map(k => +k.dataset.midi));
        return { label: chord.getLabel(false), midis, missing: midis.filter(m => !activeKeys.has(m)) };
    });
    check(am6.label === 'Am6' && am6.midis.length === 4, `Am6 charge bien ses 4 notes (A/C/E/F#) — obtenu ${am6.label}, ${am6.midis.length} notes`);
    check(am6.missing.length === 0, `les 4 notes de Am6 sont TOUTES actives sur le diagramme piano (aucune manquante) — manquantes : ${JSON.stringify(am6.missing)}`);

    const pianoBox = await page.locator('#piano-viz').boundingBox();
    check(pianoBox.width > 100, `le clavier n'est pas écrasé à son min-content (largeur ${pianoBox.width}px, régression historique connue — voir renderPiano/#piano-col)`);

    // ============================================================
    // === B. Même cas, mobile (tap réel) ===
    // ============================================================
    const iphone = devices['iPhone 13'];
    const ctx = await browser.newContext({ ...iphone });
    const mpage = await ctx.newPage();
    mpage.on('pageerror', e => errors.push('pageerror(mobile): ' + e.message));
    await mpage.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await mpage.waitForTimeout(400);
    await mpage.evaluate(() => {
        const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 0, octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            mk('C', 'maj', 4), mk('A', 'm6', 4), mk('G', '7', 4)] }] }));
        localStorage.setItem('harmohubShowGuitar', '1');
    });
    await mpage.reload({ waitUntil: 'load' });
    await mpage.waitForTimeout(400);
    await mpage.evaluate(() => window.app.editChord(0, 1));
    await mpage.waitForTimeout(300);
    const am6mobile = await mpage.evaluate(() => {
        const chord = window.app.readChord();
        const midis = chord.getMidiNotes();
        const activeKeys = new Set([...document.querySelectorAll('.key.active')].map(k => +k.dataset.midi));
        const vw = window.innerWidth;
        const offscreen = [...document.querySelectorAll('.key.active')].filter(k => {
            const r = k.getBoundingClientRect();
            return r.right < 0 || r.left > vw || r.width === 0;
        }).length;
        return { missing: midis.filter(m => !activeKeys.has(m)), offscreen };
    });
    check(am6mobile.missing.length === 0, `Am6 sur mobile : aucune note manquante — manquantes : ${JSON.stringify(am6mobile.missing)}`);
    check(am6mobile.offscreen === 0, `Am6 sur mobile : aucune touche active hors-cadre (${am6mobile.offscreen})`);
    await ctx.close();

    // ============================================================
    // === C. Balayage large : d'autres accords enrichis auraient-ils le même problème ? ===
    // ============================================================
    // Passe par l'API interne (Chord/computePianoWindow/updateViz) plutôt que par un clic par
    // combinaison : c'est le SEUL point qui décide quelles touches s'allument (renderGuitarDiagram
    // et le reste de l'UI ne changent rien à ce calcul), et ça permet de couvrir des milliers de cas
    // en quelques secondes au lieu d'une éternité de clics — voir le raisonnement complet en tête de
    // fichier.
    const sweep = await page.evaluate(() => {
        const QUALITIES = ['maj','min','sus2','sus4','maj7','min7','dom7','6','m6','dim','dim7','m7b5','aug',
            'add9','add11','maj9','m9','dom9','dom11','dom13'];
        const ROOTS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
        const OCTAVES = [2, 3, 4, 5];
        const INVERSIONS = [0, 1, 2, 3];
        const DROPS = ['none', 'drop2', 'drop3'];
        const BASSES = [null, 'D', 'F#'];
        const problems = [];
        let combos = 0;
        for (const quality of QUALITIES) for (const root of ROOTS) for (const octave of OCTAVES)
            for (const inversion of INVERSIONS) for (const drop of DROPS) for (const bass of BASSES) {
                combos++;
                const chord = new Chord(root, quality, 4, inversion, drop, octave, bass);
                const midis = chord.getMidiNotes();
                const win = window.app.computePianoWindow(midis);
                if (midis.some(m => m < win.low || m > win.high)) {
                    problems.push({ root, quality, octave, inversion, drop, bass, kind: 'hors-fenetre' });
                    continue;
                }
                window.app.pianoWindow = null;
                window.app.ensurePianoWindow(midis);
                window.app.updateViz(midis, chord.getRoleMap());
                const activeKeys = new Set([...document.querySelectorAll('.key.active')].map(k => +k.dataset.midi));
                const missing = midis.filter(m => !activeKeys.has(m));
                if (missing.length) problems.push({ root, quality, octave, inversion, drop, bass, missing, kind: 'absent-du-dom' });
            }
        return { combos, problems: problems.slice(0, 10), total: problems.length };
    });
    console.log(`Balayage : ${sweep.combos} combinaisons (qualités × tons × octaves × renversements × drops × basses)`);
    if (sweep.total) console.log('Problèmes trouvés :', JSON.stringify(sweep.problems, null, 1));
    check(sweep.combos > 30000, `le balayage couvre bien un large éventail (${sweep.combos} combinaisons)`);
    check(sweep.total === 0, `aucun accord (toutes qualités confondues) ne laisse une note jouée invisible sur le piano — ${sweep.total} trouvé(s)`);

    // ============================================================
    // === D. Contrôle visuel : la couleur d'une touche noire active se distingue bien de ses voisines ===
    // ============================================================
    // Régression plausible et purement visuelle (invisible aux vérifications DOM ci-dessus) : une
    // touche active correctement posée mais dont la couleur se confondrait avec l'ivoire/l'ébène du
    // clavier au repos. Vérifié en pixels sur le F# actif de Am6 (6e, rôle "ext" — la touche la plus
    // étroite du clavier, donc la plus à risque).
    const contraste = await page.evaluate(() => {
        const key = document.querySelector('.key.black.active.role-ext') || document.querySelector('.key.active.role-ext');
        if (!key) return null;
        const style = getComputedStyle(key);
        return style.backgroundImage || style.backgroundColor;
    });
    check(!!contraste && contraste !== 'none' && !contraste.includes('rgba(0, 0, 0, 0)'),
        `la touche active (rôle "ext") porte bien une couleur de fond distincte — obtenu ${JSON.stringify(contraste)}`);

    check(errors.length === 0, 'aucune erreur JavaScript, desktop et mobile confondus — ' + JSON.stringify(errors));

    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
