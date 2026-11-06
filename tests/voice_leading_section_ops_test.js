// La conduite de voix face aux opérations sur les parties (monter, dupliquer, supprimer).
// CONTRAT ENTIÈREMENT CHANGÉ. Ce test décrivait UN PANNEAU PAR PARTIE : chaque partie avait son
// bouton, plusieurs panneaux pouvaient donc être ouverts, et il fallait vérifier que chacun
// « suivait » sa partie lors d'un échange — avec, en cas de doute, un repli sûr : tout refermer.
// Il n'y a plus qu'UN panneau, global (voir 9f9b0c9) : un seul étant de toute façon affiché à la
// fois, N boutons pour un seul résultat était du travail en trop, et « tout refermer » au moindre
// remaniement faisait perdre la vue qu'on venait d'ouvrir. Le panneau se rattache désormais à la
// partie ACTIVE et reste ouvert. Ce qui doit encore être vrai, et que ce test éprouve : il ne
// montre jamais une partie disparue, il ne se duplique pas, et rien ne plante.
//
// RÉÉCRIT POUR LE NOUVEAU GESTE (lot 9c). Sur ORDINATEUR, la conduite de voix est le calque Voix de l'éditeur de notes (docs/refonte.md) : la
// partie B rejoue les trois opérations, éditeur ouvert et calque allumé, par le menu ⋯ de l'en-tête (lot 5c) — le calque reste unique, ne montre
// jamais une partie disparue (la bande des accords de sa règle est celle d'une partie qui existe), et rien ne plante. Depuis le 06/11 (décision du
// 05/11, point 5), l'édition reste OUVERTE après chaque opération : la bande est celle de la partie active, les traits des voix sont là. Sur TÉLÉPHONE (< 900px),
// rien ne bouge avant le lot 10 : la partie A rejoue le contrat d'origine à 860px (depuis le lot 10c par le menu ⋯ de l'en-tête, comme à l'ordinateur).
// Les parties ont des accords DIFFÉRENTS, pour que « la bonne partie » se lise dans ce que le calque affiche.
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable, bruit filtré (estBruitReseau).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('conduite de voix et opérations sur les parties');
const { estBruitReseau } = require('./_harness');

plan(17);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' });
    localStorage.setItem('myProgression', JSON.stringify({ sections: [
        { title: 'A', chords: [mk('C', 'maj7'), mk('G', 'dom7')] },
        { title: 'B', chords: [mk('D', 'min7'), mk('A', 'dom7')] },
        { title: 'C', chords: [mk('F', 'maj7'), mk('E', 'min7')] },
    ] }));
    localStorage.removeItem('harmohubSeqVoix');
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const browser = await chromium.launch();
    const errors = [];
    const ouvrir = async (viewport) => {
        const page = await browser.newPage({ viewport });
        page.on('dialog', (d) => d.accept());
        page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
        page.on('console', (msg) => { if (msg.type() === 'error' && !estBruitReseau(msg.text()) && !/AudioContext/.test(msg.text())) errors.push('console.error: ' + msg.text()); });
        await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
        await page.evaluate(graine);
        await page.reload({ waitUntil: 'load' });
        await page.waitForTimeout(500);
        return page;
    };

    // Lot 10f : le téléphone a le MÊME éditeur et le même calque que l'ordinateur (l'ancien panneau ⊱ n'existe plus) : mêmes vérifications aux deux largeurs.
    for (const [nom, larg] of [['TÉLÉPHONE (860px)', 860], ['ORDINATEUR (1280px)', 1280]]) {
        // ======================================================================================================
        console.log(`\n=== ${nom} : le calque Voix, éditeur ouvert ===`);
        const page = await ouvrir({ width: larg, height: 1000 });
        // Ce que montre le calque, comparé à la partie que l'appli dit active : la bande des accords doit être EXACTEMENT ses accords.
        const calque = () => page.evaluate(() => {
            const sec = loadProgressionSections()[window.app.activeSection];
            const attendu = sec ? sec.chords.map(c => chordSymbolForData(c, window.app.useFlatsForRoot(c.root))) : [];
            const vu = [...document.querySelectorAll('#arp-sequencer .seq-voix-accord .seq-voix-nom')].filter(n => n.offsetParent !== null).map(n => n.textContent);
            const ed = window.app.editingIndex, traits = document.querySelectorAll('#arp-sequencer .seq-voix-trait').length;
            const calques = document.querySelectorAll('#arp-sequencer .seq-grid-voix').length;
            // COHÉRENT = jamais une partie disparue, et l'édition reste OUVERTE. Jusqu'au 06/11, une opération sur les parties terminait l'édition de
            // l'accord (l'éditeur montrait alors l'accord seul) ; décision du 05/11 (point 5) : « une opération de partie garde l'édition ouverte » —
            // la bande des accords est donc EXACTEMENT celle de la partie active, et un accord est en cours (sous-lot « Éditeur et clavier »).
            const coherent = calques === 1 && ed != null && JSON.stringify(vu) === JSON.stringify(attendu) && traits > 0;
            return { vu, attendu, coherent, ed, parties: loadProgressionSections().map(s => s.title), calques, ouvert: window.app.seqMode === 'continu' };
        });
        // Téléphone : le menu ⋯ de la partie est sous la feuille plein écran (on ne le touche pas) : le clic lui est envoyé sans passer par l'écran ;
        // à l'ordinateur, vrais clics. Ce que le banc vérifie — le calque après l'opération — se lit à l'écran dans les deux cas.
        const cliquer = (sel) => larg < 900 ? page.locator(sel).dispatchEvent('click') : page.click(sel);
        const parMenu = async (n, action) => { await cliquer(`.prog-section:nth-child(${n}) .prog-section-menu`); await page.waitForTimeout(150); await cliquer(`#partie-menu [data-partie-action="${action}"]`); };
        await page.click('#progression-sections .grid-cell[data-section="1"][data-index="0"]');
        await page.waitForTimeout(300);
        await page.click('#grid-zoom');
        await page.waitForTimeout(900);
        await page.click('#editeur-notes-voix');
        await page.waitForTimeout(700);
        let c = await calque();
        exiger(c.ouvert && c.calques === 1 && JSON.stringify(c.vu) === JSON.stringify(['Dm7', 'A7']), `le calque s'ouvre sur la partie B, la seule (${c.vu.join(' ')})`);
        await parMenu(2, 'monter');
        await page.waitForTimeout(500);
        c = await calque();
        check(c.coherent, `après un échange de parties, un seul calque, qui ne montre que ce qui existe (${c.vu.join(' ')} — accord en cours : ${c.ed})`);
        check(!c.vu.includes('Cmaj7') && !c.vu.includes('G7'), '...et rien de la partie A, qui a pris l\'ancien index de B');
        await parMenu(1, 'dupliquer');
        await page.waitForTimeout(500);
        c = await calque();
        check(c.calques <= 1, `pas de calque en double après une duplication (${c.calques})`);
        check(c.coherent, `...et il ne montre que ce qui existe (${c.vu.join(' ')} parmi ${c.parties.join(', ')})`);
        await parMenu(1, 'supprimer');
        await page.waitForTimeout(600);
        c = await calque();
        check(c.parties.length === 3, `une partie de moins (${c.parties.join(', ')})`);
        check(c.coherent, `l'édition reste ouverte, et le calque ne montre que ce qui est encore là (${c.vu.join(' ')} / ${c.attendu.join(' ')})`);
        check(await page.evaluate(() => !document.querySelector('.voice-leading-panel')), 'aucun ancien panneau');
        await page.close();

    }

    check(errors.length === 0, 'aucune erreur (' + JSON.stringify(errors) + ')');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
