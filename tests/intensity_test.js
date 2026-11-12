const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
const R = require('./_retrait_ancien');
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_CERT_AUTHORITY_INVALID|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);

    // CE BANC A CHANGÉ DE CONTRAT, VOLONTAIREMENT.
    //
    // Il exigeait « 75 % reproduit EXACTEMENT le comportement d'avant », c'est-à-dire une vélocité de
    // 1,0 sur un accord tenu au niveau « Normal ». C'était le bon contrat le jour où l'intensité est
    // née : elle ne devait alors rien changer tant qu'on n'y touchait pas.
    //
    // Ce contrat est devenu le défaut lui-même. Retour utilisateur : « La modification d'intensité ne
    // semble pas fonctionner, le jeu est toujours fort. » Mesuré, il avait raison : « Normal » étant
    // déjà au plafond, « Fort » (90) et « Très fort » (100) donnaient EUX AUSSI 1,0 — trois des cinq
    // niveaux rendaient le même son. VELOCITE_NIVEAU_NORMAL descend « Normal » à 0,8 pour créer la
    // marge où les deux niveaux du dessus peuvent exister. Le coût, accepté : les morceaux déjà
    // écrits, tous sur « Normal », deviennent environ 2 dB plus discrets.
    //
    // Ce qui est éprouvé ici n'est donc plus « rien n'a changé » mais LA PROPRIÉTÉ QUI COMPTE :
    // les cinq niveaux sont-ils cinq sons DISTINCTS ? (Vérifié niveau par niveau dans
    // intensite_reparee_test.js, section A.)
    console.log('--- computeVelocity : l\'échelle est linéaire, et « Normal » laisse de la marge au-dessus ---');
    let r = await page.evaluate(() => {
        // held (base=1) : jamais d'aléa, vérifiable exactement
        const held75 = computeVelocity(true, false, 75, null);
        const held50 = computeVelocity(true, false, 50, null);
        const held100 = computeVelocity(true, false, 100, null);
        const held90 = computeVelocity(true, false, 90, null);
        const held0 = computeVelocity(true, false, 0, null);
        // undefined -> DEFAULT_INTENSITY (75), donc identique à held75
        const heldDefault = computeVelocity(true, false, undefined, null);
        return { held75, held50, held100, held90, held0, heldDefault };
    });
    console.log(JSON.stringify(r));
    const K = 0.8;   // VELOCITE_NIVEAU_NORMAL
    const pass1 = Math.abs(r.held75 - K) < 1e-9
        && Math.abs(r.held50 - (50 / 75) * K) < 1e-9
        && Math.abs(r.heldDefault - K) < 1e-9
        && r.held0 === 0
        && r.held100 === 1                                   // toujours borné à 1 par le haut
        // LE POINT DU CORRECTIF : les trois niveaux du haut ne se confondent plus.
        && r.held75 < r.held90 && r.held90 < r.held100;
    console.log(pass1 ? 'PASS (échelle linéaire, bornée à 1, et Normal < Fort < Très fort)' : 'FAIL');

    console.log('--- computeVelocity: a per-step override wins over the chord-wide intensity ---');
    r = await page.evaluate(() => ({
        withOverride: computeVelocity(true, false, 75, 30),
        withoutOverride: computeVelocity(true, false, 75, null),
    }));
    console.log(JSON.stringify(r));
    console.log((Math.abs(r.withOverride - (30 / 75) * K) < 1e-9 && Math.abs(r.withoutOverride - K) < 1e-9) ? 'PASS (step override takes priority)' : 'FAIL');

    console.log('--- Existing onBeat/offBeat randomization still layered on top (not replaced) ---');
    r = await page.evaluate(() => {
        const samples = Array.from({ length: 30 }, () => computeVelocity(false, true, 75, null));
        // La fourchette d'aléa d'origine (0,78 à 0,88) est CONSERVÉE puis mise à l'échelle, elle
        // n'est pas remplacée : c'est ce que ce banc vérifie depuis toujours. Seul le facteur a
        // changé — 0,8, pour la même raison qu'en section 1.
        const allInRange = samples.every(v => v >= 0.78 * 0.8 - 1e-9 && v <= 0.88 * 0.8 + 1e-9);
        const varied = new Set(samples).size > 1; // toujours un peu d'aléa
        return { allInRange, varied };
    });
    console.log(JSON.stringify(r));
    console.log((r.allInRange && r.varied) ? 'PASS (aléa du temps/contretemps conservé, mis à l\'échelle et non remplacé)' : 'FAIL');

    console.log('--- UI: slider defaults to 75, DOM round-trips through save/edit ---');
    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Test', chords: [mk('C', 'maj7', 4)] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    r = await page.evaluate(() => document.getElementById('intensity').value);
    console.log('default slider value on a chord with no saved intensity:', r);
    console.log((+r === 75) ? 'PASS (defaults to 75)' : 'FAIL');

    await page.evaluate(() => {
        window.app.editChord(0, 0);
        document.getElementById('intensity').value = '40';
        document.getElementById('intensity').dispatchEvent(new Event('input'));
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => window.app.saveCurrent());
    await page.waitForTimeout(100);
    r = await page.evaluate(() => {
        const sections = JSON.parse(localStorage.getItem('myProgression')).sections;
        return sections[0].chords[0].intensity;
    });
    console.log('saved intensity:', r);
    console.log((r === 40) ? 'PASS (custom intensity persisted)' : 'FAIL');

    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(100);
    r = await page.evaluate(() => document.getElementById('intensity').value);
    console.log('re-opened chord slider value:', r);
    console.log((+r === 40) ? 'PASS (round-trips back into the slider on re-edit)' : 'FAIL');

    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4b, 12/11) : le petit séquenceur de l'inspecteur et son mode studio (une barre par attaque, glissé, double-clic
    // qui efface) ont quitté l'ordinateur — « le mode studio comme mode à part disparaît, son logo est repris pour le bouton Intensité » (cahier, « Ce qui disparaît »).
    // L'intensité croche par croche se règle désormais au séquenceur du bloc « Vues » : allumée, un clic sur une note change sa force ; éteinte, le clic repose les notes.
    console.log('--- Intensité croche par croche : le bouton Intensité du séquenceur du bloc Vues ---');
    r = await R.ouvrirNouveau(page);
    console.log((r.ok ? 'PASS' : 'FAIL') + ' (le séquenceur du bloc « Vues » s\'ouvre par son bouton — ' + r.detail + ')');
    console.log(await page.evaluate(() => !document.getElementById('toggle-studio-mode')) ? 'PASS (l\'ancien mode studio n\'est plus là)' : 'FAIL (l\'ancien mode studio est encore là)');
    r = await R.intensite(page, 0);
    console.log((r.ok ? 'PASS' : 'FAIL') + ' (Intensité allumée, un clic sur une note la passe en « fort » — ' + r.detail + ')');
    r = await page.evaluate(() => document.getElementById('sq-intensite').getAttribute('aria-pressed'));
    console.log((r === 'false') ? 'PASS (un second clic éteint l\'Intensité)' : 'FAIL (Intensité restée ' + r + ')');
    await R.cliquer(page, '#vue-sequenceur', 300);

    console.log('--- MIDI export does not throw with a custom intensity + per-step override set ---');
    await page.evaluate(() => {
        window.app.intensityPerStep = { 0: 20 };
        document.getElementById('intensity').value = '60';
        document.getElementById('intensity').dispatchEvent(new Event('input'));
        window.app.saveCurrent();
    });
    r = await page.evaluate(() => {
        try {
            const bytes = window.app.buildMidiFile();
            return { ok: true, size: bytes.length };
        } catch (e) { return { ok: false, error: e.message }; }
    });
    console.log(JSON.stringify(r));
    console.log((r.ok && r.size > 0) ? 'PASS (MIDI export handles custom intensity without throwing)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
