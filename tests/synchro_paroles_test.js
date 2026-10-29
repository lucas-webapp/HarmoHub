// LES PAROLES AU CLOUD (voir synchro-paroles.js) : « je veux que tout soit stocké en ligne pour retrouver mes données en changeant
// d'ordinateur. »
//
// CE QUI N'ÉTAIT PAS AU CLOUD, mesuré avant de corriger : les paroles (le texte de chaque partie et les accords posés dessus) ne
// vivaient que dans le navigateur, une clé `harmohub_lyrics_v1_id-<morceau>` par morceau. Les morceaux, la structure et ses
// commentaires, eux, y étaient déjà (portés par le morceau). Changer d'ordinateur faisait donc perdre les paroles.
//
// Deux « appareils » = deux contextes de navigateur (donc deux localStorage distincts) branchés sur le MÊME nuage simulé. Vrais
// gestes : on TAPE dans la zone de paroles, on clique la pilule de connexion. Le faux Firebase refuse, comme le vrai, les tableaux
// imbriqués, les `undefined` et plus de 1 Mio : un document mal formé échouerait ici comme il échouerait chez l'utilisateur.
//
// CE QUE CE BANC NE PEUT PAS ÉPROUVER : les règles de sécurité Firestore (le document `harmohub-paroles` tombe sous
// `users/{uid}/apps/{appId}`, qui l'autorise — à confirmer sur de vrais appareils), la fenêtre Google réelle sur Safari.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('synchro paroles');
const estBruitReseau = require('./_harness').estBruitReseau;
const { creerNuage, installer } = require('./_firebase_faux');

plan(40);

const CHEMIN = 'users/u1/apps/harmohub-paroles';
const CLE = 'harmohub_lyrics_v1_id-sync-p-1';
const MORCEAU = {
    version: 1, song: 'Chanson Cloud', songId: 'sync-p-1', beatsPerBar: 4,
    sections: [
        { title: 'Couplet', chords: [{ symbol: 'C', beats: 4 }, { symbol: 'G', beats: 4 }] },
        { title: 'Refrain', chords: [{ symbol: 'F', beats: 4 }] },
    ],
};
const FICHIER = path.join(__dirname, '..', 'sample_synchro_paroles.json');

const pause = (p, ms) => p.waitForTimeout(ms);

(async () => {
    fs.writeFileSync(FICHIER, JSON.stringify(MORCEAU));
    const navigateur = await chromium.launch();
    const erreurs = [];
    const pannes = [];

    const ouvrir = async (nuage, appareil, { viewport, tactile, persister = true } = {}) => {
        const ctx = await navigateur.newContext({ viewport: viewport || { width: 1300, height: 900 }, ...(tactile ? { hasTouch: true, isMobile: true } : {}) });
        await installer(ctx, nuage, { appareil, uid: 'u1', persister });
        const p = await ctx.newPage();
        p.on('pageerror', (e) => erreurs.push(`${appareil} pageerror: ${e.message}`));
        p.on('console', (m) => {
            if (m.type() !== 'error' || estBruitReseau(m.text())) return;
            // Les pannes sont SIMULÉES par ce banc (nuage.coupe) et l'appli les consigne : comportement voulu.
            if (/Envoi vers le cloud impossible|Écoute de la synchro interrompue|Synchro initiale impossible/.test(m.text())) { pannes.push(m.text()); return; }
            erreurs.push(`${appareil} console: ${m.text()}`);
        });
        await p.goto(`${BASE}/paroles.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 20000 });
        await pause(p, 700);
        return { ctx, p, nom: appareil };
    };
    const importer = async (d) => { await d.p.setInputFiles('#file-input', FICHIER); await pause(d.p, 400); };
    const taper = async (d, texte, section = 0) => {
        await d.p.locator('.lyrics-text').nth(section).click();
        await d.p.keyboard.type(texte);
        await pause(d.p, 2800);               // anti-rebond de la page (350 ms) + délai d'envoi du moteur (1,5 s)
    };
    const connecter = async (d, attente = 2200) => { await d.p.click('#google-signin-btn'); await pause(d.p, attente); };
    const texteAffiche = (d, section = 0) => d.p.locator('.lyrics-text').nth(section).textContent();
    const session = (d) => d.p.evaluate((c) => { const b = localStorage.getItem(c); return b ? JSON.parse(b) : null; }, CLE);
    const dansNuage = (nuage) => nuage.docs.get(CHEMIN) || null;
    const etat = (d) => d.p.getAttribute('#sync-status', 'data-etat');

    // =========================================================================================
    // 0. SANS FIREBASE : la page marche exactement comme avant
    // =========================================================================================
    {
        const ctx = await navigateur.newContext({ viewport: { width: 1300, height: 900 } });
        await ctx.route(/gstatic\.com\/firebasejs\//, (r) => r.abort());
        const p = await ctx.newPage();
        const locales = [];
        p.on('pageerror', (e) => locales.push(e.message));
        await p.goto(`${BASE}/paroles.html?nocache=` + Date.now(), { waitUntil: 'load' });
        await pause(p, 700);
        await p.setInputFiles('#file-input', FICHIER); await pause(p, 300);
        await p.locator('.lyrics-text').first().click();
        await p.keyboard.type('Tapé sans cloud');
        await pause(p, 800);
        check(locales.length === 0, `sans SDK Firebase, aucune erreur JavaScript — ${locales.slice(0, 1)}`);
        const local = await p.evaluate((c) => JSON.parse(localStorage.getItem(c)), CLE);
        check(local && /Tapé sans cloud/.test(local.sections[0].lyricsHtml), 'et l\'enregistrement local marche comme avant');
        check(typeof local.savedAt === 'number' && local.savedAt > 1e12, `chaque session porte maintenant sa date d'enregistrement (${local.savedAt})`);
        check(await p.isVisible('#google-signin-btn') && await p.locator('#google-signin-btn').evaluate(e => e.classList.contains('cc-indisponible')),
            'la pilule reste visible, grisée : un bouton qui disparaît ressemble à une panne');
        await ctx.close();
    }

    // =========================================================================================
    // 1. APPAREIL P : taper des paroles, connecté, les voit partir au cloud
    // =========================================================================================
    const nuage = creerNuage();
    const P = await ouvrir(nuage, 'P');
    check(await P.p.isVisible('#google-signin-btn'), 'la page Paroles montre la même pilule « Se connecter » que HarmoHub');
    check(await P.p.isHidden('#cloud-guard-modal'), 'sans fenêtre d\'accueil : on arrive en général depuis HarmoHub, qui l\'a déjà proposée');
    await importer(P);
    await taper(P, 'Premier couplet sur P');
    check(!dansNuage(nuage), 'non connecté : rien ne part (les paroles restent ici)');
    await connecter(P);
    check(await etat(P) === 'synced', `connecté : la pastille passe à « synchronisé » (${await etat(P)})`);
    const doc = dansNuage(nuage);
    check(!!doc && doc.sessions.length === 1 && doc.sessions[0].cle === 'id-sync-p-1', 'les paroles de P sont au cloud, dans le document `harmohub-paroles` (une session par morceau)');
    check(doc && typeof doc.sessions[0].json === 'string' && /Premier couplet sur P/.test(doc.sessions[0].json), 'chaque session est une chaîne JSON (Firestore refuse les tableaux imbriqués) qui porte le texte');
    check(!nuage.docs.has('users/u1/apps/harmohub'), 'la page Paroles n\'écrit PAS dans le document de la bibliothèque : chacun son document, chacun sa limite de 1 Mio');
    check(doc && doc.sessions[0].nom === 'Chanson Cloud', 'avec le nom du morceau, lisible dans la console Firebase');

    // Taper ENCORE : une nouvelle version part toute seule.
    const avant = nuage.ecritures.filter(e => e.chemin === CHEMIN).length;
    await taper(P, ' puis la suite', 0);
    check(nuage.ecritures.filter(e => e.chemin === CHEMIN).length > avant && /puis la suite/.test(dansNuage(nuage).sessions[0].json),
        'connecté, chaque modification part toute seule, sans rien à faire');
    await P.p.evaluate(() => { window.__ecr = 0; });

    // =========================================================================================
    // 2. APPAREIL Q : « changer d'ordinateur » — un navigateur vierge retrouve les paroles
    // =========================================================================================
    const Q = await ouvrir(nuage, 'Q');
    await importer(Q);                                  // la structure du morceau vient de HarmoHub (fichier « Exporter pour paroles »)
    check((await texteAffiche(Q)) === '', 'précondition : sur ce nouvel appareil, la zone de paroles est vide');
    await connecter(Q, 3000);
    const retrouve = await texteAffiche(Q);
    check(/Premier couplet sur P puis la suite/.test(retrouve), `après connexion, Q retrouve les paroles tapées sur P, SANS rien retaper (« ${retrouve} »)`);
    const sQ = await session(Q);
    check(sQ && /Premier couplet sur P puis la suite/.test(sQ.sections[0].lyricsHtml), 'et elles sont enregistrées dans le navigateur de Q (hors ligne, elles y seraient)');
    check(await etat(Q) === 'synced', 'Q est synchronisé');

    // Ordre inverse : la page est ouverte AVANT la connexion, les paroles arrivent en direct.
    // =========================================================================================
    // 3. EN DIRECT : P tape, Q (page ouverte) reçoit sans recharger
    // =========================================================================================
    await taper(P, ' / ajout live', 0);
    await pause(Q.p, 1800);
    check(/ajout live/.test(await texteAffiche(Q)), 'P tape, Q reçoit les paroles EN DIRECT, page ouverte, sans recharger');
    check(await Q.p.locator('#paroles-restaurer').count() === 0, 'sans bandeau de restauration : personne n\'a rien perdu');

    // =========================================================================================
    // 4. ÉDITION CONCURRENTE : deux appareils tapent sans se voir
    // =========================================================================================
    nuage.coupe.add('Q');
    await Q.p.evaluate(() => window.dispatchEvent(new Event('offline')));
    await taper(Q, ' [Q hors ligne]', 1);          // section « Refrain », Q coupé du réseau
    await taper(P, ' [P pendant ce temps]', 1);      // plus tard que Q : P gagnera
    check(/Q hors ligne/.test(await texteAffiche(Q, 1)) && !/P pendant/.test(await texteAffiche(Q, 1)), 'précondition : Q a son texte, sans celui de P (réseau coupé)');
    check(['offline', 'pending', 'error'].includes(await etat(Q)), `et la pastille de Q le dit (${await etat(Q)})`);
    nuage.coupe.delete('Q');
    await Q.p.evaluate(() => window.dispatchEvent(new Event('online')));
    await pause(Q.p, 4500);
    const apresQ = await texteAffiche(Q, 1);
    check(/P pendant ce temps/.test(apresQ), `la version la plus RÉCENTE gagne : Q reçoit celle de P (« ${apresQ} »)`);
    const rangee = await Q.p.evaluate(() => { const b = localStorage.getItem('harmohub_lyrics_rangee_id-sync-p-1'); return b ? JSON.parse(b) : null; });
    check(!!rangee && /Q hors ligne/.test(rangee.json) && rangee.de === 'cet appareil', 'la version d\'ICI qui perd n\'est PAS jetée : elle est rangée à part');
    check(await Q.p.locator('#paroles-restaurer').count() === 1 && /gardée à part/.test(await Q.p.locator('#banners').textContent()),
        'un bandeau le dit, avec un bouton pour la restaurer');
    // Restaurer : la version de Q redevient la plus récente, et gagne partout.
    await Q.p.click('#paroles-restaurer'); await pause(Q.p, 3200);
    check(/Q hors ligne/.test(await texteAffiche(Q, 1)), 'restaurer remet la version de Q à l\'écran');
    check(await Q.p.locator('#paroles-restaurer').count() === 0 && (await Q.p.evaluate(() => localStorage.getItem('harmohub_lyrics_rangee_id-sync-p-1'))) === null,
        'et la version rangée est consommée (plus de bandeau, rien qui traîne)');
    await pause(P.p, 2000);
    check(/Q hors ligne/.test(await texteAffiche(P, 1)), 'la version restaurée gagne ensuite sur P : les deux appareils convergent');

    // Même cas, dans l'autre sens : c'est la version DE L'AUTRE appareil qui perd — elle ne doit pas non plus disparaître.
    nuage.coupe.add('P');
    await P.p.evaluate(() => window.dispatchEvent(new Event('offline')));
    await taper(P, ' [P hors ligne, plus ancien]', 0);
    await taper(Q, ' [Q, plus récent]', 0);
    nuage.coupe.delete('P');
    await P.p.evaluate(() => window.dispatchEvent(new Event('online')));
    await pause(P.p, 4500); await pause(Q.p, 2500);
    check(/Q, plus récent/.test(await texteAffiche(Q, 0)) && /Q, plus récent/.test(await texteAffiche(P, 0)), 'la plus récente gagne dans les deux sens (P reprend celle de Q)');
    const rangeeP = await P.p.evaluate(() => { const b = localStorage.getItem('harmohub_lyrics_rangee_id-sync-p-1'); return b ? JSON.parse(b) : null; });
    check(!!rangeeP && /P hors ligne/.test(rangeeP.json), 'la version de P, plus ancienne, est rangée chez P : rien n\'est perdu, dans aucun sens');

    // =========================================================================================
    // 5. DONNÉES : le nuage ne contient que ce qu'il doit
    // =========================================================================================
    const final = dansNuage(nuage);
    check(final.sessions.length === 1, `une seule session au cloud pour un seul morceau (${final.sessions.length})`);
    check(JSON.stringify(final).length < 20000, `et le document reste petit (${JSON.stringify(final).length} octets)`);
    check(!final.sessions.some(s => /rangee/.test(s.cle)), 'les versions rangées restent sur l\'appareil : elles ne sont pas envoyées comme des morceaux');
    check(nuage.ecritures.every(e => e.chemin === CHEMIN), `rien d'autre n'est écrit au cloud par la page Paroles (${[...new Set(nuage.ecritures.map(e => e.chemin))]})`);

    // =========================================================================================
    // 6. APPAREIL VIERGE ET CLOUD VIDE : on n'écrase jamais le cloud avec du vide
    // =========================================================================================
    const nuage2 = creerNuage();
    const V = await ouvrir(nuage2, 'V');
    await importer(V);
    await connecter(V);
    check(!nuage2.docs.has(CHEMIN) || nuage2.docs.get(CHEMIN).sessions.length === 0, 'un appareil sans paroles qui se connecte à un cloud vide n\'invente aucune session');
    const W = await ouvrir(nuage, 'W');
    await importer(W);
    await connecter(W, 3000);
    check(/Q hors ligne/.test(await texteAffiche(W, 1)), 'un troisième appareil vierge retrouve aussi tout : la version courante du cloud');
    check((dansNuage(nuage).sessions[0].json.match(/Q hors ligne/g) || []).length >= 1 && dansNuage(nuage).sessions.length === 1,
        'et sa connexion n\'a rien écrasé au cloud (une session, la même)');

    // =========================================================================================
    // 7. TÉLÉPHONE
    // =========================================================================================
    const T = await ouvrir(nuage, 'T', { viewport: { width: 390, height: 844 }, tactile: true });
    const g = await T.p.evaluate(() => {
        const b = document.getElementById('google-signin-btn').getBoundingClientRect();
        return { w: b.width, h: b.height, debord: document.documentElement.scrollWidth - window.innerWidth };
    });
    check(g.h >= 32 && g.w >= 32 && g.debord <= 0, `téléphone : la pilule se vise au doigt et la page ne déborde pas (${Math.round(g.w)}×${Math.round(g.h)}, débord ${g.debord})`);
    await T.p.tap('#google-signin-btn'); await pause(T.p, 2200);
    await T.p.setInputFiles('#file-input', FICHIER); await pause(T.p, 600);
    check(/Q hors ligne/.test(await texteAffiche(T, 1)), 'téléphone : les paroles sont retrouvées après connexion, au doigt');

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.slice(0, 2).join(' | ')}`);
    check(pannes.length > 0, 'les pannes simulées ont bien été consignées dans la console');
    try { fs.unlinkSync(FICHIER); } catch (e) { /* déjà parti */ }
    await navigateur.close();
    bilan();
})().catch((e) => { try { fs.unlinkSync(FICHIER); } catch (x) { } console.error('FATAL', e); process.exit(2); });
