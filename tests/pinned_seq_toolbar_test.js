// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11) : la partie ordinateur porte sur la barre du séquenceur du bloc « Vues » ; le téléphone reste (4c).
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
plan(10);

(async () => {
    const browser = await chromium.launch();


    // La rangée tient-elle dans la boîte du volet ? C'est la seule question qui intéresse
    // l'utilisateur : voit-il ses boutons, ou sont-ils rognés hors du cadre.
    const barreDansHote = (page) => page.evaluate(() => {
        // LOT 9b : sur ordinateur, la barre a rejoint la rangée « Notes / Fermer » de l'éditeur de notes (#editeur-notes-tete), EN HAUT du même
        // volet. La question reste la même — voit-on les boutons, ou sont-ils rognés ? — mais elle se pose alors à cette rangée dans le volet
        // entier (#seq-dock-panel), et plus à une barre au bas de #seq-dock-host.
        const tete = document.querySelector('#editeur-notes-tete .seq-presets') ? document.getElementById('editeur-notes-tete') : null;
        const hote = tete ? document.getElementById('seq-dock-panel') : document.getElementById('seq-dock-host');
        const barre = tete || document.querySelector('.seq-presets');
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

    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11) : à l'ordinateur, le volet d'avant et sa barre (Lecture en tête, zoom H en dernier) ont disparu. LE SUJET
    // RESTE — une barre d'outils dans un ordre lisible, qui reste ENTIÈREMENT visible même quand le séquenceur doit défiler — pour celle du bloc « Vues » : motifs
    // d'abord (pas de Lecture propre, décision du 11/11), le × en dernier ; écran court, elle reste collée en haut pendant que les lignes défilent dessous.
    const R = require('./_retrait_ancien');
    // La même scène que ouvrirVolet, sans l'ancienne porte (absente à l'ordinateur) : une partie de quatre accords, l'un en modification.
    const monter = async (page) => {
        await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
        await page.evaluate(() => {
            const mk = (r, q) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' });
            localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] }] }));
            localStorage.removeItem('harmohubSequenceurLigne');
        });
        await page.reload({ waitUntil: 'load' });
        await page.waitForTimeout(500);
        await page.evaluate(() => window.app.editChord(0, 0));
        await page.waitForTimeout(200);
    };
    console.log('=== Écran ORDINATEUR ===');
    const bureau = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await monter(bureau);
    let rr = await R.porteAbsente(bureau);
    check(rr.ok, `l'ancien volet n'a plus de porte (${rr.detail})`);
    rr = await R.ouvrirNouveau(bureau);
    exiger(rr.ok, `le séquenceur du bloc « Vues » s'ouvre (${rr.detail})`);
    const ordre = await bureau.evaluate(() => [...document.querySelectorAll('#sequenceur .sq-outils button')].filter(b => b.offsetParent).map(b => b.id || b.dataset.sqMotif || b.className.split(' ')[0]));
    console.log('ordre:', JSON.stringify(ordre));
    check(ordre[0] === 'sq-motif-plaque' && ordre[ordre.length - 1] === 'sq-fermer', `motifs en tête, × en dernier — trouvé « ${ordre[0]} » … « ${ordre[ordre.length - 1]} »`);
    rr = await R.sansLecturePropre(bureau);
    check(rr.ok, `pas de Lecture propre en tête de barre (${rr.detail})`);
    const dansLeCadre = (page) => page.evaluate(() => { const s = document.getElementById('sequenceur').getBoundingClientRect(), b = document.querySelector('#sequenceur .sq-outils').getBoundingClientRect(); return { dedans: b.top >= s.top - 1 && b.bottom <= s.bottom + 1 && b.height > 0, colle: getComputedStyle(document.querySelector('#sequenceur .sq-outils')).position }; });
    const normal = await dansLeCadre(bureau);
    check(normal.dedans && normal.colle === 'sticky', `la barre tient dans le séquenceur, collée en haut (${JSON.stringify(normal)})`);
    await bureau.close();

    console.log('=== Écran court (600 px), « Toutes les notes » : le séquenceur défile, la barre reste visible ===');
    const court = await browser.newPage({ viewport: { width: 1400, height: 600 } });
    await monter(court);
    await R.ouvrirNouveau(court);
    await R.cliquer(court, '#sq-vue-notes', 400);
    const avant = await court.evaluate(() => { const s = document.getElementById('sequenceur'); return { defile: s.scrollHeight > s.clientHeight + 1 }; });
    await court.evaluate(() => { document.getElementById('sequenceur').scrollTop = 9999; }); // le défilement interne, comme la molette
    await court.waitForTimeout(200);
    const apres = await dansLeCadre(court);
    check(apres.dedans, `séquenceur défilé jusqu'en bas${avant.defile ? '' : ' (rien à défiler)'}, la barre d'outils reste entière à l'écran (${JSON.stringify(apres)})`);
    await R.cliquer(court, '#sq-vue-voix', 300);
    await court.close();

    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11) : au téléphone, le volet d'avant et sa barre (.seq-presets) ont disparu avec la feuille « Séq. ».
    // Le séquenceur du téléphone est dans l'onglet Rythme du panneau d'accord ; même exigence pour SA barre : aucun bouton hors de l'écran, pas d'escalier,
    // et la barre reste dans le panneau.
    console.log('\n=== Écran TÉLÉPHONE (390px) : la barre de l\'onglet Rythme ne se disloque pas ===');
    const tel = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await tel.goto(`${BASE}/index.html`);
    await tel.evaluate(() => {
        const mk = (r, q) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] }] }));
        sessionStorage.setItem('cc_accueil_vu', '1');
    });
    await tel.reload(); await tel.waitForTimeout(900);
    const ouvertTel = await R.ouvrirRythmeTel(tel);
    exiger(ouvertTel.ok, `« Séquenceur » du panneau Lecture ouvre l'onglet Rythme (${ouvertTel.detail})`);
    const rangee = await tel.evaluate(() => {
        const sq = document.getElementById('sequenceur'), hote = document.getElementById('panneau-accord').getBoundingClientRect();
        const enfants = [...sq.querySelectorAll('button')].filter(e => !e.closest('#sq-grille') && e.getBoundingClientRect().width > 0);
        return {
            // Une rangée à TOUT défiler de côté (les motifs, .sq-motifs, choix du 3e sous-lot de D) n'est pas une dislocation : on mesure la rangée, pas ses boutons.
            // Les hauts à moins de 8 px les uns des autres sont une même rangée (boutons de hauteurs différentes).
            dehors: enfants.map(e => { const d = e.parentElement; return ['auto', 'scroll'].includes(getComputedStyle(d).overflowX) ? d : e; })
                .filter((e, i, l) => l.indexOf(e) === i)
                .filter(e => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > window.innerWidth + 1; }).map(e => e.id || e.className.split(' ')[0]),
            lignes: enfants.map(e => Math.round(e.getBoundingClientRect().top)).sort((a, b) => a - b).filter((y, i, l) => i === 0 || y - l[i - 1] >= 8),
            horsPanneau: enfants.filter(e => { const r = e.getBoundingClientRect(); return r.top < hote.top - 1 || r.bottom > hote.bottom + 1; }).map(e => e.id),
            nb: enfants.length,
        };
    });
    console.log(JSON.stringify(rangee));
    check(rangee.nb > 0 && rangee.dehors.length === 0, `aucun bouton de la barre ne sort de l'écran à 390px (${rangee.nb} boutons) — fautifs : ${JSON.stringify(rangee.dehors)}`);
    check(rangee.lignes.length <= 4, `la barre tient sur 4 rangées au plus (motifs, vue, portée, copier), pas en escalier (${rangee.lignes.length} niveau(x) : ${rangee.lignes.join(', ')})`);
    check(rangee.horsPanneau.length === 0, `sur téléphone la barre reste dans le panneau d'accord — hors panneau : ${JSON.stringify(rangee.horsPanneau)}`);
    await tel.close();

    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
