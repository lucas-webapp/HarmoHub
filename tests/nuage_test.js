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
//   • sans Firebase, HarmoHub fonctionne exactement comme avant.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('nuage dans HarmoHub');

plan(48);

const attendre = (ms) => new Promise(r => setTimeout(r, ms));
const FAUX = fs.readFileSync(path.join(__dirname, '_firebase_factice.js'), 'utf8');
const BRANCHEMENT = "window.__backend = FirebaseFactice.creerBackend(); window.firebase = FirebaseFactice.creerFirebase(window.__backend, { uid: 'u1', nom: 'Testeur' });";
const IGNORES = /ERR_FAILED|fonts\.|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED|ERR_TUNNEL|ERR_CERT_AUTHORITY_INVALID|tonejs|Failed to load resource|AudioContext was not allowed/;

// Attente d'une condition SANS avaler le délai : s'il est dépassé, le banc le dit (et la vérification qui suit
// échoue) au lieu de passer sous silence — l'erreur que le cliquet de meta_suite_test.js interdit d'aggraver.
function patienter(page, fn, arg, options) {
    return page.waitForFunction(fn, arg, options).catch((e) => {
        console.log('  (délai dépassé en attendant : ' + String(fn).replace(/\s+/g, ' ').slice(0, 100) + ')');
    });
}

async function ouvrir(navigateur, { avecFaux = true, viewport } = {}) {
    const contexte = await navigateur.newContext({ viewport: viewport || { width: 1300, height: 950 }, acceptDownloads: true });
    if (avecFaux) {
        await contexte.addInitScript({ content: FAUX });
        await contexte.addInitScript({ content: BRANCHEMENT });
    }
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
        const pastille = () => p.evaluate(() => { const d = document.getElementById('cloud-dot'); return { visible: !d.hidden, cls: [...d.classList] }; });
        const attendrePastille = (c, ms = 6000) => p.waitForFunction((x) => document.getElementById('cloud-dot').classList.contains(x), c, { timeout: ms }).then(() => true, () => false);

        check(!(await pastille()).visible, 'pas connecté : aucune pastille');
        // L'entrée existe dans la barre du haut et ouvre la fenêtre
        await p.click('#open-cloud');
        const ouverte = await p.evaluate(() => !document.getElementById('cloud-overlay').hidden);
        exiger(ouverte, 'le bouton Nuage de la barre du haut ouvre la fenêtre « Nuage et sauvegarde »');
        const avant = await p.evaluate(() => ({
            note: document.getElementById('cloud-note').textContent,
            entrer: !document.getElementById('cloud-signin').hidden, sortir: !document.getElementById('cloud-signout').hidden,
            auto: document.getElementById('cloud-autosave').checked,
        }));
        check(avant.entrer && !avant.sortir && /Connecte-toi/.test(avant.note), 'elle propose de se connecter, et explique pourquoi');
        check(avant.auto === true, 'l\'enregistrement automatique est ACTIVÉ par défaut (c\'est ce qui était demandé)');

        await p.click('#cloud-signin');
        check(await attendrePastille('synced'), 'connecté : la pastille passe à « synchronisé »');
        const compte = await p.evaluate(() => ({ nom: document.getElementById('cloud-name').textContent, sortir: !document.getElementById('cloud-signout').hidden }));
        check(compte.nom === 'Testeur' && compte.sortir, 'la fenêtre montre le compte et propose de se déconnecter');
        await p.click('#cloud-close');

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
        await p.evaluate(() => { window.app.openCloudWindow(); });
        await p.click('#cloud-autosave');
        check(await p.evaluate(() => localStorage.getItem('harmohubAutoSave')) === '0', 'décocher l\'option la mémorise');
        await p.click('#cloud-close');
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
        await B.page.waitForFunction(() => document.getElementById('cloud-dot').classList.contains('synced'), null, { timeout: 6000 });
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
                pastilleCachee: document.getElementById('cloud-dot').hidden,
                enBiblio: loadSongs().find(x => x.id === s.id).sections[0].title,
                dirty: hasUnsavedChanges,
                enAttente: window.app.nuage ? window.app.nuage.enAttente() : false,
            };
        });
        check(sans.pastilleCachee && /indisponible|Connecte-toi/.test(sans.note) && !sans.enAttente,
            'sans Firebase : pas de pastille, la fenêtre dit honnêtement ce qui manque, et rien n\'est « en attente »');
        check(sans.enBiblio === 'Local' && sans.dirty === false, 'et l\'enregistrement automatique local marche quand même (le nuage est un plus, pas une condition)');
        check(C.erreurs.length === 0, `aucune erreur JavaScript sans Firebase (${C.erreurs.length}) ${C.erreurs.slice(0, 2).join(' | ')}`);
        await C.contexte.close();
    } finally {
        await navigateur.close();
    }
    bilan();
})().catch((e) => { console.error(e); process.exit(1); });
