// Lot 7 : une note libre ajoutée doit être JOUÉE d'emblée.
// Règle : elle copie le rythme des voix de l'accord si elles jouent toutes le même, sinon tenue
// pleine durée — et ce rythme est posé À LA VALIDATION DE LA HAUTEUR, jamais à la création.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

// Cases actives d'une voix, dans le motif vivant.
async function voiceSteps(page, voice) {
    return page.evaluate((v) => {
        const app = window.app;
        const { pattern } = app.getLiveSeqPattern(app.readChord());
        return pattern.reduce((acc, s, i) => (s.includes(v) ? [...acc, i] : acc), []);
    }, voice);
}
async function state(page) {
    return page.evaluate(() => ({
        root: document.getElementById('root').value,
        quality: document.getElementById('quality').value,
        extras: window.app.extraNotes.length,
        bodyVoices: window.app.readChord().getIntervals().length,
        totalVoices: window.app.readChord().getSeqMidiNotes().length,
    }));
}

async function openSeqOn(page, sym) {
    await page.fill('#quick-add-input', sym);
    await page.click('#quick-add-btn');
    await page.waitForTimeout(250);
    if (!(await page.evaluate(() => window.app.seqOpen))) await page.evaluate(() => window.app.toggleSequencer('compact'));
    await page.waitForTimeout(400);
}

(async () => {
    const browser = await chromium.launch();
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(700);
    await openSeqOn(page, 'C');

    const before = await state(page);
    console.log('accord de départ:', JSON.stringify(before));

    // ============================================================
    // === A. Le clic sur « + » ne joue ni ne renomme RIEN ===
    // ============================================================
    await page.click('#seq-add-note');
    await page.waitForTimeout(300);
    const afterAdd = await state(page);
    check(afterAdd.extras === 1, `la ligne de note libre est bien créée — obtenu ${afterAdd.extras}`);
    check(afterAdd.root === before.root && afterAdd.quality === before.quality,
        `le clic sur « + » ne renomme PAS l'accord (la hauteur proposée n'est qu'un espace réservé) — ${afterAdd.root}${afterAdd.quality} vs ${before.root}${before.quality}`);
    const newVoice = before.bodyVoices; // 1re note libre = juste après le corps de l'accord
    check((await voiceSteps(page, newVoice)).length === 0,
        'à la création, la ligne est encore vide — c\'est voulu, la vraie hauteur n\'est pas connue');

    // ============================================================
    // === B. Valider une hauteur donne enfin un rythme à la note ===
    // ============================================================
    const input = await page.$(`.seq-label-input[data-extra-index="0"]`);
    check(!!input, 'le champ de saisie de la note libre est bien présent');
    await input.fill('D4'); // 9e sur un do : hauteur qui ne renomme pas l'accord en qualité connue
    await input.press('Enter');
    await page.waitForTimeout(400);

    const st = await state(page);
    const played = await voiceSteps(page, newVoice);
    const totalSteps = await page.evaluate(() => window.app.getLiveSeqPattern(window.app.readChord()).pattern.length);
    console.log('après validation:', JSON.stringify(st), 'cases jouées:', played.length, '/', totalSteps);
    check(played.length > 0, `la note est désormais JOUÉE dès la validation de sa hauteur — ${played.length} cases actives`);
    check(played.length === totalSteps,
        `l'accord de départ étant tenu, la note l'est aussi sur toute la durée — ${played.length}/${totalSteps}`);

    // Conséquence assumée (choix utilisateur) : jouée assez longtemps, la note franchit les seuils de
    // reevaluateExtraNoteUpgrades — un ré tenu sur un do EST un Cadd9. L'accord est donc renommé et la
    // note absorbée dans son corps. Elle reste jouée : c'est bien le but recherché.
    check(st.quality === 'add9' && st.extras === 0 && st.bodyVoices === before.bodyVoices + 1,
        `un ré tenu sur un do renomme l'accord en add9 et absorbe la note dans son corps — obtenu ${JSON.stringify(st)}`);

    // #save en mode Ajout AJOUTE un accord à la grille (il ne réécrit pas le premier) : c'est donc le
    // DERNIER accord qu'il faut relire, pas chords[0] — qui reste le do majeur ajouté au départ.
    await page.click('#save');
    await page.waitForTimeout(250);
    await page.reload();
    await page.waitForTimeout(600);
    const saved = await page.evaluate(() => {
        const chords = loadProgressionSections()[0].chords;
        const c = chords[chords.length - 1];
        return { count: chords.length, quality: c.quality, extras: (c.extraNotes || []).length, seqEdited: !!c.seqEdited };
    });
    check(saved.quality === 'add9',
        `l'accord enrichi survit à l'enregistrement et au rechargement — obtenu ${JSON.stringify(saved)}`);

    // ============================================================
    // === C. Sur un accord au rythme régulier, la note épouse ce rythme ===
    // ============================================================
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(600);
    await openSeqOn(page, 'C');
    // Motif « noire staccato » sur tout le corps : une attaque courte chaque temps.
    await page.evaluate(() => {
        const app = window.app;
        const chord = app.readChord();
        const body = chord.getIntervals().length;
        const { pattern, tie } = app.getLiveSeqPattern(chord);
        for (let s = 0; s < pattern.length; s++) { pattern[s] = []; tie[s] = []; }
        for (let s = 0; s < pattern.length; s += 4) for (let v = 0; v < body; v++) pattern[s].push(v);
        app.setLiveSeqPattern(pattern, tie);
        app.seqTouched = true;
        app.renderSequencer();
    });
    await page.waitForTimeout(250);
    const bodyBefore = await state(page);
    await page.click('#seq-add-note');
    await page.waitForTimeout(300);
    const input2 = await page.$(`.seq-label-input[data-extra-index="0"]`);
    // C#4 : hauteur qui ne complète AUCUNE qualité connue sur un do majeur, donc la note reste une
    // vraie note libre — c'est son rythme qu'on veut observer ici, pas l'absorption (testée en B).
    await input2.fill('C#4');
    await input2.press('Enter');
    await page.waitForTimeout(400);

    const v2 = bodyBefore.bodyVoices;
    const played2 = await voiceSteps(page, v2);
    const ref = await voiceSteps(page, 0);
    console.log('rythme accord:', JSON.stringify(ref), '| note ajoutée:', JSON.stringify(played2));
    check(played2.length > 0, `sur un accord rythmé, la note ajoutée est jouée elle aussi — ${played2.length} cases`);
    check(JSON.stringify(played2) === JSON.stringify(ref),
        `...et elle épouse EXACTEMENT le rythme de l'accord au lieu de bourdonner par-dessus — ${JSON.stringify(played2)} vs ${JSON.stringify(ref)}`);

    // ============================================================
    // === D. Sur un accord aux voix désynchronisées, elle est tenue (toujours audible) ===
    // ============================================================
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(600);
    await openSeqOn(page, 'C');
    await page.evaluate(() => {
        const app = window.app;
        const chord = app.readChord();
        const body = chord.getIntervals().length;
        const { pattern, tie } = app.getLiveSeqPattern(chord);
        for (let s = 0; s < pattern.length; s++) { pattern[s] = []; tie[s] = []; }
        // Arpège : chaque voix sur une case différente -> aucun rythme commun à copier.
        for (let v = 0; v < body; v++) pattern[v * 2].push(v);
        app.setLiveSeqPattern(pattern, tie);
        app.seqTouched = true;
        app.renderSequencer();
    });
    await page.waitForTimeout(250);
    const bodyBefore3 = await state(page);
    await page.click('#seq-add-note');
    await page.waitForTimeout(300);
    const input3 = await page.$(`.seq-label-input[data-extra-index="0"]`);
    await input3.fill('C#4');
    await input3.press('Enter');
    await page.waitForTimeout(400);
    const played3 = await voiceSteps(page, bodyBefore3.bodyVoices);
    const total3 = await page.evaluate(() => window.app.getLiveSeqPattern(window.app.readChord()).pattern.length);
    check(played3.length === total3,
        `sur un arpège (aucun rythme commun), la note est TENUE pleine durée — seul choix toujours audible : ${played3.length}/${total3}`);

    // ============================================================
    // === E. Reprendre la hauteur d'une note DÉJÀ jouée ne réécrit pas son rythme ===
    // ============================================================
    await page.evaluate(() => {
        const app = window.app;
        const chord = app.readChord();
        const v = chord.getIntervals().length;
        const { pattern, tie } = app.getLiveSeqPattern(chord);
        for (let s = 0; s < pattern.length; s++) {
            const at = pattern[s].indexOf(v);
            if (at >= 0 && s > 3) { pattern[s].splice(at, 1); const t = tie[s].indexOf(v); if (t >= 0) tie[s].splice(t, 1); }
        }
        app.setLiveSeqPattern(pattern, tie);
        app.renderSequencer();
    });
    await page.waitForTimeout(250);
    const shortened = await voiceSteps(page, bodyBefore3.bodyVoices);
    const input4 = await page.$(`.seq-label-input[data-extra-index="0"]`);
    await input4.fill('D#4');
    await input4.press('Enter');
    await page.waitForTimeout(400);
    const afterRetype = await voiceSteps(page, bodyBefore3.bodyVoices);
    check(JSON.stringify(afterRetype) === JSON.stringify(shortened),
        `changer la hauteur d'une note déjà jouée conserve le rythme qu'on lui a donné — ${JSON.stringify(afterRetype)} vs ${JSON.stringify(shortened)}`);

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 || errors.length > 0 ? 1 : 0);
})();
