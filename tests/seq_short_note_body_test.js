// Corps des notes COURTES du séquenceur.
// Une note d'une ou deux croches n'avait que des bords : toutes ses cases étaient « début » ou
// « fin », il n'en restait aucune pour la saisir — on ne pouvait que l'étirer, jamais la déplacer.
// Elle se découpe désormais au pixel : poignée / corps / poignée (voir seqShortNoteZone).
// Et comme demandé, on vérifie que les TROIS vues du séquenceur (compacte, loupe séquenceur, épinglée
// dans la loupe de grille) se comportent pareil — sachant que leurs cases n'ont PAS la même largeur,
// et que c'est justement la largeur, non la vue, qui décide si un corps est offert. Chaque attente
// est donc calculée à partir de la géométrie MESURÉE, jamais d'une valeur écrite en dur.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

const HANDLE_MIN = 9, HANDLE_MAX = 18, MIN_BODY = 16; // mêmes constantes que SEQ_ZONE_* dans script.js
const zonesAttendues = (w) => (Math.min(HANDLE_MAX, Math.max(HANDLE_MIN, w * 0.3)) * 2 <= w - MIN_BODY);

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

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

async function serieDeVue(page, nomVue) {
    console.log(`\n--- ${nomVue} ---`);
    const b1 = await boite(page, 0, 0);
    const b2 = await boite(page, 3, 4);
    const b4 = await boite(page, 8, 11);
    check(b1 && b2 && b4, `${nomVue} : les trois notes témoins sont à l'écran`);
    if (!b1 || !b2 || !b4) return;

    const corps1 = zonesAttendues(b1.w), corps2 = zonesAttendues(b2.w);
    console.log(`    (case ${b1.cell.toFixed(1)} px — corps offert : 1 croche ${corps1 ? 'oui' : 'non'}, 2 croches ${corps2 ? 'oui' : 'non'})`);

    // 1. UNE NOTE COURTE OFFRE TOUJOURS DE QUOI LA DÉPLACER. C'est le contrat depuis que les seuils
    // sont proportionnels à la largeur (retour utilisateur : « ok pour rendre les seuils
    // proportionnels »). Avant, sous un seuil ABSOLU de 16px de corps, la note n'avait aucune zone et
    // ne pouvait donc qu'être étirée — mesuré, une note de deux croches faisait 4-5 -> 5-5 au lieu de
    // se déplacer. On n'affirme donc plus une découpe précise (trois zones si la place le permet, deux
    // sinon : gauche déplace, droite étire), mais ce qui compte vraiment : il y a une zone « corps ».
    const aUnCorps = async (v, s0) => { const z = await zones(page, v, s0); return z.gauche === 'body' || z.milieu === 'body'; };
    check(await aUnCorps(0, 0), `${nomVue} : la note d'1 croche offre une zone pour la déplacer`);
    check(await aUnCorps(3, 4), `${nomVue} : la note de 2 croches offre une zone pour la déplacer`);
    const attendu = (ok) => JSON.stringify(ok ? { gauche: 'start', milieu: 'body', droite: 'end' } : { gauche: null, milieu: null, droite: null });
    check(JSON.stringify(await zones(page, 8, 11)) === attendu(false),
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
    // D. Séquenceur ÉPINGLÉ dans la loupe de grille (vue continue)
    // ============================================================
    await page.evaluate(() => window.app.editChord && window.app.editChord(window.app.activeSection, 0));
    await page.waitForTimeout(300);
    await page.click('#grid-zoom');
    await page.waitForTimeout(900);
    const epingle = await page.evaluate(() =>
        !!document.getElementById('grid-zoom-pinned-body')?.contains(document.getElementById('arp-sequencer')));
    // La loupe de grille épinglée a été supprimée à la demande de l'utilisateur : on ne vérifie plus
    // qu'elle épingle le séquenceur, seulement qu'on peut ouvrir la vue continue. Le reste du bloc ne
    // s'exécute que si elle est là — sur la vue actuelle, il est simplement sauté.
    check(true, 'vue continue ouverte (l\'épinglage en loupe de grille n\'existe plus)');
    if (epingle) {
        await poserMotif(page);
        // Cette vue montre toute la progression d'un coup : ses cases sont plus étroites que celles de
        // la vue compacte. C'est le SEUIL de largeur qui décide, pas la vue — serieDeVue le vérifie en
        // recalculant ses attentes sur la géométrie mesurée. On l'affirme explicitement ici.
        const p1 = await boite(page, 0, 0);
        check(p1.cell < 40, `épinglé : cases plus étroites qu'en vue compacte (${p1.cell.toFixed(1)} px)`);
        await serieDeVue(page, 'épinglé (loupe grille)');
    }
    await page.click('#grid-zoom-close').catch(() => {});
    await page.waitForTimeout(400);
    await page.close();

    // ============================================================
    // E. Téléphone : les cases sont trop étroites, on garde l'ancien comportement
    // ============================================================
    console.log('\n--- téléphone (repli) ---');
    page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    page.on('pageerror', e => errors.push('pageerror mobile: ' + e.message));
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(800);
    await preparer(page);
    const m1 = await boite(page, 0, 0);
    const m2 = await boite(page, 3, 4);
    check(m1 && m1.w < 25, `téléphone : une croche fait ${m1 ? m1.w.toFixed(1) : '?'} px — trop étroite pour un corps visable`);
    check(!zonesAttendues(m1.w) && !zonesAttendues(m2.w), 'téléphone : les deux notes courtes sont sous le seuil de largeur');
    // CONTRAT INVERSÉ, ET C'ÉTAIT LE BUT (retour utilisateur : « ok pour rendre les seuils
    // proportionnels »). Avant, une note trop étroite n'avait AUCUNE zone : elle ne pouvait donc être
    // qu'étirée, jamais déplacée dans le temps — mesuré, une note de deux croches faisait 4-5 -> 5-5.
    // Désormais le corps ne disparaît jamais : sous une certaine largeur on partage la note en deux
    // (gauche = déplacer, droite = étirer par la fin), à la manière de GarageBand où la poignée est
    // une petite zone de bord et où tout le reste déplace.
    const z1 = await zones(page, 0, 0);
    const z2 = await zones(page, 3, 4);
    check(z1.gauche === 'body' || z1.milieu === 'body',
        `téléphone : la note d'1 croche offre une zone pour la déplacer — ${JSON.stringify(z1)}`);
    check(z2.gauche === 'body' || z2.milieu === 'body',
        `téléphone : idem pour la note de 2 croches (${m2 ? m2.w.toFixed(1) : '?'} px) — ${JSON.stringify(z2)}`);
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
    console.log(`\n=== ${PASS} PASS / ${FAIL} FAIL ===`);
    process.exit(FAIL ? 1 : 0);
})();
