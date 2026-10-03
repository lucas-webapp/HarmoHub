// Banc du NUAGE DANS HARMOHUB — l'intégration, dans un vrai navigateur, sur un Firebase en mémoire.
//
// CE QU'IL PROTÈGE. Retour utilisateur : « l'enregistrement me semble trop aléatoire sur HarmoHub et
// TabHub, voici ce qu'on va faire : on va connecter tous les documents à mon Firebase, comme c'est déjà
// le cas pour TrainHub [...] Conserve des exports/imports de secours ».
//
// Le MOTEUR (nuage.js) a son banc à lui côté TabHub (nuage_moteur_test.js) : conflits, hors ligne,
// droits refusés, suppression de masse. Celui-ci vérifie ce qui est propre à HarmoHub :
//   • que le moteur est branché sur la BIBLIOTHÈQUE (saveSongs), et que tout geste qui la change part au
//     nuage — enregistrer, supprimer, importer ;
//   • L'ENREGISTREMENT AUTOMATIQUE du morceau ouvert. Avant, rien n'écrivait le morceau tant qu'on
//     n'appuyait pas sur Enregistrer : c'est la source directe de « trop aléatoire ». Il est réglable, et
//     le quitter (changer de morceau, fermer la page, mettre l'onglet en arrière-plan) le fait partir
//     d'abord ;
//   • un morceau écrit sur un AUTRE appareil arrive dans la liste ; s'il remplace le morceau ouvert, le
//     tampon est rechargé — SAUF si l'on est en train de le modifier ;
//   • les dossiers voyagent, sans jamais en retirer ;
//   • la sauvegarde de secours (celle qui existait : toute la bibliothèque en un fichier) est à portée
//     de la fenêtre Nuage ;
//   • LE BOUTON DE LA BARRE DU HAUT (retour utilisateur : « un bouton à part plus voyant avec mon nom ou Google »),
//     et LE GARDE-FOU (« une confirmation si je commence à travailler alors que je ne suis pas connecté ») :
//     une question à la première modification faite sans être connecté, une fois par séance, sans activer un
//     bouton par mégarde, la fenêtre Google ouverte dans le clic, jamais à quelqu'un qui est connecté ;
//   • sans Firebase, HarmoHub fonctionne exactement comme avant.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('nuage dans HarmoHub');

plan(100);

const attendre = (ms) => new Promise(r => setTimeout(r, ms));
const FAUX = fs.readFileSync(path.join(__dirname, '_firebase_factice.js'), 'utf8');
const branchement = (compte = {}) => `window.__backend = FirebaseFactice.creerBackend(); window.firebase = FirebaseFactice.creerFirebase(window.__backend, ${JSON.stringify({ uid: 'u1', nom: 'Testeur', ...compte })});`;
const IGNORES = /ERR_FAILED|fonts\.|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED|ERR_TUNNEL|ERR_CERT_AUTHORITY_INVALID|tonejs|Failed to load resource|AudioContext was not allowed/;

// Attente d'une condition SANS avaler le délai : s'il est dépassé, le banc le dit (et la vérification qui suit
// échoue) au lieu de passer sous silence — l'erreur que le cliquet de meta_suite_test.js interdit d'aggraver.
function patienter(page, fn, arg, options) {
    return page.waitForFunction(fn, arg, options).catch((e) => {
        console.log('  (délai dépassé en attendant : ' + String(fn).replace(/\s+/g, ' ').slice(0, 100) + ')');
    });
}

async function ouvrir(navigateur, { avecFaux = true, viewport, compte, avant = [], tactile = false } = {}) {
    const contexte = await navigateur.newContext({ viewport: viewport || { width: 1300, height: 950 }, acceptDownloads: true, ...(tactile ? { hasTouch: true, isMobile: true } : {}) });
    if (avecFaux) {
        await contexte.addInitScript({ content: FAUX });
        await contexte.addInitScript({ content: branchement(compte) });
    }
    for (const contenu of avant) await contexte.addInitScript({ content: contenu });
    // Le CDN de Google est COUPÉ dans tous les cas. Avec le faux : sur une machine qui a du réseau, le vrai SDK
    // se chargerait après l'injection et l'écraserait — le banc éprouverait Firebase au lieu de l'application.
    // Sans le faux : le scénario « sans Firebase » éprouve l'absence du SDK, pas celle du réseau.
    await contexte.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
    const page = await contexte.newPage();
    const erreurs = [];
    page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
    page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !IGNORES.test(m.text())) erreurs.push('console: ' + m.text()); });
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.app, null, { timeout: 15000 });
    await page.waitForTimeout(700);
    return { page, erreurs, contexte };
}

const cle = (id) => 'users/u1/apps/harmohub__' + id.replace(/[^A-Za-z0-9_-]/g, '-');
const INDEX = 'users/u1/apps/harmohub';

(async () => {
    const navigateur = await chromium.launch();
    try {
        // ===== 0. GARDE STRUCTURELLE : UNE SEULE PORTE POUR « LE MORCEAU A CHANGÉ » ==================
        // Vingt-trois gestes posaient le drapeau à la main. S'il en reste un, ou qu'un futur en ajoute un,
        // il modifiera le morceau SANS programmer l'enregistrement automatique : c'est exactement le
        // défaut d'origine (« trop aléatoire »), réintroduit en silence.
        const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
        const poses = (source.match(/hasUnsavedChanges = true;/g) || []).length;
        check(poses === 1, `le drapeau « modifié » n'est posé qu'à UN seul endroit, marquerModifie() (${poses} trouvé${poses > 1 ? 's' : ''})`);

        // ===== A. LE CHEMIN COMPLET, UN APPAREIL ====================================================
        const A = await ouvrir(navigateur);
        const p = A.page;
        const dansLeNuage = (id) => p.evaluate((c) => window.__backend.docs[c] ? JSON.parse(window.__backend.docs[c].json) : null, cle(id));
        const pastille = () => p.evaluate(() => {
            const b = document.getElementById('open-cloud');
            return { visible: !b.hidden, etat: b.dataset.etat, point: b.dataset.point, libelle: b.querySelector('.cloud-libelle').textContent, titre: b.title };
        });
        const attendrePastille = (c, ms = 6000) => p.waitForFunction((x) => document.getElementById('open-cloud').dataset.point === x, c, { timeout: ms }).then(() => true, () => false);

        // --- le bouton du nuage, dans la barre du haut -------------------------------------------------
        let b0 = await pastille();
        check(b0.visible && b0.etat === 'deconnecte' && b0.libelle === 'Se connecter' && b0.point === '',
            'pas connecté : le bouton de la barre du haut dit « Se connecter », sans pastille d\'état (rien à signaler tant qu\'il n\'y a rien de relié)');
        // UN SEUL CLIC : déconnecté, le bouton ouvre Google tout de suite, sans fenêtre intermédiaire.
        await p.click('#open-cloud');
        check(await attendrePastille('synced'), 'un clic sur « Se connecter » ouvre Google, et connecté la pastille passe à « synchronisé »');
        check(await p.evaluate(() => document.getElementById('cloud-overlay').hidden), 'sans passer par une fenêtre : un seul clic suffit');
        b0 = await pastille();
        check(b0.etat === 'connecte' && b0.libelle === 'Testeur' && /tout est enregistré/.test(b0.titre), 'le bouton montre alors le prénom, et son infobulle dit que tout est enregistré');
        // Connecté, le même bouton ouvre la fenêtre du compte.
        await p.click('#open-cloud');
        const ouverte = await p.evaluate(() => !document.getElementById('cloud-overlay').hidden);
        exiger(ouverte, 'connecté, le bouton de la barre du haut ouvre la fenêtre « Nuage et sauvegarde »');
        const compte = await p.evaluate(() => ({ nom: document.getElementById('cloud-name').textContent, sortir: !document.getElementById('cloud-signout').hidden, entrer: !document.getElementById('cloud-signin').hidden }));
        check(compte.nom === 'Testeur' && compte.sortir && !compte.entrer, 'la fenêtre montre le compte et propose de se déconnecter');
        // Se déconnecter depuis la fenêtre : le bouton redevient « Se connecter », la fenêtre propose de se reconnecter.
        await p.click('#cloud-signout');
        await p.waitForFunction(() => document.getElementById('open-cloud').dataset.etat === 'deconnecte', null, { timeout: 4000 });
        const apresSortie = await p.evaluate(() => ({ note: document.getElementById('cloud-note').textContent, entrer: !document.getElementById('cloud-signin').hidden, libelle: document.querySelector('#open-cloud .cloud-libelle').textContent }));
        check(apresSortie.entrer && apresSortie.libelle === 'Se connecter' && /Connecte-toi/.test(apresSortie.note), 'déconnecté depuis la fenêtre : le bouton redit « Se connecter », et la fenêtre propose de se reconnecter en expliquant pourquoi');
        await p.click('#cloud-signin');
        check(await attendrePastille('synced'), 'se reconnecter depuis la fenêtre marche aussi');
        await p.click('#cloud-close');
        // L'enregistrement automatique est une PRÉFÉRENCE : dans les Paramètres, activé par défaut.
        await p.evaluate(() => window.app.openSettings());
        const reglage = await p.evaluate(() => ({ actif: document.getElementById('toggle-autosave')?.getAttribute('aria-checked'), groupes: [...document.querySelectorAll('.settings-group-title')].map(h => h.textContent) }));
        check(reglage.actif === 'true' && reglage.groupes.includes('Enregistrement'), 'l\'enregistrement automatique est ACTIVÉ par défaut, et se règle dans les Paramètres (groupe « Enregistrement »)');
        await p.click('#settings-close');
        // Comme toutes les autres fenêtres, Échap la ferme. Sans cela elle reste ouverte derrière un banc qui
        // balaie les boutons (sortie_edition_involontaire_test) : tout ce qui suit est masqué, et son verdict
        // « aucun contrôle ne fait sortir de l'édition » ne prouve plus rien — il saute ces clics en silence.
        await p.click('#open-cloud');
        await p.keyboard.press('Escape');
        const apresEchap = await p.evaluate(() => ({ cachee: document.getElementById('cloud-overlay').hidden, verrou: document.body.classList.contains('body-scroll-locked') }));
        check(apresEchap.cachee && !apresEchap.verrou, 'Échap ferme la fenêtre Nuage, comme les autres, et rend le défilement à la page');

        // --- un morceau créé part dans le nuage -----------------------------------------------------
        const id = await p.evaluate(() => window.app.createNewSongFromCurrentState('Ballade test').id);
        check(await attendrePastille('syncing', 1500), 'créer un morceau : la pastille passe à « en cours »');
        check(await attendrePastille('synced'), '…puis revient à « synchronisé »');
        const envoye = await dansLeNuage(id);
        check(envoye && envoye.name === 'Ballade test', 'le morceau est DANS le nuage, sous son nom');
        const entree = await p.evaluate((i) => window.__backend.docs['users/u1/apps/harmohub'].docs[i.replace(/[^A-Za-z0-9_-]/g, '-')], id);
        check(entree && entree.d === false && entree.t === 'Ballade test', 'et l\'index le liste, non supprimé');

        // --- ENREGISTREMENT AUTOMATIQUE -------------------------------------------------------------
        await p.evaluate(() => { saveProgressionSections([{ title: 'Couplet', chords: [window.app.buildChordData({ root: 'C', quality: 'maj' }, 4, 'block')] }]); });
        const dirty1 = await p.evaluate(() => hasUnsavedChanges);
        check(dirty1 === true, 'modifier le morceau ouvert le marque modifié');
        await attendre(2000);
        const apresAuto = await p.evaluate(() => ({ dirty: hasUnsavedChanges, titre: loadSongs()[0].sections[0].title }));
        check(apresAuto.dirty === false && apresAuto.titre === 'Couplet',
            'sans rien faire, 1,5 s plus tard le morceau est ENREGISTRÉ (plus de « modifications non enregistrées »)');
        await attendre(2400);
        const dansNuage2 = await dansLeNuage(id);
        check(dansNuage2 && dansNuage2.sections[0].title === 'Couplet', 'et la modification est partie dans le nuage, sans aucun geste');

        // Des modifications rapprochées = UN enregistrement (la frappe n'écrit pas à chaque lettre)
        const ecr0 = await p.evaluate(() => window.__backend.ecritures);
        await p.evaluate(async () => {
            for (let i = 0; i < 6; i++) { saveProgressionSections([{ title: 'Couplet ' + i, chords: [window.app.buildChordData({ root: 'C', quality: 'maj' }, 4, 'block')] }]); await new Promise(r => setTimeout(r, 150)); }
        });
        await attendre(5000);
        const ecr1 = await p.evaluate(() => window.__backend.ecritures);
        check(ecr1 - ecr0 === 2, `six modifications en moins d'une seconde partent en UN envoi (document + index = 2 écritures, ${ecr1 - ecr0} constatées)`);
        check((await dansLeNuage(id)).sections[0].title === 'Couplet 5', 'avec la dernière version');

        // Changer de morceau juste après une modification : elle n'est pas perdue, et rien n'est demandé
        const idDeux = await p.evaluate(() => { const s = window.app.createNewSongFromCurrentState('Second'); return s.id; });
        await p.evaluate((i) => { window.app.loadSong(i); }, id);
        await p.evaluate(() => { saveProgressionSections([{ title: 'Modifié à la dernière seconde', chords: [window.app.buildChordData({ root: 'D', quality: 'maj' }, 4, 'block')] }]); });
        const question = await p.evaluate(async () => {
            const r = await Promise.race([window.app.confirmDiscardUnsavedIfNeeded(), new Promise(res => setTimeout(() => res('DIALOGUE'), 400))]);
            return r;
        });
        const sauve = await p.evaluate((i) => loadSongs().find(s => s.id === i).sections[0].title, id);
        check(question === true && sauve === 'Modifié à la dernière seconde',
            'changer de morceau AVANT le délai : la modification est enregistrée d\'abord, et on ne demande pas « enregistrer ? » pour ce qui s\'enregistrait déjà');

        // --- LE RÉGLAGE : on peut revenir à l'enregistrement explicite --------------------------------
        await p.evaluate(() => { window.app.openSettings(); });
        await p.click('#toggle-autosave');
        check(await p.evaluate(() => localStorage.getItem('harmohubAutoSave')) === '0' && await p.evaluate(() => document.getElementById('toggle-autosave').getAttribute('aria-checked')) === 'false',
            'éteindre l\'option dans les Paramètres la mémorise');
        await p.click('#settings-close');
        await p.evaluate(() => { saveProgressionSections([{ title: 'Non enregistré', chords: [window.app.buildChordData({ root: 'E', quality: 'maj' }, 4, 'block')] }]); });
        await attendre(2200);
        const explicite = await p.evaluate((i) => ({ dirty: hasUnsavedChanges, enBiblio: loadSongs().find(s => s.id === i).sections[0].title }), id);
        check(explicite.dirty === true && explicite.enBiblio !== 'Non enregistré', 'désactivé : rien ne s\'enregistre tout seul, comme avant (il faut Enregistrer)');
        await p.evaluate(() => { window.app.saveCurrentSong(); });
        check(await p.evaluate((i) => loadSongs().find(s => s.id === i).sections[0].title, id) === 'Non enregistré', 'et le bouton Enregistrer marche toujours');
        await p.evaluate(() => localStorage.removeItem('harmohubAutoSave'));

        // --- LA FERMETURE DE LA PAGE -------------------------------------------------------------------
        const fermeture = () => p.evaluate(() => { const ev = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(ev); return ev.defaultPrevented; });
        await p.evaluate(() => { saveProgressionSections([{ title: 'À la fermeture', chords: [window.app.buildChordData({ root: 'F', quality: 'maj' }, 4, 'block')] }]); });
        const prevenu = await fermeture();
        check(await p.evaluate((i) => loadSongs().find(s => s.id === i).sections[0].title, id) === 'À la fermeture' && await p.evaluate(() => hasUnsavedChanges) === false,
            'fermer la page 0,1 s après une modification : elle est enregistrée au passage dans la bibliothèque (plus de « modifications non enregistrées »)');
        check(prevenu === true, 'le navigateur prévient tout de même, parce que l\'ENVOI au nuage n\'est pas encore parti — la copie des autres appareils n\'est pas à jour');
        await attendrePastille('synced', 6000);
        check((await fermeture()) === false, 'une fois tout envoyé : fermer la page ne demande plus rien');
        const enAttente = await p.evaluate(() => { window.app.nuage.enAttente = () => true; const ev = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(ev); return ev.defaultPrevented; });
        check(enAttente === true, 'un envoi au nuage en cours ou en échec RETIENT la fermeture');
        await p.evaluate(() => { delete window.app.nuage.enAttente; });

        // --- UN AUTRE APPAREIL ÉCRIT DES MORCEAUX ------------------------------------------------------
        await p.evaluate(() => {
            const doc = (id, name, folder) => {
                const s = { id, name, savedAt: Date.now() + 10, folder: folder || null, root: 'G', mode: 'major', timeSig: '4/4', groove: 'straight', bpm: 100, sections: [{ title: 'Venu du téléphone', chords: [] }] };
                const c = id.replace(/[^A-Za-z0-9_-]/g, '-'); const u = Date.now() + 10;
                window.__backend.docs['users/u1/apps/harmohub__' + c] = { id, t: name, u, json: JSON.stringify(s) };
                window.__backend.docs['users/u1/apps/harmohub'].docs[c] = { t: name, u, i: id, d: false };
            };
            doc('song_tel1', 'Riff du téléphone', 'Mes idées');
            doc('song_tel2', 'Autre idée', null);
            window.__backend.docs['users/u1/apps/harmohub'].meta = { dossiers: ['Mes idées', 'Répertoire'] };
            window.__backend.notifier('users/u1/apps/harmohub');
        });
        await patienter(p, () => loadSongs().some(s => s.id === 'song_tel1') && loadSongs().some(s => s.id === 'song_tel2'), null, { timeout: 5000 });
        const recus = await p.evaluate(() => ({ noms: loadSongs().map(s => s.name), dossiers: loadFolders(), liste: [...document.querySelectorAll('#song-select option')].map(o => o.textContent) }));
        check(recus.noms.includes('Riff du téléphone') && recus.noms.includes('Autre idée'), 'les morceaux écrits sur un autre appareil ARRIVENT dans la bibliothèque');
        check(recus.liste.some(t => /Riff du téléphone/.test(t)), 'et dans la liste déroulante des morceaux (l\'interface est rafraîchie)');
        check(recus.dossiers.includes('Mes idées') && recus.dossiers.includes('Répertoire'), 'les dossiers voyagent aussi');
        await attendre(2200);
        const ecrEcho = await p.evaluate(() => window.__backend.ecritures);
        await attendre(2200);
        check((await p.evaluate(() => window.__backend.ecritures)) === ecrEcho, 'recevoir ne renvoie rien (pas d\'écho)');

        // --- mise à jour distante du morceau OUVERT ------------------------------------------------------
        await p.evaluate(() => { window.app.loadSong('song_tel1'); });
        await p.evaluate(() => {
            const c = 'song_tel1'; const s = JSON.parse(window.__backend.docs['users/u1/apps/harmohub__' + c].json);
            s.sections = [{ title: 'Retravaillé ailleurs', chords: [] }]; s.savedAt = Date.now() + 100;
            const u = Date.now() + 100;
            window.__backend.docs['users/u1/apps/harmohub__' + c] = { id: c, t: s.name, u, json: JSON.stringify(s) };
            window.__backend.docs['users/u1/apps/harmohub'].docs[c] = { t: s.name, u, i: c, d: false };
            window.__backend.notifier('users/u1/apps/harmohub');
        });
        await patienter(p, () => loadProgressionSections()[0].title === 'Retravaillé ailleurs', null, { timeout: 5000 });
        check(await p.evaluate(() => loadProgressionSections()[0].title) === 'Retravaillé ailleurs',
            'le morceau OUVERT mis à jour ailleurs est rechargé dans le tampon de travail');

        // ... mais pas sous les doigts
        await p.evaluate(() => { window.app.nuage.arreter && 0; saveProgressionSections([{ title: 'En cours de frappe', chords: [] }]); window.app.enregistrerAuto = () => {}; });
        await p.evaluate(() => {
            const c = 'song_tel1'; const s = JSON.parse(window.__backend.docs['users/u1/apps/harmohub__' + c].json);
            s.sections = [{ title: 'Encore ailleurs', chords: [] }]; s.savedAt = Date.now() + 500;
            const u = Date.now() + 500;
            window.__backend.docs['users/u1/apps/harmohub__' + c] = { id: c, t: s.name, u, json: JSON.stringify(s) };
            window.__backend.docs['users/u1/apps/harmohub'].docs[c] = { t: s.name, u, i: c, d: false };
            window.__backend.notifier('users/u1/apps/harmohub');
        });
        await attendre(800);
        check(await p.evaluate(() => loadProgressionSections()[0].title) === 'En cours de frappe',
            'mais un morceau qu\'on est EN TRAIN de modifier n\'est pas remplacé en douce');
        // CE QUE LA GARDE PROTÈGE VRAIMENT : la version de l'AUTRE appareil. Sans elle, la bibliothèque est
        // remplacée sous les doigts, puis l'enregistrement du tampon l'écrase — et ce que l'autre appareil
        // avait écrit disparaît, sans copie, sans un mot. Avec elle, le conflit est traité au grand jour.
        await p.evaluate(() => { delete window.app.enregistrerAuto; window.app.enregistrerAuto(); });
        await attendre(3500);
        const apresConflit = await p.evaluate(() => ({
            titres: loadSongs().map(s => (s.sections[0] || {}).title),
            cloud: JSON.parse(window.__backend.docs['users/u1/apps/harmohub__song_tel1'].json).sections[0].title,
        }));
        check(apresConflit.titres.includes('Encore ailleurs'),
            'quand on finit par enregistrer, la version de l\'autre appareil N\'EST PAS PERDUE : elle est gardée en copie (conflit traité, pas écrasé)');
        check(apresConflit.cloud === 'En cours de frappe', 'et la version qu\'on vient d\'écrire (la plus récente) est celle du nuage');
        await p.evaluate(() => { hasUnsavedChanges = false; });

        // --- SUPPRESSION --------------------------------------------------------------------------------
        await p.evaluate(() => { saveSongs(loadSongs().filter(s => s.id !== 'song_tel2')); if (getCurrentSongId() === 'song_tel2') setCurrentSongId(null); });
        await patienter(p, () => window.__backend.docs['users/u1/apps/harmohub'].docs['song_tel2'].d === true, null, { timeout: 5000 });
        const supp = await p.evaluate(() => ({ d: window.__backend.docs['users/u1/apps/harmohub'].docs['song_tel2'].d, reste: !!window.__backend.docs['users/u1/apps/harmohub__song_tel2'] }));
        check(supp.d === true && supp.reste, 'supprimer un morceau le marque supprimé dans le nuage, dont le CONTENU reste (une erreur se rattrape)');

        await p.evaluate(() => {
            const c = 'song_tel1'; window.__backend.docs['users/u1/apps/harmohub'].docs[c] = { t: 'Riff du téléphone', u: Date.now() + 9000, i: c, d: true };
            window.__backend.notifier('users/u1/apps/harmohub');
        });
        await patienter(p, () => !loadSongs().some(s => s.id === 'song_tel1'), null, { timeout: 5000 });
        check(await p.evaluate(() => !loadSongs().some(s => s.id === 'song_tel1')), 'un morceau supprimé depuis un autre appareil disparaît ici');
        check(await p.evaluate(() => window.app.nuage.secours().some(e => e.id === 'song_tel1')), 'avec une copie de secours gardée sur cet appareil');

        // --- SUPPRESSION DE MASSE REFUSÉE ----------------------------------------------------------------
        await p.evaluate(async () => { for (let i = 0; i < 5; i++) window.app.createNewSongFromCurrentState('Lot ' + i); });
        await attendrePastille('syncing', 1000);
        await attendrePastille('synced', 8000);
        await p.evaluate(() => { localStorage.setItem('harmohubSongs', '[]'); saveSongs([]); });
        await attendre(2500);
        const masse = await p.evaluate(() => ({
            tombes: Object.values(window.__backend.docs['users/u1/apps/harmohub'].docs).filter(e => e.d === true && /^Lot /.test(e.t)).length,
            etat: window.app.nuage.etat().mode, msg: window.app.nuage.etat().message,
        }));
        check(masse.tombes === 0, 'la bibliothèque vidée d\'un coup (stockage effacé, bogue) ne supprime RIEN dans le nuage');
        check(masse.etat === 'error' && /massive/.test(masse.msg), 'et la pastille le dit en rouge, avec la raison');
        await patienter(p, () => loadSongs().filter(s => /^Lot /.test(s.name)).length === 5, null, { timeout: 6000 });
        check(await p.evaluate(() => loadSongs().filter(s => /^Lot /.test(s.name)).length) === 5, 'les morceaux reviennent depuis le nuage');

        // --- LA SAUVEGARDE DE SECOURS --------------------------------------------------------------------
        await p.evaluate(() => { window.app.openCloudWindow(); window.__exportAppele = 0; const v = window.app.exportLibrary; window.app.exportLibrary = function () { window.__exportAppele++; return v.apply(this, arguments); }; });
        const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), p.click('#cloud-export')]);
        check(await p.evaluate(() => window.__exportAppele) === 1, '« Tout exporter » de la fenêtre Nuage lance l\'export de toute la bibliothèque existant');
        const contenu = dl ? JSON.parse(fs.readFileSync(await dl.path(), 'utf8')) : null;
        check(!!dl && contenu && JSON.stringify(contenu).includes('Ballade test'), 'le fichier téléchargé contient les morceaux');
        const fichierImport = path.join(require('os').tmpdir(), 'harmohub-import-nuage.json');
        fs.writeFileSync(fichierImport, JSON.stringify(contenu));
        const nAvantImport = await p.evaluate(() => loadSongs().length);
        const [choix] = await Promise.all([p.waitForEvent('filechooser', { timeout: 4000 }), p.click('#cloud-import')]);
        await choix.setFiles(fichierImport);
        await attendre(1500);
        check(await p.evaluate(() => loadSongs().length) >= nAvantImport - 0, '« Tout importer » relit la sauvegarde sans rien perdre');
        const attendues = A.erreurs.filter(e => /suppression refusée/.test(e));
        check(attendues.length >= 1, 'le refus de suppression massive est aussi journalisé en console (de quoi comprendre après coup)');
        const inattendues = A.erreurs.filter(e => !/suppression refusée/.test(e));
        check(inattendues.length === 0, `aucune AUTRE erreur JavaScript pendant le parcours (${inattendues.length}) ${inattendues.slice(0, 2).join(' | ')}`);
        await A.contexte.close();

        // ===== B. IMPORT DE BIBLIOTHÈQUE -> NUAGE ====================================================
        const B = await ouvrir(navigateur);
        await B.page.evaluate(() => { window.app.openCloudWindow(); document.getElementById('cloud-signin').click(); });
        await B.page.waitForFunction(() => document.getElementById('open-cloud').dataset.point === 'synced', null, { timeout: 6000 });
        await B.page.evaluate(() => { window.app.closeCloudWindow(); });
        const fichierBiblio = path.join(require('os').tmpdir(), 'harmohub-biblio.json');
        // Le format que lit importLibraryFile : `{ songs: [...] }` (voir script.js).
        fs.writeFileSync(fichierBiblio, JSON.stringify({ songs: [1, 2, 3].map(i => ({
            id: 'song_imp' + i, name: 'Importé ' + i, savedAt: 1000 + i, sections: [{ title: 'S', chords: [] }],
            root: 'C', mode: 'major', timeSig: '4/4', groove: 'straight', bpm: 90 })) }));
        const [choixB] = await Promise.all([B.page.waitForEvent('filechooser', { timeout: 4000 }), B.page.evaluate(() => { window.app.openCloudWindow(); document.getElementById('cloud-import').click(); })]);
        await choixB.setFiles(fichierBiblio);
        await patienter(B.page, () => { const d = window.__backend.docs['users/u1/apps/harmohub'].docs; return d && Object.keys(d).filter(k => /imp/.test(k)).length >= 3; }, null, { timeout: 9000 });
        const importes = await B.page.evaluate(() => Object.values(window.__backend.docs['users/u1/apps/harmohub'].docs || {}).filter(e => /^Importé/.test(e.t)).length);
        check(importes === 3, `une bibliothèque importée par le bouton de la fenêtre Nuage part AUSSI dans le nuage (${importes} morceaux sur 3)`);
        check(B.erreurs.length === 0, `aucune erreur JavaScript à l'import (${B.erreurs.length}) ${B.erreurs.slice(0, 2).join(' | ')}`);
        await B.contexte.close();

        // ===== C. SANS FIREBASE : RIEN NE CHANGE =======================================================
        const C = await ouvrir(navigateur, { avecFaux: false });
        const sans = await C.page.evaluate(async () => {
            window.app.openCloudWindow();
            const s = window.app.createNewSongFromCurrentState('Hors nuage');
            saveProgressionSections([{ title: 'Local', chords: [window.app.buildChordData({ root: 'C', quality: 'maj' }, 4, 'block')] }]);
            await new Promise(r => setTimeout(r, 2000));
            return {
                note: document.getElementById('cloud-note').textContent,
                bouton: document.getElementById('open-cloud').dataset.etat + '/' + document.querySelector('#open-cloud .cloud-libelle').textContent,
                connexionProposee: !document.getElementById('cloud-signin').hidden,
                dialogue: !document.getElementById('cloud-guard-modal').hidden,
                enBiblio: loadSongs().find(x => x.id === s.id).sections[0].title,
                dirty: hasUnsavedChanges,
                enAttente: window.app.nuage ? window.app.nuage.enAttente() : false,
            };
        });
        check(sans.bouton === 'indisponible/Hors ligne' && /indisponible/.test(sans.note) && !sans.connexionProposee && !sans.enAttente,
            'sans Firebase : le bouton dit « Hors ligne », la fenêtre dit honnêtement ce qui manque (sans proposer de se connecter) et rien n\'est « en attente »');
        check(sans.dialogue === false, 'et AUCUNE question « tu n\'es pas connecté » malgré les modifications : proposer de se connecter quand c\'est impossible n\'aurait aucun sens');
        check(sans.enBiblio === 'Local' && sans.dirty === false, 'et l\'enregistrement automatique local marche quand même (le nuage est un plus, pas une condition)');
        check(C.erreurs.length === 0, `aucune erreur JavaScript sans Firebase (${C.erreurs.length}) ${C.erreurs.slice(0, 2).join(' | ')}`);
        await C.contexte.close();

        // ===== D. LE GARDE-FOU « TU TRAVAILLES SANS ÊTRE CONNECTÉ », DANS UN VRAI NAVIGATEUR =============
        // Le moteur décide QUAND (nuage_moteur_test.js, côté TabHub : le même fichier) ; ici on éprouve ce que
        // l'utilisateur voit et touche : la question, le clavier, les deux boutons, la fenêtre Google.
        const lire = (pg) => pg.evaluate(() => {
            const v = document.getElementById('cloud-guard-modal');
            return {
                ouvert: !v.hidden,
                titre: document.getElementById('cloud-guard-title').textContent,
                boutons: [...v.querySelectorAll('button')].map(b => b.textContent.trim()),
                focusSurBouton: !!(document.activeElement && document.activeElement.closest('#cloud-guard-modal button')),
                focusDansLaBoite: v.contains(document.activeElement),
            };
        });
        const questionOuverte = (pg, ms = 1500) => pg.waitForFunction(() => !document.getElementById('cloud-guard-modal').hidden, null, { timeout: ms }).then(() => true, () => false);
        const sansQuestion = async (pg, ms = 500) => { await attendre(ms); return await pg.evaluate(() => document.getElementById('cloud-guard-modal').hidden); };
        const reponduGarde = (pg) => pg.evaluate(() => window.app.nuage._diagnostic().garde.repondu);
        const compterQuestions = (pg) => pg.evaluate(() => {
            window.__questions = 0; window.__ouvert = false;
            new MutationObserver(() => {
                const v = document.getElementById('cloud-guard-modal');
                if (!v.hidden && !window.__ouvert) { window.__questions++; window.__ouvert = true; }
                if (v.hidden) window.__ouvert = false;
            }).observe(document.getElementById('cloud-guard-modal'), { attributes: true, attributeFilter: ['hidden'] });
        });
        const nbQuestions = (pg) => pg.evaluate(() => window.__questions || 0);
        // Un VRAI geste : l'ajout rapide d'un accord, comme au clavier — pas un appel direct à la porte des modifications.
        const ajouterAccord = async (pg, nom) => { await pg.fill('#quick-add-input', nom); await pg.press('#quick-add-input', 'Control+Enter'); await attendre(250); };
        const nbAccords = (pg) => pg.evaluate(() => loadProgressionSections().reduce((n, sec) => n + (sec.chords || []).length, 0));
        // Note l'évènement en cours au moment où la fenêtre Google est demandée : `window.event` n'existe QUE pendant la
        // distribution d'un évènement. Une demande faite après une attente le trouve vide — et c'est exactement ce que
        // Safari refuse d'ouvrir.
        const espionnerGoogle = (pg) => pg.evaluate(() => {
            const auth = window.firebase.auth();
            const origine = auth.signInWithPopup;
            window.__googleDemande = [];
            auth.signInWithPopup = function () { window.__googleDemande.push(window.event ? window.event.type : null); return origine.apply(this, arguments); };
        });
        const message = (pg) => pg.evaluate(() => (document.getElementById('toast') || {}).textContent || '');

        // --- D1. Ouvrir, regarder : ce n'est pas travailler -----------------------------------------------------
        {
            const D = await ouvrir(navigateur);
            const pg = D.page;
            await compterQuestions(pg);
            await attendre(700);
            check(await sansQuestion(pg, 100), 'ouvrir l\'application sans rien toucher : aucune question (celui qui vient seulement lire ou écouter n\'est pas interrompu)');
            await pg.evaluate(() => window.app.openSettings()); await pg.click('#settings-close');
            check(await sansQuestion(pg, 400), 'ouvrir les Paramètres n\'est pas travailler non plus');
            // Charger un morceau de la bibliothèque réécrit le tampon de travail, mais ne modifie rien. Le morceau est
            // posé directement dans le stockage : passer par saveSongs() serait déjà « travailler ».
            await pg.evaluate(() => {
                localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 'song_a', name: 'Ancien', savedAt: 1, root: 'C', mode: 'major', timeSig: '4/4', groove: 'straight', bpm: 90, sections: [{ title: 'S', chords: [] }] }]));
                window.app.loadSong('song_a');
            });
            check(await sansQuestion(pg, 400), 'charger un morceau de la bibliothèque n\'est pas travailler non plus');

            // --- D2. La première vraie modification pose la question -----------------------------------------
            await ajouterAccord(pg, 'Am7');
            exiger(await questionOuverte(pg), 'la première modification (un accord ajouté) pose la question');
            let d = await lire(pg);
            check(d.titre === 'Tu n\'es pas connecté' && d.boutons.join('|') === 'Me connecter avec Google|Continuer sans me connecter',
                `elle dit « ${d.titre} » et propose deux choix : ${d.boutons.join(' / ')}`);
            check((await nbAccords(pg)) === 1, 'et la modification qui l\'a déclenchée est bien appliquée (la question ne la bloque pas, ni ne la perd)');
            check(d.focusDansLaBoite && !d.focusSurBouton,
                'le focus est dans la boîte mais SUR AUCUN BOUTON : la frappe suivante (Entrée, espace) ne peut pas activer un choix avant qu\'on ait lu');
            // Un accord SÉLECTIONNÉ, comme après un clic : c'est ce qui donne un effet à Suppr. Sans lui, la grille n'a rien à
            // perdre et le test passerait même si le clavier agissait sous la question (mesuré : sabotage survivant).
            await pg.evaluate(() => { window.app.selectChord(0, 0); });
            for (const touche of ['Enter', 'Space', 'Delete', 'Backspace', 'ArrowRight', 'a']) await pg.keyboard.press(touche);
            await attendre(250);
            check((await lire(pg)).ouvert && (await nbAccords(pg)) === 1 && (await pg.evaluate(() => window.firebase.auth()._appelsConnexion)) === 0,
                'Entrée, espace, Suppr, flèche, une lettre pendant que la question est à l\'écran, avec un accord sélectionné : elle reste ouverte, aucune connexion lancée, et l\'accord caché derrière n\'est PAS effacé');

            // --- D3. Échap vaut « continuer » : la question ne revient pas ----------------------------------------
            await pg.keyboard.press('Escape');
            check(await sansQuestion(pg, 150), 'Échap referme la question');
            check((await reponduGarde(pg)) === true, 'et vaut « continuer sans me connecter »');
            await ajouterAccord(pg, 'F'); await ajouterAccord(pg, 'G');
            check(await sansQuestion(pg, 500) && (await nbQuestions(pg)) === 1, 'les modifications suivantes ne posent plus la question (une seule pour toute la séance)');
            check(D.erreurs.length === 0, `aucune erreur JavaScript (${D.erreurs.length}) ${D.erreurs.slice(0, 2).join(' | ')}`);
            await D.contexte.close();
        }

        // --- D4. « Me connecter avec Google » : la fenêtre Google s'ouvre DANS le clic ---------------------------
        {
            const D = await ouvrir(navigateur, { compte: { nom: 'Lucas Martin' } });
            const pg = D.page;
            await espionnerGoogle(pg);
            await ajouterAccord(pg, 'C');
            exiger(await questionOuverte(pg), 'préalable : la question est posée');
            await pg.click('#cloud-guard-signin');
            const demandes = await pg.evaluate(() => window.__googleDemande);
            check(demandes.length === 1 && demandes[0] === 'click',
                `la fenêtre Google est demandée DANS le clic (évènement en cours : ${JSON.stringify(demandes)}) — pas après une attente, que Safari refuserait`);
            check(await pg.waitForFunction(() => document.getElementById('open-cloud').dataset.etat === 'connecte', null, { timeout: 4000 }).then(() => true, () => false),
                'puis on est connecté : le bouton de la barre du haut montre le prénom');
            check(await sansQuestion(pg, 100), 'et la question est refermée');
            await ajouterAccord(pg, 'Dm');
            check(await sansQuestion(pg, 500), 'connecté, les modifications suivantes ne posent plus aucune question');
            await D.contexte.close();
        }

        // --- D5. Le bouton de la barre du haut lance Google lui aussi dans le clic ---------------------------------------
        {
            const D = await ouvrir(navigateur);
            const pg = D.page;
            await espionnerGoogle(pg);
            await pg.click('#open-cloud');
            const demandes = await pg.evaluate(() => window.__googleDemande);
            check(demandes.length === 1 && demandes[0] === 'click', `le bouton « Se connecter » demande la fenêtre Google dans le clic (${JSON.stringify(demandes)})`);
            await D.contexte.close();
        }

        // --- D6. Google refermé sans se connecter : pas d'erreur affichée, et la question revient -------------------------
        {
            const D = await ouvrir(navigateur);
            const pg = D.page;
            await compterQuestions(pg);
            await pg.evaluate(() => { window.firebase.auth()._echecConnexion = { code: 'auth/popup-closed-by-user', message: 'Firebase: Error (auth/popup-closed-by-user).' }; });
            await ajouterAccord(pg, 'C');
            exiger(await questionOuverte(pg), 'préalable : la question est posée');
            await pg.click('#cloud-guard-signin');
            await attendre(400);
            const msg = await message(pg);
            check(!/Connexion impossible|popup/.test(msg), `refermer la fenêtre Google n'est pas une erreur : aucun message (« ${msg} »)`);
            check((await pg.evaluate(() => document.getElementById('open-cloud').dataset.etat)) === 'deconnecte', 'on reste déconnecté, et le bouton continue de proposer « Se connecter »');
            await ajouterAccord(pg, 'G');
            check(await questionOuverte(pg) && (await nbQuestions(pg)) === 2, 'la modification suivante REDEMANDE : il avait dit vouloir se connecter, ce n\'est pas fait');
            await pg.keyboard.press('Escape');
            await D.contexte.close();
        }

        // --- D7. Fenêtre bloquée par le navigateur : on le dit, et comment s'en sortir ----------------------------------
        {
            const D = await ouvrir(navigateur);
            const pg = D.page;
            await pg.evaluate(() => { window.firebase.auth()._echecConnexion = { code: 'auth/popup-blocked', message: 'bloqué' }; });
            await pg.click('#open-cloud');
            await attendre(300);
            const msg = await message(pg);
            check(/bloqué la fenêtre de connexion/.test(msg) && /autorise/.test(msg), `fenêtre bloquée : le message dit pourquoi et quoi faire (« ${msg} »)`);
            await D.contexte.close();
        }

        // --- D8. Connecté AILLEURS pendant que la question est à l'écran : elle disparaît d'elle-même ------------------
        {
            const D = await ouvrir(navigateur, { compte: { nom: 'Lucas Martin' } });
            const pg = D.page;
            await compterQuestions(pg);
            await ajouterAccord(pg, 'E');
            exiger(await questionOuverte(pg), 'préalable : la question est posée');
            await pg.evaluate(() => window.firebase.auth()._connecter());   // un autre onglet vient de se connecter
            check(await pg.waitForFunction(() => document.getElementById('cloud-guard-modal').hidden, null, { timeout: 3000 }).then(() => true, () => false),
                'connecté depuis un autre onglet pendant que la question est à l\'écran : elle se referme toute seule (elle n\'a plus d\'objet)');
            await pg.evaluate(() => window.app.nuage.deconnecter());
            await attendre(300);
            await ajouterAccord(pg, 'A');
            check(await questionOuverte(pg) && (await nbQuestions(pg)) === 2, 'puis déconnecté : la modification suivante redemande (la fermeture automatique n\'a pas compté comme une réponse)');
            await pg.keyboard.press('Escape');
            await D.contexte.close();
        }

        // --- D9. Un clic à côté vaut « continuer » ----------------------------------------------------------------------
        {
            const D = await ouvrir(navigateur);
            const pg = D.page;
            await ajouterAccord(pg, 'B');
            exiger(await questionOuverte(pg), 'préalable : la question est posée');
            await pg.mouse.click(5, 5);   // dans le voile, hors de la boîte
            check(await sansQuestion(pg, 150) && (await reponduGarde(pg)) === true, 'un clic à côté referme la question et vaut « continuer »');
            await D.contexte.close();
        }

        // --- D10. Firebase n'a pas encore répondu : on ne le sait pas, on ne demande pas -----------------------------------
        {
            // Une session est restaurée, mais Firebase met 700 ms à le dire : c'est le piège du garde-fou naïf.
            const D = await ouvrir(navigateur, { compte: { nom: 'Lucas Martin', dejaConnecte: true, authApres: 2500 } });
            const pg = D.page;
            await ajouterAccord(pg, 'C');
            exiger(await pg.evaluate(() => window.app.nuage.etat().authConnue === false), 'préalable : Firebase n\'a PAS encore répondu au moment de la modification (sans quoi ce scénario n\'éprouverait rien)');
            check(await sansQuestion(pg, 100), 'Firebase n\'a pas encore répondu : aucune question (on ne sait pas encore si l\'utilisateur est connecté)');
            await pg.waitForFunction(() => document.getElementById('open-cloud').dataset.etat === 'connecte', null, { timeout: 4000 });
            check(await sansQuestion(pg, 400), 'il répond « connecté » (session restaurée) : la question ne vient JAMAIS — on ne demande pas de se connecter à quelqu\'un qui l\'est');
            await D.contexte.close();
        }
        {
            // Même retard, mais personne n'est connecté : la question vient, une fois la réponse connue.
            const D = await ouvrir(navigateur, { compte: { nom: 'Lucas Martin', authApres: 2500 } });
            const pg = D.page;
            await ajouterAccord(pg, 'C');
            exiger(await pg.evaluate(() => window.app.nuage.etat().authConnue === false), 'préalable : Firebase n\'a PAS encore répondu au moment de la modification');
            check(await sansQuestion(pg, 100), 'Firebase tarde, personne n\'est connecté : pas de question tant qu\'il n\'a pas répondu…');
            check(await questionOuverte(pg, 5000), '…elle vient dès qu\'il répond « personne », pour la modification faite entre-temps');
            await pg.keyboard.press('Escape');
            await D.contexte.close();
        }

        // --- D11. Au rechargement, le dernier compte s'affiche tout de suite (pas de « Se connecter » qui clignote) ------
        {
            // Firebase met 2,5 s à répondre : assez pour regarder le bouton AVANT sa réponse.
            const D = await ouvrir(navigateur, { compte: { nom: 'Lucas Martin', dejaConnecte: true, authApres: 2500 } });
            const pg = D.page;
            const etatBouton = () => pg.evaluate(() => { const b = document.getElementById('open-cloud'); return { etat: b.dataset.etat, avatar: b.dataset.avatar, libelle: b.querySelector('.cloud-libelle').textContent }; });
            await pg.waitForFunction(() => document.getElementById('open-cloud').dataset.etat === 'connecte', null, { timeout: 8000 });
            check(JSON.parse(await pg.evaluate(() => localStorage.getItem('nuage.harmohub.compte')) || 'null')?.nom === 'Lucas Martin',
                'connecté : le nom du compte est retenu dans le navigateur (un indice d\'affichage, rien d\'autre)');
            await pg.reload({ waitUntil: 'load' });
            await pg.waitForFunction(() => window.app && window.app.nuage, null, { timeout: 15000 });
            const avant = await etatBouton();
            check(avant.etat === 'inconnu' && avant.libelle === 'Lucas' && avant.avatar === 'initiale',
                `au rechargement, AVANT que Firebase ne réponde, le bouton montre déjà le dernier compte (${avant.etat} / ${avant.libelle}) au lieu d'un « Se connecter » qui clignoterait`);
            await pg.waitForFunction(() => document.getElementById('open-cloud').dataset.etat === 'connecte', null, { timeout: 8000 });
            await pg.evaluate(() => window.app.nuage.deconnecter());
            await pg.waitForFunction(() => document.getElementById('open-cloud').dataset.etat === 'deconnecte', null, { timeout: 4000 });
            check((await pg.evaluate(() => localStorage.getItem('nuage.harmohub.compte'))) === null, 'déconnecté : l\'indice est oublié (le bouton ne montrera plus ce nom au prochain chargement)');
            await D.contexte.close();
        }

        // --- D12. Le script du moteur n'a pas chargé : pas de bouton qui ne mène nulle part ------------------------------
        {
            const D = await ouvrir(navigateur, { avecFaux: false, avant: ["Object.defineProperty(window, 'Nuage', { get() { return undefined; }, set() {} });"] });
            const pg = D.page;
            await ajouterAccord(pg, 'C');
            const r = await pg.evaluate(() => ({ cache: document.getElementById('open-cloud').hidden, question: !document.getElementById('cloud-guard-modal').hidden, moteur: window.app.nuage }));
            check(r.cache && !r.question && r.moteur === null && (await nbAccords(pg)) === 1,
                'sans le moteur (script non chargé) : pas de bouton qui ne mène nulle part, aucune question, et l\'édition marche comme avant');
            check(D.erreurs.length === 0, `et aucune erreur JavaScript (${D.erreurs.length}) ${D.erreurs.slice(0, 2).join(' | ')}`);
            await D.contexte.close();
        }

        // --- D13. Créer un morceau ou un dossier, c'est aussi travailler (la bibliothèque est un document) -----------------
        {
            const D = await ouvrir(navigateur);
            const pg = D.page;
            await pg.evaluate(() => { window.app.createNewSongFromCurrentState('Ballade'); });
            check(await questionOuverte(pg), 'créer un morceau (une écriture dans la bibliothèque) pose la question, comme une modification du morceau ouvert');
            await pg.keyboard.press('Escape');
            await D.contexte.close();
        }
        {
            const D = await ouvrir(navigateur);
            const pg = D.page;
            await pg.evaluate(() => { saveFolders(['Mes idées']); });
            check(await questionOuverte(pg), 'créer un dossier aussi');
            await pg.keyboard.press('Escape');
            await D.contexte.close();
        }

        // ===== E. LE BOUTON DANS LA BARRE DU HAUT : DESSIN ET PLACE ===========================================
        {
            const mesurer = (pg) => pg.evaluate(() => {
                const barre = document.querySelector('.top-bar'); const b = document.getElementById('open-cloud'); const r = b.getBoundingClientRect(); const cs = getComputedStyle(b);
                const visibles = [...barre.children].filter(e => !e.hidden && getComputedStyle(e).display !== 'none').map(e => e.getBoundingClientRect());
                return { largeur: Math.round(r.width), hauteur: Math.round(r.height), libelleVisible: getComputedStyle(b.querySelector('.cloud-libelle')).display !== 'none',
                         affichage: cs.display, rayon: parseFloat(cs.borderTopLeftRadius), minLargeur: cs.minWidth, bordure: cs.borderTopColor,
                         horsEcran: visibles.some(x => x.left < -0.5 || x.right > innerWidth + 0.5) };
            });
            const E = await ouvrir(navigateur, { viewport: { width: 1320, height: 800 } });
            const m1 = await mesurer(E.page);
            // `inline-flex` devient `flex` : un enfant direct d'une barre en flex est « blockifié ».
            check(m1.affichage === 'flex' && m1.rayon > 100 && m1.libelleVisible && m1.largeur < 160,
                `sur ordinateur, le bouton est dessiné par sa règle propre (flex, arrondi, ${m1.largeur}px de large avec son libellé) — la règle générique « button { min-width: 120px } » en aurait fait un rectangle`);
            const bordureDeconnecte = m1.bordure;
            await E.page.click('#open-cloud');
            await E.page.waitForFunction(() => document.getElementById('open-cloud').dataset.etat === 'connecte', null, { timeout: 4000 });
            await attendre(300);   // la bordure s'anime (0,12 s) : on mesure une fois posée
            const m2 = await mesurer(E.page);
            check(m2.bordure !== bordureDeconnecte, `le déconnecté se voit de loin : sa bordure change une fois connecté (${bordureDeconnecte} → ${m2.bordure})`);
            await E.contexte.close();
            for (const largeur of [390, 320]) {
                const T = await ouvrir(navigateur, { viewport: { width: largeur, height: 800 }, tactile: true });
                const a = await mesurer(T.page);
                await T.page.tap('#open-cloud');
                await T.page.waitForFunction(() => document.getElementById('open-cloud').dataset.etat === 'connecte', null, { timeout: 4000 });
                const b = await mesurer(T.page);
                check(!a.horsEcran && !b.horsEcran, `téléphone ${largeur}px : tous les boutons de la barre du haut restent à l'écran, déconnecté comme connecté`);
                check(!a.libelleVisible && a.largeur >= 30 && a.largeur < 50 && a.hauteur >= 30, `et le bouton garde son rond (${a.largeur}×${a.hauteur}px), sans libellé`);
                await T.contexte.close();
            }
        }
    } finally {
        await navigateur.close();
    }
    bilan();
})().catch((e) => { console.error(e); process.exit(1); });
