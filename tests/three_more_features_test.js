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
const R = require('./_retrait_ancien');
plan(10);

const accord = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} });

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_CERT_AUTHORITY_INVALID|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });
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
    // On compare le NOM, pas le libellé entier : chaque option porte désormais « — <date> » derrière
    // le nom (ajouté avec la comparaison des versions à l'import, commit 7ea17c0). Figer le libellé
    // complet ici, c'était faire échouer ce banc pour un ajout qui ne le concerne pas — et ça a bien
    // fini par arriver.
    const attendu = [
        { label: 'Jazz', options: ['Song C'] },
        { label: 'Rock', options: ['Song B', 'Song A'] },
        { label: 'Sans dossier', options: ['Song D'] },
    ];
    const nomsSeuls = groupes.groupes.map(g => ({ label: g.label, options: g.options.map(o => o.split(' — ')[0]) }));
    check(JSON.stringify(nomsSeuls) === JSON.stringify(attendu),
        `les morceaux sont regroupés par dossier, dossiers en ordre alphabétique et morceaux du plus récent au plus ancien — ${JSON.stringify(nomsSeuls)}`);

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
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11) : la vue continue d'avant (« Éditeur de notes ») a quitté l'ordinateur. Le séquenceur du bloc « Vues »
    // ne défile JAMAIS de côté (toute la partie à l'écran, « pas de zoom ») : ses noms de notes, dans leur colonne de gauche, restent donc toujours visibles —
    // même avec un accord de 16 temps à côté d'un accord de 4.
    await R.ouvrirNouveau(page);
    const continu = await page.evaluate(() => {
        const g = document.getElementById('sq-grille'), noms = [...g.querySelectorAll('.sq-etiq')].filter(e => e.textContent.trim()), s = document.getElementById('sequenceur').getBoundingClientRect();
        return { trouve: noms.length > 0, deborde: g.scrollWidth - g.clientWidth, visibles: noms.every(n => { const b = n.getBoundingClientRect(); return b.left >= s.left - 1 && b.width > 0; }) };
    });
    console.log(JSON.stringify(continu));
    if (exiger(continu.trouve, 'les noms de note du séquenceur sont bien là')) {
        check(continu.deborde <= 1 && continu.visibles,
            `rien ne défile de côté (débord ${continu.deborde}px) : les noms restent toujours visibles à gauche`);
    }
    await R.cliquer(page, '#sq-fermer', 300);

    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4b, 12/11, décision « réécriture courte ») : le petit séquenceur de l'inspecteur — et ses deux cas, accord court
    // (rien à coller) et accord long (bande qui défile, noms collés) — a quitté l'ordinateur. Ce qu'ils gardaient, des noms toujours lisibles quelle que soit la durée
    // de l'accord, est tenu par le séquenceur du bloc « Vues » : il ne défile jamais de côté, l'accord de 16 temps choisi comme celui de 4.
    console.log('--- Plus de petit séquenceur ; accord long ou court, tout reste à l\'écran ---');
    const porte = await R.porteInspecteurAbsente(page, 0, 1);
    check(porte.ok, `plus de porte « Séquenceur » ni de petit séquenceur dans l'inspecteur (${porte.detail})`);
    await R.ouvrirNouveau(page);
    await R.cliquer(page, '#sq-grille .sq-nom[data-c="0"]');
    const tout = await R.toutePartie(page);
    check(tout.ok, `l'accord de 16 temps choisi, toute la partie reste à l'écran sans défiler de côté (${tout.detail})`);
    await R.cliquer(page, '#sq-fermer', 300);

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
