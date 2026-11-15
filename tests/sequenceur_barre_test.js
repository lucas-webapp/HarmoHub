// SÉQUENCEUR, L3 (14/11) — la barre d'outils : « + » en premier, vues « Accord | Piano », plus de portée, intensité « mf », menu du clic droit sur un rythme, signet = popover de
// tous les rythmes (enregistrer / créer une forme), roue des réglages, noms des rythmes, barre sur UNE ligne — avec de vrais gestes.
//
// CE QUE L'UTILISATEUR A DEMANDÉ (docs/decisions-13-14-11.md, lettres A7, D, E, T) : « + » en premier, « plus clair et plus court » ; « Voix et Toutes les notes, ce n'est pas clair,
// si tu as des logos c'est encore mieux » ; « ces boutons [de portée] compliquent un peu l'application » ; aucune croix au survol (« un peu dangereux ») : un clic droit ouvre un
// menu (Modifier, Supprimer avec confirmation, Masquer) ; le signet n'ajoute plus de rythme mais ouvre la liste de TOUS les rythmes avec « Enregistrer la forme… » et « Créer une
// forme… » ; « un petit bouton paramètres à gauche de la croix » ; tous les outils sur une seule ligne, les noms des rythmes en moins sur petit écran.
//
// CE QUE LE BANC TIENT : chaque geste lu dans le MODÈLE (formes enregistrées, rythmes des accords), la barre mesurée de 900 à 1920 px, et que le TÉLÉPHONE n'a pas bougé.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('séquenceur : la barre d\'outils');
const { estBruitReseau } = require('./_harness');
const V = require('./_verre_commun');
const R = require('./_retrait_ancien');

plan(80);

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
            if (sessionStorage.getItem('banc-sq-barre')) return;
            sessionStorage.setItem('banc-sq-barre', '1');
            localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
            localStorage.setItem('harmohubCurrentSongId', 's1');
            localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
            localStorage.setItem('harmohubSequenceurOuvert', '1');
            sessionStorage.setItem('cc_accueil_vu', '1');
            for (const k of Object.keys(reglages)) localStorage.setItem(k, reglages[k]);
        }, [PARTIE, reglages]);
        await ctx.route(/gstatic\.com|googleapis\.com|tonejs\.github\.io/, r => r.abort());
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !V.BRUIT.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.waitForFunction(() => !!window.app);
        await p.waitForTimeout(1000);
        return { p, ctx };
    };
    const visible = (p, sel) => p.evaluate((sel) => { const e = document.querySelector(sel); return !!e && !e.hidden && e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none'; }, sel);
    const formes = (p) => p.evaluate(() => (window.FormesSequenceur ? window.FormesSequenceur.formes() : []).map(f => ({ nom: f.nom, v: f.v })));
    const motifs = (p) => p.evaluate(() => loadProgressionSections()[0].chords.map(d => SequenceurHarmo.motifActuel(d)));
    const cliquer = async (p, s, opt) => { await p.click(s, opt); await p.waitForTimeout(250); };
    const droit = async (p, s) => { await p.click(s, { button: 'right' }); await p.waitForTimeout(250); };

    // ======================================================================================================
    console.log('\n=== A. La barre tient sur UNE ligne, de 900 à 1920 px ===');
    let { p, ctx } = await ouvrir({ viewport: { width: 1440, height: 900 } });
    await p.close(); await ctx.close();
    for (const w of [900, 1024, 1280, 1440, 1920]) {
        ({ p, ctx } = await ouvrir({ viewport: { width: w, height: 900 } }));
        const m = await p.evaluate(() => { const o = document.querySelector('.sq-outils'), ob = o.getBoundingClientRect(); const dr = Math.max(...[...o.querySelectorAll(':scope > *, .sq-motifs > *')].filter(e => e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none').map(e => e.getBoundingClientRect().right)); return { h: Math.round(ob.height), deborde: Math.round(dr - ob.right) }; });
        check(m.h <= 52 && m.deborde <= 0, `${w} px : la barre fait ${m.h} px de haut (une seule ligne), rien ne dépasse à droite (${m.deborde} px)`);
        await p.close(); await ctx.close();
    }
    for (const [w, noms] of [[1280, false], [1339, false], [1340, true], [1440, true]]) {
        ({ p, ctx } = await ouvrir({ viewport: { width: w, height: 900 } }));
        const n = await p.evaluate(() => { const b = document.querySelector('#sq-motif-plaque > span:not(.sq-vignette)'); return b ? getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().width > 0 : false; });
        check(n === noms, `${w} px : ${noms ? 'les noms des rythmes sont écrits' : 'les noms des rythmes sont masqués (vignette seule, infobulle gardée)'}`);
        await p.close(); await ctx.close();
    }
    ({ p, ctx } = await ouvrir({ viewport: { width: 980, height: 900 } }));
    check(await visible(p, '#sq-motif-main') && await visible(p, '#sq-forme-enregistrer') && !await visible(p, '#sq-motif-plaque') && !await visible(p, '#sq-motif-pompe'), 'sous 1020 px, seuls « + » et le signet restent parmi les rythmes (les autres sont dans la popover du signet)');
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== B. « + » en premier, qui repart d\'un rythme vide ; vues Accord | Piano ; plus de portée ; intensité « mf » ===');
    ({ p, ctx } = await ouvrir({ viewport: { width: 1440, height: 900 } }));
    const ordre = await p.evaluate(() => [...document.querySelectorAll('.sq-motifs > .sq-motif')].map(b => b.dataset.sqMotif).join());
    check(ordre.startsWith('main,plaque,monte,descend,pompe,ballade'), `« + » est le premier des rythmes (${ordre})`);
    check(await p.evaluate(() => { const s = document.querySelector('#sq-motif-main .sq-nom-ordi'); return getComputedStyle(s).display !== 'none' && s.textContent === '+' && getComputedStyle(document.querySelector('#sq-motif-main .sq-nom-tel')).display === 'none'; }), 'il s\'appelle « + » (plus « À la main »)');
    check(await p.evaluate(() => document.getElementById('sq-motif-main').title.includes('rythme libre')), 'son infobulle dit ce qu\'il fait');
    check(await p.evaluate(() => window.app.selectedIndex) === null, 'aucun accord n\'est choisi');
    const avant = await R.lire(p, 0);
    exiger(avant.pos.some(x => x !== ''), 'l\'accord 1 a un rythme (plaqué) au départ');
    const u0 = await p.evaluate(() => window.app.undoStack.length);
    await cliquer(p, '#sq-motif-main');
    const apres = await R.lire(p, 0);
    check(await p.evaluate(() => window.app.selectedIndex) === 0, 'sans accord choisi, « + » choisit d\'abord l\'accord visé (jamais inerte)');
    check(apres.pos.every(x => x === '') && await p.evaluate(() => window.app.undoStack.length) === u0 + 1, 'puis vide son rythme, d\'UNE annulation');
    check(await p.evaluate(() => document.getElementById('sq-motif-main').getAttribute('aria-pressed')) === 'true', '« + » s\'allume');
    check((await motifs(p)).slice(1).every(m => m === 'plaque'), 'les autres accords n\'ont pas bougé');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
    check((await R.lire(p, 0)).pos.some(x => x !== ''), 'Ctrl+Z rend le rythme');
    const vues = await p.evaluate(() => ['sq-vue-voix', 'sq-vue-notes'].map(id => { const b = document.getElementById(id), o = b.querySelector('.sq-vue-ordi'); return { texte: o.textContent.trim(), svg: !!o.querySelector('svg'), tel: getComputedStyle(b.querySelector('.sq-vue-tel')).display }; }));
    check(vues[0].texte === 'Accord' && vues[1].texte === 'Piano' && vues.every(v => v.svg && v.tel === 'none'), `les vues s'appellent « Accord » et « Piano », avec un logo (${vues.map(v => v.texte).join(' | ')})`);
    check(await p.evaluate(() => getComputedStyle(document.querySelector('.sq-portee')).display) === 'none', 'plus de choix « Toute la partie | Cet accord » à l\'ordinateur');
    check(await p.evaluate(() => { const b = document.getElementById('sq-intensite'); return getComputedStyle(b.querySelector('.sq-ico-ordi')).display !== 'none' && b.querySelector('.sq-ico-ordi text').textContent === 'mf' && getComputedStyle(b.querySelector('.sq-ico-tel')).display === 'none'; }), 'l\'intensité porte le logo « mf »');
    // Un rythme n'agit que sur l'accord choisi.
    await cliquer(p, '#sq-motif-pompe');
    const m2 = await motifs(p);
    check(m2[0] === 'pompe' && m2.slice(1).every(m => m === 'plaque'), `« Pompe » ne change que l'accord choisi (${m2.join()})`);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);

    // ======================================================================================================
    console.log('\n=== C. Clic droit sur un rythme : un menu, plus de croix ===');
    check(await p.evaluate(() => document.querySelectorAll('.sq-forme-suppr, [data-sq-suppr]').length) === 0, 'aucune croix de suppression au survol des rythmes');
    await droit(p, '#sq-motif-pompe');
    let menu = await p.evaluate(() => { const m = document.getElementById('sq-menu-rythme'); return m.hidden ? null : [...m.querySelectorAll('button')].map(b => b.textContent.trim()); });
    check(JSON.stringify(menu) === '["Modifier ce schéma…","Masquer ce rythme"]', `un rythme fourni : Modifier ou Masquer (${JSON.stringify(menu)})`);
    await cliquer(p, '#sq-menu-rythme [data-a="modifier"]');
    check(await p.evaluate(() => !document.getElementById('sq-schema').hidden && document.getElementById('sq-menu-rythme').hidden), 'Modifier ouvre l\'éditeur du schéma, le menu se referme');
    await cliquer(p, '#sq-schema-annuler');
    await droit(p, '#sq-motif-pompe');
    await cliquer(p, '#sq-menu-rythme [data-a="masquer"]');
    check(!await visible(p, '#sq-motif-pompe') && await visible(p, '#sq-rythmes-retablir') && await p.evaluate(() => document.getElementById('sq-n-masques').textContent) === '1', 'Masquer retire « Pompe » de la barre ; « ↺ Rétablir (1) » apparaît');
    check(await p.evaluate(() => JSON.parse(localStorage.getItem('harmohubRythmesMasques')).join()) === 'pompe', 'retenu par appareil');
    await cliquer(p, '#sq-rythmes-retablir');
    check(await visible(p, '#sq-motif-pompe') && !await visible(p, '#sq-rythmes-retablir'), 'Rétablir ramène « Pompe », le bouton disparaît');
    await droit(p, '#sq-motif-main');
    menu = await p.evaluate(() => [...document.querySelectorAll('#sq-menu-rythme button')].map(b => b.textContent.trim()));
    check(JSON.stringify(menu) === '["Créer une forme…","Enregistrer la forme…"]', `sur « + » : Créer une forme, Enregistrer la forme (${JSON.stringify(menu)})`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    check(await p.evaluate(() => document.getElementById('sq-menu-rythme').hidden), 'Échap referme le menu');

    // ======================================================================================================
    console.log('\n=== D. Le signet : tous les rythmes, enregistrer une forme ===');
    await cliquer(p, '#sq-forme-enregistrer');
    let liste = await p.evaluate(() => { const b = document.getElementById('sq-biblio'); return b.hidden ? null : { noms: [...b.querySelectorAll('.bi-item[data-bi-id] .bi-nom')].map(x => x.textContent), actions: [...b.querySelectorAll('[data-bi-a]')].map(x => x.textContent.trim()), sec: !!b.querySelector('.bi-sec') }; });
    exiger(!!liste, 'le signet ouvre une popover');
    check(liste.noms.join() === 'Plaqué,Arpège ↑,Arpège ↓,Pompe,Ballade' && !liste.sec, `elle liste tous les rythmes (${liste.noms.join(', ')}), sans « Mes formes » tant qu'il n'y en a pas`);
    check(JSON.stringify(liste.actions) === '["＋ Enregistrer la forme…","＋ Créer une forme…"]', `et propose d'enregistrer ou de créer une forme (${JSON.stringify(liste.actions)})`);
    await cliquer(p, '#sq-biblio [data-bi-a="enregistrer"]');
    const champ = await p.evaluate(() => { const c = document.getElementById('sq-biblio-nom'); return c ? { v: c.value, titre: document.querySelector('#sq-biblio .bi-titre').textContent } : null; });
    check(champ && champ.v === 'Forme 1' && /Enregistrer la forme · Cmaj7/.test(champ.titre), `« Enregistrer la forme · Cmaj7 » : nom prérempli (« ${champ && champ.v} »)`);
    await p.fill('#sq-biblio-nom', 'Ma ballade'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
    const f1 = await formes(p);
    check(f1.length === 1 && f1[0].nom === 'Ma ballade' && f1[0].v.length === 4, `Entrée valide : la forme « Ma ballade » est enregistrée (${JSON.stringify(f1.map(f => f.nom))})`);
    check(await p.evaluate(() => document.getElementById('sq-biblio').hidden) && await visible(p, '#sq-formes .sq-motif'), 'la popover se referme, la forme est dans la barre');
    check((await motifs(p))[0] !== 'plaque' && await p.evaluate(() => document.querySelector('#sq-formes .sq-motif').getAttribute('aria-pressed')) === 'true', 'l\'accord dont on a pris la forme la suit (son bouton est allumé)');
    check(await p.evaluate(() => document.querySelectorAll('.sq-forme-suppr').length) === 0, 'toujours aucune croix');
    // Masquer un rythme fourni : il porte « masqué · afficher » dans la liste ; un clic le ramène et l'applique.
    await droit(p, '#sq-motif-ballade'); await cliquer(p, '#sq-menu-rythme [data-a="masquer"]');
    await cliquer(p, '#sq-forme-enregistrer');
    const ba = await p.evaluate(() => { const l = document.querySelector('#sq-biblio [data-bi-id="ballade"]'); return { etat: l.querySelector('.bi-etat').textContent, mes: !!document.querySelector('#sq-biblio .bi-sec') && document.querySelector('#sq-biblio .bi-sec').textContent }; });
    check(ba.etat === 'masqué · afficher' && ba.mes === 'Mes formes', `un rythme masqué dit « masqué · afficher », « Mes formes » annonce les formes (${ba.etat} / ${ba.mes})`);
    await cliquer(p, '#sq-biblio [data-bi-id="ballade"]');
    check(await visible(p, '#sq-motif-ballade') && (await motifs(p))[0] === 'ballade' && await p.evaluate(() => document.getElementById('sq-biblio').hidden), 'un clic dessus la ramène dans la barre, l\'applique à l\'accord choisi, referme la popover');
    // Supprimer une forme : confirmation dans le menu.
    await droit(p, '#sq-formes .sq-motif');
    menu = await p.evaluate(() => [...document.querySelectorAll('#sq-menu-rythme button')].map(b => b.textContent.trim()));
    check(JSON.stringify(menu) === '["Modifier ce schéma…","Supprimer cette forme"]', `une forme : Modifier ou Supprimer (${JSON.stringify(menu)})`);
    await cliquer(p, '#sq-menu-rythme [data-a="supprimer"]');
    check((await formes(p)).length === 1 && await p.evaluate(() => document.querySelector('#sq-menu-rythme [data-a="supprimer"]').textContent) === 'Confirmer la suppression', 'un premier clic ne supprime rien : il demande « Confirmer la suppression »');
    await cliquer(p, '#sq-menu-rythme [data-a="supprimer"]');
    check((await formes(p)).length === 0 && !await visible(p, '#sq-formes .sq-motif'), 'le second clic supprime la forme');

    // ======================================================================================================
    console.log('\n=== E. Créer une forme de zéro ===');
    await cliquer(p, '#sq-forme-enregistrer'); await cliquer(p, '#sq-biblio [data-bi-a="creer"]');
    let cr = await p.evaluate(() => ({ cases: document.querySelectorAll('#sq-biblio .bi-case').length, lignes: document.querySelector('#sq-biblio .bi-grille').dataset.lignes, nom: document.getElementById('sq-biblio-nom').value, seg: [...document.querySelectorAll('#sq-biblio [data-bi-lignes]')].map(b => b.textContent.trim() + ':' + b.getAttribute('aria-pressed')).join() }));
    check(cr.cases === 32 && cr.lignes === '4' && cr.nom === 'Forme 1' && cr.seg === 'Triade · 3:false,Tétrade · 4:true', `« Créer une forme » : choix Triade | Tétrade, grille de 8 croches sur 4 lignes, nom prérempli (${JSON.stringify(cr)})`);
    await cliquer(p, '#sq-biblio [data-bi-lignes="3"]');
    check(await p.evaluate(() => document.querySelectorAll('#sq-biblio .bi-case').length) === 24, 'Triade : trois lignes');
    const case3 = (pos, k) => `#sq-biblio .bi-case[data-bi-p="${pos}"][data-bi-k="${k}"]`;
    // Une croche à la basse (ligne du bas), un glissé d'une note tenue au milieu (croches 2 à 4), une croche à l'aiguë.
    await cliquer(p, case3(0, 0));
    const a = await (await p.locator(case3(1, 2)).boundingBox()), b = await (await p.locator(case3(1, 4)).boundingBox());
    await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await p.mouse.down(); await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(250);
    await cliquer(p, case3(2, 6));
    check(await p.evaluate(() => document.querySelectorAll('#sq-biblio .bi-case.on').length) === 5, 'un clic pose une croche, un glissé en peint une note tenue (1 + 3 + 1 croches allumées)');
    await cliquer(p, '#sq-biblio [data-bi-a="effacer"]');
    check(await p.evaluate(() => document.querySelectorAll('#sq-biblio .bi-case.on').length) === 0, 'Effacer vide la grille');
    await cliquer(p, case3(0, 0));
    const a2 = await p.locator(case3(1, 2)).boundingBox(), b2 = await p.locator(case3(1, 4)).boundingBox();
    await p.mouse.move(a2.x + a2.width / 2, a2.y + a2.height / 2); await p.mouse.down(); await p.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(250);
    await cliquer(p, case3(2, 6));
    await p.fill('#sq-biblio-nom', 'Triade perso');
    await cliquer(p, '#sq-biblio .bi-ok');
    const f2 = await formes(p);
    exiger(f2.length === 1 && f2[0].nom === 'Triade perso', `la forme est enregistrée (${JSON.stringify(f2.map(f => f.nom))})`);
    check(JSON.stringify(f2[0].v) === '[[0],[2,3,4],[2,3,4],[6]]', `écrite PAR POSITION, une triade ([L0, L1, L1, L2]) : ${JSON.stringify(f2[0].v)}`);
    check(await p.evaluate(() => document.getElementById('sq-biblio').hidden), 'la popover se referme');
    await cliquer(p, '#sq-forme-enregistrer'); await cliquer(p, '#sq-biblio [data-bi-a="creer"]');
    await cliquer(p, case3(3, 1));
    await cliquer(p, '#sq-biblio [data-bi-a="liste"]');
    check(await p.evaluate(() => !document.getElementById('sq-biblio').hidden && !!document.querySelector('#sq-biblio [data-bi-id]')), 'Annuler revient à la liste, sans créer');
    check((await formes(p)).length === 1, 'aucune forme de plus');
    await cliquer(p, '#sq-forme-enregistrer');
    check(await p.evaluate(() => document.getElementById('sq-biblio').hidden), 'le signet referme la popover ouverte (et elle ne le recouvre pas)');
    await p.mouse.click(700, 300);
    await droit(p, '#sq-motif-main'); await cliquer(p, '#sq-menu-rythme [data-a="creer"]');
    check(await p.evaluate(() => !!document.querySelector('#sq-biblio .bi-grille')), 'le clic droit sur « + » › « Créer une forme… » ouvre le même éditeur');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    check(await p.evaluate(() => document.getElementById('sq-biblio').hidden), 'Échap referme la popover');
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== E2. Beaucoup de formes : la barre reste sur une ligne, les autres sont dans le signet ===');
    // Douze formes enregistrées (le magasin des formes, comme le fait le signet) : la barre serre ses noms puis range les dernières dans la popover.
    ({ p, ctx } = await ouvrir({ viewport: { width: 1440, height: 900 } }));
    await p.evaluate(() => { for (let i = 1; i <= 12; i++) FormesSequenceur.enregistrer({ id: FormesSequenceur.nouvelId(), type: 'forme', nom: 'Forme numéro ' + i, v: [[0], [2], [4], [6]], s: [[], [], [], []], n: [{}, {}, {}, {}] }); });
    await p.waitForTimeout(500);
    const nb = await p.evaluate(() => { const o = document.querySelector('.sq-outils'), s = document.getElementById('sq-forme-enregistrer'), r = s.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { h: Math.round(o.getBoundingClientRect().height), dessus: !!top && (top === s || s.contains(top)), cachees: document.querySelectorAll('#sq-formes .sq-deborde').length, visibles: [...document.querySelectorAll('#sq-formes .sq-motif')].filter(b => b.getBoundingClientRect().width > 0).length, deborde: o.scrollWidth - o.clientWidth }; });
    check(nb.h <= 52 && nb.deborde <= 1 && nb.dessus, `douze formes : la barre reste sur une ligne (${nb.h} px), rien ne recouvre le signet`);
    check(nb.cachees > 0 && nb.visibles + nb.cachees === 12, `les dernières formes quittent la barre (${nb.visibles} visibles, ${nb.cachees} rangées dans le signet)`);
    await cliquer(p, '#sq-forme-enregistrer');
    check(await p.evaluate(() => document.querySelectorAll('#sq-biblio .bi-item[data-bi-id]').length) === 5 + 12, 'la popover du signet les liste toutes (5 rythmes fournis + 12 formes)');
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== F. La roue des réglages ===');
    ({ p, ctx } = await ouvrir({ viewport: { width: 1440, height: 900 } }));
    const pos = await p.evaluate(() => { const r = document.getElementById('sq-reglages').getBoundingClientRect(), f = document.getElementById('sq-fermer').getBoundingClientRect(); return { gauche: r.right <= f.left, h: r.height, svg: document.querySelector('#sq-reglages svg circle') !== null }; });
    check(pos.gauche && pos.h === 32 && pos.svg, 'la roue des Paramètres est à gauche de la croix, bouton de 32 px');
    await cliquer(p, '#sq-reglages');
    const comp = await p.evaluate(() => { const d = document.getElementById('sq-reglages-pop'); return d.hidden ? null : { titre: !!d.querySelector('h3.settings-group-title'), curseurs: d.querySelectorAll('.settings-slider-row').length, interrupteurs: d.querySelectorAll('.settings-toggle-row .switch').length, seg: [...d.querySelectorAll('[data-sq-contenu]')].map(b => b.textContent).join('|') }; });
    exiger(!!comp, 'la roue ouvre une popover');
    check(comp.titre && comp.curseurs === 2 && comp.interrupteurs === 2 && comp.seg === 'Rien|Notes|Degrés', `aux composants de Paramètres : deux curseurs, deux interrupteurs, « Barres : Rien | Notes | Degrés » (${JSON.stringify(comp)})`);
    await p.focus('#sq-r-hauteur');
    for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(200);
    check(Math.round(await p.evaluate(() => document.querySelector('#sq-grille .sq-case[data-r]').getBoundingClientRect().height)) === 36 && await p.evaluate(() => localStorage.getItem('harmohubSequenceurLigne')) === '36', 'le curseur de hauteur règle les barres (26 → 36 px), retenu par appareil');
    await cliquer(p, '#sq-r-auto');
    const auto = await p.evaluate(() => ({ h: Math.round(document.querySelector('#sq-grille .sq-case[data-r]').getBoundingClientRect().height), off: document.getElementById('sq-r-hauteur').disabled }));
    check(auto.off && auto.h === 48, `Auto : le curseur se fige et les barres s'adaptent (quatre lignes en vue Accord : ${auto.h} px)`);
    await cliquer(p, '#sq-vue-notes');
    const piano = await p.evaluate(() => ({ h: Math.round(document.querySelector('#sq-grille .sq-case[data-r]').getBoundingClientRect().height), nb: document.querySelectorAll('#sq-grille .sq-etiq').length }));
    check(piano.h < 48 && piano.nb > 6, `en vue Piano (${piano.nb} lignes), Auto rapetisse les barres (${piano.h} px)`);
    await cliquer(p, '#sq-vue-voix');
    await cliquer(p, '#sq-reglages');   // un clic ailleurs avait refermé la popover
    await cliquer(p, '#sq-r-auto');
    await p.focus('#sq-r-croche');
    for (let i = 0; i < 4; i++) await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(200);
    check(Math.round(await p.evaluate(() => document.querySelector('#sq-grille .sq-case[data-r="0"]').getBoundingClientRect().width)) === 42 && await p.evaluate(() => localStorage.getItem('harmohubSequenceurCroche')) === '42', 'le curseur de largeur règle les croches (34 → 42 px)');
    await cliquer(p, '[data-sq-contenu="degres"]');
    const deg = await p.evaluate(() => [...document.querySelectorAll('#sq-grille .sq-case.on[data-c="0"] .sq-note')].map(n => n.textContent.trim()).filter(Boolean));
    check(deg.sort().join() === '1,3,5,7', `Barres : Degrés écrit 1, 3, 5, 7 sur Cmaj7 (${deg.join()})`);
    await cliquer(p, '[data-sq-contenu="rien"]');
    check(await p.evaluate(() => [...document.querySelectorAll('#sq-grille .sq-case.on .sq-note')].every(n => n.textContent.trim() === '')), 'Barres : Rien n\'écrit rien');
    await cliquer(p, '[data-sq-contenu="notes"]');
    check(await p.evaluate(() => /^[A-G]/.test(document.querySelector('#sq-grille .sq-case.on .sq-note').textContent.trim())), 'Barres : Notes écrit le nom des notes');
    await cliquer(p, '#sq-r-regle');
    check(!await visible(p, '#sq-grille .sq-temps') && !await visible(p, '#sq-grille .sq-boucle'), 'Règle éteinte : la règle des temps disparaît');
    await p.reload(); await p.waitForFunction(() => !!window.app); await p.waitForTimeout(900);
    check(!await visible(p, '#sq-grille .sq-temps') && Math.round(await p.evaluate(() => document.querySelector('#sq-grille .sq-case[data-r="0"]').getBoundingClientRect().width)) === 42, 'tout cela est retenu après rechargement');
    await cliquer(p, '#sq-reglages'); await cliquer(p, '#sq-r-retablir');
    check(Math.round(await p.evaluate(() => document.querySelector('#sq-grille .sq-case[data-r="0"]').getBoundingClientRect().width)) === 34 && Math.round(await p.evaluate(() => document.querySelector('#sq-grille .sq-case[data-r]').getBoundingClientRect().height)) === 26 && await visible(p, '#sq-grille .sq-temps'), 'Rétablir : barres de 26 px, croches de 34 px, règle visible');
    await p.mouse.click(60, 300); await p.waitForTimeout(250);
    check(await p.evaluate(() => document.getElementById('sq-reglages-pop').hidden), 'un clic à côté referme la popover');
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== G. Paramètres › Affichage › Noms des rythmes ===');
    ({ p, ctx } = await ouvrir({ viewport: { width: 1440, height: 900 } }));
    await p.click('#open-settings'); await p.waitForTimeout(400);
    exiger(await p.evaluate(() => document.getElementById('toggle-noms-rythmes').getAttribute('aria-checked')) === 'true', 'l\'interrupteur existe, allumé à 1440 px (réglage par défaut : oui au-dessus de 1340 px)');
    await p.click('#toggle-noms-rythmes'); await p.waitForTimeout(250);
    await p.click('#settings-close'); await p.waitForTimeout(250);
    check(await p.evaluate(() => localStorage.getItem('harmohubNomsRythmes')) === '0' && !await visible(p, '#sq-motif-plaque > span:not(.sq-vignette)'), 'éteint : les noms disparaissent à 1440 px, retenu par appareil');
    await p.close(); await ctx.close();
    ({ p, ctx } = await ouvrir({ viewport: { width: 1100, height: 900 } }, { harmohubNomsRythmes: '1' }));
    check(await visible(p, '#sq-motif-plaque > span:not(.sq-vignette)') && await p.evaluate(() => { const l = [...document.querySelectorAll('.sq-motifs > .sq-motif')].filter(b => b.getBoundingClientRect().width > 0).map(b => b.getBoundingClientRect()); return l.every((r, i) => i === 0 || r.left >= l[i - 1].right - 1 || r.top >= l[i - 1].bottom - 1); }), 'allumé à 1100 px : les noms reviennent, et la barre passe à la ligne plutôt que de se chevaucher');
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== H. Le téléphone n\'a pas bougé ===');
    ({ p, ctx } = await ouvrir(TEL, {}));
    await p.tap('#bl-plus'); await p.waitForTimeout(400);
    await p.tap('#pl-notes'); await p.waitForTimeout(800);
    const tel = await p.evaluate(() => ({
        main: document.querySelector('#sq-motif-main .sq-nom-tel').textContent, mainOrdi: getComputedStyle(document.querySelector('#sq-motif-main .sq-nom-ordi')).display,
        voix: getComputedStyle(document.querySelector('#sq-vue-voix .sq-vue-tel')).display, portee: getComputedStyle(document.querySelector('.sq-portee')).display,
        roue: getComputedStyle(document.getElementById('sq-reglages')).display, mf: getComputedStyle(document.querySelector('#sq-intensite .sq-ico-ordi')).display, retab: document.getElementById('sq-rythmes-retablir').hidden,
    }));
    check(tel.main === 'À la main' && tel.mainOrdi === 'none' && tel.voix !== 'none' && tel.portee !== 'none', `au téléphone : « À la main », « Voix », le choix de portée sont là (${JSON.stringify(tel)})`);
    check(tel.roue === 'none' && tel.mf === 'none' && tel.retab, 'et ni la roue des réglages, ni le logo « mf », ni « Rétablir »');
    await p.close(); await ctx.close();

    check(erreurs.length === 0, `aucune erreur de page ni de console (${erreurs.slice(0, 3).join(' | ')})`);
    await nav.close();
    bilan();
})().catch(e => { console.log('FATAL ' + (e && e.stack || e)); process.exit(1); });
