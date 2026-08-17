// La poignée du volet doit RÉPONDRE, la hauteur de base doit être généreuse, et les en-têtes de partie
// doivent rester serrés.
//
// LE DÉFAUT QU'IL GARDE (retour utilisateur : « la poignée pour agrandir/réduire la hauteur du
// séquenceur ne fonctionne pas »). Deux règles CSS donnaient `flex: 1` au volet et à son hôte quand
// aucun diagramme n'était affiché — l'état le plus courant. `flex: 1` implique `flex-basis: 0`, qui
// l'emporte sur le `height` posé en ligne par le JS : tirer la poignée écrivait bien une nouvelle
// hauteur, et la mise en page l'ignorait entièrement. Mesuré avant correction : la hauteur mémorisée
// passait de 0 à 497px sans qu'un seul pixel ne bouge. Un banc qui n'aurait éprouvé que l'état AVEC
// diagrammes (le défaut par défaut au premier lancement) serait passé au vert sans rien voir — d'où les
// deux états ci-dessous, systématiquement.
//
// LE PIÈGE INVERSE, vérifié aussi : un volet qui s'ouvre d'emblée à son maximum ne peut plus que
// rétrécir, et tirer vers le haut ne fait toujours rien. C'est le même symptôme pour une autre cause,
// et c'est ce que garantit SEQ_DOCK_MARGE_POIGNEE — d'où l'assertion « la poignée agrandit », pas
// seulement « la poignée change quelque chose ».
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('hauteur du volet et en-têtes de partie');
plan(20);

const partie = (titre) => {
    const mk = (r, q) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 0, octave: 3, bass: null, playStyle: 'held' });
    return { title: titre, chords: [mk('C', 'min'), mk('A', 'maj'), mk('C', 'min'), mk('A', 'min')] };
};

(async () => {
    const browser = await chromium.launch();
    const errors = [];

    // ---- Scène : trois parties, volet du séquenceur continu ouvert, diagrammes affichés ou non ----
    const ouvrir = async (page, diagrammes) => {
        await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
        await page.waitForTimeout(200);
        await page.evaluate(({ d, sections }) => {
            localStorage.setItem('myProgression', JSON.stringify({ sections }));
            localStorage.removeItem('harmohubSeqDockHeight');  // hauteur AUTOMATIQUE, pas celle d'une campagne précédente
            localStorage.setItem('harmohubShowPiano', d ? '1' : '0');
            localStorage.setItem('harmohubShowGuitar', '0');
        }, { d: diagrammes, sections: [partie('Couplet'), partie('Refrain'), partie('Pont')] });
        await page.reload({ waitUntil: 'load' });
        await page.waitForTimeout(500);
        await page.evaluate(() => window.app.editChord(0, 0));
        await page.waitForTimeout(250);
        await page.click('#grid-zoom');
        await page.waitForTimeout(800);
    };

    const mesurer = (page) => page.evaluate(() => {
        const bo = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height) }; };
        return {
            hote: bo('#seq-dock-host').h,
            grille: bo('.history-section').h,
            memo: window.app.seqDockHeight,
            max: window.app.hauteurMaxVoletSequenceur(),
            classeCachee: document.querySelector('.col-right').classList.contains('diagrams-hidden'),
            vizWrap: bo('.viz-wrap').h,
            carte: bo('.viz-card'),
            exp: bo('.viz-export-actions'),
            enteteGrille: bo('.viz-wrap'),
        };
    });

    // Tire la poignée de `dy` pixels (négatif = vers le haut = agrandir).
    const tirer = async (page, dy) => {
        const p = await page.evaluate(() => { const r = document.getElementById('seq-dock-resize').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
        await page.mouse.move(p.x, p.y);
        await page.mouse.down();
        await page.mouse.move(p.x, p.y + dy, { steps: 14 });
        await page.waitForTimeout(150);
        await page.mouse.up();
        await page.waitForTimeout(500);
        return mesurer(page);
    };

    for (const diagrammes of [false, true]) {
        const nom = diagrammes ? 'diagrammes affichés' : 'diagrammes masqués';
        const page = await browser.newPage({ viewport: { width: 1905, height: 900 } });
        page.on('pageerror', (e) => errors.push(`${nom}: ` + e.message));
        await ouvrir(page, diagrammes);

        const repos = await mesurer(page);
        console.log(`--- ${nom} ---`, JSON.stringify(repos));
        if (!exiger(repos.hote > 0 && repos.max > 0, `${nom} : le volet est ouvert et mesurable (${repos.hote}px pour un maximum de ${repos.max}px)`)) { await page.close(); continue; }
        check(repos.classeCachee === !diagrammes, `${nom} : l'état des diagrammes est bien celui du scénario`);

        // La marge des deux côtés : c'est elle qui rend la poignée utile dans les DEUX sens.
        check(repos.hote < repos.max, `${nom} : le volet s'ouvre EN DESSOUS de son maximum, il reste de quoi agrandir (${repos.hote} < ${repos.max})`);

        const agrandi = await tirer(page, -250);
        console.log('  agrandi :', JSON.stringify({ hote: agrandi.hote, grille: agrandi.grille, memo: agrandi.memo }));
        check(agrandi.hote > repos.hote, `${nom} : tirer la poignée vers le haut AGRANDIT vraiment le volet (${repos.hote} -> ${agrandi.hote}px)`);
        check(agrandi.memo === agrandi.hote, `${nom} : la hauteur obtenue est bien celle mémorisée (${agrandi.memo})`);
        check(agrandi.grille >= 140, `${nom} : la grille d'accords garde une hauteur utilisable même volet tiré à fond (${agrandi.grille}px)`);

        const reduit = await tirer(page, 200);
        console.log('  réduit  :', JSON.stringify({ hote: reduit.hote, grille: reduit.grille }));
        check(reduit.hote < agrandi.hote, `${nom} : tirer vers le bas RÉDUIT le volet (${agrandi.hote} -> ${reduit.hote}px)`);
        check(reduit.grille > agrandi.grille, `${nom} : la place rendue profite à la grille (${agrandi.grille} -> ${reduit.grille}px)`);
        await page.close();
    }

    console.log('\n=== Diagrammes masqués : les boutons descendent sur la ligne de Paroles/Fichier ===');
    const page = await browser.newPage({ viewport: { width: 1905, height: 900 } });
    page.on('pageerror', (e) => errors.push('bas de page: ' + e.message));
    await ouvrir(page, false);
    const bas = await mesurer(page);
    console.log(JSON.stringify({ carte: bas.carte, exp: bas.exp, vizWrap: bas.vizWrap }));
    if (exiger(!!bas.carte && !!bas.exp, 'la carte des boutons et les boutons Paroles/Fichier sont mesurables')) {
        // Alignement vertical : même bord bas. Les deux rangées n'ont pas la même hauteur (32px contre
        // 26px), on compare donc ce qui est demandé — être sur la même ligne — et non des centres égaux.
        check(Math.abs(bas.carte.b - bas.exp.b) <= 2,
            `même bord bas que Paroles/Fichier, donc même ligne (${bas.carte.b} contre ${bas.exp.b})`);
        const centreCarte = (bas.carte.l + bas.carte.r) / 2;
        const centreBande = (bas.enteteGrille.l + bas.enteteGrille.r) / 2;
        check(Math.abs(centreCarte - centreBande) <= 2,
            `centrés horizontalement dans la colonne (écart ${Math.round(Math.abs(centreCarte - centreBande))}px)`);
        check(bas.carte.r < bas.exp.l, `sans recouvrir Paroles/Fichier (fin à ${bas.carte.r}, qui commencent à ${bas.exp.l})`);
        check(bas.vizWrap <= 40, `la bande des diagrammes ne coûte plus qu'une hauteur de boutons (${bas.vizWrap}px, contre 142 avant)`);
    }
    await page.close();

    console.log('\n=== Téléphone : les boutons restent DANS LE FLUX, ils recouvraient « Paroles » ===');
    const tel = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    tel.on('pageerror', (e) => errors.push('téléphone: ' + e.message));
    await tel.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await tel.evaluate((sections) => {
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
        localStorage.setItem('harmohubShowPiano', '0');
        localStorage.setItem('harmohubShowGuitar', '0');
    }, [partie('Couplet'), partie('Refrain')]);
    await tel.reload({ waitUntil: 'load' });
    await tel.waitForTimeout(700);
    const mob = await tel.evaluate(() => {
        const bo = (s) => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right) }; };
        const c = bo('.viz-card'), x = bo('.viz-export-actions');
        return { position: getComputedStyle(document.querySelector('.viz-card')).position, carte: c, exp: x, debordePage: Math.round(document.documentElement.scrollWidth - window.innerWidth) };
    });
    console.log(JSON.stringify(mob));
    check(mob.position === 'static', `à 390px la carte reste dans le flux (position « ${mob.position} »)`);
    check(mob.carte.b <= mob.exp.t + 2, `elle est AU-DESSUS de Paroles/Fichier, sans les recouvrir (finit à ${mob.carte.b}, ils commencent à ${mob.exp.t})`);
    check(mob.debordePage <= 1, `et la page ne défile pas horizontalement (${mob.debordePage}px)`);
    await tel.close();

    console.log('\n=== En-têtes de partie resserrés ===');
    const serre = await browser.newPage({ viewport: { width: 1905, height: 900 } });
    serre.on('pageerror', (e) => errors.push('en-têtes: ' + e.message));
    await ouvrir(serre, false);
    const entetes = await serre.evaluate(() => {
        const têtes = [...document.querySelectorAll('.prog-section-head')];
        const grilles = [...document.querySelectorAll('.prog-section .chord-grid')];
        const cs = getComputedStyle(têtes[0]);
        return {
            nb: têtes.length,
            margeBasTete: parseFloat(cs.marginBottom),
            margeBasSection: parseFloat(getComputedStyle(document.querySelector('.prog-section')).marginBottom),
            policeTitre: parseFloat(getComputedStyle(document.querySelector('.prog-title')).fontSize),
            // Écart RÉEL entre le bas du titre et le haut de la grille qu'il nomme : c'est ce que voit
            // l'utilisateur, plus fiable que la somme des marges déclarées.
            ecarts: têtes.map((t, i) => grilles[i] ? Math.round(grilles[i].getBoundingClientRect().top - t.getBoundingClientRect().bottom) : null),
        };
    });
    console.log(JSON.stringify(entetes));
    if (exiger(entetes.nb === 3 && entetes.ecarts.every(e => e !== null), `les trois en-têtes et leurs grilles sont mesurables`)) {
        check(entetes.margeBasTete <= 4, `l'espace sous le titre de partie est resserré (${entetes.margeBasTete}px, 8 avant)`);
        check(entetes.margeBasSection <= 10, `celui entre deux parties aussi (${entetes.margeBasSection}px, 14 avant)`);
        check(entetes.policeTitre < 16, `le titre de partie est d'un cran plus petit sur écran à souris (${entetes.policeTitre}px, 16 avant)`);
        check(entetes.ecarts.every(e => e <= 8), `le titre reste collé à sa grille — écarts mesurés ${JSON.stringify(entetes.ecarts)}px`);
    }
    await serre.close();

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript sur aucun des écrans');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
