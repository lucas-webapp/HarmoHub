// LE SÉQUENCEUR EN PLEIN ÉCRAN (L9a, 15/11) — la poignée du haut monte jusque SOUS LA BARRE DU HAUT de l'appli, la grille d'accords est entièrement recouverte.
//
// SES MOTS : « étirer le séquenceur au-dessus de la barre d'outils […] une seule ligne visible si je suis en plein écran pour le séquenceur » ; puis, quand je l'avais pris pour une ligne de
// la grille : « Pardon on s'est mal compris. Je ne veux pas une ligne de la grille ! Je veux une ligne de l'appli, c'est-à-dire celle avec le logo et l'enregistrement, pour avoir le séquenceur
// en plein écran » (l'utilisateur, 15/11).
//
// CE QUE LE BANC TIENT, avec de vrais gestes (glissé de la poignée à la souris, double-clic, clics sur les noms d'accords, lecture) :
//   A. au départ rien ne change : la grille est là, la barre de lecture aussi ;
//   B. tirer la poignée jusqu'en haut : le séquenceur colle sous la barre du haut (logo, Enregistrer, onglets), la grille est MASQUÉE (hauteur 0, pas rétrécie), la page ne défile pas
//      (la barre de lecture reste à l'écran, au bas), plus de lignes sont visibles ;
//   C. on y travaille : choisir un accord par son nom, ▲ ▼ entre les lignes, poser une croche, Ctrl+Z, la lecture ;
//   D. la bulle d'accord ouverte se referme (sa case n'a plus de place) ; redescendre : la grille revient ; double-clic sur la poignée : retour aussi ;
//   E. à 700 px de haut, et en réduisant la fenêtre : toujours plein, barre de lecture à l'écran ; fermer le séquenceur rend la grille ;
//   F. la vue Voix (quatre lignes) ne masque jamais la grille ; le réglage de la vue Piano revient avec elle ; les onglets Structure / Grille ;
//   G. le téléphone n'a pas bougé.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('séquenceur en plein écran');
const { estBruitReseau } = require('./_harness');
const { dblclickHorsNom } = require('./_geste_accord');
const V = require('./_verre_commun');

plan(51);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const mk = (r, q) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
// Huit accords = deux lignes de la grille (▲ ▼ ont de quoi faire).
const PARTIE = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7'), mk('E', 'min7'), mk('A', 'dom7'), mk('D', 'min7'), mk('G', 'dom7')] }];
const TEL = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 };

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (contexte, vue = 'notes') => {
        const ctx = await nav.newContext(contexte);
        await ctx.addInitScript(([S, vue]) => {
            if (sessionStorage.getItem('banc-sq-plein')) return;
            sessionStorage.setItem('banc-sq-plein', '1');
            localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
            localStorage.setItem('harmohubCurrentSongId', 's1');
            localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
            sessionStorage.setItem('cc_accueil_vu', '1');
            localStorage.setItem('harmohubSequenceurOuvert', '1');
            localStorage.setItem('harmohubSequenceurVue', vue);
        }, [PARTIE, vue]);
        await ctx.route(/gstatic\.com|googleapis\.com|tonejs\.github\.io/, r => r.abort());
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !V.BRUIT.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.waitForFunction(() => !!window.app);
        await p.waitForTimeout(900);
        return { p, ctx };
    };
    // Lecture de l'état (jamais pour agir) : la page entière, mesurée.
    const mesures = (p) => p.evaluate(() => {
        const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { t: Math.round(b.top * 10) / 10, b: Math.round(b.bottom * 10) / 10, h: Math.round(b.height * 10) / 10, w: Math.round(b.width) }; };
        const seq = document.getElementById('sequenceur');
        return {
            plein: document.body.classList.contains('sequenceur-plein'), inner: window.innerHeight, page: document.documentElement.scrollHeight, defile: window.scrollY,
            haut: r('.top-bar'), main: r('main'), grille: r('.history-section'), seq: r('#sequenceur'), poignee: r('#sq-poignee'), tiroir: r('#vues-tiroir'), lecture: r('#barre-lecture'),
            seqAffiche: seq ? getComputedStyle(seq).display !== 'none' && !seq.hidden : false,
            visibles: window.app.sequenceur._visibles, lignes: (window.app.sequenceur._lignes || []).length,
            noms: [...document.querySelectorAll('.sq-nom')].map(e => +e.dataset.c), choisi: window.app.selectedIndex,
            allumees: document.querySelectorAll('#sq-grille .sq-case.on').length,
        };
    });
    // Un VRAI glissé de souris sur la poignée du haut : par pas de 15 px toutes les 15 ms, comme une main. On la saisit à droite : une bulle d'accord ouverte peut couvrir le milieu.
    const glisserPoignee = async (p, versY) => {
        const b = await p.locator('#sq-poignee').boundingBox();
        const x = b.x + b.width - 80, y0 = b.y + 5;
        await p.mouse.move(x, y0); await p.mouse.down();
        const sens = versY < y0 ? -1 : 1;
        for (let y = y0; sens < 0 ? y > versY : y < versY; y += sens * 15) { await p.mouse.move(x, y + sens * 15); await p.waitForTimeout(15); }
        await p.mouse.move(x, versY); await p.mouse.up(); await p.waitForTimeout(350);
    };
    const enHaut = (p) => glisserPoignee(p, 20);   // au-delà de la barre du haut : la poignée s'arrête où la place s'arrête
    // La barre de lecture est EXACTEMENT au bas de l'écran (ni au-delà, ni un trou sous elle : un séquenceur trop court laisserait du vide en dessous).
    const toutDansLEcran = (m) => m.lecture && Math.abs(m.lecture.b - m.inner) <= 1 && m.lecture.t >= 0;

    // ======================================================================================================
    console.log('\n=== A. Au départ : rien ne change ===');
    let { p, ctx } = await ouvrir({ viewport: { width: 1440, height: 900 } });
    let m = await mesures(p);
    exiger(m.seqAffiche && await p.evaluate(() => window.app.sequenceur.vue === 'notes'), 'le séquenceur est ouvert, en vue Piano (la vue qui a de quoi remplir l\'écran)');
    check(!m.plein && m.grille.h > 150, `la grille d'accords est là (${m.grille.h} px) et le plein écran n'est pas posé`);
    check(Math.abs(m.seq.b - m.tiroir.t) <= 1 && m.lecture.b <= m.inner + 0.5, 'le séquenceur repose sur le tiroir des diagrammes, la barre de lecture est au bas de l\'écran');
    const visAvant = m.visibles || 12, hautAvant = m.seq.h;

    // ======================================================================================================
    console.log('\n=== B. Tirer la poignée jusqu\'en haut : le séquenceur prend toute la place sous la barre du haut ===');
    // Le glissé à la main, SANS relâcher d'abord : on voit où l'on va pendant qu'on tire, pas seulement au lâcher.
    const prise = await p.locator('#sq-poignee').boundingBox();
    const xp = prise.x + prise.width - 80;
    await p.mouse.move(xp, prise.y + 5); await p.mouse.down();
    for (let y = prise.y + 5; y > 20; y -= 15) { await p.mouse.move(xp, y - 15); await p.waitForTimeout(15); }
    await p.waitForTimeout(200);
    check((await mesures(p)).plein, 'PENDANT le glissé (bouton encore enfoncé) la grille disparaît déjà : on voit où l\'on va');
    await p.mouse.up(); await p.waitForTimeout(350);
    m = await mesures(p);
    check(m.plein, 'la classe body.sequenceur-plein est posée');
    check(m.haut.b === 53 && m.haut.t === 0, `la barre du haut (logo, Enregistrer, onglets) est toujours là : ${m.haut.t} → ${m.haut.b}`);
    check(Math.abs(m.seq.t - m.haut.b) <= 1.5, `le séquenceur colle sous elle (${m.seq.t} pour ${m.haut.b})`);
    check(Math.abs(m.seq.b - m.tiroir.t) <= 1, `et descend jusqu'au tiroir des diagrammes, sans trou (${m.seq.b} pour ${m.tiroir.t})`);
    check(await p.evaluate(() => { const g = document.getElementById('sq-grille'); return g.clientHeight >= parseFloat(g.style.maxHeight) - 1; }), 'aucune ligne n\'est coupée : la grille des notes a toute la hauteur que demandent ses lignes visibles (la poignée s\'arrête avant)');
    check(m.grille.h === 0, `la grille d'accords est ENTIÈREMENT recouverte, masquée et non rétrécie (hauteur ${m.grille.h})`);
    check(m.main.h === 53, `la colonne ne garde que la place de la barre du haut (${m.main.h} px : plus de rangée collée, plus de marge de 20 px)`);
    check(m.page === m.inner && m.defile === 0, `la page ne défile pas (${m.page} pour ${m.inner} px de fenêtre)`);
    check(toutDansLEcran(m) && m.lecture.t >= m.tiroir.b - 1, `la barre de lecture reste à l'écran, sous le tiroir (${m.lecture.t} → ${m.lecture.b})`);
    check(m.visibles > visAvant && m.seq.h > hautAvant + 150, `plus de lignes sont visibles (${visAvant} → ${m.visibles}, séquenceur ${Math.round(hautAvant)} → ${Math.round(m.seq.h)} px)`);
    const portes = await p.evaluate(() => ['tab-grille', 'structure-btn', 'lyrics-btn'].map(id => { const e = document.getElementById(id), b = e.getBoundingClientRect(), t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!t && !!t.closest('#' + id); }));
    check(portes.every(Boolean), 'les onglets Grille, Structure et Paroles de la barre du haut sont à l\'écran et cliquables');
    check(m.poignee.t >= m.haut.b - 1 && m.poignee.t < m.haut.b + 12 && await p.evaluate(() => { const b = document.getElementById('sq-poignee').getBoundingClientRect(), t = document.elementFromPoint(b.right - 80, b.top + 5); return !!t && !!t.closest('#sq-poignee'); }),
        `la poignée reste juste sous la barre du haut, atteignable pour redescendre (${m.poignee.t})`);
    const parLigne = await p.evaluate(() => { const l = [...document.querySelectorAll('#sq-grille .sq-case[data-r]')].map(e => Math.round(e.getBoundingClientRect().top)); return new Set(l).size; });
    check(parLigne >= 15, `les lignes de demi-tons se voient en nombre (${parLigne} lignes à l'écran)`);

    // ======================================================================================================
    console.log('\n=== C. On y travaille : accords par leur nom, ▲ ▼, croches, annulation, lecture ===');
    await p.click('.sq-nom[data-c="2"]'); await p.waitForTimeout(250);
    m = await mesures(p);
    check(m.choisi === 2 && m.plein, `un clic sur le nom d'un accord le choisit, sans grille (accord ${m.choisi})`);
    check(m.noms.join() === '0,1,2,3' && m.noms.length === 4, `le séquenceur montre la ligne de cet accord (${m.noms.join(' ')})`);
    await p.click('#sq-ligne-suiv'); await p.waitForTimeout(250);
    m = await mesures(p);
    check(m.noms.join() === '4,5,6,7' && m.choisi >= 4 && m.plein, `▼ passe à la ligne suivante de la grille (${m.noms.join(' ')}, accord ${m.choisi})`);
    await p.click('#sq-ligne-prec'); await p.waitForTimeout(250);
    m = await mesures(p);
    check(m.noms.join() === '0,1,2,3' && m.plein, `▲ revient à la première (${m.noms.join(' ')})`);
    const avant = m.allumees;
    const vide = await p.evaluate(() => {
        const c = [...document.querySelectorAll('#sq-grille .sq-case[data-r]:not(.on)')].find(e => { const r = e.getBoundingClientRect(); return r.top > 160 && r.bottom < 600 && e.dataset.c === '0'; });
        const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await p.mouse.click(vide.x, vide.y); await p.waitForTimeout(300);
    m = await mesures(p);
    check(m.allumees === avant + 1, `un clic sur une case vide pose une croche (${avant} → ${m.allumees} cases allumées)`);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
    m = await mesures(p);
    check(m.allumees === avant && m.plein, `Ctrl+Z l'annule en une fois (${m.allumees}) et le plein écran reste`);
    await p.click('#play-prog');
    const joue = await p.waitForFunction(() => window.app.isPlaying && document.querySelector('#sq-grille .sq-case.tete'), null, { timeout: 5000 }).then(() => true, () => false);
    exiger(joue, 'la lecture démarre et marque la croche qui sonne');
    await p.waitForTimeout(1200);
    m = await mesures(p);
    check(m.plein && m.page === m.inner && toutDansLEcran(m) && !await p.evaluate(() => document.getElementById('sq-tete').hidden),
        'pendant la lecture : toujours plein, page fixe, barre de lecture à l\'écran, la tête de lecture glisse dans le séquenceur');
    await p.click('#stop'); await p.waitForTimeout(300);

    // ======================================================================================================
    console.log('\n=== D. Redescendre : la grille revient ===');
    await glisserPoignee(p, 560);
    m = await mesures(p);
    check(!m.plein && m.grille.h > 100, `un glissé vers le bas rend la grille (${m.grille.h} px) et retire le plein écran`);
    check(m.seq.t > m.haut.b + 100 && Math.abs(m.seq.b - m.tiroir.t) <= 1 && m.page === m.inner && toutDansLEcran(m), `le séquenceur repose de nouveau sur le tiroir (haut à ${m.seq.t}), page fixe, barre de lecture à l'écran`);
    check(m.visibles < 20 && m.visibles >= 2, `avec moins de lignes (${m.visibles})`);
    await enHaut(p);
    m = await mesures(p);
    exiger(m.plein, 'on le remet en plein écran');
    await p.dblclick('#sq-poignee', { position: { x: 1200, y: 5 } }); await p.waitForTimeout(350);
    m = await mesures(p);
    check(!m.plein && m.grille.h > 100 && m.visibles === 0, `le double-clic sur la poignée rend la vue d'origine (douze lignes) : grille ${m.grille.h} px`);
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== E. La bulle d\'accord se referme quand la grille disparaît ===');
    ({ p, ctx } = await ouvrir({ viewport: { width: 1440, height: 900 } }));
    await dblclickHorsNom(p, '#progression-sections .grid-cell[data-section="0"][data-index="1"]'); await p.waitForTimeout(350);
    exiger(await p.evaluate(() => !document.getElementById('bulle-accord').hidden), 'la bulle de l\'accord est ouverte (double-clic sur la case)');
    await enHaut(p);
    m = await mesures(p);
    check(m.plein && await p.evaluate(() => document.getElementById('bulle-accord').hidden), 'plein écran : la bulle est fermée (sa case n\'a plus de place), elle ne flotte pas sur le séquenceur');
    check(m.choisi === 1, `l'accord reste choisi (${m.choisi}) : le séquenceur le montre`);
    await p.click('#sq-fermer'); await p.waitForTimeout(350);
    m = await mesures(p);
    check(!m.plein && !m.seqAffiche && m.grille.h > 150, `fermer le séquenceur (✕) en plein écran rend la grille (${m.grille.h} px)`);
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== F. Fenêtre basse (700 px) et fenêtre qu\'on réduit ===');
    ({ p, ctx } = await ouvrir({ viewport: { width: 1440, height: 700 } }));
    await enHaut(p);
    m = await mesures(p);
    check(m.plein && Math.abs(m.seq.t - m.haut.b) <= 1.5 && Math.abs(m.seq.b - m.tiroir.t) <= 1, `à 700 px de haut : plein écran aussi (séquenceur ${m.seq.t} → ${m.seq.b})`);
    check(m.page === m.inner && toutDansLEcran(m), `la page ne défile pas (${m.page} pour ${m.inner}) et la barre de lecture est au bas (${m.lecture.b})`);
    // La place n'est jamais un nombre entier de lignes : le reste (jusqu'à 28 px) ne doit laisser AUCUN trou, ni sous la barre du haut ni au-dessus du tiroir.
    const trous = [];
    for (const h of [660, 672, 684, 696, 708, 720]) {
        await p.setViewportSize({ width: 1440, height: h }); await p.waitForTimeout(450);
        const mh = await mesures(p);
        if (!(mh.plein && Math.abs(mh.seq.t - mh.haut.b) <= 1.5 && Math.abs(mh.seq.b - mh.tiroir.t) <= 1 && mh.page === mh.inner && toutDansLEcran(mh))) trous.push(`${h} px : ${mh.seq.t} → ${mh.seq.b}, tiroir ${mh.tiroir.t}`);
    }
    check(trous.length === 0, `de 660 à 720 px de haut (six hauteurs, restes différents) le séquenceur remplit toute la place sans trou (${trous.join(' ; ')})`);
    await p.setViewportSize({ width: 1440, height: 620 }); await p.waitForTimeout(500);
    m = await mesures(p);
    check(m.plein && m.page === m.inner && toutDansLEcran(m) && Math.abs(m.seq.b - m.tiroir.t) <= 1, `fenêtre réduite à 620 px : toujours plein, barre de lecture à l'écran (${m.lecture.b} pour ${m.inner})`);
    const lignesDemandees = m.visibles;
    await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(500);
    m = await mesures(p);
    check(!m.plein && m.grille.h > 100 && m.visibles === lignesDemandees && m.page === m.inner && toutDansLEcran(m) && Math.abs(m.seq.b - m.tiroir.t) <= 1,
        `agrandie de nouveau, les mêmes ${lignesDemandees} lignes tiennent avec la grille : elle revient (${m.grille.h} px), barre de lecture à l'écran`);
    await p.close(); await ctx.close();
    // Fenêtre où les douze lignes de départ ne tiennent déjà plus avec la grille (le séquenceur y défile) : la poignée compte depuis ce que les lignes DEMANDENT, pas depuis la hauteur plafonnée.
    ({ p, ctx } = await ouvrir({ viewport: { width: 1440, height: 640 } }));
    await enHaut(p);
    m = await mesures(p);
    check(m.plein && toutDansLEcran(m) && Math.abs(m.seq.b - m.tiroir.t) <= 1 && await p.evaluate(() => { const g = document.getElementById('sq-grille'); return g.clientHeight >= parseFloat(g.style.maxHeight) - 1; }),
        `à 640 px (douze lignes déjà trop hautes avec la grille) : plein écran, aucune ligne coupée (${m.visibles} lignes pour ${Math.round(m.seq.h)} px)`);
    await p.close(); await ctx.close();
    // Sans toucher à la poignée, une fenêtre très basse ne masque PAS la grille : seul un réglage de l'utilisateur (lignes demandées à la poignée) décide du plein écran.
    ({ p, ctx } = await ouvrir({ viewport: { width: 1440, height: 560 } }));
    m = await mesures(p);
    check(!m.plein && m.grille.h > 0 && m.visibles === 0 && m.seq.h < m.inner - 53 - 97 - 61 - 30, `à 560 px, les douze lignes de départ ne masquent pas la grille (${m.grille.h} px de grille, séquenceur ${Math.round(m.seq.h)} px)`);
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== G. La vue Voix ne masque jamais la grille ; Structure ; le réglage de Piano revient ===');
    ({ p, ctx } = await ouvrir({ viewport: { width: 1440, height: 900 } }, 'voix'));
    await enHaut(p);
    m = await mesures(p);
    check(!m.plein && m.grille.h > 100 && m.visibles <= m.lignes, `vue Voix (${m.lignes} lignes) : tout est visible, la poignée s'arrête là, la grille reste (${m.grille.h} px)`);
    await p.click('#sq-vue-notes'); await p.waitForTimeout(350);
    await enHaut(p);
    m = await mesures(p);
    exiger(m.plein, 'en vue Piano, la même poignée mène au plein écran');
    await p.click('#sq-vue-voix'); await p.waitForTimeout(400);
    m = await mesures(p);
    check(!m.plein && m.grille.h > 100, 'repasser en vue Voix (quatre lignes) rend la grille');
    await p.click('#sq-vue-notes'); await p.waitForTimeout(400);
    m = await mesures(p);
    check(m.plein && m.grille.h === 0, 'et revenir en vue Piano retrouve son réglage : plein écran');
    await p.click('#structure-btn'); await p.waitForTimeout(500);
    const struct = await p.evaluate(() => ({ ouverte: document.body.classList.contains('vue-ouverte'), seq: getComputedStyle(document.getElementById('sequenceur')).display }));
    check(struct.ouverte && struct.seq === 'none', 'l\'onglet Structure recouvre la page : le séquenceur s\'efface (rien de la grille masquée ne reste)');
    await p.click('#tab-grille'); await p.waitForTimeout(500);
    m = await mesures(p);
    check(!await p.evaluate(() => document.body.classList.contains('vue-ouverte')) && m.plein && m.grille.h === 0 && Math.abs(m.seq.t - m.haut.b) <= 1.5, 'revenir à la Grille retrouve le séquenceur en plein écran');
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== H. Le téléphone n\'a pas bougé ===');
    ({ p, ctx } = await ouvrir(TEL));
    await p.tap('#tel-sequenceur'); await p.waitForTimeout(700);
    const tel = await p.evaluate(() => {
        const seq = document.getElementById('sequenceur'), b = seq.getBoundingClientRect();
        return { plein: document.body.classList.contains('sequenceur-plein'), dans: seq.parentElement.id, max: seq.style.maxHeight, min: seq.style.minHeight, affiche: !seq.hidden && b.width > 0,
            grille: document.querySelector('.history-section').getBoundingClientRect().height, page: document.documentElement.scrollHeight };
    });
    exiger(tel.dans === 'pa-rythme' && tel.affiche, `au téléphone le séquenceur est dans le panneau d'accord (${tel.dans})`);
    check(!tel.plein && tel.max === '' && tel.min === '', `ni plein écran, ni hauteur imposée (max « ${tel.max} », min « ${tel.min} »)`);
    check(tel.grille > 0, `la grille d'accords reste dans la page (${Math.round(tel.grille)} px)`);
    await p.close(); await ctx.close();

    check(erreurs.length === 0, `aucune erreur de page ni de console (${erreurs.slice(0, 3).join(' | ')})`);
    await nav.close();
    bilan();
})().catch(e => { console.log('FATAL ' + (e && e.stack || e)); process.exit(1); });
