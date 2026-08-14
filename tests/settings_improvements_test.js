const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// Réécrit après la refonte des Paramètres (retour utilisateur : « j'aimerais que tu réfléchisses à
// améliorer les paramètres de l'application... gagner du temps et de la clarté »). Ce que cette
// suite garantissait a changé de forme, mais pas de fond — le badge sous l'accord reste pilotable,
// l'aide de l'ajout rapide reste atteignable, « Style de jeu » reste retiré :
//   - plus d'onglets : les trois groupes sont rendus d'un coup, il n'y a plus de tab à cliquer ;
//   - l'ampoule d'aide a QUITTÉ les Paramètres pour la rangée du champ qu'elle explique ;
//   - les deux bascules Octave et Renversement/drop, qui pilotaient le MÊME badge, sont fondues en
//     un seul choix ordonné #grid-voicing-badge (masquée / octave seule / octave + renversement).
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable, jamais
// un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font échouer
// « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    let PASS = 0, FAIL = 0;
    const check = (c, l) => { if (c) { PASS++; console.log('PASS - ' + l); } else { FAIL++; console.log('FAIL - ' + l); } };

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj7', beats: 4, inversion: 1, drop: 'drop2', octave: 4, bass: null, playStyle: 'held' },
            { root: 'D', quality: 'min', beats: 4, inversion: 0, drop: 'none', octave: 5, bass: null, playStyle: 'croche_staccato' },
        ]}]}));
        // Partir de l'état par défaut du badge : les suites précédentes ont pu le laisser ailleurs.
        localStorage.removeItem('harmohubShowGridOctave');
        localStorage.removeItem('harmohubShowGridVoicing');
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(250);

    // Le choix ordonné pilote les deux anciennes bascules d'un coup.
    const reglerBadge = async (valeur) => {
        if (await page.evaluate(() => document.getElementById('settings-overlay').hidden)) {
            await page.click('#open-settings');
            await page.waitForTimeout(300);
        }
        await page.selectOption('#grid-voicing-badge', valeur);
        await page.waitForTimeout(200);
        await page.click('#settings-close');
        await page.waitForTimeout(250);
    };
    const badges = () => page.evaluate(() => {
        const t = i => document.querySelector(`.grid-cell[data-index="${i}"] .cell-meta`);
        return { c0: t(0) ? t(0).textContent : null, c1: t(1) ? t(1).textContent : null };
    });

    console.log('=== 1. L\'ampoule d\'aide a quitté les Paramètres pour la rangée du champ ===');
    let r = await page.evaluate(() => {
        const btn = document.getElementById('quick-add-help-btn');
        const champ = document.getElementById('quick-add-input');
        return {
            existe: !!btn,
            surLaRangeeDuChamp: !!(btn && champ && btn.parentElement === champ.parentElement),
            plusDansLesParams: !document.querySelector('#settings-overlay #quick-add-help-btn'),
        };
    });
    console.log(JSON.stringify(r));
    check(r.existe && r.surLaRangeeDuChamp, 'le bouton est à côté du champ d\'ajout rapide');
    check(r.plusDansLesParams, '...et n\'est plus un réglage (une aide n\'en est pas un)');

    console.log('=== 2. Cliquer l\'ampoule ouvre le popover d\'aide, Échap le referme ===');
    await page.click('#quick-add-help-btn');
    await page.waitForTimeout(200);
    check(await page.evaluate(() => !document.getElementById('quick-add-help').hidden), 'le popover s\'ouvre');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    check(await page.evaluate(() => document.getElementById('quick-add-help').hidden), 'Échap le referme');

    console.log('=== 3. Paramètres : une seule page, « Style de jeu » toujours retiré ===');
    await page.click('#open-settings');
    await page.waitForTimeout(300);
    r = await page.evaluate(() => ({
        plusDOnglets: document.querySelectorAll('#settings-overlay .settings-tab').length === 0,
        styleToggleGone: !document.getElementById('toggle-show-style-label'),
        choixBadge: !!document.getElementById('grid-voicing-badge'),
        anciennesBascules: !!document.getElementById('toggle-show-grid-octave') || !!document.getElementById('toggle-show-grid-voicing'),
    }));
    console.log(JSON.stringify(r));
    check(r.plusDOnglets, 'plus aucun onglet à cliquer');
    check(r.styleToggleGone, '« Style de jeu » reste absent');
    check(r.choixBadge && !r.anciennesBascules,
        'les deux bascules Octave/Renversement sont remplacées par un seul choix ordonné');
    await page.click('#settings-close');
    await page.waitForTimeout(250);

    console.log('=== 4. Par défaut : octave + renversement, en notation compacte ===');
    r = await badges();
    console.log(JSON.stringify(r));
    // Accord 0 : octave 4, renversement 1 (maj7 a 4 notes -> renversement valide), drop2 => « O4-R1-D2 »
    // Accord 1 : octave 5, ni renversement ni drop => « O5 »
    check(r.c0 === 'O4-R1-D2' && r.c1 === 'O5', `notation compacte correcte — ${r.c0} / ${r.c1}`);

    console.log('=== 5. « Octave seule » : le renversement disparaît, l\'octave reste ===');
    await reglerBadge('octave');
    r = await badges();
    console.log(JSON.stringify(r));
    check(r.c0 === 'O4' && r.c1 === 'O5', `octave seule sur les deux accords — ${r.c0} / ${r.c1}`);

    console.log('=== 6. « Masquée » : plus aucun badge ===');
    await reglerBadge('aucune');
    r = await badges();
    console.log(JSON.stringify(r));
    check(r.c0 === null && r.c1 === null, 'plus aucun badge dans la grille');

    console.log('=== 7. Le choix survit au rechargement ===');
    await reglerBadge('octave');
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);
    r = await badges();
    const valeurRelue = await page.evaluate(async () => {
        window.app.openSettings();
        await new Promise(res => setTimeout(res, 150));
        const v = document.getElementById('grid-voicing-badge').value;
        window.app.closeSettings();
        return v;
    });
    console.log(JSON.stringify({ ...r, valeurRelue }));
    check(r.c0 === 'O4' && valeurRelue === 'octave',
        `préférence persistée, et le menu se rouvre sur le bon choix — ${r.c0} / « ${valeurRelue} »`);

    console.log('Errors:', JSON.stringify(errors, null, 2));
    check(errors.length === 0, 'aucune erreur JavaScript');
    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
