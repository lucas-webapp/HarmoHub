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

module.exports = { centre, cliquer, porteAbsente, ouvrirNouveau, toutePartie, poserCroche, intensite, noteLibre, plageBoucle, teteLecture, couleursRoles, suitSelection, motif, lire };
