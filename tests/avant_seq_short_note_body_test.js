// Corps des notes COURTES du séquenceur.
// Une note d'une ou deux croches n'avait que des bords : toutes ses cases étaient « début » ou
// « fin », il n'en restait aucune pour la saisir — on ne pouvait que l'étirer, jamais la déplacer.
// Elle se découpe désormais au pixel : poignée / corps / poignée (voir seqShortNoteZone).
// Et comme demandé, on vérifie que les TROIS vues du séquenceur (compacte, loupe séquenceur, volet
// continu sous la grille) se comportent pareil — sachant que leurs cases n'ont PAS la même largeur,
// et que c'est justement la largeur, non la vue, qui décide si un corps est offert. Chaque attente
// est donc calculée à partir de la géométrie MESURÉE, jamais d'une valeur écrite en dur.
//
// La troisième vue s'appelait « épinglée dans la loupe de grille » et se cherchait dans
// #grid-zoom-pinned-body : cet hôte a disparu avec la vue plein écran de la grille, remplacée par le
// volet ancré (#seq-dock-host). Le bloc échouait donc à sa toute première vérification et RENONÇAIT
// silencieusement à tout le reste — une vue entière n'était plus éprouvée du tout. C'est en la
// rebranchant qu'un vrai défaut est apparu (bande morte de 4px entre deux cases, voir .seq-cell-b
// dans style.css) : un banc qui abandonne en silence ne protège rien.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

// Mêmes constantes que SEQ_ZONE_* dans script.js — recopiées ici plutôt qu'importées ; avaient dérivé
// (9/18/16 avec un ratio de 0.3) après un réglage des seuils vers des poignées plus généreuses au
// toucher (SEQ_ZONE_HANDLE_MIN_PX/MIN_BODY_PX abaissés), ce qui faussait ce banc pour la mauvaise
// raison — il prédisait « pas de corps » là où l'appli, avec ses vrais seuils, en offre bien un.
const HANDLE_RATIO = 0.25, HANDLE_MIN = 5, HANDLE_MAX = 18, MIN_BODY = 6;
const zonesAttendues = (w) => (Math.min(HANDLE_MAX, Math.max(HANDLE_MIN, w * HANDLE_RATIO)) * 2 <= w - MIN_BODY);

// Compteurs et bilan délégués au harnais commun (voir tests/_harness.js) : c'est lui qui porte
// `plan`, le garde-fou contre les vérifications qui disparaissent en silence — le défaut que ce
// fichier précis a subi (voir son en-tête, la troisième vue n'était plus éprouvée du tout).
const { check, exiger, plan, bilan } = require('./_harness')('corps des notes courtes');
// PLANCHER, pas un compte exact : le nombre de vérifications varie légitimement avec la géométrie
// MESURÉE (une note assez large reçoit trois zones, une note étroite deux — voir `attendu`). 45
// laisse cette marge tout en rendant impossible la perte d'une VUE entière (~13 vérifications
// chacune, sur les 56 que rend ce banc au complet).
plan(45);

// note 1 croche en 0 ; note 2 croches en 3-4 ; note 4 croches en 8-11 (témoin : elle a déjà un corps)
async function poserMotif(page) {
    await page.evaluate(() => {
        const app = window.app;
        const { pattern, tie } = app.getLiveSeqPattern(app.readChord());
        for (let s = 0; s < pattern.length; s++) { pattern[s] = []; tie[s] = []; }
        pattern[0].push(0);
        pattern[3].push(0); pattern[4].push(0); tie[4].push(0);
        pattern[8].push(0); for (let s = 9; s <= 11; s++) { pattern[s].push(0); tie[s].push(0); }
        app.setLiveSeqPattern(pattern, tie);
        app.seqTouched = true; app.seqSelections = []; app.renderSequencer();
    });
    await page.waitForTimeout(300);
}

const notes = (page) => page.evaluate(() => [...document.querySelectorAll('.seq-note[data-voice="0"]')]
    .map(n => `${n.dataset.start}-${n.dataset.end}`).sort());

const boite = (page, start, end) => page.evaluate(([s, e]) => {
    const n = document.querySelector(`.seq-note[data-voice="0"][data-start="${s}"][data-end="${e}"]`);
    if (!n) return null;
    // AMENER LA NOTE DANS LA BANDE avant de relever ses coordonnées. La vue continue affiche tout
    // l'ambitus (60 lignes chromatiques) dans un volet bien plus court, et se recentre en plus sur
    // l'accord édité : la ligne de la voix 0 se retrouvait à y=776 alors que la bande s'arrête à
    // y=616. Les coordonnées restaient « valides » — le rectangle existe — mais elementFromPoint y
    // renvoyait .viz-wrap, la carte des diagrammes SOUS le séquenceur : tous les gestes de cette vue
    // partaient donc dans le vide, sans que rien ne le signale. Un rectangle n'est pas une garantie
    // d'atteignabilité ; c'est la leçon déjà tirée pour caseTouchable dans probe_defilement_tactile.
    n.scrollIntoView({ block: 'center', inline: 'center' });
    const r = n.getBoundingClientRect();
    return { left: r.left, right: r.right, w: r.width, y: r.top + r.height / 2, cell: r.width / (e - s + 1) };
}, [start, end]);

const zones = (page, start, end) => page.evaluate(([s, e]) => {
    const n = document.querySelector(`.seq-note[data-voice="0"][data-start="${s}"][data-end="${e}"]`);
    if (!n) return null;
    const r = n.getBoundingClientRect();
    const z = (x) => window.app.seqShortNoteZone(0, s, e, x);
    return { gauche: z(r.left + 2), milieu: z(r.left + r.width / 2), droite: z(r.right - 2) };
}, [start, end]);

async function preparer(page) {
    await page.fill('#quick-add-input', 'C');
    await page.click('#quick-add-btn');
    await page.waitForTimeout(350);
    if (!(await page.evaluate(() => window.app.seqOpen))) await page.click('#toggle-sequencer');
    await page.waitForTimeout(450);
    await poserMotif(page);
}

// Glissé horizontal en plusieurs étapes (le seuil de 10 px et la décision d'axe se jouent sur les
// tout premiers mouvements). On vise TOUJOURS le CENTRE d'une case, jamais une frontière : à cheval
// entre deux cases, la case retenue dépend d'un arrondi et le test mesurerait ce hasard-là.
async function glisser(page, x, y, dx) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(60);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) { await page.mouse.move(x + (dx * i) / 6, y); await page.waitForTimeout(35); }
    await page.mouse.up();
    await page.waitForTimeout(350);
}

// CONTRAT. Une note trop étroite pour trois zones ne renvoie PLUS `null` partout : seqShortNoteZone
// la partage en DEUX (60 % à gauche pour la déplacer, 40 % à droite pour l'allonger). Renvoyer null
// revenait à « condamner la note à ne jamais pouvoir être déplacée » — c'est écrit tel quel dans
// script.js, et c'est le défaut que ce partage corrige. Au niveau module : la section « téléphone »
// s'en sert aussi, hors de serieDeVue.
const attendu = (ok) => JSON.stringify(ok
    ? { gauche: 'start', milieu: 'body', droite: 'end' }
    : { gauche: 'body', milieu: 'body', droite: 'end' });

async function serieDeVue(page, nomVue) {
    console.log(`\n--- ${nomVue} ---`);
    const b1 = await boite(page, 0, 0);
    const b2 = await boite(page, 3, 4);
    const b4 = await boite(page, 8, 11);
    check(b1 && b2 && b4, `${nomVue} : les trois notes témoins sont à l'écran`);
    if (!b1 || !b2 || !b4) return;

    const corps1 = zonesAttendues(b1.w), corps2 = zonesAttendues(b2.w);
    console.log(`    (case ${b1.cell.toFixed(1)} px — corps offert : 1 croche ${corps1 ? 'oui' : 'non'}, 2 croches ${corps2 ? 'oui' : 'non'})`);

    // 1. Découpage : trois zones sur les notes courtes ASSEZ LARGES, rien ailleurs
    check(JSON.stringify(await zones(page, 0, 0)) === attendu(corps1),
        `${nomVue} : note d'1 croche — ${corps1 ? 'découpée en début / corps / fin' : 'trop étroite, comportement d\'avant conservé'}`);
    check(JSON.stringify(await zones(page, 3, 4)) === attendu(corps2),
        `${nomVue} : note de 2 croches — ${corps2 ? 'découpée en début / corps / fin' : 'trop étroite, comportement d\'avant conservé'}`);
    // Une note LONGUE (> 2 croches) renvoie null partout, et pour une raison qui n'a rien à voir avec
    // l'étroitesse : elle possède déjà de vraies cases de corps, le découpage au pixel ne la concerne
    // pas (voir seqShortNoteZone, tout premier test). À ne pas confondre avec `attendu(false)`, qui
    // décrit une note TROP ÉTROITE — celle-ci est partagée en deux, pas laissée sans zone.
    const AUCUNE_ZONE = JSON.stringify({ gauche: null, milieu: null, droite: null });
    check(JSON.stringify(await zones(page, 8, 11)) === AUCUNE_ZONE,
        `${nomVue} : note de 4 croches jamais découpée au pixel (elle a déjà des cases de corps)`);

    // 2. Le CORPS déplace la note — c'est tout l'objet du chantier
    if (corps1) {
        await glisser(page, b1.left + b1.cell / 2, b1.y, b1.cell * 2);
        const apres = await notes(page);
        check(apres.includes('2-2') && !apres.includes('0-0'),
            `${nomVue} : glissé depuis le corps d'une note d'1 croche → elle se DÉPLACE (0-0 → 2-2), durée inchangée [${apres.join(' ')}]`);
        await poserMotif(page);
    }
    if (corps2) {
        // Saisie à 40 % de la note : toujours dans le corps (la poignée vaut au plus 30 % de la note,
        // et au plus 18 px), et à 80 % de la PREMIÈRE case — donc loin de la frontière entre les deux,
        // où la case retenue dépendrait d'un arrondi. Viser le centre de la seconde case, lui, tombe
        // dans la poignée de fin dès que les cases sont étroites (vue épinglée) : ce serait mesurer la
        // géométrie du test, pas le comportement de l'appli.
        await glisser(page, b2.left + b2.w * 0.4, b2.y, b2.cell);
        const apres = await notes(page);
        check(apres.includes('4-5') && !apres.includes('3-4'),
            `${nomVue} : glissé depuis le corps d'une note de 2 croches → elle se déplace (3-4 → 4-5), durée conservée [${apres.join(' ')}]`);
        await poserMotif(page);
    }

    // 3. Les POIGNÉES étirent toujours — la régression qu'il ne faut surtout pas introduire
    let b = await boite(page, 3, 4);
    await glisser(page, b.right - 2, b.y, b.cell);
    let apres = await notes(page);
    check(apres.includes('3-5'), `${nomVue} : poignée de FIN d'une note de 2 croches → elle s'étire d'une croche (3-4 → 3-5) [${apres.join(' ')}]`);
    await poserMotif(page);

    b = await boite(page, 3, 4);
    await glisser(page, b.left + 2, b.y, -b.cell);
    apres = await notes(page);
    check(apres.includes('2-4'), `${nomVue} : poignée de DÉBUT d'une note de 2 croches → elle s'étire vers la gauche (3-4 → 2-4) [${apres.join(' ')}]`);
    await poserMotif(page);

    b = await boite(page, 0, 0);
    await glisser(page, b.right - 2, b.y, b.cell * 2);
    apres = await notes(page);
    check(apres.includes('0-2'), `${nomVue} : poignée de FIN d'une note d'1 croche → elle s'étire vers la droite (0-0 → 0-2) [${apres.join(' ')}]`);
    await poserMotif(page);

    // 4. La note LONGUE garde son geste d'avant, depuis n'importe laquelle de ses cases de corps
    b = await boite(page, 8, 11);
    await glisser(page, b.left + b.cell * 1.5, b.y, b.cell);
    apres = await notes(page);
    check(apres.includes('9-12'), `${nomVue} : note de 4 croches déplacée depuis son corps comme avant (8-11 → 9-12) [${apres.join(' ')}]`);
    await poserMotif(page);

    // 5. Un simple CLIC sur le corps ne modifie toujours rien : il sélectionne
    b = await boite(page, 0, 0);
    await page.mouse.click(b.left + b.cell / 2, b.y);
    await page.waitForTimeout(300);
    apres = await notes(page);
    check(apres.includes('0-0') && apres.includes('3-4') && apres.includes('8-11'),
        `${nomVue} : un clic sur le corps ne modifie rien (il sélectionne, comme avant)`);
    check(await page.evaluate(() => window.app.seqSelections.some(s => s.voice === 0 && s.start === 0 && s.end === 0)),
        `${nomVue} : ce clic a bien SÉLECTIONNÉ la note courte`);
    await poserMotif(page);
}

(async () => {
    const browser = await chromium.launch();
    const errors = [];

    // ============================================================
    // A. Vue COMPACTE (celle par défaut, sous la grille)
    // ============================================================
    let page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(800);
    await preparer(page);
    await serieDeVue(page, 'compacte');

    // ============================================================
    // B. Retour visuel : curseur et liseré doivent dire la vérité
    // ============================================================
    console.log('\n--- retour visuel (survol) ---');
    const b1 = await boite(page, 0, 0);
    const etatCase = () => page.evaluate(() => {
        const c = document.querySelector('.seq-cell[data-voice="0"][data-step="0"]');
        return {
            corps: c.classList.contains('seq-zone-body'),
            curseur: getComputedStyle(c).cursor,
            avant: getComputedStyle(c, '::before').display,
            apres: getComputedStyle(c, '::after').display,
        };
    });

    await page.mouse.move(b1.left + 2, b1.y);
    await page.waitForTimeout(200);
    let e1 = await etatCase();
    check(!e1.corps, 'survol de la poignée gauche : la case n\'est pas marquée « corps »');
    check(e1.curseur === 'ew-resize', `survol de la poignée gauche : curseur d'étirement (${e1.curseur})`);
    check(e1.avant !== 'none', 'survol de la poignée gauche : le liseré de bord reste affiché');

    await page.mouse.move(b1.left + b1.w / 2, b1.y);
    await page.waitForTimeout(200);
    let e2 = await etatCase();
    check(e2.corps, 'survol du corps : la case est marquée « corps »');
    // Le curseur « main » (grab/grabbing) a été retiré du corps d'une note (voir
    // sequencer_reticle_cursor_test.js) : retour utilisateur, « le curseur change de forme (main)
    // lorsque je suis sur une barre... il faut garder le curseur que tu viens de mettre en place » —
    // le réticule fin reste affiché partout dans le séquenceur, y compris sur le corps d'une note.
    // Seul compte ici ce que ce banc-ci garantit vraiment : PAS de curseur d'étirement sur le corps.
    check(e2.curseur !== 'ew-resize', `survol du corps : pas de curseur d'étirement, contrairement au bord (${e2.curseur})`);
    check(e2.avant === 'none' && e2.apres === 'none', 'survol du corps : les liserés de bord s\'effacent');

    await page.mouse.move(b1.right - 2, b1.y);
    await page.waitForTimeout(200);
    let e3 = await etatCase();
    check(!e3.corps, 'retour sur la poignée droite : le marquage « corps » est retiré');
    check(e3.curseur === 'ew-resize', `survol de la poignée droite : curseur d'étirement (${e3.curseur})`);
    check(e3.apres !== 'none', 'survol de la poignée droite : le liseré de bord revient');

    const b4 = await boite(page, 8, 11);
    await page.mouse.move(b4.left + b4.w / 2, b4.y);
    await page.waitForTimeout(200);
    check(await page.evaluate(() => document.querySelectorAll('.seq-cell.seq-zone-body').length === 0),
        'survol du milieu d\'une note longue : aucune case marquée « corps » (découpage par case inchangé)');

    // Le marquage doit survivre à une reconstruction du séquenceur (les cases sont recréées)
    await page.mouse.move(b1.left + b1.w / 2, b1.y);
    await page.waitForTimeout(150);
    await page.evaluate(() => window.app.renderSequencer());
    await page.waitForTimeout(200);
    check(await page.evaluate(() => {
        const c = document.querySelector('.seq-cell[data-voice="0"][data-step="0"]');
        return c && c.classList.contains('seq-zone-body');
    }), 'après un nouveau rendu, le marquage « corps » est reposé sur les cases neuves');

    await page.mouse.move(5, 5);
    await page.waitForTimeout(200);
    check(await page.evaluate(() => document.querySelectorAll('.seq-cell.seq-zone-body').length === 0),
        'pointeur sorti du séquenceur : plus aucune case marquée');

    // ============================================================
    // C. Vue LOUPE du séquenceur
    // ============================================================
    await poserMotif(page);
    await page.click('#seq-zoom');
    await page.waitForTimeout(700);
    check(await page.evaluate(() => window.app.seqZoomOpen), 'la loupe séquenceur est ouverte');
    await poserMotif(page);
    await serieDeVue(page, 'loupe séquenceur');
    await page.click('#seq-zoom-close');
    await page.waitForTimeout(500);

    // ============================================================
    // D. Séquenceur CONTINU, dans son volet sous la grille (vue continue)
    // Ce bloc visait #grid-zoom-pinned-body, l'hôte de la vue plein écran de la grille — supprimée
    // depuis, remplacée par le volet ancré sous la grille (#seq-dock-host, voir placeSequencer). Le
    // bouton, lui, n'a pas changé de nom (#grid-zoom garde son id historique, renommer étant risqué
    // pour un index.html servi en cache — voir son commentaire). La TROISIÈME vue existe donc
    // toujours ; seul son hôte a changé, et le banc le cherchait au mauvais endroit.
    // ============================================================
    await page.evaluate(() => window.app.editChord && window.app.editChord(window.app.activeSection, 0));
    await page.waitForTimeout(300);
    await page.click('#grid-zoom');
    await page.waitForTimeout(900);
    const epingle = await page.evaluate(() =>
        !!document.getElementById('seq-dock-host')?.contains(document.getElementById('arp-sequencer')));
    exiger(epingle, 'le séquenceur est bien dans son volet continu sous la grille');
    if (epingle) {
        await poserMotif(page);
        // Cette vue montre toute la progression d'un coup : ses cases sont plus étroites que celles de
        // la vue compacte. C'est le SEUIL de largeur qui décide, pas la vue — serieDeVue le vérifie en
        // recalculant ses attentes sur la géométrie mesurée. On l'affirme explicitement ici.
        const p1 = await boite(page, 0, 0);
        check(p1.cell < 40, `volet continu : cases plus étroites qu'en vue compacte (${p1.cell.toFixed(1)} px)`);
        await serieDeVue(page, 'volet continu');
    }
    await page.click('#grid-zoom').catch(() => {}); // même bouton pour refermer (bascule)
    await page.waitForTimeout(400);
    await page.close();

    // ============================================================
    // E. Téléphone : mêmes règles, appliquées à des cases plus étroites
    // Ce bloc affirmait « les cases sont trop étroites, on garde l'ancien comportement » (aucune zone
    // du tout). Deux choses l'ont périmé : les seuils SEQ_ZONE_* ont été abaissés (poignée à 25 % de
    // la note, plancher 5px, corps minimum 6px), si bien qu'une note de 2 croches — 37px ici — obtient
    // désormais bel et bien ses trois zones ; et une note VRAIMENT trop étroite n'est plus laissée
    // sans zone, elle est partagée en deux (voir `attendu` plus haut). On applique donc ici la MÊME
    // attente calculée depuis la géométrie mesurée que sur les autres vues, conformément au principe
    // annoncé en tête de ce fichier — plutôt qu'un comportement écrit en dur qui redevient faux au
    // prochain réglage de seuil.
    // ============================================================
    console.log('\n--- téléphone (repli) ---');
    page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    page.on('pageerror', e => errors.push('pageerror mobile: ' + e.message));
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(800);
    await preparer(page);
    const m1 = await boite(page, 0, 0);
    const m2 = await boite(page, 3, 4);
    check(m1 && m1.w < 25, `téléphone : une croche fait ${m1 ? m1.w.toFixed(1) : '?'} px — la plus étroite des trois vues`);
    const mCorps1 = zonesAttendues(m1.w), mCorps2 = zonesAttendues(m2.w);
    check(JSON.stringify(await zones(page, 0, 0)) === attendu(mCorps1),
        `téléphone : note d'1 croche (${m1.w.toFixed(1)}px) — ${mCorps1 ? 'découpée en début / corps / fin' : 'partagée en deux (déplacer / allonger)'}`);
    check(JSON.stringify(await zones(page, 3, 4)) === attendu(mCorps2),
        `téléphone : note de 2 croches (${m2.w.toFixed(1)}px) — ${mCorps2 ? 'découpée en début / corps / fin' : 'partagée en deux (déplacer / allonger)'}`);
    await page.touchscreen.tap(m1.left + m1.w / 2, m1.y);
    await page.waitForTimeout(300);
    check((await notes(page)).includes('0-0'), 'téléphone : un tap au milieu d\'une note courte ne la modifie toujours pas');
    check(await page.evaluate(() => document.querySelectorAll('.seq-cell.seq-zone-body').length === 0),
        'téléphone : aucune case marquée « corps » (pas de survol au doigt)');
    // L'étirement au doigt depuis un bord doit rester exactement ce qu'il était
    const t = await boite(page, 3, 4);
    await page.touchscreen.tap(t.left + t.cell / 2, t.y); // sélectionne pour faire apparaître les poignées
    await page.waitForTimeout(250);
    check((await notes(page)).includes('3-4'), 'téléphone : tap sur une note de 2 croches — toujours une simple sélection');
    await page.close();

    await browser.close();
    console.log('\nErreurs page : ' + (errors.length ? errors.join(' | ') : 'aucune'));
    check(errors.length === 0, 'aucune erreur JavaScript');
    bilan();
})();
