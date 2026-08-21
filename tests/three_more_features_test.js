// Trois fonctions sans rapport entre elles, regroupées ici depuis le jour où elles ont été ajoutées :
//   1. le sélecteur de morceaux regroupe par dossier (<optgroup>), et reste plat si aucun dossier n'est utilisé ;
//   2. l'export MIDI demande « un seul fichier ou un par partie ? » — et seulement pour un morceau à
//      plusieurs parties ;
//   3. les noms de note du séquenceur restent collés à gauche dès que la vue défile horizontalement.
//
// CE FICHIER N'ÉTAIT PAS UN BANC. Il écrivait `console.log('PASS ...')` ou `console.log('FAIL')` sans
// jamais compter quoi que ce soit, sans code de sortie, et sans la ligne de bilan que la campagne
// cherche : run_all.sh le rangeait donc parmi les « CRASH » quel qu'ait été le résultat, et un vrai
// échec ici passait pour un incident d'outillage. Ses six verdicts sont devenus de vraies
// vérifications, comptées et exigibles.
//
// Son § 3 montait sa scène avec app.openGridZoom() + app.editChordFromGridZoom(), disparues avec la
// vue plein écran, puis app.closeGridZoom() pour revenir au séquenceur compact : trois appels morts.
// Il énonçait aussi la règle de travers — « compact = pas collant » — alors qu'elle suit ce qui DÉFILE :
// `.seq-scroll-continuous .seq-label, .seq-scroll-wide .seq-label`, et .seq-scroll-wide est justement
// un accord COMPACT trop long pour tenir sur une page. L'accord de 16 temps qu'il utilisait pour
// prouver « static en compact » est précisément le cas où le collant est voulu. Les deux compacts sont
// donc distingués ici.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.
const { check, exiger, plan, bilan } = require('./_harness')('trois fonctions supplémentaires');
plan(9);

const accord = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} });

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);

    console.log('=== 1. Sélecteur de morceaux regroupé par dossier ===');
    await page.evaluate(() => {
        localStorage.setItem('harmohubSongs', JSON.stringify([
            { id: 's1', name: 'Song A', savedAt: 3, folder: 'Rock', sections: [] },
            { id: 's2', name: 'Song B', savedAt: 4, folder: 'Rock', sections: [] },
            { id: 's3', name: 'Song C', savedAt: 2, folder: 'Jazz', sections: [] },
            { id: 's4', name: 'Song D', savedAt: 1, folder: null, sections: [] },
        ]));
        localStorage.setItem('harmohubFolders', JSON.stringify(['Rock', 'Jazz']));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    const groupes = await page.evaluate(() => {
        const select = document.getElementById('song-select');
        return {
            groupes: [...select.querySelectorAll('optgroup')].map(g => ({ label: g.label, options: [...g.querySelectorAll('option')].map(o => o.textContent) })),
            total: select.querySelectorAll('option').length,
        };
    });
    console.log(JSON.stringify(groupes, null, 1));
    // Dossiers classés par ordre alphabétique, morceaux du plus récent au plus ancien dans chacun.
    const attendu = [
        { label: 'Jazz', options: ['Song C'] },
        { label: 'Rock', options: ['Song B', 'Song A'] },
        { label: 'Sans dossier', options: ['Song D'] },
    ];
    check(JSON.stringify(groupes.groupes) === JSON.stringify(attendu),
        'les morceaux sont regroupés par dossier, dossiers en ordre alphabétique et morceaux du plus récent au plus ancien');

    console.log('--- Aucun dossier utilisé -> liste plate, sans <optgroup> ---');
    await page.evaluate(() => {
        localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Song A', savedAt: 1, folder: null, sections: [] }]));
        localStorage.setItem('harmohubFolders', JSON.stringify([]));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    const plat = await page.evaluate(() => {
        const select = document.getElementById('song-select');
        return { groupe: !!select.querySelector('optgroup'), options: select.querySelectorAll('option').length };
    });
    console.log(JSON.stringify(plat));
    // 2 options = l'invite « choisir un morceau » + le seul morceau enregistré.
    check(!plat.groupe && plat.options === 2, `liste plate quand aucun dossier n'est utilisé — ${plat.options} options, ${plat.groupe ? 'avec' : 'sans'} groupe`);

    console.log('=== 2. Export MIDI : un seul fichier ou un par partie ? ===');
    await page.evaluate((a) => {
        const sections = [{ title: 'Couplet', chords: [a.c] }, { title: '', chords: [a.g] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
        localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 'song1', name: 'MultiSection', savedAt: 1, sections }]));
        localStorage.setItem('harmohubCurrentSongId', 'song1');
    }, { c: accord('C', 'maj', 4), g: accord('G', 'maj', 4) });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.evaluate(() => { window.app.exportMidi(); });
    await page.waitForTimeout(300);
    check(await page.evaluate(() => document.getElementById('midi-export-modal').hidden) === false,
        'la question est bien posée pour un morceau à plusieurs parties');
    await page.click('#midi-export-cancel');
    await page.waitForTimeout(200);

    console.log('--- Repère de partie SANS TITRE : nom de repli dans le fichier MIDI ---');
    const reperes = await page.evaluate(() => {
        const octets = window.app.buildMidiFile();
        // On relit les octets en latin-1 pour y retrouver le texte des repères de position.
        let s = '';
        for (let i = 0; i < octets.length; i++) s += String.fromCharCode(octets[i]);
        return { couplet: s.includes('Couplet'), partie2: s.includes('Partie 2') };
    });
    console.log(JSON.stringify(reperes));
    check(reperes.couplet && reperes.partie2,
        'un repère est présent pour la partie TITRÉE comme pour celle sans titre (« Partie 2 » en repli)');

    console.log('--- Morceau à UNE seule partie : pas de question, export direct ---');
    await page.evaluate((c) => {
        const sections = [{ title: '', chords: [c] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
        localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 'song2', name: 'SingleSection', savedAt: 1, sections }]));
        localStorage.setItem('harmohubCurrentSongId', 'song2');
    }, accord('C', 'maj', 4));
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    let telechargement = false;
    page.once('download', () => { telechargement = true; });
    await page.evaluate(() => { window.app.exportMidi(); });
    await page.waitForTimeout(500);
    const modaleCachee = await page.evaluate(() => document.getElementById('midi-export-modal').hidden);
    console.log('modale cachée :', modaleCachee, '| téléchargement :', telechargement);
    check(modaleCachee === true && telechargement, 'une seule partie : aucune question, le fichier part directement');

    console.log('=== 3. Noms de note collants dans la vue continue ===');
    await page.evaluate((a) => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: '', chords: [a.long, a.court] }] }));
    }, { long: accord('C', 'maj7', 16), court: accord('G', 'maj', 4) });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(250);
    await page.click('#grid-zoom');       // volet du séquenceur CONTINU
    await page.waitForTimeout(800);
    const continu = await page.evaluate(() => {
        const nom = document.querySelector('.seq-scroll-continuous .seq-label');
        if (!nom) return { trouve: false };
        const cs = getComputedStyle(nom);
        return { trouve: true, position: cs.position, left: cs.left, fond: cs.backgroundColor };
    });
    console.log(JSON.stringify(continu));
    if (exiger(continu.trouve, 'les noms de note de la vue continue sont bien là')) {
        check(continu.position === 'sticky',
            `ils restent collés à gauche quand on défile (position « ${continu.position} »)`);
    }

    // La règle n'est PAS « continu = collant, compact = pas collant » : elle suit ce qui DÉFILE
    // horizontalement. `.seq-scroll-continuous .seq-label, .seq-scroll-wide .seq-label` — et
    // .seq-scroll-wide est justement un accord COMPACT trop long pour tenir sur une page (voir
    // wideCompact dans renderSequencer). Le banc d'origine vérifiait « static en compact » sur un
    // accord de 16 temps, c'est-à-dire précisément le cas où le collant est voulu. On distingue donc
    // les deux compacts.
    console.log('--- Séquenceur COMPACT, accord qui TIENT sur une page : rien à coller ---');
    await page.evaluate(() => window.app.toggleSequencer('compact'));   // bascule de mode sans refermer (voir toggleSequencer)
    await page.waitForTimeout(600);
    await page.evaluate(() => window.app.editChordFromSequencer(0, 1)); // le G, 4 temps : tient
    await page.waitForTimeout(500);
    const compactCourt = await page.evaluate(() => {
        const nom = document.querySelector('#arp-sequencer .seq-label');
        return {
            mode: window.app.seqMode,
            position: nom ? getComputedStyle(nom).position : null,
            large: !!document.querySelector('#arp-sequencer .seq-scroll-wide'),
        };
    });
    console.log(JSON.stringify(compactCourt));
    check(compactCourt.mode === 'compact' && !compactCourt.large && compactCourt.position === 'static',
        `accord court en compact : rien ne défile, donc rien n'est collé — mode « ${compactCourt.mode} », position « ${compactCourt.position} »`);

    console.log('--- Séquenceur COMPACT, accord trop LONG pour une page : collant aussi ---');
    await page.evaluate(() => window.app.editChordFromSequencer(0, 0)); // le Cmaj7 de 16 temps : déborde
    await page.waitForTimeout(500);
    const compactLong = await page.evaluate(() => {
        const nom = document.querySelector('#arp-sequencer .seq-label');
        return {
            mode: window.app.seqMode,
            position: nom ? getComputedStyle(nom).position : null,
            large: !!document.querySelector('#arp-sequencer .seq-scroll-wide'),
        };
    });
    console.log(JSON.stringify(compactLong));
    check(compactLong.mode === 'compact' && compactLong.large && compactLong.position === 'sticky',
        `accord long en compact : la bande défile, donc les noms restent collés — large ${compactLong.large}, position « ${compactLong.position} »`);

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
