// LE NOMMAGE DES FICHIERS EXPORTÉS (voir fichiers.js).
//
// Ce banc garde la SEULE partie du rangement automatique qui fonctionne sur tous les appareils. Le
// classement dans un dossier choisi repose sur File System Access, absent de Safari, de Firefox,
// d'iPhone et d'Android : sur ces machines-là, le nom du fichier est tout ce qui reste pour s'y
// retrouver. Il ne doit donc jamais régresser.
//
// On éprouve DEUX choses, et la seconde compte autant que la première : la forme des noms, et le fait
// que les NEUF routes d'export passent bien par cette règle unique. Neuf sanitisations recopiées à la
// main vivaient là avant ; il a suffi d'une pour que deux modules divergent par le passé.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('nommage des fichiers exportés');

plan(18);

(async () => {
    const navigateur = await chromium.launch();
    const erreurs = [];
    const page = await navigateur.newPage({ viewport: { width: 1300, height: 950 } });
    page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(900);

    if (!exiger(await page.evaluate(() => typeof nomExport === 'function'),
        'fichiers.js est bien chargé par index.html')) return bilan();

    const nom = (opts) => page.evaluate((o) => nomExport({ ...o, date: new Date(2026, 8, 17, 14, 32) }), opts);

    // ---- La forme ----
    check(await nom({ morceau: 'Ballade', type: 'Accords', extension: 'pdf' })
        === 'HarmoHub - Ballade - Accords - 2026-09-17 1432.pdf', 'forme complète : Appli - Morceau - Type - Date Heure');
    check(await nom({ type: 'Bibliotheque', extension: 'json' })
        === 'HarmoHub - Bibliotheque - 2026-09-17 1432.json',
        'sans morceau, le segment saute au lieu de laisser un vide');

    // L'HEURE : c'est elle qui empêche le navigateur d'ajouter « (1) », « (2) » à deux exports du même
    // jour — la cause même de la perte de fil entre versions.
    const matin = await page.evaluate(() => nomExport({ morceau: 'X', type: 'T', extension: 'json', date: new Date(2026, 8, 17, 9, 5) }));
    const soir = await page.evaluate(() => nomExport({ morceau: 'X', type: 'T', extension: 'json', date: new Date(2026, 8, 17, 21, 40) }));
    check(matin !== soir, `deux exports le même jour donnent deux noms — ${matin} / ${soir}`);
    check(/2026-09-17 0905/.test(matin), `l'heure est sur deux chiffres, sans deux-points — ${matin}`);

    // Le tri alphabétique DOIT donner l'ordre chronologique : c'est tout l'intérêt d'aaaa-mm-jj.
    const dates = await page.evaluate(() => [
        nomExport({ morceau: 'A', extension: 'json', date: new Date(2025, 11, 3, 10, 0) }),
        nomExport({ morceau: 'A', extension: 'json', date: new Date(2026, 8, 17, 10, 0) }),
        nomExport({ morceau: 'A', extension: 'json', date: new Date(2026, 0, 5, 10, 0) }),
    ]);
    const trie = [...dates].sort();
    check(trie[0].includes('2025-12-03') && trie[2].includes('2026-09-17'),
        `trier par nom trie par date — ${JSON.stringify(trie.map(x => x.slice(-20)))}`);

    // ---- La sanitisation : un fichier doit pouvoir voyager d'un système à l'autre ----
    const interdits = await page.evaluate(() => nomExport({ morceau: 'A/B\\\\C:D*E?F"G<H>I|J', type: 'T', extension: 'json' }));
    check(!/[\\/:*?"<>|]/.test(interdits.replace(/\.json$/, '')),
        `les caractères interdits par Windows sont remplacés — ${interdits}`);
    const finPoint = await page.evaluate(() => nomExport({ morceau: 'Fin de morceau...  ', type: 'T', extension: 'json' }));
    check(finPoint.startsWith('HarmoHub - Fin de morceau - T - ') && !finPoint.includes('...'),
        `points et espaces en fin de nom retirés (Windows les supprime en silence) — ${finPoint}`);
    const vide = await page.evaluate(() => nomExport({ morceau: '   ', type: 'T', extension: 'json' }));
    check(vide.includes('Sans titre'), `un nom vide ne produit pas un fichier anonyme — ${vide}`);
    const long = await page.evaluate(() => nomExport({ morceau: 'M'.repeat(200), type: 'T', extension: 'json' }));
    check(long.length < 120, `un nom très long est borné (${long.length} caractères)`);
    const accents = await page.evaluate(() => nomExport({ morceau: 'Été à Noël', type: 'T', extension: 'json' }));
    check(accents.includes('Été à Noël'), `les accents sont conservés — ${accents}`);

    // ---- Les routes réelles : chacune produit-elle le bon nom ? ----
    // On intercepte le nom au lieu de télécharger : ce qui compte est l'étiquette, pas l'octet.
    const nomsRoutes = await page.evaluate(async () => {
        const vus = [];
        const vraiClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () { if (this.download) vus.push(this.download); };
        const vraiSave = window.jspdf.jsPDF.prototype.save;
        window.jspdf.jsPDF.prototype.save = function (n) { vus.push(n); return this; };
        try {
            localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Ballade', savedAt: Date.now(), sections: [] }]));
            window.app.exportLibrary();
            window.app.downloadSongBackup(loadSongs()[0]);
        } finally {
            HTMLAnchorElement.prototype.click = vraiClick;
            window.jspdf.jsPDF.prototype.save = vraiSave;
        }
        return vus;
    });
    check(nomsRoutes.some(n => /^HarmoHub - Bibliotheque - \d{4}-\d{2}-\d{2} \d{4}\.json$/.test(n)),
        `la sauvegarde de bibliothèque suit la règle — ${JSON.stringify(nomsRoutes)}`);
    check(nomsRoutes.some(n => /^HarmoHub - Ballade - Morceau - \d{4}-\d{2}-\d{2} \d{4}\.json$/.test(n)),
        `l'export d'un morceau seul aussi — ${JSON.stringify(nomsRoutes)}`);

    // Plus AUCUNE sanitisation recopiée dans les deux gros fichiers : une règle, un endroit.
    const restes = await page.evaluate(async () => {
        const lire = async (u) => (await fetch(u)).text();
        const src = (await lire('script.js')) + (await lire('paroles.js'));
        return (src.match(/<>\|/g) || []).length;
    });
    check(restes === 0, `aucune sanitisation dispersée ne subsiste (${restes} trouvée(s))`);

    // ---- Paroles : la MÊME règle, pas une copie ----
    const p2 = await navigateur.newPage();
    p2.on('pageerror', (e) => erreurs.push('paroles pageerror: ' + e.message));
    await p2.goto(`${BASE}/paroles.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await p2.waitForTimeout(500);
    check(await p2.evaluate(() => typeof nomExport === 'function'), 'Paroles charge le même fichiers.js');
    const memeRegle = await p2.evaluate(() => nomExport({ morceau: 'Ballade', type: 'Paroles', extension: 'pdf', date: new Date(2026, 8, 17, 14, 32) }));
    check(memeRegle === 'HarmoHub - Ballade - Paroles - 2026-09-17 1432.pdf',
        `et produit exactement le même nom qu'HarmoHub — ${memeRegle}`);

    // Deux types différents du MÊME morceau ne doivent jamais entrer en collision.
    const deux = await page.evaluate(() => [
        nomExport({ morceau: 'Ballade', type: 'Paroles', extension: 'json', date: new Date(2026, 8, 17, 14, 32) }),
        nomExport({ morceau: 'Ballade', type: 'Morceau', extension: 'json', date: new Date(2026, 8, 17, 14, 32) }),
    ]);
    check(deux[0] !== deux[1], `deux documents du même morceau et de même extension restent distincts — ${deux.join(' / ')}`);
    // ...et ils se rangent côte à côte, puisque le nom du morceau vient avant le type.
    check(deux.every(n => n.startsWith('HarmoHub - Ballade - ')),
        'toutes les pièces d\'un morceau se regroupent au tri par nom');

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.slice(0, 2).join(' | ')})`);

    await navigateur.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
