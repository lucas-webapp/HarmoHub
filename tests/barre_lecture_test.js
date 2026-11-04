// LA BARRE DE LECTURE DU BAS (refonte, lot 2 — docs/refonte.md et la maquette « Version 2 »).
//
// CE QUE LA MAQUETTE A FIXÉ, mot pour mot dans les commentaires de l'utilisateur, et que ce banc tient :
//   • « boutons de lecture plus gros… de la même taille » : Lecture, Stop, Boucle = carrés identiques de 44px (voir aussi
//     global_transport_test, section B) ;
//   • « la barre de lecture dépasse de mon écran en bas » : la barre est entièrement visible à TOUTES les hauteurs d'écran
//     testées — c'était la maquette qui forçait 720px mini, mais la règle vaut pour la vraie appli ;
//   • « simplifier : juste le numéro de mesure » : « Mes. N », rien d'autre, qui SUIT l'accord choisi puis la lecture ;
//   • « garder une règle de lecture… avec la définition à l'aide de la barre orange » : la bande orange de la plage à boucler
//     se retrouve sur la frise ;
//   • « bouton 50 % à 200 % du métronome » + « réglage métronome avec clic molette + haut ou bas » : vitesse de lecture 50-200 %,
//     molette, clic molette + glisser ;
//   • « compartimentage par blocs… déplacer le bloc des boutons de lecture au centre, à droite des parties du morceau ».
//
// LE POINT QUE LA MAQUETTE NE POUVAIT PAS ÉPROUVER : la vitesse change-t-elle vraiment le tempo JOUÉ, sans réécrire le tempo du
// MORCEAU ? On lit les instants que playProgression programme sur Tone.Transport (le moteur, pas l'affichage) : à 200 % ils sont
// deux fois plus proches qu'à 100 %, et #bpm n'a pas bougé.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('barre de lecture du bas');
const { estBruitReseau } = require('./_harness');

plan(49);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const mk = (root, quality, beats = 4) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} });
const graine = (src) => {
    const m = eval('(' + src + ')');
    const sections = [
        { title: 'Couplet', chords: [m('C', 'maj7'), m('A', 'min7'), m('D', 'min7'), m('G', '7')] },
        { title: 'Refrain', chords: [m('F', 'maj7'), m('E', 'min7'), m('A', 'min7'), m('D', '7')] },
    ];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: 1, sections }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections }));
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const brancher = (p, t = '') => {
        p.on('pageerror', e => erreurs.push(t + e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push(t + 'console: ' + m.text()); });
    };
    const ouvrir = async (viewport, extra = {}) => {
        const p = await nav.newPage({ viewport, ...extra });
        brancher(p, viewport.width < 900 ? 'tel: ' : '');
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine, mk.toString());
        await p.reload();
        await p.waitForTimeout(1000);
        return p;
    };

    const p = await ouvrir({ width: 1440, height: 900 });

    console.log('\n=== A. La barre : en bas, pleine largeur, quatre blocs ===');
    const a = await p.evaluate(() => {
        const b = document.getElementById('barre-lecture'), r = b.getBoundingClientRect();
        const blocs = [...b.querySelectorAll('.bl-bloc')].map(x => ({ nom: x.dataset.bloc, gauche: Math.round(x.getBoundingClientRect().left) }));
        return { bas: Math.round(r.bottom), haut: Math.round(r.top), larg: Math.round(r.width), h: Math.round(r.height), fenetre: window.innerHeight, blocs, mesure: document.getElementById('bl-mesure').textContent, verticale: getComputedStyle(b).display };
    });
    check(a.verticale === 'flex' && a.bas === a.fenetre && a.larg === 1440, `barre collée au bas de l'écran, sur toute la largeur — bas ${a.bas}/${a.fenetre}, largeur ${a.larg}`);
    check(a.h >= 60 && a.h <= 61, `60px de haut — ${a.h}px`);
    // LOT 8 : le quatrième bloc est « Vues » (Clavier, Guitare), à la suite du tempo.
    check(a.blocs.map(x => x.nom).join() === 'lecture,parties,tempo,vues' && a.blocs[0].gauche < a.blocs[1].gauche && a.blocs[1].gauche < a.blocs[2].gauche && a.blocs[2].gauche < a.blocs[3].gauche,
        `quatre blocs, dans l'ordre d'origine : Lecture, Parties, Tempo, Vues — ${JSON.stringify(a.blocs)}`);
    check(a.mesure === 'Mes. 1', `« Mes. N » seul, sans temps ni nom d'accord — « ${a.mesure} »`);

    console.log('\n=== B. La frise : une tranche par partie, durée proportionnelle ===');
    const f = await p.evaluate(() => [...document.querySelectorAll('#bl-frise .bl-frise-part')].map(x => ({ t: x.textContent, w: Math.round(x.getBoundingClientRect().width) })));
    check(f.length === 2 && f[0].t === 'Couplet' && f[1].t === 'Refrain', `deux tranches nommées comme les parties — ${JSON.stringify(f)}`);
    check(Math.abs(f[0].w - f[1].w) <= 2, `deux parties de même durée, deux tranches de même largeur — ${f[0].w} et ${f[1].w}px`);

    console.log('\n=== C. « Mes. N » et la tête suivent l\'accord choisi ===');
    await p.click('.chord-grid[data-section="1"] .grid-cell[data-index="0"]');
    await p.waitForTimeout(300);
    const c = await p.evaluate(() => {
        const fr = document.getElementById('bl-frise').getBoundingClientRect(), t = document.querySelector('#bl-frise .bl-frise-tete').getBoundingClientRect();
        return { mesure: document.getElementById('bl-mesure').textContent, pct: Math.round((t.left - fr.left) / fr.width * 100), actif: document.querySelector('#bl-frise .bl-frise-part.en-cours')?.textContent };
    });
    check(c.mesure === 'Mes. 5', `le premier accord du Refrain (après 16 temps en 4/4) est à la mesure 5 — « ${c.mesure} »`);
    check(Math.abs(c.pct - 50) <= 2, `la tête est à mi-frise — ${c.pct} %`);
    check(c.actif === 'Refrain', `la partie en cours est surlignée — ${c.actif}`);

    console.log('\n=== D. La lecture fait avancer « Mes. N » et la tête (le moteur, pas l\'affichage) ===');
    await p.click('body', { position: { x: 700, y: 600 } });
    await p.evaluate(() => Tone.start());
    await p.evaluate(() => { window.app.metronomeCountIn = false; window.app.selectedIndex = null; });
    await p.click('.chord-grid[data-section="0"] .grid-cell[data-index="0"]');
    await p.click('#play-prog');
    await p.waitForTimeout(2700);
    const d = await p.evaluate(() => ({ mesure: document.getElementById('bl-mesure').textContent, jouee: window.app.isPlaying }));
    check(d.jouee, 'la lecture est en cours');
    check(/^Mes\. [2-9]$/.test(d.mesure), `après quelques secondes la mesure a avancé — « ${d.mesure} »`);
    await p.click('#stop');
    await p.waitForTimeout(200);

    console.log('\n=== E. La plage à boucler (orange) se retrouve sur la frise ===');
    await p.evaluate(() => window.app.setLoopRange(0, 2, 1, 1));
    await p.waitForTimeout(300);
    const e = await p.evaluate(() => {
        const fr = document.getElementById('bl-frise').getBoundingClientRect(), pl = document.querySelector('#bl-frise .bl-frise-plage');
        if (!pl) return null;
        const r = pl.getBoundingClientRect();
        return { debut: Math.round((r.left - fr.left) / fr.width * 100), fin: Math.round((r.right - fr.left) / fr.width * 100), couleur: getComputedStyle(pl).borderTopColor };
    });
    exiger(!!e, 'une bande orange apparaît sur la frise quand une plage est tracée');
    // plage = Couplet accord n°3 → Refrain accord n°2 (indices 2 et 1) : de 8 temps à 24 temps sur 32 → 25 % à 75 %.
    check(e && Math.abs(e.debut - 25) <= 2 && Math.abs(e.fin - 75) <= 2, `...et couvre la bonne partie du morceau — ${e && e.debut}→${e && e.fin} % (attendu 25→75)`);
    check(e && e.couleur === 'rgb(255, 179, 0)', `...en orange, comme la bande de la règle — ${e && e.couleur}`);
    await p.evaluate(() => { window.app.loopRange = null; window.app.updatePlayButtonsForLoopRange(); }); // ce que fait un tap sur la bande (onLoopRangeEnd)
    await p.waitForTimeout(200);
    check(await p.evaluate(() => !document.querySelector('#bl-frise .bl-frise-plage')), '...et disparaît avec la plage');

    console.log('\n=== F. Le tempo : bouton, molette, clic molette + glisser ===');
    const tempo = () => p.evaluate(() => ({ bpm: +document.getElementById('bpm').value, bouton: document.getElementById('bl-tempo-val').textContent, modifie: typeof hasUnsavedChanges !== 'undefined' ? hasUnsavedChanges : null }));
    check((await tempo()).bouton === '120', 'le bouton affiche le tempo du morceau — 120');
    const bt = await p.locator('#bl-tempo').boundingBox();
    await p.mouse.move(bt.x + bt.width / 2, bt.y + bt.height / 2);
    await p.mouse.wheel(0, -100);
    await p.waitForTimeout(150);
    let t = await tempo();
    check(t.bpm === 121 && t.bouton === '121', `un cran de molette vers le haut : +1 BPM — ${t.bpm}`);
    await p.keyboard.down('Shift'); await p.mouse.wheel(0, -100); await p.keyboard.up('Shift');
    await p.waitForTimeout(150);
    t = await tempo();
    check(t.bpm === 126, `Maj + molette : +5 — ${t.bpm}`);
    await p.mouse.wheel(0, 100);
    await p.waitForTimeout(150);
    t = await tempo();
    check(t.bpm === 125, `un cran vers le bas : −1 — ${t.bpm}`);
    // clic molette maintenu + glisser vers le HAUT : plus vite ; vers le BAS : plus lent (un cran tous les 6px).
    await p.mouse.move(bt.x + bt.width / 2, bt.y + bt.height / 2);
    await p.mouse.down({ button: 'middle' });
    for (let i = 1; i <= 6; i++) { await p.mouse.move(bt.x + bt.width / 2, bt.y + bt.height / 2 - i * 4); await p.waitForTimeout(15); }
    await p.mouse.up({ button: 'middle' });
    await p.waitForTimeout(150);
    t = await tempo();
    check(t.bpm === 129, `clic molette + glisser de 24px vers le haut : +4 BPM — ${t.bpm}`);
    await p.mouse.move(bt.x + bt.width / 2, bt.y + bt.height / 2);
    await p.mouse.down({ button: 'middle' });
    for (let i = 1; i <= 6; i++) { await p.mouse.move(bt.x + bt.width / 2, bt.y + bt.height / 2 + i * 6); await p.waitForTimeout(15); }
    await p.mouse.up({ button: 'middle' });
    await p.waitForTimeout(150);
    t = await tempo();
    check(t.bpm === 123, `...puis de 36px vers le bas : −6 BPM — ${t.bpm}`);
    check(t.bpm === +await p.evaluate(() => document.getElementById('bpm-val').value), 'le champ du tempo de la carte Rythme suit (une seule valeur, deux endroits)');
    // annulation : le geste passe par le même chemin que le curseur (Ctrl+Z revient en arrière).
    await p.evaluate(() => window.app.globalUndo && window.app.globalUndo());
    await p.waitForTimeout(150);
    check((await tempo()).bpm !== 123, 'le changement de tempo à la molette s\'annule comme celui du curseur (Annuler)');
    await p.evaluate(() => { const c = document.getElementById('bpm'); c.value = 120; document.getElementById('bpm-val').value = 120; c.dispatchEvent(new Event('change')); window.app.syncBarreLecture(); });

    console.log('\n=== G. La vitesse de lecture, 50 à 200 % ===');
    await p.click('#bl-tempo');
    await p.waitForTimeout(150);
    const pop = await p.evaluate(() => { const r = document.getElementById('bl-tempo-pop').getBoundingClientRect(); return { visible: !document.getElementById('bl-tempo-pop').hidden, droite: Math.round(r.right), larg: window.innerWidth, haut: Math.round(r.top), bas: Math.round(r.bottom) }; });
    check(pop.visible && pop.droite <= pop.larg && pop.haut >= 0, `la fenêtre du tempo s'ouvre et reste entièrement à l'écran — droite ${pop.droite}/${pop.larg}`);
    const r = await p.evaluate(() => { const v = document.getElementById('bl-vitesse'); return { min: v.min, max: v.max, step: v.step }; });
    check(r.min === '50' && r.max === '200', `le curseur va de 50 à 200 % — ${r.min}→${r.max}`);
    // Les instants programmés par le moteur, à 100 % puis à 200 %.
    const instants = async () => p.evaluate(async () => {
        const vus = [];
        const orig = Tone.Transport.schedule.bind(Tone.Transport);
        Tone.Transport.schedule = (cb, t) => { vus.push(t); return orig(cb, t); };
        window.app.selectedIndex = null;
        window.app.metronomeCountIn = false;
        await window.app.playProgression();
        Tone.Transport.schedule = orig;
        window.app.stopAll();
        return Math.max(...vus.filter(x => typeof x === 'number'));
    });
    const fin100 = await instants();
    await p.click('#bl-vitesses button[data-vitesse="200"]');
    await p.waitForTimeout(150);
    const fin200 = await instants();
    check(fin200 > 0 && Math.abs(fin100 / fin200 - 2) < 0.08, `à 200 % le morceau se joue deux fois plus vite — dernier instant ${fin100.toFixed(2)}s → ${fin200.toFixed(2)}s`);
    check(await p.evaluate(() => +document.getElementById('bpm').value === 120), 'le tempo ENREGISTRÉ du morceau n\'a pas bougé (la vitesse ne réécrit pas le morceau)');
    const tag = await p.evaluate(() => { const t = document.getElementById('bl-vitesse-tag'); return { visible: !t.hidden, txt: t.textContent, couleur: getComputedStyle(t).color }; });
    check(tag.visible && tag.txt.includes('200'), `le bouton du tempo annonce la vitesse dès qu'elle diffère de 100 % — « ${tag.txt} »`);
    await p.click('#bl-vitesses button[data-vitesse="50"]');
    await p.waitForTimeout(100);
    check(await p.evaluate(() => window.app.bpmLecture() === 60), 'à 50 %, le tempo de lecture est 60 pour un morceau à 120');
    await p.click('#bl-vitesses button[data-vitesse="100"]');
    await p.waitForTimeout(100);
    check(await p.evaluate(() => document.getElementById('bl-vitesse-tag').hidden), '...et la mention disparaît à 100 %');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(100);
    check(await p.evaluate(() => document.getElementById('bl-tempo-pop').hidden), 'Échap referme la fenêtre du tempo');

    console.log('\n=== H. Le métronome de la barre pilote celui de la carte, avec le même logo ===');
    const m0 = await p.evaluate(() => ({ barre: document.getElementById('bl-metro').getAttribute('aria-pressed'), source: document.getElementById('toggle-metronome').classList.contains('active'), svg: document.getElementById('bl-metro').innerHTML.replace(/\s+/g, '') === document.getElementById('toggle-metronome').innerHTML.replace(/\s+/g, '') }));
    check(m0.svg, 'le logo du métronome est exactement celui de la carte Rythme');
    await p.click('#bl-metro');
    await p.waitForTimeout(150);
    const m1 = await p.evaluate(() => ({ barre: document.getElementById('bl-metro').getAttribute('aria-pressed'), source: document.getElementById('toggle-metronome').classList.contains('active') }));
    check(m1.source !== m0.source && m1.barre === String(m1.source), `un clic dans la barre bascule le métronome, et la barre l'annonce — carte ${m0.source}→${m1.source}, barre ${m1.barre}`);
    await p.evaluate(() => document.getElementById('toggle-metronome').click()); // la carte Rythme est repliée : on déclenche son bouton, comme le ferait un raccourci
    await p.waitForTimeout(150);
    check(await p.evaluate(() => document.getElementById('bl-metro').getAttribute('aria-pressed') === String(document.getElementById('toggle-metronome').classList.contains('active'))), '...et le bouton de la carte est répercuté dans la barre');

    console.log('\n=== I. Réorganiser les blocs ===');
    const gauches = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.bl-bloc')].map(x => [x.dataset.bloc, Math.round(x.getBoundingClientRect().left)])));
    check(await p.evaluate(() => getComputedStyle(document.querySelector('.bl-fleches')).display === 'none'), 'hors mode « réorganiser », aucune flèche ne s\'affiche');
    await p.click('#bl-reorg');
    await p.waitForTimeout(150);
    check(await p.evaluate(() => getComputedStyle(document.querySelector('.bl-fleches')).display !== 'none' && !document.getElementById('bl-reinit').hidden), 'le mode « réorganiser » montre les flèches et « Ordre d\'origine »');
    // L'exemple de l'utilisateur : le bloc des boutons de lecture au centre, à droite des parties du morceau.
    await p.click('.bl-bloc[data-bloc="lecture"] .bl-fleches button:last-child');
    await p.waitForTimeout(150);
    let g = await gauches();
    check(g.parties < g.lecture && g.lecture < g.tempo, `Lecture passe à droite des Parties du morceau — ${JSON.stringify(g)}`);
    check(await p.evaluate(() => document.querySelector('.bl-bloc[data-bloc="parties"] .bl-fleches button:first-child').disabled), '...et la flèche gauche du premier bloc est grisée');
    await p.reload();
    await p.waitForTimeout(900);
    g = await gauches();
    check(g.parties < g.lecture, 'l\'ordre choisi est retrouvé au rechargement (mémorisé par appareil)');
    check(await p.evaluate(() => !!localStorage.getItem('harmohubBarreLectureOrdre')), '...dans le stockage de l\'appareil');
    await p.click('#bl-reorg');
    await p.click('#bl-reinit');
    await p.waitForTimeout(150);
    g = await gauches();
    check(g.lecture < g.parties && g.parties < g.tempo, 'ordre d\'origine : tout revient en place');
    await p.click('#bl-reorg');
    // Le transport a bien suivi son bloc : un seul exemplaire, toujours dans #bl-lecture.
    check(await p.evaluate(() => document.querySelectorAll('.transport').length === 1 && document.getElementById('bl-lecture').contains(document.querySelector('.transport'))), 'le transport reste UN seul nœud, dans son bloc');
    // Le réglage est PAR APPAREIL : jamais dans les réglages synchronisés.
    const synchro = await p.evaluate(() => typeof REGLAGES_SYNCHRONISES !== 'undefined' ? [...REGLAGES_SYNCHRONISES] : null);
    exiger(Array.isArray(synchro) && synchro.length > 10, 'la liste blanche des réglages synchronisés est lisible (sinon la vérification suivante ne prouverait rien)');
    check(!synchro.includes('harmohubBarreLectureOrdre'), 'l\'ordre des blocs n\'est pas un réglage synchronisé (écran de chaque appareil)');
    await p.close();

    console.log('\n=== J. La barre reste ENTIÈREMENT visible à toutes les hauteurs d\'écran ===');
    for (const h of [560, 700, 800, 1000]) {
        const q = await ouvrir({ width: 1280, height: h });
        const m = await q.evaluate(() => { const r = document.getElementById('barre-lecture').getBoundingClientRect(); const tr = document.querySelector('.transport').getBoundingClientRect(); return { bas: Math.round(r.bottom), fen: window.innerHeight, trBas: Math.round(tr.bottom), trHaut: Math.round(tr.top), defile: document.documentElement.scrollHeight > window.innerHeight + 1 }; });
        check(m.bas === m.fen && m.trBas <= m.fen && m.trHaut >= 0 && !m.defile, `${h}px de haut : barre et boutons entiers à l'écran, la page ne défile pas — barre ${m.bas}/${m.fen}, boutons ${m.trHaut}→${m.trBas}`);
        await q.close();
    }

    console.log('\n=== K. Téléphone : pas de barre du bas (lot 10) ===');
    const tel = await ouvrir({ width: 390, height: 800 }, { hasTouch: true, isMobile: true });
    check(await tel.evaluate(() => getComputedStyle(document.getElementById('barre-lecture')).display === 'none' && document.getElementById('footer-dock').contains(document.querySelector('.transport'))), 'sous 900px la barre est masquée et le transport reste dans le pied de colonne');
    await tel.close();

    check(erreurs.length === 0, 'aucune erreur JavaScript (' + (erreurs.join(' | ') || 'rien') + ')');
    await nav.close();
    bilan();
})();
