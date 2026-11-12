// UN CLIC SUR UN ACCORD = L'ÉCOUTER ; DOUBLE-CLIC (OU TOUCHER UNE CASE DÉJÀ CHOISIE) = L'OUVRIR (refonte du séquenceur, point B, 11/11), avec de vrais gestes.
//
// LA DEMANDE : « cliquer un accord ne doit pas forcément ouvrir le panneau : parfois on veut seulement entendre l'accord ». Décision du 11/11 (option A, planche 4
// de la maquette) : « un clic ou un toucher : la case est sélectionnée (bleu) et l'accord est joué. Rien ne s'ouvre. Double-clic, ou toucher une case déjà
// sélectionnée : ouvre le panneau de l'accord (bulle à l'ordinateur, panneau du bas au téléphone). Échap ou clic à côté referme ; la sélection reste. »
//
// CE QUE LE BANC TIENT : à l'ordinateur, un clic sélectionne et fait entendre sans rien ouvrir (ni bulle, ni inspecteur, ni modification), même recliqué ; le
// double-clic ouvre la bulle sur cet accord (sans retaper le nom) ; Échap et le clic à côté la referment, la sélection reste ; ouverte, elle suit un clic sur
// une autre case ; le renommage passe par « Renommer » au clic droit, ou par une lettre tapée ; au téléphone, un toucher choisit et fait entendre sans ouvrir
// ni faire défiler, un second toucher (lent ou rapide) ouvre le panneau, Échap le ferme en gardant la sélection, ouvert il suit un toucher sur une autre case,
// et l'appui long propose « Renommer ».
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('clic = écouter, double-clic = ouvrir');
const { estBruitReseau } = require('./_harness');

plan(31);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, b = 4) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const S = [
        { title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] },
        { title: 'Refrain', chords: [mk('F', 'maj7'), mk('E', 'min7'), mk('A', 'min7'), mk('D', 'dom7')] },
    ];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport, tactile = false) => {
        const ctx = await nav.newContext({ viewport, hasTouch: tactile, isMobile: tactile });
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(1000);
        // On compte les écoutes (relu, jamais déclenché) : selectChord fait entendre l'accord par playSavedChord.
        await p.evaluate(() => { window.__ecoutes = 0; const o = window.app.playSavedChord.bind(window.app); window.app.playSavedChord = (...a) => { window.__ecoutes++; return o(...a); }; });
        return p;
    };
    const caseSel = (s, i) => `#progression-sections .grid-cell[data-section="${s}"][data-index="${i}"]`;
    const centre = async (p, s, i) => { const b = await p.locator(caseSel(s, i)).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    const etat = (p) => p.evaluate(() => ({
        sel: window.app.selectedIndex, section: window.app.activeSection, ecoutes: window.__ecoutes, edition: window.app.editingIndex, y: Math.round(scrollY),
        bulle: !document.getElementById('bulle-accord').hidden && document.getElementById('bulle-accord').getBoundingClientRect().height > 0,
        bulleIndex: window.app._bulle ? window.app._bulle.index : null,
        panneau: !document.getElementById('panneau-accord').hidden && document.getElementById('panneau-accord').getBoundingClientRect().height > 0,
        etendu: !!(window.app._bulle && window.app._bulle.etendu),
        inspecteur: document.querySelector('.sidebar-frame').getBoundingClientRect().width > 0,
        retape: !!document.querySelector('#progression-sections .grid-cell:not(.grid-cell-add) input'),
        bleue: !!document.querySelector('#progression-sections .grid-cell.selected'),
    }));

    // ======================================================================================================
    console.log('\n=== A. Ordinateur : un clic = entendre, rien ne s\'ouvre ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    let c = await centre(p, 0, 1);
    await p.mouse.click(c.x, c.y); await p.waitForTimeout(700);
    let e = await etat(p);
    exiger(e.sel === 1 && e.section === 0, 'le clic sélectionne l\'accord');
    check(e.bleue, 'la case est en bleu (sélection)');
    check(e.ecoutes === 1, `et on l'entend (${e.ecoutes} écoute)`);
    check(!e.bulle && !e.inspecteur && e.edition == null, 'rien ne s\'ouvre : ni bulle, ni inspecteur, pas de modification');
    await p.waitForTimeout(500);
    await p.mouse.click(c.x, c.y); await p.waitForTimeout(700);
    e = await etat(p);
    check(!e.bulle && e.ecoutes === 2, `recliquer la case choisie la fait réentendre, sans rien ouvrir (${e.ecoutes} écoutes)`);

    console.log('\n=== B. Ordinateur : double-clic = ouvrir la bulle ===');
    c = await centre(p, 1, 2);
    await p.mouse.dblclick(c.x, c.y); await p.waitForTimeout(700);
    e = await etat(p);
    exiger(e.bulle && e.bulleIndex === 2 && e.section === 1, 'le double-clic ouvre la bulle de cet accord');
    check(!e.retape, 'le double-clic ne retape plus le nom');
    check(e.ecoutes === 3, `l'accord ne sonne qu'une fois pour un double-clic (${e.ecoutes} écoutes en tout)`);
    c = await centre(p, 1, 3);
    await p.mouse.click(c.x, c.y); await p.waitForTimeout(700);
    e = await etat(p);
    check(e.bulle && e.bulleIndex === 3 && e.sel === 3, 'bulle ouverte, un clic sur une autre case : elle la suit');
    await p.keyboard.press('Escape'); await p.waitForTimeout(500);
    e = await etat(p);
    check(!e.bulle && e.sel === 3, 'Échap la referme, la sélection reste');
    c = await centre(p, 1, 3);
    await p.mouse.dblclick(c.x, c.y); await p.waitForTimeout(700);
    exiger((await etat(p)).bulle, 'rouverte au double-clic');
    await p.mouse.click(1300, 300); await p.waitForTimeout(1000);
    e = await etat(p);
    check(!e.bulle && e.sel === 3, 'un clic à côté la referme, la sélection reste');
    await p.mouse.click(1300, 300); await p.waitForTimeout(500);
    check((await etat(p)).sel == null, 'bulle fermée, un nouveau clic à côté désélectionne, comme avant');

    console.log('\n=== C. Ordinateur : renommer, au clic droit ou en tapant une lettre ===');
    c = await centre(p, 0, 0);
    await p.mouse.click(c.x, c.y, { button: 'right' }); await p.waitForTimeout(500);
    const renommer = p.locator('#context-menu [data-ctx-action="rename-chord"]');
    exiger(await renommer.isVisible(), 'le clic droit sur un accord propose « Renommer »');
    check(await p.locator('#context-menu [data-ctx-action="rename"] .ctx-label').innerText() === 'Modifier', 'à côté de « Modifier » (l\'inspecteur), qui garde son sens');
    await renommer.click(); await p.waitForTimeout(400);
    exiger((await etat(p)).retape, '« Renommer » ouvre la retape du nom dans la case');
    await p.keyboard.press('Control+a'); await p.keyboard.type('Em7'); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
    let nom = await p.evaluate(() => { const c = JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[0]; return c.root + c.quality; });
    check(nom === 'Emin7', `l'accord est renommé (${nom})`);
    c = await centre(p, 0, 2);
    await p.mouse.click(c.x, c.y); await p.waitForTimeout(500);
    await p.keyboard.press('b'); await p.waitForTimeout(400);
    check((await etat(p)).retape, 'une lettre tapée sur l\'accord choisi ouvre aussi la retape (comme avant)');
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    await p.context().close();

    // ======================================================================================================
    console.log('\n=== D. Téléphone : un toucher = entendre, un second toucher = ouvrir ===');
    p = await ouvrir({ width: 390, height: 844 }, true);
    const toucher = async (s, i) => { const c = await centre(p, s, i); await p.touchscreen.tap(c.x, c.y); };
    await toucher(0, 1); await p.waitForTimeout(800);
    e = await etat(p);
    exiger(e.sel === 1 && e.section === 0, 'le toucher choisit l\'accord');
    check(e.ecoutes === 1 && e.bleue, `en bleu, et on l'entend (${e.ecoutes} écoute)`);
    check(!e.panneau && e.y === 0, `rien ne s'ouvre, rien ne défile (défilement ${e.y})`);
    await toucher(0, 1); await p.waitForTimeout(800);
    e = await etat(p);
    exiger(e.panneau && e.bulleIndex === 1, 'toucher la case déjà choisie ouvre le panneau d\'accord');
    check(!e.etendu, 'à mi-hauteur (pas agrandi)');
    await p.keyboard.press('Escape'); await p.waitForTimeout(600);
    e = await etat(p);
    check(!e.panneau && e.sel === 1, 'Échap le referme, la sélection reste');
    // Double toucher rapide sur une autre case : choisir puis ouvrir, d'un seul geste.
    await toucher(0, 3); await p.waitForTimeout(120); await toucher(0, 3); await p.waitForTimeout(800);
    e = await etat(p);
    check(e.panneau && e.bulleIndex === 3 && !e.etendu && !e.retape, 'un double toucher rapide ouvre le panneau, sans retaper le nom ni l\'agrandir');
    await toucher(0, 2); await p.waitForTimeout(800);
    e = await etat(p);
    check(e.panneau && e.bulleIndex === 2 && e.sel === 2, 'panneau ouvert, un toucher sur une autre case : il la suit');
    await p.keyboard.press('Escape'); await p.waitForTimeout(600);
    // L'appui long (doigt posé, immobile) : le menu propose « Renommer ».
    const cdp = await p.context().newCDPSession(p);
    c = await centre(p, 0, 0);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y }] });
    await p.waitForTimeout(900);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(500);
    check(await p.locator('#context-menu [data-ctx-action="rename-chord"]').isVisible(), 'l\'appui long sur un accord propose « Renommer »');
    await p.locator('#context-menu [data-ctx-action="rename-chord"]').tap(); await p.waitForTimeout(500);
    check((await etat(p)).retape, 'qui ouvre la retape du nom');
    await p.context().close();

    // ======================================================================================================
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a) : « Éditeur de notes » n'existe plus à l'ordinateur ; c'est le séquenceur du bloc « Vues » qui suit l'accord cliqué.
    console.log('\n=== E. Séquenceur ouvert (ordinateur) : un clic choisit l\'accord au séquenceur, sans bulle ===');
    p = await ouvrir({ width: 1440, height: 900 });
    { const v = await p.locator('#vue-sequenceur').boundingBox(); await p.mouse.click(v.x + v.width / 2, v.y + v.height / 2); await p.waitForTimeout(800); }
    c = await centre(p, 0, 2);
    await p.mouse.click(c.x, c.y); await p.waitForTimeout(800);
    e = await etat(p);
    const choisiSq = await p.evaluate(() => { const n = document.querySelector('#sq-grille .sq-nom.choisi'); return n ? +n.dataset.c : null; });
    check(choisiSq === 2 && !e.bulle && !e.inspecteur, `le séquenceur suit l'accord cliqué (${choisiSq}), sans bulle ni inspecteur`);
    await p.mouse.dblclick(c.x, c.y); await p.waitForTimeout(800);
    check((await etat(p)).bulle, 'le double-clic ouvre la bulle, séquenceur ouvert aussi');
    await p.context().close();

    check(erreurs.length === 0, `aucune erreur de page${erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''}`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
