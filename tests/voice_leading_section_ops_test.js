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
// jamais une partie disparue (la bande des accords de sa règle est celle d'une partie qui existe), et rien ne plante. Sur TÉLÉPHONE (< 900px),
// rien ne bouge avant le lot 10 : la partie A rejoue le contrat d'origine à 860px (depuis le lot 10c par le menu ⋯ de l'en-tête, comme à l'ordinateur).
// Les parties ont des accords DIFFÉRENTS, pour que « la bonne partie » se lise dans ce que le calque affiche.
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable, bruit filtré (estBruitReseau).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('conduite de voix et opérations sur les parties');
const { estBruitReseau } = require('./_harness');

plan(19);

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

    // ======================================================================================================
    console.log('\n=== A. TÉLÉPHONE (860px) : le panneau d\'avant, contrat d\'origine ===');
    let page = await ouvrir({ width: 860, height: 1000 });
    const etat = () => page.evaluate(() => {
        const panneaux = [...document.querySelectorAll('.voice-leading-panel')];
        return {
            nombre: panneaux.length,
            ouvert: !!window.app.voiceLeadingOpen,
            partie: panneaux.map(p => { const s = p.closest('.prog-section'); return s ? s.querySelector('.prog-title').value : '(hors partie)'; }),
            titresExistants: [...document.querySelectorAll('.prog-title')].map(t => t.value),
        };
    });
    check((await etat()).nombre === 0, 'aucun panneau au départ');
    await page.click('#toggle-voice-leading');
    await page.waitForTimeout(300);
    let e = await etat();
    check(e.nombre === 1 && e.ouvert, `un panneau, un seul — obtenu ${JSON.stringify(e.partie)}`);
    check(e.titresExistants.includes(e.partie[0]), `...posé dans une partie qui existe vraiment — « ${e.partie[0]} »`);
    // Réécrit au lot 10c : au téléphone aussi, les outils de partie sont passés dans le menu ⋯ de l'en-tête (celui du lot 5c, à 44px) —
    // monter, dupliquer, supprimer s'y font comme à l'ordinateur. Le panneau ⊱ d'avant, lui, reste au téléphone jusqu'au lot 10f.
    const parMenuTel = async (n, action) => { await page.click(`.prog-section:nth-child(${n}) .prog-section-menu`); await page.waitForTimeout(150); await page.click(`#partie-menu [data-partie-action="${action}"]`); };
    exiger(await page.locator('.prog-section:nth-child(2) .prog-section-menu').isVisible(), 'le menu ⋯ de la partie est là, sous 900px');
    await parMenuTel(2, 'monter');
    await page.waitForTimeout(300);
    e = await etat();
    check(e.nombre === 1 && e.ouvert, `le panneau reste ouvert après un échange de parties — obtenu ${e.nombre} panneau(x)`);
    check(e.titresExistants.includes(e.partie[0]), `...et toujours rattaché à une partie réelle, pas à un index périmé — « ${e.partie[0]} »`);
    await parMenuTel(1, 'dupliquer');
    await page.waitForTimeout(300);
    e = await etat();
    check(e.nombre === 1, `pas de panneau en double après une duplication — obtenu ${e.nombre}`);
    check(e.titresExistants.includes(e.partie[0]), `...et il désigne une partie existante — « ${e.partie[0]} » parmi ${JSON.stringify(e.titresExistants)}`);
    const supprimee = (await etat()).titresExistants[0];
    await parMenuTel(1, 'supprimer');
    await page.waitForTimeout(400);
    e = await etat();
    check(e.titresExistants.length === 3, `une partie de moins (${JSON.stringify(e.titresExistants)}, la première était « ${supprimee} »)`);
    check(e.nombre === 0 || e.titresExistants.includes(e.partie[0]), `le panneau s'est refermé, ou pointe une partie encore là — obtenu ${JSON.stringify(e.partie)}`);
    await page.close();

    // ======================================================================================================
    console.log('\n=== B. ORDINATEUR (1280px) : le calque Voix, éditeur ouvert ===');
    page = await ouvrir({ width: 1280, height: 1000 });
    // Ce que montre le calque, comparé à la partie que l'appli dit active : la bande des accords doit être EXACTEMENT ses accords.
    const calque = () => page.evaluate(() => {
        const sec = loadProgressionSections()[window.app.activeSection];
        const attendu = sec ? sec.chords.map(c => chordSymbolForData(c, window.app.useFlatsForRoot(c.root))) : [];
        const vu = [...document.querySelectorAll('#arp-sequencer .seq-voix-accord .seq-voix-nom')].filter(n => n.offsetParent !== null).map(n => n.textContent);
        const ed = window.app.editingIndex, traits = document.querySelectorAll('#arp-sequencer .seq-voix-trait').length;
        const calques = document.querySelectorAll('#arp-sequencer .seq-grid-voix').length;
        // COHÉRENT = jamais une partie disparue. Une opération sur les parties termine l'édition de l'accord (déjà vrai avant le lot 9c, vérifié sur
        // le commit d'avant) : l'éditeur montre alors l'accord seul, sans partie autour — donc un seul nom, aucun trait. Sinon, la bande des accords
        // est EXACTEMENT celle de la partie active.
        const coherent = calques <= 1 && (calques === 0 || (ed == null ? (vu.length <= 1 && traits === 0) : JSON.stringify(vu) === JSON.stringify(attendu)));
        return { vu, attendu, coherent, ed, parties: loadProgressionSections().map(s => s.title), calques, ouvert: window.app.seqMode === 'continu' };
    });
    const parMenu = async (n, action) => { await page.click(`.prog-section:nth-child(${n}) .prog-section-menu`); await page.waitForTimeout(150); await page.click(`#partie-menu [data-partie-action="${action}"]`); };
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
    check(c.coherent, `le calque s'est retiré, ou ne montre que ce qui est encore là (${c.vu.join(' ')} / ${c.attendu.join(' ')})`);
    check(await page.evaluate(() => !document.querySelector('.voice-leading-panel')), 'aucun ancien panneau à l\'ordinateur');
    await page.close();

    check(errors.length === 0, 'aucune erreur (' + JSON.stringify(errors) + ')');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
