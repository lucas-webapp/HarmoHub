// Trois défauts signalés ensemble sur la vue plein écran, et trois causes distinctes.
//
// 1. « Lorsque je sélectionne une barre dans le séquenceur, elle n'est pas du tout centrée [...] elle
//    apparaît à la base du séquenceur. » La vue continue affiche TOUJOURS les soixante demi-tons de
//    l'étendue (voir .seq-cell-free), dont la moitié seulement tient à l'écran — et scrollTop restait à
//    0, c'est-à-dire tout en haut, sur les notes les plus AIGUËS. Un accord en octave 3 se retrouvait
//    donc collé en bas de la bande. Mesuré avant correction : barre à 66 % de la hauteur, scrollTop à 0.
//    Il existait bien un centrage, mais sur le seul axe HORIZONTAL (centrerSurAccordEdite).
//
// 2. « Lorsque je scroll verticalement, le défilement se fait par à-coups et n'est pas très fluide. Sur
//    GarageBand le défilement est doux. » Ce n'était pas une animation à ajouter, c'était l'animation du
//    navigateur qu'on retirait : le gestionnaire de molette faisait preventDefault() puis
//    `scrollTop += e.deltaY`, remplaçant le défilement natif — animé, avec inertie — par un saut sec de
//    la valeur brute du cran, ~100px d'un coup. Le banc vérifie donc que l'appli NE PREND PLUS la main
//    sur l'axe vertical, et qu'une vraie molette fait bien défiler la bande (et non la page).
//
// 3. « Il y a des problèmes d'affichage des diagrammes d'accords. » Masquer le piano ne masquait que
//    #piano-viz ; sa COLONNE #piano-col restait dans la rangée flex avec sa `width: 100%` — mesuré,
//    165px de large pour 0px de haut — et poussait le diagramme de guitare jusqu'à le faire DÉBORDER de
//    sa carte (carte 1029→1273, guitare 1152→1338). Guitare seule affichée : diagramme décentré et
//    coupé à droite.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('centrage vertical, molette, diagrammes');
plan(19);

const mk = (root, quality, octave) => ({ root, quality, beats: 4, inversion: 0, drop: 0, octave, bass: null, playStyle: 'held' });

(async () => {
    const browser = await chromium.launch();
    const errors = [];

    const ouvrir = async (page, piano, guitare, chords) => {
        await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
        await page.waitForTimeout(200);
        await page.evaluate(({ pi, gu, c }) => {
            localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'S', chords: c }] }));
            localStorage.removeItem('harmohubSeqDockHeight');
            localStorage.setItem('harmohubShowPiano', pi);
            localStorage.setItem('harmohubShowGuitar', gu);
        }, { pi: piano, gu: guitare, c: chords });
        await page.reload({ waitUntil: 'load' });
        await page.waitForTimeout(500);
        await page.evaluate(() => window.app.editChord(0, 0));
        await page.waitForTimeout(250);
        await page.click('#grid-zoom');
        await page.waitForTimeout(800);
    };

    console.log('=== 1. Les hauteurs jouées sont CENTRÉES dans la bande, quelle que soit l\'octave ===');
    const page = await browser.newPage({ viewport: { width: 1905, height: 900 } });
    page.on('pageerror', (e) => errors.push('centrage: ' + e.message));
    // Trois octaves très différentes : le centrage doit suivre l'accord, pas le milieu de l'étendue.
    await ouvrir(page, '0', '0', [mk('C', 'min', 3), mk('A', 'maj', 3), mk('C', 'min', 5), mk('A', 'min', 2)]);

    const centrage = async (index) => {
        await page.evaluate((i) => window.app.editChordFromSequencer(0, i), index);
        await page.waitForTimeout(700);
        return page.evaluate(() => {
            const sc = document.querySelector('#arp-sequencer .seq-scroll');
            const notes = [...sc.querySelectorAll('.seq-note')];
            if (!notes.length) return null;
            const rs = sc.getBoundingClientRect();
            let haut = Infinity, bas = -Infinity;
            for (const n of notes) { const r = n.getBoundingClientRect(); haut = Math.min(haut, r.top); bas = Math.max(bas, r.bottom); }
            return {
                nbNotes: notes.length,
                ecartAuCentre: Math.round(Math.abs((haut + bas) / 2 - rs.top - rs.height / 2)),
                toutVisible: haut >= rs.top - 1 && bas <= rs.bottom + 1,
                scrollTop: Math.round(sc.scrollTop),
                scrollMax: Math.round(sc.scrollHeight - sc.clientHeight),
            };
        });
    };

    const oct3 = await centrage(1);
    console.log('A majeur octave 3 :', JSON.stringify(oct3));
    if (!exiger(!!oct3 && oct3.nbNotes > 0, 'les barres de l\'accord édité sont mesurables')) bilan();
    check(oct3.ecartAuCentre <= 8, `octave 3 : les hauteurs jouées sont centrées dans la bande (écart ${oct3.ecartAuCentre}px)`);
    check(oct3.scrollTop > 0, `la bande a bien été défilée pour y arriver, elle ne reste plus en haut de l'étendue (scrollTop ${oct3.scrollTop})`);
    check(oct3.toutVisible, 'et aucune barre de l\'accord n\'est coupée');

    const oct2 = await centrage(3);
    console.log('A mineur octave 2 :', JSON.stringify(oct2));
    check(oct2.ecartAuCentre <= 8, `octave 2 : centré aussi, plus bas dans l'étendue (écart ${oct2.ecartAuCentre}px)`);
    check(oct2.scrollTop > oct3.scrollTop, `un accord plus GRAVE fait descendre la vue (${oct3.scrollTop} -> ${oct2.scrollTop})`);

    const oct5 = await centrage(2);
    console.log('C mineur octave 5 :', JSON.stringify(oct5));
    // Bornes du conteneur : un accord tout en haut de l'étendue ne PEUT pas être centré, scrollTop ne
    // descend pas sous 0. Ce qui compte alors est qu'il soit entièrement visible, pas au pixel près.
    check(oct5.scrollTop === 0 || oct5.ecartAuCentre <= 8,
        `octave 5 : soit centré, soit calé en haut de l'étendue faute de pouvoir défiler plus (scrollTop ${oct5.scrollTop})`);
    check(oct5.toutVisible, 'et il reste entièrement visible dans les deux cas');

    console.log('=== 2. La molette VERTICALE est laissée au navigateur (défilement fluide) ===');
    const molette = await page.evaluate(() => {
        const sc = document.querySelector('#arp-sequencer .seq-scroll');
        const ev = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
        sc.dispatchEvent(ev);
        return { intercepte: ev.defaultPrevented, peutV: sc.scrollHeight > sc.clientHeight };
    });
    console.log(JSON.stringify(molette));
    if (exiger(molette.peutV, 'la bande déborde bien verticalement, il y a de quoi défiler')) {
        check(!molette.intercepte,
            "l'appli ne fait plus preventDefault() sur la molette verticale : c'est le navigateur qui défile, avec sa propre animation");
    }
    // Et il faut que ça défile VRAIMENT : ne rien intercepter ne sert à rien si le navigateur fait
    // défiler la page derrière au lieu de la bande.
    const avant = await page.evaluate(() => ({ bande: Math.round(document.querySelector('#arp-sequencer .seq-scroll').scrollTop), page: Math.round(window.scrollY) }));
    const centre = await page.evaluate(() => { const r = document.querySelector('#arp-sequencer .seq-scroll').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; });
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.wheel(0, 150);
    await page.waitForTimeout(400);
    const apres = await page.evaluate(() => ({ bande: Math.round(document.querySelector('#arp-sequencer .seq-scroll').scrollTop), page: Math.round(window.scrollY) }));
    console.log('molette réelle :', JSON.stringify({ avant, apres }));
    check(apres.bande > avant.bande, `une vraie molette fait défiler la BANDE (${avant.bande} -> ${apres.bande})`);
    check(apres.page === avant.page, `et pas la page derrière (${apres.page})`);
    await page.close();

    console.log('=== 3. Diagrammes : la guitare seule tient centrée dans sa carte ===');
    for (const [piano, guitare, nom] of [['0', '1', 'guitare seule'], ['1', '0', 'piano seul'], ['1', '1', 'les deux']]) {
        const p = await browser.newPage({ viewport: { width: 1905, height: 900 } });
        p.on('pageerror', (e) => errors.push(`${nom}: ` + e.message));
        await ouvrir(p, piano, guitare, [mk('C', 'min', 3), mk('A', 'maj', 3)]);
        await p.evaluate(() => window.app.editChordFromSequencer(0, 1));
        await p.waitForTimeout(500);
        const d = await p.evaluate(() => {
            const bo = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) }; };
            const carte = bo('.viz-card');
            const visibles = [...document.querySelectorAll('.viz-diagrams > *')]
                .filter(e => e.getBoundingClientRect().width > 0)
                .map(e => ({ q: e.id, ...e.getBoundingClientRect().toJSON() }));
            // La BASCULE compte dans le contenu de la carte : depuis qu'elle est passée à côté des
            // diagrammes (voir plus bas), c'est l'ensemble des deux qui doit être centré.
            const bascule = [...document.querySelectorAll('.viz-toggle')]
                .filter(e => e.getBoundingClientRect().width > 0)
                .map(e => ({ q: 'viz-toggle', ...e.getBoundingClientRect().toJSON() }));
            const contenu = visibles.concat(bascule);
            return {
                carte,
                visibles: visibles.map(v => ({ q: v.q, l: Math.round(v.left), r: Math.round(v.right) })),
                bascule: bascule.map(v => ({ l: Math.round(v.left), r: Math.round(v.right) })),
                // Aucune colonne de diagramme masquée ne doit garder de largeur : c'était la cause.
                debordent: visibles.filter(v => v.left < carte.l - 1 || v.right > carte.r + 1).map(v => v.q),
                ecartCentre: contenu.length
                    ? Math.round(Math.abs((Math.min(...contenu.map(v => v.left)) + Math.max(...contenu.map(v => v.right))) / 2 - (carte.l + carte.r) / 2))
                    : null,
            };
        });
        console.log(nom.padEnd(14), JSON.stringify(d));
        check(d.debordent.length === 0,
            `${nom} : aucun diagramme ne déborde de sa carte — fautifs ${JSON.stringify(d.debordent)}`);
        // CETTE MESURE PORTAIT SUR LES SEULS DIAGRAMMES, ET ELLE EST DEVENUE FAUSSE — pas parce que
        // l'appli s'est cassée, mais parce que la disposition qu'elle décrivait a changé sur demande :
        // la bascule piano/guitare, autrefois EMPILÉE sous les diagrammes (donc sans effet sur le
        // centrage horizontal), est passée À CÔTÉ d'eux pour rendre 42px de hauteur au séquenceur
        // (« les diagrammes d'accords ouverts prennent trop de place en hauteur »). Les diagrammes
        // seuls sont donc désormais décalés de (70px de bascule + 14px de gap) / 2 = 42px vers la
        // gauche du centre de la carte — mesuré : exactement 42px dans les trois cas, ce qui confirme
        // que rien d'autre n'a bougé. Ce qui doit rester centré, c'est le CONTENU de la carte.
        check(d.ecartCentre !== null && d.ecartCentre <= 3,
            `${nom} : l'ensemble diagrammes + bascule est centré dans la carte (écart ${d.ecartCentre}px)`);
        await p.close();
    }

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
