// Ce qu'on est en train de régler s'écrit à côté du doigt, et s'entend.
// Retour utilisateur : « voir exactement la note où je déplace les barres (son + grille lors du
// déplacement, comme GarageBand) ». Le fantôme suivait bien le pointeur, mais il fallait deviner sur
// quelle ligne on tombait, et le son n'arrivait qu'AU DÉPÔT — trop tard pour chercher à l'oreille.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
let PASS = 0, FAIL = 0;
function check(c, l) { if (c) { PASS++; console.log('PASS - ' + l); } else { FAIL++; console.log('FAIL - ' + l); } }
const mk = (root, q) => ({ root, quality: q, beats: 8, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} });

(async () => {
    const browser = await chromium.launch();
    const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|fonts\.googleapis|fonts\.gstatic/.test(m.text())) errs.push('console: ' + m.text()); });
    await p.goto(`${BASE}/index.html`); await p.waitForTimeout(500);
    await p.evaluate((s) => { const mk = eval('(' + s + ')');
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'C', chords: [mk('C','maj7')] }] })); }, mk.toString());
    await p.reload(); await p.waitForTimeout(900);
    await p.evaluate(() => window.app.editChord(0, 0)); await p.waitForTimeout(300);
    await p.evaluate(() => { if (!window.app.seqOpen) window.app.toggleSequencer(); }); await p.waitForTimeout(600);
    await p.evaluate(() => {
        const n = document.querySelectorAll('.seq-cell[data-voice="0"]').length;
        for (let s = 0; s < n; s++) app.applySeqCell(0, s, false);
        for (let s = 0; s < 4; s++) app.applySeqCell(0, s, true, s !== 0);
        app.renderSequencer();
    });
    await p.waitForTimeout(400);
    await p.evaluate(() => document.querySelector('.seq-scroll').scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(300);

    // Les notes qu'on écoute pendant le geste : on instrumente seqEditFeedback plutôt que l'audio,
    // injoignable dans le bac à sable (les échantillons du piano viennent d'un CDN bloqué).
    await p.evaluate(() => {
        window.__entendu = [];
        const orig = window.app.seqEditFeedback.bind(window.app);
        window.app.seqEditFeedback = (v) => { window.__entendu.push(v); return orig(v); };
    });
    const lire = () => p.evaluate(() => { const e = document.querySelector('.seq-drag-readout'); return e && !e.hidden ? e.textContent : null; });
    const caseAt = (voice, step) => p.evaluate(([v, s]) => {
        const c = document.querySelector(`.seq-cell[data-voice="${v}"][data-step="${s}"]`);
        const r = c.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, [voice, step]);

    console.log('\n=== A. Glissé VERTICAL : la note visée s\'affiche et s\'entend ===');
    check(await lire() === null, 'aucun repère au repos');
    const dep = await caseAt(0, 1), arr = await caseAt(2, 1);
    await p.mouse.move(dep.x, dep.y); await p.mouse.down();
    await p.mouse.move(dep.x, arr.y, { steps: 12 }); await p.waitForTimeout(250);
    const nomAffiche = await lire();
    check(/^[A-G][#b♭♯]?\d$/.test(nomAffiche || ''), `le nom de la note visée est affiché — « ${nomAffiche} »`);
    const attendu = await p.evaluate(() => {
        const c = window.app.readChord();
        return c.getSeqDisplayNotes(window.app.useFlatsForRoot(c.root))[2];
    });
    check(nomAffiche === attendu, `...et c'est bien la note de la ligne survolée — attendu « ${attendu} »`);
    check((await p.evaluate(() => window.__entendu.length)) > 0,
        'la note a été jouée PENDANT le glissé, pas seulement au dépôt');
    await p.mouse.up(); await p.waitForTimeout(400);
    check(await lire() === null, 'le repère disparaît au relâchement');

    console.log('\n=== B. Une seule écoute par ligne traversée ===');
    // Sinon un glissé lent déclencherait un son par pixel : injouable.
    await p.evaluate(() => { window.__entendu = []; });
    const a2 = await caseAt(2, 1), a0 = await caseAt(0, 1);
    await p.mouse.move(a2.x, a2.y); await p.mouse.down();
    for (let i = 0; i <= 20; i++) { await p.mouse.move(a2.x, a2.y + (a0.y - a2.y) * i / 20); await p.waitForTimeout(12); }
    await p.waitForTimeout(200);
    const nb = await p.evaluate(() => window.__entendu.length);
    check(nb > 0 && nb <= 6, `${nb} écoute(s) pour 3 lignes traversées en 20 mouvements — une par ligne, pas une par pixel`);
    await p.mouse.up(); await p.waitForTimeout(300);

    console.log('\n=== C. Glissé HORIZONTAL : la position s\'affiche ===');
    const corps = await caseAt(0, 1), loin = await caseAt(0, 9);
    await p.mouse.move(corps.x, corps.y); await p.mouse.down();
    await p.mouse.move(loin.x, corps.y, { steps: 12 }); await p.waitForTimeout(250);
    const pos = await lire();
    check(/mes\.\s*\d+\s*·\s*temps\s*\d/.test(pos || ''), `la position visée est annoncée — « ${pos} »`);
    await p.mouse.up(); await p.waitForTimeout(300);
    check(await lire() === null, 'et disparaît aussi à la fin de ce geste');

    await browser.close();
    check(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' — ' + errs[0] : ''));
    console.log(`\n=== ${PASS} PASS / ${FAIL} FAIL ===`);
    process.exit(FAIL ? 1 : 0);
})();
