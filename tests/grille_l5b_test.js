// L5b — RANGÉE DE RÉGLAGES ET GRILLE : bouton Séquenceur, saisie rapide non permanente, « + Section », poignées unifiées (refonte, lettres D et L des décisions des 13 et 14/11).
//
// CE QUE DEMANDE L'UTILISATEUR (docs/decisions-13-14-11.md) :
//   - le bouton « Séquenceur » à l'extrémité droite de la rangée de réglages, AVEC son nom, bordé de vert, plein vert quand le séquenceur est ouvert ; il quitte le bloc « Vues »
//     de la barre de lecture (qui garde Clavier / Guitare) ; logo seul sous 1181 px comme « Voicing », 12 px d'écart entre les deux ;
//   - la barre « Ajout rapide » n'est plus permanente : elle s'ouvre avec le panneau d'ajout (« + Accord »), et se referme avec lui ;
//   - « Ajouter section » : un mince bandeau en pointillés, TOUJOURS visible sous la dernière partie (collé en bas quand la liste est longue), plus un clic droit dans le vide de la grille ;
//   - les poignées (bord droit et bas de la grille, haut du séquenceur, haut du tiroir) ont UNE forme : trait fin de 4 px au repos, languette de 10 px bleue aux trois points au survol
//     et en tirant, centrées sur le bord qu'elles déplacent.
// CE QUE LE BANC TIENT : de vrais gestes (clics, clic droit, glissés à la souris), l'état relu dans la page ; le téléphone n'a pas bougé.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('rangée de réglages et grille, L5b');
const { estBruitReseau } = require('./_harness');

plan(64);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, b = 4) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const S = [
        { title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] },
        { title: 'Refrain', chords: [mk('F', 'maj7'), mk('E', 'min7')] },
    ];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (width, height = 800) => {
        const p = await nav.newPage({ viewport: { width, height } });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const rect = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; }, sel);
    const nbParties = (p) => p.evaluate(() => loadProgressionSections().length);
    const pseudo = (p, sel) => p.evaluate((s) => { const c = getComputedStyle(document.querySelector(s), '::after'); return { w: parseFloat(c.width), h: parseFloat(c.height), fond: c.backgroundColor }; }, sel);
    const survoler = async (p, sel) => { const b = await p.locator(sel).boundingBox(); await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.waitForTimeout(350); };
    const quitter = async (p) => { await p.mouse.move(8, 400); await p.waitForTimeout(350); };

    // ======================================================================================================
    console.log('\n=== A. Le bouton « Séquenceur » : à l\'extrémité droite, avec son nom, vert ===');
    let p = await ouvrir(1440);
    const pos = await p.evaluate(() => {
        const b = document.getElementById('vue-sequenceur');
        return { dansEntete: !!b.closest('.grid-head-sticky'), dansBarre: !!b.closest('#bl-vues'), vuesGardent: !!document.querySelector('#bl-vues #toggle-viz-guitar') && !!document.querySelector('#bl-vues #toggle-viz-piano'),
            nom: b.querySelector('.vue-sequenceur-nom').getBoundingClientRect().width > 0, bord: getComputedStyle(b).borderTopColor, couleur: getComputedStyle(b).color, fond: getComputedStyle(b).backgroundImage };
    });
    check(pos.dansEntete && !pos.dansBarre, 'il est dans l\'en-tête de la grille, plus dans le bloc « Vues » de la barre de lecture');
    check(pos.vuesGardent, 'le bloc « Vues » garde Clavier et Guitare');
    check(pos.nom, 'il porte son nom « Séquenceur » à côté du logo (1440 px)');
    check((() => { const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(pos.bord); return !!m && +m[2] > +m[1] + 20 && +m[2] > +m[3] + 10; })(), `bordé de vert (${pos.bord})`);
    check(pos.fond === 'none', 'fermé, il n\'a pas de fond plein');
    const rs = await rect(p, '#vue-sequenceur'), rv = await rect(p, '#voicing-btn'), rt = await rect(p, '.grid-head-sticky');
    check(rs.h === 32 && rs.w >= 124, `à la jauge : 32 px de haut, large de ${Math.round(rs.w)} px`);
    check(Math.abs(rv.x - rs.r - 12) <= 1, `12 px d'écart avec « Voicing » (${Math.round(rv.x - rs.r)} px)`);
    check(rv.r <= rt.r && rt.r - rv.r < 40, `ils sont tous deux à l'extrémité droite de l'en-tête (reste ${Math.round(rt.r - rv.r)} px)`);
    await p.click('#vue-sequenceur'); await p.waitForTimeout(500);
    const ouvert = await p.evaluate(() => { const b = document.getElementById('vue-sequenceur'); return { seq: !document.getElementById('sequenceur').hidden, presse: b.getAttribute('aria-pressed'), fond: getComputedStyle(b).backgroundImage }; });
    exiger(ouvert.seq && ouvert.presse === 'true', 'un vrai clic ouvre le séquenceur (bouton enfoncé)');
    check(/linear-gradient/.test(ouvert.fond), 'ouvert, il est plein vert (dégradé de la famille verte)');
    await p.click('#vue-sequenceur'); await p.waitForTimeout(400);
    check(await p.evaluate(() => document.getElementById('sequenceur').hidden && document.getElementById('vue-sequenceur').getAttribute('aria-pressed') === 'false'), 'un second clic le referme');
    await p.close();
    p = await ouvrir(1180);
    const etroit = await p.evaluate(() => ({ nom: document.querySelector('.vue-sequenceur-nom').getBoundingClientRect().width, w: document.getElementById('vue-sequenceur').getBoundingClientRect().width,
        ecart: document.getElementById('voicing-btn').getBoundingClientRect().left - document.getElementById('vue-sequenceur').getBoundingClientRect().right }));
    check(etroit.nom === 0 && etroit.w === 32, `à 1180 px : le logo seul, carré de 32 px (${etroit.w} px)`);
    check(Math.abs(etroit.ecart - 12) <= 1, `et toujours 12 px d'écart avec « Voicing » (${Math.round(etroit.ecart)} px)`);
    await p.close();

    // ======================================================================================================
    console.log('\n=== B. La saisie « Ajout rapide » s\'ouvre avec le panneau et s\'en va avec lui ===');
    p = await ouvrir(1440);
    const largeurSaisie = () => p.evaluate(() => Math.round(document.getElementById('quick-add-input').getBoundingClientRect().width));
    check(await largeurSaisie() === 0, 'au repos : plus de barre « Ajout rapide » sous l\'en-tête');
    const calme = await p.evaluate(() => ({ haut: Math.round(document.getElementById('quick-add-panel').getBoundingClientRect().height), grille: Math.round(document.getElementById('progression-sections').getBoundingClientRect().top), tete: Math.round(document.querySelector('.grid-head-sticky').getBoundingClientRect().bottom) }));
    check(calme.haut === 0 && calme.grille - calme.tete <= 12, `et elle ne laisse aucun vide : la grille suit l'en-tête (${calme.grille - calme.tete} px d'écart)`);
    await p.evaluate(() => window.app.ouvrirAideAjout(0, null)); await p.waitForTimeout(350); // L6c : « + Accord » n'existe plus ; le panneau d'ajout s'ouvre aussi par le « + » entre deux cases
    check(await largeurSaisie() > 300, 'le panneau d\'ajout s\'ouvre : la saisie apparaît, en pleine largeur');
    check(await p.evaluate(() => document.activeElement && document.activeElement.id === 'quick-add-input'), 'et le curseur y est, prêt à taper');
    await p.keyboard.type('F6'); await p.keyboard.press('Control+Enter'); await p.waitForTimeout(400);
    check(await p.evaluate(() => loadProgressionSections()[0].chords.map(c => c.root + ':' + c.quality).join(' ')) === 'C:maj7 A:min7 D:min7 G:dom7 F:6', 'elle fait toujours son travail (F6, Ctrl+Entrée) : l\'accord est ajouté');
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    check(await largeurSaisie() === 0, 'Échap referme le panneau, la saisie s\'en va avec lui');
    await p.close();

    // ======================================================================================================
    console.log('\n=== C. « + Section » : un bandeau en pointillés, toujours visible ===');
    p = await ouvrir(1440, 700);
    const bande = await p.evaluate(() => {
        const b = document.getElementById('add-section'), r = b.getBoundingClientRect(), c = getComputedStyle(b), cadre = document.getElementById('grille-cadre').getBoundingClientRect(), sec = document.querySelector('#progression-sections').getBoundingClientRect();
        return { style: c.borderTopStyle, pos: c.position, fond: c.backgroundImage, h: Math.round(r.height), w: Math.round(r.width), cadreW: Math.round(cadre.width), haut: r.top, visible: r.top >= 0 && r.bottom <= window.innerHeight, texte: b.textContent.trim(), sous: r.top >= sec.bottom, couleur: c.color };
    });
    check(bande.style === 'dashed' && bande.fond === 'none', `en pointillés, sans aplat vert (${bande.style}, fond ${bande.fond})`);
    check(bande.visible && bande.sous, `toujours visible, sous la dernière partie (à ${Math.round(bande.haut)} px du haut)`);
    check(bande.h === 32 && Math.abs(bande.w - (bande.cadreW - 10)) <= 2, `un bandeau de la largeur de la grille (${bande.w} px, 32 px de haut)`);
    check(/Ajouter/.test(bande.texte), `il dit « ${bande.texte} »`);
    check(bande.pos === 'sticky', 'collé en bas de la zone quand la liste des parties est longue');
    await p.click('#add-section'); await p.waitForTimeout(300);
    check(await nbParties(p) === 3, 'un clic ajoute une partie');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
    check(await nbParties(p) === 2, 'un Ctrl+Z la retire');
    for (let i = 0; i < 7; i++) { await p.click('#add-section'); await p.waitForTimeout(150); }
    const long = await p.evaluate(() => { const r = document.getElementById('add-section').getBoundingClientRect(), t = document.querySelector('.grid-head-sticky').getBoundingClientRect(); return { n: loadProgressionSections().length, visible: r.top >= t.bottom - 1 && r.bottom <= window.innerHeight, bas: Math.round(window.innerHeight - r.bottom) }; });
    check(long.n === 9 && long.visible, `neuf parties, plus haut que l'écran : le bandeau reste visible, collé en bas (${long.bas} px du bord)`);
    await p.close();

    console.log('\n=== C2. Le clic droit dans le vide de la grille ===');
    p = await ouvrir(1440);
    const menuVide = () => p.evaluate(() => { const m = document.getElementById('grille-vide-menu'); return !m.hidden && m.getBoundingClientRect().width > 0 ? { items: [...m.querySelectorAll('.tb-mi')].map(b => b.textContent.trim()), x: m.getBoundingClientRect().left, y: m.getBoundingClientRect().top } : null; });
    await p.mouse.click(300, 300, { button: 'right' }); await p.waitForTimeout(250);
    let mv = await menuVide();
    exiger(!!mv, 'un clic droit à côté de la grille ouvre un petit menu');
    check(JSON.stringify(mv.items) === '["Ajouter une section"]', `un seul article : ${JSON.stringify(mv.items)}`);
    check(Math.abs(mv.x - 300) <= 12 && Math.abs(mv.y - 300) <= 12, `posé sous le pointeur (${Math.round(mv.x)}, ${Math.round(mv.y)})`);
    check(await p.evaluate(() => document.getElementById('context-menu').hidden), 'le menu des accords, lui, reste fermé');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    check(await menuVide() === null, 'Échap le referme');
    await p.mouse.click(300, 300, { button: 'right' }); await p.waitForTimeout(250);
    await p.mouse.click(120, 500); await p.waitForTimeout(250);
    check(await menuVide() === null, 'un clic à côté le referme aussi');
    await p.mouse.click(300, 300, { button: 'right' }); await p.waitForTimeout(250);
    await p.click('#gvm-section'); await p.waitForTimeout(350);
    check(await nbParties(p) === 3 && await menuVide() === null, 'l\'article ajoute une partie et le menu se referme');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
    check(await nbParties(p) === 2, 'un Ctrl+Z la retire');
    // Sur une case : le menu des accords, pas celui du vide.
    const cell = await p.locator('#progression-sections .grid-cell[data-index="1"]').first().boundingBox();
    await p.mouse.click(cell.x + cell.width / 2, cell.y + cell.height / 2, { button: 'right' }); await p.waitForTimeout(250);
    check(await p.evaluate(() => !document.getElementById('context-menu').hidden) && await menuVide() === null, 'sur une case, c\'est le menu de l\'accord qui s\'ouvre, pas celui du vide');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await p.close();

    // ======================================================================================================
    console.log('\n=== D. Les poignées ont UNE forme : trait fin, languette bleue au survol, centrées sur leur bord ===');
    p = await ouvrir(1440);
    await p.click('#vue-sequenceur'); await p.waitForTimeout(500);
    const repos = { bas: await pseudo(p, '#grille-poignee-bas'), droite: await pseudo(p, '#grille-poignee-droite'), sq: await pseudo(p, '#sq-poignee'), vues: await pseudo(p, '#vues-poignee') };
    check(repos.bas.h === 4 && repos.bas.w === 72, `bas de la grille, au repos : 72 × 4 px (${repos.bas.w} × ${repos.bas.h})`);
    check(repos.droite.w === 4 && repos.droite.h === 72, `bord droit de la grille, au repos : 4 × 72 px (${repos.droite.w} × ${repos.droite.h})`);
    check(repos.sq.h === 4 && repos.sq.w === 60, `haut du séquenceur, au repos : 60 × 4 px (${repos.sq.w} × ${repos.sq.h})`);
    check(repos.vues.h === 4 && repos.vues.w === 60, `haut du tiroir, au repos : 60 × 4 px (${repos.vues.w} × ${repos.vues.h})`);
    check([repos.bas, repos.droite, repos.sq, repos.vues].every(r => r.fond === 'rgb(42, 47, 54)'), 'le même gris à peine plus clair que le fond, partout');
    for (const [nom, sel, dim] of [['bas de la grille', '#grille-poignee-bas', 'h'], ['bord droit de la grille', '#grille-poignee-droite', 'w'], ['haut du séquenceur', '#sq-poignee', 'h'], ['haut du tiroir', '#vues-poignee', 'h']]) {
        await survoler(p, sel);
        const s = await pseudo(p, sel);
        check(s[dim] === 10 && s.fond === 'rgb(37, 55, 77)', `${nom}, au survol : languette de 10 px, bleue (${s[dim]} px, ${s.fond})`);
        await quitter(p);
        check((await pseudo(p, sel))[dim] === 4, `${nom} : la souris partie, elle redevient un trait de 4 px`);
    }
    // Centrées sur le bord qu'elles déplacent.
    const bord = await p.evaluate(() => { const ps = [...document.querySelectorAll('#progression-sections > *')]; const dern = ps[ps.length - 1].getBoundingClientRect(), sec = document.querySelector('#progression-sections').getBoundingClientRect(); return { bas: dern.bottom, droite: Math.max(...ps.map(x => x.getBoundingClientRect().right)), secDroite: sec.right }; });
    const hb = await rect(p, '#grille-poignee-bas'), hd = await rect(p, '#grille-poignee-droite');
    check(Math.abs((hb.y + hb.h / 2) - bord.bas - 6) <= 1, `la poignée du bas est à 6 px sous la dernière partie (${Math.round(hb.y + hb.h / 2 - bord.bas)} px)`);
    check(Math.abs((hd.x + hd.w / 2) - bord.droite) <= 1, `celle de droite est centrée sur le bord de la grille (${Math.round(hd.x + hd.w / 2 - bord.droite)} px)`);
    const bandeau = await rect(p, '#add-section');
    check(bandeau.y >= hb.b - 1, `le bandeau « + Section » est SOUS la poignée du bas (bandeau ${JSON.stringify(bandeau)}, poignée ${JSON.stringify(hb)})`);
    // On les tire vraiment : la poignée de largeur de la grille, celle du bas, celle du séquenceur, celle du tiroir.
    const l0 = (await rect(p, '#grille-cadre')).w;
    let b = await p.locator('#grille-poignee-droite').boundingBox();
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down();
    await p.mouse.move(b.x + b.width / 2 + 40, b.y + b.height / 2, { steps: 5 });
    check(await p.evaluate(() => document.getElementById('grille-poignee-droite').classList.contains('en-cours')), 'tirée, la poignée de droite reste allumée');
    await p.mouse.up(); await p.waitForTimeout(250);
    check((await rect(p, '#grille-cadre')).w > l0 + 20, `tirer la poignée de droite élargit la grille (${Math.round(l0)} → ${Math.round((await rect(p, '#grille-cadre')).w)} px)`);
    const h0 = (await rect(p, '#progression-sections .grid-cell')).h;
    b = await p.locator('#grille-poignee-bas').boundingBox();
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down();
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 40, { steps: 5 });
    await p.mouse.up(); await p.waitForTimeout(250);
    check((await rect(p, '#progression-sections .grid-cell')).h > h0 + 10, `tirer la poignée du bas agrandit les cases (${Math.round(h0)} → ${Math.round((await rect(p, '#progression-sections .grid-cell')).h)} px)`);
    for (const [nom, sel] of [['du séquenceur', '#sq-poignee'], ['du tiroir', '#vues-poignee']]) {
        b = await p.locator(sel).boundingBox();
        await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down();
        await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2 - 30, { steps: 4 });
        const en = await p.evaluate((s) => document.querySelector(s).classList.contains('tire'), sel);
        await p.mouse.up(); await p.waitForTimeout(250);
        const apres = await p.evaluate((s) => document.querySelector(s).classList.contains('tire'), sel);
        check(en && !apres, `la poignée ${nom} reste allumée pendant qu'on tire, et s'éteint au relâchement`);
        await quitter(p);
    }
    await p.close();

    // ======================================================================================================
    console.log('\n=== E. Le téléphone n\'a pas bougé (lot 7) ===');
    p = await ouvrir(390, 844);
    const tel = await p.evaluate(() => ({
        seq: getComputedStyle(document.getElementById('vue-sequenceur')).display,
        bande: getComputedStyle(document.getElementById('add-section')).borderTopStyle, pos: getComputedStyle(document.getElementById('add-section')).position,
        poignee: Math.round(document.getElementById('grille-poignee-bas').getBoundingClientRect().height),
        saisie: getComputedStyle(document.querySelector('#quick-add-panel > .quick-add-row')).display,
    }));
    check(tel.seq === 'none', 'le bouton Séquenceur n\'existe pas au téléphone (il est dans le panneau d\'accord)');
    // L7d (15/11) : au téléphone « + Section » est un petit bouton gris en pointillés (sobre comme à l'ordinateur) sous la dernière partie, mais il n'y est pas COLLÉ en bas (position non sticky).
    check(tel.bande === 'dashed' && tel.pos !== 'sticky', `« + Section » est un petit bouton en pointillés, non collé en bas (${tel.bande}, ${tel.pos})`);
    check(tel.poignee === 0, 'pas de poignée de grille');
    check(tel.saisie === 'none', 'la saisie rapide n\'est pas dans la page (elle est dans le panneau d\'ajout, comme avant)');
    await p.click('#progression-sections .prog-section-ajout[data-section="0"]'); await p.waitForTimeout(500);   // L7d : « + Accord » de l'en-tête (le « + » nu n'existe plus au téléphone)
    check(await p.evaluate(() => { const i = document.querySelector('#aa-saisie #quick-add-input'); return !!i && i.getBoundingClientRect().width > 0; }), 'la case « + » ouvre le panneau d\'ajout, qui porte la saisie, comme avant');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await p.mouse.click(200, 520, { button: 'right' }); await p.waitForTimeout(250);
    check(await p.evaluate(() => document.getElementById('grille-vide-menu').hidden), 'le clic droit dans le vide n\'ouvre rien au téléphone');
    await p.close();

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length ? erreurs.join(' | ') : 'aucune'})`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
