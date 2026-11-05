// L'EN-TÊTE DE PARTIE (refonte, lot 5c), avec de vrais clics.
//
// CE QUE DEMANDE LA MAQUETTE VALIDÉE (docs/refonte.md, « Grille (bureau) ») : « nom et N mesures sur la MÊME LIGNE DE BASE, ×N si répétée, menu ⋯
// (répéter, renommer, monter, descendre, dupliquer, supprimer — version automatique avant suppression) ».
//
// CE QUE LE BANC TIENT :
//   • sur ordinateur, le nom, « N mesures » et « ×N » se suivent sur la même ligne de base ; le champ du nom a la largeur de son texte, sans jamais
//     déborder ; les quatre petits boutons ▲▼⧉🗑 ont laissé la place au seul ⋯ ;
//   • ×N est le nombre de fois que la partie est JOUÉE d'après la structure — la même valeur que la vue Structure, réglée par le même geste ;
//   • chaque article du menu fait ce qu'il dit (et rien quand il est grisé) ; supprimer garde une version d'abord, et un refus ne supprime rien ;
//   • une partie jouée à plusieurs endroits de la structure ne se « répète » pas d'ici : le menu le dit et mène à la vue Structure ;
//   • clavier : Échap referme et rend le focus au ⋯, les flèches parcourent le menu ;
//   • le téléphone n'a pas bougé (lot 10).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('en-tête de partie');
const { estBruitReseau } = require('./_harness');

plan(48);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = (opts) => {
    const mk = (r, q, b = 4) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const S = [
        { title: 'Couplet', sid: 'pa', repeatCount: 2, chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', '7')] },
        { title: 'Refrain', sid: 'pb', chords: [mk('F', 'maj7'), mk('G', '7', 2), mk('C', 'maj7', 6)] },
        { title: 'Pont', sid: 'pc', chords: [mk('D', 'min7', 4)] },
        { title: 'Fin', sid: 'pd', chords: [mk('C', 'maj7', 6)] },
    ].slice(0, opts.nb || 4);
    const tampon = { sections: S };
    if (opts.structure) tampon.structure = opts.structure;
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S, structure: opts.structure || undefined }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify(tampon));
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    let dialogues = [];
    let reponseDialogue = true;
    const ouvrir = async (viewport, opts = {}) => {
        const p = await nav.newPage({ viewport });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        p.on('dialog', d => { dialogues.push(d.message()); if (reponseDialogue) d.accept(); else d.dismiss(); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine, opts);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const titres = (p) => p.evaluate(() => [...document.querySelectorAll('#progression-sections .prog-title')].map(t => t.value));
    const etiquettes = (p) => p.evaluate(() => [...document.querySelectorAll('#progression-sections .prog-section-head')].map(h => { const r = h.querySelector('.prog-section-rep'); return r ? r.textContent : ''; }));
    const menuOuvert = (p) => p.evaluate(() => !document.getElementById('partie-menu').hidden);
    const ouvrirMenu = async (p, si) => { await p.click(`.prog-section-menu[data-section="${si}"]`); await p.waitForTimeout(150); };
    const article = (p, action) => p.locator(`#partie-menu [data-partie-action="${action}"]`);

    // ======================================================================================================
    console.log('\n=== A. Nom, mesures et ×N sur une même ligne de base ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    const geo = await p.evaluate(() => [...document.querySelectorAll('#progression-sections .prog-section-head')].map(h => {
        // Ligne de base mesurée par des SONDES de hauteur nulle : posée DANS un texte, une boîte inline-block vide a son bas sur la ligne de base de ce
        // texte. Une sonde dans « N mesures », une dans « ×N », et une troisième comme élément de la rangée (son bas = la ligne de base commune).
        const sonde = (parent, avant = null) => { const s = document.createElement('span'); s.style.cssText = 'display:inline-block;width:0;height:0'; parent.insertBefore(s, avant); return s; };
        const nom = h.querySelector('.psh-nom'), t = h.querySelector('.prog-title'), m = h.querySelector('.prog-section-measures'), r = h.querySelector('.prog-section-rep');
        const sr = sonde(nom), sm = m ? sonde(m) : null;
        // « ×N » est une étiquette en flex : une sonde y deviendrait un élément flex, pas du texte. Sa ligne de base vient donc du TEXTE lui-même :
        // la boîte d'un nœud texte (Range) a pour hauteur montée + descente de sa police, la ligne de base est à « haut + montée ».
        const baseTexte = (el) => { const n = [...el.childNodes].find(x => x.nodeType === 3 && x.textContent.trim()); if (!n) return null; const rg = document.createRange(); rg.selectNodeContents(n); const c = getComputedStyle(el); const cx = document.createElement('canvas').getContext('2d'); cx.font = `${c.fontWeight} ${c.fontSize} ${c.fontFamily}`; const mm = cx.measureText('Hg'); const b = rg.getBoundingClientRect(); return b.top + (b.height - mm.fontBoundingBoxAscent - mm.fontBoundingBoxDescent) / 2 + mm.fontBoundingBoxAscent; };
        const sx = null;
        // Le texte du champ : sa ligne de base = haut du champ + bordure + marge intérieure + montée de la police (mesurée au canevas).
        const cs = getComputedStyle(t); const ctx = document.createElement('canvas').getContext('2d'); ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const mt = ctx.measureText('Hg'); const tr = t.getBoundingClientRect();
        const ligneTexte = parseFloat(cs.lineHeight) || (mt.fontBoundingBoxAscent + mt.fontBoundingBoxDescent);
        const baseChamp = tr.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop) + (tr.height - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth) - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - ligneTexte) / 2 + (ligneTexte - mt.fontBoundingBoxAscent - mt.fontBoundingBoxDescent) / 2 + mt.fontBoundingBoxAscent;
        const out = {
            rangee: sr.getBoundingClientRect().bottom, mesures: sm ? sm.getBoundingClientRect().bottom : null, rep: r ? baseTexte(r) : null, mesuresTexteBase: m ? baseTexte(m) : null, champ: baseChamp,
            titreDroite: tr.right, titreL: tr.width, mesuresGauche: m ? m.getBoundingClientRect().left : null, repGauche: r ? r.getBoundingClientRect().left : null,
            mesuresTexte: m ? [...m.childNodes].filter(n => n.nodeType === 3 || getComputedStyle(n).display !== 'none').map(n => n.textContent).join('').trim() : null,
            teteH: h.getBoundingClientRect().height,
        };
        [sr, sm, sx].forEach(s => s && s.remove());
        return out;
    }));
    console.log(JSON.stringify(geo.map(g => ({ r: Math.round(g.rangee), m: g.mesures && Math.round(g.mesures), x: g.rep && Math.round(g.rep), c: Math.round(g.champ), t: g.mesuresTexte }))));
    check(geo[0].mesures !== null && Math.abs(geo[0].mesures - geo[0].rangee) <= 1, `« 4 mesures » est sur la ligne de base de la rangée (${geo[0].mesures?.toFixed(1)} / ${geo[0].rangee.toFixed(1)})`);
    check(geo[0].mesuresTexteBase !== null && Math.abs(geo[0].mesuresTexteBase - geo[0].mesures) <= 1, `(la mesure par le texte donne la même ligne que la sonde : ${geo[0].mesuresTexteBase?.toFixed(1)})`);
    check(geo[0].rep !== null && Math.abs(geo[0].rep - geo[0].rangee) <= 1, `« ×2 » aussi (${geo[0].rep?.toFixed(1)})`);
    check(Math.abs(geo[0].champ - geo[0].rangee) <= 1.5, `et le texte du nom aussi (${geo[0].champ.toFixed(1)})`);
    check(geo[0].mesuresGauche - geo[0].titreDroite >= 0 && geo[0].mesuresGauche - geo[0].titreDroite <= 12, `« 4 mesures » suit le nom, juste après lui (${(geo[0].mesuresGauche - geo[0].titreDroite).toFixed(1)}px)`);
    check(geo[0].titreL < 110, `le champ du nom a la largeur de son texte, pas toute la ligne (${geo[0].titreL.toFixed(0)}px pour « Couplet »)`);
    check(JSON.stringify(geo.map(g => g.mesuresTexte)) === JSON.stringify(['4 mesures', '3 mesures', '1 mesure', '1,5 mesure']),
        `« mesures » en toutes lettres, au singulier sous 2, virgule décimale : ${JSON.stringify(geo.map(g => g.mesuresTexte))}`);
    check(geo.every(g => Math.round(g.teteH) === 32), `l'en-tête fait 32px, la hauteur de la maquette (${geo.map(g => Math.round(g.teteH)).join(', ')})`);
    check(JSON.stringify(await etiquettes(p)) === JSON.stringify(['×2', '', '', '']), `« ×2 » sur le couplet joué deux fois, rien ailleurs : ${JSON.stringify(await etiquettes(p))}`);
    const boutons = await p.evaluate(() => {
        const h = document.querySelector('#progression-sections .prog-section-head');
        const vis = (sel) => [...h.querySelectorAll(sel)].filter(b => b.getBoundingClientRect().width > 0).length;
        const m = h.querySelector('.prog-section-menu').getBoundingClientRect(), hr = h.getBoundingClientRect();
        return { anciens: vis('.psh-ancien'), menu: vis('.prog-section-menu'), aDroite: Math.abs(m.right - hr.right) <= 1 };
    });
    check(boutons.anciens === 0 && boutons.menu === 1, `un seul bouton ⋯, plus de ▲▼⧉🗑 dans l'en-tête (${boutons.anciens} ancien(s) visible(s))`);
    check(boutons.aDroite, 'le ⋯ est au bout de la ligne');

    // Un nom très long s'élargit en tapant… sans jamais pousser le ⋯ hors de la ligne.
    const champ = p.locator('.prog-title[data-section="1"]');
    await champ.click();
    await p.keyboard.press('End');
    await p.keyboard.type(' — le grand refrain final, celui qui revient trois fois avant le pont');
    await p.waitForTimeout(100);
    const long = await p.evaluate(() => { const h = document.querySelectorAll('#progression-sections .prog-section-head')[1]; const t = h.querySelector('.prog-title').getBoundingClientRect(), m = h.querySelector('.prog-section-menu').getBoundingClientRect(), hr = h.getBoundingClientRect(); return { t: t.width, tDroite: t.right, mGauche: m.left, mDroite: m.right, hDroite: hr.right }; });
    check(long.t > 150, `le champ grandit avec le nom tapé (${long.t.toFixed(0)}px)`);
    check(long.tDroite <= long.mGauche && long.mDroite <= long.hDroite + 1, `sans déborder : le ⋯ reste sur la ligne (nom finit à ${long.tDroite.toFixed(0)}, ⋯ de ${long.mGauche.toFixed(0)} à ${long.mDroite.toFixed(0)}, ligne ${long.hDroite.toFixed(0)})`);
    await p.keyboard.press('Enter');
    await p.waitForTimeout(150);
    check((await titres(p))[1].startsWith('Refrain — le grand'), 'Entrée valide le nouveau nom');
    await p.keyboard.press('Control+z');
    await p.waitForTimeout(200);

    // ======================================================================================================
    console.log('\n=== B. Répéter : le même ×N que la vue Structure ===');
    await ouvrirMenu(p, 0);
    const pos = await p.evaluate(() => { const m = document.getElementById('partie-menu').getBoundingClientRect(), b = document.querySelector('.prog-section-menu[data-section="0"]').getBoundingClientRect(); return { sous: m.top >= b.bottom, cale: Math.abs(m.right - b.right) <= 1, dedans: m.left >= 0 && m.right <= innerWidth && m.bottom <= innerHeight, exp: document.querySelector('.prog-section-menu[data-section="0"]').getAttribute('aria-expanded') }; });
    check(pos.sous && pos.cale && pos.dedans, `le menu s'ouvre sous le ⋯, calé à droite sur lui, dans la fenêtre (${JSON.stringify(pos)})`);
    check(pos.exp === 'true', 'le ⋯ se dit « ouvert » (aria-expanded)');
    const val = () => p.evaluate(() => document.querySelector('#partie-menu .partie-rep-val').textContent);
    check(await val() === '×2', `« Répéter » montre ×2 (${await val()})`);
    await article(p, 'rep-plus').click(); await p.waitForTimeout(150);
    check(await val() === '×3' && await menuOuvert(p), `« + » : ×3, et le menu reste ouvert pour enchaîner (${await val()})`);
    check((await etiquettes(p))[0] === '×3', `l'en-tête dit ×3 aussitôt (${(await etiquettes(p))[0]})`);
    const vueStructure = await p.evaluate(() => { const it = structureEffective(assurerIdentifiantsParties()).items.find(i => i.sid === 'pa'); const song = loadSongs()[0]; const so = (song.structure || []).find(i => i.sid === 'pa'); return { tampon: it && it.rep, morceau: so && so.rep }; });
    check(vueStructure.tampon === 3 && vueStructure.morceau === 3, `c'est la répétition de la STRUCTURE, enregistrée dans le morceau comme depuis la vue Structure (tampon ${vueStructure.tampon}, morceau ${vueStructure.morceau})`);
    await article(p, 'rep-moins').click(); await p.waitForTimeout(100);
    await article(p, 'rep-moins').click(); await p.waitForTimeout(150);
    check(await val() === '×1' && (await etiquettes(p))[0] === '', `deux fois « − » : ×1, et l'étiquette disparaît de l'en-tête (${await val()} / « ${(await etiquettes(p))[0]} »)`);
    check(await article(p, 'rep-moins').isDisabled(), 'à ×1, « − » est grisé');
    const focusApres = await p.evaluate(() => document.activeElement && document.activeElement.dataset.partieAction);
    check(focusApres === 'rep-plus', `le focus ne se perd pas quand « − » se grise : il passe à « + » (${focusApres})`);

    // ======================================================================================================
    console.log('\n=== C. Clavier ===');
    await p.keyboard.press('ArrowDown'); await p.waitForTimeout(50);
    check(await p.evaluate(() => document.activeElement && document.activeElement.dataset.partieAction) === 'renommer', 'Flèche bas : article suivant (Renommer — Monter est grisé pour la 1re partie, on le saute)');
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    check(!(await menuOuvert(p)), 'Échap referme le menu');
    check(await p.evaluate(() => document.activeElement && document.activeElement.matches('.prog-section-menu[data-section="0"]')), 'et rend le focus au ⋯');
    const activeAvant = await p.evaluate(() => window.app.activeSection);
    const autre = activeAvant === 1 ? 2 : 1;
    await ouvrirMenu(p, autre);
    // Ouvrir un menu ne déplace rien : activer la partie redessinait la grille et faisait sauter le panneau « Conduite de voix » sous elle.
    check(await p.evaluate(() => window.app.activeSection) === activeAvant, `ouvrir le ⋯ d'une autre partie ne l'active pas (partie active ${activeAvant} → ${await p.evaluate(() => window.app.activeSection)})`);
    await p.mouse.click(1400, 860); await p.waitForTimeout(100);
    check(!(await menuOuvert(p)), 'un clic ailleurs le referme');

    // ======================================================================================================
    console.log('\n=== D. Chaque article fait ce qu\'il dit ===');
    await ouvrirMenu(p, 0);
    check(await article(p, 'monter').isDisabled(), '« Monter » est grisé pour la première partie');
    await article(p, 'monter').click({ force: true }); await p.waitForTimeout(150);
    check(JSON.stringify((await titres(p)).slice(0, 2)) === '["Couplet","Refrain"]' && await menuOuvert(p), 'et cliqué quand même, il ne fait rien (le menu reste ouvert)');
    await article(p, 'descendre').click(); await p.waitForTimeout(200);
    check(JSON.stringify((await titres(p)).slice(0, 2)) === '["Refrain","Couplet"]' && !(await menuOuvert(p)), `« Descendre » : ${JSON.stringify((await titres(p)).slice(0, 2))}, menu refermé`);
    await ouvrirMenu(p, 1);
    await article(p, 'monter').click(); await p.waitForTimeout(200);
    check(JSON.stringify((await titres(p)).slice(0, 2)) === '["Couplet","Refrain"]', '« Monter » la remet en tête');
    await ouvrirMenu(p, 2);
    await article(p, 'renommer').click(); await p.waitForTimeout(150);
    const ren = await p.evaluate(() => { const a = document.activeElement; return { champ: a && a.matches('.prog-title[data-section="2"]'), sel: a ? a.selectionEnd - a.selectionStart : 0 }; });
    check(ren.champ && ren.sel === 4, `« Renommer » met le curseur dans le nom de la partie, texte sélectionné (${JSON.stringify(ren)})`);
    await p.keyboard.type('Bridge'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
    check((await titres(p))[2] === 'Bridge', 'on tape le nouveau nom directement');
    await ouvrirMenu(p, 2);
    await article(p, 'dupliquer').click(); await p.waitForTimeout(200);
    check(JSON.stringify(await titres(p)) === '["Couplet","Refrain","Bridge","Bridge (copie)","Fin"]', `« Dupliquer » : la copie juste après (${JSON.stringify(await titres(p))})`);

    // Supprimer : une confirmation ; refusée, rien ne part ; acceptée, la partie part — et une version est gardée AVANT.
    reponseDialogue = false; dialogues = [];
    await ouvrirMenu(p, 3);
    await article(p, 'supprimer').click(); await p.waitForTimeout(200);
    check(dialogues.length === 1 && (await titres(p)).length === 5, `« Supprimer », confirmation refusée : rien ne part (${dialogues.length} question, ${(await titres(p)).length} parties)`);
    const avant = await p.evaluate(() => HistoriqueVersions.lister('s1').then(l => l.filter(v => v.motif === 'avant-suppression-partie').length));
    reponseDialogue = true; dialogues = [];
    await ouvrirMenu(p, 3);
    await article(p, 'supprimer').click(); await p.waitForTimeout(400);
    check(JSON.stringify(await titres(p)) === '["Couplet","Refrain","Bridge","Fin"]', `confirmation acceptée : la copie est supprimée (${JSON.stringify(await titres(p))})`);
    const versions = await p.evaluate(() => HistoriqueVersions.lister('s1').then(l => l.filter(v => v.motif === 'avant-suppression-partie').map(v => ({ libelle: v.libelle, parties: v.charge.sections.map(s => s.title) }))));
    check(versions.length === avant + 1 && versions[0] && versions[0].parties.includes('Bridge (copie)'), `une version « avant suppression » a été gardée, AVEC la partie supprimée (${JSON.stringify(versions[0])})`);
    await p.close();

    // Une seule partie : elle ne se supprime pas, et le menu le dit au lieu de cacher l'article.
    p = await ouvrir({ width: 1440, height: 900 }, { nb: 1 });
    await ouvrirMenu(p, 0);
    check(await article(p, 'supprimer').isDisabled(), 'une partie seule : « Supprimer la partie » est grisé (visible, avec sa raison en infobulle)');
    check(await article(p, 'monter').isDisabled() && await article(p, 'descendre').isDisabled(), 'ni monter ni descendre');
    await p.close();

    // ======================================================================================================
    console.log('\n=== E. Jouée à plusieurs endroits de la structure ===');
    const structure = [
        { id: 'i1', sid: 'pa', rep: 2, label: '', notes: [] }, { id: 'i2', sid: 'pb', rep: 1, label: '', notes: [] },
        { id: 'i3', sid: 'pa', rep: 1, label: '', notes: [] }, { id: 'i4', sid: 'pd', rep: 1, label: '', notes: [] },
    ];
    p = await ouvrir({ width: 1440, height: 900 }, { structure });
    check(JSON.stringify(await etiquettes(p)) === JSON.stringify(['×3', '', '', '']), `le couplet, à deux endroits (×2 puis ×1), est joué 3 fois ; le pont, absent de la structure, n'affiche rien (${JSON.stringify(await etiquettes(p))})`);
    await ouvrirMenu(p, 0);
    const multi = await p.evaluate(() => ({ raison: (document.querySelector('#partie-menu .partie-rep-raison') || {}).textContent || '', moins: document.querySelector('#partie-menu [data-partie-action="rep-moins"]').disabled, plus: document.querySelector('#partie-menu [data-partie-action="rep-plus"]').disabled }));
    check(multi.moins && multi.plus && /2 endroits/.test(multi.raison), `on ne règle pas « répéter » d'ici : − et + grisés, avec la raison (« ${multi.raison} »)`);
    await article(p, 'structure').click(); await p.waitForTimeout(400);
    check(await p.evaluate(() => window.app.fenetreStructureOuverte()), '« Régler dans Structure » ouvre la vue Structure');
    await p.evaluate(() => window.app.closeStructureWindow()); await p.waitForTimeout(200);
    await ouvrirMenu(p, 2);
    const absente = await p.evaluate(() => (document.querySelector('#partie-menu .partie-rep-raison') || {}).textContent || '');
    check(/Absente/.test(absente), `une partie absente de la structure le dit aussi (« ${absente} »)`);
    await p.close();

    // ======================================================================================================
    console.log('\n=== E2. Le menu suit son bouton quand la page défile ===');
    // Fenêtre basse : la grille défile. Un menu en position fixe qui ne suivrait pas resterait en l'air, loin de sa partie ; le refermer à chaque
    // défilement le fermait aussi à peine ouvert (activer la partie redessine la grille, ce qui fait défiler d'un cran) — il SUIT.
    p = await ouvrir({ width: 1440, height: 560 });
    await ouvrirMenu(p, 1);
    const ancrage = () => p.evaluate(() => { const m = document.getElementById('partie-menu'), b = document.querySelector('.prog-section-menu[data-section="1"]').getBoundingClientRect(), r = m.getBoundingClientRect(); return { ouvert: !m.hidden, ecartHaut: Math.round(r.top - b.bottom), ecartDroite: Math.round(r.right - b.right), boutonHaut: Math.round(b.top) }; });
    const a0 = await ancrage();
    // La grille défile dans son propre cadre (.history-section), pas la page : la molette au-dessus d'une case de la partie 0 (l'activer redessinerait).
    const g = await p.locator('.chord-grid[data-section="0"] .grid-cell').first().boundingBox();
    await p.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    await p.mouse.wheel(0, 80); await p.waitForTimeout(400);
    const a1 = await ancrage();
    console.log(JSON.stringify({ a0, a1 }));
    exiger(a1.boutonHaut !== a0.boutonHaut, `la page a bien défilé (bouton de ${a0.boutonHaut} à ${a1.boutonHaut}px)`);
    check(a1.ouvert && a1.ecartHaut === 6 && a1.ecartDroite === 0, `le menu est resté ouvert, collé sous son bouton (${JSON.stringify(a1)})`);
    await p.close();

    // ======================================================================================================
    // Réécrit au lot 10c : le téléphone a pris l'en-tête de l'ordinateur (« nom + N mesures + ×N + menu ⋯ ») — à 44px, voir telephone_reglages_test.
    console.log('\n=== F. Le téléphone a l\'en-tête de l\'ordinateur (lot 10c) ===');
    p = await ouvrir({ width: 390, height: 844 });
    const tel = await p.evaluate(() => {
        const h = document.querySelector('#progression-sections .prog-section-head');
        const vis = (sel) => [...h.querySelectorAll(sel)].filter(b => b.getBoundingClientRect().width > 0).length;
        const m = h.querySelector('.prog-section-measures');
        return { anciens: vis('.psh-ancien'), menu: vis('.prog-section-menu'), titre: h.querySelector('.prog-title').getBoundingClientRect().width,
            mesures: [...m.childNodes].filter(n => n.nodeType === 3 || getComputedStyle(n).display !== 'none').map(n => n.textContent).join('').trim() };
    });
    check(tel.anciens === 0 && tel.menu === 1, `ses boutons ▼⧉🗑 sont passés dans le ⋯ (${tel.anciens} boutons, ${tel.menu} ⋯)`);
    check(tel.titre < 150 && tel.mesures === '4 mesures', `le nom prend la largeur de son texte (${tel.titre.toFixed(0)}px) et « 4 mesures » s'écrit en toutes lettres (« ${tel.mesures} »)`);
    await p.close();

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length ? erreurs.join(' | ') : 'aucune'})`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
