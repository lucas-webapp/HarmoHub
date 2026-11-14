// LES VIGNETTES DES DOIGTÉS DE GUITARE ET LES NOMS DES NOTES (L8, affichage, 14/11), avec de vrais gestes.
//
// CE QUE DEMANDE L'UTILISATEUR (13/11, « toutes tes idées sont bonnes » ; 14/11 : « on peut commencer par l'affichage ») : une vignette par doigté proposé SOUS le
// grand diagramme de guitare (un clic le met en grand), et le nom des notes en petit sur les diagrammes, réglable dans Paramètres › Affichage.
//
// CE QUE LE BANC TIENT : à l'ordinateur, le tiroir Clavier + Guitare montre autant de vignettes que de doigtés, sous le manche et dans le tiroir, une seule
// est « en grand » (aria-pressed) ; un vrai clic sur une vignette la met en grand sans toucher à la grille ni à l'historique d'annulation, et reste d'accord
// avec ‹ › et le compteur ; guitare masquée = plus de vignettes. Les noms des notes sont éteints par défaut, s'allument par l'interrupteur de Paramètres
// (mémorisé après rechargement), se limitent aux notes de l'accord, et ne passent jamais sur les vignettes. Le téléphone n'a pas bougé.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('vignettes guitare');
const { estBruitReseau } = require('./_harness');

plan(21);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, bass = null) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass, playStyle: 'held' });
    const S = [{ title: 'Couplet', chords: [mk('C', 'maj7', 'E'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport) => {
        const p = await nav.newPage({ viewport });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const guitareAffichee = async (p, on) => {
        if ((await p.getAttribute('#toggle-viz-guitar', 'aria-pressed')) !== String(on)) await p.click('#toggle-viz-guitar', { force: true });
        await p.waitForTimeout(250);
    };
    const etat = (p) => p.evaluate(() => {
        const v = [...document.querySelectorAll('#guitar-vignettes .guitar-vignette')];
        return {
            n: v.length, pressed: v.map((b, i) => b.getAttribute('aria-pressed') === 'true' ? i : -1).filter(i => i >= 0),
            index: window.app.guitarFingeringIndex, total: window.app.guitarFingerings.length,
            label: document.getElementById('guitar-nav-label').textContent,
            grand: document.getElementById('guitar-viz').innerHTML,
        };
    });
    const noms = (p, sel) => p.evaluate((sel) => [...document.querySelectorAll(sel + ' svg text')].filter(t => t.getAttribute('font-weight') === '700').map(t => t.textContent), sel);

    // ======================================================================================================
    console.log('\n=== A. Ordinateur : une vignette par doigté, sous le manche ===');
    const p = await ouvrir({ width: 1440, height: 900 });
    await guitareAffichee(p, true);
    await p.click('#progression-sections .chord-grid[data-section="0"] .grid-cell[data-index="0"]'); await p.waitForTimeout(500);
    let e = await etat(p);
    exiger(e.total >= 2, `Cmaj7/E propose plusieurs doigtés (${e.total})`);
    check(e.n === e.total, `une vignette par doigté : ${e.n} vignettes pour ${e.total} doigtés`);
    check(e.pressed.length === 1 && e.pressed[0] === 0, `une seule vignette « en grand », la première (${JSON.stringify(e.pressed)})`);
    const geo = await p.evaluate(() => {
        const g = document.getElementById('guitar-viz').getBoundingClientRect();
        const t = document.querySelector('.vues-tiroir').getBoundingClientRect();
        const vs = [...document.querySelectorAll('#guitar-vignettes .guitar-vignette')].map(b => b.getBoundingClientRect());
        return { dessous: vs.every(r => r.top >= g.bottom - 1), dansTiroir: vs.every(r => r.bottom <= t.bottom + 1 && r.right <= window.innerWidth), maxL: Math.max(...vs.map(r => r.width)) };
    });
    check(geo.dessous, 'les vignettes sont SOUS le grand diagramme');
    check(geo.dansTiroir && geo.maxL <= 60, `elles restent dans le tiroir et dans la fenêtre, petites (${geo.maxL} px)`);

    const avant = await p.evaluate(() => JSON.stringify(loadProgressionSections()));
    const annul0 = await p.evaluate(() => window.app.undoStack ? window.app.undoStack.length : -1);
    const b2 = await p.locator('#guitar-vignettes .guitar-vignette').nth(2).boundingBox();
    await p.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(300);
    const e2 = await etat(p);
    check(e2.index === 2 && e2.label === `3/${e.total}`, `un clic sur la 3e vignette la met en grand (index ${e2.index}, compteur ${e2.label})`);
    check(e2.pressed.length === 1 && e2.pressed[0] === 2, 'et c\'est elle qui est marquée');
    check(e2.grand !== e.grand, 'le grand diagramme a changé');
    check(await p.evaluate(() => JSON.stringify(loadProgressionSections())) === avant, 'la grille n\'a pas bougé');
    check(await p.evaluate(() => window.app.undoStack ? window.app.undoStack.length : -1) === annul0, 'aucune annulation empilée');

    await p.click('#guitar-next'); await p.waitForTimeout(250);
    const e3 = await etat(p);
    check(e3.index === 3 && e3.pressed[0] === 3 && e3.label === `4/${e.total}`, `‹ › reste d'accord avec les vignettes (index ${e3.index}, marquée ${e3.pressed})`);

    // ======================================================================================================
    console.log('\n=== B. Noms des notes ===');
    check((await noms(p, '#guitar-viz')).length === 0, 'éteints par défaut : aucun nom sur le grand diagramme');
    await p.click('#open-settings'); await p.waitForTimeout(400);
    exiger(await p.locator('#toggle-guitar-note-names').count() === 1, 'Paramètres › Affichage a l\'interrupteur « Noms des notes (guitare) »');
    await p.click('#toggle-guitar-note-names'); await p.waitForTimeout(300);
    check(await p.getAttribute('#toggle-guitar-note-names', 'aria-checked') === 'true' && await p.evaluate(() => localStorage.getItem('harmohubNomsNotesGuitare')) === '1', 'l\'interrupteur s\'allume et se mémorise');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    const n1 = await noms(p, '#guitar-viz');
    check(n1.length >= 3 && n1.every(n => ['C', 'E', 'G', 'B'].includes(n)), `les noms sont ceux des notes de Cmaj7 : ${n1.join(' ')}`);
    check((await noms(p, '#guitar-vignettes')).length === 0, 'jamais sur les vignettes');
    await p.reload(); await p.waitForTimeout(900);
    await p.click('#progression-sections .chord-grid[data-section="0"] .grid-cell[data-index="0"]'); await p.waitForTimeout(400);
    check((await noms(p, '#guitar-viz')).length >= 3, 'le réglage survit au rechargement');
    await p.click('#open-settings'); await p.waitForTimeout(400);
    await p.click('#toggle-guitar-note-names'); await p.waitForTimeout(300);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    check((await noms(p, '#guitar-viz')).length === 0, 'éteint de nouveau : plus aucun nom');

    // ======================================================================================================
    console.log('\n=== C. Guitare masquée : plus de vignettes ===');
    await guitareAffichee(p, false);
    check(await p.evaluate(() => document.getElementById('guitar-vignettes').getBoundingClientRect().width) === 0, 'la guitare est masquée : les vignettes aussi');
    await p.close();

    // ======================================================================================================
    console.log('\n=== D. Le téléphone n\'a pas bougé ===');
    const t = await ouvrir({ width: 390, height: 844 });
    check(await t.evaluate(() => document.getElementById('guitar-vignettes').getBoundingClientRect().width) === 0, 'au téléphone, aucune vignette (le tiroir n\'existe pas sous 900 px)');
    await t.close();

    check(erreurs.length === 0, `aucune erreur de page (${erreurs.slice(0, 2).join(' | ')})`);
    await nav.close();
    bilan();
})();
