// LES RÉGLAGES AU CLOUD, ET LES PAROLES DANS LES SAUVEGARDES (voir synchro-harmohub.js, et enveloppeSauvegarde dans script.js).
//
// RETOUR UTILISATEUR : « je veux que tout soit stocké en ligne pour retrouver mes données en changeant d'ordinateur. »
//
// CE QUI N'ÉTAIT PAS AU CLOUD, mesuré avant de corriger : les réglages (volume, métronome, affichages, exports PDF, rythme de départ) vivaient
// dans le navigateur — un ordinateur neuf repartait des valeurs d'usine — et les sauvegardes sur disque ne contenaient pas les paroles.
// Les morceaux, la structure et ses commentaires, eux, y étaient déjà : ils font partie du morceau.
//
// CE QUE CE BANC ÉPROUVE, dans l'ordre : (1) un réglage fait avec un VRAI clic dans les Paramètres arrive au cloud ; (2) ce qui décrit l'ÉCRAN
// ou l'APPAREIL (zooms, volet, verre) n'y arrive JAMAIS ; (3) un appareil neuf retrouve les réglages, sans rien refaire ; (4) deux appareils qui
// changent chacun un réglage différent les gardent TOUS LES DEUX (la fusion est par réglage, pas en bloc) ; (5) répéter une valeur n'est pas une
// modification ; (6) les sauvegardes contiennent les paroles, et les restaurer n'écrase jamais une version plus récente.
//
// CE QU'IL NE PEUT PAS ÉPROUVER : les règles de sécurité Firestore ni la vraie fenêtre Google (faux Firebase, voir _firebase_faux.js).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('synchro réglages et sauvegardes');
const estBruitReseau = require('./_harness').estBruitReseau;
const { creerNuage, installer } = require('./_firebase_faux');

plan(42);

const CHEMIN = 'users/u1/apps/harmohub';
const pause = (p, ms) => p.waitForTimeout(ms);
// Ce qui décrit l'écran ou l'appareil : ne doit JAMAIS partir au cloud.
const PAR_APPAREIL = ['harmohubSeqZoomLevelX', 'harmohubClassicGridZoomLevelY', 'harmohubVoiceLeadingZoomLevelX', 'harmohubSeqDockHeight',
    'harmohubSidebarCollapsed', 'harmohubShowPiano', 'harmohubShowGuitar', 'harmohub.glass.v1', 'harmohub.glassBg.v1', 'songSettingsOpen',
    'harmohub_derniere_sauvegarde', 'harmohub_dossier_rangement', 'harmohubCurrentSongId', 'harmohub_lyrics_prefs'];

(async () => {
    const navigateur = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const pannes = [];

    const ouvrir = async (nuage, appareil, { viewport, tactile } = {}) => {
        const ctx = await navigateur.newContext({ viewport: viewport || { width: 1300, height: 900 }, acceptDownloads: true, ...(tactile ? { hasTouch: true, isMobile: true } : {}) });
        await installer(ctx, nuage, { appareil, uid: 'u1', persister: true });
        const p = await ctx.newPage();
        p.on('pageerror', (e) => erreurs.push(`${appareil} pageerror: ${e.message}`));
        p.on('console', (m) => {
            if (m.type() !== 'error' || estBruitReseau(m.text())) return;
            if (/Envoi vers le cloud impossible|Écoute de la synchro interrompue|Synchro initiale impossible/.test(m.text())) { pannes.push(m.text()); return; }
            erreurs.push(`${appareil} console: ${m.text()}`);
        });
        await p.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 20000 });
        await pause(p, 900);
        return { ctx, p, nom: appareil };
    };
    // Se connecte comme l'utilisateur : par la fenêtre d'accueil si elle est là, par la pilule sinon.
    const connecter = async (d, attente = 2200) => {
        if (await d.p.isVisible('#cloud-guard-modal')) await d.p.click('#cloud-guard-connect'); else await d.p.click('#google-signin-btn');
        await pause(d.p, attente);
    };
    const reglagesNuage = (nuage) => { const doc = nuage.docs.get(CHEMIN); return doc ? Object.fromEntries((doc.reglages || []).map(r => [r.k, r])) : null; };
    const local = (d, cle) => d.p.evaluate((c) => localStorage.getItem(c), cle);
    const ouvrirReglages = async (d) => { await d.p.click('#open-settings'); await pause(d.p, 350); };
    const fermerReglages = async (d) => { await d.p.evaluate(() => window.app.closeSettings()); await pause(d.p, 200); };
    const bascule = (d, id) => d.p.getAttribute(id, 'aria-checked');
    const ecritures = (nuage, appareil) => nuage.ecritures.filter(e => e.chemin === CHEMIN && (!appareil || e.appareil === appareil)).length;

    // =========================================================================================
    // A. UN VRAI CLIC DANS LES PARAMÈTRES ARRIVE AU CLOUD
    // =========================================================================================
    const nuage = creerNuage();
    const P = await ouvrir(nuage, 'P');
    await connecter(P);
    check(!!nuage.docs.get(CHEMIN), 'précondition : P est connecté, le document de la bibliothèque existe');
    await ouvrirReglages(P);
    const avantCompte = await bascule(P, '#toggle-metronome-countin');
    await P.p.click('#toggle-metronome-countin');                 // décompte : activé par défaut -> éteint
    await P.p.click('#toggle-show-roman');                        // degrés
    await P.p.locator('#general-volume').focus();
    for (let i = 0; i < 6; i++) await P.p.keyboard.press('ArrowLeft');   // volume général : plus bas
    await pause(P.p, 3000);
    const vP = { compte: await local(P, 'harmohubMetronomeCountIn'), roman: await local(P, 'harmohubShowRomanNumerals'), vol: await local(P, 'harmohubGeneralVolume') };
    check(avantCompte === 'true' && vP.compte === '0', `précondition : le clic a bien éteint le décompte (${avantCompte} -> ${vP.compte})`);
    const r1 = reglagesNuage(nuage);
    check(!!r1 && r1.harmohubMetronomeCountIn && r1.harmohubMetronomeCountIn.v === '0', 'le décompte éteint est au cloud');
    check(!!r1 && r1.harmohubShowRomanNumerals && r1.harmohubShowRomanNumerals.v === vP.roman, `les degrés aussi (${vP.roman})`);
    check(!!r1 && r1.harmohubGeneralVolume && r1.harmohubGeneralVolume.v === vP.vol, `et le volume général, réglé au curseur (${vP.vol})`);
    check(!!r1 && Object.values(r1).every(x => typeof x.v === 'string' && x.t > 1e12), 'chaque réglage porte sa valeur (texte) et sa date de modification');
    await fermerReglages(P);

    // =========================================================================================
    // B. CE QUI DÉCRIT L'ÉCRAN OU L'APPAREIL N'Y ARRIVE JAMAIS
    // =========================================================================================
    await P.p.evaluate((cles) => cles.forEach((c) => localStorage.setItem(c, '42')), PAR_APPAREIL);
    await P.p.evaluate(() => { localStorage.setItem('harmohubMetronomeVolume', '37'); });   // un réglage listé, pour déclencher un envoi
    await pause(P.p, 3000);
    const r2 = reglagesNuage(nuage) || {};
    check(PAR_APPAREIL.every(c => !(c in r2)), `zooms, volet, instruments affichés, verre, repères de sauvegarde : jamais au cloud (${PAR_APPAREIL.filter(c => c in r2)})`);
    check(r2.harmohubMetronomeVolume && r2.harmohubMetronomeVolume.v === '37', 'alors qu\'un réglage listé, lui, est bien parti (preuve que l\'envoi a eu lieu)');
    const srcScript = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
    const listees = await P.p.evaluate(() => REGLAGES_SYNCHRONISES.slice());
    check(listees.length >= 18 && listees.every(c => srcScript.includes(`'${c}'`)), `chaque clé de la liste existe dans script.js (${listees.length} clés) : une faute de frappe ne ferait rien, sans erreur`);
    check(PAR_APPAREIL.every(c => !listees.includes(c)), 'et la liste ne contient aucun réglage d\'écran ou d\'appareil');

    // =========================================================================================
    // C. « CHANGER D'ORDINATEUR » : un appareil neuf retrouve ses réglages
    // =========================================================================================
    const Q = await ouvrir(nuage, 'Q');
    check(await local(Q, 'harmohubMetronomeCountIn') === null, 'précondition : Q est vierge (valeurs d\'usine)');
    const ecrAvantQ = ecritures(nuage, 'Q');
    await Q.p.evaluate(() => { window.__avantRecharge = 1; });
    await connecter(Q, 3500);                                        // reprise -> rechargement UNE fois
    check(await Q.p.evaluate(() => window.__avantRecharge === undefined), 'la reprise recharge la page UNE fois, pour que les réglages prennent effet');
    check(await local(Q, 'harmohubMetronomeCountIn') === '0' && await local(Q, 'harmohubMetronomeVolume') === '37' && await local(Q, 'harmohubGeneralVolume') === vP.vol,
        'Q retrouve les réglages de P, sans rien refaire');
    await ouvrirReglages(Q);
    check(await bascule(Q, '#toggle-metronome-countin') === 'false' && await bascule(Q, '#toggle-show-roman') === (vP.roman === '1' ? 'true' : 'false'),
        'et les Paramètres de Q les montrent (décompte éteint, degrés comme sur P)');
    await fermerReglages(Q);
    check(ecritures(nuage, 'Q') === ecrAvantQ, `Q n'a rien écrit au cloud : reprendre n'est pas modifier (${ecritures(nuage, 'Q') - ecrAvantQ} écriture)`);
    check(await local(Q, 'harmohubSeqZoomLevelX') === null && await local(Q, 'harmohubSidebarCollapsed') === null,
        'et les zooms de P ne sont PAS venus : Q garde son propre écran');
    const tQ = await Q.p.evaluate(() => JSON.parse(localStorage.getItem('harmohub_sync_reglages_t') || '{}'));
    check(tQ.harmohubMetronomeCountIn === r1.harmohubMetronomeCountIn.t, 'la date de chaque réglage voyage avec lui (Q reprend celle de P)');
    check(await Q.p.evaluate(() => sessionStorage.getItem('harmohub_reglages_rechargee')) === '1', 'garde-fou posé : un seul rechargement par ouverture, jamais de boucle');

    // =========================================================================================
    // D. EN DIRECT : P change un réglage, Q (page ouverte) le reçoit sans recharger
    // =========================================================================================
    await Q.p.evaluate(() => { window.__marque = 'ouverte'; });
    await ouvrirReglages(P);
    await P.p.click('#toggle-show-saved-date'); await pause(P.p, 3200);
    await fermerReglages(P);
    const dateP = await local(P, 'harmohubShowSavedDate');
    check(await local(Q, 'harmohubShowSavedDate') === dateP && dateP !== null, `P change un réglage, Q le reçoit en direct (${dateP})`);
    check(await Q.p.evaluate(() => window.__marque) === 'ouverte', 'sans recharger Q : on ne casse pas la page de quelqu\'un qui travaille');
    check(/Réglages mis à jour/.test(await Q.p.textContent('#toast')), 'et Q est prévenu (appliqué à la prochaine ouverture)');

    // =========================================================================================
    // E. DEUX APPAREILS, DEUX RÉGLAGES DIFFÉRENTS : on garde les DEUX
    // =========================================================================================
    nuage.coupe.add('Q');
    await Q.p.evaluate(() => window.dispatchEvent(new Event('offline')));
    await ouvrirReglages(Q);
    await Q.p.locator('#metronome-volume').focus();
    for (let i = 0; i < 3; i++) await Q.p.keyboard.press('ArrowRight');   // Q hors ligne : le métronome
    await fermerReglages(Q);
    const volQ = await local(Q, 'harmohubMetronomeVolume');
    await pause(Q.p, 600);
    await ouvrirReglages(P);
    await P.p.click('#toggle-metronome-countin');                          // P, pendant ce temps : le décompte
    await fermerReglages(P);
    await pause(P.p, 3200);
    const compteP = await local(P, 'harmohubMetronomeCountIn');
    nuage.coupe.delete('Q');
    await Q.p.evaluate(() => window.dispatchEvent(new Event('online')));
    await pause(Q.p, 5000); await pause(P.p, 2000);
    check(await local(Q, 'harmohubMetronomeCountIn') === compteP && await local(P, 'harmohubMetronomeVolume') === volQ,
        `chaque appareil garde le réglage de l'autre ET le sien : décompte « ${compteP} » de P chez Q, métronome « ${volQ} » de Q chez P`);
    const r3 = reglagesNuage(nuage);
    check(r3.harmohubMetronomeCountIn.v === compteP && r3.harmohubMetronomeVolume.v === volQ, 'et le cloud a les deux (fusion par réglage, pas en bloc)');

    // =========================================================================================
    // F. RÉPÉTER UNE VALEUR N'EST PAS UNE MODIFICATION
    // =========================================================================================
    const ecrAvant = ecritures(nuage);
    const tAvant = await P.p.evaluate(() => localStorage.getItem('harmohub_sync_reglages_t'));
    await P.p.evaluate(() => { localStorage.setItem('harmohubMetronomeVolume', localStorage.getItem('harmohubMetronomeVolume')); });
    await pause(P.p, 3000);
    check(ecritures(nuage) === ecrAvant, 'réécrire la même valeur n\'envoie rien au cloud');
    check(await P.p.evaluate(() => localStorage.getItem('harmohub_sync_reglages_t')) === tAvant, 'et ne redate pas le réglage (elle ne gagnerait pas contre un autre appareil)');

    // =========================================================================================
    // G. LES SAUVEGARDES CONTIENNENT LES PAROLES
    // =========================================================================================
    const S1 = { id: 'S1', name: 'Ballade', savedAt: 5000, sections: [{ title: 'A', chords: [] }] };
    const parolesS1 = (texte, at) => JSON.stringify({ songName: 'Ballade', savedAt: at, sections: [{ lyricsHtml: texte, placements: [], repeatCount: 1 }] });
    await P.p.evaluate(([song, brut, orphelin]) => {
        localStorage.setItem('harmohubSongs', JSON.stringify([song]));
        localStorage.setItem('harmohub_lyrics_v1_id-S1', brut);
        localStorage.setItem('harmohub_lyrics_v1_id-DISPARU', orphelin);
    }, [S1, parolesS1('Paroles de la ballade', 9000), parolesS1('Orphelin', 100)]);
    const complete = await P.p.evaluate(() => enveloppeSauvegarde(loadSongs(), loadFolders(), true));
    check(complete.paroles && Object.keys(complete.paroles).sort().join() === 'id-DISPARU,id-S1', `la bibliothèque entière emporte TOUTES les paroles, même celles d'un morceau disparu (${Object.keys(complete.paroles || {})})`);
    const unSeul = await P.p.evaluate(() => enveloppeSauvegarde([loadSongs()[0]], null, false));
    check(Object.keys(unSeul.paroles || {}).join() === 'id-S1', 'la sauvegarde d\'UN morceau n\'emporte que les siennes');
    const sansParoles = await P.p.evaluate(() => { localStorage.removeItem('harmohub_lyrics_v1_id-S1'); localStorage.removeItem('harmohub_lyrics_v1_id-DISPARU'); return enveloppeSauvegarde(loadSongs(), loadFolders(), true); });
    check(!('paroles' in sansParoles), 'sans paroles, le fichier est identique à avant (aucun champ en plus)');
    // Le vrai export : un téléchargement, relu.
    await P.p.evaluate((b) => localStorage.setItem('harmohub_lyrics_v1_id-S1', b), parolesS1('Paroles de la ballade', 9000));
    const dl = P.p.waitForEvent('download', { timeout: 20000 });
    await P.p.evaluate(() => { window.app.exportLibrary(); });
    const fichier = await (await dl).path();
    const exporte = JSON.parse(fs.readFileSync(fichier, 'utf8'));
    check(exporte.kind === 'library-backup' && exporte.songs.length === 1 && exporte.paroles && /Paroles de la ballade/.test(exporte.paroles['id-S1']),
        'l\'export réel de la bibliothèque (téléchargement) contient bien les paroles');

    // =========================================================================================
    // H. LES RESTAURER : jamais d'écrasement d'une version plus récente
    // =========================================================================================
    const importer = async (d, json) => {
        await d.p.evaluate((j) => { window.__import = window.app.importLibraryFile(new File([j], 'b.json', { type: 'application/json' })); }, JSON.stringify(json));
        await pause(d.p, 400);
    };
    const R = await ouvrir(creerNuage(), 'R');                       // un appareil vierge, SANS compte
    await R.p.evaluate(() => { const v = document.getElementById('cloud-guard-modal'); if (v) v.hidden = true; });
    await importer(R, exporte);
    await R.p.evaluate(() => window.__import);
    check(/Paroles de la ballade/.test(await local(R, 'harmohub_lyrics_v1_id-S1') || ''), 'importer la sauvegarde sur un appareil vierge restaure le morceau ET ses paroles');
    check(await local(R, 'harmohub_lyrics_v1_id-DISPARU') === null, 'sans ramener les paroles d\'un morceau qui n\'est pas importé');
    check(/paroles de 1 morceau/.test(await R.p.textContent('#toast')), 'et le dit (« paroles de 1 morceau(x) retrouvées »)');

    // Conflit : le morceau existe déjà ici, on choisit « écraser ». Des paroles plus RÉCENTES ici ne sont pas touchées.
    const choisir = async (d, valeur) => {
        await d.p.waitForSelector('#import-conflict-modal:not([hidden])', { timeout: 5000 });
        await d.p.check(`input[name="ic-S1"][value="${valeur}"]`);
        await d.p.click('#import-conflict-apply');
        await d.p.evaluate(() => window.__import);
        await pause(d.p, 300);
    };
    const T = await ouvrir(creerNuage(), 'T');
    await T.p.evaluate(() => { const v = document.getElementById('cloud-guard-modal'); if (v) v.hidden = true; });
    await T.p.evaluate(([song, brut]) => { localStorage.setItem('harmohubSongs', JSON.stringify([song])); localStorage.setItem('harmohub_lyrics_v1_id-S1', brut); }, [{ ...S1, savedAt: 1000 }, parolesS1('Version d\'ici, plus récente', 20000)]);
    await importer(T, exporte);
    await choisir(T, 'ecraser');
    check(/plus récente/.test(await local(T, 'harmohub_lyrics_v1_id-S1')), 'des paroles plus RÉCENTES ici ne sont pas écrasées par celles du fichier');
    const U = await ouvrir(creerNuage(), 'U');
    await U.p.evaluate(() => { const v = document.getElementById('cloud-guard-modal'); if (v) v.hidden = true; });
    await U.p.evaluate(([song, brut]) => { localStorage.setItem('harmohubSongs', JSON.stringify([song])); localStorage.setItem('harmohub_lyrics_v1_id-S1', brut); }, [{ ...S1, savedAt: 1000 }, parolesS1('Version d\'ici, plus ancienne', 100)]);
    await importer(U, exporte);
    await choisir(U, 'ecraser');
    check(/Paroles de la ballade/.test(await local(U, 'harmohub_lyrics_v1_id-S1')), 'des paroles plus ANCIENNES ici sont remplacées par celles du fichier (plus récentes)');
    const rangee = JSON.parse(await local(U, 'harmohub_lyrics_rangee_id-S1') || 'null');
    check(!!rangee && /plus ancienne/.test(rangee.json), 'et la version d\'ici qui part est RANGÉE (la page Paroles propose de la restaurer) : rien n\'est perdu');
    // « Garder les deux » : la copie reçoit un nouvel identifiant, ses paroles la suivent.
    const V = await ouvrir(creerNuage(), 'V');
    await V.p.evaluate(() => { const v = document.getElementById('cloud-guard-modal'); if (v) v.hidden = true; });
    await V.p.evaluate(([song]) => { localStorage.setItem('harmohubSongs', JSON.stringify([song])); }, [{ ...S1, savedAt: 1000 }]);
    await importer(V, exporte);
    await choisir(V, 'les-deux');
    const copie = await V.p.evaluate(() => loadSongs().find(s => s.id !== 'S1'));
    check(!!copie && /Paroles de la ballade/.test(await local(V, 'harmohub_lyrics_v1_id-' + copie.id) || ''), '« garder les deux » : les paroles du fichier suivent la COPIE (son nouvel identifiant), pas l\'original');
    check(await local(V, 'harmohub_lyrics_v1_id-S1') === null, 'et l\'original n\'en reçoit pas');
    // Un ancien fichier, sans champ `paroles`, s'importe comme avant.
    const W = await ouvrir(creerNuage(), 'W');
    await W.p.evaluate(() => { const v = document.getElementById('cloud-guard-modal'); if (v) v.hidden = true; });
    const ancien = { ...exporte }; delete ancien.paroles;
    await importer(W, ancien);
    await W.p.evaluate(() => window.__import);
    check(await W.p.evaluate(() => loadSongs().length) === 1, 'un ancien fichier, sans paroles, s\'importe comme avant');

    // =========================================================================================
    // I. TÉLÉPHONE : un téléphone neuf retrouve les réglages
    // =========================================================================================
    const M = await ouvrir(nuage, 'M', { viewport: { width: 390, height: 844 }, tactile: true });
    await M.p.evaluate(() => { window.__avantRecharge = 1; });
    await connecter(M, 3500);
    check(await M.p.evaluate(() => window.__avantRecharge === undefined) && await local(M, 'harmohubMetronomeCountIn') === compteP,
        'téléphone : la reprise recharge une fois et le téléphone retrouve les réglages');
    check(await M.p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 0, 'sans que la page déborde');

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.slice(0, 2).join(' | ')}`);
    check(pannes.length > 0, 'les pannes simulées ont bien été consignées dans la console');
    await navigateur.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
