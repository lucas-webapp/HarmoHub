// LOT 10a DE LA REFONTE — la barre du haut et les onglets au TÉLÉPHONE (docs/refonte.md, section « Téléphone » ; maquette « Téléphone (v2) »).
//
// « Tout en 44 px, bouton du compte carré comme ses voisins (habillage CSS HarmoHub, sans toucher compte-cloud.js). » Jusqu'au lot 10a le téléphone
// gardait la barre d'avant la refonte (pastilles à droite, logo dernier) et la carte Morceau avec sa liste et ses six icônes ; il a désormais la barre
// de l'ordinateur : logo, titre qui ouvre le menu du morceau, voyant, Enregistrer, Paramètres, compte — et sur une SECONDE rangée les onglets
// Grille / Structure / Paroles en groupe segmenté, avec Annuler et Rétablir à leur droite. DÉCISION DU 05/11 : la maquette n'a ni Rétablir ni
// Paramètres ; les garder tous sur la première rangée ne laissait que ~75px au titre (« Ba… ») — Annuler et Rétablir passent sous Paramètres et le
// compte.
//
// Ce que le banc tient, par de VRAIS gestes (toucher, clavier) — window.app ne sert qu'à relire l'état :
//   A. la jauge : chaque commande de la barre à 44px et 7px d'angle, le groupe d'onglets à 44px ;
//   B. la disposition : les deux rangées, l'ordre de la maquette, rien de la page sous la barre, pas de débordement ;
//   C. le menu du titre : il tient dans l'écran, ses lignes à 44px, il ouvre un autre morceau ; renommer pose son champ à la place du titre ;
//   D. le travail : un accord ajouté allume le voyant, Enregistrer l'éteint ; Annuler et Rétablir (seconde rangée) agissent ; Paramètres s'ouvre ;
//   E. les onglets : Structure s'ouvre SOUS la barre (les onglets restent sous le doigt), Grille la referme ;
//   F. le verre : le groupe d'onglets est un creux translucide, aucun texte n'y devient illisible ;
//   G. les petits écrans (360, 320px) : tout reste à l'écran, les mots des onglets ne sont pas coupés ;
//   H. l'ordinateur n'a pas bougé (une rangée de 52px, onglets au centre, chevron du titre).
const { chromium, devices } = require('playwright');
const V = require('./_verre_commun');
const { check, exiger, plan, bilan } = require('./_harness')('téléphone : barre du haut et onglets (lot 10a)');
const { estBruitReseau } = require('./_harness');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

plan(31);

const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
const SECTIONS = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', '7')] }];

async function ouvrir(nav, contexte, erreurs, nom) {
    const ctx = await nav.newContext(contexte);
    await ctx.addInitScript(([sections]) => {
        if (sessionStorage.getItem('banc-10a')) return; // un rechargement garde ce que le banc a fait
        sessionStorage.setItem('banc-10a', '1');
        const now = Date.now();
        const songs = [
            { id: 's1', name: 'Ballade en Do mineur', bpm: 100, timeSig: '4/4', savedAt: now, sections },
            { id: 's2', name: 'Autumn Leaves', bpm: 120, timeSig: '4/4', savedAt: now - 3600000, sections: [{ title: 'A', chords: [sections[0].chords[0]] }] },
        ];
        localStorage.setItem('harmohubSongs', JSON.stringify(songs));
        localStorage.setItem('harmohubCurrentSongId', 's1');
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    }, [SECTIONS]);
    const p = await ctx.newPage();
    p.on('pageerror', e => erreurs.push(nom + e.message));
    p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push(nom + 'console: ' + m.text()); });
    await p.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await p.waitForTimeout(800);
    return { p, ctx };
}

// Un toucher au centre d'un élément (tap de Playwright : vrais évènements tactiles + clic synthétisé, comme un doigt).
const toucher = async (p, sel) => { await p.tap(sel); await p.waitForTimeout(250); };
const boite = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom, rt: r.right, rayon: cs.borderTopLeftRadius }; }, sel);
const nbAccords = (p) => p.evaluate(() => loadProgressionSections()[0].chords.length);

(async () => {
    const nav = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    try {
        let { p, ctx } = await ouvrir(nav, { ...devices['iPhone 13'] }, erreurs, 'iPhone : ');
        exiger(await p.evaluate(() => innerWidth === 390 && matchMedia('(max-width: 899px)').matches), 'on mesure bien sur un téléphone (390px de large)');

        // ===================================================================================================
        console.log('\n=== A. La jauge : tout en 44px, 7px d\'angle ===');
        const COMMANDES = ['#tb-titre', '#tb-save', '#open-settings', '#global-undo-btn', '#global-redo-btn', '#compte-cloud .cc-pilule:not([hidden])'];
        const mesures = [];
        for (const s of COMMANDES) mesures.push([s, await boite(p, s)]);
        const horsJauge = mesures.filter(([, m]) => !m || Math.round(m.h) !== 44 || m.rayon !== '7px').map(([s, m]) => `${s} ${m ? Math.round(m.w) + 'x' + Math.round(m.h) + ' ' + m.rayon : 'absent'}`);
        check(horsJauge.length === 0, `les six commandes de la barre sont à 44px et 7px d'angle${horsJauge.length ? ' — hors jauge : ' + horsJauge.join(', ') : ''}`);
        const compte = mesures[5][1];
        check(!!compte && Math.round(compte.w) === 44, `le compte est CARRÉ comme ses voisins (${compte ? Math.round(compte.w) + 'x' + Math.round(compte.h) : 'absent'}) — habillage CSS, compte-cloud.js inchangé`);
        const groupe = await boite(p, '#tb-onglets');
        const onglets = await p.evaluate(() => [...document.querySelectorAll('#tb-onglets > button')].map(b => ({ id: b.id, h: Math.round(b.getBoundingClientRect().height), w: b.getBoundingClientRect().width })));
        check(Math.round(groupe.h) === 44 && groupe.rayon === '7px' && onglets.length === 3 && onglets.every(o => o.h === 38),
            `les onglets sont un groupe segmenté de 44px (segments de 38px, comme la maquette) — groupe ${Math.round(groupe.h)}px, segments ${onglets.map(o => o.h)}`);
        check(Math.max(...onglets.map(o => o.w)) - Math.min(...onglets.map(o => o.w)) < 1.5 && JSON.stringify(onglets.map(o => o.id)) === '["tab-grille","structure-btn","lyrics-btn"]',
            `trois parts égales, dans l'ordre Grille / Structure / Paroles (${onglets.map(o => Math.round(o.w))} px)`);

        // ===================================================================================================
        console.log('\n=== B. La disposition : deux rangées, l\'ordre de la maquette ===');
        const d = await p.evaluate(() => {
            const r = (s) => document.querySelector(s).getBoundingClientRect();
            const bar = r('.top-bar'), logo = r('.top-bar .logo'), titre = r('#tb-titre'), etat = r('#tb-etat'), save = r('#tb-save'), reg = r('#open-settings'), compte = r('#compte-cloud'), ong = r('#tb-onglets'), annuler = r('#global-undo-btn'), retablir = r('#global-redo-btn');
            const cy = (b) => b.top + b.height / 2;
            return {
                rang1: [logo, titre, etat, save, reg, compte].every(b => Math.abs(cy(b) - cy(titre)) < 2) && logo.right <= titre.left && titre.right <= etat.left && etat.right <= save.left && save.right <= reg.left && reg.right <= compte.left,
                rang2: [ong, annuler, retablir].every(b => Math.abs(cy(b) - cy(ong)) < 2) && ong.right <= annuler.left && annuler.right <= retablir.left && cy(ong) > cy(titre) + 40,
                colonnes: Math.abs(annuler.left - reg.left) < 1 && Math.abs(retablir.left - r('#compte-cloud .cc-pilule:not([hidden])').left) < 1,
                titreW: Math.round(titre.width),
                barreBas: bar.bottom, contenuHaut: r('main').top + parseFloat(getComputedStyle(document.querySelector('main')).paddingTop),
                premiere: r('#song-card').top,
                debord: document.documentElement.scrollWidth - innerWidth,
                fixe: getComputedStyle(document.querySelector('.top-bar')).position,
                carte: [getComputedStyle(document.querySelector('#song-card > .card-head')).display, document.getElementById('song-select').getBoundingClientRect().width],
                bas: [...document.querySelectorAll('.viz-export-actions > button')].map(b => b.id),
            };
        });
        check(d.rang1, 'rangée 1 : logo, titre, voyant, Enregistrer, Paramètres, compte — dans cet ordre, sur une ligne');
        check(d.rang2 && d.colonnes, 'rangée 2 : les onglets, puis Annuler sous Paramètres et Rétablir sous le compte (décision du 05/11)');
        check(d.titreW >= 160, `le titre garde la place qui reste (${d.titreW}px à 390px — « Ballade en Do mineur » en entier)`);
        check(d.fixe === 'fixed' && d.premiere >= d.barreBas && d.debord <= 0, `rien de la page ne passe sous la barre (barre jusqu'à ${Math.round(d.barreBas)}px, carte à ${Math.round(d.premiere)}px), aucun débordement en largeur (${d.debord}px)`);
        check(d.carte[0] === 'none' && d.carte[1] === 0 && JSON.stringify(d.bas) === '["file-menu-btn"]', 'la carte Morceau n\'a plus sa liste ni ses icônes, et le bas de la grille ne garde que « Fichier » : rien en double');

        // ===================================================================================================
        console.log('\n=== C. Le menu du titre ===');
        await toucher(p, '#tb-titre');
        const menu = await p.evaluate(() => {
            const m = document.getElementById('tb-menu'), r = m.getBoundingClientRect();
            const lignes = [...m.querySelectorAll('.tb-mi')].filter(b => b.getBoundingClientRect().height > 0);
            return { ouvert: !m.hidden, dansEcran: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, lignes: [...new Set(lignes.map(b => Math.round(b.getBoundingClientRect().height)))], actions: lignes.map(b => b.dataset.tbAction) };
        });
        check(menu.ouvert && menu.dansEcran, `toucher le titre ouvre le menu du morceau, entièrement dans l'écran (${JSON.stringify(menu.dansEcran)})`);
        check(JSON.stringify(menu.lignes) === '[44]' && ['mes-morceaux', 'nouveau', 'renommer', 'dupliquer', 'importer', 'exporter', 'historique'].every(a => menu.actions.includes(a)),
            `ses lignes sont à 44px (${menu.lignes}) et il offre tout ce que portait la carte Morceau (mes morceaux, nouveau, renommer, importer, exporter…)`);
        await toucher(p, '#tb-menu [data-song-id="s2"]');
        await p.waitForTimeout(400);
        const ouvert = await p.evaluate(() => ({ id: localStorage.getItem('harmohubCurrentSongId'), titre: document.getElementById('tb-titre-nom').textContent, menu: document.getElementById('tb-menu').hidden }));
        check(ouvert.id === 's2' && ouvert.titre === 'Autumn Leaves' && ouvert.menu, `une ligne du menu ouvre l'autre morceau, le titre le dit (« ${ouvert.titre} »), le menu se referme`);
        await toucher(p, '#tb-titre');
        await toucher(p, '#tb-menu [data-tb-action="renommer"]');
        const champ = await boite(p, '.tb-morceau input.tb-titre-saisie');
        check(!!champ && Math.round(champ.h) === 44 && champ.w > 150, `« Renommer » pose son champ à la place du titre, à 44px (${champ ? Math.round(champ.w) + 'x' + Math.round(champ.h) : 'absent'})`);
        await p.keyboard.press('Control+A');
        await p.keyboard.type('Feuilles mortes');
        await p.keyboard.press('Enter');
        await p.waitForTimeout(300);
        check(await p.evaluate(() => document.getElementById('tb-titre-nom').textContent === 'Feuilles mortes' && JSON.parse(localStorage.getItem('harmohubSongs')).some(s => s.id === 's2' && s.name === 'Feuilles mortes')),
            'Entrée renomme le morceau : le titre et la bibliothèque disent « Feuilles mortes »');
        // On revient au premier morceau par le même menu.
        await toucher(p, '#tb-titre');
        await toucher(p, '#tb-menu [data-song-id="s1"]');
        await p.waitForTimeout(400);
        exiger(await p.evaluate(() => localStorage.getItem('harmohubCurrentSongId') === 's1'), 'retour au premier morceau par le menu');

        // ===================================================================================================
        console.log('\n=== D. Le travail : voyant, Enregistrer, Annuler / Rétablir, Paramètres ===');
        const avant = await nbAccords(p);
        await toucher(p, '#quick-add-input');
        await p.keyboard.type('Em7');
        await toucher(p, '#quick-add-btn'); // l'ajout rapide se valide par « + » (Entrée y ouvre une nouvelle ligne)
        await p.waitForTimeout(300);
        const apresAjout = await nbAccords(p);
        const voyant = await p.evaluate(() => ({ etat: document.getElementById('tb-etat').dataset.etat, point: document.querySelector('.tb-etat-point').getBoundingClientRect().width, texte: getComputedStyle(document.getElementById('tb-etat-texte')).display }));
        check(apresAjout === avant + 1 && voyant.etat === 'modifie' && voyant.point > 0 && voyant.texte === 'none',
            `un accord ajouté allume le voyant (son point seul, le texte en infobulle) — ${avant} → ${apresAjout} accords, état « ${voyant.etat} »`);
        await toucher(p, '#tb-save');
        await p.waitForTimeout(300);
        const sauve = await p.evaluate(() => ({ etat: document.getElementById('tb-etat').dataset.etat, n: JSON.parse(localStorage.getItem('harmohubSongs')).find(s => s.id === 's1').sections[0].chords.length }));
        check(sauve.etat === 'enregistre' && sauve.n === apresAjout, `Enregistrer (icône seule, 44px) enregistre : voyant « ${sauve.etat} », ${sauve.n} accords en bibliothèque`);
        await toucher(p, '#global-undo-btn');
        const annule = await nbAccords(p);
        await toucher(p, '#global-redo-btn');
        const retabli = await nbAccords(p);
        check(annule === avant && retabli === apresAjout, `Annuler puis Rétablir, sur la seconde rangée, agissent (${apresAjout} → ${annule} → ${retabli})`);
        await toucher(p, '#open-settings');
        check(await p.evaluate(() => !document.getElementById('settings-overlay').hidden), 'Paramètres (engrenage d\'origine) ouvre les Paramètres');
        await toucher(p, '#settings-close');

        // ===================================================================================================
        console.log('\n=== E. Les onglets ===');
        await toucher(p, '#structure-btn');
        await p.waitForTimeout(250);
        const st = await p.evaluate(() => ({ ouverte: !document.getElementById('structure-overlay').hidden, haut: document.getElementById('structure-overlay').getBoundingClientRect().top, barre: document.querySelector('.top-bar').getBoundingClientRect().bottom, pressés: ['tab-grille', 'structure-btn', 'lyrics-btn'].map(i => document.getElementById(i).getAttribute('aria-pressed')) }));
        check(st.ouverte && Math.abs(st.haut - st.barre) <= 1 && JSON.stringify(st.pressés) === '["false","true","false"]',
            `l'onglet Structure ouvre sa fenêtre SOUS la barre (${Math.round(st.haut)}px), allumé seul (${st.pressés})`);
        const atteint = await p.evaluate(() => { const r = document.getElementById('tab-grille').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e && !!e.closest('#tab-grille'); });
        check(atteint, 'l\'onglet Grille reste sous le doigt, la fenêtre ouverte (rien ne le recouvre)');
        await toucher(p, '#tab-grille');
        check(await p.evaluate(() => document.getElementById('structure-overlay').hidden && document.getElementById('tab-grille').getAttribute('aria-pressed') === 'true'), 'l\'onglet Grille la referme et s\'allume');
        const allume = await p.evaluate(() => { const cs = getComputedStyle(document.getElementById('tab-grille')); return { couleur: cs.color, liseré: cs.boxShadow, fond: cs.backgroundImage }; });
        check(/inset/.test(allume.liseré) && allume.fond === 'none', `l'onglet allumé se reconnaît à son liseré, jamais à un aplat (${allume.couleur})`);
        await ctx.close();

        // ===================================================================================================
        console.log('\n=== F. Le verre dépoli ===');
        const off = await ouvrir(nav, { ...devices['iPhone 13'] }, erreurs, 'verre éteint : ');
        const on = await ouvrir(nav, { ...devices['iPhone 13'] }, erreurs, 'verre allumé : ');
        await on.p.evaluate(() => { document.documentElement.dataset.glass = '1'; });
        await on.p.waitForTimeout(200);
        const fonds = await Promise.all([off.p, on.p].map(q => q.evaluate(() => getComputedStyle(document.getElementById('tb-onglets')).backgroundColor)));
        check(fonds[0] !== fonds[1] && /rgba\(.*, 0?\.\d+\)/.test(fonds[1]), `verre allumé, le groupe d'onglets devient un creux translucide (${fonds[0]} → ${fonds[1]})`);
        const a = await V.contrastesFaibles(off.p), b = await V.contrastesFaibles(on.p);
        const nouveaux = b.filter(f => !a.some(g => g.cle === f.cle)).map(f => `${f.cle} (${f.rapport})`);
        check(nouveaux.length === 0, `aucun texte de la page téléphone n'est devenu illisible par le verre (${nouveaux.length}${nouveaux.length ? ' : ' + nouveaux.slice(0, 4).join(' ; ') : ''})`);
        await off.ctx.close(); await on.ctx.close();

        // ===================================================================================================
        console.log('\n=== G. Les petits écrans ===');
        for (const largeur of [360, 320]) {
            const q = await ouvrir(nav, { viewport: { width: largeur, height: 720 }, hasTouch: true, isMobile: true }, erreurs, `${largeur}px : `);
            const m = await q.p.evaluate(() => {
                const dans = [...document.querySelectorAll('.top-bar button, .top-bar .logo')].filter(e => e.getBoundingClientRect().width > 0 && !e.closest('[hidden]')).every(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5; });
                const coupes = [...document.querySelectorAll('#tb-onglets .btn-label')].filter(l => l.scrollWidth > l.clientWidth + 0.5 || l.parentElement.scrollWidth > l.parentElement.clientWidth + 0.5).map(l => l.textContent);
                return { dans, coupes, debord: document.documentElement.scrollWidth - innerWidth, titre: Math.round(document.getElementById('tb-titre').getBoundingClientRect().width) };
            });
            check(m.dans && m.debord <= 0 && m.coupes.length === 0 && m.titre >= 55,
                `à ${largeur}px : toute la barre reste à l'écran, aucun mot d'onglet coupé${m.coupes.length ? ' (' + m.coupes + ')' : ''}, le titre garde ${m.titre}px, débordement ${m.debord}px`);
            await q.ctx.close();
        }

        // ===================================================================================================
        console.log('\n=== H. L\'ordinateur n\'a pas bougé ===');
        ({ p, ctx } = await ouvrir(nav, { viewport: { width: 1440, height: 900 } }, erreurs, 'ordinateur : '));
        const o = await p.evaluate(() => {
            const r = (s) => document.querySelector(s).getBoundingClientRect();
            const centre = r('#tb-onglets');
            return {
                barre: Math.round(r('.top-bar').height), hauteurs: ['#tb-titre', '#tb-save', '#global-undo-btn', '#open-settings'].map(s => Math.round(r(s).height)),
                centre: Math.abs((centre.left + centre.right) / 2 - innerWidth / 2), uneLigne: Math.abs(r('#global-undo-btn').top - r('#tb-titre').top) < 1,
                chevron: r('.tb-titre-chevron').width, mot: getComputedStyle(document.querySelector('.tb-save-mot')).display, texte: getComputedStyle(document.getElementById('tb-etat-texte')).display,
                fondOnglets: getComputedStyle(document.getElementById('tb-onglets')).backgroundColor, logos: [...document.querySelectorAll('#tb-onglets .icon')].every(i => i.getBoundingClientRect().width > 0),
            };
        });
        check(o.barre === 53 && o.hauteurs.every(h => h === 32) && o.uneLigne && o.centre < 1,
            `ordinateur : une seule rangée de 52px + filet (${o.barre}px), commandes à 32px (${o.hauteurs}), onglets EXACTEMENT au centre (écart ${o.centre.toFixed(1)}px)`);
        check(o.chevron > 0 && o.mot !== 'none' && o.texte !== 'none' && o.logos && /rgba\(0, 0, 0, 0\)|transparent/.test(o.fondOnglets),
            'ordinateur : le titre garde son chevron, Enregistrer son mot, le voyant son texte, les onglets leurs logos et aucun fond de groupe');
        await ctx.close();

        console.log(`\nErreurs de page : ${erreurs.length}${erreurs.length ? '\n  ' + erreurs.slice(0, 6).join('\n  ') : ''}`);
        check(erreurs.length === 0, 'aucune erreur JavaScript pendant tout le banc');
    } finally {
        await nav.close();
    }
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
