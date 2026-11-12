// RETRAIT DE L'ANCIEN SÉQUENCEUR (refonte du séquenceur, D, dernier sous-lot — docs/refonte-sequenceur.md, section D et « Ce qui disparaît »).
//
// Décision de l'utilisateur, 12/11 (« Réécriture courte ») : un banc qui éprouvait une fonction de l'ancien séquenceur qui DISPARAÎT (éditeur de notes, loupe,
// zooms H / V, calque Voix, chemin des voix, poignée du volet) n'est pas supprimé : il devient une vérification courte — l'ancienne porte n'existe plus, ET le
// geste du nouveau séquenceur (sequenceur.js) qui la remplace fonctionne. Ce module réunit ces gestes pour que chaque banc réécrit les joue de la même façon.
//
// Tout se fait par de VRAIS gestes (souris, clavier) ; window.app et loadProgressionSections ne servent qu'à relire l'état.
// Chaque fonction rend { ok, detail } : le banc appelle check(r.ok, `… (${r.detail})`) — pas de vérification cachée ici (meta_suite).

const centre = async (p, sel) => {
    const b = await p.locator(sel).first().boundingBox();
    if (!b) throw new Error(`élément introuvable ou invisible : ${sel}`);
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const cliquer = async (p, sel, ms = 300) => { const q = await centre(p, sel); await p.mouse.click(q.x, q.y); await p.waitForTimeout(ms); };

// L'ancienne porte (« Éditeur de notes », #grid-zoom) a disparu de l'ordinateur ; le bouton « Séquenceur » du bloc « Vues » est là.
async function porteAbsente(p) {
    const r = await p.evaluate(() => {
        const vis = (id) => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; };
        return { ancienne: vis('grid-zoom'), nouveau: vis('vue-sequenceur'), dansVues: !!document.getElementById('vue-sequenceur').closest('#bl-vues') };
    });
    return { ok: !r.ancienne && r.nouveau && r.dansVues, detail: `« Éditeur de notes » visible : ${r.ancienne}, « Séquenceur » du bloc Vues : ${r.nouveau}` };
}

// Ouvre le nouveau séquenceur par son bouton (vrai clic), s'il ne l'est pas déjà.
async function ouvrirNouveau(p) {
    const ouvert = await p.evaluate(() => !document.getElementById('sequenceur').hidden);
    if (!ouvert) await cliquer(p, '#vue-sequenceur', 500);
    const r = await p.evaluate(() => ({ ouvert: !document.getElementById('sequenceur').hidden, cases: document.querySelectorAll('#sq-grille .sq-case[data-r]').length }));
    return { ok: r.ouvert && r.cases > 0, detail: `ouvert ${r.ouvert}, ${r.cases} cases` };
}

// Ce qui remplace la loupe, les zooms et les défilements : TOUTE la partie à l'écran, sans défilement de côté (cahier : « pas de zoom, pas de loupe »).
async function toutePartie(p) {
    const r = await p.evaluate(() => {
        const sec = loadProgressionSections()[window.app.activeSection || 0];
        const g = document.getElementById('sq-grille'), s = document.getElementById('sequenceur').getBoundingClientRect();
        const noms = [...g.querySelectorAll('.sq-nom')];
        const dedans = noms.every(n => { const b = n.getBoundingClientRect(); return b.left >= s.left - 1 && b.right <= s.right + 1; });
        return { accords: sec ? sec.chords.length : 0, noms: noms.length, dedans, deborde: g.scrollWidth - g.clientWidth };
    });
    return { ok: r.accords > 0 && r.noms === r.accords && r.dedans && r.deborde <= 1, detail: `${r.noms} accords sur ${r.accords}, tous à l'écran ${r.dedans}, débord ${r.deborde}` };
}

// La voix (index) d'une position (0 = basse) d'un accord, et ses croches, relues dans le morceau enregistré.
const lire = (p, c) => p.evaluate((c) => {
    const s = window.app.activeSection || 0, d = loadProgressionSections()[s].chords[c];
    const e = SequenceurHarmo.lireAccord(d);
    const par = (v) => { const r = []; for (let k = 0; k < e.info.croches; k++) if (e.on.has(v + ':' + k)) r.push(k); return r.join(','); };
    return { positions: e.info.positions, pos: e.info.positions.map(par), motif: SequenceurHarmo.motifActuel(d), niveaux: [...e.niveaux.entries()].map(x => x.join('=')).join(' ') };
}, c);

// Poser puis enlever une croche (remplace le crayon, la gomme, la pipette, le déplacement de note) : un clic pose, Ctrl+Z l'enlève.
async function poserCroche(p, c = 0) {
    await cliquer(p, `#sq-grille .sq-nom[data-c="${c}"]`); // choisir l'accord visé (Effacer agit sur l'accord choisi)
    await cliquer(p, '#sq-effacer');
    const e0 = await lire(p, c);
    const v = e0.positions[e0.positions.length - 1];
    await cliquer(p, `#sq-grille .sq-case[data-c="${c}"][data-v="${v}"][data-k="3"]`);
    const e1 = await lire(p, c);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
    const e2 = await lire(p, c);
    const ok = e0.pos.every(x => x === '') && e1.pos[e1.pos.length - 1] === '3' && e2.pos.every(x => x === '');
    return { ok, detail: `vide → aiguë « ${e1.pos[e1.pos.length - 1]} » → Ctrl+Z « ${e2.pos.join('|')} »` };
}

// Intensité (remplace le mode studio et la bande d'intensité) : allumée, un clic sur une note la passe en « fort ».
async function intensite(p, c = 0) {
    await cliquer(p, `#sq-grille .sq-nom[data-c="${c}"]`);
    const e0 = await lire(p, c);
    const v = e0.positions[0];
    const k0 = e0.pos[0] ? +e0.pos[0].split(',')[0] : null;
    if (k0 == null) return { ok: false, detail: 'la basse ne joue pas : rien à régler' };
    await cliquer(p, '#sq-intensite');
    await cliquer(p, `#sq-grille .sq-case[data-c="${c}"][data-v="${v}"][data-k="${k0}"]`);
    const e1 = await lire(p, c);
    await cliquer(p, '#sq-intensite');
    return { ok: / ?\d+:\d+=fort/.test(' ' + e1.niveaux), detail: `niveaux « ${e1.niveaux} »` };
}

// Note libre (remplace le « + » note libre et la pose au clavier) : la bande, « Ajouter C4 », une ligne en pointillés.
async function noteLibre(p) {
    await cliquer(p, '#sq-grille .sq-libre-btn');
    await cliquer(p, '#sq-libre-ajouter', 400);
    const r = await p.evaluate(() => ({ ligne: document.querySelectorAll('#sq-grille .sq-etiq.libre').length, partie: (loadProgressionSections()[window.app.activeSection || 0].notesLibres || []).length }));
    return { ok: r.ligne >= 1 && r.partie >= 1, detail: `${r.ligne} ligne(s) libre(s), ${r.partie} retenue(s) par la partie` };
}

// Plage à boucler (remplace la plage tracée dans l'ancien séquenceur) : tirer sur la règle du premier au deuxième accord ; un clic sur la bande la retire.
async function plageBoucle(p) {
    const a = await centre(p, '#sq-grille .sq-temps[data-c="0"][data-k="0"]');
    const b = await centre(p, '#sq-grille .sq-temps[data-c="1"][data-k="4"]');
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(b.x, b.y, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(400);
    const r1 = await p.evaluate(() => ({ plage: window.app.loopRange && [window.app.loopRange.startIndex, window.app.loopRange.endIndex].join('-'), bande: !!document.querySelector('#sq-grille .sq-boucle') }));
    await cliquer(p, '#sq-grille .sq-boucle', 400);
    const r2 = await p.evaluate(() => ({ plage: window.app.loopRange, bande: !!document.querySelector('#sq-grille .sq-boucle') }));
    return { ok: r1.plage === '0-1' && r1.bande && !r2.plage && !r2.bande, detail: `tirée ${r1.plage} (bande ${r1.bande}), retirée ${!r2.plage && !r2.bande}` };
}

// Lecture (remplace la lecture propre au séquenceur et ses repères) : la barre de lecture de l'appli joue, la croche qui sonne s'allume au séquenceur.
async function teteLecture(p) {
    await cliquer(p, '#play-prog', 100);
    const vu = await p.waitForFunction(() => !!document.querySelector('#sq-grille .sq-case.tete'), null, { timeout: 5000 }).then(() => true, () => false);
    await cliquer(p, '#stop', 300);
    const eteint = await p.evaluate(() => !document.querySelector('#sq-grille .tete'));
    return { ok: vu && eteint, detail: `tête vue ${vu}, éteinte au Stop ${eteint}` };
}

// Couleurs des rôles (remplace le calque Voix et le chemin des voix, supprimés le 11/11) : la fondamentale, la tierce et la quinte ont trois couleurs.
async function couleursRoles(p, c = 0) {
    const r = await p.evaluate((c) => [...new Set([...document.querySelectorAll(`#sq-grille .sq-case[data-c="${c}"] .sq-note`)].map(n => n.style.getPropertyValue('--sq-rgb')))], c);
    return { ok: r.length >= 3, detail: `${r.length} couleurs : ${r.join(' / ')}` };
}

// Le séquenceur suit la sélection : un clic sur une autre case de la grille la choisit dans le séquenceur.
async function suitSelection(p, i = 1) {
    await cliquer(p, `#progression-sections .grid-cell[data-section="0"][data-index="${i}"]`, 400);
    const r = await p.evaluate(() => { const n = document.querySelector('#sq-grille .sq-nom.choisi'); return n ? +n.dataset.c : null; });
    return { ok: r === i, detail: `accord choisi au séquenceur : ${r}` };
}

// Un motif (remplace les rythmes types de l'inspecteur) : « Arpège ↑ » sur toute la partie.
async function motif(p) {
    await cliquer(p, '#sq-portee-partie');
    await cliquer(p, '#sq-motif-monte', 400);
    const m = await lire(p, 0);
    return { ok: m.motif === 'monte', detail: `motif suivi : ${m.motif}` };
}

// Le glissé PEINT plusieurs croches d'un coup, d'une seule annulation (remplace la pose fluide « comme GarageBand » et le glisser-déposer de notes).
async function peindre(p, c = 0) {
    await cliquer(p, `#sq-grille .sq-nom[data-c="${c}"]`);
    await cliquer(p, '#sq-effacer');
    const e0 = await lire(p, c);
    const v = e0.positions[e0.positions.length - 1];
    const u0 = await p.evaluate(() => window.app.undoStack.length);
    const a = await centre(p, `#sq-grille .sq-case[data-c="${c}"][data-v="${v}"][data-k="1"]`);
    const b = await centre(p, `#sq-grille .sq-case[data-c="${c}"][data-v="${v}"][data-k="5"]`);
    await p.mouse.move(a.x, a.y); await p.mouse.down();
    for (let s = 1; s <= 8; s++) await p.mouse.move(a.x + (b.x - a.x) * s / 8, a.y, { steps: 2 });
    await p.mouse.up(); await p.waitForTimeout(400);
    const e1 = await lire(p, c);
    const u1 = await p.evaluate(() => window.app.undoStack.length);
    return { ok: e1.pos[e1.pos.length - 1] === '1,2,3,4,5' && u1 === u0 + 1, detail: `aiguë « ${e1.pos[e1.pos.length - 1]} », ${u1 - u0} annulation(s)` };
}

// Les repères (remplace le quadrillage et les étiquettes de l'ancien séquenceur) : un trait à chaque temps, un plus marqué à chaque mesure, les numéros de temps
// dans la règle, le nom de chaque note à gauche, toujours visible.
async function reperes(p) {
    const r = await p.evaluate(() => {
        const g = document.getElementById('sq-grille');
        const temps = [...g.querySelectorAll('.sq-temps')].map(x => x.textContent).filter(Boolean);
        const etiq = [...g.querySelectorAll('.sq-etiq')].filter(e => e.textContent.trim() && e.getBoundingClientRect().width > 0);
        return { mesures: g.querySelectorAll('.sq-case.mesure').length, traits: g.querySelectorAll('.sq-case.temps').length, temps: temps.slice(0, 4).join(''), etiq: etiq.length, lignes: new Set([...g.querySelectorAll('.sq-case[data-r]')].map(x => x.dataset.r)).size };
    });
    return { ok: r.mesures > 0 && r.traits > r.mesures && r.temps === '1234' && r.etiq === r.lignes, detail: `${r.mesures} débuts de mesure, ${r.traits} temps, règle « ${r.temps} », ${r.etiq} noms de notes pour ${r.lignes} lignes` };
}

// Effacer le rythme d'un accord (remplace la suppression de notes du plein écran) : il se vide, Ctrl+Z le rend.
async function effacerAccord(p, c = 0) {
    await cliquer(p, `#sq-grille .sq-nom[data-c="${c}"]`);
    const e0 = await lire(p, c);
    await cliquer(p, '#sq-effacer');
    const e1 = await lire(p, c);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
    const e2 = await lire(p, c);
    return { ok: e0.pos.some(Boolean) && e1.pos.every(x => x === '') && e2.pos.join('|') === e0.pos.join('|'), detail: `« ${e0.pos.join('|')} » → vide → Ctrl+Z « ${e2.pos.join('|')} »` };
}

// Une ligne par VOIX, pas par demi-ton (remplace les deux séquenceurs d'avant, chromatique et simplifié).
async function lignesParVoix(p) {
    const r = await p.evaluate(() => {
        const sec = loadProgressionSections()[window.app.activeSection || 0];
        const max = Math.max(...sec.chords.map(d => SequenceurHarmo.voixDe(d).positions.length));
        return { max, lignes: new Set([...document.querySelectorAll('#sq-grille .sq-case[data-r]')].map(x => x.dataset.r)).size };
    });
    return { ok: r.lignes === r.max, detail: `${r.lignes} lignes pour un accord le plus riche de ${r.max} sons` };
}

// Pas de Lecture / Stop propres au séquenceur (décision du 11/11) : c'est la barre de lecture de l'appli qui joue.
async function sansLecturePropre(p) {
    const r = await p.evaluate(() => ({ propre: !!document.querySelector('#sequenceur #seq-play, #sequenceur #seq-stop, #sequenceur [aria-label="Lecture"]'), barre: document.querySelectorAll('.transport').length }));
    return { ok: !r.propre && r.barre === 1, detail: `bouton de lecture dans le séquenceur : ${r.propre}, transports : ${r.barre}` };
}

// La poignée règle la hauteur des LIGNES (22 à 48 px), double-clic = 30 px.
async function poigneeLignes(p) {
    const h = () => p.evaluate(() => Math.round(document.querySelector('#sq-grille .sq-case[data-r]').getBoundingClientRect().height));
    const h0 = await h();
    const q = await centre(p, '#sq-poignee');
    await p.mouse.move(q.x, q.y); await p.mouse.down(); await p.mouse.move(q.x, q.y - 60, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(300);
    const h1 = await h();
    const q2 = await centre(p, '#sq-poignee');
    await p.mouse.dblclick(q2.x, q2.y); await p.waitForTimeout(300);
    const h2 = await h();
    return { ok: h1 > h0 && h1 <= 48 && h2 === 30, detail: `${h0} → ${h1} px, double-clic ${h2} px` };
}

module.exports = { peindre, reperes, effacerAccord, lignesParVoix, sansLecturePropre, poigneeLignes, centre, cliquer, porteAbsente, ouvrirNouveau, toutePartie, poserCroche, intensite, noteLibre, plageBoucle, teteLecture, couleursRoles, suitSelection, motif, lire };
