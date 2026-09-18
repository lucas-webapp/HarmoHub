// L'EXPORT INTÉGRAL, LA STRUCTURE EN PDF, ET L'IMPORT DIRECT.
//
// Trois manques restés en suspens depuis longtemps :
//   - l'export intégral, décidé avec l'utilisateur (« deux options d'export ») et jamais construit ;
//   - la Structure, seul PDF de l'appli à passer encore par l'impression du navigateur — donc le seul
//     qu'on ne pouvait pas RANGER, d'où un dossier PDF/Structure qui ne se remplissait jamais ;
//   - l'import qui s'ouvrait là où le système s'était arrêté, et non dans le dossier de l'appli.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('export intégral, structure PDF, import direct');
const bruit = require('./_harness').estBruitReseau;

plan(18);

const STUB = () => {
    window.showDirectoryPicker = async () =>
        (await navigator.storage.getDirectory()).getDirectoryHandle('BancIntegral', { create: true });
};
const ARBRE = async (d, prefixe = '') => {
    const vus = [];
    for await (const [nom, h] of d.entries()) {
        if (h.kind === 'directory') vus.push(...(await window.__arbre(h, prefixe + nom + '/')));
        else vus.push(prefixe + nom);
    }
    return vus;
};

(async () => {
    const navigateur = await chromium.launch();
    const erreurs = [];
    const contexte = await navigateur.newContext({ viewport: { width: 1400, height: 950 } });
    await contexte.addInitScript(STUB);
    await contexte.addInitScript(`window.__arbre = ${ARBRE.toString()}`);
    const page = await contexte.newPage();
    page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !bruit(m.text())) erreurs.push('console: ' + m.text()); });
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(1000);
    await page.evaluate(async () => {
        try { await (await navigator.storage.getDirectory()).removeEntry('BancIntegral', { recursive: true }); } catch (e) { }
        await new Promise((r) => { const q = indexedDB.deleteDatabase('harmohub_fichiers'); q.onsuccess = q.onerror = q.onblocked = r; });
        localStorage.removeItem('harmohub_dossier_rangement:HarmoHub');
    });
    if (!exiger(await page.evaluate(() => typeof window.app.exportStructurePdf === 'function'
        && typeof window.app.ouvrirExportIntegral === 'function'
        && typeof choisirFichierAImporter === 'function'), 'les trois fonctions sont en place')) return bilan();

    // PDF/Structure revient dans l'arborescence, maintenant qu'il peut se remplir.
    await page.evaluate(() => choisirDossierRangement());
    const arbreInitial = await page.evaluate(async () => {
        const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('BancIntegral');
        const vus = [];
        for await (const [nom, h] of (await d.getDirectoryHandle('PDF')).entries()) vus.push(nom);
        return vus.sort();
    });
    check(arbreInitial.includes('Structure'),
        `PDF/Structure revient dans l'arborescence puisqu'il peut enfin se remplir — ${JSON.stringify(arbreInitial)}`);

    // Un vrai morceau, avec des accents dans le titre et deux parties.
    await page.evaluate(() => {
        const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', extraNotes: [], intensity: 75, intensityPerStep: {} });
        const sections = [
            { title: 'Couplet', chords: [mk('C', 'maj', 4), mk('A', 'min7', 4)] },
            { title: 'Refrain', chords: [mk('F', 'maj', 4), mk('G', 'dom7', 4)] },
        ];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
        localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 'm1', name: 'Été à Noël', savedAt: 1000, sections }]));
        localStorage.setItem('harmohubCurrentSongId', 'm1');
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1200);

    // ---- LA STRUCTURE EN PDF ----
    await page.evaluate(() => window.app.openStructureWindow && window.app.openStructureWindow());
    await page.waitForTimeout(400);
    check(await page.locator('#structure-pdf').count() === 1,
        'la fenêtre Structure offre désormais « Exporter en PDF » à côté d\'« Imprimer »');
    await page.evaluate(() => window.app.exportStructurePdf());
    await page.waitForTimeout(3500);
    const pdfStruct = await page.evaluate(async () => {
        const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('BancIntegral');
        const s = await (await d.getDirectoryHandle('PDF')).getDirectoryHandle('Structure');
        const vus = [];
        for await (const [nom, h] of s.entries()) if (h.kind === 'file') vus.push({ nom, taille: (await h.getFile()).size });
        return vus;
    });
    check(pdfStruct.length === 1, `un PDF de structure est écrit — ${JSON.stringify(pdfStruct.map(f => f.nom))}`);
    // ACCENTS TRANSLITTÉRÉS ICI, ET C'EST ATTENDU. Mesuré dans ce navigateur : le système de fichiers
    // privé (OPFS), qui sert de disque à ce banc, REFUSE tout nom non-ASCII — « Été à Noël » y est
    // impossible. Un disque ordinaire accepte les accents ; l'appli les garde donc partout où elle le
    // peut et ne translittère qu'en cas de refus (voir nomsCandidats). Ce contrôle éprouve donc le
    // REPLI, pas le cas nominal — que ce banc ne peut pas atteindre, faute d'un vrai disque.
    check(pdfStruct[0] && pdfStruct[0].nom === 'HarmoHub - Ete a Noel - Structure.pdf',
        `nom canonique, translittéré parce que ce support refuse les accents — ${pdfStruct[0] && pdfStruct[0].nom}`);
    check(pdfStruct[0] && pdfStruct[0].taille > 5000,
        `et il contient réellement quelque chose (${pdfStruct[0] && pdfStruct[0].taille} octets)`);
    // La page ne doit pas rester dans l'état « impression » après coup.
    check(await page.evaluate(() => !document.getElementById('structure-print-zone')
        && !document.body.classList.contains('impression-structure')),
        'la page est rendue à son état normal : aucun résidu d\'impression');

    // ---- L'EXPORT INTÉGRAL ----
    await page.evaluate(() => window.app.closeStructureWindow && window.app.closeStructureWindow());
    await page.waitForTimeout(200);
    await page.evaluate(() => window.app.ouvrirExportIntegral());
    await page.waitForTimeout(400);
    check(await page.isVisible('#export-full-modal'), 'la fenêtre d\'export intégral s\'ouvre');
    const cases = await page.evaluate(() => [...document.querySelectorAll('#export-full-body input')]
        .map(i => ({ id: i.value, coche: i.checked })));
    check(cases.length === 6, `six types de fichiers proposés — ${JSON.stringify(cases.map(c => c.id))}`);
    const audio = cases.find(c => c.id === 'audio');
    check(audio && audio.coche === false,
        'le MP3 est DÉCOCHÉ par défaut : c\'est le plus long, et le cocher d\'office ferait attendre pour un fichier non demandé');
    check(cases.filter(c => c.coche).length >= 3, 'mais les types instantanés ou courts sont cochés');
    const aide = await page.textContent('#export-full-body');
    check(/outil Paroles/.test(aide),
        'la fenêtre dit pourquoi le PDF des paroles n\'y est pas, au lieu d\'offrir une case qui ne ferait rien');

    // On décoche tout sauf le morceau et le MIDI : rapides et vérifiables sans attendre le rendu audio.
    await page.evaluate(() => {
        document.querySelectorAll('#export-full-body input').forEach(i => { i.checked = ['morceau', 'midi'].includes(i.value); });
    });
    await page.click('#export-full-go');
    await page.waitForTimeout(3000);
    const arbre = await page.evaluate(async () => {
        const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('BancIntegral');
        return (await window.__arbre(d)).sort();
    });
    check(arbre.some(c => c === 'Morceaux/HarmoHub - Ete a Noel - Morceau.json'),
        `la sauvegarde du morceau est écrite — ${JSON.stringify(arbre)}`);
    // Le MIDI portait encore un nom HORODATÉ dans le dossier, seul de tous les exports : il passait un
    // `nom` tout fait, ce qui court-circuite le nommage canonique. Il accumulait donc un fichier par
    // génération au lieu de garder le dernier avec ses versions.
    check(arbre.some(c => c === 'MIDI/HarmoHub - Ete a Noel - MIDI.mid'),
        `le MIDI aussi, et sous un nom canonique comme les autres — ${JSON.stringify(arbre.filter(c => c.startsWith('MIDI/')))}`);
    check(!arbre.some(c => c.startsWith('Audio/')), 'et RIEN dans Audio, puisque la case était décochée');
    check(await page.evaluate(() => document.getElementById('export-full-modal').hidden),
        'la fenêtre se referme une fois le travail fini');

    // ---- L'IMPORT DIRECT ----
    // showOpenFilePicker n'existe pas dans le navigateur de banc : on le remplace pour vérifier ce qui
    // lui est PASSÉ — c'est `startIn` qui fait tout l'intérêt de la fonction.
    const appel = await page.evaluate(async () => {
        let recu = null;
        window.showOpenFilePicker = async (options) => {
            recu = { aStartIn: !!options.startIn, nomDepart: options.startIn && options.startIn.name, multiple: options.multiple };
            return [{ getFile: async () => new File(['{}'], 'x.json', { type: 'application/json' }) }];
        };
        const f = await choisirFichierAImporter({ cle: 'morceaux' });
        delete window.showOpenFilePicker;
        return { recu, nomFichier: f && f.name };
    });
    check(appel.recu && appel.recu.aStartIn === true,
        'le sélecteur reçoit un dossier de départ au lieu de s\'ouvrir n\'importe où');
    check(appel.recu && appel.recu.nomDepart === 'Morceaux',
        `et c'est bien le sous-dossier Morceaux, pas seulement la racine — ${appel.recu && appel.recu.nomDepart}`);
    check(appel.nomFichier === 'x.json', 'le fichier choisi revient bien à l\'appelant');

    // Sans l'API : rend null, pour que l'appelant retombe sur le champ classique.
    const sansApi = await page.evaluate(async () => {
        const vrai = window.showOpenFilePicker;
        delete window.showOpenFilePicker;
        const r = await choisirFichierAImporter({ cle: 'morceaux' });
        if (vrai) window.showOpenFilePicker = vrai;
        return r;
    });
    check(sansApi === null,
        'sans l\'API (Safari, Firefox, téléphones), il rend null et l\'import classique prend le relais');

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.slice(0, 2).join(' | ')})`);
    await navigateur.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
