// Ce qu'on est en train de régler s'écrit à côté du doigt, et s'entend.
// Retour utilisateur : « voir exactement la note où je déplace les barres (son + grille lors du
// déplacement, comme GarageBand) ». Le fantôme suivait bien le pointeur, mais il fallait deviner sur
// quelle ligne on tombait, et le son n'arrivait qu'AU DÉPÔT — trop tard pour chercher à l'oreille.
//
// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4b, 12/11, décision « réécriture courte ») : le petit séquenceur de l'inspecteur, où l'on DÉPLAÇAIT une barre en voyant
// un repère (« G3 », « mes. 1 · temps 2 ») et en l'entendant, a quitté l'ordinateur ; le nouveau séquenceur ne déplace plus les notes (cahier, « Ce qui disparaît »).
// La demande d'origine — voir exactement la note qu'on pose et l'entendre PENDANT le geste — y est tenue autrement, et c'est ce que le banc éprouve : chaque ligne
// porte le nom de sa note (toujours visible), la note posée porte son nom, et chaque croche peinte s'entend pendant le glissé, une fois par croche.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('seq_repere_glisse');
const { estBruitReseau } = require('./_harness');
const R = require('./_retrait_ancien');

plan(6);

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) errs.push('console: ' + m.text()); });
    await p.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await p.evaluate(() => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'C', chords: [{ root: 'C', quality: 'maj7', beats: 8, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' }] }] }));
        sessionStorage.setItem('cc_accueil_vu', '1');
    });
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);

    let r = await R.porteInspecteurAbsente(p, 0, 0);
    check(r.ok, `plus de porte « Séquenceur » ni de petit séquenceur dans l'inspecteur (${r.detail})`);
    r = await R.ouvrirNouveau(p);
    exiger(r.ok, `le séquenceur du bloc « Vues » s'ouvre par son bouton (${r.detail})`);
    // Les notes qu'on entend : on observe jouerNote du séquenceur plutôt que l'audio, injoignable dans le bac à sable (échantillons du piano sur un CDN bloqué).
    await p.evaluate(() => { window.__entendu = []; const sq = window.app.sequenceur, orig = sq.jouerNote.bind(sq); sq.jouerNote = (c, midi, n) => { window.__entendu.push(midi); return orig(c, midi, n); }; });
    await R.cliquer(p, '#sq-grille .sq-nom[data-c="0"]');
    await R.cliquer(p, '#sq-effacer');
    const e0 = await R.lire(p, 0);
    const v = e0.positions[e0.positions.length - 1];
    const noms = await p.evaluate(() => [...document.querySelectorAll('#sq-grille .sq-etiq')].map(e => e.textContent.trim()).filter(Boolean));
    check(noms.length >= 4 && noms.every(n => /^[A-G][#♯b♭]?-?\d+$/.test(n)), `chaque ligne porte le nom de sa note, toujours visible — ${noms.join(', ')}`);
    await p.evaluate(() => { window.__entendu = []; });
    const a = await R.centre(p, `#sq-grille .sq-case[data-c="0"][data-v="${v}"][data-k="1"]`);
    const b = await R.centre(p, `#sq-grille .sq-case[data-c="0"][data-v="${v}"][data-k="3"]`);
    await p.mouse.move(a.x, a.y); await p.mouse.down();
    for (let i = 1; i <= 20; i++) { await p.mouse.move(a.x + (b.x - a.x) * i / 20, a.y); await p.waitForTimeout(12); }
    const pendant = await p.evaluate(() => window.__entendu.length);
    await p.mouse.up(); await p.waitForTimeout(400);
    check(pendant === 3, `la note s'entend PENDANT le glissé, une fois par croche peinte (3 croches en 20 mouvements) — ${pendant} écoute(s)`);
    const pose = await p.evaluate((v) => { const n = document.querySelector(`#sq-grille .sq-case[data-c="0"][data-v="${v}"][data-k="1"] .sq-note`); return n ? n.textContent.trim() : null; }, v);
    check(!!pose && /^[A-G][#♯b♭]?-?\d+$/.test(pose), `la note posée porte son nom au début de sa barre — « ${pose} »`);
    check(errs.length === 0, `aucune erreur JavaScript (${errs.slice(0, 3).join(' | ') || 'rien'})`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
