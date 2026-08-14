const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
const fs = require('fs');

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

const SAMPLE = {
    version: 1, song: 'Chanson Lignes', songId: 'lines-test-1', beatsPerBar: 4,
    sections: [{ title: 'Couplet', chords: [{ symbol: 'C', beats: 4 }, { symbol: 'G', beats: 4 }, { symbol: 'Am', beats: 4 }] }],
};
const SAMPLE_PATH = 'sample_lines.json';
fs.writeFileSync(SAMPLE_PATH, JSON.stringify(SAMPLE, null, 2));

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/paroles.html`);
    await page.waitForTimeout(300);
    await page.setInputFiles('#file-input', SAMPLE_PATH);
    await page.waitForTimeout(200);

    const text = await page.$('.lyrics-text');
    await text.click();
    await page.keyboard.type('Premiere ligne de paroles ici');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Deuxieme ligne bien plus bas');
    await page.waitForTimeout(200);

    // === 1. Mode syllabe : place 2 accords sur la MÊME ligne (1ère), vérifie qu'ils ont la même Y ===
    async function armAndClickWord(chipIndex, word, charOffset) {
        const chip = await page.$(`.chord-chip:nth-child(${chipIndex})`);
        await chip.click();
        await page.waitForTimeout(80);
        const box = await page.evaluate(({ word, charOffset }) => {
            const textEl = document.querySelector('.lyrics-text');
            const idx = textEl.textContent.indexOf(word) + charOffset;
            const range = document.createRange();
            // Trouve le bon noeud texte pour cet index global (simplifié : on suppose un seul niveau
            // d'enfants directs comme le fait le navigateur pour un contenteditable multi-lignes).
            let remaining = idx, node = null;
            const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT, null);
            let n;
            while ((n = walker.nextNode())) {
                if (remaining <= n.textContent.length) { node = n; break; }
                remaining -= n.textContent.length;
            }
            if (!node) return null;
            range.setStart(node, Math.max(0, remaining));
            range.collapse(true);
            const rect = range.getClientRects()[0] || range.getBoundingClientRect();
            return { x: rect.left, y: rect.top + rect.height / 2 };
        }, { word, charOffset });
        await page.mouse.click(box.x, box.y);
        await page.waitForTimeout(150);
    }
    await armAndClickWord(1, 'Premiere', 0);
    await armAndClickWord(2, 'ligne', 2);

    const pillTops1 = await page.$$eval('.lyric-pill', els => els.map(el => el.style.top));
    console.log('tops (2 accords même ligne, mode syllabe):', JSON.stringify(pillTops1));
    check(pillTops1.length === 2 && pillTops1[0] === pillTops1[1], `les 2 accords de la MÊME ligne ont exactement la même hauteur (top) — obtenu ${JSON.stringify(pillTops1)}`);

    // === 2. Mode libre : place un accord sur la 2e ligne (clic proche de cette ligne), vérifie qu'il a
    // une hauteur DIFFÉRENTE des deux premiers (posés sur la 1ère ligne) ===
    await page.click('#mode-free');
    await page.waitForTimeout(100);
    const chip3 = await page.$('.chord-chip:nth-child(3)');
    await chip3.click();
    await page.waitForTimeout(80);
    const line2Box = await page.evaluate(() => {
        const textEl = document.querySelector('.lyrics-text');
        const r = textEl.getBoundingClientRect();
        return { x: r.left + r.width * 0.5, y: r.bottom - 5 }; // vise le bas du bloc = 2e ligne
    });
    await page.mouse.click(line2Box.x, line2Box.y);
    await page.waitForTimeout(150);

    const pillTops2 = await page.$$eval('.lyric-pill', els => els.map(el => el.style.top));
    console.log('tops après pose libre sur la 2e ligne:', JSON.stringify(pillTops2));
    check(pillTops2.length === 3, `3 accords posés au total — obtenu ${pillTops2.length}`);
    check(pillTops2[2] !== pillTops2[0], "l'accord posé en mode libre sur la 2e ligne a une hauteur DIFFÉRENTE de ceux de la 1ère ligne");

    // === 3. Vérifie qu'aucune pastille n'a de position Y "libre" arbitraire (yPct) : le format stocké
    // pour le mode libre est bien {lineIndex, xPct}, pas {xPct, yPct} ===
    const freePlacementShape = await page.evaluate(() => {
        const sec = state.song.sections[0];
        const freePl = sec._placements.find(p => p.type === 'free');
        return freePl ? Object.keys(freePl).sort() : null;
    });
    console.log('forme du placement libre:', JSON.stringify(freePlacementShape));
    check(freePlacementShape && freePlacementShape.includes('lineIndex') && !freePlacementShape.includes('yPct'), `le placement libre est bien stocké en {lineIndex, xPct}, pas {yPct} — obtenu ${JSON.stringify(freePlacementShape)}`);

    // === 4. Redimensionne la fenêtre (le texte se redispose) : les accords de la même ligne doivent
    // rester alignés entre eux après le redimensionnement ===
    await page.setViewportSize({ width: 500, height: 800 });
    await page.waitForTimeout(300);
    const pillTops3 = await page.$$eval('.lyric-pill', els => els.map(el => el.style.top));
    console.log('tops après redimensionnement:', JSON.stringify(pillTops3));
    check(pillTops3[0] === pillTops3[1], "après redimensionnement, les 2 accords de la 1ère ligne restent alignés entre eux");

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
