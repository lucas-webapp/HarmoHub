// LES CARRÉS DU RYTHME DANS LES CASES, ET LES ACCORDS COURTS (refonte, lot 5b), avec de vrais clics.
//
// CE QUE L'UTILISATEUR A DEMANDÉ : « pour les petits carrés du rythme, c'est pas débile, je pense qu'on peut les garder avec une option dans les paramètres
// pour les afficher ou pas » ; puis, sur les accords d'un temps devenus minuscules dans la fenêtre de 480px : « ça peut arriver quelques fois. Fais au mieux
// pour l'affichage. Ça ne se règle pas en étirant la fenêtre manuellement ? »
//
// CE QUE LE BANC TIENT :
//   • les carrés disent le VRAI rythme : un motif connu (posé à la main) donne, case par case, attaque / tenue / silence — y compris sur un accord coupé
//     en fin de ligne, dont chaque morceau montre SES pas ;
//   • seulement en Détaillé, seulement option allumée, seulement si la case est assez haute ; jamais sur téléphone (inchangé avant le lot 10) ;
//   • l'option est dans Paramètres › Affichage, mémorisée, et SYNCHRONISÉE (comme les degrés) ;
//   • on clique toujours la case à travers eux ;
//   • un accord d'un temps reste lisible : la fenêtre s'élargit d'elle-même si le morceau en contient (pas de 8px) — et une largeur tirée à la main
//     l'emporte toujours ; en dernier recours, le nom passe sur deux lignes.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('carrés du rythme et accords courts');
const { estBruitReseau } = require('./_harness');

plan(27);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
// Motif posé à la main (seqEdited) pour un accord de 4 temps à 3 voix : pas 0 attaque, pas 1 tenu (les 3 voix liées), pas 2-3 silence, pas 4 attaque,
// pas 5-7 tenus, puis rien jusqu'au pas 12 attaque. 16 pas.
const MOTIF = ['0,1,2', '0t,1t,2t', '', '', '0,1,2', '0t,1t,2t', '0t,1t,2t', '0t,1t,2t', '', '', '', '', '0,1,2', '', '', ''].join(';');
const ATTENDU = ['a', 't', '', '', 'a', 't', 't', 't', '', '', '', '', 'a', '', '', ''];
const graine = ({ motif, court }) => {
    const mk = (r, q, b = 4, extra = {}) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', ...extra });
    const chords = [mk('C', 'maj', 4, { seqEdited: true, arpPattern: motif }), mk('F', 'maj7'), mk('G', '7'), mk('A', 'min7', 8)];
    if (court) chords.splice(1, 0, mk('A#', 'maj7', 1), mk('D', 'min7', 3));
    const A = [{ title: 'Couplet', chords }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: A, grilleDensite: 'detail' }]));
    localStorage.setItem('harmohubCurrentSongId', 's1'); localStorage.setItem('myProgression', JSON.stringify({ sections: A }));
    localStorage.removeItem('harmohubRythmeDansCases');
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport, opts = {}) => {
        const p = await nav.newPage({ viewport });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine, { motif: MOTIF, court: !!opts.court });
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const carres = (p, index) => p.evaluate((i) => [...document.querySelectorAll(`#progression-sections .grid-cell[data-index="${i}"] .cell-rythme`)].map(r => [...r.children].map(x => x.className)), index);

    // ======================================================================================================
    console.log('\n=== A. Les carrés disent le vrai rythme ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    exiger(await p.evaluate(() => window.app.grilleDensite === 'detail'), 'le morceau s\'ouvre en Détaillé');
    let c = await carres(p, 0);
    check(c.length === 1 && c[0].length === 16, `un accord de 4 temps porte 16 carrés (${c[0] ? c[0].length : 0})`);
    check(JSON.stringify(c[0]) === JSON.stringify(ATTENDU), `ils suivent son motif, pas par pas : ${c[0] && c[0].map(x => x || '·').join('')} (attendu ${ATTENDU.map(x => x || '·').join('')})`);
    const tenu = await carres(p, 1);
    check(tenu[0] && tenu[0][0] === 'a' && tenu[0].slice(1).every(x => x === 't'), 'un accord « tenu » : une attaque, puis quinze carrés pâles (la note dure)');
    // accord coupé en fin de ligne : 8 temps qui commencent au temps 12 → 4 temps sur la 1re ligne, 4 sur la 2e
    const coupe = await carres(p, 3);
    check(coupe.length === 2 && coupe[0].length === 16 && coupe[1].length === 16, `un accord coupé sur deux lignes : chaque morceau porte SES pas (${coupe.map(x => x.length).join(' + ')})`);
    check(coupe[0][0] === 'a' && coupe[1][0] === 't', 'la note commence sur la 1re ligne (attaque) et se prolonge sur la 2e (tenue, pas une nouvelle attaque)');
    const sousSymbole = await p.evaluate(() => { const cell = document.querySelector('#progression-sections .grid-cell[data-index="0"]'); const r = cell.querySelector('.cell-rythme').getBoundingClientRect(), s = cell.querySelector('.cell-sym').getBoundingClientRect(), k = cell.getBoundingClientRect(); return { sous: r.top >= s.bottom - 1, dans: r.bottom <= k.bottom && r.left >= k.left && r.right <= k.right }; });
    check(sousSymbole.sous && sousSymbole.dans, 'ils sont sous le nom de l\'accord, dans la case');
    // on clique la case à travers eux
    const r0 = await p.locator('#progression-sections .grid-cell[data-index="1"] .cell-rythme').boundingBox();
    await p.mouse.click(r0.x + r0.width / 2, r0.y + r0.height / 2);
    await p.waitForTimeout(300);
    check(await p.evaluate(() => window.app.selectedIndex === 1), 'un clic sur les carrés sélectionne bien la case (ils ne volent pas le clic)');

    // ======================================================================================================
    console.log('\n=== B. Seulement en Détaillé, et seulement si la case est assez haute ===');
    for (const d of ['normal', 'compact']) {
        await p.click(`#grille-densites [data-densite="${d}"]`); await p.waitForTimeout(300);
        check(await p.evaluate(() => document.querySelectorAll('#progression-sections .cell-rythme').length) === 0, `${d === 'normal' ? 'Normal' : 'Compact'} : pas de carrés`);
    }
    // Normal avec des cases agrandies à la poignée (90px) : la place y est, mais ce n'est pas l'affichage Détaillé — pas de carrés. (Sans ce cas, la
    // condition « Détaillé » n'était jamais éprouvée : les cases de Normal et Compact sont de toute façon trop basses — un sabotage l'a montré.)
    await p.click('#grille-densites [data-densite="normal"]'); await p.waitForTimeout(300);
    await p.evaluate(() => window.app.setZoomLevel('classicGrid', 'y', 90 / 64)); await p.waitForTimeout(300);
    check(await p.evaluate(() => window.app.hauteurCaseGrille() >= 64 && document.querySelectorAll('#progression-sections .cell-rythme').length === 0), 'Normal avec des cases de 90px : toujours pas de carrés (c\'est le choix « Détaillé » qui les montre, pas la place)');
    await p.click('#grille-densites [data-densite="detail"]'); await p.waitForTimeout(300);
    check(await p.evaluate(() => document.querySelectorAll('#progression-sections .cell-rythme').length) > 0, 'retour en Détaillé : ils reviennent');
    await p.evaluate(() => window.app.setZoomLevel('classicGrid', 'y', 56 / 64)); await p.waitForTimeout(300);
    check(await p.evaluate(() => document.querySelectorAll('#progression-sections .cell-rythme').length) === 0, 'cases ramenées à 56px (poignée du bas) : plus la place, ils s\'effacent au lieu de recouvrir le nom');
    await p.dblclick('#grille-poignee-bas'); await p.waitForTimeout(300);

    // ======================================================================================================
    console.log('\n=== C. L\'option, dans Paramètres › Affichage ===');
    await p.click('#open-settings'); await p.waitForTimeout(300);
    const bascule = await p.evaluate(() => { const b = document.getElementById('toggle-show-cell-rhythm'); return b ? { etat: b.getAttribute('aria-checked'), libelle: b.closest('.settings-toggle-row').textContent.replace(/\s+/g, ' ').trim(), dansAffichage: !!b.closest('#settings-panel-display') } : null; });
    exiger(!!bascule, 'l\'interrupteur existe');
    check(bascule.dansAffichage && /Rythme de l'accord dans les cases/.test(bascule.libelle) && bascule.etat === 'true', `dans Affichage, allumé par défaut : « ${bascule.libelle} »`);
    await p.click('#toggle-show-cell-rhythm'); await p.waitForTimeout(300);
    await p.click('#settings-close'); await p.waitForTimeout(200);
    check(await p.evaluate(() => document.querySelectorAll('#progression-sections .cell-rythme').length) === 0, 'éteint : plus de carrés en Détaillé');
    check(await p.evaluate(() => localStorage.getItem('harmohubRythmeDansCases')) === '0', 'mémorisé (harmohubRythmeDansCases = 0)');
    check(await p.evaluate(() => Array.isArray(window.REGLAGES_SYNCHRONISES) && window.REGLAGES_SYNCHRONISES.includes('harmohubRythmeDansCases')), 'et SYNCHRONISÉ entre appareils, comme les degrés (dans REGLAGES_SYNCHRONISES)');
    await p.reload(); await p.waitForTimeout(800);
    check(await p.evaluate(() => document.querySelectorAll('#progression-sections .cell-rythme').length) === 0, 'toujours éteint après rechargement');
    await p.close();

    // ======================================================================================================
    console.log('\n=== D. Un accord d\'un temps reste lisible ===');
    p = await ouvrir({ width: 1440, height: 900 }, { court: true });
    await p.click('#grille-densites [data-densite="normal"]'); await p.waitForTimeout(400);
    const auto = await p.evaluate(() => {
        const cadre = document.getElementById('grille-cadre').getBoundingClientRect().width;
        const sym = document.querySelector('#progression-sections .grid-cell[data-index="1"] .cell-sym');
        return { cadre: Math.round(cadre), px: parseFloat(getComputedStyle(sym).fontSize), deborde: sym.scrollWidth > sym.closest('.grid-cell').clientWidth, texte: sym.textContent.trim() };
    });
    check(auto.cadre > 480, `morceau avec un accord d'un temps, en Normal : la fenêtre s'élargit d'elle-même (${auto.cadre}px au lieu de 480)`);
    check(auto.px >= 10 && !auto.deborde, `« ${auto.texte} » (un temps) s'écrit à ${auto.px}px, sans déborder — plus le plancher de 8px`);
    // une largeur tirée à la main l'emporte
    const ph = await p.locator('#grille-poignee-droite').boundingBox();
    await p.mouse.move(ph.x + ph.width / 2, ph.y + ph.height / 2); await p.mouse.down();
    for (let i = 1; i <= 5; i++) await p.mouse.move(ph.x + ph.width / 2 - 60 * i, ph.y + ph.height / 2);
    await p.mouse.up(); await p.waitForTimeout(400);
    const main = await p.evaluate(() => ({ cadre: Math.round(document.getElementById('grille-cadre').getBoundingClientRect().width), choisie: window.app.grilleLargeur }));
    check(main.choisie && Math.abs(main.cadre - main.choisie) <= 1 && main.cadre < auto.cadre, `une largeur tirée à la main l'emporte sur l'élargissement automatique (${main.cadre}px)`);
    // dernier recours : très étroit → le nom sur deux lignes, plus grand qu'au plancher
    await p.evaluate(() => { window.app.grilleLargeur = 360; window.app.appliquerLargeurGrille(); window.app.loadProgression(); });
    await p.waitForTimeout(400);
    const etroit = await p.evaluate(() => { const sym = document.querySelector('#progression-sections .grid-cell[data-index="1"] .cell-sym'); return { deux: sym.classList.contains('sym-2l'), px: parseFloat(getComputedStyle(sym).fontSize), lignes: [...sym.querySelectorAll('.sym-l')].map(l => l.textContent.trim()) }; });
    check(etroit.deux ? (etroit.px > 8 && etroit.lignes.join('|') === 'B♭|maj7') : etroit.px >= 10, `fenêtre forcée à 360px : ${etroit.deux ? `le nom passe sur deux lignes (${etroit.lignes.join(' / ')}) à ${etroit.px}px` : `le nom tient à ${etroit.px}px`} plutôt que de tomber à 8px`);
    // un morceau sans accord court garde la largeur de la maquette
    await p.evaluate(() => { window.app.grilleLargeur = null; const s = JSON.parse(localStorage.getItem('myProgression')); s.sections[0].chords = s.sections[0].chords.filter(x => x.beats >= 2); localStorage.setItem('myProgression', JSON.stringify(s)); window.app.loadProgression(); });
    await p.waitForTimeout(300);
    check(await p.evaluate(() => Math.round(document.getElementById('grille-cadre').getBoundingClientRect().width)) === 480, 'sans accord de moins de deux temps : la fenêtre garde les 480px de la maquette');
    await p.close();

    // ======================================================================================================
    console.log('\n=== E. Téléphone : rien ne change avant le lot 10 ===');
    p = await ouvrir({ width: 390, height: 844 });
    check(await p.evaluate(() => window.app.grilleDensite === 'detail' && document.querySelectorAll('#progression-sections .cell-rythme').length === 0), 'téléphone, morceau en Détaillé : pas de carrés');
    await p.evaluate(() => { window.app.grilleDensite = 'compact'; window.app.loadProgression(); });
    await p.waitForTimeout(300);
    check(await p.evaluate(() => document.querySelectorAll('#progression-sections .row-roman').length > 0), 'téléphone, morceau en Compact : les degrés restent (« noms seuls » est un affichage d\'ordinateur)');
    await p.close();

    console.log(`\nErreurs de page : ${erreurs.length}${erreurs.length ? '\n  ' + erreurs.slice(0, 6).join('\n  ') : ''}`);
    check(erreurs.length === 0, 'aucune erreur JavaScript pendant tout le banc');
    await nav.close();
    bilan();
})();
