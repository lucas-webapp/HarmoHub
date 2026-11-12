const { chromium } = require('playwright')
const { ajouterAccord, editerAccord } = require('./_ajout');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
// La section « loupe grille » de ce banc est SUPPRIMÉE, pas rebranchée : elle refaisait exactement les
// mêmes deux vérifications que la section 1, sur les mêmes cases, au seul motif qu'elles vivaient alors
// dans #grid-zoom-host. La grille ne déménage plus nulle part (voir retour_a_sa_place_test) : rejouer le
// scénario une seconde fois n'éprouverait plus rien de nouveau. Le banc mourait dessus sur un
// `cellsZoom[0]` undefined, et sa section 3 — la seule qui reste vraiment distincte, le repère de temps
// dans la vue AGRANDIE du séquenceur — n'était donc jamais atteinte.
const { check, exiger, plan, bilan } = require('./_harness')('repères de mesure et de temps');
plan(10);

(async () => {
    const browser = await chromium.launch();
    // LOT 6c : sur ordinateur (≥ 900px), il n'y a plus de mode Ajout ni de carte Accord à préparer — QUEL accord se règle dans la bulle, COMMENT il
    // sonne dans l'inspecteur, qui n'existe qu'en modification. Ce banc éprouve une FONCTION de la carte (le même code), pas sa mise en page :
    // il se joue donc sous le seuil (860px), où la carte garde son mode Ajout jusqu'au lot 10. DETTE : à reprendre au lot 10 (docs/dette-tests.md).
    const page = await browser.newPage({ viewport: { width: 860, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('ERR_CONNECTION_RESET') && !msg.text().includes('ERR_TUNNEL_CONNECTION_FAILED') && !msg.text().includes('ERR_CERT_AUTHORITY_INVALID')) errors.push('console: ' + msg.text()); });

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(600);
    await page.waitForTimeout(150);

    // === 0. Contretemps du séquenceur : le repère est bien là et bien visible ===
    // CONTRAT CHANGÉ : ce test attendait le CARACTÈRE « • » dans le texte de l'élément. Le repère
    // n'est plus un caractère depuis qu'il a été redessiné : c'est une forme en CSS (.offbeat-dash),
    // un petit trait VERTICAL pour le séquenceur — un caractère typographique ne se centrait pas au
    // pixel près sur la colonne, et l'utilisateur a tranché entre cinq propositions (« j'aime bien
    // le petit rond pour la grille d'accords, mais laisse un tiret pour le séquenceur »). Ce qui
    // reste à éprouver est le besoin, pas le moyen : le repère existe, et il se voit.
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11) : le petit séquenceur (et son tiret de contretemps .seq-beat-offbeat) a disparu. Le séquenceur du
    // téléphone est l'onglet Rythme du panneau d'accord, ouvert par « Séquenceur » du panneau Lecture (vrais clics) ; ses repères : un trait à chaque temps, un
    // plus marqué à chaque mesure, les temps numérotés dans la règle. Le besoin (« le repère existe, et il se voit ») est éprouvé sur eux.
    await editerAccord(page); // lot 10e : il faut un accord ; editerAccord en pose un et l'ouvre
    const R = require('./_retrait_ancien');
    await R.cliquer(page, '#bl-plus', 400); await R.cliquer(page, '#pl-notes', 700);
    check(await page.evaluate(() => !!(window.app._bulle && window.app._bulle.rythme) && document.getElementById('sequenceur').parentElement.id === 'pa-rythme' && !window.app.seqOpen),
        'l\'onglet Rythme s\'ouvre, l\'ancien séquenceur reste fermé');
    const rq = await R.reperes(page);
    check(rq.ok, `les repères du séquenceur : un trait par temps, un plus marqué par mesure, les temps numérotés (${rq.detail})`);
    check(await page.evaluate(() => { const c = document.querySelector('#sq-grille .sq-case.temps'); return !!c && getComputedStyle(c).opacity >= 0.5; }), 'le repère de temps est nettement opaque (>= 0.5)');
    await R.cliquer(page, '#panneau-accord [data-bulle="fermer"]', 400);
    // L'accord reste en modification (editerAccord) : un premier toucher sur « + » ne ferait qu'en sortir. « Terminer » du dock en sort, comme l'utilisateur.
    await R.cliquer(page, '#dock-terminer', 300);

    // Ajoute plusieurs accords pour avoir de la marge d'étirement (case "+" toujours présente après)
    for (const sym of ['C', 'G', 'Am', 'F']) {
        await ajouterAccord(page, sym);
        await page.waitForTimeout(150);
    }

    // === 1. Étirement d'un accord dans la grille CLASSIQUE (hors loupe) ===
    const cellsBefore = await page.$$('.grid-cell');
    console.log('cellules avant étirement:', cellsBefore.length);
    const firstCell = cellsBefore[0];
    const handle = await firstCell.$('.cell-resize-right');
    if (!handle) {
        const html = await firstCell.evaluate(el => el.outerHTML);
        console.log('PAS de poignée cell-resize-right trouvée, HTML de la case:', html);
    }
    const handleBox = await handle.boundingBox();

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + 120, handleBox.y + handleBox.height / 2, { steps: 6 });
    await page.waitForTimeout(150);

    const duringGridResize = await page.evaluate(() => {
        const reached = document.querySelector('.row-measure.row-measure-reached');
        const beatTicks = document.querySelectorAll('.cell-beat-tick').length;
        return { reachedText: reached ? reached.textContent : null, beatTicks };
    });
    console.log('pendant l\'étirement (grille classique):', JSON.stringify(duringGridResize));
    check(duringGridResize.reachedText !== null, "un numéro de mesure est mis en évidence (.row-measure-reached) pendant l'étirement d'un accord (grille classique)");
    check(duringGridResize.beatTicks > 0, "des traits de temps (.cell-beat-tick) apparaissent sur l'accord étiré (grille classique)");

    await page.mouse.up();
    await page.waitForTimeout(250);

    const afterGridResize = await page.evaluate(() => ({
        reached: !!document.querySelector('.row-measure.row-measure-reached'),
        beatTicks: document.querySelectorAll('.cell-beat-tick').length,
    }));
    console.log('après relâchement (grille classique):', JSON.stringify(afterGridResize));
    check(afterGridResize.reached === false, "le repère de mesure s'éteint bien une fois l'étirement de grille terminé");
    check(afterGridResize.beatTicks === 0, "les traits de temps disparaissent bien une fois l'étirement de grille terminé");

    // === 2. Le repère de temps du SÉQUENCEUR ===
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11) : la vue agrandie du séquenceur (et le temps allumé quand on étirait une note) a disparu. Au
    // séquenceur de l'onglet Rythme, c'est la croche qui sonne qui s'allume pendant la lecture de la barre de lecture.
    await R.cliquer(page, '#bl-plus', 400); await R.cliquer(page, '#pl-notes', 700);
    exiger(await page.evaluate(() => !!(window.app._bulle && window.app._bulle.rythme)), 'l\'onglet Rythme est rouvert');
    const tl = await R.teteLecture(page);
    check(tl.ok, `le repère de temps du séquenceur suit la lecture : la croche qui sonne s'allume, Stop l'éteint (${tl.detail})`);

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario');
    await browser.close();
    bilan();
})();
