// L'ÉDITEUR DE NOTES : NOTES MANUELLES ET BANDE D'INTENSITÉ (refonte, lot 9d), avec de vrais gestes.
//
// CE QUE DEMANDE LA MAQUETTE VALIDÉE (docs/refonte.md) : « Notes ajoutées à la main en pointillés + pastille ambre sur la case + « Revenir à
// l'automatique » dans l'inspecteur. Bande d'intensité (le « mode studio » actuel) sous les notes. » Décisions du 05/11 : les barres des accords
// voisins s'affichent, pâles et non modifiables ; une croche réglée à la main passe en ambre ; les pointillés valent partout à l'ordinateur
// (éditeur, petit séquenceur de l'inspecteur, accords voisins).
//
// CE QUE LE BANC TIENT :
//   A. la porte Intensité : le bouton du mode studio, même logo, rangé après Voix, à la jauge, allumé en bleu ;
//   B. la bande collée en bas de la vue (en haut comme en bas du défilement), qui s'ajoute aux 170px de notes du réduit, « Int. » dans la
//      gouttière, les voisins pâles et sans clic, à leur vraie valeur, l'ambre d'une croche réglée ;
//   C. le glissé sur une barre : ambre aussitôt, écrit dans le morceau dès le relâchement (Ctrl+S juste après le garde), UNE annulation par
//      geste, double-clic compris ;
//   D. un clic sur la bande, entre deux barres, ne dessine rien dans la case cachée dessous ;
//   E. la barre de la note choisie est cerclée de blanc ;
//   F. une note posée à la main : pointillés, presque vide, la pastille ambre de la case en direct, les notes libres des voisins en pointillés ;
//   G. « Revenir à l'automatique » depuis l'inspecteur, éditeur ouvert : la note et la pastille s'en vont, Ctrl+Z les rend, Ctrl+Y les reprend ;
//   H. la gomme sur la note manuelle : la pastille s'éteint en direct ;
//   I. le petit séquenceur de l'inspecteur : mêmes pointillés, rangée d'intensité d'avant (ni bande, ni voisins) ;
//   J. la bande est mémorisée par appareil ;
//   K. le téléphone n'a pas bougé (lot 10) : ni pointillés, ni bande collée, « Studio » et « Mode studio » à leur place d'avant.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('éditeur de notes : notes manuelles et intensité');
const { estBruitReseau } = require('./_harness');

plan(59);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
// C (48 52 55) en cours ; F 2e renversement avec un FA4 ajouté à la main (une doublure : elle ne renomme pas l'accord) et sa première croche
// réglée à 30 % ; G7 joué à 90 % ; Cadd9.
const graine = () => {
    const mk = (r, q, octave, inversion = 0) => ({ root: r, quality: q, beats: 4, inversion, drop: 'none', octave, bass: null, playStyle: 'held' });
    const S = [{ title: 'Couplet', chords: [mk('C', 'maj', 3), mk('F', 'maj', 2, 2), mk('G', 'dom7', 2, 1), mk('C', 'add9', 3)] }];
    S[0].chords[1].extraNotes = [{ note: 'F', octave: 4 }];
    S[0].chords[1].intensityPerStep = { 0: 30 };
    S[0].chords[2].intensity = 90;
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    localStorage.removeItem('harmohubSeqDockHeight');
    localStorage.removeItem('harmohubSeqAjuster');
    localStorage.removeItem('harmohubSeqVoix');
    localStorage.removeItem('harmohubStudioMode');
    sessionStorage.setItem('cc_accueil_vu', '1');
};
const AMBRE = 'rgb(224, 179, 106)';

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport, reseme = true) => {
        const p = await nav.newPage({ viewport });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        if (reseme) await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const clic = async (p, sel, ms = 500) => { await p.click(sel); await p.waitForTimeout(ms); };
    const caseGrille = (i) => `#progression-sections .chord-grid[data-section="0"] .grid-cell[data-index="${i}"]`;
    // Amène un élément de la bande défilante sous les yeux (ce que ferait la molette), puis donne son centre.
    const centre = async (p, sel) => {
        const el = await p.$(sel);
        await el.evaluate(e => e.scrollIntoView({ block: 'center', inline: 'nearest' }));
        await p.waitForTimeout(150);
        const b = await el.boundingBox();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
    };
    const cliquerEn = async (p, pt, ms = 500) => { await p.mouse.move(pt.x, pt.y); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(ms); };
    const sauve = (p, i) => p.evaluate((i) => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[i], i);
    const pastilles = (p) => p.evaluate(() => [...document.querySelectorAll('#progression-sections .cell-perso')].map(e => +e.closest('.grid-cell').dataset.index));
    const manuelles = (p) => p.evaluate(() => [...document.querySelectorAll('#arp-sequencer .seq-note.manuelle')].map(n => ({ bord: getComputedStyle(n).borderTopStyle, fond: getComputedStyle(n).backgroundColor })));
    const bande = (p) => p.evaluate(() => {
        const sc = document.querySelector('#arp-sequencer .seq-scroll');
        const b = sc.querySelector('.seq-vel-band');
        const rs = sc.getBoundingClientRect();
        // Le bas de ce qu'on VOIT des notes : le bord de la vue, ou la fin de la grille si on est tout en bas (sous elle, la marge de la vue est vide).
        const basGrille = sc.querySelector('.seq-grid').getBoundingClientRect().bottom;
        return { present: !!b, bas: b ? Math.round(b.getBoundingClientRect().bottom) : null, basVue: Math.round(Math.min(rs.top + sc.clientTop + sc.clientHeight, basGrille)), haut: sc.clientHeight, scrollTop: sc.scrollTop, scrollMax: sc.scrollHeight - sc.clientHeight };
    });

    // ======================================================================================================
    console.log('\n=== A. La porte Intensité : le bouton du mode studio, après Voix ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    await clic(p, caseGrille(0), 400);
    await clic(p, '#grid-zoom', 900);
    exiger(await p.evaluate(() => window.app._editeurNotesActif && window.app.editingIndex === 0), 'l\'éditeur de notes est ouvert sur le premier accord');
    const porte = await p.evaluate(() => {
        const b = document.getElementById('toggle-studio-mode'), v = document.getElementById('editeur-notes-voix');
        const rb = b.getBoundingClientRect(), rv = v.getBoundingClientRect();
        return { dansLaRangee: !!b.closest('#editeur-notes-tete'), apresVoix: rb.left > rv.right && rb.left - rv.right < 14 && Math.abs(rb.top - rv.top) < 2,
            groupe: b.closest('.seq-groupe').dataset.groupe, w: Math.round(rb.width), h: Math.round(rb.height), rayon: getComputedStyle(b).borderTopLeftRadius,
            nom: b.getAttribute('aria-label'), presse: b.getAttribute('aria-pressed'), memeLogo: (() => { const t = document.createElement('div'); t.innerHTML = svgIcon('studio'); return b.innerHTML.trim() === t.innerHTML.trim(); })() };
    });
    check(porte.dansLaRangee && porte.apresVoix && porte.groupe === 'affichage', `Intensité est dans la rangée de l'éditeur, juste après Voix, avec les commandes d'affichage (groupe « ${porte.groupe} »)`);
    check(porte.memeLogo, 'il porte le logo du mode studio, repris tel quel');
    check(porte.w === 32 && porte.h === 32 && porte.rayon === '7px' && porte.nom === 'Intensité', `à la jauge, sans mot (${porte.w}×${porte.h}, ${porte.rayon}, « ${porte.nom} »)`);
    let bd = await bande(p);
    check(porte.presse === 'false' && !bd.present && !(await p.$('#arp-sequencer .seq-vel-bar')), 'éteint au départ : ni bande ni barre');
    const hautEteint = bd.haut;
    await clic(p, '#toggle-studio-mode', 700);
    const allume = await p.evaluate(() => { const b = document.getElementById('toggle-studio-mode'); return { presse: b.getAttribute('aria-pressed'), fond: getComputedStyle(b).backgroundColor, actif: window.app.studioMode }; });
    check(allume.actif && allume.presse === 'true' && allume.fond === 'rgba(47, 129, 247, 0.16)', `allumé, il le dit, en BLEU comme Voix et Ajuster (${allume.fond})`);

    // ======================================================================================================
    console.log('\n=== B. La bande, collée sous les notes ===');
    bd = await bande(p);
    exiger(bd.present, 'la bande d\'intensité est là');
    check(bd.haut - hautEteint === 40, `elle s'AJOUTE au volet réduit : +${bd.haut - hautEteint}px, les notes gardent leur place`);
    check(bd.haut - 40 - 24 === 170, `les 170px de notes du réduit sont toujours là (vue de ${bd.haut}px = règle 24 + notes ${bd.haut - 64} + bande 40)`);
    await p.evaluate(() => { document.querySelector('#arp-sequencer .seq-scroll').scrollTop = 0; }); await p.waitForTimeout(150);
    const enHaut = await bande(p);
    await p.evaluate(() => { const sc = document.querySelector('#arp-sequencer .seq-scroll'); sc.scrollTop = sc.scrollHeight; }); await p.waitForTimeout(150);
    const enBas = await bande(p);
    check(enHaut.scrollMax > 200 && Math.abs(enHaut.bas - enHaut.basVue) <= 1 && Math.abs(enBas.bas - enBas.basVue) <= 1,
        `collée au bas de la vue, qu'on regarde les notes aiguës ou graves : aucune note ne passe dessous (écart ${enHaut.bas - enHaut.basVue} / ${enBas.bas - enBas.basVue}px, ${enHaut.scrollMax}px de défilement)`);
    const lbl = await p.evaluate(() => { const l = document.querySelector('#arp-sequencer .seq-vel-lane-label'), g = document.querySelector('#arp-sequencer .seq-label'); const rl = l.getBoundingClientRect(), rg = g.getBoundingClientRect(); return { txt: l.textContent.trim(), gauche: Math.abs(rl.left - rg.left) <= 1 && rl.width <= rg.width + 1 }; });
    check(lbl.txt === 'Int.' && lbl.gauche, `« ${lbl.txt} » dans la gouttière des touches`);
    const voisins = await p.evaluate(() => [...document.querySelectorAll('#arp-sequencer .seq-vel-ctx')].map(e => ({ accord: +e.dataset.accord, step: +e.dataset.step, reglee: e.classList.contains('reglee'), op: +getComputedStyle(e).opacity, pe: getComputedStyle(e).pointerEvents,
        h: Math.round(e.querySelector('.seq-vel-fill').getBoundingClientRect().height / (e.getBoundingClientRect().height - 2) * 100), img: getComputedStyle(e.querySelector('.seq-vel-fill')).backgroundImage })));
    check([1, 2, 3].every(i => voisins.some(v => v.accord === i)) && voisins.every(v => v.op <= 0.6), `les accords voisins ont leurs barres, pâles (${voisins.length} barres, opacité ${[...new Set(voisins.map(v => v.op))].join('/')})`);
    check(voisins.every(v => v.pe === 'none') && !(await p.$('#arp-sequencer .seq-vel-ctx.seq-vel-bar')), 'elles ne se règlent pas ici : aucun clic, aucune classe de barre réglable');
    const fa = voisins.find(v => v.accord === 1 && v.step === 0), sol = voisins.find(v => v.accord === 2 && v.step === 0);
    check(fa && fa.reglee && fa.img.includes(AMBRE) && Math.abs(fa.h - 30) <= 4, `la croche de F réglée à la main à 30 % est en AMBRE, à sa hauteur (${fa && fa.h} %)`);
    check(sol && !sol.reglee && !sol.img.includes(AMBRE) && Math.abs(sol.h - 90) <= 4, `G7 joue à 90 % : sa barre est à 90 %, et dans le bleu d'origine (${sol && sol.h} %)`);
    const barre = await p.evaluate(() => { const b = document.querySelector('#arp-sequencer .seq-vel-bar[data-step="0"]'); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { vue: !!e && b.contains(e), reglee: b.classList.contains('reglee'), n: document.querySelectorAll('#arp-sequencer .seq-vel-bar').length }; });
    check(barre.vue && !barre.reglee && barre.n === 1, `la barre de l'accord en cours est VISIBLE sans défiler (au premier plan), une seule pour un accord tenu, non réglée`);

    // ======================================================================================================
    console.log('\n=== C. Le glissé sur une barre ===');
    let bb = (await (await p.$('#arp-sequencer .seq-vel-bar[data-step="0"]')).boundingBox());
    const pileAvant = await p.evaluate(() => window.app.seqUndoStack.length);
    await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height - 4); await p.mouse.down();
    await p.mouse.move(bb.x + bb.width / 2, bb.y + 12, { steps: 3 });
    const pendant = await p.evaluate(() => { const b = document.querySelector('#arp-sequencer .seq-vel-bar[data-step="0"]'); return { reglee: b.classList.contains('reglee'), img: getComputedStyle(b.querySelector('.seq-vel-fill')).backgroundImage }; });
    await p.mouse.move(bb.x + bb.width / 2, bb.y + 2, { steps: 3 }); await p.mouse.up();
    await p.waitForTimeout(150);
    check(pendant.reglee && pendant.img.includes(AMBRE), 'la barre passe en ambre PENDANT le geste');
    const vRegle = await p.evaluate(() => window.app.intensityPerStep[0]);
    check(vRegle >= 85, `glissée vers le haut, la croche monte (${vRegle} %)`);
    check((await sauve(p, 0)).intensityPerStep[0] === vRegle, 'écrite dans le morceau dès le relâchement, sans attendre un autre rendu');
    await p.keyboard.press('Control+s'); await p.waitForTimeout(500);
    const enreg = await p.evaluate(() => JSON.parse(localStorage.getItem('harmohubSongs')).find(s => s.id === 's1').sections[0].chords[0].intensityPerStep);
    check(enreg && enreg[0] === vRegle, 'Ctrl+S juste après enregistre la valeur réglée');
    check(await p.evaluate(() => window.app.seqUndoStack.length) === pileAvant + 1, 'le geste a laissé UNE étape d\'annulation');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(500);
    check(await p.evaluate(() => window.app.intensityPerStep[0] === undefined && !document.querySelector('#arp-sequencer .seq-vel-bar[data-step="0"]').classList.contains('reglee')), 'Ctrl+Z rend l\'intensité de l\'accord (la barre redevient bleue)');
    await p.keyboard.press('Control+y'); await p.waitForTimeout(500);
    check(await p.evaluate((v) => window.app.intensityPerStep[0] === v && document.querySelector('#arp-sequencer .seq-vel-bar[data-step="0"]').classList.contains('reglee'), vRegle), 'Ctrl+Y la remet');
    await p.waitForTimeout(700);
    bb = (await (await p.$('#arp-sequencer .seq-vel-bar[data-step="0"]')).boundingBox());
    const pileDbl = await p.evaluate(() => window.app.seqUndoStack.length);
    await p.mouse.dblclick(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(500);
    check(await p.evaluate(() => window.app.intensityPerStep[0] === undefined && !document.querySelector('#arp-sequencer .seq-vel-bar[data-step="0"]').classList.contains('reglee')), 'un vrai double-clic rend la croche à l\'intensité de l\'accord');
    check(await p.evaluate(() => window.app.seqUndoStack.length) === pileDbl + 1, 'le double-clic n\'a laissé qu\'UNE étape d\'annulation (ses deux appuis sont un seul geste)');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(500);
    check(await p.evaluate((v) => window.app.intensityPerStep[0] === v, vRegle), 'un seul Ctrl+Z rend la valeur d\'avant le double-clic');

    // ======================================================================================================
    console.log('\n=== D. La bande prend les clics qui tombent entre deux barres ===');
    const sousBande = await p.evaluate(() => {
        const sc = document.querySelector('#arp-sequencer .seq-scroll');
        sc.scrollTop = 0; // des hauteurs défilent SOUS la bande
        const b = sc.querySelector('.seq-vel-band').getBoundingClientRect();
        const c = sc.querySelector('.seq-cell[data-step="6"]').getBoundingClientRect();
        return { x: c.left + c.width / 2, y: b.top + b.height / 2 };
    });
    await p.waitForTimeout(150);
    const touche = await p.evaluate((pt) => { const e = document.elementFromPoint(pt.x, pt.y); return e ? e.className : ''; }, sousBande);
    const motifAvant = await p.evaluate(() => [document.getElementById('arpPattern').value, JSON.stringify(window.app.extraNotes)].join('|'));
    await cliquerEn(p, sousBande);
    const motifApres = await p.evaluate(() => [document.getElementById('arpPattern').value, JSON.stringify(window.app.extraNotes)].join('|'));
    check(/seq-vel-band/.test(touche) && motifAvant === motifApres, `un clic sur la bande atteint la bande (« ${touche} ») : aucune note dessinée dans la case cachée dessous`);

    // ======================================================================================================
    console.log('\n=== E. La barre de la note choisie ===');
    await cliquerEn(p, await centre(p, '#arp-sequencer .seq-cell[data-voice="0"][data-step="3"]'));
    const choisie = await p.evaluate(() => { const b = document.querySelector('#arp-sequencer .seq-vel-bar[data-step="0"]'); return { sel: window.app.seqSelections.map(s => s.voice + ':' + s.start).join(','), cls: b.classList.contains('choisie'), bord: getComputedStyle(b).borderTopColor }; });
    check(choisie.sel === '0:0' && choisie.cls && choisie.bord === 'rgba(255, 255, 255, 0.85)', `la note choisie (${choisie.sel}) : sa barre est cerclée de blanc (${choisie.bord})`);

    // ======================================================================================================
    console.log('\n=== F. Une note posée à la main ===');
    exiger(JSON.stringify(await pastilles(p)) === '[1]', 'au départ, seule la case de F porte la pastille ambre (sa note ajoutée à la main)');
    await cliquerEn(p, await centre(p, '#arp-sequencer .seq-cell-free[data-midi="60"][data-step="2"]'), 700);
    exiger(await p.evaluate(() => window.app.extraNotes.length === 1 && window.app.extraNotes[0].note === 'C' && window.app.extraNotes[0].octave === 4), 'un clic sur la ligne de DO4 a posé une note ajoutée à la main');
    let man = await manuelles(p);
    check(man.length === 1 && man[0].bord === 'dashed', `elle est dessinée en POINTILLÉS (${man.map(m => m.bord).join(',')})`);
    const alpha = man.length ? +(man[0].fond.match(/rgba\([^)]*,\s*([\d.]+)\)/) || [0, 1])[1] : 1;
    check(alpha <= 0.1, `presque vide : fond à ${Math.round(alpha * 100)} % (une note de l'accord : 38 %)`);
    check(await p.evaluate(() => [...document.querySelectorAll('#arp-sequencer .seq-note:not(.manuelle)')].every(n => getComputedStyle(n).borderTopStyle === 'solid')), 'les notes de l\'accord restent en trait plein');
    check(JSON.stringify(await pastilles(p)) === '[0,1]', 'la case de C porte AUSSITÔT sa pastille ambre, sans attendre un rendu de la grille');
    check(await p.evaluate(() => /une note ajoutée à la main/.test((document.querySelector(`#progression-sections .grid-cell[data-index="0"] .cell-perso`) || {}).title || '')), 'avec son infobulle (« une note ajoutée à la main »)');
    check(JSON.stringify((await sauve(p, 0)).extraNotes) === '[{"note":"C","octave":4}]', 'la note est écrite dans le morceau');
    check(await p.evaluate(() => [...document.querySelectorAll('#arp-sequencer .seq-ctx-note.manuelle')].length >= 1 && [...document.querySelectorAll('#arp-sequencer .seq-ctx-note.manuelle')].every(n => getComputedStyle(n).borderTopStyle === 'dashed')), 'la note ajoutée à la main de l\'accord voisin (F) est en pointillés elle aussi');
    check(await p.evaluate(() => !!document.querySelector('#arp-sequencer .seq-vel-bar[data-step="2"]')), 'sa croche d\'attaque a sa barre dans la bande d\'intensité');

    // ======================================================================================================
    console.log('\n=== G. « Revenir à l\'automatique » depuis l\'inspecteur, éditeur ouvert ===');
    const insp = await p.evaluate(() => { const b = document.getElementById('voicing-perso'); return { vis: !b.hidden && !!b.offsetParent, txt: document.getElementById('voicing-perso-texte').textContent }; });
    check(insp.vis && /une note ajoutée à la main/.test(insp.txt), `l'inspecteur dit pourquoi (« ${insp.txt} ») pendant que l'éditeur est ouvert`);
    await clic(p, '#voicing-perso-auto', 700);
    check(await p.evaluate(() => window.app.extraNotes.length === 0) && (await manuelles(p)).length === 0, '« Revenir à l\'automatique » retire la note, l\'éditeur la retire aussitôt');
    check(JSON.stringify(await pastilles(p)) === '[1]', 'la pastille de C s\'éteint, celle de F reste');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(700);
    check((await manuelles(p)).length === 1 && JSON.stringify(await pastilles(p)) === '[0,1]', 'Ctrl+Z rend la note (en pointillés) et la pastille');
    await p.keyboard.press('Control+y'); await p.waitForTimeout(700);
    check((await manuelles(p)).length === 0 && JSON.stringify(await pastilles(p)) === '[1]', 'Ctrl+Y la retire de nouveau');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(700);
    exiger((await manuelles(p)).length === 1, 'Ctrl+Z la rend pour la suite');

    // ======================================================================================================
    console.log('\n=== H. La gomme sur la note manuelle ===');
    await clic(p, '#en-outil-gomme', 300);
    await cliquerEn(p, await centre(p, '#arp-sequencer .seq-note.manuelle'), 700);
    check(await p.evaluate(() => window.app.extraNotes.length === 0) && JSON.stringify(await pastilles(p)) === '[1]', 'gommée, la note s\'en va et la pastille de la case s\'éteint en direct');
    await clic(p, '#en-outil-selection', 300);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(700);
    exiger((await manuelles(p)).length === 1 && JSON.stringify(await pastilles(p)) === '[0,1]', 'Ctrl+Z la rend (et la pastille)');

    // ======================================================================================================
    console.log('\n=== I. Le petit séquenceur de l\'inspecteur ===');
    await clic(p, '#editeur-notes-fermer', 700);
    await clic(p, caseGrille(0), 500);
    await clic(p, '#seq-zoom', 800);
    exiger(await p.evaluate(() => window.app.seqMode === 'compact' && !window.app._editeurNotesActif && !!document.querySelector('#arp-sequencer .seq-note')), 'le petit séquenceur est ouvert');
    man = await manuelles(p);
    check(man.length === 1 && man[0].bord === 'dashed', 'la note ajoutée à la main y est AUSSI en pointillés (« partout, ordinateur »)');
    const petit = await p.evaluate(() => { const b = document.getElementById('toggle-studio-mode'); return { nom: b.getAttribute('aria-label'), groupe: b.closest('.seq-groupe').dataset.groupe, bande: !!document.querySelector('#arp-sequencer .seq-vel-band, #arp-sequencer .seq-vel-ctx, #arp-sequencer .seq-grid-intensite'), barres: document.querySelectorAll('#arp-sequencer .seq-vel-bar').length, lbl: (document.querySelector('#arp-sequencer .seq-vel-lane-label') || {}).textContent }; });
    check(petit.nom === 'Mode studio' && petit.groupe === 'motif' && !petit.bande && petit.barres >= 1 && petit.lbl === 'Studio', `il garde sa rangée d'avant : « ${petit.nom} » parmi le motif, « ${petit.lbl} », ni bande collée ni voisins`);

    // ======================================================================================================
    console.log('\n=== J. Mémorisée par appareil ===');
    await p.reload(); await p.waitForTimeout(900);
    await clic(p, caseGrille(0), 400);
    await clic(p, '#grid-zoom', 900);
    check(await p.evaluate(() => document.getElementById('toggle-studio-mode').getAttribute('aria-pressed') === 'true' && !!document.querySelector('#arp-sequencer .seq-vel-band')), 'rouverte après un rechargement, la bande est là, le bouton allumé');
    // Depuis un accord du MILIEU (la zone de l'accord voisin, dans l'éditeur) : des voisins des deux côtés.
    await cliquerEn(p, await centre(p, '#arp-sequencer .seq-ctx-nav[data-target-index="2"]'), 800);
    const deuxCotes = await p.evaluate(() => ({ en: window.app.editingIndex, accords: [...new Set([...document.querySelectorAll('#arp-sequencer .seq-vel-ctx')].map(e => +e.dataset.accord))].sort().join(','), fa: !!document.querySelector('#arp-sequencer .seq-vel-ctx.reglee[data-accord="1"][data-step="0"]') }));
    check(deuxCotes.en === 2 && deuxCotes.accords === '0,1,3' && deuxCotes.fa, `sur G7, les barres des voisins d'AVANT comme d'APRÈS (accords ${deuxCotes.accords}), l'ambre de F toujours là`);
    await clic(p, '#toggle-studio-mode', 600);
    check((await bande(p)).haut === hautEteint && !(await p.$('#arp-sequencer .seq-vel-band')), 'éteinte, la bande part et le volet reprend sa hauteur');
    check(await p.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map(e => e.id); return ids.length === new Set(ids).size; }), 'aucun id en double dans la page');
    await p.close();

    // ======================================================================================================
    console.log('\n=== K. Le téléphone a la même bande et les mêmes pointillés (lot 10f) ===');
    p = await ouvrir({ width: 860, height: 900 });
    await clic(p, caseGrille(0), 400);
    await clic(p, '#grid-zoom', 900);
    exiger(await p.evaluate(() => window.app.seqMode === 'continu' && window.app._editeurNotesActif && window.app.editingIndex === 0), 'l\'éditeur de notes est ouvert sur le premier accord');
    exiger(await p.evaluate(() => document.querySelectorAll('#arp-sequencer .seq-ctx-note.manuelle').length >= 1), 'la note ajoutée à la main de F est à l\'écran (accord voisin)');
    const tel = await p.evaluate(() => { const b = document.getElementById('toggle-studio-mode'); return { nom: b.getAttribute('aria-label'), groupe: b.closest('#editeur-notes-barre') ? 'editeur' : 'autre', presse: b.hasAttribute('aria-pressed') }; });
    check(tel.groupe === 'editeur' && tel.presse, `le bouton « ${tel.nom} » est rangé dans l'en-tête de l'éditeur`);
    await clic(p, '#toggle-studio-mode', 700);
    const telBande = await p.evaluate(() => { const b = document.querySelector('#arp-sequencer .seq-vel-band'); const v = document.querySelector('#arp-sequencer .seq-vel-bar'); return { bande: !!b, pos: b ? getComputedStyle(b).position : null, h: v ? Math.round(v.getBoundingClientRect().height) : 0, voisins: document.querySelectorAll('#arp-sequencer .seq-vel-ctx').length }; });
    check(telBande.bande && telBande.pos === 'sticky' && telBande.h === 32 && telBande.voisins > 0, `la bande collée sous les notes : barres de ${telBande.h}px, ${telBande.voisins} voisines pâles`);
    check(await p.evaluate(() => { const n = [...document.querySelectorAll('#arp-sequencer .seq-ctx-note.manuelle')]; return n.length > 0 && n.every(e => getComputedStyle(e).borderTopStyle === 'dashed'); }), 'les notes ajoutées à la main sont en pointillés');
    await p.close();

    check(erreurs.length === 0, `aucune erreur dans la page (${erreurs.length}${erreurs.length ? ' : ' + erreurs.slice(0, 2).join(' | ') : ''})`);
    await nav.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
