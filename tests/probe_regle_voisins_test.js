const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// Retour utilisateur (3 points) :
// 1. « Je n'aime pas trop la représentation des accords voisins sous forme de petites barres.
//     Garder le séquenceur réel des accords à proximité. »
// 2. « La règle de mesure est complètement incohérente. Je rappelle qu'elle doit suivre la section
//     de grille en entier. »
// 3. « La règle de mesure doit être en dehors du quadrillage pour mieux la voir (cf. autres DAW) »
let PASS = 0, FAIL = 0;
const check = (c, l) => { if (c) { PASS++; console.log('PASS - ' + l); } else { FAIL++; console.log('FAIL - ' + l); } };

const SCR = __dirname + '/';

async function ouvrir(page) {
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 0, octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            mk('C', 'maj', 4), mk('A', 'min7', 4), mk('D', 'min7', 2), mk('G', '7', 6), mk('C', 'maj7', 4)] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.evaluate(() => window.app.editChord(0, 1));
    await page.waitForTimeout(300);
    await page.click('#grid-zoom');
    await page.waitForTimeout(600);
}

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/fonts\.googleapis|fonts\.gstatic|ERR_/.test(m.text())) errors.push('console: ' + m.text()); });

    await ouvrir(page);

    console.log('--- 1. Les accords voisins montrent leur VRAI séquenceur, pas un chapelet de pastilles ---');
    const voisins = await page.evaluate(() => {
        const grille = document.querySelector('.seq-grid-continuous');
        const lire = el => {
            const gc = el.style.gridColumn;
            const m = gc.match(/^(\d+)\s*\/\s*span\s*(\d+)$/);
            return m ? { debut: +m[1], len: +m[2] } : { debut: +gc, len: 1 };
        };
        const ctx = [...grille.querySelectorAll('.seq-ctx-note')].map(lire);
        const notes = [...grille.querySelectorAll('.seq-note')].map(lire);
        const par = arr => arr.reduce((a, n) => { a[n.len] = (a[n.len] || 0) + 1; return a; }, {});
        const styleCtx = ctx.length ? getComputedStyle(grille.querySelector('.seq-ctx-note')) : null;
        const styleNote = notes.length ? getComputedStyle(grille.querySelector('.seq-note')) : null;
        return {
            nbCtx: ctx.length, nbNotes: notes.length,
            longueursCtx: par(ctx), longueursNotes: par(notes),
            maxCtx: Math.max(...ctx.map(c => c.len)),
            aucunAncienRepere: grille.querySelectorAll('.seq-ctx-cell').length === 0,
            // Même langage visuel : arrondi, bordure, étendue verticale de la ligne.
            radiusCtx: styleCtx && styleCtx.borderRadius, radiusNote: styleNote && styleNote.borderTopLeftRadius,
            hauteurCtx: styleCtx && Math.round(parseFloat(styleCtx.height)),
            hauteurNote: styleNote && Math.round(parseFloat(styleNote.height)),
            opaciteCtx: styleCtx && +styleCtx.opacity, opaciteNote: styleNote && +styleNote.opacity,
            // Comparaison la plus dure : une barre de contexte et une barre éditée SUR LA MÊME LIGNE.
            // Les styles calculés peuvent concorder alors que les rectangles réels diffèrent (une marge
            // propre au contexte décalait la barre de 2px et la raccourcissait de 4px, tout en gonflant
            // la hauteur de la ligne).
            memeLigne: (() => {
                const par = {};
                [...grille.querySelectorAll('.seq-ctx-note')].forEach(e => { (par[e.style.gridRow] = par[e.style.gridRow] || {}).ctx = e; });
                [...grille.querySelectorAll('.seq-note')].forEach(e => { (par[e.style.gridRow] = par[e.style.gridRow] || {}).note = e; });
                const c = Object.values(par).find(v => v.ctx && v.note);
                if (!c) return null;
                const r = e => { const b = e.getBoundingClientRect(); return { h: +b.height.toFixed(1), t: +b.top.toFixed(1) }; };
                return { ctx: r(c.ctx), note: r(c.note) };
            })(),
        };
    });
    console.log(JSON.stringify(voisins));
    check(voisins.aucunAncienRepere, 'plus une seule ancienne pastille .seq-ctx-cell');
    // 5 accords de 4/4/2/6/4 temps sur un motif tenu : chaque voix voisine doit tenir en UNE barre par
    // accord, pas en une pastille par double croche (216 avant, mesuré).
    check(voisins.nbCtx > 0 && voisins.nbCtx < 40,
        `les voisins tiennent en quelques barres, plus en chapelet — ${voisins.nbCtx} barres (216 avant)`);
    check(voisins.maxCtx > 1 && !voisins.longueursCtx[1],
        `aucune barre de contexte réduite à une double croche isolée — la plus longue fait ${voisins.maxCtx} pas`);
    check(voisins.radiusCtx === '4px' && voisins.radiusNote === '4px',
        `même arrondi que les notes éditables — ${voisins.radiusCtx} / ${voisins.radiusNote}`);
    check(voisins.hauteurCtx === voisins.hauteurNote,
        `même hauteur de barre que l'accord édité — ${voisins.hauteurCtx}px / ${voisins.hauteurNote}px`);
    check(voisins.opaciteCtx < voisins.opaciteNote,
        `mais plus pâles : ${voisins.opaciteCtx} contre ${voisins.opaciteNote}`);
    check(voisins.memeLigne && voisins.memeLigne.ctx.h === voisins.memeLigne.note.h
        && voisins.memeLigne.ctx.t === voisins.memeLigne.note.t,
        `sur une même ligne, barre voisine et barre éditée occupent le MÊME rectangle — ${JSON.stringify(voisins.memeLigne)}`);

    // Le rythme réel doit être respecté : deux attaques séparées restent deux barres. On pose un
    // motif haché sur l'accord 0 puis on revient éditer l'accord 1 pour le regarder de l'extérieur.
    console.log('--- 1-bis. Deux attaques séparées restent deux barres (le rythme n\'est pas lissé) ---');
    const rythme = await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('myProgression'));
        // Une attaque sèche par temps, jamais liée, sur les 3 voix du 1er accord (4 temps = 16 doubles
        // croches). Le motif n'est relu que si `seqEdited` est posé ET s'il est écrit dans `arpPattern`
        // au format attendu par parseSeqPattern ("0,1,2" par case, ";" entre cases, "t" = liée) —
        // sinon resolveSeqPatternForData retombe sur le preset de playStyle et le motif forcé est ignoré.
        const cases = Array.from({ length: 16 }, (_, i) => (i % 4 === 0 ? '0,1,2' : ''));
        s.sections[0].chords[0].arpPattern = cases.join(';');
        s.sections[0].chords[0].seqEdited = true;
        localStorage.setItem('myProgression', JSON.stringify(s));
        return true;
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.evaluate(() => window.app.editChord(0, 1));
    await page.waitForTimeout(300);
    await page.click('#grid-zoom');
    await page.waitForTimeout(600);
    const haché = await page.evaluate(() => {
        const grille = document.querySelector('.seq-grid-continuous');
        // Segment du 1er accord : colonnes 2..17 (16 doubles croches, gouttière en colonne 1).
        const dans = [...grille.querySelectorAll('.seq-ctx-note')].filter(el => {
            const c = parseInt(el.style.gridColumn, 10);
            return c >= 2 && c <= 17;
        });
        return { nb: dans.length, len: [...new Set(dans.map(el => (el.style.gridColumn.match(/span (\d+)/) || [0, 1])[1]))] };
    });
    console.log(JSON.stringify(haché));
    check(haché.nb >= 8 && haché.len.join() === '1',
        `un motif haché donne bien des barres séparées d'une double croche — ${haché.nb} barres de ${haché.len.join('/')} pas`);

    // Retour à un morceau propre pour la suite
    await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('myProgression'));
        delete s.sections[0].chords[0].arpPattern; delete s.sections[0].chords[0].seqEdited;
        localStorage.setItem('myProgression', JSON.stringify(s));
    });
    await ouvrir(page);

    console.log('--- 2. La règle numérote des MESURES, de façon cohérente, sur toute la section ---');
    const regle = await page.evaluate(() => {
        const grille = document.querySelector('.seq-grid-continuous');
        const labels = [...grille.querySelectorAll('.seq-beat-label')];
        const lus = labels.filter(l => {
            const sp = l.querySelector('.seq-beat-num');
            return sp && +getComputedStyle(sp).opacity > 0.05;
        }).map(l => l.querySelector('.seq-beat-num').textContent);
        const cols = labels.map(l => +l.style.gridColumn);
        const nbCol = getComputedStyle(grille).gridTemplateColumns.split(' ').length;
        const bande = grille.querySelector('.seq-ruler-band');
        const br = bande && bande.getBoundingClientRect();
        const gr = grille.getBoundingClientRect();
        return {
            suiteLue: lus.join(' '),
            nbLabels: labels.length,
            premiereCol: Math.min(...cols), derniereCol: Math.max(...cols), nbCol,
            bandeExiste: !!bande,
            bandeLargeur: br && Math.round(br.width), grilleLargeur: Math.round(gr.width),
            bandeGauche: br && Math.round(br.left - gr.left),
        };
    });
    console.log(JSON.stringify(regle));
    // 4+4+2+6+4 = 20 temps = 5 mesures à 4/4. Une règle de mesure lit « 1 2 3 4 5 », point.
    check(regle.suiteLue === '1 2 3 4 5',
        `la règle se lit comme une suite de mesures — « ${regle.suiteLue} » (avant : « 1 2 3 4 2 2 3 4 3 ... »)`);
    check(regle.nbLabels === 20, `une graduation par temps, toujours — ${regle.nbLabels} pour 20 temps`);
    // « Elle doit suivre la section de grille en entier » : premières et dernières colonnes couvertes.
    check(regle.premiereCol === 2 && regle.derniereCol === regle.nbCol - 3,
        `graduations du tout premier au tout dernier temps de la section — colonnes ${regle.premiereCol}..${regle.derniereCol} sur ${regle.nbCol}`);
    check(regle.bandeExiste && regle.bandeGauche === 0 && regle.bandeLargeur === regle.grilleLargeur,
        `un bandeau continu couvre la section entière — ${regle.bandeLargeur}px sur ${regle.grilleLargeur}px`);

    console.log('--- 2-ter. Les numéros de la règle sont les MÊMES que ceux de la grille d\'accords ---');
    // « Elle doit suivre la section de grille en entier » : suivre la section, c'est aussi compter
    // comme elle. Les repères de mesure de la grille d'accords (.row-measure) et ceux de la règle du
    // séquenceur doivent donner la même suite pour la même partie — sinon on lit deux morceaux.
    const accord = await page.evaluate(() => {
        const grille = document.querySelector('.seq-grid-continuous');
        const regle = [...grille.querySelectorAll('.seq-beat-label[data-mesure]')]
            .map(l => l.dataset.mesure);
        // La grille affiche en plus le numéro de la mesure QUI SUIT le dernier accord (voir
        // .row-measure-end) : c'est un aperçu, pas une mesure de la partie — on l'écarte.
        // Tri par POSITION (ligne puis colonne) et non par ordre du DOM : ces repères sont émis avec
        // leur accord, si bien que celui qui ouvre la ligne suivante précède dans le DOM celui qui
        // termine la ligne du dessus — mesuré « 1 2 3 5 4 » alors qu'on lit bien « 1 2 3 4 » puis « 5 ».
        const gril = [...document.querySelectorAll('#progression-sections .row-measure:not(.row-measure-end)')]
            .map(e => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim(), y: Math.round(r.top), x: Math.round(r.left) }; })
            .sort((a, b) => a.y - b.y || a.x - b.x)
            .map(o => o.t);
        return { regle, gril };
    });
    console.log(JSON.stringify(accord));
    check(accord.regle.join(' ') === accord.gril.join(' '),
        `règle du séquenceur et grille d'accords comptent pareil — « ${accord.regle.join(' ')} » contre « ${accord.gril.join(' ')} »`);

    console.log('--- 2-bis. Le chiffre du temps revient pendant un geste (repère « où est le temps 4 ») ---');
    const surbrillance = await page.evaluate(() => {
        const l = [...document.querySelectorAll('.seq-grid-continuous .seq-beat-label')].find(x => !x.hasAttribute('data-mesure'));
        const sp = l.querySelector('.seq-beat-num');
        const avant = +getComputedStyle(sp).opacity;
        l.classList.add('seq-beat-reached');
        // Le chiffre apparaît en fondu (transition CSS) : getComputedStyle lu tout de suite renvoie la
        // valeur de DÉPART de la transition, pas celle visée — d'où l'attente avant la seconde lecture.
        return new Promise(r => setTimeout(() => {
            const apres = +getComputedStyle(sp).opacity;
            const couleur = getComputedStyle(sp).color;
            l.classList.remove('seq-beat-reached');
            r({ avant, apres, couleur, texte: sp.textContent });
        }, 250));
    });
    console.log(JSON.stringify(surbrillance));
    check(surbrillance.avant < 0.05 && surbrillance.apres > 0.9,
        `le numéro de temps ${surbrillance.texte} est masqué au repos et réapparaît au geste — ${surbrillance.avant} -> ${surbrillance.apres}`);

    console.log('--- 3. La règle est EN DEHORS du quadrillage ---');
    const dehors = await page.evaluate(() => {
        const grille = document.querySelector('.seq-grid-continuous');
        const cs = getComputedStyle(grille);
        const bande = grille.querySelector('.seq-ruler-band');
        const hRegle = parseFloat(cs.getPropertyValue('--seq-ruler-h'));
        const label = grille.querySelector('.seq-beat-label');
        const cbande = getComputedStyle(bande);
        return {
            hRegle,
            fondY: cs.backgroundPosition.split(',').map(p => p.trim().split(' ')[1]),
            fondTaille: cs.backgroundSize.split(',').map(p => p.trim()),
            fondRepeat: cs.backgroundRepeat.split(',').map(r => r.trim()),
            hauteurBande: Math.round(bande.getBoundingClientRect().height),
            hauteurLabel: Math.round(label.getBoundingClientRect().height),
            bandeOpaque: cbande.background.includes('rgb'),
            labelSansFond: getComputedStyle(label).backgroundImage === 'none',
            zBande: cbande.zIndex, zLabel: getComputedStyle(label).zIndex,
            collante: cbande.position,
        };
    });
    console.log(JSON.stringify(dehors));
    check(dehors.fondY.every(y => y === dehors.hRegle + 'px'),
        `le quadrillage démarre sous la règle, pas en haut de la grille — y = ${dehors.fondY[0]}`);
    check(dehors.fondRepeat.every(r => r === 'repeat-x') && dehors.fondTaille.every(t => /100%/.test(t)),
        `...et ne se recopie pas au-dessus — ${dehors.fondRepeat[0]}, ${dehors.fondTaille[0]}`);
    check(dehors.hauteurBande === dehors.hRegle && dehors.hauteurLabel === dehors.hRegle,
        `bandeau et graduations à la même hauteur que la variable — ${dehors.hauteurBande}/${dehors.hauteurLabel} pour ${dehors.hRegle}px`);
    check(dehors.labelSansFond && dehors.bandeOpaque,
        'les étiquettes ne peignent plus leur propre fond : le bandeau seul fait corps de règle');
    check(dehors.collante === 'sticky' && +dehors.zBande > 6,
        `le bandeau reste collé en haut et passe devant la gouttière — ${dehors.collante}, z=${dehors.zBande}`);

    // Vérification par les pixels : la première ligne du quadrillage ne doit pas traverser la règle.
    const pixels = await page.evaluate(() => {
        const grille = document.querySelector('.seq-grid-continuous');
        const gr = grille.getBoundingClientRect();
        const h = parseFloat(getComputedStyle(grille).getPropertyValue('--seq-ruler-h'));
        // Une barre de mesure tombe toutes les --seq-bar-w. On regarde ce qu'il y a à cette abscisse,
        // une fois DANS la règle et une fois juste en dessous.
        const barW = parseFloat(getComputedStyle(grille).getPropertyValue('--seq-bar-w'));
        const labelW = parseFloat(getComputedStyle(grille).getPropertyValue('--seq-label-w'));
        const x = gr.left + labelW + barW + 1;
        return { x, yDansRegle: gr.top + h / 2, ySousRegle: gr.top + h + 20, hRegle: h };
    });
    // La règle doit être l'élément touché dans sa bande, la grille (donc son quadrillage) en dessous.
    const quiEstLa = await page.evaluate(({ x, yDansRegle, ySousRegle }) => {
        const nom = el => el ? (el.className || el.tagName) : 'rien';
        return {
            dansRegle: nom(document.elementFromPoint(x, yDansRegle)),
            sousRegle: nom(document.elementFromPoint(x, ySousRegle)),
        };
    }, pixels);
    console.log(JSON.stringify(quiEstLa));
    check(/seq-(beat-label|ruler-band|beat-offbeat)/.test(quiEstLa.dansRegle),
        `dans la bande de la règle, c'est bien la règle qu'on touche — ${quiEstLa.dansRegle}`);

    console.log('--- 4. Curseur de lecture et zones de navigation ne mordent plus sur la règle ---');
    const lignes = await page.evaluate(() => {
        const grille = document.querySelector('.seq-grid-continuous');
        const nbVoix = grille.querySelectorAll('.seq-label').length;
        const ph = grille.querySelector('.seq-playhead');
        const nav = grille.querySelector('.seq-ctx-nav');
        return { nbVoix, playhead: ph.style.gridRow, nav: nav && nav.style.gridRow };
    });
    console.log(JSON.stringify(lignes));
    check(lignes.playhead === `2 / span ${lignes.nbVoix}`,
        `le curseur couvre les ${lignes.nbVoix} hauteurs et rien d'autre — ${lignes.playhead}`);
    check(lignes.nav === `2 / span ${lignes.nbVoix}`,
        `la zone « modifier cet accord » ne recouvre plus la règle (où l'on glisse pour défiler) — ${lignes.nav}`);

    await page.screenshot({ path: SCR + 'regle_APRES_desktop.png' });
    const clip = await page.evaluate(() => {
        const g = document.querySelector('.seq-scroll-continuous');
        const r = g.getBoundingClientRect();
        return { x: r.x, y: r.y, width: Math.min(r.width, 900), height: Math.min(r.height, 240) };
    });
    await page.screenshot({ path: SCR + 'regle_APRES_zoom.png', clip });

    console.log('--- 5. Le petit séquenceur garde ses NUMÉROS DE TEMPS (1 2 3 4) ---');
    await page.click('#grid-zoom'); // referme le volet continu
    await page.waitForTimeout(300);
    await page.click('#toggle-sequencer');
    await page.waitForTimeout(500);
    const petit = await page.evaluate(() => {
        const g = document.querySelector('#arp-sequencer .seq-grid');
        if (!g) return { absent: true };
        const nums = [...g.querySelectorAll('.seq-beat-label .seq-beat-num')].map(s => s.textContent);
        return {
            continu: g.classList.contains('seq-grid-continuous'),
            suite: nums.join(' '),
            visibles: [...g.querySelectorAll('.seq-beat-label .seq-beat-num')].every(s => +getComputedStyle(s).opacity > 0.5),
            bande: g.querySelectorAll('.seq-ruler-band').length,
        };
    });
    console.log(JSON.stringify(petit));
    check(!petit.continu && petit.suite === '1 2 3 4' && petit.visibles,
        `le petit séquenceur compte toujours en temps, tous visibles — « ${petit.suite} »`);
    check(petit.bande === 0, 'pas de bandeau de règle dans le petit séquenceur (il ne couvre qu\'un accord)');

    console.log('--- 6. Mobile ---');
    const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    mob.on('pageerror', e => errors.push('mobile pageerror: ' + e.message));
    await ouvrir(mob);
    const surMobile = await mob.evaluate(() => {
        const grille = document.querySelector('.seq-grid-continuous');
        if (!grille) return { absent: true };
        const labels = [...grille.querySelectorAll('.seq-beat-label')];
        const lus = labels.filter(l => +getComputedStyle(l.querySelector('.seq-beat-num')).opacity > 0.05)
            .map(l => l.querySelector('.seq-beat-num').textContent);
        const bande = grille.querySelector('.seq-ruler-band');
        const cs = getComputedStyle(grille);
        const ctx = [...grille.querySelectorAll('.seq-ctx-note')];
        return {
            suite: lus.join(' '),
            bandeLargeur: bande && Math.round(bande.getBoundingClientRect().width),
            grilleLargeur: Math.round(grille.getBoundingClientRect().width),
            fondY: cs.backgroundPosition.split(',')[0].trim().split(' ')[1],
            hRegle: cs.getPropertyValue('--seq-ruler-h').trim(),
            nbCtx: ctx.length,
            ctxUnPas: ctx.filter(c => !/span/.test(c.style.gridColumn)).length,
        };
    });
    console.log(JSON.stringify(surMobile));
    check(surMobile.suite === '1 2 3 4 5', `même règle de mesures sur téléphone — « ${surMobile.suite} »`);
    check(surMobile.bandeLargeur === surMobile.grilleLargeur,
        `le bandeau couvre toute la section sur téléphone — ${surMobile.bandeLargeur}px sur ${surMobile.grilleLargeur}px`);
    check(surMobile.fondY === surMobile.hRegle, `quadrillage sous la règle sur téléphone — ${surMobile.fondY}`);
    check(surMobile.nbCtx > 0 && surMobile.ctxUnPas === 0,
        `voisins en vraies barres sur téléphone — ${surMobile.nbCtx} barres, aucune d'une seule case`);
    await mob.screenshot({ path: SCR + 'regle_APRES_mobile.png' });

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript');
    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
