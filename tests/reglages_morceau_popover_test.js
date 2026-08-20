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

const geometrie = () => {
    const p = document.getElementById('song-settings');
    const a = document.getElementById('song-summary');
    const g = document.getElementById('progression-sections');
    const rp = p.getBoundingClientRect(), ra = a.getBoundingClientRect(), rg = g.getBoundingClientRect();
    return {
        ouvert: !p.hidden,
        panneau: { t: Math.round(rp.top), b: Math.round(rp.bottom), l: Math.round(rp.left), r: Math.round(rp.right), h: Math.round(rp.height) },
        grilleTop: Math.round(rg.top),
        // Le panneau doit tenir ENTIÈREMENT dans la fenêtre : un panneau dont le bas dépasse laisse
        // des réglages inatteignables sans un défilement que rien n'annonce.
        deborde: rp.bottom > window.innerHeight + 1 || rp.top < -1 || rp.right > window.innerWidth + 1 || rp.left < -1,
        // ...et ne doit pas recouvrir la ligne de résumé, qui affiche justement le tempo et la
        // tonalité qu'on est en train de changer.
        // VRAI croisement de rectangles, sur les DEUX axes. La première version de cette
        // vérification ne comparait que les bandes verticales — elle suffisait tant que le panneau
        // se posait sous son ancre, et elle a crié au loup dès qu'il s'est rangé À CÔTÉ de la
        // colonne : mêmes hauteurs, mais à 400px de distance horizontale, donc aucun recouvrement.
        recouvreResume: !(rp.bottom <= ra.top || rp.top >= ra.bottom || rp.right <= ra.left || rp.left >= ra.right),
        resumeLisible: ra.width > 20 && ra.top >= -1 && ra.bottom <= window.innerHeight + 1,
        vh: window.innerHeight,
    };
};

async function eprouverFormat(page, contexte, ouvrir) {
    const ferme = await page.evaluate(geometrie);
    await ouvrir();
    await page.waitForTimeout(400);
    const ouv = await page.evaluate(geometrie);
    exiger(ouv.ouvert, `${contexte} : le panneau s'ouvre bien`);
    check(ouv.grilleTop === ferme.grilleTop,
        `${contexte} : ouvrir les réglages ne déplace PAS la grille — ${ferme.grilleTop}px puis ${ouv.grilleTop}px`);
    check(!ouv.deborde,
        `${contexte} : le panneau tient entièrement dans la fenêtre — haut ${ouv.panneau.t}, bas ${ouv.panneau.b}, écran ${ouv.vh}px`);
    check(!ouv.recouvreResume && ouv.resumeLisible,
        `${contexte} : la ligne de résumé (tempo, mesure, tonalité) reste visible et non recouverte`);
    return ouv;
}

(async () => {
    plan(21);
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

    console.log('\n=== B. Le panneau se referme des deux façons attendues ===');
    // Un clic AILLEURS. On vise le bas de l'écran, hors du panneau : le panneau est ancré en haut.
    await m.mouse.click(20, await m.evaluate(() => window.innerHeight - 30));
    await m.waitForTimeout(300);
    check(await m.evaluate(() => document.getElementById('song-settings').hidden), 'un clic à côté referme le panneau');

    await m.click('#song-summary');
    await m.waitForTimeout(300);
    exiger(await m.evaluate(() => !document.getElementById('song-settings').hidden), 'le panneau est rouvert pour éprouver Échap');
    await m.keyboard.press('Escape');
    await m.waitForTimeout(300);
    check(await m.evaluate(() => document.getElementById('song-settings').hidden), 'Échap referme le panneau');

    console.log('\n=== C. Il ne se rouvre pas tout seul au chargement ===');
    // Un bloc déplié qui restait déplié au retour était cohérent ; un panneau flottant qui s'ouvre
    // par-dessus la grille au lancement ne l'est pas, et personne ne l'a demandé.
    await m.click('#song-summary');
    await m.waitForTimeout(250);
    exiger(await m.evaluate(() => !document.getElementById('song-settings').hidden), 'le panneau est ouvert avant le rechargement');
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(700);
    check(await m.evaluate(() => document.getElementById('song-settings').hidden),
        'après rechargement, le panneau est refermé');
    await m.close();

    console.log('\n=== D. Ordinateur : rien ne bouge non plus, et 310px de volet sont rendus ===');
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(600);
    const ouvBureau = await eprouverFormat(page, 'ordinateur', () => page.click('#song-summary'));
    check(ouvBureau.panneau.h > 150, `le panneau contient bien les deux cartes — ${ouvBureau.panneau.h}px de haut`);

    console.log('\n=== E. Le panneau reste branché sur le reste de l\'appli ===');
    // Un panneau sorti du flux est vite un panneau sorti du CIRCUIT : ses réglages n'écrivent plus
    // dans le morceau, ou n'alimentent plus la ligne de résumé. Éprouvé par un VRAI glissé de souris
    // sur le curseur de tempo, puis un VRAI Ctrl+Z — pas par un appel de méthode.
    const boite = await page.locator('#bpm').boundingBox();
    if (exiger(!!boite, 'le curseur de tempo est atteignable dans le panneau flottant')) {
        await page.mouse.move(boite.x + boite.width * 0.2, boite.y + boite.height / 2);
        await page.mouse.down();
        await page.mouse.move(boite.x + boite.width * 0.8, boite.y + boite.height / 2, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(250);
        const apres = await page.evaluate(() => ({
            bpm: document.getElementById('bpm').value,
            resume: document.getElementById('song-summary-bpm').textContent.trim(),
        }));
        check(apres.bpm !== '120', `le glissé change bien le tempo — ${apres.bpm}`);
        check(apres.resume === apres.bpm, `la ligne de résumé suit le réglage — résumé « ${apres.resume} », champ « ${apres.bpm} »`);

        await page.keyboard.press('Control+z');
        await page.waitForTimeout(300);
        const repris = await page.evaluate(() => document.getElementById('bpm').value);
        check(repris === '120', `Ctrl+Z reprend le tempo d'avant depuis le panneau flottant — ${repris}`);
    }

    console.log('\n=== F. Le panneau ne casse ni le mode Modification ni les menus qui s\'ouvrent depuis lui ===');
    // F1. Cliquer DANS le panneau ne doit pas sortir du mode Modification. Le panneau est posé en
    // position fixe, mais il reste un descendant de #song-card dans le DOM — c'est cette parenté,
    // pas la position à l'écran, que lit ZONE_EDITION_SELECTEURS. Une vérification bon marché pour
    // un défaut qui a mordu douze fois.
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(300);
    exiger(await page.evaluate(() => window.app.appMode === 'edit'), 'on est bien en mode Modification');
    await page.evaluate(() => { if (document.getElementById('song-settings').hidden) window.app.toggleSongSettings(true); });
    await page.waitForTimeout(300);
    const bGroove = await page.locator('#groove').boundingBox();
    if (exiger(!!bGroove, 'un réglage du panneau est atteignable')) {
        await page.mouse.click(bGroove.x + bGroove.width / 2, bGroove.y + bGroove.height / 2);
        await page.waitForTimeout(300);
        check(await page.evaluate(() => window.app.appMode === 'edit'),
            'cliquer dans le panneau flottant ne sort PAS du mode Modification');
        await page.keyboard.press('Escape'); // referme la liste déroulante native éventuelle
        await page.waitForTimeout(200);
    }

    // F2. La suggestion de tonalité s'ouvre DEPUIS ce panneau : elle doit passer DEVANT lui. Un
    // menu qui s'ouvrirait derrière serait invisible sans que rien ne le signale.
    await page.evaluate(() => { if (document.getElementById('song-settings').hidden) window.app.toggleSongSettings(true); });
    await page.waitForTimeout(300);
    await page.click('#key-suggest-btn');
    await page.waitForTimeout(400);
    const menu = await page.evaluate(() => {
        const el = document.getElementById('key-suggest-menu');
        const pan = document.getElementById('song-settings');
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
    if (menu.ouvert) {
        check(menu.devant,
            `la suggestion de tonalité passe DEVANT le panneau — z-index ${menu.zMenu} contre ${menu.zPanneau}${menu.devant ? '' : ', le clic atteint ' + menu.voleur}`);
    } else {
        // Pas d'échec ici : la suggestion ne s'affiche que si la grille est assez claire pour en
        // proposer une. On le dit, plutôt que de faire semblant d'avoir mesuré.
        check(false, 'la suggestion de tonalité n\'a rien proposé pour cette grille — superposition non éprouvée');
    }

    console.log('\n=== G. Le panneau ne doit JAMAIS recouvrir l\'accord en cours d\'édition ===');
    // Acquis explicite, antérieur à ce lot : « on peut régler le tempo sans perdre de vue l'accord
    // qu'on est en train d'éditer » (voir toggleSongSettings dans script.js). Le premier placement de
    // ce lot — sous l'ancre, le réflexe pour un popover — le cassait sans bruit : mesuré à 96 % de la
    // carte de l'accord recouverte sur grand écran. C'est un banc qui l'a rattrapé, pas l'œil ; d'où
    // cette vérification, sur les DEUX formats, car le défaut n'existait que sur l'un des deux.
    const chevauchement = async (p, contexte) => {
        await p.evaluate(() => { window.app.editChord(0, 1); });
        await p.waitForTimeout(300);
        await p.evaluate(() => window.app.toggleSongSettings(true));
        await p.waitForTimeout(400);
        const r = await p.evaluate(() => {
            const pan = document.getElementById('song-settings').getBoundingClientRect();
            const ac = document.getElementById('accord-card');
            const acr = ac.getBoundingClientRect();
            const ox = Math.max(0, Math.min(pan.right, acr.right) - Math.max(pan.left, acr.left));
            const oy = Math.max(0, Math.min(pan.bottom, acr.bottom) - Math.max(pan.top, acr.top));
            const aire = acr.width * acr.height;
            return { cachee: ac.hidden, part: aire > 0 ? Math.round(ox * oy / aire * 100) : 0 };
        });
        check(!r.cachee && r.part === 0,
            `${contexte} : le panneau ne recouvre pas la carte de l'accord édité — ${r.part} % recouverts`);
    };
    await chevauchement(page, 'ordinateur');

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
