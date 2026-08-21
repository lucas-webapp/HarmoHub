// La barre de boutons du séquenceur continu, dans son VOLET sous la grille (#seq-dock-host) :
// boutons dans le bon ordre, et rangée qui reste entièrement visible — volet réduit à la poignée
// comme sur un écran de 390px.
//
// Ce banc montait sa scène avec app.openGridZoom() + app.editChordFromGridZoom(), disparues avec la
// vue plein écran, et mesurait dans #grid-zoom-pinned-body, dont l'identifiant n'existe plus. Il
// échouait donc à la mise en place, sans jamais atteindre une seule de ses mesures. Le sujet, lui,
// a survécu intact : le volet sous la grille « reprend le rôle qu'avait le séquenceur épinglé de
// l'ancienne vue plein écran » (voir index.html, #seq-dock-panel). On y rebranche tout.
//
// DEUX ASSERTIONS ONT ÉTÉ ABANDONNÉES, et pas par facilité :
//
// 1. « case à 14px sur téléphone, 28px sur ordinateur ». Ce n'est plus le contrat : la largeur de
//    colonne se déduit maintenant de la place réellement disponible pour y faire tenir six mesures,
//    bornée entre SEQ_COL_PX_MIN et SEQ_COL_PX_MAX (voir largeurColonneBase) — 14 et 28 ne sont plus
//    deux paliers d'écran mais les deux bornes d'un calcul continu. Sur un écran de 1400px la valeur
//    mesurée est 14, exactement comme sur téléphone, et c'est correct. Ce comportement adaptatif est
//    déjà couvert sur trois tailles d'écran par probe_seq_adaptatif_test : le redire ici, avec des
//    nombres périmés, n'ajouterait aucune couverture et rouvrirait un banc menteur.
//
// 2. « .seq-presets a bien position:sticky ». Le mécanisme a changé : dans le volet, la barre est un
//    enfant flex non rétrécissable (`.seq-dock-panel .seq-presets { flex: none }`) au bas d'un
//    panneau dont la zone de défilement prend le reste — elle ne peut donc plus sortir du cadre, sans
//    avoir besoin de collant. Ce qui compte pour l'utilisateur n'est pas la propriété CSS employée
//    mais le RÉSULTAT : la rangée reste dans la boîte du volet. C'est ce qui est vérifié ci-dessous,
//    volet à sa hauteur normale puis réduit à 140px.
//
// Il reprend enfin le sujet de seq_toolbar_wrap_test (supprimé) : celui-ci vérifiait que les groupes
// de zoom H et V restaient sur la même ligne, via #seq-zoom-in-h-pinned / #seq-zoom-in-v-pinned. Ces
// boutons ont été retirés à la demande de l'utilisateur (« bloquer la hauteur des barres du petit
// séquenceur, et supprimer le V+/- ») et leur absence est déjà affirmée ailleurs
// (probe_suppression_pleinecran_test, seq_buttons_removed_test). Ce qui reste vrai et vérifiable,
// c'est que la rangée tient à 390px sans partir en escalier ni sortir de l'écran.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('barre du séquenceur en volet');
plan(9);

(async () => {
    const browser = await chromium.launch();

    // ---- Scène commune : une seule partie, un seul accord, volet du séquenceur continu ouvert sur lui ----
    const ouvrirVolet = async (page) => {
        await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
        await page.waitForTimeout(200);
        await page.evaluate(() => {
            localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
                { root: 'C', quality: 'maj7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
            ] }] }));
            localStorage.removeItem('harmohubSeqDockHeight'); // hauteur AUTOMATIQUE, pas celle d'une campagne précédente
        });
        await page.reload({ waitUntil: 'load' });
        await page.waitForTimeout(400);
        await page.evaluate(() => window.app.editChord(0, 0));
        await page.waitForTimeout(200);
        await page.click('#grid-zoom');      // ouvre le volet en mode continu
        await page.waitForTimeout(700);
    };

    // La rangée tient-elle dans la boîte du volet ? C'est la seule question qui intéresse
    // l'utilisateur : voit-il ses boutons, ou sont-ils rognés hors du cadre.
    const barreDansHote = (page) => page.evaluate(() => {
        const hote = document.getElementById('seq-dock-host');
        const barre = document.querySelector('.seq-presets');
        if (!hote || !barre) return null;
        const rh = hote.getBoundingClientRect(), rb = barre.getBoundingClientRect();
        return {
            flex: getComputedStyle(barre).flex,
            hauteurHote: Math.round(rh.height),
            dedans: rb.bottom <= rh.bottom + 1 && rb.top >= rh.top - 1 && rb.height > 0,
            basBarre: Math.round(rb.bottom), basHote: Math.round(rh.bottom),
            hautBarre: Math.round(rb.top), hautHote: Math.round(rh.top),
        };
    });

    console.log('=== Écran ORDINATEUR ===');
    const bureau = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await ouvrirVolet(bureau);
    exiger(await bureau.evaluate(() => !!document.querySelector('#seq-dock-host .seq-grid-continuous')),
        'la grille continue est bien dans le volet sous la grille (#seq-dock-host)');

    console.log('=== Ordre des boutons : transport -> actions -> zoom H EN DERNIER ===');
    // LA BARRE EST DÉSORMAIS GROUPÉE PAR FAMILLES (retour utilisateur : « c'est brouillon à
    // l'affichage »), donc les enfants directs de .seq-presets sont des .seq-groupe et non plus les
    // boutons eux-mêmes. On aplatit d'abord — ce banc éprouve un ORDRE, pas une profondeur de DOM, et
    // l'ordre visuel n'a pas changé : transport, motif, suppression, affichage.
    const ordre = await bureau.evaluate(() => [...document.querySelectorAll('.seq-presets button, .seq-presets .btn-wrap-group')]
        .map(el => el.id || el.className.split(' ')[0]));
    console.log('ordre:', JSON.stringify(ordre));
    const familles = await bureau.evaluate(() => [...document.querySelectorAll('.seq-presets > .seq-groupe')].map(g => g.dataset.groupe));
    console.log('familles:', JSON.stringify(familles));
    const iZoom = ordre.findIndex(x => x === 'btn-wrap-group');
    const iDerniereAction = ordre.findIndex(x => x === 'seq-delete-selection');
    check(iZoom > iDerniereAction && iDerniereAction !== -1,
        `le groupe de zoom arrive bien APRÈS seq-delete-selection, dernier bouton d'action (${iDerniereAction} -> ${iZoom})`);
    check(ordre[0] === 'seq-play', `seq-play toujours en premier (transport) — trouvé « ${ordre[0]} »`);
    // Le groupement lui-même, tant qu'on y est : c'est lui qui rend l'ordre lisible plutôt que subi.
    check(JSON.stringify(familles) === JSON.stringify(['transport', 'motif', 'suppression', 'affichage']),
        `quatre familles, dans l'ordre écouter -> fabriquer -> défaire -> regarder — ${familles.join(', ')}`);

    console.log('=== La rangée reste dans le cadre, hauteur normale puis volet réduit ===');
    const normal = await barreDansHote(bureau);
    console.log('hauteur normale :', JSON.stringify(normal));
    check(normal.flex.startsWith('0 0') || normal.flex === 'none',
        `la barre est un enfant flex non rétrécissable dans le volet — flex: « ${normal.flex} »`);
    check(normal.dedans, `la rangée tient dans le volet à sa hauteur normale (${normal.hauteurHote}px : barre ${normal.hautBarre}→${normal.basBarre}, volet ${normal.hautHote}→${normal.basHote})`);

    // Simule la poignée #seq-dock-resize tirée vers le haut : c'est bien la hauteur de l'HÔTE qu'elle
    // écrit (voir hauteurVoletSequenceur, qui insiste sur ce point), pas celle du panneau autour.
    await bureau.evaluate(() => { document.getElementById('seq-dock-host').style.height = '140px'; });
    await bureau.waitForTimeout(250);
    const reduit = await barreDansHote(bureau);
    console.log('volet réduit :', JSON.stringify(reduit));
    check(reduit.dedans, `la rangée reste dans le volet une fois réduit à 140px (barre ${reduit.hautBarre}→${reduit.basBarre}, volet ${reduit.hautHote}→${reduit.basHote})`);
    await bureau.close();

    console.log('\n=== Écran TÉLÉPHONE (390px) : la rangée ne se disloque pas ===');
    const tel = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await ouvrirVolet(tel);
    // On ne peut pas exiger UNE seule ligne (huit boutons pour 390px, un retour à la ligne est
    // légitime) ; ce qui ne l'est pas, c'est qu'un bouton sorte de l'écran, ou que la rangée s'étale
    // sur trois niveaux.
    const rangee = await tel.evaluate(() => {
        const barre = document.querySelector('.seq-presets');
        const enfants = [...barre.children].filter(e => e.getBoundingClientRect().width > 0);
        return {
            lignes: [...new Set(enfants.map(e => Math.round(e.getBoundingClientRect().top)))].sort((a, b) => a - b),
            dehors: enfants.filter(e => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > window.innerWidth + 1; })
                .map(e => e.id || e.className.split(' ')[0]),
            nb: enfants.length,
        };
    });
    console.log(JSON.stringify(rangee));
    check(rangee.dehors.length === 0, `aucun bouton de la barre ne sort de l'écran à 390px (${rangee.nb} boutons) — fautifs : ${JSON.stringify(rangee.dehors)}`);
    check(rangee.lignes.length <= 2, `la barre tient sur 2 lignes au plus, pas en escalier (${rangee.lignes.length} niveau(x) : ${rangee.lignes.join(', ')})`);
    const telDedans = await barreDansHote(tel);
    console.log('téléphone, barre dans le volet :', JSON.stringify(telDedans));
    check(telDedans.dedans, `sur téléphone aussi la rangée tient dans le volet (barre ${telDedans.hautBarre}→${telDedans.basBarre}, volet ${telDedans.hautHote}→${telDedans.basHote})`);
    await tel.close();

    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
