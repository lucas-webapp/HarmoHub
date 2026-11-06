// LOT 10e DE LA REFONTE — le panneau d'ajout du TÉLÉPHONE (docs/refonte.md, section « Téléphone » ; maquette « Téléphone (v2) »,
// page project/Telephone2.dc.html ; CLAUDE-HARMOHUB.md, « Lot 10 »).
//
// « Ajout : saisie unique (syntaxe complète), aide « ? », suggestions après l'accord précédent, accords de la tonalité. » La case « + » d'une partie
// ouvre un panneau qui monte du bas, comme celui de l'accord (10d). Il remplace sous 900px la carte « Nouvel accord » (mode Ajout), son bouton
// « Ajouter » et la saisie rapide posée dans la page : le champ lui-même est DÉPLACÉ dans le panneau, jamais dupliqué.
//
// Ce que le banc tient, par de VRAIS gestes (toucher, clavier) — window.app ne sert qu'à relire l'état :
//   A. toucher la case « + » : le panneau se pose sur la barre de lecture, dit la destination, la saisie est dedans (44px), la carte « Nouvel accord »,
//      « Ajouter » et la saisie de la page ont disparu, la case « + » reste visible au-dessus du panneau, le clavier virtuel ne s'ouvre pas ;
//   B. un accord de la tonalité, d'un toucher : ajouté à la fin, UNE annulation, le panneau reste ouvert, le suivant se range après ;
//   C. les suggestions « Souvent après » suivent l'accord précédent ; « avec 7e » passe aux accords de 7e ;
//   D. la saisie unique, syntaxe complète : « Am7/F » (deux accords, une annulation), « C_E » (basse), puis un symbole inconnu ne change rien ;
//   E. l'aide « ? » s'ouvre dans l'écran et se referme ;
//   F. ✕, Échap et le toucher à côté referment le panneau, la saisie rentre dans la page, la destination s'oublie ;
//   G. ouvrir le panneau d'ajout ferme celui de l'accord, et l'inverse ; le mode Modification garde sa carte (10d) ;
//   H. le verre : le fond des menus, aucun texte illisible ;
//   I. 320px : tout tient ;
//   J. l'ordinateur n'a pas bougé (la case « + » est un champ, la saisie reste dans la page), et franchir le seuil panneau ouvert le referme proprement.
const { chromium } = require('playwright');
const V = require('./_verre_commun');
const { check, exiger, plan, bilan } = require('./_harness')('téléphone : panneau d\'ajout (lot 10e)');
const { estBruitReseau } = require('./_harness');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

plan(34);

const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
const SECTIONS = [
    { title: 'Couplet', chords: [mk('C', 'maj'), mk('A', 'min'), mk('F', 'maj'), mk('G', 'maj')] },
    { title: 'Refrain', chords: [mk('F', 'maj'), mk('G', 'maj')] },
];

async function ouvrir(nav, contexte, erreurs, nom, reglages = {}) {
    const ctx = await nav.newContext(contexte);
    await ctx.addInitScript(([sections, reglages]) => {
        if (sessionStorage.getItem('banc-10e')) return;
        sessionStorage.setItem('banc-10e', '1');
        localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight', savedAt: Date.now(), sections }]));
        localStorage.setItem('harmohubCurrentSongId', 's1');
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
        for (const k of Object.keys(reglages)) localStorage.setItem(k, reglages[k]);
    }, [SECTIONS, reglages]);
    await ctx.route(/gstatic\.com|googleapis\.com|tonejs\.github\.io/, r => r.abort());
    const p = await ctx.newPage();
    p.on('pageerror', e => erreurs.push(nom + e.message));
    p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !V.BRUIT.test(m.text())) erreurs.push(nom + 'console: ' + m.text()); });
    await p.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await p.waitForFunction(() => !!window.app);
    await p.waitForTimeout(800);
    return { p, ctx };
}

const TEL = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 };
const PLUS = (s) => `#progression-sections .cell-add-input[data-section="${s}"]`;
const CASE = (s, i) => `#progression-sections .grid-cell[data-section="${s}"][data-index="${i}"]`;
const toucher = async (p, sel, ms = 300) => { await p.tap(sel); await p.waitForTimeout(ms); };
const noms = (p, s) => p.evaluate((s) => JSON.parse(localStorage.getItem('myProgression')).sections[s].chords.map(c => c.root + ':' + c.quality + (c.bass ? '/' + c.bass : '')).join(' '), s);
const etat = (p) => p.evaluate(() => {
    const a = window.app, pa = document.getElementById('ajout-aide');
    const rang = document.querySelector('.quick-add-row');
    return {
        ouvert: !pa.hidden && pa.getBoundingClientRect().height > 0, cible: a._cibleAjout ? { ...a._cibleAjout } : null,
        undo: a.undoStack.length, rangDans: !!(rang && rang.parentElement.id === 'aa-saisie'), rangVisible: !!(rang && rang.getBoundingClientRect().height > 0),
        lieu: (document.getElementById('ajout-lieu') || {}).textContent,
    };
});

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    try {
        const { p, ctx } = await ouvrir(nav, TEL, erreurs, 'téléphone : ');
        const e0 = await etat(p);
        const avant = await p.evaluate(() => ({
            carte: document.getElementById('accord-card').getBoundingClientRect().height, ajouter: document.getElementById('save').getBoundingClientRect().height,
            saisiePage: document.getElementById('quick-add-input').getBoundingClientRect().height,
        }));

        // ===== A. TOUCHER LA CASE « + » ==============================================================================================
        await toucher(p, PLUS(0), 500);
        const a1 = await etat(p);
        exiger(a1.ouvert && a1.cible && a1.cible.section === 0 && a1.cible.index === null, `toucher la case « + » ouvre le panneau d'ajout, destination : la fin de la partie (${JSON.stringify(a1.cible)})`);
        check(/Couplet/.test(a1.lieu) && /G/.test(a1.lieu), `le panneau dit où l'on ajoute (« ${a1.lieu} »)`);
        const g = await p.evaluate((plus) => {
            const pa = document.getElementById('ajout-aide').getBoundingClientRect(), bl = document.getElementById('barre-lecture').getBoundingClientRect();
            const c = document.querySelector(plus).getBoundingClientRect(), saisie = document.getElementById('quick-add-input').getBoundingClientRect();
            const bt = [...document.querySelectorAll('#ajout-aide .quick-add-row button, #ajout-aide .ajout-tuile, #ajout-aide [data-ajout]')].map(b => Math.round(b.getBoundingClientRect().height));
            return { bas: Math.round(pa.bottom), barre: Math.round(bl.top), l: Math.round(pa.left), r: Math.round(pa.right), h: Math.round(pa.height), ih: innerHeight,
                plusBas: Math.round(c.bottom), plusHaut: Math.round(c.top), paHaut: Math.round(pa.top), saisieH: Math.round(saisie.height), bt,
                rayon: getComputedStyle(document.getElementById('ajout-aide')).borderTopLeftRadius, enfocus: document.activeElement === document.getElementById('quick-add-input') };
        }, PLUS(0));
        check(Math.abs(g.bas - g.barre) <= 1 && g.l === 0 && g.r === 390 && g.rayon === '12px', `posé sur la barre de lecture, pleine largeur, 12px d'arrondi (${JSON.stringify({ bas: g.bas, barre: g.barre, l: g.l, r: g.r, rayon: g.rayon })})`);
        check(g.plusBas <= g.paHaut && g.plusHaut > 100, `la case « + » reste visible au-dessus du panneau (case ${g.plusHaut}-${g.plusBas}, panneau dès ${g.paHaut})`);
        check(g.saisieH >= 44 && g.bt.length >= 10 && g.bt.every(h => h >= 44), `la saisie et les boutons sont à la jauge du téléphone, 44px (${g.saisieH}px ; ${g.bt.join(',')})`);
        check(!g.enfocus, `le clavier virtuel ne s'ouvre pas tout seul sur les accords proposés (focus dans la saisie : ${g.enfocus})`);
        const a2 = await p.evaluate(() => ({
            carte: document.getElementById('accord-card').getBoundingClientRect().height, ajouter: document.getElementById('save').getBoundingClientRect().height,
            mode: document.body.dataset.appMode, readonly: document.querySelector('.cell-add-input').readOnly,
        }));
        check(avant.carte === 0 && a2.carte === 0, `la carte « Nouvel accord » n'est plus dans la page, ni au repos ni panneau ouvert (${avant.carte}px, ${a2.carte}px)`);
        check(a2.ajouter === 0 && a2.mode === 'add' && a2.readonly, `le bouton « Ajouter » a disparu, le champ de la case « + » est en lecture seule (${JSON.stringify(a2)})`);
        check(e0.rangVisible === false && a1.rangDans && a1.rangVisible, `la saisie de la page a disparu, la même est dans le panneau (page : ${e0.rangVisible}, panneau : ${a1.rangDans})`);

        // ===== B. UN ACCORD DE LA TONALITÉ ===========================================================================================
        const u0 = (await etat(p)).undo;
        await toucher(p, '#ajout-aide .ajout-tuiles:last-of-type .ajout-tuile[data-ajout-root="D"]', 400);
        const b1 = await etat(p);
        check((await noms(p, 0)).endsWith('G:maj D:min') && b1.undo === u0 + 1 && b1.ouvert, `un toucher sur Dm l'ajoute à la fin, une seule annulation, le panneau reste ouvert (${await noms(p, 0)} ; annulations ${u0} → ${b1.undo})`);
        await toucher(p, '#ajout-aide .ajout-tuile[data-ajout-root="E"]', 400);
        const b2 = await etat(p);
        check((await noms(p, 0)).endsWith('D:min E:min') && b2.undo === u0 + 2 && /Em/.test(b2.lieu), `le suivant se range après : deux accords dans l'ordre, deux annulations (${await noms(p, 0)}) ; le panneau dit « ${b2.lieu} »`);
        const b3 = await p.evaluate((plus) => { const c = document.querySelector(plus).getBoundingClientRect(), pa = document.getElementById('ajout-aide').getBoundingClientRect(); return c.bottom <= pa.top + 1 && c.top > 0; }, PLUS(0));
        check(b3, `la case « + » suit la grille qui grandit : toujours visible au-dessus du panneau`);

        // ===== C. SUGGESTIONS ET « AVEC 7E » =========================================================================================
        const c1 = await p.evaluate(() => ({ lbl: [...document.querySelectorAll('#ajout-aide .rr-lbl')].map(e => e.textContent), sugg: [...document.querySelectorAll('#ajout-aide .ajout-tuile-sugg')].map(e => e.dataset.ajoutRoot + e.dataset.ajoutQuality),
            colonnes: getComputedStyle(document.querySelector('#ajout-aide .ajout-tuiles')).gridTemplateColumns.split(' ').length }));
        check(/Souvent après Em/.test(c1.lbl.join('|')) && c1.sugg.length >= 2 && c1.colonnes === 4, `« Souvent après Em » : des suites habituelles, sur quatre colonnes (${JSON.stringify(c1)})`);
        await toucher(p, '#ajout-aide [data-ajout="avec7"]', 300);
        const c2 = await p.evaluate(() => [...document.querySelectorAll('#ajout-aide .ajout-tuiles:last-of-type .ajout-tuile')].map(e => e.dataset.ajoutQuality));
        check(c2.length === 7 && c2.includes('maj7') && c2.includes('dom7') && c2.includes('min7'), `« avec 7e » : les sept accords de la tonalité en quatre sons (${c2.join(',')})`);
        await toucher(p, '#ajout-aide [data-ajout="avec7"]', 300);

        // ===== D. LA SAISIE UNIQUE ===================================================================================================
        await toucher(p, '#quick-add-input', 300);
        await p.keyboard.type('Am7/F', { delay: 20 });
        const u1 = (await etat(p)).undo;
        await toucher(p, '#quick-add-btn', 400);
        const d1 = await etat(p);
        check((await noms(p, 0)).endsWith('E:min A:min7 F:maj') && d1.undo === u1 + 1, `« Am7/F » : deux accords, une seule annulation (${await noms(p, 0)} ; ${u1} → ${d1.undo})`);
        const champ = await p.evaluate(() => document.getElementById('quick-add-input').value);
        check(champ === '' && d1.ouvert, `la saisie se vide et le panneau reste ouvert pour enchaîner (« ${champ} »)`);
        await toucher(p, '#quick-add-input', 200);
        await p.keyboard.type('C_E', { delay: 20 });
        await p.keyboard.press('Control+Enter'); await p.waitForTimeout(400);
        check((await noms(p, 0)).endsWith('F:maj C:maj/E'), `« C_E » : la syntaxe complète, ici une basse (${await noms(p, 0)})`);
        const n0 = await noms(p, 0);
        await p.keyboard.type('Zzz', { delay: 20 });
        await p.keyboard.press('Control+Enter'); await p.waitForTimeout(300);
        check(await noms(p, 0) === n0, `un symbole inconnu ne change rien (${await noms(p, 0)})`);
        await p.evaluate(() => { document.getElementById('quick-add-input').value = ''; });

        // ===== E. L'AIDE « ? » ======================================================================================================
        await toucher(p, '#quick-add-help-btn', 300);
        const h1 = await p.evaluate(() => { const h = document.getElementById('quick-add-help'), r = h.getBoundingClientRect();
            return { ouvert: !h.hidden, dedans: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, texte: /C\/Am\/F\/G/.test(h.textContent) }; });
        check(h1.ouvert && h1.dedans && h1.texte, `« ? » ouvre l'aide de la saisie, entière dans l'écran (${JSON.stringify(h1)})`);
        await toucher(p, '#quick-add-help-btn', 300);
        check(await p.evaluate(() => document.getElementById('quick-add-help').hidden), `un second toucher sur « ? » la referme`);

        // ===== G. L'ACCORD ET L'AJOUT SE CÈDENT LA PLACE ===============================================================================
        await toucher(p, CASE(0, 0), 500);
        const g1 = await p.evaluate(() => ({ ajout: !document.getElementById('ajout-aide').hidden, accord: !document.getElementById('panneau-accord').hidden, cible: window.app._cibleAjout }));
        check(!g1.ajout && g1.accord && g1.cible === null, `toucher une case referme le panneau d'ajout et ouvre celui de l'accord (${JSON.stringify(g1)})`);
        // Le panneau de l'accord recouvre le bas de la page : on fait défiler la grille (le doigt le ferait) jusqu'à la case « + » de l'autre partie.
        await p.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'start' }), PLUS(1));
        await p.evaluate(() => window.scrollBy(0, -(document.getElementById('song-card').offsetHeight + 160))); await p.waitForTimeout(300);
        await toucher(p, PLUS(1), 500);
        const g2 = await p.evaluate(() => ({ ajout: !document.getElementById('ajout-aide').hidden, accord: !document.getElementById('panneau-accord').hidden, cible: window.app._cibleAjout && window.app._cibleAjout.section }));
        check(g2.ajout && !g2.accord && g2.cible === 1, `toucher la case « + » d'une autre partie referme celui de l'accord et vise cette partie (${JSON.stringify(g2)})`);

        // ===== F. REFERMER ==========================================================================================================
        const nF = await noms(p, 0), uF = (await etat(p)).undo;
        await toucher(p, '#ajout-aide [data-ajout="fermer"]', 400);
        const f1 = await etat(p);
        check(!f1.ouvert && f1.cible === null && !f1.rangDans && f1.rangVisible === false, `✕ referme, la destination s'oublie, la saisie est rentrée dans la page (${JSON.stringify({ ouvert: f1.ouvert, cible: f1.cible, dans: f1.rangDans })})`);
        await toucher(p, PLUS(0), 400);
        await p.keyboard.press('Escape'); await p.waitForTimeout(300);
        check(!(await etat(p)).ouvert, `Échap referme le panneau`);
        await toucher(p, PLUS(0), 400);
        const hors = await p.locator('#song-card').boundingBox();
        await p.touchscreen.tap(hors.x + hors.width / 2, hors.y + 4); await p.waitForTimeout(400);
        check(!(await etat(p)).ouvert && (await etat(p)).cible === null, `toucher à côté referme le panneau et oublie la destination`);
        check(nF === await noms(p, 0) && uF === (await etat(p)).undo, `refermer, de trois façons, n'écrit rien dans le morceau et ne dépose aucune annulation`);
        await ctx.close();

        // ===== H. LE VERRE ===========================================================================================================
        {
            const off = await ouvrir(nav, TEL, erreurs, 'verre éteint : ');
            const on = await ouvrir(nav, TEL, erreurs, 'verre allumé : ', { 'harmohub.glass.v1': '1' });
            for (const pg of [off.p, on.p]) await toucher(pg, PLUS(0), 500);
            const fond = (pg) => pg.evaluate(() => { const cs = getComputedStyle(document.getElementById('ajout-aide')); return cs.backgroundColor + ' ' + cs.backdropFilter; });
            const [fOff, fOn] = [await fond(off.p), await fond(on.p)];
            check(fOff !== fOn && /blur/.test(fOn), `verre allumé : le panneau prend le fond dépoli des menus (${fOff} → ${fOn})`);
            const zone = (pg) => pg.evaluate(() => [...document.querySelectorAll('#ajout-aide *')].map(e => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : '')));
            const cles = new Set(await zone(on.p));
            const a = (await V.contrastesFaibles(off.p)).filter(f => cles.has(f.cle.split('|')[0])), b = (await V.contrastesFaibles(on.p)).filter(f => cles.has(f.cle.split('|')[0]));
            const nouveaux = b.filter(f => !a.some(x => x.cle === f.cle));
            check(nouveaux.length === 0, `aucun texte du panneau ne devient illisible verre allumé (${nouveaux.length}${nouveaux.length ? ' : ' + JSON.stringify(nouveaux.slice(0, 3)) : ''})`);
            await off.ctx.close(); await on.ctx.close();
        }

        // ===== I. 320PX ==============================================================================================================
        {
            const { p, ctx } = await ouvrir(nav, { ...TEL, viewport: { width: 320, height: 640 } }, erreurs, '320px : ');
            await toucher(p, PLUS(0), 500);
            const t = await p.evaluate(() => {
                const pa = document.getElementById('ajout-aide'), r = pa.getBoundingClientRect();
                const dehors = [...pa.querySelectorAll('button, textarea')].filter(b => { const q = b.getBoundingClientRect(); return q.width > 0 && (q.left < 0 || q.right > innerWidth + 0.5); }).length;
                const plus = document.querySelector('.cell-add-input').getBoundingClientRect();
                return { ouvert: !pa.hidden, dehors, debord: document.documentElement.scrollWidth > innerWidth, haut: Math.round(r.top), plusBas: Math.round(plus.bottom) };
            });
            check(t.ouvert && t.dehors === 0 && !t.debord && t.plusBas <= t.haut, `à 320px tout tient, rien n'est coupé, la case « + » reste visible (${JSON.stringify(t)})`);
            await ctx.close();
        }

        // ===== J. L'ORDINATEUR N'A PAS BOUGÉ =========================================================================================
        {
            const { p, ctx } = await ouvrir(nav, { viewport: { width: 1320, height: 820 } }, erreurs, 'ordinateur : ');
            const o1 = await p.evaluate(() => ({ readonly: document.querySelector('.cell-add-input').readOnly, saisie: document.getElementById('quick-add-input').getBoundingClientRect().height > 0,
                dans: document.querySelector('.quick-add-row').parentElement.id }));
            check(!o1.readonly && o1.saisie && o1.dans === 'quick-add-panel', `ordinateur : la case « + » reste un champ, la saisie reste dans la page (${JSON.stringify(o1)})`);
            await p.click('#progression-sections .prog-section-ajout >> nth=0'); await p.waitForTimeout(400);
            const o2 = await p.evaluate(() => { const pa = document.getElementById('ajout-aide'), r = pa.getBoundingClientRect();
                return { ouvert: !pa.hidden, fixe: getComputedStyle(pa).position, bas: Math.round(r.bottom), ih: innerHeight, classe: document.body.classList.contains('aj-ouvert') }; });
            check(o2.ouvert && o2.fixe === 'absolute' && !o2.classe, `ordinateur : « + Accord » ouvre toujours le panneau sous la saisie, pas en feuille du bas (${JSON.stringify(o2)})`);
            await ctx.close();
        }
        {
            const { p, ctx } = await ouvrir(nav, TEL, erreurs, 'seuil : ');
            await toucher(p, PLUS(0), 500);
            await p.setViewportSize({ width: 1320, height: 820 }); await p.waitForTimeout(500);
            const s = await p.evaluate(() => ({ ouvert: !document.getElementById('ajout-aide').hidden, cible: window.app._cibleAjout, dans: document.querySelector('.quick-add-row').parentElement.id,
                classe: document.body.classList.contains('aj-ouvert'), ro: document.querySelector('.cell-add-input').readOnly }));
            check(!s.ouvert && s.cible === null && s.dans === 'quick-add-panel' && !s.classe, `panneau ouvert puis fenêtre élargie : il se referme, la saisie rentre dans la page (${JSON.stringify(s)})`);
            await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400);
            await toucher(p, PLUS(0), 500);
            check((await etat(p)).ouvert, `et rétréci de nouveau, la case « + » rouvre le panneau`);
            await ctx.close();
        }
        check(erreurs.length === 0, `aucune erreur JavaScript nulle part (${erreurs.length}) ${erreurs.slice(0, 2).join(' | ')}`);
    } finally { await nav.close(); }
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
