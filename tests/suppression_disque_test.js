// SUPPRIMER UN MORCEAU — ET SES FICHIERS, OU NON (voir fichiersDuMorceau / supprimerFichiers).
//
// DEUX DEMANDES, MOT POUR MOT :
//   « lorsque je supprime un morceau de l'appli, l'appli doit me demander si elle doit également
//     supprimer tous les fichiers du disque qui lui sont liés. Si je clique sur non, alors l'appli le
//     réimportera la prochaine fois. »
//   « je voudrais également pouvoir supprimer des morceaux directement sur le disque, en ne passant
//     pas par l'appli. »
//
// C'est la première fois que cette appli efface des fichiers que l'utilisateur n'a pas désignés un par
// un. Le banc porte donc surtout sur CE QUI NE DOIT PAS ÊTRE SUPPRIMÉ — le piège du préfixe en tête :
// les fichiers de « Ballade » et ceux de « Ballade - live » commencent par la même chaîne.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('suppression et fichiers du disque');
const bruit = require('./_harness').estBruitReseau;

plan(28);

const STUB = () => {
    window.showDirectoryPicker = async () =>
        (await navigator.storage.getDirectory()).getDirectoryHandle('BancSuppr', { create: true });
};
const LISTER = async (chemin) => {
    let d = await (await navigator.storage.getDirectory()).getDirectoryHandle('BancSuppr');
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
        try { await (await navigator.storage.getDirectory()).removeEntry('BancSuppr', { recursive: true }); } catch (e) { }
        await new Promise((r) => { const q = indexedDB.deleteDatabase('harmohub_fichiers'); q.onsuccess = q.onerror = q.onblocked = r; });
        localStorage.removeItem('harmohub_dossier_rangement:HarmoHub');
    });
    if (!exiger(await page.evaluate(() => typeof fichiersDuMorceau === 'function'),
        'l\'inventaire par morceau est chargé')) return bilan();
    await page.evaluate(() => choisirDossierRangement());

    // Un dossier peuplé de fichiers appartenant à TROIS morceaux dont deux aux noms imbriqués.
    await page.evaluate(async () => {
        const racine = await preparerRangement();
        const poser = async (cle, nom, versions) => {
            let d = await sousDossier(racine, cle, true);
            if (versions) d = await d.getDirectoryHandle('_versions', { create: true });
            const f = await (await d.getFileHandle(nom, { create: true })).createWritable();
            await f.write(JSON.stringify({ app: 'HarmoHub', kind: 'library-backup', songs: [{ id: nom, name: nom, savedAt: 1, sections: [] }] }));
            await f.close();
        };
        await poser('morceaux', 'HarmoHub - Ballade - Morceau.json');
        await poser('morceaux', 'HarmoHub - Ballade - Paroles.json');
        await poser('morceaux', 'HarmoHub - Ballade - Morceau - 2026-09-01 1200.json', true);
        await poser('morceaux', 'HarmoHub - Ballade - Morceau - 2026-09-02 1200.json', true);
        await poser('pdfAccords', 'HarmoHub - Ballade - Accords.pdf');
        await poser('midi', 'HarmoHub - Ballade - MIDI.mid');
        await poser('audio', 'HarmoHub - Ballade - Audio.mp3');
        await poser('texte', 'HarmoHub - Ballade - Texte.txt');
        // LE PIÈGE : un autre morceau dont le nom COMMENCE par celui-ci.
        await poser('morceaux', 'HarmoHub - Ballade - live - Morceau.json');
        await poser('pdfAccords', 'HarmoHub - Ballade - live - Accords.pdf');
        // Et un morceau sans rapport.
        await poser('morceaux', 'HarmoHub - Nuit - Morceau.json');
        // La bibliothèque : elle contient TOUS les morceaux, elle ne doit jamais partir avec un seul.
        await poser('bibliotheque', 'HarmoHub - Bibliotheque.json');
    });

    // ---- L'inventaire, avant toute suppression ----
    const inv = await page.evaluate(() => preparerRangement()
        .then(r => fichiersDuMorceau(r, 'Ballade', ['Ballade - live', 'Nuit'])));
    const chemins = inv.map(f => f.chemin).sort();
    check(inv.length === 8, `huit fichiers rattachés à « Ballade » — ${inv.length}`);
    check(chemins.some(c => c === 'PDF/Accords/HarmoHub - Ballade - Accords.pdf')
        && chemins.some(c => c === 'MIDI/HarmoHub - Ballade - MIDI.mid')
        && chemins.some(c => c === 'Audio/HarmoHub - Ballade - Audio.mp3')
        && chemins.some(c => c === 'Texte/HarmoHub - Ballade - Texte.txt'),
        'tous les types sont retrouvés : PDF, MIDI, audio, texte');
    check(chemins.filter(c => c.includes('_versions')).length === 2,
        `les versions archivées en font partie — ${chemins.filter(c => c.includes('_versions')).length}`);

    // LES TROIS CONTRÔLES QUI COMPTENT LE PLUS :
    check(!chemins.some(c => c.includes('Ballade - live')),
        `les fichiers de « Ballade - live » ne sont PAS emportés — ${JSON.stringify(chemins.filter(c => c.includes('live')))}`);
    check(!chemins.some(c => c.includes('Nuit')), 'ni ceux d\'un morceau sans rapport');
    check(!chemins.some(c => c.startsWith('Bibliotheque/')),
        'ni la sauvegarde de bibliothèque, qui contient TOUS les morceaux');

    // Sans la liste des autres morceaux, le garde-fou ne peut pas jouer : on vérifie qu'il s'appuie
    // bien dessus et qu'il n'invente rien.
    const sansGarde = await page.evaluate(() => preparerRangement().then(r => fichiersDuMorceau(r, 'Ballade', [])));
    check(sansGarde.length > inv.length,
        `sans la liste des autres morceaux, l'inventaire est plus large — c'est elle qui protège (${sansGarde.length} contre ${inv.length})`);

    // ---- « Garder les fichiers » : rien ne doit disparaître ----
    await page.evaluate(() => {
        localStorage.setItem('harmohubSongs', JSON.stringify([
            { id: 'b1', name: 'Ballade', savedAt: 1000, sections: [] },
            { id: 'b2', name: 'Ballade - live', savedAt: 1000, sections: [] },
        ]));
        window.app.refreshSongList();
    });
    const avant = await page.evaluate(() => window.__lister('Morceaux'));
    const p1 = page.evaluate(() => window.app.deleteSongById('b1'));
    await page.waitForTimeout(500);
    check(await page.isVisible('#delete-files-modal'), 'supprimer un morceau demande ce qu\'il faut faire des fichiers');
    const corps = await page.textContent('#delete-files-body');
    check(/8 fichier/.test(corps), `la fenêtre annonce combien de fichiers sont concernés — ${/8 fichier/.test(corps)}`);
    check(/Accords\.pdf/.test(corps) && /_versions/.test(corps),
        'et les NOMME un par un, versions comprises : c\'est ça qui rend la suppression sûre');
    await page.click('#delete-files-keep');
    await p1;
    await page.waitForTimeout(300);
    const apres = await page.evaluate(() => window.__lister('Morceaux'));
    check(JSON.stringify(avant) === JSON.stringify(apres),
        `« garder les fichiers » n'efface RIEN sur le disque — ${apres.length} fichiers`);
    check((await page.evaluate(() => loadSongs())).length === 1,
        'mais le morceau est bien retiré de la bibliothèque');

    // ---- Annuler : le morceau reste dans la bibliothèque ----
    await page.evaluate(() => {
        localStorage.setItem('harmohubSongs', JSON.stringify([
            { id: 'b1', name: 'Ballade', savedAt: 1000, sections: [] },
            { id: 'b2', name: 'Ballade - live', savedAt: 1000, sections: [] },
        ]));
    });
    const p2 = page.evaluate(() => window.app.deleteSongById('b1'));
    await page.waitForTimeout(400);
    await page.click('#delete-files-cancel');
    await p2;
    check((await page.evaluate(() => loadSongs())).length === 2,
        'annuler ne retire pas le morceau non plus — le doute ne supprime jamais');

    // ---- « Supprimer aussi les fichiers » ----
    const p3 = page.evaluate(() => window.app.deleteSongById('b1'));
    await page.waitForTimeout(400);
    await page.click('#delete-files-all');
    await p3;
    await page.waitForTimeout(600);
    const resteM = await page.evaluate(() => window.__lister('Morceaux'));
    const resteV = await page.evaluate(() => window.__lister('Morceaux/_versions'));
    const restePdf = await page.evaluate(() => window.__lister('PDF/Accords'));
    check(!resteM.some(n => /^HarmoHub - Ballade - (Morceau|Paroles)\.json$/.test(n)),
        `les fichiers de « Ballade » ont disparu — ${JSON.stringify(resteM)}`);
    check(resteV.length === 0, `y compris ses versions archivées — ${JSON.stringify(resteV)}`);
    check(resteM.includes('HarmoHub - Ballade - live - Morceau.json') && resteM.includes('HarmoHub - Nuit - Morceau.json'),
        'et ceux des AUTRES morceaux sont intacts');
    check(restePdf.includes('HarmoHub - Ballade - live - Accords.pdf') && !restePdf.includes('HarmoHub - Ballade - Accords.pdf'),
        `même dans les dossiers dérivés — ${JSON.stringify(restePdf)}`);

    // La sauvegarde de bibliothèque doit avoir été rafraîchie, sinon « supprimer » ne tient pas sa
    // promesse : le morceau reviendrait au premier réimport.
    const biblio = await page.evaluate(async () => {
        const racine = await preparerRangement();
        const lu = await lireJsonRange(racine, 'bibliotheque', 'HarmoHub - Bibliotheque.json');
        return (lu.contenu.songs || []).map(s => s.name);
    });
    check(!biblio.includes('Ballade'),
        `la sauvegarde de bibliothèque ne contient plus le morceau supprimé — ${JSON.stringify(biblio)}`);
    const versionsBiblio = await page.evaluate(() => window.__lister('Bibliotheque/_versions'));
    check(versionsBiblio.length === 1,
        `et l'ancienne sauvegarde, elle, est gardée en version — rien n'est réellement perdu (${versionsBiblio.length})`);

    // ---- LE PANNEAU « FICHIERS DU DISQUE » ----
    // « Je voudrais également pouvoir supprimer des morceaux directement sur le disque, en ne passant
    // pas par l'appli. » Ce panneau lit le DOSSIER et non la bibliothèque : il montre donc aussi ce que
    // l'appli ne connaît plus, et c'est précisément ce qui permet d'agir dessus.
    await page.evaluate(() => {
        localStorage.setItem('harmohubSongs', JSON.stringify([
            { id: 'b2', name: 'Ballade - live', savedAt: 1000, sections: [] },
        ]));
        window.app.refreshSongList();
    });
    await page.evaluate(() => window.app.ouvrirFichiersDuDisque());
    await page.waitForTimeout(700);
    check(await page.isVisible('#disk-files-modal'), 'le panneau des fichiers du disque s\'ouvre');
    const listeDisque = await page.textContent('#disk-files-body');
    check(/Nuit/.test(listeDisque),
        'il montre un morceau que la bibliothèque de ce navigateur ne contient PAS');
    check(/absent de cette bibliothèque/.test(listeDisque),
        'et le signale comme tel, au lieu de le mélanger aux autres');

    // Reprendre un orphelin : le chemin du retour, qui n'était jusqu'ici qu'à moitié construit.
    const boutons = await page.evaluate(() => [...document.querySelectorAll('#disk-files-body [data-disk-action="reprendre"]')]
        .map((b, i) => ({ i: Number(b.dataset.diskIndex), texte: b.textContent.trim() })));
    check(boutons.some(b => /Reprendre/.test(b.texte)),
        `un orphelin se reprend d'un clic — ${JSON.stringify(boutons.map(b => b.texte))}`);
    const idxNuit = await page.evaluate(() => {
        const blocs = [...document.querySelectorAll('#disk-files-body .import-conflict-song')];
        const i = blocs.findIndex(b => /Nuit/.test(b.textContent));
        return blocs[i].querySelector('[data-disk-action="reprendre"]').dataset.diskIndex;
    });
    await page.click(`#disk-files-body [data-disk-action="reprendre"][data-disk-index="${idxNuit}"]`);
    await page.waitForTimeout(600);
    check((await page.evaluate(() => loadSongs().map(s => s.name))).includes('HarmoHub - Nuit - Morceau.json')
        || (await page.evaluate(() => loadSongs().length)) === 2,
        `le morceau du disque rejoint la bibliothèque — ${JSON.stringify(await page.evaluate(() => loadSongs().map(s => s.name)))}`);

    // Supprimer DEPUIS le disque : la bibliothèque ne doit pas bouger.
    await page.evaluate(() => window.app.ouvrirFichiersDuDisque());
    await page.waitForTimeout(600);
    const avantBiblio = await page.evaluate(() => loadSongs().length);
    const idxLive = await page.evaluate(() => {
        const blocs = [...document.querySelectorAll('#disk-files-body .import-conflict-song')];
        const i = blocs.findIndex(b => /Ballade - live/.test(b.textContent));
        return i < 0 ? null : blocs[i].querySelector('[data-disk-action="supprimer"]').dataset.diskIndex;
    });
    if (idxLive !== null) {
        await page.click(`#disk-files-body [data-disk-action="supprimer"][data-disk-index="${idxLive}"]`);
        await page.waitForTimeout(500);
        check(await page.isVisible('#delete-files-modal'),
            'supprimer depuis le disque passe par la MÊME fenêtre, avec la liste — pas par un confirm() du navigateur');
        check(await page.locator('#delete-files-keep').isHidden(),
            'sans l\'issue « garder les fichiers », qui n\'aurait aucun sens ici');
        await page.click('#delete-files-all');
        await page.waitForTimeout(600);
        const resteApres = await page.evaluate(() => window.__lister('Morceaux'));
        check(!resteApres.includes('HarmoHub - Ballade - live - Morceau.json'),
            `le fichier est parti du disque — ${JSON.stringify(resteApres)}`);
        check(await page.evaluate(() => loadSongs().length) === avantBiblio,
            'et la bibliothèque de ce navigateur n\'a pas bougé d\'un morceau');
    }

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.slice(0, 2).join(' | ')})`);
    await navigateur.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
