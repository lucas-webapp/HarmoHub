// Lot 4 bis-C : atteindre les motifs rythmiques depuis le tiroir.
//
// CE LOT DEVAIT ÊTRE UNE RANGÉE DE MOTIFS, ET IL NE L'EST PAS. En allant l'écrire, j'ai vérifié ce
// qui existait : PLAYSTYLE_OPTIONS (voir script.js) EST exactement l'ensemble des motifs que
// seqPreset() sait poser — tenu, rondes/blanches/noires/croches, liées ou détachées — et il est déjà
// offert par un menu d'icônes soigné, groupé « Lié (son continu) » / « Détaché (staccato) », avec des
// têtes de notes dessinées. Une rangée de motifs aurait donc été une SECONDE COPIE des neuf mêmes
// choix, dans le même panneau : exactement le reproche « Trop de volets déroulants et de boutons ?
// J'ai l'impression d'avoir fait une machine à clics ».
//
// LE VRAI MANQUE, MESURÉ. Sur iPhone 13 (fenêtre de 664px), le bouton qui ouvre ce menu se trouve à
// 630px — hors écran — et il y reste que le tiroir soit ouvert ou non. Autrement dit : au moment
// précis où l'on travaille le rythme, on ne peut plus changer de motif. Le lot ajoute donc UN
// raccourci vers le MÊME menu, dans la barre d'outils du tiroir, et seulement là — sur ordinateur le
// sélecteur d'origine est déjà sous les yeux, un second bouton y serait le doublon qu'on veut éviter.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Tiroir : atteindre les motifs rythmiques');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r, q, b, s) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: s || 'held' });
    const song = {
        id: 'lot4bisC', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight',
        sections: [{ title: 'Couplet', chords: [mk('C', 'maj7', 4), mk('F', 'maj', 4)] }],
    };
    localStorage.setItem('harmohubSongs', JSON.stringify([song]));
    localStorage.setItem('harmohubCurrentSongId', song.id);
    localStorage.setItem('myProgression', JSON.stringify({ sections: song.sections }));
};
const motifStocke = () => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[1].playStyle;

(async () => {
    plan(12);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];

    console.log('=== A. Téléphone : le raccourci existe DANS le tiroir, et il est atteignable ===');
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const m = await ctx.newPage();
    m.on('pageerror', e => erreurs.push('téléphone : ' + e.message));
    await m.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await m.waitForTimeout(300);
    await m.evaluate(seed);
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(700);

    // Sans tiroir, le raccourci ne doit pas exister : c'est une réponse à un problème qui n'existe
    // que dans le tiroir.
    check(await m.evaluate(() => !document.getElementById('seq-playstyle-btn')),
        'séquenceur fermé, aucun raccourci de motif n\'encombre l\'écran');

    await m.evaluate(() => { window.app.editChord(0, 1); window.app.toggleSequencer('compact'); });
    await m.waitForTimeout(1100);

    const bouton = await m.evaluate(() => {
        const b = document.getElementById('seq-playstyle-btn');
        if (!b) return { present: false };
        const r = b.getBoundingClientRect();
        const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return {
            present: true,
            dansEcran: r.top >= 0 && r.bottom <= window.innerHeight,
            atteignable: !!e && (e === b || b.contains(e) || e.contains(b)),
            dansTiroir: !!b.closest('.arp-seq.seq-tiroir'),
            taille: `${Math.round(r.width)}x${Math.round(r.height)}`,
            h: r.height, l: r.width,
        };
    });
    if (exiger(bouton.present, 'le raccourci de motif apparaît dans la barre d\'outils du tiroir')) {
        check(bouton.dansTiroir, 'il est bien DANS le tiroir, pas ailleurs sur la page');
        check(bouton.dansEcran && bouton.atteignable,
            `il est à l'écran et le clic l'atteint — ${bouton.taille}`);
        // Le bouton d'origine, lui, était mesuré à 630px sur une fenêtre de 664 : c'est ce qui
        // justifie ce lot. On vérifie que le nouveau ne reproduit pas le défaut.
        check(bouton.h >= 28 && bouton.l >= 24, `cible assez grande au doigt — ${bouton.taille}`);
    }

    console.log('\n=== B. Il ouvre le MÊME menu, et ce menu change vraiment le motif ===');
    // Le piège désamorcé avant de l'écrire : le gestionnaire de clic-à-côté du menu ferme dès qu'on
    // clique hors de #playstyle-dd. Le nouveau bouton étant ailleurs, il aurait refermé le menu dans
    // la foulée du clic qui l'ouvre — le banc l'aurait vu comme « le menu ne s'ouvre pas ».
    await m.click('#seq-playstyle-btn');
    await m.waitForTimeout(400);
    const menu = await m.evaluate(() => {
        const el = document.getElementById('playstyle-dd-menu');
        const r = el.getBoundingClientRect();
        return {
            ouvert: !el.hidden,
            items: el.querySelectorAll('.playstyle-dd-item').length,
            dansEcran: r.top >= -1 && r.bottom <= window.innerHeight + 1 && r.left >= -1 && r.right <= window.innerWidth + 1,
        };
    });
    if (exiger(menu.ouvert, 'le menu des motifs s\'ouvre depuis le tiroir (et ne se referme pas aussitôt)')) {
        check(menu.items >= 9, `c'est bien le menu complet, pas un sous-ensemble — ${menu.items} motifs`);
        check(menu.dansEcran, 'et il tient entièrement dans la fenêtre');

        const avant = await m.evaluate(motifStocke);
        // On choisit un motif différent de celui en place, quel qu'il soit.
        const cible = await m.evaluate((actuel) => {
            const items = [...document.querySelectorAll('.playstyle-dd-item')];
            const autre = items.find(i => i.dataset.value !== actuel);
            return autre ? autre.dataset.value : null;
        }, avant);
        if (exiger(!!cible, 'un autre motif que celui en place est proposé')) {
            await m.click(`.playstyle-dd-item[data-value="${cible}"]`);
            await m.waitForTimeout(500);
            check(await m.evaluate(motifStocke) === cible,
                `choisir un motif l'écrit dans l'accord — ${avant} → ${await m.evaluate(motifStocke)}`);
            check(await m.evaluate(() => document.getElementById('playstyle-dd-menu').hidden),
                'et le menu se referme après le choix');
            check(await m.evaluate(() => window.app.seqOpen === true),
                'le tiroir, lui, reste ouvert : on continue à travailler le rythme');
        }
    }
    await m.close();

    console.log('\n=== C. ORDINATEUR : pas de second bouton, le sélecteur d\'origine est déjà sous les yeux ===');
    // C'est la moitié du lot qui consiste à NE PAS faire quelque chose. Sans cette vérification,
    // quelqu'un « complétera » le raccourci en l'affichant partout, et recréera le doublon.
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(650);
    await page.evaluate(() => { window.app.editChord(0, 1); window.app.toggleSequencer('compact'); });
    await page.waitForTimeout(700);
    const bureau = await page.evaluate(() => {
        const t = document.getElementById('playstyle-dd-toggle');
        const r = t.getBoundingClientRect();
        const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return {
            raccourci: !!document.getElementById('seq-playstyle-btn'),
            origineAtteignable: r.top >= 0 && r.bottom <= window.innerHeight && !!e && (e === t || t.contains(e)),
        };
    });
    check(!bureau.raccourci, 'ordinateur : aucun raccourci en double dans le séquenceur');
    check(bureau.origineAtteignable, 'ordinateur : le sélecteur de motif d\'origine est bien atteignable, lui');

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
