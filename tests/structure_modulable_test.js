// LA STRUCTURE MODULABLE : occurrences, clic droit, commentaires.
//
// RETOURS UTILISATEUR, mot pour mot :
//   « La structure me semble trop rigide. J'ai besoin de plusieurs fois du même couplet, je suis obligé de
//     dupliquer plusieurs fois mes couplets dans l'écran principal avec les accords pour que ça fonctionne.
//     Et ces couplets doivent être au bon endroit. J'aimerais pouvoir définir un seul couplet, et le
//     dupliquer au besoin dans la structure. »
//   « Ajoute des options avec clic droit (supprimer, dupliquer, renommer). »
//   « Je veux pouvoir ajouter des commentaires à la structure. Par exemple : mesure 4 avec batterie
//     uniquement, etc. »
//
// Le modèle : la grille DÉFINIT les parties, une fois chacune ; la structure est une liste d'OCCURRENCES qui
// y renvoient par identifiant. Ce banc éprouve d'abord que dupliquer ne copie AUCUN accord, ensuite que rien
// ne se perd (partie supprimée de la grille, morceau rechargé, synchro).
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('structure modulable');
const bruit = require('./_harness').estBruitReseau;

const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
// Trois parties DÉFINIES UNE FOIS : Intro (2 mes.), Couplet (4 mes.), Refrain (4 mes.).
const PROG = { sections: [
    { title: 'Intro', chords: [mk('B', 'min7', 4), mk('D', 'maj7', 4)] },
    { title: 'Couplet', chords: [mk('B', 'min7', 8), mk('D', 'maj7', 8)] },
    { title: 'Refrain', chords: [mk('C#', 'min7', 8), mk('F#', 'min', 8)] },
] };

plan(44);

(async () => {
    const navigateur = await chromium.launch();
    const erreurs = [];
    const page = await navigateur.newPage({ viewport: { width: 1300, height: 950 } });
    page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !bruit(m.text())) erreurs.push('console: ' + m.text()); });
    await page.addInitScript((pr) => { if (!sessionStorage.getItem('__init')) { localStorage.setItem('myProgression', JSON.stringify(pr)); sessionStorage.setItem('__init', '1'); } }, PROG);
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.click('#structure-btn');
    await page.waitForTimeout(400);
    if (!exiger(await page.isVisible('#structure-overlay'), 'la fenêtre Structure s\'ouvre')) return bilan();

    const lire = () => page.evaluate(() => ({
        deroule: document.querySelector('.struct-deroule')?.innerText.replace(/\s+/g, ' ').trim() || '',
        somme: document.querySelector('.struct-somme').innerText.replace(/\s+/g, ' ').trim(),
        lignes: [...document.querySelectorAll('.struct-row')].map(r => ({
            titre: r.querySelector('.struct-title').textContent,
            pos: r.querySelector('.struct-pos')?.textContent || '',
            rep: r.querySelector('.struct-rep')?.textContent || '',
            accords: r.querySelector('.struct-chords')?.textContent.trim() || '',
            notes: [...r.querySelectorAll('.struct-note')].map(n => n.innerText.replace(/\s+/g, ' ').trim()),
        })),
    }));
    const tampon = () => page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')));
    const clicDroit = async (i) => { await page.locator('.struct-row').nth(i).click({ button: 'right', position: { x: 60, y: 14 } }); await page.waitForTimeout(150); };
    const menu = (a) => page.click(`#struct-menu [data-struct-ctx="${a}"]`);

    // ---- Départ : déduite de la grille, rien n'a changé pour un morceau existant ----
    let v = await lire();
    check(v.lignes.map(l => l.titre).join() === 'Intro,Couplet,Refrain', 'sans arrangement, la structure se déduit de la grille : un morceau existant se lit comme avant');
    check((await tampon()).structure === undefined, 'et rien n\'est écrit tant qu\'on n\'a rien arrangé');
    check(v.lignes.every(l => l.pos), 'chaque occurrence indique ses mesures de départ et de fin');

    // ---- 2. UN SEUL COUPLET, DUPLIQUÉ DANS LA STRUCTURE ----
    await clicDroit(1);
    check(await page.isVisible('#struct-menu'), 'clic droit sur une partie : un menu s\'ouvre');
    const entrees = await page.evaluate(() => [...document.querySelectorAll('#struct-menu [data-struct-ctx]')].map(b => b.dataset.structCtx));
    check(['dupliquer', 'renommer', 'commentaire', 'supprimer'].every(a => entrees.includes(a)), `avec dupliquer, renommer, commenter, supprimer — ${entrees}`);
    await menu('dupliquer');
    await page.waitForTimeout(300);
    v = await lire();
    check(v.lignes.map(l => l.titre).join() === 'Intro,Couplet,Couplet,Refrain', `dupliquer ajoute une occurrence JUSTE APRÈS — ${v.lignes.map(l => l.titre)}`);
    check(v.lignes[1].accords === v.lignes[2].accords && v.lignes[1].accords !== '', 'les deux occurrences montrent les mêmes accords');
    const t1 = await tampon();
    check(t1.sections.length === 3, `LA GRILLE N'A PAS GROSSI : toujours 3 parties définies (${t1.sections.length}) — c\'est tout le but`);
    check(t1.structure.length === 4 && t1.structure[1].sid === t1.structure[2].sid && t1.structure[1].id !== t1.structure[2].id,
        'les deux occurrences renvoient à la MÊME partie, avec des identifiants distincts');
    check(JSON.stringify(t1.structure).length < 700, `et ne contiennent aucun accord (${JSON.stringify(t1.structure).length} octets)`);
    check(v.lignes[2].pos === 'mes. 7–10', `les positions suivent : la 2e occurrence tombe à la bonne mesure — « ${v.lignes[2].pos} »`);
    check(/Intro · Couplet · Couplet · Refrain/.test(v.deroule), `le déroulé donne la forme — « ${v.deroule} »`);

    // Corriger la partie dans la grille la corrige PARTOUT.
    await page.evaluate(() => { const t = JSON.parse(localStorage.getItem('myProgression')); t.sections[1].chords[0].root = 'G'; localStorage.setItem('myProgression', JSON.stringify(t)); window.app.renderStructurePanel(); });
    v = await lire();
    check(v.lignes[1].accords.startsWith('| Gm7') && v.lignes[2].accords.startsWith('| Gm7'), 'modifier le couplet dans la grille le modifie à CHAQUE endroit où il sert');

    // Réordonner : la structure bouge, la grille jamais.
    await page.evaluate(() => document.querySelectorAll('.struct-row')[3].querySelector('[data-struct="haut"]').click());
    await page.waitForTimeout(250);
    v = await lire();
    check(v.lignes.map(l => l.titre).join() === 'Intro,Couplet,Refrain,Couplet', 'monter le Refrain le replace dans la structure');
    check((await tampon()).sections.map(s => s.title).join() === 'Intro,Couplet,Refrain', '...sans toucher à l\'ordre de la grille');

    // ---- Ajouter une occurrence d'une partie déjà définie ----
    await page.selectOption('#struct-ajout-select', { label: 'Intro (déjà 1×)' });
    await page.waitForTimeout(250);
    v = await lire();
    check(v.lignes.length === 5 && v.lignes[4].titre === 'Intro', 'le sélecteur ajoute une occurrence d\'une partie existante, en fin de structure');
    check((await tampon()).sections.length === 3, 'sans rien créer dans la grille');

    // ---- 3. RENOMMER ----  (après avoir remonté le Refrain : Intro, Couplet, Refrain, Couplet, Intro — le 2e couplet est l'index 3)
    await clicDroit(3);
    await menu('renommer');
    await page.waitForTimeout(250);
    check(await page.isVisible('#struct-edit-modal'), 'renommer ouvre une fenêtre de saisie (et non un prompt() natif, absent dans l\'app du Dock)');
    check(await page.inputValue('#struct-edit-body input[type=text]') === 'Couplet', 'préremplie avec le nom actuel');
    await page.fill('#struct-edit-body input[type=text]', 'Couplet 2');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    v = await lire();
    check(v.lignes[1].titre === 'Couplet' && v.lignes[3].titre === 'Couplet 2', `le nom ne change que CETTE occurrence — ${v.lignes.map(l => l.titre)}`);
    check((await tampon()).sections[1].title === 'Couplet', 'la partie de la grille garde son titre');
    check(v.lignes[1].accords === v.lignes[3].accords, 'et les deux montrent toujours les mêmes accords');
    await clicDroit(3); await menu('renommer'); await page.fill('#struct-edit-body input[type=text]', ''); await page.click('#struct-edit-ok'); await page.waitForTimeout(200);
    check((await lire()).lignes[3].titre === 'Couplet', 'vider le nom revient au titre de la partie');
    await clicDroit(3); await menu('renommer'); await page.fill('#struct-edit-body input[type=text]', 'Couplet 2'); await page.click('#struct-edit-ok'); await page.waitForTimeout(200);

    // ---- 4. COMMENTAIRES ----
    await clicDroit(3);
    await menu('commentaire');
    await page.waitForTimeout(250);
    await page.fill('#struct-edit-mesure', '4');
    await page.fill('#struct-edit-body textarea', 'batterie uniquement');
    await page.click('#struct-edit-ok');
    await page.waitForTimeout(250);
    v = await lire();
    check(v.lignes[3].notes.length === 1 && /mes\. 4/.test(v.lignes[3].notes[0]) && /batterie uniquement/.test(v.lignes[3].notes[0]),
        `« mesure 4 : batterie uniquement » s'affiche sous la partie — ${JSON.stringify(v.lignes[3].notes)}`);
    check(v.lignes[1].notes.length === 0, 'et PAS sur l\'autre occurrence du même couplet : il décrit CETTE occurrence-ci');
    // un commentaire sur toute la partie, un autre sur la mesure 1 : triés
    await clicDroit(3); await menu('commentaire'); await page.fill('#struct-edit-body textarea', 'jouer plus doucement'); await page.click('#struct-edit-ok'); await page.waitForTimeout(200);
    await clicDroit(3); await menu('commentaire'); await page.fill('#struct-edit-mesure', '1'); await page.fill('#struct-edit-body textarea', 'entrée à la basse'); await page.click('#struct-edit-ok'); await page.waitForTimeout(200);
    v = await lire();
    check(v.lignes[3].notes.length === 3 && /toute la partie/.test(v.lignes[3].notes[0]) && /mes\. 1/.test(v.lignes[3].notes[1]) && /mes\. 4/.test(v.lignes[3].notes[2]),
        `plusieurs commentaires par partie, dans l'ordre des mesures — ${JSON.stringify(v.lignes[3].notes)}`);
    // modifier / supprimer un commentaire en cliquant dessus
    await page.locator('.struct-row').nth(3).locator('.struct-note').nth(2).click();
    await page.waitForTimeout(200);
    check(await page.inputValue('#struct-edit-body textarea') === 'batterie uniquement' && await page.isVisible('#struct-edit-delete'),
        'cliquer un commentaire le rouvre, avec « Supprimer »');
    await page.fill('#struct-edit-body textarea', 'batterie seule'); await page.click('#struct-edit-ok'); await page.waitForTimeout(200);
    check((await lire()).lignes[3].notes[2].includes('batterie seule'), 'il se modifie');
    await page.locator('.struct-row').nth(3).locator('.struct-note').nth(1).click(); await page.waitForTimeout(150);
    await page.click('#struct-edit-delete'); await page.waitForTimeout(200);
    check((await lire()).lignes[3].notes.length === 2, 'et se supprime');
    await clicDroit(3); await menu('commentaire'); await page.fill('#struct-edit-body textarea', '   '); await page.click('#struct-edit-ok'); await page.waitForTimeout(150);
    check((await lire()).lignes[3].notes.length === 2, 'un commentaire vide n\'est pas enregistré');

    // ---- SUPPRIMER : l'occurrence, pas la partie ----
    await clicDroit(4); await menu('supprimer'); await page.waitForTimeout(250);
    v = await lire();
    check(v.lignes.length === 4 && (await tampon()).sections.length === 3, 'supprimer retire l\'OCCURRENCE de la structure, la partie reste définie dans la grille');
    check(/retirée de la structure/i.test(await page.textContent('#toast')), 'et le dit');

    // ---- PERSISTANCE : le morceau emporte sa structure ----
    await page.evaluate(() => { document.getElementById('structure-overlay').hidden = true; });
    await page.evaluate(() => window.app.createNewSongFromCurrentState('Morceau structuré'));
    const enreg = await page.evaluate(() => loadSongs()[0]);
    check(Array.isArray(enreg.structure) && enreg.structure.length === 4, `le morceau enregistré contient sa structure (${enreg.structure && enreg.structure.length} occurrences)`);
    check(enreg.sections.every(p => p.sid), 'et les parties portent leur identifiant — sans lui, la structure ne retrouverait pas ses parties');
    await page.evaluate(() => { window.app.newSong(true); });
    await page.waitForTimeout(300);
    check((await tampon()).structure === undefined, 'un nouveau morceau repart sans structure héritée du précédent');
    await page.evaluate(() => window.app.loadSong(loadSongs()[0].id));
    await page.waitForTimeout(300);
    await page.click('#structure-btn'); await page.waitForTimeout(300);
    v = await lire();
    check(v.lignes.map(l => l.titre).join() === 'Intro,Couplet,Refrain,Couplet 2' && v.lignes[3].notes.length === 2,
        `rouvert, le morceau retrouve sa structure, ses noms et ses commentaires — ${v.lignes.map(l => l.titre)}`);

    // ---- PARTIE SUPPRIMÉE DE LA GRILLE : on le voit, on ne perd rien en silence ----
    await page.evaluate(() => { const t = JSON.parse(localStorage.getItem('myProgression')); t.sections = t.sections.filter(s => s.title !== 'Refrain'); localStorage.setItem('myProgression', JSON.stringify(t)); window.app.renderStructurePanel(); });
    check(await page.locator('.struct-orpheline').count() === 1, 'une occurrence dont la partie n\'existe plus reste affichée, barrée');
    check(!!(await page.locator('.struct-orpheline .struct-measures').textContent()).includes('n\'existe plus'), 'avec la raison');
    await page.locator('.struct-orpheline [data-struct="supprimer"]').click(); await page.waitForTimeout(200);
    check(await page.locator('.struct-orpheline').count() === 0, 'et on peut la retirer d\'un clic');

    // ---- GRILLE : dupliquer la partie copie son identifiant ; il est redonné ----
    const dup = await page.evaluate(() => { const t = JSON.parse(localStorage.getItem('myProgression')); t.sections.push(JSON.parse(JSON.stringify(t.sections[0]))); localStorage.setItem('myProgression', JSON.stringify(t)); assurerIdentifiantsParties(); return JSON.parse(localStorage.getItem('myProgression')).sections.map(s => s.sid); });
    check(new Set(dup).size === dup.length, '« dupliquer la partie » dans la grille copie son identifiant : le doublon en reçoit un neuf');

    // ---- PAROLES : répétitions totales ----
    const rep = await page.evaluate(() => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ sid: 'pA', title: 'Couplet', chords: [{ root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' }] }],
            structure: [{ id: 'a', sid: 'pA', rep: 2, notes: [] }, { id: 'b', sid: 'pA', rep: 1, notes: [] }] }));
        return window.app.repetitionsDansStructure(loadProgressionSections()[0]);
    });
    check(rep === 3, `Paroles reçoit le nombre de passages TOTAL d'une partie (2 + 1 = ${rep})`);

    // ---- IMPRESSION : les commentaires y sont, les commandes non ----
    await page.evaluate(() => { localStorage.setItem('myProgression', JSON.stringify({ sections: [{ sid: 'pA', title: 'Couplet', chords: [{ root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' }] }],
        structure: [{ id: 'a', sid: 'pA', rep: 1, notes: [{ mesure: 1, texte: 'batterie seule' }] }] })); window.app.renderStructurePanel(); });
    const feuille = await page.evaluate(() => { const f = window.app.fabriquerPagesFeuille(); return { t: f.pages.textContent, cmd: f.pages.querySelectorAll('.struct-actions, .struct-ajout, button, select').length }; });
    check(/batterie seule/.test(feuille.t) && feuille.cmd === 0, 'la feuille imprimée / PDF contient les commentaires et aucune commande');

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.slice(0, 2).join(' | ')})`);
    await navigateur.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
