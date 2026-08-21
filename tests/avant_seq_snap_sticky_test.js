// Lot 2, revu : le pas du séquenceur et la durée « collante » des nouvelles notes.
// Le sélecteur d'aimantation (1/4, 1/8, 1/16) que ce banc éprouvait a été RETIRÉ depuis, par
// décision : il fallait le régler avant de dessiner, et l'oublier posait les notes ailleurs qu'où
// l'on visait. Le banc a donc été retourné vers ce qui reste — le pas vaut la case, et aucun
// recalage ne s'interpose entre le geste et l'endroit visé.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

async function runsOf(page, voice) {
    return page.evaluate((v) => {
        const app = window.app;
        const { pattern, tie } = app.getLiveSeqPattern(app.readChord());
        const runs = [];
        for (let s = 0; s < pattern.length; s++) {
            if (!pattern[s].includes(v)) continue;
            if (s > 0 && pattern[s - 1].includes(v) && tie[s].includes(v)) continue;
            let e = s;
            while (e + 1 < pattern.length && pattern[e + 1].includes(v) && tie[e + 1].includes(v)) e++;
            runs.push({ start: s, end: e });
        }
        return runs;
    }, voice);
}

async function clearVoice(page, voice) {
    await page.evaluate((v) => {
        const app = window.app;
        const { pattern } = app.getLiveSeqPattern(app.readChord());
        for (let s = 0; s < pattern.length; s++) app.applySeqCell(v, s, false);
        app.seqSelections = [];
        app.renderSequencer();
    }, voice);
    await page.waitForTimeout(120);
}

async function cellCenter(page, voice, step) {
    return page.evaluate(({ v, s }) => {
        const el = document.querySelector(`.seq-cell[data-voice="${v}"][data-step="${s}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, { v: voice, s: step });
}

// Un point visé sur la BARRE de note elle-même, en fraction de sa largeur (+ décalage en pixels).
// Les zones corps/poignée se découpent au pixel sur la barre (voir seqShortNoteZone) : viser une
// case, dont les bords ne coïncident pas exactement avec elle, éprouverait la mise en page.
async function pointSurNote(page, voice, start, end, fraction, decalage = 0) {
    return page.evaluate(({ v, s, e, f, d }) => {
        const n = document.querySelector(`.seq-note[data-voice="${v}"][data-start="${s}"][data-end="${e}"]`);
        if (!n) return null;
        const r = n.getBoundingClientRect();
        return { x: r.left + r.width * f + d, y: r.top + r.height / 2 };
    }, { v: voice, s: start, e: end, f: fraction, d: decalage });
}

async function drag(page, from, to) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) {
        await page.mouse.move(from.x + (to.x - from.x) * i / 12, from.y + (to.y - from.y) * i / 12);
        await page.waitForTimeout(8);
    }
    await page.mouse.up();
    await page.waitForTimeout(180);
}

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(700);
    await page.fill('#quick-add-input', 'C').catch(() => {});
    await page.click('#quick-add-btn').catch(() => {});
    await page.waitForTimeout(250);
    if (!(await page.evaluate(() => window.app.seqOpen))) await page.evaluate(() => window.app.toggleSequencer('compact'));
    await page.waitForTimeout(400);

    // ============================================================
    // === A. L'aimantation est FIXE : il n'y a plus de sélecteur ===
    // ============================================================
    // CE BANC ÉPROUVAIT UN SÉLECTEUR QUI N'EXISTE PLUS, et c'est une décision, pas une perte.
    // Le choix 1/4-1/8-1/16 a été retiré (voir seqSnap dans script.js, qui porte la raison) : il
    // fallait le régler AVANT de dessiner, et l'oublier posait des notes au mauvais endroit. Une case
    // de la grille EST une double croche, donc « se caler sur la case » ne restreint plus rien —
    // c'est déjà la précision maximale que la vue permet.
    // Ce qui reste à éprouver, et qui est le fond de l'affaire : le pas est bien de 1, c'est-à-dire
    // qu'aucune aimantation ne s'interpose entre le clic et la case visée.
    check(await page.evaluate(() => !document.querySelector('.seq-snap-group')),
        'plus aucun sélecteur d\'aimantation dans la barre : le pas est fixe');
    check(await page.evaluate(() => window.app.seqSnap() === 1), 'seqSnap() vaut bien 1 double croche, la case elle-même');

    // ============================================================
    // === B. Sans aimantation : comportement historique inchangé ===
    // ============================================================
    await clearVoice(page, 0);
    await page.mouse.click(...Object.values(await cellCenter(page, 0, 5)));
    await page.waitForTimeout(200);
    let runs = await runsOf(page, 0);
    // UNE CROCHE, ET NON UNE DOUBLE CROCHE. Ce banc attendait une note d'une seule case. Le repli a
    // changé en même temps que le sélecteur disparaissait : seqNewNoteLen() rend 2 par défaut, soit
    // une croche — « la durée la plus courante », et l'ancien repli (le pas d'aimantation) n'existe
    // plus. Ce qui compte n'a pas bougé : la note commence PILE où l'on clique.
    check(runs.length === 1 && runs[0].start === 5 && runs[0].end === 6,
        `un clic pose une croche qui commence pile où on clique — obtenu ${JSON.stringify(runs)}`);

    await clearVoice(page, 0);
    await drag(page, await cellCenter(page, 0, 3), await cellCenter(page, 0, 6));
    runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start === 3 && runs[0].end === 6,
        `sans aimantation, un glissé peint exactement 3->6 — obtenu ${JSON.stringify(runs)}`);

    // ============================================================
    // === C. Durée collante : après avoir dessiné une note de 4, un clic en repose une de 4 ===
    // ============================================================
    await clearVoice(page, 0);
    await drag(page, await cellCenter(page, 0, 0), await cellCenter(page, 0, 3)); // note de 4 croches
    await page.mouse.click(...Object.values(await cellCenter(page, 0, 8)));
    await page.waitForTimeout(200);
    runs = await runsOf(page, 0);
    const sticky = runs.find(r => r.start === 8);
    check(sticky && sticky.end === 11,
        `la nouvelle note reprend la durée de la dernière dessinée (4 croches) — obtenu ${JSON.stringify(runs)}`);

    // ...mais sans jamais empiéter sur une note déjà là
    await clearVoice(page, 0);
    await drag(page, await cellCenter(page, 0, 0), await cellCenter(page, 0, 3)); // mémorise 4
    await page.evaluate(() => { const a = window.app; a.applySeqCell(0, 10, true, false); a.renderSequencer(); });
    await page.waitForTimeout(150);
    await page.mouse.click(...Object.values(await cellCenter(page, 0, 8)));
    await page.waitForTimeout(200);
    runs = await runsOf(page, 0);
    const clipped = runs.find(r => r.start === 8);
    check(clipped && clipped.end === 9,
        `la durée collante est rabotée avant la note suivante, jamais écrasée — obtenu ${JSON.stringify(runs)}`);

    // ============================================================
    // === D. Le clic pose la note PILE sur la case visée ===
    // ============================================================
    // Ce que le sélecteur d'aimantation garantissait « en 1/4 » (le clic se cale sur le temps) n'a
    // plus lieu d'être : le pas vaut 1, donc la seule garantie qui compte est qu'AUCUN recalage ne
    // s'interpose. C'est très exactement ce qui avait motivé le retrait du sélecteur — il fallait le
    // régler avant de dessiner, et l'oublier posait les notes ailleurs qu'où l'on visait.
    await page.evaluate(() => { window.app.seqStickyLen = null; });
    await clearVoice(page, 0);
    await page.mouse.click(...Object.values(await cellCenter(page, 0, 6)));
    await page.waitForTimeout(200);
    runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start === 6 && runs[0].end === 7,
        `un clic sur la case 6 pose une croche qui commence sur la case 6, sans recalage — obtenu ${JSON.stringify(runs)}`);

    // ============================================================
    // === E. Un glissé peint exactement les cases survolées ===
    // ============================================================
    await clearVoice(page, 0);
    await drag(page, await cellCenter(page, 0, 1), await cellCenter(page, 0, 9));
    runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start === 1 && runs[0].end === 9,
        `un glissé 1->9 peint 1->9, bords compris — obtenu ${JSON.stringify(runs)}`);

    // ============================================================
    // === F. Étirer un bord s'arrête pile sur la case survolée ===
    // ============================================================
    await clearVoice(page, 0);
    await drag(page, await cellCenter(page, 0, 0), await cellCenter(page, 0, 7));
    runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start === 0 && runs[0].end === 7,
        `note de deux temps posée — obtenu ${JSON.stringify(runs)}`);
    // La règle « le cran survolé est couvert en entier » demeure ; simplement, le cran est la case.
    await drag(page, await cellCenter(page, 0, 7), await cellCenter(page, 0, 2));
    runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start === 0 && runs[0].end === 2,
        `raccourcir le bord droit s'arrête sur la case survolée (0->2) — obtenu ${JSON.stringify(runs)}`);
    await drag(page, await cellCenter(page, 0, 2), await cellCenter(page, 0, 5));
    runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start === 0 && runs[0].end === 5,
        `rallonger le bord droit s'arrête sur la case survolée (0->5) — obtenu ${JSON.stringify(runs)}`);

    // ============================================================
    // === G. Déplacer une note par son corps : elle retombe où on la lâche ===
    // ============================================================
    await clearVoice(page, 0);
    await drag(page, await cellCenter(page, 0, 0), await cellCenter(page, 0, 3));
    runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start === 0 && runs[0].end === 3, `note de 4 croches posée — obtenu ${JSON.stringify(runs)}`);
    // Saisie sur sa 2e case (du corps : ni début ni fin), lâchée sur la case 6 : c'est le POINT SAISI
    // qui suit le pointeur, donc la note glisse de 5 croches et garde sa longueur.
    await drag(page, await cellCenter(page, 0, 1), await cellCenter(page, 0, 6));
    runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start === 5 && runs[0].end === 8,
        `la note déplacée suit le point saisi et garde sa longueur (5->8) — obtenu ${JSON.stringify(runs)}`);

    // CONTRAT CHANGÉ (à la demande : « mettre un corps aux notes qui n'en ont pas »). Une note de deux
    // croches n'avait que des bords : le centre de sa seconde case ÉTIRAIT, faute de mieux. Elle se
    // découpe désormais au pixel (voir seqShortNoteZone) — corps au milieu, poignées aux extrémités.
    // ON VISE LA BARRE, PAS LA CASE : à cette largeur, le centre de la 2e case tombe à un demi-pixel
    // de la frontière corps/poignée. Le banc éprouvait donc un cheveu de mise en page, pas la règle ;
    // le milieu de la barre, lui, est du corps quelle que soit la largeur.
    await clearVoice(page, 0);
    await drag(page, await cellCenter(page, 0, 0), await cellCenter(page, 0, 1));
    const corps2 = await pointSurNote(page, 0, 0, 1, 0.5);
    await drag(page, corps2, await cellCenter(page, 0, 5));
    runs = await runsOf(page, 0);
    check(runs.length === 1 && (runs[0].end - runs[0].start) === 1 && runs[0].start > 0,
        `une note de 2 croches saisie par son corps se DÉPLACE, longueur intacte — obtenu ${JSON.stringify(runs)}`);

    // ...et depuis sa vraie POIGNÉE (les tout derniers pixels), elle s'étire toujours.
    await clearVoice(page, 0);
    await drag(page, await cellCenter(page, 0, 0), await cellCenter(page, 0, 1));
    const poignee2 = await pointSurNote(page, 0, 0, 1, 1, -2);
    await drag(page, poignee2, await cellCenter(page, 0, 5));
    runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start === 0 && runs[0].end === 5,
        `une note de 2 croches s'étire toujours depuis sa poignée de fin (0->5) — obtenu ${JSON.stringify(runs)}`);

    // ============================================================
    // === H. Le pas fixe survit à un rechargement ===
    // ============================================================
    // Il n'y a plus de réglage à retrouver : c'est justement l'intérêt du retrait. Ce qui doit
    // survivre, c'est l'absence de réglage — aucun reste en mémoire ne peut ressusciter un pas
    // qui décalerait les clics au prochain démarrage.
    await page.reload();
    await page.waitForTimeout(600);
    check(await page.evaluate(() => window.app.seqSnap() === 1),
        `après rechargement, le pas vaut toujours 1 — obtenu ${await page.evaluate(() => window.app.seqSnap())}`);
    check(await page.evaluate(() => localStorage.getItem('harmohubSeqSnap') === null),
        'aucun pas d\'aimantation ne traîne en mémoire pour ressusciter au prochain démarrage');

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 || errors.length > 0 ? 1 : 0);
})();
