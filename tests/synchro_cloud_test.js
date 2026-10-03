// LA SYNCHRO CLOUD DE HARMOHUB (voir synchro-cloud.js et synchro-harmohub.js).
//
// CONTEXTE. Retour utilisateur : « l'enregistrement me semble trop aléatoire sur HarmoHub et TabHub ».
// Décision : tous les documents sont connectés à son Firebase, comme TrainHub. Il garde des exports et
// imports de secours, et sauvegarde de temps en temps sur un disque.
//
// CE QUE CE BANC CHERCHE EN PRIORITÉ, dans l'ordre :
//   1. qu'aucun travail ne se perde — édition concurrente, suppression, panne d'écriture, appareil
//      vierge qui se connecte à un cloud plein (écraser le cloud avec du vide serait le pire) ;
//   2. que la synchro ne boucle jamais (recevoir ne doit pas renvoyer) ;
//   3. que les données soient VALIDES pour Firestore (le faux refuse undefined, les tableaux
//      imbriqués et plus de 1 Mio, comme le vrai) ;
//   4. que l'état soit toujours dit : « l'enregistrement me semble trop aléatoire ».
//
// CE QU'IL NE PEUT PAS ÉPROUVER : les règles de sécurité Firestore, les domaines autorisés, la fenêtre
// Google réelle (surtout sur Safari et dans l'app du Dock). Le faux reproduit les refus de FORMAT du
// vrai ; il ne reproduit pas ses refus d'AUTORISATION.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('synchro cloud');
const estBruitReseau = require('./_harness').estBruitReseau;
const { creerNuage, installer } = require('./_firebase_faux');

plan(119);

const CHEMIN = 'users/u1/apps/harmohub';
const pause = (p, ms) => p.waitForTimeout(ms);

(async () => {
    const navigateur = await chromium.launch();
    const erreurs = [];
    const pannesConsignees = [];

    const ouvrir = async (nuage, appareil, { uid = 'u1', viewport, tactile, persister } = {}) => {
        const ctx = await navigateur.newContext({
            viewport: viewport || { width: 1300, height: 950 },
            ...(tactile ? { hasTouch: true, isMobile: true } : {}),
        });
        await installer(ctx, nuage, { appareil, uid, persister });
        const p = await ctx.newPage();
        p.on('pageerror', (e) => erreurs.push(`${appareil} pageerror: ${e.message}`));
        p.on('console', (m) => {
            if (m.type() !== 'error' || estBruitReseau(m.text())) return;
            // Les pannes sont SIMULÉES par ce banc, et l'appli les consigne dans la console : c'est son
            // comportement voulu. On les compte pour prouver qu'elles sont bien consignées, sans les
            // confondre avec une vraie erreur.
            if (/Envoi vers le cloud impossible|Écoute de la synchro interrompue|Synchro initiale impossible|Morceau illisible dans le cloud/.test(m.text())) { pannesConsignees.push(m.text()); return; }
            erreurs.push(`${appareil} console: ${m.text()}`);
        });
        await p.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 20000 });
        await pause(p, 900);
        return { ctx, p, nom: appareil };
    };
    const poser = async (d, songs, dossiers) => {
        await d.p.evaluate(([s, f]) => {
            localStorage.setItem('harmohubSongs', JSON.stringify(s));
            localStorage.setItem('harmohubFolders', JSON.stringify(f || []));
        }, [songs, dossiers || []]);
        await d.p.reload({ waitUntil: 'load' });
        await pause(d.p, 900);
    };
    // LE BOUTON DE SYNCHRO est dans la BARRE DU HAUT (comme TrainHub), pas dans le menu Fichier : c'est un
    // menu d'EXPORT (retour utilisateur : « c'est un bouton d'export, pas de sauvegarde »).
    const ouvrirMenuCloud = async (p) => { await p.click('#account-info'); await p.waitForTimeout(200); };
    const deconnecter = async (p) => { await ouvrirMenuCloud(p); await p.click('#signout-btn'); };
    const connecter = async (d, attente = 1800) => { await d.p.click('#google-signin-btn'); await pause(d.p, attente); };
    const etat = (d) => d.p.getAttribute('#sync-status', 'data-etat');
    const locaux = (d) => d.p.evaluate(() => loadSongs());
    const nomsLocaux = async (d) => (await locaux(d)).map(s => s.name).sort();
    const dansNuage = (nuage) => {
        const doc = nuage.docs.get(CHEMIN);
        return doc ? doc.songs.map(e => JSON.parse(e.json)) : null;
    };
    // Modifie un morceau comme le fait tout le code de l'appli : lire, changer, saveSongs.
    const modifier = (d, id, champs) => d.p.evaluate(([i, c]) => {
        const l = loadSongs(); const s = l.find(x => x.id === i); Object.assign(s, c); saveSongs(l);
    }, [id, champs]);
    const morceau = (id, name, savedAt, extra = {}) => Object.assign({ id, name, savedAt, sections: [{ title: 'A', chords: [] }] }, extra);

    // =========================================================================================
    // 0. SANS FIREBASE : la synchro n'existe pas, et RIEN ne doit casser
    // =========================================================================================
    {
        const ctx = await navigateur.newContext({ viewport: { width: 1300, height: 950 } });
        await ctx.route(/gstatic\.com\/firebasejs\//, (r) => r.abort());
        const p = await ctx.newPage();
        const locales = [];
        p.on('pageerror', (e) => locales.push(e.message));
        await p.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 20000 });
        await pause(p, 900);
        check(locales.length === 0, `sans SDK Firebase (hors ligne au premier chargement), aucune erreur — ${locales.slice(0, 1)}`);
        check(await p.isVisible('#google-signin-btn') && await p.locator('#google-signin-btn').evaluate(e => e.classList.contains('indisponible')),
            'sans SDK, le bouton reste VISIBLE mais grisé : un bouton qui disparaît en silence ressemble à une panne');
        check(/Firebase/.test(await p.getAttribute('#google-signin-btn', 'title')), 'et la raison est au survol');
        await p.click('#google-signin-btn'); await pause(p, 300);
        check(/indisponible/.test(await p.textContent('#toast')), 'le clic DIT pourquoi au lieu de ne rien faire');
        check(!(await p.evaluate(() => [...document.querySelectorAll('#file-menu-btn')].length && (document.getElementById('file-menu') || {}).textContent || '')).includes('Cloud'),
            'et le menu Fichier ne contient rien sur la synchro');
        const stampe = await p.evaluate(() => {
            localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 'x', name: 'X', savedAt: 1, sections: [] }]));
            const l = loadSongs(); l[0].name = 'X2'; saveSongs(l);
            return { enreg: loadSongs()[0].name, syncAt: typeof loadSongs()[0].syncAt };
        });
        check(stampe.enreg === 'X2', 'enregistrer un morceau marche exactement comme avant, synchro ou non');
        check(stampe.syncAt === 'number', 'et la date de synchro est posée quand même, pour qu\'une connexion ultérieure parte d\'un état sain');
        await ctx.close();
    }

    // =========================================================================================
    // 1. PREMIÈRE CONNEXION, CLOUD VIDE : cet appareil l'amorce
    // =========================================================================================
    const nuage = creerNuage();
    const A = await ouvrir(nuage, 'A');
    await poser(A, [morceau('a1', 'Ballade', 1000), morceau('a2', 'Nuit', 2000)], ['Jazz']);
    if (!exiger(await A.p.isVisible('#google-signin-btn'), 'le bouton « Se connecter » est visible dans la barre du haut')) return bilan();
    check(await A.p.isHidden('#account-info') && await A.p.isHidden('#sync-status'), 'et rien d\'autre tant qu\'aucun compte n\'est connecté');
    check(!(await A.p.evaluate(() => document.getElementById('file-menu-btn') && (window.app.openFileMenu(document.getElementById('file-menu-btn')), document.getElementById('file-menu').textContent))).includes('Se connecter'),
        'le menu Fichier ne contient PAS la connexion : c\'est un menu d\'export');
    await A.p.keyboard.press('Escape'); await A.p.evaluate(() => window.app.closeFileMenu());
    await connecter(A);
    check(await etat(A) === 'synced', `connecté : la pastille passe à « synchronisé » — ${await etat(A)}`);
    check(nuage.docs.has(CHEMIN), 'le document est créé sous users/{uid}/apps/harmohub, le même chemin que TrainHub (slug « harmohub »)');
    check((dansNuage(nuage) || []).length === 2, 'les deux morceaux de l\'appareil sont au cloud');
    check(nuage.docs.get(CHEMIN).songs.every(e => typeof e.json === 'string'),
        'chaque morceau est stocké comme une chaîne JSON — Firestore refuse les tableaux imbriqués et `undefined`');
    check(nuage.docs.get(CHEMIN).dossiers.some(r => r.nom === 'Jazz' && r.supprime === false), 'le dossier part aussi, avec sa date');
    check(await A.p.isVisible('#account-info') && await A.p.isHidden('#google-signin-btn'),
        'connecté : le bouton montre le COMPTE à la place de « Se connecter »');
    check(/Testeur/.test(await A.p.textContent('#account-name')) || (await A.p.evaluate(() => getComputedStyle(document.getElementById('account-name')).display)) === 'none',
        'avec le nom de la personne (sur un écran étroit, le libellé s\'efface et la pastille reste)');
    await ouvrirMenuCloud(A.p);
    check(/Synchronisé/.test(await A.p.textContent('#cloud-menu-etat')), 'cliquer dessus dit l\'état de la synchro en toutes lettres');
    await A.p.keyboard.press('Escape'); await pause(A.p, 150);
    check(await A.p.isHidden('#cloud-menu'), 'et Échap referme ce menu');

    // =========================================================================================
    // 2. APPAREIL VIERGE : il RÉCUPÈRE, sans rien demander et sans écraser le cloud
    // =========================================================================================
    const B = await ouvrir(nuage, 'B');
    const ecrituresAvantB = nuage.ecritures.filter(e => e.appareil === 'B').length;
    await connecter(B);
    check(JSON.stringify(await nomsLocaux(B)) === '["Ballade","Nuit"]', 'un appareil vierge récupère toute la bibliothèque');
    check(await B.p.isHidden('#import-conflict-modal'), 'sans poser la moindre question : il n\'y a rien à arbitrer');
    check(JSON.stringify(await B.p.evaluate(() => loadFolders())) === '["Jazz"]', 'dossiers compris');
    check(nuage.ecritures.filter(e => e.appareil === 'B').length === ecrituresAvantB,
        'et n\'a RIEN écrit au cloud : écraser le cloud avec du vide serait le pire qui puisse arriver');
    check((dansNuage(nuage) || []).length === 2, 'le cloud a toujours ses deux morceaux');

    // =========================================================================================
    // 3. MODIFIER : la pastille dit la vérité, puis l'autre appareil reçoit
    // =========================================================================================
    const ecrituresAvantA = nuage.ecritures.filter(e => e.appareil === 'A').length;
    await modifier(A, 'a1', { sections: [{ title: 'A', chords: [] }, { title: 'B', chords: [] }] });
    check(await etat(A) === 'pending',
        `juste après l'enregistrement : « modifications pas encore envoyées » — c'est la réponse à « est-ce bien parti ? » (${await etat(A)})`);
    check(/pas encore envoyées/.test(await A.p.getAttribute('#sync-status', 'title')), 'et le survol le dit en toutes lettres');
    await pause(A.p, 2600);
    check(await etat(A) === 'synced', 'puis « synchronisé » une fois parti');
    check((dansNuage(nuage).find(s => s.id === 'a1').sections || []).length === 2, 'le cloud porte la nouvelle version');
    check(((await locaux(B)).find(s => s.id === 'a1').sections || []).length === 2,
        'et l\'autre appareil l\'a reçue tout seul, sans rien faire');
    const ecrituresB = nuage.ecritures.filter(e => e.appareil === 'B').length;
    check(ecrituresB === ecrituresAvantB,
        `recevoir ne renvoie RIEN : pas de boucle entre appareils (B a écrit ${ecrituresB - ecrituresAvantB} fois)`);
    check(nuage.ecritures.filter(e => e.appareil === 'A').length - ecrituresAvantA === 1,
        'et une modification n\'a coûté qu\'UNE écriture à l\'appareil qui l\'a faite');
    // ATTENDRE ASSEZ POUR VOIR UNE BOUCLE. Une première version de la couche d'envoi se renvoyait
    // elle-même indéfiniment, une écriture toutes les 1,5 s. Ce contrôle existait déjà — mais il lisait
    // le compteur à 2,6 s, JUSTE AVANT la deuxième écriture, et passait. Un banc qui mesure trop tôt ne
    // voit pas ce qu'il cherche ; on lit donc encore 5 s plus tard, soit trois délais d'envoi.
    await pause(A.p, 5000);
    check(nuage.ecritures.filter(e => e.appareil === 'A').length - ecrituresAvantA === 1,
        'et cinq secondes plus tard TOUJOURS une seule : la synchro ne se renvoie pas elle-même');
    check(await etat(A) === 'synced', 'la pastille est restée stable au lieu de clignoter entre envoi et attente');

    // Un simple déplacement dans un dossier doit voyager aussi, sans toucher à la date affichée.
    const savedAvant = (await locaux(A)).find(s => s.id === 'a2').savedAt;
    await A.p.evaluate(() => window.app.moveSongToFolder('a2', 'Jazz'));
    await pause(A.p, 2600);
    check(((await locaux(B)).find(s => s.id === 'a2') || {}).folder === 'Jazz',
        'un déplacement dans un dossier arrive sur l\'autre appareil — moveSongToFolder ne change pas savedAt, d\'où syncAt');
    check((await locaux(A)).find(s => s.id === 'a2').savedAt === savedAvant, 'sans que la date d\'enregistrement affichée ait bougé');

    // =========================================================================================
    // 4. SUPPRIMER : la trace empêche un appareil en retard de ramener le morceau
    // =========================================================================================
    await A.p.evaluate(() => { const l = loadSongs().filter(s => s.id !== 'a2'); saveSongs(l); });
    await pause(A.p, 2600);
    check(nuage.docs.get(CHEMIN).supprimes.some(t => t.id === 'a2'), 'la suppression laisse une trace au cloud');
    check(!(await nomsLocaux(B)).includes('Nuit'), 'l\'autre appareil perd le morceau supprimé');
    // B, qui vient de tout recevoir, enregistre autre chose : le morceau supprimé ne doit pas revenir.
    await modifier(B, 'a1', { bpm: 99 });
    await pause(B.p, 2600);
    check(!(dansNuage(nuage).map(s => s.id)).includes('a2'), 'et il ne REVIENT PAS quand l\'autre appareil enregistre à son tour');
    check(!(await nomsLocaux(A)).includes('Nuit'), 'pas davantage là d\'où il a été supprimé');

    // Ctrl+Z : un morceau qui revient doit l'emporter sur sa propre suppression.
    await A.p.evaluate(() => { const l = loadSongs(); l.push({ id: 'a2', name: 'Nuit', savedAt: 2000, sections: [] }); saveSongs(l); });
    await pause(A.p, 2600);
    check((dansNuage(nuage).map(s => s.id)).includes('a2'), 'restaurer un morceau supprimé (Ctrl+Z) le remet au cloud');
    check((await nomsLocaux(B)).includes('Nuit'), 'et sur l\'autre appareil');

    // =========================================================================================
    // 5. ÉDITIONS CONCURRENTES : personne ne perd rien
    // =========================================================================================
    // B tombe hors ligne, puis les deux appareils modifient.
    nuage.coupe.add('B');
    await modifier(B, 'a2', { notes: 'écrit sur B hors ligne' });
    await pause(B.p, 2200);
    check(await etat(B) === 'error' || await etat(B) === 'offline', `hors ligne, la pastille le dit (${await etat(B)})`);
    await modifier(A, 'a1', { notes: 'écrit sur A pendant ce temps' });
    await pause(A.p, 2600);
    nuage.coupe.delete('B');
    await B.p.evaluate(() => window.dispatchEvent(new Event('online')));
    await pause(B.p, 3200);
    const cloudApres = dansNuage(nuage);
    check(cloudApres.find(s => s.id === 'a2').notes === 'écrit sur B hors ligne',
        'le travail fait HORS LIGNE sur B est au cloud au retour du réseau');
    check(cloudApres.find(s => s.id === 'a1').notes === 'écrit sur A pendant ce temps',
        'et celui de A, fait pendant ce temps, n\'a pas été écrasé : deux morceaux différents, deux modifications conservées');
    check((await locaux(B)).find(s => s.id === 'a1').notes === 'écrit sur A pendant ce temps', 'B a reçu le travail de A');
    check((await locaux(A)).find(s => s.id === 'a2').notes === 'écrit sur B hors ligne', 'A a reçu le travail de B');

    // MÊME morceau modifié des deux côtés : celle qui perd est RANGÉE, pas jetée.
    nuage.coupe.add('B');
    await modifier(B, 'a1', { notes: 'version B' });
    await pause(B.p, 300);
    await pause(A.p, 50);
    await modifier(A, 'a1', { notes: 'version A (plus récente)' });
    await pause(A.p, 2600);
    nuage.coupe.delete('B');
    await B.p.evaluate(() => window.dispatchEvent(new Event('online')));
    await pause(B.p, 3200);
    const lesA1 = (dansNuage(nuage) || []);
    check(lesA1.find(s => s.id === 'a1').notes === 'version A (plus récente)', 'édition concurrente du MÊME morceau : la plus récente gagne');
    const archives = lesA1.filter(s => s.folder === 'Archives' && s.notes === 'version B');
    check(archives.length === 1, `et la perdante est RANGÉE dans Archives, pas jetée — ${archives.length} archive(s)`);
    check(archives[0].name === 'Ballade', 'sous le même titre, pour qu\'on la reconnaisse');
    check(JSON.stringify((await B.p.evaluate(() => loadFolders()))).includes('Archives'), 'le dossier Archives existe des deux côtés');

    // La règle vaut AUSSI quand c'est la version d'ici qui gagne (défaut trouvé en relisant la fusion).
    const pureGagne = await A.p.evaluate(() => {
        const l = { songs: [{ id: 's', name: 'S', savedAt: 1, syncAt: 500, notes: 'ici' }], dossiers: [], supprimes: {} };
        const r = { songs: [{ id: 's', name: 'S', savedAt: 1, syncAt: 400, notes: 'la-bas' }], dossiers: [], supprimes: {} };
        const res = fusionnerBibliotheques(l, r, { base: { s: 100 }, maintenant: 9000 });
        return res.fusionne.songs.map(x => x.notes + '/' + (x.folder || '-')).sort();
    });
    check(JSON.stringify(pureGagne) === '["ici/-","la-bas/Archives"]',
        `quand c'est la version d'ICI qui gagne, celle de l'autre appareil est rangée elle aussi — ${JSON.stringify(pureGagne)}`);

    // =========================================================================================
    // 6. FUSION PURE : les cas limites, sans navigateur de synchro
    // =========================================================================================
    const pur = await A.p.evaluate(() => {
        const F = fusionnerBibliotheques;
        const vide = { dossiers: [], supprimes: {} };
        const s = (id, sync, extra) => Object.assign({ id, name: id, savedAt: sync, syncAt: sync }, extra || {});
        const out = {};
        // égalité : l'appareil garde sa version
        out.egalite = F({ songs: [s('x', 10, { n: 'ici' })], ...vide }, { songs: [s('x', 10, { n: 'la' })], ...vide }, { base: { x: 10 } }).fusionne.songs[0].n;
        // suppression plus récente que le morceau : supprimé
        out.supprime = F({ songs: [s('x', 10)], ...vide }, { songs: [], dossiers: [], supprimes: { x: 20 } }, {}).fusionne.songs.length;
        // morceau modifié APRÈS sa suppression : il revient
        const revenu = F({ songs: [s('x', 30)], ...vide }, { songs: [], dossiers: [], supprimes: { x: 20 } }, {});
        out.revenu = [revenu.fusionne.songs.length, Object.keys(revenu.fusionne.supprimes).length];
        // archives déterministes : rejouer la fusion ne crée pas deux archives
        const l = { songs: [s('x', 5, { n: 'l' })], ...vide }, r = { songs: [s('x', 9, { n: 'r' })], ...vide };
        const un = F(l, r, { base: {}, maintenant: 1 }), deux = F(l, r, { base: {}, maintenant: 999 });
        out.archivesStables = [un.fusionne.songs.map(x => x.id).sort().join(), deux.fusionne.songs.map(x => x.id).sort().join()];
        // identique : aucun changement local
        out.identique = F({ songs: [s('x', 10)], ...vide }, { songs: [s('x', 10)], ...vide }, { base: { x: 10 } }).changeLocal;
        // dossier supprimé plus récemment qu'il n'a été créé
        const d = F({ songs: [], dossiers: [{ nom: 'J', ts: 5, supprime: false }], supprimes: {} }, { songs: [], dossiers: [{ nom: 'J', ts: 9, supprime: true }], supprimes: {} }, {});
        out.dossierSupprime = d.fusionne.dossiersVisibles;
        // un dossier référencé par un morceau vivant existe, quoi qu'en disent les traces
        const ref = F({ songs: [s('x', 1, { folder: 'J' })], dossiers: [], supprimes: {} }, { songs: [], dossiers: [{ nom: 'J', ts: 9, supprime: true }], supprimes: {} }, {});
        out.dossierRef = ref.fusionne.dossiersVisibles;
        return out;
    });
    check(pur.egalite === 'ici', 'à égalité de date, l\'appareil garde sa version — pas de va-et-vient entre deux appareils');
    check(pur.supprime === 0, 'un morceau plus ancien que sa suppression est supprimé');
    check(pur.revenu[0] === 1 && pur.revenu[1] === 0, 'un morceau modifié APRÈS sa suppression revient, et la trace disparaît');
    check(pur.archivesStables[0] === pur.archivesStables[1], 'rejouer la même fusion ne crée jamais deux fois la même archive');
    check(pur.identique === false, 'deux états identiques : rien à appliquer');
    check(JSON.stringify(pur.dossierSupprime) === '[]', 'un dossier supprimé après sa création disparaît');
    check(JSON.stringify(pur.dossierRef) === '["J"]', 'mais un dossier qu\'un morceau vivant référence reste, quoi qu\'en disent les traces');

    // Un morceau illisible dans le cloud est ignoré, il ne fait pas tomber la synchro.
    const illisible = await A.p.evaluate(() => depuisDocumentHarmoHub({ songs: [{ id: 'z', json: '{pas du json' }, { id: 'ok', json: '{"id":"ok","name":"ok"}' }], dossiers: [], supprimes: [] }).songs.map(s => s.id));
    check(JSON.stringify(illisible) === '["ok"]', 'un morceau illisible au cloud est ignoré sans faire tomber la synchro');

    // =========================================================================================
    // 7. DONNÉES DÉLICATES : ce que Firestore refuserait
    // =========================================================================================
    await A.p.evaluate(() => {
        const l = loadSongs();
        // Un champ futur avec un tableau imbriqué et une valeur undefined : le vrai Firestore refuserait.
        l.push({ id: 'piege', name: 'Piège', savedAt: 5000, sections: [], motif: [[1, 2], [3]], absent: undefined });
        saveSongs(l);
    });
    await pause(A.p, 2600);
    check(await etat(A) === 'synced', `un morceau à tableaux imbriqués se synchronise quand même — ${await etat(A)}`);
    const piege = ((dansNuage(nuage) || []).find(s => s.id === 'piege')) || {};
    check(JSON.stringify(piege.motif) === '[[1,2],[3]]', 'et en revient intact');
    check(JSON.stringify(((await locaux(B)).find(s => s.id === 'piege') || {}).motif) === '[[1,2],[3]]', 'sur l\'autre appareil aussi');

    // =========================================================================================
    // 8. PANNE D'ÉCRITURE : rien n'est perdu, et on le SAIT
    // =========================================================================================
    nuage.coupe.add('A');
    await modifier(A, 'a1', { notes: 'écrit pendant une panne' });
    await pause(A.p, 2600);
    check(await etat(A) === 'error', `une écriture qui échoue ne repasse JAMAIS au vert — ${await etat(A)}`);
    check((await locaux(A)).find(s => s.id === 'a1').notes === 'écrit pendant une panne', 'le travail reste enregistré sur l\'appareil');
    const bloque = await A.p.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
    check(bloque === true, 'fermer l\'onglet alors que des modifications n\'ont pas été envoyées est signalé');
    nuage.coupe.delete('A');
    // SANS évènement `online` : la reprise automatique seule. Sans elle, un échec passager laissait les
    // modifications en attente jusqu'à la PROCHAINE modification — potentiellement des heures, et c'est
    // le « trop aléatoire » signalé. Premier essai 5 s après l'échec.
    await pause(A.p, 6500);
    check(await etat(A) === 'synced', `le réseau revenu, l'envoi reprend TOUT SEUL, sans évènement ni nouvelle modification — ${await etat(A)}`);
    check(dansNuage(nuage).find(s => s.id === 'a1').notes === 'écrit pendant une panne', 'et le travail est au cloud');
    const libre = await A.p.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
    check(libre === false, 'une fois tout envoyé, plus aucun avertissement à la fermeture');

    // Quand l'onglet se cache (iPhone, app du Dock), on n'attend pas le délai.
    const avantCache = nuage.ecritures.filter(e => e.appareil === 'A').length;
    await modifier(A, 'a1', { notes: 'juste avant de quitter' });
    await A.p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await pause(A.p, 600);
    check(nuage.ecritures.filter(e => e.appareil === 'A').length === avantCache + 1,
        'quand l\'onglet se cache, l\'envoi part aussitôt au lieu d\'attendre — c\'est le seul signal fiable sur iPhone');
    await A.p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });

    // =========================================================================================
    // 9. PLAFOND D'UN DOCUMENT
    // =========================================================================================
    const nuageGros = creerNuage();
    const G = await ouvrir(nuageGros, 'G');
    const tailles = await G.p.evaluate(() => {
        const bloc = 'x'.repeat(9000);
        const songs = [];
        let poids = 0, alerte = 0;
        for (let i = 0; i < 300; i++) {
            songs.push({ id: 'g' + i, name: 'G' + i, savedAt: i + 1, sections: [], gros: bloc });
            poids = poidsOctets(versDocumentHarmoHub({ songs, dossiers: [], supprimes: {} }));
            if (!alerte && poids > TAILLE_ALERTE) alerte = songs.length;
            if (poids > TAILLE_MAX) break;
        }
        return { total: songs.length, alerte };
    });
    const creer = (n) => G.p.evaluate((nb) => {
        const bloc = 'x'.repeat(9000);
        localStorage.setItem('harmohubSongs', JSON.stringify(Array.from({ length: nb }, (_, i) => ({ id: 'g' + i, name: 'G' + i, savedAt: i + 1, sections: [], gros: bloc }))));
    }, n);
    await creer(tailles.total);
    await G.p.reload({ waitUntil: 'load' }); await pause(G.p, 900);
    await connecter(G, 2500);
    check(await etat(G) === 'toolarge', `au-delà du plafond, la pastille le dit au lieu d'échouer en silence — ${await etat(G)}`);
    check(!nuageGros.docs.has(CHEMIN), 'rien n\'est envoyé : un document refusé ne doit pas laisser le cloud à moitié écrit');
    check((await locaux(G)).length === tailles.total, 'et toute la bibliothèque reste intacte sur l\'appareil');
    check(/sauvegarde sur disque/.test(await G.p.getAttribute('#sync-status', 'title')), 'le message renvoie vers la sauvegarde sur disque, qui reste le recours');
    await creer(tailles.alerte + 1);
    await G.p.reload({ waitUntil: 'load' }); await pause(G.p, 900);
    await connecter(G, 2500);
    check(await etat(G) === 'synced' && /% du plafond/.test(await G.p.getAttribute('#sync-status', 'title')),
        `à 80 % du plafond, on prévient AVANT de l'atteindre — « ${await G.p.getAttribute('#sync-status', 'title')} »`);

    // =========================================================================================
    // 10. PREMIÈRE CONNEXION D'UN APPAREIL QUI A DÉJÀ DU CONTENU : le cas qui fabriquait les doublons
    // =========================================================================================
    const cas = async (choix) => {
        const n = creerNuage();
        const D1 = await ouvrir(n, 'D1');
        await poser(D1, [morceau('c1', 'Ballade', 5000, { notes: 'cloud' }), morceau('c2', 'Nuit', 3000)]);
        await connecter(D1);
        const D2 = await ouvrir(n, 'D2');
        await poser(D2, [morceau('l1', 'Ballade', 1000, { notes: 'appareil' }), morceau('l2', 'Solo', 2000)]);
        await D2.p.click('#google-signin-btn');
        await pause(D2.p, 900);
        const vu = await D2.p.evaluate(() => ({
            visible: !document.getElementById('import-conflict-modal').hidden,
            titre: document.getElementById('import-conflict-title').textContent,
            corps: document.getElementById('import-conflict-body').textContent,
            coche: (document.querySelector('input[name="ic-c1"]:checked') || {}).value,
        }));
        if (choix === 'fermer') await D2.p.click('#import-conflict-modal', { position: { x: 4, y: 4 } });
        else await D2.p.check(`input[name="ic-c1"][value="${choix}"]`).then(() => D2.p.click('#import-conflict-apply'));
        await pause(D2.p, 3000);
        const vivants = (await locaux(D2)).filter(s => s.folder !== 'Archives');
        const rangees = (await locaux(D2)).filter(s => s.folder === 'Archives');
        const dansCloud = (dansNuage2(n) || []);
        return { vu, vivants, rangees, dansCloud, D2 };
    };
    const dansNuage2 = (n) => { const doc = n.docs.get(CHEMIN); return doc ? doc.songs.map(e => JSON.parse(e.json)) : null; };

    const ec = await cas('ecraser');
    check(ec.vu.visible, 'deux bibliothèques qui se ressemblent : on DEMANDE au lieu de fusionner en silence');
    check(ec.vu.titre === 'Ta bibliothèque existe déjà dans le cloud', 'avec les mots du cloud, pas ceux de l\'import de fichier');
    check(/Sur cet appareil/.test(ec.vu.corps) && /Dans le cloud/.test(ec.vu.corps), 'les deux versions sont nommées « Sur cet appareil » et « Dans le cloud »');
    check(/Archives/.test(ec.vu.corps) && /rien n'est supprimé/.test(ec.vu.corps), 'et la fenêtre dit ce qu\'il advient de celle qu\'on écarte');
    check(ec.vu.coche === 'ecraser', 'la plus récente (ici celle du cloud) est cochée d\'avance');
    check(ec.vivants.filter(s => s.name === 'Ballade').length === 1, '« prendre celle du cloud » : UN seul « Ballade » vivant, pas deux');
    check(ec.vivants.find(s => s.name === 'Ballade').notes === 'cloud', 'et c\'est celui du cloud');
    check(ec.rangees.some(s => s.notes === 'appareil'), 'celui de l\'appareil est rangé dans Archives, pas jeté');
    check(ec.vivants.some(s => s.name === 'Solo') && ec.vivants.some(s => s.name === 'Nuit'), 'les morceaux sans équivalent sont tous là');
    check(ec.dansCloud.filter(s => s.name === 'Ballade' && s.folder !== 'Archives').length === 1, 'le cloud non plus n\'a pas de doublon vivant');

    const ig = await cas('ignorer');
    check(ig.vivants.find(s => s.name === 'Ballade').notes === 'appareil', '« garder celle de cet appareil » : c\'est elle qui reste vivante');
    check(ig.dansCloud.some(s => s.id === 'c1' && s.folder === 'Archives'),
        'et celle du cloud est rangée dans Archives AU cloud, donc sur tous les autres appareils aussi');

    const deux = await cas('les-deux');
    check(deux.vivants.filter(s => /^Ballade/.test(s.name)).length === 2, '« garder les deux » : deux morceaux vivants');
    check(deux.vivants.some(s => s.name === 'Ballade (2)'), 'la copie de l\'appareil porte un suffixe pour qu\'on les distingue');

    const ferme = await cas('fermer');
    check(ferme.vivants.filter(s => /^Ballade/.test(s.name)).length === 2 && ferme.rangees.length === 0,
        'fermer la fenêtre sans choisir ne retire RIEN à personne : on garde les deux');

    // =========================================================================================
    // 11. LE MORCEAU OUVERT
    // =========================================================================================
    await A.p.evaluate(() => { const l = loadSongs(); setCurrentSongId('a1'); window.app.loadSong('a1'); });
    await B.p.evaluate(() => { setCurrentSongId('a1'); window.app.loadSong('a1'); });
    await pause(B.p, 400);
    await modifier(A, 'a1', { sections: [{ title: 'Venu de A', chords: [] }] });
    await pause(A.p, 2600);
    check((await B.p.evaluate(() => loadProgressionSections()))[0].title === 'Venu de A',
        'le morceau ouvert, sans modification en cours, se recharge quand une version plus récente arrive');
    await B.p.evaluate(() => { window.eval('hasUnsavedChanges = true'); });
    await modifier(A, 'a1', { sections: [{ title: 'Deuxième version de A', chords: [] }] });
    await pause(A.p, 2600);
    check((await B.p.evaluate(() => loadProgressionSections()))[0].title === 'Venu de A',
        'mais avec des modifications en cours, l\'écran n\'est PAS remplacé sous les doigts');
    check(/modifié sur un autre appareil/.test(await B.p.textContent('#toast')), 'on prévient que la version a changé ailleurs');
    // L'autre version ne doit pas pouvoir être écrasée sans trace par un enregistrement ultérieur.
    const rangeeIci = (await locaux(B)).filter(s => s.folder === 'Archives' && (s.sections[0] || {}).title === 'Deuxième version de A');
    check(rangeeIci.length === 1,
        'et la version arrivée d\'ailleurs est RANGÉE dans Archives : l\'enregistrer par-dessus ne la ferait pas disparaître');
    await pause(B.p, 2800);
    check((dansNuage(nuage) || []).some(s => s.folder === 'Archives' && (s.sections[0] || {}).title === 'Deuxième version de A'),
        'et cette archive est envoyée au cloud, pas seulement gardée ici');
    await B.p.evaluate(() => { window.eval('hasUnsavedChanges = false'); });

    // =========================================================================================
    // 12. DÉCONNEXION ET CHANGEMENT DE COMPTE
    // =========================================================================================
    const ecrituresAvantSortie = nuage.ecritures.length;
    await deconnecter(B.p);
    await pause(B.p, 500);
    check(await B.p.isVisible('#google-signin-btn') && await B.p.isHidden('#sync-status') && await B.p.isHidden('#cloud-menu'),
        'se déconnecter remet « Se connecter », masque la pastille et referme le menu');
    check((await locaux(B)).length > 0, 'et la bibliothèque reste sur l\'appareil');
    await modifier(B, 'a1', { notes: 'déconnecté' });
    await pause(B.p, 2500);
    check(nuage.ecritures.length === ecrituresAvantSortie, 'déconnecté, plus rien ne part au cloud');
    const compte = await B.p.evaluate(() => {
        localStorage.setItem('harmohub_sync_uid', 'u1'); localStorage.setItem('harmohub_sync_base', '{"a":1}');
        ADAPTATEUR_HARMOHUB.surCompte('u1'); const memeCompte = localStorage.getItem('harmohub_sync_base');
        ADAPTATEUR_HARMOHUB.surCompte('u2'); const autreCompte = localStorage.getItem('harmohub_sync_base');
        return { memeCompte, autreCompte, uid: localStorage.getItem('harmohub_sync_uid') };
    });
    check(compte.memeCompte !== null, 'se reconnecter avec le même compte garde l\'historique de synchro');
    check(compte.autreCompte === null && compte.uid === 'u2',
        'un AUTRE compte repart de zéro : ses morceaux ne seraient pas fusionnés dans la base du précédent');

    // =========================================================================================
    // 13. TÉLÉPHONE
    // =========================================================================================
    const nuageTel = creerNuage();
    const T = await ouvrir(nuageTel, 'T', { viewport: { width: 390, height: 844 }, tactile: true });
    await poser(T, [morceau('t1', 'Sur téléphone', 1000)]);
    // La barre du haut est FIXE et flottante, avec de la place ; l'en-tête de la carte Morceau, lui, n'a que
    // 4 px de marge à 390 px et ne doit pas bouger (mobile_grille_plus_haut l'avait signalé à une version précédente).
    const geometrie = () => T.p.evaluate(() => {
        const y = (s) => { const e = document.querySelector(s); const b = e && e.getBoundingClientRect(); return b && b.width > 0 ? Math.round(b.top + window.scrollY) : null; };
        const b = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height), vis: r.width > 0 }; };
        return { titre: y('#song-card .card-head h2'), actions: y('#song-card .card-head-actions'), select: y('#song-select'),
                 debord: document.documentElement.scrollWidth - window.innerWidth,
                 pastille: b('sync-status'), compte: b('account-info'), logo: document.querySelector('.logo').getBoundingClientRect().left };
    });
    const avantConnexion = await geometrie();
    await connecter(T);
    const apresConnexion = await geometrie();
    check(avantConnexion.titre === apresConnexion.titre && avantConnexion.actions === apresConnexion.actions && avantConnexion.select === apresConnexion.select,
        'se connecter ne bouge RIEN dans la carte Morceau');
    check(apresConnexion.debord <= 1, `à 390 px la page ne déborde pas (${apresConnexion.debord}px)`);
    check(apresConnexion.pastille.vis, 'la pastille reste visible sur téléphone, libellé du nom effacé');
    check(apresConnexion.compte.h >= 32 && apresConnexion.compte.w >= 32, `le bouton se vise au doigt (${apresConnexion.compte.w}×${apresConnexion.compte.h})`);
    check(apresConnexion.compte.r <= apresConnexion.logo, 'et ne chevauche pas le logo');

    // ================= 14. LE GARDE-FOU : travailler sans être connecté =================
    // « Un garde-fou pour me demander une confirmation si je commence à travailler alors que je ne suis pas connecté. »
    const nuageG = creerNuage();
    const GF = await ouvrir(nuageG, 'GF');
    await pause(GF.p, 600);
    check(await GF.p.isHidden('#cloud-guard-modal'), 'à l\'ouverture, sans rien toucher : AUCUNE question — il n\'y a pas encore de travail');
    await GF.p.evaluate(() => window.app.openFileMenu(document.getElementById('file-menu-btn')));
    await GF.p.evaluate(() => window.app.closeFileMenu());
    check(await GF.p.isHidden('#cloud-guard-modal'), 'ouvrir un menu n\'est pas travailler');
    await GF.p.evaluate(() => saveProgressionSections([{ title: 'A', chords: [] }]));
    await pause(GF.p, 250);
    check(await GF.p.isVisible('#cloud-guard-modal'), 'à la PREMIÈRE modification sans être connecté : la question s\'ouvre');
    check(/pas enregistré dans le cloud/.test(await GF.p.textContent('#cloud-guard-modal')), 'et dit ce qu\'on risque : ça ne partira pas dans le cloud');
    check(await GF.p.isVisible('#cloud-guard-connect') && await GF.p.isVisible('#cloud-guard-continue'), 'avec deux issues : se connecter, ou continuer sans');
    await GF.p.click('#cloud-guard-continue');
    check(await GF.p.isHidden('#cloud-guard-modal'), '« continuer sans synchroniser » referme la fenêtre');
    await GF.p.evaluate(() => saveProgressionSections([{ title: 'B', chords: [] }]));
    await pause(GF.p, 250);
    check(await GF.p.isHidden('#cloud-guard-modal'), 'et on ne REDEMANDE pas à chaque modification : une seule fois par ouverture');
    check((await GF.p.evaluate(() => loadProgressionSections()))[0].title === 'B', 'le travail n\'a jamais été bloqué');

    // Fermer sans choisir = continuer (jamais bloquer).
    const GF2 = await ouvrir(creerNuage(), 'GF2');
    await GF2.p.evaluate(() => saveProgressionSections([{ title: 'A', chords: [] }]));
    await pause(GF2.p, 250);
    await GF2.p.click('#cloud-guard-modal', { position: { x: 4, y: 4 } });
    check(await GF2.p.isHidden('#cloud-guard-modal'), 'cliquer à côté referme aussi : on ne bloque jamais le travail');

    // « Se connecter » depuis la question : la fenêtre Google part de CE clic.
    const GF3 = await ouvrir(creerNuage(), 'GF3', { persister: true });
    await GF3.p.evaluate(() => saveProgressionSections([{ title: 'A', chords: [] }]));
    await pause(GF3.p, 250);
    await GF3.p.click('#cloud-guard-connect');
    await pause(GF3.p, 1500);
    check(await GF3.p.evaluate(() => window.__faux.fenetresGoogle) === 1, 'le bouton ouvre la connexion Google (depuis le clic, sans quoi le navigateur la bloquerait)');
    check(await etat(GF3) === 'synced', 'et la synchro démarre aussitôt');

    // Déjà connecté : jamais de question, même après un rechargement où la session se relit.
    await GF3.p.reload({ waitUntil: 'load' }); await pause(GF3.p, 900);
    await GF3.p.evaluate(() => saveProgressionSections([{ title: 'C', chords: [] }]));
    await pause(GF3.p, 250);
    check(await GF3.p.isHidden('#cloud-guard-modal'), 'connecté, jamais de question');

    // Avant que Firebase ait répondu sur « qui est connecté » : se taire, ce serait une fausse alerte.
    const GF4 = await ouvrir(creerNuage(), 'GF4');
    const avantReponse = await GF4.p.evaluate(() => {
        SYNCHRO.etat.authPrete = false; SYNCHRO.etat.gardeConnexionPosee = false; SYNCHRO.etat.utilisateur = null;
        saveProgressionSections([{ title: 'X', chords: [] }]);
        return document.getElementById('cloud-guard-modal').hidden;
    });
    check(avantReponse === true, 'tant que Firebase n\'a pas dit s\'il y a une session, on se TAIT : alerter quelqu\'un déjà connecté serait une fausse alerte');

    check(pannesConsignees.length > 0, 'les pannes simulées ont bien été consignées dans la console — un échec qui ne laisserait aucune trace serait introuvable');
    check(erreurs.length === 0, `aucune autre erreur JavaScript pendant tout le scénario — ${erreurs.slice(0, 2).join(' | ')}`);
    await navigateur.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
