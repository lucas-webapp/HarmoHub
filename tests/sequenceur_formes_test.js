// LE SÉQUENCEUR, DEUXIÈME SOUS-LOT (refonte du séquenceur, point D) : formes enregistrées au compte, notes libres, retouche d'un schéma au clic droit,
// vue « Toutes les notes ». De vrais gestes (souris, clavier) ; window.app et loadProgressionSections ne servent qu'à RELIRE l'état.
//
// CE QUE DEMANDE LE CAHIER (docs/refonte-sequenceur.md, section 3 « Barre d'outils » points 3 et 5, « Modifier un schéma », « Vue Toutes les notes »,
// section 4 point 1) :
//   - « Enregistrer la forme » (marque-page de TrainHub) propose d'office « Forme 1 », sélectionné ; Entrée valide, Échap annule. La forme garde les
//     croches ET leurs intensités ; elle s'applique par position ; supprimer une forme : les accords qui la suivaient gardent leurs notes, « À la main ».
//   - les formes vivent sur le COMPTE (Firestore, un document, fusion sans doublon, suppression tracée, hors ligne d'abord) ;
//   - note libre : bouton à gauche, dans la colonne des noms, en face de la règle ; bande nom + octave + « Ajouter C4 » ; une ligne en pointillés sur
//     TOUS les accords, cases normales et cliquables, × pour la retirer ; un motif ne réécrit que les quatre voix ;
//   - clic droit sur une vignette (pas « À la main ») : un schéma 4 × 8 retouché à part, ▶ pour l'entendre, Enregistrer, Annuler, « Rétablir
//     l'original » (les retouches se posent par-dessus), « Supprimer » sur une forme ; les accords qui suivent le schéma le suivent ;
//   - « Toutes les notes » : seulement les hauteurs utilisées par la partie ; une note posée hors de l'accord y est en pointillés.
// Et : une annulation par geste, le téléphone qui n'a pas bougé, les bandes opaques verre allumé.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('séquenceur : formes, notes libres, schémas');
const { estBruitReseau } = require('./_harness');
const { creerNuage, installer } = require('./_firebase_faux');

plan(75);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const DOC = 'users/u1/apps/harmohub-formes';
const graine = (S) => {
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    localStorage.setItem('harmohubSequenceurOuvert', '1');
    sessionStorage.setItem('cc_accueil_vu', '1');
};
const mk = (r, q, extra = {}) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', ...extra });
const PARTIE = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] }];

(async () => {
    const nav = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const surveiller = (p, nom) => {
        p.on('pageerror', e => erreurs.push(`${nom} pageerror: ${e.message}`));
        // L'envoi coupé exprès (partie B) est consigné par l'appli : voulu, pas une panne.
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext|Firebase|firebase|unavailable/.test(m.text())) erreurs.push(`${nom} console: ${m.text()}`); });
    };
    const ouvrir = async (viewport, S = PARTIE, { ctx = null, avant = null } = {}) => {
        const p = ctx ? await ctx.newPage() : await nav.newPage({ viewport });
        surveiller(p, 'page');
        await p.goto(`${BASE}/index.html?nocache=` + Date.now());
        await p.evaluate(graine, S);
        if (avant) await p.evaluate(avant);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const attendre = async (fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await new Promise(r => setTimeout(r, 150)); } return false; };
    const centre = async (p, sel) => { const b = await p.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    const cliquer = async (p, sel, opts = {}) => { const q = await centre(p, sel); await p.mouse.click(q.x, q.y, opts); await p.waitForTimeout(250); };
    const ctrlZ = async (p) => { await p.keyboard.press('Control+z'); await p.waitForTimeout(300); };
    const caseL = (c, r, k) => `#sq-grille .sq-case[data-c="${c}"][data-r="${r}"][data-k="${k}"]`;
    const accord = (p, c, s = 0) => p.evaluate(({ c, s }) => JSON.parse(JSON.stringify(loadProgressionSections()[s].chords[c])), { c, s });
    // Les croches de chaque position (de la basse à l'aiguë), et des notes libres par hauteur, d'un accord enregistré.
    const croches = (p, c, s = 0) => p.evaluate(({ c, s }) => {
        const d = loadProgressionSections()[s].chords[c];
        const e = SequenceurHarmo.lireAccord(d);
        const par = (v) => { const r = []; for (let k = 0; k < e.info.croches; k++) if (e.on.has(v + ':' + k)) r.push(k); return r.join(','); };
        const niv = (v) => { const r = []; for (let k = 0; k < e.info.croches; k++) if (e.niveaux.has(v + ':' + k)) r.push(k + '=' + e.niveaux.get(v + ':' + k)); return r.join(','); };
        const libres = {}; e.info.libres.forEach(v => { libres[e.info.voix[v].midi] = par(v); });
        return { pos: e.info.positions.map(par), niv: e.info.positions.map(niv), basse: e.info.basse != null ? par(e.info.basse) : null, libres, motif: d.motifSeq || null };
    }, { c, s });
    const etiquettes = (p) => p.evaluate(() => [...document.querySelectorAll('#sq-grille .sq-etiq')].map(e => e.textContent.trim()));
    const formes = (p) => p.evaluate(() => FormesSequenceur.formes().map(f => ({ id: f.id, nom: f.nom, v: f.v, n: f.n })));
    const presse = (p, sel) => p.evaluate((sel) => { const b = document.querySelector(sel); return b ? b.getAttribute('aria-pressed') : null; }, sel);

    // ======================================================================================================
    console.log('\n=== A. Enregistrer la forme : nom proposé, Entrée / Échap, croches ET intensités, application par position ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    await cliquer(p, '#sq-grille .sq-nom[data-c="0"]');
    // Le rythme de Cmaj7 : Effacer, puis à la main la basse sur 1 et 3 (la première en « fort »), l'aiguë sur les contretemps.
    await cliquer(p, '#sq-effacer');
    for (const k of [0, 4]) await cliquer(p, caseL(0, 3, k));
    for (const k of [1, 3, 5, 7]) await cliquer(p, caseL(0, 0, k));
    await cliquer(p, '#sq-intensite');
    await cliquer(p, caseL(0, 3, 0));        // normal → fort
    await cliquer(p, '#sq-intensite');
    const avantForme = await croches(p, 0);
    exiger(avantForme.pos[0] === '0,4' && avantForme.pos[3] === '1,3,5,7' && avantForme.niv[0] === '0=fort', 'le rythme de départ est posé à la main (basse 1 et 3, la première forte ; aiguë sur les contretemps)');
    await cliquer(p, '#sq-forme-enregistrer');
    const saisie = await p.evaluate(() => { const c = document.getElementById('sq-forme-nom'); return { vu: !document.getElementById('sq-forme-saisie').hidden, val: c.value, focus: document.activeElement === c, sel: [c.selectionStart, c.selectionEnd], marque: !document.getElementById('sq-forme-enregistrer').hidden }; });
    check(saisie.vu && saisie.val === 'Forme 1' && saisie.focus && saisie.sel[0] === 0 && saisie.sel[1] === 7 && !saisie.marque, 'le marque-page propose « Forme 1 », sélectionné, le curseur dans le champ (et le marque-page s\'efface)');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    check((await formes(p)).length === 0 && await p.evaluate(() => document.getElementById('sq-forme-saisie').hidden), 'Échap annule : aucune forme, la saisie se referme');
    await cliquer(p, '#sq-forme-enregistrer');
    await p.keyboard.press('Control+a'); await p.keyboard.press('Delete'); await p.waitForTimeout(100);
    check(await p.evaluate(() => document.getElementById('sq-forme-valider').disabled), 'un nom vide ne s\'enregistre pas (Enregistrer grisé)');
    await p.keyboard.type('Contretemps'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    const f1 = await formes(p);
    check(f1.length === 1 && f1[0].nom === 'Contretemps', 'Entrée enregistre la forme sous son nom');
    check(f1.length === 1 && f1[0].v[0].join(',') === '0,4' && f1[0].v[3].join(',') === '1,3,5,7' && f1[0].n[0]['0'] === 'fort', 'la forme garde les croches PAR POSITION et leurs intensités (la basse forte)');
    const id1 = f1[0] && f1[0].id;
    check(await presse(p, `#sq-formes [data-sq-motif="${id1}"]`) === 'true' && (await croches(p, 0)).motif === id1, 'la forme apparaît après les motifs, enfoncée : l\'accord dont on l\'a prise la suit');
    check(await p.evaluate((id) => document.querySelectorAll(`#sq-formes [data-sq-motif="${id}"] .sq-vignette span.lit`).length, id1) === 2 + 4, 'sa vignette est dessinée comme le séquenceur (deux croches de basse, quatre de l\'aiguë)');
    // Appliquée à toute la partie (portée par défaut) depuis Am7.
    await cliquer(p, '#sq-grille .sq-nom[data-c="1"]');
    await cliquer(p, `#sq-formes [data-sq-motif="${id1}"]`);
    const apres = await Promise.all([1, 2, 3].map(c => croches(p, c)));
    check(apres.every(e => e.pos[0] === '0,4' && e.pos[3] === '1,3,5,7' && e.pos[1] === '' && e.niv[0] === '0=fort' && e.motif === id1), 'appliquée à « Toute la partie » : chaque accord prend la forme par position, intensités comprises');
    await ctrlZ(p);
    check((await croches(p, 2)).pos[0] === '0,1,2,3,4,5,6,7' && (await croches(p, 2)).motif === null, 'un Ctrl+Z défait l\'application sur toute la partie');
    await cliquer(p, '#sq-grille .sq-nom[data-c="1"]');    // la forme suivante est prise sur Am7 (Cmaj7 suit toujours « Contretemps »)
    await cliquer(p, '#sq-forme-enregistrer');
    check(await p.inputValue('#sq-forme-nom') === 'Forme 1', 'la forme suivante se propose sous le premier nom libre (« Forme 1 », la première s\'appelle « Contretemps »)');
    await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    await cliquer(p, '#sq-forme-enregistrer');
    check(await p.inputValue('#sq-forme-nom') === 'Forme 2', 'puis « Forme 2 »');
    await cliquer(p, '#sq-forme-annuler');
    // Supprimer la forme « Contretemps » : Cmaj7 la suivait.
    await cliquer(p, '#sq-grille .sq-nom[data-c="0"]');
    const avantSuppr = await accord(p, 0);
    await cliquer(p, `#sq-formes [data-sq-suppr="${id1}"]`);
    const apresSuppr = await accord(p, 0);
    check((await formes(p)).every(f => f.id !== id1) && await p.locator(`#sq-formes [data-sq-motif="${id1}"]`).count() === 0, 'le × supprime la forme (elle quitte la barre)');
    check(apresSuppr.arpPattern === avantSuppr.arpPattern && await presse(p, '#sq-motif-main') === 'true', 'l\'accord qui la suivait garde ses notes et passe « À la main »');
    check(await p.evaluate(() => JSON.parse(localStorage.getItem('harmohubFormes')).supprimes) && await p.evaluate((id) => !!JSON.parse(localStorage.getItem('harmohubFormes')).supprimes[id], id1), 'la suppression est TRACÉE (elle partira au cloud et l\'emportera sur une copie plus ancienne)');
    // Accord de trois sons : la forme se rejoue à l'identique sur lui (la basse et l'aiguë gardées, le milieu fondu).
    await p.close();
    p = await ouvrir({ width: 1440, height: 900 }, [{ title: 'Couplet', chords: [mk('C', 'maj'), mk('F', 'maj7')] }]);
    await cliquer(p, '#sq-grille .sq-nom[data-c="0"]');
    await cliquer(p, '#sq-motif-ballade');
    await cliquer(p, '#sq-forme-enregistrer'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    const tri = await croches(p, 0);
    const f3 = (await formes(p))[0];
    await cliquer(p, '#sq-grille .sq-nom[data-c="1"]');
    await cliquer(p, '#sq-portee-accord');
    await cliquer(p, '#sq-motif-plaque');
    await cliquer(p, '#sq-grille .sq-nom[data-c="0"]');
    await cliquer(p, '#sq-motif-plaque');
    await cliquer(p, `#sq-formes [data-sq-motif="${f3.id}"]`);
    check(JSON.stringify((await croches(p, 0)).pos) === JSON.stringify(tri.pos), 'une forme prise sur un accord de trois sons s\'y rejoue à l\'identique');
    await cliquer(p, '#sq-grille .sq-nom[data-c="1"]');
    await cliquer(p, `#sq-formes [data-sq-motif="${f3.id}"]`);
    const quatre = await croches(p, 1);
    check(quatre.pos[0] === tri.pos[0] && quatre.pos[3] === tri.pos[2] && quatre.pos[1] === tri.pos[1] && quatre.pos[2] === tri.pos[1], 'et par position sur un accord de quatre : la basse et l\'aiguë se correspondent, la voix du milieu sert les deux voix du milieu');
    await p.close();

    // ======================================================================================================
    console.log('\n=== B. Les formes vivent sur le compte : deux appareils, suppression partout, hors ligne d\'abord ===');
    const nuage = creerNuage();
    const appareil = async (nom) => {
        const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
        await installer(ctx, nuage, { appareil: nom, uid: 'u1', persister: true });
        const pg = await ouvrir(null, PARTIE, { ctx, avant: () => localStorage.setItem('__fauxSession', '1') });
        return { ctx, p: pg };
    };
    const A = await appareil('A'), B = await appareil('B');
    exiger(await attendre(() => A.p.evaluate(() => FormesSequenceur.connecte())) && await attendre(() => B.p.evaluate(() => FormesSequenceur.connecte())), 'les deux appareils sont connectés au même compte');
    await cliquer(A.p, '#sq-grille .sq-nom[data-c="0"]');
    await cliquer(A.p, '#sq-motif-pompe');
    await cliquer(A.p, '#sq-forme-enregistrer'); await A.p.keyboard.type('Ma pompe'); await A.p.keyboard.press('Enter');
    check(await attendre(() => { const d = nuage.docs.get(DOC); return !!d && d.entrees.some(e => e.nom === 'Ma pompe'); }), 'la forme enregistrée sur A part au cloud, dans le document des formes du compte');
    const entree = (nuage.docs.get(DOC) || { entrees: [] }).entrees.find(e => e.nom === 'Ma pompe') || {};
    check(typeof entree.json === 'string' && JSON.parse(entree.json).v.length === 4, 'son dessin y est une chaîne JSON (Firestore refuse les tableaux imbriqués)');
    check(await attendre(() => B.p.evaluate(() => FormesSequenceur.formes().some(f => f.nom === 'Ma pompe'))) && await attendre(async () => (await B.p.locator('#sq-formes .sq-motif').count()) === 1), 'B la reçoit sans recharger : elle apparaît dans sa barre');
    const idP = await B.p.evaluate(() => FormesSequenceur.formes()[0].id);
    await cliquer(B.p, '#sq-grille .sq-nom[data-c="2"]');
    await cliquer(B.p, '#sq-portee-accord');
    await cliquer(B.p, `#sq-formes [data-sq-motif="${idP}"]`);
    check((await croches(B.p, 2)).motif === idP, 'B l\'applique à un de ses accords');
    // A hors ligne : il supprime la forme et en crée une autre ; rien ne part. De retour en ligne, tout arrive.
    nuage.coupe.add('A');
    await cliquer(A.p, `#sq-formes [data-sq-suppr="${idP}"]`);
    await cliquer(A.p, '#sq-motif-plaque');
    await cliquer(A.p, '#sq-forme-enregistrer'); await A.p.keyboard.type('Hors ligne'); await A.p.keyboard.press('Enter');
    await A.p.waitForTimeout(1500);
    check((nuage.docs.get(DOC) || { entrees: [] }).entrees.some(e => e.nom === 'Ma pompe') && !(nuage.docs.get(DOC) || { entrees: [] }).entrees.some(e => e.nom === 'Hors ligne'), 'hors ligne, rien ne part (et rien n\'est perdu ici : A a déjà sa nouvelle forme)');
    nuage.coupe.delete('A');
    check(await attendre(() => { const d = nuage.docs.get(DOC); return !!d && d.entrees.some(e => e.nom === 'Hors ligne') && !d.entrees.some(e => e.nom === 'Ma pompe') && d.supprimes.some(t => t.id === idP); }, 10000), 'de retour en ligne, la suppression et la nouvelle forme partent (la suppression tracée au cloud)');
    check(await attendre(() => B.p.evaluate((id) => !FormesSequenceur.formes().some(f => f.id === id) && FormesSequenceur.formes().some(f => f.nom === 'Hors ligne'), idP)), 'B perd la forme supprimée sur A et reçoit la nouvelle');
    check(await attendre(async () => await presse(B.p, '#sq-motif-main') === 'true') && (await accord(B.p, 2)).arpPattern.length > 0, 'l\'accord de B qui suivait la forme supprimée passe « À la main », ses notes gardées');
    // Fusion pure : une copie plus ANCIENNE qu'une suppression ne revient pas ; une version plus récente la lève.
    const fusion = await A.p.evaluate(() => {
        const e = (id, at) => ({ id, type: 'forme', nom: id, v: [[0], [], [], []], s: [[], [], [], []], n: [{}, {}, {}, {}], at, cree: at });
        const r1 = FormesSequenceur._fusionner({ entrees: {}, supprimes: { x: 200 } }, { entrees: { x: e('x', 100) }, supprimes: {} });
        const r2 = FormesSequenceur._fusionner({ entrees: {}, supprimes: { x: 200 } }, { entrees: { x: e('x', 300) }, supprimes: {} });
        const r3 = FormesSequenceur._fusionner({ entrees: { y: e('y', 5) }, supprimes: {} }, { entrees: { y: { ...e('y', 9), nom: 'neuf' } }, supprimes: {} });
        return [!r1.fusionne.entrees.x && r1.changeDistant, !!r2.fusionne.entrees.x && !r2.fusionne.supprimes.x, r3.fusionne.entrees.y.nom === 'neuf' && Object.keys(r3.fusionne.entrees).length === 1];
    });
    check(fusion[0] && fusion[1] && fusion[2], 'fusion : une suppression l\'emporte sur une copie plus ancienne, une version plus récente la lève, la plus récente gagne sans doublon');
    await A.ctx.close(); await B.ctx.close();

    // ======================================================================================================
    console.log('\n=== C. Note libre : bouton en face de la règle, bande, une ligne sur tous les accords, × ===');
    const BASSE = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('C', 'maj7', { bass: 'E' })] }];
    p = await ouvrir({ width: 1440, height: 900 }, BASSE);
    await cliquer(p, '#sq-grille .sq-nom[data-c="3"]');
    await cliquer(p, '#sq-motif-monte');     // toute la partie en Arpège ↑ (la basse différente au rythme de la basse)
    const geo = await p.evaluate(() => {
        const b = document.querySelector('.sq-libre-btn').getBoundingClientRect(), regle = document.querySelector('.sq-temps').getBoundingClientRect();
        const etiq = document.querySelector('.sq-etiq').getBoundingClientRect(), col = document.querySelector('.sq-nom').getBoundingClientRect();
        return { droite: b.right <= col.left, regle: b.bottom >= regle.top && b.top <= regle.bottom, dessus: b.bottom <= etiq.top + 1, h: Math.round(b.height), r: getComputedStyle(document.querySelector('.sq-libre-btn')).borderTopLeftRadius };
    });
    check(geo.droite && geo.regle && geo.dessus, 'le bouton « note libre » est dans la colonne des noms, en face de la règle, juste au-dessus des noms de notes');
    check(geo.h === 32 && geo.r === '7px', 'il suit le gabarit (32 px, arrondi 7 px)');
    await cliquer(p, '.sq-libre-btn');
    check(await p.isVisible('#sq-libre-bande') && await p.textContent('#sq-libre-ajouter') === 'Ajouter C4' && await presse(p, '.sq-libre-btn') === 'true', 'il déplie la bande « Note libre », « Ajouter C4 » proposé');
    await cliquer(p, '#sq-libre-bande [data-sq-note="E"]');
    await cliquer(p, '#sq-libre-plus');
    check(await p.textContent('#sq-libre-ajouter') === 'Ajouter E5', 'choisir le nom et monter l\'octave : « Ajouter E5 »');
    const avantLigne = await Promise.all([0, 1, 2, 3].map(c => accord(p, c)));
    const etiqAvant = await etiquettes(p);
    await cliquer(p, '#sq-libre-ajouter');
    const etiqApres = await etiquettes(p);
    check(!(await p.isVisible('#sq-libre-bande')) && etiqApres.length === etiqAvant.length + 1 && etiqApres[0] === 'E5', 'une ligne « E5 » s\'ajoute en haut, la bande se referme');
    check(await p.evaluate(() => { const e = document.querySelector('#sq-grille .sq-etiq'); return e.classList.contains('libre') && !!e.querySelector('.sq-libre-retirer'); }), 'son étiquette est en pointillés, avec un × pour la retirer');
    const apresLigne = await Promise.all([0, 1, 2, 3].map(c => accord(p, c)));
    check(apresLigne.every((d, c) => d.arpPattern === avantLigne[c].arpPattern && !(d.extraNotes || []).length), 'aucun accord ne change de son : la ligne est à la partie, les accords ne portent la note qu\'une fois une croche posée');
    check(await p.evaluate(() => { const L = [...document.querySelectorAll('#sq-grille .sq-case[data-r="0"]')]; return L.length === 32 && L.every(c => !c.classList.contains('sans-voix')); }), 'ses cases sont normales et cliquables sur TOUS les accords (aucune grisée)');
    await ctrlZ(p);
    check((await etiquettes(p)).length === etiqAvant.length, 'un Ctrl+Z retire la ligne ajoutée');
    await p.keyboard.press('Control+y'); await p.waitForTimeout(300);
    exiger((await etiquettes(p))[0] === 'E5', 'Ctrl+Y la remet');
    // Poser une croche sur l'accord à basse différente : la note s'ajoute à lui, la basse garde son rythme (les voix sont renumérotées).
    const avant3 = await croches(p, 3);
    await cliquer(p, caseL(3, 0, 2));
    const c3 = await croches(p, 3), d3 = await accord(p, 3);
    check((d3.extraNotes || []).length === 1 && d3.extraNotes[0].note === 'E' && d3.extraNotes[0].octave === 5 && c3.libres['76'] === '2', 'une croche posée sur la ligne ajoute E5 à CET accord, sur la croche touchée');
    check(c3.basse === avant3.basse && avant3.basse === '0,1,2,3,4,5,6,7' && JSON.stringify(c3.pos) === JSON.stringify(avant3.pos), 'la basse différente et les voix gardent leur rythme (les voix qui suivent la note libre sont renumérotées, rien ne glisse)');
    check(await p.evaluate(() => { const c = document.querySelector('#sq-grille .sq-case[data-c="3"][data-r="0"][data-k="2"]'); return c.classList.contains('on') && c.classList.contains('libre'); }), 'la note libre posée est dessinée en pointillés');
    check((await Promise.all([0, 1, 2].map(c => accord(p, c)))).every(d => !(d.extraNotes || []).length), 'les autres accords ne portent toujours pas la note');
    // Un glissé sur la ligne PEINT d'un accord à l'autre : chacun reçoit la note.
    const g0 = await centre(p, caseL(0, 0, 6)), g1 = await centre(p, caseL(1, 0, 1));
    await p.mouse.move(g0.x, g0.y); await p.mouse.down();
    for (let i = 1; i <= 8; i++) { await p.mouse.move(g0.x + (g1.x - g0.x) * i / 8, g0.y); await p.waitForTimeout(30); }
    await p.mouse.up(); await p.waitForTimeout(300);
    const peint = await Promise.all([0, 1].map(c => croches(p, c)));
    check(peint[0].libres['76'] === '6,7' && peint[1].libres['76'] === '0,1', 'un glissé sur la ligne peint la note d\'un accord à l\'autre (chacun la reçoit)');
    await ctrlZ(p);
    check((await Promise.all([0, 1].map(c => accord(p, c)))).every(d => !(d.extraNotes || []).length), 'un seul Ctrl+Z défait tout le glissé (et les notes ajoutées)');
    // Appliquer un motif garde les notes libres.
    await cliquer(p, '#sq-grille .sq-nom[data-c="3"]');
    await cliquer(p, '#sq-portee-accord');
    await cliquer(p, '#sq-motif-pompe');
    check((await croches(p, 3)).libres['76'] === '2', 'appliquer un motif ne réécrit que les voix de l\'accord : la note libre garde sa croche');
    // Enlever la dernière croche : la note quitte l'accord (pas de voix fantôme), la ligne reste.
    await cliquer(p, caseL(3, 0, 2));
    check(!((await accord(p, 3)).extraNotes || []).length && (await etiquettes(p))[0] === 'E5', 'sa dernière croche enlevée, la note quitte l\'accord (pas de voix fantôme) ; la ligne reste');
    // Le × retire la ligne ET la note de chaque accord qui la porte, en une annulation.
    await cliquer(p, caseL(1, 0, 4));
    await cliquer(p, '.sq-libre-retirer');
    check((await etiquettes(p))[0] !== 'E5' && !((await accord(p, 1)).extraNotes || []).length && !(await p.evaluate(() => loadProgressionSections()[0].notesLibres)), 'le × retire la ligne, et la note (avec ses croches) de chaque accord qui la portait');
    await ctrlZ(p);
    check((await etiquettes(p))[0] === 'E5' && (await croches(p, 1)).libres['76'] === '4', 'un Ctrl+Z rend la ligne et la croche posée');
    await p.close();

    // ======================================================================================================
    console.log('\n=== D. Clic droit sur une vignette : retoucher un schéma, l\'entendre, « Rétablir l\'original » ===');
    p = await ouvrir({ width: 1440, height: 900 });
    await cliquer(p, '#sq-grille .sq-nom[data-c="1"]');
    await cliquer(p, '#sq-portee-partie');
    await cliquer(p, '#sq-motif-monte');
    await cliquer(p, '#sq-motif-main', { button: 'right' });
    check(!(await p.isVisible('#sq-schema')), '« À la main » n\'a pas de clic droit (rien à retoucher)');
    await cliquer(p, '#sq-motif-monte', { button: 'right' });
    const schema = await p.evaluate(() => ({ vu: !document.getElementById('sq-schema').hidden, cases: document.querySelectorAll('#sq-schema-grille .sq-schema-case').length, on: [...document.querySelectorAll('#sq-schema-grille .sq-schema-case.on')].map(b => b.dataset.sqSchema + ':' + b.dataset.k).sort().join(' '), nom: document.getElementById('sq-schema-nom').value, retablir: !document.getElementById('sq-schema-retablir').hidden, suppr: !document.getElementById('sq-schema-supprimer').hidden }));
    check(schema.vu && schema.cases === 32, 'le clic droit sur « Arpège ↑ » déplie un schéma SANS notes de 4 voix × 8 croches');
    check(schema.on === '0:0 0:1 0:2 0:3 0:4 0:5 0:6 0:7 1:1 1:5 2:2 2:6 3:3 3:7' && schema.nom === 'Arpège ↑' && !schema.retablir && !schema.suppr, 'il montre le motif tel qu\'il est (nom compris) ; ni « Rétablir » (pas encore retouché) ni « Supprimer » (motif fourni)');
    const pistes = await p.evaluate(() => { const r = document.getElementById('sq-schema-grille').getBoundingClientRect(), n = document.getElementById('sq-schema-nom').getBoundingClientRect(); return r.right <= n.left && r.width < 260; });
    check(pistes, 'la grille du schéma tient à sa place, à gauche du nom (rien ne se chevauche)');
    // Retouche : l'aiguë frappe aussi sur le 1.
    await cliquer(p, '#sq-schema-grille .sq-schema-case[data-sq-schema="3"][data-k="0"]');
    const avantEcoute = await accord(p, 1);
    await cliquer(p, '#sq-schema-ecouter');
    check(await attendre(() => p.evaluate(() => window.app.isPlaying)) && (await accord(p, 1)).arpPattern === avantEcoute.arpPattern, '▶ fait entendre le schéma sur l\'accord choisi, sans rien écrire');
    await cliquer(p, '#sq-schema-enregistrer');
    check(await p.evaluate(() => !!FormesSequenceur.retouche('monte') && FormesSequenceur.retouche('monte').v[3].join(',') === '0,3,7'), 'Enregistrer garde la RETOUCHE (au compte), par-dessus le motif');
    check(await p.evaluate(() => SequenceurHarmo.MOTIFS.find(m => m.id === 'monte').v[3].join(',') === '3,7'), 'l\'original n\'est jamais perdu (le motif fourni ne change pas)');
    const suivent = await Promise.all([0, 1, 2, 3].map(c => croches(p, c)));
    check(suivent.every(e => e.pos[3] === '0,3,7' && e.motif === 'monte'), 'les accords qui suivent « Arpège ↑ » le suivent dans sa nouvelle version');
    check(await p.evaluate(() => document.getElementById('sq-motif-monte').querySelectorAll('.sq-vignette span.lit').length) === 8 + 2 + 2 + 3 && await p.evaluate(() => document.getElementById('sq-motif-monte').classList.contains('retouche')), 'sa vignette montre la retouche, et dit qu\'il est retouché');
    await ctrlZ(p);
    check((await croches(p, 2)).pos[3] === '3,7', 'un Ctrl+Z rend aux accords leur rythme d\'avant (une annulation)');
    await p.keyboard.press('Control+y'); await p.waitForTimeout(300);
    await cliquer(p, '#sq-motif-monte', { button: 'right' });
    check(await p.isVisible('#sq-schema-retablir'), 'retouché, son clic droit propose « Rétablir l\'original »');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    check(!(await p.isVisible('#sq-schema')) && await p.evaluate(() => !!FormesSequenceur.retouche('monte')), 'Échap referme le schéma sans rien changer');
    await cliquer(p, '#sq-motif-monte', { button: 'right' });
    await cliquer(p, '#sq-schema-retablir');
    check(await p.evaluate(() => !FormesSequenceur.retouche('monte')) && (await Promise.all([0, 1, 2, 3].map(c => croches(p, c)))).every(e => e.pos[3] === '3,7'), '« Rétablir l\'original » retire la retouche, les accords reprennent l\'arpège d\'origine');
    // Une forme de l'utilisateur : son clic droit propose « Supprimer », et un nom changé.
    await cliquer(p, '#sq-forme-enregistrer'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    const idF = (await formes(p))[0].id;
    await cliquer(p, `#sq-formes [data-sq-motif="${idF}"]`, { button: 'right' });
    check(await p.isVisible('#sq-schema-supprimer') && !(await p.isVisible('#sq-schema-retablir')), 'sur une forme de l\'utilisateur : « Supprimer », pas de « Rétablir »');
    await p.fill('#sq-schema-nom', 'Renommée'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    check((await formes(p))[0].nom === 'Renommée' && await p.textContent(`#sq-formes [data-sq-motif="${idF}"]`) === 'Renommée', 'Entrée dans le nom enregistre le schéma sous son nouveau nom');
    await cliquer(p, `#sq-formes [data-sq-motif="${idF}"]`, { button: 'right' });
    await cliquer(p, '#sq-schema-supprimer');
    check((await formes(p)).length === 0 && !(await p.isVisible('#sq-schema')), '« Supprimer » retire la forme et referme le schéma');
    await p.close();

    // ======================================================================================================
    console.log('\n=== E. Vue « Toutes les notes » : les hauteurs utilisées, une note hors de l\'accord ===');
    p = await ouvrir({ width: 1440, height: 900 });
    await cliquer(p, '#sq-grille .sq-nom[data-c="0"]');
    check(await presse(p, '#sq-vue-voix') === 'true' && await presse(p, '#sq-vue-notes') === 'false', 'la vue « Voix » est celle de départ (groupe segmenté Voix / Toutes les notes)');
    await cliquer(p, '#sq-vue-notes');
    const hauteurs = await p.evaluate(() => {
        const t = new Set();
        loadProgressionSections()[0].chords.forEach(d => SequenceurHarmo.voixDe(d).voix.forEach(x => t.add(x.midi)));
        return [...t].sort((a, b) => b - a).map(m => midiToDisplayName(m, false));
    });
    const etiqN = await etiquettes(p);
    check(JSON.stringify(etiqN) === JSON.stringify(hauteurs) && etiqN.length < 20, 'une ligne par hauteur UTILISÉE par la partie, de la plus aiguë à la plus grave (pas 60 lignes)');
    const rA3 = etiqN.indexOf('A3');
    exiger(rA3 >= 0, 'A3 (dans Am7 et Dm7) est une des lignes');
    check(await p.evaluate((r) => !document.querySelector(`#sq-grille .sq-case[data-c="0"][data-r="${r}"][data-k="0"]`).dataset.v, rA3), 'sur Cmaj7, qui n\'a pas de A3, la case est vide mais cliquable');
    await cliquer(p, caseL(0, rA3, 3));
    const cA = await accord(p, 0), crA = await croches(p, 0);
    check((cA.extraNotes || []).length === 1 && cA.extraNotes[0].note === 'A' && cA.extraNotes[0].octave === 3 && crA.libres['57'] === '3', 'y poser une croche ajoute A3 à Cmaj7 (note hors de l\'accord), sur la croche touchée');
    check(await p.evaluate((r) => document.querySelector(`#sq-grille .sq-case[data-c="0"][data-r="${r}"][data-k="3"]`).classList.contains('libre'), rA3), 'elle est en pointillés (ajoutée à la main)');
    await cliquer(p, caseL(1, rA3, 3));
    check((await croches(p, 1)).pos[0] === '0,1,2,4,5,6,7' && !((await accord(p, 1)).extraNotes || []).length, 'sur Am7, la même ligne est sa basse : la case touche sa voix, rien n\'est ajouté');
    await cliquer(p, '#sq-vue-voix');
    check((await etiquettes(p))[0] === 'A3' && await p.evaluate(() => document.querySelector('#sq-grille .sq-etiq').classList.contains('libre')), 'en vue Voix, la note ajoutée devient une ligne de note libre');
    await cliquer(p, '#sq-vue-notes');
    await p.reload(); await p.waitForTimeout(900);
    check(await presse(p, '#sq-vue-notes') === 'true', 'la vue choisie est retenue par l\'appareil');
    await p.close();

    // ======================================================================================================
    console.log('\n=== F. Verre allumé : les bandes restent opaques ; téléphone inchangé ===');
    p = await ouvrir({ width: 1440, height: 900 }, PARTIE, { avant: () => localStorage.setItem('harmohub.glass.v1', '1') });
    await cliquer(p, '#sq-grille .sq-nom[data-c="0"]');
    await cliquer(p, '.sq-libre-btn');
    const fondLibre = await p.evaluate(() => getComputedStyle(document.getElementById('sq-libre-bande')).backgroundColor);
    await cliquer(p, '#sq-motif-plaque', { button: 'right' });
    const fondSchema = await p.evaluate(() => getComputedStyle(document.getElementById('sq-schema')).backgroundColor);
    const verre = await p.evaluate(() => document.documentElement.dataset.glass);
    check(verre === '1' && /^rgb\(/.test(fondLibre) && /^rgb\(/.test(fondSchema), 'verre allumé, les bandes « Note libre » et « Schéma » sont opaques (les notes ne traversent pas leurs boutons)');
    await p.close();
    p = await ouvrir({ width: 390, height: 844 });
    const tel = await p.evaluate(() => ({
        seq: getComputedStyle(document.getElementById('sequenceur')).display,
        bandes: ['sq-schema', 'sq-libre-bande', 'sq-forme-saisie'].every(id => { const e = document.getElementById(id); return e.offsetParent === null; }),
    }));
    check(tel.seq === 'none' && tel.bandes, 'au téléphone : ni séquenceur, ni bande, ni saisie de forme (rien n\'a bougé)');
    await p.close();

    check(erreurs.length === 0, 'aucune erreur de page' + (erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''));
    await nav.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
