// La conduite de voix face aux opérations sur les parties (monter, dupliquer, supprimer).
// CONTRAT ENTIÈREMENT CHANGÉ. Ce test décrivait UN PANNEAU PAR PARTIE : chaque partie avait son
// bouton, plusieurs panneaux pouvaient donc être ouverts, et il fallait vérifier que chacun
// « suivait » sa partie lors d'un échange — avec, en cas de doute, un repli sûr : tout refermer.
// Il n'y a plus qu'UN panneau, global (voir 9f9b0c9) : un seul étant de toute façon affiché à la
// fois, N boutons pour un seul résultat était du travail en trop, et « tout refermer » au moindre
// remaniement faisait perdre la vue qu'on venait d'ouvrir. Le panneau se rattache désormais à la
// partie ACTIVE et reste ouvert. Ce qui doit encore être vrai, et que ce test éprouve : il ne
// montre jamais une partie disparue, il ne se duplique pas, et rien ne plante.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.
let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    page.on('dialog', (d) => d.accept());
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);

    const twoChords = [
        { root: 'C', quality: 'maj7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
        { root: 'G', quality: 'dom7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
    ];
    await page.evaluate((chords) => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [
            { title: 'A', chords: chords.map(c => ({ ...c })) },
            { title: 'B', chords: chords.map(c => ({ ...c })) },
            { title: 'C', chords: chords.map(c => ({ ...c })) },
        ] }));
    }, twoChords);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);

    // Où se trouve le panneau unique, et dans quelle partie est-il posé ?
    const etat = () => page.evaluate(() => {
        const panneaux = [...document.querySelectorAll('.voice-leading-panel')];
        return {
            nombre: panneaux.length,
            ouvert: !!window.app.voiceLeadingOpen,
            partie: panneaux.map(p => {
                const s = p.closest('.prog-section');
                return s ? s.querySelector('.prog-title').value : '(hors partie)';
            }),
            titresExistants: [...document.querySelectorAll('.prog-title')].map(t => t.value),
        };
    });

    console.log('=== Un seul panneau, et il s\'ouvre sur la partie active ===');
    check((await etat()).nombre === 0, 'aucun panneau au départ');
    await page.click('#toggle-voice-leading');
    await page.waitForTimeout(300);
    let e = await etat();
    check(e.nombre === 1 && e.ouvert, `un panneau, un seul — obtenu ${JSON.stringify(e.partie)}`);
    check(e.titresExistants.includes(e.partie[0]),
        `...posé dans une partie qui existe vraiment — « ${e.partie[0]} »`);

    console.log('=== Faire MONTER une partie ne le fait ni disparaître ni se dédoubler ===');
    await page.click('.prog-section:nth-child(2) .prog-section-move-up');
    await page.waitForTimeout(300);
    e = await etat();
    check(e.nombre === 1 && e.ouvert,
        `le panneau reste ouvert après un échange de parties — obtenu ${e.nombre} panneau(x)`);
    check(e.titresExistants.includes(e.partie[0]),
        `...et toujours rattaché à une partie réelle, pas à un index périmé — « ${e.partie[0]} »`);

    console.log('=== Dupliquer une partie : toujours un seul panneau, toujours cohérent ===');
    await page.click('.prog-section:nth-child(1) .prog-section-duplicate');
    await page.waitForTimeout(300);
    e = await etat();
    check(e.nombre === 1, `pas de panneau en double après une duplication — obtenu ${e.nombre}`);
    check(e.titresExistants.includes(e.partie[0]),
        `...et il désigne une partie existante — « ${e.partie[0]} » parmi ${JSON.stringify(e.titresExistants)}`);

    console.log('=== Supprimer une partie : le panneau ne montre jamais une partie disparue ===');
    const supprimee = (await etat()).titresExistants[0];
    await page.click('.prog-section:nth-child(1) .prog-section-del');
    await page.waitForTimeout(300);
    e = await etat();
    check(!e.titresExistants.includes(supprimee), `la partie « ${supprimee} » a bien été supprimée`);
    check(e.nombre === 0 || e.titresExistants.includes(e.partie[0]),
        `le panneau s'est refermé, ou pointe une partie encore là — obtenu ${JSON.stringify(e.partie)}`);

    console.log('=== Aucune erreur JS pendant tout le scénario ===');
    check(errors.length === 0, 'aucune erreur (' + JSON.stringify(errors) + ')');

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
