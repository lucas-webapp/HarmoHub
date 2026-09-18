// LE RANGEMENT AUTOMATIQUE DES EXPORTS (voir fichiers.js, « COUCHE RANGEMENT »).
//
// Ce banc éprouve l'étage du HAUT : écrire dans un dossier désigné plutôt que dans Téléchargements.
// L'étage du bas (le nommage, qui marche partout) a son propre banc, nommage_fichiers_test.
//
// COMMENT ON TESTE UNE API QUI OUVRE UNE FENÊTRE SYSTÈME. showDirectoryPicker ouvre un sélecteur de
// fichiers du système d'exploitation : aucun navigateur piloté ne peut cliquer dedans. On le remplace
// donc par un dossier OPFS (le disque privé du navigateur), qui expose EXACTEMENT la même interface
// FileSystemDirectoryHandle. Tout ce qui est testé en dessous du sélecteur — création de
// l'arborescence, écriture, index, persistance, permission — est donc le vrai code, pas une imitation.
//
// CE QUI COMPTE LE PLUS ICI n'est pas que le rangement marche : c'est qu'il ÉCHOUE BIEN. Un dossier
// débranché, une permission retirée, une clé USB retirée ne doivent jamais faire disparaître un
// export. Le repli sur le téléchargement est vérifié autant que le chemin heureux.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('rangement des fichiers exportés');

plan(21);

// Le sélecteur système remplacé par un dossier OPFS de même interface (voir l'en-tête).
const STUB = () => {
    window.__dossierDemande = 0;
    window.showDirectoryPicker = async () => {
        window.__dossierDemande++;
        if (window.__refuserSelecteur) { const e = new Error('annulé'); e.name = 'AbortError'; throw e; }
        const opfs = await navigator.storage.getDirectory();
        return await opfs.getDirectoryHandle('BancHarmoHub', { create: true });
    };
};

// Parcourt réellement le dossier : c'est le disque qui fait foi, pas ce que l'appli croit avoir écrit.
const ARBRE = async (d, prefixe = '') => {
    const vus = [];
    for await (const [nom, h] of d.entries()) {
        const chemin = prefixe + nom;
        if (h.kind === 'directory') vus.push(chemin + '/', ...(await window.__arbre(h, chemin + '/')));
        else vus.push(chemin);
    }
    return vus;
};

(async () => {
    const navigateur = await chromium.launch();
    const erreurs = [];
    const contexte = await navigateur.newContext({ viewport: { width: 1300, height: 950 } });
    await contexte.addInitScript(STUB);
    await contexte.addInitScript(`window.__arbre = ${ARBRE.toString()}`);

    const page = await contexte.newPage();
    page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(900);

    // Table rase : un banc qui hérite du dossier d'un run précédent ne prouve rien sur la création.
    await page.evaluate(async () => {
        try { await (await navigator.storage.getDirectory()).removeEntry('BancHarmoHub', { recursive: true }); } catch (e) { }
        await new Promise((r) => { const q = indexedDB.deleteDatabase('harmohub_fichiers'); q.onsuccess = q.onerror = q.onblocked = r; });
        localStorage.removeItem('harmohub_dossier_rangement:HarmoHub');
    });

    if (!exiger(await page.evaluate(() => typeof enregistrerFichier === 'function' && typeof preparerRangement === 'function'),
        'la couche rangement est chargée par index.html')) return bilan();

    // ---- Avant toute configuration : rien n'est rangé, tout est téléchargé ----
    check(await page.evaluate(() => rangementDisponible()), 'le navigateur sait ranger (showDirectoryPicker présent)');
    check((await page.evaluate(() => preparerRangement())) === null,
        'sans dossier choisi, preparerRangement ne renvoie rien — et n\'invente pas de racine');

    const avant = await page.evaluate(async () => {
        const vus = [];
        const vrai = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () { if (this.download) vus.push(this.download); };
        try { await enregistrerFichier(new Blob(['x']), { morceau: 'Avant', type: 'Morceau', extension: 'json', dossier: 'morceaux' }); }
        finally { HTMLAnchorElement.prototype.click = vrai; }
        return vus;
    });
    check(avant.length === 1 && /^HarmoHub - Avant - Morceau - /.test(avant[0]),
        `sans dossier, l'export retombe sur le téléchargement — ${JSON.stringify(avant)}`);

    // ---- Le menu Fichier annonce la destination ----
    await page.click('#file-menu-btn');
    await page.waitForTimeout(150);
    const libelleAvant = await page.textContent('#file-menu [data-file-action="dossier"] .file-menu-label');
    check(/Choisir un dossier/.test(libelleAvant), `le menu propose de choisir un dossier — « ${libelleAvant} »`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);

    // ---- Configuration ----
    const racineNom = await page.evaluate(() => choisirDossierRangement().then((r) => (r ? r.name : null)));
    check(racineNom === 'BancHarmoHub', `le dossier choisi est mémorisé — ${racineNom}`);

    // L'ARBORESCENCE est créée TOUT DE SUITE, pas au premier export de chaque type : un dossier vide
    // ne dit pas ce que l'appli va y mettre.
    const arbre = await page.evaluate(async () => {
        const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('BancHarmoHub');
        return (await window.__arbre(d)).sort();
    });
    // PDF/Structure a été RETIRÉ de l'arborescence : la vue Structure passe encore par l'impression du
    // navigateur, donc rien ne saurait écrire dedans. Un dossier vide qu'on crée quand même est une
    // invitation à y chercher ce qui n'y sera jamais.
    for (const attendu of ['Bibliotheque/', 'Morceaux/', 'PDF/', 'PDF/Accords/', 'PDF/Paroles/', 'MIDI/', 'Audio/', 'Texte/']) {
        check(arbre.includes(attendu), `le dossier « ${attendu} » est créé dès le choix — ${JSON.stringify(arbre)}`);
    }

    // ---- L'export réel : plus rien ne passe par Téléchargements ----
    const range = await page.evaluate(async () => {
        const vus = [];
        const vrai = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () { if (this.download) vus.push(this.download); };
        let res;
        try {
            localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Ballade', savedAt: Date.now(), sections: [] }]));
            res = await window.app.exportLibrary();
            await window.app.downloadSongBackup(loadSongs()[0]);
        } finally { HTMLAnchorElement.prototype.click = vrai; }
        const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('BancHarmoHub');
        return { telecharges: vus, arbre: (await window.__arbre(d)).sort() };
    });
    check(range.telecharges.length === 0,
        `avec un dossier configuré, AUCUN téléchargement n'est déclenché — ${JSON.stringify(range.telecharges)}`);
    // NOM STABLE DANS LE DOSSIER, nom horodaté dans Téléchargements — l'asymétrie est voulue. Dans un
    // dossier, un nom fixe donne un point de repère et la rotation garde les anciens dans `_versions`.
    // Dans Téléchargements il n'y a ni rotation ni versions : deux fichiers de même nom y deviennent
    // « (1) », « (2) », précisément ce qu'on cherche à éviter.
    check(range.arbre.includes('Bibliotheque/HarmoHub - Bibliotheque.json'),
        `la bibliothèque atterrit dans Bibliotheque/, sous un nom stable — ${JSON.stringify(range.arbre)}`);
    check(range.arbre.includes('Morceaux/HarmoHub - Ballade - Morceau.json'),
        `un morceau seul atterrit dans Morceaux/, sous un nom stable — ${JSON.stringify(range.arbre)}`);

    // Le fichier écrit contient bien les octets, pas une coquille vide — une sauvegarde illisible
    // serait pire qu'une absence de sauvegarde, puisqu'on croirait l'avoir.
    const contenu = await page.evaluate(async () => {
        const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('BancHarmoHub');
        const dossier = await d.getDirectoryHandle('Morceaux');
        for await (const [nom, h] of dossier.entries()) {
            if (h.kind === 'file' && nom.includes('Ballade')) return JSON.parse(await (await h.getFile()).text());
        }
        return null;
    });
    check(contenu && contenu.kind === 'library-backup' && contenu.songs[0].name === 'Ballade',
        'le fichier rangé est relisible et complet (pas une coquille vide)');

    // ---- PLUS D'INDEX : ce qui n'est lu par personne ne doit pas être écrit ----
    // Un `_index.json` recensait chaque écriture. Rien ne le lisait : les garde-fous, l'inventaire et
    // les versions interrogent tous le DISQUE, qui est la seule source honnête (l'utilisateur peut
    // déplacer un fichier à la main). Il coûtait une lecture, une analyse et une écriture par export.
    const racineFichiers = await page.evaluate(async () => {
        const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('BancHarmoHub');
        const noms = [];
        for await (const [nom, h] of d.entries()) if (h.kind === 'file') noms.push(nom);
        return noms;
    });
    check(!racineFichiers.includes('_index.json'),
        `aucun index n'est écrit à la racine — ${JSON.stringify(racineFichiers)}`);

    // ---- La persistance : c'est elle qui fait la différence entre un outil et une corvée ----
    const page2 = await contexte.newPage();
    page2.on('pageerror', (e) => erreurs.push('page2 pageerror: ' + e.message));
    await page2.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page2.waitForTimeout(900);
    const retrouve = await page2.evaluate(() => preparerRangement().then((r) => (r ? r.name : null)));
    check(retrouve === 'BancHarmoHub', `après rechargement, le dossier est retrouvé sans redemander — ${retrouve}`);
    check(await page2.evaluate(() => window.__dossierDemande === 0),
        'et le sélecteur système n\'a PAS été rouvert (sinon ce serait à refaire chaque séance)');
    await page2.click('#file-menu-btn');
    await page2.waitForTimeout(150);
    const libelleApres = await page2.textContent('#file-menu [data-file-action="dossier"] .file-menu-label');
    check(libelleApres === 'Dossier : BancHarmoHub', `le menu affiche le dossier configuré — « ${libelleApres} »`);
    await page2.keyboard.press('Escape');

    // ---- Paroles partage la MÊME racine (même origine, même base) ----
    const p3 = await contexte.newPage();
    p3.on('pageerror', (e) => erreurs.push('paroles pageerror: ' + e.message));
    await p3.goto(`${BASE}/paroles.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await p3.waitForTimeout(600);
    const vuParoles = await p3.evaluate(() => preparerRangement().then((r) => (r ? r.name : null)));
    check(vuParoles === 'BancHarmoHub', `Paroles voit le dossier configuré depuis HarmoHub — ${vuParoles}`);
    const rangeTexte = await p3.evaluate(async () => {
        const res = await enregistrerFichier(new Blob(['paroles']), { morceau: 'Ballade', type: 'Texte', extension: 'txt', dossier: 'texte' });
        return res;
    });
    check(rangeTexte.range === true && rangeTexte.dossier === 'Texte',
        `le .txt de Paroles est rangé lui aussi — ${JSON.stringify(rangeTexte)}`);
    // LA PAGE PAROLES NE CHARGE PAS script.js. Tout ce dont fichiers.js a besoin doit donc vivre DANS
    // fichiers.js : une dépendance vers script.js y devient une fonction inexistante, et le rangement
    // repart en téléchargement sans un mot. C'est arrivé avec asciiPourMidi, écrite d'abord dans
    // script.js puis appelée par fichiers.js.
    const manquantes = await p2.evaluate(() => ['nomExport', 'nomCanonique', 'enregistrerFichier', 'preparerRangement',
        'asciiPourMidi', 'nomsCandidats', 'partagerFichier', 'messageEnregistrement', 'listerRangement']
        .filter(n => typeof window[n] !== 'function'));
    check(manquantes.length === 0,
        `Paroles dispose de tout ce que fichiers.js utilise — ${JSON.stringify(manquantes)}`);

    // ---- Lister : le disque fait foi, du plus récent au plus ancien ----
    // Le second fichier venait du contrôle de l'index, désormais retiré : on le pose explicitement,
    // plutôt que de dépendre d'un effet de bord d'un autre contrôle.
    await page.evaluate(() => enregistrerFichier(new Blob(['x']), { morceau: 'Aurore', type: 'Morceau', extension: 'json', dossier: 'morceaux' }));
    const liste = await page.evaluate(() => listerRangement('morceaux'));
    check(liste.length === 2 && liste[0] > liste[1],
        `listerRangement rend les fichiers dans l'ordre décroissant des noms — ${JSON.stringify(liste)}`);

    // ---- L'ÉCHEC : le point le plus important du banc ----
    // Dossier supprimé sous les pieds de l'appli (clé USB retirée, dossier déplacé). Le fichier ne
    // doit PAS disparaître : il repart dans Téléchargements.
    const apresPanne = await page.evaluate(async () => {
        await (await navigator.storage.getDirectory()).removeEntry('BancHarmoHub', { recursive: true });
        const vus = [];
        const vrai = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () { if (this.download) vus.push(this.download); };
        let res;
        try { res = await enregistrerFichier(new Blob(['secours']), { morceau: 'Panne', type: 'Morceau', extension: 'json', dossier: 'morceaux' }); }
        finally { HTMLAnchorElement.prototype.click = vrai; }
        return { res, vus };
    });
    check(apresPanne.res.range === false && apresPanne.vus.length === 1,
        `dossier disparu en cours de route : le fichier est téléchargé plutôt que perdu — ${JSON.stringify(apresPanne.vus)}`);
    const messages = await page.evaluate(() => [
        messageEnregistrement({ range: true, dossier: 'PDF/Accords', racine: 'Musique' }, 'PDF exporté'),
        messageEnregistrement({ range: false }, 'PDF exporté'),
    ]);
    check(messages[0] === 'PDF exporté → Musique/PDF/Accords' && messages[1] === 'PDF exporté → dossier Téléchargements',
        `le message dit où le fichier est VRAIMENT — ${JSON.stringify(messages)}`);

    // ---- Un navigateur sans l'API : l'entrée reste visible et s'explique ----
    const contexteNu = await navigateur.newContext({ viewport: { width: 1300, height: 950 } });
    await contexteNu.addInitScript(() => { delete window.showDirectoryPicker; });
    const nue = await contexteNu.newPage();
    nue.on('pageerror', (e) => erreurs.push('sans API pageerror: ' + e.message));
    await nue.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await nue.waitForTimeout(900);
    await nue.click('#file-menu-btn');
    await nue.waitForTimeout(150);
    const entreeNue = nue.locator('#file-menu [data-file-action="dossier"]');
    check(await entreeNue.isDisabled(), 'sans l\'API, l\'entrée est éteinte plutôt que trompeuse');
    check(/Téléchargements/.test(await entreeNue.textContent()),
        'et dit où les fichiers iront, au lieu de disparaître sans explication');
    const telNue = await nue.evaluate(async () => {
        const vus = [];
        const vrai = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () { if (this.download) vus.push(this.download); };
        try { await enregistrerFichier(new Blob(['x']), { morceau: 'Safari', type: 'Morceau', extension: 'json', dossier: 'morceaux' }); }
        finally { HTMLAnchorElement.prototype.click = vrai; }
        return vus;
    });
    check(telNue.length === 1, `et l'export fonctionne quand même — ${JSON.stringify(telNue)}`);
    check(/ - \d{4}-\d{2}-\d{2} \d{4}\.json$/.test(telNue[0] || ''),
        `un fichier TÉLÉCHARGÉ garde l'horodatage, lui — ${JSON.stringify(telNue)}`);

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.slice(0, 3).join(' | ')})`);

    await navigateur.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
