const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.
//
// CE FICHIER N'ÉTAIT PAS UN BANC : ses cinq verdicts s'écrivaient en console.log sans compteur, et il
// finissait sur process.exit(0) — aucun échec ne pouvait remonter.
//
// SON « ITEM 5 » EST SUPPRIMÉ, pas rebranché. Il éprouvait la pastille octave flottante
// (#grid-cell-octave-float, deux boutons posés au-dessus de la case sélectionnée), qui n'existait QUE
// dans la vue plein écran de la grille : elle a disparu avec elle, plus aucun code ne la crée, et le
// banc mourait sur un `.hidden` de null — après quoi rien ne s'exécutait. Ce qui reste vrai et
// vérifiable de ce sujet, c'est que l'octave d'un accord reste LISIBLE sur sa case : le badge
// .cell-meta. C'est ce qui le remplace ci-dessous.
const { check, exiger, plan, bilan } = require('./_harness')('items 2 à 5');
plan(6);

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' });
        const sections = [{ title: 'Couplet', chords: [mk('C', 'maj'), mk('D', 'min'), mk('E', 'min'), mk('F', 'maj'), mk('G', '7'), mk('A', 'min')] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    console.log('--- Item 2: reverse button removed ---');
    let r = await page.evaluate(() => ({
        hasReverseBtn: !!document.querySelector('.prog-section-reverse'),
        hasReverseMethod: typeof window.app.reverseSectionChords,
    }));
    console.log(JSON.stringify(r));
    check(!r.hasReverseBtn && r.hasReverseMethod === 'undefined',
        `le bouton « inverser la partie » a bien disparu, méthode comprise — bouton ${r.hasReverseBtn}, reverseSectionChords « ${r.hasReverseMethod} »`);

    console.log('--- Item 4 : aucune teinte dorée sur la case quand une plage à boucler est définie ---');
    // (Le banc ouvrait ici la vue plein écran de la grille. Elle n'existe plus, et la teinte se juge de
    // toute façon sur la case de la grille elle-même, qui ne déménage plus.)
    await page.evaluate(() => window.app.setLoopRange(0, 0, 0, 2));
    await page.waitForTimeout(100);
    r = await page.evaluate(() => {
        const cell = document.querySelector('.grid-cell[data-section="0"][data-index="1"]');
        const bg = cell.style.backgroundImage;
        return { hasGoldTint: bg.includes('255, 213, 79') || bg.includes('rgba(255,213,79'), bg };
    });
    console.log(JSON.stringify(r));
    check(!r.hasGoldTint, `aucune teinte dorée posée sur la case pendant qu'une plage est active — fond « ${r.bg || 'aucun'} »`);

    console.log('--- Item 3 : taper une plage EXISTANTE en début de mesure la supprime, ne la redéfinit pas ---');
    r = await page.evaluate(() => {
        // range is 0..2; find the row-measure or bar for chord index 1 (a bar-start, likely overlapped
        // by both .row-measure and .loop-range-bar at the same grid cell)
        const cell = document.querySelector('.grid-cell[data-section="0"][data-index="1"]');
        const rect = cell.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.bottom + 8 }; // measure-number row just below the cell
    });
    // Simulate pointerdown/up (tap, no movement) exactly on that spot - should DELETE the range (bar-tap), not create a fresh 1-chord range
    await page.mouse.move(r.x, r.y);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(100);
    r = await page.evaluate(() => ({ loopRange: window.app.loopRange }));
    console.log('after tap on existing range:', JSON.stringify(r));
    check(r.loopRange === null,
        `taper sur une plage existante la SUPPRIME au lieu de la redéfinir sur un seul accord — ${JSON.stringify(r.loopRange)}`);

    console.log('--- Item 5 : l\'octave reste LISIBLE sur la case, dans son badge ---');
    // Remplace l'ancienne pastille flottante de la vue plein écran (voir l'en-tête du fichier).
    await page.evaluate(() => window.app.editChordFromSequencer(0, 2));
    await page.waitForTimeout(300);
    const badge = await page.evaluate(() => {
        const cell = document.querySelector('.grid-cell[data-section="0"][data-index="2"]');
        const meta = cell && cell.querySelector('.cell-meta');
        const octaveDonnee = JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[2].octave;
        return { texte: meta ? meta.textContent.trim() : null, octaveDonnee, dansLaCase: !!meta };
    });
    console.log(JSON.stringify(badge));
    if (exiger(badge.dansLaCase, 'la case porte bien son badge .cell-meta')) {
        check(badge.texte.includes('O' + badge.octaveDonnee),
            `le badge annonce l'octave réelle de l'accord — « ${badge.texte} » pour une octave ${badge.octaveDonnee}`);
    }

    console.log('Errors collected:', JSON.stringify(errors, null, 2));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
