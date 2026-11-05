// Lot 2 de la refonte : les réglages du morceau (tempo, groove, mesure, tonalité) deviennent un
// panneau FLOTTANT au lieu d'un bloc qui pousse la mise en page.
//
// LA MESURE QUI A DÉCIDÉ DU LOT. Sur un iPhone 13 (390x664), ouvrir ces réglages repoussait la grille
// d'accords de 345px à 703px — c'est-à-dire hors d'un écran de 664px. Il ne restait plus UN SEUL
// accord en vue pendant qu'on réglait le tempo, alors que chercher son tempo se fait précisément en
// regardant et en écoutant sa grille. Sur ordinateur, le coût était nul (le volet de gauche défile
// pour lui-même) mais le bloc y occupait 314px de colonne.
//
// CE QUE LE BANC ÉPROUVE VRAIMENT. Un panneau flottant est facile à faire et facile à rater : il
// suffit qu'il sorte de l'écran, qu'il recouvre ce qu'il documente, qu'il refuse de se fermer, ou
// qu'il coupe le lien entre ses réglages et le reste de l'appli. Les six familles ci-dessous
// correspondent chacune à une de ces façons de rater, et non à la simple description du résultat.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Réglages du morceau : panneau flottant');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const song = {
        id: 'lot2-popover', name: 'Ballade en Do mineur', bpm: 120, timeSig: '4/4', groove: 'straight',
        sections: [{ title: 'Couplet', chords: [mk('C', 'maj7', 4), mk('F', 'maj', 4), mk('G', '7', 4), mk('A', 'min', 4)] }],
    };
    localStorage.setItem('harmohubSongs', JSON.stringify([song]));
    localStorage.setItem('harmohubCurrentSongId', song.id);
    localStorage.setItem('myProgression', JSON.stringify({ sections: song.sections }));
};

// LOT 10c : sous 900px, la barre-résumé déplie désormais les quatre CASES de la maquette (Tonalité, Mesure, Swing, Son, et Transposer dessous) ;
// l'ancien panneau flottant de listes déroulantes ne s'ouvre plus à aucune largeur. Les cases sont DANS la page, comme sur la maquette : elles
// poussent la grille d'environ 170px — ce que ce banc interdisait au panneau. L'intention d'origine est gardée telle quelle, mesurée autrement :
// pendant qu'on règle, la grille RESTE À L'ÉCRAN (sa première rangée d'accords visible au-dessus de la barre de lecture), rien ne déborde, le
// résumé reste lisible. Ce qui flotte aujourd'hui — le choix ouvert par une case (#rr-pop), le panneau Lecture du tempo — est éprouvé pour le
// reste : deux façons de le refermer, rien qui ne se rouvre seul, le circuit (vrai geste puis vrai Ctrl+Z), la Modification, la suggestion de
// tonalité devant, la carte de l'accord jamais recouverte.
const geometrie = () => {
    const p = document.getElementById('tel-reglages-cases');
    const a = document.getElementById('song-summary');
    const c = document.querySelector('#progression-sections .grid-cell');
    const rp = p.getBoundingClientRect(), ra = a.getBoundingClientRect(), rc = c.getBoundingClientRect();
    const basUtile = window.innerHeight - document.getElementById('barre-lecture').getBoundingClientRect().height;
    return {
        ouvert: !p.hidden,
        panneau: { t: Math.round(rp.top), b: Math.round(rp.bottom), l: Math.round(rp.left), r: Math.round(rp.right), h: Math.round(rp.height) },
        caseBas: Math.round(rc.bottom), basUtile: Math.round(basUtile),
        deborde: rp.bottom > window.innerHeight + 1 || rp.top < -1 || rp.right > window.innerWidth + 1 || rp.left < -1,
        // VRAI croisement de rectangles, sur les DEUX axes (une première version ne comparait que les bandes verticales et criait au loup).
        recouvreResume: !(rp.bottom <= ra.top || rp.top >= ra.bottom || rp.right <= ra.left || rp.left >= ra.right),
        resumeLisible: ra.width > 20 && ra.top >= -1 && ra.bottom <= window.innerHeight + 1,
        vh: window.innerHeight,
    };
};

async function eprouverFormat(page, contexte, ouvrir) {
    await ouvrir();
    await page.waitForTimeout(400);
    const ouv = await page.evaluate(geometrie);
    exiger(ouv.ouvert, `${contexte} : les cases s'ouvrent bien`);
    check(ouv.caseBas <= ouv.basUtile,
        `${contexte} : ouvrir les réglages laisse la grille à l'écran — la première rangée d'accords finit à ${ouv.caseBas}px, au-dessus de la barre de lecture (${ouv.basUtile}px)`);
    check(!ouv.deborde,
        `${contexte} : les cases tiennent entièrement dans la fenêtre — haut ${ouv.panneau.t}, bas ${ouv.panneau.b}, écran ${ouv.vh}px`);
    check(!ouv.recouvreResume && ouv.resumeLisible,
        `${contexte} : la ligne de résumé (tonalité, tempo, mesure) reste visible et non recouverte`);
    return ouv;
}

(async () => {
    plan(25);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];

    console.log('=== A. Téléphone : c\'est là que le bloc déplié faisait disparaître la grille ===');
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const m = await ctx.newPage();
    m.on('pageerror', e => erreurs.push('téléphone : ' + e.message));
    await m.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await m.waitForTimeout(300);
    await m.evaluate(seed);
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(700);
    await eprouverFormat(m, 'téléphone', () => m.click('#song-summary'));

    console.log('\n=== B. Le choix d\'une case se referme des deux façons attendues ===');
    await m.click('#rr-mesure');
    await m.waitForTimeout(250);
    // Un clic AILLEURS. On vise le haut de la grille, hors du choix (posé sous sa case).
    await m.mouse.click(20, await m.evaluate(() => window.innerHeight - 100));
    await m.waitForTimeout(300);
    check(await m.evaluate(() => document.getElementById('rr-pop').hidden), 'un clic à côté referme le choix');

    await m.click('#rr-mesure');
    await m.waitForTimeout(300);
    exiger(await m.evaluate(() => !document.getElementById('rr-pop').hidden), 'le choix est rouvert pour éprouver Échap');
    await m.keyboard.press('Escape');
    await m.waitForTimeout(300);
    check(await m.evaluate(() => document.getElementById('rr-pop').hidden), 'Échap referme le choix');

    console.log('\n=== C. Rien ne se rouvre tout seul au chargement ===');
    await m.click('#rr-swing');
    await m.waitForTimeout(250);
    exiger(await m.evaluate(() => !document.getElementById('tel-reglages-cases').hidden && !document.getElementById('rr-pop').hidden), 'les cases et un choix sont ouverts avant le rechargement');
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(700);
    check(await m.evaluate(() => document.getElementById('tel-reglages-cases').hidden && document.getElementById('rr-pop').hidden),
        'après rechargement, les cases et le choix sont refermés');
    await m.close();

    console.log('\n=== D. Juste sous le seuil (860px) : la grille reste à l\'écran aussi ===');
    // LOT 6a : à partir de 900px, ces réglages sont des puces au-dessus de la grille (rangee_reglages_test). Sous le seuil, la barre-résumé et ses
    // cases (lot 10c) : la partie « grand écran » de ce banc se joue juste sous le seuil.
    const page = await browser.newPage({ viewport: { width: 860, height: 900 } });
    page.on('pageerror', e => erreurs.push('860px : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(600);
    const ouvBureau = await eprouverFormat(page, '860px', () => page.click('#song-summary'));
    check(ouvBureau.panneau.h > 100, `les cases contiennent bien les quatre réglages et Transposer — ${ouvBureau.panneau.h}px de haut`);

    console.log('\n=== E. Le tempo reste branché sur le reste de l\'appli ===');
    // Un réglage sorti de sa place est vite un réglage sorti du CIRCUIT : il n'écrit plus dans le morceau, ou n'alimente plus la ligne de résumé.
    // Le tempo se règle dans le panneau Lecture (lot 10b) : éprouvé par de VRAIS clics sur « + », puis un VRAI Ctrl+Z — pas par un appel de méthode.
    await page.click('#bl-plus');
    await page.waitForTimeout(250);
    const boite = await page.locator('#bl-tempo-plus').boundingBox();
    if (exiger(!!boite, 'le « + » du tempo est atteignable dans le panneau Lecture')) {
        for (let i = 0; i < 4; i++) { await page.mouse.click(boite.x + boite.width / 2, boite.y + boite.height / 2); await page.waitForTimeout(60); }
        await page.waitForTimeout(250);
        const apres = await page.evaluate(() => ({
            bpm: document.getElementById('bpm').value,
            resume: document.getElementById('song-summary-tel-bpm').textContent.trim(),
        }));
        check(apres.bpm !== '120', `les clics changent bien le tempo — ${apres.bpm}`);
        check(apres.resume === apres.bpm + ' BPM', `la ligne de résumé suit le réglage — résumé « ${apres.resume} », champ « ${apres.bpm} »`);
        await page.click('#pl-fermer');
        await page.waitForTimeout(200);
        for (let i = 0; i < 4; i++) { await page.keyboard.press('Control+z'); await page.waitForTimeout(120); }
        await page.waitForTimeout(200);
        const repris = await page.evaluate(() => document.getElementById('bpm').value);
        check(repris === '120', `Ctrl+Z reprend le tempo d'avant — ${repris}`);
    }

    console.log('\n=== F. Les cases ne cassent ni le mode Modification ni les menus qui s\'ouvrent depuis elles ===');
    // F1. Choisir dans une case ne doit pas sortir du mode Modification : les cases vivent dans #song-card (.col-left) et leur choix est
    // déclaré dans ZONE_EDITION_SELECTEURS (#rr-pop) — c'est cette déclaration que lit le clic à côté. Un défaut qui a mordu douze fois.
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(300);
    exiger(await page.evaluate(() => window.app.appMode === 'edit'), 'on est bien en mode Modification');
    await page.evaluate(() => window.scrollTo(0, 0));
    if (await page.evaluate(() => document.getElementById('tel-reglages-cases').hidden)) await page.click('#song-summary');
    await page.waitForTimeout(250);
    await page.click('#rr-swing');
    await page.waitForTimeout(250);
    const bGroove = await page.locator('#rr-pop [data-rr-valeur="shuffle"]').boundingBox();
    if (exiger(!!bGroove, 'un réglage du choix est atteignable')) {
        await page.mouse.click(bGroove.x + bGroove.width / 2, bGroove.y + bGroove.height / 2);
        await page.waitForTimeout(300);
        check(await page.evaluate(() => window.app.appMode === 'edit' && document.getElementById('groove').value === 'shuffle'),
            'choisir dans une case règle le swing et ne sort PAS du mode Modification');
    }

    // F2. La suggestion de tonalité s'ouvre DEPUIS le choix de la tonalité : elle doit passer DEVANT lui. Un menu qui s'ouvrirait derrière serait
    // invisible sans que rien ne le signale.
    await page.click('#rr-tonalite');
    await page.waitForTimeout(250);
    await page.click('#rr-pop .rr-suggerer');
    await page.waitForTimeout(400);
    const menu = await page.evaluate(() => {
        const el = document.getElementById('key-suggest-menu');
        const pan = document.getElementById('rr-pop');
        if (!el || el.hidden) return { ouvert: false };
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + Math.min(12, r.height / 2);
        const dessus = document.elementFromPoint(cx, cy);
        return {
            ouvert: true,
            devant: !!dessus && (el === dessus || el.contains(dessus)),
            zMenu: getComputedStyle(el).zIndex, zPanneau: getComputedStyle(pan).zIndex,
            voleur: dessus ? (dessus.id ? '#' + dessus.id : dessus.tagName) : 'rien',
        };
    });
    // Pas de vérification sous condition : si la suggestion n'a rien proposé, c'est un échec dit comme tel (rien n'a été mesuré).
    check(menu.ouvert && menu.devant,
        `la suggestion de tonalité passe DEVANT le choix — z-index ${menu.zMenu} contre ${menu.zPanneau}${menu.ouvert ? (menu.devant ? '' : ', le clic atteint ' + menu.voleur) : ' (rien n\'a été proposé)'}`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);

    console.log('\n=== G. Les réglages ne doivent JAMAIS recouvrir l\'accord en cours d\'édition ===');
    // Acquis explicite, antérieur au lot 2 : « on peut régler le tempo sans perdre de vue l'accord qu'on est en train d'éditer ». Le premier
    // placement du panneau flottant le cassait sans bruit (96 % de la carte recouverte, mesuré) : vérifié sur les DEUX formats, cases ouvertes.
    const chevauchement = async (p, contexte) => {
        await p.evaluate(() => { window.app.editChord(0, 1); });
        await p.waitForTimeout(300);
        await p.evaluate(() => window.scrollTo(0, 0));
        if (await p.evaluate(() => document.getElementById('tel-reglages-cases').hidden)) await p.click('#song-summary');
        await p.waitForTimeout(400);
        const r = await p.evaluate(() => {
            const pan = document.getElementById('tel-reglages-cases').getBoundingClientRect();
            const ac = document.getElementById('accord-card');
            const acr = ac.getBoundingClientRect();
            const ox = Math.max(0, Math.min(pan.right, acr.right) - Math.max(pan.left, acr.left));
            const oy = Math.max(0, Math.min(pan.bottom, acr.bottom) - Math.max(pan.top, acr.top));
            const aire = acr.width * acr.height;
            return { cachee: ac.hidden, ouvertes: pan.height > 0, part: aire > 0 ? Math.round(ox * oy / aire * 100) : 0 };
        });
        check(!r.cachee && r.ouvertes && r.part === 0,
            `${contexte} : les cases ne recouvrent pas la carte de l'accord édité — ${r.part} % recouverts`);
    };
    await chevauchement(page, '860px');

    const ctx2 = await browser.newContext({ ...devices['iPhone 13'] });
    const m2 = await ctx2.newPage();
    m2.on('pageerror', e => erreurs.push('téléphone (G) : ' + e.message));
    await m2.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await m2.waitForTimeout(300);
    await m2.evaluate(seed);
    await m2.reload({ waitUntil: 'load' });
    await m2.waitForTimeout(700);
    await chevauchement(m2, 'téléphone');

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
