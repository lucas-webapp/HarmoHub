// LES VERSIONS AU CLOUD (sous-lot « Versions au cloud », 05/11 — synchro-versions.js, historique.js `importer` / `surAjout`), avec de vrais
// gestes, sur deux appareils branchés sur le même nuage simulé (_firebase_faux.js).
//
// CE QUE L'UTILISATEUR A DEMANDÉ : « toutes les versions stockées dans le firestore », celles des morceaux ET des paroles, donc sur tous
// les appareils ; « s'il y a un problème de place, il faut garder moins de versions que prévu […] le minimum acceptable (environ 3 à 5
// versions) » ; la page Paroles ouverte SEULE doit aussi lister et restaurer ses versions (« oui on restaure »).
//
// CE QUI N'ÉTAIT PAS, mesuré avant : les versions restaient dans IndexedDB, PAR APPAREIL — ouvrir Paramètres › Historique sur le téléphone
// ne montrait rien de ce qui avait été gardé sur l'ordinateur ; la page Paroles seule n'avait aucune liste de versions.
//
// A à l'ordinateur (1440 px), B au téléphone (390 px, tactile). Tous deux déjà connectés (la session survit au rechargement).
const { chromium } = require('playwright');
const { ajouterAccord: ajouterGeste } = require('./_ajout');
const { check, exiger, plan, bilan } = require('./_harness')('versions au cloud (morceaux et paroles, deux appareils)');
const { estBruitReseau } = require('./_harness');
const { creerNuage, installer } = require('./_firebase_faux');

plan(37);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const DOC = 'users/u1/apps/harmohub-versions-s1';
const INDEX = 'users/u1/apps/harmohub-versions';
const CLE = 'harmohub_lyrics_v1_id-s1';
const mk = (root, quality, beats = 4) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} });
const graine = ({ src, avecMorceaux }) => {
    const m = eval('(' + src + ')');
    if (avecMorceaux) {
        const A = [{ title: 'Couplet', chords: [m('C', 'maj7'), m('A', 'min7')] }];
        localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: A }]));
        localStorage.setItem('harmohubCurrentSongId', 's1');
        localStorage.setItem('myProgression', JSON.stringify({ sections: A }));
    }
    localStorage.setItem('__fauxSession', '1');
    sessionStorage.setItem('cc_accueil_vu', '1');
};
const texteDe = (brut) => { if (!brut) return ''; const s = JSON.parse(brut); return s.sections.map(x => (x.lyricsHtml || '').replace(/<[^>]+>/g, '')).join('|'); };

(async () => {
    const nav = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const nuage = creerNuage();
    const erreurs = [];
    const surveiller = (p, nom) => {
        p.on('pageerror', e => erreurs.push(`${nom} pageerror: ${e.message}`));
        // L'envoi coupé (partie E) est consigné par l'appli : c'est voulu, pas une panne.
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext|Firebase|firebase|unavailable|Envoi des versions impossible|Envoi vers le cloud impossible/.test(m.text())) erreurs.push(`${nom} console: ${m.text()}`); });
        p.on('dialog', d => d.accept());
    };
    const ouvrir = async (appareil, { viewport, tactile, avecMorceaux }) => {
        const ctx = await nav.newContext({ viewport, ...(tactile ? { hasTouch: true, isMobile: true } : {}) });
        await installer(ctx, nuage, { appareil, uid: 'u1', persister: true });
        const p = await ctx.newPage();
        surveiller(p, appareil);
        await p.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 20000 });
        await p.evaluate(graine, { src: mk.toString(), avecMorceaux });
        await p.reload({ waitUntil: 'load' });
        await p.waitForTimeout(900);
        return { ctx, p, nom: appareil };
    };
    const attendre = async (fn, ms = 10000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await new Promise(r => setTimeout(r, 150)); } return false; };
    const doc = () => nuage.docs.get(DOC) || null;
    const versionsLocales = (p, quoi = 'HistoriqueVersions') => p.evaluate(([q]) => window[q].lister('s1').then(l => l.map(v => ({ id: v.id, motif: v.motif, appareil: v.appareil, empreinte: v.empreinte }))), [quoi]);
    const ajouterAccord = async (p, texte) => {
        await ajouterGeste(p, texte);
        const choix = p.locator('#section-picker-menu:not([hidden]) button').first();
        if (await choix.isVisible().catch(() => false)) await choix.click();
        await p.waitForTimeout(250);
    };
    const cadre = (p) => p.frame({ url: /paroles\.html\?integre=1/ });
    const cadrePret = async (p) => { let f = null; await attendre(async () => { f = cadre(p); return !!f && await f.evaluate(() => document.readyState === 'complete' && typeof writeSessionNow === 'function').catch(() => false); }); return f; };

    // ======================================================================================================
    console.log('\n=== A. L\'ordinateur enregistre : ses versions partent au cloud, 5 au plus ===');
    const A = await ouvrir('A', { viewport: { width: 1440, height: 900 }, avecMorceaux: true });
    exiger(await attendre(() => A.p.evaluate(() => typeof VersionsCloud !== 'undefined' && VersionsCloud.connecte())), 'A est connecté et le module des versions au cloud est chargé');
    await ajouterAccord(A.p, 'D');
    await A.p.click('#tb-save');
    check(await attendre(() => !!doc() && doc().morceau.length === 1), 'un enregistrement : sa version est au cloud, dans le document du morceau');
    const v0 = doc().morceau[0];
    check(typeof v0.charge === 'string' && JSON.parse(v0.charge).sections[0].chords.length === 3 && v0.motif === 'enregistre', 'la version garde tout le morceau (charge en texte JSON : Firestore refuse les tableaux imbriqués)');
    check(!!nuage.docs.get(INDEX) && nuage.docs.get(INDEX).morceaux.some(l => l.songId === 's1' && l.n === 1), 'l\'index des versions au cloud cite le morceau');
    check(!nuage.docs.get('users/u1/apps/harmohub') || !/"motif"/.test(JSON.stringify(nuage.docs.get('users/u1/apps/harmohub'))), 'le document de la bibliothèque ne porte aucune version (sa limite de 1 Mio reste pour les morceaux)');
    for (const r of ['E', 'F', 'G', 'A', 'B', 'C#']) { await ajouterAccord(A.p, r); await A.p.click('#tb-save'); await A.p.waitForTimeout(200); }
    const locA = await versionsLocales(A.p);
    check(locA.length >= 7, `l'ordinateur garde toutes ses versions (${locA.length})`);
    check(await attendre(() => doc().morceau.length === 5 && doc().morceau.map(v => v.id).join() === locA.slice(0, 5).map(v => v.id).join()), `le cloud garde les 5 plus récentes, dans l'ordre (${doc().morceau.length})`);

    // ======================================================================================================
    console.log('\n=== B. Les paroles aussi ===');
    await A.p.click('#lyrics-btn');
    const fA = await cadrePret(A.p);
    await fA.evaluate(() => { DELAI_VERSION_PAROLES = 0; });   // réglage prévu pour les bancs : une version à chaque écriture plutôt que toutes les 5 min
    await fA.click('.lyrics-text');
    await A.p.keyboard.type('Sous le pont Mirabeau');
    await A.p.click('#tab-grille');
    await A.p.waitForTimeout(500);
    await A.p.click('#lyrics-btn');
    await fA.click('.lyrics-text');
    await A.p.keyboard.press('End');
    await A.p.keyboard.type(' coule la Seine');
    await A.p.click('#tab-grille');
    check(await attendre(() => !!doc() && (doc().paroles || []).some(v => /Mirabeau/.test(v.charge) && !/Seine/.test(v.charge))), 'la version précédente des paroles (« Sous le pont Mirabeau ») est au cloud, dans le même document');

    // ======================================================================================================
    console.log('\n=== C. La page Paroles ouverte SEULE, sur le téléphone : elle liste et restaure les versions venues de l\'ordinateur ===');
    const B = await ouvrir('B', { viewport: { width: 390, height: 844 }, tactile: true, avecMorceaux: false });
    exiger(await attendre(() => B.p.evaluate(() => (JSON.parse(localStorage.getItem('harmohubSongs') || '[]')).some(s => s.id === 's1'))), 'B reprend la bibliothèque');
    check((await versionsLocales(B.p)).length === 0, 'B n\'a encore aucune version du morceau dans son navigateur');
    await B.p.click('#tb-titre');
    await B.p.click('[data-tb-action="ouvrir-id"][data-song-id="s1"]');
    await B.p.waitForTimeout(400);
    await B.p.click('#lyrics-btn');               // la vue Paroles retient le morceau : la page seule le rouvrira
    await cadrePret(B.p);
    check(await attendre(async () => /Seine/.test(texteDe(await B.p.evaluate((c) => localStorage.getItem(c), CLE)))), 'B a les paroles actuelles (« …coule la Seine »)');
    const seule = await B.ctx.newPage();
    surveiller(seule, 'B/paroles');
    await seule.goto(`${BASE}/paroles.html`, { waitUntil: 'load' });
    exiger(await attendre(() => seule.evaluate(() => !!state.song && state.song.songId === 's1' && typeof VersionsCloud !== 'undefined' && VersionsCloud.connecte())), 'la page Paroles seule rouvre le morceau et se connecte');
    await seule.click('#btn-options');
    check(await attendre(() => seule.evaluate(() => [...document.querySelectorAll('#versions-paroles-liste .version-carte')].some(c => /Mirabeau/.test(c.textContent) && /autre appareil/.test(c.textContent)))),
        'Options › Versions précédentes liste la version prise sur l\'ordinateur, marquée « autre appareil »');
    const carte = await seule.evaluate(() => { const c = [...document.querySelectorAll('#versions-paroles-liste .version-carte')].find(x => /Mirabeau/.test(x.textContent) && !/Seine/.test(x.textContent)); return c ? c.dataset.version : null; });
    exiger(!!carte, 'la version « Sous le pont Mirabeau » a son bouton Restaurer');
    const bouton = await seule.locator(`#versions-paroles-liste [data-restaurer="${carte}"]`).boundingBox();
    check(!!bouton && bouton.height >= 44, `au doigt, Restaurer fait 44 px de haut (${bouton && Math.round(bouton.height)})`);
    await seule.locator(`#versions-paroles-liste [data-restaurer="${carte}"]`).tap();
    check(await attendre(() => seule.evaluate(() => document.querySelector('.lyrics-text').textContent.trim() === 'Sous le pont Mirabeau')), 'Restaurer remet ces paroles à l\'écran');
    const enregistre = texteDe(await seule.evaluate((c) => localStorage.getItem(c), CLE));
    check(enregistre === 'Sous le pont Mirabeau', `…et dans la session enregistrée (${enregistre})`);
    check(await attendre(async () => (await seule.evaluate(() => HistoriqueParoles.lister('s1').then(l => l.filter(v => v.motif === 'avant-restauration').map(v => JSON.stringify(v.charge))))).some(t => /Seine/.test(t))), 'les paroles remplacées (« …coule la Seine ») sont d\'abord gardées comme version');
    check(await seule.evaluate(() => /remises en place/.test(document.getElementById('banners').textContent)), 'un bandeau dit que les paroles sont remises en place');
    // L'ordinateur reçoit la restauration et garde lui aussi l'état remplacé (« avant synchro ») : même contenu, donc UNE seule au cloud.
    check(await attendre(() => (doc().paroles || []).filter(v => /coule la Seine/.test(v.charge)).length === 1 && (doc().paroles || []).some(v => /coule la Seine/.test(v.charge) && /avant-(restauration|synchro)/.test(v.motif))),
        'les paroles remplacées sont au cloud, une seule fois (même contenu gardé sur les deux appareils : pas de doublon)');
    await seule.close();

    // ======================================================================================================
    console.log('\n=== D. Paramètres › Historique au téléphone : les versions du morceau prises sur l\'ordinateur ===');
    await B.p.click('#tab-grille');
    await B.p.click('#open-settings');
    check(await attendre(() => B.p.evaluate(() => document.querySelectorAll('#hist-liste [data-version]').length >= 5)), 'B voit les versions du morceau gardées sur l\'ordinateur (au moins les 5 du cloud)');
    const textes = await B.p.evaluate(() => [...document.querySelectorAll('#hist-liste [data-version]')].map(c => c.textContent.replace(/\s+/g, ' ')));
    check(textes.filter(t => /autre appareil/.test(t)).length >= 5, `elles sont marquées « autre appareil » (${textes.filter(t => /autre appareil/.test(t)).length})`);
    check(await B.p.evaluate(() => /cloud/.test(document.querySelector('#settings-panel-historique .hist-aide').textContent)), 'le texte d\'aide dit que les plus récentes sont gardées dans le cloud');
    check(await B.p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'au téléphone, le panneau ne déborde pas en largeur');
    const plusAncienne = await B.p.evaluate(() => { const l = [...document.querySelectorAll('#hist-liste [data-version]')]; return l[l.length - 1].dataset.version; });
    await B.p.locator(`#hist-liste [data-restaurer="${plusAncienne}"]`).tap();
    check(await attendre(() => B.p.evaluate(() => /remise dans le brouillon/.test(document.getElementById('hist-message').textContent))), 'Restaurer une version de l\'ordinateur la remet dans le brouillon du téléphone');
    const appareilB = await B.p.evaluate(() => HistoriqueVersions.appareil());
    check(await attendre(() => doc().morceau.some(v => v.motif === 'avant-restauration' && v.appareil === appareilB)), 'la version gardée avant la restauration, prise au téléphone, part au cloud');
    const d = doc();
    check(d.morceau.length <= 5 && d.paroles.length <= 5, `le cloud n'en garde jamais plus de 5 + 5 (${d.morceau.length} + ${d.paroles.length})`);
    const ids = d.morceau.concat(d.paroles).map(v => v.id), emp = d.morceau.map(v => v.empreinte);
    check(new Set(ids).size === ids.length && new Set(emp).size === emp.length, 'aucun doublon au cloud après la fusion des deux appareils (ni même id, ni même contenu)');
    const locB = await versionsLocales(B.p);
    check(new Set(locB.map(v => v.id)).size === locB.length && new Set(locB.map(v => v.empreinte)).size === locB.length, `aucun doublon non plus dans le navigateur du téléphone (${locB.length} versions)`);

    // ======================================================================================================
    console.log('\n=== E. Hors ligne : la version attend, et part au retour du réseau ===');
    nuage.coupe.add('A');
    await A.p.waitForTimeout(300);
    await ajouterAccord(A.p, 'F#');
    await A.p.click('#tb-save');
    await A.p.waitForTimeout(4000);
    const enAttente = await A.p.evaluate(() => JSON.parse(localStorage.getItem('harmohub_versions_a_envoyer') || '{}'));
    const derniereA = (await versionsLocales(A.p))[0];
    check('s1' in enAttente && !doc().morceau.some(v => v.id === derniereA.id), 'réseau coupé : la version n\'est pas au cloud, elle est notée en attente');
    nuage.coupe.delete('A');
    await A.p.click('#open-settings');            // ouvrir l'historique relance ce qui attend
    check(await attendre(() => doc().morceau.some(v => v.id === derniereA.id)), 'réseau revenu : elle part (ici, à l\'ouverture de l\'historique)');
    check(await attendre(() => A.p.evaluate(() => !('s1' in JSON.parse(localStorage.getItem('harmohub_versions_a_envoyer') || '{}')))), '…et n\'est plus en attente');
    // Sans doublon à l'import : deux appareils qui ont gardé le MÊME contenu (après une synchro) sous deux identifiants n'en font qu'une.
    await A.p.waitForTimeout(800);
    const locA2 = await versionsLocales(A.p);
    check(new Set(locA2.map(v => v.id)).size === locA2.length && new Set(locA2.map(v => v.empreinte)).size === locA2.length, `l'ordinateur, après avoir relu le cloud, n'a aucun doublon (${locA2.length} versions)`);
    const reimport = await A.p.evaluate(async () => {
        const l = await HistoriqueVersions.lister('s1');
        const copie = { ...l[l.length - 1], id: 'v_autre_appareil', appareil: 'a_autre' };
        const n = await HistoriqueVersions.importer([copie, l[0]]);
        return { n, apres: (await HistoriqueVersions.lister('s1')).length, avant: l.length };
    });
    check(reimport.n === 0 && reimport.apres === reimport.avant, `une version reçue dont le contenu (ou l'identifiant) est déjà là n'est pas ajoutée (${reimport.n} ajoutée)`);

    // ======================================================================================================
    console.log('\n=== F. Un morceau trop lourd : moins de versions, jamais un refus du cloud ===');
    const taille = await A.p.evaluate(() => {
        const gros = (n) => ({ id: 'g' + n, date: n, empreinte: 'e' + n, charge: 'x'.repeat(250 * 1024) });
        const r = VersionsCloud._composer('s9', [gros(5), gros(4), gros(3), gros(2), gros(1)], [gros(15), gros(14)]);
        const seul = VersionsCloud._composer('s9', [{ id: 'h', date: 1, empreinte: 'h', charge: 'x'.repeat(1200 * 1024) }], []);
        return { poids: new Blob([JSON.stringify(r.doc)]).size, m: r.doc.morceau.length, p: r.doc.paroles.length, plusRecente: r.doc.morceau[0].id, seul: seul.doc.morceau.length };
    });
    check(taille.poids <= 900 * 1024 && taille.m >= 1 && taille.p >= 1 && taille.plusRecente === 'g5', `trop lourd : on garde moins de versions (${taille.m} + ${taille.p}, ${Math.round(taille.poids / 1024)} Ko), les plus récentes, au moins une de chaque`);
    check(taille.seul === 0, 'une version seule plus lourde que le plafond reste sur l\'appareil (le document ne serait jamais accepté)');

    check(erreurs.length === 0, `aucune erreur de page ni de console${erreurs.length ? ' : ' + erreurs.slice(0, 4).join(' | ') : ''}`);
    await nav.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
