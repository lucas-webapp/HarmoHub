// LES GARDE-FOUS D'ÉCRASEMENT (voir fichiers.js « NOM CANONIQUE » et etatMorceauSurDisque).
//
// DEUX EXIGENCES, MOT POUR MOT :
//   « si je réexporte une bibliothèque, les morceaux déjà présents sur le disque et qui ne sont plus
//     sur l'application ne doivent pas être supprimés »
//   « des morceaux modifiés ailleurs (que l'appli) a "oublié" ne doivent pas être écrasés »
//
// Ce banc les éprouve toutes les deux, et surtout LEURS CAS LIMITES. Le fichier canonique porte un nom
// STABLE : c'est ce qui rend le remplacement possible, donc c'est aussi ce qui rend l'écrasement
// possible. Chaque contrôle ci-dessous garde une porte que le nom horodaté fermait toute seule.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('garde-fous d\'écrasement');

plan(27);

const STUB = () => {
    window.showDirectoryPicker = async () =>
        (await navigator.storage.getDirectory()).getDirectoryHandle('BancGardeFous', { create: true });
};

// Lit le disque pour de vrai : c'est lui qui fait foi, pas ce que l'appli croit y avoir laissé.
const LIRE = async (chemin) => {
    let d = await (await navigator.storage.getDirectory()).getDirectoryHandle('BancGardeFous');
    const bouts = chemin.split('/');
    for (const b of bouts.slice(0, -1)) d = await d.getDirectoryHandle(b);
    return JSON.parse(await (await (await d.getFileHandle(bouts[bouts.length - 1])).getFile()).text());
};
const LISTER = async (chemin) => {
    let d = await (await navigator.storage.getDirectory()).getDirectoryHandle('BancGardeFous');
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
    await contexte.addInitScript(`window.__lire = ${LIRE.toString()}; window.__lister = ${LISTER.toString()};`);
    const page = await contexte.newPage();
    page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(900);

    await page.evaluate(async () => {
        try { await (await navigator.storage.getDirectory()).removeEntry('BancGardeFous', { recursive: true }); } catch (e) { }
        await new Promise((r) => { const q = indexedDB.deleteDatabase('harmohub_fichiers'); q.onsuccess = q.onerror = q.onblocked = r; });
        localStorage.removeItem('harmohub_dossier_rangement:HarmoHub');
    });
    if (!exiger(await page.evaluate(() => typeof nomCanonique === 'function' && typeof lireJsonRange === 'function'),
        'la couche garde-fous est chargée')) return bilan();
    await page.evaluate(() => choisirDossierRangement());

    const morceau = (extra = {}) => Object.assign({
        id: 's1', name: 'Ballade', savedAt: 1000,
        sections: [{ title: 'A', chords: [] }],
    }, extra);
    const poser = (songs) => page.evaluate((l) => localStorage.setItem('harmohubSongs', JSON.stringify(l)), songs);

    // ---- LE NOM STABLE : c'est tout l'intérêt, et c'est vérifiable ----
    check(await page.evaluate(() => nomCanonique({ morceau: 'Ballade', type: 'Morceau', extension: 'json' }))
        === 'HarmoHub - Ballade - Morceau.json', 'le nom canonique ne porte aucune date');

    await poser([morceau()]);
    await page.evaluate(() => window.app.enregistrerMorceauDansDossier(loadSongs()[0]));
    await page.waitForTimeout(200);
    let fichiers = await page.evaluate(() => window.__lister('Morceaux'));
    check(fichiers.includes('HarmoHub - Ballade - Morceau.json'),
        `un seul fichier, au nom stable — ${JSON.stringify(fichiers)}`);

    // Réenregistrer DIX fois ne doit pas produire dix fichiers courants : l'ancien part en version.
    for (let i = 2; i <= 4; i++) {
        await poser([morceau({ savedAt: 1000 * i, sections: Array.from({ length: i }, () => ({ title: 'A', chords: [] })) })]);
        await page.evaluate(() => window.app.enregistrerMorceauDansDossier(loadSongs()[0]));
        await page.waitForTimeout(150);
    }
    fichiers = await page.evaluate(() => window.__lister('Morceaux'));
    check(fichiers.length === 1 && fichiers[0] === 'HarmoHub - Ballade - Morceau.json',
        `quatre enregistrements laissent UN seul fichier courant — ${JSON.stringify(fichiers)}`);
    const courant = await page.evaluate(() => window.__lire('Morceaux/HarmoHub - Ballade - Morceau.json'));
    check(courant.songs[0].savedAt === 4000, `et c'est bien le plus récent (savedAt ${courant.songs[0].savedAt})`);
    const versions = await page.evaluate(() => window.__lister('Morceaux/_versions'));
    check(versions.length === 3, `les trois précédents sont gardés dans _versions (${versions.length})`);
    check(versions.every(n => n.startsWith('HarmoHub - Ballade - Morceau - ')),
        `et portent l'horodatage, qui sert justement là — ${JSON.stringify(versions.slice(0, 2))}`);

    // ---- LE GARDE-FOU : le disque est plus récent ----
    // On simule ce que craint l'utilisateur : le fichier a été modifié ailleurs, et l'appli n'en sait
    // rien parce qu'elle a été vidée / rouverte sur une autre machine.
    await page.evaluate(async () => {
        const d = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('BancGardeFous')).getDirectoryHandle('Morceaux');
        const f = await (await d.getFileHandle('HarmoHub - Ballade - Morceau.json')).createWritable();
        await f.write(JSON.stringify({ app: 'HarmoHub', kind: 'library-backup', version: 1, songs: [
            { id: 's1', name: 'Ballade', savedAt: 999999, sections: [{ title: 'Ailleurs', chords: [] }] }] }));
        await f.close();
    });
    await poser([morceau({ savedAt: 4000 })]);
    const etat = await page.evaluate(() => window.app.etatMorceauSurDisque(
        window.__racine || undefined, loadSongs()[0]).catch(() => null));
    // etatMorceauSurDisque a besoin de la racine : on passe par le chemin public, qui la prépare.
    const auto = await page.evaluate(() => window.app.enregistrerMorceauDansDossier(loadSongs()[0], { auto: true }));
    check(auto.fait === false && auto.raison === 'plus-recent',
        `un fichier plus récent N'EST PAS écrasé en automatique — ${JSON.stringify(auto.raison)}`);
    const intact = await page.evaluate(() => window.__lire('Morceaux/HarmoHub - Ballade - Morceau.json'));
    check(intact.songs[0].savedAt === 999999 && intact.songs[0].sections[0].title === 'Ailleurs',
        'et le travail fait ailleurs est toujours là, mot pour mot');

    // En mode explicite, la fenêtre s'ouvre et propose les quatre issues.
    const p1 = page.evaluate(() => window.app.enregistrerMorceauDansDossier(loadSongs()[0]));
    await page.waitForTimeout(400);
    check(await page.isVisible('#export-conflict-modal'), 'en enregistrement explicite, la fenêtre s\'ouvre');
    const texte = await page.textContent('#export-conflict-body');
    check(/plus récente/.test(texte), 'elle dit laquelle des deux versions est la plus récente');
    check(/Ailleurs|1 partie/.test(texte), `et décrit la version du disque, pas seulement la nôtre — ${texte.slice(0, 90).replace(/\s+/g, ' ')}`);
    for (const id of ['reload', 'overwrite', 'both', 'cancel']) {
        check(await page.isVisible(`#export-conflict-${id}`), `l'issue « ${id} » est offerte`);
    }

    // ANNULER : rien n'est touché. C'est l'issue par défaut, et la plus prudente.
    await page.click('#export-conflict-cancel');
    const r1 = await p1;
    check(r1.fait === false && r1.raison === 'annule', `annuler n'écrit rien — ${JSON.stringify(r1.raison)}`);
    const apresAnnule = await page.evaluate(() => window.__lire('Morceaux/HarmoHub - Ballade - Morceau.json'));
    check(apresAnnule.songs[0].savedAt === 999999, 'et le fichier du disque est identique après annulation');

    // GARDER LES DEUX : le fichier du disque reste intact, le nôtre se pose à côté.
    const p2 = page.evaluate(() => window.app.enregistrerMorceauDansDossier(loadSongs()[0]));
    await page.waitForTimeout(400);
    await page.click('#export-conflict-both');
    await p2;
    await page.waitForTimeout(200);
    const apresDeux = await page.evaluate(() => window.__lister('Morceaux'));
    const copie = apresDeux.find(n => / \(copie /.test(n));
    check(!!copie && apresDeux.includes('HarmoHub - Ballade - Morceau.json'),
        `« garder les deux » ajoute sans remplacer — ${JSON.stringify(apresDeux)}`);
    const toujoursLa = await page.evaluate(() => window.__lire('Morceaux/HarmoHub - Ballade - Morceau.json'));
    check(toujoursLa.songs[0].savedAt === 999999, 'et la version du disque n\'a toujours pas bougé');

    // RECHARGER : c'est la version du disque qui gagne, DANS L'APPLI.
    const p3 = page.evaluate(() => window.app.enregistrerMorceauDansDossier(loadSongs()[0]));
    await page.waitForTimeout(400);
    await page.click('#export-conflict-reload');
    const r3 = await p3;
    check(r3.raison === 'recharge' && r3.duFichier && r3.duFichier.savedAt === 999999,
        '« recharger » rend la version du disque au lieu d\'écrire');

    // ---- L'HOMONYME : deux morceaux différents, un seul nom ----
    await poser([{ id: 'AUTRE', name: 'Ballade', savedAt: 5000, sections: [] }]);
    const homo = await page.evaluate(() => window.app.enregistrerMorceauDansDossier(loadSongs()[0], { auto: true }));
    check(homo.fait === false && homo.raison === 'homonyme',
        `un AUTRE morceau du même nom ne prend pas la place du fichier existant — ${JSON.stringify(homo.raison)}`);

    // ---- L'EXIGENCE 1 : la sauvegarde de bibliothèque ne supprime rien ----
    await page.evaluate(async () => {
        const d = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('BancGardeFous')).getDirectoryHandle('Morceaux');
        const f = await (await d.getFileHandle('HarmoHub - Morceau oublie - Morceau.json', { create: true })).createWritable();
        await f.write(JSON.stringify({ app: 'HarmoHub', kind: 'library-backup', songs: [{ id: 'zz', name: 'Morceau oublie', savedAt: 1 }] }));
        await f.close();
    });
    await poser([{ id: 's9', name: 'Seul morceau connu', savedAt: 7000, sections: [] }]);
    const avantSauvegarde = await page.evaluate(() => window.__lister('Morceaux'));
    await page.evaluate(() => window.app.exportLibrary());
    await page.waitForTimeout(500);
    const apresSauvegarde = await page.evaluate(() => window.__lister('Morceaux'));
    check(JSON.stringify(avantSauvegarde) === JSON.stringify(apresSauvegarde),
        `sauvegarder la bibliothèque ne supprime AUCUN fichier du disque (${avantSauvegarde.length} avant, ${apresSauvegarde.length} après)`);
    const orphelins = await page.evaluate(() => window.app.morceauxOrphelinsSurDisque());
    check(orphelins.includes('HarmoHub - Morceau oublie - Morceau.json'),
        `et l'appli SAIT NOMMER ce qu'elle ne connaît plus — ${JSON.stringify(orphelins)}`);
    check(!orphelins.some(n => / - \d{4}-\d{2}-\d{2} \d{4}\.json$/.test(n)),
        'sans confondre un orphelin avec une simple copie horodatée');

    // ---- LA PURGE : la SEULE suppression de tout le projet ----
    // Elle mérite plus de méfiance que le reste. On lui donne un dossier `_versions` peuplé à la main,
    // avec des archives appartenant à DEUX morceaux différents, et on vérifie qu'elle ne déborde ni du
    // morceau visé, ni du dossier `_versions`, ni des dix plus récentes.
    await page.evaluate(async () => {
        const d = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('BancGardeFous')).getDirectoryHandle('Morceaux');
        const v = await d.getDirectoryHandle('_versions', { create: true });
        for await (const [nom] of v.entries()) await v.removeEntry(nom); // table rase
        const poser = async (dossier, nom) => { const f = await (await dossier.getFileHandle(nom, { create: true })).createWritable(); await f.write('x'); await f.close(); };
        for (let j = 1; j <= 14; j++) await poser(v, `HarmoHub - Purge - Morceau - 2026-09-${String(j).padStart(2, '0')} 1200.json`);
        await poser(v, 'HarmoHub - Voisin - Morceau - 2026-09-01 1200.json'); // un AUTRE morceau
        await poser(v, 'Note personnelle.txt');                               // déposé à la main
        await poser(d, 'HarmoHub - Purge - Morceau.json');                    // le fichier COURANT
    });
    const supprimes = await page.evaluate(() => preparerRangement()
        .then(r => purgerVersions(r, 'morceaux', 'HarmoHub - Purge - Morceau.json')));
    const restant = await page.evaluate(() => window.__lister('Morceaux/_versions'));
    const dePurge = restant.filter(n => n.startsWith('HarmoHub - Purge - Morceau - '));
    check(dePurge.length === 10, `seules DIX versions sont gardées (${dePurge.length} restantes, ${supprimes.length} supprimées)`);
    check(dePurge.includes('HarmoHub - Purge - Morceau - 2026-09-14 1200.json')
        && !dePurge.includes('HarmoHub - Purge - Morceau - 2026-09-04 1200.json'),
        'ce sont les dix PLUS RÉCENTES, pas dix au hasard');
    check(restant.includes('HarmoHub - Voisin - Morceau - 2026-09-01 1200.json'),
        'la purge d\'un morceau ne touche pas aux versions d\'un AUTRE morceau');
    check(restant.includes('Note personnelle.txt'),
        'ni à un fichier déposé à la main sous un autre nom');
    check((await page.evaluate(() => window.__lister('Morceaux'))).includes('HarmoHub - Purge - Morceau.json'),
        'ni, surtout, au fichier COURANT du morceau purgé');

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.slice(0, 2).join(' | ')})`);
    await navigateur.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
