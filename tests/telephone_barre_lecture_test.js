// LOT 10b DE LA REFONTE — la barre de lecture du TÉLÉPHONE et les vues Structure / Paroles intégrées au-dessus d'elle (docs/refonte.md, section
// « Téléphone » ; maquette « Téléphone (v2) », page project/Telephone2.dc.html).
//
// Jusqu'au lot 10b le téléphone jouait le morceau par deux grands boutons dans #footer-dock, pied collant du volet ; la boucle n'y était qu'un appui
// long sur Lecture ; le tempo et le métronome vivaient dans les cartes du volet, hors de vue ; Structure était une fenêtre et Paroles ouvrait sa page
// dans un nouvel onglet. Il a désormais la barre de l'ordinateur, fixée en bas, en 68px : Lecture, Stop, « Mes. N » + frise, Boucle, « ⋯ » — et « ⋯ »
// ouvre le panneau Lecture (tempo −/+/Tap, métronome, Clavier / Guitare / Notes). Structure et Paroles deviennent des vues entre les deux barres.
//
// Ce que le banc tient, par de VRAIS gestes (toucher, clavier) — window.app ne sert qu'à relire l'état :
//   A. la barre : fixée en bas, 68px, l'ordre de la maquette, boutons de 44px à 7px d'angle, rien du bureau (tempo, vues, réorganiser), le transport
//      sorti de #footer-dock, la fin de la page au-dessus d'elle ;
//   B. la lecture : Lecture joue et avance « Mes. N » et la tête de la frise, Stop arrête, Boucle se bascule ;
//   C. le panneau : « ⋯ » l'ouvre sur la barre ; tempo −/+ (une annulation), Tap, métronome (« Activé » / « Coupé »), Clavier / Guitare / Notes
//      qui pilotent les boutons d'origine et amènent ce qu'ils ouvrent à l'écran ; Échap, le clic à côté et « ⋯ » le referment ;
//   D. la Modification : ses accès de secours se posent SUR la barre, sans la chevaucher, sur une rangée ;
//   E. les vues : Structure et Paroles entre la barre du haut et la barre de lecture, qui reste jouable ; le panneau passe au-dessus d'elles ;
//   F. le verre : la barre et le panneau floutent, aucun texte du panneau n'y devient illisible ;
//   G. 320px : tout tient ;
//   H. l'ordinateur n'a pas bougé (pas de « ⋯ », pas de panneau, le tempo et le métronome dans la barre), et franchir le seuil remet chaque nœud
//      à sa place.
const { chromium } = require('playwright');
const V = require('./_verre_commun');
const { check, exiger, plan, bilan } = require('./_harness')('téléphone : barre de lecture et vues intégrées (lot 10b)');
const { estBruitReseau } = require('./_harness');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

plan(48);

const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
const SECTIONS = [
    { title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] },
    { title: 'Refrain', chords: [mk('F', 'maj'), mk('G', 'maj'), mk('E', 'min7'), mk('A', 'min')] },
];

async function ouvrir(nav, contexte, erreurs, nom, reglages = {}) {
    const ctx = await nav.newContext(contexte);
    await ctx.addInitScript(([sections, reglages]) => {
        if (sessionStorage.getItem('banc-10b')) return; // un rechargement garde ce que le banc a fait
        sessionStorage.setItem('banc-10b', '1');
        localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Ballade', bpm: 120, timeSig: '4/4', savedAt: Date.now(), sections }]));
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
const toucher = async (p, sel, ms = 250) => { await p.tap(sel); await p.waitForTimeout(ms); };
const boite = (p, sel) => p.evaluate((s) => {
    const e = document.querySelector(s); if (!e) return null;
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom, rt: r.right, rayon: parseFloat(cs.borderTopLeftRadius), pos: cs.position, vis: r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' };
}, sel);
// « Atteignable » au sens fort : à l'écran ET le doigt y arrive (rien posé dessus).
const atteint = (p, sel) => p.evaluate((s) => {
    const e = document.querySelector(s); if (!e) return false;
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.top < 0 || r.bottom > innerHeight + 0.5) return false;
    const d = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!d && (d === e || e.contains(d));
}, sel);
const panneauOuvert = (p) => p.evaluate(() => !document.getElementById('panneau-lecture').hidden);

(async () => {
    const nav = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    try {
        // ===== A. LA BARRE ===========================================================================================================
        const { p, ctx } = await ouvrir(nav, TEL, erreurs, 'téléphone : ');
        const ih = await p.evaluate(() => innerHeight);
        const barre = await boite(p, '#barre-lecture');
        exiger(barre && barre.vis, 'la barre de lecture existe au téléphone');
        check(barre.pos === 'fixed' && Math.abs(barre.b - ih) < 1 && Math.abs(barre.h - 68) < 1 && barre.x === 0 && Math.abs(barre.w - 390) < 1,
            `elle est fixée en bas, pleine largeur, en 68px comme la maquette (${barre.pos}, bas ${barre.b}/${ih}, ${barre.w}×${barre.h})`);
        const ordre = ['#play-prog', '#stop', '#bl-mesure', '#boucle-btn', '#bl-plus'];
        const bts = {}; for (const s of ordre) bts[s] = await boite(p, s);
        check(ordre.every(s => bts[s] && bts[s].vis && bts[s].y >= barre.y - 0.5 && bts[s].b <= barre.b + 0.5) && ordre.every((s, i) => i === 0 || bts[s].x > bts[ordre[i - 1]].x),
            `l'ordre de la maquette, tous dans la barre : Lecture, Stop, « Mes. N », Boucle, ⋯ (x : ${ordre.map(s => bts[s] && Math.round(bts[s].x)).join(', ')})`);
        const carres = ['#play-prog', '#stop', '#boucle-btn', '#bl-plus'];
        check(carres.every(s => Math.abs(bts[s].w - 44) < 0.6 && Math.abs(bts[s].h - 44) < 0.6 && Math.abs(bts[s].rayon - 7) < 0.6),
            `Lecture, Stop, Boucle et ⋯ sont des carrés de 44px à 7px d'angle, la jauge du téléphone (${carres.map(s => `${Math.round(bts[s].w)}×${Math.round(bts[s].h)}/${bts[s].rayon}`).join(' ')})`);
        const frise = await boite(p, '#bl-frise');
        check(frise.vis && frise.y > bts['#bl-mesure'].y && frise.w > 100 && frise.h >= 6 && frise.h <= 10,
            `la frise des parties est une bande sous « Mes. N », dans la place qui reste (${Math.round(frise.w)}×${frise.h}px)`);
        const bureau = await p.evaluate(() => ['#bl-tempo', '#bl-vues', '#bl-reorg', '.bl-fleches'].map(s => { const e = document.querySelector(s); return !e || e.getBoundingClientRect().width === 0; }));
        check(bureau.every(Boolean), `rien du bureau dans la barre : ni bouton BPM, ni bloc Vues, ni « réorganiser » et ses flèches (${JSON.stringify(bureau)})`);
        const dock = await p.evaluate(() => ({ transport: !!document.querySelector('#footer-dock .transport'), dansBarre: !!document.querySelector('#bl-lecture .transport'), nTransport: document.querySelectorAll('.transport').length, dockVu: document.getElementById('footer-dock').getBoundingClientRect().height }));
        check(!dock.transport && dock.dansBarre && dock.nTransport === 1 && dock.dockVu === 0,
            `le transport a quitté #footer-dock pour la barre (un seul, déplacé), et le dock vide s'efface (${JSON.stringify(dock)})`);
        await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(300);
        const fin = await boite(p, '#add-section');
        const debord = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        check(fin.b <= barre.y && await atteint(p, '#add-section') && debord <= 0,
            `la fin de la page s'arrête au-dessus de la barre : « Ajouter section » reste touchable, défilé jusqu'en bas (bas ${Math.round(fin.b)} ≤ ${barre.y}) ; pas de débordement (${debord}px)`);
        await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(200);

        // ===== B. LA LECTURE =========================================================================================================
        await toucher(p, '#play-prog', 300);
        check(await p.evaluate(() => window.app.isPlaying === true), 'toucher Lecture joue le morceau');
        await p.waitForFunction(() => document.getElementById('bl-mesure').textContent !== 'Mes. 1', null, { timeout: 9000 });
        const avance = await p.evaluate(() => ({ m: document.getElementById('bl-mesure').textContent, tete: parseFloat(document.querySelector('#bl-frise .bl-frise-tete').style.left), enCours: document.querySelectorAll('#bl-frise .bl-frise-part.en-cours').length }));
        check(/^Mes\. [2-9]/.test(avance.m) && avance.tete > 0 && avance.enCours === 1, `« Mes. N » et la tête de la frise avancent avec la lecture (${avance.m}, tête à ${avance.tete.toFixed(1)} %, ${avance.enCours} partie allumée)`);
        await toucher(p, '#stop', 300);
        check(await p.evaluate(() => window.app.isPlaying === false), 'toucher Stop arrête la lecture');
        await toucher(p, '#boucle-btn');
        const boucle1 = await p.evaluate(() => ({ app: window.app.bouclerLecture, aria: document.getElementById('boucle-btn').getAttribute('aria-pressed') }));
        await toucher(p, '#boucle-btn');
        const boucle2 = await p.evaluate(() => ({ app: window.app.bouclerLecture, aria: document.getElementById('boucle-btn').getAttribute('aria-pressed') }));
        check(boucle1.app === true && boucle1.aria === 'true' && boucle2.app === false && boucle2.aria === 'false',
            `la Boucle a son bouton au téléphone : un toucher la met, un autre l'ôte (${JSON.stringify([boucle1, boucle2])})`);

        // ===== C. LE PANNEAU LECTURE =================================================================================================
        await toucher(p, '#bl-plus');
        const pan = await boite(p, '#panneau-lecture');
        const plus = await p.evaluate(() => ({ exp: document.getElementById('bl-plus').getAttribute('aria-expanded'), pr: document.getElementById('bl-plus').getAttribute('aria-pressed') }));
        exiger(pan && pan.vis, '« ⋯ » ouvre le panneau Lecture');
        check(Math.abs(pan.b - barre.y) < 1 && pan.y >= 0 && pan.x === 0 && Math.abs(pan.w - 390) < 1 && plus.exp === 'true' && plus.pr === 'true',
            `il monte du bas et se pose sur la barre, pleine largeur, dans l'écran ; « ⋯ » se dit ouvert (${Math.round(pan.y)}→${Math.round(pan.b)}, barre à ${barre.y} ; ${JSON.stringify(plus)})`);
        const noeuds = await p.evaluate(() => ({ ligne: !!document.querySelector('#panneau-lecture #bl-tempo-ligne'), metro: !!document.querySelector('#panneau-lecture #bl-metro'), n: ['bl-tempo-moins', 'bl-tempo-plus', 'bl-tap', 'bl-metro'].map(i => document.querySelectorAll('#' + i).length).join('') }));
        check(noeuds.ligne && noeuds.metro && noeuds.n === '1111', `le tempo et le métronome du panneau sont ceux de la barre d'ordinateur, déplacés et non copiés (${JSON.stringify(noeuds)})`);
        const jauge = await p.evaluate(() => ['#pl-fermer', '#bl-tap', '#bl-metro', '#pl-clavier', '#pl-guitare', '#pl-notes', '#pl-tempo .bl-seg'].map(s => Math.round(document.querySelector(s).getBoundingClientRect().height)));
        check(jauge.every(h => h === 44), `toutes les commandes du panneau font 44px de haut (${jauge.join(', ')})`);
        const bpm = () => p.evaluate(() => +document.getElementById('bpm').value);
        const bpm0 = await bpm();
        await toucher(p, '#bl-tempo-plus'); await toucher(p, '#bl-tempo-plus');
        const bpmPlus = await bpm();
        const affiche = await p.evaluate(() => document.getElementById('bl-tempo-pop-val').textContent);
        await toucher(p, '#bl-tempo-moins');
        check(bpmPlus === bpm0 + 2 && affiche === `${bpm0 + 2} BPM` && await bpm() === bpm0 + 1, `+ et − règlent le tempo du morceau, affiché dans le groupe (${bpm0} → ${bpmPlus} « ${affiche} » → ${await bpm()})`);
        check(await panneauOuvert(p), 'régler le tempo laisse le panneau ouvert');
        await toucher(p, '#global-undo-btn');
        check(await bpm() === bpm0 + 2, `Annuler défait le dernier geste de tempo, un seul (${await bpm()} attendu ${bpm0 + 2})`);
        if (!(await panneauOuvert(p))) await toucher(p, '#bl-plus'); // Annuler, dans la barre du haut, est « à côté » : il referme le panneau
        // Le tempo tapé se compare au rythme RÉELLEMENT tapé, relevé dans la page à chaque toucher (lecture seule) : sous la charge du balayage
        // parallèle, un toucher « toutes les 500 ms » en prend 650 (constaté : 94 BPM au lieu de ~120 au balayage complet du lot 10b).
        await p.evaluate(() => { window.__taps = []; document.getElementById('bl-tap').addEventListener('click', () => window.__taps.push(performance.now())); });
        for (let i = 0; i < 4; i++) { await p.tap('#bl-tap'); await p.waitForTimeout(500); }
        const tape = await bpm();
        const rythme = await p.evaluate(() => { const t = window.__taps, iv = t.slice(1).map((x, i) => x - t[i]); return { n: t.length, bpm: Math.min(240, Math.max(60, Math.round(60000 / (iv.reduce((a, b) => a + b, 0) / iv.length)))) }; });
        check(rythme.n === 4 && Math.abs(tape - rythme.bpm) <= 1, `Tap : quatre touchers règlent le tempo du morceau sur le rythme tapé (${tape} BPM, rythme des touchers : ${rythme.bpm})`);
        await toucher(p, '#bl-metro');
        const metro1 = await p.evaluate(() => ({ actif: document.getElementById('toggle-metronome').classList.contains('active'), mot: document.querySelector('#bl-metro .bl-metro-etat').textContent }));
        await toucher(p, '#bl-metro');
        const metro2 = await p.evaluate(() => ({ actif: document.getElementById('toggle-metronome').classList.contains('active'), mot: document.querySelector('#bl-metro .bl-metro-etat').textContent }));
        check(metro1.actif !== metro2.actif && metro1.mot === (metro1.actif ? 'Activé' : 'Coupé') && metro2.mot === (metro2.actif ? 'Activé' : 'Coupé'),
            `le métronome du panneau pilote celui du morceau et dit son état en toutes lettres (${JSON.stringify([metro1, metro2])})`);
        const logos = await p.evaluate(() => ['pl-clavier', 'pl-guitare', 'pl-notes'].map(i => { const b = document.getElementById(i); const src = document.getElementById(b.dataset.source); return !!b.querySelector('svg') && b.querySelector('svg').innerHTML === src.querySelector('svg').innerHTML; }));
        check(logos.every(Boolean), `Clavier, Guitare et Notes portent le logo de leur bouton d'origine (${JSON.stringify(logos)})`);
        const guitareAvant = await p.evaluate(() => document.getElementById('toggle-viz-guitar').getAttribute('aria-pressed'));
        await toucher(p, '#pl-guitare', 700);
        const guitare = await p.evaluate(() => ({ src: document.getElementById('toggle-viz-guitar').getAttribute('aria-pressed'), miroir: document.getElementById('pl-guitare').getAttribute('aria-pressed') }));
        const carte = await boite(p, '.viz-card');
        check(guitareAvant === 'false' && guitare.src === 'true' && guitare.miroir === 'true' && !(await panneauOuvert(p)),
            `Guitare ouvre la guitare (le bouton d'origine), se marque allumé et referme le panneau (${guitareAvant} → ${JSON.stringify(guitare)})`);
        check(carte.y >= 0 && carte.b <= barre.y + 0.5, `et la carte des diagrammes vient à l'écran, au-dessus de la barre (${Math.round(carte.y)}→${Math.round(carte.b)})`);
        await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(200);
        await toucher(p, '#bl-plus'); await toucher(p, '#pl-notes', 900);
        const notes = await p.evaluate(() => ({ src: document.getElementById('grid-zoom').getAttribute('aria-pressed'), ouvert: window.app.seqOpen }));
        const seq = await boite(p, '#seq-dock-panel');
        check(notes.src === 'true' && notes.ouvert === true && seq.vis && seq.y < barre.y && seq.b <= barre.y + 0.5,
            `Notes ouvre l'éditeur de notes du téléphone (« Séq. ») et l'amène à l'écran, au-dessus de la barre (${JSON.stringify(notes)}, ${Math.round(seq.y)}→${Math.round(seq.b)})`);
        await toucher(p, '#bl-plus'); await toucher(p, '#pl-notes', 600);
        check(await p.evaluate(() => document.getElementById('grid-zoom').getAttribute('aria-pressed') === 'false'), 'un second toucher sur Notes le referme');
        await toucher(p, '#bl-plus');
        await p.keyboard.press('Escape'); await p.waitForTimeout(200);
        const apresEchap = await panneauOuvert(p);
        await toucher(p, '#bl-plus');
        await p.tap('.grid-cell >> nth=0'); await p.waitForTimeout(300);
        const apresCote = await panneauOuvert(p);
        await toucher(p, '#bl-plus'); await toucher(p, '#bl-plus');
        const apresPlus = await panneauOuvert(p);
        await toucher(p, '#bl-plus'); await toucher(p, '#pl-fermer');
        const apresCroix = await panneauOuvert(p);
        check(!apresEchap && !apresCote && !apresPlus && !apresCroix && await p.evaluate(() => document.getElementById('bl-plus').getAttribute('aria-expanded') === 'false'),
            `Échap, un toucher à côté, « ⋯ » et la croix le referment (${[apresEchap, apresCote, apresPlus, apresCroix].join(', ')})`);

        // ===== D. LA MODIFICATION ====================================================================================================
        // Au téléphone (jusqu'au lot 10d), on y entre par un DOUBLE toucher sur une case — le geste de filet_toujours_visible_test.
        const cdp = await ctx.newCDPSession(p);
        const caseB = await p.locator('.grid-cell >> nth=1').boundingBox();
        for (let i = 0; i < 2; i++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: caseB.x + caseB.width / 2, y: caseB.y + caseB.height * 0.85 }] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            if (i === 0) await p.waitForTimeout(120);
        }
        await p.waitForTimeout(500);
        exiger(await p.evaluate(() => window.app.appMode === 'edit'), 'un double toucher sur une case entre en Modification');
        const modif = await p.evaluate(() => {
            const d = document.getElementById('footer-dock').getBoundingClientRect(), b = document.getElementById('barre-lecture').getBoundingClientRect();
            const enfants = [...document.getElementById('footer-dock').querySelectorAll('#dock-rythme, #dock-terminer')].map(e => e.getBoundingClientRect());
            return { haut: Math.round(d.height), bas: d.bottom, barre: b.top, uneRangee: enfants.every(a => enfants.every(c => Math.abs(a.top - c.top) < 1)), droite: enfants.every(r => r.right > innerWidth / 2) };
        });
        check(Math.abs(modif.bas - modif.barre) < 1 && modif.haut <= 48 && modif.uneRangee && modif.droite,
            `en Modification, les accès de secours se posent sur la barre sans la chevaucher, une rangée calée à droite de ${modif.haut}px (${JSON.stringify(modif)})`);
        check(await atteint(p, '#dock-rythme') && await atteint(p, '#dock-terminer'), 'et le doigt les atteint tous les deux');
        await toucher(p, '#dock-terminer', 400);

        // ===== E. LES VUES INTÉGRÉES =================================================================================================
        const hautBarre = await p.evaluate(() => document.querySelector('.top-bar').getBoundingClientRect().bottom);
        await toucher(p, '#structure-btn', 500);
        const st = await p.evaluate(() => {
            const o = document.getElementById('structure-overlay'), r = o.getBoundingClientRect(), cs = getComputedStyle(o);
            const vu = (i) => { const e = document.getElementById(i); return !!e && e.getBoundingClientRect().width > 0; };
            return { ouverte: !o.hidden, haut: r.top, bas: r.bottom, fond: cs.backgroundColor, titre: vu('structure-title'), croix: vu('structure-close'), grille: getComputedStyle(document.querySelector('main')).visibility, onglet: document.getElementById('structure-btn').getAttribute('aria-pressed') };
        });
        check(st.ouverte && Math.abs(st.haut - hautBarre) < 1.5 && Math.abs(st.bas - barre.y) < 1 && st.onglet === 'true',
            `Structure est une vue entre la barre du haut et la barre de lecture (${Math.round(st.haut)}→${Math.round(st.bas)}, barres à ${Math.round(hautBarre)} et ${barre.y})`);
        check(!st.titre && !st.croix && st.fond === 'rgba(0, 0, 0, 0)' && st.grille === 'hidden',
            `sans titre ni croix de fenêtre (l'onglet le dit, Grille ramène), fond transparent, grille masquée derrière (${JSON.stringify({ titre: st.titre, croix: st.croix, fond: st.fond, grille: st.grille })})`);
        await toucher(p, '#play-prog', 400);
        const joueStructure = await p.evaluate(() => window.app.isPlaying);
        await toucher(p, '#stop', 300);
        check(joueStructure === true && await atteint(p, '#bl-plus'), 'la barre de lecture reste jouable sous la vue : Lecture joue, ⋯ reste au doigt');
        await p.touchscreen.tap(3, Math.round((hautBarre + barre.y) / 2)); await p.waitForTimeout(300); // le fond, dans la marge de 8px
        check(await p.evaluate(() => !document.getElementById('structure-overlay').hidden), 'toucher le fond de la vue ne la referme pas (ce n\'est plus une fenêtre)');
        await toucher(p, '#lyrics-btn', 1500);
        const par = await p.evaluate(() => {
            const v = document.getElementById('vue-paroles'), r = v.getBoundingClientRect();
            return { ouverte: !v.hidden, haut: r.top, bas: r.bottom, src: document.getElementById('paroles-cadre').getAttribute('src'), structure: !document.getElementById('structure-overlay').hidden, onglet: document.getElementById('lyrics-btn').getAttribute('aria-pressed') };
        });
        check(par.ouverte && !par.structure && Math.abs(par.haut - hautBarre) < 1.5 && Math.abs(par.bas - barre.y) < 1 && par.onglet === 'true',
            `Paroles est une vue au même endroit, à la place de Structure (${JSON.stringify(par)})`);
        const cadre = p.frames().find(f => /paroles\.html\?integre=1/.test(f.url()));
        exiger(!!cadre, 'la vue charge la page Paroles en mode intégré, dans la page (pas de nouvel onglet)');
        await cadre.waitForFunction(() => document.querySelectorAll('.chord-chip').length >= 8, null, { timeout: 8000 });
        const puces = await cadre.evaluate(() => [...document.querySelectorAll('.chord-chip')].map(c => c.textContent.trim()).slice(0, 4).join(' '));
        check(puces === 'Cmaj7 Am7 Dm7 G7' && ctx.pages().length === 1, `et y montre les accords du morceau ouvert (« ${puces} »), sans ouvrir d'onglet (${ctx.pages().length} page)`);
        await toucher(p, '#bl-plus');
        const surVue = await p.evaluate(() => { const r = document.getElementById('pl-tempo').getBoundingClientRect(); const d = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!d && !!d.closest('#panneau-lecture'); });
        check(surVue, 'le panneau Lecture passe au-dessus de la vue Paroles (on règle le tempo en lisant ses paroles)');
        await toucher(p, '#pl-fermer');
        await toucher(p, '#tab-grille', 400);
        check(await p.evaluate(() => document.getElementById('vue-paroles').hidden && getComputedStyle(document.querySelector('main')).visibility === 'visible'), 'l\'onglet Grille ramène à la grille');
        check(erreurs.length === 0, `aucune erreur JavaScript au téléphone (${erreurs.length}) ${erreurs.slice(0, 2).join(' | ')}`);
        await ctx.close();

        // ===== F. LE VERRE ===========================================================================================================
        {
            const off = await ouvrir(nav, TEL, erreurs, 'verre éteint : ');
            const on = await ouvrir(nav, TEL, erreurs, 'verre allumé : ', { 'harmohub.glass.v1': '1' });
            await toucher(off.p, '#bl-plus'); await toucher(on.p, '#bl-plus');
            const flou = await on.p.evaluate(() => ['#barre-lecture', '#panneau-lecture'].map(s => { const cs = getComputedStyle(document.querySelector(s)); return { f: cs.backdropFilter, img: cs.backgroundImage, c: cs.backgroundColor }; }));
            check(/blur\(24px\)/.test(flou[0].f) && /blur\(24px\)/.test(flou[1].f) && /gradient/.test(flou[1].img) && /rgba\(7, 11, 18, 0\.6\)/.test(flou[1].c),
                `verre allumé, la barre et le panneau floutent à 24px ; le panneau a la sous-couche sombre des fenêtres (${flou.map(x => x.f).join(' / ')}, ${flou[1].c})`);
            const faibles = (pg) => V.contrastesFaibles(pg);
            const dansPanneau = (pg) => pg.evaluate(() => [...document.querySelectorAll('#panneau-lecture *')].map(e => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : '')));
            const clesPanneau = new Set(await dansPanneau(on.p));
            const a = (await faibles(off.p)).filter(f => clesPanneau.has(f.cle.split('|')[0])), b = (await faibles(on.p)).filter(f => clesPanneau.has(f.cle.split('|')[0]));
            const nouveaux = b.filter(f => !a.some(g => g.cle === f.cle));
            check(nouveaux.length === 0, `aucun texte du panneau ne devient illisible verre allumé (${nouveaux.length}${nouveaux.length ? ' : ' + JSON.stringify(nouveaux.slice(0, 3)) : ''})`);
            await off.ctx.close(); await on.ctx.close();
        }

        // ===== G. 320px ==============================================================================================================
        {
            const { p, ctx } = await ouvrir(nav, { ...TEL, viewport: { width: 320, height: 640 } }, erreurs, '320px : ');
            const r = await p.evaluate(() => {
                const b = (s) => document.querySelector(s).getBoundingClientRect();
                return { boutons: ['#play-prog', '#stop', '#boucle-btn', '#bl-plus'].every(s => b(s).left >= 0 && b(s).right <= innerWidth && b(s).width >= 43.5), mesure: Math.round(b('.bl-parties').width), debord: document.documentElement.scrollWidth - document.documentElement.clientWidth, texte: document.getElementById('bl-mesure').scrollWidth <= document.getElementById('bl-mesure').clientWidth };
            });
            check(r.boutons && r.mesure >= 50 && r.texte && r.debord <= 0, `à 320px les quatre boutons restent entiers à l'écran, « Mes. N » se lit en entier dans ${r.mesure}px, rien ne déborde (${r.debord}px)`);
            await toucher(p, '#bl-plus');
            const pan = await p.evaluate(() => [...document.querySelectorAll('#panneau-lecture button, #panneau-lecture .bl-seg')].every(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5 && r.top >= 0; }));
            check(pan, 'et le panneau Lecture tient dans l\'écran, chaque commande entière');
            await ctx.close();
        }

        // ===== H. L'ORDINATEUR N'A PAS BOUGÉ, ET LE SEUIL REMET TOUT EN PLACE ========================================================
        {
            const { p, ctx } = await ouvrir(nav, { viewport: { width: 1320, height: 820 } }, erreurs, 'ordinateur : ');
            const o = await p.evaluate(() => {
                const vu = (s) => { const e = document.querySelector(s); return !!e && e.getBoundingClientRect().width > 0; };
                return { plus: vu('#bl-plus'), panneau: vu('#panneau-lecture'), tempo: vu('#bl-tempo'), metro: vu('#bl-metro'), metroBloc: !!document.querySelector('[data-bloc="tempo"] #bl-metro'), ligne: document.getElementById('bl-tempo-ligne').parentElement.id, pos: getComputedStyle(document.getElementById('barre-lecture')).position, mot: getComputedStyle(document.querySelector('#bl-metro .bl-metro-etat')).display };
            });
            check(!o.plus && !o.panneau && o.tempo && o.metro && o.metroBloc && o.ligne === 'bl-tempo-pop' && o.pos === 'relative' && o.mot === 'none',
                `ordinateur : ni « ⋯ » ni panneau ; BPM et métronome (logo seul) dans le bloc Tempo, la rangée −/+/Tap dans la fenêtre du tempo, la barre dans le flux (${JSON.stringify(o)})`);
            await p.click('#bl-tempo'); await p.waitForTimeout(200);
            const avant = await p.evaluate(() => +document.getElementById('bpm').value);
            await p.click('#bl-tempo-plus'); await p.waitForTimeout(200);
            check(await p.evaluate(() => +document.getElementById('bpm').value) === avant + 1, 'et le + de la fenêtre du tempo règle toujours le tempo à l\'ordinateur');
            await p.keyboard.press('Escape');
            await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400);
            const tel = await p.evaluate(() => ({ ligne: document.getElementById('bl-tempo-ligne').parentElement.id, metro: document.getElementById('bl-metro').parentElement.id }));
            await p.click('#bl-plus'); await p.waitForTimeout(200);
            await p.setViewportSize({ width: 1320, height: 820 }); await p.waitForTimeout(400);
            const retour = await p.evaluate(() => ({ ligne: document.getElementById('bl-tempo-ligne').parentElement.id, premier: document.getElementById('bl-tempo-pop').firstElementChild.id, metro: !!document.querySelector('[data-bloc="tempo"] #bl-metro'), ferme: document.getElementById('panneau-lecture').hidden }));
            check(tel.ligne === 'pl-tempo' && tel.metro === 'pl-metro' && retour.ligne === 'bl-tempo-pop' && retour.premier === 'bl-tempo-ligne' && retour.metro && retour.ferme,
                `franchir le seuil déplace la rangée du tempo et le métronome dans le panneau, puis les rend à la barre d'ordinateur, panneau refermé (${JSON.stringify({ tel, retour })})`);
            await ctx.close();
        }
        check(erreurs.length === 0, `aucune erreur JavaScript nulle part (${erreurs.length}) ${erreurs.slice(0, 2).join(' | ')}`);
    } finally { await nav.close(); }
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
