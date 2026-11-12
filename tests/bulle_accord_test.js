// LA BULLE « QUEL ACCORD » (refonte, lot 6b), avec de vrais clics.
//
// CE QUE DEMANDE LA MAQUETTE VALIDÉE (docs/refonte.md) : « clic = sélectionne et ouvre la bulle » ; la bulle dit QUEL accord — fondamentale, type,
// basse, durée, ‹ › vers le voisin ; « une bulle = UNE étape d'annulation. Modification directe, Ctrl+Z comme filet » ; « double-clic = retaper le
// nom » ; « Sélection BLEUE, lecture VERTE » (devenue GRISE CLAIRE le 12/11, B1).
//
// CE QUE LE BANC TIENT : la bulle dit le vrai accord et le modifie pour de bon ; toutes les retouches d'une bulle s'annulent d'UN Ctrl+Z, et deux
// bulles font deux étapes ; ‹ › et les flèches la déplacent ; Échap, × et le clic à côté la ferment, un clic sur une autre case la déplace ; le
// double-clic retape le nom ; « Réglages du son » ouvre la carte Accord sur cet accord ; la sélection est bleue ; un clic n'est plus un « mode » ;
// le téléphone n'a pas bougé (lot 10).
// REFONTE DU SÉQUENCEUR, POINT B (11/11) : « un clic = écouter, double-clic = ouvrir ». La bulle s'ouvre donc au DOUBLE-clic ; ouverte, elle suit un clic
// simple sur une autre case ; la retape du nom passe par « Renommer » au clic droit. Le banc tient tout le reste à l'identique, avec ces gestes-là.
const { chromium } = require('playwright');
const { retaperNom, dblclickHorsNom } = require('./_geste_accord');
const { check, exiger, plan, bilan } = require('./_harness')('bulle « quel accord »');
const { estBruitReseau } = require('./_harness');

plan(45);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, b = 4) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const S = [{ title: 'Couplet', chords: [mk('C', 'maj7'), { ...mk('A', 'min7'), inversion: 1, drop: 'drop2' }, mk('D', 'min7'), mk('G', 'dom7')] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport, opts = {}) => {
        const p = await nav.newPage({ viewport, ...opts });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const bulle = (p) => p.evaluate(() => {
        const b = document.getElementById('bulle-accord');
        if (!b || b.hidden) return null;
        const r = b.getBoundingClientRect();
        const presse = (a) => [...b.querySelectorAll(`[data-bulle="${a}"][aria-pressed="true"]`)].map(x => x.textContent);
        return { nom: b.querySelector('.bulle-nom').textContent, degre: (b.querySelector('.bulle-degre') || {}).textContent || '', ou: b.querySelector('.bulle-ou').textContent,
            racines: b.querySelectorAll('[data-bulle="root"]').length, types: b.querySelectorAll('[data-bulle="quality"]').length, basses: b.querySelectorAll('[data-bulle="bass"]').length,
            root: presse('root'), quality: presse('quality'), bass: presse('bass'), duree: b.querySelector('.bulle-duree').textContent,
            haut: r.top, bas: r.bottom, gauche: r.left, droite: r.right, l: Math.round(r.width) };
    });
    const accord = (p, i) => p.evaluate((i) => { const c = loadProgressionSections()[0].chords[i]; return { root: c.root, quality: c.quality, bass: c.bass || null, beats: c.beats }; }, i);
    const cliquer = async (p, i) => { await dblclickHorsNom(p, `#progression-sections .grid-cell[data-index="${i}"]`); await p.waitForTimeout(250); }; // ouvrir = double-clic hors du nom (B2, 12/11)
    const choisir = async (p, action, valeur) => { await p.click(`#bulle-accord [data-bulle="${action}"]${valeur != null ? `[data-valeur="${valeur}"]` : ''}`); await p.waitForTimeout(250); };

    // ======================================================================================================
    console.log('\n=== A. Un double-clic : la case est choisie, la bulle s\'ouvre et dit quel accord ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    await cliquer(p, 1);
    let b = await bulle(p);
    exiger(!!b, 'un clic sur une case ouvre la bulle');
    check(b.nom === 'Am7' && b.degre === 'vi7' && b.ou === 'mes. 2 · Couplet', `elle dit l'accord, son degré et sa place : ${b.nom} · ${b.degre} · ${b.ou}`);
    check(b.racines === 12 && b.types === 20 && b.basses === 13, `douze fondamentales, les vingt types, treize basses (${b.racines}/${b.types}/${b.basses})`);
    check(JSON.stringify([b.root, b.quality, b.bass]) === JSON.stringify([['A'], ['Min 7'], ['—']]) && b.duree === '1 mesure', `l'accord est coché tel qu'il est : ${b.root} / ${b.quality} / ${b.bass} / ${b.duree}`);
    const cel = await p.evaluate(() => { const c = document.querySelector('#progression-sections .grid-cell[data-index="1"]'); const r = c.getBoundingClientRect(); return { bas: r.bottom, gauche: r.left, bord: getComputedStyle(c).borderTopColor, cls: c.className }; });
    check(b.haut >= cel.bas && Math.abs(b.gauche - cel.gauche) <= 1 && b.l === 404, `sous la case, calée sur son bord gauche, 404px (${Math.round(b.haut)} sous ${Math.round(cel.bas)})`);
    // B1 (12/11) : la sélection est GRISE CLAIRE (elle était bleue, rgba(76, 141, 255) : « ne va pas avec le design de l'application ») ; le détail est tenu par `selection_grise`.
    check(/selected/.test(cel.cls) && /rgba\(214, 219, 226/.test(cel.bord), `la case choisie est GRISE CLAIRE (${cel.bord})`);
    check(await p.evaluate(() => window.app.appMode === 'add' && window.app.editingIndex == null), 'un clic n\'est plus un « mode » : l\'appli ne bascule pas en modification');
    check(await p.evaluate(() => !hasUnsavedChanges), 'ouvrir la bulle ne modifie rien');

    // ======================================================================================================
    console.log('\n=== B. On modifie directement ===');
    // On ENTEND l'accord retouché, comme à un clic sur sa case : l'appel au lecteur est compté.
    await p.evaluate(() => { window.__ecoutes = 0; const o = window.app.playSavedChord.bind(window.app); window.app.playSavedChord = (...a) => { window.__ecoutes++; return o(...a); }; });
    await choisir(p, 'root', 'D');
    check(await p.evaluate(() => window.__ecoutes) === 1, `on entend le nouvel accord (${await p.evaluate(() => window.__ecoutes)} écoute)`);
    b = await bulle(p);
    check(JSON.stringify(await accord(p, 1)) === JSON.stringify({ root: 'D', quality: 'min7', bass: null, beats: 4 }) && b && b.nom === 'Dm7', `fondamentale D : l'accord devient Dm7 tout de suite, la bulle reste ouverte (${b && b.nom})`);
    check(await p.evaluate(() => { const c = loadProgressionSections()[0].chords[1]; return c.inversion === 1 && c.drop === 'drop2'; }), 'changer la fondamentale garde le renversement et le drop');
    await choisir(p, 'quality', 'maj7');
    check(await p.evaluate(() => { const c = loadProgressionSections()[0].chords[1]; return c.inversion === 0 && c.drop === 'none'; }), 'un autre TYPE remet renversement et drop à zéro (ceux de l\'ancien accord ne veulent plus rien dire — la maquette)');
    await choisir(p, 'bass', 'F#');
    await choisir(p, 'duree-plus');
    b = await bulle(p);
    check(JSON.stringify(await accord(p, 1)) === JSON.stringify({ root: 'D', quality: 'maj7', bass: 'F#', beats: 5 }), `type, basse et durée suivent : ${JSON.stringify(await accord(p, 1))}`);
    check(b.duree === '1 mesure et 1 temps' && b.bass[0] === 'F♯', `la bulle les montre (« ${b.duree} », basse ${b.bass})`);
    check(await p.evaluate(() => document.querySelector('#progression-sections .grid-cell[data-index="1"] .cell-sym').textContent.startsWith('Dmaj7')), 'la case de la grille aussi');
    check(await p.evaluate(() => hasUnsavedChanges), 'le morceau est marqué modifié');
    await choisir(p, 'duree-moins');
    check((await accord(p, 1)).beats === 4, '« − » rend un temps');

    // ======================================================================================================
    console.log('\n=== C. Une bulle = une étape d\'annulation ===');
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
    check(JSON.stringify(await accord(p, 1)) === JSON.stringify({ root: 'A', quality: 'min7', bass: null, beats: 4 }), `UN Ctrl+Z défait les cinq retouches de la bulle d'un coup : ${JSON.stringify(await accord(p, 1))}`);
    check(await p.evaluate(() => { const c = loadProgressionSections()[0].chords[1]; return c.inversion === 1 && c.drop === 'drop2'; }), 'renversement et drop compris');
    await cliquer(p, 1);
    await choisir(p, 'root', 'E');
    await choisir(p, 'suiv');
    b = await bulle(p);
    check(b && b.nom === 'Dm7' && b.ou === 'mes. 3 · Couplet', `› passe à l'accord suivant (${b && b.nom})`);
    check(await p.evaluate(() => window.app.selectedIndex) === 2, 'et le choisit dans la grille');
    await choisir(p, 'root', 'G');
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
    check((await accord(p, 2)).root === 'D' && (await accord(p, 1)).root === 'E', 'deux bulles, deux étapes : le 1er Ctrl+Z ne défait que la seconde');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
    check((await accord(p, 1)).root === 'A', 'le 2e défait la première');
    await p.keyboard.press('Control+y'); await p.waitForTimeout(300);
    check((await accord(p, 1)).root === 'E', 'Ctrl+Y la rétablit');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);

    // ======================================================================================================
    console.log('\n=== D. Naviguer, fermer, déplacer ===');
    await cliquer(p, 0);
    check(await p.evaluate(() => document.querySelector('#bulle-accord [data-bulle="prec"]').disabled), '‹ est grisé sur le premier accord');
    await choisir(p, 'suiv'); await choisir(p, 'prec');
    check((await bulle(p)).nom === 'Cmaj7', '› puis ‹ ramène au premier');
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    check(await bulle(p) === null, 'Échap ferme la bulle');
    check(await p.evaluate(() => window.app.selectedIndex) === 0, 'la case reste choisie');
    await cliquer(p, 0);
    await choisir(p, 'fermer');
    check(await bulle(p) === null, '× la ferme');
    await cliquer(p, 0);
    await p.click('#progression-sections .grid-cell[data-index="3"]'); await p.waitForTimeout(250); // un clic SIMPLE, bulle ouverte
    b = await bulle(p);
    check(b && b.nom === 'G7', `un clic sur une autre case DÉPLACE la bulle (${b && b.nom})`);
    // « À côté » pour de vrai : un point hors de la bulle ET de la grille (la bulle du dernier accord est calée sur le bord droit de l'écran).
    const dehors = await p.evaluate(() => { const b = document.getElementById('bulle-accord').getBoundingClientRect(); return { x: 200, y: Math.min(innerHeight - 120, 760), dansBulle: 200 >= b.left && 200 <= b.right }; });
    exiger(!dehors.dansBulle, 'le point visé est bien hors de la bulle');
    await p.mouse.click(dehors.x, dehors.y); await p.waitForTimeout(200);
    check(await bulle(p) === null, 'un clic à côté la ferme');
    check(JSON.stringify(await accord(p, 3)) === JSON.stringify({ root: 'G', quality: 'dom7', bass: null, beats: 4 }), 'sans rien changer à l\'accord');
    // Les flèches du clavier : la bulle suit l'accord choisi.
    await cliquer(p, 1);
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    await p.keyboard.press('ArrowRight'); await p.waitForTimeout(250);
    b = await bulle(p);
    check(b && b.nom === 'Dm7' && await p.evaluate(() => window.app.selectedIndex) === 2, `→ au clavier : la sélection ET la bulle passent au suivant (${b && b.nom})`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);

    // ======================================================================================================
    console.log('\n=== E. « Renommer » : retaper le nom ===');
    await cliquer(p, 2); // bulle ouverte : « Renommer » la retire devant la saisie
    await retaperNom(p, 0, 2, 300);
    const saisie = await p.evaluate(() => { const i = document.querySelector('#progression-sections .grid-cell[data-index="2"] .cell-sym-input'); return i ? i.value : null; });
    check(saisie === 'Dm7', `un champ apparaît dans la case, avec le nom (« ${saisie} »)`);
    check(await bulle(p) === null, 'la bulle s\'efface devant la saisie');
    await p.keyboard.press('Control+a'); await p.keyboard.type('Bb7'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    check(JSON.stringify(await accord(p, 2)) === JSON.stringify({ root: 'A#', quality: 'dom7', bass: null, beats: 4 }), `on tape « Bb7 », Entrée : ${JSON.stringify(await accord(p, 2))}`);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);

    // ======================================================================================================
    console.log('\n=== F. « Réglages du son » ===');
    await cliquer(p, 3);
    await choisir(p, 'son');
    check(await p.evaluate(() => window.app.editingIndex === 3 && window.app.appMode === 'edit'), 'la carte Accord s\'ouvre sur CET accord (le comment il sonne)');
    check(await bulle(p) === null, 'la bulle se retire');
    check(await p.evaluate(() => /rgba?\(214, 219, 226/.test(getComputedStyle(document.querySelector('#progression-sections .grid-cell[data-index="3"]')).borderTopColor)), 'la case en modification est grise claire elle aussi (B1, 12/11) — fini l\'orange');
    await p.evaluate(() => window.app.cancelEdit()); await p.waitForTimeout(200);

    // ======================================================================================================
    console.log('\n=== G. Près du bas de l\'écran, la bulle s\'ouvre au-dessus ===');
    // Un morceau assez long pour que la grille défile : sa dernière partie est amenée tout en bas de l'écran.
    await p.evaluate(() => { const s = loadProgressionSections(); for (let k = 0; k < 6; k++) s.push({ title: `P${k}`, chords: s[0].chords.map(c => ({ ...c })) }); saveProgressionSections(s); window.app.loadProgression(); });
    await p.waitForTimeout(300);
    const derniere = await p.evaluate(() => loadProgressionSections().length - 1);
    const sel = `#progression-sections .grid-cell[data-section="${derniere}"][data-index="0"]`;
    await p.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'end' }), sel);
    await p.waitForTimeout(300);
    await dblclickHorsNom(p, sel); await p.waitForTimeout(300);
    b = await bulle(p);
    const ctop = await p.evaluate((sel) => document.querySelector(sel).getBoundingClientRect().top, sel);
    exiger(ctop > 500, `la case visée est bien en bas de l'écran (${Math.round(ctop)}px sur 900)`);
    check(b && b.bas <= ctop + 1 && b.haut >= 0, `pas la place en dessous : la bulle s'ouvre au-dessus de la case, dans l'écran (${b && Math.round(b.haut)}–${b && Math.round(b.bas)}, case à ${Math.round(ctop)})`);
    await p.close();

    // ======================================================================================================
    console.log('\n=== H. Le téléphone n\'a pas bougé (lot 10) ===');
    p = await ouvrir({ width: 860, height: 900 });
    await p.click('#progression-sections .grid-cell[data-index="1"]'); await p.waitForTimeout(250);
    check(await bulle(p) === null && await p.evaluate(() => window.app.selectedIndex) === 1, 'sous 900px (la mise en page du téléphone), même à la souris : la case est choisie, sans bulle');
    await p.close();
    p = await ouvrir({ width: 390, height: 844 }, { hasTouch: true, isMobile: true });
    await p.tap('#progression-sections .grid-cell[data-index="1"]'); await p.waitForTimeout(300);
    check(await bulle(p) === null && await p.evaluate(() => window.app.selectedIndex) === 1, 'un toucher choisit la case, sans bulle');
    await p.close();

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length ? erreurs.join(' | ') : 'aucune'})`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
