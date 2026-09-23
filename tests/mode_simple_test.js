// LE RETOUR AU MODE SIMPLE (voir oublierDossierExports).
//
// POURQUOI CE CHEMIN EXISTE. Retour utilisateur : « le fonctionnement Safari et Chrome fonctionnent
// quand même très différemment [...] je veux garder quelque chose de simple ». Le rangement
// automatique ne marche que sur Chrome ; le mode simple, lui, se comporte À L'IDENTIQUE partout.
// Le dossier se désignait mais ne s'abandonnait pas : un réglage qu'on peut prendre sans pouvoir le
// défaire n'est pas un réglage, c'est un engagement.
//
// CE QUE CE BANC ÉPROUVE AVANT TOUT : qu'abandonner le rangement ne touche AUCUN fichier. « Ne plus
// ranger » pourrait s'entendre comme « effacer ce qui est rangé » — le dossier et son contenu doivent
// être exactement dans l'état où on les a laissés.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('retour au mode simple');
const bruit = require('./_harness').estBruitReseau;

plan(16);

const STUB = () => {
    window.showDirectoryPicker = async () =>
        (await navigator.storage.getDirectory()).getDirectoryHandle('BancSimple', { create: true });
};
const LISTER = async (chemin) => {
    let d = await (await navigator.storage.getDirectory()).getDirectoryHandle('BancSimple');
    for (const b of chemin.split('/').filter(Boolean)) d = await d.getDirectoryHandle(b);
    const noms = [];
    for await (const [nom, h] of d.entries()) if (h.kind === 'file') noms.push(nom);
    return noms.sort();
};

(async () => {
    const navigateur = await chromium.launch();
    const erreurs = [];
    const contexte = await navigateur.newContext({ viewport: { width: 1300, height: 950 } });
    await contexte.addInitScript(STUB);
    await contexte.addInitScript(`window.__lister = ${LISTER.toString()};`);
    const page = await contexte.newPage();
    page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !bruit(m.text())) erreurs.push('console: ' + m.text()); });
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(900);
    await page.evaluate(async () => {
        try { await (await navigator.storage.getDirectory()).removeEntry('BancSimple', { recursive: true }); } catch (e) { }
        await new Promise((r) => { const q = indexedDB.deleteDatabase('harmohub_fichiers'); q.onsuccess = q.onerror = q.onblocked = r; });
        localStorage.removeItem('harmohub_dossier_rangement:HarmoHub');
        localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Ballade', savedAt: 1000, sections: [] }]));
    });
    if (!exiger(await page.evaluate(() => typeof window.app.oublierDossierExports === 'function'),
        'le retour au mode simple est en place')) return bilan();

    const ouvrirMenu = async () => { await page.click('#file-menu-btn'); await page.waitForTimeout(200); };
    const entrees = () => page.evaluate(() => [...document.querySelectorAll('#file-menu [data-file-action]')].map(b => b.dataset.fileAction));

    // ---- Sans dossier : rien à abandonner, donc aucune entrée pour le faire ----
    await ouvrirMenu();
    check(!(await entrees()).includes('oublier-dossier'),
        'sans dossier configuré, aucune entrée « ne plus ranger » — elle n\'aurait aucun objet');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);

    // ---- On configure, on écrit, on vérifie que le mode dossier est bien actif ----
    await page.evaluate(() => choisirDossierRangement());
    await page.evaluate(() => window.app.enregistrerMorceauDansDossier(loadSongs()[0]));
    await page.waitForTimeout(400);
    const avant = await page.evaluate(() => window.__lister('Morceaux'));
    check(avant.includes('HarmoHub - Ballade - Morceau.json'), `un fichier est bien rangé — ${JSON.stringify(avant)}`);
    await ouvrirMenu();
    const avecDossier = await entrees();
    check(avecDossier.includes('oublier-dossier'), 'avec un dossier, l\'entrée apparaît');
    const libelle = await page.textContent('#file-menu [data-file-action="dossier"] .file-menu-label');
    check(/^Dossier : /.test(libelle), `et le menu nomme le dossier en cours — « ${libelle} »`);
    const aide = await page.textContent('#file-menu [data-file-action="oublier-dossier"] .file-menu-hint');
    check(/Téléchargements/.test(aide) && /Safari/.test(aide),
        `l'entrée dit ce qui va changer, et que ce sera le comportement de Safari — « ${aide} »`);

    // ---- LE GESTE ----
    await page.click('#file-menu [data-file-action="oublier-dossier"]');
    await page.waitForTimeout(500);

    // LE CONTRÔLE QUI COMPTE LE PLUS : aucun fichier touché.
    const apres = await page.evaluate(() => window.__lister('Morceaux'));
    check(JSON.stringify(avant) === JSON.stringify(apres),
        `abandonner le rangement ne touche AUCUN fichier — ${JSON.stringify(apres)}`);
    const message = await page.textContent('#toast');
    check(/intacts?/.test(message) || /Téléchargements/.test(message),
        `et le message le dit, au lieu de laisser croire à un effacement — « ${(message || '').slice(0, 80)} »`);

    // ---- L'appli est revenue au mode simple ----
    check((await page.evaluate(() => nomRacineAffiche())) === '', 'plus aucun dossier mémorisé');
    check((await page.evaluate(() => preparerRangement())) === null,
        'et preparerRangement ne rend plus rien : les exports repartent en téléchargement');

    const telecharge = await page.evaluate(async () => {
        const vus = [];
        const vrai = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () { if (this.download) vus.push(this.download); };
        try { await window.app.downloadSongBackup(loadSongs()[0]); }
        finally { HTMLAnchorElement.prototype.click = vrai; }
        return vus;
    });
    check(telecharge.length === 1 && / - \d{4}-\d{2}-\d{2} \d{4}\.json$/.test(telecharge[0]),
        `un export repart bien dans Téléchargements, sous le nom horodaté — ${JSON.stringify(telecharge)}`);

    // Les deux boutons qui n'ont plus d'objet doivent avoir disparu, sinon ils mèneraient à une
    // invitation à choisir un dossier — exactement ce qu'on vient de refuser.
    await page.evaluate(() => window.app.openFilesWindow());
    await page.waitForTimeout(300);
    check(await page.locator('#export-changes-btn').count() === 0, '« Exporter ce qui a changé » a disparu du gestionnaire');
    check(await page.locator('#disk-files-btn').count() === 0, '« Fichiers du disque » aussi');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // La suppression redevient la confirmation simple, la même que sur Safari.
    page.once('dialog', (d) => d.dismiss());
    await page.evaluate(() => window.app.deleteSongById('s1'));
    await page.waitForTimeout(400);
    check(await page.locator('#delete-files-modal').isHidden(),
        'et supprimer ne demande plus rien sur les fichiers : même geste que sur Safari');

    // ---- RÉVERSIBLE DANS LES DEUX SENS : c'est tout l'intérêt ----
    await page.evaluate(() => choisirDossierRangement());
    await page.waitForTimeout(300);
    check((await page.evaluate(() => nomRacineAffiche())) === 'BancSimple',
        'redésigner un dossier remarche aussitôt — le réglage se reprend dans les deux sens');
    const retrouve = await page.evaluate(() => window.__lister('Morceaux'));
    check(JSON.stringify(retrouve) === JSON.stringify(avant),
        `et l'appli retrouve les fichiers laissés là — ${JSON.stringify(retrouve)}`);

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.slice(0, 2).join(' | ')})`);
    await navigateur.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
