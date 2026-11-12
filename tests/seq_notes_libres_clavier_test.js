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

// Ouvre la loupe grille et met l'accord `i` en édition : c'est la seule vue « continue ».
const ouvrirLoupe = async (p, i) => {
    await p.click('#grid-zoom');
    await p.waitForTimeout(700);
    // editChord remplace editChordFromGridZoom, supprimée avec la vue plein écran de la grille (voir
    // le commentaire d'editChord dans script.js). L'appel à la méthode disparue faisait échouer la
    // MISE EN PLACE de ce banc, qui mourait donc avant sa première assertion : il ne surveillait plus
    // rien, sans le dire.
    await p.evaluate((idx) => window.app.editChord(0, idx), i);
    await p.waitForTimeout(800);
};

// Relève une ligne par étiquette, dans l'ordre d'affichage (grid-row), avec son aspect de touche.
const relever = (p) => p.evaluate(() => {
    const grille = document.querySelector('#arp-sequencer .seq-grid');
    if (!grille) return null;
    const lignes = [...grille.querySelectorAll('.seq-label')].map(el => {
        const inp = el.querySelector('input');
        return {
            rang: parseInt(el.style.gridRow) || 0,
            nom: inp ? inp.value : el.textContent.trim(),
            touche: el.classList.contains('seq-key-black') ? 'noire'
                : el.classList.contains('seq-key-white') ? 'blanche' : null,
            contexte: el.classList.contains('seq-label-context'),
            libre: el.classList.contains('seq-label-extra'),
            voix: el.dataset.voice != null ? +el.dataset.voice : null,
        };
    }).sort((a, b) => a.rang - b.rang);
    const casesLibres = [...grille.querySelectorAll('.seq-cell-free')];
    return {
        lignes,
        continu: !!grille.classList.contains('seq-grid-continuous'),
        nbCasesLibres: casesLibres.length,
        midisLibres: [...new Set(casesLibres.map(c => +c.dataset.midi))].sort((a, b) => b - a),
        voixDesCasesLibres: [...new Set(casesLibres.map(c => c.dataset.voice))],
        barres: grille.querySelectorAll('.seq-note').length,
    };
});

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

    console.log('\n=== G. Téléphone : la même chose au doigt ===');
    const m = await browser.newPage({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
    brancher(m, 'mobile: ');
    await prep(m, [['C', 'maj7'], ['A', 'min7'], ['F', 'maj7']]);
    await ouvrirLoupe(m, 1);
    const vm = await relever(m);
    check(vm && vm.continu && vm.nbCasesLibres > 0, 'lignes chromatiques et cases libres au téléphone aussi');
    check(vm.lignes.every(l => l.touche !== null), 'le clavier y est complet');
    const cibleM = vm.midisLibres[Math.floor(vm.midisLibres.length / 2)];
    // ON NE SUPPOSE PLUS UNE STRATÉGIE DE DÉFILEMENT, ON VÉRIFIE LE RÉSULTAT.
    // Ce banc codait `block:'start'` en dur, avec un commentaire expliquant que centrer échouait parce
    // que la rangée de transport collée en bas mangeait la moitié de la hauteur visible. C'était vrai
    // de la fenêtre épinglée plein écran ; depuis que le séquenceur vit dans un volet ANCRÉ sous la
    // grille, la géométrie s'est inversée — mesuré : 'start' remonte désormais la case derrière
    // .top-bar (y=7) et échoue, tandis que 'center' et 'nearest' tombent juste. Coder l'un ou l'autre
    // en dur revient à parier sur une mise en page, et le pari se reperd au prochain changement.
    // On essaie donc les quatre points d'ancrage et on garde le premier réellement atteignable, ce
    // qu'on vérifie par elementFromPoint — même leçon que caseTouchable dans
    // probe_defilement_tactile : un rectangle n'est pas une garantie d'atteignabilité.
    const pos = await m.evaluate((midi) => {
        const c = document.querySelector(`.seq-cell-free[data-midi="${midi}"]`);
        for (const block of ['nearest', 'center', 'start', 'end']) {
            c.scrollIntoView({ block });
            const b = c.getBoundingClientRect();
            const x = b.left + b.width / 2, y = b.top + b.height / 2;
            if (document.elementFromPoint(x, y) === c) return { x, y, atteignable: true, block };
        }
        const b = c.getBoundingClientRect();
        return { x: b.left + b.width / 2, y: b.top + b.height / 2, atteignable: false, block: null };
    }, cibleM);
    check(pos.atteignable, `la case visée est bien la cible du point qu'on va toucher (ancrage retenu : ${pos.block})`);
    await m.touchscreen.tap(pos.x, pos.y);
    await m.waitForTimeout(700);
    check(await m.evaluate((midi) => window.app.readChord().getSeqMidiNotes().includes(midi), cibleM),
        `un simple toucher crée la note visée — MIDI ${cibleM}`);
    // La colonne d'étiquettes est COLLÉE à gauche pendant le défilement horizontal : si une touche
    // n'était pas opaque, la grille défilante réapparaîtrait au travers.
    check(await m.evaluate(() => {
        const l = document.querySelector('#arp-sequencer .seq-label.seq-key');
        const f = getComputedStyle(l).background;
        return /rgb\(/.test(f) && !/^rgba\(0, 0, 0, 0\)/.test(f);
    }), 'les touches restent opaques — la colonne collée à gauche ne laisse pas transparaître la grille');
    check(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        'rien ne déborde de l\'écran');
    await m.close();

    await browser.close();
    check(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' — ' + errs[0] : ''));
    console.log(`\n=== ${PASS} PASS / ${FAIL} FAIL ===`);
    process.exit(FAIL ? 1 : 0);
})();
