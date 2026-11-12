// LES POIGNÉES D'UNE NOTE DU SÉQUENCEUR : ÉTIRER OU RACCOURCIR AU GLISSÉ, CURSEUR « ⇔ » AU SURVOL (13/11), avec de vrais gestes (souris, puis doigt).
//
// LE RETOUR : « Dans le séquenceur, ajoute des poignées à droite et à gauche des notes pour pouvoir les étirer ou les raccourcir. On l'avait mis en place pour HarmoHub. L'icône
// du curseur doit changer en survolant la poignée. »
//
// CE QUE LE BANC TIENT : une note porte une poignée à gauche (son attaque) et une à droite (sa dernière croche), une note d'une croche les deux ; le curseur y devient « ⇔ » et
// pas ailleurs sur la note ; tirer la poignée de droite étire ou raccourcit, celle de gauche aussi (le niveau d'intensité suit l'attaque) ; une note garde une croche au moins,
// s'arrête contre sa voisine (rien n'est écrasé) et contre le bout de l'accord ; tout le glissé est UNE annulation ; un simple clic sur le bord enlève toujours la note ;
// au doigt, le glissé sur une poignée étire la note sans faire défiler la grille.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('poignées des notes du séquenceur');
const { estBruitReseau } = require('./_harness');

plan(24);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const mk = (r, q) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
const PARTIE = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7')] }];
const graine = (S) => {
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const surveiller = (p) => {
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
    };
    const ouvrir = async () => {
        const p = await nav.newPage({ viewport: { width: 1440, height: 900 } });
        surveiller(p);
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine, PARTIE);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    // Lecture de l'état (jamais pour agir) : les croches de chaque position, les soudures de la première, les niveaux.
    const etat = (p, c = 0) => p.evaluate((c) => {
        const d = loadProgressionSections()[0].chords[c];
        const e = SequenceurHarmo.lireAccord(d);
        const par = (v) => { const r = []; for (let k = 0; k < e.info.croches; k++) if (e.on.has(v + ':' + k)) r.push(k); return r.join(','); };
        const v0 = e.info.positions[0];
        return { pos: e.info.positions.map(par), positions: e.info.positions,
                 soude: [...e.soude].filter(x => x.startsWith(v0 + ':')).map(x => +x.split(':')[1]).sort((a, b) => a - b).join(','),
                 niveaux: Object.fromEntries([...e.niveaux].filter(([x]) => x.startsWith(v0 + ':'))) };
    }, c);
    const caseSq = (c, v, k) => `#sq-grille .sq-case[data-c="${c}"][data-v="${v}"][data-k="${k}"]`;
    const poignee = (c, v, k, cote) => `${caseSq(c, v, k)} .sq-bord.${cote}`;
    const centre = async (p, sel) => { const b = await p.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    const cliquer = async (p, sel) => { const q = await centre(p, sel); await p.mouse.click(q.x, q.y); await p.waitForTimeout(250); };
    const ctrlZ = async (p) => { await p.keyboard.press('Control+z'); await p.waitForTimeout(300); };
    // Le glissé d'une poignée : on part du centre de la poignée, on suit l'horizontale jusqu'au centre de la case visée (mesuré AVANT, la grille se redessine pendant le geste).
    const tirer = async (p, c, v, kPoignee, cote, kVisee, { garder = false } = {}) => {
        const a = await centre(p, poignee(c, v, kPoignee, cote)), b = await centre(p, caseSq(c, v, kVisee));
        await p.mouse.move(a.x, a.y); await p.mouse.down();
        const pas = 6;
        for (let i = 1; i <= pas; i++) await p.mouse.move(a.x + (b.x - a.x) * i / pas, a.y, { steps: 2 });
        if (!garder) { await p.mouse.up(); await p.waitForTimeout(300); }
    };
    const demarrer = async () => {
        const p = await ouvrir();
        await cliquer(p, '#vue-sequenceur');
        await cliquer(p, '#sq-grille .sq-nom[data-c="0"]');
        return p;
    };
    const curseurSous = (p, q) => p.evaluate(([x, y]) => getComputedStyle(document.elementFromPoint(x, y)).cursor, [q.x, q.y]);

    // ======================================================================================================
    console.log('\n=== A. Chaque note porte ses poignées ===');
    let p = await demarrer();
    let e = await etat(p);
    const v = e.positions[0]; // la voix la plus grave : une longue note d'un bout à l'autre de l'accord (« Plaqué »)
    const bilanLigne = await p.evaluate((v) => {
        const g = document.querySelectorAll(`#sq-grille .sq-case[data-c="0"][data-v="${v}"] .sq-bord.g`).length;
        const d = document.querySelectorAll(`#sq-grille .sq-case[data-c="0"][data-v="${v}"] .sq-bord.d`).length;
        const premiere = document.querySelector(`#sq-grille .sq-case[data-c="0"][data-v="${v}"][data-k="0"] .sq-bord.g`) != null;
        const derniere = document.querySelector(`#sq-grille .sq-case[data-c="0"][data-v="${v}"][data-k="7"] .sq-bord.d`) != null;
        return { g, d, premiere, derniere };
    }, v);
    exiger(bilanLigne.g === 1 && bilanLigne.d === 1 && bilanLigne.premiere && bilanLigne.derniere,
        `une longue note de huit croches : UNE poignée à gauche (sur la 1re croche) et UNE à droite (sur la 8e), aucune au milieu (${bilanLigne.g} / ${bilanLigne.d})`);
    await cliquer(p, '#sq-effacer');
    await cliquer(p, caseSq(0, v, 2));
    const seule = await p.evaluate((sel) => ({ g: document.querySelectorAll(sel + ' .sq-bord.g').length, d: document.querySelectorAll(sel + ' .sq-bord.d').length }), caseSq(0, v, 2));
    check(seule.g === 1 && seule.d === 1, `une note d'une croche porte les deux poignées (${seule.g} / ${seule.d})`);

    // ======================================================================================================
    console.log('\n=== B. Le curseur change au survol de la poignée ===');
    const ph = await centre(p, poignee(0, v, 2, 'd'));
    await p.mouse.move(ph.x, ph.y);
    const curseurPoignee = await curseurSous(p, ph);
    check(curseurPoignee === 'ew-resize', `au-dessus de la poignée, le curseur est « ⇔ » (${curseurPoignee})`);
    const lisere = await p.evaluate((sel) => getComputedStyle(document.querySelector(sel), '::after').backgroundColor, poignee(0, v, 2, 'd'));
    check(/rgba?\(255, 255, 255/.test(lisere) && !/, 0\)$/.test(lisere), `et la poignée s'éclaire sous le pointeur (${lisere})`);
    const bn = await p.locator(`${caseSq(0, v, 2)} .sq-note`).boundingBox();
    const corps = { x: bn.x + bn.width / 2, y: bn.y + bn.height / 2 };
    await p.mouse.move(corps.x, corps.y);
    const curseurCorps = await curseurSous(p, corps);
    check(!/ew-resize/.test(curseurCorps) && curseurCorps !== 'auto', `au milieu de la note, le curseur reste celui du séquenceur, pas « ⇔ » (${curseurCorps.slice(0, 40)})`);

    // ======================================================================================================
    console.log('\n=== C. Tirer la poignée de droite étire la note ===');
    await tirer(p, 0, v, 2, 'd', 5, { garder: true });
    const pendant = await p.evaluate(() => ({ classe: document.body.classList.contains('sq-etire'), curseur: getComputedStyle(document.body).cursor }));
    check(pendant.classe && pendant.curseur === 'ew-resize', `pendant le glissé, le curseur reste « ⇔ » partout (${pendant.curseur})`);
    await p.mouse.up(); await p.waitForTimeout(300);
    e = await etat(p);
    check(e.pos[0] === '2,3,4,5' && e.soude === '3,4,5', `de la croche 3 à la 6 : une note tenue de quatre croches (${e.pos[0]}, soudures ${e.soude})`);
    check(!(await p.evaluate(() => document.body.classList.contains('sq-etire'))), 'le curseur d\'étirement est rendu au relâchement');
    await ctrlZ(p);
    e = await etat(p);
    check(e.pos[0] === '2', `un seul Ctrl+Z défait tout l'étirement (${e.pos[0]})`);

    // ======================================================================================================
    console.log('\n=== D. Raccourcir, des deux côtés ===');
    await tirer(p, 0, v, 2, 'd', 5);
    await tirer(p, 0, v, 5, 'd', 3);
    e = await etat(p);
    check(e.pos[0] === '2,3' && e.soude === '3', `la poignée de droite tirée vers la gauche raccourcit la note (${e.pos[0]}, soudures ${e.soude})`);
    await tirer(p, 0, v, 2, 'g', 3);
    e = await etat(p);
    check(e.pos[0] === '3' && e.soude === '', `la poignée de gauche tirée vers la droite la raccourcit aussi (${e.pos[0]}, soudures ${e.soude})`);

    console.log('\n=== E. Étirer vers la gauche ===');
    await cliquer(p, '#sq-effacer');
    await cliquer(p, caseSq(0, v, 5));
    await tirer(p, 0, v, 5, 'g', 2);
    e = await etat(p);
    check(e.pos[0] === '2,3,4,5' && e.soude === '3,4,5', `la poignée de gauche étire la note vers l'attaque (${e.pos[0]}, soudures ${e.soude})`);

    // ======================================================================================================
    console.log('\n=== F. Une note s\'arrête contre sa voisine, garde une croche au moins ===');
    await cliquer(p, '#sq-effacer');
    await cliquer(p, caseSq(0, v, 1));
    await cliquer(p, caseSq(0, v, 4));
    await tirer(p, 0, v, 1, 'd', 7);
    e = await etat(p);
    check(e.pos[0] === '1,2,3,4' && e.soude === '2,3', `tirée trop loin, la note s'arrête contre sa voisine, qui n'est ni écrasée ni soudée (${e.pos[0]}, soudures ${e.soude})`);
    await tirer(p, 0, v, 4, 'g', 0);
    e = await etat(p);
    check(e.pos[0] === '1,2,3,4' && e.soude === '2,3', `et la voisine ne peut pas non plus passer sur elle par la gauche (${e.pos[0]})`);
    await cliquer(p, '#sq-effacer');
    await cliquer(p, caseSq(0, v, 2));
    await tirer(p, 0, v, 2, 'd', 5);
    await tirer(p, 0, v, 5, 'd', 0);
    e = await etat(p);
    check(e.pos[0] === '2' && e.soude === '', `on ne peut pas raccourcir une note sous une croche (${e.pos[0]})`);

    // ======================================================================================================
    console.log('\n=== G. L\'intensité suit l\'attaque ===');
    await cliquer(p, '#sq-effacer');
    await cliquer(p, caseSq(0, v, 4));
    await cliquer(p, '#sq-intensite');
    await cliquer(p, caseSq(0, v, 4));
    await cliquer(p, '#sq-intensite');
    e = await etat(p);
    exiger(e.niveaux[v + ':4'] === 'fort', `la note de la croche 5 est « forte » (${JSON.stringify(e.niveaux)})`);
    await tirer(p, 0, v, 4, 'g', 1);
    e = await etat(p);
    check(e.pos[0] === '1,2,3,4' && e.niveaux[v + ':1'] === 'fort' && e.niveaux[v + ':4'] === undefined, `étirée par la gauche, la note garde son niveau, porté par sa nouvelle attaque (${JSON.stringify(e.niveaux)})`);

    // ======================================================================================================
    console.log('\n=== H. Un clic sur le bord enlève toujours la note, et la poignée s\'arrête au bout de l\'accord ===');
    await cliquer(p, '#sq-effacer');
    await cliquer(p, caseSq(0, v, 3));
    await cliquer(p, poignee(0, v, 3, 'd'));
    e = await etat(p);
    check(e.pos[0] === '', `un clic sur la poignée, sans glisser, enlève la note comme un clic sur la note (${e.pos[0]})`);
    await cliquer(p, caseSq(0, v, 5));
    const autre = await etat(p, 1);
    const rangee = await p.evaluate((sel) => document.querySelector(sel).dataset.r, caseSq(0, v, 5));
    const a = await centre(p, poignee(0, v, 5, 'd')), loin = await centre(p, `#sq-grille .sq-case[data-c="1"][data-r="${rangee}"][data-k="5"]`);
    await p.mouse.move(a.x, a.y); await p.mouse.down();
    for (let i = 1; i <= 8; i++) await p.mouse.move(a.x + (loin.x - a.x) * i / 8, a.y, { steps: 2 });
    await p.mouse.up(); await p.waitForTimeout(300);
    e = await etat(p);
    const apres = await etat(p, 1);
    check(e.pos[0] === '5,6,7' && JSON.stringify(apres.pos) === JSON.stringify(autre.pos), `tirée jusque dans l'accord voisin, la note s'arrête au bout de SON accord (${e.pos[0]}) sans toucher l'autre`);
    await p.context().close();

    // ======================================================================================================
    console.log('\n=== I. Au doigt : le glissé sur une poignée étire la note sans faire défiler ===');
    const ctx = await nav.newContext({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });
    const t = await ctx.newPage();
    surveiller(t);
    const cdp = await ctx.newCDPSession(t);
    await t.goto(`${BASE}/index.html`); await t.evaluate(graine, PARTIE); await t.reload(); await t.waitForTimeout(1000);
    const toucher = async (sel, ms = 450) => { const r = await t.locator(sel).boundingBox(); await t.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); await t.waitForTimeout(ms); };
    const b0 = await t.locator('#progression-sections .grid-cell[data-section="0"][data-index="0"]').boundingBox();
    await t.touchscreen.tap(b0.x + b0.width / 2, b0.y + b0.height - 6); await t.waitForTimeout(600);
    await toucher('#bl-plus'); await toucher('#pl-notes', 800);
    e = await etat(t);
    const vt = e.positions[3]; // la ligne du haut, visible sans défiler à 664 px
    await toucher('#sq-effacer');
    await toucher(caseSq(0, vt, 1));
    const largeur = await t.evaluate((sel) => document.querySelector(sel).getBoundingClientRect().width, poignee(0, vt, 1, 'd'));
    check(largeur >= 9, `au doigt, la poignée est plus large (${largeur.toFixed(1)} px)`);
    const pt = await centre(t, poignee(0, vt, 1, 'd')), cible = await centre(t, caseSq(0, vt, 3));
    const gauche0 = await t.evaluate(() => document.getElementById('sq-grille').scrollLeft);
    const points = Array.from({ length: 8 }, (_, i) => ({ x: Math.round(pt.x + (cible.x - pt.x) * (i + 1) / 8), y: Math.round(pt.y) }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(pt.x), y: Math.round(pt.y) }] });
    for (const q of points) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [q] }); await t.waitForTimeout(30); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await t.waitForTimeout(400);
    e = await etat(t);
    check(e.pos[3] === '1,2,3' && e.soude !== undefined, `le doigt tire la poignée de la croche 2 à la croche 4 : la note s'étire (${e.pos[3]})`);
    const gauche1 = await t.evaluate(() => document.getElementById('sq-grille').scrollLeft);
    check(gauche1 === gauche0, `la grille n'a pas défilé pendant le glissé (${gauche0} → ${gauche1})`);
    await toucher(caseSq(0, vt, 2));
    e = await etat(t);
    check(e.pos[3] === '', `et un toucher sur la note l'enlève en entier comme avant (${e.pos[3]})`);
    await ctx.close();

    // ======================================================================================================
    check(erreurs.length === 0, `aucune erreur de page${erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''}`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
