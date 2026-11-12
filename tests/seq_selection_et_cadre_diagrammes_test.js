// Deux retours du même message, deux sujets sans rapport l'un avec l'autre.
//
// 1. « Finalement le centrage de la barre sélectionnée était une mauvaise idée, ou alors c'est mal
//    modifié. Je pense que ça va me gêner pour sélectionner plusieurs barres en même temps. En plus, la
//    barre se recentre également en horizontal, ce que je ne voulais pas produire. Regarde si tu peux
//    l'améliorer facilement, sinon on enlève cette option (cf. GarageBand pour essayer de reproduire le
//    même système). »
//    Ce n'était PAS le centrage d'ouverture qu'il fallait retirer : c'était l'absence de préservation
//    du défilement VERTICAL à la repeinture. Mesuré avant correction : on défile la bande à
//    scrollLeft 744 / scrollTop 203, on clique une barre, et la bande revient à scrollTop 0 — tout en
//    haut de l'étendue — pendant que scrollLeft, lui, était bien rendu à sa place. Comme dans
//    GarageBand, SÉLECTIONNER NE DÉPLACE RIEN ; c'est OUVRIR un accord qui cadre la vue.
//
// 2. « Les diagrammes d'accords ouverts prennent trop de place en hauteur. Les boutons diagrammes
//    peuvent facilement être décalés j'ai l'impression, et tout l'ensemble peut facilement être décalé
//    vers le bas. Le contour rectangulaire de l'ensemble des diagrammes est une bonne idée, par contre
//    les diagrammes dépassent du cadre. »
//    Deux causes distinctes là aussi. La hauteur : la bascule piano/guitare était EMPILÉE sous les
//    diagrammes, 42px (10 de gap + 32 de boutons) pris à la colonne où la hauteur est la ressource
//    rare, alors que la largeur y est abondante. Le débordement : .viz-card est en width:fit-content
//    mais max-width:100%, et .viz-diagrams était en flex-wrap:nowrap sur ordinateur — dès que la place
//    manque, le cadre s'arrête à 100 % pendant que ses enfants gardent leur taille et sortent des deux
//    côtés (mesuré : 4px de chaque côté à 400px de large, 84px à 240px).
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('sélection sans déplacement, cadre des diagrammes');
plan(16);

const mk = (root, quality, octave, beats) => ({ root, quality, beats: beats || 4, inversion: 0, drop: 0, octave, bass: null, playStyle: 'held' });

const R = require('./_retrait_ancien');
(async () => {
    const browser = await chromium.launch();
    const errors = [];

    const ouvrir = async (page, chords, piano, guitare) => {
        await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
        await page.waitForTimeout(200);
        await page.evaluate(({ c, pi, gu }) => {
            localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'S', chords: c }] }));
            localStorage.removeItem('harmohubSeqDockHeight');
            localStorage.setItem('harmohubShowPiano', pi);
            localStorage.setItem('harmohubShowGuitar', gu);
        }, { c: chords, pi: piano, gu: guitare });
        await page.reload({ waitUntil: 'load' });
        await page.waitForTimeout(500);
    };

    // ---------------------------------------------------------------------------------------------
    console.log('=== 1. Sélectionner une barre ne déplace NI l\'axe vertical NI l\'horizontal ===');
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    page.on('pageerror', (e) => errors.push('sélection: ' + e.message));
    // Accords longs (16 temps) : la vue continue déborde alors des DEUX côtés, sinon un axe sans
    // débordement passerait le test sans rien prouver.
    await ouvrir(page, [mk('C', 'min', 3, 16), mk('A', 'maj', 3, 16), mk('F', 'maj7', 4, 16)], '0', '0');
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11, « réécriture courte ») : la vue continue (sa bande qui débordait des deux côtés, la barre qu'on
    // sélectionnait, le recadrage à l'accord suivant) était ouverte ici par toggleSequencer('continu'), un appel de programme : elle n'avait plus de porte depuis
    // la 4a, et l'appel ouvre désormais le séquenceur du bloc « Vues ». Là, rien ne défile ni ne se recadre : toute la partie est à l'écran, choisir un accord ne
    // déplace rien, et le séquenceur suit la sélection de la grille.
    let rr = await R.porteAbsente(page);
    check(rr.ok, `la vue continue n'a plus de porte (${rr.detail})`);
    rr = await R.ouvrirNouveau(page);
    check(rr.ok, `le séquenceur du bloc « Vues » s'ouvre (${rr.detail})`);
    rr = await R.toutePartie(page);
    check(rr.ok, `toute la partie est à l'écran : rien à faire défiler ni à recadrer (${rr.detail})`);
    const cadre0 = await page.evaluate(() => { const g = document.getElementById('sq-grille'); return [g.scrollLeft, g.scrollTop, Math.round(g.getBoundingClientRect().top)].join(','); });
    rr = await R.choisirParNom(page, 2);
    const cadre1 = await page.evaluate(() => { const g = document.getElementById('sq-grille'); return [g.scrollLeft, g.scrollTop, Math.round(g.getBoundingClientRect().top)].join(','); });
    check(rr.ok && cadre1 === cadre0, `choisir un autre accord ne déplace rien (${rr.detail} ; ${cadre0} → ${cadre1})`);
    rr = await R.suitSelection(page, 1);
    check(rr.ok, `et le séquenceur suit la sélection de la grille (${rr.detail})`);
    await page.close();

    // ---------------------------------------------------------------------------------------------
    console.log('=== 2. La bascule est À CÔTÉ des diagrammes, plus en dessous ===');
    const mesureCarte = (p) => p.evaluate(() => {
        const c = document.querySelector('.viz-card');
        if (!c) return null;
        const cr = c.getBoundingClientRect();
        const cs = getComputedStyle(c);
        const pad = { t: parseFloat(cs.paddingTop), b: parseFloat(cs.paddingBottom), l: parseFloat(cs.paddingLeft), r: parseFloat(cs.paddingRight) };
        const bo = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height), w: Math.round(r.width) }; };
        const hors = [];
        for (const e of c.querySelectorAll('*')) {
            const r = e.getBoundingClientRect();
            if (!r.width && !r.height) continue;
            const dl = Math.round(cr.left + pad.l - r.left), dr = Math.round(r.right - (cr.right - pad.r));
            const dt = Math.round(cr.top + pad.t - r.top), db = Math.round(r.bottom - (cr.bottom - pad.b));
            if (dl > 1 || dr > 1 || dt > 1 || db > 1)
                hors.push({ q: e.id || String(e.className.baseVal !== undefined ? e.className.baseVal : e.className).slice(0, 22) || e.tagName, dl, dr, dt, db });
        }
        return {
            carte: { h: Math.round(cr.height), w: Math.round(cr.width) },
            padV: pad.t + pad.b,
            diag: bo('.viz-diagrams'), toggle: bo('.viz-toggle'),
            dansLaBarre: !!document.querySelector('#barre-lecture .viz-toggle') && !c.querySelector('.viz-toggle'),
            volet: bo('#seq-dock-panel'),
            hors: hors.slice(0, 6),
        };
    });

    for (const [pi, gu, nom] of [['1', '1', 'piano + guitare'], ['1', '0', 'piano seul'], ['0', '1', 'guitare seule']]) {
        const p = await browser.newPage({ viewport: { width: 1905, height: 900 } });
        p.on('pageerror', (e) => errors.push(`${nom}: ` + e.message));
        await ouvrir(p, [mk('C', 'min', 3), mk('A', 'maj', 3)], pi, gu);
        await p.evaluate(() => { window.app.editChord(0, 1); window.app.toggleSequencer('continu'); });
        await p.waitForTimeout(700);
        const m = await mesureCarte(p);
        console.log(nom.padEnd(16), JSON.stringify({ carte: m.carte, diag: m.diag && m.diag.h, toggle: m.toggle, hors: m.hors }));
        if (!exiger(!!m && !!m.diag && !!m.toggle, `${nom} : la carte, les diagrammes et la bascule sont mesurables`)) continue;
        // RÉÉCRIT AU LOT 8 : la bascule n'est plus À CÔTÉ des diagrammes dans la carte, elle est dans le bloc « Vues » de la barre de lecture (le critère
        // d'alors — chevaucher leur bande verticale — voulait dire « elle ne coûte pas de hauteur à la carte » ; elle n'est plus du tout dans la carte).
        check(m.dansLaBarre, `${nom} : la bascule est dans la barre de lecture, et plus dans la carte des diagrammes`);
        // Et la conséquence recherchée : la carte n'est plus haute que de son plus grand contenu.
        const attendu = Math.max(m.diag.h, m.toggle.h) + m.padV;
        check(m.carte.h <= attendu + 2,
            `${nom} : la carte ne fait plus que la hauteur de son plus grand élément (${m.carte.h}px pour ${attendu}px attendus)`);
        await p.close();
    }

    // ---------------------------------------------------------------------------------------------
    console.log('=== 3. Quelle que soit la place, rien ne sort du cadre ===');
    const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    p.on('pageerror', (e) => errors.push('cadre: ' + e.message));
    await ouvrir(p, [mk('C', 'min', 3), mk('A', 'maj', 3)], '1', '1');
    await p.evaluate(() => { window.app.editChord(0, 1); window.app.toggleSequencer('continu'); });
    await p.waitForTimeout(700);
    const fautifs = [];
    for (const largeur of [500, 440, 400, 360, 300, 240]) {
        await p.evaluate((w) => {
            let s = document.getElementById('banc-largeur');
            if (!s) { s = document.createElement('style'); s.id = 'banc-largeur'; document.head.appendChild(s); }
            s.textContent = `.viz-wrap { max-width: ${w}px !important; }`;
        }, largeur);
        await p.waitForTimeout(250);
        const m = await mesureCarte(p);
        console.log(`  place ${String(largeur).padEnd(4)} -> carte ${m.carte.w}px, hors cadre ${JSON.stringify(m.hors)}`);
        if (m.hors.length) fautifs.push({ largeur, hors: m.hors });
    }
    check(fautifs.length === 0,
        `aucun diagramme ne sort du cadre, même quand la place manque — fautifs ${JSON.stringify(fautifs)}`);
    await p.close();

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
