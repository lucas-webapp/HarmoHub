// REFONTE DU SÉQUENCEUR — D, TROISIÈME SOUS-LOT : LE TÉLÉPHONE (docs/refonte-sequenceur.md, sections 3 et 3 bis, cases « Téléphone » ;
// maquette v17, planche `Telephone.dc.html`).
//
// « Au téléphone, le séquenceur est dans le panneau d'accord, onglet « Rythme » à côté de « Accord » et « Son » » ; « le bouton « Notes » du panneau
// Lecture devient « Séquenceur » ». Le séquenceur de l'ordinateur (sequenceur.js) est DÉPLACÉ dans le panneau (jamais dupliqué), réduit à l'accord du
// panneau : huit croches, une ligne par voix, des cases de 44 px.
//
// Ce que le banc tient, par de VRAIS gestes (toucher ; souris pour le glissé, que Playwright ne sait pas faire au doigt) — window.app ne sert qu'à relire :
//   A. « Séquenceur » du panneau Lecture : son nom, le logo de l'ordinateur, 44 px ; il ouvre le panneau de l'accord choisi sur « Rythme », sans rien écrire ;
//   B. l'onglet Rythme : quatre lignes × huit croches de 44 px, l'accord du panneau seul, ni poignée, ni ×, ni nom d'accord ; tout tient (pas de
//      défilement de côté) ; outils à 44 px ;
//   C. toucher une case pose une croche, la retoucher l'enlève, une annulation par toucher, l'accord passe « À la main » ;
//   D. un motif (Arpège ↑) sur toute la partie, une annulation ;
//   E. ‹ › : le panneau reste sur « Rythme » et le séquenceur suit l'accord ; toucher une autre case aussi ;
//   F. le glissé peint d'une seule annulation ;
//   G. les onglets : Accord (le séquenceur repart à sa place), Son (la modification, la carte dans le panneau), retour à Rythme (modification refermée) ;
//   H. × referme le panneau, le séquenceur retourne à sa place, « Séquenceur » s'éteint ;
//   I. verre allumé : le séquenceur prend le fond du panneau (pas de second verre) ;
//   J. 320 px : les huit croches tiennent ;
//   K. l'ordinateur : pas d'onglets dans la bulle, le séquenceur de l'ordinateur s'ouvre toujours au bloc « Vues » ; franchir le seuil, onglet Rythme
//      ouvert, rend le séquenceur à sa place.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('séquenceur au téléphone');
const { dblclickHorsNom } = require('./_geste_accord');
const { estBruitReseau } = require('./_harness');
const V = require('./_verre_commun');

plan(50);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const mk = (r, q, extra = {}) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', ...extra });
const PARTIE = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] }];
const TEL = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 };

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (contexte, reglages = {}) => {
        const ctx = await nav.newContext(contexte);
        await ctx.addInitScript(([S, reglages]) => {
            if (sessionStorage.getItem('banc-sq-tel')) return;
            sessionStorage.setItem('banc-sq-tel', '1');
            localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
            localStorage.setItem('harmohubCurrentSongId', 's1');
            localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
            sessionStorage.setItem('cc_accueil_vu', '1');
            for (const k of Object.keys(reglages)) localStorage.setItem(k, reglages[k]);
        }, [PARTIE, reglages]);
        await ctx.route(/gstatic\.com|googleapis\.com|tonejs\.github\.io/, r => r.abort());
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !V.BRUIT.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.waitForFunction(() => !!window.app);
        await p.waitForTimeout(900);
        return { p, ctx };
    };
    const toucher = async (p, sel, ms = 400) => { await p.tap(sel); await p.waitForTimeout(ms); };
    const centre = async (p, sel) => { const b = await p.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    // Lecture de l'état (jamais pour agir).
    const croches = (p, c) => p.evaluate((c) => {
        const d = loadProgressionSections()[0].chords[c];
        const e = SequenceurHarmo.lireAccord(d);
        const par = (v) => { const r = []; for (let k = 0; k < e.info.croches; k++) if (e.on.has(v + ':' + k)) r.push(k); return r.join(','); };
        return { pos: e.info.positions.map(par), motif: SequenceurHarmo.motifActuel(d), positions: e.info.positions };
    }, c);
    const etat = (p) => p.evaluate(() => {
        const a = window.app, z = a._bulle, sq = document.getElementById('sequenceur');
        const r = sq.getBoundingClientRect();
        return {
            ouvert: !document.getElementById('panneau-accord').hidden, sur: z ? [z.section, z.index] : null, rythme: !!(z && z.rythme), etendu: !!(z && z.etendu),
            parent: sq.parentElement.id || sq.parentElement.tagName, visible: !sq.hidden && r.height > 0, edit: a.editingIndex, undo: a.undoStack.length,
            onglets: [...document.querySelectorAll('#pa-quel .pa-onglets button')].map(b => b.textContent + ':' + b.getAttribute('aria-pressed')).join(' '),
            colonnes: [...new Set([...document.querySelectorAll('#sq-grille .sq-case[data-r]')].map(x => x.dataset.c))].join(','),
            carte: document.getElementById('accord-card').parentElement.id,
        };
    });
    const parentOrigine = (p) => p.evaluate(() => document.getElementById('sequenceur').parentElement === document.getElementById('vues-tiroir').parentElement);

    // ======================================================================================================
    console.log('\n=== A. « Séquenceur » du panneau Lecture ===');
    let { p, ctx } = await ouvrir(TEL);
    const bouton = await p.evaluate(() => {
        const b = document.getElementById('pl-notes'), src = document.getElementById(b.dataset.source);
        return { mot: b.querySelector('.btn-label').textContent, source: b.dataset.source, logo: !!b.querySelector('svg') && b.querySelector('svg').innerHTML === src.querySelector('svg').innerHTML };
    });
    check(bouton.mot === 'Séquenceur' && bouton.source === 'vue-sequenceur', `le bouton « Notes » du panneau Lecture devient « Séquenceur » (${bouton.mot})`);
    check(bouton.logo, 'il porte le logo du bouton Séquenceur de l\'ordinateur, repris tel quel');
    const undo0 = (await etat(p)).undo;
    await toucher(p, '#bl-plus');
    check(Math.round(await p.evaluate(() => document.getElementById('pl-notes').getBoundingClientRect().height)) === 44, 'il fait 44 px (la jauge du téléphone)');
    await toucher(p, '#pl-notes', 700);
    let e = await etat(p);
    exiger(e.ouvert && e.rythme && e.parent === 'pa-rythme' && e.visible, `il ouvre le panneau d'accord sur l'onglet Rythme, le séquenceur dedans (${e.parent}, ${e.ouvert}, ${e.rythme})`);
    check(JSON.stringify(e.sur) === '[0,0]', `rien n'était choisi : le panneau prend le premier accord de la partie (${JSON.stringify(e.sur)})`);
    check(await p.evaluate(() => document.getElementById('panneau-lecture').hidden), 'le panneau Lecture s\'est refermé');
    check(e.undo === undo0, 'ouvrir le séquenceur n\'écrit rien (pas d\'annulation déposée)');
    check(e.onglets === 'Accord:false Son:false Rythme:true', `trois onglets, Rythme enfoncé (${e.onglets})`);
    check(await p.evaluate(() => document.getElementById('pl-notes').getAttribute('aria-pressed')) === 'true', '« Séquenceur » se dit allumé dans le panneau Lecture');

    console.log('\n=== B. L\'onglet Rythme ===');
    const vue = await p.evaluate(() => {
        const g = document.getElementById('sq-grille');
        const cases = [...g.querySelectorAll('.sq-case[data-r]')];
        const vis = (s) => { const el = document.querySelector(s); return !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0; };
        const outils = [...document.querySelectorAll('#sequenceur .sq-outils > .icon-btn, #sequenceur .sq-rythme .icon-btn, #sequenceur .sq-motif, #sequenceur .sq-seg')].filter(b => b.getBoundingClientRect().height > 0).map(b => Math.round(b.getBoundingClientRect().height));
        return {
            n: cases.length, lignes: new Set(cases.map(x => x.dataset.r)).size, h: Math.round(cases[0].getBoundingClientRect().height),
            poignee: vis('#sq-poignee'), fermer: vis('#sq-fermer'), nom: vis('#sq-grille .sq-nom'), deborde: g.scrollWidth - g.clientWidth,
            droite: Math.round(cases.filter(x => x.dataset.c === '0').pop().getBoundingClientRect().right), outils,
        };
    });
    // PLEIN ÉCRAN (12/11, « sur portable, il serait peut-être plus simple de l'afficher en plein écran » ; « je ne vois pas beaucoup de barres ») : « Toute la partie » (le choix de
    // l'appareil, enfoncé d'office) montre TOUS les accords, qu'on fait défiler de côté ; « Cet accord » le seul accord du panneau. Avant, le choix était affiché mais sans effet au téléphone.
    check(vue.n === 128 && vue.lignes === 4, `toute la partie : quatre accords × quatre lignes × huit croches (${vue.n} cases, ${vue.lignes} lignes)`);
    check(vue.h === 40, `des lignes de 40 px de haut, pour voir plus de voix (${vue.h}, elles étaient à 44)`);
    check(!vue.poignee && !vue.fermer && vue.nom, 'ni poignée de hauteur ni ×, mais les noms d\'accords sont de retour : ils disent quel accord est où');
    check(vue.deborde > 0 && vue.droite <= 390, `la partie dépasse l'écran, la grille défile de côté (débord ${vue.deborde} px) ; les huit croches de l'accord du panneau tiennent dans la largeur (bord droit ${vue.droite})`);
    await toucher(p, '#sq-portee-accord');
    check(await p.evaluate(() => document.querySelectorAll('#sq-grille .sq-case[data-r]').length) === 32, '« Cet accord » : le seul accord du panneau, quatre lignes × huit croches (32 cases)');
    await toucher(p, '#sq-portee-partie');
    check(vue.outils.length >= 8 && vue.outils.every(h => h === 44), `les outils du séquenceur à 44 px (${vue.outils.join(' ')})`);
    // A3 (12/11), « règle ce défaut de hauteur » : à 390 × 844 la barre d'outils tenait sur quatre rangées (212 px), la grille commençait à 660 px et la quatrième ligne sortait du
    // panneau (bas à 845 px, panneau arrêté à 776). Trois rangées (motifs, les deux groupes segmentés côte à côte, les quatre icônes) et toutes les lignes d'un accord de 4 sons à l'écran.
    // Mesuré une seconde fois le 13/11 : le contrôle comparait la dernière ligne au bas du PANNEAU, or le pied du panneau (« Réglages du son ») et le défilement de .pa-corps rognaient
    // la quatrième ligne sans que rien ne le dise. On compare maintenant au bas de la zone qui défile (.pa-corps), et le pied n'existe plus sur l'onglet Rythme (plein écran).
    const haut = await p.evaluate(() => {
        const pa = document.querySelector('#panneau-accord .pa-corps').getBoundingClientRect(), o = document.querySelector('#pa-rythme .sq-outils').getBoundingClientRect();
        const lignes = [...new Set([...document.querySelectorAll('#sq-grille .sq-case[data-v]')].map(c => c.dataset.v))].map(v => document.querySelector(`#sq-grille .sq-case[data-v="${v}"]`).getBoundingClientRect());
        return { outils: Math.round(o.height), derniere: Math.round(lignes[lignes.length - 1].bottom), panneau: Math.round(pa.bottom), vh: innerHeight, n: lignes.length };
    });
    check(haut.outils <= 154, `la barre d'outils tient sur trois rangées (${haut.outils} px au lieu de 212 mesurés avant)`);
    check(haut.n === 4 && haut.derniere <= haut.panneau && haut.derniere <= haut.vh && await p.evaluate(() => getComputedStyle(document.querySelector('#panneau-accord .pa-actions')).display) === 'none', `les quatre lignes se voient sans faire défiler, et sans pied de panneau par-dessus (dernière ligne à ${haut.derniere} px, zone visible jusqu'à ${haut.panneau}, écran ${haut.vh})`);

    console.log('\n=== C. Toucher une case pose, retoucher enlève ===');
    // Plaqué d'origine : la basse tient toute la mesure ; on vide la voix de l'aiguë d'abord par « Effacer », puis on y pose une croche.
    await toucher(p, '#sq-effacer');
    let c0 = await croches(p, 0);
    const vAigue = c0.positions[3];
    check(c0.pos.every(x => x === ''), `Effacer vide le rythme de l'accord (${c0.pos.join(' | ')})`);
    const u1 = (await etat(p)).undo;
    await toucher(p, `#sq-grille .sq-case[data-c="0"][data-v="${vAigue}"][data-k="2"]`);
    c0 = await croches(p, 0);
    check(c0.pos[3] === '2' && c0.motif === 'main', `toucher une case de l'aiguë y pose une croche, l'accord passe « À la main » (${c0.pos[3]}, ${c0.motif})`);
    check((await etat(p)).undo === u1 + 1, 'une annulation pour ce toucher');
    await toucher(p, `#sq-grille .sq-case[data-c="0"][data-v="${vAigue}"][data-k="2"]`);
    c0 = await croches(p, 0);
    check(c0.pos[3] === '' && (await etat(p)).undo === u1 + 2, 'la retoucher l\'enlève (une annulation de plus)');
    e = await etat(p);
    check(e.rythme && e.parent === 'pa-rythme' && JSON.stringify(e.sur) === '[0,0]', 'le panneau reste ouvert sur Rythme, sur le même accord');

    console.log('\n=== D. Un motif sur toute la partie ===');
    const u2 = (await etat(p)).undo;
    await toucher(p, '#sq-motif-monte');
    const motifs = await Promise.all([0, 1, 2, 3].map(c => croches(p, c)));
    check(motifs.every(m => m.motif === 'monte'), `Arpège ↑ s'applique à toute la partie (${motifs.map(m => m.motif).join(' ')})`);
    check(motifs[0].pos[0] === '0,4' || motifs[0].pos[0].startsWith('0'), `la basse attaque sur le premier temps (${motifs[0].pos.join(' | ')})`);
    check((await etat(p)).undo === u2 + 1, 'une seule annulation pour tout le motif');

    console.log('\n=== E. ‹ › : le séquenceur suit l\'accord ===');
    await toucher(p, '#pa-quel [data-bulle="suiv"]', 500);
    e = await etat(p);
    const vers = () => p.evaluate(() => ({ sl: Math.round(document.getElementById('sq-grille').scrollLeft), choisi: (document.querySelector('#sq-grille .sq-nom.choisi') || {}).dataset ? document.querySelector('#sq-grille .sq-nom.choisi').dataset.c : null }));
    let ve = await vers();
    check(JSON.stringify(e.sur) === '[0,1]' && e.rythme && e.colonnes === '0,1,2,3' && ve.choisi === '1' && ve.sl > 100, `› passe à l'accord suivant, toujours sur Rythme : la partie reste à l'écran, défilée jusqu'à lui (${JSON.stringify(e.sur)}, colonne choisie ${ve.choisi}, défilement ${ve.sl} px)`);
    check(await p.evaluate(() => window.app.selectedIndex) === 1, 'la sélection de la grille suit');
    await toucher(p, '#pa-quel [data-bulle="prec"]', 500);
    e = await etat(p);
    ve = await vers();
    check(JSON.stringify(e.sur) === '[0,0]' && ve.choisi === '0' && ve.sl === 0, '‹ revient au premier accord, la grille revient avec lui');
    // Le séquenceur couvre la grille (plein écran) : on change d'accord en touchant son NOM dans la grille de croches, et le panneau l'y suit.
    await toucher(p, '#sq-grille .sq-nom[data-c="2"]', 600);
    e = await etat(p);
    ve = await vers();
    check(JSON.stringify(e.sur) === '[0,2]' && e.rythme && e.colonnes === '0,1,2,3' && ve.choisi === '2', `toucher le nom d'un autre accord : le panneau l'y suit, sur Rythme (${JSON.stringify(e.sur)}, ${e.rythme}, colonne choisie ${ve.choisi})`);

    console.log('\n=== F. Le glissé peint d\'une seule annulation ===');
    await toucher(p, '#sq-effacer');
    const c2 = await croches(p, 2);
    const v2 = c2.positions[2];
    const u3 = (await etat(p)).undo;
    const a = await centre(p, `#sq-grille .sq-case[data-c="2"][data-v="${v2}"][data-k="1"]`);
    const b = await centre(p, `#sq-grille .sq-case[data-c="2"][data-v="${v2}"][data-k="5"]`);
    await p.mouse.move(a.x, a.y); await p.mouse.down();
    for (let s = 1; s <= 8; s++) await p.mouse.move(a.x + (b.x - a.x) * s / 8, a.y, { steps: 2 });
    await p.mouse.up(); await p.waitForTimeout(400);
    const peint = await croches(p, 2);
    check(peint.pos[2] === '1,2,3,4,5', `le glissé peint les croches 2 à 6 de la voix 3 (${peint.pos[2]})`);
    check((await etat(p)).undo === u3 + 1, 'une seule annulation pour tout le glissé');

    console.log('\n=== G. Les onglets ===');
    await toucher(p, '#pa-quel [data-bulle="onglet"][data-valeur="accord"]');
    e = await etat(p);
    check(!e.rythme && !e.etendu && await parentOrigine(p) && !e.visible, `Accord : le séquenceur quitte le panneau et retourne à sa place, caché (${e.parent})`);
    check(await p.evaluate(() => document.querySelectorAll('#pa-quel [data-bulle="root"]').length) === 12, 'Accord : les douze fondamentales sont là');
    await toucher(p, '#pa-quel [data-bulle="onglet"][data-valeur="son"]');
    e = await etat(p);
    check(e.etendu && e.edit === 2 && e.carte === 'pa-son' && !e.visible, `Son : le panneau s'agrandit, l'accord en modification, la carte Accord dedans (${e.edit}, ${e.carte})`);
    check(e.onglets === 'Accord:false Son:true Rythme:false', `Son enfoncé (${e.onglets})`);
    await toucher(p, '#pa-quel [data-bulle="onglet"][data-valeur="rythme"]');
    e = await etat(p);
    check(e.rythme && !e.etendu && e.edit == null && e.parent === 'pa-rythme' && e.visible, `Rythme : la modification se referme, le séquenceur revient (${e.edit}, ${e.parent})`);
    check(e.carte !== 'pa-son' && await p.evaluate(() => window.app.selectedIndex) === 2, 'la carte Accord est rendue à la page, la sélection est restée sur l\'accord');
    // « Réglages du son » (le bouton du pied) mène aussi à Son. 13/11 : l'onglet Rythme est en plein écran, SANS pied ; il revient avec l'onglet Accord, d'où l'on y va.
    await toucher(p, '#pa-quel [data-bulle="onglet"][data-valeur="accord"]');
    await toucher(p, '#pa-son-btn');
    e = await etat(p);
    check(e.etendu && !e.rythme && !e.visible, '« Réglages du son » (le bouton du pied, de l\'onglet Accord) mène à Son');
    await toucher(p, '#pa-quel [data-bulle="onglet"][data-valeur="rythme"]');

    console.log('\n=== H. × referme ===');
    await toucher(p, '#pa-quel [data-bulle="fermer"]');
    e = await etat(p);
    check(!e.ouvert && !e.visible && await parentOrigine(p), '× referme le panneau, le séquenceur retourne à sa place, caché');
    check(await p.evaluate(() => document.getElementById('pl-notes').getAttribute('aria-pressed')) === 'false', '« Séquenceur » s\'éteint dans le panneau Lecture');
    // Rouvrir : « Séquenceur » ramène le panneau sur Rythme (l'accord choisi, ou le premier : « Réglages du son » a vidé la sélection, comme avant ce lot).
    await toucher(p, '#bl-plus'); await toucher(p, '#pl-notes', 700);
    e = await etat(p);
    check(e.ouvert && e.rythme && e.parent === 'pa-rythme' && e.visible, `« Séquenceur » rouvre le panneau sur Rythme (${JSON.stringify(e.sur)})`);
    await ctx.close();

    console.log('\n=== I. Verre allumé ===');
    ({ p, ctx } = await ouvrir(TEL, { 'harmohub.glass.v1': '1' }));
    await toucher(p, '#bl-plus'); await toucher(p, '#pl-notes', 700);
    const verre = await p.evaluate(() => {
        const s = getComputedStyle(document.getElementById('sequenceur')), o = getComputedStyle(document.querySelector('#sequenceur .sq-outils'));
        return { glass: document.documentElement.dataset.glass, fond: s.backgroundColor, flou: s.backdropFilter, outils: o.backgroundColor };
    });
    check(verre.glass === '1', `le verre est allumé (${verre.glass})`);
    check(verre.fond === 'rgba(0, 0, 0, 0)' && (verre.flou === 'none' || verre.flou === '') && verre.outils === 'rgba(0, 0, 0, 0)', `dans le panneau, le séquenceur n'a ni second fond ni second flou (${verre.fond}, ${verre.flou}, ${verre.outils})`);
    await ctx.close();

    console.log('\n=== J. 320 px ===');
    ({ p, ctx } = await ouvrir({ ...TEL, viewport: { width: 320, height: 640 } }));
    await toucher(p, '#bl-plus'); await toucher(p, '#pl-notes', 700);
    const etroit = await p.evaluate(() => {
        const g = document.getElementById('sq-grille'), cases = [...g.querySelectorAll('.sq-case[data-r]')];
        return { n: cases.length, deborde: g.scrollWidth - g.clientWidth, droite: Math.round(cases.filter(x => x.dataset.c === '0').pop().getBoundingClientRect().right), page: document.documentElement.scrollWidth };
    });
    // Plein écran (13/11) : toute la partie est montrée, la GRILLE défile de côté (jamais la page), et les huit croches du premier accord tiennent à 320 px.
    check(etroit.n === 128 && etroit.deborde > 0 && etroit.droite <= 320 && etroit.page <= 320, `à 320 px, les huit croches du premier accord tiennent, la grille défile de côté et la page non (${etroit.droite}, page ${etroit.page}, grille +${etroit.deborde})`);
    await ctx.close();

    console.log('\n=== K. L\'ordinateur ===');
    ({ p, ctx } = await ouvrir({ viewport: { width: 1440, height: 900 } }));
    await dblclickHorsNom(p, '#progression-sections .grid-cell[data-section="0"][data-index="1"]'); // B2 (12/11) : hors du texte du nom, que le double-clic retape
    await p.waitForTimeout(500);
    const bulle = await p.evaluate(() => ({ ouverte: !document.getElementById('bulle-accord').hidden, onglets: document.querySelectorAll('#bulle-accord .pa-onglets').length, pa: document.getElementById('panneau-accord').hidden }));
    check(bulle.ouverte && bulle.onglets === 0 && bulle.pa, 'à l\'ordinateur, la bulle s\'ouvre, sans onglets, le panneau du téléphone reste caché');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await p.mouse.click(...Object.values(await centre(p, '#vue-sequenceur'))); await p.waitForTimeout(400);
    const ordi = await p.evaluate(() => ({ visible: !document.getElementById('sequenceur').hidden, parent: document.getElementById('sequenceur').parentElement === document.getElementById('vues-tiroir').parentElement, cases: document.querySelectorAll('#sq-grille .sq-case[data-r]').length }));
    check(ordi.visible && ordi.parent && ordi.cases === 4 * 32, `le bouton du bloc « Vues » ouvre toujours le séquenceur de l'ordinateur, toute la partie (${ordi.cases} cases)`);
    await ctx.close();
    // Franchir le seuil, onglet Rythme ouvert : le panneau s'efface, le séquenceur retourne à sa place (fermé à l'ordinateur s'il l'était).
    ({ p, ctx } = await ouvrir(TEL));
    await toucher(p, '#bl-plus'); await toucher(p, '#pl-notes', 700);
    exiger((await etat(p)).parent === 'pa-rythme', 'onglet Rythme ouvert avant de franchir le seuil');
    await p.setViewportSize({ width: 1280, height: 860 }); await p.waitForTimeout(700);
    e = await etat(p);
    check(!e.ouvert && await parentOrigine(p) && !e.visible, `élargi à 1280 px : le panneau s'efface, le séquenceur rentre à sa place, fermé comme il l'était à l'ordinateur (${e.parent}, ${e.visible})`);
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(500);
    check(!(await etat(p)).visible, 'revenu à 390 px, rien ne s\'ouvre tout seul');
    await ctx.close();

    check(erreurs.length === 0, 'aucune erreur JavaScript (' + (erreurs.join(' | ') || 'rien') + ')');
    await nav.close();
    bilan();
})();
