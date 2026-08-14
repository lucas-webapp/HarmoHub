// La lecture doit produire du son même quand les échantillons du Piano sont injoignable — c'est le
// cas normal d'un téléphone hors couverture, et c'était jusqu'ici le silence complet.
// On ne se fie pas à « ça a l'air de jouer » : on ENREGISTRE la sortie audio hors temps réel et on
// mesure s'il y a effectivement du signal.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

async function page(browser, bloquer) {
    const p = await browser.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
    if (bloquer) await p.route('**tonejs.github.io/**', r => r.abort());
    await p.goto(`${BASE}/index.html`);
    await p.waitForTimeout(900);
    await p.evaluate(() => localStorage.clear());
    await p.reload();
    await p.waitForTimeout(900);
    for (const s of ['C', 'Am']) { await p.fill('#quick-add-input', s); await p.click('#quick-add-btn'); await p.waitForTimeout(120); }
    await p.evaluate(() => { const m = document.getElementById('context-menu'); if (m) m.hidden = true; });
    await p.waitForTimeout(250);
    return p;
}

// Rend le premier accord hors temps réel et mesure l'amplitude crête du signal produit.
// C'est la seule preuve qui vaille : « le transport tourne » ne dit rien sur le fait qu'on entende
// quelque chose — c'était précisément le défaut.
const MESURE = `
window._mesurerSignal = async () => {
    const app = window.app;
    const buf = await Tone.Offline(async ({ transport }) => {
        const bus = new Tone.Gain(1).toDestination();
        const inst = INSTRUMENT_BANKS.piano.build(bus);
        inst.triggerAttackRelease('C4', 1, 0.05, 0.9);
        inst.triggerAttackRelease('E4', 1, 0.05, 0.9);
        inst.triggerAttackRelease('G4', 1, 0.05, 0.9);
    }, 1.5);
    const data = buf.getChannelData(0);
    let crete = 0;
    for (let i = 0; i < data.length; i++) crete = Math.max(crete, Math.abs(data[i]));
    return crete;
};
`;

(async () => {
    const browser = await chromium.launch();
    const errors = [];

    // ============================================================
    console.log('=== A. Échantillons INJOIGNABLES (téléphone hors couverture) ===');
    // ============================================================
    const p1 = await page(browser, true);
    p1.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await p1.addScriptTag({ content: MESURE });

    const etatPiano = await p1.evaluate(() => {
        const piano = window.app.getInstrument('piano');
        return { charge: piano.loaded, doublure: piano.usingFallback ? piano.usingFallback() : null };
    });
    check(etatPiano.charge === false && etatPiano.doublure === true,
        `le Piano sait qu'il n'a pas ses échantillons et bascule sur sa doublure — ${JSON.stringify(etatPiano)}`);

    const crete = await p1.evaluate(() => window._mesurerSignal());
    console.log('    amplitude crête mesurée :', crete.toFixed(4));
    check(crete > 0.01,
        `un accord produit un VRAI signal audio malgré l'absence d'échantillons — crête ${crete.toFixed(4)}`);

    // La lecture démarre, et vite : plus d'attente de 4 secondes dans le vide.
    const t0 = Date.now();
    await p1.evaluate(() => document.getElementById('play-prog').click());
    await p1.waitForFunction(() => Tone.Transport.state === 'started', { timeout: 5000 }).catch(() => {});
    const delai = Date.now() - t0;
    console.log('    délai avant démarrage du transport :', delai, 'ms');
    check(delai < 2500, `la lecture démarre sans faire attendre — ${delai} ms (4 s d'attente auparavant)`);

    await p1.waitForTimeout(900);
    const enCours = await p1.evaluate(() => ({
        transport: Tone.Transport.state,
        secondes: +Tone.Transport.seconds.toFixed(2),
        enLecture: window.app.isPlaying,
        toast: (document.getElementById('toast') || {}).textContent || '',
    }));
    check(enCours.transport === 'started' && enCours.secondes > 0,
        `le curseur avance réellement — ${JSON.stringify(enCours)}`);
    check(/secours|piano/i.test(enCours.toast),
        `l'utilisateur est prévenu que le son de secours est utilisé — « ${enCours.toast} »`);

    // Un état incohérent (« je joue » alors que rien ne tourne) était la source de l'impression
    // d'aléatoire : on vérifie que les deux disent la même chose.
    check(enCours.enLecture === (enCours.transport === 'started'),
        `l'appli ne prétend jamais jouer alors que rien ne tourne — isPlaying=${enCours.enLecture}, transport=${enCours.transport}`);

    await p1.evaluate(() => document.getElementById('stop').click());
    await p1.waitForTimeout(300);
    const apresStop = await p1.evaluate(() => ({ transport: Tone.Transport.state, enLecture: window.app.isPlaying }));
    check(apresStop.transport === 'stopped' && !apresStop.enLecture,
        `Stop remet tout à l'arrêt, des deux côtés — ${JSON.stringify(apresStop)}`);

    // ============================================================
    console.log('\n=== B. Appuis répétés pendant le chargement ===');
    // ============================================================
    // C'est le geste réel de quelqu'un devant une appli qui ne répond pas : on rappuie.
    for (let i = 0; i < 3; i++) {
        await p1.evaluate(() => document.getElementById('play-prog').click());
        await p1.waitForTimeout(150);
    }
    await p1.waitForTimeout(1800);
    const apresRafale = await p1.evaluate(() => ({
        transport: Tone.Transport.state,
        secondes: +Tone.Transport.seconds.toFixed(2),
        enLecture: window.app.isPlaying,
    }));
    check(apresRafale.transport === 'started' && apresRafale.secondes > 0,
        `trois appuis rapprochés finissent bien par jouer, au lieu de s'annuler entre eux — ${JSON.stringify(apresRafale)}`);

    // ============================================================
    console.log('\n=== C. Reprise après suspension (quitter l\'appli, appel, écran verrouillé) ===');
    // ============================================================
    await p1.evaluate(() => document.getElementById('stop').click());
    await p1.waitForTimeout(200);
    await p1.evaluate(async () => { await Tone.getContext().rawContext.suspend(); });
    await p1.waitForTimeout(200);
    const suspendu = await p1.evaluate(() => Tone.getContext().rawContext.state);
    check(suspendu === 'suspended', `le contexte audio est bien suspendu, comme le fait un téléphone — ${suspendu}`);

    // Un simple geste, n'importe où, doit suffire à le relancer.
    await p1.evaluate(() => document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await p1.waitForTimeout(600);
    const repris = await p1.evaluate(() => Tone.getContext().rawContext.state);
    check(repris === 'running',
        `un geste quelconque relance l'audio — ${repris} (auparavant : plus rien ne réessayait, muet jusqu'au rechargement)`);

    // Et le retour dans l'appli aussi, sans même attendre un geste.
    await p1.evaluate(async () => { await Tone.getContext().rawContext.suspend(); });
    await p1.waitForTimeout(200);
    await p1.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await p1.waitForTimeout(600);
    const reprisVisible = await p1.evaluate(() => Tone.getContext().rawContext.state);
    check(reprisVisible === 'running', `revenir dans l'appli relance l'audio tout seul — ${reprisVisible}`);
    await p1.close();

    // ============================================================
    console.log('\n=== D. Le séquenceur aussi ===');
    // ============================================================
    const p2 = await page(browser, true);
    p2.on('pageerror', e => errors.push('pageerror(seq): ' + e.message));
    await p2.evaluate(() => { const a = window.app; a.selectedIndex = 0; a.loadProgression(); });
    await p2.waitForTimeout(300);
    const seqOuvert = await p2.evaluate(() => !!window.app.seqOpen);
    if (!seqOuvert) await p2.evaluate(() => document.getElementById('toggle-sequencer').click());
    await p2.waitForTimeout(500);
    await p2.evaluate(() => document.getElementById('seq-play').click());
    await p2.waitForTimeout(1600);
    const seq = await p2.evaluate(() => ({
        transport: Tone.Transport.state,
        secondes: +Tone.Transport.seconds.toFixed(2),
        enLecture: window.app.isPlaying,
    }));
    check(seq.transport === 'started' && seq.secondes > 0,
        `la lecture du séquenceur démarre elle aussi sans échantillons — ${JSON.stringify(seq)}`);
    await p2.close();

    console.log('\n=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 || errors.length > 0 ? 1 : 0);
})();
