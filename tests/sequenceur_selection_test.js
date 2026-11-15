// SÉQUENCEUR, L2 (14/11) — les notes : sélection, déplacement, étirement en groupe, suppression, avec de vrais gestes.
//
// CE QUE L'UTILISATEUR A DEMANDÉ (docs/decisions-13-14-11.md, lettre B) : un clic SÉLECTIONNE une note (surbrillance claire, un trait autour de la note entière), Ctrl / Cmd +
// clic ajoute ou retire ; Suppr supprime ; une case vide pose une croche ; glisser DÉPLACE le groupe du même écart (dans le temps et d'une ligne à l'autre), une note garde
// exactement sa longueur, ne se pose jamais sur une autre ni hors de son accord (refus sans rien changer), UNE annulation ; une copie suit la souris, l'originale reste pâle ;
// les poignées d'une note choisie étirent TOUTES les notes choisies ; chaque ligne survolée fait entendre sa note (Paramètres › Audio « Son au déplacement »).
//
// CE QUE LE BANC TIENT : chaque geste lu dans le MODÈLE (jamais dans les pixels seuls), une annulation par geste, le refus qui ne change rien, la copie et les cases d'arrivée,
// le son au survol et son réglage, et que le téléphone n'a pas bougé (un toucher sur une note l'enlève encore).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('séquenceur : sélection et déplacement des notes');
const { estBruitReseau } = require('./_harness');
const V = require('./_verre_commun');
const R = require('./_retrait_ancien');

plan(41);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const mk = (r, q) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
const PARTIE = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] }];
const TEL = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 };

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (contexte) => {
        const ctx = await nav.newContext(contexte);
        await ctx.addInitScript(([S]) => {
            if (sessionStorage.getItem('banc-sq-notes')) return;
            sessionStorage.setItem('banc-sq-notes', '1');
            localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
            localStorage.setItem('harmohubCurrentSongId', 's1');
            localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
            localStorage.setItem('harmohubSequenceurOuvert', '1');
            sessionStorage.setItem('cc_accueil_vu', '1');
        }, [PARTIE]);
        await ctx.route(/gstatic\.com|googleapis\.com|tonejs\.github\.io/, r => r.abort());
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !V.BRUIT.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.waitForFunction(() => !!window.app);
        await p.waitForTimeout(1000);
        return { p, ctx };
    };
    // Lecture de l'état (jamais pour agir) : les croches de chaque position de l'accord c (0 = basse), et les annulations déposées.
    const pos = async (p, c = 0) => (await R.lire(p, c)).pos.join('|');
    const annulations = (p) => p.evaluate(() => window.app.undoStack.length);
    const sel = (p) => p.evaluate(() => ({ n: window.app.sequenceur.sel.length, marquees: document.querySelectorAll('#sq-grille .sq-sel').length, g: document.querySelectorAll('#sq-grille .sq-sel-g').length, d: document.querySelectorAll('#sq-grille .sq-sel-d').length }));
    const caseSel = (r, k, c = 0) => `#sq-grille .sq-case[data-c="${c}"][data-r="${r}"][data-k="${k}"]`;
    const centre = async (p, s) => { const b = await p.locator(s).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }; };
    const cliquer = async (p, s, modif) => { const c = await centre(p, s); if (modif) await p.keyboard.down(modif); await p.mouse.click(c.x, c.y); if (modif) await p.keyboard.up(modif); await p.waitForTimeout(250); };
    // Un VRAI glissé, du centre d'une case au centre d'une autre ; `pendant` regarde l'écran avant le relâchement.
    const glisser = async (p, de, vers, pendant) => {
        const a = await centre(p, de), b = await centre(p, vers);
        await p.mouse.move(a.x, a.y); await p.mouse.down();
        await p.mouse.move(a.x + (b.x - a.x) / 3, a.y + (b.y - a.y) / 3, { steps: 4 });
        await p.mouse.move(b.x, b.y, { steps: 6 });
        await p.waitForTimeout(120);
        if (pendant) await pendant();
        await p.mouse.up(); await p.waitForTimeout(350);
    };
    const choisirAccord0 = async (p) => { await R.choisirAccord(p, 0, 500); };

    // ======================================================================================================
    console.log('\n=== A. Un clic sélectionne, Ctrl + clic ajoute, Suppr supprime ===');
    let { p, ctx } = await ouvrir({ viewport: { width: 1440, height: 900 } });
    await choisirAccord0(p);
    await cliquer(p, '#sq-effacer');
    exiger((await pos(p)).split('|').every(x => x === ''), 'l\'accord est vidé (Effacer) : on part de rien');
    // Trois croches seules, sur trois lignes : r0 = position haute (3), r1, r2.
    await cliquer(p, caseSel(0, 0)); await cliquer(p, caseSel(1, 2)); await cliquer(p, caseSel(2, 4));
    const trois = await pos(p);
    check(trois === '|4|2|0', `trois croches posées d'un clic sur des cases vides (positions : ${trois})`);
    let u0 = await annulations(p);
    await cliquer(p, caseSel(1, 2));
    let s = await sel(p);
    check(await pos(p) === trois && await annulations(p) === u0, 'un clic sur une NOTE ne l\'enlève plus : le morceau n\'a pas bougé, aucune annulation');
    check(s.n === 1 && s.marquees === 1 && s.g === 1 && s.d === 1, `elle est sélectionnée : une seule note, un trait autour de la note entière (${JSON.stringify(s)})`);
    await cliquer(p, caseSel(0, 0), 'Control');
    s = await sel(p);
    check(s.n === 2, `Ctrl + clic sur une autre note l'ajoute (${s.n} notes choisies)`);
    await cliquer(p, caseSel(0, 0), 'Control');
    s = await sel(p);
    check(s.n === 1, `Ctrl + clic sur une note déjà choisie la retire (${s.n})`);
    await cliquer(p, caseSel(0, 0), 'Control');
    await cliquer(p, caseSel(0, 0));
    s = await sel(p);
    check(s.n === 1 && await pos(p) === trois, 'un clic simple sur une note d\'un groupe garde cette seule note');
    await cliquer(p, caseSel(3, 6));
    s = await sel(p);
    check(s.n === 0 && (await pos(p)).split('|')[0] === '6', `une case VIDE pose une croche (position basse : ${(await pos(p)).split('|')[0]}) et lève la sélection`);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
    // Suppr : deux notes choisies, une annulation.
    await cliquer(p, caseSel(0, 0)); await cliquer(p, caseSel(1, 2), 'Control');
    u0 = await annulations(p);
    await p.keyboard.press('Delete'); await p.waitForTimeout(400);
    check(await pos(p) === '|4||', `Suppr supprime les deux notes choisies, l'autre reste (${await pos(p)})`);
    check(await annulations(p) === u0 + 1 && (await sel(p)).n === 0, 'd\'UNE annulation, et la sélection est vide');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(400);
    check(await pos(p) === trois, `Ctrl+Z rend les deux notes d'un coup (${await pos(p)})`);
    await cliquer(p, caseSel(2, 4));
    await p.keyboard.press('Backspace'); await p.waitForTimeout(400);
    check(await pos(p) === '||2|0', `Retour arrière supprime aussi (${await pos(p)})`);
    check(await p.evaluate(() => loadProgressionSections()[0].chords.length) === 4, 'et ne supprime pas l\'ACCORD choisi dans la grille');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);

    // ======================================================================================================
    console.log('\n=== B. Les poignées étirent toutes les notes choisies ===');
    await cliquer(p, '#sq-effacer');
    await cliquer(p, caseSel(0, 1)); await cliquer(p, caseSel(2, 1));
    exiger(await pos(p) === '|1||1', `deux notes d'une croche posées (${await pos(p)})`);
    await cliquer(p, caseSel(0, 1)); await cliquer(p, caseSel(2, 1), 'Control');
    exiger((await sel(p)).n === 2, 'les deux sont choisies');
    u0 = await annulations(p);
    const poigneeD = `${caseSel(0, 1)} .sq-bord.d`;
    await glisser(p, poigneeD, caseSel(0, 3));
    const apresEtire = (await R.lire(p, 0)).pos;
    check(apresEtire[3] === '1,2,3' && apresEtire[1] === '1,2,3', `tirée de deux croches vers la droite, la poignée étire LES DEUX notes (${apresEtire.join('|')})`);
    check(await annulations(p) === u0 + 1, 'sous une seule annulation');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
    check((await R.lire(p, 0)).pos.filter(x => x !== '').join() === '1,1', 'Ctrl+Z ramène les deux notes d\'une croche');
    // Une seule note choisie : l'étirement d'une seule note, comme avant.
    await cliquer(p, caseSel(0, 1));
    await glisser(p, `${caseSel(0, 1)} .sq-bord.d`, caseSel(0, 2));
    const une = (await R.lire(p, 0)).pos;
    check(une[3] === '1,2' && une[1] === '1', `une seule note choisie : seule elle s'étire (${une.join('|')})`);
    await cliquer(p, `${caseSel(2, 1)} .sq-bord.d`);
    check((await sel(p)).n === 1 && (await R.lire(p, 0)).pos.filter(x => x !== '').length === 2, 'un clic sur la poignée (sans glisser) choisit la note, ne l\'enlève plus');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);

    // ======================================================================================================
    console.log('\n=== C. Glisser déplace la note, ou le groupe, du même écart ===');
    // Une note de deux croches : on la peint d'un trait (glisser sur des cases vides).
    await cliquer(p, '#sq-effacer');
    await glisser(p, caseSel(1, 1), caseSel(1, 2));
    exiger((await R.lire(p, 0)).pos[2] === '1,2', `une note de deux croches, peinte d'un trait (${(await R.lire(p, 0)).pos.join('|')})`);
    u0 = await annulations(p);
    let vu = null;
    await glisser(p, caseSel(1, 1), caseSel(1, 5), async () => {
        vu = await p.evaluate(() => { const f = document.getElementById('sq-fantome'); return { fantome: !f.hidden && f.getBoundingClientRect().width > 0, pales: document.querySelectorAll('#sq-grille .sq-fantome').length, cibles: document.querySelectorAll('#sq-grille .sq-cible').length, curseur: document.body.classList.contains('sq-deplace') }; });
    });
    check(vu && vu.fantome && vu.pales === 2 && vu.cibles === 2, `pendant le glissé : une copie suit la souris, l'originale reste pâle (${vu && vu.pales} cases), les cases d'arrivée sont surlignées (${vu && vu.cibles})`);
    check(await p.evaluate(() => document.getElementById('sq-fantome').hidden && !document.querySelector('#sq-grille .sq-fantome, #sq-grille .sq-cible')), 'au relâchement tout cela disparaît');
    const deplacee = (await R.lire(p, 0)).pos;
    check(deplacee[2] === '5,6', `la note a glissé de quatre croches en gardant sa longueur de deux (${deplacee.join('|')})`);
    check(await annulations(p) === u0 + 1, 'sous une seule annulation');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
    check((await R.lire(p, 0)).pos[2] === '1,2', 'Ctrl+Z la ramène');
    // D'une ligne à l'autre.
    await glisser(p, caseSel(1, 1), caseSel(0, 3));
    check((await R.lire(p, 0)).pos[3] === '3,4' && (await R.lire(p, 0)).pos[2] === '', `d'une ligne à l'autre : une ligne plus haut, deux croches plus loin, même longueur (${(await R.lire(p, 0)).pos.join('|')})`);
    // Le groupe : deux notes du même écart.
    await cliquer(p, '#sq-effacer');
    await cliquer(p, caseSel(0, 0)); await cliquer(p, caseSel(2, 2));
    await cliquer(p, caseSel(0, 0)); await cliquer(p, caseSel(2, 2), 'Control');
    u0 = await annulations(p);
    await glisser(p, caseSel(0, 0), caseSel(1, 3));
    const groupe = (await R.lire(p, 0)).pos;
    check(groupe[2] === '3' && groupe[0] === '5' && groupe[1] === '' && groupe[3] === '', `le groupe glisse d'un bloc : +3 croches, une ligne plus bas (${groupe.join('|')})`);
    check(await annulations(p) === u0 + 1 && (await sel(p)).n === 2 && (await sel(p)).marquees === 2, 'une annulation, et les deux notes restent choisies à leur nouvelle place');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);

    // ======================================================================================================
    console.log('\n=== D. Les refus ne changent rien ===');
    await cliquer(p, '#sq-effacer');
    await cliquer(p, caseSel(1, 1)); await cliquer(p, caseSel(1, 4));
    const avant = await pos(p); u0 = await annulations(p);
    await glisser(p, caseSel(1, 1), caseSel(1, 4));
    check(await pos(p) === avant && await annulations(p) === u0, `sur une AUTRE note : refus, le morceau n'a pas bougé et aucune annulation n'est déposée (${await pos(p)})`);
    await cliquer(p, '#sq-effacer');
    await glisser(p, caseSel(1, 5), caseSel(1, 7));
    exiger((await R.lire(p, 0)).pos[2] === '5,6,7', `une note de trois croches (${(await R.lire(p, 0)).pos.join('|')})`);
    const avant2 = await pos(p); u0 = await annulations(p);
    await glisser(p, caseSel(1, 5), caseSel(1, 7));
    check(await pos(p) === avant2 && await annulations(p) === u0, `qui déborderait de son accord : refus sans rien changer (${await pos(p)})`);
    // Une note d'un accord à l'autre : elle va dans l'accord voisin (qu'on vide d'abord : plaqué, il n'a pas une croche de libre), à la même croche.
    await R.choisirAccord(p, 1, 500); await cliquer(p, '#sq-effacer');
    await R.choisirAccord(p, 0, 500);
    await glisser(p, caseSel(1, 5), caseSel(1, 1, 1));
    check((await pos(p, 0)).split('|').every(x => x === '') && (await R.lire(p, 1)).pos.filter(x => x !== '').length === 1, `d'un accord à l'autre : elle quitte le premier (${await pos(p, 0)}) et arrive dans le second (${await pos(p, 1)})`);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);

    // ======================================================================================================
    console.log('\n=== E. Le son au survol, et son réglage ===');
    await cliquer(p, '#sq-effacer');
    await cliquer(p, caseSel(0, 1));
    await p.evaluate(() => { const sq = window.app.sequenceur, j = sq.jouerNote; window.__sons = 0; sq.jouerNote = function () { window.__sons++; return j.apply(this, arguments); }; });
    await glisser(p, caseSel(0, 1), caseSel(3, 4));
    const sons = await p.evaluate(() => window.__sons);
    check(sons >= 3, `en déplaçant à travers quatre lignes, chaque ligne survolée fait entendre sa note (${sons} sons)`);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
    await p.click('#open-settings'); await p.waitForTimeout(400);
    exiger(await p.evaluate(() => document.getElementById('toggle-son-deplacement') && document.getElementById('toggle-son-deplacement').getAttribute('aria-checked') === 'true'), 'Paramètres › Audio : « Son au déplacement », allumé par défaut');
    await p.click('#toggle-son-deplacement'); await p.waitForTimeout(200);
    check(await p.evaluate(() => localStorage.getItem('harmohubSonDeplacement')) === '0' && await p.evaluate(() => document.getElementById('toggle-son-deplacement').getAttribute('aria-checked')) === 'false', 'éteint, et retenu par appareil');
    await p.click('#settings-close'); await p.waitForTimeout(300);
    await p.evaluate(() => { window.__sons = 0; });
    await glisser(p, caseSel(0, 1), caseSel(3, 4));
    check(await p.evaluate(() => window.__sons) === 0, 'éteint, on déplace en silence');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);

    // ======================================================================================================
    console.log('\n=== F. Intensité : un clic règle la force, il ne sélectionne pas ===');
    await p.click('#sq-intensite'); await p.waitForTimeout(200);
    await cliquer(p, caseSel(0, 1));
    check((await sel(p)).n === 0 && await p.evaluate(() => document.querySelector('#sq-grille .sq-case.on.niv-fort') !== null), 'en mode Intensité, le clic change la force de la note et ne la sélectionne pas');
    await p.click('#sq-intensite'); await p.waitForTimeout(200);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
    check(erreurs.length === 0, `aucune erreur de page (${erreurs.slice(0, 2).join(' | ')})`);
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== G. Le téléphone n\'a pas bougé ===');
    ({ p, ctx } = await ouvrir(TEL));
    await p.tap('#bl-plus'); await p.waitForTimeout(400);
    await p.tap('#pl-notes'); await p.waitForTimeout(800);
    const avantTel = await p.evaluate(() => document.querySelectorAll('#sq-grille .sq-case.on').length);
    await p.tap('#sq-grille .sq-case.on'); await p.waitForTimeout(500);
    const apresTel = await p.evaluate(() => ({ n: document.querySelectorAll('#sq-grille .sq-case.on').length, sel: window.app.sequenceur.sel.length, marquees: document.querySelectorAll('#sq-grille .sq-sel').length, fantome: document.getElementById('sq-fantome').hidden }));
    check(apresTel.n < avantTel && apresTel.sel === 0 && apresTel.marquees === 0 && apresTel.fantome, `au téléphone, un toucher sur une note l'enlève encore (${avantTel} → ${apresTel.n} croches), rien n'est sélectionné`);
    await p.close(); await ctx.close();

    check(erreurs.length === 0, `aucune erreur de page ni de console (${erreurs.slice(0, 3).join(' | ')})`);
    await nav.close();
    bilan();
})().catch(e => { console.log('FATAL ' + (e && e.stack || e)); process.exit(1); });
