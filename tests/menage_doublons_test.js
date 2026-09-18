// LE MÉNAGE DES TITRES EN DOUBLE (voir groupesDeDoublons / ouvrirMenageDoublons).
//
// « Je commence à avoir beaucoup de fois le même titre de morceau, avec seulement les dates qui
// changent, et je ne sais plus lequel est le morceau correct. »
//
// Le lot précédent a fermé le robinet (l'import n'empile plus de doublons) ; celui-ci vide la baignoire.
// LE POINT LE PLUS IMPORTANT DU BANC : rien ne doit être supprimé. Les versions écartées vont dans un
// dossier « Archives », d'où elles restent ouvrables et d'où on peut les ressortir. C'est ce qui permet
// de trancher sans risque — on ne se décide bien que quand se tromper ne coûte rien.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan, estBruitReseau } = require('./_harness')('ménage des titres en double');
const bruit = require('./_harness').estBruitReseau;

plan(18);

(async () => {
    const navigateur = await chromium.launch();
    const erreurs = [];
    const page = await navigateur.newPage({ viewport: { width: 1300, height: 950 } });
    page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !bruit(m.text())) erreurs.push('console: ' + m.text()); });
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(800);

    if (!exiger(await page.evaluate(() => typeof groupesDeDoublons === 'function'), 'le ménage est chargé')) return bilan();

    const acc = (n) => ({ title: 'A', chords: Array.from({ length: n }, () => ({ root: 'C', quality: 'maj', beats: 4 })) });
    const poser = (songs) => page.evaluate((l) => {
        localStorage.setItem('harmohubSongs', JSON.stringify(l));
        localStorage.setItem('harmohubFolders', JSON.stringify([]));
        window.app.refreshSongList();
        window.app.openFilesWindow();
    }, songs);

    // ---- L'inventaire ----
    const inv = await page.evaluate((a) => {
        const songs = [
            { id: '1', name: 'Ballade', savedAt: 1000, sections: [a] },
            { id: '2', name: 'ballade ', savedAt: 5000, sections: [a] },   // casse + espace : même titre
            { id: '3', name: 'Ballade (2)', savedAt: 3000, sections: [a] },// nom CHOISI : distinct
            { id: '4', name: 'Nuit', savedAt: 2000, sections: [a] },
            { id: '5', name: 'Archivee', savedAt: 9000, sections: [a], folder: 'Archives' },
            { id: '6', name: 'Archivee', savedAt: 1000, sections: [a] },
        ];
        return groupesDeDoublons(songs).map(g => g.map(s => s.id));
    }, acc(1));
    check(inv.length === 1, `un seul groupe de doublons trouvé — ${JSON.stringify(inv)}`);
    check(JSON.stringify(inv[0]) === '["2","1"]',
        `« Ballade » et « ballade » forment le groupe, du plus récent au plus ancien — ${JSON.stringify(inv[0])}`);
    check(!inv.some(g => g.includes('3')), '« Ballade (2) » n\'est pas considéré comme un doublon : c\'est un nom choisi');
    check(!inv.some(g => g.includes('5') || g.includes('6')),
        'un morceau déjà archivé ne forme pas un doublon avec son homonyme vivant');

    // ---- Le bouton n'apparaît que s'il y a du désordre ----
    await poser([{ id: 'a', name: 'Seul', savedAt: 1, sections: [acc(1)] }]);
    await page.waitForTimeout(250);
    check(await page.locator('#dedup-btn').count() === 0,
        'sur une bibliothèque propre, aucun bouton de ménage — il n\'apprendrait rien');

    await poser([
        { id: 'v1', name: 'Ballade', savedAt: 5000, sections: [acc(2)] },
        { id: 'v2', name: 'Ballade', savedAt: 1000, sections: [acc(9)] },  // ancienne MAIS plus fournie
        { id: 'v3', name: 'Ballade', savedAt: 3000, sections: [acc(1)] },
        { id: 'n1', name: 'Nuit', savedAt: 5000, sections: [acc(3)] },
        { id: 'n2', name: 'Nuit', savedAt: 9000, sections: [acc(1)] },
    ]);
    await page.waitForTimeout(250);
    check(await page.isVisible('#dedup-btn'), 'avec des doublons, le bouton apparaît');
    check(/2 titre/.test(await page.textContent('#dedup-btn')),
        `et annonce combien de titres sont concernés — « ${await page.textContent('#dedup-btn')} »`);

    // ---- La fenêtre ----
    await page.click('#dedup-btn');
    await page.waitForTimeout(250);
    check(await page.isVisible('#dedup-modal'), 'la fenêtre de ménage s\'ouvre');
    const corps = await page.textContent('#dedup-body');
    check(/rien n'est supprimé/i.test(corps), 'elle dit noir sur blanc que rien ne sera supprimé');
    check(/3 versions/.test(corps) && /2 versions/.test(corps), `et le nombre de versions par titre — ${/3 versions/.test(corps)}`);
    const preselect = await page.evaluate(() => [...document.querySelectorAll('#dedup-body input:checked')].map(i => i.value));
    check(JSON.stringify(preselect) === '["v1","n2"]',
        `la plus récente de chaque groupe est cochée d'avance — ${JSON.stringify(preselect)}`);

    // Le raccourci « la plus complète » doit changer le choix là où ça compte.
    await page.click('#dedup-complete');
    const complets = await page.evaluate(() => [...document.querySelectorAll('#dedup-body input:checked')].map(i => i.value));
    check(complets[0] === 'v2', `« la plus complète » désigne bien la version la plus fournie — ${JSON.stringify(complets)}`);
    await page.click('#dedup-recent');
    const recents = await page.evaluate(() => [...document.querySelectorAll('#dedup-body input:checked')].map(i => i.value));
    check(JSON.stringify(recents) === '["v1","n2"]', 'et « la plus récente » remet la comparaison par date');

    // On choisit à la main pour le second groupe, pour vérifier que chaque groupe est indépendant.
    await page.check('#dedup-body input[name="dedup-1"][value="n1"]');
    await page.click('#dedup-apply');
    await page.waitForTimeout(350);

    // ---- LE CONTRÔLE QUI COMPTE LE PLUS : rien n'a disparu ----
    const apres = await page.evaluate(() => loadSongs().map(s => ({ id: s.id, folder: s.folder || null })));
    check(apres.length === 5, `les CINQ morceaux sont toujours là — aucune suppression (${apres.length})`);
    const dossierDe = (id) => (apres.find(s => s.id === id) || {}).folder;
    check(dossierDe('v1') === null && dossierDe('n1') === null,
        'les versions gardées restent hors des Archives');
    check(dossierDe('v2') === 'Archives' && dossierDe('v3') === 'Archives' && dossierDe('n2') === 'Archives',
        `les écartées sont rangées dans « Archives » — ${JSON.stringify(apres)}`);
    check((await page.evaluate(() => loadFolders())).includes('Archives'),
        'le dossier Archives est inscrit au registre, donc visible et manipulable');

    // Le ménage fait, il n'y a plus de doublons — donc plus de bouton.
    await page.waitForTimeout(200);
    check(await page.locator('#dedup-btn').count() === 0, 'après le ménage, le bouton disparaît de lui-même');

    // ---- RÉVERSIBLE : ressortir un morceau des Archives le remet en jeu ----
    const remis = await page.evaluate(() => {
        const songs = loadSongs().map(s => (s.id === 'v2' ? { ...s, folder: null } : s));
        return groupesDeDoublons(songs).length;
    });
    check(remis === 1, 'sortir un morceau des Archives le remet en jeu — le rangement n\'est pas un aller simple');

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.slice(0, 2).join(' | ')})`);
    await navigateur.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
