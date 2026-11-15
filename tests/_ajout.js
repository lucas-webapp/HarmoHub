// Ajouter un accord par le GESTE de l'utilisateur, quelle que soit la largeur (lot 10e, réécrit à L5b puis L6c).
// Téléphone (< 900 px) : la saisie vit dans le panneau d'ajout, que la case « + » de la partie ouvre — on la touche d'abord, on tape, on valide, puis Échap referme le panneau.
// Ordinateur : « + Accord » n'existe plus (L6c) ; on tape le symbole DANS la case « + » du bout de la partie et on valide par Entrée (le même chemin que la saisie rapide :
// addChordInputToSection, donc « C/Am/F/G » marche aussi) ; le double-clic sur cette case ouvre la fenêtre d'ajout au clic (banc ajout_clic).
async function ajouterAccord(page, symbole, section = 0) {
    const tel = await page.evaluate(() => window.matchMedia('(max-width: 899px)').matches);
    const ouverte = await page.evaluate(() => { const i = document.getElementById('quick-add-input'); return !!i && i.getBoundingClientRect().width > 0; });
    if (ouverte) { // un banc a déjà ouvert le panneau d'ajout lui-même : on se sert de sa saisie telle quelle
        await page.fill('#quick-add-input', symbole);
        await page.click('#quick-add-btn');
        return;
    }
    if (tel) {
        await page.click(`#progression-sections .cell-add-input[data-section="${section}"]`);
        await page.fill('#quick-add-input', symbole);
        await page.click('#quick-add-btn');
        await page.keyboard.press('Escape'); await page.waitForTimeout(150);
        return;
    }
    const champ = `#progression-sections .cell-add-input[data-section="${section}"]`;
    await page.click(champ);
    await page.fill(champ, symbole);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
}

// Ouvre le panneau d'ajout d'une partie (palette de la tonalité, suggestions, saisie rapide) à l'ordinateur. Ses portes à l'écran : le « + » entre deux cases (au survol), qui vise un endroit
// PRÉCIS ; il n'y en a plus au bout d'une partie depuis que « + Accord » est retiré (L6c : le double-clic sur le « + » ouvre la fenêtre d'ajout au clic, un autre panneau). Les bancs
// qui éprouvent le panneau À LA FIN d'une partie l'ouvrent donc par l'appel de l'appli, faute de geste.
async function ouvrirSaisieRapide(page, section = 0) {
    await page.evaluate((s) => window.app.ouvrirAideAjout(s, null), section);
    await page.waitForTimeout(300);
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
module.exports = { ajouterAccord, ouvrirSaisieRapide, editerAccord, ajouterAccordTypé };
