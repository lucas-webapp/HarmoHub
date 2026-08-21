// Séquenceur continu : toutes les hauteurs présentes, et un clavier pour s'y repérer.
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
        p.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|fonts\.googleapis|fonts\.gstatic/.test(m.text())) errs.push(tag + 'console: ' + m.text()); });
    };

    const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    brancher(p);
    await prep(p, [['C', 'maj7'], ['A', 'min7'], ['F', 'maj7']]);
    await ouvrirLoupe(p, 1);

    console.log('\n=== A. Toutes les hauteurs de l\'étendue, pas seulement celles qui sonnent ===');
    let v = await relever(p);
    check(v && v.continu, 'la vue continue est bien celle qu\'on mesure');
    const midis = v.lignes.map(l => nomVersMidi(l.nom));
    check(midis.every(m => m !== null), `toutes les étiquettes sont des hauteurs lisibles — ${v.lignes.map(l => l.nom).join(' ')}`);
    const contigu = midis.every((m, i) => i === 0 || m === midis[i - 1] - 1);
    check(contigu, 'les lignes descendent par demi-tons, sans trou — un clavier en regard peut alors dire vrai');
    check(midis.length === midis[0] - midis[midis.length - 1] + 1,
        `une ligne par demi-ton de l'étendue — ${midis.length} lignes de ${midis[midis.length - 1]} à ${midis[0]}`);
    // Avant : seules les hauteurs jouées par un accord de la section apparaissaient — les cases
    // libres (posées UNIQUEMENT sur les demi-tons muets, voir section C) sont donc, par construction,
    // les hauteurs nouvellement montrées. `voix` vaut -1 (donc `!== null`) même sur une ligne libre :
    // ce n'est pas ce champ qui distingue une ligne muette d'une ligne qui sonne, c'est nbCasesLibres.
    check(v.nbCasesLibres > 0,
        `des hauteurs NOUVELLES (jusque-là invisibles) sont apparues — ${v.midisLibres.length} demi-tons muets sur ${midis.length} lignes`);

    console.log('\n=== B. Le clavier : chaque étiquette prend l\'aspect de SA touche ===');
    const NOIRES = new Set([1, 3, 6, 8, 10]);
    const bonnesTouches = v.lignes.every((l, i) => {
        const attendu = NOIRES.has(((midis[i] % 12) + 12) % 12) ? 'noire' : 'blanche';
        return l.touche === attendu;
    });
    check(bonnesTouches, 'blanches et noires correspondent exactement aux classes de hauteur');
    check(v.lignes.every(l => l.touche !== null),
        'aucune ligne sans touche — y compris les lignes de contexte et les notes libres, sinon le clavier serait troué');
    const motif = v.lignes.map(l => l.touche === 'noire' ? 'N' : 'B').join('');
    check(/N.?N|NN/.test(motif) || motif.length < 12, `le motif 2+3 des noires se lit dans la colonne — ${motif}`);

    console.log('\n=== C. Une hauteur non jouée reste cliquable ===');
    check(v.nbCasesLibres > 0, `des cases libres sont posées sur ces lignes — ${v.nbCasesLibres}`);
    check(v.voixDesCasesLibres.length === 1 && v.voixDesCasesLibres[0] === '-1',
        'elles se déclarent toutes voix -1 : la voix n\'existe pas encore, c\'est la HAUTEUR qui identifie la ligne');
    const cibleMidi = v.midisLibres[Math.floor(v.midisLibres.length / 2)];
    const barresAvant = v.barres;
    const clic = await p.evaluate((midi) => {
        const c = document.querySelector(`.seq-cell-free[data-midi="${midi}"][data-step="4"]`)
            || document.querySelector(`.seq-cell-free[data-midi="${midi}"]`);
        c.scrollIntoView({ block: 'center' });
        const b = c.getBoundingClientRect();
        return { x: b.left + b.width / 2, y: b.top + b.height / 2, step: +c.dataset.step };
    }, cibleMidi);
    await p.mouse.click(clic.x, clic.y);
    await p.waitForTimeout(700);

    const apres = await p.evaluate(() => ({
        notes: window.app.readChord().getSeqMidiNotes(),
        libres: window.app.extraNotes.map(n => n.note + n.octave),
    }));
    check(apres.notes.includes(cibleMidi),
        `le clic crée la note à CETTE hauteur exacte — MIDI ${cibleMidi} joué, notes libres ${JSON.stringify(apres.libres)}`);
    v = await relever(p);
    check(v.barres === barresAvant + 1, `...et la peint aussitôt — ${barresAvant} barres puis ${v.barres}`);
    check(!v.midisLibres.includes(cibleMidi), 'sa ligne n\'est plus une ligne libre : elle est devenue une voix');
    check(v.lignes.find(l => nomVersMidi(l.nom) === cibleMidi)?.libre === true,
        'l\'étiquette est devenue le champ éditable des notes libres (on peut encore la renommer)');
    check(v.lignes.find(l => nomVersMidi(l.nom) === cibleMidi)?.touche !== null,
        'sa touche est toujours peinte — pas de trou dans le clavier là où on vient de poser la note');
    check(v.lignes.length === midis.length, `aucune ligne ajoutée ou perdue au passage — ${v.lignes.length}`);

    console.log('\n=== D. Annuler efface la note ET la voix créée ===');
    await p.evaluate(() => window.app.seqUndo());
    await p.waitForTimeout(600);
    const annule = await p.evaluate(() => ({
        notes: window.app.readChord().getSeqMidiNotes(),
        libres: window.app.extraNotes.length,
    }));
    check(!annule.notes.includes(cibleMidi), 'la note n\'est plus jouée');
    check(annule.libres === 0,
        'et la voix libre a disparu avec elle — sinon il resterait une ligne muette impossible à enlever');

    console.log('\n=== E. Rien ne change en vue COMPACTE (lignes = voix, pas demi-tons) ===');
    await p.click('#grid-zoom') // même bouton pour refermer : #grid-zoom est une bascule;
    await p.waitForTimeout(700);
    await p.evaluate(() => window.app.editChord(0, 1));
    await p.waitForTimeout(500);
    await p.evaluate(() => { if (!window.app.seqOpen) window.app.toggleSequencer('compact'); });
    await p.waitForTimeout(700);
    const compact = await relever(p);
    check(compact && !compact.continu, 'on est bien revenu sur le séquenceur compact');
    check(compact.nbCasesLibres === 0, 'aucune case libre ici — une ligne compacte est une VOIX, pas un demi-ton');
    check(compact.lignes.every(l => l.touche === null),
        'et aucune touche de clavier : sur des lignes non chromatiques, elle mentirait sur les écarts');
    check(compact.lignes.length === (await p.evaluate(() => window.app.readChord().getSeqMidiNotes().length)),
        `une ligne par voix de l'accord, comme avant — ${compact.lignes.length}`);
    await p.close();

    console.log('\n=== F. Cas défavorable : une section très étendue reste bornée ===');
    const g = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    brancher(g, 'étendue: ');
    // Basse à l'octave 1 face à un accord à l'octave 6 : l'étendue maximale que l'appli permet.
    await prep(g, [['C', 'maj', 1], ['B', 'maj7', 6], ['F', 'maj7', 3]]);
    const t0 = Date.now();
    await ouvrirLoupe(g, 2);
    const dt = Date.now() - t0;
    const large = await relever(g);
    // Pas de plafond précis attendu ici (l'étendue dépend de l'octave choisie par l'utilisateur, sans
    // borne dans l'appli) — seule compte l'absence d'explosion/débordement, vérifiée juste après.
    check(large.lignes.length > 20 && large.lignes.length < 150,
        `l'étendue la plus large reste dans un ordre de grandeur raisonnable — ${large.lignes.length} lignes`);
    check(dt < 5000, `et se rend sans peiner — ${dt}ms pour ouvrir la loupe`);
    check(await g.evaluate(() => {
        const s = document.querySelector('#arp-sequencer .seq-scroll');
        return s.scrollHeight > s.clientHeight ? getComputedStyle(s).overflowY !== 'visible' : true;
    }), 'ce qui dépasse en hauteur se fait défiler, ça ne sort pas du panneau');
    check(await g.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        'et rien ne déborde de la page en largeur');
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
