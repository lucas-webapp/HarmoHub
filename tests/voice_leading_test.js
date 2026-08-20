const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.
let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.evaluate; // noop, keep lints quiet
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);

    await page.evaluate(() => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
            { root: 'A', quality: 'min7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
            { root: 'F', quality: 'maj7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
            { root: 'G', quality: 'dom7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
        ] }, { title: 'Refrain', chords: [
            { root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    console.log('=== Bouton global "Conduite de voix" présent, désactivé sur la partie à 1 seul accord ===');
    const btnCount = await page.evaluate(() => document.querySelectorAll('#toggle-voice-leading').length);
    check(btnCount === 1, 'un seul bouton global (pas un par partie) — trouvé ' + btnCount);
    await page.evaluate(() => { window.app.setActiveSection(1); }); // "Refrain", 1 seul accord
    await page.waitForTimeout(100);
    let disabled = await page.evaluate(() => document.querySelector('#toggle-voice-leading').disabled);
    check(disabled, 'désactivé sur la partie à 1 seul accord (Refrain)');
    await page.evaluate(() => { window.app.setActiveSection(0); }); // retour sur "Couplet", 4 accords
    await page.waitForTimeout(100);
    disabled = await page.evaluate(() => document.querySelector('#toggle-voice-leading').disabled);
    check(!disabled, 'réactivé sur la partie à 4 accords (Couplet)');

    console.log('=== Le panneau n\'existe pas dans le DOM avant le premier clic ===');
    let panelCount = await page.evaluate(() => document.querySelectorAll('.voice-leading-panel').length);
    check(panelCount === 0, 'panneau absent au départ (fermé par défaut) — trouvé ' + panelCount);

    console.log('=== Un clic ouvre le panneau, un second le referme ===');
    await page.click('#toggle-voice-leading');
    await page.waitForTimeout(150);
    panelCount = await page.evaluate(() => document.querySelectorAll('.voice-leading-panel').length);
    check(panelCount === 1, 'panneau présent après clic — trouvé ' + panelCount);
    const svgPresent = await page.evaluate(() => !!document.querySelector('.voice-leading-panel svg'));
    check(svgPresent, 'un <svg> est bien rendu dans le panneau');
    const btnActive = await page.evaluate(() => document.querySelector('#toggle-voice-leading').classList.contains('active'));
    check(btnActive, 'le bouton passe en état actif (classe .active)');

    await page.screenshot({ path: 'app_voice_leading_open.png', fullPage: true });

    console.log('=== Colonne des touches SÉPARÉE de la zone de notes qui défile (fixe pendant le scroll) ===');
    const twoSvgs = await page.evaluate(() => ({
        keys: !!document.querySelector('.voice-leading-keys svg'),
        notes: !!document.querySelector('.voice-leading-scroll svg'),
        distinct: document.querySelector('.voice-leading-keys svg') !== document.querySelector('.voice-leading-scroll svg'),
    }));
    check(twoSvgs.keys && twoSvgs.notes && twoSvgs.distinct, 'deux <svg> distincts (touches + notes) — ' + JSON.stringify(twoSvgs));

    // vérifie les rects de notes (4 accords x 4 notes = 16 rects) dans la zone qui défile
    const noteRectCount = await page.evaluate(() => {
        const svg = document.querySelector('.voice-leading-scroll svg');
        return [...svg.querySelectorAll('rect[fill^="url(#vlg-"]')].length;
    });
    check(noteRectCount === 16, '16 notes colorées rendues (4 accords x 4 notes) — trouvé ' + noteRectCount);

    console.log('=== Les touches noires/blanches ont bien des couleurs distinctes (ivoire vs noir, pas juste 2 gris) ===');
    const keyColors = await page.evaluate(() => {
        const rects = [...document.querySelectorAll('.voice-leading-keys svg rect')];
        return [...new Set(rects.map(r => r.getAttribute('fill')))];
    });
    check(keyColors.includes('#ece1cd') && keyColors.includes('#171310'), 'couleurs ivoire (#ece1cd) et noir (#171310) trouvées — ' + JSON.stringify(keyColors));

    console.log('=== Zoom H/V : les boutons sont présents et augmentent bien les dimensions du SVG ===');
    const dimsBefore = await page.evaluate(() => {
        const svg = document.querySelector('.voice-leading-scroll svg');
        return { w: +svg.getAttribute('width'), h: +svg.getAttribute('height') };
    });
    await page.click('.voice-leading-zoom-in-h');
    await page.click('.voice-leading-zoom-in-h');
    await page.click('.voice-leading-zoom-in-v');
    await page.click('.voice-leading-zoom-in-v');
    await page.waitForTimeout(150);
    const dimsAfter = await page.evaluate(() => {
        const svg = document.querySelector('.voice-leading-scroll svg');
        return { w: +svg.getAttribute('width'), h: +svg.getAttribute('height') };
    });
    check(dimsAfter.w > dimsBefore.w, 'largeur augmentée après 2 clics zoom H (' + dimsBefore.w + ' -> ' + dimsAfter.w + ')');
    check(dimsAfter.h > dimsBefore.h, 'hauteur augmentée après 2 clics zoom V (' + dimsBefore.h + ' -> ' + dimsAfter.h + ')');
    const keysHeightAfter = await page.evaluate(() => +document.querySelector('.voice-leading-keys svg').getAttribute('height'));
    check(keysHeightAfter === dimsAfter.h, 'la colonne des touches suit la même hauteur que la zone de notes (' + keysHeightAfter + ' === ' + dimsAfter.h + ')');

    // vérifie les ids uniques par section (pas de doublons comme sur la maquette)
    const dupIds = await page.evaluate(() => {
        const all = document.querySelectorAll('[id]');
        const seen = {}, dups = [];
        all.forEach(el => { seen[el.id] = (seen[el.id] || 0) + 1; });
        Object.entries(seen).forEach(([id, count]) => { if (count > 1) dups.push(id + ' x' + count); });
        return dups;
    });
    check(dupIds.length === 0, 'aucun id dupliqué dans le DOM (bug de la maquette corrigé) — ' + JSON.stringify(dupIds));

    console.log('=== Fermeture ===');
    await page.click('#toggle-voice-leading');
    await page.waitForTimeout(150);
    panelCount = await page.evaluate(() => document.querySelectorAll('.voice-leading-panel').length);
    check(panelCount === 0, 'panneau retiré du DOM après re-clic — trouvé ' + panelCount);

    console.log('=== Ré-ouvre, édite un accord (renversement), vérifie que le panneau se met à jour ===');
    await page.click('#toggle-voice-leading');
    await page.waitForTimeout(150);
    const beforeMidis = await page.evaluate(() => {
        const svg = document.querySelector('.voice-leading-scroll svg');
        return [...svg.querySelectorAll('text[font-family="ui-monospace, monospace"]')].map(t => t.textContent);
    });
    // ouvre l'édition du 1er accord et change son renversement
    await page.evaluate(() => { window.app.editChord(0, 0); });
    await page.waitForTimeout(150);
    // Le renversement se choisit désormais par les SEGMENTS de la rangée de voicing. La liste
    // déroulante existe toujours — elle reste la source de vérité que lit readChord — mais elle est
    // masquée, et selectOption ne pilote pas un élément invisible. On vise donc le segment visible,
    // ce qui éprouve le vrai geste plutôt qu'un raccourci de banc.
    const segmentRenv = await page.$('#inversion-seg .voicing-segment[data-valeur="1"]');
    check(!!segmentRenv, 'le panneau Accord (avec les segments de renversement) s\'est bien ouvert');
    if (segmentRenv) {
        await segmentRenv.click();
        await page.waitForTimeout(250);
        const afterMidis = await page.evaluate(() => {
            const svg = document.querySelector('.voice-leading-scroll svg');
            return svg ? [...svg.querySelectorAll('text[font-family="ui-monospace, monospace"]')].map(t => t.textContent) : null;
        });
        check(afterMidis !== null, 'le panneau existe toujours après édition (pas de crash)');
        check(JSON.stringify(afterMidis) !== JSON.stringify(beforeMidis), 'le contenu du panneau a bien changé après le renversement');
    }

    await page.screenshot({ path: 'app_voice_leading_after_edit.png', fullPage: true });

    console.log('=== Aucune erreur JS pendant tout le scénario ===');
    check(errors.length === 0, 'aucune erreur (' + JSON.stringify(errors) + ')');

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
