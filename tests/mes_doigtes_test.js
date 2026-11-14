// MES DOIGTÉS (L8, fin, 14/11), avec de vrais gestes : un doigté verrouillé ou dessiné est proposé EN PREMIER pour le même accord dans tous les morceaux, et suit le compte.
//
// CE QUE DEMANDE L'UTILISATEUR (13/11, « toutes tes idées sont bonnes ») : « un doigté verrouillé ou dessiné est proposé EN PREMIER pour le même accord dans tous les morceaux, synchronisé au
// compte sur le modèle de `synchro-formes.js` […]. Le cadenas reste tel quel (le doigté verrouillé passe toujours en tête). »
//
// CE QUE LE BANC TIENT : (A) le module — format, fusion (la plus récente gagne, un retrait l'emporte sur plus ancien), entrées illisibles ignorées, six doigtés par accord au plus, une identité
// par fondamentale + qualité + basse ; (B) les gestes — le cadenas retient le doigté, une fois libéré il reste le premier proposé, dans un AUTRE morceau aussi, la popover le marque « Mon doigté »
// avec son « × » (deux appuis pour retirer), un doigté dessiné puis verrouillé ou envoyé à la grille s'ajoute, un autre accord n'a pas ces doigtés ; (C) le compte — ce qui est ici part au
// document `harmohub-doigtes`, ce qui arrive du compte rejoint la liste de l'accord affiché, un retrait distant le retire ; (D) le téléphone n'a pas bougé tant que Mes doigtés est vide.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('mes doigtés');
const { estBruitReseau } = require('./_harness');

plan(39);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = (courant) => {
    const mk = (r, q, bass = null) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass, playStyle: 'held' });
    const S1 = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] }];
    const S2 = [{ title: 'Refrain', chords: [mk('C', 'maj7'), mk('F', 'maj7')] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S1 }, { id: 's2', name: 'Autre', savedAt: Date.now() - 1000, sections: S2 }]));
    localStorage.setItem('harmohubCurrentSongId', courant);
    localStorage.setItem('myProgression', JSON.stringify({ sections: courant === 's1' ? S1 : S2 }));
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport, morceau = 's1') => {
        const p = await nav.newPage({ viewport });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine, morceau);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const guitareAffichee = async (p) => {
        if ((await p.getAttribute('#toggle-viz-guitar', 'aria-pressed')) !== 'true') await p.click('#toggle-viz-guitar', { force: true });
        await p.waitForTimeout(250);
    };
    // Un vrai appui de souris au centre de l'élément (les boutons du tiroir sont parfois recouverts d'un autre calque : Playwright refuserait le clic).
    const appui = async (p, sel) => {
        const b = await p.locator(sel).boundingBox();
        await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(300);
    };
    const choisirCase = async (p, i) => { await p.click(`#progression-sections .chord-grid[data-section="0"] .grid-cell[data-index="${i}"]`); await p.waitForTimeout(500); };
    // La liste des doigtés de l'accord affiché : « cases » (x pour une corde étouffée), suivi de « * » s'il vient de Mes doigtés.
    const liste = (p) => p.evaluate(() => window.app.guitarFingerings.map(f => f.map(x => x ? x.fret : 'x').join(',') + (f.mesDoigtesId ? '*' : '')));
    // Le texte d'un élément, ou '' s'il n'existe pas (un défaut doit rougir une vérification, pas attendre 30 s un élément absent).
    const texte = (p, sel) => p.evaluate((sel) => { const e = document.querySelector(sel); return e ? e.textContent : ''; }, sel);
    const mes = (p, r, q, b = '') => p.evaluate(([r, q, b]) => MesDoigtes.mes(r, q, b).map(e => e.cases.map(c => c === null ? 'x' : c).join(',')), [r, q, b]);

    // ======================================================================================================
    console.log('\n=== A. Le module : format, fusion, limites, identité ===');
    const p = await ouvrir({ width: 1440, height: 900 });
    const A = await p.evaluate(async () => {
        const ent = (cases, at, root = 'C', quality = 'maj7', bass = '') => ({ root, quality, bass, at, cree: at, json: JSON.stringify(cases) });
        const doc = (liste, supprimes = []) => MesDoigtes._depuisDocument({ entrees: liste, supprimes });
        const r = {};
        const cases = [null, 3, 2, 0, 0, 0];
        const d1 = doc([ent(cases, 100)]);
        const id = Object.keys(d1.entrees)[0];
        r.id = id;
        r.allerRetour = JSON.stringify(MesDoigtes._depuisDocument(MesDoigtes._versDocument(d1))) === JSON.stringify(d1);
        r.formatCloud = (() => { const v = MesDoigtes._versDocument(d1); return v.app + '/' + v.schema + '/' + typeof v.entrees[0].json + '/' + v.entrees[0].json; })();
        const recent = MesDoigtes._fusionner(doc([ent(cases, 100)]), doc([ent(cases, 200)]));
        r.plusRecente = [recent.fusionne.entrees[id].at, recent.changeLocal, recent.changeDistant];
        const retrait = MesDoigtes._fusionner({ entrees: {}, supprimes: { [id]: 300 } }, doc([ent(cases, 200)]));
        r.retrait = [Object.keys(retrait.fusionne.entrees).length, retrait.changeDistant];
        const revenu = MesDoigtes._fusionner({ entrees: {}, supprimes: { [id]: 100 } }, doc([ent(cases, 200)]));
        r.revenu = [Object.keys(revenu.fusionne.entrees).length, Object.keys(revenu.fusionne.supprimes).length];
        r.illisibles = Object.keys(MesDoigtes._depuisDocument({ entrees: [
            { root: 'C', quality: 'maj7', bass: '', at: 1, json: 'pas du json' }, ent([1, 2], 1), ent([null, null, null, null, null, null], 1), ent([0, 0, 0, 0, 0, 25], 1), ent([0, 0, 0, 0, 0, 1.5], 1),
            { root: '', quality: 'maj7', at: 1, json: '[0,0,0,0,0,0]' }, null] }).entrees).length;
        // Six doigtés au plus par accord ; le même doigté remonte au lieu de se doubler.
        localStorage.removeItem('harmohubMesDoigtes');
        const attendre = () => new Promise(res => setTimeout(res, 4));
        for (let i = 0; i < 7; i++) { MesDoigtes.memoriser('C', 'maj7', '', [null, i, 2, 0, 0, 0]); await attendre(); }
        r.apresSept = MesDoigtes.mes('C', 'maj7', '').map(e => e.cases[1]).join();
        r.traceDuPlusAncien = Object.keys(JSON.parse(localStorage.getItem('harmohubMesDoigtes')).supprimes).length;
        MesDoigtes.memoriser('C', 'maj7', '', [null, 2, 2, 0, 0, 0]);
        r.remonte = MesDoigtes.mes('C', 'maj7', '').map(e => e.cases[1]).join();
        r.autreBasse = MesDoigtes.mes('C', 'maj7', 'E').length;
        r.autreQualite = MesDoigtes.mes('C', 'maj', '').length;
        r.refuse = MesDoigtes.memoriser('C', 'maj7', '', [null, null, null, null, null, null]);
        localStorage.removeItem('harmohubMesDoigtes');
        return r;
    });
    check(A.id === 'C|maj7|#x,3,2,0,0,0', `un doigté a une identité stable : accord + cases (${A.id})`);
    check(A.allerRetour === true && A.formatCloud === 'HarmoHub-Doigtes/1/string/[null,3,2,0,0,0]', `format du compte : un document « HarmoHub-Doigtes », les cases en chaîne JSON, et ça se relit à l'identique (${A.formatCloud})`);
    check(JSON.stringify(A.plusRecente) === '[200,true,false]', `la fusion garde la plus récente et dit qu'il faut le noter ici, pas au compte (${JSON.stringify(A.plusRecente)})`);
    check(JSON.stringify(A.retrait) === '[0,true]', `un retrait l'emporte sur une version plus ancienne, et le compte doit l'apprendre (${JSON.stringify(A.retrait)})`);
    check(JSON.stringify(A.revenu) === '[1,0]', `un doigté plus récent que son retrait revient, la trace s'efface (${JSON.stringify(A.revenu)})`);
    check(A.illisibles === 0, `six entrées illisibles ou impossibles (JSON cassé, mauvaise longueur, rien de joué, case 25, case décimale, accord vide) sont ignorées : ${A.illisibles} gardée(s)`);
    check(A.apresSept === '6,5,4,3,2,1', `six doigtés au plus par accord, le plus ancien s'efface (${A.apresSept})`);
    check(A.traceDuPlusAncien === 1, `et son effacement est tracé, pour que le compte l'efface aussi (${A.traceDuPlusAncien})`);
    check(A.remonte === '2,6,5,4,3,1', `mémoriser de nouveau un doigté connu le fait remonter en tête sans le doubler (${A.remonte})`);
    check(A.autreBasse === 0 && A.autreQualite === 0, 'les doigtés de C maj7 ne sont pas ceux de C maj7 sur basse E, ni ceux de C maj');

    // ======================================================================================================
    console.log('\n=== B. Les gestes : cadenas, autre morceau, popover, retrait, dessin ===');
    await guitareAffichee(p);
    await choisirCase(p, 0);
    let l = await liste(p);
    exiger(l.length >= 3 && l.every(x => !x.endsWith('*')), `Mes doigtés est vide : Cmaj7 a ses doigtés calculés (${l.length}), aucun n'en vient`);
    await appui(p, '#guitar-next');
    const choisi = (await liste(p))[1];
    await appui(p, '#guitar-lock-btn');
    check(JSON.stringify(await mes(p, 'C', 'maj7')) === JSON.stringify([choisi]), `le cadenas retient le doigté verrouillé (${choisi}) dans Mes doigtés`);
    check(await p.evaluate(() => !!window.app.guitarDisplayLock), 'et le cadenas est bien posé sur cette case (comme avant)');
    await appui(p, '#guitar-lock-btn');
    l = await liste(p);
    check(!await p.evaluate(() => !!window.app.guitarDisplayLock) && l[0] === choisi + '*', `libéré, le doigté reste le premier proposé et vient de Mes doigtés (${l[0]})`);
    check(l.filter(x => x.replace('*', '') === choisi).length === 1, 'il n\'est pas compté deux fois dans la liste');
    await appui(p, '#guitar-nav-label');
    check(await p.locator('#guitar-doigtes-pop .doigte-mien').count() === 1 && await p.evaluate(() => document.querySelector('#guitar-doigtes-pop .doigte-choix:nth-child(1)').classList.contains('doigte-mien')), 'la popover le marque et le met en premier');
    check((await texte(p, '#guitar-doigtes-pop .doigte-mien .doigte-etiq')).includes('Mon doigté'), 'son étiquette courte dit « Mon doigté »');
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);

    // Un AUTRE morceau (même appareil, même liste) : le doigté y est proposé en premier, sans cadenas.
    await p.evaluate(graine, 's2'); await p.reload(); await p.waitForTimeout(900);
    await guitareAffichee(p); await choisirCase(p, 0);
    l = await liste(p);
    const titre = await p.evaluate(() => loadProgressionSections()[0].title);
    exiger(titre === 'Refrain', `on est bien dans l'autre morceau (« Autre », sa partie s'appelle « Refrain » : « ${titre} »)`);
    check(l[0] === choisi + '*' && !await p.evaluate(() => !!window.app.guitarDisplayLock), `autre morceau, même accord : le doigté verrouillé ailleurs est le premier proposé, sans cadenas (${l[0]})`);
    await choisirCase(p, 1);
    check((await liste(p)).every(x => !x.endsWith('*')), 'un autre accord (Fmaj7) n\'en reçoit aucun');
    await choisirCase(p, 0);

    // La popover : « × » en deux appuis.
    await appui(p, '#guitar-nav-label');
    exiger(await p.locator('#guitar-doigtes-pop .doigte-mien .doigte-retirer').count() === 1, 'la vignette de Mes doigtés porte un « × »');
    check(await p.evaluate(() => getComputedStyle(document.querySelector('#guitar-doigtes-pop .doigte-retirer')).opacity) === '0', 'le « × » est discret : il n\'apparaît qu\'au survol de la vignette');
    await appui(p, '#guitar-doigtes-pop .doigte-retirer');
    check((await texte(p, '#guitar-doigtes-pop .doigte-retirer')) === 'Retirer ?' && (await mes(p, 'C', 'maj7')).length === 1, 'un premier appui arme « Retirer ? » sans rien retirer');
    await p.waitForTimeout(3300);
    check((await texte(p, '#guitar-doigtes-pop .doigte-retirer')) === '×' && (await mes(p, 'C', 'maj7')).length === 1, 'sans second appui dans les trois secondes, il se désarme');
    await appui(p, '#guitar-doigtes-pop .doigte-retirer'); await appui(p, '#guitar-doigtes-pop .doigte-retirer');
    check((await mes(p, 'C', 'maj7')).length === 0 && (await liste(p)).every(x => !x.endsWith('*')), 'le second appui le retire de Mes doigtés : la liste de l\'accord redevient celle du calcul');
    check(await p.locator('#guitar-doigtes-pop .doigte-mien').count() === 0 && await p.locator('#guitar-doigtes-pop .doigte-choix').count() >= 2, 'la popover, restée ouverte, ne le montre plus et garde les autres doigtés');
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);

    // Un doigté dessiné, verrouillé ou envoyé à la grille.
    await choisirCase(p, 1);
    const ouvrirDessin = async () => { await p.click('#guitar-edit-btn', { force: true }); await p.waitForTimeout(250); await p.click('#guitar-edit-tab-draw'); await p.waitForTimeout(250); };
    const poser = async (s, f) => {
        const c = await p.evaluate(([s, f]) => { const r = document.querySelector('#guitar-edit-neck svg').getBoundingClientRect(), vb = document.querySelector('#guitar-edit-neck svg').viewBox.baseVal; const k = r.width / vb.width; return { x: r.left + (f === 0 ? 11 : 20 + (f - 0.5) * 30) * k, y: r.top + (8 + (5 - s) * 16) * k }; }, [s, f]);
        await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(150);
    };
    await ouvrirDessin();
    await poser(1, 0); await poser(4, 1); await poser(5, 0);
    await p.click('#guitar-draw-validate'); await p.waitForTimeout(250);
    exiger(await p.locator('#guitar-draw-lock').count() === 1, 'le dessin d\'un Am est reconnu : « Verrouiller » est proposé');
    await p.click('#guitar-draw-lock'); await p.waitForTimeout(300);
    check(JSON.stringify(await mes(p, 'A', 'min')) === JSON.stringify(['x,0,x,x,1,0']), `un doigté dessiné puis verrouillé rejoint Mes doigtés, pour l'accord joué à la guitare (${JSON.stringify(await mes(p, 'A', 'min'))})`);
    await choisirCase(p, 0); // une case sans doigté verrouillé : la fenêtre repart d'un manche vierge (la première garde son Am dessiné)
    await ouvrirDessin();
    await poser(1, 3); await poser(2, 2); await poser(3, 0); await poser(4, 1); await poser(5, 0);
    await p.click('#guitar-draw-validate'); await p.waitForTimeout(250);
    await p.click('#guitar-draw-send'); await p.waitForTimeout(400);
    check(JSON.stringify(await mes(p, 'C', 'maj')) === JSON.stringify(['x,3,2,0,1,0']), `un doigté dessiné et envoyé à la grille rejoint Mes doigtés (${JSON.stringify(await mes(p, 'C', 'maj'))})`);

    // ======================================================================================================
    console.log('\n=== C. Le compte : ce qui part, ce qui arrive, ce qui est retiré ailleurs ===');
    await choisirCase(p, 0);
    await p.evaluate(() => {
        // Un faux compte et un faux Firestore, rien que pour ce banc : un document par chemin, des écouteurs qu'on déclenche à la main.
        const docs = {}, ecouteurs = {};
        const ref = (slug) => ({
            onSnapshot: (cb) => { ecouteurs[slug] = cb; return () => { delete ecouteurs[slug]; }; },
            collection: () => ({ doc: () => ref(slug + '/x') }),
        });
        const db = {
            collection: () => ({ doc: () => ({ collection: () => ({ doc: (slug) => ref(slug) }), set: () => Promise.resolve(), get: () => Promise.resolve({ exists: false }) }) }),
            runTransaction: (fn) => Promise.resolve(fn({
                get: () => Promise.resolve({ exists: false, data: () => null }),
                set: (r, d) => { docs[d.app] = JSON.parse(JSON.stringify(d)); },
            })),
        };
        window.__faux = { docs, ecouteurs };
        window.__vraiSynchro = window.SYNCHRO;
        window.SYNCHRO = { etat: { utilisateur: { uid: 'u-test' }, db } };
    });
    await p.waitForTimeout(2600);
    const envoi = await p.evaluate(() => { const d = window.__faux.docs['HarmoHub-Doigtes']; return d ? { n: d.entrees.length, cles: d.entrees.map(e => e.root + e.quality).sort().join(), json: typeof d.entrees[0].json } : null; });
    exiger(!!envoi, 'connecté au compte, Mes doigtés écrit son document');
    check(envoi.n === 2 && envoi.cles === 'Amin,Cmaj' && envoi.json === 'string', `le document porte les deux doigtés dessinés (${envoi.cles}), cases en chaîne JSON`);
    await p.evaluate(() => MesDoigtes.memoriser('D', 'min', '', [null, null, 0, 2, 3, 1]));
    await p.waitForTimeout(1500);
    check(await p.evaluate(() => window.__faux.docs['HarmoHub-Doigtes'].entrees.length) === 3, 'un doigté retenu ensuite part de lui-même (3 dans le document)');
    // Un doigté qui arrive du compte (autre appareil) rejoint la liste de l'accord affiché, en tête.
    const avant = await liste(p);
    await p.evaluate(() => {
        const maintenant = Date.now() + 5000;
        const doc = MesDoigtes._versDocument({ entrees: MesDoigtes._depuisDocument({ entrees: [{ root: 'C', quality: 'maj7', bass: '', at: maintenant, cree: maintenant, json: '[8,7,9,9,8,8]' }] }).entrees, supprimes: {} });
        window.__faux.ecouteurs['harmohub-doigtes']({ exists: true, data: () => doc });
    });
    await p.waitForTimeout(500);
    l = await liste(p);
    check(avant.every(x => !x.endsWith('*')) && l[0] === '8,7,9,9,8,8*', `un doigté reçu du compte passe en tête de Cmaj7 sans rien faire (${l[0]})`);
    check(await p.evaluate(() => window.app.guitarFingeringIndex) === 0, 'et c\'est celui qui est affiché');
    // Retiré sur un autre appareil : disparu ici.
    await p.evaluate(() => {
        const id = MesDoigtes.mes('C', 'maj7', '')[0].id;
        window.__faux.ecouteurs['harmohub-doigtes']({ exists: true, data: () => ({ app: 'HarmoHub-Doigtes', schema: 1, entrees: [], supprimes: [{ id, ts: Date.now() + 9000 }] }) });
    });
    await p.waitForTimeout(500);
    check((await mes(p, 'C', 'maj7')).length === 0 && (await liste(p)).every(x => !x.endsWith('*')), 'un retrait fait ailleurs retire le doigté ici, et la liste de l\'accord redevient celle du calcul');
    await p.evaluate(() => { window.SYNCHRO = window.__vraiSynchro; });
    await p.waitForTimeout(1300);
    check(await p.evaluate(() => Object.keys(window.__faux.ecouteurs).includes('harmohub-doigtes')) === false, 'déconnecté, il n\'écoute plus le compte');
    await p.close();

    // ======================================================================================================
    console.log('\n=== D. Téléphone : rien n\'a bougé tant que Mes doigtés est vide ===');
    const t = await ouvrir({ width: 390, height: 844 }, 's1');
    await guitareAffichee(t);
    await choisirCase(t, 0);
    l = await liste(t);
    exiger(l.length >= 3, `téléphone : Cmaj7 propose ses doigtés calculés (${l.length})`);
    check(l.every(x => !x.endsWith('*')) && await t.locator('.doigte-retirer, .doigte-mien').count() === 0, 'téléphone : aucun doigté ne vient de Mes doigtés, aucun « × » ni « Mon doigté »');
    await t.close();

    check(erreurs.length === 0, `aucune erreur de page ni de console${erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''}`);
    await nav.close();
    bilan();
})().catch(e => { console.log('FATAL', e); process.exit(1); });
