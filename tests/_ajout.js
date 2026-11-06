// Ajouter un accord par le GESTE de l'utilisateur, quelle que soit la largeur (lot 10e).
// Ordinateur : la saisie est dans la page, on tape et on valide. Téléphone (< 900px) : la saisie vit dans le panneau d'ajout, que la case « + » de la
// partie ouvre — on la touche d'abord, on tape, on valide, puis Échap referme le panneau (il resterait sinon ouvert au-dessus de la grille).
async function ajouterAccord(page, symbole, section = 0) {
    const tel = await page.evaluate(() => window.matchMedia('(max-width: 899px)').matches);
    if (tel) await page.click(`#progression-sections .cell-add-input[data-section="${section}"]`);
    await page.fill('#quick-add-input', symbole);
    await page.click('#quick-add-btn');
    if (tel) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }
}

// Le séquenceur compact et la carte Accord ne se montrent plus en mode Ajout sous 900px (lot 10e) : ils appartiennent à un accord ouvert en modification.
// Les bancs qui les éprouvent ouvrent donc d'abord un accord de la grille (le premier, créé au besoin par le geste d'ajout), comme le fait l'utilisateur.
async function editerAccord(page, index = 0) {
    const n = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('myProgression')).sections.reduce((t, s) => t + s.chords.length, 0); } catch (e) { return 0; } });
    if (n === 0) await ajouterAccord(page, 'C');
    // index négatif : en partant de la fin (-1 = le dernier accord de la partie active)
    await page.evaluate((i) => { const a = window.app, n = loadProgressionSections()[a.activeSection].chords.length; a.editChord(a.activeSection, i < 0 ? n + i : i); }, index);
    await page.waitForTimeout(250);
}
// Même geste avec un accord décrit par sa fondamentale et son type (« C », « maj7 ») : le symbole saisi est celui que l'appli affiche pour lui.
async function ajouterAccordTypé(page, racine, type, section = 0) {
    const symbole = await page.evaluate(([r, q]) => r + (QUALITY_LABEL[q] ?? ''), [racine, type]);
    await ajouterAccord(page, symbole, section);
}
module.exports = { ajouterAccord, editerAccord, ajouterAccordTypé };
