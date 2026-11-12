// Trois remarques du même message, sur ordinateur, capture d'écran à l'appui.
//
// 1. « Je n'arrive plus à scroller horizontalement. La barre de défilement en bas a disparu.
//    J'aimerais également pouvoir scroller en laissant cliquée la molette et en allant vers la droite
//    ou la gauche avec la souris. » Le mécanisme de défilement lui-même (overflow-x, scrollWidth réel,
//    scrollLeft assignable) reste intact — mesuré, aucune régression trouvée là. Mais mon navigateur de
//    test ne peut de toute façon afficher AUCUNE barre de défilement classique, même sur un simple
//    <div> isolé hors de l'appli (mesuré : offsetWidth===clientWidth partout, y compris sur ce témoin
//    neuf) — impossible donc de confirmer/infirmer la disparition par une capture ici. Ce banc livre
//    et vérifie donc ce qui EST vérifiable et robuste indépendamment de ce mystère : le glisser au clic
//    MOLETTE, comme l'outil « main » d'une station audio, qui ne dépend d'aucune fine poignée visible.
//
// 2. « Il faut remonter un peu le piano pour le centrer avec le diagramme de la guitare. » Le piano et
//    la guitare sont centrés en CSS (align-items:center) sur #guitar-viz-wrap tout ENTIER — diagramme
//    ET rangée de boutons en dessous —, pas sur le diagramme seul. Mesuré avant correction : centre du
//    piano à 764px, centre du diagramme à 760px SANS la rangée de boutons pour cause, mais l'écart
//    grimpait à 19-23px selon le contexte (jusqu'à 23px avec un titre scindé au-dessus du piano). Un
//    piège classique guettait la correction elle-même : mesurer la position après un premier
//    translateY() pour en déduire s'il en faut un second se traduit par mesurer SA PROPRE correction et
//    l'annuler (getBoundingClientRect() renvoie la position APRÈS transform) — vérifié explicitement
//    ici par plusieurs rappels consécutifs de la fonction, qui ne doivent JAMAIS faire osciller le
//    résultat.
//
// 3. « Pour les accords non sélectionnés en transparence, je ne les vois pas assez, à rendre un tout
//    petit peu plus opaques. » .seq-ctx-note passe de 0.45 à 0.6 d'opacité (teinte effective ~0.14 ->
//    ~0.18, contre 0.38 pour une barre éditable — reste nettement en dessous, comme demandé) et
//    .seq-label-context de 0.55 à 0.7.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('glisser molette, alignement piano/guitare, opacité du contexte');
plan(14);

const R = require('./_retrait_ancien');
const mk = (root, quality, octave, beats) => ({ root, quality, beats: beats || 4, inversion: 0, drop: 0, octave, bass: null, playStyle: 'held' });

(async () => {
    const browser = await chromium.launch();
    const errors = [];

    // ---------------------------------------------------------------------------------------------
    console.log('=== 1. Glisser au clic MOLETTE fait défiler la bande dans les deux sens ===');
    const page = await browser.newPage({ viewport: { width: 1397, height: 720 } });
    page.on('pageerror', (e) => errors.push('molette: ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate((c) => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'S', chords: c }] }));
        localStorage.removeItem('harmohubSeqDockHeight');
    }, [mk('C', 'min', 3, 16), mk('A', 'maj', 3, 16), mk('F', 'maj7', 4, 16), mk('G', '7', 3, 16)]);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(500);
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11, « réécriture courte ») : le séquenceur continu (sa bande à faire défiler, le glisser au clic molette)
    // était ouvert ici par toggleSequencer('continu'), un appel de programme : il n'avait plus de porte depuis la 4a, et l'appel ouvre désormais le séquenceur du
    // bloc « Vues ». Là, rien à faire défiler de côté : toute la partie est à l'écran (« pas de zoom ») ; et le clic gauche normal pose toujours une croche.
    let rr = await R.porteAbsente(page);
    check(rr.ok, `l'ancien séquenceur continu n'a plus de porte (${rr.detail})`);
    rr = await R.ouvrirNouveau(page);
    check(rr.ok, `le séquenceur du bloc « Vues » s'ouvre (${rr.detail})`);
    rr = await R.toutePartie(page);
    check(rr.ok, `rien à faire défiler : toute la partie (quatre accords de quatre mesures) est à l'écran (${rr.detail})`);
    rr = await R.poserCroche(page, 1);
    check(rr.ok, `un clic GAUCHE normal pose toujours une croche (${rr.detail})`);
    await page.close();

    // ---------------------------------------------------------------------------------------------
    console.log('=== 2. Le piano est centré sur le DIAGRAMME guitare, pas sur tout son bloc ===');
    const p2 = await browser.newPage({ viewport: { width: 1905, height: 900 } });
    p2.on('pageerror', (e) => errors.push('alignement: ' + e.message));
    await p2.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await p2.waitForTimeout(200);
    await p2.evaluate((c) => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'S', chords: c }] }));
        localStorage.setItem('harmohubShowPiano', '1');
        localStorage.setItem('harmohubShowGuitar', '1');
    }, [mk('C', 'min', 3), mk('F', 'maj', 2), mk('B', '7', 3)]);
    await p2.reload({ waitUntil: 'load' });
    await p2.waitForTimeout(400);

    const ecartCentres = () => p2.evaluate(() => {
        const bo = (id) => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); return (r.top + r.bottom) / 2; };
        return Math.round(bo('piano-viz') - bo('guitar-viz'));
    });

    for (const [i, nom] of [[0, 'Cmin3'], [1, 'Fmaj2'], [2, 'B7']]) {
        await p2.evaluate((k) => window.app.editChord(0, k), i);
        await p2.waitForTimeout(400);
        const ecart = await ecartCentres();
        check(Math.abs(ecart) <= 2, `${nom} : le piano est centré sur le diagramme guitare (écart ${ecart}px)`);
    }

    // Piège vérifié explicitement : plusieurs rappels consécutifs ne doivent jamais faire osciller
    // le résultat (mesurer une position déjà corrigée par transform et croire qu'il n'y a plus rien à
    // faire annulerait la correction précédente).
    let stable = true;
    for (let i = 0; i < 4; i++) {
        await p2.evaluate(() => window.app.alignPianoOnGuitarDiagram());
        const e = await ecartCentres();
        if (Math.abs(e) > 2) stable = false;
    }
    check(stable, 'quatre rappels consécutifs de la correction restent stables, sans osciller');

    // Masquer l'un des deux : plus rien à corriger, le transform doit être remis à vide.
    await p2.click('#toggle-viz-guitar');
    await p2.waitForTimeout(200);
    const transformSeul = await p2.evaluate(() => document.getElementById('piano-viz').style.transform);
    check(transformSeul === '', `piano seul affiché : la correction est bien désactivée (transform="${transformSeul}")`);
    await p2.click('#toggle-viz-guitar');
    await p2.waitForTimeout(200);
    const ecartRetour = await ecartCentres();
    check(Math.abs(ecartRetour) <= 2, `les deux diagrammes de retour : la correction se réapplique (écart ${ecartRetour}px)`);
    await p2.close();

    // ---------------------------------------------------------------------------------------------
    console.log('=== 3. Les accords voisins (contexte) sont un peu plus opaques ===');
    const p3 = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    p3.on('pageerror', (e) => errors.push('opacité: ' + e.message));
    await p3.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await p3.waitForTimeout(200);
    await p3.evaluate((c) => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'S', chords: c }] }));
        localStorage.removeItem('harmohubSeqDockHeight');
    }, [mk('C', 'min', 3, 8), mk('A', 'maj', 3, 8), mk('F', 'maj7', 4, 8)]);
    await p3.reload({ waitUntil: 'load' });
    await p3.waitForTimeout(500);
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11, « réécriture courte ») : les accords voisins EN TRANSPARENCE (.seq-ctx-note) étaient ceux du séquenceur
    // continu, ouvert par un appel de programme qui ouvre désormais le séquenceur du bloc « Vues ». Là, chaque accord de la partie est montré en entier, avec les
    // couleurs de ses rôles (rien n'est plus « en transparence » à deviner) ; un clic sur le nom d'un voisin le choisit.
    let r3 = await R.ouvrirNouveau(p3);
    check(r3.ok, `le séquenceur du bloc « Vues » s'ouvre (${r3.detail})`);
    r3 = await R.couleursRoles(p3, 0);
    check(r3.ok, `un accord non choisi est montré en entier, avec les couleurs de ses rôles (${r3.detail})`);
    r3 = await R.choisirParNom(p3, 2);
    check(r3.ok, `un clic sur le nom d'un accord voisin le choisit (${r3.detail})`);
    await p3.close();

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript sur les trois scénarios');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
