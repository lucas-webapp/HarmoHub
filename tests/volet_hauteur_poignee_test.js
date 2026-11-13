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
plan(27);

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
        // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11) : à l'ordinateur, le séquenceur s'ouvre par le bloc « Vues ».
        await page.click('#vue-sequenceur');
        await page.waitForTimeout(800);
    };

    const mesurer = (page) => page.evaluate(() => {
        const bo = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height) }; };
        return {
            grille: bo('.history-section').h,
            barre: (() => { const e = document.querySelector('.history-section .grid-head-sticky'); return e ? Math.round(e.getBoundingClientRect().height) : 0; })(),
            uneCaseVisible: (() => {
                const c = document.querySelector('.chord-grid .grid-cell');
                const g = document.querySelector('.history-section');
                if (!c || !g) return false;
                const rc = c.getBoundingClientRect(), rg = g.getBoundingClientRect();
                return rc.top >= rg.top - 1 && rc.bottom <= rg.bottom + 1;
            })(),
            classeCachee: document.querySelector('.col-right').classList.contains('diagrams-hidden'),
            vizWrap: bo('.viz-wrap').h,
            carte: bo('.viz-card'),
            exp: bo('.viz-export-actions'),
            enteteGrille: bo('.viz-wrap'),
            // A2 (13/11) : le volet d'avant (#seq-dock-panel) n'existe plus ; sans séquenceur ouvert, c'est la grille qui finit juste au-dessus de la bande des boutons.
            ecartSousVolet: Math.round(bo('.viz-wrap').t - bo('.history-section').b),
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

    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11) : le volet d'avant (hôte #seq-dock-host, poignée #seq-dock-resize, deux plafonds) a disparu avec l'éditeur
    // de notes. LE DÉFAUT GARDÉ RESTE le même pour la poignée du séquenceur du bloc « Vues » (cahier 3 bis, « règle définitive ») : elle doit RÉPONDRE dans les deux
    // sens, avec et sans diagrammes — tirée vers le haut, les LIGNES grandissent (22 à 48 px) et la grille cède la place ; jamais plus que la place libre (la barre
    // du haut reste à l'écran) ; tirée vers le bas, elles rapetissent et la grille reprend sa place ; double-clic = 30 px.
    const R = require('./_retrait_ancien');
    const mesurerSq = (page) => page.evaluate(() => {
        const s = document.getElementById('sequenceur').getBoundingClientRect(), h = document.querySelector('.top-bar').getBoundingClientRect();
        return { ligne: Math.round(document.querySelector('#sq-grille .sq-case[data-r]').getBoundingClientRect().height), haut: Math.round(s.top), plafond: Math.round(h.bottom),
            grille: Math.round(document.querySelector('.history-section').getBoundingClientRect().height), classeCachee: document.querySelector('.col-right').classList.contains('diagrams-hidden') };
    });
    const tirerSq = async (page, dy) => {
        const q = await R.centre(page, '#sq-poignee');
        await page.mouse.move(q.x, q.y); await page.mouse.down(); await page.mouse.move(q.x, q.y + dy, { steps: 14 }); await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(400);
        return mesurerSq(page);
    };
    for (const diagrammes of [false, true]) {
        const nom = diagrammes ? 'diagrammes affichés' : 'diagrammes masqués';
        const page = await browser.newPage({ viewport: { width: 1905, height: 900 } });
        page.on('pageerror', (e) => errors.push(`${nom}: ` + e.message));
        await ouvrir(page, diagrammes);
        const repos = await mesurerSq(page);
        console.log(`--- ${nom} ---`, JSON.stringify(repos));
        exiger(repos.ligne > 0, `${nom} : le séquenceur est ouvert et mesurable (lignes de ${repos.ligne}px)`);
        check(repos.classeCachee === !diagrammes, `${nom} : l'état des diagrammes est bien celui du scénario`);
        check(repos.ligne === 30, `${nom} : il s'ouvre à la hauteur de lignes d'origine, il reste de quoi agrandir (${repos.ligne}px)`);
        const agrandi = await tirerSq(page, -400);
        console.log('  agrandi :', JSON.stringify(agrandi));
        check(agrandi.ligne > repos.ligne && agrandi.ligne <= 48, `${nom} : tirer la poignée vers le haut AGRANDIT vraiment les lignes (${repos.ligne} -> ${agrandi.ligne}px, au plus 48)`);
        check(agrandi.haut >= agrandi.plafond, `${nom} : jamais plus que la place libre — le séquenceur s'arrête sous la barre du haut (${agrandi.haut} ≥ ${agrandi.plafond})`);
        check(agrandi.grille <= repos.grille, `${nom} : la grille a bien cédé sa place (${repos.grille} -> ${agrandi.grille}px)`);
        const reduit = await tirerSq(page, 200);
        console.log('  réduit  :', JSON.stringify(reduit));
        check(reduit.ligne < agrandi.ligne && reduit.ligne >= 22, `${nom} : tirer vers le bas RÉDUIT les lignes (${agrandi.ligne} -> ${reduit.ligne}px, au moins 22)`);
        check(reduit.grille > agrandi.grille, `${nom} : la place rendue profite à la grille (${agrandi.grille} -> ${reduit.grille}px)`);
        const q = await R.centre(page, '#sq-poignee');
        await page.mouse.dblclick(q.x, q.y); await page.waitForTimeout(300);
        check((await mesurerSq(page)).ligne === 30, `${nom} : double-clic sur la poignée, hauteur d'origine (30 px)`);
        await page.close();
    }

    console.log('\n=== Diagrammes masqués : les boutons descendent sur la ligne de Paroles/Fichier ===');
    const page = await browser.newPage({ viewport: { width: 1905, height: 900 } });
    page.on('pageerror', (e) => errors.push('bas de page: ' + e.message));
    await ouvrir(page, false);
    await page.click('#sq-fermer'); await page.waitForTimeout(400); // cette partie mesure la page SANS séquenceur (la mise en place l'ouvre)
    const bas = await mesurer(page);
    console.log(JSON.stringify({ carte: bas.carte, exp: bas.exp, vizWrap: bas.vizWrap }));
    if (exiger(!!bas.carte && !!bas.exp, 'la carte des boutons et les boutons Paroles/Fichier sont mesurables')) {
        // RÉÉCRIT AU LOT 8 : les boutons Clavier / Guitare ne sont plus une carte posée sur la ligne de Paroles/Fichier, ils sont dans le bloc « Vues » de la
        // barre de lecture, et sans diagramme il n'y a plus de tiroir. Ce que ces deux contrôles gardaient — « les boutons ne coûtent aucune hauteur à la
        // grille, et ne sont pas décrochés » — se mesure donc ici : ils sont dans la barre, et la colonne de la grille descend jusqu'à ~20px d'elle.
        const dansLaBarre = await page.evaluate(() => {
            const bt = document.querySelector('#toggle-viz-piano').getBoundingClientRect(), br = document.getElementById('barre-lecture').getBoundingClientRect();
            const col = document.querySelector('.col-right').getBoundingClientRect();
            return { dedans: bt.top >= br.top && bt.bottom <= br.bottom, ecart: Math.round(br.top - col.bottom), tiroir: !!document.getElementById('vues-tiroir') && !document.getElementById('vues-tiroir').hidden };
        });
        check(dansLaBarre.dedans && !dansLaBarre.tiroir, 'les boutons sont dans la barre de lecture, et sans diagramme le tiroir ne prend aucune place');
        check(Math.abs(dansLaBarre.ecart - 20) <= 3, `la colonne de la grille descend jusqu'à ~20px de la barre (${dansLaBarre.ecart}px)`);
        // RÉÉCRIT LE 11/11 : « Il y a toute une barre noire juste pour le bouton "fichier". Place ce bouton ailleurs et supprime l'espace perdu » —
        // à l'ordinateur, « Fichier » a quitté ce coin pour la barre du haut (placerBoutonFichier) : plus rien à recouvrir ici, et rien ne le recouvre là-haut.
        const fichier = await page.evaluate(() => {
            const b = document.getElementById('file-menu-btn'), r = b.getBoundingClientRect(), h = document.querySelector('.top-bar').getBoundingClientRect();
            const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return { haut: r.top >= h.top && r.bottom <= h.bottom, libre: !!dessus && b.contains(dessus), coin: getComputedStyle(document.querySelector('.viz-wrap')).display };
        });
        check(fichier.haut && fichier.libre && fichier.coin === 'none', `« Fichier » est dans la barre du haut, rien ne le recouvre, le coin bas n'existe plus (${JSON.stringify(fichier)})`);
        check(bas.vizWrap <= 40, `la bande des diagrammes ne coûte plus qu'une hauteur de boutons (${bas.vizWrap}px, contre 142 avant)`);
        // Retour utilisateur : « il reste encore de la place optimisable entre le séquenceur et les
        // boutons diagrammes ». Elle venait de deux enfants de colonne à 0px de haut qui consommaient
        // quand même leur interligne de 16px chacun.
        check(bas.ecartSousVolet <= 24,
            `l'écart entre le bas du volet et la bande des boutons est resserré (${bas.ecartSousVolet}px, 38 avant)`);
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
    // ON ÉPROUVE LE CONTRAT, PAS UNE VALEUR. Ce qui compte est que la carte ne soit pas SORTIE du flux
    // et ne recouvre donc plus « Paroles » — c'est `position: absolute` qui l'en sortait, sur les
    // grands écrans seulement. `relative`, elle, reste parfaitement dans le flux : ce n'est qu'un
    // repère de position pour la bascule des diagrammes (voir .viz-card dans style.css, posé en
    // 1ac0b31 bien avant ce banc). Exiger `static` faisait échouer ce contrôle sur une propriété qui
    // ne change rien au défaut visé.
    check(mob.position !== 'absolute' && mob.position !== 'fixed',
        `à 390px la carte reste dans le flux (position « ${mob.position} »)`);
    check(mob.carte.b <= mob.exp.t,
        `et ne recouvre pas les boutons d'export (carte finit à ${mob.carte.b}, boutons commencent à ${mob.exp.t})`);
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
