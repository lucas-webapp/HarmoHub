// Lot 1-A : au doigt, un balayage vertical rapide démarré sur une case doit FAIRE DÉFILER la page,
// pas déplacer l'accord. Un appui marqué (> 300 ms) avant de glisser, lui, doit toujours réordonner,
// et la souris ne doit rien changer du tout.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

async function labels(page) {
    return page.evaluate(() => loadProgressionSections()[0].chords.map(c => c.root + (c.quality === 'min' ? 'm' : '')));
}

async function cellBox(page, index) {
    return page.evaluate((i) => {
        const el = document.querySelector(`.grid-cell[data-index="${i}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, index);
}

// Glissé tactile synthétique : le code de la grille lit e.pointerType/clientX/clientY et pose ses
// écouteurs sur window — dispatcher de vrais PointerEvent suffit donc, et permet de contrôler
// finement le DÉLAI avant le premier mouvement (c'est lui qui décide défilement vs réordonnancement).
async function touchDrag(page, from, to, { holdMs = 0, steps = 14, stepDelay = 12 } = {}) {
    await page.evaluate(async ({ from, to, holdMs, steps, stepDelay }) => {
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        const mk = (type, x, y) => new PointerEvent(type, {
            pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1,
            clientX: x, clientY: y, bubbles: true, cancelable: true,
        });
        const target = document.elementFromPoint(from.x, from.y);
        target.dispatchEvent(mk('pointerdown', from.x, from.y));
        if (holdMs) await sleep(holdMs);
        for (let i = 1; i <= steps; i++) {
            const x = from.x + (to.x - from.x) * i / steps;
            const y = from.y + (to.y - from.y) * i / steps;
            window.dispatchEvent(mk('pointermove', x, y));
            await sleep(stepDelay);
        }
        window.dispatchEvent(mk('pointerup', to.x, to.y));
    }, { from, to, holdMs, steps, stepDelay });
    await page.waitForTimeout(220);
}

(async () => {
    const browser = await chromium.launch();
    // Fenêtre étroite/basse : mise en page mobile, c'est la PAGE elle-même qui défile.
    const page = await browser.newPage({ viewport: { width: 420, height: 640 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(700);

    // Assez d'accords pour que la grille tienne sur plusieurs lignes et que la page déborde.
    for (const sym of ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bm', 'C']) {
        await page.fill('#quick-add-input', sym);
        await page.click('#quick-add-btn');
        await page.waitForTimeout(90);
    }
    const before = await labels(page);
    check(before.length === 8, `8 accords en place au départ — obtenu ${JSON.stringify(before)}`);

    const scrollable = await page.evaluate(() => {
        const p = document.scrollingElement || document.documentElement;
        return p.scrollHeight > p.clientHeight;
    });
    check(scrollable, 'la page déborde bien verticalement (sinon le test ne prouverait rien)');

    // ============================================================
    // === A. Balayage vertical RAPIDE au doigt depuis une case : doit défiler, pas réordonner ===
    // ============================================================
    // La grille est plus bas que l'écran : on l'amène d'abord à sa hauteur. scrollTop devient alors
    // non nul, donc un balayage du doigt vers le BAS (qui fait remonter la page) a forcément de quoi
    // défiler — et la case visée est à coup sûr sous le doigt.
    await page.evaluate(() => document.querySelector('.grid-cell[data-index="2"]').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(200);
    const cell = await cellBox(page, 2);
    check(cell && cell.y > 0 && cell.y < 640, `la case visée est bien à l'écran — obtenu ${JSON.stringify(cell)}`);
    const scrollBefore = await page.evaluate(() => (document.scrollingElement || document.documentElement).scrollTop);
    check(scrollBefore > 0, `la page est bien descendue, il y a de quoi remonter — scrollTop=${scrollBefore}`);

    await touchDrag(page, cell, { x: cell.x + 4, y: cell.y + 90 }, { holdMs: 0, stepDelay: 10 });

    const scrollAfter = await page.evaluate(() => (document.scrollingElement || document.documentElement).scrollTop);
    const afterSwipe = await labels(page);
    check(scrollAfter !== scrollBefore, `le balayage vertical a bien fait DÉFILER la page — ${scrollBefore} -> ${scrollAfter}`);
    check(JSON.stringify(afterSwipe) === JSON.stringify(before),
        `l'ordre des accords n'a PAS bougé pendant le défilement — obtenu ${JSON.stringify(afterSwipe)}`);
    const selAfterSwipe = await page.evaluate(() => window.app.selectedIndex);
    check(selAfterSwipe == null, `le relâchement n'a pas non plus été lu comme un clic (aucun accord sélectionné) — obtenu ${selAfterSwipe}`);

    // ============================================================
    // === B. Même geste, mais APRÈS un appui marqué : doit réordonner comme avant ===
    // ============================================================
    await page.evaluate(() => document.querySelector('.grid-cell[data-index="0"]').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(200);
    const src = await cellBox(page, 0);
    const dst = await cellBox(page, 3);
    await touchDrag(page, src, dst, { holdMs: 380, stepDelay: 14 });
    const afterHold = await labels(page);
    check(JSON.stringify(afterHold) !== JSON.stringify(before),
        `un appui marqué AVANT de glisser réordonne toujours — avant ${JSON.stringify(before)} / après ${JSON.stringify(afterHold)}`);

    // ============================================================
    // === C. NON-RÉGRESSION souris : un glissé vertical à la souris réordonne toujours ===
    // ============================================================
    await page.reload();
    await page.waitForTimeout(600);
    const mouseBefore = await labels(page);
    await page.evaluate(() => document.querySelector('.grid-cell[data-index="0"]').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(200);
    const m0 = await cellBox(page, 0);
    const m1 = await cellBox(page, 5);
    await page.mouse.move(m0.x, m0.y);
    await page.mouse.down();
    for (let i = 1; i <= 14; i++) {
        await page.mouse.move(m0.x + (m1.x - m0.x) * i / 14, m0.y + (m1.y - m0.y) * i / 14);
        await page.waitForTimeout(10);
    }
    await page.mouse.up();
    await page.waitForTimeout(250);
    const mouseAfter = await labels(page);
    check(JSON.stringify(mouseAfter) !== JSON.stringify(mouseBefore),
        `à la souris, le glisser-réordonner fonctionne exactement comme avant — avant ${JSON.stringify(mouseBefore)} / après ${JSON.stringify(mouseAfter)}`);

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 || errors.length > 0 ? 1 : 0);
})();
