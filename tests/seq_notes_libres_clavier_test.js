// Séquenceur continu : toutes les hauteurs présentes, et un clavier pour s'y repérer.
// (RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR, 4a, 12/11 : à l'ordinateur, c'est la vue « Toutes les notes » du séquenceur du bloc « Vues » ; voir plus bas.)
// Retour utilisateur : « 2. Voir toutes les notes possibles. Pour le moment, les notes non utilisées
// ne sont pas présentées dans le séquenceur. 3. M'aider à l'aide d'un diagramme de piano à gauche
// pour mieux me repérer, faire comme pour le voice leading. »
// Deux changements liés, et c'est le lien qui compte : un clavier n'est honnête QUE si les lignes
// sont chromatiques. Avec les anciennes lignes (uniquement les hauteurs qui sonnent), deux touches
// voisines à l'écran pouvaient être séparées d'une tierce — le repère aurait menti.
// D'où le périmètre : lignes chromatiques + touches UNIQUEMENT en vue continue (loupe). En vue
// compacte, les lignes restent des VOIX (une par note de l'accord), donc pas de touches, et sur
// téléphone 20 lignes de 30px seraient de toute façon inutilisables.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police vient de Google Fonts, injoignable derrière le proxy du bac à sable : bruit filtré.

let PASS = 0, FAIL = 0;
function check(c, l) { if (c) { PASS++; console.log('PASS - ' + l); } else { FAIL++; console.log('FAIL - ' + l); } }

const mk = (root, q, oct = 3) => ({ root, quality: q, beats: 4, inversion: 0, drop: 'none', octave: oct, bass: null, playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} });

// Nom affiché -> MIDI. Les étiquettes suivent la tonalité (dièses ou bémols), donc les deux graphies.
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function nomVersMidi(nom) {
    const m = /^([A-G])([#b]?)(-?\d+)$/.exec((nom || '').trim());
    if (!m) return null;
    return (+m[3] + 1) * 12 + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

const prep = async (p, chords) => {
    await p.goto(`${BASE}/index.html`);
    await p.waitForTimeout(500);
    await p.evaluate(({ s, list }) => {
        const mk = eval('(' + s + ')');
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet',
            chords: list.map(a => mk(...a)) }] }));
    }, { s: mk.toString(), list: chords });
    await p.reload();
    await p.waitForTimeout(900);
};

(async () => {
    const browser = await chromium.launch();
    const errs = [];
    const brancher = (p, tag = '') => {
        p.on('pageerror', e => errs.push(tag + e.message));
        p.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_CERT_AUTHORITY_INVALID|fonts\.googleapis|fonts\.gstatic/.test(m.text())) errs.push(tag + 'console: ' + m.text()); });
    };

    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11, « réécriture courte ») : à l'ordinateur, la vue continue chromatique (et son clavier en gouttière) a disparu.
    // Les deux demandes restent tenues par le séquenceur du bloc « Vues » : « voir toutes les notes » = sa vue « Toutes les notes » (les hauteurs utilisées par la
    // partie, jamais 60 lignes, cahier planche 2) où l'on pose aussi une note hors de l'accord ; « un diagramme de piano à gauche » = ses étiquettes dessinées comme
    // des touches (claires pour les naturelles, sombres pour les dièses). Le téléphone garde la vue d'avant jusqu'à l'étape 4c (partie G).
    const R = require('./_retrait_ancien');
    const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    brancher(p);
    await prep(p, [['C', 'maj7'], ['A', 'min7'], ['F', 'maj7']]);
    console.log('\n=== A. Ordinateur : « Toutes les notes », et des étiquettes en touches de piano ===');
    let rr = await R.porteAbsente(p);
    check(rr.ok, `l'ancienne vue continue n'a plus de porte (${rr.detail})`);
    rr = await R.ouvrirNouveau(p);
    check(rr.ok, `le séquenceur s'ouvre (${rr.detail})`);
    await R.cliquer(p, '#sq-vue-notes', 500);
    const toutes = await p.evaluate(() => {
        const sec = loadProgressionSections()[0];
        const utilisees = new Set(); sec.chords.forEach(d => SequenceurHarmo.voixDe(d).voix.forEach(x => utilisees.add(x.midi)));
        const lignes = new Set([...document.querySelectorAll('#sq-grille .sq-case[data-r]')].map(x => x.dataset.r)).size;
        const etiq = [...document.querySelectorAll('#sq-grille .sq-etiq')].filter(e => e.textContent.trim()).map(e => ({ diese: e.classList.contains('diese'), fond: getComputedStyle(e).backgroundColor }));
        return { lignes, utilisees: utilisees.size, etiq };
    });
    check(toutes.lignes === toutes.utilisees, `« Toutes les notes » : une ligne par hauteur utilisée par la partie (${toutes.lignes} lignes, ${toutes.utilisees} hauteurs)`);
    const clair = (c) => { const m = c.match(/\d+/g).map(Number); return (m[0] + m[1] + m[2]) / 3 > 150; };
    check(toutes.etiq.some(e => e.diese) === toutes.etiq.some(e => !clair(e.fond)) && toutes.etiq.filter(e => !e.diese).every(e => clair(e.fond)), 'les étiquettes sont dessinées comme des touches de piano (naturelles claires, dièses sombres)');
    // Une case d'une hauteur que l'accord n'a pas : y poser une croche ajoute la note (une note libre).
    const vide = await p.evaluate(() => { const c = document.querySelector('#sq-grille .sq-case[data-r][data-c="1"]:not([data-v])'); return c ? { r: c.dataset.r, k: c.dataset.k } : null; });
    check(!!vide, 'une hauteur que l\'accord du milieu ne porte pas est bien proposée');
    if (!vide) { await browser.close(); process.exit(1); }
    await R.cliquer(p, `#sq-grille .sq-case[data-c="1"][data-r="${vide.r}"][data-k="${vide.k}"]`, 400);
    const libres = await p.evaluate(() => (loadProgressionSections()[0].chords[1].extraNotes || []).length);
    check(libres === 1, `y poser une croche ajoute la note à l'accord (${libres} note libre)`);
    await R.cliquer(p, '#sq-vue-voix', 300);
    await p.close();

    console.log('\n=== F. Cas défavorable : une section très étendue reste bornée ===');
    const g = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    brancher(g, 'étendue: ');
    await prep(g, [['C', 'maj', 1], ['B', 'maj7', 6], ['F', 'maj7', 3]]);
    await R.ouvrirNouveau(g);
    const t0 = Date.now();
    await R.cliquer(g, '#sq-vue-notes', 300);
    const dt = Date.now() - t0;
    const large = await g.evaluate(() => { const s = document.getElementById('sequenceur'), b = document.getElementById('barre-lecture').getBoundingClientRect(); return { lignes: new Set([...document.querySelectorAll('#sq-grille .sq-case[data-r]')].map(x => x.dataset.r)).size, bas: Math.round(s.getBoundingClientRect().bottom), barre: Math.round(b.top), defile: getComputedStyle(s).overflowY }; });
    check(large.lignes > 6 && large.lignes < 40, `l'étendue la plus large reste dans un ordre de grandeur raisonnable — ${large.lignes} lignes (les hauteurs utilisées seulement)`);
    check(dt < 5000, `et se rend sans peiner — ${dt}ms`);
    check(large.bas <= large.barre + 1 && large.defile === 'auto', `ce qui dépasse en hauteur défile dans le séquenceur, rien ne passe sous la barre de lecture (${large.bas} ≤ ${large.barre})`);
    check(await g.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'et rien ne déborde de la page en largeur');
    await R.cliquer(g, '#sq-vue-voix', 300);
    await g.close();

    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11) : au téléphone, la feuille « Séq. » (sa vue continue chromatique, son clavier en gouttière) a
    // disparu. La même chose au doigt, c'est « Toutes les notes » dans l'onglet Rythme du panneau d'accord : une ligne par hauteur, des étiquettes en touches
    // de piano, et toucher une hauteur que l'accord n'a pas lui ajoute la note.
    console.log('\n=== G. Téléphone : la même chose au doigt, dans l\'onglet Rythme ===');
    const m = await browser.newPage({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
    brancher(m, 'mobile: ');
    await prep(m, [['C', 'maj7'], ['A', 'min7'], ['F', 'maj7']]);
    await m.tap('#progression-sections .grid-cell[data-section="0"][data-index="1"]'); await m.waitForTimeout(400); // choisir A-7 (un toucher)
    rr = await R.ouvrirRythmeTel(m);
    check(rr.ok && await m.evaluate(() => window.app._bulle.index) === 1, `« Séquenceur » du panneau Lecture ouvre l'onglet Rythme sur l'accord choisi (${rr.detail})`);
    await m.tap('#sq-vue-notes'); await m.waitForTimeout(500);
    const vm = await m.evaluate(() => {
        const lignes = new Set([...document.querySelectorAll('#pa-rythme #sq-grille .sq-case[data-r]')].map(x => x.dataset.r)).size;
        const etiq = [...document.querySelectorAll('#pa-rythme #sq-grille .sq-etiq')].filter(e => e.textContent.trim()).map(e => ({ diese: e.classList.contains('diese'), fond: getComputedStyle(e).backgroundColor }));
        const vide = document.querySelector('#pa-rythme #sq-grille .sq-case[data-r][data-c="1"]:not([data-v])');
        return { lignes, etiq, vide: vide ? { r: vide.dataset.r, k: vide.dataset.k } : null, voix: SequenceurHarmo.voixDe(loadProgressionSections()[0].chords[1]).positions.length };
    });
    check(vm.lignes > vm.voix && vm.etiq.length === vm.lignes, `« Toutes les notes » : plus de lignes que l'accord n'a de voix (${vm.lignes} lignes, ${vm.voix} voix), chacune nommée`);
    check(vm.etiq.filter(e => !e.diese).every(e => clair(e.fond)) && vm.etiq.filter(e => e.diese).every(e => !clair(e.fond)), 'les étiquettes y sont des touches de piano');
    check(!!vm.vide, 'une hauteur que l\'accord ne porte pas est proposée');
    if (vm.vide) await m.tap(`#pa-rythme #sq-grille .sq-case[data-c="1"][data-r="${vm.vide.r}"][data-k="${vm.vide.k}"]`);
    await m.waitForTimeout(400);
    check(await m.evaluate(() => (loadProgressionSections()[0].chords[1].extraNotes || []).length) === 1, 'la toucher ajoute la note à l\'accord (une note libre)');
    check(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'et rien ne déborde de la page en largeur');
    await m.tap('#sq-vue-voix'); await m.waitForTimeout(300);
    await m.close();

    check(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' — ' + errs[0] : ''));
    console.log(`\n=== ${PASS} PASS / ${FAIL} FAIL ===`);
    process.exit(FAIL ? 1 : 0);
})();
