// LA FUSION PAR TITRE À L'IMPORT (voir apparierMorceau) ET LA DÉCISION PAR MORCEAU.
//
// LE DÉFAUT QUE ÇA CORRIGE, dans les mots de l'utilisateur : « dans l'appli, je commence à avoir
// beaucoup de fois le même titre de morceau, avec seulement les dates qui changent, et je ne sais plus
// lequel est le morceau correct ».
//
// La cause : l'import ne dédupliquait que par IDENTIFIANT. Chaque navigateur crée les siens de son
// côté, donc « Ballade » enregistrée séparément dans Chrome et dans Safari porte deux identifiants
// différents. En réimportant la bibliothèque de l'un dans l'autre — le geste fait à CHAQUE changement
// de navigateur — l'appli ne voyait aucun conflit et empilait un morceau de plus sous le même titre.
//
// Et le second défaut, qui pouvait coûter du travail : la décision était GLOBALE. Un seul « Écraser »
// pour tout le lot, y compris les morceaux dont la version d'ici était la plus récente.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('import : fusion par titre');

plan(20);

(async () => {
    const navigateur = await chromium.launch();
    const erreurs = [];
    const page = await navigateur.newPage({ viewport: { width: 1300, height: 950 } });
    page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !require('./_harness').estBruitReseau(m.text())) erreurs.push('console: ' + m.text()); });
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(800);

    if (!exiger(await page.evaluate(() => typeof apparierMorceau === 'function'),
        'l\'appariement par titre est chargé')) return bilan();

    // ---- La normalisation du titre ----
    const cles = await page.evaluate(() => ({
        egal: cleTitre('Ballade') === cleTitre('  ballade  '),
        espaces: cleTitre('Nuit  blanche') === cleTitre('Nuit blanche'),
        copie: cleTitre('Ballade (2)') === cleTitre('Ballade'),
        vide: cleTitre('   '),
    }));
    check(cles.egal, 'la casse et les espaces de bord ne distinguent pas deux titres');
    check(cles.espaces, 'ni les espaces doublés à l\'intérieur');
    check(cles.copie === false,
        '« Ballade (2) » reste DISTINCT de « Ballade » — c\'est un nom choisi lors d\'un « garder les deux »');
    check(cles.vide === '', 'un titre vide ne s\'apparie avec rien (il ne vaut pas identité)');

    // ---- L'appariement ----
    const app = await page.evaluate(() => {
        const locaux = [
            { id: 'L1', name: 'Ballade', savedAt: 1000 },
            { id: 'L2', name: 'Ballade', savedAt: 5000 },   // le désordre actuel : deux fois le même titre
            { id: 'L3', name: 'Nuit blanche', savedAt: 2000 },
        ];
        const nom = (r) => (r ? r.id : null);
        return {
            parId: nom(apparierMorceau({ id: 'L3', name: 'Titre tout autre' }, locaux)),
            parTitre: nom(apparierMorceau({ id: 'INCONNU', name: 'ballade' }, locaux)),
            inconnu: nom(apparierMorceau({ id: 'X', name: 'Jamais vue' }, locaux)),
            sansNom: nom(apparierMorceau({ id: 'X', name: '' }, locaux)),
        };
    });
    check(app.parId === 'L3', `l'identifiant prime sur le titre — ${app.parId}`);
    check(app.parTitre === 'L2',
        `à identifiant inconnu, le titre apparie — et avec LE PLUS RÉCENT des homonymes (${app.parTitre})`);
    check(app.inconnu === null, 'un titre vraiment nouveau ne s\'apparie avec rien');
    check(app.sansNom === null, 'un morceau sans titre non plus');

    // ---- LE CAS RÉEL : la bibliothèque d'un autre navigateur ----
    const poser = (songs) => page.evaluate((l) => {
        localStorage.setItem('harmohubSongs', JSON.stringify(l));
        window.app.refreshSongList();
    }, songs);
    const importer = (songs) => page.evaluate((l) => {
        const fichier = new File([JSON.stringify({ app: 'HarmoHub', kind: 'library-backup', version: 1, songs: l })],
            'b.json', { type: 'application/json' });
        window.__import = window.app.importLibraryFile(fichier);
    }, songs);
    const noms = () => page.evaluate(() => loadSongs().map(s => `${s.name}#${s.id}`).sort());

    await poser([{ id: 'CHROME1', name: 'Ballade', savedAt: 1000, sections: [{ title: 'A', chords: [] }] }]);
    await importer([{ id: 'SAFARI1', name: 'Ballade', savedAt: 9000, sections: [{ title: 'A', chords: [] }, { title: 'B', chords: [] }] }]);
    await page.waitForTimeout(400);
    check(await page.isVisible('#import-conflict-modal'),
        'même titre, identifiant inconnu : la fenêtre s\'ouvre au lieu d\'empiler un doublon');
    const corps = await page.textContent('#import-conflict-body');
    check(/plus récente/.test(corps), 'et elle dit laquelle des deux versions est la plus récente');

    // La position de départ est déjà la bonne : le fichier étant plus récent, « Écraser » est coché.
    const prechoisi = await page.evaluate(() =>
        (document.querySelector('input[name="ic-SAFARI1"]:checked') || {}).value);
    check(prechoisi === 'ecraser',
        `la plus récente est cochée d'avance — « Appliquer » sans rien toucher fait déjà le bon choix (${prechoisi})`);

    await page.click('#import-conflict-apply');
    await page.evaluate(() => window.__import);
    let apres = await noms();
    check(apres.length === 1, `après écrasement il reste UN seul « Ballade », pas deux — ${JSON.stringify(apres)}`);
    check(apres[0] === 'Ballade#CHROME1',
        `et il garde l'identifiant LOCAL, sinon le morceau ouvert divergerait — ${apres[0]}`);
    const contenu = await page.evaluate(() => loadSongs()[0]);
    check((contenu.sections || []).length === 2 && contenu.savedAt === 9000,
        'tout en portant bien le contenu du fichier');

    // ---- LA DÉCISION PAR MORCEAU : c'est elle qui empêche de perdre du travail ----
    // Deux morceaux en conflit, deux réponses différentes dans la même fenêtre.
    await poser([
        { id: 'A', name: 'Alpha', savedAt: 1000, sections: [] },      // le fichier est plus récent
        { id: 'B', name: 'Beta', savedAt: 9000, sections: [{ title: 'ici', chords: [] }] }, // ICI est plus récent
    ]);
    await importer([
        { id: 'A2', name: 'Alpha', savedAt: 5000, sections: [{ title: 'fichier', chords: [] }] },
        { id: 'B2', name: 'Beta', savedAt: 2000, sections: [] },
    ]);
    await page.waitForTimeout(400);
    const defauts = await page.evaluate(() => ({
        alpha: (document.querySelector('input[name="ic-A2"]:checked') || {}).value,
        beta: (document.querySelector('input[name="ic-B2"]:checked') || {}).value,
    }));
    check(defauts.alpha === 'ecraser' && defauts.beta === 'ignorer',
        `chaque ligne est cochée selon SA propre comparaison — Alpha ${defauts.alpha}, Beta ${defauts.beta}`);

    // On choisit à la main l'inverse pour Beta : « garder les deux ».
    await page.check('input[name="ic-B2"][value="les-deux"]');
    await page.click('#import-conflict-apply');
    await page.evaluate(() => window.__import);
    apres = await noms();
    const alpha = await page.evaluate(() => loadSongs().find(s => s.name === 'Alpha'));
    check((alpha.sections || []).length === 1 && alpha.savedAt === 5000, 'Alpha a bien été écrasé par le fichier');
    const betas = await page.evaluate(() => loadSongs().filter(s => /^Beta/.test(s.name)).map(s => s.name).sort());
    check(betas.length === 2 && betas.includes('Beta'), `et Beta a produit une copie, comme demandé — ${JSON.stringify(betas)}`);
    const betaEnPlace = await page.evaluate(() => loadSongs().find(s => s.name === 'Beta'));
    check(betaEnPlace.savedAt === 9000 && betaEnPlace.sections[0].title === 'ici',
        'SANS que la version d\'ici, plus récente, ait été touchée');

    // ---- Le raccourci « partout la plus récente » ----
    await poser([
        { id: 'C', name: 'Gamma', savedAt: 1000, sections: [] },
        { id: 'D', name: 'Delta', savedAt: 9000, sections: [{ title: 'ici', chords: [] }] },
    ]);
    await importer([
        { id: 'C2', name: 'Gamma', savedAt: 5000, sections: [{ title: 'fichier', chords: [] }] },
        { id: 'D2', name: 'Delta', savedAt: 2000, sections: [] },
    ]);
    await page.waitForTimeout(400);
    await page.click('#import-conflict-recent');
    await page.evaluate(() => window.__import);
    const gamma = await page.evaluate(() => loadSongs().find(s => s.name === 'Gamma'));
    const delta = await page.evaluate(() => loadSongs().find(s => s.name === 'Delta'));
    check((gamma.sections || []).length === 1,
        'un clic « la plus récente » prend le fichier là où il est plus récent');
    check(delta.savedAt === 9000 && delta.sections[0].title === 'ici',
        '... et garde la version d\'ici là où c\'est elle la plus récente — c\'est TOUT l\'intérêt');
    const total = await page.evaluate(() => loadSongs().length);
    check(total === 2, `sans créer le moindre doublon au passage (${total} morceaux)`);

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.slice(0, 2).join(' | ')})`);
    await navigateur.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
