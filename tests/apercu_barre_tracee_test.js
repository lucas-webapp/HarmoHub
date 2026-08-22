// La barre doit se voir PENDANT qu'on trace une note, pas seulement après.
//
// RETOUR UTILISATEUR :
//   « Dans le grand séquenceur, lorsque je crée une note et définis sa longueur avec la souris, j'ai
//     des problèmes d'accrochage lors du survol : certains 1/4 de tons sont grisés et la barre refuse
//     de s'accrocher. »
//
// LE RELEVÉ QUI NOMME LE DÉFAUT (glissé de 10 croches, vue continue, cases de 14 px) :
//   pendant le geste  -> 11 cases passées à l'état « on », donc grises  |  0 barre dessinée
//   après relâchement -> 11 cases « on »                                |  1 barre, 0→10, correcte
// La barre ne refusait pas de s'accrocher : elle n'existait pas encore. Le moteur, lui, était juste —
// findSeqStepAt n'a pas perdu un seul pas sur 167 positions balayées, et la note obtenue est bonne.
//
// DEUX PISTES ÉCARTÉES PAR LA MESURE, et c'est ce qui rend le diagnostic sûr :
//   - ce n'est pas l'aimantation : seqSnap() vaut 1, le sélecteur 1/4–1/8 ayant été retiré ;
//   - ce n'est pas l'étirement d'une note EXISTANTE : là, la pilule suit déjà (voir onSeqResizeMove,
//     d.noteEl). Il manquait le pendant pour une note NEUVE, qui n'a pas encore de pilule à déplacer.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('aperçu de la barre pendant le tracé');
plan(15);

const semer = () => {
    const mk = r => ({ root: r, quality: 'maj7', beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: ['C', 'G'].map(mk) }] }));
};

(async () => {
    const navigateur = await chromium.launch();
    const page = await navigateur.newPage({ viewport: { width: 1440, height: 900 } });
    const erreurs = [];
    page.on('pageerror', e => erreurs.push(e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now());
    await page.waitForTimeout(400);
    await page.evaluate(semer);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(700);
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(250);
    // Le GRAND séquenceur, celui que vise le retour utilisateur.
    await page.evaluate(() => { if (window.app.seqMode !== 'continu') window.app.toggleSequencer('continu'); });
    await page.waitForTimeout(500);
    exiger(await page.evaluate(() => window.app.seqMode === 'continu' && document.querySelectorAll('.seq-cell').length > 0),
        'la vue continue est bien ouverte, avec ses cases');

    // Ligne vierge : on trace à partir de rien, comme l'utilisateur.
    await page.evaluate(() => {
        const a = window.app;
        const { pattern } = a.getLiveSeqPattern(a.readChord());
        const n = pattern.length;
        a.setLiveSeqPattern(Array.from({ length: n }, () => []), Array.from({ length: n }, () => []));
        a.renderSequencer();
    });
    await page.waitForTimeout(300);

    const depart = await page.evaluate(() => {
        const c = document.querySelector('.seq-cell[data-voice="0"][data-step="0"]');
        const r = c.getBoundingClientRect();
        return { x: r.left + 4, y: r.top + r.height / 2, l: r.width };
    });

    await page.mouse.move(depart.x, depart.y);
    await page.mouse.down();

    const releve = [];
    for (let i = 1; i <= 11; i++) {
        await page.mouse.move(Math.round(depart.x + i * depart.l), depart.y);
        await page.waitForTimeout(45);
        releve.push(await page.evaluate(() => {
            const apercu = document.querySelector('.seq-note-apercu');
            const d = window.app.seqDrag;
            const caseFin = d ? document.querySelector(`.seq-cell[data-voice="0"][data-step="${d.rangeTo}"]`) : null;
            const ra = apercu ? apercu.getBoundingClientRect() : null;
            const rc = caseFin ? caseFin.getBoundingClientRect() : null;
            return {
                present: !!apercu,
                droite: ra ? Math.round(ra.right) : null,
                droiteCase: rc ? Math.round(rc.right) : null,
                rangeTo: d ? d.rangeTo : null,
                couleur: apercu ? getComputedStyle(apercu).backgroundColor : null,
                clics: apercu ? getComputedStyle(apercu).pointerEvents : null,
            };
        }));
    }

    check(releve.every(r => r.present), `une barre est visible à CHAQUE pas du tracé (avant : zéro barre du début à la fin) — ${releve.filter(r => r.present).length}/11`);

    // Le bord droit tombe PILE sur la case visée. Le retrait de 4px n'est pas une tolérance mais une
    // règle : l'interstice entre deux paires de doubles croches est porté par la bordure transparente
    // de .seq-cell-b, donc une note qui s'arrête sur cette 2e moitié doit le laisser libre — et une
    // note qui s'arrête sur la 1re moitié doit au contraire occuper toute la case.
    const ecarts = releve.map(r => {
        const attendu = r.rangeTo % 2 === 1 ? r.droiteCase - 4 : r.droiteCase;
        return r.droite - attendu;
    });
    check(ecarts.every(e => e === 0), `le bord droit de la barre tombe pile sur la case visée, à chaque pas (écarts : ${ecarts.join(', ')})`);

    const avance = releve.map(r => r.rangeTo);
    check(avance.every((v, i) => i === 0 || v > avance[i - 1]), `la barre avance d'un pas à chaque case traversée (${avance.join(' ')})`);
    check(new Set(releve.map(r => r.couleur)).size === 1, 'la barre garde une seule et même couleur pendant tout le tracé');

    // L'aperçu ne doit pas voler le survol : sans cela, il se glisserait sous le pointeur et le geste
    // suivant viserait la barre au lieu de la case.
    check(releve.every(r => r.clics === 'none'), 'la barre d\'aperçu ne capte pas le pointeur (pointer-events: none)');

    // La VRAIE pilule n'existe pas encore : c'est bien un aperçu, pas une note écrite d'avance.
    const barresPendant = await page.evaluate(() => document.querySelectorAll('.seq-note[data-voice="0"]:not(.seq-note-apercu)').length);
    check(barresPendant === 0, `aucune vraie pilule n'est écrite avant le relâchement (${barresPendant})`);

    await page.mouse.up();
    await page.waitForTimeout(350);

    const apres = await page.evaluate(() => {
        const n = document.querySelector('.seq-note[data-voice="0"]');
        return {
            apercus: document.querySelectorAll('.seq-note-apercu').length,
            barres: document.querySelectorAll('.seq-note[data-voice="0"]').length,
            debut: n ? +n.dataset.start : null,
            fin: n ? +n.dataset.end : null,
            largeur: n ? Math.round(n.getBoundingClientRect().width) : null,
        };
    });
    check(apres.apercus === 0, 'l\'aperçu disparaît au relâchement — deux barres superposées ajouteraient leurs opacités');
    check(apres.barres === 1, `il reste exactement UNE barre, la vraie (${apres.barres})`);
    check(apres.debut === 0 && apres.fin === 11, `et elle couvre bien ce qu'on a tracé (${apres.debut} → ${apres.fin})`);
    check(apres.largeur === releve[releve.length - 1].droite - Math.round(depart.x - 4),
        `la vraie barre a exactement la largeur qu'annonçait l'aperçu (${apres.largeur} px)`);

    // NON-RÉGRESSION : partir du CORPS d'une note la DÉPLACE dans le temps (voir beginSeqHDrag), elle
    // ne se trace pas — donc aucun aperçu ne doit apparaître. Ce cas mérite d'être fixé ici parce que
    // c'est celui où je me suis trompé en écrivant ce banc : j'attendais un effacement, l'application
    // déplaçait. Elle avait raison, et le geste a désormais sa vérification.
    const surNote = await page.evaluate(() => {
        const c = document.querySelector('.seq-cell[data-voice="0"][data-step="2"]');
        const r = c.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.width };
    });
    await page.mouse.move(surNote.x, surNote.y);
    await page.mouse.down();
    await page.mouse.move(Math.round(surNote.x + 4 * surNote.l), surNote.y);
    await page.waitForTimeout(120);
    const pendantDeplacement = await page.evaluate(() => ({
        apercus: document.querySelectorAll('.seq-note-apercu').length,
        deplace: !!(window.app.seqDrag && window.app.seqDrag.hDrag),
    }));
    check(pendantDeplacement.deplace, 'partir du corps d\'une note ouvre bien un DÉPLACEMENT, pas un tracé');
    check(pendantDeplacement.apercus === 0, `et n'invente aucun aperçu de barre (${pendantDeplacement.apercus})`);
    await page.mouse.up();
    await page.waitForTimeout(300);

    // NON-RÉGRESSION : l'étirement d'une note EXISTANTE continue de suivre, comme avant ce correctif.
    // Note COURTE remise en place exprès : celle d'avant touche désormais la dernière croche de
    // l'accord, et un banc qui l'étirerait mesurerait la borne maxEnd, pas le suivi de la barre.
    await page.evaluate(() => {
        const a = window.app;
        const { pattern } = a.getLiveSeqPattern(a.readChord());
        const n = pattern.length;
        const v = Array.from({ length: n }, () => []), t = Array.from({ length: n }, () => []);
        v[0] = [0]; v[1] = [0]; t[1] = [0];
        a.setLiveSeqPattern(v, t); a.renderSequencer();
    });
    await page.waitForTimeout(300);
    const noteRestante = await page.evaluate(() => {
        const n = document.querySelector('.seq-note[data-voice="0"]');
        if (!n) return null;
        const r = n.getBoundingClientRect();
        return { fin: +n.dataset.end, d: r.right, cy: r.top + r.height / 2, largeur: Math.round(r.width) };
    });
    exiger(!!noteRestante, 'une note courte est bien en place pour éprouver l\'étirement');
    await page.mouse.move(noteRestante.d - 3, noteRestante.cy);
    await page.mouse.down();
    await page.mouse.move(Math.round(noteRestante.d + 3 * depart.l), noteRestante.cy);
    await page.waitForTimeout(120);
    const pendantEtirement = await page.evaluate(() => {
        const n = document.querySelector('.seq-note[data-voice="0"]');
        return { largeur: n ? Math.round(n.getBoundingClientRect().width) : null, apercus: document.querySelectorAll('.seq-note-apercu').length };
    });
    await page.mouse.up();
    await page.waitForTimeout(250);
    check(pendantEtirement.largeur > noteRestante.largeur, `étirer une note existante l'allonge toujours en direct (${noteRestante.largeur} -> ${pendantEtirement.largeur} px)`);
    check(pendantEtirement.apercus === 0, 'et n\'invente pas un second aperçu par-dessus la vraie pilule');

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.slice(0, 2).join(' | ')})`);
    await navigateur.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
