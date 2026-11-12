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
const R = require('./_retrait_ancien');
const { estBruitReseau } = require('./_harness');

plan(11);

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
    const ouvrir = async (viewport, extra = {}) => {
        const page = await browser.newPage({ viewport, ...extra });
        page.on('dialog', (d) => d.accept());
        page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
        page.on('console', (msg) => { if (msg.type() === 'error' && !estBruitReseau(msg.text()) && !/AudioContext/.test(msg.text())) errors.push('console.error: ' + msg.text()); });
        await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
        await page.evaluate(graine);
        await page.reload({ waitUntil: 'load' });
        await page.waitForTimeout(500);
        return page;
    };

    // TÉLÉPHONE — RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11, « réécriture courte ») : la feuille « Notes » du téléphone emportait le dernier calque
    // Voix (fonctions dans les notes, chemin des voix, son zoom et son pincement). Comme à l'ordinateur (plus bas), ce qui reste : les couleurs des rôles, dans
    // le séquenceur de l'onglet Rythme du panneau d'accord, ouvert par « Séquenceur » du panneau Lecture.
    console.log('\n=== TÉLÉPHONE (860px) : plus de calque Voix ; l\'onglet Rythme garde les couleurs des rôles ===');
    {
        const pt = await ouvrir({ width: 860, height: 1000 }, { hasTouch: true, isMobile: true });
        let r = await R.porteTelephoneAbsente(pt);
        check(r.ok, `la feuille « Notes » et son calque Voix ont quitté le téléphone (${r.detail})`);
        check(!(await pt.locator('#toggle-voice-leading').isVisible()), 'l\'icône ⊱ n\'y est pas non plus');
        r = await R.ouvrirRythmeTel(pt);
        exiger(r.ok, `« Séquenceur » du panneau Lecture ouvre l'onglet Rythme (${r.detail})`);
        check(await pt.evaluate(() => document.querySelectorAll('.seq-voix-trait, .seq-note-fn, .voice-leading-panel').length === 0), 'ni trait du chemin des voix, ni chiffre de fonction, ni ancien panneau');
        r = await R.couleursRoles(pt, 0);
        check(r.ok, `les notes y gardent les couleurs de leur rôle (${r.detail})`);
        await pt.close();
    }

    // ======================================================================================================
    // ORDINATEUR — RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11, « réécriture courte ») : la conduite de voix pendant les opérations de partie (calque Voix, chemin des voix, loupe, zoom) a disparu
    // de l'ordinateur avec l'éditeur de notes (« le chemin des voix est supprimé », décision du 11/11). Restent les couleurs des rôles au séquenceur du bloc « Vues ».
    console.log('\n=== ORDINATEUR : plus de calque Voix ; le séquenceur garde les couleurs des rôles ===');
    {
        const pg = await ouvrir({ width: 1280, height: 1000 });
        let r = await R.porteAbsente(pg);
        check(r.ok, `l'éditeur de notes et son calque Voix ont quitté l'ordinateur (${r.detail})`);
        check(!(await pg.locator('#toggle-voice-leading').isVisible()), 'l\'icône ⊱ n\'y est pas non plus');
        r = await R.ouvrirNouveau(pg);
        exiger(r.ok, `le séquenceur s'ouvre (${r.detail})`);
        check(await pg.evaluate(() => document.querySelectorAll('.seq-voix-trait, .seq-note-fn, .voice-leading-panel').length === 0), 'ni trait du chemin des voix, ni chiffre de fonction, ni ancien panneau');
        r = await R.couleursRoles(pg, 0);
        check(r.ok, `les notes gardent les couleurs de leur rôle (${r.detail})`);
        await pg.close();
    }

    check(errors.length === 0, 'aucune erreur (' + JSON.stringify(errors) + ')');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
