// L6c — LA FENÊTRE D'AJOUT AU CLIC (refonte, lettre Q.3 des décisions du 14/11) ET LE RETRAIT DE « + ACCORD » À L'ORDINATEUR (lettre D).
//
// CE QUE DEMANDE L'UTILISATEUR : « je n'aurais pas toujours envie d'utiliser le clavier » : un DOUBLE-CLIC sur le « + » du bout d'une partie ouvre une fenêtre dans le style de la fenêtre
// d'accord (titre « Ajouter à Couplet », la fondamentale en 12 notes, le type, « Ajouter » neutre, pas vert), ancrée sous la case « + », qui reste ouverte pour enchaîner ; Échap et un clic à
// côté la ferment ; la saisie au clavier dans le « + » est inchangée ; le bouton « + Accord » de l'en-tête de partie (« doublon des + ») n'existe plus à l'ordinateur.
// CE QUE LE BANC TIENT : de vrais gestes (double-clic, clics, Entrée, Échap, Ctrl+Z), l'état relu dans la page ; le téléphone n'a pas bougé.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('ajout au clic');
const { estBruitReseau } = require('./_harness');
const { dblclickHorsNom } = require('./_geste_accord');

plan(27);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, b = 4) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const S = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7')] }, { title: 'Refrain', chords: [mk('F', 'maj7')] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport, opts = {}) => {
        const p = await nav.newPage({ viewport, ...opts });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const parties = (p) => p.evaluate(() => loadProgressionSections().map(s => s.chords.map(c => c.root + ':' + c.quality).join(' ')));
    const plus = async (p, s) => { const b = await p.locator(`#progression-sections .cell-add-input[data-section="${s}"]`).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }; };
    const fenetre = (p) => p.evaluate(() => {
        const f = document.getElementById('ajout-clic');
        if (!f || f.hidden) return null;
        const r = f.getBoundingClientRect(), c = document.querySelector('.cell-add-input[data-section="0"]').closest('.grid-cell-add').getBoundingClientRect();
        return { w: Math.round(r.width), titre: f.querySelector('.ajout-titre').textContent, racines: f.querySelectorAll('.bulle-g12 button').length, types: f.querySelectorAll('.bulle-g5 button').length, symbole: f.querySelector('.ajout-symbole').textContent,
            sousLaCase: r.top >= c.bottom - 1, gauche: Math.abs(r.left - (c.left - 8)) <= 12 || r.left >= 8, dansEcran: r.right <= window.innerWidth && r.bottom <= window.innerHeight,
            valider: getComputedStyle(f.querySelector('.ajout-valider')).backgroundColor, validerBord: getComputedStyle(f.querySelector('.ajout-valider')).borderTopColor, racine: [...f.querySelectorAll('.bulle-g12 [aria-pressed="true"]')].map(b => b.textContent).join(), type: [...f.querySelectorAll('.bulle-g5 [aria-pressed="true"]')].map(b => b.textContent).join() };
    });

    // ======================================================================================================
    console.log('\n=== A. « + Accord » n\'existe plus ; le double-clic sur le « + » ouvre la fenêtre ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    check(await p.evaluate(() => [...document.querySelectorAll('.prog-section-ajout')].every(b => b.getBoundingClientRect().width === 0)), 'à l\'ordinateur, plus de « + Accord » dans l\'en-tête des parties');
    check(await fenetre(p) === null, 'au départ, aucune fenêtre d\'ajout');
    let c = await plus(p, 0);
    await p.mouse.dblclick(c.x, c.y); await p.waitForTimeout(350);
    let f = await fenetre(p);
    exiger(!!f, 'un double-clic sur le « + » de la partie ouvre la fenêtre d\'ajout');
    check(f.w === 404 && f.titre === 'Ajouter à Couplet', `404 px de large, « ${f.titre} » (c'est bien la partie visée)`);
    check(f.racines === 12 && f.types === 20, `la fondamentale en ${f.racines} notes, le type en ${f.types} boutons (ceux de la liste des types)`);
    check(f.sousLaCase && f.dansEcran, 'ancrée sous la case « + », entièrement à l\'écran');
    check(f.valider !== 'rgb(35, 69, 52)' && !/rgba?\(\s*0,\s*2[0-9]{2},\s*1[0-9]{2}/.test(f.validerBord) && !/gradient/.test(await p.evaluate(() => getComputedStyle(document.querySelector('#ajout-clic .ajout-valider')).backgroundImage)), `« Ajouter » est neutre, pas vert (${f.valider})`);
    check(f.symbole === 'C' && f.racine === 'C' && f.type === 'Majeur', `au départ : ${f.symbole} (${f.racine}, ${f.type})`);
    check(await p.evaluate(() => document.activeElement && !document.activeElement.classList.contains('cell-add-input')), 'le champ « + » a rendu le focus (on clique dans la fenêtre)');

    // ======================================================================================================
    console.log('\n=== B. Choisir, ajouter, enchaîner ===');
    await p.click('#ajout-clic [data-ajout-clic="root"][data-valeur="D"]');
    await p.click('#ajout-clic [data-ajout-clic="quality"][data-valeur="min7"]'); await p.waitForTimeout(150);
    f = await fenetre(p);
    check(f.symbole === 'Dm7' && f.racine === 'D', `le symbole suit les choix : ${f.symbole}`);
    await p.click('#ajout-clic [data-ajout-clic="ajouter"]'); await p.waitForTimeout(400);
    check(JSON.stringify(await parties(p)) === JSON.stringify(['C:maj7 A:min7 D:min7', 'F:maj7']), `« Ajouter » pose l'accord à la fin de la partie : ${(await parties(p))[0]}`);
    f = await fenetre(p);
    check(!!f && f.sousLaCase, 'la fenêtre reste ouverte pour enchaîner, toujours sous le « + » (qui a bougé)');
    await p.click('#ajout-clic [data-ajout-clic="root"][data-valeur="G"]');
    await p.click('#ajout-clic [data-ajout-clic="quality"][data-valeur="dom7"]');
    await p.click('#ajout-clic [data-ajout-clic="ajouter"]'); await p.waitForTimeout(400);
    check((await parties(p))[0] === 'C:maj7 A:min7 D:min7 G:dom7', `un second accord à la suite : ${(await parties(p))[0]}`);
    check((await parties(p))[1] === 'F:maj7', 'l\'autre partie n\'a pas bougé');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(350);
    check((await parties(p))[0] === 'C:maj7 A:min7 D:min7', 'un Ctrl+Z retire le dernier accord ajouté, lui seul');
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    check(await fenetre(p) === null, 'Échap ferme la fenêtre');

    // ======================================================================================================
    console.log('\n=== C. Fermeture, autre partie, saisie au clavier inchangée ===');
    c = await plus(p, 1);
    await p.mouse.dblclick(c.x, c.y); await p.waitForTimeout(350);
    f = await p.evaluate(() => { const e = document.getElementById('ajout-clic'); return e.hidden ? null : e.querySelector('.ajout-titre').textContent; });
    check(f === 'Ajouter à Refrain', `le « + » du Refrain ouvre la fenêtre du Refrain (« ${f} »)`);
    check(await p.evaluate(() => document.querySelector('#ajout-clic [data-ajout-clic="root"][aria-pressed="true"]').dataset.valeur === 'G'), 'elle se souvient du dernier choix de fondamentale (G, le dernier accord posé) pour enchaîner');
    await p.mouse.click(60, 600); await p.waitForTimeout(300);
    check(await fenetre(p) === null, 'un clic à côté ferme la fenêtre');
    c = await plus(p, 1);
    await p.mouse.click(c.x, c.y); await p.waitForTimeout(200);
    check(await fenetre(p) === null && await p.evaluate(() => document.activeElement.classList.contains('cell-add-input')), 'un SIMPLE clic sur le « + » reste un champ où l\'on tape (pas de fenêtre)');
    await p.keyboard.type('Em7'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
    check((await parties(p))[1] === 'F:maj7 E:min7', `la saisie au clavier dans le « + » est inchangée : ${(await parties(p))[1]}`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    // Une bulle d'accord ouverte se referme quand la fenêtre d'ajout s'ouvre (une seule fenêtre à la fois).
    await dblclickHorsNom(p, '#progression-sections .grid-cell[data-section="0"][data-index="1"]'); await p.waitForTimeout(350);
    exiger(await p.evaluate(() => !document.getElementById('bulle-accord').hidden), 'une bulle d\'accord est ouverte');
    c = await plus(p, 0);
    await p.mouse.dblclick(c.x, c.y); await p.waitForTimeout(350);
    check(await p.evaluate(() => document.getElementById('bulle-accord').hidden && !document.getElementById('ajout-clic').hidden), 'ouvrir la fenêtre d\'ajout referme la bulle d\'accord (une seule fenêtre à la fois)');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);

    // ======================================================================================================
    console.log('\n=== D. Le panneau d\'ajout à la fin d\'une partie reste ouvrable par l\'appli (palette, suggestions) ; le téléphone n\'a pas bougé ===');
    check(await p.evaluate(() => { window.app.ouvrirAideAjout(0, null); return !document.getElementById('ajout-aide').hidden; }), 'le panneau d\'ajout (palette de la tonalité, suggestions) fonctionne toujours : il s\'ouvre par le « + » entre deux cases');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await p.close();
    p = await ouvrir({ width: 390, height: 844 }, { hasTouch: true, isMobile: true });
    const tel = await p.evaluate(() => ({ dbl: !!document.getElementById('ajout-clic'), plusAcc: [...document.querySelectorAll('.prog-section-ajout')].filter(b => b.getBoundingClientRect().width > 0).length, parties: document.querySelectorAll('.prog-section-head').length,
        nus: [...document.querySelectorAll('.grid-cell-add')].filter(b => b.getBoundingClientRect().width > 0).length }));
    check(tel.dbl && tel.plusAcc === tel.parties && tel.plusAcc > 0 && tel.nus === 0, `au téléphone (L7d) : « + Accord » dans l'en-tête de chaque partie, plus de « + » nu (${JSON.stringify(tel)})`);
    const tc = await p.locator('#progression-sections .prog-section-ajout[data-section="0"]').boundingBox();
    await p.touchscreen.tap(tc.x + tc.width / 2, tc.y + tc.height / 2); await p.waitForTimeout(250);
    await p.touchscreen.tap(tc.x + tc.width / 2, tc.y + tc.height / 2); await p.waitForTimeout(400);
    check(await p.evaluate(() => document.getElementById('ajout-clic').hidden), 'et un double toucher sur « + Accord » n\'ouvre pas la fenêtre d\'ajout au clic (le panneau d\'ajout du téléphone l\'a déjà)');
    await p.close();

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length ? erreurs.join(' | ') : 'aucune'})`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
