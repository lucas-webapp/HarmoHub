// LA BARRE DE SÉLECTION, LE CLIC DROIT, TAB DANS LA RETAPE (refonte, lot 7b), avec de vrais gestes.
//
// CE QUE DEMANDE LA MAQUETTE VALIDÉE (docs/refonte.md) : « Ctrl/Maj+clic = multiple (barre de sélection : copier, dupliquer, transposer, boucler,
// supprimer) ; double-clic = retaper le nom (Tab = case suivante) ; clic droit = copier, coller, pipettes, insérer, dupliquer, supprimer ».
//
// CE QUE LE BANC TIENT : Ctrl+clic et Maj+clic composent un groupe, et la barre apparaît (en bas de la grille, centrée sur elle, au-dessus de la barre
// de lecture) à la place de la bulle ; chaque bouton agit sur CE groupe seul, d'un Ctrl+Z ; × et Échap relâchent ; le clic droit copie, colle après,
// et insère avant / après en ouvrant le panneau d'ajout déjà visé ; Tab et Maj+Tab font passer la retape d'une case à l'autre, d'une partie à l'autre ;
// le téléphone n'a pas bougé (lot 10).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('barre de sélection');
const { estBruitReseau } = require('./_harness');
const { retaperNom, dblclickHorsNom } = require('./_geste_accord');

plan(49);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, b = 4) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const S = [
        { title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] },
        { title: 'Refrain', chords: [mk('F', 'maj7'), mk('E', 'min7')] },
    ];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport) => {
        const p = await nav.newPage({ viewport });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const partie = (p, s) => p.evaluate((s) => loadProgressionSections()[s].chords.map(c => c.root + ':' + c.quality).join(' '), s);
    const cellule = (s, i) => `#progression-sections .chord-grid[data-section="${s}"] .grid-cell[data-index="${i}"]`;
    const barre = (p) => p.evaluate(() => {
        const b = document.getElementById('barre-selection');
        if (!b || b.hidden || b.getBoundingClientRect().height === 0) return null;
        const r = b.getBoundingClientRect(), g = document.getElementById('grille-cadre').getBoundingClientRect(), l = document.getElementById('barre-lecture').getBoundingClientRect();
        return { compte: document.getElementById('bs-compte').textContent, centre: (r.left + r.right) / 2, centreGrille: (g.left + g.right) / 2, bas: r.bottom, lecture: l.top,
            boucle: document.getElementById('bs-boucler').getAttribute('aria-pressed') };
    });
    const groupe = (p) => p.evaluate(() => [...window.app.multiSelect].sort((a, b) => a - b).join(','));
    const bs = async (p, id) => { await p.click(`#${id}`); await p.waitForTimeout(300); };
    const menu = (p) => p.evaluate(() => [...document.querySelectorAll('#context-menu button')].filter(b => !b.hidden).map(b => b.querySelector('.ctx-label').textContent));
    const ctrlZ = async (p) => { await p.keyboard.press('Control+z'); await p.waitForTimeout(300); };

    // ======================================================================================================
    console.log('\n=== A. Ctrl+clic, Maj+clic : un groupe, et la barre ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    check(await barre(p) === null, 'au départ, pas de barre');
    await p.click(cellule(0, 3), { button: 'right' }); await p.waitForTimeout(300);
    check(!(await menu(p)).includes('Coller après'), 'rien de copié encore : le clic droit ne propose pas « Coller après »');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    // Point B de la refonte du séquenceur : le double-clic ouvre la bulle (un clic seul ne fait qu'entendre l'accord).
    await dblclickHorsNom(p, cellule(0, 0)); await p.waitForTimeout(300); // B2 (12/11) : sur le texte du nom, le double-clic le retape ; la bulle s'ouvre sur le reste de la case
    check(await barre(p) === null && await p.evaluate(() => !document.getElementById('bulle-accord').hidden), 'un accord (double-clic) : la bulle, pas la barre');
    await p.click(cellule(0, 1), { modifiers: ['Control'] }); await p.waitForTimeout(300);
    let b = await barre(p);
    exiger(!!b, 'Ctrl+clic sur un second accord fait apparaître la barre');
    check(b.compte === '2 accords sélectionnés', `elle dit combien (« ${b.compte} »)`);
    check(await p.evaluate(() => document.getElementById('bulle-accord').hidden), 'la bulle (qui ne parle que d\'un accord) s\'efface');
    check(Math.abs(b.centre - b.centreGrille) <= 2 && b.bas <= b.lecture - 10 && b.bas >= b.lecture - 24, `en bas de la grille, centrée sur elle, au-dessus de la barre de lecture (centre ${Math.round(b.centre)}/${Math.round(b.centreGrille)}, bas ${Math.round(b.bas)}, lecture ${Math.round(b.lecture)})`);
    await p.click(cellule(0, 0)); await p.waitForTimeout(500);
    check(await barre(p) === null, 'un clic simple relâche le groupe : la barre s\'en va');
    await p.click(cellule(0, 3), { modifiers: ['Shift'] }); await p.waitForTimeout(300);
    check(await groupe(p) === '0,1,2,3' && (await barre(p)).compte === '4 accords sélectionnés', `Maj+clic prend la plage depuis l'accord choisi (${await groupe(p)})`);
    await p.click(cellule(0, 1), { modifiers: ['Shift'] }); await p.waitForTimeout(300);
    check(await groupe(p) === '0,1', `un second Maj+clic repart du même accord (${await groupe(p)})`);

    // ======================================================================================================
    console.log('\n=== B. Transposer : ce groupe seul, d\'un Ctrl+Z ===');
    await p.click(cellule(0, 2), { modifiers: ['Shift'] }); await p.waitForTimeout(300); // 0,1,2
    await p.click(cellule(0, 0), { modifiers: ['Control'] }); await p.waitForTimeout(300); // 1,2
    check(await groupe(p) === '1,2', 'Ctrl+clic retire un accord du groupe');
    await bs(p, 'bs-transposer-haut');
    check(await partie(p, 0) === 'C:maj7 A#:min7 D#:min7 G:dom7', `+ : Am7 et Dm7 montent d'un demi-ton, les autres non (${await partie(p, 0)})`);
    check(await groupe(p) === '1,2' && !!(await barre(p)) && await p.evaluate(() => window.app.selectedIndex === 0), 'le groupe reste pris, son ancre aussi : on peut cliquer encore');
    await bs(p, 'bs-transposer-bas'); await bs(p, 'bs-transposer-bas');
    check(await partie(p, 0) === 'C:maj7 G#:min7 C#:min7 G:dom7', `− deux fois : un demi-ton sous l'original (${await partie(p, 0)})`);
    await ctrlZ(p); await ctrlZ(p); await ctrlZ(p);
    check(await partie(p, 0) === 'C:maj7 A:min7 D:min7 G:dom7', 'trois clics, trois Ctrl+Z : retour à l\'original');
    check(await partie(p, 1) === 'F:maj7 E:min7', 'le refrain n\'a jamais bougé');

    // ======================================================================================================
    console.log('\n=== C. Dupliquer, Boucler ===');
    await p.click(cellule(0, 1)); await p.waitForTimeout(500);
    await p.click(cellule(0, 2), { modifiers: ['Shift'] }); await p.waitForTimeout(300);
    await bs(p, 'bs-dupliquer');
    check(await partie(p, 0) === 'C:maj7 A:min7 D:min7 A:min7 D:min7 G:dom7', `Dupliquer recopie le groupe juste après lui (${await partie(p, 0)})`);
    check(await groupe(p) === '3,4', 'la copie devient le groupe (pour la retransposer aussitôt)');
    const recouvre = await p.evaluate(() => { const t = document.getElementById('toast'), b = document.getElementById('barre-selection'); if (!t || !t.classList.contains('show')) return 'pas de message';
        const rt = t.getBoundingClientRect(), rb = b.getBoundingClientRect(); return rt.bottom > rb.top && rt.top < rb.bottom ? 'recouvre' : 'au-dessus'; });
    check(recouvre === 'au-dessus', `le message « accords dupliqués » passe au-dessus de la barre, sans la cacher (${recouvre})`);
    await ctrlZ(p);
    check(await partie(p, 0) === 'C:maj7 A:min7 D:min7 G:dom7', 'un Ctrl+Z la retire');
    await p.click(cellule(0, 1)); await p.waitForTimeout(500);
    await p.click(cellule(0, 2), { modifiers: ['Shift'] }); await p.waitForTimeout(300);
    await bs(p, 'bs-boucler');
    const lr = await p.evaluate(() => JSON.stringify(window.app.loopRange));
    check(lr === JSON.stringify({ startSection: 0, startIndex: 1, endSection: 0, endIndex: 2 }) && await p.evaluate(() => window.app.bouclerLecture === true), `Boucler pose la plage à boucler sur ces accords, boucle allumée (${lr})`);
    check((await barre(p)).boucle === 'true' && await p.evaluate(() => !!document.querySelector('#progression-sections .loop-range-bar')), 'le bouton s\'allume, la bande de la règle apparaît');
    await bs(p, 'bs-boucler');
    check(await p.evaluate(() => window.app.loopRange === null) && (await barre(p)).boucle === 'false', 'un second appui retire la plage');

    // ======================================================================================================
    console.log('\n=== D. Copier, puis coller ailleurs ===');
    await bs(p, 'bs-copier');
    check(await p.evaluate(() => (window.app.clipboard || []).map(c => c.root + c.quality).join(' ')) === 'Amin7 Dmin7', 'Copier prend les deux accords, dans l\'ordre de la grille');
    check(await barre(p) === null, 'et relâche le groupe, comme Ctrl+C');
    await p.click(cellule(1, 0)); await p.waitForTimeout(500);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await p.keyboard.press('Control+v'); await p.waitForTimeout(400);
    check(await partie(p, 1) === 'F:maj7 A:min7 D:min7 E:min7', `Ctrl+V les colle derrière l'accord cliqué (${await partie(p, 1)})`);
    await ctrlZ(p);

    // ======================================================================================================
    console.log('\n=== E. Supprimer ; × et Échap relâchent ===');
    await p.click(cellule(0, 1)); await p.waitForTimeout(500);
    await p.click(cellule(0, 3), { modifiers: ['Control'] }); await p.waitForTimeout(300);
    await bs(p, 'bs-supprimer');
    check(await partie(p, 0) === 'C:maj7 D:min7', `Supprimer retire Am7 et G7, et eux seuls (${await partie(p, 0)})`);
    check(await barre(p) === null, 'plus rien de sélectionné : la barre s\'en va');
    await ctrlZ(p);
    check(await partie(p, 0) === 'C:maj7 A:min7 D:min7 G:dom7', 'un Ctrl+Z les rend tous les deux');
    await p.click(cellule(0, 0)); await p.waitForTimeout(500);
    await p.click(cellule(0, 2), { modifiers: ['Shift'] }); await p.waitForTimeout(300);
    await bs(p, 'bs-fermer');
    check(await barre(p) === null && await groupe(p) === '' && await p.evaluate(() => window.app.selectedIndex === null), '× : tout désélectionné, l\'accord d\'ancrage compris');
    await p.click(cellule(0, 0)); await p.waitForTimeout(500);
    await p.click(cellule(0, 2), { modifiers: ['Shift'] }); await p.waitForTimeout(300);
    exiger(!!(await barre(p)), 'Maj+clic recompose un groupe');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    check(await barre(p) === null && await groupe(p) === '', 'Échap aussi');

    // ======================================================================================================
    console.log('\n=== F. Clic droit : copier, coller après, insérer ===');
    await p.click(cellule(0, 3), { button: 'right' }); await p.waitForTimeout(300);
    let m = await menu(p);
    check(m.includes('Copier') && m.includes('Insérer avant…') && m.includes('Insérer après…') && m.includes('Coller après'), `copier, coller après (la copie de D), insérer (${m.slice(0, 5).join(', ')}…)`);
    check(m.includes('Copier l\'accord') && m.includes('Dupliquer') && m.includes('Supprimer'), 'les pipettes, Dupliquer et Supprimer restent');
    await p.click('#context-menu [data-ctx-action="copy-chord"]'); await p.waitForTimeout(300);
    await p.click(cellule(0, 0), { button: 'right' }); await p.waitForTimeout(300);
    exiger((await menu(p)).includes('Coller après'), 'après une copie, « Coller après » apparaît');
    await p.click('#context-menu [data-ctx-action="paste-after"]'); await p.waitForTimeout(400);
    check(await partie(p, 0) === 'C:maj7 G:dom7 A:min7 D:min7 G:dom7', `G7 collé juste après Cmaj7 (${await partie(p, 0)})`);
    await ctrlZ(p);
    check(await partie(p, 0) === 'C:maj7 A:min7 D:min7 G:dom7', 'un Ctrl+Z le retire');
    await p.click(cellule(0, 2), { button: 'right' }); await p.waitForTimeout(300);
    await p.click('#context-menu [data-ctx-action="insert-before"]'); await p.waitForTimeout(400);
    const lieu = () => p.evaluate(() => { const a = document.getElementById('ajout-aide'); return a && !a.hidden ? a.querySelector('.ajout-lieu').textContent : null; });
    check(await lieu() === 'Couplet, avant Dm7 (après Am7)', `« Insérer avant… » ouvre l'ajout, visé : « ${await lieu()} »`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await p.click(cellule(0, 3), { button: 'right' }); await p.waitForTimeout(300);
    await p.click('#context-menu [data-ctx-action="insert-after"]'); await p.waitForTimeout(400);
    check(await lieu() === 'Couplet, à la fin, après G7', `« Insérer après… » le dernier : « ${await lieu()} »`);
    await p.click('#ajout-aide .ajout-tuile:not(.ajout-tuile-sugg) >> text="C"'); await p.waitForTimeout(300);
    check(await partie(p, 0) === 'C:maj7 A:min7 D:min7 G:dom7 C:maj', 'et une tuile ajoute bien là');
    await ctrlZ(p);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);

    // ======================================================================================================
    // Refonte du séquenceur, point B : le double-clic ouvre l'accord ; la retape du nom passe par « Renommer » au clic droit.
    console.log('\n=== G. « Renommer » = retaper le nom ; Tab = la case suivante ===');
    await retaperNom(p, 0, 2, 400);
    const retape = () => p.evaluate(() => { const i = document.querySelector('#progression-sections .cell-sym-input'); if (!i) return null; const c = i.closest('.grid-cell'); return c.dataset.section + ':' + c.dataset.index; });
    exiger(await retape() === '0:2', '« Renommer » ouvre la retape du nom');
    await p.keyboard.type('Em7'); await p.keyboard.press('Tab'); await p.waitForTimeout(400);
    check(await partie(p, 0) === 'C:maj7 A:min7 E:min7 G:dom7' && await retape() === '0:3', `Tab valide Em7 et passe à la case suivante (${await retape()})`);
    check(await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('cell-sym-input')), 'le curseur y est : on tape tout de suite');
    await p.keyboard.press('Tab'); await p.waitForTimeout(400);
    check(await retape() === '1:0', `au bout du couplet, Tab passe au refrain (${await retape()})`);
    await p.keyboard.press('Shift+Tab'); await p.waitForTimeout(400);
    check(await retape() === '0:3' && await partie(p, 0) === 'C:maj7 A:min7 E:min7 G:dom7', 'Maj+Tab revient en arrière, sans rien changer');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    check(await retape() === null, 'Échap referme la retape');
    await ctrlZ(p);
    check(await partie(p, 0) === 'C:maj7 A:min7 D:min7 G:dom7', 'un Ctrl+Z défait la retape d\'Em7');
    await p.close();

    // ======================================================================================================
    console.log('\n=== H. Le téléphone n\'a pas bougé (lot 10) ===');
    p = await ouvrir({ width: 390, height: 844 });
    const tel = await p.evaluate(() => {
        window.app.multiSelect = new Set([0, 1]); window.app.loadProgression();
        const b = document.getElementById('barre-selection');
        window.app.openContextMenu(100, 100, { type: 'chord', section: 0, index: 0 });
        const nouveaux = ['copy-chord', 'paste-after', 'insert-before', 'insert-after'].filter(a => !document.querySelector(`#context-menu [data-ctx-action="${a}"]`).hidden);
        window.app.closeContextMenu();
        return { barre: !b.hidden && b.getBoundingClientRect().height > 0, nouveaux };
    });
    check(!tel.barre && tel.nouveaux.length === 0, `ni barre, ni nouvelles lignes au menu (${JSON.stringify(tel)})`);
    await p.close();

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length ? erreurs.join(' | ') : 'aucune'})`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
