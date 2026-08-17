// Le séquenceur CONTINU dans son volet sous la grille : mise en page attendue, et surtout aucun
// verrouillage du défilement de la page.
//
// CE FICHIER N'ÉTAIT PAS UN BANC. Il affichait sept mesures en JSON et se terminait par
// `process.exit(0)` : pas une seule assertion, aucun chemin d'échec. Il ne pouvait donc RIEN
// signaler, quoi qu'il arrive — et il comptait pourtant dans l'inventaire comme un banc de plus. Il
// appelait en outre app.closeGridZoom(), disparue avec la vue plein écran, ce qui aurait fait mourir
// n'importe quel banc réel à cet endroit. Les mesures qu'il prenait étaient les bonnes ; il ne leur
// manquait qu'un verdict. C'est ce qu'on ajoute ici.
//
// L'ENJEU DU VERROUILLAGE. Les fenêtres agrandies posent .body-scroll-locked pour empêcher la page
// de défiler derrière elles (voir lockBodyScroll). Le volet, lui, vit DANS la page : s'il verrouillait
// aussi, la page entière deviendrait immobile alors que rien ne la recouvre — l'appli paraîtrait
// figée. C'est exactement ce que ce fichier mesurait sans jamais l'affirmer.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('séquenceur continu en volet');
plan(12);

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
    page.on('console', (msg) => {
        const t = msg.type();
        if (t === 'error' || t === 'warning') {
            const text = msg.text();
            if (text.includes('Failed to load resource') || text.includes('AudioContext was not allowed')) return;
            errors.push(t + ': ' + text);
        }
    });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const sections = [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' },
            { root: 'A', quality: 'min7', beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' },
            { root: 'F', quality: 'maj7', beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' },
        ] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);

    const verrou = () => page.evaluate(() => ({
        classe: document.body.classList.contains('body-scroll-locked'),
        overflow: getComputedStyle(document.body).overflow,
    }));

    const avant = await verrou();
    check(!avant.classe, `au repos, .body-scroll-locked n'est pas posée sur le corps de page (overflow calculé : « ${avant.overflow} »)`);

    console.log('--- Ouvre le volet, édite l\'accord du MILIEU, inspecte la mise en page continue ---');
    await page.click('#grid-zoom');
    await page.waitForTimeout(500);
    await page.evaluate(() => window.app.editChordFromSequencer(0, 1));
    await page.waitForTimeout(600);

    const mise = await page.evaluate(() => {
        const hote = document.getElementById('arp-sequencer');
        const grille = hote.querySelector('.seq-grid');
        const defilant = hote.querySelector('.seq-scroll');
        return {
            colOffset: grille ? +grille.dataset.colOffset : null,
            colPx: grille ? +grille.dataset.colPx : null,
            scrollLeft: defilant ? Math.round(defilant.scrollLeft) : null,
            scrollWidth: defilant ? Math.round(defilant.scrollWidth) : null,
            clientWidth: defilant ? Math.round(defilant.clientWidth) : null,
            classeContinue: !!hote.querySelector('.seq-grid-continuous'),
            classeDefilementContinu: !!hote.querySelector('.seq-scroll-continuous'),
            // Nombre de colonnes du gabarit : 1 pour la gouttière des noms de note, puis une par
            // double croche de TOUTE la partie.
            colonnes: grille ? getComputedStyle(grille).gridTemplateColumns.split(' ').length : null,
            // Le contexte des accords VOISINS s'affiche en barres grisées, une par VOIX (les croches
            // liées d'une même voix ne forment qu'une barre, voir paintCtxSeg). On relève la colonne de
            // départ et la portée de chacune : c'est ce qui dit de quel côté de l'accord édité elle se
            // trouve, donc si l'on voit bien ce qui précède ET ce qui suit.
            ctx: [...hote.querySelectorAll('.seq-ctx-note')].map(e => {
                const m = /(\d+)\s*\/\s*span\s*(\d+)/.exec(e.style.gridColumn) || [];
                return { debut: +m[1], portee: +m[2] };
            }),
            ctxNav: hote.querySelectorAll('.seq-ctx-nav').length,
            cellules: hote.querySelectorAll('.seq-cell').length,
            dansVolet: document.getElementById('seq-dock-host').contains(hote),
        };
    });
    console.log(JSON.stringify(mise, null, 1));

    if (!exiger(mise.classeContinue && mise.classeDefilementContinu && mise.dansVolet,
        'le volet affiche bien la vue CONTINUE (.seq-grid-continuous + .seq-scroll-continuous dans #seq-dock-host)')) {
        bilan();
    }

    // L'accord du milieu commence après le premier : 4 temps x 4 doubles croches = 16 colonnes.
    check(mise.colOffset === 16,
        `la vue commence bien à la colonne de l'accord édité, pas au début de la partie (colOffset ${mise.colOffset}, attendu 16)`);
    check(mise.colPx > 0, `la largeur de colonne est bien publiée pour les gestes de zoom (colPx ${mise.colPx})`);
    // Trois accords de 4 temps = 48 doubles croches, plus la gouttière des noms de note. C'est
    // l'invariant de la vue « d'ensemble » : elle couvre TOUTE la partie, pas seulement l'accord édité.
    // (On ne vérifie pas que la partie dépasse la vue : à 14px la colonne, ces 48 pas tiennent dans
    // 1280px — il n'y a alors rien à défiler, et c'est correct.)
    check(mise.colonnes === 49,
        `la grille couvre toute la partie : 48 doubles croches + la gouttière des noms (${mise.colonnes} colonnes)`);
    check(mise.ctxNav === 2,
        `les deux zones de navigation (accord précédent / suivant) sont là — ${mise.ctxNav}`);
    // L'accord édité occupe les colonnes 18 à 33 (colOffset 16, +1 pour la gouttière, +1 car les
    // colonnes CSS comptent à partir de 1). Le contexte doit donc apparaître AVANT (colonne 2) et
    // APRÈS (colonne 34) : c'est la promesse de la vue continue, voir ce qui précède et ce qui suit.
    const avantAccord = mise.ctx.filter(c => c.debut === 2);
    const apresAccord = mise.ctx.filter(c => c.debut === 34);
    console.log('contexte :', JSON.stringify(mise.ctx));
    check(avantAccord.length > 0 && apresAccord.length > 0,
        `le contexte grisé apparaît des DEUX côtés de l'accord édité — ${avantAccord.length} voix avant, ${apresAccord.length} après`);
    // Chaque voisin est joué « held » : chacune de ses voix tient ses 4 temps entiers, soit 16 pas.
    check(mise.ctx.length > 0 && mise.ctx.every(c => c.portee === 16),
        `chaque barre de contexte couvre les 16 doubles croches de son accord (portées : ${[...new Set(mise.ctx.map(c => c.portee))].join(', ')})`);
    check(mise.cellules > 0, `la grille éditable de l'accord courant est bien dessinée (${mise.cellules} cases)`);

    console.log('--- Le volet vit DANS la page : il ne doit jamais verrouiller son défilement ---');
    const pendant = await verrou();
    console.log(JSON.stringify(pendant));
    check(!pendant.classe,
        `volet ouvert, .body-scroll-locked n'est toujours pas posée — c'est un volet EN PLACE, pas une fenêtre par-dessus (overflow calculé : « ${pendant.overflow} »)`);

    console.log('--- Referme par le même bouton ---');
    await page.click('#grid-zoom');
    await page.waitForTimeout(400);
    const apres = await page.evaluate(() => ({
        verrou: document.body.classList.contains('body-scroll-locked'),
        seqOpen: window.app.seqOpen,
        voletVisible: !document.getElementById('seq-dock-panel').hidden,
    }));
    console.log(JSON.stringify(apres));
    check(!apres.verrou && !apres.seqOpen && !apres.voletVisible,
        'refermé, le volet est masqué et aucun verrou de défilement ne subsiste');

    console.log('Errors:', JSON.stringify(errors, null, 2));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario');

    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
