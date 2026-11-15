// SÉQUENCEUR, L1c (14/11) — il montre LA LIGNE de la grille où se trouve l'accord choisi, avec de vrais gestes.
//
// CE QUE L'UTILISATEUR A DEMANDÉ (docs/decisions-13-14-11.md, lettres A3 et S) : « je ne sais pas lesquels il affiche dans la grille […] ce que ça va toucher » → un trait
// continu, lumineux, sous les cases que le séquenceur montre ; « je ne veux pas de séquenceur inerte » → sans accord choisi, tout reste actif et un bouton qui agit
// choisit d'abord l'accord visé ; changer de ligne sans recliquer (▲ ▼, d'une partie à l'autre) avec la sélection qui suit ; pendant la lecture, sans accord choisi, le
// séquenceur suit la ligne qui sonne.
//
// CE QUE LE BANC TIENT : les lignes montrées (au nombre de mesures de la Vue), le trait (position mesurée sur les cases), ▲ ▼ avec et sans sélection, les boutons qui
// choisissent d'abord, la lecture qui suit, la plage à boucler rognée à la ligne, et que le TÉLÉPHONE n'a pas bougé (toute la partie, ni flèches ni trait).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('séquenceur : la ligne de la grille');
const { estBruitReseau } = require('./_harness');
const V = require('./_verre_commun');

plan(43);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const mk = (r, q, b = 4) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
// Couplet : huit mesures (deux lignes de quatre) ; Refrain : trois mesures (une ligne).
const PARTIES = [
    { title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7'), mk('F', 'maj7'), mk('E', 'min7'), mk('A', 'min7'), mk('G', 'dom7')] },
    { title: 'Refrain', chords: [mk('F', 'maj7'), mk('G', 'dom7'), mk('C', 'maj7')] },
];
const TEL = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 };

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (contexte, reglages = { harmohubSequenceurOuvert: '1' }) => {
        const ctx = await nav.newContext(contexte);
        await ctx.addInitScript(([S, reglages]) => {
            if (sessionStorage.getItem('banc-sq-ligne')) return;
            sessionStorage.setItem('banc-sq-ligne', '1');
            localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
            localStorage.setItem('harmohubCurrentSongId', 's1');
            localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
            sessionStorage.setItem('cc_accueil_vu', '1');
            for (const k of Object.keys(reglages)) localStorage.setItem(k, reglages[k]);
        }, [PARTIES, reglages]);
        await ctx.route(/gstatic\.com|googleapis\.com|tonejs\.github\.io/, r => r.abort());
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !V.BRUIT.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.waitForFunction(() => !!window.app);
        await p.waitForTimeout(1000);
        return { p, ctx };
    };
    // Lecture de l'état (jamais pour agir).
    const etat = (p) => p.evaluate(() => {
        const sq = window.app.sequenceur, g = document.getElementById('sq-grille');
        return {
            montres: [...new Set([...g.querySelectorAll('.sq-nom')].map(e => +e.dataset.c))], partie: sq._s, accord: sq._i, sel: window.app.selectedIndex, actif: window.app.activeSection,
            txt: document.getElementById('sq-ligne-txt').textContent.trim(), nomVisible: getComputedStyle(document.querySelector('.sq-ligne-nom')).display !== 'none',
            prec: document.getElementById('sq-ligne-prec').disabled, suiv: document.getElementById('sq-ligne-suiv').disabled, val: document.getElementById('vue-mesures-val').textContent,
            traits: [...document.querySelectorAll('.sq-vu-trait')].map(t => t.parentElement.dataset.section),
        };
    });
    // Le trait et les cases de la ligne, mesurés à l'écran.
    const trait = (p, section, indexes) => p.evaluate(([section, indexes]) => {
        const t = document.querySelector('.sq-vu-trait');
        const g = document.querySelector(`#progression-sections .chord-grid[data-section="${section}"]`);
        const cases = indexes.map(i => g.querySelector(`.grid-cell[data-index="${i}"]`).getBoundingClientRect());
        const r = t.getBoundingClientRect();
        return { gauche: r.left - Math.min(...cases.map(c => c.left)), droite: Math.max(...cases.map(c => c.right)) - r.right, dessous: r.top - Math.max(...cases.map(c => c.bottom)), haut: Math.round(r.height), lumiere: getComputedStyle(t).boxShadow !== 'none', n: document.querySelectorAll('.sq-vu-trait').length };
    }, [section, indexes]);
    const caseGrille = (i, s = 0) => `#progression-sections .chord-grid[data-section="${s}"] .grid-cell[data-index="${i}"]`;
    // Un vrai clic au milieu d'une case de la grille (le coin porte le « + » d'insertion, la poignée de durée est sur les bords).
    const cliquerCase = async (p, i, s = 0) => { const b = await p.locator(caseGrille(i, s)).first().boundingBox(); await p.mouse.click(b.x + b.width / 2, b.y + b.height * 0.35); await p.waitForTimeout(350); };
    // Lever la sélection : un vrai clic à côté de la grille (marge gauche de la page), comme le fait l'utilisateur.
    const deselectionner = async (p) => { await p.mouse.click(60, 300); await p.waitForTimeout(400); };
    const vue = async (p, n) => {
        for (let k = 0; k < 9; k++) {
            const v = +(await p.locator('#vue-mesures-val').textContent());
            if (v === n) break;
            await p.click(v < n ? '#vue-mesures-plus' : '#vue-mesures-moins', { force: true }); await p.waitForTimeout(200);
        }
        await p.waitForTimeout(350);
    };

    // ======================================================================================================
    console.log('\n=== A. Le séquenceur montre la ligne de la grille ===');
    let { p, ctx } = await ouvrir({ viewport: { width: 1440, height: 900 } });
    let e = await etat(p);
    check(JSON.stringify(e.montres) === '[0,1,2,3]' && e.sel === null, `sans accord choisi, il montre la première ligne : accords ${e.montres} (pas toute la partie)`);
    check(e.txt === 'Couplet1/2' || e.txt === '1/2', `la barre d'outils dit la ligne : « ${e.txt} » (ligne 1 sur 2)`);
    check(e.prec && !e.suiv, 'la flèche ▲ est grisée sur la première ligne de la grille, ▼ ne l\'est pas');
    let t = await trait(p, 0, [0, 1, 2, 3]);
    check(t.n === 1 && JSON.stringify(e.traits) === '["0"]', 'un seul trait lumineux, dans la grille de la partie montrée');
    check(Math.abs(t.gauche - 4) <= 1.5 && Math.abs(t.droite - 4) <= 1.5 && t.dessous >= -4 && t.dessous <= 1 && t.haut === 3 && t.lumiere, `il court sous les quatre cases de la ligne (gauche ${t.gauche.toFixed(1)}, droite ${t.droite.toFixed(1)}, sous les cases ${t.dessous.toFixed(1)}, 3px, lumière)`);
    await cliquerCase(p, 5);
    e = await etat(p);
    check(e.sel === 5 && JSON.stringify(e.montres) === '[4,5,6,7]' && e.accord === 5, `choisir un accord de la 2e ligne : le séquenceur passe sur elle (accords ${e.montres})`);
    t = await trait(p, 0, [4, 5, 6, 7]);
    check(t.n === 1 && Math.abs(t.gauche - 4) <= 1.5 && Math.abs(t.droite - 4) <= 1.5 && t.dessous >= -4 && t.dessous <= 1, 'et le trait suit : sous la deuxième ligne de la grille');
    check(!e.prec && e.suiv === false, 'sur la 2e ligne, les deux flèches sont actives (une ligne avant, une partie après)');
    await vue(p, 3);
    e = await etat(p);
    check(e.val === '3' && JSON.stringify(e.montres) === '[3,4,5]' && e.accord === 5, `Vue 3 mes. : la ligne de l'accord 5 compte trois accords (${e.montres}) — le séquenceur montre les mesures de la Vue`);
    await vue(p, 8);
    e = await etat(p);
    check(JSON.stringify(e.montres) === '[0,1,2,3,4,5,6,7]', `Vue 8 mes. : toute la partie sur une ligne (${e.montres})`);
    t = await trait(p, 0, [0, 1, 2, 3, 4, 5, 6, 7]);
    check(t.n === 1 && Math.abs(t.gauche - 4) <= 1.5 && Math.abs(t.droite - 4) <= 1.5, 'le trait s\'étire sur les huit cases');
    await vue(p, 4);

    // ======================================================================================================
    console.log('\n=== B. ▲ ▼ : changer de ligne sans recliquer ===');
    await cliquerCase(p, 1);
    await p.waitForTimeout(2600);   // choisir un accord le fait sonner (quatre temps) : tant qu'il sonne, le séquenceur suit la lecture ; on attend la fin
    e = await etat(p);
    exiger(e.sel === 1 && JSON.stringify(e.montres) === '[0,1,2,3]', `l'accord 2 est choisi, ligne 1 (${e.montres})`);
    const annulations = await p.evaluate(() => window.app.undoStack.length), morceau = await p.evaluate(() => JSON.stringify(loadProgressionSections()));
    await p.click('#sq-ligne-suiv'); await p.waitForTimeout(400);
    e = await etat(p);
    check(e.sel === 5 && JSON.stringify(e.montres) === '[4,5,6,7]' && e.txt.endsWith('2/2'), `▼ avec un accord choisi : la sélection SUIT, même rang sur la ligne d'après (accord ${e.sel}, ${e.txt})`);
    await p.click('#sq-ligne-suiv'); await p.waitForTimeout(400);
    e = await etat(p);
    check(e.sel === 1 && e.actif === 1 && JSON.stringify(e.montres) === '[0,1,2]', `▼ au bout de la partie : on passe au Refrain, première ligne (partie ${e.actif}, accord ${e.sel}, accords ${e.montres})`);
    check(e.suiv && !e.prec, 'sur la dernière ligne de la dernière partie, ▼ est grisé (et reste visible)');
    check(await p.evaluate(() => { const b = document.getElementById('sq-ligne-suiv'); return b.getBoundingClientRect().width === 32 && b.getBoundingClientRect().height === 32 && getComputedStyle(b).opacity !== '0'; }), 'les deux flèches sont des boutons carrés de 32 px, visibles même grisés');
    await p.click('#sq-ligne-prec'); await p.waitForTimeout(400);
    e = await etat(p);
    check(e.actif === 0 && e.sel === 5 && JSON.stringify(e.montres) === '[4,5,6,7]', `▲ revient à la dernière ligne du Couplet (partie ${e.actif}, accord ${e.sel})`);
    check(await p.evaluate(() => window.app.undoStack.length) === annulations && await p.evaluate(() => JSON.stringify(loadProgressionSections())) === morceau, 'changer de ligne n\'écrit rien dans le morceau (pas d\'annulation déposée)');
    // Sans accord choisi : Échap désélectionne ; le séquenceur GARDE sa ligne, et les flèches ne changent que lui.
    await deselectionner(p);
    e = await etat(p);
    check(e.sel === null && JSON.stringify(e.montres) === '[4,5,6,7]', `désélectionner ne fait pas sauter le séquenceur : il reste sur sa ligne (accords ${e.montres})`);
    await p.click('#sq-ligne-prec'); await p.waitForTimeout(400);
    e = await etat(p);
    check(e.sel === null && JSON.stringify(e.montres) === '[0,1,2,3]', `▲ sans accord choisi : seul le séquenceur change de ligne, rien n'est choisi (accords ${e.montres})`);
    t = await trait(p, 0, [0, 1, 2, 3]);
    check(t.n === 1 && Math.abs(t.gauche - 4) <= 1.5, 'le trait a suivi dans la grille');

    // ======================================================================================================
    console.log('\n=== C. Jamais inerte ===');
    const vise1 = (await etat(p)).accord;
    await p.click('#sq-copier'); await p.waitForTimeout(400);
    e = await etat(p);
    check(vise1 !== null && e.sel === vise1, `« Copier » sans accord choisi choisit d'abord l'accord que le séquenceur vise (accord ${vise1}, choisi : ${e.sel})`);
    check(await p.evaluate(() => !!window.app.sequenceur.presse), 'et le rythme est bien copié');
    await deselectionner(p);
    await p.click('#sq-ligne-suiv'); await p.waitForTimeout(300);
    const vise2 = (await etat(p)).accord;
    const motifs = () => p.evaluate(() => loadProgressionSections()[0].chords.map(d => SequenceurHarmo.motifActuel(d)));
    const avant = await motifs();
    await p.click('#sq-motif-pompe'); await p.waitForTimeout(500);
    e = await etat(p);
    const apres = await motifs();
    check(e.sel === vise2, `un rythme (« Cet accord »), sans accord choisi, choisit d'abord l'accord visé (visé ${vise2}, choisi ${e.sel})`);
    check(apres[vise2] === 'pompe' && apres.every((m, i) => i === vise2 || m === avant[i]), `et il ne change que cet accord (avant ${avant.join()} ; après ${apres.join()})`);
    await deselectionner(p);
    const noteCase = await p.locator('#sq-grille .sq-case.on[data-c="6"]').first().boundingBox();
    await p.mouse.click(noteCase.x + noteCase.width / 2, noteCase.y + noteCase.height / 2); await p.waitForTimeout(400);
    e = await etat(p);
    check(e.sel === 6, `toucher une note choisit son accord (${e.sel})`);
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== D. La lecture ===');
    ({ p, ctx } = await ouvrir({ viewport: { width: 1440, height: 900 } }));
    await vue(p, 2);
    e = await etat(p);
    exiger(JSON.stringify(e.montres) === '[0,1]' && e.sel === null, `Vue 2 mes., rien de choisi : le séquenceur montre les accords 0 et 1 (${e.montres})`);
    await p.click('#play-prog');
    const suit = await p.waitForFunction(() => { const s = window.app.sequenceur; return s._s === 0 && s._montres.join() === '2,3'; }, null, { timeout: 14000 }).then(() => true, () => false);
    check(suit, 'sans accord choisi, il SUIT la ligne qui sonne : après deux mesures il passe aux accords 2 et 3');
    const trait2 = await etat(p);
    check(trait2.traits.length === 1 && trait2.sel === null, 'le trait suit aussi, et la lecture ne choisit aucun accord');
    await p.click('#stop'); await p.waitForTimeout(400);
    // Lancer la lecture lève la sélection (clic hors de la grille) : on choisit l'accord PENDANT la lecture, puis on laisse sonner plus de quatre secondes (l'accord 2 arrive).
    await p.click('#play-prog');
    await p.waitForTimeout(1200);
    await cliquerCase(p, 0);
    await p.waitForTimeout(5500);
    e = await etat(p);
    check(JSON.stringify(e.montres) === '[0,1]' && e.sel === 0, `avec un accord choisi il reste sur sa ligne pendant que la lecture avance (${e.montres})`);
    await p.click('#stop'); await p.waitForTimeout(300);
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== E. La plage à boucler est rognée à la ligne montrée ===');
    ({ p, ctx } = await ouvrir({ viewport: { width: 1440, height: 900 } }));
    // Une plage qui commence sur la première ligne et finit sur la seconde : accords 2 à 5 (posée comme le fait l'appli, dans l'état de la lecture en boucle).
    await p.evaluate(() => { window.app.loopRange = { startSection: 0, startIndex: 2, endSection: 0, endIndex: 5 }; window.app.sequenceur.rafraichir(); });
    await p.waitForTimeout(300);
    let boucle = await p.evaluate(() => { const b = document.querySelector('#sq-grille .sq-boucle'); return b ? b.style.gridColumn : null; });
    check(boucle !== null && !/NaN|undefined/.test(boucle), `ligne 1 : la bande orange couvre seulement les accords 2 et 3 (${boucle})`);
    await cliquerCase(p, 5);
    boucle = await p.evaluate(() => { const b = document.querySelector('#sq-grille .sq-boucle'); return b ? b.style.gridColumn : null; });
    check(boucle !== null && !/NaN|undefined/.test(boucle), `ligne 2 : elle couvre les accords 4 et 5 (${boucle})`);
    await p.evaluate(() => { window.app.loopRange = { startSection: 1, startIndex: 0, endSection: 1, endIndex: 1 }; window.app.sequenceur.rafraichir(); });
    check(await p.evaluate(() => !document.querySelector('#sq-grille .sq-boucle')), 'une plage dans une autre partie n\'a pas de bande ici');
    check(erreurs.length === 0, `aucune erreur de page (${erreurs.slice(0, 2).join(' | ')})`);
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== G. Fenêtre étroite : le séquenceur défile de côté, la poignée reste atteignable ===');
    // À 980 px la Vue porte 8 mesures (⌊(980 − 78) / 112⌋) ; la grille entière (étiquettes, poignée de largeur, marges) en demande 22 px de plus : le séquenceur défile.
    ({ p, ctx } = await ouvrir({ viewport: { width: 980, height: 800 } }));
    await vue(p, 8);
    let defile = await p.evaluate(() => { const r = document.getElementById('sequenceur'); return { trop: r.scrollWidth - r.clientWidth, overflowX: getComputedStyle(r).overflowX, croches: document.querySelectorAll('#sq-grille .sq-case[data-r="0"]').length }; });
    exiger(defile.croches === 64 && defile.trop > 0, `à 980 px, 8 mesures par ligne : le séquenceur déborde de ${defile.trop}px (${defile.croches} croches)`);
    check(defile.overflowX === 'auto', 'il défile de côté (overflow-x: auto) au lieu de rogner');
    const place = () => p.evaluate(() => { const rb = document.getElementById('sequenceur').getBoundingClientRect(); return { outils: document.querySelector('.sq-outils').getBoundingClientRect().left - rb.left, etiq: document.querySelector('#sq-grille .sq-etiq').getBoundingClientRect().left - rb.left, croche: document.querySelector('#sq-grille .sq-case[data-r="0"]').getBoundingClientRect().left - rb.left }; });
    const avantDefile = await place();
    const sq = await p.locator('#sequenceur').boundingBox();
    await p.mouse.move(sq.x + 500, sq.y + 150); await p.mouse.wheel(60, 0); await p.waitForTimeout(400);
    const decale = await p.evaluate(() => {
        const r = document.getElementById('sequenceur'), rb = r.getBoundingClientRect(), h = document.querySelector('.sq-poignee-largeur').getBoundingClientRect();
        return { defile: r.scrollLeft, poigneeDroite: h.right - rb.right };
    });
    const apresDefile = await place();
    check(decale.defile > 0, `un coup de molette horizontale fait défiler le séquenceur (${decale.defile}px)`);
    check(Math.abs(apresDefile.outils - avantDefile.outils) <= 1 && Math.abs(apresDefile.etiq - avantDefile.etiq) <= 1 && apresDefile.croche < avantDefile.croche - 1, `la barre d'outils et les noms de notes restent collés à gauche pendant que les croches défilent (outils ${avantDefile.outils.toFixed(0)} → ${apresDefile.outils.toFixed(0)}, noms ${avantDefile.etiq.toFixed(0)} → ${apresDefile.etiq.toFixed(0)}, croches ${avantDefile.croche.toFixed(0)} → ${apresDefile.croche.toFixed(0)})`);
    check(decale.poigneeDroite <= 1, `et la poignée de largeur est entière dans la fenêtre (${decale.poigneeDroite.toFixed(1)}px de dépassement)`);
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== F. Le téléphone n\'a pas bougé ===');
    ({ p, ctx } = await ouvrir(TEL, {}));
    await p.tap('#bl-plus'); await p.waitForTimeout(400);
    await p.tap('#pl-notes'); await p.waitForTimeout(800);
    const tel = await p.evaluate(() => ({ dans: document.getElementById('sequenceur').parentElement.id, flechesCachees: getComputedStyle(document.querySelector('.sq-ligne')).display === 'none', traits: document.querySelectorAll('.sq-vu-trait').length, noms: document.querySelectorAll('#sq-grille .sq-nom').length, montres: window.app.sequenceur._montres.length }));
    exiger(tel.dans === 'pa-rythme', `au téléphone le séquenceur est dans le panneau d'accord (${tel.dans})`);
    check(tel.flechesCachees && tel.traits === 0, 'ni flèches de ligne ni trait lumineux');
    check(tel.noms === 8 && tel.montres === 8, `il montre toute la partie, comme avant (${tel.noms} accords)`);
    await p.close(); await ctx.close();

    check(erreurs.length === 0, `aucune erreur de page ni de console (${erreurs.slice(0, 3).join(' | ')})`);
    await nav.close();
    bilan();
})().catch(e => { console.log('FATAL ' + (e && e.stack || e)); process.exit(1); });
