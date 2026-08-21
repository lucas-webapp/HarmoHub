const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 700, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('ERR_CONNECTION_RESET') && !msg.text().includes('ERR_TUNNEL_CONNECTION_FAILED')) errors.push('console: ' + msg.text()); });

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(600);
    await page.waitForTimeout(150);
    await page.evaluate(() => window.app.toggleSequencer('compact'));
    await page.waitForTimeout(300);

    // === 1. Repères de base : chiffres de temps + points de contretemps ===
    const info = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('.seq-beat-label')).map(el => ({ text: el.textContent, beatIndex: el.dataset.beatIndex }));
        const offbeats = document.querySelectorAll('.seq-beat-offbeat').length;
        return { labels, offbeats };
    });
    console.log('labels:', JSON.stringify(info.labels), '| offbeats:', info.offbeats);
    check(info.labels.length > 0 && info.labels.every(l => l.beatIndex !== undefined && l.beatIndex !== ''), "chaque chiffre de temps porte bien data-beat-index");
    check(info.offbeats === info.labels.length || info.offbeats === info.labels.length - 1, "un point de contretemps par temps affiché (à la dernière mesure près)");

    // === 2. Peindre une note courte, puis étirer son bord droit : le chiffre de temps atteint doit s'allumer ===
    const cells = await page.$$('.seq-cell[data-voice="0"]');
    const box0 = await cells[0].boundingBox();
    await page.mouse.click(box0.x + box0.width / 2, box0.y + box0.height / 2);
    await page.waitForTimeout(150);

    // Trouve la case de fin de la note tout juste peinte, pour démarrer un étirement depuis son bord.
    const noteEndBox = await page.evaluate(() => {
        // Le séquenceur est sous la ligne de flottaison sur ce gabarit : sans l'y amener, la souris
        // de Playwright vise un point hors fenêtre et le glissé ne touche rien.
        const sc = document.querySelector('.seq-scroll');
        if (sc) sc.scrollIntoView({ block: 'center' });
        const note = document.querySelector('.seq-note[data-voice="0"]');
        if (!note) return null;
        const end = +note.dataset.end;
        const cell = document.querySelector(`.seq-cell[data-voice="0"][data-step="${end}"]`);
        const r = cell.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, end };
    });
    console.log('noteEndBox:', JSON.stringify(noteEndBox));

    if (noteEndBox) {
        const startX = noteEndBox.x + noteEndBox.width - 2, startY = noteEndBox.y + noteEndBox.height / 2;
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        // Étire vers la droite d'environ 3 temps (12 croches à 14px/pas environ, large marge)
        await page.mouse.move(startX + 200, startY, { steps: 8 });
        await page.waitForTimeout(150);

        const reachedDuring = await page.evaluate(() => {
            const el = document.querySelector('.seq-beat-label.seq-beat-reached');
            return el ? el.textContent : null;
        });
        console.log('temps allumé pendant le glissé:', reachedDuring);
        check(reachedDuring !== null, "un chiffre de temps est bien allumé (.seq-beat-reached) pendant l'étirement");

        await page.mouse.up();
        await page.waitForTimeout(200);

        const reachedAfter = await page.evaluate(() => !!document.querySelector('.seq-beat-label.seq-beat-reached'));
        check(reachedAfter === false, "le repère s'éteint bien une fois le glissé terminé");
    } else {
        check(false, 'note introuvable pour tester l\'étirement');
    }

    // Capture visuelle de la ligne de temps (chiffres + contretemps) au repos
    await page.evaluate(() => document.getElementById('arp-sequencer').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(150);
    const seqBox = await page.$eval('#arp-sequencer', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, 260) }; });
    await page.screenshot({ path: 'beat_labels_visual.png', clip: seqBox });

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
