// LES GESTES QUI OUVRENT UN ACCORD, depuis la refonte du séquenceur (point B, 11/11) : « un clic ou un toucher : la case est sélectionnée et l'accord est
// joué. Rien ne s'ouvre. Double-clic, ou toucher une case déjà sélectionnée : ouvre le panneau de l'accord ». Le double-clic ne retape plus le nom : c'est
// « Renommer » au clic droit (ou à l'appui long). Écrits une fois ici pour tous les bancs qui ouvraient un accord d'un simple clic.
const caseSel = (section, index) => `#progression-sections .grid-cell[data-section="${section}"][data-index="${index}"]`;

async function centreCase(page, section, index, bas = false) {
    const loc = page.locator(caseSel(section, index));
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    // `bas` : près du bord bas, loin du symbole (certains bancs visent une zone nue de la case).
    return { x: b.x + b.width / 2, y: bas ? b.y + b.height - 6 : b.y + b.height / 2 };
}

// Ordinateur : le double-clic ouvre la bulle de l'accord (le premier clic le choisit et le fait entendre).
async function ouvrirBulle(page, section, index, attente = 500) {
    const c = await centreCase(page, section, index);
    await page.mouse.dblclick(c.x, c.y);
    await page.waitForTimeout(attente);
}

// Ordinateur : la bulle, puis « Réglages du son » — l'inspecteur sur cet accord.
async function ouvrirSon(page, section, index, attente = 500) {
    await ouvrirBulle(page, section, index, 300);
    await page.click('#bulle-accord [data-bulle="son"]');
    await page.waitForTimeout(attente);
}

// Téléphone : un premier toucher choisit l'accord, un second (sur la case déjà choisie) ouvre le panneau d'accord.
async function ouvrirPanneau(page, section, index, attente = 700, bas = false) {
    const c = await centreCase(page, section, index, bas);
    await page.touchscreen.tap(c.x, c.y);
    await page.waitForTimeout(500);
    const c2 = await centreCase(page, section, index, bas);
    await page.touchscreen.tap(c2.x, c2.y);
    await page.waitForTimeout(attente);
}

// Retaper le nom : clic droit sur la case, « Renommer ».
async function retaperNom(page, section, index, attente = 400) {
    const c = await centreCase(page, section, index);
    await page.mouse.click(c.x, c.y, { button: 'right' });
    await page.waitForTimeout(300);
    await page.click('#context-menu [data-ctx-action="rename-chord"]');
    await page.waitForTimeout(attente);
}

module.exports = { caseSel, centreCase, ouvrirBulle, ouvrirSon, ouvrirPanneau, retaperNom };
