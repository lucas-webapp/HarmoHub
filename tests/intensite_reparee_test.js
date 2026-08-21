// L'intensité : réparée, puis rangée hors de vue.
//
// SIGNALEMENT UTILISATEUR : « La modification d'intensité ne semble pas fonctionner, le jeu est
// toujours fort. Pas besoin de tout le temps le laisser afficher, c'est une option pour affiner le
// morceau seulement. À cacher. »
//
// IL AVAIT RAISON, ET C'ÉTAIT MESURABLE. Pour un accord TENU — le réglage par défaut — les cinq
// niveaux ne donnaient que TROIS vélocités distinctes :
//
//     Très doux 35 % → 0,467      Fort      90 %  → 1,0
//     Doux      55 % → 0,733      Très fort 100 % → 1,0
//     Normal    75 % → 1,0
//
// `base` valait 1 pour un accord tenu et le résultat est plafonné à 1 : tout ce qui passait au-dessus
// de « Normal » était écrêté. Mon propre commentaire annonçait que « la marge utile se resserre » —
// elle était NULLE, et je ne l'avais pas mesurée avant de placer deux niveaux là.
//
// Cacher un réglage cassé aurait été cacher une panne. On répare d'abord (section A), on range
// ensuite (sections B à E).
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Intensité : cinq niveaux qui s\'entendent, rangés hors de vue');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r, q, b, x) => Object.assign({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', intensity: 75 }, x || {});
    const song = {
        id: 'intensite', name: 'Ballade', bpm: 100, timeSig: '4/4', groove: 'straight',
        // Le second accord porte une valeur qui ne tombe sur AUCUN des cinq niveaux : le cas des
        // morceaux écrits avant. Il ne doit être ni réécrit, ni présenté comme exact.
        sections: [{ title: 'Couplet', chords: [mk('C', 'maj7', 4), mk('F', 'maj7', 4, { intensity: 60 })] }],
    };
    localStorage.setItem('harmohubSongs', JSON.stringify([song]));
    localStorage.setItem('harmohubCurrentSongId', song.id);
    localStorage.setItem('myProgression', JSON.stringify({ sections: song.sections }));
};
const intensites = () => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.map(c => c.intensity);

const clicDroitSurCase = async (page, i) => {
    const b = await page.evaluate((k) => {
        const c = document.querySelectorAll('.grid-cell:not(.grid-cell-add)')[k];
        const r = c.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, i);
    await page.mouse.click(b.x, b.y, { button: 'right' });
    await page.waitForTimeout(450);
};

(async () => {
    plan(22);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    page.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(900);

    console.log('=== A. LE DÉFAUT : cinq niveaux doivent donner cinq vélocités ===');
    const vels = await page.evaluate(() => NIVEAUX_INTENSITE.map(n => ({
        nom: n.nom, pct: n.valeur,
        tenu: +computeVelocity(true, true, n.valeur, null).toFixed(3),
    })));
    const distinctes = new Set(vels.map(v => v.tenu)).size;
    check(distinctes === 5,
        `sur un accord TENU, les cinq niveaux donnent cinq vélocités distinctes — ${distinctes}/5 : ${vels.map(v => v.tenu).join(', ')}`);
    check(vels.every((v, i) => i === 0 || v.tenu > vels[i - 1].tenu),
        'et elles montent strictement du plus doux au plus fort');
    // La marge au-dessus de « Normal » est la condition même de l'existence d'un niveau « fort ».
    const normal = vels.find(v => v.pct === 75).tenu;
    check(normal < 1, `« Normal » laisse de la marge sous le plafond — ${normal} (il valait 1,0, d'où l'écrêtage)`);
    check(vels[vels.length - 1].tenu === 1, 'et « Très fort » atteint bien le plafond, sans le dépasser');
    // Le rapport entre deux niveaux ne dépend pas du type d'accord : la même échelle vaut pour un
    // accord détaché, sinon le réglage voudrait dire deux choses selon le rythme.
    const detaches = await page.evaluate(() => NIVEAUX_INTENSITE.map(n => +computeVelocity(false, true, n.valeur, null).toFixed(3)));
    check(detaches.every((v, i) => i === 0 || v >= detaches[i - 1]), `l'échelle monte aussi sur un accord détaché — ${detaches.join(', ')}`);

    console.log('\n=== B. La rangée a quitté la carte, la source de vérité est restée ===');
    const carte = await page.evaluate(() => ({
        rangee: !!document.querySelector('#lecture-row .voicing-group-intensite'),
        seg: !!document.getElementById('intensity-seg'),
        champ: !!document.getElementById('intensity'),
        menu: !!document.getElementById('intensity-menu'),
        entree: !!document.querySelector('[data-ctx-action="intensity"]'),
    }));
    check(!carte.rangee && !carte.seg, 'plus de rangée d\'intensité dans la carte');
    check(carte.champ, 'le champ #intensity est resté dans le DOM : readChord et les exports le lisent toujours');
    check(carte.menu && carte.entree, 'un menu de niveaux et son entrée de menu contextuel existent');

    console.log('\n=== C. Cinq niveaux à la demande, sur l\'accord désigné ===');
    await clicDroitSurCase(page, 0);
    check(await page.evaluate(() => { const e = document.querySelector('[data-ctx-action="intensity"]'); return e && !e.hidden; }),
        'l\'entrée « Intensité… » est proposée sur un accord');
    await page.click('[data-ctx-action="intensity"]');
    await page.waitForTimeout(450);
    const menu = await page.evaluate(() => {
        const m = document.getElementById('intensity-menu');
        const r = m.getBoundingClientRect();
        return {
            ouvert: !m.hidden,
            items: [...m.querySelectorAll('button[data-valeur]')].map(b => +b.dataset.valeur),
            actifs: [...m.querySelectorAll('button.active')].map(b => +b.dataset.valeur),
            dansEcran: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
        };
    });
    check(menu.ouvert && menu.items.length === 5, `le menu s'ouvre avec les cinq niveaux — ${menu.items.join(', ')}`);
    // Construit depuis la table, jamais écrit en dur : les valeurs doivent être CELLES de la table.
    const table = await page.evaluate(() => NIVEAUX_INTENSITE.map(n => n.valeur));
    check(JSON.stringify(menu.items) === JSON.stringify(table), 'ses valeurs viennent de NIVEAUX_INTENSITE, pas d\'une copie');
    check(menu.dansEcran, 'et il s\'ouvre entièrement dans la fenêtre');
    check(menu.actifs.length === 1 && menu.actifs[0] === 75, `le niveau courant de CET accord est mis en avant — ${menu.actifs.join(',')}`);

    const avant = await page.evaluate(intensites);
    await page.click('#intensity-menu button[data-valeur="35"]');
    await page.waitForTimeout(600);
    const apres = await page.evaluate(intensites);
    check(apres[0] === 35 && apres[1] === avant[1],
        `le clic écrit l'intensité de CET accord seulement — ${avant.join('/')} → ${apres.join('/')}`);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(600);
    check(JSON.stringify(await page.evaluate(intensites)) === JSON.stringify(avant), 'et Ctrl+Z le reprend');

    console.log('\n=== D. Une valeur héritée n\'est ni réécrite, ni présentée comme exacte ===');
    await clicDroitSurCase(page, 1);
    await page.click('[data-ctx-action="intensity"]');
    await page.waitForTimeout(450);
    const herite = await page.evaluate(() => ({
        donnee: JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[1].intensity,
        actifs: [...document.querySelectorAll('#intensity-menu button.active')].map(b => +b.dataset.valeur),
    }));
    check(herite.donnee === 60, `la donnée n'a pas bougé en ouvrant le menu — ${herite.donnee}`);
    check(herite.actifs.length === 1 && herite.actifs[0] === 55,
        `le niveau le plus proche est désigné, sans réécrire — ${herite.actifs.join(',')}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
    check(await page.evaluate(() => document.getElementById('intensity-menu').hidden),
        'Échap referme le menu, comme tous les autres popups de l\'appli');

    console.log('\n=== E. Le mode studio a suivi l\'intensité, dans le séquenceur ===');
    // Il fermait la rangée d'intensité de la carte ; celle-ci partie, sa place est là où il dessine
    // ses barres. Construit à chaque rendu, donc son câblage devait déménager avec lui.
    await page.evaluate(() => { window.app.editChord(0, 0); if (!window.app.seqOpen) window.app.toggleSequencer('compact'); });
    await page.waitForTimeout(900);
    check(await page.evaluate(() => !!document.querySelector('#arp-sequencer #toggle-studio-mode')),
        'le bouton du mode studio est dans la barre d\'outils du séquenceur');
    const avantStudio = await page.evaluate(() => window.app.studioMode);
    await page.click('#arp-sequencer #toggle-studio-mode');
    await page.waitForTimeout(600);
    check(await page.evaluate(() => window.app.studioMode) !== avantStudio,
        'il bascule toujours le mode studio, malgré le déménagement');
    // Et il survit à un re-rendu : c'est le piège d'un bouton reconstruit à chaque fois.
    await page.evaluate(() => window.app.renderSequencer());
    await page.waitForTimeout(500);
    const apresRendu = await page.evaluate(() => {
        const b = document.querySelector('#arp-sequencer #toggle-studio-mode');
        return { present: !!b, actif: !!b && b.classList.contains('active') };
    });
    check(apresRendu.present && apresRendu.actif === !avantStudio,
        'après un re-rendu du séquenceur, il est toujours là ET reflète toujours l\'état');
    await page.click('#arp-sequencer #toggle-studio-mode');
    await page.waitForTimeout(500);
    check(await page.evaluate(() => window.app.studioMode) === avantStudio,
        'et le bouton reconstruit répond encore : son câblage n\'a pas été perdu au rendu');
    await page.close();

    console.log('\n=== F. Téléphone : le menu reste atteignable au doigt ===');
    const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true });
    const m = await ctx.newPage();
    m.on('pageerror', e => erreurs.push('téléphone : ' + e.message));
    await m.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await m.waitForTimeout(300);
    await m.evaluate(seed);
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(1000);
    // Appui long : c'est le seul chemin vers le menu contextuel au doigt.
    const b0 = await m.evaluate(() => { const c = document.querySelector('.grid-cell:not(.grid-cell-add)'); const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await m.touchscreen.tap(b0.x, b0.y);
    await m.waitForTimeout(200);
    await m.evaluate(({ x, y }) => window.app.openContextMenu(x, y, { type: 'chord', section: 0, index: 0 }), b0);
    await m.waitForTimeout(450);
    await m.click('[data-ctx-action="intensity"]');
    await m.waitForTimeout(500);
    const telMenu = await m.evaluate(() => {
        const mm = document.getElementById('intensity-menu');
        const r = mm.getBoundingClientRect();
        const cibles = [...mm.querySelectorAll('button[data-valeur]')].map(b => b.getBoundingClientRect());
        return {
            ouvert: !mm.hidden,
            dansEcran: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1,
            hMin: Math.round(Math.min(...cibles.map(c => c.height))),
        };
    });
    check(telMenu.ouvert && telMenu.dansEcran, 'téléphone : le menu s\'ouvre entièrement dans l\'écran');
    check(telMenu.hMin >= 28, `téléphone : chaque niveau fait au moins 28px de haut — ${telMenu.hMin}px`);
    await m.tap('#intensity-menu button[data-valeur="100"]');
    await m.waitForTimeout(600);
    check((await m.evaluate(intensites))[0] === 100, 'téléphone : un vrai appui applique le niveau');

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
