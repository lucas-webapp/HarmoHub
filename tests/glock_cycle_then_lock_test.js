const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

async function cellBox(page, section, index) {
    const sel = `.grid-cell[data-section="${section}"][data-index="${index}"]`;
    await page.waitForSelector(sel);
    return page.locator(sel).boundingBox();
}
async function dblclickCellSafe(page, section, index) {
    const box = await cellBox(page, section, index);
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height - 6);
    await page.waitForTimeout(250);
}

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality, octave) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Section', chords: [
            mk('C#', 'min', 4), mk('G#', 'min', 3), mk('D#', 'min', 3), mk('C#', 'min', 3),
        ] }] }));
        localStorage.setItem('harmohubShowGuitar', '1');
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);

    await dblclickCellSafe(page, 0, 2); // D#m
    const nFingerings = await page.evaluate(() => window.app.guitarFingerings.length);
    console.log('D#m fingerings:', nFingerings);
    check(nFingerings >= 2, "au moins 2 doigtés pour tester la navigation");

    // Lock fingering #0 (the one shown by default)
    const shape0 = await page.evaluate(() => window.app.guitarFingerings[0].map(f => f ? f.fret : null));
    await page.click('#guitar-lock-btn');
    await page.waitForTimeout(150);
    console.log('locked to shape0:', JSON.stringify(shape0));
    check(await page.evaluate(() => document.getElementById('guitar-lock-btn').classList.contains('active')), "verrouillé sur le doigté 0");

    // RÉÉCRIT LE 14/11 (retour : « si le cadenas est verrouillé et que je clique sur un chevron pour changer de diagramme d'accord, j'aimerais que soit les chevrons soient bloqués, soit
    // afficher un message d'alerte »). Verrouillé, « › » ne change plus de doigté : il est bloqué et le dit. Ce banc éprouvait l'ancien « on peut feuilleter un autre doigté sous un
    // verrou posé » ; il vérifie maintenant ce que devient ce scénario : rien ne bouge, le verrou reste, puis le libérer rend les flèches.
    // Un bouton marqué aria-disabled n'est pas « actionnable » pour Playwright (page.click attendrait pour rien) : vrai appui de souris, comme un doigt.
    const appui = async (sel) => {
        const b = await page.locator(sel).boundingBox();
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(250);
    };
    await appui('#guitar-next');
    const idxAfterNext = await page.evaluate(() => window.app.guitarFingeringIndex);
    check(idxAfterNext === 0, `verrouillé, « › » ne change pas de doigté (index ${idxAfterNext})`);
    check(await page.evaluate(() => document.getElementById('guitar-lock-btn').classList.contains('active')), 'le cadenas reste verrouillé');
    check((await page.textContent('#toast')).includes('Doigté verrouillé'), 'et un message dit pourquoi');
    const savedLockStillShape0 = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[2].guitarLock);
    check(JSON.stringify(savedLockStillShape0) === JSON.stringify(shape0), "le verrou enregistré reste celui du doigté 0");

    // Libérer le verrou : le cadenas se lève, et les flèches marchent de nouveau.
    await appui('#guitar-lock-btn');
    const savedAfterUnlock = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[2].guitarLock);
    check(savedAfterUnlock === null || savedAfterUnlock === undefined, 'le cadenas libéré efface le verrou enregistré');
    await appui('#guitar-next');
    check(await page.evaluate(() => window.app.guitarFingeringIndex) === 1, 'libéré, « › » passe au doigté suivant');

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
