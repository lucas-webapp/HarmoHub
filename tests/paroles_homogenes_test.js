// LES PAROLES FONCTIONNENT COMME LA GRILLE ET LA STRUCTURE (sous-lot « Paroles homogènes », 05/11), avec de vrais gestes, sur deux appareils.
//
// CE QUE L'UTILISATEUR A DEMANDÉ : les paroles « doivent être connectées au firestore directement, et doivent fonctionner comme la grille ou
// la structure. Le but est d'avoir un fonctionnement homogène. » ; « Oui tu peux enregistrer les paroles automatiquement » ; « Garde en
// mémoire des sauvegardes précédentes ».
//
// CE QUI NE L'ÉTAIT PAS, mesuré avant de corriger :
//   1. SUPPRIMER un morceau laissait ses paroles : la session restait dans le navigateur ET au cloud (document `harmohub-paroles`), et
//      revenait sur tous les appareils. Ctrl+Z ramène la grille et la structure ; les paroles doivent revenir avec elles.
//   2. LA SYNCHRO DES PAROLES n'avait lieu qu'une fois la vue Paroles ouverte (son moteur vit dans la page Paroles) : des paroles tapées sur
//      l'ordinateur n'étaient pas sur le téléphone avant d'y avoir cliqué l'onglet Paroles.
//   3. Quitter la vue sans rien taper RÉÉCRIVAIT la session, datée de maintenant — c'est ce qui ressuscitait les paroles d'un morceau supprimé.
//   4. AUCUNE version précédente des paroles : une mauvaise frappe, ou la version d'un autre appareil, remplaçait le texte sans retour.
//
// Deux « appareils » = deux contextes (deux localStorage) sur le MÊME nuage simulé (_firebase_faux.js) : A à l'ordinateur, B au téléphone
// (390 px, tactile). On les suppose déjà connectés (la session Google survit au rechargement, comme avec le vrai Firebase).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('paroles homogènes (suppression, synchro à l\'ouverture, versions)');
const { estBruitReseau } = require('./_harness');
const { creerNuage, installer } = require('./_firebase_faux');

plan(36);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const CHEMIN = 'users/u1/apps/harmohub-paroles';
const CHEMIN_BIB = 'users/u1/apps/harmohub';
const CLE = 'harmohub_lyrics_v1_id-s1';
const mk = (root, quality, beats = 4) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} });
const graine = ({ src, avecMorceaux }) => {
    const m = eval('(' + src + ')');
    if (avecMorceaux) {
        const A = [{ title: 'Couplet', chords: [m('C', 'maj7'), m('A', 'min7')] }, { title: 'Refrain', chords: [m('F', 'maj7')] }];
        const B = [{ title: 'Pont', chords: [m('B', 'min7'), m('E', '7')] }];
        localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: A }, { id: 's2', name: 'Autre', savedAt: Date.now() - 1000, sections: B }]));
        localStorage.setItem('harmohubCurrentSongId', 's1');
        localStorage.setItem('myProgression', JSON.stringify({ sections: A }));
    }
    localStorage.setItem('__fauxSession', '1');          // déjà connecté (voir _firebase_faux.js, `persister`)
    sessionStorage.setItem('cc_accueil_vu', '1');
};
const texteDe = (brut) => { if (!brut) return ''; const s = JSON.parse(brut); return s.sections.map(x => (x.lyricsHtml || '').replace(/<[^>]+>/g, '')).join('|'); };

(async () => {
    const nav = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const nuage = creerNuage();
    const erreurs = [];
    const dialogues = [];   // les mises en garde « quitter la page ? », par appareil
    const ouvrir = async (appareil, { viewport, tactile, avecMorceaux, connecte = true }) => {
        const ctx = await nav.newContext({ viewport, ...(tactile ? { hasTouch: true, isMobile: true } : {}) });
        if (connecte) await installer(ctx, nuage, { appareil, uid: 'u1', persister: true });
        else await ctx.route(/gstatic\.com\/firebasejs\//, (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/* hors ligne */' }));
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(`${appareil} pageerror: ${e.message}`));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext|Firebase|firebase/.test(m.text())) erreurs.push(`${appareil} console: ${m.text()}`); });
        p.on('dialog', d => { if (d.type() === 'beforeunload') dialogues.push(appareil); d.accept(); });
        await p.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 20000 });
        await p.evaluate(graine, { src: mk.toString(), avecMorceaux });
        await p.reload({ waitUntil: 'load' });
        await p.waitForTimeout(900);
        return { ctx, p, nom: appareil };
    };
    // Attend qu'une condition (relue dans la page) devienne vraie : la synchro a des délais (anti-rebond de 350 ms, envoi à 1,5 s).
    const attendre = async (fn, ms = 9000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await new Promise(r => setTimeout(r, 150)); } return false; };
    const cadre = (p) => p.frame({ url: /paroles\.html\?integre=1/ });
    const cadrePret = async (p) => { let f = null; await attendre(async () => { f = cadre(p); return !!f && await f.evaluate(() => document.readyState === 'complete' && typeof writeSessionNow === 'function').catch(() => false); }); return f; };
    const session = (d) => d.p.evaluate((c) => localStorage.getItem(c), CLE);
    const tombes = (d) => d.p.evaluate(() => JSON.parse(localStorage.getItem('harmohub_lyrics_sync_deleted') || '{}'));
    const auNuage = () => { const doc = nuage.docs.get(CHEMIN); return doc ? doc.sessions.find(s => s.cle === 'id-s1') || null : null; };
    const traceAuNuage = () => { const doc = nuage.docs.get(CHEMIN); return !!doc && (doc.supprimes || []).some(t => t.cle === 'id-s1'); };
    const versionsParoles = (d, f) => (f || d.p).evaluate(() => HistoriqueParoles.lister('s1').then(l => l.map(v => ({ id: v.id, motif: v.motif, texte: v.charge.sections.map(x => (x.lyricsHtml || '').replace(/<[^>]+>/g, '')).join('|') }))));
    const ouvrirMorceaux = async (d) => { await d.p.click('#tb-titre'); await d.p.click('[data-tb-action="mes-morceaux"]'); await d.p.waitForSelector('#files-overlay:not([hidden])'); };

    // ======================================================================================================
    console.log('\n=== A. Connecté : le moteur des paroles tourne dès l\'ouverture, sans ouvrir la vue ===');
    const A = await ouvrir('A', { viewport: { width: 1300, height: 860 }, avecMorceaux: true });
    exiger(await attendre(() => A.p.evaluate(() => /paroles\.html\?integre=1/.test(document.getElementById('paroles-cadre').getAttribute('src') || ''))), 'A connecté : le cadre Paroles est chargé en arrière-plan');
    check(await A.p.evaluate(() => document.getElementById('vue-paroles').hidden && document.getElementById('tab-grille').getAttribute('aria-pressed') === 'true'), '…la vue Paroles reste fermée, l\'onglet Grille allumé (rien ne change à l\'écran)');
    check(await attendre(() => nuage.docs.has(CHEMIN)), 'le document des paroles est au cloud sans avoir ouvert la vue (le moteur a démarré)');

    await A.p.click('#lyrics-btn');
    let fA = await cadrePret(A.p);
    await fA.click('.lyrics-text');
    await A.p.keyboard.type('Sous le pont Mirabeau');
    await A.p.click('#tab-grille');
    check(await attendre(() => /Mirabeau/.test(texteDe(auNuage() && auNuage().json))), 'A tape des paroles : elles partent au cloud');

    // ======================================================================================================
    console.log('\n=== B. Le téléphone les a dès l\'ouverture de HarmoHub, sans toucher à l\'onglet Paroles ===');
    const B = await ouvrir('B', { viewport: { width: 390, height: 844 }, tactile: true, avecMorceaux: false });
    check(await attendre(() => B.p.evaluate(() => (JSON.parse(localStorage.getItem('harmohubSongs') || '[]')).some(s => s.id === 's1'))), 'B reprend la bibliothèque (le morceau Démo)');
    check(await attendre(async () => /Mirabeau/.test(texteDe(await session(B)))), 'B a les paroles du morceau dans son navigateur — sans avoir ouvert la vue Paroles');
    check(await B.p.evaluate(() => document.getElementById('vue-paroles').hidden), '…et sa vue Paroles est restée fermée');
    // B ouvre le morceau et sa vue Paroles : c'est là qu'une suppression venue d'ailleurs doit se voir.
    await B.p.click('#tb-titre');
    await B.p.click('[data-tb-action="ouvrir-id"][data-song-id="s1"]');
    await B.p.waitForTimeout(400);
    await B.p.click('#lyrics-btn');
    const fB = await cadrePret(B.p);
    check(await attendre(() => fB.evaluate(() => /Mirabeau/.test(document.querySelector('.lyrics-text') ? document.querySelector('.lyrics-text').textContent : ''))), 'B ouvre la vue Paroles : les paroles d\'A y sont');

    // ======================================================================================================
    console.log('\n=== C. Supprimer le morceau supprime ses paroles, partout ===');
    await ouvrirMorceaux(A);
    await A.p.click('.file-row[data-id="s1"] [data-action="delete"]');   // confirm() accepté
    check(await attendre(async () => !(await A.p.evaluate(() => JSON.parse(localStorage.getItem('harmohubSongs')).some(s => s.id === 's1')))), 'A : le morceau est supprimé');
    check(await session(A) === null, 'A : sa session de paroles est partie avec lui');
    check(!!(await tombes(A))['id-s1'], 'A : une trace de suppression des paroles est posée');
    check(await attendre(() => !auNuage() && traceAuNuage()), 'cloud : la session n\'y est plus, la trace y est (un appareil hors ligne ne la ramènera pas)');
    check(await fA.evaluate(() => state.song === null && !document.getElementById('empty-state').hidden), 'A : le cadre Paroles a oublié le morceau (il ne peut plus réécrire ses paroles)');
    check((await versionsParoles(A)).some(v => v.motif === 'avant-suppression-morceau' && /Mirabeau/.test(v.texte)), 'A : les paroles supprimées sont gardées comme version (Paramètres › Historique)');
    check(await attendre(async () => (await session(B)) === null), 'B : la session des paroles est supprimée aussi');
    check(await fB.evaluate(() => state.song === null && !document.getElementById('empty-state').hidden), 'B : sa vue Paroles, ouverte sur ce morceau, l\'a oublié (une frappe ne le ressuscitera pas)');

    // ======================================================================================================
    console.log('\n=== D. Ctrl+Z ramène le morceau ET ses paroles ===');
    await A.p.keyboard.press('Control+z');
    check(await attendre(() => A.p.evaluate(() => JSON.parse(localStorage.getItem('harmohubSongs')).some(s => s.id === 's1'))), 'A : Ctrl+Z ramène le morceau');
    check(/Mirabeau/.test(texteDe(await session(A))), 'A : …et ses paroles');
    check(!(await tombes(A))['id-s1'], 'A : la trace de suppression est levée');
    check(await attendre(() => !!auNuage() && !traceAuNuage()), 'cloud : les paroles y sont de retour, sans trace');
    check(await attendre(async () => /Mirabeau/.test(texteDe(await session(B)))), 'B : les paroles reviennent aussi');

    // ======================================================================================================
    console.log('\n=== E. Ouvrir puis quitter la vue sans rien taper ne réécrit rien ===');
    await A.p.click('.file-row[data-id="s1"] [data-action="open"]');
    await A.p.waitForTimeout(400);
    const avant = JSON.parse(await session(A)).savedAt;
    await A.p.click('#lyrics-btn');
    fA = await cadrePret(A.p);
    check(await attendre(() => fA.evaluate(() => !!state.song && state.song.songId === 's1' && /Mirabeau/.test(document.querySelector('.lyrics-text').textContent))), 'le morceau revenu (Ctrl+Z) se rouvre dans la vue Paroles, avec ses paroles');
    await A.p.waitForTimeout(500);
    await A.p.click('#tab-grille');
    await A.p.waitForTimeout(600);
    check(JSON.parse(await session(A)).savedAt === avant, 'session inchangée (même date) : rien de tapé, rien de réécrit');

    // ======================================================================================================
    console.log('\n=== F. Les versions précédentes des paroles, et leur restauration ===');
    await fA.evaluate(() => { DELAI_VERSION_PAROLES = 0; });   // le délai de 5 minutes entre deux versions, ramené à rien pour le banc
    await A.p.click('#lyrics-btn');
    await fA.click('.lyrics-text');
    await A.p.keyboard.press('End');
    await A.p.keyboard.type(' coule la Seine');
    await A.p.click('#tab-grille');
    check(await attendre(async () => /Seine/.test(texteDe(await session(A)))), 'les paroles modifiées sont enregistrées toutes seules');
    // L'état d'avant (« Sous le pont Mirabeau ») est déjà une version (avant la suppression, partie C) : la même n'est pas gardée deux fois.
    check((await versionsParoles(A)).filter(v => v.texte === 'Sous le pont Mirabeau|').length === 1, 'l\'état d\'avant est gardé une seule fois (même texte que la version précédente : pas de doublon)');
    await A.p.click('#lyrics-btn');
    await fA.click('.lyrics-text');
    await A.p.keyboard.press('End');
    await A.p.keyboard.type(' et nos amours');
    await A.p.click('#tab-grille');
    check(await attendre(async () => (await versionsParoles(A)).some(v => v.motif === 'auto' && v.texte === 'Sous le pont Mirabeau coule la Seine|')), 'nouvelle modification : la version d\'avant (« …coule la Seine ») est gardée automatiquement');
    await A.p.click('#open-settings');
    await A.p.waitForSelector('#settings-panel-historique .hist-liste-paroles [data-restaurer-paroles]', { timeout: 5000 });
    const panneau = await A.p.evaluate(() => [...document.querySelectorAll('#settings-panel-historique .hist-carte-paroles')].map(c => ({ id: c.dataset.versionParoles, texte: c.textContent.replace(/\s+/g, ' ') })));
    check(panneau.length >= 2 && panneau.some(c => /« Sous le pont Mirabeau »/.test(c.texte)), `Paramètres › Historique liste les versions des paroles, avec un extrait (${panneau.length} versions)`);
    const cible = panneau.find(c => /« Sous le pont Mirabeau »/.test(c.texte));
    await A.p.click(`[data-restaurer-paroles="${cible.id}"]`);
    check(await attendre(async () => texteDe(await session(A)) === 'Sous le pont Mirabeau|'), 'Restaurer remet ces paroles en place');
    check(await attendre(async () => (await versionsParoles(A)).some(v => v.motif === 'avant-restauration' && /amours/.test(v.texte))), '…après avoir gardé les paroles remplacées (rien ne se perd)');
    check(await A.p.evaluate(() => /remises en place/.test(document.getElementById('hist-message').textContent)), 'un message dit que les paroles sont remises en place');
    check(await attendre(async () => !/Seine/.test(texteDe(auNuage() && auNuage().json)) && /Mirabeau/.test(texteDe(auNuage() && auNuage().json))), 'la version restaurée part au cloud');
    check(await attendre(async () => texteDe(await session(B)) === 'Sous le pont Mirabeau|'), 'B la reçoit');
    await A.p.click('#settings-close');
    await A.p.click('#lyrics-btn');
    check(await attendre(() => fA.evaluate(() => document.querySelector('.lyrics-text').textContent.trim() === 'Sous le pont Mirabeau')), 'la vue Paroles montre la version restaurée');

    // ======================================================================================================
    console.log('\n=== H. Fermer avec des paroles pas encore envoyées : UNE mise en garde, donnée par HarmoHub ===');
    // Le cadre a son propre moteur, qui prévenait lui aussi : deux boîtes pour une fermeture, et le navigateur refusait la seconde (erreur de console).
    nuage.coupe.add('A');
    // (la vue Paroles est restée ouverte à la fin de F)
    await fA.click('.lyrics-text');
    await A.p.keyboard.press('End');
    await A.p.keyboard.type(' hors ligne');
    await A.p.click('#tab-grille');
    await attendre(() => fA.evaluate(() => SYNCHRO.etat.statut === 'error' || SYNCHRO.etat.modifsEnAttente));
    const avantRecharge = dialogues.length;
    await A.p.reload({ waitUntil: 'load' });
    await A.p.waitForTimeout(600);
    check(dialogues.length - avantRecharge === 1, `une seule mise en garde à la fermeture (${dialogues.length - avantRecharge}), donnée par HarmoHub pour les paroles du cadre`);
    nuage.coupe.delete('A');

    // ======================================================================================================
    console.log('\n=== G. Sans compte : rien n\'est chargé en arrière-plan ===');
    const C = await ouvrir('C', { viewport: { width: 1300, height: 860 }, avecMorceaux: true, connecte: false });
    await C.p.waitForTimeout(1200);
    check(await C.p.evaluate(() => !document.getElementById('paroles-cadre').getAttribute('src')), 'C, sans compte : le cadre Paroles n\'est pas chargé tant qu\'on n\'ouvre pas la vue');

    check(erreurs.length === 0, 'aucune erreur de page' + (erreurs.length ? ' : ' + erreurs.slice(0, 4).join(' | ') : ''));
    await nav.close();
    bilan();
})().catch(e => { console.log('FATAL', e && e.stack || e); process.exit(1); });
