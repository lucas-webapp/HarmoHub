// SÉQUENCEUR, L1a (14/11) — tailles, poignées, tête de lecture, avec de vrais gestes.
//
// CE QUE L'UTILISATEUR A VALIDÉ (docs/decisions-13-14-11.md, lettre A, et commentaires du 14/11) : « Proposé » = ligne de 26 px, croche de 34 px au plus (14 au plus
// serré), grille calée à gauche, plus d'écart entre deux mesures ; la poignée du haut change le NOMBRE de lignes visibles (« je préfère pouvoir voir plus de notes »)
// et la hauteur d'une barre se règle dans Paramètres › Affichage (22 à 48 px) ; une poignée de largeur au bord droit des croches (14 à 90 px, double-clic = 34) ;
// à la lecture, plus de contour vert qui saute de croche en croche mais une fine barre verte qui glisse en continu.
//
// CE QUE LE BANC TIENT : les mesures, aux pixels près, à 1440 px ; les gestes (tirer, double-cliquer, flèches au clavier, lecture) ; la mémoire par appareil ;
// et que le TÉLÉPHONE n'a pas bougé (croche de 30 px au moins, pas de poignée de largeur, pas de barre de lecture, contour de lecture conservé).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('séquenceur : tailles et poignées');
const { estBruitReseau } = require('./_harness');
const V = require('./_verre_commun');

plan(56);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const mk = (r, q) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
const PARTIE = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] }];
const TEL = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 };

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (contexte, reglages = {}) => {
        const ctx = await nav.newContext(contexte);
        await ctx.addInitScript(([S, reglages]) => {
            if (sessionStorage.getItem('banc-sq-tailles')) return;
            sessionStorage.setItem('banc-sq-tailles', '1');
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
    const OUVERT = { harmohubSequenceurOuvert: '1' };
    // Lecture de l'état (jamais pour agir).
    const mesures = (p) => p.evaluate(() => {
        const g = document.getElementById('sq-grille');
        const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
        const cases = [...g.querySelectorAll('.sq-case[data-r="0"]')].map(r);
        const h = g.querySelector('.sq-poignee-largeur');
        const lignes = [...g.querySelectorAll('.sq-case[data-r]')];
        return {
            grille: r(g), cases, poignee: h ? r(h) : null, nPoignees: g.querySelectorAll('.sq-poignee-largeur').length,
            premiereLigne: lignes.length ? r(lignes[0]) : null, derniereLigne: lignes.length ? r(lignes[lignes.length - 1]) : null,
            colonnes: g.style.gridTemplateColumns, maxHauteur: g.style.maxHeight, defile: g.scrollHeight > g.clientHeight + 1,
            nLignes: new Set(lignes.map(x => x.dataset.r)).size, barre: Math.round(lignes[0] ? lignes[0].getBoundingClientRect().height : 0),
            largeurFenetre: window.innerWidth, memo: localStorage.getItem('harmohubSequenceurCroche'),
        };
    });
    const centre = async (p, sel) => { const b = await p.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    // Un VRAI glissé de souris, de la poignée jusqu'à (x, y).
    const glisser = async (p, de, vers) => {
        await p.mouse.move(de.x, de.y); await p.mouse.down();
        await p.mouse.move((de.x + vers.x) / 2, (de.y + vers.y) / 2, { steps: 4 });
        await p.mouse.move(vers.x, vers.y, { steps: 6 });
        await p.mouse.up(); await p.waitForTimeout(200);
    };
    const pseudo = (p, sel, prop) => p.evaluate(([sel, prop]) => getComputedStyle(document.querySelector(sel), '::before')[prop], [sel, prop]);

    // ======================================================================================================
    console.log('\n=== A. Les mesures par défaut, à 1440 px ===');
    let { p, ctx } = await ouvrir({ viewport: { width: 1440, height: 900 } }, OUVERT);
    let m = await mesures(p);
    exiger(m.cases.length === 32, `le séquenceur est ouvert sur 4 accords de 8 croches (${m.cases.length} cases)`);
    check(m.barre === 26, `la ligne fait 26 px (elle en faisait 30) : ${m.barre}`);
    check(Math.round(m.cases[0].w) === 34 && Math.round(m.cases[31].w) === 34, `la croche fait 34 px au plus : ${m.cases[0].w}`);
    check(Math.round(m.cases[0].l - m.grille.l) === 56, `grille calée à gauche : la première croche suit les 56 px des étiquettes (${Math.round(m.cases[0].l - m.grille.l)})`);
    check(m.grille.r - m.cases[31].r > 100, `et du vide reste à droite au lieu d'étirer les croches (${Math.round(m.grille.r - m.cases[31].r)} px)`);
    check([7, 15, 23].every(i => Math.abs(m.cases[i].r - m.cases[i + 1].l) < 0.6), 'aucun écart entre deux mesures : la dernière croche touche la première de la suivante');
    check(!/\b4px\b/.test(m.colonnes) && /repeat\(8, minmax\(14px, 34px\)\)/.test(m.colonnes), `les colonnes : croches de 14 à 34 px, plus de piste de 4 px (${m.colonnes.slice(0, 60)}…)`);

    // ======================================================================================================
    console.log('\n=== B. La poignée de largeur ===');
    check(m.nPoignees === 1, 'une poignée de largeur au bord droit des croches');
    exiger(!!m.poignee, 'elle existe');
    check(Math.abs(m.poignee.l - m.cases[31].r) < 1 && Math.round(m.poignee.w) === 18, `juste après la dernière croche, 18 px de large (${Math.round(m.poignee.l - m.cases[31].r)} px d'écart)`);
    check(Math.abs(m.poignee.t - m.premiereLigne.t) < 1 && Math.abs(m.poignee.b - m.derniereLigne.b) < 1, 'centrée sur les LIGNES DE NOTES (ni l\'en-tête des accords ni la règle des temps)');
    check(await p.evaluate(() => { const h = document.querySelector('.sq-poignee-largeur'); return h.getAttribute('role') === 'separator' && h.getAttribute('aria-orientation') === 'vertical' && !!h.title; }), 'séparateur vertical, avec son infobulle');
    let c = await centre(p, '.sq-poignee-largeur');
    check(await pseudo(p, '.sq-poignee-largeur', 'width') === '4px', 'au repos : un trait de 4 px');
    await p.mouse.move(c.x, c.y); await p.waitForTimeout(300);
    check(await pseudo(p, '.sq-poignee-largeur', 'width') === '10px', 'au survol : la languette de 10 px');
    check(await p.evaluate(() => getComputedStyle(document.querySelector('.sq-poignee-largeur')).cursor) === 'ew-resize', 'le curseur dit « élargir » (ew-resize)');
    // Tirer vers la droite : 32 croches, 6 px de plus chacune = 192 px.
    await glisser(p, c, { x: c.x + 192, y: c.y });
    m = await mesures(p);
    check(Math.abs(m.cases[0].w - 40) <= 1, `tirée de 192 px vers la droite, la croche passe à 40 px (${m.cases[0].w.toFixed(1)})`);
    check(m.nLignes === 4 && m.barre === 26, 'la hauteur des barres ne change pas');
    check(m.memo === String(Math.round(m.cases[0].w)), `la largeur est retenue par appareil (harmohubSequenceurCroche = ${m.memo})`);
    await p.reload(); await p.waitForFunction(() => !!window.app); await p.waitForTimeout(900);
    m = await mesures(p);
    check(Math.abs(m.cases[0].w - 40) <= 1, `après rechargement, elle garde 40 px (${m.cases[0].w.toFixed(1)})`);
    // Tirer très loin à droite : elle s'arrête avant le bord de la fenêtre.
    c = await centre(p, '.sq-poignee-largeur');
    await glisser(p, c, { x: 1435, y: c.y });
    m = await mesures(p);
    check(m.poignee.r <= m.largeurFenetre && m.grille.r - m.poignee.r >= -0.6, `tirée jusqu'au bord : la poignée reste dans la fenêtre (droite à ${Math.round(m.poignee.r)} sur ${m.largeurFenetre})`);
    check(m.cases[0].w <= 90 && m.cases[0].w > 40, `la croche a grandi sans dépasser 90 px (${m.cases[0].w.toFixed(1)})`);
    // Tirer très loin à gauche : plancher de 14 px (une mesure = 112 px).
    c = await centre(p, '.sq-poignee-largeur');
    await glisser(p, c, { x: 60, y: c.y });
    m = await mesures(p);
    check(Math.round(m.cases[0].w) === 14, `tirée à fond vers la gauche : 14 px au plus serré (${m.cases[0].w.toFixed(1)})`);
    // Double-clic : 34 px.
    c = await centre(p, '.sq-poignee-largeur');
    await p.mouse.dblclick(c.x, c.y); await p.waitForTimeout(250);
    m = await mesures(p);
    check(Math.round(m.cases[0].w) === 34 && m.memo === '34', `double-clic : retour à 34 px, et c'est retenu (${m.cases[0].w.toFixed(1)}, ${m.memo})`);
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== C. La poignée du haut change le NOMBRE de lignes visibles ===');
    ({ p, ctx } = await ouvrir({ viewport: { width: 1440, height: 900 } }, { ...OUVERT, harmohubSequenceurVue: 'notes' }));
    m = await mesures(p);
    const nb = m.nLignes;
    exiger(nb >= 6, `la vue « Toutes les notes » montre plusieurs lignes (${nb}) : de quoi en cacher`);
    // L6bis : la vue Piano est faite de TOUS les demi-tons d'une fenêtre (37 lignes ici) ; elle en montre douze au départ, le reste défile dans la grille.
    const visiblesDepart = await p.evaluate(() => window.app.sequenceur.visiblesEffectives(window.app.sequenceur._lignes.length));
    check(m.maxHauteur !== '' && m.defile && visiblesDepart === 12, `au départ, douze lignes sont visibles et la grille défile pour le reste (${visiblesDepart} sur ${nb})`);
    const haut0 = m.grille.h;
    const pas = 26 + 3;   // une ligne + l'écart entre deux lignes
    let q = await centre(p, '#sq-poignee');
    await glisser(p, q, { x: q.x, y: q.y + 3 * pas });
    m = await mesures(p);
    check(await p.evaluate(() => window.app.sequenceur._visibles) === 12 - 3, `tirée de trois lignes vers le bas : ${12 - 3} lignes visibles`);
    check(Math.abs((haut0 - m.grille.h) - 3 * pas) <= 3, `la grille a perdu trois lignes de hauteur (${Math.round(haut0 - m.grille.h)} px pour ${3 * pas})`);
    check(m.barre === 26 && m.defile, 'les barres gardent leur hauteur de 26 px, et la grille défile pour le reste');
    q = await centre(p, '#sq-poignee');
    await glisser(p, q, { x: q.x, y: q.y - 8 * pas });
    m = await mesures(p);
    check(await p.evaluate(() => window.app.sequenceur._visibles) > 12 - 3 && m.defile, 'tirée vers le haut, elle montre plus de lignes (jamais plus que la place libre : la grille défile pour le reste)');
    q = await centre(p, '#sq-poignee');
    await glisser(p, q, { x: q.x, y: q.y + 2 * pas });
    q = await centre(p, '#sq-poignee');
    await p.mouse.dblclick(q.x, q.y); await p.waitForTimeout(250);
    m = await mesures(p);
    check(await p.evaluate(() => window.app.sequenceur._visibles) === 0 && await p.evaluate(() => window.app.sequenceur.visiblesEffectives(window.app.sequenceur._lignes.length)) === 12 && m.barre === 26, 'double-clic sur la poignée : retour au réglage d\'origine (douze lignes en vue Piano)');
    check(await p.evaluate(() => { const r = document.getElementById('sequenceur').getBoundingClientRect(), t = document.querySelector('.top-bar').getBoundingClientRect(); return r.top >= t.bottom - 1; }), 'le séquenceur ne passe jamais sous la barre du haut');
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== D. Paramètres › Affichage › « Barres du séquenceur » ===');
    ({ p, ctx } = await ouvrir({ viewport: { width: 1440, height: 900 } }, OUVERT));
    await p.click('#open-settings'); await p.waitForTimeout(500);
    const reglage = await p.evaluate(() => { const i = document.getElementById('sq-hauteur'); return i ? { min: i.min, max: i.max, step: i.step, v: i.value, val: document.getElementById('sq-hauteur-val').textContent } : null; });
    exiger(!!reglage, 'le réglage existe dans Paramètres › Affichage');
    check(reglage.min === '22' && reglage.max === '48' && reglage.v === '26' && reglage.val === '26 px', `de 22 à 48 px, 26 par défaut (${JSON.stringify(reglage)})`);
    await p.focus('#sq-hauteur');
    for (let i = 0; i < 7; i++) await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(200);
    m = await mesures(p);
    check(m.barre === 40 && await p.evaluate(() => document.getElementById('sq-hauteur-val').textContent) === '40 px', `sept crans à droite : les barres font 40 px (${m.barre})`);
    check(await p.evaluate(() => localStorage.getItem('harmohubSequenceurLigne')) === '40', 'retenu par appareil (harmohubSequenceurLigne = 40)');
    await p.keyboard.press('Home'); await p.waitForTimeout(200);
    m = await mesures(p);
    check(m.barre === 22, `au plus bas : 22 px (${m.barre})`);
    check(await p.evaluate(() => document.getElementById('sequenceur').classList.contains('lignes-moyennes')), 'entre 18 et 23 px, les noms de notes rapetissent (lignes-moyennes)');
    check(await p.evaluate(() => { const n = document.querySelector('#sq-grille .sq-case.on .sq-note'); return getComputedStyle(n).fontSize; }) === '10px', 'ils s\'écrivent en 10 px, ils ne disparaissent plus à 22 px');
    await p.keyboard.press('End'); await p.waitForTimeout(200);
    m = await mesures(p);
    check(m.barre === 48, `au plus haut : 48 px (${m.barre})`);
    check(await p.evaluate(() => !document.getElementById('sequenceur').classList.contains('lignes-moyennes')), 'les noms reprennent leur taille');
    await p.click('#settings-close'); await p.waitForTimeout(300);
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== E. La lecture : une barre qui glisse, plus de contour qui saute ===');
    ({ p, ctx } = await ouvrir({ viewport: { width: 1440, height: 900 } }, OUVERT));
    check(await p.evaluate(() => document.getElementById('sq-tete').hidden), 'avant la lecture, la barre est cachée');
    await p.click('#play-prog');
    const tete = await p.waitForFunction(() => document.querySelector('#sq-grille .sq-case.tete'), null, { timeout: 5000 }).then(() => true, () => false);
    exiger(tete, 'la lecture marque la croche qui sonne');
    await p.waitForTimeout(300);
    const echantillons = [];
    for (let i = 0; i < 14; i++) {
        echantillons.push(await p.evaluate(() => {
            const t = document.getElementById('sq-tete'), g = document.getElementById('sq-grille').getBoundingClientRect(), b = t.getBoundingClientRect();
            const cs = document.querySelector('#sq-grille .sq-case.tete');
            return { cache: t.hidden, x: b.left, t: b.top, h: b.height, gt: g.top, gh: g.height, ombre: cs ? getComputedStyle(cs).boxShadow : 'sans case' };
        }));
        await p.waitForTimeout(35);
    }
    check(echantillons.every(e => !e.cache), 'pendant la lecture, la barre est visible');
    const xs = echantillons.map(e => Math.round(e.x * 10) / 10);
    check(new Set(xs).size >= 8, `elle glisse en continu : ${new Set(xs).size} positions différentes en 14 mesures sur ~0,5 s (${xs.slice(0, 6).join(' ')}…)`);
    const sauts = xs.slice(1).map((x, i) => x - xs[i]).filter(d => d > 0);
    check(sauts.length >= 6 && Math.max(...sauts) < 34, `sans saut d'une croche entière : plus grand pas ${Math.max(...sauts).toFixed(1)} px (< 34)`);
    check(echantillons.every(e => Math.abs(e.t - e.gt) <= 2 && Math.abs(e.h - e.gh) <= 2), 'elle couvre toute la hauteur de la grille (règle et lignes de notes)');
    check(echantillons.every(e => e.ombre === 'none'), 'le contour vert de la croche a disparu (box-shadow: none)');
    await p.click('#stop'); await p.waitForTimeout(400);
    check(await p.evaluate(() => document.getElementById('sq-tete').hidden && !document.querySelector('#sq-grille .tete')), 'Stop cache la barre et éteint la croche');
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== F. Le téléphone n\'a pas bougé ===');
    ({ p, ctx } = await ouvrir(TEL));
    await p.tap('#bl-plus'); await p.waitForTimeout(400);
    await p.tap('#pl-notes'); await p.waitForTimeout(700);
    const tel = await p.evaluate(() => {
        const g = document.getElementById('sq-grille'), cases = [...g.querySelectorAll('.sq-case[data-r="0"]')];
        return { dans: document.getElementById('sequenceur').parentElement.id, colonnes: g.style.gridTemplateColumns, poignees: g.querySelectorAll('.sq-poignee-largeur').length, largeur: cases[0] ? cases[0].getBoundingClientRect().width : 0, ligne: getComputedStyle(document.getElementById('sequenceur')).getPropertyValue('--sq-ligne').trim(), teteCachee: document.getElementById('sq-tete').hidden, vis: window.app.sequenceur._visibles };
    });
    exiger(tel.dans === 'pa-rythme', `au téléphone le séquenceur est dans le panneau d'accord (${tel.dans})`);
    check(/minmax\(30px, 1fr\)/.test(tel.colonnes) && !/34px/.test(tel.colonnes), `la croche reste à 30 px au moins, sans plafond (${tel.colonnes.slice(0, 50)}…)`);
    check(tel.poignees === 0 && tel.teteCachee, 'ni poignée de largeur ni barre de lecture au téléphone');
    check(tel.ligne === '40px', `les lignes y font toujours 40 px (${tel.ligne})`);
    check(tel.largeur >= 30, `les croches font 30 px au moins (${Math.round(tel.largeur)})`);
    // La lecture au téléphone : la croche reste ENTOURÉE (rien n'a changé), la barre fine n'apparaît pas.
    await p.tap('#play-prog');
    const teteTel = await p.waitForFunction(() => document.querySelector('#sq-grille .sq-case.tete'), null, { timeout: 5000 }).then(() => true, () => false);
    exiger(teteTel, 'au téléphone aussi, la lecture marque la croche qui sonne');
    await p.waitForTimeout(300);
    const lectureTel = await p.evaluate(() => ({ ombre: getComputedStyle(document.querySelector('#sq-grille .sq-case.tete')).boxShadow, barreCachee: document.getElementById('sq-tete').hidden }));
    check(lectureTel.ombre !== 'none' && lectureTel.barreCachee, `la croche reste entourée de vert et la barre fine ne s'allume pas (${lectureTel.ombre.slice(0, 30)})`);
    await p.tap('#stop'); await p.waitForTimeout(300);
    await p.close(); await ctx.close();

    check(erreurs.length === 0, `aucune erreur de page ni de console (${erreurs.slice(0, 3).join(' | ')})`);
    await nav.close();
    bilan();
})().catch(e => { console.log('FATAL ' + (e && e.stack || e)); process.exit(1); });
