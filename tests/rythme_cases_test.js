// LES CARRÉS DU RYTHME (RETIRÉS le 13/11) ET LES ACCORDS COURTS (refonte, lot 5b), avec de vrais clics.
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

plan(15);

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

    // ======================================================================================================
    // RÉÉCRIT AU RETRAIT DES CARRÉS DU RYTHME (13/11, A2) : « je ne veux plus ces petits points verts qui représentent le rythme. Je trouve qu'ils faussent un peu la
    // compréhension. Je comprendrai directement avec le séquenceur » (puis « supprimer ces options »). Les parties A à C d'avant éprouvaient ces carrés, leur condition
    // (Détaillé, case assez haute) et leur option de Paramètres › Affichage : tout cela a disparu. Ce que le banc garde : plus aucun carré à aucun affichage, plus
    // d'option, et la case se clique toujours. Les parties D et E (accords courts, téléphone) restent telles quelles.
    console.log('\n=== A. Plus de carrés du rythme, plus d\'option ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    exiger(await p.evaluate(() => window.app.grilleDensite === 'detail'), 'le morceau s\'ouvre en Détaillé');
    check(await p.evaluate(() => document.querySelectorAll('#progression-sections .cell-rythme').length) === 0, 'Détaillé : aucun carré du rythme dans les cases');
    for (const d of ['normal', 'compact']) {
        await p.click(`#grille-densites [data-densite="${d}"]`); await p.waitForTimeout(300);
        check(await p.evaluate(() => document.querySelectorAll('#progression-sections .cell-rythme').length) === 0, `${d === 'normal' ? 'Normal' : 'Compact'} : aucun carré non plus`);
    }
    await p.click('#grille-densites [data-densite="detail"]'); await p.waitForTimeout(300);
    await p.click('#open-settings'); await p.waitForTimeout(300);
    check(await p.evaluate(() => document.getElementById('toggle-show-cell-rhythm') === null), 'Paramètres › Affichage : l\'option « Rythme de l\'accord dans les cases » n\'existe plus');
    await p.click('#settings-close'); await p.waitForTimeout(200);
    check(await p.evaluate(() => !(Array.isArray(window.REGLAGES_SYNCHRONISES) && window.REGLAGES_SYNCHRONISES.includes('harmohubRythmeDansCases'))), 'et son réglage n\'est plus synchronisé entre appareils');
    const bas = await p.locator('#progression-sections .grid-cell[data-index="1"]').boundingBox();
    await p.mouse.click(bas.x + bas.width / 2, bas.y + bas.height - 4);
    await p.waitForTimeout(300);
    check(await p.evaluate(() => window.app.selectedIndex === 1), 'un clic au bas d\'une case la sélectionne (plus rien n\'y est dessiné)');
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
