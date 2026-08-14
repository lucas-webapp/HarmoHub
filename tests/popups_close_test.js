// Tous les popups se referment pareil : un clic à côté, ou Échap.
// Les six écouteurs « clic à côté » et les six lignes Échap ont fusionné dans une seule table
// (this._popups). Ce test existe pour ça : une consolidation qui laisserait UN popup au bord de la
// route ne se verrait pas à l'œil nu — on ne rouvre pas les six menus à chaque relecture.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(c, l) { if (c) { PASS++; console.log('PASS - ' + l); } else { FAIL++; console.log('FAIL - ' + l); } }

const cache = (page, id) => page.evaluate((i) => {
    const el = document.getElementById(i);
    return !el || el.hidden;
}, id);

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(900);
    await page.fill('#quick-add-input', 'C/Am/F/G');
    await page.click('#quick-add-btn');
    await page.waitForTimeout(600);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());

    const deplieReglages = async () => {
        if (await page.evaluate(() => document.getElementById('song-settings').hidden)) {
            await page.click('#song-summary');
            await page.waitForTimeout(250);
        }
    };

    // Chaque popup, avec le geste qui l'ouvre. Le menu contextuel s'ouvre au clic droit sur une case.
    const popups = [
        { id: 'file-menu', nom: 'menu Fichier', ouvre: async () => page.click('#file-menu-btn') },
        // Le bouton vit dans les réglages du morceau, qui sont repliés par défaut : on les déplie
        // s'il le faut avant de cliquer (et pas systématiquement — #song-summary est une bascule,
        // un clic de trop les refermerait).
        { id: 'key-suggest-menu', nom: 'suggestion de tonalité', ouvre: async () => { await deplieReglages(); await page.click('#key-suggest-btn'); } },
        // L'aide de l'ajout rapide a quitté les Paramètres pour la rangée du champ qu'elle explique
        // (retour utilisateur : « une aide n'est pas un réglage »). Elle s'ouvre donc depuis la page
        // elle-même, et le « clic à côté » est un clic ordinaire sur la page.
        {
            id: 'quick-add-help', nom: 'aide de l\'ajout rapide',
            ouvre: async () => {
                // Les Paramètres ne doivent plus être ouverts : ils masqueraient le champ.
                if (!(await page.evaluate(() => document.getElementById('settings-overlay').hidden))) {
                    await page.click('#settings-close');
                    await page.waitForTimeout(300);
                }
                await page.click('#quick-add-help-btn');
            },
        },
        { id: 'context-menu', nom: 'menu contextuel', ouvre: async () => page.click('.grid-cell[data-index="0"]', { button: 'right' }) },
    ];

    for (const p of popups) {
        console.log(`\n=== ${p.nom} ===`);
        // Repart d'une page propre : un popup ouvert dans une fenêtre modale masque la suivante.
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
        await p.ouvre();
        await page.waitForTimeout(350);
        check(!(await cache(page, p.id)), `${p.nom} : s'ouvre`);
        // Un clic loin de tout doit le refermer.
        if (p.aCote) await page.click(p.aCote);
        else await page.mouse.click(700, 960);
        await page.waitForTimeout(300);
        check(await cache(page, p.id), `${p.nom} : un clic à côté le referme`);

        await p.ouvre();
        await page.waitForTimeout(350);
        check(!(await cache(page, p.id)), `${p.nom} : se rouvre`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        check(await cache(page, p.id), `${p.nom} : Échap le referme aussi`);
    }

    console.log('\n=== Le clic qui OUVRE ne referme pas dans la foulée ===');
    // C'est le piège du motif : sans exclusion de l'ancre, le même pointerdown ouvre puis ferme.
    for (const id of ['file-menu', 'quick-add-help']) {
        const p = popups.find(x => x.id === id);
        await p.ouvre();
        await page.waitForTimeout(350);
        check(!(await cache(page, id)), `${p.nom} : reste ouvert après le clic qui l'ouvre`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(250);
    }

    // Un clic sur l'ICÔNE du bouton, pas sur le bouton : c'est le cas réel, et c'est celui qui
    // échappait à l'ancienne comparaison `e.target.id !== 'key-suggest-btn'`.
    await page.evaluate(() => { if (window.app.settingsOpen) window.app.closeSettings(); });
    await page.waitForTimeout(300);
    await deplieReglages();
    const surIcone = await page.evaluate(() => {
        const svg = document.querySelector('#key-suggest-btn svg, #key-suggest-btn *');
        return !!svg;
    });
    if (surIcone) {
        await page.click('#key-suggest-btn');
        await page.waitForTimeout(350);
        check(!(await cache(page, 'key-suggest-menu')),
            'la suggestion de tonalité s\'ouvre même quand le clic tombe sur l\'icône dans le bouton');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
    }

    await browser.close();
    check(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' — ' + errs[0] : ''));
    console.log(`\n=== ${PASS} PASS / ${FAIL} FAIL ===`);
    process.exit(FAIL ? 1 : 0);
})();
