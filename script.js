// ---------- Migration ancien nom (HarmoBox -> HarmoHub) ----------
// Une seule fois : recopie les clés localStorage de l'ancien préfixe vers 'harmohub*'
// pour ne pas perdre les données des utilisateurs qui avaient l'app sous l'ancien nom.
(function migrateHarmoboxKeys() {
    const OLD_PREFIX = 'harmo' + 'box'; // évite qu'un futur renommage global écrase ce littéral
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const oldKey = localStorage.key(i);
        if (!oldKey || !oldKey.startsWith(OLD_PREFIX)) continue;
        const newKey = 'harmohub' + oldKey.slice(OLD_PREFIX.length);
        if (localStorage.getItem(newKey) === null) {
            localStorage.setItem(newKey, localStorage.getItem(oldKey));
        }
        localStorage.removeItem(oldKey);
    }
})();

// ---------- Icônes ----------
// Un seul jeu d'icônes (traits arrondis, currentColor) pour tous les boutons générés dynamiquement,
// cohérent avec celles écrites en dur dans index.html (même style : viewBox 24, trait 2, coins ronds).
const ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    close: '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    duplicate: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    up: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
    down: '<path d="M12 5v14"/><path d="m5 12 7 7 7-7"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-left': '<path d="m15 18-6-6 6-6"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    loop: '<path d="M17 2 21 6 17 10"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22 3 18 7 14"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    play: '<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
    // « Appliquer partout » (voir applyInstrumentToSong) : pot de peinture renversé qui goutte — se
    // lit comme « remplir/appliquer partout », plus parlant que les deux dessins précédents (une
    // flèche convergente, puis un porte-voix, tous deux jugés peu compréhensibles au premier coup
    // d'œil par retour utilisateur). Le seau (anse + corps + ouverture ovale) est un <g> incliné à
    // 35° — le filet et la goutte, eux, restent hors du groupe : ils représentent la peinture qui
    // tombe sous son propre poids, pas une partie du seau qui tourne avec lui.
    applyAll: '<g transform="rotate(35 9 8)"><path d="M5 4a4 3 0 0 1 8 0"/><path d="M4 4h10l-1.4 9.2a1.6 1.6 0 0 1-1.6 1.4H7a1.6 1.6 0 0 1-1.6-1.4L4 4Z"/><ellipse cx="9" cy="4" rx="5" ry="1.4"/></g><path d="M17 16c1.3 1.3 1.3 2.7 0 4"/><circle cx="20" cy="20" r="1.8" fill="currentColor" stroke="none"/>',
    // Bouton clic faible sur le contretemps (voir metronomeSubdivision) : l'icône reflète l'état
    // ACTUEL (pas l'action au clic) — une noire seule quand désactivé (clics réguliers), deux croches
    // reliées quand activé (clics subdivisés) — plutôt qu'une icône fixe qui ne montrait jamais que
    // l'état "activé", peu importe l'état réel (retour utilisateur : confondue avec des "...").
    quarterNote: '<ellipse cx="9" cy="18" rx="4" ry="3" fill="currentColor"/><path d="M13 18V4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    eighthNotes: '<ellipse cx="6" cy="18" rx="3" ry="2.3" fill="currentColor"/><ellipse cx="17" cy="19" rx="3" ry="2.3" fill="currentColor"/><path d="M9 18V6l8 2v11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    // Pipette de motif ENTRE VOIES (voir toggleSeqRowPipette) : une barre pleine (la note prélevée)
    // au-dessus, une flèche vers le bas, une barre en pointillés (la ligne cible qui va la recevoir)
    // en dessous — plus explicite que l'ancienne icône de pipette/goutte (retour utilisateur : "je
    // n'aime pas ce logo, pas assez compréhensible").
    seqRowPipette: '<rect x="2" y="5" width="11" height="4" rx="1" fill="currentColor" stroke="none"/><path d="M19 7v10"/><path d="m16 14 3 3 3-3"/><rect x="2" y="16" width="11" height="4" rx="1" stroke-dasharray="2 2"/>',
    // Bouton "Conduite de voix" (voir toggleVoiceLeadingPanel) : deux paires de notes (barres
    // horizontales, façon piano-roll) reliées par des pointillés, chaque paire bougeant en sens
    // contraire — se lit comme "plusieurs voix qui bougent", pas un simple réglage de volume (l'ancien
    // dessin, 4 barres verticales de hauteurs croissantes, y ressemblait trop — retour utilisateur).
    voiceLeading: '<rect x="2" y="4" width="6" height="2.6" rx="1" fill="currentColor" stroke="none"/><rect x="10" y="7.5" width="6" height="2.6" rx="1" fill="currentColor" stroke="none"/><path d="M8 5.3 10 8.8" stroke-width="1.5" stroke-dasharray="1.5 1.5"/><rect x="3" y="15.5" width="6" height="2.6" rx="1" fill="currentColor" stroke="none"/><rect x="13" y="11.5" width="6" height="2.6" rx="1" fill="currentColor" stroke="none"/><path d="M9 16.8 13 12.8" stroke-width="1.5" stroke-dasharray="1.5 1.5"/>'
};

// Rendu HTML d'une icône (name doit exister dans ICONS) ; extraClass optionnel pour la taille/marge
// via CSS (voir .icon dans style.css). aria-hidden car ces icônes sont toujours à côté d'un texte,
// d'un title ou d'un aria-label déjà porté par leur bouton parent.
function svgIcon(name, extraClass) {
    return `<svg class="icon${extraClass ? ' ' + extraClass : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// Équivalents enharmoniques en bémols, utilisés à l'affichage pour les tonalités qui s'écrivent ainsi
const NOTES_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];


// Intervalles de chaque type d'accord, partagés entre la classe Chord (voicing/lecture), le
// repérage hors-tonalité et l'orthographe enharmonique fonctionnelle. Pour chaque note :
//   - semi   : demi-tons depuis la fondamentale (au-delà de 12 pour les extensions 9e/11e/13e ;
//              la classe Chord ne s'en soucie pas, simple arithmétique MIDI) ;
//   - degree : distance en « lettres » depuis la fondamentale (0=fondamentale, 1=2de/9e, 2=tierce,
//              3=4te/11e, 4=quinte, 5=6te/13e, 6=7me) — sert à l'orthographe fonctionnelle, pour
//              qu'une tierce s'écrive toujours avec la bonne lettre (ex. Fa# et non Sol♭ sur un Ré) ;
//   - role   : catégorie de coloration du clavier (root/third/fifth/seventh/ext).
// Voicings dom11/dom13 : on omet respectivement la tierce (choc avec la 11e) et la quinte + la 11e
// (notes les moins essentielles), comme c'est l'usage courant en jazz.
const CHORD_INTERVALS = {
    maj:  [{ semi: 0, degree: 0, role: 'root' }, { semi: 4, degree: 2, role: 'third' }, { semi: 7, degree: 4, role: 'fifth' }],
    min:  [{ semi: 0, degree: 0, role: 'root' }, { semi: 3, degree: 2, role: 'third' }, { semi: 7, degree: 4, role: 'fifth' }],
    maj7: [{ semi: 0, degree: 0, role: 'root' }, { semi: 4, degree: 2, role: 'third' }, { semi: 7, degree: 4, role: 'fifth' }, { semi: 11, degree: 6, role: 'seventh' }],
    min7: [{ semi: 0, degree: 0, role: 'root' }, { semi: 3, degree: 2, role: 'third' }, { semi: 7, degree: 4, role: 'fifth' }, { semi: 10, degree: 6, role: 'seventh' }],
    dom7: [{ semi: 0, degree: 0, role: 'root' }, { semi: 4, degree: 2, role: 'third' }, { semi: 7, degree: 4, role: 'fifth' }, { semi: 10, degree: 6, role: 'seventh' }],
    // Le 2e/4e degré qui remplace la tierce n'EST pas une tierce (voir légende 1/3/5/7/Autres) :
    // classé « ext » comme les autres degrés hors 1-3-5-7 (2, 4, 6, 9, 11, 13...).
    sus2: [{ semi: 0, degree: 0, role: 'root' }, { semi: 2, degree: 1, role: 'ext' }, { semi: 7, degree: 4, role: 'fifth' }],
    sus4: [{ semi: 0, degree: 0, role: 'root' }, { semi: 5, degree: 3, role: 'ext' }, { semi: 7, degree: 4, role: 'fifth' }],
    '6':  [{ semi: 0, degree: 0, role: 'root' }, { semi: 4, degree: 2, role: 'third' }, { semi: 7, degree: 4, role: 'fifth' }, { semi: 9, degree: 5, role: 'ext' }],
    m6:   [{ semi: 0, degree: 0, role: 'root' }, { semi: 3, degree: 2, role: 'third' }, { semi: 7, degree: 4, role: 'fifth' }, { semi: 9, degree: 5, role: 'ext' }],
    dim:  [{ semi: 0, degree: 0, role: 'root' }, { semi: 3, degree: 2, role: 'third' }, { semi: 6, degree: 4, role: 'fifth' }],
    dim7: [{ semi: 0, degree: 0, role: 'root' }, { semi: 3, degree: 2, role: 'third' }, { semi: 6, degree: 4, role: 'fifth' }, { semi: 9, degree: 6, role: 'seventh' }],
    m7b5: [{ semi: 0, degree: 0, role: 'root' }, { semi: 3, degree: 2, role: 'third' }, { semi: 6, degree: 4, role: 'fifth' }, { semi: 10, degree: 6, role: 'seventh' }],
    aug:  [{ semi: 0, degree: 0, role: 'root' }, { semi: 4, degree: 2, role: 'third' }, { semi: 8, degree: 4, role: 'fifth' }],
    add9: [{ semi: 0, degree: 0, role: 'root' }, { semi: 4, degree: 2, role: 'third' }, { semi: 7, degree: 4, role: 'fifth' }, { semi: 14, degree: 1, role: 'ext' }],
    // add11 : garde la tierce (contrairement à dom11, qui l'omet) puisqu'il n'y a pas de 7e pour
    // épaissir le mélange tierce/11e — 11e placée au-dessus de l'octave, comme la 9e d'add9.
    add11: [{ semi: 0, degree: 0, role: 'root' }, { semi: 4, degree: 2, role: 'third' }, { semi: 7, degree: 4, role: 'fifth' }, { semi: 17, degree: 3, role: 'ext' }],
    maj9: [{ semi: 0, degree: 0, role: 'root' }, { semi: 4, degree: 2, role: 'third' }, { semi: 7, degree: 4, role: 'fifth' }, { semi: 11, degree: 6, role: 'seventh' }, { semi: 14, degree: 1, role: 'ext' }],
    m9:   [{ semi: 0, degree: 0, role: 'root' }, { semi: 3, degree: 2, role: 'third' }, { semi: 7, degree: 4, role: 'fifth' }, { semi: 10, degree: 6, role: 'seventh' }, { semi: 14, degree: 1, role: 'ext' }],
    dom9: [{ semi: 0, degree: 0, role: 'root' }, { semi: 4, degree: 2, role: 'third' }, { semi: 7, degree: 4, role: 'fifth' }, { semi: 10, degree: 6, role: 'seventh' }, { semi: 14, degree: 1, role: 'ext' }],
    // dom11 : tierce omise (dissonance de seconde avec la 11e)
    dom11: [{ semi: 0, degree: 0, role: 'root' }, { semi: 7, degree: 4, role: 'fifth' }, { semi: 10, degree: 6, role: 'seventh' }, { semi: 14, degree: 1, role: 'ext' }, { semi: 17, degree: 3, role: 'ext' }],
    // dom13 : quinte et 11e omises (notes les moins essentielles de l'accord)
    dom13: [{ semi: 0, degree: 0, role: 'root' }, { semi: 4, degree: 2, role: 'third' }, { semi: 10, degree: 6, role: 'seventh' }, { semi: 14, degree: 1, role: 'ext' }, { semi: 21, degree: 5, role: 'ext' }]
};

// Ensemble de classes de hauteur (0-11, relatives à la fondamentale) d'une qualité — sert à repérer
// si l'ajout d'une note libre au séquenceur complète exactement une AUTRE qualité déjà reconnue
// (voir commitExtraNoteLabel/findQualityMatchingPitchClasses).
function pitchClassSetForQuality(quality) {
    const ivs = CHORD_INTERVALS[quality] || CHORD_INTERVALS.maj;
    return new Set(ivs.map(iv => ((iv.semi % 12) + 12) % 12));
}

// Cherche, parmi toutes les qualités connues, celle dont l'ensemble de classes de hauteur est
// EXACTEMENT `pcSet` (même taille, mêmes membres) — ou null si aucune ne correspond exactement.
function findQualityMatchingPitchClasses(pcSet) {
    for (const q of Object.keys(CHORD_INTERVALS)) {
        const qSet = pitchClassSetForQuality(q);
        if (qSet.size === pcSet.size && [...qSet].every(pc => pcSet.has(pc))) return q;
    }
    return null;
}

// Parse "E3", "F#4", "Bb2"... (lettre + dièse/bémol optionnel + chiffre d'octave, signé) en
// { note, octave }, ou null si non reconnu — note libre ajoutée au séquenceur (voir
// addSequencerNote/commitExtraNoteLabel), à la différence de parseChordSymbol qui lit un SYMBOLE
// D'ACCORD entier (fondamentale + qualité, jamais d'octave).
function parseNoteNameOctave(text) {
    const m = (text || '').trim().match(/^([A-Ga-g])(#|b)?(-?\d+)$/);
    if (!m) return null;
    const [, letter, accidental, octaveStr] = m;
    const BASE_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    let pc = BASE_PC[letter.toUpperCase()];
    if (accidental === '#') pc += 1;
    else if (accidental === 'b') pc -= 1;
    pc = ((pc % 12) + 12) % 12;
    const octave = parseInt(octaveStr, 10);
    if (!Number.isFinite(octave)) return null;
    return { note: NOTES[pc], octave };
}

// Symboles d'accord lisibles pour l'affichage
const QUALITY_LABEL = {
    maj: '', min: 'm', maj7: 'maj7', min7: 'm7', dom7: '7',
    sus2: 'sus2', sus4: 'sus4', '6': '6', m6: 'm6',
    dim: 'dim', dim7: 'dim7', m7b5: 'm7b5', aug: 'aug',
    add9: 'add9', add11: 'add11', maj9: 'maj9', m9: 'm9', dom9: '9', dom11: '11', dom13: '13'
};

// ---------- Saisie rapide au clavier (grille) ----------
// Alias reconnus pour chaque qualité, clé = suffixe normalisé (espaces retirés, en minuscules) une
// fois la fondamentale extraite. "m"/"min" = mineur (convention universelle) ; le majeur ne
// s'abrège JAMAIS en un simple "M" à ce stade (voir plus bas, traité séparément AVANT la mise en
// minuscule) pour éviter la confusion avec "m" (mineur) une fois tout passé en minuscules.
const QUALITY_ALIASES = {
    '': 'maj', 'maj': 'maj', 'ma': 'maj', 'major': 'maj',
    'm': 'min', 'min': 'min', 'mi': 'min', 'minor': 'min', '-': 'min',
    '7': 'dom7', 'dom7': 'dom7',
    'maj7': 'maj7', 'ma7': 'maj7',
    'm7': 'min7', 'min7': 'min7', 'mi7': 'min7', '-7': 'min7',
    'sus2': 'sus2',
    'sus4': 'sus4', 'sus': 'sus4',
    '6': '6',
    'm6': 'm6', 'min6': 'm6', '-6': 'm6',
    'dim': 'dim', '°': 'dim', 'o': 'dim',
    'dim7': 'dim7', '°7': 'dim7', 'o7': 'dim7',
    'm7b5': 'm7b5', 'm7-5': 'm7b5', 'min7b5': 'm7b5', 'ø': 'm7b5', 'ø7': 'm7b5', 'halfdim': 'm7b5', 'halfdim7': 'm7b5',
    'aug': 'aug', '+': 'aug',
    'add9': 'add9',
    'add11': 'add11',
    'maj9': 'maj9', 'ma9': 'maj9',
    'm9': 'm9', 'min9': 'm9',
    '9': 'dom9', 'dom9': 'dom9',
    '11': 'dom11', 'dom11': 'dom11',
    '13': 'dom13', 'dom13': 'dom13',
};

// Parse un symbole d'accord tapé au clavier (ex. "Cm7", "F#dim", "Bbadd9", "DM7") en { root, quality,
// bass, octave, inversion, drop } exploitable par Chord, ou null si non reconnu. `octave`/`inversion`/
// `drop` valent null si non précisés dans le symbole (voir bloc "_" ci-dessous) — à l'appelant de les
// remplacer par leurs valeurs par défaut (fondamentale/octave classique/sans drop) : un symbole SANS
// bloc "_" (ex. juste "C") repart donc toujours d'un voicing par défaut plutôt que de garder ce qui
// était déjà réglé (retour utilisateur : ce qu'on tape doit décrire le voicing ENTIER, pas juste un
// correctif de racine/qualité — voir buildChordData et startInlineChordSymbolEdit, seuls appelants
// qui donnent un sens à octave/inversion/drop).
function parseChordSymbol(input) {
    const s = (input || '').trim();
    if (!s) return null;
    const m = s.match(/^([A-Ga-g])(#|b|♭)?(.*)$/);
    if (!m) return null;
    const [, letter, accidental, rawRest] = m;

    const BASE_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    let pc = BASE_PC[letter.toUpperCase()];
    if (accidental === '#') pc += 1;
    else if (accidental === 'b' || accidental === '♭') pc -= 1;
    pc = ((pc % 12) + 12) % 12;
    const root = NOTES[pc];

    let rest = rawRest.trim();

    // Bloc "_" : basse différente et/ou voicing (octave/renversement/drop), combinables et dans
    // n'importe quel ordre (ex. "C_E", "C_O4-R1-D2", "C_D2" (partiel), "C_E_O4-D2"). Découpé en
    // jetons lettre+chiffres — tirets/espaces entre eux ne sont QUE de la ponctuation lisible,
    // ignorés par ce découpage (matchAll saute tout ce qui ne matche pas). Chaque jeton est ensuite
    // reconnu par sa FORME, pas sa position : "O"/"R"/"D" + un chiffre = octave/renversement/drop
    // (même notation que les badges "O4-R1-D2" du PDF/de la grille, voir getVoicingBadge) ; une
    // simple lettre de note SANS chiffre = basse (seul "D" est ambigu entre les deux — mais jamais
    // suivi d'un chiffre pour une basse, ce qui les distingue sans équivoque). Volontairement pas
    // "/" pour la basse (déjà pris par la saisie rapide pour séparer plusieurs accords).
    let bass = null, octave = null, inversion = null, drop = null;
    const modIdx = rest.indexOf('_');
    if (modIdx !== -1) {
        const modStr = rest.slice(modIdx + 1);
        rest = rest.slice(0, modIdx).trim();
        const tokens = modStr.match(/[A-Za-z](?:#|b|♭)?\d*/g);
        if (!tokens || tokens.length === 0) return null;
        for (const tok of tokens) {
            const tm = tok.match(/^([A-Za-z])(#|b|♭)?(\d*)$/);
            const tLetter = tm[1].toUpperCase();
            const tAccidental = tm[2];
            const tDigits = tm[3];
            if (tDigits) {
                const n = parseInt(tDigits, 10);
                if (tLetter === 'O' && n >= 2 && n <= 5) { if (octave != null) return null; octave = n; }
                else if (tLetter === 'R' && n >= 0 && n <= 3) { if (inversion != null) return null; inversion = n; }
                else if (tLetter === 'D' && (n === 2 || n === 3)) { if (drop != null) return null; drop = 'drop' + n; }
                else return null;
            } else if (BASE_PC[tLetter] != null) {
                if (bass != null) return null;
                let bPc = BASE_PC[tLetter];
                if (tAccidental === '#') bPc += 1;
                else if (tAccidental === 'b' || tAccidental === '♭') bPc -= 1;
                bPc = ((bPc % 12) + 12) % 12;
                bass = NOTES[bPc];
            } else {
                return null;
            }
        }
    }

    // Convention jazz répandue : M/M7/M9 en MAJUSCULE = majeur — vérifié avant la normalisation en
    // minuscules (sinon "M7" serait confondu avec "m7", mineur 7e).
    if (rest === 'M') return { root, quality: 'maj', bass, octave, inversion, drop };
    if (rest === 'M7') return { root, quality: 'maj7', bass, octave, inversion, drop };
    if (rest === 'M9') return { root, quality: 'maj9', bass, octave, inversion, drop };

    const suffix = rest.replace(/\s+/g, '').toLowerCase();
    const quality = QUALITY_ALIASES[suffix];
    return quality ? { root, quality, bass, octave, inversion, drop } : null;
}

// Tonalités majeures qui s'écrivent conventionnellement avec des bémols (Db, Eb, F, Ab, Bb) :
// moins d'altérations que leur équivalent en dièses (ex. Db = 5b vs C# = 7#). Toutes les autres
// tonalités majeures (C, G, D, A, E, B, F#) s'écrivent avec des dièses.
const FLAT_KEY_PCS = new Set([1, 3, 5, 8, 10]);

// ---------- Modes ----------
// Les 7 modes diatoniques ne sont que des rotations de la gamme majeure, chacun démarrant sur un
// degré différent de celui-ci — d'où deux tables dérivées mécaniquement l'une de l'autre :
//   - MODE_SCALES : les degrés (demi-tons depuis la tonique DU MODE) de chaque mode.
//   - MODE_RELATIVE_MAJOR_OFFSET : le décalage (en demi-tons) entre la tonique du mode et celle de
//     SA relative majeure (même armure, mêmes notes) — sert à réutiliser FLAT_KEY_PCS pour
//     déterminer si le mode s'écrit en dièses ou en bémols (ex. do dorien -> sib majeur, relative,
//     s'écrit en bémols -> do dorien aussi).
const MODE_SCALES = {
    maj: [0, 2, 4, 5, 7, 9, 11],        // Ionien
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    min: [0, 2, 3, 5, 7, 8, 10],        // Éolien
    locrian: [0, 1, 3, 5, 6, 8, 10]
};
const MODE_RELATIVE_MAJOR_OFFSET = { maj: 0, dorian: 10, phrygian: 8, lydian: 7, mixolydian: 5, min: 3, locrian: 1 };
const MODE_LABELS = { maj: 'majeur', min: 'mineur', dorian: 'dorien', phrygian: 'phrygien', lydian: 'lydien', mixolydian: 'mixolydien', locrian: 'locrien' };

// ---------- Aide au choix de la tonalité (voir suggestSongKey) ----------
// Profils de Krumhansl-Kessler (Krumhansl & Kessler, 1982 — repris tel quel par music21, MuseScore...) :
// poids relatif de chaque degré (0 = tonique, 1 = 2nde mineure au-dessus, 2 = 2nde majeure, etc.) dans
// le sentiment de tonalité, mesurés empiriquement auprès d'auditeurs. Algorithme DE RÉFÉRENCE en
// analyse tonale (Krumhansl-Schmuckler) — préféré à un simple décompte de fondamentales diatoniques
// (bien plus fragile dès que les accords se compliquent, voir retour utilisateur) : ici, on corrèle la
// forme du profil réel des hauteurs JOUÉES (toutes les notes de chaque accord — tierce/quinte/7e/9e/
//11e/13e comprises, pas juste sa fondamentale) à celle de ces 24 profils (12 fondamentales x majeur/
// mineur), ce qui reste valable quelle que soit la complexité des accords (dominantes secondaires,
// extensions, altérations...) : chaque note contribue sa propre hauteur, sans règle spéciale par type
// d'accord à écrire ou tenir à jour.
const KS_MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KS_MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

// Corrélation de Pearson entre deux profils de même longueur : mesure standard de similarité de FORME
// entre deux distributions (insensible à leur échelle globale, contrairement à un simple produit
// scalaire) — ce qui compte pour reconnaître une tonalité, c'est que les pics retombent au même
// endroit, pas l'intensité absolue de l'un ou l'autre profil.
function pearsonCorrelation(a, b) {
    const n = a.length;
    const meanA = a.reduce((s, v) => s + v, 0) / n;
    const meanB = b.reduce((s, v) => s + v, 0) / n;
    let num = 0, denA = 0, denB = 0;
    for (let i = 0; i < n; i++) {
        const da = a[i] - meanA, db = b[i] - meanB;
        num += da * db;
        denA += da * da;
        denB += db * db;
    }
    return (denA === 0 || denB === 0) ? 0 : num / Math.sqrt(denA * denB);
}

// La relative majeure d'un mode emprunte son armure (voir MODE_RELATIVE_MAJOR_OFFSET ci-dessus)
function useFlatsForKey(rootPc, mode) {
    const majorPc = (rootPc + (MODE_RELATIVE_MAJOR_OFFSET[mode] ?? 0)) % 12;
    return FLAT_KEY_PCS.has(((majorPc % 12) + 12) % 12);
}

// Nom de note pour une classe de hauteur (0-11), en dièses ou en bémols selon la tonalité
function noteNameForPc(pc, useFlats) {
    const i = ((pc % 12) + 12) % 12;
    return (useFlats ? NOTES_FLAT : NOTES)[i];
}

// Nom de note affichable (avec octave) pour un numéro MIDI, selon la tonalité
function midiToDisplayName(midi, useFlats) {
    const pc = ((midi % 12) + 12) % 12;
    const oct = Math.floor(midi / 12) - 1;
    return noteNameForPc(pc, useFlats) + oct;
}

// ---------- Orthographe enharmonique FONCTIONNELLE (par degré, indépendante de la tonalité) ----------
// Une tierce s'écrit toujours avec la lettre une tierce au-dessus de la fondamentale (ex. Fa# sur
// un Ré, jamais Sol♭), même si la tonalité du morceau s'écrit en bémols. Seule la fondamentale
// elle-même suit encore la convention dièses/bémols de la tonalité (c'est le point de départ).
const LETTER_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_NATURAL_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Décompose un nom de note (« F# », « Bb », « D♭♭ »...) en lettre + décalage d'altération (nombre
// entier de # ou de b/♭, positif ou négatif)
function parseNoteSpelling(name) {
    const letter = name[0];
    let accidental = 0;
    for (let i = 1; i < name.length; i++) {
        if (name[i] === '#') accidental += 1;
        else if (name[i] === 'b' || name[i] === '♭') accidental -= 1;
    }
    return { letter, accidental };
}

// Épelle la lettre+altération à `degreeSteps` lettres au-dessus de `rootLetter` de façon à obtenir
// la classe de hauteur `targetPc` (ex. degree=2 (tierce) depuis Ré, visant Fa# -> "F#").
// Renvoie null si ça exigerait plus qu'un double dièse/bémol (cas extrême, on retombe alors sur
// l'orthographe générique dièse/bémol de la tonalité).
function spellByDegree(rootLetter, degreeSteps, targetPc) {
    const rootLetterIdx = LETTER_ORDER.indexOf(rootLetter);
    const targetLetter = LETTER_ORDER[(rootLetterIdx + degreeSteps) % 7];
    const naturalPc = LETTER_NATURAL_PC[targetLetter];
    let diff = (((targetPc - naturalPc) % 12) + 12) % 12; // ramené dans [0, 11]
    if (diff > 6) diff -= 12;                              // puis dans [-5, 6] (signé, le plus court chemin)
    if (diff < -2 || diff > 2) return null;                // au-delà du double dièse/bémol : abandon
    let sym = targetLetter;
    if (diff === 1) sym += '#';
    else if (diff === 2) sym += '##';
    else if (diff === -1) sym += '♭';
    else if (diff === -2) sym += '♭♭';
    return { letter: targetLetter, accidental: diff, name: sym };
}

// Octave affichée : les numéros d'octave changent à Do (C), pas à chaque lettre. Si on épelle une
// hauteur en "Cb"/"Cbb" (juste sous un Do), ou en "B#"/"B##" (juste au-dessus d'un Si), l'octave
// affichée doit suivre la lettre choisie plutôt que le calcul brut à partir du numéro MIDI.
function displayOctaveFor(letter, accidental, rawOctave) {
    if (letter === 'C' && accidental < 0) return rawOctave + 1;
    if (letter === 'B' && accidental > 0) return rawOctave - 1;
    return rawOctave;
}

// Épelle une note d'accord par sa FONCTION (degré depuis la fondamentale du même accord), avec
// repli sur l'orthographe générique dièse/bémol de la tonalité si le degré est extrême (>2 alt.)
// ou non fourni (notes hors accord, ex. clavier générique). `withOctave=false` omet le chiffre
// d'octave (utile pour un simple récapitulatif des notes, où il n'apporte pas grand-chose).
function spellChordTone(rootPc, useFlats, degree, targetMidi, withOctave = true) {
    const targetPc = ((targetMidi % 12) + 12) % 12;
    const rawOctave = Math.floor(targetMidi / 12) - 1;
    if (degree != null) {
        const rootLetter = parseNoteSpelling(noteNameForPc(rootPc, useFlats)).letter;
        const spelled = spellByDegree(rootLetter, degree, targetPc);
        if (spelled) return spelled.name + (withOctave ? displayOctaveFor(spelled.letter, spelled.accidental, rawOctave) : '');
    }
    return noteNameForPc(targetPc, useFlats) + (withOctave ? rawOctave : ''); // repli : orthographe générique
}

// Convention dièse/bémol pour LA FONDAMENTALE d'un accord précis (par opposition à la convention
// générale du morceau) : certains degrés chromatiques empruntés (bII, bIII, bV, bVI, bVII) s'écrivent
// TOUJOURS avec un bémol en notation réelle, quel que soit le ton (ex. un bVI en Do majeur s'écrit
// « Lab », jamais « Sol# », puisque c'est littéralement un degré abaissé). En mineur, III/VI/VII sont
// diatoniques (cf. MINOR_ROMAN_MAP) et donc exclus de cette liste : seuls bII et bV y restent
// chromatiques. Pour tout le reste (diatonique, dominantes secondaires...), on garde la convention
// générale du morceau, déjà cohérente avec l'usage (ex. les dominantes secondaires se notent
// généralement avec des dièses/bécarres, pas des bémols).
const FLAT_BORROW_DEGREES_MAJOR = new Set([1, 3, 6, 8, 10]);
const FLAT_BORROW_DEGREES_MINOR = new Set([1, 6]);

// Pour les 5 autres modes (sans réglage main par main comme majeur/mineur ci-dessus), tout degré
// chromatique (hors gamme du mode) est traité en bémol par défaut — convention la plus courante
// pour noter un degré emprunté/abaissé, à défaut d'un usage plus établi pour ces modes.
const MODE_FLAT_BORROW_DEGREES = { maj: FLAT_BORROW_DEGREES_MAJOR, min: FLAT_BORROW_DEGREES_MINOR };
Object.keys(MODE_SCALES).forEach(mode => {
    if (MODE_FLAT_BORROW_DEGREES[mode]) return;
    const scaleSet = new Set(MODE_SCALES[mode]);
    const chromatic = new Set();
    for (let s = 0; s < 12; s++) if (!scaleSet.has(s)) chromatic.add(s);
    MODE_FLAT_BORROW_DEGREES[mode] = chromatic;
});

function useFlatsForChordRoot(chordRootPc, keyRootPc, keyMode, songUseFlats) {
    const diff = ((chordRootPc - keyRootPc) % 12 + 12) % 12;
    const borrow = MODE_FLAT_BORROW_DEGREES[keyMode] || FLAT_BORROW_DEGREES_MAJOR;
    return borrow.has(diff) ? true : songUseFlats;
}

// Plage du clavier affiché : C2 (MIDI 36) -> B5 (MIDI 83), couvre tous les drops
const VIZ_LOW = 36;
const VIZ_HIGH = 83;

// Signatures rythmiques courantes proposées dans l'onglet Morceau (temps par mesure).
// Un « temps » reste ici la noire de l'appli (durées, tempo) : pour les mesures composées
// (6/8, 9/8, 12/8), c'est donc un raccourci pratique plutôt qu'un vrai temps pointé dirigé —
// suffisant pour placer correctement les barres de mesure et la durée « 1 mesure ».
const TIME_SIG_BEATS = { '2/4': 2, '3/4': 3, '4/4': 4, '5/4': 5, '6/8': 6, '7/8': 7, '9/8': 9, '12/8': 12 };

// Nombre de temps affichés par ligne de la grille : un multiple de la mesure proche de 16 (32 en
// mode loupe, où la fenêtre est bien plus large — ex. 8 mesures par ligne en 4/4 au lieu de 4),
// pour garder des lignes de largeur comparable quelle que soit la signature choisie. `hZoom`
// (échelle horizontale de la loupe grille, voir adjustZoom/applyZoomLevel) réduit cette cible
// d'autant : moins d'accords par ligne, donc chaque case mécaniquement plus large — un zoom réel
// (vraie mise en page recalculée), pas un simple agrandissement visuel.
function beatsPerRowFor(beatsPerBar, zoomed = false, hZoom = 1) {
    const base = zoomed ? 32 : 16;
    const floor = zoomed ? 8 : 4; // grille classique : peut resserrer jusqu'à 1 seule mesure par ligne
    const target = Math.max(floor, base / hZoom);
    const bars = Math.max(1, Math.round(target / beatsPerBar));
    return beatsPerBar * bars;
}

// Nombre de mesures affichées d'un coup dans le séquenceur (pour un accord qui en dure plusieurs) :
// une pleine mesure en 4/4, mais 2 en 2/4 (deux fois moins de temps chacune) ou 1 seule dès que la
// mesure est plus longue que 4 temps (5/4, 6/8...) — même largeur visuelle cible qu'une mesure en 4/4,
// pour ne jamais afficher ni trop peu ni trop de croches d'un coup quelle que soit la signature.
// Cible doublée (8 temps) une fois agrandi (fenêtre séquenceur ou loupe grille avec séquenceur épinglé,
// voir renderSequencer) : beaucoup plus de place, comme beatsPerRowFor pour la grille d'accords.
// `hZoom` (échelle horizontale — loupe séquenceur OU version compacte, voir adjustSeqInlineZoom)
// réduit cette cible d'autant, même principe, qu'on soit agrandi ou non (hZoom reste à 1 par défaut
// dans les deux cas, donc sans effet tant qu'on n'y a pas touché).
function seqPageBars(beatsPerBar, zoomed = false, hZoom = 1) {
    const target = Math.max(2, (zoomed ? 8 : 4) / hZoom);
    return Math.max(1, Math.round(target / beatsPerBar));
}

// Réglages d'accord : Entrée depuis l'un d'eux ajoute/modifie directement (moins de clics)
const CHORD_PARAM_IDS = ['root', 'quality', 'duration', 'inversion', 'drop', 'octave', 'bass', 'playStyle', 'instrument', 'intensity'];

// Durées disponibles pour un accord (voir #duration, piloté par setupDurationPicker) : icône en
// barre remplie (proportion de la mesure occupée), même langage visuel pour les 5 — noire/blanche
// juste partiellement remplies (1/4, 1/2 d'une mesure en 4/4), 1/2/4 mesures en barres pleines
// répétées. `label` = libellé compact affiché sous l'icône du bouton fermé, `name` = libellé complet
// dans le menu déroulant (juste le nom : pas besoin d'y répéter "1 temps"/"2 temps", déjà su).
const DURATION_OPTIONS = [
    { beats: '1', label: 'Noire', name: 'Noire',
        svg: '<rect x="1" y="9" width="22" height="7" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="1" y="9" width="6" height="7" rx="2.2" fill="currentColor"/>' },
    { beats: '2', label: 'Blanche', name: 'Blanche',
        svg: '<rect x="1" y="9" width="22" height="7" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="1" y="9" width="11" height="7" rx="2.2" fill="currentColor"/>' },
    { beats: '4', label: '1 mes.', name: '1 mesure',
        svg: '<rect x="1" y="9" width="22" height="7" rx="2.2" fill="currentColor"/>' },
    { beats: '8', label: '2 mes.', name: '2 mesures',
        svg: '<rect x="1" y="6" width="22" height="5" rx="1.8" fill="currentColor"/><rect x="1" y="13" width="22" height="5" rx="1.8" fill="currentColor"/>' },
    { beats: '16', label: '4 mes.', name: '4 mesures',
        svg: '<rect x="1" y="2.5" width="22" height="4" rx="1.5" fill="currentColor"/><rect x="1" y="8" width="22" height="4" rx="1.5" fill="currentColor"/><rect x="1" y="13.5" width="22" height="4" rx="1.5" fill="currentColor"/><rect x="1" y="19" width="22" height="4" rx="1.5" fill="currentColor"/>' },
];

// Styles de jeu disponibles pour un accord (voir #playStyle, piloté par setupPlayStylePicker) :
// notation musicale réelle — tête(s) de note reliée(s) par une liaison (lié, son continu entre les
// reprises) ou marquées d'un point staccato (détaché). Le nombre de têtes affichées suit désormais la
// cadence réelle (voir PRESET_PULSE_STEPS : ronde=1 reprise/mesure, blanche=2, noire=4, croche=8) —
// plafonné à 4 têtes pour rester lisible en petit (croche, la plus rapide, en a réellement le double ;
// 4 têtes suffisent à la distinguer des 3 autres sans être illisibles) plutôt que l'ancienne icône
// unique à 2 têtes pour les 4 cadences, jugée trop peu différenciée (retour utilisateur) — le libellé
// ("4t", "½t"...) reste la seule source exacte, comme pour DURATION_OPTIONS.
function pulseIconSvg(count, tied) {
    const positions = { 1: [12], 2: [6, 18], 3: [4, 12, 20], 4: [3, 9, 15, 21] }[count];
    const r = { 1: 3.5, 2: 3.2, 3: 2.6, 4: 2.2 }[count];
    const cy = tied ? 12 : 8;
    const heads = positions.map(cx => `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.72}" fill="currentColor"/>`).join('');
    if (tied && positions.length > 1) {
        const first = positions[0], last = positions[positions.length - 1];
        const arcY = cy - 5 - (last - first) * 0.1; // liaison d'autant plus haute que les têtes sont espacées
        return heads + `<path d="M${first} ${cy - 5} Q${(first + last) / 2} ${arcY} ${last} ${cy - 5}" fill="none" stroke="currentColor" stroke-width="1.6"/>`;
    }
    if (!tied) return heads + positions.map(cx => `<circle cx="${cx}" cy="14.3" r="1.4" fill="currentColor"/>`).join('');
    return heads;
}
const PLAYSTYLE_OPTIONS = [
    { value: 'held', label: 'Tenu', name: 'Tenu',
        svg: '<ellipse cx="5" cy="8" rx="3.4" ry="2.4" fill="currentColor"/><rect x="9" y="6.2" width="13" height="3.6" rx="1.6" fill="currentColor" opacity="0.55"/>' },
    { value: 'ronde_maintenu', label: '4t', name: '4t', group: 'Lié (son continu)', svg: pulseIconSvg(1, true) },
    { value: 'blanche_maintenu', label: '2t', name: '2t', group: 'Lié (son continu)', svg: pulseIconSvg(2, true) },
    { value: 'noire_maintenu', label: '1t', name: '1t', group: 'Lié (son continu)', svg: pulseIconSvg(3, true) },
    { value: 'croche_maintenu', label: '½t', name: '½t', group: 'Lié (son continu)', svg: pulseIconSvg(4, true) },
    // Pas de suffixe "stac." ici (contrairement au libellé compact de la grille, voir styleMap) :
    // l'icône (points isolés, sans liaison) et l'en-tête de groupe "Détaché" le montrent déjà, sur le
    // bouton fermé comme dans le menu — répéter "staccato" à chaque ligne n'apportait rien de plus.
    { value: 'ronde_staccato', label: '4t', name: '4t', group: 'Détaché (staccato)', svg: pulseIconSvg(1, false) },
    { value: 'blanche_staccato', label: '2t', name: '2t', group: 'Détaché (staccato)', svg: pulseIconSvg(2, false) },
    { value: 'noire_staccato', label: '1t', name: '1t', group: 'Détaché (staccato)', svg: pulseIconSvg(3, false) },
    { value: 'croche_staccato', label: '½t', name: '½t', group: 'Détaché (staccato)', svg: pulseIconSvg(4, false) },
];
const PLAYSTYLE_BY_VALUE = {};
PLAYSTYLE_OPTIONS.forEach(o => { PLAYSTYLE_BY_VALUE[o.value] = o; });
PLAYSTYLE_BY_VALUE.pulsed = PLAYSTYLE_BY_VALUE.noire_staccato; // alias historique (voir seqPreset)

// Renversement/drop seuls, en notation compacte (ex. ["R1", "D2"], [] en position de base) — même
// format que Chord.getVoicingBadge (PDF exporté), mais calculé directement depuis les données brutes
// de l'accord de la grille (pas besoin d'un Chord complet, juste sa qualité pour borner le
// renversement à ce que l'accord peut réellement porter, voir Chord.getEffectiveInversion). Utilisé
// par loadProgression pour le badge "octave/voicing" sous chaque case (options Affichage > Octave /
// Renversement-drop, voir showGridOctave/showGridVoicing) — remplace l'ancienne icône de style de jeu.
function gridVoicingParts(h) {
    const intervalsLen = (CHORD_INTERVALS[h.quality] || CHORD_INTERVALS.maj).length;
    const inv = Math.min(h.inversion || 0, intervalsLen - 1);
    const parts = [];
    if (inv > 0) parts.push(`R${inv}`);
    if (h.drop === 'drop2') parts.push('D2');
    if (h.drop === 'drop3') parts.push('D3');
    return parts;
}

// Récupère la durée en temps d'un accord sauvegardé (compatibilité : anciens formats en "measures").
// Blindé contre une valeur corrompue (ex. chaîne vide, texte, 0 ou négatif) : sans ce garde-fou, un
// seul accord avec un `beats` invalide produisait un total NaN pour toute sa partie ("NaN mes." dans
// l'en-tête) et une case quasi invisible dans la grille (span dégénéré) — repli sur 4 temps (comme
// si la durée n'était pas renseignée du tout) plutôt que de propager la valeur invalide plus loin.
function beatsFromData(data) {
    if (data.beats != null) {
        const n = parseInt(data.beats);
        return (Number.isFinite(n) && n >= 1) ? n : 4;
    }
    if (data.measures != null) return (parseInt(data.measures) || 1) * 4; // ancien format
    return 4;
}

// Nombre de mesures d'une partie (somme des durées de ses accords / temps par mesure) — pour un
// coup d'œil rapide sur sa longueur (grille et export PDF), utile pour une synthèse du morceau.
// Un entier la plupart du temps ; jusqu'à 1 décimale si une partie s'arrête au milieu d'une mesure
// (rare, mais possible selon les durées choisies et la signature rythmique).
function sectionMeasureCount(sec, beatsPerBar) {
    const totalBeats = sec.chords.reduce((sum, c) => sum + beatsFromData(c), 0);
    const count = totalBeats / beatsPerBar;
    return Number.isInteger(count) ? String(count) : count.toFixed(1);
}

// Fond zébré sur UNE MESURE SUR DEUX (pas un temps sur deux : ça se répétait trop vite et perdait
// tout son sens, on ne distinguait plus la mesure elle-même) — la mise en valeur couvre TOUTE la
// largeur de la mesure, pas un simple repère centré sur un temps. S'applique quand même à CHAQUE
// case, y compris un accord plus court qu'une mesure (contrairement à l'ancienne version qui ne
// s'affichait que pour un accord étalé sur plusieurs mesures) : la phase se base sur la position
// ABSOLUE de chaque case dans la grille (pas sur la position du segment lui-même), pour rester
// cohérente d'un accord à l'autre, y compris scindé sur plusieurs lignes.
// Fines hachures obliques (repeating-linear-gradient) par-dessus TOUTE la case, très discrètes : un
// peu de matière/texture plutôt qu'un aplat plat, y compris sur les mesures non mises en valeur.
function buildMeasureZebra(s, beatsPerBar, beatsPerRow) {
    const startAbs = s.row * beatsPerRow + s.col;
    const stops = [];
    for (let i = 0; i < s.span; i++) {
        const measureIdx = Math.floor((startAbs + i) / beatsPerBar);
        const on = measureIdx % 2 === 1; // une mesure sur deux
        const color = on ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0)';
        const from = (i / s.span * 100).toFixed(3), to = ((i + 1) / s.span * 100).toFixed(3);
        stops.push(`${color} ${from}%`, `${color} ${to}%`);
    }
    const measureBlocks = `linear-gradient(90deg, ${stops.join(', ')})`;
    const hachures = `repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 5px)`;
    const sheen = `linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 55%)`;
    return `${measureBlocks}, ${hachures}, ${sheen}`;
}

// Octave de base d'un accord (défaut 3 = C3, compatibilité avec les sauvegardes sans octave)
function octaveFromData(data) {
    return (data.octave != null) ? parseInt(data.octave) : 3;
}

// Décale la fondamentale ET la basse (si définie) d'un accord de `semitones` demi-tons, en conservant
// tout le reste tel quel (qualité, renversement, drop, octave, durée, style de lecture...). +1200 (100
// tours d'octave) avant le modulo : garantit un résultat toujours positif quel que soit le signe de
// `semitones`, sans changer la classe de hauteur obtenue.
function transposeChordData(data, semitones) {
    const shift = (pc) => NOTES[(NOTES.indexOf(pc) + semitones + 1200) % 12];
    // Un doigté verrouillé (voir toggleGuitarLock) transpose comme une vraie forme de guitare : les
    // mêmes cases décalées du même nombre de cases (barré qui monte/descend le manche) — sauf si ça
    // sort de la portée jouable (case négative), auquel cas mieux vaut relâcher le verrou que garder
    // une forme qui ne correspond plus aux bonnes notes.
    let guitarLock = data.guitarLock;
    if (guitarLock) {
        const shifted = guitarLock.map(f => (f == null ? null : f + semitones));
        guitarLock = shifted.some(f => f != null && (f < 0 || f > GUITAR_MAX_FRET)) ? null : shifted;
    }
    // Les notes libres (voir addSequencerNote) transposent en hauteur ABSOLUE, comme n'importe quelle
    // autre voix de l'accord — recalculées via leur MIDI plutôt qu'un simple décalage de lettre (qui
    // ne saurait pas quand faire déborder l'octave, ex. un Si transposé d'un demi-ton devient un Do
    // à l'octave AU-DESSUS, pas le même octave).
    const extraNotes = (data.extraNotes || []).map(x => {
        const midi = NOTES.indexOf(x.note) + 12 * (x.octave + 1) + semitones;
        const pc = ((midi % 12) + 12) % 12;
        return { note: NOTES[pc], octave: Math.floor(midi / 12) - 1 };
    });
    return { ...data, root: shift(data.root), bass: data.bass ? shift(data.bass) : data.bass, guitarLock, extraNotes };
}

// ---------- Sections de la progression (couplet, refrain, etc.) ----------
// Stockage : { sections: [ { title, chords: [...] }, ... ] }
function loadProgressionSections() {
    let raw;
    try { raw = JSON.parse(localStorage.getItem('myProgression')); } catch (e) { raw = null; }
    if (!raw) return [{ title: '', chords: [] }];
    if (Array.isArray(raw)) return [{ title: '', chords: raw }]; // migration : ancien format (tableau plat)
    if (Array.isArray(raw.sections) && raw.sections.length) return raw.sections;
    return [{ title: '', chords: [] }];
}

// Modifications du tampon de travail pas encore reportées dans le morceau enregistré (voir
// saveCurrentSong/Ctrl+S) — volontairement une variable de module (pas this.xxx) : les fonctions
// autonomes ci-dessous (appelées depuis de très nombreux endroits) doivent pouvoir la modifier sans
// dépendre de l'instance HarmoHubApp (pas encore construite au tout premier appel).
let hasUnsavedChanges = false;

// `markDirty=false` : chargement d'un morceau (neuf ou déjà enregistré), pas une modification —
// voir newSong/loadSong, les deux seuls appelants à passer false.
function saveProgressionSections(sections, markDirty = true) {
    localStorage.setItem('myProgression', JSON.stringify({ sections }));
    if (markDirty) hasUnsavedChanges = true;
}

// ---------- Morceaux (plusieurs chansons enregistrées séparément) ----------
// Le « tampon de travail » (myProgression, tonalité, tempo) représente le morceau ouvert, mais n'est
// PLUS recopié automatiquement dans le morceau enregistré à chaque modification (voir
// hasUnsavedChanges ci-dessus) : il faut explicitement Enregistrer (bouton dédié ou Ctrl+S, voir
// saveCurrentSong) pour que les changements soient vraiment sauvegardés.
const SONG_ID_KEY = 'harmohubCurrentSongId';

function loadSongs() {
    try { return JSON.parse(localStorage.getItem('harmohubSongs')) || []; } catch (e) { return []; }
}

function saveSongs(songs) {
    localStorage.setItem('harmohubSongs', JSON.stringify(songs));
}

function getCurrentSongId() {
    return localStorage.getItem(SONG_ID_KEY) || null;
}

function setCurrentSongId(id) {
    if (id) localStorage.setItem(SONG_ID_KEY, id);
    else localStorage.removeItem(SONG_ID_KEY);
}

// Registre des dossiers (fenêtre Paramètres > Fichiers) : une liste de noms, SÉPARÉE des morceaux,
// pour qu'un dossier puisse exister vide (créé à l'avance) plutôt que d'être uniquement déduit des
// morceaux qui s'y trouvent.
function loadFolders() {
    try { return JSON.parse(localStorage.getItem('harmohubFolders')) || []; } catch (e) { return []; }
}
function saveFolders(folders) {
    localStorage.setItem('harmohubFolders', JSON.stringify(folders));
}

// Options <option> pour un <select> de dossier (« Sans dossier » + dossiers existants triés + « +
// Nouveau dossier… ») — partagé par le panneau Fichiers (déplacer un morceau) et la modale Nouveau
// morceau (voir openNewSongModal), pour ne pas dupliquer cette liste à deux endroits.
function buildFolderOptionsHtml(current) {
    const folders = loadFolders().slice().sort((a, b) => a.localeCompare(b, 'fr'));
    let opts = `<option value=""${!current ? ' selected' : ''}>Sans dossier</option>`;
    folders.forEach(f => { opts += `<option value="${escapeHtml(f)}"${f === current ? ' selected' : ''}>${escapeHtml(f)}</option>`; });
    opts += `<option value="__new__">+ Nouveau dossier…</option>`;
    return opts;
}

// Recopie les champs donnés dans le morceau actuellement ouvert (aucun effet si aucun n'est ouvert)
function syncCurrentSong(partial) {
    const id = getCurrentSongId();
    if (!id) return;
    const songs = loadSongs();
    const song = songs.find(s => s.id === id);
    if (!song) return;
    Object.assign(song, partial, { savedAt: Date.now() });
    saveSongs(songs);
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Récapitulatif des notes d'un accord au-dessus du piano : sans octave (peu utile à ce niveau),
// une note = un « chip » séparé pour un espacement propre entre notes sans écarter les caractères
// à l'intérieur d'une même note (ex. le ♭ doit rester collé à sa lettre, voir .chord-note en CSS).
// Chaque note reprend la couleur de son rôle (fondamentale/tierce/quinte/7e/extension), en pâle —
// même code que le clavier/la légende (.dot-*), voir .chord-note.role-* en CSS.
function chordNotesHtml(chord, useFlats) {
    const rootPc = NOTES.indexOf(chord.root);
    return chord.getVoiced().map(v => {
        const text = spellChordTone(rootPc, useFlats, v.degree, v.midi, false);
        return `<span class="chord-note role-${v.role}">${flatTight(text)}</span>`;
    }).join('');
}

// Le ♭ a une chasse large dans la police de l'appli et paraît détaché de sa lettre, surtout au
// grand format du titre : on l'entoure d'un span resserré (voir .flat en CSS). Chord.getLabel()
// reste du texte brut (utilisé aussi dans l'export PDF/la grille, où le HTML n'a pas sa place) —
// ce resserrement n'est appliqué qu'à l'affichage du grand titre et de la liste de notes.
function flatTight(text) {
    return text.replace(/♭/g, '<span class="flat">♭</span>');
}

// ---------- Séquenceur pas-à-pas ----------
// Résolution du séquenceur : 4 cases par temps (double-croche). Le nombre de cases suit donc
// toujours la durée de l'accord (1 mesure = 4 temps = 16 double-croches). Visuellement, les cases
// restent groupées par paires de la largeur d'une croche (voir renderSequencer/.seq-cell-a/b) —
// seule la note posée par-dessus peut s'arrêter à la moitié d'un de ces rectangles pour simuler
// une double-croche, sans multiplier le nombre de rectangles visibles.
const SEQ_STEPS_PER_BEAT = 4;

// ---------- Notes libres du séquenceur : seuils avant de renommer l'accord ----------
// Une note libre (voir addSequencerNote) ne renomme l'accord (voir reevaluateExtraNoteUpgrades) que
// si elle est réellement JOUÉE assez longtemps — une note de passage furtive ne doit jamais renommer
// l'accord, même si sa hauteur complète pile une qualité reconnue. Deux façons de "compter", au
// choix de la manière dont elle est jouée (voir seqVoiceCoverage) :
// - tenue en continu (liée) au moins SEQ_HELD_MIN_STEPS cases d'affilée -> clairement une vraie voix
//   soutenue de l'accord, peu importe le reste du motif ;
// - à défaut, en détaché/staccato (plusieurs attaques courtes séparées) -> il en faut BEAUCOUP plus,
//   couvrant au moins SEQ_STACCATO_MIN_COVERAGE de la durée totale de l'accord, pour distinguer un
//   martèlement voulu (vraie voix) d'une simple broderie ponctuelle.
// Réglages à affiner si besoin : 4 cases = 1 temps plein tenu ; 0.5 = la moitié de l'accord au moins.
const SEQ_HELD_MIN_STEPS = SEQ_STEPS_PER_BEAT; // 1 temps plein tenu en continu
const SEQ_STACCATO_MIN_COVERAGE = 0.5; // 50% de la durée totale, même en attaques séparées

// Compte, pour une voix donnée, ses cases actives au total et sa plus longue série de cases LIÉES
// consécutives (une même note tenue) — voir reevaluateExtraNoteUpgrades.
function seqVoiceCoverage(pattern, tie, voiceIndex) {
    let onSteps = 0, longestRun = 0, currentRun = 0;
    for (let s = 0; s < pattern.length; s++) {
        const isOn = pattern[s].includes(voiceIndex);
        if (isOn) {
            onSteps++;
            const continuesPrev = s > 0 && pattern[s - 1].includes(voiceIndex) && tie[s].includes(voiceIndex);
            currentRun = continuesPrev ? currentRun + 1 : 1;
        } else {
            currentRun = 0;
        }
        if (currentRun > longestRun) longestRun = currentRun;
    }
    return { onSteps, totalSteps: pattern.length, longestRun };
}

// Une voix est-elle jouée assez longtemps pour compter comme une vraie voix de l'accord (voir les
// seuils ci-dessus) ? Tenue assez longtemps EN CONTINU, ou à défaut assez de couverture totale
// (staccato).
function seqCoverageQualifies(cov) {
    if (cov.longestRun >= SEQ_HELD_MIN_STEPS) return true;
    return cov.totalSteps > 0 && (cov.onSteps / cov.totalSteps) >= SEQ_STACCATO_MIN_COVERAGE;
}

// ---------- Groove (droit / shuffle / ternaire) ----------
// La grille du séquenceur reste TOUJOURS affichée droite (comme dans la plupart des séquenceurs/DAW) :
// le groove ne change rien à son édition, seulement l'instant réel où chaque case tombe à la lecture
// et dans l'export MIDI. Le swing/shuffle « classique » agit au niveau de la CROCHE, pas de la double-
// croche : dans un temps (SEQ_STEPS_PER_BEAT = 4 cases), la 1ère croche (cases 0-1) garde sa durée
// normale et la 2nde (cases 2-3) est repoussée plus tard — 0.5 = coupé en deux également (droit, aucun
// effet), 2/3 = triolet strict (1ère croche deux fois plus longue que la 2nde), valeurs intermédiaires
// = shuffle plus léger. C'est important : Tenu/Ronde/Blanche/Noire/Croche (les préréglages du volet
// Lecture) ne déclenchent jamais une attaque à la double-croche — seule une croche « en retard »
// rendrait le groove audible sur ces préréglages, pas une double-croche « en retard ». Chaque double-
// croche à l'intérieur d'une croche garde sa position relative (moitié du temps qui lui est imparti),
// et chaque temps (case d'index multiple de SEQ_STEPS_PER_BEAT) tombe toujours pile à sa place.
const GROOVE_RATIOS = { straight: 0.5, shuffle: 0.58, ternary: 2 / 3 };
function grooveStepOffset(step, unitDur, ratio) {
    const eighthSteps = SEQ_STEPS_PER_BEAT / 2; // cases par croche (2)
    const beatIndex = Math.floor(step / SEQ_STEPS_PER_BEAT);
    const beatStart = beatIndex * SEQ_STEPS_PER_BEAT * unitDur;
    const local = step - beatIndex * SEQ_STEPS_PER_BEAT;       // position dans le temps (0..3)
    const eighthIndex = Math.floor(local / eighthSteps);        // 0 = 1ère croche, 1 = 2nde croche
    const withinEighth = (local - eighthIndex * eighthSteps) / eighthSteps; // fraction dans sa croche
    const firstEighthDur = ratio * SEQ_STEPS_PER_BEAT * unitDur;
    const eighthStart = eighthIndex === 0 ? 0 : firstEighthDur;
    const eighthDur = eighthIndex === 0 ? firstEighthDur : (SEQ_STEPS_PER_BEAT * unitDur - firstEighthDur);
    return beatStart + eighthStart + withinEighth * eighthDur;
}

// Intensité par défaut d'un accord (voir data.intensity) : choisie pour représenter EXACTEMENT le
// comportement automatique déjà existant (tenu=1, temps=0.78-0.88, contretemps=0.6-0.72) sans aucun
// changement de son sur les accords déjà créés avant cette fonctionnalité (retour utilisateur) — le
// multiplicateur ci-dessous vaut 1 pile à 75%, jamais une coïncidence.
const DEFAULT_INTENSITY = 75;

// Vélocité (0-1) d'une note du séquenceur : reprend l'aléa automatique existant (tenue/temps/
// contretemps, voir schedulePlayback/buildMidiFile/renderProgressionBuffer) comme base, PUIS applique
// l'intensité choisie par l'utilisateur comme un multiplicateur PAR-DESSUS plutôt qu'un remplacement
// (retour utilisateur : garder un peu d'aléa "joué" même une fois l'intensité réglée à la main).
// `intensityPercent` : intensité globale de l'accord (data.intensity, DEFAULT_INTENSITY si absente).
// `stepOverride` : réglage précis du mode studio pour CETTE croche (data.intensityPerStep[runStart]),
// prioritaire sur intensityPercent quand présent. Bornée à [0,1] : un accord déjà tenu (base=1) ne
// peut pas sonner plus fort qu'un accord à vélocité MIDI maximale, quelle que soit l'intensité choisie.
function computeVelocity(held, onBeat, intensityPercent, stepOverride) {
    const base = held ? 1 : (onBeat ? 0.78 + Math.random() * 0.1 : 0.6 + Math.random() * 0.12);
    const percent = (stepOverride != null) ? stepOverride : (intensityPercent != null ? intensityPercent : DEFAULT_INTENSITY);
    const mult = percent / DEFAULT_INTENSITY;
    return Math.max(0, Math.min(1, base * mult));
}

// Motif = tableau (une entrée par case) de listes de voix actives (index dans l'accord, grave=0).
// Liaisons (tie) = pour chaque case, la liste des voix qui PROLONGENT la note de la case précédente
// au lieu de déclencher une nouvelle attaque : deux croches actives et adjacentes ne forment une
// seule note tenue que si la seconde est explicitement liée (glissé) — deux clics séparés sur des
// croches voisines restent deux notes distinctes rejouées, même côte à côte.
// Sérialisé en chaîne "0,1,2;;1t;..." (cases séparées par ';', voix séparées par ',', "t" = liée).
function parseSeqPattern(str) {
    if (!str) return { pattern: [], tie: [] };
    if (!str.includes(';')) {
        // Compatibilité avec le tout premier format (une seule voix par case, -1 = silence, jamais liée)
        const pattern = str.split(',').map(x => parseInt(x, 10)).map(v => (!isNaN(v) && v >= 0) ? [v] : []);
        return { pattern, tie: pattern.map(() => []) };
    }
    const pattern = [], tie = [];
    str.split(';').forEach(seg => {
        if (seg === '') { pattern.push([]); tie.push([]); return; }
        const voices = [], tied = [];
        seg.split(',').forEach(tok => {
            if (tok === '') return;
            const isTied = tok.endsWith('t');
            const v = parseInt(isTied ? tok.slice(0, -1) : tok, 10);
            if (isNaN(v)) return;
            voices.push(v);
            if (isTied) tied.push(v);
        });
        pattern.push(voices);
        tie.push(tied);
    });
    return { pattern, tie };
}

function serializeSeqPattern(pattern, tie) {
    return pattern.map((voices, s) => voices.map(v => (tie[s] || []).includes(v) ? `${v}t` : `${v}`).join(',')).join(';');
}

// Ajuste un motif à la durée/voix courantes : tronque s'il est devenu trop long, ou le RÉPÈTE en
// boucle s'il est devenu trop court (ex. un accord tenu qu'on étire de 1 à 4 mesures continue de
// sonner sur toute sa durée, au lieu de laisser les mesures ajoutées totalement silencieuses — c'est
// ce second cas qui produisait un séquenceur apparemment « mort » au-delà de la longueur d'origine).
// Retire aussi les voix devenues hors plage (ex. accord passé de tétrade à triade).
function resizeSeqPattern(pattern, tie, steps, voices) {
    const srcLen = pattern.length;
    const outP = [], outT = [];
    for (let i = 0; i < steps; i++) {
        const srcIdx = srcLen > 0 ? (i % srcLen) : i;
        const v = (pattern[srcIdx] || []).filter(x => x >= 0 && x < voices);
        outP.push(v);
        outT.push((tie[srcIdx] || []).filter(x => v.includes(x)));
    }
    return { pattern: outP, tie: outT };
}

// Les `voiceCount` premières voix jouent-elles TOUTES exactement le même schéma (mêmes cases actives,
// mêmes liaisons) ? Sert à décider comment initialiser une voix qui vient d'apparaître (voir
// applyNewVoiceDefaults ci-dessous) — ex. min -> min7, la 7te ajoutée n'a par définition aucune case
// peinte, encore faut-il choisir quoi y mettre par défaut.
function seqPatternIsUniformAcrossVoices(pattern, tie, voiceCount) {
    if (voiceCount <= 1) return true;
    const profileFor = (v) => pattern.map((s, i) => (s.includes(v) ? '1' : '0') + ((tie[i] || []).includes(v) ? '1' : '0')).join('');
    const first = profileFor(0);
    for (let v = 1; v < voiceCount; v++) {
        if (profileFor(v) !== first) return false;
    }
    return true;
}

// Règle fixée par l'utilisateur pour une voix qui vient d'apparaître dans un accord déjà personnalisé
// (motif peint à la main, pas un simple préréglage — voir syncSeqPatternForCurrentChord) suite à un
// changement qui ajoute une note (ex. qualité min -> min7, la 7te est neuve) : plutôt que la laisser
// muette par défaut (ce que ferait resizeSeqPattern seul, qui ne fait QUE filtrer/répéter, jamais
// inventer une voix) —
//   - si les voix déjà là jouent toutes exactement le même schéma, la voix ajoutée suit ce même schéma ;
//   - sinon (rythmes différents d'une voix à l'autre), elle tient une seule note sur toute la durée de
//     l'accord (plus simple à corriger ensuite qu'un silence total).
// `prevVoices` : nombre de voix tel qu'il était la dernière fois que ce motif a été synchronisé (voir
// this.seqLastVoices) — pas de règle à appliquer si les voix n'ont pas grandi depuis (qualité réduite,
// ou nombre de voix inchangé).
function applyNewVoiceDefaults(pattern, tie, prevVoices, voices) {
    if (!(prevVoices > 0) || voices <= prevVoices) return { pattern, tie };
    const uniform = seqPatternIsUniformAcrossVoices(pattern, tie, prevVoices);
    const outP = pattern.map(s => s.slice());
    const outT = tie.map((s, i) => (s || []).slice());
    for (let v = prevVoices; v < voices; v++) {
        for (let s = 0; s < outP.length; s++) {
            const on = uniform ? pattern[s].includes(0) : true;
            if (!on) continue;
            outP[s].push(v);
            const tied = uniform ? (tie[s] || []).includes(0) : (s !== 0);
            if (tied) outT[s].push(v);
        }
    }
    return { pattern: outP, tie: outT };
}

// Durée d'une pulsation, en cases (double-croches), pour chaque préréglage rythmique — indépendante
// de son articulation (maintenu/staccato, voir seqPreset ci-dessous).
const PRESET_PULSE_STEPS = { ronde: 16, blanche: 8, noire: 4, croche: 2 };

// Motifs-types selon le style de lecture, servant de point de départ (modifiable ensuite case par
// case). Deux familles au-delà de « held »/« arpeggio » : un nom de préréglage rythmique combine une
// PULSATION (ronde/blanche/noire/croche) et une ARTICULATION (maintenu/staccato), ex. "noire_staccato"
//   - maintenu  : actif en continu sur toute la durée, mais une nouvelle attaque (non liée) à chaque
//                 pulsation -> son soutenu, sans silence, qui « repique » à intervalles réguliers.
//   - staccato  : une seule croche active (courte, détachée) à chaque pulsation, silence le reste du
//                 temps -> notes brèves façon coup d'archet.
function seqPreset(kind, voices, steps) {
    const allVoices = Array.from({ length: voices }, (_, v) => v);
    if (kind === 'pulsed') kind = 'noire_staccato'; // ancien nom (accords sauvegardés avant ce préréglage)
    if (kind === 'held') {
        // L'accord est tenu sur toute sa durée : toutes les voix actives et liées entre elles,
        // sauf la toute première croche qui déclenche l'attaque initiale
        const pattern = Array.from({ length: steps }, () => allVoices.slice());
        const tie = pattern.map((_, s) => s === 0 ? [] : allVoices.slice());
        return { pattern, tie };
    }
    const [rate, articulation] = kind.split('_');
    const pulse = PRESET_PULSE_STEPS[rate];
    if (pulse) {
        if (articulation === 'staccato') {
            const pattern = Array.from({ length: steps }, (_, s) => (s % pulse === 0) ? allVoices.slice() : []);
            return { pattern, tie: pattern.map(() => []) };
        }
        // maintenu : actif en continu, une nouvelle attaque (non liée) à chaque pulsation seulement
        const pattern = Array.from({ length: steps }, () => allVoices.slice());
        const tie = pattern.map((_, s) => (s % pulse === 0) ? [] : allVoices.slice());
        return { pattern, tie };
    }
    // 'arpeggio', 'clear', ou tout autre cas : pas de pré-remplissage, l'arpège se saisit à la main
    const pattern = Array.from({ length: steps }, () => []);
    return { pattern, tie: pattern.map(() => []) };
}

// Chiffrage romain : degré diatonique de base (I, bII, II...) et qualité naturelle de chaque degré
// (majeur/mineur/diminué) dans un ton majeur ou mineur — sert à nommer la cible d'une dominante
// secondaire (le « V » dans « V7/V ») avec la bonne casse.
// Deux tables séparées par mode : en mineur naturel, III/VI/VII (relative majeure, sus-médiante,
// sous-tonique) sont des degrés DIATONIQUES et ne prennent donc pas de bémol — contrairement à un
// ton majeur, où ces mêmes intervalles sont chromatiques (empruntés à la mineure parallèle). Seuls
// bII (napolitain) et bV restent chromatiques dans les deux modes. #III et #VI (médiante et
// sus-dominante haussées, très rares) complètent la table par cohérence — de même pour #VII (sensible
// haussée du mineur harmonique/mélodique), à ne pas confondre avec la sous-tonique diatonique (VII,
// demi-ton 10) : sans ce préfixe, les deux degrés se retrouveraient chiffrés à l'identique.
const MAJOR_ROMAN_MAP = { 0: 'I', 1: 'bII', 2: 'II', 3: 'bIII', 4: 'III', 5: 'IV', 6: 'bV', 7: 'V', 8: 'bVI', 9: 'VI', 10: 'bVII', 11: 'VII' };
const MINOR_ROMAN_MAP = { 0: 'I', 1: 'bII', 2: 'II', 3: 'III', 4: '#III', 5: 'IV', 6: 'bV', 7: 'V', 8: 'VI', 9: '#VI', 10: 'VII', 11: '#VII' };
const MAJOR_DEGREE_QUALITY = { 0: 'maj', 2: 'min', 4: 'min', 5: 'maj', 7: 'maj', 9: 'min', 11: 'dim' };
const MINOR_DEGREE_QUALITY = { 0: 'min', 2: 'dim', 3: 'maj', 5: 'min', 7: 'min', 8: 'maj', 10: 'maj', 11: 'dim' };

// Pour les 5 autres modes, table/qualité par degré dérivées automatiquement de MODE_SCALES (tierces
// empilées À L'INTÉRIEUR de la gamme du mode) plutôt que recopiées à la main comme majeur/mineur
// ci-dessus : le degré i de la gamme donne sa tierce en scale[i+2] et sa quinte en scale[i+4]
// (modulo 7, +12 s'il y a un tour de gamme), dont l'écart en demi-tons avec la tonique du degré fixe
// la qualité (majeur/mineur/diminué/augmenté). Les degrés hors gamme (chromatiques) sont nommés par
// bémol du degré diatonique immédiatement au-dessus (même convention que majeur/mineur pour bII/bV).
const ROMAN_NUMERALS_PLAIN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
function buildModeRomanTables(scale) {
    const ext = scale.concat(scale.map(s => s + 12));
    const romanMap = {}, qualityMap = {};
    for (let i = 0; i < 7; i++) {
        const t3 = ext[i + 2] - ext[i], t5 = ext[i + 4] - ext[i];
        let quality = 'min';
        if (t3 === 4 && t5 === 7) quality = 'maj';
        else if (t3 === 3 && t5 === 6) quality = 'dim';
        else if (t3 === 4 && t5 === 8) quality = 'aug';
        else if (t3 === 3 && t5 === 7) quality = 'min';
        romanMap[scale[i]] = ROMAN_NUMERALS_PLAIN[i];
        qualityMap[scale[i]] = quality;
    }
    for (let semi = 0; semi < 12; semi++) {
        if (romanMap[semi] != null) continue;
        let above = semi;
        while (romanMap[above % 12] == null) above++;
        romanMap[semi] = 'b' + romanMap[above % 12];
    }
    return { romanMap, qualityMap };
}
const MODE_ROMAN_TABLES = {
    maj: { romanMap: MAJOR_ROMAN_MAP, qualityMap: MAJOR_DEGREE_QUALITY },
    min: { romanMap: MINOR_ROMAN_MAP, qualityMap: MINOR_DEGREE_QUALITY }
};
['dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'].forEach(mode => {
    MODE_ROMAN_TABLES[mode] = buildModeRomanTables(MODE_SCALES[mode]);
});

function romanMapFor(keyMode) {
    return (MODE_ROMAN_TABLES[keyMode] || MODE_ROMAN_TABLES.maj).romanMap;
}

function diatonicNumeralFor(diff, keyMode) {
    const tables = MODE_ROMAN_TABLES[keyMode] || MODE_ROMAN_TABLES.maj;
    let numeral = tables.romanMap[diff];
    const quality = tables.qualityMap[diff];
    if (quality === 'min' || quality === 'dim') numeral = numeral.toLowerCase();
    if (quality === 'dim') numeral += '°';
    return numeral;
}

class Chord {
    constructor(root, quality, beats, inversion, drop, octave = 3, bass = null, guitarLock = null, extraNotes = null) {
        this.root = root;
        this.quality = quality;
        this.beats = parseInt(beats); // durée en temps
        this.octave = parseInt(octave); // octave de base (3 = C3)
        this.inversion = parseInt(inversion);
        this.drop = drop;
        this.bass = bass || null; // note de basse différente de la fondamentale (ex. "D" sur un Cmaj7/D), ou null
        // Doigté guitare verrouillé par l'utilisateur (case par corde, `null` = corde étouffée), ou
        // null si laissé au choix automatique — voir guitarFingeringsForChord/toggleGuitarLock.
        this.guitarLock = guitarLock || null;
        // Notes ajoutées librement au séquenceur ({note, octave}), en plus des voix de la qualité —
        // typiquement des notes de passage vers l'accord suivant, sans rapport avec l'accord joué
        // (voir addSequencerNote/commitExtraNoteLabel). Si l'une d'elles complète exactement une
        // AUTRE qualité reconnue, elle est absorbée dans `quality` au lieu de rester ici — voir
        // commitExtraNoteLabel.
        this.extraNotes = extraNotes || [];
    }

    getIntervals() {
        // .map() -> on ne mute jamais les objets de référence de CHORD_INTERVALS
        return (CHORD_INTERVALS[this.quality] || CHORD_INTERVALS.maj).map(n => ({ ...n }));
    }

    // Un renversement au-delà du nombre de notes n'a pas de sens (ex. 3e renv. sur une triade) :
    // on le limite au dernier renversement possible pour cet accord.
    getEffectiveInversion() {
        return Math.min(this.inversion, this.getIntervals().length - 1);
    }

    // Notes voisées, avec leur fonction (role) et leur degré (pour l'orthographe) conservés à
    // travers renversements et drops. Triée du grave à l'aigu — l'ordre attendu partout où l'affichage
    // seul compte (clavier, PDF, libellés). Pour le séquenceur, qui STOCKE ses motifs par index de
    // voix, voir plutôt getSeqVoices()/_computeVoices() : leur ordre reste stable même quand une basse
    // différente est activée/désactivée, ce que ce tri par hauteur ne garantit pas (voir plus bas).
    getVoiced() {
        return this._computeVoices().sort((a, b) => a.midi - b.midi);
    }

    // Même voicing que getVoiced(), mais SANS le tri final par hauteur : la basse (si présente) reste
    // en dernière position (son ajout n'est qu'un push, voir plus bas), donc l'index d'une voix du
    // CORPS de l'accord (fondamentale/tierce/quinte/7e...) ne dépend jamais de la présence ou non
    // d'une basse différente. Sert exclusivement au séquenceur (voir getSeqVoices), qui STOCKE ses
    // motifs par index de voix : avec getVoiced() (triée), ajouter une basse insère une nouvelle voix
    // la plus grave en TÊTE de tableau et décale l'index de toutes les voix existantes d'un cran —
    // exactement le bug observé (motif/couleurs qui se décalent d'une voix quand la basse est activée).
    _computeVoices() {
        let notes = this.getIntervals();

        const inversion = this.getEffectiveInversion();
        for (let i = 0; i < inversion; i++) {
            const n = notes.shift();
            n.semi += 12;
            notes.push(n);
        }

        // Drop 2 : descend d'une octave la 2e voix en partant du haut. Drop 3 : la 3e voix en
        // partant du haut (sur une triade, c'est alors la voix la plus grave qui descend).
        // Définition purement positionnelle : elle reste valable sur les accords enrichis (9e/11e/
        // 13e) et correspond à un usage réel en jazz (ex. drop 2 sur un accord de 9e, courant en
        // arrangement guitare/piano) — pas besoin de la réserver aux triades/tétrades.
        if (notes.length >= 3) {
            if (this.drop === 'drop2') {
                const [n] = notes.splice(notes.length - 2, 1);
                n.semi -= 12;
                notes.unshift(n);
            } else if (this.drop === 'drop3') {
                const [n] = notes.splice(notes.length - 3, 1);
                n.semi -= 12;
                notes.unshift(n);
            }
        }

        const rootMidi = NOTES.indexOf(this.root) + 12 * (this.octave + 1); // octave 3 -> C3 = 48
        const voiced = notes.map(n => ({ midi: rootMidi + n.semi, role: n.role, degree: n.degree }));

        // Notes libres ajoutées au séquenceur (voir addSequencerNote) : hauteur ABSOLUE (note+octave
        // tels que tapés, pas relatifs à rootMidi comme les voix ci-dessus) — ajoutées ICI, avant la
        // basse, pour que leur index de voix reste stable même si la basse est activée/désactivée
        // ensuite (voir getSeqVoices, même raisonnement que pour la basse juste en dessous). Rôle/
        // degré empruntés à la voix de l'accord qui partage leur classe de hauteur, s'il y en a une
        // (ex. doubler la tierce une octave plus haut reste bleu) — sinon note « étrangère » (violet,
        // orthographe générique), typiquement une note de passage sans rapport avec l'accord joué.
        this.extraNotes.forEach(x => {
            const midi = NOTES.indexOf(x.note) + 12 * (x.octave + 1);
            const relPc = ((NOTES.indexOf(x.note) - NOTES.indexOf(this.root)) % 12 + 12) % 12;
            const match = notes.find(n => ((n.semi % 12) + 12) % 12 === relPc);
            voiced.push({ midi, role: match ? match.role : 'ext', degree: match ? match.degree : null });
        });

        // Basse différente (accord « sur » une note, ex. Cmaj7/D) : ajoutée SOUS la voix la plus
        // grave actuelle, sans toucher au reste du voicing (renversement/drop restent ceux définis
        // par ailleurs pour les voix du dessus). Sa fonction (rôle/degré, donc sa couleur et son
        // orthographe) suit celle de la note de l'accord qui partage sa classe de hauteur — ex. un Mi
        // en basse sur un Cmaj7 est sa tierce, pas sa fondamentale. Si aucune voix de l'accord ne
        // partage cette classe de hauteur (note réellement étrangère à l'accord, ex. Cmaj7/D), elle
        // est traitée comme une extension (« Autres » dans la légende), orthographiée génériquement.
        if (this.bass) {
            const lowestMidi = Math.min(...voiced.map(v => v.midi));
            let bassMidi = NOTES.indexOf(this.bass) + 12 * (this.octave + 1);
            while (bassMidi >= lowestMidi) bassMidi -= 12;
            const bassSemi = ((NOTES.indexOf(this.bass) - NOTES.indexOf(this.root)) % 12 + 12) % 12;
            const match = notes.find(n => ((n.semi % 12) + 12) % 12 === bassSemi);
            voiced.push({ midi: bassMidi, role: match ? match.role : 'ext', degree: match ? match.degree : null });
        }

        return voiced;
    }

    // Numéros MIDI, triés du plus grave au plus aigu
    getMidiNotes() {
        return this.getVoiced().map(v => v.midi);
    }

    // ---- Variantes « séquenceur » : mêmes notes, ordre STABLE de _computeVoices() (voir plus haut)
    // au lieu de l'ordre trié par hauteur — à utiliser PARTOUT où un index de voix est apparié à un
    // motif du séquenceur (pattern/tie stockés par index), jamais pour un simple affichage isolé.
    getSeqVoices() {
        return this._computeVoices();
    }

    getSeqMidiNotes() {
        return this._computeVoices().map(v => v.midi);
    }

    getSeqNotes() {
        return this._computeVoices().map(v => Tone.Frequency(v.midi, "midi").toNote());
    }

    getSeqDisplayNotes(useFlats = false, withOctave = true) {
        const rootPc = NOTES.indexOf(this.root);
        return this._computeVoices().map(v => spellChordTone(rootPc, useFlats, v.degree, v.midi, withOctave));
    }

    // { 60: "root", 64: "third", ... } pour colorer le clavier (indexé par MIDI, indépendant de l'orthographe)
    getRoleMap() {
        const map = {};
        this.getVoiced().forEach(v => {
            map[v.midi] = v.role;
        });
        return map;
    }

    // Suffixe renversement/drop seul (ex. "1er renv. · Drop 2", '' si voicing de base) : version
    // longue, utilisée par getLabel() (aperçu, séquenceur...) — voir getVoicingBadge pour la notation
    // compacte du PDF exporté.
    getVoicingSuffix() {
        const parts = [];
        const inv = this.getEffectiveInversion();
        if (inv === 1) parts.push('1er renv.');
        if (inv === 2) parts.push('2e renv.');
        if (inv === 3) parts.push('3e renv.');
        if (this.drop === 'drop2') parts.push('Drop 2');
        if (this.drop === 'drop3') parts.push('Drop 3');
        return parts.join(' · ');
    }

    // Notation compacte octave/renversement/drop pour le PDF exporté (voir buildPrintExportHtml,
    // réglage Affichage > Position d'accord PDF) : "O{octave}" toujours présent (l'octave reste une
    // information utile même en position de base), complété par "-R{n}"/"-D{n}" seulement si l'accord
    // s'écarte de la position de base — ex. "O3", "O4-R1", "O3-R2-D2".
    getVoicingBadge() {
        const parts = [`O${this.octave}`];
        const inv = this.getEffectiveInversion();
        if (inv > 0) parts.push(`R${inv}`);
        if (this.drop === 'drop2') parts.push('D2');
        if (this.drop === 'drop3') parts.push('D3');
        return parts.join('-');
    }

    // Symbole SANS renversement/drop, ex : "Cmaj7/Ré" — voir getVoicingSuffix pour cette partie à
    // part, et getLabel() qui recombine les deux pour l'affichage habituel (aperçu, séquenceur...).
    getBareLabel(useFlats = false) {
        let sym = noteNameForPc(NOTES.indexOf(this.root), useFlats) + (QUALITY_LABEL[this.quality] ?? '');
        if (this.bass) sym += '/' + noteNameForPc(NOTES.indexOf(this.bass), useFlats);
        return sym;
    }

    // Symbole complet, ex : "Cmaj7/Ré · 2e renv. · Drop 2"
    getLabel(useFlats = false) {
        const suffix = this.getVoicingSuffix();
        return suffix ? `${this.getBareLabel(useFlats)} · ${suffix}` : this.getBareLabel(useFlats);
    }
}

// ---------- Diagrammes guitare ----------
// Couleurs par fonction, partagées entre le clavier et les diagrammes (piano/guitare) exportés en
// PDF — mêmes rôles que .key.active.role-* dans le CSS (repris ici en dur car ce fichier n'a pas
// accès aux styles calculés pour construire du SVG à l'export).
const ROLE_COLOR = { root: '#00c853', third: '#2f81f7', fifth: '#e53922', seventh: '#ff9800', ext: '#8bd6a8' };

// Dégradés « perlés » (clair -> teinte -> foncé) des points de doigté guitare EN DIRECT (voir
// buildGuitarDiagramSVG) — même principe que les touches actives du piano (.key.active.role-* dans
// style.css), pour un rendu plus joli qu'un simple disque plat. Pas utilisés à l'export PDF
// (forPrint) : l'encre sur papier reste en aplat ROLE_COLOR, plus fiable à l'impression qu'un dégradé.
const ROLE_GRADIENT_STOPS = {
    root:    ['#7dffc2', '#00e676', '#00a855'],
    third:   ['#7fb2ff', '#2f81f7', '#1f5fc0'],
    fifth:   ['#ff8f87', '#ff3b30', '#d42a20'],
    seventh: ['#ffd166', '#ffb300', '#cc8f00'],
    ext:     ['#f0d4ff', '#e0b0ff', '#c48ce6'],
};
let guitarSvgIdSeq = 0; // suffixe unique par diagramme, pour ne jamais dupliquer un id de <radialGradient> quand plusieurs schémas cohabitent dans la page (ex. export PDF, plusieurs doigtés)

// Détecte un barré POUR L'AFFICHAGE (un doigt à plat sur plusieurs cordes à la case la plus basse
// de la forme). Un barré n'est réellement la façon la plus commune de jouer une forme QUE lorsqu'il
// est nécessaire, c'est-à-dire quand il y a plus de cases différentes à tenir que de doigts
// disponibles (4) : en-dessous de ce seuil, un guitariste pose un doigt par corde, même si 2-3 cordes
// se retrouvent par coïncidence à la même case (ex. La ouvert x02220 : Ré/Sol/Si à la case 2, joués
// avec 3 doigts séparés, jamais un mini-barré ; Ré ouvert xx0232 : Sol et Mi aigu à la case 2 avec un
// 3e doigt sur Si à la case 3 entre les deux, jamais un barré non plus). Ce seuil ne concerne QUE cet
// affichage — voir fingersNeeded (dans solveGuitarFingerings) qui, lui, préfère déjà un barré dès que
// c'est possible pour évaluer la difficulté d'un doigté, une hypothèse plus prudente utile au tri mais
// trop permissive pour décider si on DESSINE un barré. Une fois le barré jugé nécessaire, la
// compatibilité géométrique reste la même : seule une corde à VIDE entre les deux cordes extrêmes du
// groupe à la case la plus basse est réellement incompatible avec un barré continu à cet endroit
// (d'autres doigts peuvent presser PAR-DESSUS à une case plus haute sur des cordes intermédiaires,
// cas réel du Fa en forme de Mi). Fonction autonome, jamais utilisée par le solveur de doigtés
// lui-même. Renvoie {fret, loString, hiString} ou null.
// Chemin SVG d'un rectangle aux coins du BAS arrondis, coins du haut carrés (voir buildPianoDiagramSVG) :
// un simple <rect rx> arrondirait les 4 coins, donnant à chaque touche un air de pastille plutôt que
// de sortir du clavier — exactement ce qu'évite .key.white/.key.black (border-radius: 0 0 Xpx Xpx)
// à l'écran, reproduit ici en SVG puisque le PDF n'a pas accès aux classes CSS de l'appli.
function roundedBottomRectPath(x, y, w, h, r) {
    return `M${x},${y} H${x + w} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x + r} Q${x},${y + h} ${x},${y + h - r} Z`;
}

function detectBarre(byString) {
    const fretted = [];
    byString.forEach((e, s) => { if (e && e.fret > 0) fretted.push({ s, fret: e.fret }); });
    if (fretted.length <= GUITAR_MAX_FINGERS) return null; // jouable un doigt par case, barré pas nécessaire
    const minFret = Math.min(...fretted.map(f => f.fret));
    const atMin = fretted.filter(f => f.fret === minFret);
    if (atMin.length < 2) return null;
    const strs = atMin.map(f => f.s);
    const loString = Math.min(...strs), hiString = Math.max(...strs);
    for (let s = loString; s <= hiString; s++) {
        const e = byString[s];
        if (e && e.fret === 0) return null; // corde à vide entre les deux : pas de vrai barré ici
    }
    return { fret: minFret, loString, hiString };
}

// Accordage standard, du 6e (Mi grave) au 1er (Mi aigu), en numéros MIDI
const GUITAR_OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const GUITAR_MAX_FRET = 15;   // au-delà, une position n'est plus vraiment utilisée en pratique
const GUITAR_MAX_SPAN = 4;    // écart max (en cases) entre la case la plus basse et la plus haute jouées
const GUITAR_MAX_FINGERS = 4; // 4 doigts disponibles ; une case commune à plusieurs cordes ne compte
                               // que pour un seul doigt (barré)

// Cherche tous les doigtés qui reproduisent EXACTEMENT les notes du voicing donné (mêmes hauteurs,
// pas seulement mêmes classes de note - un accord est fait pour être joué tel quel, pas approximé)
// sur un manche accordé standard. Retourne un tableau (longueur <= limit) trié du doigté le plus
// facile/courant (position basse, peu de doigts, cordes à vide) au plus difficile ; chaque doigté
// est un tableau de 6 cases (index 0 = corde de Mi grave ... 5 = Mi aigu), chacune soit `null`
// (corde étouffée), soit `{ fret, midi, role }`. Tableau vide si aucun doigté n'est jouable.
function solveGuitarFingerings(voiced, limit = 4) {
    if (!voiced.length || voiced.length > 6) return [];

    // Cordes candidates pour chaque note (celles où sa hauteur tombe sur une case valide)
    const candidates = voiced.map(v => {
        const opts = [];
        GUITAR_OPEN_MIDI.forEach((open, string) => {
            const fret = v.midi - open;
            if (fret >= 0 && fret <= GUITAR_MAX_FRET) opts.push({ string, fret });
        });
        return opts;
    });
    if (candidates.some(opts => opts.length === 0)) return []; // note hors de portée de la guitare

    // Notes les plus contraintes (moins d'options) en premier, pour couper court plus vite
    const order = voiced.map((_, i) => i).sort((a, b) => candidates[a].length - candidates[b].length);

    const results = [];
    const usedStrings = new Set();
    const assignment = new Array(voiced.length).fill(null);
    (function backtrack(k) {
        if (k === order.length) { results.push(assignment.slice()); return; }
        const i = order[k];
        for (const { string, fret } of candidates[i]) {
            if (usedStrings.has(string)) continue;
            usedStrings.add(string);
            assignment[i] = { string, fret, midi: voiced[i].midi, role: voiced[i].role };
            backtrack(k + 1);
            usedStrings.delete(string);
            assignment[i] = null;
        }
    })(0);

    // Nombre de doigts requis pour tenir une forme (barré compris). Un barré n'est physiquement
    // possible qu'à la case la PLUS BASSE de la forme (technique réelle : l'index à plat) ET
    // seulement si aucune corde utilisée entre les deux cordes extrêmes du barré n'est prise à une
    // case différente (sinon le doigt à plat changerait aussi sa hauteur) — les cordes étouffées ou
    // à vide dans cet intervalle ne posent pas de problème. Toute autre case partagée par plusieurs
    // cordes (rare) est traitée prudemment comme des doigts séparés plutôt que comme un 2e barré.
    function fingersNeeded(byString) {
        const fretted = [];
        byString.forEach((e, s) => { if (e && e.fret > 0) fretted.push({ s, fret: e.fret }); });
        if (!fretted.length) return 0;
        const minFret = Math.min(...fretted.map(f => f.fret));
        const atMin = fretted.filter(f => f.fret === minFret);
        let barreOk = false;
        if (atMin.length >= 2) {
            const strs = atMin.map(f => f.s);
            const loS = Math.min(...strs), hiS = Math.max(...strs);
            barreOk = true;
            for (let s = loS; s <= hiS; s++) {
                const e = byString[s];
                if (e && e.fret > 0 && e.fret !== minFret) { barreOk = false; break; }
            }
        }
        const barreFingers = barreOk ? 1 : atMin.length;
        const others = fretted.filter(f => f.fret !== minFret).length;
        return barreFingers + others;
    }

    function score(byString) {
        const fretted = byString.filter(e => e && e.fret > 0);
        const openCount = byString.filter(e => e && e.fret === 0).length;
        if (!fretted.length) return { fingers: 0, span: 0, position: 0, openCount, valid: true };
        const frets = fretted.map(e => e.fret);
        const position = Math.min(...frets);
        const span = Math.max(...frets) - position;
        const fingers = fingersNeeded(byString);
        return { fingers, span, position, openCount, valid: fingers <= GUITAR_MAX_FINGERS && span <= GUITAR_MAX_SPAN };
    }

    const seen = new Set();
    const candidates2 = [];
    for (const fingering of results) {
        const byString = new Array(6).fill(null);
        fingering.forEach(f => { byString[f.string] = { fret: f.fret, midi: f.midi, role: f.role }; });
        const key = byString.map(e => e ? e.fret : 'x').join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        candidates2.push(byString);
    }

    return candidates2
        .map(byString => ({ byString, s: score(byString) }))
        .filter(r => r.s.valid)
        .sort((a, b) =>
            a.s.position - b.s.position ||
            a.s.fingers - b.s.fingers ||
            a.s.span - b.s.span ||
            b.s.openCount - a.s.openCount
        )
        .slice(0, limit)
        .map(r => r.byString);
}

// Formes ouvertes standard (celles apprises en tout premier, "école de musique") pour les tons qui
// ont une forme dédiée bien connue — D, G et C n'ont pas de forme mobile simple (contrairement à
// E/A ci-dessous), donc consignées telles quelles. E/A eux-mêmes n'ont pas besoin d'entrée ici : leur
// forme ouverte est simplement leur gabarit de barré (voir BARRE_TEMPLATES) posé à la case 0.
// Case par corde (grave -> aigu), `null` = corde étouffée. Vérifiées note à note contre les
// intervalles de l'accord (voir les commentaires de dérivation dans la conversation de conception).
const OPEN_SHAPES = {
    'D:maj':   [null, null, 0, 2, 3, 2],
    'D:min':   [null, null, 0, 2, 3, 1],
    'D:dom7':  [null, null, 0, 2, 1, 2],
    'G:maj':   [3, 2, 0, 0, 0, 3],
    'G:dom7':  [3, 2, 0, 0, 0, 1],
    'C:maj':   [null, 3, 2, 0, 1, 0],
    'C:dom7':  [null, 3, 2, 3, 1, 0],
};

// Gabarits de barré mobiles (les deux formes enseignées en premier pour jouer N'IMPORTE QUEL ton) :
// forme E (fondamentale à la 6e corde) et forme A (fondamentale à la 5e corde), décalage de case
// (barré) déduit de la tonique demandée. `null` = corde étouffée, nombre = décalage depuis le barré
// (0 = à la hauteur du barré). Dérivées directement des accords ouverts E/Em/E7/Emaj7/Em7 et
// A/Am/A7/Amaj7/Am7 (mêmes décalages, vérifiés note à note), donc fiables pour n'importe quel ton.
const BARRE_TEMPLATES = {
    E: {
        openPc: NOTES.indexOf('E'),
        maj:  [0, 2, 2, 1, 0, 0],
        min:  [0, 2, 2, 0, 0, 0],
        dom7: [0, 2, 0, 1, 0, 0],
        maj7: [0, 2, 1, 1, 0, 0],
        min7: [0, 2, 0, 0, 0, 0],
    },
    A: {
        openPc: NOTES.indexOf('A'),
        maj:  [null, 0, 2, 2, 2, 0],
        min:  [null, 0, 2, 2, 1, 0],
        dom7: [null, 0, 2, 0, 2, 0],
        maj7: [null, 0, 2, 1, 2, 0],
        min7: [null, 0, 2, 0, 1, 0],
    }
};
const BARRE_QUALITIES = ['maj', 'min', 'dom7', 'maj7', 'min7'];

// Formes « communément enseignées » pour un ton/qualité donné (ouverte quand elle existe, puis
// gabarits de barré E et A décalés) — triées de la plus courante (position la plus basse) à la plus
// rare. Tableau vide si la qualité n'a pas de forme standard répandue (accords étendus/rares) :
// c'est alors le solveur exact (solveGuitarFingerings) qui prend le relais, voir guitarFingeringsForChord.
function commonGuitarShapes(root, quality) {
    const rootPc = NOTES.indexOf(root);
    const results = [];

    const openShape = OPEN_SHAPES[`${root}:${quality}`];
    if (openShape) results.push({ shape: openShape, pos: 0 });

    if (BARRE_QUALITIES.includes(quality)) {
        ['E', 'A'].forEach(name => {
            const tpl = BARRE_TEMPLATES[name][quality];
            if (!tpl) return;
            const barreFret = ((rootPc - BARRE_TEMPLATES[name].openPc) % 12 + 12) % 12;
            const shape = tpl.map(f => (f === null ? null : f + barreFret));
            const key = shape.join(',');
            if (results.some(r => r.shape.join(',') === key)) return; // déjà couvert (barreFret 0 == forme ouverte)
            results.push({ shape, pos: barreFret });
        });
    }

    return results.sort((a, b) => a.pos - b.pos).map(r => r.shape);
}

// Convertit une forme (case par corde, `null` = étouffée) en doigté { fret, midi, role } par corde,
// le rôle étant recalculé depuis la hauteur réelle jouée (pas mémorisé à la main -> pas d'erreur
// possible de correspondance avec la couleur affichée).
function shapeToByString(shape, root, quality) {
    const rootPc = NOTES.indexOf(root);
    const intervals = CHORD_INTERVALS[quality] || CHORD_INTERVALS.maj;
    return shape.map((fret, s) => {
        if (fret === null || fret === undefined) return null;
        const midi = GUITAR_OPEN_MIDI[s] + fret;
        const pc = ((midi % 12) + 12) % 12;
        const match = intervals.find(iv => (((rootPc + iv.semi) % 12) + 12) % 12 === pc);
        return { fret, midi, role: match ? match.role : 'ext' };
    });
}

// Clé de comparaison d'un doigté (case par corde, sous forme { fret } ou null) — sert à repérer si
// le doigté verrouillé (voir toggleGuitarLock) figure déjà dans la liste automatique, pour ne pas le
// lister deux fois.
function fingeringShapeKey(fingering) {
    return fingering.map(f => f ? f.fret : 'x').join(',');
}

// Point d'entrée unique pour la vue live et l'export PDF : privilégie les formes communément
// enseignées quand elles existent ET que l'accord est en position simple (fondamentale, sans drop
// ni basse différente) — dès que l'utilisateur a personnalisé le voicing (renversement/drop/basse),
// cette personnalisation est délibérée et doit rester fidèle, donc on retombe sur le solveur exact.
// `lockedShape` (case par corde, voir toggleGuitarLock) passe en tête de liste s'il est fourni —
// par défaut celui mémorisé sur l'accord lui-même (chord.guitarLock, restauré depuis les données
// enregistrées), mais la vue live le passe explicitement (this.guitarLock) puisque son Chord est
// reconstruit à chaque frappe depuis les contrôles du panneau, sans jamais porter ce champ-là.
function guitarFingeringsForChord(chord, lockedShape = chord.guitarLock) {
    // '#drop' vaut littéralement "none" par défaut (pas "" ni null) quand aucun drop n'est choisi.
    const hasDrop = chord.drop === 'drop2' || chord.drop === 'drop3';
    const isPlainVoicing = chord.getEffectiveInversion() === 0 && !hasDrop && !chord.bass;
    let list;
    if (isPlainVoicing) {
        const common = commonGuitarShapes(chord.root, chord.quality);
        list = common.length ? common.map(shape => shapeToByString(shape, chord.root, chord.quality)) : solveGuitarFingerings(chord.getVoiced());
    } else {
        list = solveGuitarFingerings(chord.getVoiced());
    }
    if (!lockedShape) return list;
    const lockedFingering = shapeToByString(lockedShape, chord.root, chord.quality);
    const lockedKey = fingeringShapeKey(lockedFingering);
    return [lockedFingering, ...list.filter(f => fingeringShapeKey(f) !== lockedKey)];
}

// ---------- Banques de sons ----------
// Le piano (échantillonné, Salamander) reste le son par défaut. Les autres sont synthétisés
// (Tone.js) : disponibles instantanément, sans temps de chargement ni bibliothèque à héberger.
// Timbres choisis pour la pratique d'accords — soutenus/harmoniques plutôt que percussifs, pour
// bien laisser entendre chaque voix.
// Compensation de gain PAR INSTRUMENT (dB), mesurée hors-ligne pour égaliser le niveau perçu d'un même
// geste de jeu d'un instrument à l'autre (voir /tmp/.../instrument_level_calibration.js — rendu Tone.Offline
// de chaque instrument sur le même accord/durée/vélocité, RMS de la portion tenue ramenée à une cible
// commune). Piano à 0 dB : référence déjà naturelle (échantillons réels), les synthés sont recalés dessus.
const INSTRUMENT_TRIM_DB = {
    piano: 0,
    epiano: -4,
    pad: -16,
    strings: -16,
    organ: -18,
};

// Chaque build(masterBus) construit SON PROPRE filtre/effet/volume et se chaîne jusqu'à masterBus
// (jamais .toDestination() directement, voir getMasterBus) : la sortie de chaque instrument passe donc
// systématiquement par la même réverbe légère + le même limiteur partagés, ce qui recolle des synthés
// bruts (carré/dent de scie) au Piano échantillonné plutôt que de les laisser sonner secs/cliniques à
// côté (retour utilisateur : sons stridents, volumes très inégaux d'un instrument à l'autre). Chaque
// filtre passe-bas retire les harmoniques aiguës responsables du côté strident d'une onde brute ; les
// gains de this.instrumentTrimDb (mesurés hors-ligne, voir calibrateInstrumentLevels) égalisent le
// niveau perçu, tous instruments confondus, pour un même geste de jeu.
const INSTRUMENT_BANKS = {
    piano: {
        label: 'Piano',
        build: (masterBus) => {
            const sampler = new Tone.Sampler({
                urls: {
                    "C2": "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3", "A2": "A2.mp3",
                    "C3": "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3", "A3": "A3.mp3",
                    "C4": "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3", "A4": "A4.mp3",
                    "C5": "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3", "A5": "A5.mp3",
                    "C6": "C6.mp3"
                },
                release: 1,
                baseUrl: "https://tonejs.github.io/audio/salamander/"
            });
            const volume = new Tone.Volume(INSTRUMENT_TRIM_DB.piano);
            sampler.chain(volume, masterBus);
            return sampler;
        }
    },
    // Ancien réglage : modulationIndex 14 + modulationEnvelope.sustain 1 gardaient l'anche FM à pleine
    // brillance pendant TOUTE la note tenue (jamais d'assagissement après l'attaque) — le vrai
    // « clavinet FM » classique s'éclaire seulement au pincement puis s'adoucit vite. sustain: 0.12 (au
    // lieu de 1) sur l'enveloppe de MODULATION corrige ça ; modulationIndex abaissé à 5 (au lieu de 14)
    // et modulateur en sinus (au lieu de carré) retirent le côté métallique/strident au pic lui-même.
    epiano: {
        label: 'Piano électrique',
        build: (masterBus) => {
            const synth = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 3.01, modulationIndex: 5,
                oscillator: { type: 'sine' },
                envelope: { attack: 0.005, decay: 1.4, sustain: 0.08, release: 1.2 },
                modulation: { type: 'sine' },
                modulationEnvelope: { attack: 0.002, decay: 0.35, sustain: 0.12, release: 0.5 }
            });
            const filter = new Tone.Filter({ type: 'lowpass', frequency: 4500, Q: 0.5 });
            const volume = new Tone.Volume(INSTRUMENT_TRIM_DB.epiano);
            synth.chain(filter, volume, masterBus);
            return synth;
        }
    },
    pad: {
        label: 'Nappe',
        build: (masterBus) => {
            const synth = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: 'triangle' },
                envelope: { attack: 0.6, decay: 0.3, sustain: 0.9, release: 2.5 }
            });
            const filter = new Tone.Filter({ type: 'lowpass', frequency: 3500, Q: 0.4 });
            // Léger chorus (voix détunée en mouvement lent) : donne de l'ampleur à une simple triangle,
            // comme une vraie nappe analogique plutôt qu'une onde synthé isolée.
            const chorus = new Tone.Chorus({ frequency: 0.6, delayTime: 4, depth: 0.4, wet: 0.25 }).start();
            const volume = new Tone.Volume(INSTRUMENT_TRIM_DB.pad);
            synth.chain(filter, chorus, volume, masterBus);
            return synth;
        }
    },
    // Une dent de scie brute est la source la plus fréquente de « strident » : le filtre passe-bas
    // retire son mordant aigu, le chorus imite l'« ensemble » (plusieurs pupitres légèrement désaccordés)
    // des cordes synthé classiques plutôt qu'une seule onde sèche.
    strings: {
        label: 'Cordes synthé',
        build: (masterBus) => {
            const synth = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: 'sawtooth' },
                envelope: { attack: 0.35, decay: 0.25, sustain: 0.85, release: 1.6 }
            });
            const filter = new Tone.Filter({ type: 'lowpass', frequency: 2400, Q: 0.6 });
            const chorus = new Tone.Chorus({ frequency: 0.8, delayTime: 5, depth: 0.6, wet: 0.35 }).start();
            const volume = new Tone.Volume(INSTRUMENT_TRIM_DB.strings);
            synth.chain(filter, chorus, volume, masterBus);
            return synth;
        }
    },
    // Une onde carrée brute (riche en harmoniques impaires) est la seconde grande source de stridence :
    // même traitement que les cordes (filtre + léger chorus, ici plus rapide façon Leslie d'orgue).
    organ: {
        label: 'Orgue / Lead',
        build: (masterBus) => {
            const synth = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: 'square' },
                envelope: { attack: 0.02, decay: 0.12, sustain: 0.8, release: 0.3 }
            });
            const filter = new Tone.Filter({ type: 'lowpass', frequency: 3000, Q: 0.7 });
            const chorus = new Tone.Chorus({ frequency: 1.1, delayTime: 3.5, depth: 0.45, wet: 0.25 }).start();
            const volume = new Tone.Volume(INSTRUMENT_TRIM_DB.organ);
            synth.chain(filter, chorus, volume, masterBus);
            return synth;
        }
    }
};

// Tone.Transport.loop (playCurrent/playProgression) ne rejoue jamais un évènement programmé PILE à
// Tone.Transport.loopStart — vérifié directement : un évènement à cette position ne déclenche qu'une
// seule fois, quelle que soit sa durée, alors que le même évènement 20ms plus loin se rejoue à chaque
// tour sans problème (quirk interne à Tone.js, une valeur de 5ms suffisait déjà, 20ms garde une marge
// large tout en restant totalement inaudible). Régler loopStart LÉGÈREMENT AVANT le premier évènement
// réellement programmé (jamais l'inverse, qui décalerait ce premier évènement lui-même) évite le cas :
// voir les deux usages de cette constante.
const LOOP_START_EPSILON = 0.02;

// Attend que les instruments à échantillons (Piano) aient fini de charger leurs sons depuis internet
// avant de démarrer une lecture — sans plafond, un réseau absent ou trop lent bloquerait la lecture
// indéfiniment (elle ne démarrerait jamais) plutôt que de simplement laisser filer en silence les
// quelques notes concernées (voir schedulePlayback). Le plafond n'empêche pas le chargement de se
// terminer en arrière-plan ensuite, pour les lectures suivantes.
function waitForAudioReady(timeoutMs = 4000) {
    return Promise.race([
        Tone.loaded().catch(() => {}), // un échec de chargement ne doit jamais empêcher la lecture
        new Promise(resolve => setTimeout(resolve, timeoutMs)),
    ]);
}

const INSTRUMENT_KEY = 'harmohubInstrument';
const METRONOME_KEY = 'harmohubMetronomeDuringPlayback';
const METRONOME_VOLUME_KEY = 'harmohubMetronomeVolume';
const METRONOME_SOUND_KEY = 'harmohubMetronomeSound';
const GENERAL_VOLUME_KEY = 'harmohubGeneralVolume';
const AUTOPLAY_SELECT_KEY = 'harmohubAutoplaySelect';
const METRONOME_COUNTIN_KEY = 'harmohubMetronomeCountIn';
const METRONOME_SUBDIVISION_KEY = 'harmohubMetronomeSubdivision';
const SHOW_ROMAN_KEY = 'harmohubShowRomanNumerals';
// Octave / renversement-drop sous chaque accord de la GRILLE (voir gridVoicingParts, Paramètres >
// Affichage) — remplacent l'ancien réglage unique "Style de jeu" (icône sous la case), retiré.
const SHOW_GRID_OCTAVE_KEY = 'harmohubShowGridOctave';
const SHOW_GRID_VOICING_KEY = 'harmohubShowGridVoicing';
// Notation octave/renversement/drop au-dessus de chaque case (voir Chord.getVoicingBadge) — remplace
// l'ancienne flèche de sens mélodique ▲/▼ (retour utilisateur), dont le réglage a été retiré.
const SHOW_VOICING_PDF_KEY = 'harmohubShowVoicingPdf';
// Fonction harmonique (Tonique/Sous-dominante/Dominante, voir chordFunction) au-dessus de chaque
// accord — désactivée par défaut (contrairement aux autres badges ci-dessus) : fonctionnalité
// nouvelle/analytique, pas encore un réflexe attendu par défaut comme les degrés ou l'octave.
const SHOW_CHORD_FUNCTION_KEY = 'harmohubShowChordFunction';
// Nombre de mesures par ligne dans la grille du PDF exporté (voir buildPrintExportHtml/
// layoutProgression, beatsPerRowOverride) — ÉCHELLE FIXE indépendante du zoom horizontal de la
// grille à l'écran (retour utilisateur : avant, l'échelle du PDF variait ligne par ligne en
// suivant le zoom écran, une ligne plus courte s'étirait pour remplir la largeur de la page).
const PDF_MEASURES_PER_LINE_KEY = 'harmohubPdfMeasuresPerLine';
// Mode studio (voir this.studioMode/#toggle-studio-mode) : réglage global de l'appareil, mémorisé
// d'une session à l'autre — pas remis à zéro à chaque accord édité, pour ne pas avoir à le
// rallumer sans cesse (retour utilisateur : « alléger l'appli », voir aussi le mode simple/studio).
const STUDIO_MODE_KEY = 'harmohubStudioMode';
// Échelles horizontale/verticale INDÉPENDANTES des modes loupe (grille/séquenceur) : remplace
// l'ancien niveau de zoom unique (une seule clé harmohubSeqZoomLevel/harmohubGridZoomLevel) — une
// valeur toujours reprise comme repli pour les deux axes si trouvée (session précédente), pour ne
// pas perdre le réglage déjà choisi par l'utilisateur en migrant vers ce nouveau système.
const SEQ_ZOOM_LEVEL_LEGACY_KEY = 'harmohubSeqZoomLevel';
const GRID_ZOOM_LEVEL_LEGACY_KEY = 'harmohubGridZoomLevel';
const SEQ_ZOOM_LEVEL_X_KEY = 'harmohubSeqZoomLevelX';
const SEQ_ZOOM_LEVEL_Y_KEY = 'harmohubSeqZoomLevelY';
const GRID_ZOOM_LEVEL_X_KEY = 'harmohubGridZoomLevelX';
const GRID_ZOOM_LEVEL_Y_KEY = 'harmohubGridZoomLevelY';
// Échelles horizontale/verticale de la grille CLASSIQUE (hors loupe, voir gridZoomOpen) — voir
// adjustZoom('classicGrid', ...) : INDÉPENDANTES de gridZoomLevelX/Y (loupe), pour resserrer/agrandir
// la grille sans avoir à ouvrir la loupe (retour utilisateur).
const CLASSIC_GRID_ZOOM_LEVEL_X_KEY = 'harmohubClassicGridZoomLevelX';
const CLASSIC_GRID_ZOOM_LEVEL_Y_KEY = 'harmohubClassicGridZoomLevelY';
// Échelle horizontale du séquenceur COMPACT (panneau Accord, hors loupe séquenceur/grille) — voir
// adjustSeqInlineZoom : indépendante de seqZoomLevelX (loupe), 1 par défaut pour garder EXACTEMENT
// l'affichage actuel tant qu'on n'y touche pas (retour utilisateur).
const SEQ_INLINE_ZOOM_LEVEL_X_KEY = 'harmohubSeqInlineZoomLevelX';
// Échelles horizontale/verticale du panneau "Conduite de voix" (voir buildVoiceLeadingPanelHtml) —
// mêmes bornes/pas que les autres (ZOOM_LEVEL_MIN/MAX/STEP ci-dessous), un seul réglage GLOBAL
// (pas par partie, comme voiceLeadingOpen) puisqu'un seul panneau est jamais affiché à la fois.
const VOICE_LEADING_ZOOM_LEVEL_X_KEY = 'harmohubVoiceLeadingZoomLevelX';
const VOICE_LEADING_ZOOM_LEVEL_Y_KEY = 'harmohubVoiceLeadingZoomLevelY';
const ZOOM_LEVEL_MIN = 0.7;
const ZOOM_LEVEL_MAX = 2;
const ZOOM_LEVEL_STEP = 0.1;
// Borne basse plus large QUE ZOOM_LEVEL_MIN, pour ce seul réglage : la cible de base y est bien
// plus petite que celle des fenêtres agrandies (4 temps plutôt que 8, voir seqPageBars) — sur une
// mesure à 4 temps, rester à 0.7 ne suffirait même pas à passer d'1 à 2 mesures par page (le zoom
// n'aurait litéralement aucun effet visible). Plage volontairement plus large pour que réduire
// l'échelle affiche vraiment plus de mesures d'un coup.
const SEQ_INLINE_ZOOM_MIN = 0.3;
const GRID_ZOOM_SEQ_COLLAPSED_KEY = 'harmohubGridZoomSeqCollapsed';
const GRID_ZOOM_SEQ_HEIGHT_KEY = 'harmohubGridZoomSeqHeight';
const GRID_ZOOM_SEQ_HEIGHT_DEFAULT = 240;
const GRID_ZOOM_SEQ_HEIGHT_MIN = 140;
// Panneau de gauche masqué ou non (voir #toggle-sidebar/toggleSidebar) : préférence de l'APPAREIL,
// pas du morceau (contrairement aux échelles de zoom) — une préférence d'espace d'écran, pas un
// réglage propre à un morceau donné.
const SIDEBAR_COLLAPSED_KEY = 'harmohubSidebarCollapsed';

// Curseurs de volume (0-100, plus intuitif qu'une valeur en décibels) : 0 = silence, 100 = 0 dB
// (plein volume « normal »), avec un plancher à -40 dB pour que même « presque muet » reste audible
// sans à-coup plutôt que de couper brutalement.
function percentToDb(percent) {
    return percent <= 0 ? -Infinity : -40 + (percent / 100) * 40;
}

// Sonorités disponibles pour le métronome. Chacune fabrique son propre instrument Tone.js (des
// timbres assez différents pour ne pas pouvoir se contenter de changer la hauteur d'un seul synthé)
// et sait se déclencher elle-même via `trigger`, en distinguant le temps accentué (1er temps de la
// mesure) du temps normal — par la hauteur pour les sons avec pitch, par le volume pour le bruit blanc.
// `sub` (subdivision, voir metronomeSubdivision) marque un clic de croche entre deux temps : toujours
// le plus discret des trois niveaux, quel que soit `accent` (une subdivision n'est jamais LE temps 1).
const METRONOME_SOUNDS = {
    click: {
        label: 'Clic classique',
        build: () => new Tone.Synth({
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 }
        }),
        trigger: (inst, accent, time, sub) => inst.triggerAttackRelease(sub ? 1250 : (accent ? 1500 : 1000), 0.03, time, sub ? 0.5 : 1)
    },
    // Un vrai coup de baguette/bloc de bois est un bruit bref coloré par une résonance courte — pas
    // une corde qui vibre. PluckSynth (Karplus-Strong) sustient toujours une hauteur nette, façon
    // pincement de corde : quel que soit le réglage, l'oreille l'entend comme une note pincée, jamais
    // comme du bois qui claque. Ici : un bruit très court passé dans un filtre passe-bande étroit,
    // la technique habituelle pour synthétiser claves/wood block (c'est d'ailleurs ainsi que ces sons
    // sont fabriqués sur une boîte à rythmes classique). Composé à la main (bruit -> filtre) plutôt
    // qu'un objet Tone.js tout fait, mais expose la même interface que les autres sonorités
    // (volume/dispose/toDestination) pour rester interchangeable avec elles.
    woodblock: {
        label: 'Baguette',
        build: () => {
            const noise = new Tone.NoiseSynth({
                noise: { type: 'pink' },
                envelope: { attack: 0.001, decay: 0.03, sustain: 0 }
            });
            const filter = new Tone.Filter({ type: 'bandpass', frequency: 900, Q: 1.6 });
            // Un filtre passe-bande aussi étroit ne laisse passer qu'une fraction de l'énergie du
            // bruit d'origine : ce gain fixe compense cette perte pour rester audible au même volume
            // que les autres sonorités. Séparé de `volume` (qui reste le réglage utilisateur, réécrit
            // à chaque changement de son/curseur) pour ne pas s'y faire écraser.
            const boost = new Tone.Gain(4);
            noise.chain(filter, boost);
            return {
                volume: noise.volume,
                toDestination() { boost.toDestination(); return this; },
                triggerAttackRelease(dur, time, vel) { noise.triggerAttackRelease(dur, time, vel); return this; },
                dispose() { noise.dispose(); filter.dispose(); boost.dispose(); return this; },
                _filter: filter
            };
        },
        // La hauteur perçue vient du centre du filtre (pas d'une note) : légèrement plus haut sur le
        // temps accentué, comme deux zones différentes d'un même bloc de bois.
        trigger: (inst, accent, time, sub) => {
            inst._filter.frequency.setValueAtTime(sub ? 950 : (accent ? 1100 : 780), time);
            inst.triggerAttackRelease(0.05, time, sub ? 0.35 : (accent ? 0.95 : 0.65));
        }
    },
    clave: {
        label: 'Clave',
        build: () => new Tone.MetalSynth({
            envelope: { attack: 0.001, decay: 0.03, release: 0.01 },
            harmonicity: 3.1, modulationIndex: 16, resonance: 3500, octaves: 0.5
        }),
        trigger: (inst, accent, time, sub) => inst.triggerAttackRelease(sub ? 'E6' : (accent ? 'C7' : 'G6'), 0.02, time, sub ? 0.5 : 1)
    },
    // FMSynth avec un ratio porteuse/modulante non entier : les partiels obtenus sont inharmoniques
    // mais peu nombreux et bien espacés, ce qui donne un timbre de cloche propre (technique FM
    // classique, ex. patches « Tubular Bells » d'un DX7) — contrairement à MetalSynth, pensé pour un
    // son métallique dense/bruité (cymbale, gong), trop dur pour une cloche « douce ». Un indice de
    // modulation très bas (peu de bandes latérales -> presque un ton pur) et une attaque légèrement
    // adoucie (pas un déclic net) visent une écoute confortable sur plusieurs heures.
    bell: {
        label: 'Cloche douce',
        build: () => new Tone.FMSynth({
            harmonicity: 2.76, modulationIndex: 1.8,
            oscillator: { type: 'sine' },
            modulation: { type: 'sine' },
            envelope: { attack: 0.012, decay: 0.6, sustain: 0, release: 1.4 },
            modulationEnvelope: { attack: 0.012, decay: 0.4, sustain: 0, release: 0.6 }
        }),
        trigger: (inst, accent, time, sub) => inst.triggerAttackRelease(sub ? 'E5' : (accent ? 'C6' : 'A5'), 0.4, time, sub ? 0.22 : (accent ? 0.55 : 0.4))
    },
    tic: {
        label: 'Tic sec',
        build: () => new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 0.0005, decay: 0.025, sustain: 0 }
        }),
        // Le bruit blanc n'a pas de hauteur : l'accent se distingue par le volume (vélocité) plutôt
        // que par la note.
        trigger: (inst, accent, time, sub) => inst.triggerAttackRelease(0.03, time, sub ? 0.3 : (accent ? 1 : 0.55))
    }
};

// ---------- Encodage MIDI bas niveau (fichier .mid standard, format 1) ----------
// Aucune bibliothèque externe : le format SMF (quantités de longueur variable + méta-événements)
// est assez simple pour s'écrire directement, sans dépendance à héberger.

// Quantité de longueur variable (7 bits utiles par octet, bit de poids fort = "encore un octet suit")
function midiVarLen(value) {
    const bytes = [value & 0x7f];
    value >>= 7;
    while (value > 0) {
        bytes.unshift((value & 0x7f) | 0x80);
        value >>= 7;
    }
    return bytes;
}
function midiU16(n) { return [(n >> 8) & 0xff, n & 0xff]; }
function midiU32(n) { return [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]; }

function midiTextEvent(type, text) {
    const bytes = Array.from(new TextEncoder().encode(text));
    return [0xff, type, ...midiVarLen(bytes.length), ...bytes];
}
function midiTempoEvent(bpm) {
    const usPerQuarter = Math.round(60000000 / bpm);
    return [0xff, 0x51, 0x03, (usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff];
}
function midiTimeSigEvent(numerator, denominator) {
    return [0xff, 0x58, 0x04, numerator, Math.round(Math.log2(denominator)), 24, 8];
}

// Une piste = une liste d'événements horodatés en temps ABSOLU (plus simple à construire que des
// deltas au fil de l'eau) ; toBytes() trie et ne convertit en delta-time qu'à la toute fin, en gardant
// l'ordre d'arrivée pour les événements simultanés (ex. Note Off avant Note On sur le même tick).
class MidiTrackBuilder {
    constructor() { this.events = []; }
    push(tick, bytes) { this.events.push({ tick, bytes }); }
    // `minEndTick` : certaines pistes (ex. la piste méta, qui ne porte que le tempo/les repères de
    // parties) n'ont pas d'événement pile à la toute fin du morceau — sans ça, sa fin de piste
    // tomberait avant celle des pistes de notes, ce qui peut fausser la durée totale affichée par le DAW.
    toBytes(minEndTick = 0) {
        const sorted = this.events
            .map((e, i) => ({ ...e, i }))
            .sort((a, b) => (a.tick - b.tick) || (a.i - b.i));
        const out = [];
        let prevTick = 0;
        sorted.forEach(e => {
            out.push(...midiVarLen(e.tick - prevTick), ...e.bytes);
            prevTick = e.tick;
        });
        const endTick = Math.max(minEndTick, prevTick);
        out.push(...midiVarLen(endTick - prevTick), 0xff, 0x2f, 0x00); // End of Track
        return [0x4d, 0x54, 0x72, 0x6b, ...midiU32(out.length), ...out]; // "MTrk" + longueur + contenu
    }
}

// Correspondance approximative avec les instruments General MIDI (GM) : à l'import dans un DAW, chaque
// piste charge d'emblée un son du même esprit que celui de l'appli, avant que l'utilisateur ne le
// remplace par le sien (l'objectif de cet export étant justement de pouvoir changer les sons).
const GM_PROGRAM = { piano: 0, epiano: 4, pad: 88, strings: 50, organ: 80 };
const MIDI_PPQ = 480; // pulsations par noire (doit être divisible par SEQ_STEPS_PER_BEAT)

// Fréquence d'échantillonnage du rendu audio hors-temps réel (export MP3, voir plus bas) : 44,1 kHz,
// standard universel, largement suffisant pour des accords/nappes (pas de contenu ultrasonique à capter).
const MP3_SAMPLE_RATE = 44100;

// Convertit un canal audio Float32 (-1..1, format natif Web Audio) en PCM 16 bits signé, tel
// qu'attendu par l'encodeur MP3 (lame.min.js). Écrêté à [-1, 1] par sécurité (un instrument mal réglé
// pourrait dépasser légèrement l'amplitude nominale).
function floatTo16BitPCM(f32) {
    const out = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
        const s = Math.max(-1, Math.min(1, f32[i]));
        out[i] = Math.round(s < 0 ? s * 32768 : s * 32767);
    }
    return out;
}

class HarmoHubApp {
    constructor() {
        // Réduit la marge de sécurité par défaut de Tone.js (0.1s) avant que tout son programmé ne
        // soit réellement audible — remise en cause après un retour utilisateur : ce délai, fixe et
        // systématique, se percevait comme un petit temps mort au lancement de la lecture de la grille,
        // surtout quand le décompte est désactivé (rien d'autre pour "absorber" ce silence). 0.02s
        // reste une marge suffisante pour un métronome/accords (contrairement à un player audio
        // temps réel exigeant), voir playProgression qui aligne son propre pré-roll sur cette valeur.
        Tone.context.lookAhead = 0.02;

        // Volume général : agit APRÈS les deux réglages spécifiques ci-dessous (accords, métronome),
        // sur la sortie audio globale de Tone.js — un vrai « volume maître » qui les multiplie tous
        // les deux ensemble sans changer leur équilibre relatif l'un par rapport à l'autre.
        const storedGeneralVol = localStorage.getItem(GENERAL_VOLUME_KEY);
        this.generalVolumePercent = storedGeneralVol !== null ? parseInt(storedGeneralVol) : 100;
        Tone.Destination.volume.value = percentToDb(this.generalVolumePercent);

        // Lecture automatique d'un accord de la grille dès qu'on clique dessus pour le sélectionner
        // (activée par défaut, comme le comportement historique) — désactivable dans Paramètres > Son.
        this.autoplaySelect = localStorage.getItem(AUTOPLAY_SELECT_KEY) !== '0';

        // Clics du décompte avant le début de la lecture de la grille (activés par défaut) —
        // distinct du métronome PENDANT la lecture (this.metronomeDuringPlayback, bouton dédié) :
        // désactivable séparément dans Paramètres > Son (voir playProgression).
        this.metronomeCountIn = localStorage.getItem(METRONOME_COUNTIN_KEY) !== '0';

        // Clic faible additionnel sur le contretemps (croches, "et" de chaque temps) — désactivé par
        // défaut pour ne rien changer au comportement existant (bouton dédié, voir toggle-metronome-
        // subdivision), qu'on garde ou non le métronome pendant la lecture par ailleurs.
        this.metronomeSubdivision = localStorage.getItem(METRONOME_SUBDIVISION_KEY) === '1';

        // Chiffrage romain (I, IV, V7...) : une fine ligne dédiée au-dessus de chaque ligne d'accords —
        // un SEUL réglage (Paramètres > Affichage) qui vaut pour la grille ET le PDF exporté, ce
        // dernier reprenant toujours ce qui est affiché à l'écran plutôt qu'un réglage à part (voir
        // loadProgression et buildPrintExportHtml).
        this.showRomanNumerals = localStorage.getItem(SHOW_ROMAN_KEY) !== '0';
        // Fonction harmonique (T/SD/D, voir chordFunction) partageant la même ligne que le chiffrage
        // romain — DÉSACTIVÉE par défaut (voir SHOW_CHORD_FUNCTION_KEY), contrairement à celui-ci.
        this.showChordFunction = localStorage.getItem(SHOW_CHORD_FUNCTION_KEY) === '1';

        // Octave / renversement-drop sous chaque accord de la grille (voir .cell-meta,
        // gridVoicingParts) — remplace l'ancienne icône de style de jeu (retour utilisateur :
        // n'apportait plus grand-chose). Deux réglages indépendants, comme demandé : l'octave seule
        // (toujours présente, ex. "O3") et/ou le renversement/drop seul (ex. "R1-D2", absent en
        // position de base) — activés par défaut.
        this.showGridOctave = localStorage.getItem(SHOW_GRID_OCTAVE_KEY) !== '0';
        this.showGridVoicing = localStorage.getItem(SHOW_GRID_VOICING_KEY) !== '0';

        // PDF exporté uniquement (rien d'équivalent à l'écran) : notation octave/renversement/drop en
        // petit au-dessus de chaque accord (voir Chord.getVoicingBadge), au lieu d'alourdir son symbole
        // (voir Chord.getLabel) — activé par défaut.
        this.showVoicingPdf = localStorage.getItem(SHOW_VOICING_PDF_KEY) !== '0';

        // Mesures par ligne dans le PDF exporté (voir PDF_MEASURES_PER_LINE_KEY ci-dessus) — 4 par
        // défaut, comme demandé.
        const storedMeasuresPerLine = parseInt(localStorage.getItem(PDF_MEASURES_PER_LINE_KEY), 10);
        this.pdfMeasuresPerLine = (storedMeasuresPerLine >= 1 && storedMeasuresPerLine <= 8) ? storedMeasuresPerLine : 4;

        // Chaque accord choisit sa propre banque de son (voir data.instrument) : plusieurs
        // instruments Tone.js peuvent donc jouer simultanément. Construits à la demande et mis en
        // cache (voir getInstrument) plutôt qu'un seul « activeInstrument » partagé comme avant.
        this.instrumentCache = new Map();

        // Métronome : son au choix (voir METRONOME_SOUNDS et le panneau Son des Paramètres). 80 par
        // défaut = -8 dB, le volume fixe d'avant l'ajout de ce réglage.
        const storedSound = localStorage.getItem(METRONOME_SOUND_KEY);
        this.metronomeSoundKey = (storedSound && METRONOME_SOUNDS[storedSound]) ? storedSound : 'click';
        this.metronome = METRONOME_SOUNDS[this.metronomeSoundKey].build().toDestination();
        const storedMetroVol = localStorage.getItem(METRONOME_VOLUME_KEY);
        this.metronomeVolumePercent = storedMetroVol !== null ? parseInt(storedMetroVol) : 80;
        this.metronome.volume.value = percentToDb(this.metronomeVolumePercent);

        this.activeSection = 0;    // partie (couplet/refrain/...) ciblée par les contrôles courants
        this.loopActiveSection = false; // boucle la partie active au lieu de jouer toute la grille (bouton Grille)
        this.selectedIndex = null; // accord sélectionné dans la grille (au sein de la partie active)
        this.multiSelect = new Set(); // indices en plus de selectedIndex (Ctrl/Cmd+clic, voir toggleGridMultiSelect), toujours au sein de la partie active — vidé au changement de partie
        this._multiIntensityUndoPushed = false; // voir applyIntensityToSelection : un seul instantané Annuler par sélection multiple, pas un par cran de la barre #intensity
        this.editingIndex = null;  // accord en cours de modification (au sein de la partie active)
        // Bandeau Ajout/Modification (retour utilisateur : trop de clics/erreurs pour modifier un
        // accord) — voir updateAppModeBanner/editChord/exitEditMode. 'add' : un clic simple sur la
        // grille sélectionne/écoute seulement, double-clic bascule en 'edit' ET charge cet accord.
        // 'edit' : mode COLLANT, un simple clic sur N'IMPORTE quel accord le charge directement pour
        // édition, jusqu'à repasser en 'add' via le bandeau. editingIndex non nul implique toujours
        // appMode==='edit' (seul editChord() peut le poser, et il force toujours ce mode).
        this.appMode = 'add';
        // Un seul instantané Annuler par SESSION d'édition en mode 'edit' (voir commitLiveEdit),
        // jamais un par champ retouché — remis à false à chaque nouvel appel à editChord().
        this._editSessionUndoPushed = false;
        // Troisième onglet du bandeau (voir setLeftPanelTab) : 'edit' affiche Accord/Lecture (comme
        // avant), 'config' affiche #config-card (tonalité/mode/signature/groove/transpose) à la
        // place — INDÉPENDANT de this.appMode (Config. n'est pas un mode d'interaction avec la
        // grille, juste un panneau de réglages qu'on fixe une fois pour toutes, voir le bandeau).
        this.leftPanelTab = 'edit';
        this.drag = null;          // état de glisser-déposer
        this.loopRange = null;     // {startSection, startIndex, endSection, endIndex} : boucle sur une
                                    // PLAGE d'accords voisins, qui peut traverser plusieurs parties
                                    // (glisser sur la ligne des numéros de mesure, voir
                                    // setupLoopRangeInteractions/playProgression) — comme la barre de
                                    // cycle jaune de GarageBand. Distinct de loopActiveSection (boucle
                                    // TOUTE la partie active, bouton dédié) : quand définie, elle est
                                    // prioritaire sur celui-ci.
        this.clipboard = null;     // presse-papier (copier/coller d'accords)
        this.pianoWindow = null;   // fenêtre clavier courante
        this.guitarKey = null;     // signature (midis triés) du dernier accord affiché à la guitare
        this.guitarIdentityKey = null; // signature de CE QUI DÉFINIT VRAIMENT l'accord joué à la guitare
                                   // (racine/qualité/renversement/drop/octave/basse, PAS les notes
                                   // libres du séquenceur) — voir ensureGuitarDiagram, décide si le
                                   // verrou doit sauter, séparément de guitarKey (qui décide si le
                                   // diagramme entier doit se recalculer).
        this.guitarFingerings = []; // doigtés jouables pour l'accord courant (voir solveGuitarFingerings)
        this.guitarFingeringIndex = 0; // doigté actuellement affiché parmi guitarFingerings
        this.guitarLock = null;    // doigté verrouillé en attente pour l'accord en cours d'édition (voir toggleGuitarLock)
        this._keepGuitarLockOnce = false; // laisse passer guitarLock au PROCHAIN recalcul (voir ensureGuitarDiagram)
        this.guitarDisplayLock = null; // verrou du diagramme RÉELLEMENT affiché (édition ou simple aperçu, voir ensureGuitarDiagram/updateGuitarLockButton)
        // { section, index } de l'accord actuellement affiché en LECTURE SEULE (simple clic pour
        // écouter, PAS d'édition ouverte — voir playSavedChord/scheduleProgressionChord) : le panneau
        // Accord ne synchronise ses champs QU'en édition (voir editChord), donc toggleGuitarLock ne peut
        // pas s'appuyer sur readChord() ici, sous peine de verrouiller un accord totalement différent
        // (retour utilisateur : cliquer le cadenas en simple aperçu — sans avoir double-cliqué pour
        // éditer — n'avait aucun effet réel, silencieusement, puisque le panneau visait toujours
        // l'accord précédemment édité ou l'accord vierge par défaut). Remis à null dès qu'un vrai
        // panneau live (édition ou Ajout) reprend la main, voir ensureGuitarDiagram(useLiveLock=true).
        this.guitarPreviewPos = null;
        this.extraNotes = [];      // notes libres en attente pour l'accord en cours d'édition (voir addSequencerNote)
        // Intensité (vélocité) de l'accord en cours d'édition, voir computeVelocity/DEFAULT_INTENSITY :
        // intensityPerStep est un réglage fin PAR CROCHE (mode studio, une valeur par attaque/case
        // active, partagée par toutes les voix qui y sonnent — jamais par voix), en attente comme
        // extraNotes/guitarLock jusqu'à l'enregistrement (voir saveCurrent/editChord/exitEditMode).
        this.intensityPerStep = {};
        // Affiche la rangée de barres de vélocité sous le séquenceur (voir renderSequencer) — réglage
        // global de l'appareil, mémorisé (voir STUDIO_MODE_KEY), pas remis à zéro à chaque accord édité.
        this.studioMode = localStorage.getItem(STUDIO_MODE_KEY) === '1';
        this._velDragStep = null; // croche en cours de glissé dans cette rangée (voir setupEventListeners)
        this.seqRenderGen = 0;     // incrémenté à chaque renderSequencer() (voir plus bas, étiquette éditable
                                   // d'une note libre) : un blur tardif d'une étiquette d'un rendu déjà
                                   // remplacé ne doit jamais committer sur l'état (accord) désormais chargé
        this._lastTap = null;      // pour le double-tap (suppression mobile)
        this.tapTimes = [];        // horodatages du tap tempo (voir handleTapTempo)
        this.isPlaying = false;    // une lecture (accord/progression) est-elle en cours ?
        this._playGen = 0;        // jeton incrémenté à chaque stopAll() (voir playCurrent/playProgression/
                                   // playSavedChord) pour qu'un appel resté en attente du chargement d'un
                                   // instrument abandonne au lieu de redémarrer le transport après un Stop
        this._playMode = null;    // 'chord' (playCurrent) ou 'progression' (playProgression) tant que
                                   // isPlaying est vrai — sert à livePreviewUpdate (voir plus bas) pour
                                   // savoir QUOI relancer quand on modifie un réglage en cours de lecture
        this._progChordSlots = new Map(); // voir scheduleProgressionChord/liveUpdateProgressionChord :
                                   // patcher un accord de la chanson en cours de lecture sans redémarrer
        this.seqOpen = false;      // panneau séquenceur ouvert ou non (indépendant du style de lecture)
        this.seqZoomOpen = false;  // fenêtre agrandie du séquenceur ouverte ou non (voir openSeqZoom)
        this.gridZoomOpen = false; // fenêtre agrandie de la grille d'accords ouverte ou non (voir openGridZoom)
        // Panneau "Conduite de voix" ouvert ou non (voir toggleVoiceLeadingPanel/buildVoiceLeadingPanelHtml)
        // — un seul bouton global (#toggle-voice-leading, à côté de #grid-zoom), pas un par partie : le
        // panneau affiché suit simplement la partie ACTIVE (this.activeSection) à chaque rendu. Comme
        // gridZoomOpen/seqOpen, volontairement pas persisté : état d'affichage de la session, pas une
        // donnée du morceau.
        this.voiceLeadingOpen = false;
        // Échelles horizontale/verticale (1 = taille normale), INDÉPENDANTES l'une de l'autre, des deux
        // fenêtres agrandies ci-dessus — réglables une fois ouvertes via les boutons dédiés ou
        // Ctrl+molette/Ctrl+Maj+molette (voir adjustZoom) — mémorisées d'une session à l'autre comme
        // les autres préférences d'affichage. Reprend l'ancien réglage unique (avant l'indépendance
        // des deux axes) comme repli si présent, pour ne rien perdre au premier chargement après la
        // mise à jour.
        const legacySeq = parseFloat(localStorage.getItem(SEQ_ZOOM_LEVEL_LEGACY_KEY));
        const legacyGrid = parseFloat(localStorage.getItem(GRID_ZOOM_LEVEL_LEGACY_KEY));
        this.seqZoomLevelX = parseFloat(localStorage.getItem(SEQ_ZOOM_LEVEL_X_KEY)) || legacySeq || 1;
        this.seqZoomLevelY = parseFloat(localStorage.getItem(SEQ_ZOOM_LEVEL_Y_KEY)) || legacySeq || 1;
        this.gridZoomLevelX = parseFloat(localStorage.getItem(GRID_ZOOM_LEVEL_X_KEY)) || legacyGrid || 1;
        this.gridZoomLevelY = parseFloat(localStorage.getItem(GRID_ZOOM_LEVEL_Y_KEY)) || legacyGrid || 1;
        // Grille CLASSIQUE (hors loupe) : voir CLASSIC_GRID_ZOOM_LEVEL_X_KEY — indépendante de la loupe,
        // toujours active (pas de fenêtre à ouvrir), 1 par défaut pour garder l'affichage actuel.
        this.classicGridZoomLevelX = parseFloat(localStorage.getItem(CLASSIC_GRID_ZOOM_LEVEL_X_KEY)) || 1;
        this.classicGridZoomLevelY = parseFloat(localStorage.getItem(CLASSIC_GRID_ZOOM_LEVEL_Y_KEY)) || 1;
        // Panneau "Conduite de voix" (voir VOICE_LEADING_ZOOM_LEVEL_X_KEY) : mémorisé comme les autres.
        this.voiceLeadingZoomLevelX = parseFloat(localStorage.getItem(VOICE_LEADING_ZOOM_LEVEL_X_KEY)) || 1;
        this.voiceLeadingZoomLevelY = parseFloat(localStorage.getItem(VOICE_LEADING_ZOOM_LEVEL_Y_KEY)) || 1;
        // Échelle EFFECTIVEMENT posée dans les coordonnées SVG lors de la DERNIÈRE construction réelle
        // du panneau (voir buildVoiceLeadingPanelHtml/applyZoomLevel) : sert de référence pendant un
        // pincer-zoomer pour un transform: scale() de secours instantané (--vl-zoom-scale-x/-y, voir
        // style.css), tant que la vraie reconstruction (~150ms) n'a pas rattrapé l'échelle ci-dessus.
        this._voiceLeadingBuiltZoomX = this.voiceLeadingZoomLevelX;
        this._voiceLeadingBuiltZoomY = this.voiceLeadingZoomLevelY;
        // Échelle horizontale du séquenceur COMPACT (hors loupe), voir SEQ_INLINE_ZOOM_LEVEL_X_KEY.
        this.seqInlineZoomLevelX = parseFloat(localStorage.getItem(SEQ_INLINE_ZOOM_LEVEL_X_KEY)) || 1;
        // Séquenceur épinglé en bas de la loupe grille (voir openGridZoom/toggleGridZoomPinnedSeq) :
        // replié ou non, mémorisé d'une session à l'autre comme le niveau de zoom ci-dessus.
        this.gridZoomSeqCollapsed = localStorage.getItem(GRID_ZOOM_SEQ_COLLAPSED_KEY) === '1';
        // Panneau de gauche (voir #toggle-sidebar/toggleSidebar) : masqué ou non, mémorisé comme
        // ci-dessus — appliqué juste après setupEventListeners (voir plus bas dans le constructeur),
        // une fois le bouton lui-même câblé.
        this.sidebarCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
        this.seqTouched = false;   // l'utilisateur a-t-il personnalisé le motif pour l'accord en cours ?
        this.seqLastChordToneVoices = 0; // nombre de voix DU CORPS DE L'ACCORD (chord.getIntervals(),
                                   // jamais notes libres/basse — voir applyNewVoiceDefaults/
                                   // syncSeqPatternForCurrentChord) lors de la dernière synchro : une
                                   // voix du corps dont l'index est >= à cette valeur vient d'apparaître
                                   // (ex. qualité min -> min7). Les notes libres (voir addSequencerNote)
                                   // doivent rester silencieuses par défaut, jamais concernées ici.
        this.seqSelections = []; // notes du séquenceur sélectionnées : [{ voice, start, end }, ...]
        this.seqDrag = null;       // état de glisser en cours sur le séquenceur
        // Sélection par rectangle (Maj/Shift + glisser depuis une case VIDE, voir beginSeqMarqueeSelect) :
        // état séparé de this.seqDrag (qui suppose toujours une seule voix de départ), null hors glissé.
        this.seqMarquee = null;
        // Doigts actuellement posés sur le séquenceur (voir onSeqPointerDown/setupPinchZoom) : un second
        // doigt qui se pose alors qu'un premier peint/glisse déjà signale un pincer-zoomer en train de
        // démarrer (voir #grid-zoom-pinned-body/#seq-zoom-host, tous deux ancêtres de #arp-sequencer —
        // le MÊME pointerdown déclenche à la fois onSeqPointerDown ici ET le pincer-zoomer par
        // bouillonnement) — sans ce garde-fou, peindre/effacer une case et zoomer se marchaient dessus
        // en même temps sur un téléphone réel (retour utilisateur : "l'agrandissement... ne fonctionne
        // pas bien"). Vidé au relâchement de CHAQUE doigt, où qu'il se lève (voir setupSequencerInteractions).
        this._seqActiveTouchIds = new Set();
        // Même garde-fou que ci-dessus, mais pour le glisser-réordonner de la grille d'accords (voir
        // onGridPointerDown/setupGridInteractions) : un pincer-zoomer sur la loupe grille (voir
        // #grid-zoom-host/setupPinchZoom) partage le MÊME conteneur que la grille elle-même, donc le
        // même risque de conflit entre les deux doigts d'une pince et un glisser de case démarré par
        // erreur sur l'un d'eux.
        this._gridActiveTouchIds = new Set();
        // Pincer-zoomer en cours (voir setupPinchZoom) sur N'IMPORTE lequel des 3 hôtes concernés
        // (séquenceur ou grille) : tant qu'il l'est, applyZoomLevel n'y déclenche PAS de reconstruction
        // complète du DOM (renderSequencer/loadProgression) à chaque pas, seulement au relâchement des
        // doigts (voir _seqZoomRenderPending/_gridZoomRenderPending) — sinon la toute première case
        // reconstruite au premier cran de zoom perd son doigt tactile en cours de route (plus aucun
        // ancêtre DOM à traverser pour ses pointermove/pointerup suivants), coupant le geste net (retour
        // utilisateur : "l'agrandissement avec les doigts ne fonctionne pas bien"). L'échelle verticale
        // (simple variable CSS, jamais une reconstruction) continue elle de suivre les doigts en direct.
        this._zoomPinchActive = false;
        this._seqZoomRenderPending = false;
        this._gridZoomRenderPending = false;
        this._zoomPinchFlushRAF = null; // id requestAnimationFrame du rattrapage périodique, voir _startZoomPinchFlushLoop
        // Presse-papier du MOTIF rythmique entier (voir copySeqPattern/pasteSeqPattern, Ctrl+C/Ctrl+V
        // quand le séquenceur est ouvert) : { pattern, tie, intensityPerStep, steps }, ou null tant que
        // rien n'a encore été copié. En mémoire seulement (comme this.clipboard pour les accords), pas
        // persisté d'une session à l'autre.
        this.seqPatternClipboard = null;
        // Pipette de motif ENTRE VOIES du même accord (retour utilisateur : sélectionner une ou
        // plusieurs notes du séquenceur — clic, Ctrl+clic, ou rectangle, voir seqSelections/
        // finalizeSeqMarqueeSelect — puis appliquer ce même rythme sur une AUTRE ligne/voix, sans
        // affecter la grille ni les autres accords, contrairement à this.seqPatternClipboard ci-dessus).
        // null (inactive) ou tableau de { start, end } (positions absolues de croches, voir
        // toggleSeqRowPipette) tant qu'elle reste chargée — armée jusqu'à ce qu'on la désactive
        // soi-même (bouton, Échap), pour pouvoir l'appliquer sur plusieurs lignes à la suite.
        this.seqRowPipette = null;
        this.seqPage = 0;          // mesure(s) affichée(s) pour un accord qui en dure plusieurs (voir seqPageBars)
        this.seqLoopPlay = false;  // « Lecture » du séquenceur reboucle indéfiniment (voir playCurrent)
        this.playheadSection = null; // partie/index de l'accord marqué par la barre de lecture de la
        this.playheadIndex = null;   // grille (voir updateGridPlayhead) : accord sélectionné au repos,
                                      // accord en cours au fil de la lecture — jamais effacée à l'arrêt

        // Garder le métronome pendant la lecture de la grille (pas seulement au décompte) : une
        // préférence d'usage, mémorisée d'une session à l'autre comme le choix d'instrument.
        this.metronomeDuringPlayback = localStorage.getItem(METRONOME_KEY) === '1';

        this.settingsOpen = false; // fenêtre Paramètres (Fichiers, et ce qui s'y ajoutera)
        this.settingsTab = 'audio'; // onglet actif de la fenêtre Paramètres (voir setSettingsTab)
        this.contextMenuTarget = null; // { type: 'song'|'folder', id|name } pendant que le menu contextuel est ouvert

        // Historique annuler/rétablir (Ctrl+Z / Ctrl+Y) : piles de copies profondes de `sections`
        this.undoStack = [];
        this.redoStack = [];
        const UNDO_LIMIT = 50;
        this.undoLimit = UNDO_LIMIT;

        // Historique dédié au séquenceur (motif de l'accord en cours d'édition, pas encore
        // « Ajouté »/« Modifié » dans la grille) : piles de simples chaînes (le format sérialisé de
        // l'input caché #arpPattern EST déjà la représentation complète du motif, pas besoin de plus).
        this.seqUndoStack = [];
        this.seqRedoStack = [];

        // Historique dédié à la fenêtre Paramètres > Fichiers (dossiers créés/renommés/supprimés,
        // morceaux renommés/supprimés/déplacés) : instantané combiné {folders, songs} à chaque action.
        this.filesUndoStack = [];
        this.filesRedoStack = [];

        // Débloque l'AudioContext au tout PREMIER geste tactile où qu'il tombe sur la page, pas
        // seulement sur un contrôle qui appelle lui-même Tone.start() (Lecture, un accord...) : Safari
        // iOS n'autorise la création/reprise de l'AudioContext que si elle survient DANS la pile d'appel
        // d'un vrai geste utilisateur, et seulement la toute première fois qu'on la sollicite — un
        // premier tap sur un contrôle qui ne joue rien lui-même (ex. juste survoler/sélectionner sans
        // audition automatique, un menu, un champ) « consommait » ce tout premier geste sans jamais
        // débloquer l'audio, et toute lecture réclamée ensuite restait silencieuse jusqu'au rechargement
        // de la page (retour utilisateur : aucun son du tout sur iPhone, alors que la même appli
        // fonctionne sur ordinateur — desktop n'a pas cette restriction). 'pointerdown'/'touchend' :
        // les deux évènements les plus tôt disponibles d'un tap, sans dépendre du contrôle précis visé.
        let audioUnlockedOnce = false;
        const unlockAudioOnce = () => {
            if (audioUnlockedOnce) return;
            audioUnlockedOnce = true;
            Tone.start().catch(() => {});
            document.removeEventListener('pointerdown', unlockAudioOnce);
            document.removeEventListener('touchend', unlockAudioOnce);
        };
        document.addEventListener('pointerdown', unlockAudioOnce, { passive: true });
        document.addEventListener('touchend', unlockAudioOnce, { passive: true });

        this.setupEventListeners();
        this.updateAppModeBanner();
        this.setupDurationPicker();
        this.setupPlayStylePicker();
        // La plage à boucler d'ABORD : les deux écoutent 'pointerdown' sur le même conteneur, et
        // onLoopRangeStart doit pouvoir couper court (stopImmediatePropagation) avant qu'onGridPointerDown
        // ne change la partie active et ne re-rende la grille — sinon l'élément qu'il vient de capturer
        // (pour mesurer sa position) se retrouve détaché en plein milieu du même événement, faussant
        // tout calcul de coordonnées qui suit (repéré en étendant la plage vers une partie inactive).
        this.setupLoopRangeInteractions();
        this.setupGridInteractions();
        this.setupGridCellOctaveFloat();
        this.setupSequencerInteractions();
        this.setupKeyboardShortcuts();
        this.applySidebarCollapsed(); // reflète l'état mémorisé dès le premier rendu (bouton déjà câblé)
        // Avertissement natif du navigateur si on ferme/recharge la page avec des modifications non
        // enregistrées (voir hasUnsavedChanges/saveCurrentSong) — les navigateurs modernes ignorent le
        // message personnalisé et affichent le leur, mais returnValue déclenche bien la confirmation.
        window.addEventListener('beforeunload', (e) => {
            if (!hasUnsavedChanges) return;
            e.preventDefault();
            e.returnValue = '';
        });
        this.restoreCurrentSongSettingsIfAny();
        this.updateKeyLabels();
        this.updateDurationOptions();
        this.applyZoomLevel('classicGrid'); // pose --grid-zoom-scale-v sur .history-section + 1er rendu
        this.refreshPreview();       // affiche l'accord courant + cadre le clavier dès l'ouverture
        this.renderSequencer();      // prépare le motif (masqué tant que le panneau n'est pas ouvert)
        this.refreshSongList();      // remplit le sélecteur de morceaux enregistrés
        this.updateGlobalUndoRedoButtons();
        this.updateGlobalUndoRedoButtons();
        // Précharge le Piano (seul instrument À ÉCHANTILLONS, voir INSTRUMENT_BANKS) dès l'ouverture de
        // l'appli plutôt qu'au premier accord joué : construire son Tone.Sampler démarre aussitôt le
        // téléchargement de ses fichiers depuis internet en arrière-plan (voir waitForAudioReady, qui
        // attend justement CE chargement avant de jouer). Sans ce préchargement, tout ce temps de
        // téléchargement (mesuré : plus d'une seconde) retombait entièrement sur le tout premier accord
        // écouté dans la session — perçu comme un délai avant la lecture (retour utilisateur), alors
        // qu'il ne s'agit que d'un chargement qui aurait de toute façon fini par arriver. Sans risque
        // avant le premier geste utilisateur : construire l'instrument ne joue aucun son tant que rien
        // ne l'appelle, et ne nécessite pas d'avoir déjà "débloqué" l'AudioContext (seul
        // triggerAttackRelease en a besoin, voir Tone.start() dans playCurrent/playProgression).
        this.getInstrument('piano');
    }

    setupEventListeners() {
        // Bouton « Accord » : tant qu'un accord de la grille est SÉLECTIONNÉ (simple clic) sans être
        // EN COURS DE MODIFICATION (double-clic), on veut entendre CELUI-LÀ — pas l'accord « en train
        // d'être défini » dans le panneau (readChord(), qui peut dater d'une modification précédente
        // sans rapport). Dès qu'on modifie réellement (editingIndex non nul), le panneau redevient
        // prioritaire : on y prévisualise les changements non enregistrés (voir editChord/playCurrent).
        document.getElementById('play').onclick = () => {
            if (this.editingIndex == null && this.selectedIndex != null) {
                this.playSavedChord(this.activeSection, this.selectedIndex);
            } else {
                this.playCurrent();
            }
        };
        document.getElementById('save').onclick = () => this.saveCurrent();
        document.getElementById('save-insert').onclick = () => this.saveCurrent(this.selectedIndex);

        // Bandeau Config./Ajout/Modification : "Config." bascule juste QUELLE carte est affichée (voir
        // setLeftPanelTab), sans toucher au mode d'interaction en dessous. "Ajout" referme une édition
        // en cours (resetMode=true, comportement par défaut) ET revient sur la vue Accord/Lecture ;
        // "Modification" arme le mode collant, sans charger d'accord précis — le prochain clic sur la
        // grille s'en charge (voir onGridPointerUp/editChord) — et revient aussi sur cette vue.
        document.getElementById('app-mode-config').onclick = () => {
            if (this.leftPanelTab === 'config') return;
            this.setLeftPanelTab('config');
        };
        document.getElementById('app-mode-add').onclick = () => {
            if (this.appMode === 'add' && this.leftPanelTab === 'edit') return;
            this.exitEditMode();
            this.setLeftPanelTab('edit');
            this.loadProgression();
        };
        document.getElementById('app-mode-edit').onclick = () => {
            if (this.appMode === 'edit' && this.leftPanelTab === 'edit') return;
            this.appMode = 'edit';
            this.setLeftPanelTab('edit'); // appelle déjà updateAppModeBanner()
            this.updateSaveButtons(); // masque Ajouter/À la suite tout de suite, avant même de charger un accord
        };
        document.getElementById('quick-add-btn').onclick = () => this.addQuickChord();
        // Entrée = saut de ligne normal (comportement par défaut du <textarea>, donc pas de
        // preventDefault) : les lignes d'un même bloc rejoignent une seule partie, il faut sauter
        // une ligne pour en démarrer une nouvelle (voir splitQuickAddBlocks/addQuickChord).
        // Ctrl/Cmd+Entrée valide tout de suite, comme le bouton "+".
        document.getElementById('quick-add-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.addQuickChord(); }
        });
        document.getElementById('quick-add-input').addEventListener('input', () => this.autoResizeQuickAdd());

        document.getElementById('play-prog').onclick = () => this.playProgression();
        document.getElementById('stop').onclick = () => this.stopAll();

        document.getElementById('global-undo-btn').onclick = () => this.globalUndo();
        document.getElementById('global-redo-btn').onclick = () => this.globalRedo();

        // La banque de son est un réglage PAR ACCORD (comme le style de lecture), pas un instrument
        // global unique : on ne fait ici que présélectionner le dernier choix pour un nouvel accord,
        // et mémoriser le prochain (voir INSTRUMENT_KEY). La valeur réellement utilisée à la lecture
        // vient toujours de data.instrument (accords sauvegardés) ou du sélecteur (accord en cours).
        const savedInstrument = localStorage.getItem(INSTRUMENT_KEY);
        if (savedInstrument && INSTRUMENT_BANKS[savedInstrument]) {
            document.getElementById('instrument').value = savedInstrument;
        }
        document.getElementById('instrument').onchange = (e) => {
            localStorage.setItem(INSTRUMENT_KEY, e.target.value);
            // Fait entendre le nouveau son tout de suite, qu'on modifie un accord déjà posé OU qu'on
            // soit en train d'en composer un nouveau pas encore ajouté (retour utilisateur : changer de
            // son restait muet dans les deux cas, contrairement à root/qualité/etc. — voir refreshPreview,
            // qui ne joue jamais de son lui-même, seulement le bouton Lecture dédié jusqu'ici). Si une
            // chanson entière est en cours (voir livePreviewUpdate), la relancer ELLE plutôt que de
            // basculer sur l'audition d'un seul accord, qui volerait la lecture en cours.
            if (this.isPlaying) this.livePreviewUpdate();
            else this.playCurrent();
            this.commitLiveEdit(false); // n'affecte pas le symbole affiché dans la case
        };
        document.getElementById('apply-instrument-all').onclick = () => this.applyInstrumentToSong();

        // Garder le métronome pendant la lecture de la grille (au-delà du seul décompte)
        const metroBtn = document.getElementById('toggle-metronome');
        metroBtn.classList.toggle('active', this.metronomeDuringPlayback);
        metroBtn.onclick = (e) => {
            this.metronomeDuringPlayback = !this.metronomeDuringPlayback;
            e.currentTarget.classList.toggle('active', this.metronomeDuringPlayback);
            localStorage.setItem(METRONOME_KEY, this.metronomeDuringPlayback ? '1' : '0');
        };

        // Clic faible sur le contretemps (croches), en plus du clic normal sur chaque temps
        const metroSubBtn = document.getElementById('toggle-metronome-subdivision');
        const syncMetroSubIcon = () => {
            metroSubBtn.classList.toggle('active', this.metronomeSubdivision);
            metroSubBtn.innerHTML = svgIcon(this.metronomeSubdivision ? 'eighthNotes' : 'quarterNote');
        };
        syncMetroSubIcon();
        metroSubBtn.onclick = () => {
            this.metronomeSubdivision = !this.metronomeSubdivision;
            syncMetroSubIcon();
            localStorage.setItem(METRONOME_SUBDIVISION_KEY, this.metronomeSubdivision ? '1' : '0');
        };

        // Boucle la partie active (bouton Grille) au lieu de jouer toute la grille — pratique
        // pour retravailler un couplet/refrain en boucle sans tout rejouer depuis le début à chaque
        // fois. Se désactive-t-elle en cours de lecture : la boucle en cours va jusqu'à son terme
        // naturel plutôt que de couper brutalement (voir playProgression).
        document.getElementById('toggle-loop-section').onclick = (e) => {
            this.loopActiveSection = !this.loopActiveSection;
            e.currentTarget.classList.toggle('active', this.loopActiveSection);
        };

        // Révèle/masque, d'un même bouton (« … »), tout ce qui est secondaire pour la plupart des
        // accords : qualités moins courantes (diminués, augmentés, enrichis...) ET renversement/drop/
        // octave — regroupés plutôt que répartis sur plusieurs boutons, qui faisaient un peu double
        // emploi. Les qualités passent par un vrai retrait/réinsertion des <option> du DOM (voir
        // toggleSelectOptions) plutôt que par `hidden`, qui n'est pas fiable sur tous les navigateurs
        // (Safari iOS notamment continue d'afficher des <option hidden> dans le sélecteur natif) ; les
        // champs avancés, eux, sont juste un bloc qu'on montre/cache (voir #advanced-fields).
        const qualitySelect = document.getElementById('quality');
        this._complexQualityOptions = Array.from(qualitySelect.querySelectorAll('option.opt-complex'));
        this.toggleSelectOptions(qualitySelect, this._complexQualityOptions, false); // masqué par défaut
        document.getElementById('toggle-complex-quality').onclick = (e) => {
            const btn = e.currentTarget;
            const show = !btn.classList.contains('active');
            this.toggleSelectOptions(qualitySelect, this._complexQualityOptions, show);
            document.getElementById('advanced-fields').hidden = !show; // inclut la basse différente, voir index.html
            btn.classList.toggle('active', show);
        };

        // Même principe pour les modes moins courants (dorien, phrygien, lydien, mixolydien, locrien).
        // Majeur/mineur restent nommés ainsi tant que les autres modes sont masqués (plus parlant pour
        // qui ne les connaît pas) ; une fois les 5 autres modes affichés, ils reprennent leur vrai nom
        // (ionien/éolien) pour rester cohérents avec le reste de la liste.
        const modeSelect = document.getElementById('global-mode');
        this._complexModeOptions = Array.from(modeSelect.querySelectorAll('option.opt-mode'));
        this.toggleSelectOptions(modeSelect, this._complexModeOptions, false); // masqué par défaut
        document.getElementById('toggle-complex-mode').onclick = (e) => {
            const btn = e.currentTarget;
            const show = !btn.classList.contains('active');
            this.toggleSelectOptions(modeSelect, this._complexModeOptions, show);
            modeSelect.querySelector('option[value="maj"]').textContent = show ? 'Ionien' : 'Majeur';
            modeSelect.querySelector('option[value="min"]').textContent = show ? 'Éolien' : 'Mineur';
            btn.classList.toggle('active', show);
        };

        document.getElementById('bpm').oninput = (e) => document.getElementById('bpm-val').value = e.target.value;
        // 'change' (relâchement du curseur), pas 'input' (à chaque pixel glissé) : un changement de
        // tempo redémarre toute la lecture en cours (voir liveRestartForGlobalChange), on ne veut pas
        // le redéclencher en rafale pendant qu'on fait encore glisser le curseur.
        document.getElementById('bpm').addEventListener('change', () => { hasUnsavedChanges = true; this.liveRestartForGlobalChange(); });

        // Valeur du tempo éditable directement au clavier (clic dessus, taper une valeur, Entrée ou
        // clic ailleurs pour valider) — resynchronisée avec le curseur, dans les mêmes bornes (60-240).
        const bpmSlider = document.getElementById('bpm');
        const bpmValInput = document.getElementById('bpm-val');
        bpmValInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') bpmValInput.blur(); });
        bpmValInput.addEventListener('change', () => {
            let v = parseInt(bpmValInput.value);
            if (isNaN(v)) v = parseInt(bpmSlider.value);
            v = Math.min(240, Math.max(60, v));
            bpmValInput.value = v;
            bpmSlider.value = v;
            hasUnsavedChanges = true;
            this.liveRestartForGlobalChange();
        });

        document.getElementById('tap-tempo').onclick = () => this.handleTapTempo();

        document.getElementById('global-root').onchange = () => {
            hasUnsavedChanges = true;
            this.updateKeyLabels(); this.loadProgression(); this.refreshPreview();
        };
        document.getElementById('global-mode').onchange = () => {
            hasUnsavedChanges = true;
            this.updateKeyLabels(); this.loadProgression(); this.refreshPreview();
        };
        document.getElementById('time-sig').onchange = () => {
            hasUnsavedChanges = true;
            this.updateDurationOptions();
            this.loadProgression();
            this.refreshPreview();
            this.renderSequencer();
            this.liveRestartForGlobalChange();
        };
        // Le groove ne change rien à l'affichage (la grille du séquenceur reste visuellement droite,
        // comme dans la plupart des séquenceurs/DAW : seul l'instant réel de chaque case se décale à
        // la lecture/l'export) — pas de re-rendu à déclencher ici, juste la sauvegarde du réglage, et
        // le redémarrage en direct d'une lecture en cours (voir liveRestartForGlobalChange).
        document.getElementById('groove').onchange = () => {
            hasUnsavedChanges = true;
            this.liveRestartForGlobalChange();
        };

        // Aperçu en direct : nom de l'accord, clavier et séquenceur mis à jour dès qu'on change un réglage
        // — et en mode Modification (voir commitLiveEdit), ce réglage s'écrit tout de suite dans
        // l'accord édité, pas besoin de cliquer Modifier (retour utilisateur). refreshGrid=true : ces
        // champs peuvent changer ce qu'affiche la case (symbole...). Appelé explicitement ici plutôt
        // que de compter sur le seul renderSequencer() juste au-dessus : celui-ci ne fait rien tant que
        // le panneau séquenceur est refermé (voir sa garde), ce qui n'empêche pourtant pas de changer
        // l'octave/la fondamentale/etc. avec le séquenceur fermé.
        ['root', 'quality', 'duration', 'inversion', 'drop', 'octave', 'bass'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                this.seqSelections = []; // les positions des cases peuvent ne plus correspondre au même accord
                this.clearSeqHistory(); // l'historique portait sur une autre forme d'accord
                this.refreshPreview();
                this.renderSequencer();
                this.livePreviewUpdate(); // entendre le changement tout de suite si une lecture est en cours
                this.commitLiveEdit(true);
            });
        });

        // Choisir un style de lecture réinitialise le motif sur le point de départ correspondant
        document.getElementById('playStyle').onchange = () => {
            const chord = this.readChord();
            this.seqTouched = true;
            this.seqSelections = [];
            this.clearSeqHistory(); // nouveau motif de départ : l'ancien historique ne s'applique plus
            const { pattern, tie } = seqPreset(document.getElementById('playStyle').value, chord.getSeqMidiNotes().length, chord.beats * SEQ_STEPS_PER_BEAT);
            this.setLiveSeqPattern(pattern, tie);
            this.renderSequencer();
            this.refreshPreview();
            this.livePreviewUpdate();
            this.commitLiveEdit(true);
        };

        // Intensité (voir #intensity/computeVelocity) : pas de renderSequencer() systématique (n'affecte
        // ni le motif ni les cases, contrairement au bloc ['root','quality',...] ci-dessus) — seulement
        // si le mode studio est ouvert, dont les barres héritent de cette valeur globale pour les
        // croches sans réglage propre (voir la rangée de vélocité plus bas dans renderSequencer).
        document.getElementById('intensity').oninput = (e) => {
            const val = document.getElementById('intensity-val');
            if (val) val.textContent = e.target.value;
            // Plusieurs accords sélectionnés (Ctrl/Cmd+clic, voir toggleGridMultiSelect) : la barre
            // règle alors l'intensité de TOUT le groupe d'un coup plutôt que du seul accord en édition
            // (retour utilisateur) — chemin dédié, la case en édition n'ayant pas forcément de lien
            // avec cette sélection multiple.
            if (this.multiSelect.size > 0) {
                this.applyIntensityToSelection(+e.target.value);
                return;
            }
            if (this.studioMode) this.renderSequencer();
            this.livePreviewUpdate();
            this.commitLiveEdit(false); // n'affecte pas le symbole affiché dans la case
        };
        document.getElementById('toggle-studio-mode').onclick = (e) => {
            this.studioMode = !this.studioMode;
            localStorage.setItem(STUDIO_MODE_KEY, this.studioMode ? '1' : '0');
            e.currentTarget.classList.toggle('active', this.studioMode);
            this.renderSequencer();
        };

        // Glissé sur une barre de vélocité (mode studio, voir renderSequencer) : posés UNE SEULE FOIS ici
        // (pas à chaque renderSequencer(), qui recrée les barres à chaque rendu) — this._velDragStep
        // identifie la croche en cours plutôt qu'une référence DOM directe, justement parce que le
        // séquenceur peut se re-rendre (barre remplacée) pendant un même glissé sans l'interrompre.
        document.addEventListener('pointermove', (e) => {
            if (this._velDragStep == null) return;
            const bar = document.querySelector(`.seq-vel-bar[data-step="${this._velDragStep}"]`);
            if (bar) this.applyStudioVelocityFromClientY(bar, e.clientY);
        });
        document.addEventListener('pointerup', () => {
            if (this._velDragStep == null) return;
            this._velDragStep = null;
            this.seqTouched = true;
        });
        document.addEventListener('pointercancel', () => { this._velDragStep = null; });

        document.getElementById('toggle-sequencer').onclick = () => this.toggleSequencer();

        document.getElementById('cancel-edit').onclick = () => this.cancelEdit();

        document.getElementById('add-section').onclick = () => this.addSection();
        document.getElementById('transpose-song-down').onclick = () => this.transposeSong(-1);
        document.getElementById('transpose-song-up').onclick = () => this.transposeSong(1);

        document.getElementById('song-select').onchange = (e) => this.onSongSelectChange(e.target.value);
        document.getElementById('song-new').onclick = () => this.openNewSongModal();
        document.getElementById('song-save').onclick = () => this.saveCurrentSong();
        document.getElementById('song-rename').onclick = () => this.startInlineRenameSongMain();

        // Renommer le morceau ouvert : double-clic (souris) / double-tap (doigt) directement sur son
        // titre fait la même chose que le bouton crayon ci-dessus — geste raccourci en plus du bouton,
        // pas à sa place. Détection manuelle par minuterie sur `pointerdown` (comme le double-tap
        // d'édition de la grille, voir onGridPointerUp) plutôt que l'événement natif `dblclick` : sur
        // un <select>, le SECOND appui ouvrirait sinon son menu déroulant natif avant qu'un dblclick ne
        // puisse être détecté — preventDefault() dès CE pointerdown l'empêche.
        let lastSongTitleTap = 0;
        document.getElementById('song-select').addEventListener('pointerdown', (e) => {
            const now = Date.now();
            if (now - lastSongTitleTap < 450) {
                e.preventDefault();
                lastSongTitleTap = 0;
                this.startInlineRenameSongMain();
            } else {
                lastSongTitleTap = now;
            }
        });

        // Fenêtre Paramètres : toutes les sections (Son, Fichiers) se rendent ensemble à l'ouverture,
        // en une seule vue qui défile, sans onglet.
        document.getElementById('open-settings').onclick = () => this.openSettings();
        document.getElementById('toggle-sidebar').onclick = () => this.toggleSidebar();

        // Accès rapide bibliothèque (voir #quick-library-export/-import dans index.html) : mêmes
        // méthodes que le panneau Paramètres > Fichiers (exportLibrary/importLibraryFile), juste un
        // second point d'entrée plus court.
        document.getElementById('quick-library-export').onclick = () => this.exportLibrary();
        const quickImportInput = document.getElementById('quick-library-import-input');
        document.getElementById('quick-library-import').onclick = () => quickImportInput.click();
        quickImportInput.onchange = () => {
            const file = quickImportInput.files[0];
            quickImportInput.value = ''; // permet de resélectionner le même fichier ensuite
            if (file) this.importLibraryFile(file);
        };
        document.getElementById('settings-close').onclick = () => this.closeSettings();
        document.querySelectorAll('.settings-tab').forEach(btn => {
            btn.onclick = () => this.setSettingsTab(btn.dataset.settingsTab);
        });
        document.getElementById('settings-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'settings-overlay') this.closeSettings(); // clic sur le fond, pas la fenêtre
        });

        // Boîte "modifications non enregistrées" (voir confirmDiscardUnsavedIfNeeded) : clic sur le
        // fond = comme Annuler, jamais une perte de données silencieuse.
        document.getElementById('unsaved-modal').addEventListener('click', (e) => {
            if (e.target.id === 'unsaved-modal' && this._unsavedModalCancel) this._unsavedModalCancel();
        });

        // Nouveau morceau (voir openNewSongModal) : clic sur le fond = Annuler, comme Paramètres.
        document.getElementById('new-song-modal').addEventListener('click', (e) => {
            if (e.target.id === 'new-song-modal') document.getElementById('new-song-cancel').click();
        });

        // Choix export MIDI (voir chooseMidiExportMode) : clic sur le fond = Annuler, même principe.
        document.getElementById('midi-export-modal').addEventListener('click', (e) => {
            if (e.target.id === 'midi-export-modal' && this._midiExportModalCancel) this._midiExportModalCancel();
        });

        // Vue agrandie du séquenceur (voir openSeqZoom/closeSeqZoom) : ne fait que déplacer
        // #arp-sequencer dans une fenêtre plus grande, jamais le dupliquer.
        document.getElementById('seq-zoom').onclick = () => this.openSeqZoom();
        document.getElementById('seq-zoom-close').onclick = () => this.closeSeqZoom();
        document.getElementById('seq-zoom-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'seq-zoom-overlay') this.closeSeqZoom(); // clic sur le fond, pas la fenêtre
        });
        this._bindZoomButtons('seq', { inH: 'seq-zoom-in-h', outH: 'seq-zoom-out-h', inV: 'seq-zoom-in-v', outV: 'seq-zoom-out-v' });
        // Ctrl+molette : ne zoome qu'une fois la fenêtre agrandie déjà ouverte (elle seule reçoit
        // l'évènement, cachée sinon) — jamais sur le séquenceur "en place" dans le panneau Lecture.
        // Zoome les deux axes à la fois (voir adjustZoomBothAxes) — retour utilisateur, plus simple
        // et plus prévisible qu'un axe séparé selon Maj.
        this._bindCtrlWheelZoom('seq-zoom-host', 'seq');
        // Pincer-zoomer (2 doigts, voir setupPinchZoom) : équivalent tactile du Ctrl+molette ci-dessus,
        // pour mobile où ni Ctrl ni molette n'existent (retour utilisateur).
        this.setupPinchZoom(document.getElementById('seq-zoom-host'), 'seq');
        // Glisser à DEUX doigts pour faire défiler le séquenceur (voir setupPinchZoom/pan) SANS jamais
        // risquer de peindre/étirer une note par erreur — retour utilisateur : "éviter les
        // modifications non voulues, un déplacement juste après le clic pourrait ressembler à un
        // scroll". Posé UNE FOIS sur #arp-sequencer (stable, jamais reconstruit ni dupliqué — voir
        // renderSequencer/openSeqZoom/pinSequencerHost) plutôt que sur chacun de ses hôtes possibles :
        // il reste actif tel quel qu'on édite en place (compact), dans la loupe séquenceur, ou dans le
        // séquenceur épinglé de la loupe grille, sans rien câbler de plus à ces deux derniers — zoom:
        // false ici, le pincement à 2 doigts POSÉ SUR CET ÉLÉMENT ne fait donc jamais double emploi
        // avec le zoom (lui aussi actif, séparément) des hôtes agrandis ci-dessus/plus bas.
        this.setupPinchZoom(document.getElementById('arp-sequencer'), 'seq', { zoom: false, pan: true });

        // Échelles horizontale/verticale de la grille CLASSIQUE (hors loupe, voir currentGridHZoom/
        // applyZoomLevel('classicGrid')) — indépendantes de celles de la loupe ci-dessous.
        this._bindZoomButtons('classicGrid', { inH: 'classic-grid-in-h', outH: 'classic-grid-out-h', inV: 'classic-grid-in-v', outV: 'classic-grid-out-v' });
        // Ctrl+molette sur la grille elle-même, comme les fenêtres agrandies (voir adjustZoomBothAxes).
        this._bindCtrlWheelZoom('progression-sections', 'classicGrid', () => this.gridZoomOpen);

        document.getElementById('toggle-voice-leading').onclick = () => this.toggleVoiceLeadingPanel();

        // Vue agrandie de la grille d'accords (voir openGridZoom/closeGridZoom) : même principe,
        // déplace #progression-sections + le bouton "Ajouter une partie" plutôt que de les dupliquer.
        document.getElementById('grid-zoom').onclick = () => this.openGridZoom();
        document.getElementById('grid-zoom-close').onclick = () => this.closeGridZoom();
        document.getElementById('grid-zoom-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'grid-zoom-overlay') this.closeGridZoom();
        });
        this._bindZoomButtons('grid', { inH: 'grid-zoom-in-h', outH: 'grid-zoom-out-h', inV: 'grid-zoom-in-v', outV: 'grid-zoom-out-v' });

        // Accord/Grille/Boucle/Stop dans l'en-tête de la loupe grille (voir index.html) : déclenchent
        // les VRAIS boutons du pied de colonne (.click()) plutôt que de réécrire leur logique à côté —
        // un seul endroit à maintenir si elle change. La loupe masquait ce pied de colonne derrière
        // elle, il fallait la fermer pour lire quoi que ce soit (retour utilisateur).
        document.getElementById('grid-zoom-play-chord').onclick = () => document.getElementById('play').click();
        document.getElementById('grid-zoom-play-prog').onclick = () => document.getElementById('play-prog').click();
        document.getElementById('grid-zoom-stop').onclick = () => document.getElementById('stop').click();
        const gridZoomLoopBtn = document.getElementById('grid-zoom-loop');
        gridZoomLoopBtn.onclick = () => {
            document.getElementById('toggle-loop-section').click();
            gridZoomLoopBtn.classList.toggle('active', this.loopActiveSection);
        };
        // Annuler/Rétablir (voir global-undo-btn/global-redo-btn) : même relais, pour pouvoir corriger
        // une erreur sur la grille sans quitter la loupe (retour utilisateur, notamment sur téléphone
        // où Ctrl+Z n'existe pas) — voir aussi updateGlobalUndoRedoButtons, qui synchronise leur état
        // désactivé/activé en même temps que les boutons d'origine.
        document.getElementById('grid-zoom-undo').onclick = () => document.getElementById('global-undo-btn').click();
        document.getElementById('grid-zoom-redo').onclick = () => document.getElementById('global-redo-btn').click();
        this._bindCtrlWheelZoom('grid-zoom-host', 'grid');
        this.setupPinchZoom(document.getElementById('grid-zoom-host'), 'grid');

        // Séquenceur épinglé en bas de la loupe grille (voir editChordFromGridZoom/
        // syncGridZoomPinnedSeq) : Enregistrer/Annuler réutilisent tels quels saveCurrent/cancelEdit
        // (peu importe d'où vient le clic, ces méthodes ne lisent que les contrôles du panneau Accord,
        // toujours dans le DOM même masqués derrière la loupe).
        document.getElementById('grid-zoom-pinned-save').onclick = () => { this.saveCurrent(); this.syncGridZoomPinnedSeq(); };
        document.getElementById('grid-zoom-pinned-cancel').onclick = () => { this.cancelEdit(); this.syncGridZoomPinnedSeq(); };
        document.getElementById('grid-zoom-pinned-toggle').onclick = () => this.toggleGridZoomPinnedSeq();
        this.setupGridZoomPinnedResize();
        // Ctrl+molette/pincer-zoomer sur le séquenceur ÉPINGLÉ de la loupe grille aussi (voir
        // pinSequencerHost/applyZoomLevel('seq'), qui partage déjà le même réglage que #seq-zoom-host
        // ci-dessus) — jusqu'ici seule la loupe séquenceur AUTONOME les avait, pas ce mode épinglé,
        // pourtant le plus utilisé sur mobile (retour utilisateur).
        this._bindCtrlWheelZoom('grid-zoom-pinned-body', 'seq');
        this.setupPinchZoom(document.getElementById('grid-zoom-pinned-body'), 'seq');

        // Menu contextuel (clic droit / appui long) : Renommer/Modifier, Dupliquer (accords
        // uniquement), Supprimer — réutilisé pour les morceaux, les dossiers ET les accords de la
        // grille (voir attachContextMenuTrigger, appelé depuis renderFilesPanel et loadProgression).
        document.querySelector('[data-ctx-action="rename"]').onclick = () => {
            const t = this.contextMenuTarget;
            this.closeContextMenu();
            if (!t) return;
            if (t.type === 'song') this.startInlineRenameSong(t.id);
            else if (t.type === 'folder') this.startInlineRenameFolder(t.name);
            else if (t.type === 'chord') this.editChord(t.section, t.index);
        };
        document.querySelector('[data-ctx-action="duplicate"]').onclick = () => {
            const t = this.contextMenuTarget;
            this.closeContextMenu();
            if (t && t.type === 'chord') this.duplicateChord(t.section, t.index);
        };
        document.querySelector('[data-ctx-action="octave-up"]').onclick = () => {
            const t = this.contextMenuTarget;
            this.closeContextMenu();
            if (t && t.type === 'chord') this.changeChordOctave(t.section, t.index, 1);
        };
        document.querySelector('[data-ctx-action="octave-down"]').onclick = () => {
            const t = this.contextMenuTarget;
            this.closeContextMenu();
            if (t && t.type === 'chord') this.changeChordOctave(t.section, t.index, -1);
        };
        document.querySelector('[data-ctx-action="sequencer"]').onclick = () => {
            const t = this.contextMenuTarget;
            this.closeContextMenu();
            if (t && t.type === 'chord') this.openSequencerFor(t.section, t.index);
        };
        document.querySelector('[data-ctx-action="delete"]').onclick = () => {
            const t = this.contextMenuTarget;
            this.closeContextMenu();
            if (!t) return;
            if (t.type === 'song') this.deleteSongById(t.id);
            else if (t.type === 'folder') this.deleteFolder(t.name);
            // Contrairement à Suppr au clavier (rapide, protégé par Ctrl+Z) : ce chemin est le SEUL
            // moyen de supprimer un accord sur tactile (plus de petit bouton dédié), une confirmation
            // évite qu'un appui long malheureux n'efface un accord sans qu'on s'en rende compte.
            else if (t.type === 'chord') { if (confirm('Supprimer cet accord ?')) this.removeChord(t.section, t.index); }
        };
        document.addEventListener('pointerdown', (e) => {
            const menu = document.getElementById('context-menu');
            if (!menu.hidden && !menu.contains(e.target)) this.closeContextMenu();
        });
        // Clic en dehors du popup « où insérer ? » (voir openSectionPicker) : referme sans rien
        // ajouter, comme le menu contextuel ci-dessus.
        document.addEventListener('pointerdown', (e) => {
            const picker = document.getElementById('section-picker-menu');
            if (!picker.hidden && !picker.contains(e.target)) this.closeSectionPicker();
        });
        // Clic en dehors du popup « ce morceau / toute la bibliothèque ? » (voir openBackupScopeMenu)
        document.addEventListener('pointerdown', (e) => {
            const menu = document.getElementById('backup-scope-menu');
            if (!menu.hidden && !menu.contains(e.target)) this.closeBackupScopeMenu();
        });
        // Clic en dehors du popup de suggestion de tonalité (voir openKeySuggestMenu)
        document.addEventListener('pointerdown', (e) => {
            const menu = document.getElementById('key-suggest-menu');
            if (!menu.hidden && !menu.contains(e.target) && e.target.id !== 'key-suggest-btn') this.closeKeySuggestMenu();
        });
        // Clic en dehors du popover d'aide de l'ajout rapide (voir openQuickAddHelp) — sauf sur le
        // bouton ampoule lui-même, qui gère déjà son propre bascule ouverture/fermeture.
        document.addEventListener('pointerdown', (e) => {
            const help = document.getElementById('quick-add-help');
            const btn = document.getElementById('quick-add-help-btn');
            if (!help.hidden && !help.contains(e.target) && !btn.contains(e.target)) this.closeQuickAddHelp();
        });

        // Désélectionne l'accord de la grille dès qu'on clique en dehors de la grille et du menu
        // contextuel — évite l'ambiguïté entre l'accord SÉLECTIONNÉ (voir bouton « Accord » ci-
        // dessus) et l'accord affiché dans le panneau, une fois qu'on est passé à autre chose.
        // En phase 'click' (pas 'pointerdown') : un bouton comme « Grille » lit encore selectedIndex
        // (démarrage depuis l'accord en surbrillance) dans son propre clic AVANT que celui-ci ne
        // remonte jusqu'ici et déselectionne.
        // Annule aussi une édition en cours (referme facilement le contour orange sans chercher le
        // bouton Annuler) — mais SEULEMENT en dehors du panneau Accord/séquenceur (.col-left, qui
        // contient aussi bien les réglages BPM/instrument/Grille que le séquenceur) : contrairement à
        // la sélection, y cliquer fait partie de l'édition elle-même, pas un clic « ailleurs ».
        document.addEventListener('click', (e) => {
            // e.target.closest(...) suit le DOM ACTUEL, pas celui d'au moment du clic : un bouton du
            // séquenceur (ex. « + » une note libre, voir addSequencerNote) déclenche souvent un
            // renderSequencer() synchrone qui remplace tout le HTML du panneau — DONC son propre
            // bouton — avant même que ce clic ne finisse de remonter jusqu'ici. e.target se retrouve
            // alors détaché du document, et .closest() ne retombe plus sur rien (retour utilisateur :
            // ajouter une note libre sortait silencieusement du mode édition, exactement comme l'ancien
            // bug déjà noté ci-dessous pour le séquenceur agrandi). composedPath() fige au contraire le
            // chemin de propagation TEL QU'IL ÉTAIT au moment du clic, donc reste fiable même si les
            // éléments d'origine ont depuis été remplacés.
            const path = e.composedPath();
            const inPath = (selector) => path.some(el => el instanceof Element && el.matches(selector));
            const inGrid = inPath('.chord-grid');
            const inMenu = inPath('#context-menu');
            // .grid-zoom-modal ET .seq-zoom-modal inclus : le séquenceur (épinglé dans la loupe grille,
            // ou dans sa propre vue agrandie, voir openSeqZoom) et ses boutons (Enregistrer/Annuler/
            // replier, poignée de redimensionnement...) y vivent, hors de .chord-grid ET de .col-left —
            // sans cet ajout, ajouter une note ou supprimer une barre dans le séquenceur agrandi (ni
            // l'un ni l'autre) sortait silencieusement du mode édition en cours, perdant la
            // modification (retour utilisateur : les boutons Modifier/Annuler disparaissaient).
            // .chord-header-row et .viz-wrap (titre + diagrammes piano/guitare) vivent eux aussi hors de
            // .col-left (dans .col-right, à côté de la grille) : sans eux ici, cycler un doigté ou
            // verrouiller la guitare (#guitar-next/#guitar-lock-btn) sortait silencieusement du mode
            // édition — this.editingIndex retombait à null, et Enregistrer AJOUTAIT alors un nouvel
            // accord au lieu de remplacer celui en cours, perdant le verrou tout juste posé (retour
            // utilisateur : « le cadenas ne fonctionne plus »).
            const inEditor = inPath('.col-left') || inPath('.grid-zoom-modal') || inPath('.seq-zoom-modal')
                || inPath('.chord-header-row') || inPath('.viz-wrap');
            // Boutons qui OUVRENT une vue agrandie depuis l'accord déjà sélectionné/en édition (voir
            // openGridZoom/openSeqZoom, appelés par LEUR PROPRE onclick avant que ce même clic ne
            // remonte jusqu'ici) : #grid-zoom-modal/#seq-zoom-modal n'existent pas encore dans le
            // chemin du clic à cet instant (le bouton qui les ouvre vit EN DEHORS, jamais dedans), donc
            // inEditor ci-dessus ne les reconnaît pas — sans cette exception, ce même clic désélectionnait
            // aussitôt l'accord ET refermait l'édition tout juste rouverte par ce bouton (retour
            // utilisateur : "je ne vois plus la surbrillance" après avoir ouvert la loupe).
            const opensZoomView = inPath('#grid-zoom') || inPath('#seq-zoom');
            let changed = false;
            if (!opensZoomView && !inGrid && !inMenu && this.selectedIndex != null) { this.selectedIndex = null; changed = true; }
            if (!opensZoomView && !inGrid && !inMenu && !inEditor && this.editingIndex != null) { this.exitEditMode(); changed = true; }
            if (changed) this.loadProgression();
        });

        document.getElementById('export-pdf').onclick = () => this.exportPdf();
        document.getElementById('export-midi').onclick = () => this.exportMidi();
        document.getElementById('export-audio').onclick = () => this.exportAudio();
        document.getElementById('export-lyrics').onclick = () => this.exportLyricsData();
        document.getElementById('export-backup').onclick = (e) => this.openBackupScopeMenu(e.currentTarget);
        document.getElementById('key-suggest-btn').onclick = (e) => this.openKeySuggestMenu(e.currentTarget);

        // Bascule piano/guitare : indépendantes, les deux peuvent s'afficher côte à côte ou aucune.
        document.getElementById('toggle-viz-piano').onclick = () => {
            localStorage.setItem('harmohubShowPiano', this.showPianoViz() ? '0' : '1');
            this.applyVizVisibility();
        };
        document.getElementById('toggle-viz-guitar').onclick = () => {
            const wasOn = this.showGuitarViz();
            localStorage.setItem('harmohubShowGuitar', wasOn ? '0' : '1');
            this.applyVizVisibility();
            if (!wasOn) this.refreshPreview(); // vient d'être activée : calcule le diagramme de l'accord courant
        };
        document.getElementById('guitar-prev').onclick = () => this.cycleGuitarFingering(-1);
        document.getElementById('guitar-next').onclick = () => this.cycleGuitarFingering(1);
        document.getElementById('guitar-lock-btn').onclick = () => this.toggleGuitarLock();
        this.applyVizVisibility();
    }

    // Bascule la visibilité de certaines <option> d'un <select> en les retirant/réinsérant réellement
    // du DOM (plutôt que de jouer sur l'attribut `hidden`, qui n'est pas fiable dans tous les
    // navigateurs pour des <option> — certaines versions de Safari iOS continuent de les afficher
    // dans le sélecteur natif). Ne retire jamais l'option actuellement sélectionnée, pour ne pas
    // changer silencieusement la valeur en cours. `options` doit lister les <option> dans leur ordre
    // d'origine (elles sont réinsérées dans cet ordre, à la fin du select).
    toggleSelectOptions(select, options, show) {
        options.forEach(o => {
            if (show) {
                if (!o.isConnected) select.appendChild(o);
            } else if (o.value !== select.value && o.isConnected) {
                select.removeChild(o);
            }
        });
    }

    // Active le mode « plus d'options » du bouton « … » : qualités moins courantes ET renversement/
    // drop/octave ensemble (voir le onclick de toggle-complex-quality) — un seul bouton, un seul état
    // « actif », pour les deux à la fois. Ne fait rien s'il est déjà actif.
    activateMoreOptions() {
        const btn = document.getElementById('toggle-complex-quality');
        if (btn.classList.contains('active')) return;
        this.toggleSelectOptions(document.getElementById('quality'), this._complexQualityOptions, true);
        document.getElementById('advanced-fields').hidden = false; // inclut la basse différente, voir index.html
        btn.classList.add('active');
    }

    // Révèle le menu Qualité complet AVANT d'y affecter une valeur venue de données sauvegardées
    // (accord enregistré avec une qualité moins courante) — sinon, l'option correspondante n'existe
    // pas encore dans le DOM (voir toggleSelectOptions) et l'affectation échouerait silencieusement.
    // Même principe que pour la basse différente (voir editChord).
    revealComplexQualityIfNeeded(quality) {
        if (!this._complexQualityOptions.some(o => o.value === quality)) return;
        this.activateMoreOptions();
    }

    revealComplexModeIfNeeded(mode) {
        const btn = document.getElementById('toggle-complex-mode');
        if (btn.classList.contains('active') || !this._complexModeOptions.some(o => o.value === mode)) return;
        const modeSelect = document.getElementById('global-mode');
        this.toggleSelectOptions(modeSelect, this._complexModeOptions, true);
        modeSelect.querySelector('option[value="maj"]').textContent = 'Ionien';
        modeSelect.querySelector('option[value="min"]').textContent = 'Éolien';
        btn.classList.add('active');
    }

    // Révèle renversement/drop/octave en modifiant un accord qui s'en sert déjà (l'un des trois
    // s'écarte de son réglage par défaut), pour ne pas les laisser masqués sous les yeux de qui édite
    // sans le savoir — même principe que la basse (voir editChord) et les qualités complexes.
    revealAdvancedIfNeeded(d) {
        const needsAdvanced = (parseInt(d.inversion) || 0) !== 0
            || (d.drop && d.drop !== 'none')
            || octaveFromData(d) !== 3;
        if (!needsAdvanced) return;
        this.activateMoreOptions();
    }

    // Lit les réglages de l'interface et renvoie un Chord. Le doigté guitare verrouillé (voir
    // toggleGuitarLock) n'est PAS passé ici : ensureGuitarDiagram le fournit explicitement à
    // guitarFingeringsForChord (ce Chord est reconstruit à chaque frappe, il ne le porte jamais).
    readChord() {
        return new Chord(
            document.getElementById('root').value,
            document.getElementById('quality').value,
            document.getElementById('duration').value,
            document.getElementById('inversion').value,
            document.getElementById('drop').value,
            document.getElementById('octave').value,
            document.getElementById('bass').value || null,
            null,
            this.extraNotes
        );
    }

    // Tonalité du morceau -> faut-il orthographier les notes en bémols plutôt qu'en dièses ?
    useFlats() {
        const rootPc = NOTES.indexOf(document.getElementById('global-root').value);
        const mode = document.getElementById('global-mode').value;
        return useFlatsForKey(rootPc, mode);
    }

    // Convention dièse/bémol pour la fondamentale d'UN accord précis : part de la convention
    // générale du morceau, forcée en bémol pour les degrés chromatiques empruntés (voir
    // useFlatsForChordRoot). C'est ce choix qui doit être passé à Chord.getLabel/getSeqDisplayNotes,
    // jamais this.useFlats() directement, sous peine de mal orthographier les accords empruntés.
    useFlatsForRoot(root) {
        const gRootPc = NOTES.indexOf(document.getElementById('global-root').value);
        const gMode = document.getElementById('global-mode').value;
        return useFlatsForChordRoot(NOTES.indexOf(root), gRootPc, gMode, this.useFlats());
    }

    // Relabelle les listes déroulantes de notes (tonalité + accord) selon la convention dièses/bémols
    updateKeyLabels() {
        const mode = document.getElementById('global-mode').value;
        document.querySelectorAll('#global-root option').forEach(opt => {
            const pc = NOTES.indexOf(opt.value);
            opt.textContent = noteNameForPc(pc, useFlatsForKey(pc, mode));
        });
        const songFlats = this.useFlats();
        document.querySelectorAll('#root option').forEach(opt => {
            const pc = NOTES.indexOf(opt.value);
            opt.textContent = noteNameForPc(pc, songFlats);
        });
        document.querySelectorAll('#bass option[value]:not([value=""])').forEach(opt => {
            const pc = NOTES.indexOf(opt.value);
            opt.textContent = 'Basse ' + noteNameForPc(pc, songFlats); // garde le préfixe (voir index.html)
        });
    }

    // Temps par mesure de la signature rythmique du morceau (4/4 par défaut)
    beatsPerBar() {
        return TIME_SIG_BEATS[document.getElementById('time-sig').value] || 4;
    }

    // Taux de groove du morceau (droit par défaut) : voir GROOVE_RATIOS/grooveStepOffset.
    grooveRatio() {
        return GROOVE_RATIOS[document.getElementById('groove').value] ?? GROOVE_RATIOS.straight;
    }

    // Aligne les valeurs (en temps) de « 1/2/4 mesures » sur la signature rythmique courante,
    // en conservant Noire/Blanche à 1 et 2 temps quelle que soit la mesure
    updateDurationOptions() {
        const bpb = this.beatsPerBar();
        const values = [1, 2, bpb, bpb * 2, bpb * 4];
        document.querySelectorAll('#duration option').forEach((opt, i) => {
            if (values[i] != null) opt.value = values[i];
        });
    }

    // Met à jour le grand titre + la liste de notes, sans jouer de son
    refreshPreview() {
        const chord = this.readChord();
        const midis = chord.getMidiNotes();
        const useFlats = this.useFlatsForRoot(chord.root);
        const disp = document.getElementById('current-chord-display');
        disp.innerHTML = `<span class="chord-title">${flatTight(chord.getLabel(useFlats))}</span><span class="chord-notes">${chordNotesHtml(chord, useFlats)}</span>`;
        this.ensurePianoWindow(midis);
        this.updateViz(midis, chord.getRoleMap());
        this.ensureGuitarDiagram(chord);
    }

    // Calcule une fenêtre clavier (multiple de 12, alignée sur des Do) englobant l'accord,
    // d'au moins 2 octaves, étendue à 3 seulement si le voicing est très étalé
    computePianoWindow(midis) {
        if (!midis || midis.length === 0) return { low: 48, high: 72 }; // C3..C5 par défaut
        const min = Math.min(...midis), max = Math.max(...midis);
        const floorC = m => m - (((m % 12) + 12) % 12);
        const ceilC = m => { const r = ((m % 12) + 12) % 12; return r === 0 ? m : m + (12 - r); };
        let low = floorC(min), high = ceilC(max);
        while (high - low < 24) {
            if ((min - low) <= (high - max)) low -= 12; else high += 12;
        }
        return { low, high };
    }

    // Re-render le clavier si la fenêtre a changé (évite les re-render inutiles pendant un arpège)
    ensurePianoWindow(midis) {
        const w = this.computePianoWindow(midis);
        if (this.pianoWindow && this.pianoWindow.low === w.low && this.pianoWindow.high === w.high) return;
        this.pianoWindow = w;
        this.renderPiano(w.low, w.high);
    }

    renderPiano(low = 48, high = 72) {
        const viz = document.getElementById('piano-viz');
        viz.innerHTML = '';

        // 1) Touches blanches en flux (flex, largeur égale)
        const whiteMidis = [];
        for (let m = low; m <= high; m++) {
            if (![1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12)) whiteMidis.push(m);
        }
        whiteMidis.forEach(m => {
            const k = document.createElement('div');
            k.className = 'key white';
            k.dataset.midi = m;
            viz.appendChild(k);
        });

        const totalWhite = whiteMidis.length;
        // Largeur cible d'une blanche (≈17px, 50% de la taille d'origine pour mettre en valeur la
        // grille d'accords) -> le clavier ne s'étire pas sur les grands écrans, et reste réaliste ;
        // sur mobile il rétrécit (width: 100%).
        viz.style.maxWidth = `${totalWhite * 17}px`;

        // 2) Touches noires : largeur ≈62% d'une blanche, centrées sur la frontière (tout en %)
        const unit = 100 / totalWhite;      // largeur d'une blanche en % du clavier
        const blackW = unit * 0.62;
        let whiteSeen = 0;
        for (let m = low; m <= high; m++) {
            const isBlack = [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
            if (!isBlack) { whiteSeen++; continue; }
            const k = document.createElement('div');
            k.className = 'key black';
            k.dataset.midi = m;
            k.style.width = `${blackW}%`;
            k.style.left = `calc(${whiteSeen * unit}% - ${blackW / 2}%)`;
            viz.appendChild(k);
        }
    }

    // `midis` : numéros MIDI à surligner ; `roleMap` : { midi: role } (voir Chord.getRoleMap)
    updateViz(midis, roleMap = {}) {
        const ROLE_CLASSES = ['active', 'role-root', 'role-third', 'role-fifth', 'role-seventh', 'role-ext'];
        document.querySelectorAll('.key').forEach(k => k.classList.remove(...ROLE_CLASSES));
        midis.forEach(m => {
            const el = document.querySelector(`.key[data-midi="${m}"]`);
            if (el) {
                el.classList.add('active', 'role-' + (roleMap[m] || 'ext'));
            }
        });
    }

    clearViz() {
        document.querySelectorAll('.key').forEach(k =>
            k.classList.remove('active', 'role-root', 'role-third', 'role-fifth', 'role-seventh', 'role-ext'));
    }

    // Recalcule les doigtés guitare seulement si l'accord a changé — évite de tout reconstruire à
    // chaque croche pendant un arpège, comme ensurePianoWindow pour le clavier. Prend le CHORD ENTIER
    // (pas juste ses notes) : à la guitare, les doigts restent posés sur tout l'accord du début à la
    // fin (contrairement au piano), et le ton/qualité sont nécessaires pour choisir une forme
    // communément enseignée plutôt que le voicing brut (voir guitarFingeringsForChord).
    // `useLiveLock` (true par défaut) : this.guitarLock est le verrou EN COURS D'ÉDITION (panneau
    // Accord, lu/écrit par toggleGuitarLock/editChord) — juste pour readChord(), qui ne porte jamais
    // ce champ (voir plus haut). Faux pour un simple aperçu en LECTURE SEULE d'un accord déjà enregistré
    // (playSavedChord/scheduleProgressionChord, lecture de toute la grille) : là, `chord` porte déjà
    // SON PROPRE verrou (chord.guitarLock, restauré depuis les données), qu'il faut afficher tel quel
    // — jamais celui, sans rapport, resté en mémoire depuis une précédente session d'édition (bug
    // corrigé : le cadenas semblait « ne plus se bloquer » dès qu'on refermait l'édition et qu'on se
    // contentait d'écouter l'accord, cf. #guitar-lock-btn resté désaccordé de l'accord réellement
    // affiché).
    ensureGuitarDiagram(chord, useLiveLock = true) {
        if (!this.showGuitarViz()) return;
        // Un changement RÉEL d'accord invalide un verrou EN COURS D'ÉDITION : la forme mémorisée (case
        // par corde) ne correspondrait plus aux bonnes notes. « Réel » se juge sur l'IDENTITÉ de
        // l'accord (racine/qualité/renversement/drop/octave/basse) — jamais sur les notes libres du
        // séquenceur (extraNotes, voir addSequencerNote), qui ne sont qu'un embellissement mélodique
        // indépendant : peindre une note de passage ne doit pas faire sauter un doigté verrouillé
        // (retour utilisateur). Seuls editChord (restaure le verrou déjà enregistré) et toggleGuitarLock
        // (vient justement de le poser/lever) doivent survivre à un changement d'identité, via ce
        // drapeau à usage unique. Sans objet en lecture seule (chord.guitarLock est déjà exactement
        // celui de CET accord, jamais périmé).
        if (useLiveLock) {
            const identityKey = `${chord.root}:${chord.quality}:${chord.getEffectiveInversion()}:${chord.drop}:${chord.octave}:${chord.bass || ''}`;
            if (!this._keepGuitarLockOnce && this.guitarIdentityKey !== identityKey) this.guitarLock = null;
            this.guitarIdentityKey = identityKey;
            this._keepGuitarLockOnce = false;
            // Le panneau live reprend la main : this.guitarPreviewPos (voir toggleGuitarLock) ne désigne
            // plus rien de fiable, sous peine d'écrire dans les données du DERNIER accord prévisualisé
            // en lecture seule au lieu de l'accord réellement en édition/Ajout.
            this.guitarPreviewPos = null;
        }
        const lockedShape = useLiveLock ? this.guitarLock : (chord.guitarLock || null);
        // Le verrou effectif fait partie de la clé : deux accords de mêmes notes mais verrouillés
        // différemment (ou un aperçu en lecture seule juste après une édition en direct) ne doivent pas
        // se retrouver à tort avec le même diagramme figé en cache.
        const key = `${chord.root}:${chord.quality}:${chord.getMidiNotes().join(',')}:${useLiveLock ? 'L' : 'D'}:${JSON.stringify(lockedShape)}`;
        if (this.guitarKey === key) return;
        this.guitarKey = key;
        this.guitarDisplayLock = lockedShape; // voir updateGuitarLockButton : reflète TOUJOURS le diagramme réellement affiché
        this.guitarFingerings = guitarFingeringsForChord(chord, lockedShape);
        this.guitarFingeringIndex = 0;
        this.renderGuitarDiagram();
    }

    renderGuitarDiagram() {
        const viz = document.getElementById('guitar-viz');
        if (!viz) return;
        const fingerings = this.guitarFingerings;
        const nav = document.getElementById('guitar-nav');
        if (!fingerings.length) {
            viz.innerHTML = `<div class="guitar-unplayable">Non jouable à la guitare</div>`;
            if (nav) nav.style.display = 'none';
            this.updateGuitarLockButton();
            return;
        }
        const idx = Math.min(this.guitarFingeringIndex, fingerings.length - 1);
        this.guitarFingeringIndex = idx;
        viz.innerHTML = this.buildGuitarDiagramSVG(fingerings[idx]);
        if (nav) {
            nav.style.display = fingerings.length > 1 ? '' : 'none';
            const label = document.getElementById('guitar-nav-label');
            if (label) label.textContent = `${idx + 1}/${fingerings.length}`;
        }
        this.updateGuitarLockButton();
    }

    // Reflète l'état verrouillé/libre sur le bouton cadenas, relatif au doigté ACTUELLEMENT AFFICHÉ
    // (this.guitarFingeringIndex) — pas juste « CET ACCORD a-t-il UN verrou quelque part » : naviguer
    // vers un AUTRE doigté (cycleGuitarFingering) pendant qu'un verrou existe ailleurs doit rouvrir
    // visuellement le cadenas, sinon il restait affiché fermé sur un doigté qui n'est PAS le verrouillé
    // (retour utilisateur : « le cadenas saute », un clic dessus libérait alors le verrou D'UN AUTRE
    // doigté invisible à l'écran au lieu de verrouiller celui réellement affiché — voir toggleGuitarLock
    // pour le même principe côté clic). this.guitarDisplayLock (voir ensureGuitarDiagram) plutôt que
    // this.guitarLock : ce dernier ne porte que le verrou EN COURS D'ÉDITION, jamais celui d'un accord
    // simplement écouté/prévisualisé (useLiveLock=false) — sinon le cadenas semblait éteint dès qu'on
    // refermait l'édition.
    updateGuitarLockButton() {
        const btn = document.getElementById('guitar-lock-btn');
        if (!btn) return;
        btn.style.display = this.guitarFingerings.length ? '' : 'none';
        const shown = this.guitarFingerings[this.guitarFingeringIndex];
        const shownShape = shown ? shown.map(f => f ? f.fret : null) : null;
        const locked = !!this.guitarDisplayLock && !!shownShape && JSON.stringify(this.guitarDisplayLock) === JSON.stringify(shownShape);
        btn.classList.toggle('active', locked);
        btn.setAttribute('aria-pressed', locked);
        btn.title = locked ? 'Doigté verrouillé pour cet accord (cliquer pour libérer)' : 'Verrouiller ce doigté pour cet accord';
        btn.setAttribute('aria-label', btn.title);
        btn.innerHTML = locked
            ? `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`
            : `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/></svg>`;
    }

    cycleGuitarFingering(delta) {
        if (!this.guitarFingerings.length) return;
        const n = this.guitarFingerings.length;
        this.guitarFingeringIndex = (this.guitarFingeringIndex + delta + n) % n;
        this.renderGuitarDiagram();
    }

    // Verrouille/libère le doigté ACTUELLEMENT AFFICHÉ (this.guitarFingeringIndex) pour l'accord en
    // cours (voir guitarFingeringsForChord) : verrouillé, il passe en tête de liste et devient celui
    // utilisé par défaut dans la grille et le PDF, jusqu'à ce qu'on le libère ou qu'on change réellement
    // l'accord (racine/qualité/voicing). Compare au doigté AFFICHÉ, pas juste à « un verrou existe-t-il
    // déjà » : sinon, verrouiller le doigté 1, naviguer vers le doigté 2 (voir cycleGuitarFingering) puis
    // cliquer de nouveau libérait à tort le verrou du doigté 1 (invisible à l'écran) au lieu de
    // verrouiller celui réellement affiché — retour utilisateur, « le cadenas saute ». commitLiveEdit
    // persiste tout de suite en mode Modification, comme tout autre réglage du panneau (retour
    // utilisateur : sans cet appel, le cadenas semblait se fermer puis se rouvrir tout seul — il
    // n'écrivait en fait jamais rien dans la grille, puisque Enregistrer/Ajouter est justement masqué en
    // mode Modification, seule persistance possible avant cet appel). Sans effet en mode Ajout
    // (commitLiveEdit s'arrête tout de suite si appMode !== 'edit') : là, saveCurrent capture bien
    // this.guitarLock au moment d'Ajouter.
    toggleGuitarLock() {
        const fingerings = this.guitarFingerings;
        if (!fingerings.length) return;
        const current = fingerings[this.guitarFingeringIndex];
        const currentShape = current.map(f => f ? f.fret : null);

        // Simple aperçu (clic simple pour écouter, PAS d'édition ouverte, voir guitarPreviewPos) : le
        // panneau Accord ne vise pas forcément cet accord (il ne se synchronise qu'en édition, voir
        // editChord) — passer par readChord()/commitLiveEdit ci-dessous écrirait alors dans le mauvais
        // accord, voire dans rien du tout (commitLiveEdit s'arrête hors édition). Retour utilisateur :
        // cliquer le cadenas juste après un simple clic sur la grille n'avait aucun effet réel. On écrit
        // donc directement dans les données de CET accord précis, comme startInlineChordSymbolEdit/
        // changeChordOctave pour les autres réglages accessibles sans passer par le panneau.
        if (this.guitarPreviewPos) {
            const { section, index } = this.guitarPreviewPos;
            const sections = loadProgressionSections();
            const data = sections[section] && sections[section].chords[index];
            if (!data) return;
            const shownIsLocked = data.guitarLock && JSON.stringify(data.guitarLock) === JSON.stringify(currentShape);
            this.pushUndo(sections);
            data.guitarLock = shownIsLocked ? null : currentShape;
            saveProgressionSections(sections);
            hasUnsavedChanges = true;
            const chord = new Chord(data.root, data.quality, beatsFromData(data), data.inversion, data.drop, octaveFromData(data), data.bass, data.guitarLock, data.extraNotes);
            this.guitarKey = null;
            this.ensureGuitarDiagram(chord, false);
            this.loadProgression();
            return;
        }

        const shownIsLocked = this.guitarLock && JSON.stringify(this.guitarLock) === JSON.stringify(currentShape);
        this.guitarLock = shownIsLocked ? null : currentShape;
        this._keepGuitarLockOnce = true;
        this.guitarKey = null; // force le recalcul de la liste (racine/qualité inchangées, sinon ignoré)
        this.ensureGuitarDiagram(this.readChord());
        this.commitLiveEdit(false); // n'affecte pas le symbole affiché dans la case
    }

    // Appelée UNIQUEMENT par stopAll() — donc à CHAQUE lecture (avant même de démarrer la suivante,
    // pas seulement sur un vrai clic Stop, voir playCurrent/playSavedChord/playProgression) : efface
    // juste l'AFFICHAGE (redessiné juste après par le ensureGuitarDiagram qui suit systématiquement,
    // même principe que clearViz() pour le clavier), jamais this.guitarLock lui-même — ce dernier est
    // l'état de l'ÉDITION EN COURS (propre à exitEditMode, seul à décider quand il n'a plus lieu
    // d'être), pas un sous-produit de la lecture. Bug corrigé : remettre ici this.guitarLock à null
    // l'effaçait juste après chaque restauration par editChord (elle-même suivie d'un aperçu audio
    // automatique, donc d'un stopAll()), rendant le cadenas visuellement inopérant dans l'usage réel.
    clearGuitarViz() {
        this.guitarKey = null;
        this.guitarFingerings = [];
        this.guitarFingeringIndex = 0;
        this.guitarDisplayLock = null;
        const viz = document.getElementById('guitar-viz');
        if (viz) viz.innerHTML = '';
        const nav = document.getElementById('guitar-nav');
        if (nav) nav.style.display = 'none';
        const lockBtn = document.getElementById('guitar-lock-btn');
        if (lockBtn) lockBtn.style.display = 'none';
    }

    // Préférences d'affichage piano/guitare (persistées) : indépendantes l'une de l'autre, les deux
    // peuvent être affichées côte à côte ou aucune des deux.
    showPianoViz() { return localStorage.getItem('harmohubShowPiano') !== '0'; }
    showGuitarViz() { return localStorage.getItem('harmohubShowGuitar') === '1'; }

    applyVizVisibility() {
        const showPiano = this.showPianoViz(), showGuitar = this.showGuitarViz();
        const pianoEl = document.getElementById('piano-viz');
        const guitarWrap = document.getElementById('guitar-viz-wrap');
        const legend = document.querySelector('.piano-legend');
        const disp = document.getElementById('current-chord-display');
        const tPiano = document.getElementById('toggle-viz-piano');
        const tGuitar = document.getElementById('toggle-viz-guitar');
        if (pianoEl) pianoEl.style.display = showPiano ? '' : 'none';
        if (guitarWrap) guitarWrap.style.display = showGuitar ? 'flex' : 'none';
        if (legend) legend.style.display = (showPiano || showGuitar) ? '' : 'none';
        // Sans aucun diagramme affiché, le nom d'accord + ses notes n'ont plus rien à accompagner —
        // les masquer plutôt que les laisser flotter seuls au-dessus d'un bloc vide.
        if (disp) disp.style.display = (showPiano || showGuitar) ? '' : 'none';
        if (tPiano) { tPiano.classList.toggle('active', showPiano); tPiano.setAttribute('aria-pressed', showPiano); }
        if (tGuitar) { tGuitar.classList.toggle('active', showGuitar); tGuitar.setAttribute('aria-pressed', showGuitar); }
    }

    stopAll() {
        this._playGen++;
        Tone.Transport.stop();
        Tone.Transport.cancel();
        Tone.Transport.loop = false;
        this.instrumentCache.forEach(inst => inst.releaseAll());
        this.clearViz();
        this.clearGuitarViz();
        this.highlightPlaying(null, null);
        this.isPlaying = false;
        this._playMode = null;
        this._progChordSlots = new Map();
        this.updateSeqPlayhead(null);
    }

    // Reflète un réglage tout juste changé (accord, style de jeu, séquenceur...) pendant qu'on écoute
    // — sans ça, il fallait cliquer Stop puis Lecture pour en entendre l'effet. Ne fait rien si rien
    // n'est en train de jouer (comportement inchangé en dehors de la lecture).
    // - Audition d'un seul accord (this._playMode === 'chord') : rejoué en entier, un bref redémarrage
    //   étant ici attendu et sans conséquence (bouton Lecture/Boucle dédié, pas la chanson entière).
    // - Chanson en cours (this._playMode === 'progression') : SEUL l'accord actuellement ouvert dans le
    //   panneau d'édition (this.activeSection/editingIndex) peut faire partie de ce qui joue — tente un
    //   patch en direct (voir liveUpdateProgressionChord), sans à-coup ni redémarrage depuis le début,
    //   sauf si la durée de l'accord a changé (décalage en cascade que patcher en direct ne peut pas
    //   éviter proprement) ou si l'accord modifié ne fait de toute façon pas partie du passage joué.
    livePreviewUpdate() {
        if (!this.isPlaying) return;
        if (this._playMode !== 'progression') { this.playCurrent(); return; }
        if (this.activeSection == null || this.editingIndex == null) return;
        if (this.liveUpdateProgressionChord(this.activeSection, this.editingIndex) === 'needs-restart') {
            this.playProgression();
        }
    }

    // Contrairement à livePreviewUpdate (patch local d'UN accord, voir liveUpdateProgressionChord) :
    // un changement GLOBAL de minutage — tempo, groove, signature rythmique, plage à boucler — décale
    // en cascade tout ce qui est déjà programmé sur le Transport (secPerBeat, timeOffset de chaque
    // accord...), qu'aucun patch local ne peut rattraper proprement. Retour utilisateur : "j'aimerais
    // que tout se mette à jour automatiquement... sans avoir à stopper et relancer la lecture" —
    // redémarre donc toujours la lecture en cours EN ENTIER (chanson/plage/accord, selon _playMode),
    // depuis le début du passage joué, mais SANS action manuelle (pas besoin de cliquer Stop puis
    // Lecture) : ce redémarrage bref est le même compromis déjà accepté pour l'audition d'un seul
    // accord (voir livePreviewUpdate ci-dessus).
    liveRestartForGlobalChange() {
        if (!this.isPlaying) return;
        if (this._playMode === 'progression') this.playProgression();
        else this.playCurrent();
    }

    // Bus partagé par TOUS les instruments de la lecture en direct (voir INSTRUMENT_BANKS) : une légère
    // réverbe (Freeverb, purement algorithmique — pas de temps de génération asynchrone à attendre,
    // contrairement à Tone.Reverb) donne une même « pièce » à l'ensemble, puis un limiteur absorbe les
    // pics quand plusieurs voix/instruments s'additionnent (retour utilisateur : sons stridents). Un
    // rendu hors-ligne (MP3, voir renderProgressionBuffer) a son propre contexte audio et construit donc
    // sa PROPRE instance équivalente, jamais celle-ci.
    getMasterBus() {
        if (!this._masterBus) {
            const limiter = new Tone.Limiter(-2).toDestination();
            this._masterBus = new Tone.Freeverb({ roomSize: 0.55, dampening: 3000, wet: 0.15 }).connect(limiter);
        }
        return this._masterBus;
    }

    // Instrument Tone.js pour cette banque, construit puis mis en cache au premier accord qui s'en
    // sert (plusieurs peuvent donc jouer en même temps, chaque accord ayant potentiellement la sienne).
    getInstrument(key) {
        if (!INSTRUMENT_BANKS[key]) key = 'piano';
        let inst = this.instrumentCache.get(key);
        if (!inst) {
            inst = INSTRUMENT_BANKS[key].build(this.getMasterBus());
            this.instrumentCache.set(key, inst);
        }
        return inst;
    }

    // Écoute rapide d'une seule voix du séquenceur (clic sur son étiquette à gauche) : ne coupe pas
    // une lecture en cours (contrairement à playCurrent/playSavedChord, pas de stopAll ici) — juste
    // une note isolée, pour vérifier une hauteur à l'oreille sans interrompre le reste.
    async previewSeqNote(voiceIndex) {
        await Tone.start();
        const chord = this.readChord();
        const note = chord.getSeqNotes()[voiceIndex];
        if (!note) return;
        const instrumentKey = document.getElementById('instrument').value;
        const inst = this.getInstrument(instrumentKey);
        try {
            inst.triggerAttackRelease(note, 0.5, Tone.now(), 0.85);
        } catch (e) {
            console.warn('Aperçu de note ignoré (instrument pas encore prêt) :', e.message);
        }
    }

    // Joue un motif de séquenceur (résolution croche) : regroupe les cases actives contiguës d'une
    // même voix en une seule note tenue plutôt que de rejouer une attaque à chaque croche — c'est ce
    // qui permet à un motif « tout allumé » de sonner comme un accord soutenu (Maintenu), tout en
    // restant un motif éditable case par case comme un vrai séquenceur pas-à-pas.
    // Renvoie la liste des identifiants Tone.Transport (Tone.Transport.schedule) créés pour CET appel
    // — Tone.Transport.clear(id) permet d'annuler UN SEUL évènement sans toucher au reste du calendrier
    // ni au transport lui-même (voir liveUpdateProgressionChord, qui patche un accord de la chanson en
    // cours de lecture en direct, sans à-coup, grâce à cette liste).
    schedulePlayback(notes, midis, seqPattern, seqTie, secPerBeat, timeOffset, roleMap = {}, instrumentKey = 'piano', chord = null, trackPlayhead = false, gridPos = null, intensityPercent = 75, intensityPerStep = null) {
        const eventIds = [];
        const instrument = this.getInstrument(instrumentKey);
        const stepDur = secPerBeat / SEQ_STEPS_PER_BEAT;
        const steps = seqPattern.length;
        // Instant réel d'une case, groove pris en compte (voir GROOVE_RATIOS/grooveStepOffset) : la
        // grille elle-même ne change pas, seul cet instant se décale.
        const ratio = this.grooveRatio();
        const stepTime = (s) => timeOffset + grooveStepOffset(s, stepDur, ratio);

        // Surbrillance clavier : à chaque croche, affiche les voix actives à cet instant précis.
        // trackPlayhead (uniquement pour playCurrent, jamais pour la lecture de toute la grille où
        // l'accord affiché dans le panneau n'est pas forcément celui qui sonne) anime en plus le
        // curseur de lecture du séquenceur, s'il est ouvert sur cet accord.
        for (let s = 0; s < steps; s++) {
            const activeMidis = seqPattern[s].map(v => midis[v]);
            eventIds.push(Tone.Transport.schedule((t) => {
                Tone.Draw.schedule(() => {
                    // Ce bloc tourne à CHAQUE croche de CHAQUE accord pendant la lecture de toute la
                    // grille : une exception ici importe silencieusement TOUT le traitement des
                    // évènements suivants du transport (même constat que pour triggerAttackRelease,
                    // voir plus bas) — la grille se figeait alors sur le premier accord concerné,
                    // quel que soit l'état du réseau ou de l'instrument. Un filet, comme pour le son.
                    try {
                        this.ensurePianoWindow(midis); this.updateViz(activeMidis, roleMap);
                        // trackPlayhead distingue déjà playCurrent (panneau EN COURS D'ÉDITION, chord =
                        // readChord()) de la lecture d'un accord déjà enregistré (scheduleProgressionChord/
                        // playSavedChord, chord porte son PROPRE verrou, voir ensureGuitarDiagram) : même
                        // signal, pas besoin d'un paramètre séparé. gridPos (lecture seule uniquement,
                        // voir schedulePlayback) permet à toggleGuitarLock de cibler le bon accord si on
                        // clique le cadenas pendant la lecture de toute la grille (voir guitarPreviewPos).
                        if (!trackPlayhead && gridPos) {
                            this.guitarPreviewPos = { section: gridPos.section, index: gridPos.index };
                            // `chord` est un instantané figé au lancement de CETTE lecture (voir
                            // playSavedChord/scheduleProgressionChord) — son guitarLock peut être PÉRIMÉ
                            // si on vient de verrouiller/déverrouiller pendant que l'accord sonne encore
                            // (plusieurs croches restent programmées) : le relire depuis les données à
                            // CHAQUE croche évite qu'un tick de lecture encore en vol n'écrase le cadenas
                            // tout juste posé par un diagramme périmé (retour utilisateur : « le cadenas
                            // se désactive »).
                            const freshData = loadProgressionSections()[gridPos.section]?.chords[gridPos.index];
                            if (freshData) chord.guitarLock = freshData.guitarLock || null;
                        }
                        if (chord) this.ensureGuitarDiagram(chord, trackPlayhead);
                        if (trackPlayhead) this.updateSeqPlayhead(s);
                        if (gridPos && chord) this.setGridPlayheadProgress(gridPos.section, gridPos.index, s / SEQ_STEPS_PER_BEAT, chord.beats);
                    } catch (e) {
                        console.warn('Mise à jour visuelle ignorée (croche', s, ') :', e.message);
                    }
                }, t);
            }, stepTime(s)));
        }

        // Son : une note tenue par plage de croches liées (une croche active mais NON liée
        // déclenche toujours une nouvelle attaque, même juste après une autre note)
        for (let voice = 0; voice < notes.length; voice++) {
            let s = 0;
            while (s < steps) {
                if (!seqPattern[s].includes(voice)) { s++; continue; }
                const runStart = s;
                s++;
                while (s < steps && seqPattern[s].includes(voice) && seqTie[s].includes(voice)) s++;
                const runLen = s - runStart;
                const held = (runLen === steps);          // actif du début à la fin -> accord tenu
                const onBeat = (runStart % SEQ_STEPS_PER_BEAT === 0);
                const stepOverride = intensityPerStep && intensityPerStep[runStart];
                const vel = computeVelocity(held, onBeat, intensityPercent, stepOverride);
                const humanize = held ? 0 : Math.random() * 0.02;
                const t0 = stepTime(runStart);
                const runDur = stepTime(runStart + runLen) - t0; // durée réelle de la plage, groove compris
                const dur = held ? (runDur - 0.1) : Math.max(0.05, runDur - Math.min(0.06, stepDur * 0.2));
                eventIds.push(Tone.Transport.schedule((t) => {
                    // Un instrument à échantillons (Piano) peut ne pas encore avoir fini de charger ses
                    // sons (réseau lent, ou lecture démarrée dans la même seconde que le choix de
                    // l'instrument) : sans ce filet, l'exception levée ici interrompait le traitement
                    // des évènements suivants du transport — la grille entière (surbrillance, barre de
                    // lecture, chiffrage affiché) restait figée après le tout premier accord concerné,
                    // même si celui-ci ne jouait qu'un silence à la place de la note manquante.
                    try {
                        instrument.triggerAttackRelease(notes[voice], dur, t + humanize, vel);
                    } catch (e) {
                        console.warn('Note ignorée (instrument pas encore prêt) :', e.message);
                    }
                }, t0));
            }
        }
        return eventIds;
    }

    async playCurrent() {
        await Tone.start();
        this.stopAll();
        const myGen = this._playGen;
        this._playMode = 'chord';

        const chord = this.readChord();
        const notes = chord.getSeqNotes();
        this.refreshPreview();

        const { pattern: seqPattern, tie: seqTie } = this.getLiveSeqPattern(chord);
        const bpm = parseInt(document.getElementById('bpm').value);
        const secPerBeat = 60 / bpm;
        const instrumentKey = document.getElementById('instrument').value;

        const start = 0.1;
        const duration = chord.beats * secPerBeat;
        this.schedulePlayback(notes, chord.getSeqMidiNotes(), seqPattern, seqTie, secPerBeat, start, chord.getRoleMap(), instrumentKey, chord, true, null, +document.getElementById('intensity').value, this.intensityPerStep);
        this.isPlaying = true;

        // Attend que l'instrument (Piano notamment : ses sons se chargent depuis internet) soit prêt
        // AVANT de démarrer le transport — sinon triggerAttackRelease échouait sur les premières
        // notes le temps du chargement (voir schedulePlayback, qui les ignore désormais proprement,
        // mais autant vraiment les jouer plutôt que de les sauter en silence).
        await waitForAudioReady();
        // Si un stopAll() (Stop, ou une autre lecture démarrée entre-temps) est survenu pendant cette
        // attente, ce jeton a changé : abandonner plutôt que redémarrer le transport après coup (voir
        // stopAll et le commentaire sur this._playGen dans le constructeur).
        if (myGen !== this._playGen) return;

        if (this.seqLoopPlay) {
            // Bouton « Boucle » : gérée nativement par l'horloge audio (Tone.Transport.loop), exactement
            // comme playProgression (voir son propre commentaire plus bas) — tout ce qui a déjà été
            // programmé entre `start` et la fin de l'accord (notes, surbrillance, curseur du séquenceur)
            // rejoue de lui-même à chaque tour, sans aucun aller-retour JS. L'ancienne version relançait
            // playCurrent() en entier à chaque tour (stop/cancel/redémarrage, voir stopAll), ce qui
            // produisait une micro-coupure ET un décalage perceptibles à chaque reprise de la boucle.
            // Les deux bornes décalées du MÊME epsilon (voir LOOP_START_EPSILON) : la boucle garde
            // exactement sa durée réelle (sinon, décaler seulement loopStart l'aurait allongée de
            // cet epsilon à chaque tour — mesuré : un tempo légèrement plus lent qu'annoncé).
            Tone.Transport.loop = true;
            Tone.Transport.loopStart = start - LOOP_START_EPSILON;
            Tone.Transport.loopEnd = start + duration - LOOP_START_EPSILON;
        } else {
            Tone.Transport.loop = false;
            Tone.Transport.schedule((t) => {
                Tone.Draw.schedule(() => {
                    try {
                        this.isPlaying = false;
                        this.updateSeqPlayhead(null);
                    } catch (e) {
                        console.warn('Fin de lecture ignorée :', e.message);
                        this.isPlaying = false;
                    }
                }, t);
            }, start + duration);
        }

        Tone.Transport.start();
    }

    // Programme UN SEUL accord de la chanson (voir playProgression) à l'instant `timeOffset`, et
    // renvoie sa durée en temps ainsi que les identifiants Tone.Transport créés (notes, métronome,
    // étiquette/surbrillance) — utilisé aussi bien au lancement de la lecture que pour patcher un
    // accord en direct sans redémarrer le transport (voir liveUpdateProgressionChord).
    scheduleProgressionChord(section, index, data, timeOffset, secPerBeat, songBeatAtStart, beatsPerBar, disp) {
        const beats = beatsFromData(data);
        const chord = new Chord(data.root, data.quality, beats, data.inversion, data.drop, octaveFromData(data), data.bass, data.guitarLock, data.extraNotes);
        const notes = chord.getSeqNotes();
        const { pattern: seqPattern, tie: seqTie } = this.resolveSeqPatternForData(chord, data);
        const eventIds = this.schedulePlayback(notes, chord.getSeqMidiNotes(), seqPattern, seqTie, secPerBeat, timeOffset, chord.getRoleMap(), data.instrument || 'piano', chord, false, { section, index }, data.intensity, data.intensityPerStep);

        // Métronome maintenu pendant la lecture (option activée) : un clic par temps de l'accord,
        // accentué sur le 1er temps de chaque mesure — indépendant des notes de l'accord jouées.
        if (this.metronomeDuringPlayback) {
            for (let b = 0; b < beats; b++) {
                const accent = ((songBeatAtStart + b) % beatsPerBar === 0);
                const clickTime = timeOffset + b * secPerBeat;
                eventIds.push(Tone.Transport.schedule((t) => {
                    try {
                        this.playMetronomeClick(accent, t);
                    } catch (e) { console.warn('Clic de métronome ignoré :', e.message); }
                }, clickTime));
                // Clic faible sur le contretemps (croche), voir metronomeSubdivision
                if (this.metronomeSubdivision) {
                    const subTime = clickTime + secPerBeat / 2;
                    eventIds.push(Tone.Transport.schedule((t) => {
                        try {
                            this.playMetronomeClick(false, t, true);
                        } catch (e) { console.warn('Clic de métronome (croche) ignoré :', e.message); }
                    }, subTime));
                }
            }
        }

        // Au début de cet accord : maj de l'indicateur (nom + notes) et surbrillance dans la grille
        const chordUseFlats = this.useFlatsForRoot(chord.root);
        const labelHTML = `<span class="chord-title">${flatTight(chord.getLabel(chordUseFlats))}</span><span class="chord-notes">${chordNotesHtml(chord, chordUseFlats)}</span>`;
        eventIds.push(Tone.Transport.schedule((t) => {
            Tone.Draw.schedule(() => {
                try {
                    disp.innerHTML = labelHTML;
                    this.highlightPlaying(section, index);
                } catch (e) {
                    console.warn('Surbrillance ignorée pour', section, index, ':', e.message);
                }
            }, t);
        }, timeOffset));

        return { beats, eventIds };
    }

    // Modifie EN PLACE un seul accord de la chanson actuellement en lecture (voir playProgression),
    // SANS arrêter ni redémarrer le transport : les évènements déjà programmés pour cette case précise
    // sont annulés (Tone.Transport.clear) et remplacés par des neufs, À LA MÊME position dans le temps
    // — tout le reste (les autres accords, la boucle, le décompte) continue sans coupure ni décalage.
    // Renvoie 'patched' (fait), 'not-playing' (cet accord ne fait pas partie du passage actuellement
    // joué, rien à faire) ou 'needs-restart' (durée changée : tout ce qui suit devrait alors décaler
    // dans le temps, trop risqué à corriger en direct sans à-coup — voir livePreviewUpdate, qui se
    // rabat alors sur un redémarrage complet de playProgression()).
    liveUpdateProgressionChord(section, index) {
        const slot = this._progChordSlots.get(`${section}:${index}`);
        if (!slot) return 'not-playing';
        const sections = loadProgressionSections();
        const data = sections[section] && sections[section].chords[index];
        if (!data || beatsFromData(data) !== slot.beats) return 'needs-restart';

        slot.eventIds.forEach(id => Tone.Transport.clear(id));
        const disp = document.getElementById('current-chord-display');
        const { eventIds } = this.scheduleProgressionChord(section, index, data, slot.timeOffset, slot.secPerBeat, slot.songBeatAtStart, slot.beatsPerBar, disp);
        slot.eventIds = eventIds;
        return 'patched';
    }

    // Joue la chanson en entier : toutes les parties (couplet, refrain, ...) mises bout à bout, dans
    // leur ordre d'affichage. Si this.loopActiveSection est activé (bouton dédié), ne joue QUE la
    // partie active, et la boucle indéfiniment jusqu'à Stop (voir la fin de la fonction).
    async playProgression() {
        await Tone.start();
        this.stopAll();
        const myGen = this._playGen;
        this._playMode = 'progression';

        const sections = loadProgressionSections();
        // Plage à boucler (glisser sur les numéros de mesure, voir setLoopRange) : prioritaire sur le
        // bouton « Boucle » (partie active entière) quand elle est définie.
        const range = this.loopRange;
        const loop = !!range || this.loopActiveSection;
        const flat = []; // { section, index, data } à plat, dans l'ordre de lecture
        if (range) {
            // La plage peut traverser plusieurs parties : entière pour celles du milieu, bornée aux
            // deux extrémités seulement pour la première et la dernière (voir loopRangeForSection).
            for (let si = range.startSection; si <= range.endSection; si++) {
                const sec = sections[si];
                if (!sec) continue;
                const from = (si === range.startSection) ? range.startIndex : 0;
                const to = (si === range.endSection) ? range.endIndex : sec.chords.length - 1;
                for (let ci = from; ci <= to && ci < sec.chords.length; ci++) {
                    flat.push({ section: si, index: ci, data: sec.chords[ci] });
                }
            }
        } else if (this.loopActiveSection) {
            const sec = sections[this.activeSection];
            if (sec) sec.chords.forEach((data, ci) => flat.push({ section: this.activeSection, index: ci, data }));
        } else {
            sections.forEach((sec, si) => sec.chords.forEach((data, ci) => flat.push({ section: si, index: ci, data })));
        }
        if (flat.length === 0) return;

        // Démarre depuis l'accord en surbrillance si présent, sinon depuis le tout début — non
        // pertinent en mode boucle : chaque tour rejoue la partie (ou la plage) depuis son tout début.
        let startPos = 0;
        if (!loop && this.selectedIndex != null) {
            const pos = flat.findIndex(c => c.section === this.activeSection && c.index === this.selectedIndex);
            if (pos >= 0) startPos = pos;
        }

        const bpm = parseInt(document.getElementById('bpm').value);
        const secPerBeat = 60 / bpm;
        const start = 0.02; // aligné sur Tone.context.lookAhead (voir constructeur)

        // Décompte : un temps par mesure de la signature rythmique, accent sur le temps 1 — SAUTÉ
        // entièrement (pas seulement rendu muet) si metronomeCountIn est désactivé, pour que la grille
        // démarre tout de suite plutôt que d'attendre en silence la durée d'une mesure entière (retour
        // utilisateur : ce silence se percevait comme un délai au lancement de la lecture). beatsPerBar
        // reste séparé de countInBeats : lui seul sert encore plus bas à accentuer le 1er temps de
        // chaque mesure pendant la lecture (metronomeDuringPlayback), indépendamment du décompte.
        const beatsPerBar = this.beatsPerBar();
        const countInBeats = this.metronomeCountIn ? beatsPerBar : 0;
        const disp = document.getElementById('current-chord-display');
        for (let b = 0; b < countInBeats; b++) {
            const clickTime = start + b * secPerBeat;
            const accent = (b === 0);
            const label = b + 1;
            Tone.Transport.schedule((t) => {
                // Un filet à chaque callback programmé sur le transport (voir schedulePlayback) : une
                // seule exception, n'importe où, bloquait silencieusement tout le reste de la lecture.
                try {
                    this.playMetronomeClick(accent, t);
                } catch (e) { console.warn('Clic de décompte ignoré :', e.message); }
                Tone.Draw.schedule(() => {
                    disp.innerHTML = `Décompte<span class="chord-notes">${label} / ${countInBeats}</span>`;
                }, t);
            }, clickTime);
            // Clic faible sur le contretemps (croche entre ce temps et le suivant), voir metronomeSubdivision
            if (this.metronomeSubdivision) {
                const subTime = clickTime + secPerBeat / 2;
                Tone.Transport.schedule((t) => {
                    try {
                        this.playMetronomeClick(false, t, true);
                    } catch (e) { console.warn('Clic de décompte (croche) ignoré :', e.message); }
                }, subTime);
            }
        }

        // La progression démarre juste après le décompte (immédiatement si sauté, voir ci-dessus)
        let timeOffset = start + countInBeats * secPerBeat;
        const loopStartTime = timeOffset; // point de reprise en boucle, voir Tone.Transport.loop plus bas
        this.isPlaying = true;
        let songBeat = 0; // compteur de temps DEPUIS le début de la grille (pas le décompte) : le
                           // premier temps de la grille redevient un « temps 1 » accentué, comme il
                           // se doit, indépendamment du décompte qui précède.

        // Un accord de la chanson en cours pourra être patché en direct (voir liveUpdateProgressionChord)
        // sans redémarrer le transport quand on le modifie pendant la lecture — cette table garde, pour
        // chaque case { section, index } effectivement programmée cette fois-ci, tout ce qu'il faut pour
        // reproduire exactement le même appel de programmation à la même position dans le temps.
        this._progChordSlots = new Map();

        flat.slice(startPos).forEach(({ section, index, data }) => {
            const songBeatAtStart = songBeat;
            const { beats, eventIds } = this.scheduleProgressionChord(section, index, data, timeOffset, secPerBeat, songBeatAtStart, beatsPerBar, disp);
            this._progChordSlots.set(`${section}:${index}`, { timeOffset, secPerBeat, songBeatAtStart, beatsPerBar, beats, eventIds });
            songBeat += beats;
            timeOffset += beats * secPerBeat;
        });

        if (loop) {
            // Boucle gérée nativement par l'horloge audio (Tone.Transport.loop) plutôt que par un
            // rappel JS qui relançait tout playProgression() à chaque tour : cet ancien va-et-vient
            // (stop/cancel/redémarrage, voir stopAll) réintroduisait à chaque reprise le même petit
            // pré-roll qu'au tout premier lancement — perceptible comme un décalage à chaque boucle.
            // Ici, tous les évènements déjà programmés entre loopStartTime et loopEndTime (accords,
            // surbrillance, métronome pendant la lecture) rejouent d'eux-mêmes, sans aucune coupure.
            // Le décompte, lui, ne fait bien partie que du tout premier tour (programmé avant
            // loopStartTime) — comportement plus juste musicalement que l'ancien, qui le répétait
            // à chaque boucle.
            // Les deux bornes décalées du MÊME epsilon (voir LOOP_START_EPSILON, et son usage identique
            // dans playCurrent) : la boucle garde exactement sa durée réelle — le premier accord, lui,
            // reste programmé pile à loopStartTime, inchangé, seul le point de boucle bouge.
            Tone.Transport.loop = true;
            Tone.Transport.loopStart = loopStartTime - LOOP_START_EPSILON;
            Tone.Transport.loopEnd = timeOffset - LOOP_START_EPSILON;
        } else {
            Tone.Transport.loop = false;
            Tone.Transport.schedule((t) => {
                Tone.Draw.schedule(() => {
                    try {
                        this.clearViz();
                        this.highlightPlaying(null, null);
                        this.isPlaying = false;
                    } catch (e) {
                        console.warn('Fin de progression ignorée :', e.message);
                        this.isPlaying = false;
                    }
                }, t);
            }, timeOffset);
        }

        // Attend que tous les instruments utilisés dans la grille (Piano notamment : ses sons se
        // chargent depuis internet) soient prêts avant de démarrer le transport — la boucle ci-dessus
        // les a déjà tous instanciés en programmant leur lecture (voir getInstrument), il ne reste
        // qu'à attendre leur chargement. Sans ça, une note jouée trop tôt échouait silencieusement
        // (voir schedulePlayback, qui l'ignore désormais proprement), mais autant vraiment l'entendre.
        await waitForAudioReady();
        // Voir playCurrent : abandonne si un stopAll() est survenu pendant cette attente.
        if (myGen !== this._playGen) return;

        Tone.Transport.start();
    }

    // Surbrillance de l'accord en cours de lecture (sans re-render de la grille)
    highlightPlaying(section, index) {
        document.querySelectorAll('.grid-cell.playing').forEach(c => c.classList.remove('playing'));
        if (index == null) return;
        const cells = document.querySelectorAll(`.chord-grid[data-section="${section}"] .grid-cell[data-index="${index}"]`);
        cells.forEach(c => c.classList.add('playing'));
        this.updateGridPlayhead(section, index); // suit l'accord qui démarre, comme au clic (voir selectChord)
        // Suit la lecture dans la grille sur un morceau plus long que l'écran : ne scrolle QUE si la
        // case en cours sort du cadre visible ('nearest', pas 'center') — sinon ça re-scrollerait à
        // chaque accord même quand tout est déjà visible, gênant si l'utilisateur a délibérément
        // scrollé ailleurs (ex. pour regarder la suite pendant que ça joue).
        if (cells.length) cells[0].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }

    // Barre de lecture de la grille : petit repère à gauche de l'accord sélectionné au repos, qui
    // suit ensuite l'accord en cours pendant la lecture (voir highlightPlaying) — jamais effacée à
    // l'arrêt (contrairement à la surbrillance « playing »), elle marque où la lecture reprendrait.
    // Sans re-render de la grille : un simple élément déplacé/réinséré, comme highlightPlaying.
    updateGridPlayhead(section, index) {
        if (index == null) {
            this.playheadSection = section;
            this.playheadIndex = index;
            document.querySelectorAll('.grid-playhead').forEach(el => el.remove());
            return;
        }
        this.setGridPlayheadProgress(section, index, 0, 1); // position de repos : tout à gauche
    }

    // Fait glisser la barre de lecture le long de l'accord en cours, de la gauche vers la droite, au
    // fil des croches jouées (voir schedulePlayback/gridPos) — plutôt qu'un simple saut d'accord en
    // accord. `elapsedBeats`/`totalBeats` couvrent la durée ENTIÈRE de l'accord, qui peut être scindé
    // sur plusieurs cases si étiré au-delà d'une ligne (voir layoutProgression, seg-first/-mid/-last) :
    // chaque segment occupe `span` colonnes = `span` temps, on retrouve donc le bon segment et la
    // fraction qui lui correspond en consommant `elapsedBeats` case par case.
    setGridPlayheadProgress(section, index, elapsedBeats, totalBeats) {
        this.playheadSection = section;
        this.playheadIndex = index;
        const segs = Array.from(document.querySelectorAll(`.chord-grid[data-section="${section}"] .grid-cell[data-index="${index}"]`));
        if (segs.length === 0) {
            document.querySelectorAll('.grid-playhead').forEach(el => el.remove());
            return;
        }
        const spans = segs.map(seg => {
            const m = /span\s+(\d+)/.exec(seg.getAttribute('style') || '');
            return m ? parseInt(m[1], 10) : 1;
        });
        let remaining = totalBeats > 0 ? Math.max(0, Math.min(totalBeats, elapsedBeats)) : 0;
        let targetSeg = segs[0], fraction = 0;
        for (let i = 0; i < segs.length; i++) {
            if (i === segs.length - 1 || remaining < spans[i]) {
                targetSeg = segs[i];
                fraction = spans[i] > 0 ? Math.max(0, Math.min(1, remaining / spans[i])) : 0;
                break;
            }
            remaining -= spans[i];
        }
        // Réutilise la barre déjà en place si elle est déjà dans le bon segment (juste sa position qui
        // change) : la transition CSS (voir .grid-playhead) peut alors glisser au lieu de sauter d'une
        // croche à l'autre. Recrée seulement en changeant de segment/case (ou après un re-render).
        let bar = document.querySelector('.grid-playhead');
        if (!(bar && bar.parentElement === targetSeg)) {
            document.querySelectorAll('.grid-playhead').forEach(el => el.remove());
            bar = document.createElement('div');
            bar.className = 'grid-playhead';
            targetSeg.appendChild(bar);
        }
        bar.style.left = `${fraction * 100}%`;
    }

    // Retire les notes libres devenues totalement silencieuses (plus une seule croche peinte pour
    // leur voix) au moment de valider : ajoutée puis entièrement effacée, une note libre ne doit pas
    // rester une voix fantôme de l'accord (sans le moindre son, mais toujours comptée dans son
    // voicing/ses diagrammes) une fois la modification enregistrée (retour utilisateur).
    pruneEmptyExtraNotes() {
        if (!this.extraNotes.length) return;
        const chord = this.readChord();
        const { pattern: livePattern, tie: liveTie } = parseSeqPattern(document.getElementById('arpPattern').value);
        const extraStart = chord.getIntervals().length;
        // x._new (voir addSequencerNote) : une voix tout juste créée, JAMAIS peinte une seule fois
        // depuis, échappe à ce nettoyage — sinon le tout premier rendu suivant sa création (même
        // avant que le champ éditable n'ait servi à quoi que ce soit) l'effaçait déjà.
        const keepFlags = this.extraNotes.map((x, i) => x._new || livePattern.some(s => s.includes(extraStart + i)));
        if (keepFlags.every(Boolean)) return; // rien à retirer

        // Remappe chaque voix libre CONSERVÉE vers son nouvel index (celles de l'accord lui-même,
        // avant extraStart, ne bougent jamais) — même principe que reevaluateExtraNoteUpgrades.
        const remap = new Map();
        let nextIdx = 0;
        keepFlags.forEach((keep, i) => {
            if (keep) { remap.set(extraStart + i, extraStart + nextIdx); nextIdx++; }
        });
        const remapVoice = (v) => (v < extraStart ? v : remap.get(v)); // undefined = voix retirée
        const newPattern = livePattern.map(s => s.map(remapVoice).filter(v => v !== undefined));
        const newTie = liveTie.map(s => s.map(remapVoice).filter(v => v !== undefined));
        this.setLiveSeqPattern(newPattern, newTie);
        this.extraNotes = this.extraNotes.filter((_, i) => keepFlags[i]);
    }

    // Assemble l'objet accord tel qu'il est ACTUELLEMENT réglé (panneau + séquenceur + notes libres/
    // verrou guitare/intensité en attente) — partagé par saveCurrent (mode Ajout, ou ancien chemin) et
    // commitLiveEdit (mode Modification, voir plus bas) : la même « photo » de l'état courant, que
    // l'appelant écrive en fin de tableau, l'insère, ou remplace l'entrée en cours d'édition.
    buildLiveChordData() {
        this.syncSeqPatternForCurrentChord(); // garantit un arpPattern à jour même si le panneau n'a jamais été ouvert
        this.pruneEmptyExtraNotes();
        return {
            root: document.getElementById('root').value,
            quality: document.getElementById('quality').value,
            beats: document.getElementById('duration').value,
            octave: document.getElementById('octave').value,
            inversion: document.getElementById('inversion').value,
            drop: document.getElementById('drop').value,
            bass: document.getElementById('bass').value || null,
            playStyle: document.getElementById('playStyle').value,
            instrument: document.getElementById('instrument').value,
            arpPattern: document.getElementById('arpPattern').value,
            seqEdited: true,
            guitarLock: this.guitarLock || null,
            // { note, octave } seuls : x._new (voir addSequencerNote/pruneEmptyExtraNotes) n'a de sens
            // qu'en mémoire pendant l'édition en cours, jamais dans les données sauvegardées.
            extraNotes: this.extraNotes.map(({ note, octave }) => ({ note, octave })),
            intensity: +document.getElementById('intensity').value,
            intensityPerStep: { ...this.intensityPerStep }
        };
    }

    // `insertAfter` (optionnel) : index après lequel insérer le nouvel accord, dans la partie active
    // (bouton « À la suite ») — ignoré en mode modification, et si absent l'accord est ajouté en fin
    // de partie comme avant (bouton « Ajouter »/« À la fin »). En mode Modification (voir
    // commitLiveEdit), ce chemin ne sert plus normalement (chaque champ s'applique déjà tout seul) —
    // gardé pour Ajouter/À la suite, et par défense pour un éventuel appel restant en mode 'edit'.
    saveCurrent(insertAfter) {
        const data = this.buildLiveChordData();
        const sections = loadProgressionSections();
        this.pushUndo(sections);
        const history = sections[this.activeSection].chords;

        if (this.editingIndex != null && history[this.editingIndex]) {
            history[this.editingIndex] = data; // modification en place
            this.exitEditMode();
        } else if (insertAfter != null && insertAfter >= 0 && insertAfter < history.length) {
            history.splice(insertAfter + 1, 0, data); // inséré juste après l'accord sélectionné
        } else {
            history.push(data); // nouvel accord en fin de partie
        }
        saveProgressionSections(sections);
        this.clearSeqHistory(); // motif validé dans la grille : plus rien à annuler/rétablir en local
        this.loadProgression();
    }

    // Sauvegarde en direct l'accord en cours d'édition (mode Modification, voir le bandeau Ajout/
    // Modification) : chaque réglage du panneau/séquenceur s'applique tout de suite, pas besoin de
    // cliquer Modifier. Un seul instantané Annuler par SESSION d'édition (this._editSessionUndoPushed),
    // jamais un par champ retouché — Ctrl+Z revient donc en une fois à l'état d'avant l'ouverture de
    // CET accord, comme l'ancien bouton Annuler (retour utilisateur). `refreshGrid` : false pour les
    // appels internes au séquenceur (déjà en train de se redessiner depuis renderSequencer — y
    // rappeler loadProgression() rouvrirait une boucle) ; true pour un champ du panneau, qui peut
    // changer ce que la case affiche (symbole...).
    commitLiveEdit(refreshGrid) {
        if (this.appMode !== 'edit' || this.editingIndex == null) return;
        const sections = loadProgressionSections();
        const history = sections[this.activeSection] && sections[this.activeSection].chords;
        if (!history || !history[this.editingIndex]) return;
        if (!this._editSessionUndoPushed) {
            this.pushUndo(sections);
            this._editSessionUndoPushed = true;
        }
        history[this.editingIndex] = this.buildLiveChordData();
        saveProgressionSections(sections);
        if (refreshGrid) this.loadProgression();
    }

    // Construit les données d'un accord (fondamentale par défaut ; basse ET voicing — octave/
    // renversement/drop — précisables via "_", voir parseChordSymbol) à partir d'un symbole déjà
    // reconnu — partagé par addChordFromSymbol (un accord) et addChordsFromSymbolList (plusieurs,
    // séparés par "/").
    buildChordData(parsed, beats, playStyle, instrument) {
        const bass = parsed.bass || null;
        const octave = parsed.octave ?? 3;
        const inversion = parsed.inversion ?? 0;
        const drop = parsed.drop ?? 'none';
        const chord = new Chord(parsed.root, parsed.quality, beats, inversion, drop, octave, bass);
        const voices = chord.getMidiNotes().length;
        const { pattern, tie } = seqPreset(playStyle, voices, beats * SEQ_STEPS_PER_BEAT);
        return {
            root: parsed.root,
            quality: parsed.quality,
            beats,
            octave,
            inversion,
            drop,
            bass,
            playStyle,
            instrument,
            arpPattern: serializeSeqPattern(pattern, tie),
            seqEdited: false,
            guitarLock: null,
            extraNotes: [],
            intensity: DEFAULT_INTENSITY,
            intensityPerStep: {},
        };
    }

    // Saisie rapide (voir parseChordSymbol) : ajoute directement un accord à la fin de la partie
    // active, toujours en position fondamentale (sans renversement/drop/basse — modifiables ensuite
    // en double-cliquant la case comme n'importe quel accord), à la durée et au style de lecture/
    // instrument actuellement réglés dans le panneau Accord. Pensée pour poser vite une grille au
    // clavier, sans toucher aux menus déroulants.
    // Ajoute un accord à partir d'un symbole texte (ex. "Cm7") à LA FIN d'une partie donnée — logique
    // commune à l'ajout rapide (#quick-add-input, toujours sur la partie ACTIVE) et à la case "+" en
    // bout de grille (une par partie, voir loadProgression/.cell-add-input) qui vise directement la
    // partie où elle apparaît. Renvoie true si l'accord a bien été ajouté.
    addChordFromSymbol(section, symbolStr) {
        const parsed = parseChordSymbol(symbolStr);
        if (!parsed) {
            this.flashHint('Accord non reconnu (ex. Cm7, F#dim, Bbadd9)');
            return false;
        }
        const beats = parseInt(document.getElementById('duration').value) || 4;
        const playStyle = document.getElementById('playStyle').value;
        const instrument = document.getElementById('instrument').value;
        const data = this.buildChordData(parsed, beats, playStyle, instrument);

        const sections = loadProgressionSections();
        this.pushUndo(sections);
        sections[section].chords.push(data);
        saveProgressionSections(sections);
        this.loadProgression();

        this.flashHint(`${noteNameForPc(NOTES.indexOf(parsed.root), this.useFlatsForRoot(parsed.root))}${QUALITY_LABEL[parsed.quality]} ajouté`);
        return true;
    }

    // Applique le son actuellement choisi dans le panneau Accord à TOUS les accords déjà posés, dans
    // toutes les parties du morceau (voir #apply-instrument-all) — un seul pushUndo pour tout annuler
    // en un coup, comme n'importe quelle autre modification en masse de l'appli.
    applyInstrumentToSong() {
        const instrument = document.getElementById('instrument').value;
        const sections = loadProgressionSections();
        const total = sections.reduce((n, sec) => n + sec.chords.length, 0);
        if (total === 0) { this.flashHint('Aucun accord dans le morceau'); return; }
        this.pushUndo(sections);
        sections.forEach(sec => sec.chords.forEach(c => { c.instrument = instrument; }));
        saveProgressionSections(sections);
        hasUnsavedChanges = true;
        this.loadProgression();
        // Si un accord est en cours d'édition, resynchronise le séquenceur épinglé (loupe grille) qui
        // affiche son style/instrument.
        if (this.editingIndex != null) this.syncGridZoomPinnedSeq();
        // Répercute tout de suite sur une lecture en cours (voir liveUpdateProgressionChord) : un
        // patch local par accord DÉJÀ programmé cette lecture-ci suffit, l'instrument ne change ni la
        // durée ni le minutage de rien.
        if (this.isPlaying && this._playMode === 'progression') {
            for (const key of this._progChordSlots.keys()) {
                const [section, index] = key.split(':').map(Number);
                this.liveUpdateProgressionChord(section, index);
            }
        }
        this.flashHint(`Son appliqué à ${total} accord${total > 1 ? 's' : ''}`);
    }

    // Parse une liste "/" (ex. "CM7/Am7/F6/Bbm7") en tableau d'accords reconnus, ou renvoie null (en
    // affichant lequel a échoué) si un seul symbole n'est pas valide — tout ou rien, un ajout partiel
    // serait déroutant, mieux vaut corriger et retaper la liste entière.
    parseChordSymbolList(listStr) {
        const parts = listStr.split('/').map(p => p.trim()).filter(p => p.length > 0);
        if (parts.length === 0) return null;
        const parsedList = parts.map(p => parseChordSymbol(p));
        const badIndex = parsedList.findIndex(p => !p);
        if (badIndex !== -1) {
            this.flashHint(`Accord non reconnu : « ${parts[badIndex]} »`);
            return null;
        }
        return parsedList;
    }

    // Insère une liste déjà validée (voir parseChordSymbolList) dans une partie, un accord PAR
    // MESURE (beatsPerBar), sans renversement ni drop (basse "_" éventuelle conservée) — `section`
    // peut valoir 'new' pour en créer une à la volée en même temps, dans le MÊME geste d'annulation
    // (une seule action pour l'utilisateur, voir openSectionPicker).
    commitChordList(section, parsedList) {
        const sections = loadProgressionSections();
        this.pushUndo(sections);
        if (section === 'new') {
            sections.push({ title: '', chords: [] });
            section = sections.length - 1;
        }
        const beats = this.beatsPerBar();
        const playStyle = document.getElementById('playStyle').value;
        const instrument = document.getElementById('instrument').value;
        parsedList.forEach(parsed => sections[section].chords.push(this.buildChordData(parsed, beats, playStyle, instrument)));
        saveProgressionSections(sections);
        this.activeSection = section;
        this.loadProgression();
        this.flashHint(`${parsedList.length} accords ajoutés (1 par mesure)`);
    }

    // Ajoute PLUSIEURS accords d'un coup, séparés par "/" — utilisé par la case "+" (voir
    // buildAddCellHtml), qui vise déjà sans équivoque la partie où elle apparaît : jamais besoin d'y
    // demander la destination, contrairement à l'ajout rapide (voir addQuickChord/openSectionPicker).
    addChordsFromSymbolList(section, listStr) {
        const parsedList = this.parseChordSymbolList(listStr);
        if (!parsedList) return false;
        this.commitChordList(section, parsedList);
        return true;
    }

    // Point d'entrée commun à la case "+" (voir buildAddCellHtml) : un symbole seul ajoute UN accord
    // à la durée réglée dans le panneau ; plusieurs séparés par "/" ajoutent un accord par mesure
    // d'un coup (voir addChordsFromSymbolList).
    addChordInputToSection(section, value) {
        return value.includes('/')
            ? this.addChordsFromSymbolList(section, value)
            : this.addChordFromSymbol(section, value);
    }

    // Découpe la saisie en blocs séparés par une ligne VIDE (voir #quick-add-help) : une simple
    // Entrée garde les lignes dans le MÊME bloc (donc la même partie, voir addQuickChord) — il faut
    // sauter une ligne pour en démarrer une nouvelle, plus délibéré qu'une simple Entrée (qui sert
    // surtout à lister plusieurs accords l'un sous l'autre pour UNE même partie).
    splitQuickAddBlocks(text) {
        const blocks = [];
        let current = [];
        text.split('\n').forEach(line => {
            if (line.trim() === '') { if (current.length) { blocks.push(current); current = []; } }
            else current.push(line.trim());
        });
        if (current.length) blocks.push(current);
        return blocks;
    }

    // Parse toutes les lignes d'un bloc (voir splitQuickAddBlocks) en une liste plate d'accords,
    // chacun gardant si sa ligne d'origine était une liste "/" (un accord par mesure) ou un accord
    // seul (durée réglée dans le panneau) — voir commitBlockItems/commitMultilineQuickAdd. Tout ou
    // rien : la première ligne invalide annule tout le bloc (déjà signalée via flashHint).
    parseBlockLines(blockLines) {
        const items = [];
        for (const line of blockLines) {
            if (line.includes('/')) {
                const list = this.parseChordSymbolList(line);
                if (!list) return null;
                list.forEach(p => items.push({ parsed: p, isBatch: true }));
            } else {
                const parsed = parseChordSymbol(line);
                if (!parsed) { this.flashHint(`Accord non reconnu : « ${line} »`); return null; }
                items.push({ parsed, isBatch: false });
            }
        }
        return items;
    }

    // Insère une liste d'accords déjà validée (voir parseBlockLines) dans UNE section — plusieurs
    // lignes d'un même bloc rejoignent ainsi la même partie, chacune gardant sa propre durée (accord
    // seul : durée réglée dans le panneau ; ligne "/" : un accord par mesure). `section` peut valoir
    // 'new' pour en créer une à la volée (voir openSectionPicker).
    commitBlockItems(section, items) {
        const sections = loadProgressionSections();
        this.pushUndo(sections);
        if (section === 'new') { sections.push({ title: '', chords: [] }); section = sections.length - 1; }
        const barBeats = this.beatsPerBar();
        const singleBeats = parseInt(document.getElementById('duration').value) || 4;
        const playStyle = document.getElementById('playStyle').value;
        const instrument = document.getElementById('instrument').value;
        items.forEach(({ parsed, isBatch }) => {
            sections[section].chords.push(this.buildChordData(parsed, isBatch ? barBeats : singleBeats, playStyle, instrument));
        });
        saveProgressionSections(sections);
        this.activeSection = section;
        this.loadProgression();
        this.flashHint(`${items.length} accord${items.length > 1 ? 's' : ''} ajoutés`);
    }

    // Ajout rapide (barre au-dessus de la grille), un <textarea> multi-lignes (voir
    // autoResizeQuickAdd) découpé en blocs séparés par une ligne vide (voir splitQuickAddBlocks) :
    // - un seul bloc d'une seule ligne : comportement historique inchangé (ajout direct, ou choix de
    //   la partie s'il y en a plusieurs) ;
    // - un seul bloc de plusieurs lignes : toutes ces lignes rejoignent la MÊME partie (active, ou
    //   choisie s'il y en a plusieurs) ;
    // - plusieurs blocs : ajout en lot, CHAQUE bloc devient une partie TOUTE NEUVE, jamais une partie
    //   existante même vide (voir commitMultilineQuickAdd) — pour ne jamais se greffer sur ce qui est
    //   déjà écrit dans la grille.
    addQuickChord() {
        const input = document.getElementById('quick-add-input');
        const blocks = this.splitQuickAddBlocks(input.value);
        if (blocks.length === 0) return;

        if (blocks.length > 1) { this.commitMultilineQuickAdd(blocks); return; }

        const block = blocks[0];
        const sections = loadProgressionSections();

        if (block.length === 1) {
            const value = block[0];
            if (!value.includes('/')) {
                if (!parseChordSymbol(value)) { this.flashHint('Accord non reconnu (ex. Cm7, F#dim, Bbadd9)'); return; }
                if (sections.length <= 1) {
                    if (this.addChordFromSymbol(0, value)) this.resetQuickAddInput();
                    return;
                }
                this.openSectionPicker(input, (section) => {
                    this.activeSection = section;
                    if (this.addChordFromSymbol(section, value)) this.resetQuickAddInput();
                });
                return;
            }

            const parsedList = this.parseChordSymbolList(value);
            if (!parsedList) return;
            if (sections.length <= 1) {
                this.commitChordList(0, parsedList);
                this.resetQuickAddInput();
                return;
            }
            this.openSectionPicker(input, (section) => {
                this.commitChordList(section, parsedList);
                this.resetQuickAddInput();
            });
            return;
        }

        const items = this.parseBlockLines(block);
        if (!items) return;
        if (sections.length <= 1) {
            this.commitBlockItems(0, items);
            this.resetQuickAddInput();
            return;
        }
        this.openSectionPicker(input, (section) => {
            this.commitBlockItems(section, items);
            this.resetQuickAddInput();
        });
    }

    // Ajout en lot depuis l'ajout rapide agrandi (au moins une ligne vide sépare deux blocs, voir
    // splitQuickAddBlocks) : CHAQUE bloc devient une partie TOUTE NEUVE, ajoutée à la fin — jamais
    // une partie existante, même vide (retour utilisateur : l'ajout doit se faire dans de nouvelles
    // parties si la grille contient déjà quelque chose). Tout ou rien : si une seule ligne contient
    // un symbole invalide, RIEN n'est ajouté — un ajout partiel serait déroutant à corriger après
    // coup, surtout sur plusieurs parties d'un coup.
    commitMultilineQuickAdd(blocks) {
        const parsedBlocks = [];
        for (const block of blocks) {
            const items = this.parseBlockLines(block);
            if (!items) return;
            parsedBlocks.push(items);
        }

        const sections = loadProgressionSections();
        this.pushUndo(sections);
        const barBeats = this.beatsPerBar();
        const singleBeats = parseInt(document.getElementById('duration').value) || 4;
        const playStyle = document.getElementById('playStyle').value;
        const instrument = document.getElementById('instrument').value;

        let totalChords = 0;
        parsedBlocks.forEach(items => {
            const sec = { title: '', chords: [] };
            items.forEach(({ parsed, isBatch }) => {
                sec.chords.push(this.buildChordData(parsed, isBatch ? barBeats : singleBeats, playStyle, instrument));
            });
            sections.push(sec);
            totalChords += items.length;
        });

        saveProgressionSections(sections);
        this.activeSection = sections.length - 1;
        this.loadProgression();
        this.flashHint(`${totalChords} accord${totalChords > 1 ? 's' : ''} ajoutés sur ${parsedBlocks.length} nouvelle${parsedBlocks.length > 1 ? 's' : ''} partie${parsedBlocks.length > 1 ? 's' : ''}`);
        this.resetQuickAddInput();
    }

    // Vide et rétrécit le champ d'ajout rapide après un ajout réussi (voir addQuickChord).
    resetQuickAddInput() {
        const input = document.getElementById('quick-add-input');
        input.value = '';
        this.autoResizeQuickAdd();
        input.focus();
    }

    // Agrandit le <textarea> d'ajout rapide pour qu'il épouse son contenu (jusqu'à la limite CSS
    // max-height, au-delà de laquelle il défile en interne — voir .quick-add-input) : permet de
    // taper plusieurs lignes (une par partie, voir commitMultilineQuickAdd) sans perdre de vue ce
    // qu'on a déjà tapé plus haut.
    autoResizeQuickAdd() {
        const input = document.getElementById('quick-add-input');
        input.style.height = 'auto';
        input.style.height = `${input.scrollHeight}px`;
    }

    // Ampoule d'aide de l'ajout rapide (voir #quick-add-help dans index.html) : popover explicatif,
    // même positionnement que les autres popovers (openBackupScopeMenu...).
    openQuickAddHelp(anchorEl) {
        const help = document.getElementById('quick-add-help');
        help.hidden = false;
        anchorEl.setAttribute('aria-expanded', 'true');
        const rect = anchorEl.getBoundingClientRect();
        const pad = 8;
        const left = Math.min(rect.left, window.innerWidth - help.offsetWidth - pad);
        const top = Math.min(rect.bottom + 4, window.innerHeight - help.offsetHeight - pad);
        help.style.left = `${Math.max(pad, left)}px`;
        help.style.top = `${Math.max(pad, top)}px`;
    }

    closeQuickAddHelp() {
        const help = document.getElementById('quick-add-help');
        if (help.hidden) return;
        help.hidden = true;
        document.getElementById('quick-add-help-btn').setAttribute('aria-expanded', 'false');
    }

    // Popup léger (même style que le menu contextuel) demandant dans quelle partie insérer un ajout
    // en lot ("/", voir addQuickChord) quand il y en a plusieurs. `onPick(section)` est appelé avec
    // l'index choisi, ou 'new' pour en créer une à la volée (voir commitChordList).
    openSectionPicker(anchorEl, onPick) {
        const menu = document.getElementById('section-picker-menu');
        const sections = loadProgressionSections();
        menu.innerHTML = sections.map((sec, i) => {
            const label = (sec.title && sec.title.trim()) ? sec.title : `Partie ${i + 1}`;
            return `<button type="button" data-section-pick="${i}">${escapeHtml(label)}</button>`;
        }).join('') + `<button type="button" data-section-pick="new" class="section-pick-new">${svgIcon('plus')} Nouvelle partie</button>`;
        menu.querySelectorAll('button').forEach(btn => {
            btn.onclick = () => {
                this.closeSectionPicker();
                const val = btn.dataset.sectionPick;
                onPick(val === 'new' ? 'new' : parseInt(val));
            };
        });

        const rect = anchorEl.getBoundingClientRect();
        menu.hidden = false;
        const pad = 8;
        const left = Math.min(rect.left, window.innerWidth - menu.offsetWidth - pad);
        const top = Math.min(rect.bottom + 4, window.innerHeight - menu.offsetHeight - pad);
        menu.style.left = `${Math.max(pad, left)}px`;
        menu.style.top = `${Math.max(pad, top)}px`;
    }

    closeSectionPicker() {
        const menu = document.getElementById('section-picker-menu');
        if (menu) menu.hidden = true;
    }

    // Passe les contrôles en mode « modification » d'un accord existant
    editChord(section, index) {
        const sections = loadProgressionSections();
        const d = sections[section] && sections[section].chords[index];
        if (!d) return;
        // Bascule (ou reste) en mode Modification, quel que soit l'appelant (double-clic depuis le
        // mode Ajout, ou clic direct déjà en mode Modification collant) — seul editChord() pose
        // editingIndex, cette invariante simplifie tout le reste (voir commitLiveEdit/updateSaveButtons).
        this.appMode = 'edit';
        this.updateAppModeBanner();
        this._editSessionUndoPushed = false; // nouvelle session : un seul futur instantané Annuler, pour CET accord
        this.activeSection = section;

        document.getElementById('root').value = d.root;
        this.revealComplexQualityIfNeeded(d.quality);
        // La basse différente (voir #bass dans advanced-fields, index.html) n'est accessible qu'en
        // mode accords complexes : un accord qui en a une doit donc révéler ce mode même si sa
        // qualité, elle, reste courante (ex. Cmaj/D) — sinon le réglage resterait invisible.
        if (d.bass) this.activateMoreOptions();
        document.getElementById('quality').value = d.quality;
        this.setDurationField(beatsFromData(d));
        this.syncDurationPicker(); // reflète la nouvelle valeur sur le bouton/menu d'icônes (voir setupDurationPicker)
        this.revealAdvancedIfNeeded(d);
        document.getElementById('octave').value = String(octaveFromData(d));
        document.getElementById('inversion').value = d.inversion;
        document.getElementById('drop').value = d.drop;
        document.getElementById('bass').value = d.bass || '';
        document.getElementById('playStyle').value = d.playStyle || 'held';
        this.syncPlayStylePicker(); // reflète la nouvelle valeur sur le bouton/menu d'icônes (voir setupPlayStylePicker)
        document.getElementById('instrument').value = d.instrument || 'piano';
        const intensityValue = (d.intensity != null) ? d.intensity : DEFAULT_INTENSITY;
        document.getElementById('intensity').value = intensityValue;
        const intensityValEl = document.getElementById('intensity-val');
        if (intensityValEl) intensityValEl.textContent = intensityValue;

        const chord = new Chord(d.root, d.quality, beatsFromData(d), d.inversion, d.drop, octaveFromData(d), d.bass, d.guitarLock, d.extraNotes);
        this.seqTouched = true; // le motif résolu ci-dessous fait autorité, on ne le régénère plus tant qu'on ne touche pas un réglage
        this.seqSelections = [];
        this.seqPage = 0; // nouvel accord chargé pour édition : on repart de sa première mesure
        this.clearSeqHistory(); // nouvel accord chargé pour édition : l'historique précédent ne s'applique plus
        const { pattern, tie } = this.resolveSeqPatternForData(chord, d);
        this.setLiveSeqPattern(pattern, tie);
        this.seqLastChordToneVoices = chord.getIntervals().length; // repère de départ pour applyNewVoiceDefaults

        this.editingIndex = index;
        document.getElementById('save').innerHTML = svgIcon('check') + ' Modifier';
        document.getElementById('cancel-edit').hidden = false;
        this.updateEditActionsDocking();

        // Restaure le doigté guitare verrouillé de CET accord (voir toggleGuitarLock) — la vue live
        // reconstruit son propre Chord à chaque frappe (readChord(), qui ne porte jamais ce champ),
        // donc ensureGuitarDiagram doit être explicitement autorisé à le garder pour CE recalcul-ci
        // (sinon il l'effacerait, croyant passer à un accord différent — voir keepGuitarLockOnce).
        this.guitarLock = d.guitarLock || null;
        this._keepGuitarLockOnce = true;
        // Restaure les notes libres déjà enregistrées pour CET accord (voir addSequencerNote) — clonées
        // pour ne jamais muter directement le tableau stocké dans sections[].chords[].
        this.extraNotes = (d.extraNotes || []).map(x => ({ ...x }));
        // Restaure les réglages fins d'intensité par croche (mode studio) de CET accord, clonés pour la
        // même raison — jamais muter directement l'objet stocké dans sections[].chords[].
        this.intensityPerStep = { ...(d.intensityPerStep || {}) };
        // this.studioMode N'EST PLUS remis à zéro ici (voir STUDIO_MODE_KEY) : réglage global de
        // l'appareil désormais, pas un état propre à CET accord.
        this.refreshPreview();
        this.renderSequencer();
        this.loadProgression();     // met en évidence la case en édition
        // Remonte vers les contrôles pour voir ce qu'on modifie — UNIQUEMENT sur bureau (au-delà du
        // seuil où .col-left/.col-right redeviennent deux vraies colonnes séparées, voir le même
        // seuil dans style.css) : en dessous, la grille et #current-chord-display partagent le MÊME
        // flux de défilement vertical (une seule colonne empilée), donc ce scrollIntoView emportait
        // toute la page loin de la grille à chaque accord touché (retour utilisateur : "ça scrolle
        // tout de suite en bas" en Modification, sur téléphone) — sur bureau, ce sont deux panneaux
        // vraiment distincts, où ça reste utile et sans effet de bord.
        if (window.innerWidth > 899) {
            document.getElementById('current-chord-display').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // Ferme le panneau d'édition SANS quitter le mode Modification collant (voir le bandeau Ajout/
    // Modification) : rien à valider (déjà tout appliqué en direct, voir commitLiveEdit), donc plus
    // besoin d'un "Annuler" qui défait — Ctrl+Z fait déjà ce travail sur toute la session. Ce bouton
    // (réétiqueté "Fermer" en mode Modification, voir updateSaveButtons) referme juste CET accord,
    // prêt à en cliquer un autre directement.
    cancelEdit() {
        this.exitEditMode(false);
        this.loadProgression();
    }

    // `resetMode` (true par défaut) : repasse aussi en mode Ajout — le comportement de TOUJOURS avant
    // cette fonctionnalité, utilisé partout ailleurs où le contexte change radicalement (suppression du
    // morceau, changement de partie...). Seul cancelEdit() (bouton Fermer en mode Modification) passe
    // explicitement false, pour rester prêt à cliquer un autre accord sans repasser par le bandeau.
    exitEditMode(resetMode = true) {
        this.editingIndex = null;
        document.getElementById('save').innerHTML = svgIcon('plus') + ' Ajouter';
        document.getElementById('cancel-edit').hidden = true;
        this.updateEditActionsDocking();
        // Les notes libres restaurées (voir editChord) étaient propres à CET accord — repartir sans,
        // comme pour un tout nouvel accord, plutôt que les recopier malgré soi sur le suivant.
        this.extraNotes = [];
        // Idem pour le verrou guitare (voir toggleGuitarLock) : propre à CET accord, jamais à recopier
        // malgré soi sur le suivant si jamais il partage la même identité (racine/qualité/voicing) —
        // guitarKey à null force aussi ensureGuitarDiagram à tout recalculer dès le prochain accord.
        this.guitarLock = null;
        this.guitarKey = null;
        this.guitarIdentityKey = null;
        // Idem : réglages fins d'intensité propres à CET accord (voir editChord/computeVelocity).
        this.intensityPerStep = {};
        // this.studioMode N'EST PLUS remis à zéro ici (voir STUDIO_MODE_KEY) : réglage global de
        // l'appareil désormais, pas un état propre à CET accord.
        document.getElementById('intensity').value = DEFAULT_INTENSITY;
        const val = document.getElementById('intensity-val');
        if (val) val.textContent = DEFAULT_INTENSITY;
        if (resetMode) {
            this.appMode = 'add';
            this.updateAppModeBanner();
        }
    }

    // Déplace le bloc Ajouter/À la suite/Annuler entre sa place normale (juste au-dessus de la carte
    // Morceau) et le pied de colonne ancré (.dock, au-dessus de la barre de lecture), selon qu'on est
    // en train de modifier un accord existant ou non — pour que ces boutons restent toujours visibles
    // pendant l'édition, sans avoir à remonter le panneau de réglages qui peut défiler. Le nœud DOM lui-
    // même est déplacé (pas dupliqué) : un seul jeu de boutons, mêmes ids, mêmes écouteurs.
    updateEditActionsDocking() {
        const editActions = document.getElementById('edit-actions');
        const dock = document.getElementById('footer-dock');
        const transport = dock && dock.querySelector('.transport');
        if (!editActions || !dock || !transport) return;
        if (this.editingIndex != null) {
            dock.insertBefore(editActions, transport);
        } else {
            const panelControls = document.querySelector('.panel-controls');
            panelControls.insertBefore(editActions, panelControls.lastElementChild);
        }
    }

    getRomanNumeral(globalRoot, globalMode, chordRoot, chordQuality) {
        const diff = (NOTES.indexOf(chordRoot) - NOTES.indexOf(globalRoot) + 12) % 12;

        // Dominante secondaire : un accord de dominante (7/9/11/13) qui n'est pas déjà LA dominante
        // de la tonalité, mais qui résout naturellement une quarte au-dessus sur un degré diatonique
        // -> chiffré "V7/x" (x = le degré ciblé, ex. "V7/V" pour un Ré7 en Do majeur) plutôt que
        // par son propre degré brut (qui donnerait à tort "II7").
        const DOMINANT_SUFFIX = { dom7: '7', dom9: '9', dom11: '11', dom13: '13' };
        if (DOMINANT_SUFFIX[chordQuality] && diff !== 7) {
            const scale = MODE_SCALES[globalMode] || MODE_SCALES.maj;
            const targetDiff = (diff + 5) % 12; // la quarte au-dessus = la tonique que cible cette dominante
            if (scale.includes(targetDiff)) {
                return `V${DOMINANT_SUFFIX[chordQuality]}/${diatonicNumeralFor(targetDiff, globalMode)}`;
            }
        }

        let numeral = romanMapFor(globalMode)[diff];

        const MINOR_FAMILY = ['min', 'min7', 'm6', 'm9', 'dim', 'dim7', 'm7b5'];
        if (MINOR_FAMILY.includes(chordQuality) || chordQuality.startsWith('min')) numeral = numeral.toLowerCase();

        if (chordQuality === 'dim' || chordQuality === 'dim7') numeral += '°';
        else if (chordQuality === 'm7b5') numeral += 'ø';
        else if (chordQuality === 'aug') numeral += '+';
        else if (chordQuality === 'sus2' || chordQuality === 'sus4') numeral += chordQuality;
        else {
            // Reprend le même chiffrage que le symbole (7, 9, 11, 13, 6...) pour maj7/dom7/min7
            // ainsi que les nouveaux types enrichis, sans re-préciser maj/m (déjà donné par la casse)
            const ROMAN_SUFFIX = {
                maj7: '7', dom7: '7', min7: '7',
                '6': '6', m6: '6',
                add9: '9', m9: '9', dom9: '9',
                add11: '11', dom11: '11', dom13: '13'
            };
            if (ROMAN_SUFFIX[chordQuality]) numeral += ROMAN_SUFFIX[chordQuality];
        }
        return numeral;
    }

    // Fonction harmonique (Tonique/Sous-dominante/Dominante) d'un accord, affichée UNIQUEMENT quand
    // elle est admise sans grande controverse en harmonie fonctionnelle — jamais forcée sur les degrés
    // où les théoriciens eux-mêmes divergent (retour utilisateur : mieux vaut une zone grise honnête
    // qu'une étiquette fausse qui a l'air sûre d'elle). Renvoie 'T'/'SD'/'D', ou null (zone grise) :
    //   - un accord chromatique/emprunté SANS être une dominante secondaire reconnue (fonction alors
    //     sans ambiguïté : préparer le degré qu'elle tonicise, MÊME MOTIF de détection que
    //     getRomanNumeral/DOMINANT_SUFFIX ci-dessus, exclu ici en plus sur le Ier degré : un accord de
    //     dominante posé sur la tonique elle-même — ex. "I7" en blues — est trop dépendant du style/
    //     genre pour être tranché ici, contrairement à une vraie dominante secondaire) ;
    //   - le degré iii, dont la fonction (tonique OU dominante affaiblie, selon les auteurs — accord
    //     partagé à 2 notes avec chacun des deux) est un cas d'école de désaccord théorique documenté
    //     (Piston, Aldwell/Schachter) ;
    //   - le degré vi/VI, dont le traitement (substitut de tonique, ou pré-dominante dans certaines
    //     lectures) varie lui aussi selon les auteurs ;
    //   - en mode mineur naturel (this.MODE_SCALES.min, sans sensible remontée), le VIIe degré est une
    //     SOUS-TONIQUE (bVII, accord majeur un ton sous la tonique) — pas le même accord ni la même
    //     fonction que le vii° (sensible diminuée) du mode majeur, donc PAS un substitut de dominante
    //     fiable ici (contrairement au mode majeur).
    chordFunction(globalRoot, globalMode, chordRoot, chordQuality) {
        const scale = MODE_SCALES[globalMode] || MODE_SCALES.maj;
        const diff = (NOTES.indexOf(chordRoot) - NOTES.indexOf(globalRoot) + 12) % 12;

        const DOMINANT_QUALITIES = new Set(['dom7', 'dom9', 'dom11', 'dom13']);
        if (DOMINANT_QUALITIES.has(chordQuality) && diff !== 7) {
            // Un accord de dominante posé SUR la tonique elle-même (ex. "I7" en blues) : trop dépendant
            // du style pour trancher ici (zone grise), sans retomber sur la case "Tonique" ci-dessous
            // juste parce que sa fondamentale coïncide avec le degré I — voir le commentaire de tête.
            if (diff === 0) return null;
            const targetDiff = (diff + 5) % 12; // quarte au-dessus = la tonique que cible cette dominante
            if (scale.includes(targetDiff)) return 'D';
        }

        const degree = scale.indexOf(diff);
        if (degree === -1) return null; // chromatique, sans être une dominante secondaire reconnue
        if (degree === 0) return 'T';                                    // I / i
        if (degree === 1 || degree === 3) return 'SD';                   // ii(°) / IV, iv
        if (degree === 4) return 'D';                                    // V (dominante par définition)
        if (degree === 6 && globalMode === 'maj') return 'D';            // vii° (sensible), majeur seulement
        return null;                                                     // iii, vi/VI, bVII en mineur : zone grise
    }

    // Découpe la progression en segments (un accord peut être scindé sur plusieurs lignes).
    // barStart se calcule sur la position ABSOLUE (avant repli en lignes), pour que les barres de
    // mesure tombent au bon endroit même quand une ligne ne fait pas un multiple de la mesure.
    // Échelle horizontale EFFECTIVE de la grille selon le mode : gridZoomLevelX (loupe) et
    // classicGridZoomLevelX (grille classique) sont deux réglages INDÉPENDANTS (voir leur
    // déclaration), jamais mélangés — sert partout où beatsPerRowFor a besoin de cette valeur.
    currentGridHZoom(zoomed = this.gridZoomOpen) {
        return zoomed ? this.gridZoomLevelX : this.classicGridZoomLevelX;
    }

    // beatsPerRowOverride : échelle FIXE imposée (voir buildPrintExportHtml/pdfMeasuresPerLine) au lieu
    // de la déduire du zoom écran courant — seul le PDF exporté s'en sert, la grille à l'écran passe
    // toujours null ici pour garder son comportement habituel (zoom écran).
    layoutProgression(history, beatsPerBar, zoomed = this.gridZoomOpen, beatsPerRowOverride = null) {
        const beatsPerRow = beatsPerRowOverride || beatsPerRowFor(beatsPerBar, zoomed, this.currentGridHZoom(zoomed));
        let cursor = 0;
        const cells = [];
        history.forEach((h, i) => {
            let remaining = beatsFromData(h);
            let pos = cursor;
            const segs = [];
            while (remaining > 0) {
                const row = Math.floor(pos / beatsPerRow);
                const col = pos % beatsPerRow;
                const span = Math.min(remaining, beatsPerRow - col);
                // Limites de mesure INTERNES à ce segment (un accord qui dure plusieurs mesures sans
                // être coupé de ligne) : jamais à pos elle-même (déjà couverte par barStart), une par
                // mesure entièrement contenue dans le segment.
                const innerBars = [];
                for (let b = pos - (pos % beatsPerBar) + beatsPerBar; b < pos + span; b += beatsPerBar) {
                    innerBars.push({ offset: b - pos, barNumber: Math.floor(b / beatsPerBar) + 1 });
                }
                segs.push({ index: i, row, col, span, barStart: (pos % beatsPerBar === 0), barNumber: Math.floor(pos / beatsPerBar) + 1, innerBars });
                pos += span;
                remaining -= span;
            }
            segs.forEach((s, si) => {
                s.isFirst = (si === 0);
                s.isLast = (si === segs.length - 1);
                s.split = (segs.length > 1);
            });
            cells.push(...segs);
            cursor = pos;
        });
        return { cells, rows: Math.max(1, Math.ceil(cursor / beatsPerRow)), beatsPerRow, cursor };
    }

    // Rend TOUTES les parties (couplet, refrain, ...) : chacune a son titre éditable et sa propre
    // grille. Une seule est « active » à la fois (bordure d'accent) : c'est elle que ciblent les
    // contrôles (Ajouter/Modifier), Suppr, copier/coller, etc.
    loadProgression() {
        const host = document.getElementById('progression-sections');
        // Toute reconstruction de la grille rend caduque le suivi des doigts actifs par case (voir
        // this._gridActiveTouchIds/onGridPointerDown), même raison que this._seqActiveTouchIds côté
        // séquenceur (voir renderSequencer) : évite qu'un id resté bloqué ne fasse à tort passer le
        // PROCHAIN tap à un seul doigt pour un second doigt de pince.
        this._gridActiveTouchIds.clear();
        const sections = loadProgressionSections();
        if (this.activeSection >= sections.length) this.activeSection = sections.length - 1;

        const gRoot = document.getElementById('global-root').value;
        const gMode = document.getElementById('global-mode').value;
        const useFlats = useFlatsForKey(NOTES.indexOf(gRoot), gMode);
        const beatsPerBar = this.beatsPerBar();
        const dragging = !!(this.drag && this.drag.moved);

        host.innerHTML = sections.map((sec, si) => {
            const history = sec.chords;
            const isActive = si === this.activeSection;
            let gridInner, gridStyle = '';

            if (history.length === 0) {
                const beatsPerRow = beatsPerRowFor(beatsPerBar, this.gridZoomOpen, this.currentGridHZoom());
                const plusSpan = Math.min(2, beatsPerRow);
                gridStyle = `grid-template-rows: repeat(1, var(--row-h) var(--measure-row-h)); grid-template-columns: repeat(${beatsPerRow}, 1fr);`;
                gridInner = this.buildAddCellHtml(si, 1, 0, plusSpan);
            } else {
                const { cells, rows: chordRows, beatsPerRow, cursor } = this.layoutProgression(history, beatsPerBar);
                // Case "+" (voir buildAddCellHtml) juste après le dernier accord : même ligne s'il
                // reste de la place, sinon ligne suivante — la grille (rows) doit alors en tenir compte.
                const plusCol = cursor % beatsPerRow;
                const plusRow = Math.floor(cursor / beatsPerRow);
                const plusSpan = Math.min(2, beatsPerRow - plusCol);
                const rows = Math.max(chordRows, plusRow + 1);
                // Trois lignes de grille par ligne d'ACCORDS (this.row, 0/1/2...) quand le chiffrage
                // romain est activé (Paramètres > Affichage, voir showRomanNumerals) : une fine ligne
                // AU-DESSUS (--roman-row-h, voir .row-roman), la ligne d'accords elle-même
                // (--row-h), puis celle des numéros de mesure juste en dessous (--measure-row-h) —
                // seulement deux sans le chiffrage romain (accords + numéros, comme avant). Hauteurs
                // toujours EXPLICITES, jamais "auto" — plus robuste d'un navigateur à l'autre qu'un
                // dimensionnement intrinsèque basé sur le contenu. rowsPerGroup/chordRowOffset
                // traduisent this.row en ligne CSS partout plus bas dans ce bloc (cellules d'accord,
                // chiffrage romain, numéros de mesure, plage de boucle, case "+").
                const showRoman = this.showRomanNumerals;
                const showFunction = this.showChordFunction;
                // Degrés et fonction harmonique partagent la MÊME ligne dédiée (voir plus bas) : une
                // ligne de plus à réserver dès que l'UN des deux est actif, pas une par réglage.
                const showExtraRow = showRoman || showFunction;
                const rowsPerGroup = showExtraRow ? 3 : 2;
                const chordRowOffset = showExtraRow ? 2 : 1;
                const rowTemplate = showExtraRow
                    ? 'var(--roman-row-h) var(--row-h) var(--measure-row-h)'
                    : 'var(--row-h) var(--measure-row-h)';
                gridStyle = `grid-template-rows: repeat(${rows}, ${rowTemplate}); grid-template-columns: repeat(${beatsPerRow}, 1fr);`;
                const loopRange = this.loopRangeForSection(si, history.length);
                // Mesure ATTEINTE par un étirement de durée d'accord EN COURS (voir onResizeStart/
                // onResizeMove) : même principe que _highlightSeqBeatLabel pour le séquenceur (retour
                // utilisateur : "je veux faire pareil pour les étirements des accords de la grille") —
                // le numéro de mesure existant (.row-measure) s'allume au lieu d'ajouter un repère en
                // plus. Calculée ici (pas en JS séparé) : ce rendu est déjà rejoué à CHAQUE pas du
                // glissé (voir onResizeMove -> loadProgression), donc déjà à jour sans code à part.
                let resizeReachedBar = null;
                if (this.resize && this.resize.section === si) {
                    const segs = cells.filter(s => s.index === this.resize.index);
                    if (segs.length) {
                        const edgeSeg = this.resize.edge === 'left' ? segs[0] : segs[segs.length - 1];
                        const absBeat = edgeSeg.row * beatsPerRow + edgeSeg.col
                            + (this.resize.edge === 'left' ? 0 : edgeSeg.span - 1);
                        resizeReachedBar = Math.floor(absBeat / beatsPerBar) + 1;
                    }
                }
                // Repère de contretemps sous la grille : UN SEUL trait par MESURE, posé pile en son
                // milieu (pas un par temps comme au tout premier essai — bien trop chargé avec une
                // colonne de grille = un temps entier, retour utilisateur : "je veux seulement des
                // tirets au niveau des milieux de mesure, un seul tiret entre mesures 1 et 2 par
                // exemple"). Position = barStart + beatsPerBar/2, en temps ABSOLUS (pas cells) pour ne
                // rater aucune mesure même sur un accord étalé sur plusieurs mesures. Chiffrage pair
                // (ex 4/4, milieu = temps 2 pile) : la frontière tombe exactement entre deux colonnes ->
                // case à cheval sur les deux (span 2), centrée dessus, même principe que le repère du
                // séquenceur. Chiffrage impair (ex 3/4, milieu = temps 1 et demi) : le milieu tombe en
                // plein milieu d'UNE SEULE colonne -> case span 1 centrée dedans. Décoratif seul
                // (pointer-events:none en CSS) : ne doit jamais intercepter le glisser qui définit une
                // plage à boucler sur cette même ligne.
                let offbeatTicksHtml = '';
                const totalBars = Math.ceil(cursor / beatsPerBar);
                for (let barIdx = 0; barIdx < totalBars; barIdx++) {
                    const pos = barIdx * beatsPerBar + beatsPerBar / 2;
                    if (pos >= cursor) continue; // dernière mesure trop courte pour avoir un milieu affiché
                    const r = Math.floor(pos / beatsPerRow);
                    const colFloat = pos % beatsPerRow;
                    const colFloor = Math.floor(colFloat);
                    const onBoundary = Math.abs(colFloat - colFloor) < 1e-9 && colFloor > 0;
                    const gridCol = onBoundary ? `${colFloor} / span 2` : `${colFloor + 1} / span 1`;
                    offbeatTicksHtml += `<div class="row-offbeat" style="grid-column: ${gridCol}; grid-row: ${r * rowsPerGroup + rowsPerGroup};"><span class="offbeat-dot"></span></div>`;
                }
                // Numéro de mesure à la FIN de la grille (juste avant la case "+", même position/ligne
                // qu'elle — voir plusRow/plusCol plus haut) : jusqu'ici, ce numéro n'apparaissait que si
                // on prolongeait un accord jusque-là (son propre .row-measure de départ) — retour
                // utilisateur : "je devrais voir le 4 sous la grille à la fin. Je le vois uniquement si
                // je prolonge encore l'accord. Je veux voir le numéro de mesure à la fin de la grille."
                // N'apparaît que si le contenu s'arrête PILE sur une frontière de mesure (sinon aucun
                // numéro propre à afficher) ; décoratif (pointer-events:none en CSS) — ce n'est qu'un
                // aperçu de la mesure suivante, pas encore un vrai accord sur lequel on pourrait glisser
                // pour définir une plage à boucler.
                const endMeasureHtml = (cursor > 0 && cursor % beatsPerBar === 0)
                    ? `<div class="row-measure row-measure-end" style="grid-column: ${plusCol + 1} / span 1; grid-row: ${plusRow * rowsPerGroup + rowsPerGroup};">${cursor / beatsPerBar + 1}</div>`
                    : '';
                gridInner = cells.map(s => {
                    const h = history[s.index];
                    const chordUseFlats = useFlatsForChordRoot(NOTES.indexOf(h.root), NOTES.indexOf(gRoot), gMode, useFlats);
                    let sym = noteNameForPc(NOTES.indexOf(h.root), chordUseFlats) + (QUALITY_LABEL[h.quality] ?? '');
                    if (h.bass) sym += '/' + noteNameForPc(NOTES.indexOf(h.bass), chordUseFlats);

                    let cls = 'grid-cell';
                    if (dragging && this.drag.section === si && s.index === this.drag.index) {
                        // Copie (Ctrl+glisser / appui long+glisser, voir onGridPointerDown) : l'original
                        // reste en place, seule la case survolée (là où la copie s'insérerait) est
                        // signalée — contrairement au déplacement, qui hollow-out la case déplacée.
                        cls += this.drag.copy ? ' drop-target-copy' : ' drag-placeholder';
                    } else {
                        if (isActive && s.index === this.selectedIndex) cls += ' selected';
                        if (isActive && s.index === this.editingIndex) cls += ' editing';
                        if (isActive && this.multiSelect.has(s.index)) cls += ' multi-selected';
                    }
                    // arrondis / bords de coupe selon la position du segment dans l'accord
                    if (s.split) cls += s.isFirst ? ' seg-first' : (s.isLast ? ' seg-last' : ' seg-mid');
                    // repère de début de mesure (barre de mesure)
                    if (s.barStart) cls += ' bar-start';
                    // police réduite pour les segments courts (peu de temps)
                    if (s.span === 1) cls += ' sz1'; else if (s.span === 2) cls += ' sz2';
                    // Zébrure d'une mesure sur deux (voir buildMeasureZebra), toujours affichée (y
                    // compris pour un accord court, contrairement à l'ancienne version limitée aux
                    // accords étalés sur plusieurs mesures). Plus de lavis doré ici pour la plage à
                    // boucler (voir plus bas .loop-range-bar) : confondu avec l'orange de l'édition
                    // en cours sur la case elle-même (retour utilisateur) — la bande sous la ligne
                    // de mesure suffit déjà à montrer la plage, inutile de teinter aussi l'accord.
                    const hasInnerBars = s.innerBars.length > 0;
                    const zebra = `background-image: ${buildMeasureZebra(s, beatsPerBar, beatsPerRow)};`;
                    const style = `grid-column: ${s.col + 1} / span ${s.span}; grid-row: ${s.row * rowsPerGroup + chordRowOffset}; ${zebra}`;

                    // Octave / renversement-drop (voir gridVoicingParts, options Affichage > Octave /
                    // Renversement-drop) : même notation compacte que le PDF exporté (ex. "O3-R1-D2").
                    const badgeParts = [];
                    if (this.showGridOctave) badgeParts.push(`O${octaveFromData(h)}`);
                    if (this.showGridVoicing) badgeParts.push(...gridVoicingParts(h));
                    const metaEl = (s.isFirst && badgeParts.length) ? `<span class="cell-meta">${badgeParts.join('-')}</span>` : '';
                    const contFlag = (s.split && !s.isFirst) ? ' <span class="cell-cont">↩</span>' : '';
                    // Petits traits à chaque limite de mesure interne, positionnés en % de la largeur du
                    // segment (colonnes de largeur égale au sein d'une même grille) — le dégradé qui les
                    // compose (voir .cell-tick) les estompe vers le centre pour ne jamais couper le texte.
                    const ticksEl = hasInnerBars
                        ? s.innerBars.map(ib => `<span class="cell-tick" style="left: ${(ib.offset / s.span) * 100}%;"></span>`).join('')
                        : '';
                    // Traits de TEMPS (pas seulement de mesure) sur l'accord EN COURS d'étirement — voir
                    // resizeReachedBar plus haut, même retour utilisateur. Seulement pendant le geste
                    // (this.resize), jamais en permanence : la grille montre déjà les mesures via
                    // .cell-tick/bar-start, un trait par temps posé en continu serait bien trop chargé
                    // pour le repère "discret" demandé — colonnes de largeur égale (1 temps = 1
                    // colonne, voir layoutProgression), donc en % réguliers du segment, comme ticksEl.
                    const isResizingThisChord = this.resize && this.resize.section === si && s.index === this.resize.index;
                    const beatTicksEl = (isResizingThisChord && s.span > 1)
                        ? Array.from({ length: s.span - 1 }, (_, k) => k + 1)
                            .map(k => `<span class="cell-beat-tick" style="left: ${(k / s.span) * 100}%;"></span>`).join('')
                        : '';
                    // Poignées d'étirement (durée) : bord droit sur le DERNIER segment (change la fin
                    // de l'accord) — mais AUSSI sur tout segment coupé de ligne qui n'est pas le
                    // dernier (s.split && !s.isLast) : son bord droit tombe alors pile en fin de ligne
                    // (voir layoutProgression, qui étale chaque segment intermédiaire jusqu'à
                    // beatsPerRow), un bord tout aussi réel de CE MÊME accord (même s.index) — sans ça,
                    // un accord qui déborde sur la ligne suivante ne peut plus être raccourci depuis la
                    // ligne où il commence, seulement depuis celle où il se termine. Bord gauche sur le
                    // PREMIER segment s'il existe un accord précédent dans la même partie (change son
                    // début, en empruntant/rendant des temps à ce précédent — voir onResizeStart) ;
                    // ni l'un ni l'autre pendant un glisser-déposer.
                    const notDragging = !cls.includes('drag-placeholder');
                    const resizeRightEl = ((s.isLast || s.split) && notDragging)
                        ? `<div class="cell-resize cell-resize-right" data-section="${si}" data-index="${s.index}" data-edge="right" title="Glisser pour changer la durée"></div>` : '';
                    const resizeLeftEl = (s.isFirst && s.index > 0 && notDragging)
                        ? `<div class="cell-resize cell-resize-left" data-section="${si}" data-index="${s.index}" data-edge="left" title="Glisser pour changer la durée"></div>` : '';

                    return `
                    <div class="${cls}" data-section="${si}" data-index="${s.index}" style="${style}" title="Toucher pour écouter · cliquer le nom pour le modifier · double-clic/double-tap pour l'édition complète · clic droit/appui long pour plus d'options · Cmd/Ctrl+clic pour sélection multiple (Cmd+clic sur Mac)">
                        <span class="cell-sym">${flatTight(sym)}${contFlag}</span>
                        ${metaEl}
                        ${ticksEl}
                        ${beatTicksEl}
                        ${resizeLeftEl}
                        ${resizeRightEl}
                    </div>`;
                }).join('') + (showExtraRow ? cells.filter(s => s.isFirst).map(s => {
                    const h = history[s.index];
                    const romanPart = showRoman ? this.getRomanNumeral(gRoot, gMode, h.root, h.quality) : '';
                    // Fonction harmonique (voir chordFunction) : "?" en zone grise plutôt que rien du
                    // tout, pour qu'on comprenne qu'elle a bien été examinée mais jugée peu fiable ici
                    // (retour utilisateur), pas simplement oubliée.
                    let funcPart = '';
                    if (showFunction) {
                        const fn = this.chordFunction(gRoot, gMode, h.root, h.quality);
                        funcPart = `<span class="row-function${fn ? ' fn-' + fn.toLowerCase() : ' fn-unknown'}" title="${fn ? 'Fonction harmonique' : 'Fonction harmonique incertaine (accord chromatique/degré ambigu)'}">${fn || '?'}</span>`;
                    }
                    const sep = (romanPart && funcPart) ? '<span class="row-extra-sep">·</span>' : '';
                    return `
                    <div class="row-roman" style="grid-column: ${s.col + 1} / span ${s.span}; grid-row: ${s.row * rowsPerGroup + 1};">${romanPart}${sep}${funcPart}</div>`;
                }).join('') : '') + cells.filter(s => s.barStart).map(s => `
                    <div class="row-measure${resizeReachedBar === s.barNumber ? ' row-measure-reached' : ''}" style="grid-column: ${s.col + 1} / span 1; grid-row: ${s.row * rowsPerGroup + rowsPerGroup};">${s.barNumber}</div>`
                ).join('') + cells.flatMap(s => s.innerBars.map(ib => `
                    <div class="row-measure${resizeReachedBar === ib.barNumber ? ' row-measure-reached' : ''}" style="grid-column: ${s.col + ib.offset + 1} / span 1; grid-row: ${s.row * rowsPerGroup + rowsPerGroup};">${ib.barNumber}</div>`)
                ).join('') + offbeatTicksHtml + endMeasureHtml + this.buildLoopRangeBars(cells, loopRange, rowsPerGroup)
                + this.buildAddCellHtml(si, plusRow * rowsPerGroup + chordRowOffset, plusCol, plusSpan);
            }

            const titleVal = (sec.title || '').replace(/"/g, '&quot;');
            const canDelete = sections.length > 1;
            const canMoveUp = si > 0;
            const canMoveDown = si < sections.length - 1;
            const measureCountEl = history.length > 0 ? `<span class="prog-section-measures">${sectionMeasureCount(sec, beatsPerBar)} mes.</span>` : '';
            // Conduite de voix : un seul bouton global (voir #toggle-voice-leading, à côté de
            // #grid-zoom) plutôt qu'un par partie — mais le panneau lui-même reste posé ICI, juste
            // sous la partie ACTIVE (this.activeSection), pas ailleurs : suit donc automatiquement la
            // partie sur laquelle on travaille, sans bouton à rechercher à chaque fois.
            const voiceLeadingPanel = (si === this.activeSection && this.voiceLeadingOpen && history.length >= 2)
                ? this.buildVoiceLeadingPanelHtml(si, history, gRoot, gMode, useFlats)
                : '';
            return `
            <div class="prog-section">
                <div class="prog-section-head">
                    <input type="text" class="prog-title" data-section="${si}" placeholder="Section" value="${titleVal}">
                    ${measureCountEl}
                    ${canMoveUp ? `<button type="button" class="prog-section-tool prog-section-move-up" data-section="${si}" title="Monter cette partie" aria-label="Monter cette partie">${svgIcon('up')}</button>` : ''}
                    ${canMoveDown ? `<button type="button" class="prog-section-tool prog-section-move-down" data-section="${si}" title="Descendre cette partie" aria-label="Descendre cette partie">${svgIcon('down')}</button>` : ''}
                    <button type="button" class="icon-btn prog-section-duplicate" data-section="${si}" title="Dupliquer cette partie" aria-label="Dupliquer cette partie">${svgIcon('duplicate')}</button>
                    ${canDelete ? `<button type="button" class="prog-section-del" data-section="${si}" title="Supprimer cette partie" aria-label="Supprimer cette partie">${svgIcon('trash')}</button>` : ''}
                </div>
                <div class="chord-grid" data-section="${si}" data-beats-per-row="${beatsPerRowFor(beatsPerBar, this.gridZoomOpen, this.currentGridHZoom())}" style="${gridStyle}">${gridInner}</div>
                ${voiceLeadingPanel}
            </div>`;
        }).join('');

        // Bouton global (voir index.html, à côté de #grid-zoom) : reflète l'état ouvert/fermé et se
        // désactive si la partie ACTIVE a moins de 2 accords (rien à enchaîner) — jamais retiré du DOM
        // (contrairement au panneau lui-même), donc mis à jour ici plutôt que dans le gabarit ci-dessus.
        const toggleVoiceLeadingBtn = document.getElementById('toggle-voice-leading');
        if (toggleVoiceLeadingBtn) {
            const activeSec = sections[this.activeSection];
            const available = !!activeSec && activeSec.chords.length >= 2;
            toggleVoiceLeadingBtn.disabled = !available;
            toggleVoiceLeadingBtn.classList.toggle('active', this.voiceLeadingOpen && available);
            toggleVoiceLeadingBtn.setAttribute('aria-pressed', String(this.voiceLeadingOpen && available));
        }

        // Zoom H/V + pincer-zoomer du panneau "Conduite de voix" — un seul panneau possible à la fois
        // (voir buildVoiceLeadingPanelHtml), donc pas besoin de data-section ici comme pour les autres
        // boutons de cette rangée : this.activeSection suffit déjà à savoir de quelle partie il s'agit.
        const voiceLeadingPanelEl = host.querySelector('.voice-leading-panel');
        if (voiceLeadingPanelEl) {
            this._bindZoomButtons('voiceLeading', {
                inH: voiceLeadingPanelEl.querySelector('.voice-leading-zoom-in-h'),
                outH: voiceLeadingPanelEl.querySelector('.voice-leading-zoom-out-h'),
                inV: voiceLeadingPanelEl.querySelector('.voice-leading-zoom-in-v'),
                outV: voiceLeadingPanelEl.querySelector('.voice-leading-zoom-out-v'),
            }, { stopPropagation: true });
            // Ctrl+molette : zoome les deux axes à la fois, comme les autres fenêtres zoomables de
            // l'appli (voir adjustZoomBothAxes) — posé sur le corps du panneau (touches + notes), pas
            // seulement la zone qui défile, pour rester cohérent même quand la souris est sur les touches.
            const body = voiceLeadingPanelEl.querySelector('.voice-leading-body');
            if (body) {
                this._bindCtrlWheelZoom(body, 'voiceLeading');
                this.setupPinchZoom(body, 'voiceLeading');
            }
        }

        host.querySelectorAll('.prog-title').forEach(input => {
            input.addEventListener('focus', () => this.setActiveSection(+input.dataset.section));
            input.addEventListener('change', () => this.renameSection(+input.dataset.section, input.value));
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
        });
        host.querySelectorAll('.prog-section-move-up').forEach(btn => {
            btn.onclick = (e) => { e.stopPropagation(); this.moveSection(+btn.dataset.section, -1); };
        });
        host.querySelectorAll('.prog-section-move-down').forEach(btn => {
            btn.onclick = (e) => { e.stopPropagation(); this.moveSection(+btn.dataset.section, 1); };
        });
        host.querySelectorAll('.prog-section-del').forEach(btn => {
            btn.onclick = (e) => { e.stopPropagation(); this.deleteSection(+btn.dataset.section); };
        });
        host.querySelectorAll('.prog-section-duplicate').forEach(btn => {
            btn.onclick = (e) => { e.stopPropagation(); this.duplicateSection(+btn.dataset.section); };
        });
        // Clic droit (ordinateur) / appui long (tactile) sur un accord : menu Modifier/Dupliquer/
        // Supprimer — remplace les petits boutons ✎/⧉ jusque-là superposés à la case (illisibles et
        // quasi impossibles à toucher précisément au doigt sur téléphone).
        host.querySelectorAll('.grid-cell').forEach(cell => {
            const section = +cell.dataset.section, index = +cell.dataset.index;
            this.attachContextMenuTrigger(cell, () => ({ type: 'chord', section, index }));
        });
        // Poignées d'étirement : glisser un bord d'un accord change sa durée sans repasser par le
        // panneau Accord. stopPropagation empêche aussi le glisser-déposer (réordonner) de la grille
        // de se déclencher pour le même geste (délégué plus haut, sur #progression-sections).
        host.querySelectorAll('.cell-resize').forEach(handle => {
            handle.addEventListener('pointerdown', (e) => this.onResizeStart(e, +handle.dataset.section, +handle.dataset.index, handle.dataset.edge));
        });
        // Boutons octave (loupe grille uniquement, voir shiftChordOctave) : plus posés sur la case
        // elle-même (retour utilisateur : gênaient la lecture de l'accord) mais dans une pastille
        // flottante unique, positionnée au-dessus de l'accord SÉLECTIONNÉ (voir
        // updateGridCellOctaveFloat) — rien à câbler ici, ses boutons sont déjà branchés une fois pour
        // toutes (voir setupGridCellOctaveFloat, appelé au démarrage).
        this.updateGridCellOctaveFloat();

        this.updateSaveButtons();
        this.updateGlobalUndoRedoButtons();
        // La grille vient d'être entièrement reconstruite (nouveau HTML) : la barre de lecture, elle,
        // n'est jamais réinsérée dans le gabarit lui-même (voir updateGridPlayhead) — la replacer ici
        // sinon un ré-rendu la ferait simplement disparaître.
        this.updateGridPlayhead(this.playheadSection, this.playheadIndex);
        this.fitCellSymbols(host);
        this.updatePlayButtonsForLoopRange();
    }

    // Ouvre/ferme le panneau "Conduite de voix" (voir buildVoiceLeadingPanelHtml) — un seul bouton
    // global (#toggle-voice-leading), le panneau affiché suit toujours this.activeSection tout seul
    // (voir loadProgression), donc rien à cibler ici : un simple booléen + rappel de loadProgression.
    toggleVoiceLeadingPanel() {
        this.voiceLeadingOpen = !this.voiceLeadingOpen;
        this.loadProgression();
    }

    // Piano-roll continu de TOUTE une partie (pas accord par accord comme le séquenceur) : chaque
    // accord de `history` est voisé (Chord.getVoiced(), triée du grave à l'aigu, mêmes rôles/couleurs
    // que le clavier/le PDF) et posé côte à côte, largeur proportionnelle à sa durée réelle (h.beats).
    // Des traits relient chaque voix à la voix de même rang (après tri par hauteur) de l'accord
    // suivant — une ligne PLEINE et épaisse marque une note commune tenue (aucun mouvement), une ligne
    // fine en pointillés un déplacement. Objectif : rendre visible d'un coup d'œil ce qui, dans la
    // grille elle-même, ne se voit qu'accord par accord — notes tenues, mouvements parallèles, sauts.
    // Accords de tailles différentes (triade à côté d'une 7e, extensions, basse séparée...) : relie
    // seulement jusqu'au plus petit des deux nombres de voix (en partant du grave), les voix en trop
    // de l'accord le plus fourni restent sans trait — approximation simple mais correcte dans
    // l'immense majorité des cas.
    buildVoiceLeadingPanelHtml(si, history, gRoot, gMode, useFlats) {
        // Cette construction reflète exactement l'échelle courante : le transform de secours pendant
        // un pincement (--vl-zoom-scale-x/-y, voir applyZoomLevel/style.css) repart donc de 1 jusqu'au
        // prochain cran de zoom.
        this._voiceLeadingBuiltZoomX = this.voiceLeadingZoomLevelX;
        this._voiceLeadingBuiltZoomY = this.voiceLeadingZoomLevelY;
        const PX_PER_BEAT = 56 * this.voiceLeadingZoomLevelX, ROW_H = 18 * this.voiceLeadingZoomLevelY;
        const KEY_GUTTER = 34, PAD_TOP = 30, PAD_BOTTOM = 14;
        const ROLE_GRADIENT = {
            root: ['#3fe3a0', '#00a855'], third: ['#5b98f0', '#1f5fc0'],
            fifth: ['#ff6f66', '#d42a20'], seventh: ['#ffc247', '#cc8f00'], ext: ['#dba8ee', '#c48ce6'],
        };

        const chordsInfo = history.map(h => {
            const beats = beatsFromData(h);
            const chord = new Chord(h.root, h.quality, beats, h.inversion, h.drop, octaveFromData(h), h.bass, h.guitarLock, h.extraNotes);
            const chordUseFlats = useFlatsForChordRoot(NOTES.indexOf(h.root), NOTES.indexOf(gRoot), gMode, useFlats);
            let symbol = noteNameForPc(NOTES.indexOf(h.root), chordUseFlats) + (QUALITY_LABEL[h.quality] ?? '');
            if (h.bass) symbol += '/' + noteNameForPc(NOTES.indexOf(h.bass), chordUseFlats);
            const roman = this.getRomanNumeral(gRoot, gMode, h.root, h.quality);
            const voiced = chord.getVoiced(); // déjà triée du grave à l'aigu
            const labeled = voiced.map(v => ({ ...v, label: spellChordTone(NOTES.indexOf(h.root), chordUseFlats, v.degree, v.midi, false) }));
            return { beats, width: beats * PX_PER_BEAT, symbol, roman, voiced: labeled };
        });

        const allMidis = chordsInfo.flatMap(c => c.voiced.map(v => v.midi));
        if (allMidis.length === 0) return '';
        const minMidi = Math.min(...allMidis) - 1, maxMidi = Math.max(...allMidis) + 1;
        const rows = maxMidi - minMidi + 1;
        const totalWidth = chordsInfo.reduce((sum, c) => sum + c.width, 0);
        const height = PAD_TOP + rows * ROW_H + PAD_BOTTOM;
        const yFor = (midi) => PAD_TOP + (maxMidi - midi) * ROW_H;
        const gid = (role) => `vlg-${si}-${role}`; // ids UNIQUES par partie : plusieurs panneaux peuvent
                                                     // coexister dans le DOM (voir le bug corrigé sur la
                                                     // maquette — des ids d'SVG dupliqués cassent le
                                                     // rendu des dégradés dès qu'une copie est masquée).

        // Colonne des touches de piano SÉPARÉE de la zone défilante (jamais dans le même <svg>, voir
        // .voice-leading-keys/.voice-leading-scroll dans style.css) : reste fixe pendant que la partie
        // notes défile horizontalement — retour utilisateur, l'ancienne version (touches DANS le même
        // SVG que les notes) défilait avec le reste, perdant le repère de hauteur dès qu'on avançait
        // dans une partie longue. Ivoire/noir IDENTIQUES à .key.white/.key.black (voir style.css) — pas
        // les gris presque indiscernables d'avant (retour utilisateur : "elles sont toutes foncées").
        let keysSvg = `<svg viewBox="0 0 ${KEY_GUTTER} ${height}" width="${KEY_GUTTER}" height="${height}" role="img" aria-hidden="true">`;
        for (let m = minMidi; m <= maxMidi; m++) {
            const isBlack = [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
            keysSvg += `<rect x="0" y="${yFor(m)}" width="${KEY_GUTTER}" height="${ROW_H}" fill="${isBlack ? '#171310' : '#ece1cd'}" stroke="${isBlack ? '#000' : '#2a2a2a'}" stroke-width="1"/>`;
            if (m % 12 === 0) keysSvg += `<text x="${KEY_GUTTER - 5}" y="${yFor(m) + ROW_H / 2 + 3}" font-size="9" fill="#2a2a2a" text-anchor="end" font-family="ui-monospace, monospace" font-weight="700">C${Math.floor(m / 12) - 1}</text>`;
        }
        keysSvg += `</svg>`;

        let svg = `<svg viewBox="0 0 ${totalWidth} ${height}" width="${totalWidth}" height="${height}" role="img" aria-label="Conduite de voix">`;
        svg += `<defs>${Object.entries(ROLE_GRADIENT).map(([role, [c1, c2]]) => `
            <linearGradient id="${gid(role)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`).join('')}</defs>`;

        for (let m = minMidi; m <= maxMidi; m++) {
            svg += `<rect x="0" y="${yFor(m)}" width="${totalWidth}" height="${ROW_H}" fill="${m % 12 === 0 ? '#161616' : 'transparent'}"/>`;
            svg += `<line x1="0" x2="${totalWidth}" y1="${yFor(m)}" y2="${yFor(m)}" stroke="#232323" stroke-width="1"/>`;
        }

        // en-têtes d'accord + séparateurs
        let x = 0;
        chordsInfo.forEach((c, i) => {
            svg += `<line x1="${x}" x2="${x}" y1="6" y2="${height - PAD_BOTTOM}" stroke="#2c2c2c" stroke-width="${i === 0 ? 0 : 1}"/>`;
            svg += `<text x="${x + c.width / 2}" y="16" font-size="12.5" font-weight="800" fill="#e0e0e0" text-anchor="middle">${escapeHtml(c.symbol)}</text>`;
            if (c.roman) svg += `<text x="${x + c.width / 2}" y="27" font-size="9" font-weight="700" fill="#6b6b6b" text-anchor="middle">${escapeHtml(c.roman)}</text>`;
            x += c.width;
        });
        svg += `<line x1="${x}" x2="${x}" y1="6" y2="${height - PAD_BOTTOM}" stroke="#2c2c2c" stroke-width="1"/>`;

        // lignes de conduite de voix
        x = 0;
        for (let i = 0; i < chordsInfo.length - 1; i++) {
            const a = chordsInfo[i].voiced, b = chordsInfo[i + 1].voiced;
            const xEnd = x + chordsInfo[i].width - 4, xStart = x + chordsInfo[i].width + 4;
            for (let v = 0; v < Math.min(a.length, b.length); v++) {
                const y1 = yFor(a[v].midi) + ROW_H / 2, y2 = yFor(b[v].midi) + ROW_H / 2;
                const flat = a[v].midi === b[v].midi;
                svg += `<line x1="${xEnd}" y1="${y1}" x2="${xStart}" y2="${y2}" stroke="${flat ? '#4a4a4a' : '#5a5a5a'}" stroke-width="${flat ? 2.5 : 1.6}" stroke-dasharray="${flat ? 'none' : '3,2'}"/>`;
            }
            x += chordsInfo[i].width;
        }

        // notes (par-dessus les lignes de conduite)
        x = 0;
        chordsInfo.forEach(c => {
            c.voiced.forEach(v => {
                svg += `<rect x="${x + 3}" y="${yFor(v.midi) + 2}" width="${c.width - 6}" height="${ROW_H - 4}" rx="5" fill="url(#${gid(v.role)})" stroke="rgba(0,0,0,0.35)"/>`;
                svg += `<text x="${x + 10}" y="${yFor(v.midi) + ROW_H / 2 + 3.5}" font-size="9.5" font-weight="700" fill="#06170f" font-family="ui-monospace, monospace">${escapeHtml(v.label)}</text>`;
            });
            x += c.width;
        });
        svg += `</svg>`;

        return `
        <div class="voice-leading-panel" data-section="${si}">
            <div class="voice-leading-toolbar">
                <div class="piano-legend voice-leading-legend">
                    <span class="lg"><span class="dot dot-root"></span>1</span>
                    <span class="lg"><span class="dot dot-third"></span>3</span>
                    <span class="lg"><span class="dot dot-fifth"></span>5</span>
                    <span class="lg"><span class="dot dot-seventh"></span>7</span>
                    <span class="lg"><span class="dot dot-ext"></span>Autres</span>
                </div>
                <div class="btn-wrap-group">
                    <div class="zoom-axis-group" title="Échelle horizontale">
                        <span class="zoom-axis-tag">H</span>
                        <button type="button" class="icon-btn zoom-axis-btn voice-leading-zoom-in-h" title="Agrandir l'échelle horizontale" aria-label="Agrandir l'échelle horizontale">${svgIcon('plus')}</button>
                        <button type="button" class="icon-btn zoom-axis-btn voice-leading-zoom-out-h" title="Réduire l'échelle horizontale" aria-label="Réduire l'échelle horizontale">${svgIcon('minus')}</button>
                    </div>
                    <div class="zoom-axis-group" title="Échelle verticale">
                        <span class="zoom-axis-tag">V</span>
                        <button type="button" class="icon-btn zoom-axis-btn voice-leading-zoom-in-v" title="Agrandir l'échelle verticale" aria-label="Agrandir l'échelle verticale">${svgIcon('plus')}</button>
                        <button type="button" class="icon-btn zoom-axis-btn voice-leading-zoom-out-v" title="Réduire l'échelle verticale" aria-label="Réduire l'échelle verticale">${svgIcon('minus')}</button>
                    </div>
                </div>
            </div>
            <div class="voice-leading-body">
                <div class="voice-leading-keys">${keysSvg}</div>
                <div class="voice-leading-scroll">${svg}</div>
            </div>
        </div>`;
    }

    // Une plage à boucler (bande orange/dorée glissée sur les numéros de mesure, voir setLoopRange)
    // rend le bouton « Accord » (lire seulement l'accord sélectionné/en édition) redondant à côté du
    // bouton « Grille », qui lit déjà cette plage en priorité (voir playProgression) : un seul bouton
    // Lecture suffit alors, recoloré en orange pastel pour rappeler la bande. Rappelée à chaque
    // reconstruction de la grille (voir loadProgression, seul endroit qui suit TOUTE mutation de
    // this.loopRange), donc toujours cohérente avec l'état courant sans avoir à la rappeler ailleurs.
    updatePlayButtonsForLoopRange() {
        const active = !!this.loopRange;
        const rangeTitle = 'Lire la plage à boucler';
        const normalTitle = 'Lire toute la grille';

        const play = document.getElementById('play');
        if (play) play.hidden = active;

        const playProg = document.getElementById('play-prog');
        if (playProg) {
            playProg.classList.toggle('btn-loop-range', active);
            playProg.title = active ? rangeTitle : normalTitle;
            playProg.setAttribute('aria-label', active ? rangeTitle : normalTitle);
        }

        // Boutons jumeaux du transport de la loupe grille (voir index.html, .grid-zoom-transport) :
        // se contentent de relayer un clic sur #play/#play-prog (voir leur .onclick), donc les cacher/
        // recolorer pareil ici les garde visuellement cohérents avec le pied de colonne principal.
        const zoomChord = document.getElementById('grid-zoom-play-chord');
        if (zoomChord) zoomChord.hidden = active;

        const zoomProg = document.getElementById('grid-zoom-play-prog');
        if (zoomProg) {
            zoomProg.classList.toggle('btn-loop-range', active);
            zoomProg.title = active ? rangeTitle : normalTitle;
            zoomProg.setAttribute('aria-label', active ? rangeTitle : normalTitle);
        }
    }

    // Rétrécit au besoin le texte d'un accord (ex. "B♭maj7") qui déborde de sa case — plutôt que de le
    // tronquer en "B…" (arrive surtout en mode loupe, où une case peut représenter une mesure entière
    // sur une largeur très réduite selon le nombre de mesures par ligne, voir beatsPerRowFor). sz1/sz2
    // couvrent déjà les cas fréquents (accords courts) via CSS ; ce filet de sécurité gère tout le reste
    // au pixel près, quel que soit le zoom ou la largeur d'écran.
    fitCellSymbols(host) {
        const MIN_PX = 8; // en dessous, "B♭maj7" redeviendrait illisible — mieux vaut le laisser tronquer
        host.querySelectorAll('.cell-sym').forEach(el => {
            el.style.fontSize = '';
            // Un ratio direct (plutôt que retirer 1px à la fois, insuffisant pour les cases très
            // étroites/symboles longs comme "B♭maj7" en mode loupe très zoomé) converge en 1-2 passes ;
            // quelques passes de plus rattrapent l'arrondi du navigateur sur la largeur réelle du texte.
            let attempts = 0;
            while (el.scrollWidth > el.clientWidth && attempts < 4) {
                const current = parseFloat(getComputedStyle(el).fontSize);
                if (current <= MIN_PX) break;
                const next = Math.max(MIN_PX, Math.floor(current * (el.clientWidth / el.scrollWidth) * 0.97));
                if (next >= current) break;
                el.style.fontSize = `${next}px`;
                attempts++;
            }
        });
    }

    // Bascule Ajouter / (À la suite + À la fin) / Modifier selon le contexte : un accord sélectionné
    // dans la partie active, autre que le dernier, permet d'insérer juste après lui plutôt qu'en fin
    // de partie. Appelé à chaque re-rendu de la grille (loadProgression), qui reflète toujours l'état
    // courant de sélection/édition.
    updateSaveButtons() {
        const saveBtn = document.getElementById('save');
        const insertBtn = document.getElementById('save-insert');
        const cancelBtn = document.getElementById('cancel-edit');
        if (this.appMode === 'edit') {
            // Mode Modification (voir commitLiveEdit) : chaque champ s'applique déjà tout seul, plus
            // besoin d'Ajouter/Modifier ici — inutile même avant d'avoir chargé un accord précis (le
            // bandeau seul suffit à armer ce mode, voir setupEventListeners), Ajouter n'y aurait
            // jamais rien à faire (retour utilisateur). Seul un bouton pour refermer CET accord reste
            // utile une fois qu'il y en a un (réétiqueté "Fermer", voir cancelEdit) — rien à fermer
            // tant qu'aucun n'est encore chargé.
            saveBtn.hidden = true;
            insertBtn.hidden = true;
            cancelBtn.hidden = this.editingIndex == null;
            cancelBtn.innerHTML = svgIcon('close') + ' Fermer';
            return;
        }
        saveBtn.hidden = false;
        cancelBtn.hidden = true;
        const sections = loadProgressionSections();
        const history = sections[this.activeSection] && sections[this.activeSection].chords;
        const canInsert = this.selectedIndex != null && history && this.selectedIndex < history.length - 1;
        saveBtn.innerHTML = svgIcon('plus') + (canInsert ? ' À la fin' : ' Ajouter');
        insertBtn.hidden = !canInsert;
    }

    // Bandeau Config./Ajout/Modification : reflète l'état courant sur les 3 segments (aria-pressed
    // pour le style actif) — le clic lui-même est câblé une seule fois dans setupEventListeners, pas
    // ici (appelé à chaque changement de mode/accord/onglet). Pose aussi data-app-mode sur <body> :
    // thème vert/orange discret du mode courant (voir style.css, curseurs Tempo/Intensité) — un seul
    // attribut, plutôt que de reproduire ce même if/else pour chaque élément concerné. Config. et
    // Ajout/Modification sont INDÉPENDANTS (voir this.leftPanelTab/setLeftPanelTab) : Config. actif
    // n'éteint ni ne change this.appMode, il masque juste Accord/Lecture au profit de #config-card.
    updateAppModeBanner() {
        const configSeg = document.getElementById('app-mode-config');
        const addSeg = document.getElementById('app-mode-add');
        const editSeg = document.getElementById('app-mode-edit');
        document.body.dataset.appMode = this.appMode;
        if (!addSeg || !editSeg) return;
        const showingConfig = this.leftPanelTab === 'config';
        const isEdit = !showingConfig && this.appMode === 'edit';
        const isAdd = !showingConfig && !isEdit;
        if (configSeg) {
            configSeg.classList.toggle('active', showingConfig);
            configSeg.setAttribute('aria-pressed', String(showingConfig));
        }
        addSeg.classList.toggle('active', isAdd);
        addSeg.setAttribute('aria-pressed', String(isAdd));
        editSeg.classList.toggle('active', isEdit);
        editSeg.setAttribute('aria-pressed', String(isEdit));
        // Saisie rapide (voir #quick-add-panel, sous Morceau) : uniquement utile en Ajout (retour
        // utilisateur) — en Modification, chaque case de la grille s'édite déjà directement au clic ;
        // en Config., il n'y a rien à ajouter à la grille depuis là.
        const quickAddPanel = document.getElementById('quick-add-panel');
        if (quickAddPanel) {
            quickAddPanel.hidden = !isAdd;
            if (!isAdd) this.closeQuickAddHelp();
        }
    }

    // Bascule quelle carte le panneau de gauche affiche (voir #app-mode-config/#config-card) : 'edit'
    // montre Accord/Lecture comme avant (piloté séparément par this.appMode, voir editChord etc.),
    // 'config' montre la configuration du morceau à la place. Ne touche JAMAIS this.appMode : revenir
    // sur 'edit' retrouve Ajout ou Modification tel qu'il était avant de consulter Config.
    setLeftPanelTab(tab) {
        this.leftPanelTab = tab;
        const configCard = document.getElementById('config-card');
        const accordCard = document.getElementById('accord-card');
        const lectureCard = document.getElementById('lecture-card');
        // Ajouter/À la suite/Annuler (voir #edit-actions/updateEditActionsDocking) : pas sa place en
        // Config., qui ne sert qu'à régler le morceau, pas à poser/modifier un accord (retour
        // utilisateur) — masqué qu'il soit ancré dans le pied de colonne ou dans le panneau, sans
        // toucher à sa docking ni à l'état individuel de ses boutons, retrouvé tel quel au retour.
        const editActions = document.getElementById('edit-actions');
        const showingConfig = tab === 'config';
        if (configCard) configCard.hidden = !showingConfig;
        if (accordCard) accordCard.hidden = showingConfig;
        if (lectureCard) lectureCard.hidden = showingConfig;
        if (editActions) editActions.hidden = showingConfig;
        this.updateAppModeBanner();
    }

    // Rend une partie « active » : c'est elle que ciblent Ajouter/Modifier/Suppr/copier-coller
    setActiveSection(s) {
        if (s === this.activeSection) return;
        if (this.editingIndex != null) this.exitEditMode();
        this.activeSection = s;
        this.selectedIndex = null;
        this.multiSelect = new Set();
        this.loadProgression();
    }

    // Bouton « + Ajouter une partie » : nouvelle partie vide, aussitôt active, prête à être nommée
    addSection() {
        const sections = loadProgressionSections();
        this.pushUndo(sections);
        sections.push({ title: '', chords: [] });
        saveProgressionSections(sections);
        if (this.editingIndex != null) this.exitEditMode();
        this.activeSection = sections.length - 1;
        this.selectedIndex = null;
        this.loadProgression();
        const input = document.querySelector(`.prog-title[data-section="${this.activeSection}"]`);
        if (input) input.focus();
    }

    renameSection(s, title) {
        const sections = loadProgressionSections();
        if (!sections[s]) return;
        this.pushUndo(sections);
        sections[s].title = title;
        saveProgressionSections(sections);
    }

    // Supprime une partie entière (demande confirmation si elle contient des accords)
    deleteSection(s) {
        const sections = loadProgressionSections();
        if (sections.length <= 1 || !sections[s]) return;
        const sec = sections[s];
        if (sec.chords.length > 0) {
            const label = sec.title || `Partie ${s + 1}`;
            if (!confirm(`Supprimer « ${label} » et ses ${sec.chords.length} accord(s) ?`)) return;
        }
        this.pushUndo(sections);
        sections.splice(s, 1);
        saveProgressionSections(sections);

        if (this.activeSection === s && this.editingIndex != null) this.exitEditMode();
        if (this.activeSection >= sections.length) this.activeSection = sections.length - 1;
        else if (this.activeSection > s) this.activeSection--;
        this.selectedIndex = null;
        // Une partie supprimée décale les index des suivantes : plus sûr de redéfinir la plage à
        // boucler (si elle existe) que de tenter de la remapper.
        if (this.loopRange) this.loopRange = null;

        this.loadProgression();
        this.renderSequencer(); // #seq-play reflète la plage (voir renderSequencer) — sans effet si fermé
    }

    // Duplique une partie entière (titre + tous ses accords), juste après elle — même esprit que
    // dupliquer un seul accord (bouton ⧉ de chaque case), mais pour toute une partie d'un coup (ex.
    // partir d'un couplet existant pour en écrire un second plutôt que de tout reconstruire à la main).
    duplicateSection(s) {
        const sections = loadProgressionSections();
        const sec = sections[s];
        if (!sec) return;
        this.pushUndo(sections);
        const copy = { title: sec.title ? `${sec.title} (copie)` : '', chords: sec.chords.map(c => ({ ...c })) };
        sections.splice(s + 1, 0, copy);
        saveProgressionSections(sections);
        this.activeSection = s + 1;
        this.selectedIndex = null;
        // Une partie insérée décale les index des suivantes : plus sûr de redéfinir la plage à boucler
        // (si elle existe) que de tenter de la remapper.
        if (this.loopRange) this.loopRange = null;
        this.loadProgression();
        this.renderSequencer(); // #seq-play reflète la plage (voir renderSequencer) — sans effet si fermé
    }

    // Échange une partie entière avec sa voisine immédiate (haut/bas selon delta = -1/+1) — l'ordre
    // DANS chaque partie ne change pas, seul l'ordre des parties elles-mêmes est affecté.
    moveSection(s, delta) {
        const sections = loadProgressionSections();
        const t = s + delta;
        if (t < 0 || t >= sections.length) return;
        this.pushUndo(sections);
        [sections[s], sections[t]] = [sections[t], sections[s]];
        saveProgressionSections(sections);
        if (this.editingIndex != null && (this.activeSection === s || this.activeSection === t)) this.exitEditMode();
        if (this.activeSection === s) this.activeSection = t;
        else if (this.activeSection === t) this.activeSection = s;
        this.selectedIndex = null;
        // Comme pour supprimer/dupliquer une partie : plus sûr de redéfinir la plage à boucler (si
        // elle existe) que de tenter de la remapper après cet échange.
        if (this.loopRange) this.loopRange = null;
        this.loadProgression();
        this.renderSequencer(); // #seq-play reflète la plage (voir renderSequencer) — sans effet si fermé
    }

    // Transpose TOUT le morceau (toutes les parties) de `semitones` demi-tons, et décale la tonalité
    // globale d'autant pour qu'elle reste cohérente avec les accords transposés (mêmes chiffrages
    // romains qu'avant la transposition).
    transposeSong(semitones) {
        const sections = loadProgressionSections();
        if (sections.every(sec => sec.chords.length === 0)) return;
        this.pushUndo(sections);
        sections.forEach(sec => { sec.chords = sec.chords.map(c => transposeChordData(c, semitones)); });
        saveProgressionSections(sections);

        const rootSel = document.getElementById('global-root');
        rootSel.value = NOTES[(NOTES.indexOf(rootSel.value) + semitones + 1200) % 12];
        hasUnsavedChanges = true;
        this.updateKeyLabels();

        this.loadProgression();
        this.refreshPreview();
    }

    // ---------- Morceaux : enregistrer/charger plusieurs chansons séparées ----------

    // Avant de quitter le tampon actuel (nouveau morceau, en charger un autre, fermer la page...) :
    // si des modifications ne sont pas enregistrées (voir hasUnsavedChanges/saveCurrentSong), prévient
    // qu'elles seront perdues — que le morceau ait déjà un nom ou non, contrairement à l'ancien
    // comportement (qui ne prévenait que pour un morceau jamais enregistré, puisque tout le reste
    // s'auto-sauvegardait aussitôt). Désormais async (voir openUnsavedModal) pour laisser le temps
    // de choisir Enregistrer/Exporter/Continuer/Annuler au lieu d'un simple confirm() natif —
    // tous les appelants attendent donc sa réponse (voir onSongSelectChange/newSong/openSongFromFiles).
    // Le beforeunload natif (fermeture RÉELLE de l'onglet/page) reste inchangé à côté : les
    // navigateurs n'autorisent aucun bouton personnalisé sur cette boîte-là.
    confirmDiscardUnsavedIfNeeded() {
        if (!hasUnsavedChanges) return Promise.resolve(true);
        return this.openUnsavedModal();
    }

    // Enregistre l'état actuel du tampon comme un NOUVEAU morceau nommé `name` et le rend actif —
    // cœur commun à saveCurrentAsSong (champ inline dans le panneau Morceau) et à l'enregistrement
    // direct depuis la boîte "modifications non enregistrées" (voir openUnsavedModal), qui ne peut
    // pas réutiliser ce champ-là : il peut se trouver masqué derrière Paramètres au moment où la
    // boîte s'ouvre (voir openSongFromFiles).
    // `folder` (optionnel) : range directement le morceau dans ce dossier, en le créant au passage
    // s'il n'existe pas encore (voir openNewSongModal) — comme moveSongToFolder.
    createNewSongFromCurrentState(name, folder) {
        const song = {
            id: 'song_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            name,
            savedAt: Date.now(),
            folder: folder || null,
            root: document.getElementById('global-root').value,
            mode: document.getElementById('global-mode').value,
            timeSig: document.getElementById('time-sig').value,
            groove: document.getElementById('groove').value,
            bpm: parseInt(document.getElementById('bpm').value),
            instrument: document.getElementById('instrument').value,
            sections: loadProgressionSections(),
            ...this.zoomSettingsForSong(),
        };
        const songs = loadSongs();
        songs.push(song);
        saveSongs(songs);
        if (folder) {
            const folders = loadFolders();
            if (!folders.includes(folder)) { folders.push(folder); saveFolders(folders); }
        }
        setCurrentSongId(song.id);
        hasUnsavedChanges = false;
        this.refreshSongList();
        return song;
    }

    // Boîte "modifications non enregistrées" : Enregistrer / Exporter en JSON / Continuer sans
    // enregistrer / Annuler (voir #unsaved-modal dans index.html). Si le morceau n'a encore jamais
    // été nommé, Enregistrer/Exporter basculent la boîte sur un petit champ de saisie du nom
    // (.unsaved-modal-nameprompt) au lieu du champ inline habituel du panneau Morceau, potentiellement
    // invisible si cette boîte s'ouvre par-dessus Paramètres. Résout à true (continuer) ou false
    // (annuler, rien n'a changé).
    openUnsavedModal() {
        const overlay = document.getElementById('unsaved-modal');
        const actions = overlay.querySelector('.unsaved-modal-actions');
        const namePrompt = overlay.querySelector('.unsaved-modal-nameprompt');
        const nameInput = namePrompt.querySelector('input');
        overlay.hidden = false;
        actions.hidden = false;
        namePrompt.hidden = true;

        return new Promise((resolve) => {
            const close = (result) => {
                overlay.hidden = true;
                this._unsavedModalCancel = null;
                resolve(result);
            };
            this._unsavedModalCancel = () => close(false);

            const askNameThen = (after) => {
                actions.hidden = true;
                namePrompt.hidden = false;
                nameInput.value = '';
                nameInput.focus();
                const confirmName = () => {
                    const name = nameInput.value.trim() || 'Sans titre';
                    const song = this.createNewSongFromCurrentState(name);
                    this.flashHint(`« ${song.name} » enregistré`);
                    after();
                };
                const cancelName = () => { actions.hidden = false; namePrompt.hidden = true; };
                const onKey = (e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') { e.preventDefault(); confirmName(); }
                    else if (e.key === 'Escape') { e.preventDefault(); cancelName(); }
                };
                nameInput.addEventListener('keydown', onKey, { once: true });
                namePrompt.querySelector('[data-nameprompt-ok]').onclick = confirmName;
                namePrompt.querySelector('[data-nameprompt-cancel]').onclick = cancelName;
            };

            document.getElementById('unsaved-save-continue').onclick = () => {
                if (getCurrentSongId()) { this.saveCurrentSong(); close(true); }
                else askNameThen(() => close(true));
            };
            document.getElementById('unsaved-export-continue').onclick = () => {
                if (getCurrentSongId()) { this.exportCurrentSong(); close(true); }
                else askNameThen(() => { this.exportCurrentSong(); close(true); });
            };
            document.getElementById('unsaved-discard').onclick = () => close(true);
            document.getElementById('unsaved-cancel').onclick = () => close(false);
        });
    }

    // Regroupé par dossier via <optgroup> (retour utilisateur : pouvoir naviguer entre plusieurs
    // dossiers de morceaux) — un SEUL menu déroulant reste suffisant tant qu'on ne travaille pas sur
    // des dizaines de morceaux à la fois (retour utilisateur), plutôt qu'une UI de navigation à
    // plusieurs niveaux. <optgroup> inutile (liste plate comme avant) si aucun dossier n'est utilisé.
    refreshSongList() {
        const select = document.getElementById('song-select');
        if (!select) return;
        const songs = loadSongs();
        const currentId = getCurrentSongId();
        const sortRecent = (arr) => arr.slice().sort((a, b) => b.savedAt - a.savedAt);

        const folderNames = loadFolders().slice().sort((a, b) => a.localeCompare(b, 'fr'));
        const knownNames = new Set(folderNames);
        // Dossier référencé par un morceau mais absent du registre (cas limite, ex. import) : regroupé
        // quand même plutôt que silencieusement mélangé à "Sans dossier".
        const strayNames = [...new Set(songs.map(s => s.folder).filter(f => f && !knownNames.has(f)))].sort((a, b) => a.localeCompare(b, 'fr'));
        const grouped = [...folderNames, ...strayNames]
            .map(name => ({ name, songs: songs.filter(s => s.folder === name) }))
            .filter(g => g.songs.length > 0);
        const noFolder = songs.filter(s => !s.folder);

        let html = `<option value="">— Non enregistré —</option>`;
        if (grouped.length > 0) {
            grouped.forEach(g => {
                html += `<optgroup label="${escapeHtml(g.name)}">${sortRecent(g.songs).map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</optgroup>`;
            });
            if (noFolder.length) {
                html += `<optgroup label="Sans dossier">${sortRecent(noFolder).map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</optgroup>`;
            }
        } else {
            html += sortRecent(songs).map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
        }
        select.innerHTML = html;
        select.value = currentId || '';
        document.getElementById('song-save').title = 'Enregistrer (Ctrl+S)';
    }

    async onSongSelectChange(id) {
        if (id === (getCurrentSongId() || '')) return;
        if (!(await this.confirmDiscardUnsavedIfNeeded())) { this.refreshSongList(); return; }
        if (!id) this.newSong(true);
        else this.loadSong(id);
    }

    // Bouton « + » du panneau Morceau : contrairement à newSong (qui ne fait que repartir sur un
    // tampon vierge « — Non enregistré — », utilisé par le select quand on y choisit cette option),
    // demande tout de suite un titre et un dossier, pour que le morceau soit RÉELLEMENT enregistré
    // dès sa création — plus besoin de passer ensuite par Enregistrer puis Paramètres > Fichiers
    // juste pour le nommer et le ranger (retour utilisateur : ce parcours en deux temps prêtait à
    // confusion, voir aussi createNewSongFromCurrentState qui accepte maintenant un dossier).
    async openNewSongModal() {
        if (!(await this.confirmDiscardUnsavedIfNeeded())) return;

        const overlay = document.getElementById('new-song-modal');
        const nameInput = document.getElementById('new-song-name-input');
        nameInput.value = '';

        // Repart toujours d'un vrai <select> : un « + Nouveau dossier… » choisi lors d'une ouverture
        // précédente de cette même modale l'a remplacé par un champ texte (voir plus bas), qui
        // resterait sinon en place avec sa valeur précédente encore dedans à la prochaine ouverture.
        let folderSelect = document.getElementById('new-song-folder-select');
        if (folderSelect.tagName !== 'SELECT') {
            const fresh = document.createElement('select');
            fresh.id = 'new-song-folder-select';
            fresh.className = 'compact';
            folderSelect.replaceWith(fresh);
            folderSelect = fresh;
        }
        folderSelect.innerHTML = buildFolderOptionsHtml(null);
        overlay.hidden = false;
        nameInput.focus();

        // « + Nouveau dossier… » : le select se change lui-même en champ de saisie, comme dans le
        // panneau Fichiers (voir startInlineNewFolderForSong) — même schéma, pas de prompt() natif.
        // Même id conservé (le select disparaît du DOM) pour que create() ci-dessous retrouve
        // toujours le bon champ, qu'il ait basculé ou non, via un seul getElementById.
        folderSelect.onchange = () => {
            if (folderSelect.value !== '__new__') return;
            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'new-song-folder-select';
            input.className = 'compact';
            input.placeholder = 'Nom du dossier…';
            folderSelect.replaceWith(input);
            input.focus();
        };

        const close = () => { overlay.hidden = true; };
        const create = () => {
            const name = nameInput.value.trim() || 'Sans titre';
            const folderEl = document.getElementById('new-song-folder-select');
            const folder = folderEl.value.trim();
            this.newSong(true); // repart d'un tampon vierge (déjà confirmé plus haut, voir newSong)
            const song = this.createNewSongFromCurrentState(name, folder);
            close();
            this.flashHint(`« ${song.name} » créé`);
        };
        document.getElementById('new-song-create').onclick = create;
        document.getElementById('new-song-cancel').onclick = close;
        overlay.onkeydown = (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); create(); }
            else if (e.key === 'Escape') { e.preventDefault(); close(); }
        };
    }

    // Repart d'un morceau vierge (tonalité C majeur, 120 BPM, une partie sans titre)
    async newSong(skipConfirm) {
        if (!skipConfirm && !(await this.confirmDiscardUnsavedIfNeeded())) return;
        setCurrentSongId(null);
        document.getElementById('global-root').value = 'C';
        document.getElementById('global-mode').value = 'maj';
        document.getElementById('time-sig').value = '4/4';
        document.getElementById('groove').value = 'straight';
        document.getElementById('bpm').value = 120;
        document.getElementById('bpm-val').value = '120';
        saveProgressionSections([{ title: '', chords: [] }], false); // nouveau tampon vierge, rien à enregistrer
        hasUnsavedChanges = false;
        this.clearHistory(); // changement de morceau : l'historique annuler/rétablir n'a plus de sens
        this.activeSection = 0;
        this.selectedIndex = null;
        if (this.editingIndex != null) this.exitEditMode();
        this.updateKeyLabels();
        this.updateDurationOptions();
        this.loadProgression();
        this.refreshPreview();
        this.refreshSongList();
    }

    // Échelles horizontale/verticale de la loupe grille/séquenceur, telles qu'à conserver DANS le
    // morceau lui-même (voir createNewSongFromCurrentState/saveCurrentSong) plutôt que dans les seules
    // préférences de cet appareil (harmohubGridZoomLevelX, etc.) : retour utilisateur — rouvrir ce
    // morceau sur un autre ordinateur (après export/import du fichier, voir exportCurrentSong) doit
    // retrouver les derniers réglages de zoom mis en place dessus, pas ceux de l'appareil courant.
    zoomSettingsForSong() {
        return {
            gridZoomLevelX: this.gridZoomLevelX,
            gridZoomLevelY: this.gridZoomLevelY,
            classicGridZoomLevelX: this.classicGridZoomLevelX,
            classicGridZoomLevelY: this.classicGridZoomLevelY,
            seqZoomLevelX: this.seqZoomLevelX,
            seqZoomLevelY: this.seqZoomLevelY,
            seqInlineZoomLevelX: this.seqInlineZoomLevelX,
        };
    }

    // Charge un morceau enregistré : il devient le morceau ouvert, mais n'est plus auto-sauvegardé en
    // continu (voir hasUnsavedChanges/saveCurrentSong) — il faut Enregistrer/Ctrl+S pour persister
    // toute modification ultérieure.
    // Réglages « Morceau » (tonalité, mode, rythme, groove, tempo, instrument par défaut) tels
    // qu'enregistrés dans ce morceau — partagé entre loadSong (choix dans le sélecteur) et
    // restoreCurrentSongSettingsIfAny (tout premier rendu de la page, voir constructeur) : avant ça,
    // seul loadSong les restaurait, si bien qu'un simple rechargement de page (F5) avec un morceau déjà
    // ouvert retombait sur les valeurs par défaut du HTML pour tout SAUF les accords (myProgression,
    // restauré séparément) — retour utilisateur : réouvrir un morceau doit retrouver exactement les
    // réglages de sa dernière sauvegarde.
    applySongSettingsToDom(song) {
        document.getElementById('global-root').value = song.root || 'C';
        this.revealComplexModeIfNeeded(song.mode || 'maj');
        document.getElementById('global-mode').value = song.mode || 'maj';
        document.getElementById('time-sig').value = song.timeSig || '4/4';
        document.getElementById('groove').value = song.groove || 'straight';
        document.getElementById('bpm').value = song.bpm || 120;
        document.getElementById('bpm-val').value = String(song.bpm || 120);
        // Son par défaut pour un NOUVEL accord ajouté à ce morceau (chaque accord déjà posé garde de
        // toute façon le sien, voir data.instrument) — sans ça, il restait celui du dernier morceau
        // ouvert plutôt que de retrouver celui utilisé quand celui-ci a été enregistré (retour
        // utilisateur).
        if (song.instrument && INSTRUMENT_BANKS[song.instrument]) {
            document.getElementById('instrument').value = song.instrument;
            localStorage.setItem(INSTRUMENT_KEY, song.instrument);
        }
        // Échelles horizontale/verticale des loupes (voir zoomSettingsForSong) : reprises DE CE
        // MORCEAU (1 par défaut pour un morceau enregistré avant ce réglage, ou jamais zoomé) plutôt
        // que de laisser trainer celles du morceau précédemment ouvert sur cet appareil, ou de
        // dépendre de l'appareil courant — retour utilisateur : retrouver les mêmes réglages sur un
        // autre ordinateur, une fois ce morceau réimporté là-bas.
        this.gridZoomLevelX = song.gridZoomLevelX || 1;
        this.gridZoomLevelY = song.gridZoomLevelY || 1;
        this.classicGridZoomLevelX = song.classicGridZoomLevelX || 1;
        this.classicGridZoomLevelY = song.classicGridZoomLevelY || 1;
        this.seqZoomLevelX = song.seqZoomLevelX || 1;
        this.seqZoomLevelY = song.seqZoomLevelY || 1;
        this.seqInlineZoomLevelX = song.seqInlineZoomLevelX || 1;
    }

    // Au tout premier rendu de la page (voir constructeur) : un morceau reste "ouvert" d'une session à
    // l'autre (currentSongId persiste), mais seuls les accords (myProgression) survivaient jusqu'ici à
    // un rechargement — tonalité/tempo/rythme/groove/instrument retombaient aux valeurs par défaut du
    // HTML. N'écrase PAS les accords (déjà corrects via myProgression, qui reflète aussi bien un
    // morceau tout juste enregistré que des modifications en cours non encore enregistrées).
    restoreCurrentSongSettingsIfAny() {
        const id = getCurrentSongId();
        if (!id) return;
        const song = loadSongs().find(s => s.id === id);
        if (!song) return;
        this.applySongSettingsToDom(song);
    }

    loadSong(id) {
        const song = loadSongs().find(s => s.id === id);
        if (!song) return;
        setCurrentSongId(id);
        this.applySongSettingsToDom(song);
        saveProgressionSections(song.sections && song.sections.length ? song.sections : [{ title: '', chords: [] }], false);
        hasUnsavedChanges = false; // tampon tout juste chargé, identique au morceau enregistré
        this.clearHistory(); // changement de morceau : l'historique annuler/rétablir n'a plus de sens
        this.activeSection = 0;
        this.selectedIndex = null;
        if (this.editingIndex != null) this.exitEditMode();
        this.updateKeyLabels();
        this.updateDurationOptions();
        this.applyZoomLevel('classicGrid'); // reflète l'échelle verticale DE CE MORCEAU + 1er rendu
        this.refreshPreview();
        this.refreshSongList();
    }

    // Enregistre RÉELLEMENT les modifications (bouton « Enregistrer » / Ctrl+S) : écrase le morceau
    // déjà ouvert avec l'état actuel du tampon de travail — plus aucune auto-sauvegarde en continu
    // (voir hasUnsavedChanges), c'est désormais le SEUL moment où le morceau enregistré change.
    // Si aucun morceau n'est encore ouvert, il faut bien lui donner un nom une première fois :
    // se comporte alors comme « Enregistrer sous » (voir saveCurrentAsSong).
    saveCurrentSong() {
        const id = getCurrentSongId();
        if (!id) { this.saveCurrentAsSong(); return; }
        syncCurrentSong({
            sections: loadProgressionSections(),
            root: document.getElementById('global-root').value,
            mode: document.getElementById('global-mode').value,
            timeSig: document.getElementById('time-sig').value,
            groove: document.getElementById('groove').value,
            bpm: parseInt(document.getElementById('bpm').value),
            instrument: document.getElementById('instrument').value,
            ...this.zoomSettingsForSong(),
        });
        hasUnsavedChanges = false;
        this.refreshSongList();
        this.flashHint('Morceau enregistré');
    }

    // Enregistre l'état actuel comme un NOUVEAU morceau (appelé uniquement quand aucun morceau n'est
    // encore ouvert — voir saveCurrentSong et les export PDF/MIDI/MP3, qui en ont besoin pour nommer
    // le fichier). Le select se cache et un champ de saisie apparaît à sa place, plutôt qu'un prompt()
    // natif pour choisir le nom du morceau à enregistrer.
    // `reason` (optionnel) : affiché en indice quand l'appel vient d'ailleurs que du bouton
    // Enregistrer (ex. export PDF/MIDI/MP3 bloqué tant que le morceau n'a pas de nom) — sans lui,
    // le champ de renommage peut apparaître hors du cadre visible sans que rien n'explique pourquoi
    // l'action d'origine n'a eu aucun effet apparent.
    saveCurrentAsSong(reason) {
        const select = document.getElementById('song-select');
        if (!select || select.hidden) return; // déjà en cours de saisie

        select.hidden = true;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'compact song-select-full inline-rename-input';
        input.placeholder = 'Nom du morceau…';
        select.insertAdjacentElement('afterend', input);
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus();
        if (reason) this.flashHint(reason);

        const finish = () => { input.remove(); select.hidden = false; };
        const commit = () => {
            const song = this.createNewSongFromCurrentState(input.value.trim() || 'Sans titre');
            this.flashHint(`« ${song.name} » enregistré`);
            finish();
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            else if (e.key === 'Escape') { e.preventDefault(); input.removeEventListener('blur', commit); finish(); }
        });
    }

    // Renomme EN PLACE (même id) le morceau actuellement ouvert — bouton crayon #song-rename ou
    // double-clic/double-tap sur son titre (voir wiring dans setupEventListeners), les deux mènent ici.
    // Ne fait rien si rien n'est encore enregistré : pas de nom à changer, il faut d'abord
    // « Enregistrer » une première fois (voir saveCurrentAsSong).
    startInlineRenameSongMain() {
        const id = getCurrentSongId();
        if (!id) { this.flashHint('Enregistre d\'abord ce morceau pour pouvoir le renommer'); return; }
        const songs = loadSongs();
        const song = songs.find(s => s.id === id);
        if (!song) return;
        const select = document.getElementById('song-select');
        if (!select || select.hidden) return; // déjà en cours de saisie (ex. Enregistrer)

        select.hidden = true;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'compact song-select-full inline-rename-input';
        input.value = song.name;
        select.insertAdjacentElement('afterend', input);
        input.focus();
        input.select();

        let done = false;
        const finish = () => { input.remove(); select.hidden = false; };
        const commit = () => {
            if (done) return;
            done = true;
            const val = input.value.trim();
            if (val && val !== song.name) {
                this.pushFilesUndo();
                song.name = val;
                saveSongs(songs);
            }
            finish();
            this.refreshSongList();
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            else if (e.key === 'Escape') { e.preventDefault(); done = true; input.removeEventListener('blur', commit); finish(); }
        });
    }

    // ---------- Fenêtre Paramètres ----------
    // Un onglet à la fois (voir setSettingsTab) : Fichiers peut être long (beaucoup de morceaux/
    // dossiers), inutile de le faire défiler pour changer un simple réglage Son. Ajouter une future
    // section = un nouveau bouton .settings-tab + panneau + sa fonction de rendu, appelée ici.
    openSettings() {
        this.settingsOpen = true;
        document.getElementById('settings-overlay').hidden = false;
        document.getElementById('open-settings').classList.add('active');
        // Comme openGridZoom/openSeqZoom (voir lockBodyScroll) : sans ça, faire défiler le contenu
        // des Paramètres (l'onglet Fichiers peut être long) faisait aussi défiler l'arrière-plan de
        // l'appli en dessous, surtout gênant sur téléphone (retour utilisateur).
        this.lockBodyScroll();
        this.renderAudioPanel();
        this.renderDisplayPanel();
        this.renderFilesPanel();
        this.setSettingsTab(this.settingsTab); // reprend l'onglet quitté la dernière fois (défaut : Son)
        this.updateGlobalUndoRedoButtons(); // le bouton unique repointe vers l'historique Fichiers
    }

    setSettingsTab(tab) {
        this.settingsTab = tab;
        document.querySelectorAll('.settings-tab').forEach(btn => {
            btn.setAttribute('aria-selected', String(btn.dataset.settingsTab === tab));
        });
        document.querySelectorAll('.settings-panel').forEach(panel => {
            panel.hidden = panel.dataset.settingsPanel !== tab;
        });
        document.querySelector('.settings-content')?.scrollTo(0, 0);
    }

    closeSettings() {
        this.settingsOpen = false;
        document.getElementById('settings-overlay').hidden = true;
        document.getElementById('open-settings').classList.remove('active');
        this.unlockBodyScroll();
        this.updateGlobalUndoRedoButtons();
        // L'ampoule d'aide de l'ajout rapide vit désormais dans l'onglet Affichage (voir
        // renderDisplayPanel) : sans ça, son popover (position fixe, hors de #settings-overlay)
        // resterait affiché après coup, sans bouton visible pour le refermer.
        this.closeQuickAddHelp();
    }

    // ---- Panneau Son : volume général (maître), puis volume du métronome ----
    renderAudioPanel() {
        const host = document.getElementById('settings-panel-audio');
        if (!host) return;
        host.innerHTML = `
            <div class="settings-slider-row">
                <div class="settings-slider-head">
                    <label for="general-volume">Volume général</label>
                    <span class="val" id="general-volume-val">${this.generalVolumePercent}</span>
                </div>
                <input type="range" id="general-volume" min="0" max="100" value="${this.generalVolumePercent}">
            </div>
            <div class="settings-slider-sep"></div>
            <div class="settings-slider-row">
                <div class="settings-slider-head">
                    <label for="metronome-volume">Volume du métronome</label>
                    <span class="val" id="metronome-volume-val">${this.metronomeVolumePercent}</span>
                </div>
                <input type="range" id="metronome-volume" min="0" max="100" value="${this.metronomeVolumePercent}">
            </div>
            <div class="settings-select-row">
                <label for="metronome-sound">Son du métronome</label>
                <select id="metronome-sound">
                    ${Object.entries(METRONOME_SOUNDS).map(([key, s]) =>
                        `<option value="${key}"${key === this.metronomeSoundKey ? ' selected' : ''}>${s.label}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="settings-slider-sep"></div>
            <div class="settings-toggle-row">
                <label for="toggle-autoplay-select" title="Jouer l'accord en le sélectionnant dans la grille">Jouer à la sélection</label>
                <button type="button" id="toggle-autoplay-select" class="switch" role="switch" aria-checked="${this.autoplaySelect}" aria-label="Jouer l'accord en le sélectionnant dans la grille">
                    <span class="switch-thumb"></span>
                </button>
            </div>
            <div class="settings-toggle-row">
                <label for="toggle-metronome-countin" title="Clics du décompte avant la lecture de la grille">Décompte avant lecture</label>
                <button type="button" id="toggle-metronome-countin" class="switch" role="switch" aria-checked="${this.metronomeCountIn}" aria-label="Clics du décompte avant la lecture de la grille">
                    <span class="switch-thumb"></span>
                </button>
            </div>`;

        document.getElementById('general-volume').oninput = (e) => this.setGeneralVolume(+e.target.value);
        document.getElementById('metronome-volume').oninput = (e) => this.setMetronomeVolume(+e.target.value);
        document.getElementById('metronome-sound').onchange = (e) => this.setMetronomeSound(e.target.value);
        document.getElementById('toggle-autoplay-select').onclick = () => this.setAutoplaySelect(!this.autoplaySelect);
        document.getElementById('toggle-metronome-countin').onclick = () => this.setMetronomeCountIn(!this.metronomeCountIn);
    }

    setAutoplaySelect(on) {
        this.autoplaySelect = on;
        localStorage.setItem(AUTOPLAY_SELECT_KEY, on ? '1' : '0');
        const btn = document.getElementById('toggle-autoplay-select');
        if (btn) btn.setAttribute('aria-checked', on);
    }

    setMetronomeCountIn(on) {
        this.metronomeCountIn = on;
        localStorage.setItem(METRONOME_COUNTIN_KEY, on ? '1' : '0');
        const btn = document.getElementById('toggle-metronome-countin');
        if (btn) btn.setAttribute('aria-checked', on);
    }

    // ---- Panneau Affichage : préférences visuelles de la grille et du PDF exporté. Libellés courts
    // à dessein (le détail va dans title/aria-label, pas dans le texte visible) — l'un des deux
    // réglages PDF (renversement/drop, sens mélodique) n'a pas d'équivalent à l'écran, contrairement
    // au chiffrage romain qui, lui, vaut pour les deux (voir buildPrintExportHtml/loadProgression). ----
    renderDisplayPanel() {
        const host = document.getElementById('settings-panel-display');
        if (!host) return;
        host.innerHTML = `
            <div class="settings-toggle-row">
                <label for="quick-add-help-btn" title="Comment utiliser l'ajout rapide">Aide : ajout rapide</label>
                <button type="button" id="quick-add-help-btn" class="icon-btn" title="Comment utiliser l'ajout rapide" aria-label="Comment utiliser l'ajout rapide" aria-expanded="false">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2.05V17h6v-2.25c0-.85.4-1.55 1-2.05A7 7 0 0 0 12 2Z"/></svg>
                </button>
            </div>
            <div class="settings-slider-sep"></div>
            <div class="settings-toggle-row">
                <label for="toggle-show-roman" title="Degrés (I, IV, V7...) dans la grille et le PDF">Degrés</label>
                <button type="button" id="toggle-show-roman" class="switch" role="switch" aria-checked="${this.showRomanNumerals}" aria-label="Degrés dans la grille et le PDF">
                    <span class="switch-thumb"></span>
                </button>
            </div>
            <div class="settings-toggle-row">
                <label for="toggle-show-function" title="Fonction harmonique (Tonique/Sous-dominante/Dominante) dans la grille et le PDF — affichée seulement quand elle est fiable, un « ? » sinon (voir chordFunction)">Fonction harmonique</label>
                <button type="button" id="toggle-show-function" class="switch" role="switch" aria-checked="${this.showChordFunction}" aria-label="Fonction harmonique dans la grille et le PDF">
                    <span class="switch-thumb"></span>
                </button>
            </div>
            <div class="settings-toggle-row">
                <label for="toggle-show-grid-octave" title="Octave (ex. O3) sous chaque accord de la grille">Octave</label>
                <button type="button" id="toggle-show-grid-octave" class="switch" role="switch" aria-checked="${this.showGridOctave}" aria-label="Octave sous chaque accord de la grille">
                    <span class="switch-thumb"></span>
                </button>
            </div>
            <div class="settings-toggle-row">
                <label for="toggle-show-grid-voicing" title="Renversement et drop (ex. R1-D2) sous chaque accord de la grille, si l'accord s'écarte de la position de base">Renversement / drop</label>
                <button type="button" id="toggle-show-grid-voicing" class="switch" role="switch" aria-checked="${this.showGridVoicing}" aria-label="Renversement et drop sous chaque accord de la grille">
                    <span class="switch-thumb"></span>
                </button>
            </div>
            <div class="settings-slider-sep"></div>
            <div class="settings-toggle-row">
                <label for="toggle-show-voicing-pdf" title="Octave, renversement et drop (ex. O3-R1-D2) au-dessus de chaque accord, dans le PDF exporté">Position d'accord (PDF)</label>
                <button type="button" id="toggle-show-voicing-pdf" class="switch" role="switch" aria-checked="${this.showVoicingPdf}" aria-label="Octave, renversement et drop dans le PDF exporté">
                    <span class="switch-thumb"></span>
                </button>
            </div>
            <div class="settings-select-row">
                <label for="pdf-measures-per-line" title="Échelle FIXE de la grille d'accords dans le PDF exporté : toutes les lignes occupent la même largeur par mesure, une ligne plus courte laisse un blanc plutôt que de s'étirer">Mesures par ligne (PDF)</label>
                <select id="pdf-measures-per-line">
                    ${[2, 3, 4, 5, 6, 8].map(n => `<option value="${n}"${n === this.pdfMeasuresPerLine ? ' selected' : ''}>${n}</option>`).join('')}
                </select>
            </div>`;
        document.getElementById('quick-add-help-btn').onclick = (e) => {
            const help = document.getElementById('quick-add-help');
            if (help.hidden) this.openQuickAddHelp(e.currentTarget); else this.closeQuickAddHelp();
        };
        document.getElementById('toggle-show-roman').onclick = () => this.setShowRomanNumerals(!this.showRomanNumerals);
        document.getElementById('toggle-show-function').onclick = () => this.setShowChordFunction(!this.showChordFunction);
        document.getElementById('toggle-show-grid-octave').onclick = () => this.setShowGridOctave(!this.showGridOctave);
        document.getElementById('toggle-show-grid-voicing').onclick = () => this.setShowGridVoicing(!this.showGridVoicing);
        document.getElementById('toggle-show-voicing-pdf').onclick = () => this.setShowVoicingPdf(!this.showVoicingPdf);
        document.getElementById('pdf-measures-per-line').onchange = (e) => this.setPdfMeasuresPerLine(parseInt(e.target.value, 10));
    }

    setShowRomanNumerals(on) {
        this.showRomanNumerals = on;
        localStorage.setItem(SHOW_ROMAN_KEY, on ? '1' : '0');
        const btn = document.getElementById('toggle-show-roman');
        if (btn) btn.setAttribute('aria-checked', on);
        this.loadProgression();
    }

    setShowChordFunction(on) {
        this.showChordFunction = on;
        localStorage.setItem(SHOW_CHORD_FUNCTION_KEY, on ? '1' : '0');
        const btn = document.getElementById('toggle-show-function');
        if (btn) btn.setAttribute('aria-checked', on);
        this.loadProgression();
    }

    setShowGridOctave(on) {
        this.showGridOctave = on;
        localStorage.setItem(SHOW_GRID_OCTAVE_KEY, on ? '1' : '0');
        const btn = document.getElementById('toggle-show-grid-octave');
        if (btn) btn.setAttribute('aria-checked', on);
        this.loadProgression();
    }

    setShowGridVoicing(on) {
        this.showGridVoicing = on;
        localStorage.setItem(SHOW_GRID_VOICING_KEY, on ? '1' : '0');
        const btn = document.getElementById('toggle-show-grid-voicing');
        if (btn) btn.setAttribute('aria-checked', on);
        this.loadProgression();
    }

    setShowVoicingPdf(on) {
        this.showVoicingPdf = on;
        localStorage.setItem(SHOW_VOICING_PDF_KEY, on ? '1' : '0');
        const btn = document.getElementById('toggle-show-voicing-pdf');
        if (btn) btn.setAttribute('aria-checked', on);
    }

    setPdfMeasuresPerLine(n) {
        this.pdfMeasuresPerLine = n;
        localStorage.setItem(PDF_MEASURES_PER_LINE_KEY, String(n));
    }

    setGeneralVolume(percent) {
        this.generalVolumePercent = percent;
        Tone.Destination.volume.value = percentToDb(percent);
        const val = document.getElementById('general-volume-val');
        if (val) val.textContent = percent;
        localStorage.setItem(GENERAL_VOLUME_KEY, String(percent));
    }

    setMetronomeVolume(percent) {
        this.metronomeVolumePercent = percent;
        this.metronome.volume.value = percentToDb(percent);
        const val = document.getElementById('metronome-volume-val');
        if (val) val.textContent = percent;
        localStorage.setItem(METRONOME_VOLUME_KEY, String(percent));
    }

    // Point d'entrée UNIQUE pour faire sonner le métronome, quel que soit le son choisi (voir
    // METRONOME_SOUNDS) : chaque sonorité sait comment se déclencher elle-même (hauteur ou volume
    // selon le cas), les deux endroits qui font cliquer le métronome n'ont pas à s'en soucier.
    playMetronomeClick(accent, time, sub = false) {
        METRONOME_SOUNDS[this.metronomeSoundKey].trigger(this.metronome, accent, time, sub);
    }

    // Tap tempo : cliquer plusieurs fois au rythme voulu règle le BPM sans avoir à connaître ni taper
    // une valeur précise. Repart de zéro si plus de 2s s'écoulent entre deux taps (on considère alors
    // une nouvelle estimation, pas la continuation d'un tempo très lent) ; ne garde que les 8 derniers
    // taps pour rester réactif à un changement de rythme en cours de route plutôt que de figer une
    // moyenne sur toute la session.
    handleTapTempo() {
        const now = performance.now();
        if (this.tapTimes.length > 0 && now - this.tapTimes[this.tapTimes.length - 1] > 2000) this.tapTimes = [];
        this.tapTimes.push(now);
        if (this.tapTimes.length > 8) this.tapTimes.shift();

        if (this.tapTimes.length >= 2) {
            const intervals = [];
            for (let i = 1; i < this.tapTimes.length; i++) intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
            const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const bpm = Math.min(240, Math.max(60, Math.round(60000 / avgMs)));
            document.getElementById('bpm').value = bpm;
            document.getElementById('bpm-val').value = bpm;
            hasUnsavedChanges = true;
        }

        // Flash bref pour confirmer que le tap a bien été pris en compte, même avant qu'un BPM
        // puisse être calculé (dès le tout premier tap)
        const btn = document.getElementById('tap-tempo');
        btn.classList.add('tapped');
        clearTimeout(this._tapFlashTimer);
        this._tapFlashTimer = setTimeout(() => btn.classList.remove('tapped'), 120);
    }

    // Change le son du métronome : l'ancien instrument est proprement libéré (.dispose()) avant de
    // construire le nouveau, et un petit aperçu (temps normal + temps accentué) se joue aussitôt pour
    // l'entendre sans devoir lancer toute une lecture.
    setMetronomeSound(key) {
        if (!METRONOME_SOUNDS[key] || key === this.metronomeSoundKey) return;
        this.metronome.dispose();
        this.metronomeSoundKey = key;
        this.metronome = METRONOME_SOUNDS[key].build().toDestination();
        this.metronome.volume.value = percentToDb(this.metronomeVolumePercent);
        localStorage.setItem(METRONOME_SOUND_KEY, key);

        Tone.start().then(() => {
            const now = Tone.now();
            this.playMetronomeClick(false, now);
            this.playMetronomeClick(true, now + 0.35);
        });
    }

    // Regroupe les morceaux enregistrés par dossier, avec pour chacun : ouvrir, déplacer, renommer,
    // supprimer — et pour chaque dossier : renommer, supprimer (avec confirmation).
    renderFilesPanel() {
        const host = document.getElementById('settings-panel-files');
        if (!host) return;
        const songs = loadSongs().slice().sort((a, b) => b.savedAt - a.savedAt);

        // Migration douce : un morceau peut référencer un dossier jamais inscrit au registre (créé
        // avant l'ajout de ce registre, ou par l'ancien raccourci « + Nouveau dossier » d'un select) —
        // on rattrape ça ici une bonne fois pour toutes, silencieusement.
        let folders = loadFolders();
        const referenced = new Set(songs.map(s => s.folder).filter(Boolean));
        const merged = [...new Set([...folders, ...referenced])];
        if (merged.length !== folders.length) { folders = merged; saveFolders(folders); }
        folders = folders.slice().sort((a, b) => a.localeCompare(b, 'fr'));

        const currentId = getCurrentSongId();

        // Emplacement des exports locaux (JSON, MIDI, MP3) : réglé par le navigateur lui-même (dossier
        // de téléchargement / « toujours demander où enregistrer »), pas par l'appli — un paragraphe
        // l'expliquait ici mais prenait trop de place pour une information secondaire (retour
        // utilisateur) ; l'info vit maintenant dans le message de succès de chaque export, voir
        // exportCurrentSong/exportLibrary/exportMidi/exportAudio.
        const toolbar = `
            <div class="files-toolbar">
                <button type="button" id="new-folder-btn" class="btn-sec">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M12 11v4M10 13h4"/></svg>
                    Nouveau dossier
                </button>
                <div class="files-toolbar-spacer"></div>
                <button type="button" id="library-export-btn" class="icon-btn" title="Exporter toute la bibliothèque (sauvegarde)" aria-label="Exporter toute la bibliothèque">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/></svg>
                </button>
                <button type="button" id="library-import-btn" class="icon-btn" title="Importer une bibliothèque (restauration)" aria-label="Importer une bibliothèque">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21V9"/><path d="m7 13 5-5 5 5"/><path d="M5 3h14"/></svg>
                </button>
                <input type="file" id="library-import-input" accept="application/json" hidden>
            </div>`;

        if (songs.length === 0 && folders.length === 0) {
            host.innerHTML = toolbar + `<div class="files-empty">Aucun morceau enregistré pour l'instant.<br>Utilise « 💾 Enregistrer » dans la carte Morceau.</div>`;
            this.wireFilesToolbar();
            return;
        }

        const groups = folders.map(name => ({ name, songs: songs.filter(s => s.folder === name) }));
        groups.push({ name: null, songs: songs.filter(s => !s.folder) });

        const folderOptions = (current) => {
            let opts = `<option value=""${!current ? ' selected' : ''}>Sans dossier</option>`;
            folders.forEach(f => { opts += `<option value="${escapeHtml(f)}"${f === current ? ' selected' : ''}>${escapeHtml(f)}</option>`; });
            opts += `<option value="__new__">+ Nouveau dossier…</option>`;
            return opts;
        };

        const fmtDate = (ts) => new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
        const chordCount = (song) => (song.sections || []).reduce((n, sec) => n + (sec.chords ? sec.chords.length : 0), 0);

        host.innerHTML = toolbar + groups.filter(g => g.name !== null || g.songs.length > 0).map(g => `
            <details class="file-group" open>
                <summary>
                    <svg class="icon chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
                    <span class="file-group-name" data-folder="${escapeHtml(g.name || '')}">${g.name ? escapeHtml(g.name) : 'Sans dossier'}</span>
                    <span class="count">(${g.songs.length})</span>
                    ${g.name ? `
                    <span class="file-group-actions">
                        <button type="button" class="icon-btn" data-folder-action="rename" data-folder="${escapeHtml(g.name)}" title="Renommer le dossier" aria-label="Renommer le dossier" onclick="event.stopPropagation()">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        </button>
                        <button type="button" class="icon-btn" data-folder-action="delete" data-folder="${escapeHtml(g.name)}" title="Supprimer le dossier" aria-label="Supprimer le dossier" onclick="event.stopPropagation()">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        </button>
                    </span>` : ''}
                </summary>
                ${g.songs.length === 0 ? `<div class="file-group-empty">Dossier vide</div>` : g.songs.map(s => `
                    <div class="file-row" data-id="${s.id}">
                        <div class="file-info">
                            <span class="file-name">${escapeHtml(s.name)}${s.id === currentId ? ' — <em>ouvert</em>' : ''}</span>
                            <span class="file-meta">${chordCount(s)} accord(s) · ${fmtDate(s.savedAt)}</span>
                        </div>
                        <div class="file-actions">
                            <select class="file-folder-select" title="Déplacer vers un dossier">${folderOptions(s.folder)}</select>
                            <button type="button" class="icon-btn" data-action="open" title="Ouvrir" aria-label="Ouvrir">
                                <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
                            </button>
                            <button type="button" class="icon-btn" data-action="rename" title="Renommer" aria-label="Renommer">
                                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                            </button>
                            <button type="button" class="icon-btn" data-action="export" title="Exporter ce morceau en JSON" aria-label="Exporter ce morceau en JSON">
                                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/></svg>
                            </button>
                            <button type="button" class="icon-btn" data-action="delete" title="Supprimer" aria-label="Supprimer">
                                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                            </button>
                        </div>
                    </div>`).join('')}
            </details>`).join('');

        host.querySelectorAll('.file-row').forEach(row => {
            const id = row.dataset.id;
            row.querySelector('[data-action="open"]').onclick = () => this.openSongFromFiles(id);
            row.querySelector('[data-action="rename"]').onclick = () => this.startInlineRenameSong(id);
            row.querySelector('[data-action="export"]').onclick = () => this.exportSongById(id);
            row.querySelector('[data-action="delete"]').onclick = () => this.deleteSongById(id);
            row.querySelector('.file-folder-select').onchange = (e) => {
                if (e.target.value === '__new__') this.startInlineNewFolderForSong(id, e.target);
                else this.moveSongToFolder(id, e.target.value || null);
            };
            this.attachContextMenuTrigger(row, () => ({ type: 'song', id }));
        });

        host.querySelectorAll('[data-folder-action="rename"]').forEach(btn => {
            btn.onclick = () => this.startInlineRenameFolder(btn.dataset.folder);
        });
        host.querySelectorAll('[data-folder-action="delete"]').forEach(btn => {
            btn.onclick = () => this.deleteFolder(btn.dataset.folder);
        });
        host.querySelectorAll('.file-group').forEach(group => {
            const nameEl = group.querySelector('.file-group-name');
            const folderName = nameEl && nameEl.dataset.folder;
            if (folderName) {
                this.attachContextMenuTrigger(group.querySelector('summary'), () => ({ type: 'folder', name: folderName }));
            }
        });

        this.wireFilesToolbar();
    }

    wireFilesToolbar() {
        const newBtn = document.getElementById('new-folder-btn');
        if (newBtn) newBtn.onclick = () => this.startInlineCreateFolder();
        const exportBtn = document.getElementById('library-export-btn');
        if (exportBtn) exportBtn.onclick = () => this.exportLibrary();
        const importBtn = document.getElementById('library-import-btn');
        const importInput = document.getElementById('library-import-input');
        if (importBtn && importInput) {
            importBtn.onclick = () => importInput.click();
            importInput.onchange = () => {
                const file = importInput.files[0];
                importInput.value = ''; // permet de resélectionner le même fichier ensuite
                if (file) this.importLibraryFile(file);
            };
        }
    }

    async openSongFromFiles(id) {
        if (id === (getCurrentSongId() || '')) { this.closeSettings(); return; }
        if (!(await this.confirmDiscardUnsavedIfNeeded())) return;
        this.loadSong(id);
        this.closeSettings();
    }

    // Édition en ligne du nom d'un morceau (au lieu d'un prompt() natif) : le texte devient un champ
    // éditable directement dans la liste, Entrée/perte de focus valide, Échap annule.
    startInlineRenameSong(id) {
        const nameEl = document.querySelector(`.file-row[data-id="${CSS.escape(id)}"] .file-name`);
        if (!nameEl || nameEl.querySelector('input')) return; // déjà en cours d'édition
        const songs = loadSongs();
        const song = songs.find(s => s.id === id);
        if (!song) return;

        nameEl.innerHTML = `<input type="text" class="inline-rename-input" value="${escapeHtml(song.name)}">`;
        const input = nameEl.querySelector('input');
        input.focus();
        input.select();

        const commit = () => {
            const val = input.value.trim();
            if (val && val !== song.name) {
                this.pushFilesUndo();
                song.name = val;
                saveSongs(songs);
                this.refreshSongList();
            }
            this.renderFilesPanel();
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
            e.stopPropagation(); // ne remonte pas vers les raccourcis clavier globaux (Ctrl+Z, Échap...)
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            else if (e.key === 'Escape') { e.preventDefault(); input.removeEventListener('blur', commit); this.renderFilesPanel(); }
        });
    }

    deleteSongById(id) {
        const songs = loadSongs();
        const song = songs.find(s => s.id === id);
        if (!song) return;
        if (!confirm(`Supprimer « ${song.name} » ? (Ctrl+Z pour annuler juste après si besoin)`)) return;
        this.pushFilesUndo();
        saveSongs(songs.filter(s => s.id !== id));
        if (getCurrentSongId() === id) setCurrentSongId(null);
        this.refreshSongList();
        if (this.settingsOpen) this.renderFilesPanel();
    }

    moveSongToFolder(id, folder) {
        const songs = loadSongs();
        const song = songs.find(s => s.id === id);
        if (!song) return;
        this.pushFilesUndo();
        song.folder = folder || null;
        saveSongs(songs);
        if (folder) {
            const folders = loadFolders();
            if (!folders.includes(folder)) { folders.push(folder); saveFolders(folders); }
        }
        this.renderFilesPanel();
    }

    // Choix de « + Nouveau dossier… » dans le select d'un morceau : le select se change lui-même
    // en champ de saisie, plutôt qu'un prompt() natif.
    startInlineNewFolderForSong(id, selectEl) {
        selectEl.outerHTML = `<input type="text" class="inline-rename-input file-folder-select" placeholder="Nom du dossier…">`;
        const row = document.querySelector(`.file-row[data-id="${CSS.escape(id)}"]`);
        const input = row.querySelector('.file-folder-select');
        input.focus();

        const commit = () => {
            const trimmed = input.value.trim();
            if (trimmed) this.moveSongToFolder(id, trimmed);
            else this.renderFilesPanel();
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            else if (e.key === 'Escape') { e.preventDefault(); input.removeEventListener('blur', commit); this.renderFilesPanel(); }
        });
    }

    // Crée un dossier vide (visible même sans aucun morceau dedans, jusqu'à ce qu'on y en glisse un) —
    // le bouton « Nouveau dossier » se change lui-même en champ de saisie, plutôt qu'un prompt() natif.
    startInlineCreateFolder() {
        const btn = document.getElementById('new-folder-btn');
        if (!btn) return;
        btn.outerHTML = `<span class="new-folder-inline"><input type="text" class="inline-rename-input" id="new-folder-input" placeholder="Nom du dossier…"></span>`;
        const input = document.getElementById('new-folder-input');
        input.focus();

        const commit = () => {
            const trimmed = input.value.trim();
            if (trimmed) {
                const folders = loadFolders();
                if (folders.includes(trimmed)) { this.flashHint(`Le dossier « ${trimmed} » existe déjà`); this.renderFilesPanel(); return; }
                this.pushFilesUndo();
                folders.push(trimmed);
                saveFolders(folders);
            }
            this.renderFilesPanel();
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            else if (e.key === 'Escape') { e.preventDefault(); input.removeEventListener('blur', commit); this.renderFilesPanel(); }
        });
    }

    // Édition en ligne du nom d'un dossier (au lieu d'un prompt() natif) : met à jour le registre ET
    // tous les morceaux qui s'y trouvent.
    startInlineRenameFolder(oldName) {
        const nameEl = document.querySelector(`.file-group-name[data-folder="${CSS.escape(oldName)}"]`);
        if (!nameEl || nameEl.querySelector('input')) return;

        nameEl.innerHTML = `<input type="text" class="inline-rename-input" value="${escapeHtml(oldName)}" onclick="event.stopPropagation()">`;
        const input = nameEl.querySelector('input');
        input.focus();
        input.select();

        const commit = () => {
            const trimmed = input.value.trim();
            if (trimmed && trimmed !== oldName) {
                const folders = loadFolders();
                if (folders.includes(trimmed)) { this.flashHint(`Le dossier « ${trimmed} » existe déjà`); this.renderFilesPanel(); return; }
                this.pushFilesUndo();
                const idx = folders.indexOf(oldName);
                if (idx >= 0) folders[idx] = trimmed; else folders.push(trimmed);
                saveFolders(folders);
                const songs = loadSongs();
                songs.forEach(s => { if (s.folder === oldName) s.folder = trimmed; });
                saveSongs(songs);
            }
            this.renderFilesPanel();
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            else if (e.key === 'Escape') { e.preventDefault(); input.removeEventListener('blur', commit); this.renderFilesPanel(); }
        });
    }

    // Supprime un dossier (confirmation demandée) : les morceaux qu'il contenait repassent
    // « Sans dossier » — ils ne sont jamais supprimés eux-mêmes.
    deleteFolder(name) {
        const songs = loadSongs();
        const count = songs.filter(s => s.folder === name).length;
        const msg = count > 0
            ? `Supprimer le dossier « ${name} » ? ${count} morceau(x) repasseront en « Sans dossier ». (Ctrl+Z pour annuler juste après si besoin)`
            : `Supprimer le dossier « ${name} » ? (Ctrl+Z pour annuler juste après si besoin)`;
        if (!confirm(msg)) return;
        this.pushFilesUndo();
        saveFolders(loadFolders().filter(f => f !== name));
        songs.forEach(s => { if (s.folder === name) s.folder = null; });
        saveSongs(songs);
        this.renderFilesPanel();
    }

    // ---------- Sauvegarde/restauration de toute la bibliothèque (fichier .json) ----------
    // Ne couvre QUE la bibliothèque (morceaux + dossiers) : les préférences locales de l'appareil
    // (volumes, instrument par défaut, son du métronome...) n'ont pas leur place dans une sauvegarde
    // destinée à être restaurée sur un autre navigateur ou ordinateur.
    exportLibrary() {
        const payload = {
            app: 'HarmoHub',
            kind: 'library-backup',
            version: 1,
            exportedAt: Date.now(),
            songs: loadSongs(),
            folders: loadFolders()
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `harmohub-bibliotheque-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.flashHint('Bibliothèque exportée → dossier Téléchargements', 2400);
    }

    // Importe une sauvegarde : AJOUTE les morceaux du fichier à la bibliothèque actuelle, sans jamais
    // rien supprimer ni écraser (une restauration ne doit jamais faire perdre du travail en cours).
    // Les morceaux dont l'identifiant existe déjà (déjà importés, ou fichier réimporté par erreur)
    // sont ignorés PAR DÉFAUT plutôt que dupliqués — importer deux fois le même fichier ne change donc
    // rien la seconde fois. Si certains sont ignorés, propose ENSUITE (jamais automatiquement, voir
    // plus bas) de les importer quand même comme COPIES séparées, à id neuf — retour utilisateur :
    // une sauvegarde plus ancienne peut contenir une version différente (accords depuis retirés/
    // modifiés) d'un morceau qui existe encore aujourd'hui sous le même id ; « déjà à jour » masquait
    // sinon cette version-là sans aucun moyen de la retrouver.
    async importLibraryFile(file) {
        let data;
        try {
            data = JSON.parse(await file.text());
        } catch (e) {
            data = null;
        }
        if (!data || !Array.isArray(data.songs)) {
            this.flashHint('Fichier invalide — ce n\'est pas une sauvegarde HarmoHub');
            return;
        }

        const existingSongs = loadSongs();
        const existingIds = new Set(existingSongs.map(s => s.id));
        const toAdd = data.songs.filter(s => s && s.id && !existingIds.has(s.id));
        const alreadyPresent = data.songs.filter(s => s && s.id && existingIds.has(s.id));

        const existingFolders = loadFolders();
        const mergedFolders = Array.isArray(data.folders) ? [...new Set([...existingFolders, ...data.folders])] : existingFolders;
        const foldersChanged = mergedFolders.length !== existingFolders.length;

        // Copies forcées des morceaux déjà présents (même id) : seulement si demandé EXPLICITEMENT
        // ici, jamais par défaut — sinon réimporter deux fois le même fichier par erreur dupliquerait
        // systématiquement toute la bibliothèque.
        let forcedCopies = [];
        if (alreadyPresent.length > 0) {
            const n = alreadyPresent.length;
            const ask = confirm(`${n} morceau${n > 1 ? 'x' : ''} de ce fichier ${n > 1 ? 'existent' : 'existe'} déjà (même identifiant) dans ta bibliothèque actuelle.\n\nImporter quand même une COPIE de chacun ? Utile pour retrouver une ancienne version (ex. des accords depuis retirés ou modifiés).`);
            if (ask) {
                const stamp = new Date().toLocaleDateString('fr-FR');
                forcedCopies = alreadyPresent.map(s => ({
                    ...s,
                    id: 'song_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                    name: `${s.name} (import du ${stamp})`,
                    savedAt: Date.now(),
                }));
            }
        }

        const allToAdd = [...toAdd, ...forcedCopies];
        const skipped = alreadyPresent.length - forcedCopies.length;

        if (allToAdd.length > 0 || foldersChanged) {
            this.pushFilesUndo(); // un seul pas d'annulation pour tout l'import (morceaux + dossiers)
            if (allToAdd.length > 0) saveSongs([...existingSongs, ...allToAdd]);
            if (foldersChanged) saveFolders(mergedFolders);
            this.refreshSongList();
            if (this.settingsOpen) this.renderFilesPanel();
        }

        if (allToAdd.length === 0) {
            this.flashHint(skipped > 0 ? 'Bibliothèque déjà à jour — rien à importer' : 'Aucun morceau dans ce fichier');
        } else if (skipped > 0) {
            this.flashHint(`${allToAdd.length} morceau(x) importé(s), ${skipped} déjà présent(s)`);
        } else {
            this.flashHint(`${allToAdd.length} morceau(x) importé(s)`);
        }
    }

    // ---------- Menu contextuel (clic droit / appui long) ----------
    // Utilisé pour les morceaux et les dossiers de la fenêtre Fichiers : « Renommer » déclenche la
    // même édition en ligne que les boutons ✎ ; « Supprimer » déclenche la même action que 🗑.
    attachContextMenuTrigger(el, targetFn) {
        el.addEventListener('contextmenu', (e) => {
            if (el.querySelector('.cell-sym-input')) return; // édition inline en cours, voir plus bas
            e.preventDefault();
            this.openContextMenu(e.clientX, e.clientY, targetFn());
        });

        let pressTimer = null, startX = 0, startY = 0, longPressed = false;
        el.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            // Édition inline du symbole en cours sur CETTE case (voir startInlineChordSymbolEdit) :
            // elle remplace juste le texte affiché par un <input>, la case elle-même (et donc ce
            // long-press) reste montée tout du long. Sans ce garde-fou, un appui un peu long sur le
            // champ pendant qu'on tape (ou pour repositionner le curseur) rouvrait le menu contextuel
            // PAR-DESSUS le clavier/champ actif, bloquant la saisie — vu sur téléphone.
            if (el.querySelector('.cell-sym-input')) return;
            longPressed = false;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            pressTimer = setTimeout(() => {
                longPressed = true;
                this.openContextMenu(startX, startY, targetFn());
            }, 550);
        }, { passive: true });
        el.addEventListener('touchmove', (e) => {
            if (!pressTimer) return;
            const dx = e.touches[0].clientX - startX, dy = e.touches[0].clientY - startY;
            if (Math.hypot(dx, dy) > 10) { clearTimeout(pressTimer); pressTimer = null; }
        }, { passive: true });
        el.addEventListener('touchend', (e) => {
            if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
            if (longPressed) e.preventDefault(); // évite qu'un clic/toggle ne suive juste après le menu
        });
    }

    openContextMenu(x, y, target) {
        // Un appui long sur une case de la grille ouvre ce menu AVANT le relâchement du doigt : le
        // glisser/tap de la grille (this.drag, voir onGridPointerDown) est encore armé sur ce même
        // geste. Plutôt que l'annuler complètement (ce qui empêcherait tout glisser ENSUITE), on le
        // laisse vivant avec un simple repère (menuShown) : si le doigt bouge avant le relâchement,
        // onGridPointerMove referme ce menu et reprend le geste comme un glisser-copie (l'appui était
        // déjà assez long) ; s'il se relâche SANS bouger, onGridPointerUp ne fait rien de plus (pas de
        // tap-sélection ni de double-tap), le menu reste normalement affiché.
        if (this.drag) this.drag.menuShown = true;

        this.contextMenuTarget = target;
        const menu = document.getElementById('context-menu');
        // Libellé et actions disponibles diffèrent selon le type de cible (morceau/dossier : Renommer
        // + Supprimer ; accord : Modifier + Dupliquer + Séquenceur + Supprimer).
        const isChord = target && target.type === 'chord';
        menu.querySelector('[data-ctx-action="rename"] .ctx-label').textContent = isChord ? 'Modifier' : 'Renommer';
        menu.querySelector('[data-ctx-action="duplicate"]').hidden = !isChord;
        menu.querySelector('[data-ctx-action="octave-up"]').hidden = !isChord;
        menu.querySelector('[data-ctx-action="octave-down"]').hidden = !isChord;
        menu.querySelector('[data-ctx-action="sequencer"]').hidden = !isChord;
        menu.hidden = false;
        const pad = 8;
        const left = Math.min(x, window.innerWidth - menu.offsetWidth - pad);
        const top = Math.min(y, window.innerHeight - menu.offsetHeight - pad);
        menu.style.left = `${Math.max(pad, left)}px`;
        menu.style.top = `${Math.max(pad, top)}px`;
    }

    closeContextMenu() {
        const menu = document.getElementById('context-menu');
        if (menu) menu.hidden = true;
        this.contextMenuTarget = null;
    }

    // ---------- Annuler / Rétablir dans la fenêtre Fichiers ----------
    // Historique dédié, séparé des deux autres : un instantané combiné {folders, songs} avant chaque
    // action (créer/renommer/supprimer un dossier, renommer/supprimer/déplacer un morceau).
    pushFilesUndo() {
        this.filesUndoStack.push(JSON.stringify({ folders: loadFolders(), songs: loadSongs() }));
        if (this.filesUndoStack.length > this.undoLimit) this.filesUndoStack.shift();
        this.filesRedoStack = [];
        this.updateGlobalUndoRedoButtons();
    }

    filesUndo() {
        if (this.filesUndoStack.length === 0) { this.flashHint('Rien à annuler dans les fichiers'); return; }
        this.filesRedoStack.push(JSON.stringify({ folders: loadFolders(), songs: loadSongs() }));
        const prev = JSON.parse(this.filesUndoStack.pop());
        saveFolders(prev.folders);
        saveSongs(prev.songs);
        this.refreshSongList();
        if (this.settingsOpen) this.renderFilesPanel();
        this.updateGlobalUndoRedoButtons();
        this.flashHint('Annulé');
    }

    filesRedo() {
        if (this.filesRedoStack.length === 0) { this.flashHint('Rien à rétablir dans les fichiers'); return; }
        this.filesUndoStack.push(JSON.stringify({ folders: loadFolders(), songs: loadSongs() }));
        const next = JSON.parse(this.filesRedoStack.pop());
        saveFolders(next.folders);
        saveSongs(next.songs);
        this.refreshSongList();
        if (this.settingsOpen) this.renderFilesPanel();
        this.updateGlobalUndoRedoButtons();
        this.flashHint('Rétabli');
    }


    getCurrentSongName() {
        const id = getCurrentSongId();
        if (!id) return 'Sans titre';
        const song = loadSongs().find(s => s.id === id);
        return song ? song.name : 'Sans titre';
    }

    // ---------- Export PDF (via l'impression du navigateur, sans dépendance externe) ----------

    // Diagramme SVG d'un clavier avec les notes RÉELLEMENT jouées surlignées par fonction
    // (renversement et drop pris en compte, puisqu'on lit directement le voicing calculé)
    // Clavier PDF calqué sur le rendu à l'écran (.key.white/.key.black dans style.css) : ivoire chaud
    // plutôt que blanc clinique, coin bas arrondi (via roundedBottomRectPath, un <rect rx> arrondirait
    // aussi le haut — la touche aurait l'air d'une pastille plutôt que de sortir du clavier), fin
    // liseré de biseau sur les blanches. Couleurs de rôle en aplat (ROLE_COLOR), jamais en dégradé,
    // comme buildGuitarDiagramSVG en impression — plus fiable sur papier, et cohérent avec le reste du
    // PDF (aucune autre pièce n'utilise de dégradé). Retour utilisateur : l'ancien rendu (blanc pur,
    // coins carrés, liseré gris générique) ne ressemblait pas au clavier de l'appli.
    buildPianoDiagramSVG(chord) {
        const voiced = chord.getVoiced();
        const midis = voiced.map(v => v.midi);
        const { low, high } = this.computePianoWindow(midis);
        const activeByMidi = {};
        voiced.forEach(v => { activeByMidi[v.midi] = v.role; });

        const BLACK_PCS = [1, 3, 6, 8, 10];
        const KEY_W = 16, KEY_H = 58, BLACK_W = KEY_W * 0.62, BLACK_H = KEY_H * 0.6;
        const RADIUS_W = 3, RADIUS_B = 2.5;
        const IVORY = '#f2ead9';
        const EBONY = '#171310';

        const whiteMidis = [];
        for (let m = low; m <= high; m++) if (!BLACK_PCS.includes(((m % 12) + 12) % 12)) whiteMidis.push(m);
        const width = whiteMidis.length * KEY_W;

        let svg = `<svg viewBox="0 0 ${width} ${KEY_H}" width="${width}" height="${KEY_H}" xmlns="http://www.w3.org/2000/svg">`;
        whiteMidis.forEach((m, i) => {
            const active = !!activeByMidi[m];
            const fill = active ? ROLE_COLOR[activeByMidi[m]] : IVORY;
            const x = i * KEY_W, w = KEY_W - 1;
            svg += `<path d="${roundedBottomRectPath(x, 0, w, KEY_H, RADIUS_W)}" fill="${fill}" stroke="#2a2a2a" stroke-width="0.7"/>`;
            // Biseau : fil de lumière à gauche, ombre fine à droite (voir .key.white dans style.css),
            // seulement sur les touches au repos — une active porte déjà sa propre couleur de rôle.
            if (!active) {
                svg += `<rect x="${x + 0.6}" y="1" width="1.1" height="${KEY_H - 2}" fill="#fff" opacity="0.5"/>`;
                svg += `<rect x="${x + w - 1.6}" y="1" width="1.1" height="${KEY_H - 2}" fill="#000" opacity="0.12"/>`;
            }
        });
        let whiteSeen = 0;
        for (let m = low; m <= high; m++) {
            const isBlack = BLACK_PCS.includes(((m % 12) + 12) % 12);
            if (!isBlack) { whiteSeen++; continue; }
            const fill = activeByMidi[m] ? ROLE_COLOR[activeByMidi[m]] : EBONY;
            const x = whiteSeen * KEY_W - BLACK_W / 2;
            svg += `<path d="${roundedBottomRectPath(x, 0, BLACK_W, BLACK_H, RADIUS_B)}" fill="${fill}" stroke="#000" stroke-width="0.6"/>`;
        }
        svg += `</svg>`;
        return svg;
    }

    // Diagramme SVG d'un manche de guitare pour un doigté donné (un élément du tableau retourné par
    // guitarFingeringsForChord/solveGuitarFingerings) : à l'HORIZONTALE, comme un manche de guitare
    // qu'on regarde en le tenant (sillet à gauche, cases vers la droite, corde de Mi AIGU en haut,
    // Mi GRAVE en bas) — convention demandée. Fenêtre d'un nombre de cases FIXE (FRET_WINDOW) pour que
    // tous les diagrammes aient la même taille, avec les repères habituels du manche (points
    // d'incrustation aux cases 3, 5, 7, 9, 15, 17..., double point à la 12) quand ils sont dans la
    // fenêtre affichée. `forPrint` bascule vers des couleurs sombres (encre sur papier blanc) au lieu
    // des couleurs claires utilisées en direct sur fond sombre.
    buildGuitarDiagramSVG(byString, forPrint = false) {
        const FRET_WINDOW = 5; // nombre de cases visibles, identique pour tous les accords
        const SINGLE_MARKERS = [3, 5, 7, 9, 15, 17, 19, 21];
        const DOUBLE_MARKERS = [12, 24];
        const STRING_GAP = 16, FRET_GAP = 30, MARGIN_LEFT = 20, MARGIN_TOP = 8, LABEL_ROW_H = 13;
        const lineColor = forPrint ? '#555' : '#888';
        const nutColor = forPrint ? '#1a1a1a' : '#e8e8e8';
        const openColor = forPrint ? '#333' : '#ccc';
        const markerColor = forPrint ? '#999' : '#3a3a3a';
        const labelColor = forPrint ? '#333' : '#999';

        // Corde aiguë (Mi aigu, index 5) en haut, grave (Mi grave, index 0) en bas : y croît avec
        // l'index de corde à l'envers.
        const stringY = s => MARGIN_TOP + (5 - s) * STRING_GAP;

        const fretted = byString.filter(e => e && e.fret > 0);
        const maxFret = fretted.length ? Math.max(...fretted.map(e => e.fret)) : 0;
        const minFret = fretted.length ? Math.min(...fretted.map(e => e.fret)) : 0;
        // Le sillet ne s'affiche que s'il y a une vraie corde à vide ET que le reste de la forme
        // tient dans la fenêtre depuis la case 0 : un barré à la case 1 (ex. Fa, forme E) n'a AUCUNE
        // corde ouverte et doit afficher un repère de position ("1") plutôt qu'un sillet, sinon on le
        // confondrait avec un accord en position ouverte ; et une corde à vide isolée alors que le
        // reste de l'accord est loin sur le manche ne doit pas forcer la fenêtre à revenir à la case 0
        // (les notes réellement jouées deviendraient invisibles, hors fenêtre).
        const hasOpenString = byString.some(e => e && e.fret === 0);
        const showNut = fretted.length === 0 || (hasOpenString && maxFret <= FRET_WINDOW);
        const baseFret = showNut ? 0 : (minFret - 1); // n° de case juste avant la 1ère colonne dessinée

        const stringsSpan = STRING_GAP * 5;
        const width = MARGIN_LEFT + FRET_GAP * FRET_WINDOW + 8;
        const height = MARGIN_TOP + stringsSpan + LABEL_ROW_H + 4;

        let svg = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

        // Lueur "verre rétroéclairé" des points de doigté (voir ROLE_GRADIENT_STOPS) : uniquement en
        // direct, jamais à l'impression (encre en aplat, plus fiable sur papier). uid distingue les
        // <radialGradient> de ce schéma de ceux d'un autre schéma affiché en même temps ailleurs dans
        // la page (ids HTML censés être uniques document-wide).
        const uid = forPrint ? null : ++guitarSvgIdSeq;
        if (!forPrint) {
            // N'émettre que les dégradés des rôles réellement présents dans ce doigté (au plus 5,
            // souvent 2-3) plutôt que les 5 systématiquement : évite du SVG mort dans chaque diagramme.
            // Cordes à vide comprises (elles aussi reçoivent une pastille, voir plus bas).
            const usedRoles = new Set(byString.filter(e => e).map(e => ROLE_GRADIENT_STOPS[e.role] ? e.role : 'ext'));
            svg += '<defs>';
            usedRoles.forEach(role => {
                const [light, mid] = ROLE_GRADIENT_STOPS[role];
                // r="50%" (plutôt que 70%) : la lueur s'éteint avant d'atteindre le bord du cercle qui
                // la porte, pour une diffusion plus resserrée sans changer le diamètre du cercle lui-même.
                svg += `<radialGradient id="gglow-${role}-${uid}" cx="50%" cy="50%" r="50%">` +
                    `<stop offset="0%" stop-color="${light}" stop-opacity=".95"/>` +
                    `<stop offset="55%" stop-color="${mid}" stop-opacity=".6"/>` +
                    `<stop offset="100%" stop-color="${mid}" stop-opacity="0"/>` +
                    `</radialGradient>`;
            });
            svg += '</defs>';
        }

        if (showNut) {
            svg += `<rect x="${MARGIN_LEFT - 2}" y="${MARGIN_TOP}" width="3" height="${stringsSpan}" fill="${nutColor}"/>`;
        } else {
            svg += `<line x1="${MARGIN_LEFT}" y1="${MARGIN_TOP}" x2="${MARGIN_LEFT}" y2="${MARGIN_TOP + stringsSpan}" stroke="${lineColor}" stroke-width="1"/>`;
        }
        for (let c = 1; c <= FRET_WINDOW; c++) {
            const x = MARGIN_LEFT + c * FRET_GAP;
            svg += `<line x1="${x}" y1="${MARGIN_TOP}" x2="${x}" y2="${MARGIN_TOP + stringsSpan}" stroke="${lineColor}" stroke-width="1"/>`;
        }
        for (let s = 0; s < 6; s++) {
            const y = stringY(s);
            svg += `<line x1="${MARGIN_LEFT}" y1="${y}" x2="${MARGIN_LEFT + FRET_GAP * FRET_WINDOW}" y2="${y}" stroke="${lineColor}" stroke-width="1"/>`;
        }
        // Barré (un seul doigt à plat sur plusieurs cordes à la même case) : fond semi-transparent sur
        // toute la largeur de la case, entre les deux cordes extrêmes couvertes — matérialise qu'il
        // faut appuyer avec TOUT le doigt à plat à cet endroit, pas juste du bout du doigt comme les
        // autres cases. Sous les repères/points de doigté dessinés ensuite (ordre du document SVG).
        const barre = detectBarre(byString);
        if (barre && barre.fret - baseFret >= 1 && barre.fret - baseFret <= FRET_WINDOW) {
            const col = barre.fret - baseFret;
            const barreInset = 4; // légèrement moins large que la case de la frette, pour ne pas la toucher
            const bx = MARGIN_LEFT + (col - 1) * FRET_GAP + barreInset;
            const byTop = stringY(barre.hiString) - STRING_GAP * 0.42;
            const byBottom = stringY(barre.loString) + STRING_GAP * 0.42;
            const barreFill = forPrint ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.14)';
            const barreStroke = forPrint ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.3)';
            svg += `<rect x="${bx}" y="${byTop}" width="${FRET_GAP - barreInset * 2}" height="${byBottom - byTop}" rx="6" fill="${barreFill}" stroke="${barreStroke}" stroke-width="1"/>`;
        }
        // Points de repère du manche (incrustations réelles d'une guitare), centrés dans la hauteur du
        // diagramme — un seul point pour les cases usuelles, deux pour l'octave (case 12/24) — avec le
        // numéro de case en dessous du manche, UNIQUEMENT là où il y a un point (pas de repère générique
        // de position, moins lisible et redondant).
        const midY = MARGIN_TOP + stringsSpan / 2;
        const labelY = MARGIN_TOP + stringsSpan + 11;
        SINGLE_MARKERS.forEach(marker => {
            if (marker < baseFret + 1 || marker > baseFret + FRET_WINDOW) return;
            const x = MARGIN_LEFT + (marker - baseFret - 0.5) * FRET_GAP;
            svg += `<circle cx="${x}" cy="${midY}" r="3" fill="${markerColor}"/>`;
            svg += `<text x="${x}" y="${labelY}" font-size="8" fill="${labelColor}" text-anchor="middle">${marker}</text>`;
        });
        DOUBLE_MARKERS.forEach(marker => {
            if (marker < baseFret + 1 || marker > baseFret + FRET_WINDOW) return;
            const x = MARGIN_LEFT + (marker - baseFret - 0.5) * FRET_GAP;
            svg += `<circle cx="${x}" cy="${midY - STRING_GAP}" r="3" fill="${markerColor}"/>`;
            svg += `<circle cx="${x}" cy="${midY + STRING_GAP}" r="3" fill="${markerColor}"/>`;
            svg += `<text x="${x}" y="${labelY}" font-size="8" fill="${labelColor}" text-anchor="middle">${marker}</text>`;
        });
        byString.forEach((e, s) => {
            const y = stringY(s) + 3;
            const ox = MARGIN_LEFT - 9;
            if (!e) { svg += `<text x="${ox}" y="${y}" font-size="9" fill="#e53922" text-anchor="middle">X</text>`; return; }
            if (e.fret !== 0) return;
            // Corde à vide jouée : même pastille de rôle que les cases frettées, en plus petit (hors
            // manche) — le "O" reste lisible par-dessus grâce à son propre contour sombre (paint-order),
            // quelle que soit la couleur de rôle en dessous.
            const role = ROLE_GRADIENT_STOPS[e.role] ? e.role : 'ext';
            const oy = stringY(s);
            if (forPrint) {
                svg += `<circle cx="${ox}" cy="${oy}" r="4" fill="${ROLE_COLOR[role] || ROLE_COLOR.ext}" stroke="#000" stroke-width="0.5"/>`;
            } else {
                const mid = ROLE_GRADIENT_STOPS[role][1];
                svg += `<circle cx="${ox}" cy="${oy}" r="7" fill="url(#gglow-${role}-${uid})"/>`;
                svg += `<circle cx="${ox}" cy="${oy}" r="2.4" fill="${mid}"/>`;
            }
            svg += `<text x="${ox}" y="${y}" font-size="9" fill="${openColor}" stroke="#000" stroke-width="0.6" paint-order="stroke" text-anchor="middle">O</text>`;
        });
        byString.forEach((e, s) => {
            if (!e || e.fret === 0) return;
            const col = e.fret - baseFret;
            const x = MARGIN_LEFT + (col - 0.5) * FRET_GAP;
            const y = stringY(s);
            const role = ROLE_GRADIENT_STOPS[e.role] ? e.role : 'ext';
            if (forPrint) {
                svg += `<circle cx="${x}" cy="${y}" r="6" fill="${ROLE_COLOR[role] || ROLE_COLOR.ext}" stroke="#000" stroke-width="0.5"/>`;
            } else {
                // Verre rétroéclairé : une lueur resserrée (voir gglow-*, défini plus haut) derrière un
                // cœur plein un peu plus large — moins de diffusion, même diamètre global qu'avant.
                const mid = ROLE_GRADIENT_STOPS[role][1];
                svg += `<circle cx="${x}" cy="${y}" r="11" fill="url(#gglow-${role}-${uid})"/>`;
                svg += `<circle cx="${x}" cy="${y}" r="4.6" fill="${mid}"/>`;
            }
        });
        svg += `</svg>`;
        return svg;
    }

    // Construit le contenu des DEUX blocs imprimés (grille d'accords, voicings piano/guitare) — SANS
    // le conteneur <div class="print-page">, ajouté par l'appelant (voir exportPdf) une fois qu'il a
    // mesuré si les deux tiennent ensemble sur une seule page ou doivent rester deux pages séparées
    // (retour utilisateur : les regrouper sur une page quand la place le permet).
    buildPrintExportHtml() {
        const sections = loadProgressionSections();
        const gRoot = document.getElementById('global-root').value;
        const gMode = document.getElementById('global-mode').value;
        const useFlats = useFlatsForKey(NOTES.indexOf(gRoot), gMode);
        const bpm = document.getElementById('bpm').value;
        const timeSig = document.getElementById('time-sig').value;
        const songName = this.getCurrentSongName();

        // Contenu de chaque page SANS le conteneur <div class="print-page"> lui-même (voir exportPdf,
        // qui mesure chaque bloc séparément pour décider s'ils tiennent ensemble sur une seule page
        // avant de les envelopper) — gridInner/voicingsInner, jamais page1/page2 directement.
        let gridInner = `<h1 class="print-title">${escapeHtml(songName)}</h1>
            <div class="print-meta">Tonalité : ${noteNameForPc(NOTES.indexOf(gRoot), useFlats)} ${MODE_LABELS[gMode] || 'majeur'} · ${timeSig} · ${bpm} BPM</div>`;

        // Même découpage en lignes/mesures que la grille à l'écran (layoutProgression) : chaque ligne
        // imprimée correspond ainsi à un nombre entier de mesures, avec leur numéro, plutôt qu'un
        // simple retour à la ligne au gré de la largeur (comme c'était le cas avant).
        const beatsPerBar = this.beatsPerBar();
        const allChords = []; // à plat, dans l'ordre de lecture, pour les voicings
        sections.forEach((sec, si) => {
            const title = (sec.title && sec.title.trim()) ? sec.title : `Partie ${si + 1}`;
            const measuresSuffix = sec.chords.length > 0 ? ` <span class="print-section-measures">— ${sectionMeasureCount(sec, beatsPerBar)} mesures</span>` : '';
            gridInner += `<h2 class="print-section-title">${escapeHtml(title)}${measuresSuffix}</h2>`;
            if (!sec.chords.length) {
                gridInner += `<div class="print-empty">—</div>`;
                return;
            }
            // Échelle FIXE (voir pdfMeasuresPerLine, Paramètres > Affichage) : toutes les lignes de
            // TOUTES les parties du morceau utilisent le même nombre de temps par ligne, plutôt que le
            // zoom horizontal de la grille à l'écran au moment de l'export (retour utilisateur : avant,
            // l'échelle du PDF variait ligne par ligne, une ligne plus courte s'étirait pour remplir
            // toute la largeur de la page — désormais elle laisse un blanc à la place).
            const pdfBeatsPerRow = beatsPerBar * this.pdfMeasuresPerLine;
            const { cells, rows, beatsPerRow } = this.layoutProgression(sec.chords, beatsPerBar, this.gridZoomOpen, pdfBeatsPerRow);
            for (let r = 0; r < rows; r++) {
                const rowCells = cells.filter(c => c.row === r);
                // Dénominateur commun aux cases ET à la règle graduée en dessous (voir plus bas) :
                // c'est désormais le budget FIXE de la ligne (beatsPerRow, ci-dessus), pas les temps
                // réellement utilisés sur cette ligne précise — une ligne partielle laisse ainsi un
                // blanc après sa dernière mesure plutôt que d'étirer ses cases pour combler la largeur.
                const rowBeatsUsed = rowCells.reduce((sum, c) => sum + c.span, 0);
                const rowBeatsDenom = beatsPerRow;
                gridInner += `<div class="print-chord-row">`;
                rowCells.forEach(s => {
                    const data = sec.chords[s.index];
                    const chord = new Chord(data.root, data.quality, beatsFromData(data), data.inversion, data.drop, octaveFromData(data), data.bass, data.guitarLock, data.extraNotes);
                    const chordUseFlats = useFlatsForChordRoot(NOTES.indexOf(data.root), NOTES.indexOf(gRoot), gMode, useFlats);
                    const sym = chord.getBareLabel(chordUseFlats) + ((s.split && !s.isFirst) ? ' ↩' : '');
                    const roman = (s.isFirst && this.showRomanNumerals) ? this.getRomanNumeral(gRoot, gMode, data.root, data.quality) : '';
                    // Notation compacte octave/renversement/drop (voir Chord.getVoicingBadge, réglage
                    // Affichage > Position d'accord PDF) — au-dessus de la case comme le chiffrage
                    // romain (retour utilisateur : préfère les deux regroupés là plutôt que le
                    // renversement/drop dans la case, et l'ancienne flèche de sens mélodique ▲/▼
                    // supprimée, remplacée par cette notation plus informative). Même notation
                    // reprise sur la page voicings (voir plus bas), pour reconnaître le même accord.
                    const voicingBadge = (s.isFirst && this.showVoicingPdf) ? chord.getVoicingBadge() : '';
                    // Fonction harmonique (voir chordFunction) : même réglage que la grille à l'écran
                    // (this.showChordFunction), "?" en zone grise plutôt qu'absente sans explication.
                    const fn = (s.isFirst && this.showChordFunction) ? this.chordFunction(gRoot, gMode, data.root, data.quality) : null;
                    const measureEl = s.barStart ? `<span class="print-chord-measure">${s.barNumber}</span>` : '';
                    const romanEl = roman ? `<span class="print-chord-roman">${roman}</span>` : '';
                    const voicingEl = voicingBadge ? `<span class="print-chord-voicing-badge">${voicingBadge}</span>` : '';
                    const functionEl = this.showChordFunction ? `<span class="print-chord-function${fn ? ' fn-' + fn.toLowerCase() : ' fn-unknown'}">${fn || '?'}</span>` : '';
                    const aboveParts = [romanEl, voicingEl, functionEl].filter(Boolean);
                    const aboveHtml = aboveParts.join('<span class="print-chord-above-sep">·</span>');
                    // Bandeau degré/voicing AU-DESSUS de la case bordée (jamais dedans, voir
                    // .print-chord-above) — toujours présent, même vide, pour que toutes les cases
                    // d'une même ligne démarrent à la même hauteur. La case elle-même ne contient plus
                    // que le numéro de mesure + le symbole : plus de 2e ligne optionnelle dedans, donc
                    // plus plus de hauteurs incohérentes d'une case à l'autre sur la même ligne (retour
                    // utilisateur).
                    // Largeur en % EXACTE du nombre de temps (voir rowBeatsUsed plus haut), pas du
                    // flex-grow : gap/largeur mini éventuels sur .print-chord-wrap ne réduisent alors
                    // plus l'espace dispo pour la répartition, contrairement au flex-grow d'avant, qui
                    // pouvait légèrement désaligner les cases par rapport à la règle graduée en dessous
                    // (elle, sans gap ni largeur mini) — retour utilisateur, la règle doit coller
                    // PARFAITEMENT à la largeur des cases.
                    const wPct = (s.span / rowBeatsDenom * 100).toFixed(4);
                    gridInner += `<div class="print-chord-wrap" style="width:${wPct}%;">
                        <div class="print-chord-above">${aboveHtml}</div>
                        <div class="print-chord-cell">
                            ${measureEl}
                            <span class="print-chord-sym">${flatTight(escapeHtml(sym))}</span>
                        </div>
                    </div>`;
                    if (s.isFirst) allChords.push({ chord, sym });
                });
                gridInner += `</div>`;

                // Règle graduée sous la ligne (retour utilisateur : structurer un peu plus visuellement
                // la grille) : une grande graduation numérotée par mesure, des petites entre les temps —
                // recalculée indépendamment de la découpe en cases (un accord peut chevaucher plusieurs
                // mesures dans une même case, voir innerBars plus haut dans layoutProgression) plutôt que
                // dérivée des segments eux-mêmes, bien plus simple et fiable ici. MÊME dénominateur
                // (rowBeatsUsed) et MÊME mécanique de largeur (% explicite, pas flex-grow) que les cases
                // juste au-dessus : les deux lignes doivent s'aligner au pixel près, ce que flex-grow ne
                // garantissait pas dès que les deux conteneurs n'avaient pas exactement le même espace
                // disponible (gap/largeur mini des cases, absents ici).
                const firstBarNumber = Math.floor(r * beatsPerRow / beatsPerBar) + 1;
                const numBars = Math.ceil(rowBeatsUsed / beatsPerBar);
                gridInner += `<div class="print-measure-ruler">`;
                for (let bi = 0; bi < numBars; bi++) {
                    const barBeats = Math.min(beatsPerBar, rowBeatsUsed - bi * beatsPerBar);
                    const isLastBar = (bi === numBars - 1);
                    let ticks = `<span class="ruler-tick ruler-tick-major" style="left:0"></span>`;
                    for (let b = 1; b < barBeats; b++) {
                        ticks += `<span class="ruler-tick" style="left:${(b / barBeats) * 100}%"></span>`;
                    }
                    // Contretemps : UN SEUL repère par mesure, pile en son milieu — même densité réduite
                    // que la grille à l'écran (voir .row-offbeat/offbeat-dot), même esprit estompé,
                    // mais gardé en trait ici (pas un point) pour rester cohérent avec les autres
                    // graduations de CETTE règle, elles-mêmes toutes des traits (.ruler-tick)
                    // (retour utilisateur : "seulement des tirets au niveau des milieux de mesure").
                    // Le milieu d'une mesure tombe toujours à 50% de sa largeur, quel que soit son
                    // nombre de temps (barBeats) : pas besoin de connaître le chiffrage ici.
                    ticks += `<span class="ruler-tick ruler-tick-offbeat" style="left:50%"></span>`;
                    if (isLastBar) ticks += `<span class="ruler-tick ruler-tick-major" style="left:100%"></span>`;
                    const barPct = (barBeats / rowBeatsDenom * 100).toFixed(4);
                    // Numéro de fin de mesure (retour utilisateur : seul le début de chaque mesure était
                    // visible jusque-là) — seulement sur la DERNIÈRE mesure de la ligne, positionné à son
                    // bord droit plutôt qu'au bord gauche comme .ruler-num, pour marquer où elle se
                    // termine sans dupliquer une info déjà lisible sur les mesures intermédiaires (le
                    // début de la mesure suivante, juste à droite, y suffit déjà).
                    const endNumEl = isLastBar ? `<span class="ruler-num-end">${firstBarNumber + bi}</span>` : '';
                    gridInner += `<div class="ruler-bar" style="width:${barPct}%;">${ticks}<span class="ruler-num">${firstBarNumber + bi}</span>${endNumEl}</div>`;
                }
                gridInner += `</div>`;
            }
        });

        // Voicings : un schéma par voicing DISTINCT seulement (même fondamentale/qualité/renversement/
        // drop/octave -> même disposition de touches), même si l'accord revient plusieurs fois dans
        // le morceau — inutile de répéter le même schéma de piano.
        const seenVoicings = new Set();
        const uniqueChords = allChords.filter(({ chord }) => {
            const key = chord.getVoiced().map(v => `${v.midi}:${v.role}`).join(',');
            if (seenVoicings.has(key)) return false;
            seenVoicings.add(key);
            return true;
        });

        // Piano et/ou guitare selon les bascules de la vue live (aucun bloc voicings si les deux sont
        // masquées, ou si la grille est vide) — voicingsInner vide, exportPdf n'en fait alors pas de
        // page du tout (ni fusionnée, ni séparée).
        const showPiano = this.showPianoViz(), showGuitar = this.showGuitarViz();
        let voicingsInner = '';
        if ((showPiano || showGuitar) && uniqueChords.length) {
            voicingsInner = `<h1 class="print-title">Voicings</h1><div class="print-piano-grid">`;
            uniqueChords.forEach(({ chord, sym }) => {
                const diagrams = [];
                if (showPiano) diagrams.push(this.buildPianoDiagramSVG(chord));
                if (showGuitar) {
                    const fingerings = guitarFingeringsForChord(chord);
                    diagrams.push(fingerings.length
                        ? this.buildGuitarDiagramSVG(fingerings[0], true)
                        : `<div class="print-guitar-unplayable">Non jouable<br>à la guitare</div>`);
                }
                // Voicing (même notation compacte que la grille, voir plus haut) à côté du nom de
                // l'accord (retour utilisateur : absent jusque-là de cette page, alors que la case
                // n'a plus qu'un seul voicing par accord ici, pas plusieurs comme dans la grille).
                const badge = this.showVoicingPdf ? chord.getVoicingBadge() : '';
                const labelHtml = badge ? `${escapeHtml(sym)} <span class="print-piano-voicing-badge">${badge}</span>` : escapeHtml(sym);
                voicingsInner += `<div class="print-piano-item">
                    <div class="print-piano-label">${labelHtml}</div>
                    <div class="print-diagrams">${diagrams.join('')}</div>
                </div>`;
            });
            voicingsInner += `</div>`;
        }

        return { gridInner, voicingsInner };
    }

    // Bouton "📄" en bas à droite du piano : génère directement un fichier .pdf téléchargeable (via
    // jsPDF + html2canvas, vendus en local, voir index.html) plutôt que de passer par la boîte
    // d'impression du navigateur ("Enregistrer en PDF" comme destination) — cette dernière dépend d'un
    // pilote PDF système qui peut manquer ou être mal configuré (macOS sans imprimante virtuelle),
    // pour un résultat qui devrait pourtant être aussi simple qu'un "Enregistrer sous". Le HTML/CSS de
    // buildPrintExportHtml() reste la SEULE source de mise en page (une page = un <div class="print-page">,
    // posé ici une fois la fusion grille+voicings décidée, voir plus bas) : chaque page est rastérisée
    // telle quelle par html2canvas, puis posée dans le PDF par jsPDF, sans
    // dupliquer la mise en page dans un second moteur de rendu.
    async exportPdf() {
        // Le morceau doit être enregistré (avec un nom) pour pouvoir nommer le PDF en conséquence
        if (!getCurrentSongId()) {
            this.saveCurrentAsSong('Nomme d\'abord ton morceau pour exporter le PDF');
            if (!getCurrentSongId()) return; // enregistrement annulé -> pas d'export
        }

        const host = document.getElementById('print-export');
        if (!host) return;
        const { gridInner, voicingsInner } = this.buildPrintExportHtml();

        const btn = document.getElementById('export-pdf');
        btn.disabled = true;
        this.flashHint('Génération du PDF…', 60000);

        // .print-export est display:none par défaut (voir style.css), réservé jusqu'ici à l'impression
        // navigateur (@media print) : html2canvas ne peut rastériser qu'un élément réellement mis en
        // page, donc affiché hors écran ici plutôt que masqué. Largeur fixe ~ une page A4 à 96dpi.
        const prevStyle = host.getAttribute('style') || '';
        host.style.cssText = 'display:block; position:fixed; left:-10000px; top:0; width:794px; background:#fff;';

        try {
            // A4, mêmes marges que le placement final ci-dessous (voir pdf.addImage) : sert ICI à
            // décider, AVANT de rastériser quoi que ce soit, si grille et voicings tiennent ensemble
            // sur UNE SEULE page plutôt que sur deux (retour utilisateur) — mesure la hauteur RÉELLE de
            // chaque bloc rendu à la largeur cible, comparée à la hauteur qu'occuperait une page
            // pleine à cette même largeur (le même ratio maxW/maxH que le redimensionnement final).
            const A4_W_MM = 210, A4_H_MM = 297, margin = 10;
            const maxWmm = A4_W_MM - margin * 2, maxHmm = A4_H_MM - margin * 2;
            const renderWidthPx = 794;
            const onePageHeightPx = renderWidthPx * (maxHmm / maxWmm);

            host.innerHTML = `<div class="print-page" id="__pdf_measure_grid">${gridInner}</div>`
                + (voicingsInner ? `<div class="print-page" id="__pdf_measure_voicings">${voicingsInner}</div>` : '');
            const gridHeight = document.getElementById('__pdf_measure_grid').getBoundingClientRect().height;
            const voicingsHeight = voicingsInner ? document.getElementById('__pdf_measure_voicings').getBoundingClientRect().height : 0;
            const fitsTogether = voicingsInner && (gridHeight + voicingsHeight) <= onePageHeightPx;

            if (!voicingsInner) {
                host.innerHTML = `<div class="print-page">${gridInner}</div>`;
            } else if (fitsTogether) {
                host.innerHTML = `<div class="print-page">${gridInner}${voicingsInner}</div>`;
            } else {
                host.innerHTML = `<div class="print-page">${gridInner}</div><div class="print-page">${voicingsInner}</div>`;
            }

            const pages = host.querySelectorAll('.print-page');
            if (!pages.length) { this.flashHint('Grille vide — rien à exporter'); return; }

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
            const pageW = pdf.internal.pageSize.getWidth();
            const pageH = pdf.internal.pageSize.getHeight();
            const maxW = pageW - margin * 2, maxH = pageH - margin * 2;

            for (let i = 0; i < pages.length; i++) {
                const canvas = await window.html2canvas(pages[i], { scale: 2, backgroundColor: '#ffffff' });
                const ratio = canvas.width / canvas.height;
                let imgW = maxW, imgH = imgW / ratio;
                if (imgH > maxH) { imgH = maxH; imgW = imgH * ratio; } // page très longue (grille copieuse) : borne par la hauteur plutôt que la largeur
                if (i > 0) pdf.addPage();
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, imgW, imgH);
            }

            pdf.save(`${this.getCurrentSongName().replace(/[\\/:*?"<>|]+/g, '_')} - grille d'accords.pdf`);
            this.flashHint('PDF téléchargé → dossier Téléchargements', 2400);
        } catch (err) {
            console.error(err);
            this.flashHint('Échec de l’export PDF');
        } finally {
            host.setAttribute('style', prevStyle);
            btn.disabled = false;
        }
    }

    // ---------- Export MIDI (fichier .mid standard, une piste par instrument utilisé) ----------
    // Reprend le même motif de séquenceur que la lecture (resolveSeqPatternForData, la même logique
    // de regroupement des croches liées en une note tenue que schedulePlayback) : ce qu'on entend
    // dans l'appli est ce qui se retrouve dans le fichier, sans le décompte ni le métronome (propres
    // à l'écoute in-app, pas au morceau lui-même).
    // `sectionsOverride` (optionnel) : construit le fichier pour CES parties précises (repart d'une
    // timeline à 0), au lieu du morceau entier — voir exportMidi, export « un fichier par partie ».
    buildMidiFile(sectionsOverride) {
        const bpm = parseInt(document.getElementById('bpm').value) || 120;
        const [numerator, denominator] = (document.getElementById('time-sig').value || '4/4').split('/').map(Number);
        const ticksPerStep = MIDI_PPQ / SEQ_STEPS_PER_BEAT;
        const grooveRatio = this.grooveRatio(); // voir GROOVE_RATIOS/grooveStepOffset

        const meta = new MidiTrackBuilder();
        meta.push(0, midiTextEvent(0x03, this.getCurrentSongName()));
        meta.push(0, midiTempoEvent(bpm));
        meta.push(0, midiTimeSigEvent(numerator, denominator));

        // Une piste par instrument utilisé (créée à la demande, sur son propre canal) : dans le DAW,
        // chaque son reste isolé sur sa piste et peut être remplacé indépendamment des autres.
        const tracks = new Map(); // clé instrument -> { builder, channel }
        let nextChannel = 0;
        const trackFor = (key) => {
            if (!GM_PROGRAM[key]) key = 'piano';
            if (!tracks.has(key)) {
                if (nextChannel === 9) nextChannel++; // canal 9 (GM) réservé à la percussion : sauté
                const channel = nextChannel++;
                const builder = new MidiTrackBuilder();
                builder.push(0, midiTextEvent(0x03, INSTRUMENT_BANKS[key].label));
                builder.push(0, [0xc0 | channel, GM_PROGRAM[key]]);
                tracks.set(key, { builder, channel });
            }
            return tracks.get(key);
        };

        let tick = 0;
        const sections = sectionsOverride || loadProgressionSections();
        sections.forEach((sec, si) => {
            // Marqueur MIDI (type 0x06) à CHAQUE partie, même sans titre (repli "Partie N", comme
            // l'export PDF) — avant, une partie sans titre n'avait aucun marqueur du tout, alors que
            // c'est justement ce repère qui permet de couper/naviguer par partie dans un DAW (retour
            // utilisateur), qu'elle soit nommée ou non.
            const title = (sec.title && sec.title.trim()) ? sec.title.trim() : `Partie ${si + 1}`;
            meta.push(tick, midiTextEvent(0x06, title));
            sec.chords.forEach(data => {
                const beats = beatsFromData(data);
                const chord = new Chord(data.root, data.quality, beats, data.inversion, data.drop, octaveFromData(data), data.bass, null, data.extraNotes);
                const midis = chord.getSeqMidiNotes();
                const { pattern, tie } = this.resolveSeqPatternForData(chord, data);
                const steps = pattern.length;
                const { builder, channel } = trackFor(data.instrument || 'piano');

                // Une voix à la fois : regroupe ses croches liées et contiguës en une seule note
                // (même logique que schedulePlayback, voir plus haut), plutôt qu'une attaque par croche.
                for (let voice = 0; voice < midis.length; voice++) {
                    let s = 0;
                    while (s < steps) {
                        if (!pattern[s].includes(voice)) { s++; continue; }
                        const runStart = s;
                        s++;
                        while (s < steps && pattern[s].includes(voice) && tie[s].includes(voice)) s++;
                        const runLen = s - runStart;
                        const held = (runLen === steps);
                        const onBeat = (runStart % SEQ_STEPS_PER_BEAT === 0);
                        const stepOverride = data.intensityPerStep && data.intensityPerStep[runStart];
                        const velocity = Math.round(computeVelocity(held, onBeat, data.intensity, stepOverride) * 127);
                        const startTick = tick + Math.round(grooveStepOffset(runStart, ticksPerStep, grooveRatio));
                        const endTick = tick + Math.round(grooveStepOffset(runStart + runLen, ticksPerStep, grooveRatio));
                        const rawDur = endTick - startTick; // durée réelle de la plage, groove compris
                        // Détache légèrement les notes non tenues (comme à l'écoute), sans jamais
                        // descendre à une durée nulle ni couper un accord tenu sur toute sa durée
                        const durTicks = held ? Math.max(1, rawDur - 8) : Math.max(20, rawDur - Math.round(ticksPerStep * 0.2));
                        const pitch = Math.min(127, Math.max(0, midis[voice]));
                        builder.push(startTick, [0x90 | channel, pitch, velocity]);
                        builder.push(startTick + durTicks, [0x80 | channel, pitch, 0]);
                    }
                }
                tick += beats * MIDI_PPQ;
            });
        });

        const trackList = [meta, ...Array.from(tracks.values()).map(t => t.builder)];
        const chunks = trackList.map(t => t.toBytes(tick)); // `tick` = fin du morceau, voir toBytes()
        const header = [0x4d, 0x54, 0x68, 0x64, ...midiU32(6), ...midiU16(1), ...midiU16(trackList.length), ...midiU16(MIDI_PPQ)];
        const bytes = header.concat(...chunks);
        return new Uint8Array(bytes);
    }

    // Télécharge des octets .mid déjà construits sous `filename` — factorisé pour l'export simple ET
    // l'export par partie (voir exportMidi).
    downloadMidiBytes(bytes, filename) {
        const blob = new Blob([bytes], { type: 'audio/midi' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    // Boîte "Un seul fichier / Un fichier par partie" (voir #midi-export-modal) : résout à false (un
    // seul fichier), true (un par partie), ou null (annulé, clic dehors/Échap compris).
    chooseMidiExportMode() {
        const overlay = document.getElementById('midi-export-modal');
        overlay.hidden = false;
        return new Promise((resolve) => {
            const close = (result) => {
                overlay.hidden = true;
                this._midiExportModalCancel = null;
                resolve(result);
            };
            this._midiExportModalCancel = () => close(null);
            document.getElementById('midi-export-single').onclick = () => close(false);
            document.getElementById('midi-export-persection').onclick = () => close(true);
            document.getElementById('midi-export-cancel').onclick = () => close(null);
        });
    }

    // Bouton à côté de l'export PDF : télécharge le morceau en .mid, prêt à être importé dans un DAW
    // (GarageBand...) pour en changer les sons ou retravailler le séquenceur. Un seul fichier
    // directement s'il n'y a qu'une seule partie ; sinon demande d'abord si on préfère un fichier PAR
    // partie (chacune sa propre timeline à 0) plutôt que le morceau entier d'un bloc — retour
    // utilisateur : un standard .mid ne permet pas de vraies coupures gérables indépendamment DANS un
    // seul fichier (seulement des marqueurs de repère, voir buildMidiFile), donc pas d'autre choix que
    // plusieurs fichiers pour un DAW qui doit gérer chaque partie séparément sans les redécouper.
    async exportMidi() {
        if (!getCurrentSongId()) {
            this.saveCurrentAsSong('Nomme d\'abord ton morceau pour exporter le MIDI');
            if (!getCurrentSongId()) return; // enregistrement annulé -> pas d'export
        }
        const sections = loadProgressionSections();
        const perSection = sections.length > 1 ? await this.chooseMidiExportMode() : false;
        if (perSection == null) return; // annulé

        const songName = this.getCurrentSongName().replace(/[\\/:*?"<>|]+/g, '_');
        if (!perSection) {
            this.downloadMidiBytes(this.buildMidiFile(), `${songName}.mid`);
            this.flashHint('MIDI téléchargé → dossier Téléchargements', 2400);
            return;
        }
        // Téléchargements décalés d'un petit délai (retour navigateur : plusieurs déclenchés d'un
        // coup peuvent être bloqués/regroupés) — largement assez pour les laisser tous passer.
        sections.forEach((sec, si) => {
            const title = (sec.title && sec.title.trim()) ? sec.title.trim() : `Partie ${si + 1}`;
            setTimeout(() => {
                this.downloadMidiBytes(this.buildMidiFile([sec]), `${songName} - ${title.replace(/[\\/:*?"<>|]+/g, '_')}.mid`);
            }, si * 200);
        });
        this.flashHint(`${sections.length} fichiers MIDI téléchargés → dossier Téléchargements`, 2400);
    }

    // ---------- Export pour l'outil compagnon Paroles (voir paroles.html) ----------
    // Juste de quoi placer des accords sur du texte : le symbole déjà résolu (tonalité/dièses-bémols,
    // renversement/basse) + la durée en temps, par partie, dans l'ordre — aucun voicing ni instrument,
    // cet outil n'en a pas besoin. Format à part (pas la sauvegarde du morceau elle-même) : ne casse
    // jamais si la structure de sauvegarde évolue, et se lit d'un coup d'œil.
    exportLyricsData() {
        if (!getCurrentSongId()) {
            this.saveCurrentAsSong('Nomme d\'abord ton morceau pour exporter les accords');
            if (!getCurrentSongId()) return; // enregistrement annulé -> pas d'export
        }
        const sections = loadProgressionSections();
        const gRoot = document.getElementById('global-root').value;
        const gMode = document.getElementById('global-mode').value;
        const useFlats = useFlatsForKey(NOTES.indexOf(gRoot), gMode);
        const data = {
            version: 1,
            song: this.getCurrentSongName(),
            beatsPerBar: this.beatsPerBar(),
            sections: sections.map(sec => ({
                title: (sec.title || '').trim(),
                chords: sec.chords.map(h => {
                    const chordUseFlats = useFlatsForChordRoot(NOTES.indexOf(h.root), NOTES.indexOf(gRoot), gMode, useFlats);
                    const chord = new Chord(h.root, h.quality, beatsFromData(h), h.inversion, h.drop, octaveFromData(h), h.bass, h.guitarLock, h.extraNotes);
                    return { symbol: chord.getBareLabel(chordUseFlats), beats: beatsFromData(h) };
                }),
            })),
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.getCurrentSongName().replace(/[\\/:*?"<>|]+/g, '_')} - paroles.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.flashHint('Fichier pour l\'outil Paroles téléchargé', 2400);
    }

    // ---------- Export audio (.mp3, encodage LAME embarqué — voir lame.min.js) ----------
    // Reprend la même résolution de motif que l'export MIDI (resolveSeqPatternForData) et le même
    // regroupement des croches liées en une seule note tenue : ce qu'on entend dans l'appli est ce qui
    // se retrouve dans le fichier, sans le décompte ni le métronome (comme pour l'export MIDI).
    //
    // Rendu hors-temps réel (Tone.Offline) avec des instruments dédiés à ce rendu, connectés
    // directement à la sortie du contexte hors-ligne — jamais ceux du cache de lecture live
    // (this.instrumentCache), qui restent liés au contexte audio temps réel et ne peuvent pas se
    // connecter à un contexte hors-ligne. On ne passe PAS non plus par Tone.Transport ici (à la
    // différence de la lecture live et de l'export MIDI) : à l'intérieur d'un rendu Tone.Offline,
    // Tone.Transport.schedule ne déclenche fiablement aucun son avec cette version de Tone.js — chaque
    // note est donc déclenchée directement à son instant absolu (secondes depuis le début du rendu).
    async renderProgressionBuffer() {
        const bpm = parseInt(document.getElementById('bpm').value) || 120;
        const grooveRatio = this.grooveRatio();
        const lead = 0.1, tail = 3; // marge de tête + queue (laisse sonner la release des nappes/synthés)

        const sections = loadProgressionSections();
        let totalBeats = 0;
        sections.forEach(sec => sec.chords.forEach(data => { totalBeats += beatsFromData(data); }));
        if (totalBeats === 0) return null; // grille vide -> rien à rendre

        const secPerBeat = 60 / bpm;
        const duration = lead + totalBeats * secPerBeat + tail;
        const generalVolumePercent = this.generalVolumePercent;

        return Tone.Offline(async () => {
            Tone.Destination.volume.value = percentToDb(generalVolumePercent);
            // Même bus partagé (réverbe légère + limiteur) que la lecture live (voir getMasterBus) —
            // mais sa PROPRE instance : ce contexte hors-ligne est entièrement séparé de celui de la
            // lecture en direct, rien ne peut s'y connecter depuis l'autre.
            const limiter = new Tone.Limiter(-2).toDestination();
            const masterBus = new Tone.Freeverb({ roomSize: 0.55, dampening: 3000, wet: 0.15 }).connect(limiter);
            const instruments = new Map(); // clé instrument -> instance dédiée à ce rendu
            const instrumentFor = (key) => {
                if (!INSTRUMENT_BANKS[key]) key = 'piano';
                if (!instruments.has(key)) instruments.set(key, INSTRUMENT_BANKS[key].build(masterBus));
                return instruments.get(key);
            };

            // Construit d'abord tous les instruments réellement utilisés dans la grille, PUIS attend
            // qu'ils soient prêts avant de déclencher la moindre note. Indispensable pour le Piano
            // (Tone.Sampler) : ses fichiers audio se chargent de façon asynchrone depuis le réseau, et
            // triggerAttackRelease à un instant absolu s'exécute IMMÉDIATEMENT (contrairement à
            // Tone.Transport.schedule, différé) — sans cette attente, les accords joués au Piano
            // restaient silencieux (ou levaient une erreur), le temps que le chargement se termine.
            sections.forEach(sec => sec.chords.forEach(data => instrumentFor(data.instrument || 'piano')));
            await Tone.loaded();

            let timeOffset = lead;
            sections.forEach(sec => {
                sec.chords.forEach(data => {
                    const beats = beatsFromData(data);
                    const chord = new Chord(data.root, data.quality, beats, data.inversion, data.drop, octaveFromData(data), data.bass, null, data.extraNotes);
                    const notes = chord.getSeqNotes();
                    const { pattern, tie } = this.resolveSeqPatternForData(chord, data);
                    const steps = pattern.length;
                    const stepDur = secPerBeat / SEQ_STEPS_PER_BEAT;
                    const stepTime = (s) => timeOffset + grooveStepOffset(s, stepDur, grooveRatio);
                    const instrument = instrumentFor(data.instrument || 'piano');

                    // Une voix à la fois : regroupe ses croches liées et contiguës en une seule note
                    // (même logique que schedulePlayback/buildMidiFile), plutôt qu'une attaque par croche.
                    for (let voice = 0; voice < notes.length; voice++) {
                        let s = 0;
                        while (s < steps) {
                            if (!pattern[s].includes(voice)) { s++; continue; }
                            const runStart = s;
                            s++;
                            while (s < steps && pattern[s].includes(voice) && tie[s].includes(voice)) s++;
                            const runLen = s - runStart;
                            const held = (runLen === steps);
                            const onBeat = (runStart % SEQ_STEPS_PER_BEAT === 0);
                            const stepOverride = data.intensityPerStep && data.intensityPerStep[runStart];
                            const vel = computeVelocity(held, onBeat, data.intensity, stepOverride);
                            const humanize = held ? 0 : Math.random() * 0.02;
                            const t0 = stepTime(runStart);
                            const runDur = stepTime(runStart + runLen) - t0; // durée réelle, groove compris
                            const dur = held ? (runDur - 0.1) : Math.max(0.05, runDur - Math.min(0.06, stepDur * 0.2));
                            instrument.triggerAttackRelease(notes[voice], dur, t0 + humanize, vel);
                        }
                    }
                    timeOffset += beats * secPerBeat;
                });
            });
        }, duration, 2, MP3_SAMPLE_RATE);
    }

    // Encode un AudioBuffer (rendu par Tone.Offline) en MP3 via lamejs (lame.min.js, vendu en local,
    // chargé dans index.html). Découpage par blocs de 1152 échantillons, taille de trame standard MP3.
    audioBufferToMp3(audioBuffer) {
        const left = floatTo16BitPCM(audioBuffer.getChannelData(0));
        const right = audioBuffer.numberOfChannels > 1 ? floatTo16BitPCM(audioBuffer.getChannelData(1)) : left;
        const encoder = new lamejs.Mp3Encoder(2, audioBuffer.sampleRate, 192);
        const blockSize = 1152;
        const chunks = [];
        for (let i = 0; i < left.length; i += blockSize) {
            const mp3buf = encoder.encodeBuffer(left.subarray(i, i + blockSize), right.subarray(i, i + blockSize));
            if (mp3buf.length > 0) chunks.push(mp3buf);
        }
        const end = encoder.flush();
        if (end.length > 0) chunks.push(end);
        return new Blob(chunks, { type: 'audio/mpeg' });
    }

    // Bouton à côté de l'export MIDI : rend le morceau entier hors-temps réel puis l'encode en MP3,
    // prêt à écouter ou partager sans DAW ni lecteur MIDI.
    async exportAudio() {
        if (!getCurrentSongId()) {
            this.saveCurrentAsSong('Nomme d\'abord ton morceau pour exporter le MP3');
            if (!getCurrentSongId()) return; // enregistrement annulé -> pas d'export
        }
        const btn = document.getElementById('export-audio');
        btn.disabled = true;
        this.flashHint('Génération du MP3…', 60000);
        try {
            const toneBuffer = await this.renderProgressionBuffer();
            if (!toneBuffer) { this.flashHint('Grille vide — rien à exporter'); return; }
            const blob = this.audioBufferToMp3(toneBuffer.get());
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.getCurrentSongName().replace(/[\\/:*?"<>|]+/g, '_')}.mp3`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            this.flashHint('MP3 téléchargé → dossier Téléchargements', 2400);
        } catch (err) {
            console.error(err);
            this.flashHint('Échec de l’export MP3');
        } finally {
            btn.disabled = false;
        }
    }

    // Popup léger (même style que openSectionPicker) : demande si la sauvegarde locale porte sur le
    // morceau ouvert ou toute la bibliothèque, avant de déclencher le téléchargement correspondant.
    openBackupScopeMenu(anchorEl) {
        const menu = document.getElementById('backup-scope-menu');
        menu.innerHTML =
            `<button type="button" data-backup-scope="song">Ce morceau</button>` +
            `<button type="button" data-backup-scope="library">Toute la bibliothèque</button>`;
        menu.querySelectorAll('button').forEach(btn => {
            btn.onclick = () => {
                this.closeBackupScopeMenu();
                if (btn.dataset.backupScope === 'song') this.exportCurrentSong();
                else this.exportLibrary();
            };
        });

        const rect = anchorEl.getBoundingClientRect();
        menu.hidden = false;
        const pad = 8;
        const left = Math.min(rect.left, window.innerWidth - menu.offsetWidth - pad);
        const top = Math.min(rect.bottom + 4, window.innerHeight - menu.offsetHeight - pad);
        menu.style.left = `${Math.max(pad, left)}px`;
        menu.style.top = `${Math.max(pad, top)}px`;
    }

    closeBackupScopeMenu() {
        const menu = document.getElementById('backup-scope-menu');
        if (menu) menu.hidden = true;
    }

    // Devine la tonalité la plus probable à partir des accords déjà posés dans TOUT le morceau (pas
    // seulement la partie active) : algorithme de Krumhansl-Schmuckler (voir KS_MAJOR_PROFILE/
    // KS_MINOR_PROFILE/pearsonCorrelation plus haut) — bien plus robuste qu'un simple décompte de
    // fondamentales diatoniques dès que les accords se compliquent (retour utilisateur : accords
    // enrichis/altérés, dominantes secondaires... courants en jazz). Construit un histogramme des 12
    // classes de hauteur RÉELLEMENT jouées (toutes les notes de chaque accord — tierce/quinte/7e/9e/
    // 11e/13e comprises, pas juste sa fondamentale), pondéré par la durée de chaque accord (un accord
    // tenu 4 mesures pèse plus qu'un simple accord de passage d'un temps), puis corrèle sa FORME à
    // celle des 24 tonalités possibles (12 fondamentales x majeur/mineur).
    suggestSongKey() {
        const chords = [];
        loadProgressionSections().forEach(sec => sec.chords.forEach(c => chords.push(c)));
        if (chords.length === 0) return [];

        const histogram = new Array(12).fill(0);
        chords.forEach(data => {
            const beats = beatsFromData(data);
            const rootPc = NOTES.indexOf(data.root);
            const chord = new Chord(data.root, data.quality, beats, 0, 'none', 3, null);
            chord.getIntervals().forEach(iv => { histogram[(rootPc + iv.semi) % 12] += beats; });
            if (data.bass) histogram[NOTES.indexOf(data.bass)] += beats;
        });

        // Second signal, INDÉPENDANT du profil de hauteurs ci-dessus : proportion des fondamentales
        // d'accord qui appartiennent à la gamme de ce candidat (pas de leur DURÉE ni du reste de leurs
        // notes, juste "cette fondamentale est-elle dans la gamme ?") — plus simple, mais measure autre
        // chose (la cohérence des FONDAMENTALES jouées, pas la couleur globale des hauteurs). Sert
        // uniquement à CONFIRMER ou nuancer le classement du profil KS (voir openKeySuggestMenu),
        // jamais à le remplacer : les deux signaux d'accord renforcent la confiance, leur désaccord la
        // nuance — plutôt qu'un score unique fusionné qui cacherait ce désaccord éventuel.
        const results = [];
        for (let rootPc = 0; rootPc < 12; rootPc++) {
            // Aligne l'histogramme sur CE candidat (index 0 = sa tonique) avant de corréler : les
            // profils KS sont eux-mêmes exprimés relativement à la tonique (voir leur commentaire).
            const rotated = Array.from({ length: 12 }, (_, i) => histogram[(rootPc + i) % 12]);
            for (const mode of ['maj', 'min']) {
                const scale = MODE_SCALES[mode];
                const diatonicCount = chords.filter(c => scale.includes(((NOTES.indexOf(c.root) - rootPc) % 12 + 12) % 12)).length;
                const profile = mode === 'maj' ? KS_MAJOR_PROFILE : KS_MINOR_PROFILE;
                results.push({
                    root: NOTES[rootPc], mode,
                    score: pearsonCorrelation(rotated, profile),
                    diatonicRatio: diatonicCount / chords.length,
                });
            }
        }
        results.sort((a, b) => b.score - a.score);
        const topByDiatonic = results.reduce((best, r) => (r.diatonicRatio > best.diatonicRatio ? r : best), results[0]);
        // "Confirmée" = les deux signaux indépendants pointent vers LA MÊME tonalité (voir plus haut) —
        // affiché tel quel dans le popup plutôt que mélangé dans un score composite.
        results.forEach(r => { r.confirmed = (r === results[0]) && r.root === topByDiatonic.root && r.mode === topByDiatonic.mode; });
        // Seuil de fiabilité (retour utilisateur) : sous 0.6, la corrélation est trop faible pour
        // qu'une tonalité soit vraiment reconnaissable — mieux vaut n'en proposer AUCUNE (harmonie trop
        // chromatique/ambiguë) que d'en afficher une peu convaincante. Appliqué APRÈS avoir déterminé
        // `confirmed` ci-dessus (qui doit comparer TOUS les candidats entre eux, seuil ou non).
        return results.filter(r => r.score > 0.6).slice(0, 5);
    }

    // Popup léger (même style que openBackupScopeMenu) : liste les tonalités candidates (voir
    // suggestSongKey), chacune applicable d'un clic à #global-root/#global-mode.
    openKeySuggestMenu(anchorEl) {
        const menu = document.getElementById('key-suggest-menu');
        const candidates = this.suggestSongKey();
        if (candidates.length === 0) {
            // Deux raisons bien distinctes de ne rien avoir à proposer : pas encore d'accords du tout,
            // ou une grille déjà remplie mais trop ambiguë/chromatique pour dépasser le seuil de
            // fiabilité (voir suggestSongKey) — deux messages différents plutôt qu'un seul générique.
            const hasChords = loadProgressionSections().some(sec => sec.chords.length > 0);
            this.flashHint(hasChords
                ? 'Aucune tonalité assez fiable à proposer pour cette grille (harmonie trop ambiguë ou chromatique)'
                : 'Pose d\'abord quelques accords dans la grille pour pouvoir analyser la tonalité');
            return;
        }
        menu.innerHTML = candidates.map(c => {
            // En pourcentage (coefficient de corrélation borné à 1, donc un multiple de 100 lisible
            // directement comme un taux de confiance) plutôt que le coefficient brut — plus parlant
            // pour l'utilisateur qu'un nombre entre 0 et 1. "✓" en plus si un second signal indépendant
            // (fondamentales diatoniques, voir suggestSongKey) confirme ce premier choix.
            const score = Math.round(c.score * 100) + '%' + (c.confirmed ? ' ✓' : '');
            // Épelé selon la convention dièses/bémols de CE candidat (pas de la tonalité actuelle du
            // morceau, encore en place tant qu'on n'a pas cliqué) : useFlatsForKey, la fonction
            // indépendante, plutôt que this.useFlatsForRoot, qui lit toujours la tonalité en cours.
            const label = `${noteNameForPc(NOTES.indexOf(c.root), useFlatsForKey(NOTES.indexOf(c.root), c.mode))} ${MODE_LABELS[c.mode]}`;
            return `<button type="button" data-key-root="${c.root}" data-key-mode="${c.mode}" title="${c.confirmed ? 'Confirmée par un second signal indépendant (fondamentales diatoniques)' : ''}">
                <span class="key-suggest-label">${escapeHtml(label)}</span>
                <span class="key-suggest-pct">${score}</span>
            </button>`;
        }).join('');
        menu.querySelectorAll('button').forEach(btn => {
            btn.onclick = () => {
                this.closeKeySuggestMenu();
                document.getElementById('global-root').value = btn.dataset.keyRoot;
                document.getElementById('global-mode').value = btn.dataset.keyMode;
                hasUnsavedChanges = true;
                this.updateKeyLabels();
                this.loadProgression();
                this.refreshPreview();
                this.flashHint(`Tonalité changée : ${btn.querySelector('.key-suggest-label').textContent}`);
            };
        });

        const rect = anchorEl.getBoundingClientRect();
        menu.hidden = false;
        const pad = 8;
        const left = Math.min(rect.left, window.innerWidth - menu.offsetWidth - pad);
        const top = Math.min(rect.bottom + 4, window.innerHeight - menu.offsetHeight - pad);
        menu.style.left = `${Math.max(pad, left)}px`;
        menu.style.top = `${Math.max(pad, top)}px`;
    }

    closeKeySuggestMenu() {
        const menu = document.getElementById('key-suggest-menu');
        if (menu) menu.hidden = true;
    }

    // Télécharge la sauvegarde JSON d'UN morceau déjà résolu — factorisé pour exportCurrentSong
    // (morceau actuellement ouvert) ET exportSongById (n'importe quel morceau de la bibliothèque,
    // voir renderFilesPanel), qui ne construisaient sinon le même fichier qu'à deux endroits.
    downloadSongBackup(song) {
        const payload = {
            app: 'HarmoHub',
            kind: 'library-backup',
            version: 1,
            exportedAt: Date.now(),
            songs: [song]
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `harmohub-${song.name.replace(/[\\/:*?"<>|]+/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.flashHint(`« ${song.name} » sauvegardé → dossier Téléchargements`, 2400);
    }

    // Sauvegarde locale d'UN SEUL morceau (voir exportLibrary pour toute la bibliothèque) — même
    // enveloppe JSON {app, kind, version, songs, ...}, réimportable par le même bouton "Importer une
    // bibliothèque" (voir importLibraryFile, qui fusionne par id sans jamais rien écraser).
    exportCurrentSong() {
        if (!getCurrentSongId()) {
            this.saveCurrentAsSong('Nomme d\'abord ton morceau pour le sauvegarder');
            if (!getCurrentSongId()) return; // enregistrement annulé -> pas de sauvegarde
        }
        const song = loadSongs().find(s => s.id === getCurrentSongId());
        if (!song) return;
        this.downloadSongBackup(song);
    }

    // Exporte directement un morceau de la bibliothèque SANS avoir à l'ouvrir d'abord (bouton dédié
    // sur chaque ligne de Paramètres > Fichiers, voir renderFilesPanel) — retour utilisateur : pouvoir
    // sauvegarder UN morceau précis à la demande, sans passer par toute la bibliothèque (exportLibrary)
    // ni devoir d'abord le charger juste pour ça (seul moyen jusqu'ici, via exportCurrentSong).
    exportSongById(id) {
        const song = loadSongs().find(s => s.id === id);
        if (!song) return;
        this.downloadSongBackup(song);
    }

    // ---------- Durée de l'accord : bouton fermé + menu déroulant d'icônes ----------
    // Pilote le <select id="duration"> resté dans le DOM mais masqué (voir index.html) : il reste la
    // seule source de vérité, lue partout ailleurs (addChordFromSymbol, onResizeStart...) via
    // document.getElementById('duration').value — ce menu ne fait qu'écrire dedans et se resynchroniser
    // avec lui (voir syncDurationPicker, appelée aussi par editChord quand un accord existant se charge).
    setupDurationPicker() {
        const menu = document.getElementById('duration-dd-menu');
        menu.innerHTML = DURATION_OPTIONS.map(d => `
            <button type="button" class="duration-dd-item" data-beats="${d.beats}">
                <svg viewBox="0 0 24 24">${d.svg}</svg>
                <span>${d.name}</span>
            </button>`).join('');

        document.getElementById('duration-dd-toggle').addEventListener('click', (e) => {
            e.stopPropagation();
            if (menu.hidden) this.openDurationMenu(); else this.closeDurationMenu();
        });
        // Ferme au clic ailleurs, comme le menu contextuel de la grille — sauf sur le menu/bouton eux-mêmes.
        document.addEventListener('click', (e) => {
            if (!document.getElementById('duration-dd').contains(e.target)) this.closeDurationMenu();
        });

        menu.addEventListener('click', (e) => {
            const item = e.target.closest('.duration-dd-item');
            if (!item) return;
            const select = document.getElementById('duration');
            select.value = item.dataset.beats;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            this.syncDurationPicker();
            this.closeDurationMenu();
        });

        this.syncDurationPicker();
    }

    openDurationMenu() {
        const toggle = document.getElementById('duration-dd-toggle');
        const menu = document.getElementById('duration-dd-menu');
        menu.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        // Position fixed (voir CSS) : coordonnées calculées ici sous le bouton, repliées à gauche si
        // ça déborderait de la fenêtre — même logique que openContextMenu/openSectionPicker.
        const rect = toggle.getBoundingClientRect();
        const pad = 8;
        const left = Math.min(rect.left, window.innerWidth - menu.offsetWidth - pad);
        menu.style.left = `${Math.max(pad, left)}px`;
        menu.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - menu.offsetHeight - pad)}px`;
    }

    closeDurationMenu() {
        const menu = document.getElementById('duration-dd-menu');
        if (menu.hidden) return;
        menu.hidden = true;
        document.getElementById('duration-dd-toggle').setAttribute('aria-expanded', 'false');
    }

    // Écrit une durée arbitraire dans le <select id="duration"> (voir editChord/onResizeMove) : un
    // <select> natif ignore silencieusement une valeur sans <option> correspondante (.value retombe à
    // "", cassant readChord() et tout ce qui en dépend) — or un accord étiré à la souris peut prendre
    // n'importe quelle durée entière, pas seulement les préréglages du menu (DURATION_OPTIONS). On
    // réutilise une unique <option> « custom » plutôt que d'en empiler une par appel.
    setDurationField(beats) {
        const select = document.getElementById('duration');
        const value = String(beats);
        if (!Array.from(select.options).some(o => o.value === value)) {
            let custom = select.querySelector('option[data-custom]');
            if (!custom) {
                custom = document.createElement('option');
                custom.dataset.custom = '1';
                select.appendChild(custom);
            }
            custom.value = value;
        }
        select.value = value;
    }

    // Reflète la durée actuelle du <select> caché sur le bouton/menu d'icônes — à appeler chaque fois
    // que sa valeur change par un autre chemin que ce menu lui-même (voir editChord).
    syncDurationPicker() {
        const select = document.getElementById('duration');
        const d = DURATION_OPTIONS.find(x => x.beats === select.value) || DURATION_OPTIONS[2];
        document.querySelector('#duration-dd-toggle [data-icon-slot]').innerHTML = `<svg viewBox="0 0 24 24">${d.svg}</svg>`;
        document.querySelector('#duration-dd-toggle [data-label-slot]').textContent = d.label;
        document.querySelectorAll('.duration-dd-item').forEach(b => b.classList.toggle('active', b.dataset.beats === d.beats));
    }

    // ---------- Style de jeu : bouton fermé + menu déroulant d'icônes ----------
    // Même principe que setupDurationPicker ci-dessus (voir son commentaire) : pilote le
    // <select id="playStyle"> resté masqué dans le DOM, seule source de vérité lue ailleurs
    // (onchange du style de jeu, readChord...). Le menu regroupe les options par `group` (Lié/Détaché),
    // avec un intitulé non cliquable entre chaque groupe, comme les <optgroup> d'origine.
    setupPlayStylePicker() {
        const menu = document.getElementById('playstyle-dd-menu');
        let lastGroup;
        menu.innerHTML = PLAYSTYLE_OPTIONS.map(p => {
            const groupHeader = (p.group && p.group !== lastGroup) ? `<div class="playstyle-dd-group">${p.group}</div>` : '';
            lastGroup = p.group;
            return `${groupHeader}
            <button type="button" class="playstyle-dd-item" data-value="${p.value}">
                <svg viewBox="0 0 24 16">${p.svg}</svg>
                <span>${p.name}</span>
            </button>`;
        }).join('');

        document.getElementById('playstyle-dd-toggle').addEventListener('click', (e) => {
            e.stopPropagation();
            if (menu.hidden) this.openPlayStyleMenu(); else this.closePlayStyleMenu();
        });
        document.addEventListener('click', (e) => {
            if (!document.getElementById('playstyle-dd').contains(e.target)) this.closePlayStyleMenu();
        });

        menu.addEventListener('click', (e) => {
            const item = e.target.closest('.playstyle-dd-item');
            if (!item) return;
            const select = document.getElementById('playStyle');
            select.value = item.dataset.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            this.syncPlayStylePicker();
            this.closePlayStyleMenu();
        });

        this.syncPlayStylePicker();
    }

    openPlayStyleMenu() {
        const toggle = document.getElementById('playstyle-dd-toggle');
        const menu = document.getElementById('playstyle-dd-menu');
        menu.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        const rect = toggle.getBoundingClientRect();
        const pad = 8;
        const left = Math.min(rect.left, window.innerWidth - menu.offsetWidth - pad);
        menu.style.left = `${Math.max(pad, left)}px`;
        menu.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - menu.offsetHeight - pad)}px`;
    }

    closePlayStyleMenu() {
        const menu = document.getElementById('playstyle-dd-menu');
        if (menu.hidden) return;
        menu.hidden = true;
        document.getElementById('playstyle-dd-toggle').setAttribute('aria-expanded', 'false');
    }

    // Reflète le style de jeu actuel du <select> caché sur le bouton/menu d'icônes — à appeler chaque
    // fois que sa valeur change par un autre chemin que ce menu lui-même (voir editChord).
    syncPlayStylePicker() {
        const select = document.getElementById('playStyle');
        const p = PLAYSTYLE_OPTIONS.find(x => x.value === select.value) || PLAYSTYLE_OPTIONS[0];
        document.querySelector('#playstyle-dd-toggle [data-icon-slot]').innerHTML = `<svg viewBox="0 0 24 16">${p.svg}</svg>`;
        document.querySelector('#playstyle-dd-toggle [data-label-slot]').textContent = p.label;
        document.querySelectorAll('.playstyle-dd-item').forEach(b => b.classList.toggle('active', b.dataset.value === select.value));
    }

    // ---------- Grille interactive : tap (écoute), glisser (déplacer) ----------
    // Un seul écouteur délégué sur le conteneur de TOUTES les parties (chaque grille est reconstruite
    // à chaque rendu, contrairement à ce conteneur qui reste stable).
    setupGridInteractions() {
        const host = document.getElementById('progression-sections');
        host.addEventListener('pointerdown', (e) => this.onGridPointerDown(e));
        // Nettoyage du suivi des doigts actifs sur la grille (voir this._gridActiveTouchIds/
        // onGridPointerDown), même principe que this._seqActiveTouchIds pour le séquenceur : posé sur
        // window pour retirer un doigt même s'il se lève hors de la grille.
        window.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') this._gridActiveTouchIds.delete(e.pointerId); });
        window.addEventListener('pointercancel', (e) => { if (e.pointerType === 'touch') this._gridActiveTouchIds.delete(e.pointerId); });
        // Case "+" en bout de grille (voir buildAddCellHtml) : Entrée ajoute l'accord tapé. Échap vide
        // le champ. Sur certains claviers virtuels (mobile), la touche « Entrée »/« Aller » ne déclenche
        // pas toujours un vrai `keydown` détecté ici : on ajoute donc aussi un ajout au relâchement du
        // focus (focusout, ci-dessous) comme filet de sécurité, pour qu'il ne se passe jamais « rien »
        // une fois l'accord tapé, même si on touche simplement ailleurs pour refermer le clavier.
        host.addEventListener('keydown', (e) => {
            if (!e.target.matches('.cell-add-input')) return;
            if (e.key === 'Enter') {
                e.preventDefault();
                // Repris dans le gestionnaire focusout (commun aux deux chemins) : marque qu'on veut
                // enchaîner (redonner le focus) une fois l'ajout fait, contrairement à un simple tap
                // ailleurs pour refermer le clavier (voir plus bas).
                e.target.dataset.refocus = '1';
                e.target.blur();
            } else if (e.key === 'Escape') {
                e.target.value = '';
                e.target.blur();
            }
        });
        // Filet de sécurité : sur certains claviers virtuels (mobile), la touche « Entrée »/« Aller »
        // ne déclenche pas toujours un vrai `keydown` détecté ci-dessus — sans ça, taper un accord puis
        // juste toucher ailleurs pour refermer le clavier ne faisait RIEN. Le relâchement du focus,
        // lui, se produit toujours.
        host.addEventListener('focusout', (e) => {
            if (!e.target.matches('.cell-add-input')) return;
            const value = e.target.value.trim();
            const refocus = e.target.dataset.refocus === '1';
            if (!value) return; // champ vidé (Échap) ou jamais rempli : rien à faire, pas d'erreur inutile
            const section = +e.target.dataset.section;
            if (this.addChordInputToSection(section, value) && refocus) {
                // loadProgression() a déjà reconstruit un champ "+" vide à la même place : lui redonner
                // le focus pour enchaîner plusieurs accords sans re-cliquer à chaque fois — seulement
                // après Entrée (le clavier reste ouvert), jamais après un tap ailleurs qui l'a fermé.
                const fresh = document.querySelector(`.cell-add-input[data-section="${section}"]`);
                if (fresh) fresh.focus();
            }
        });
    }

    onGridPointerDown(e) {
        if (e.button != null && e.button !== 0) return; // clic gauche / touch uniquement

        // Second doigt qui se pose (voir this._gridActiveTouchIds) : un pincer-zoomer démarre (voir
        // setupPinchZoom, posé sur #grid-zoom-host — un ancêtre de #progression-sections dans la loupe
        // grille — qui reçoit LE MÊME évènement par bouillonnement) — abandonne tout glisser déjà
        // amorcé par le premier doigt plutôt que de laisser les deux se disputer la même case (retour
        // utilisateur : le pincer-zoomer de la grille ne fonctionne pas bien sur téléphone).
        if (e.pointerType === 'touch') {
            this._gridActiveTouchIds.add(e.pointerId);
            if (this._gridActiveTouchIds.size > 1) {
                this.cancelGridGestureForPinch();
                return;
            }
        }

        const gridEl = e.target.closest('.chord-grid');
        if (!gridEl) return;
        if (e.target.closest('.grid-cell-add')) return; // laisse le clic focaliser normalement le champ
        if (e.target.closest('.cell-sym-input')) return; // édition inline en cours (voir startInlineChordSymbolEdit) : laisse le focus/curseur natif faire son travail
        if (e.target.closest('.cell-octave')) return; // boutons octave (voir shiftChordOctave) : pas de glisser-déposer/écoute sur ce geste
        const section = +gridEl.dataset.section;
        const cell = e.target.closest('.grid-cell');

        if (cell) {
            const rect = cell.getBoundingClientRect();
            const pressedIndex = parseInt(cell.dataset.index);
            this.drag = {
                section,
                index: pressedIndex,   // position vivante de l'accord déplacé
                origIndex: pressedIndex,
                startX: e.clientX, startY: e.clientY,
                startTime: Date.now(),
                offsetX: e.clientX - rect.left,        // pour que le fantôme ne saute pas sous le doigt
                offsetY: e.clientY - rect.top,
                width: rect.width, height: rect.height,
                moved: false, ghost: null, cell,
                pointerType: e.pointerType || 'mouse',
                // Copier au lieu de déplacer (voir onGridPointerMove/onGridPointerUp) : Ctrl/Cmd+glisser
                // à la souris, connu tout de suite ; au doigt, seulement un appui déjà un peu long
                // (voir le seuil dans onGridPointerMove) SUIVI d'un glisser — un tap-glisser immédiat
                // reste un déplacement, comme avant.
                copy: e.ctrlKey || e.metaKey,
                // Clic pile sur le symbole affiché (voir onGridPointerUp) : un tap sans glisser dessus
                // ouvre directement l'édition inline de son texte plutôt que de sélectionner/écouter
                // l'accord — bien plus rapide que passer par le mode édition complet.
                symTarget: !!e.target.closest('.cell-sym'),
                // Le geste démarre sur une case FAISANT PARTIE de la sélection multiple courante (voir
                // toggleGridMultiSelect) : Ctrl+glisser copiera TOUT le groupe d'un coup (retour
                // utilisateur), pas seulement la case sous le doigt — sinon un simple [index] comme
                // avant. Capturé ICI (avant tout glisser) : la sélection ne doit plus bouger pendant
                // le geste lui-même.
                dragIndices: (this.multiSelect.size > 1 && this.multiSelect.has(pressedIndex))
                    ? [...this.multiSelect].sort((a, b) => a - b)
                    : [pressedIndex],
            };
            this._onMove = (ev) => this.onGridPointerMove(ev);
            this._onUp = (ev) => this.onGridPointerUp(ev);
            window.addEventListener('pointermove', this._onMove, { passive: false });
            window.addEventListener('pointerup', this._onUp);
            window.addEventListener('pointercancel', this._onUp);
        }

        // Change la partie active APRÈS avoir capturé les infos du geste ci-dessus (un re-rendu
        // détacherait `cell` du DOM et fausserait ses coordonnées)
        if (section !== this.activeSection) this.setActiveSection(section);
    }

    onGridPointerMove(e) {
        const d = this.drag;
        if (!d) return;
        const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
        // Seuil distinguant tap et glisser : plus généreux pour un Ctrl/Cmd+clic (d.copy déjà posé au
        // clic, voir onGridPointerDown) qu'un clic normal — retour utilisateur : un Ctrl+clic voulu
        // pour la sélection multiple (voir toggleGridMultiSelect) basculait trop facilement en
        // Ctrl+glisser-copie au moindre tremblement, insérant une copie non voulue au lieu de
        // simplement sélectionner. Un vrai Ctrl+glisser-copie délibéré, lui, dépasse largement 18px.
        let threshold = d.copy ? 18 : 10;
        // Doigt (pas souris) DANS la loupe grille (voir gridZoomOpen) : seuil un peu plus généreux —
        // les deux doigts d'un pincer-zoomer (voir setupPinchZoom sur #grid-zoom-host) se posent
        // rarement au même instant exact, et le premier peut facilement dépasser les 10px habituels
        // avant même que le second ne touche l'écran, démarrant par erreur un glisser-réordonner.
        // Seulement en loupe (retour utilisateur : ne pas toucher au comportement de la grille classique).
        if (!d.copy && this.gridZoomOpen && d.pointerType !== 'mouse') threshold = 24;
        if (!d.moved && Math.hypot(dx, dy) < threshold) return;

        if (d.menuShown) {
            // Le menu contextuel s'est ouvert PENDANT cet appui (voir openContextMenu) mais le doigt
            // bouge avant d'être relâché : on referme le menu, l'appui était déjà assez long pour
            // qu'on considère la suite comme un glisser-copie plutôt qu'un déplacement.
            this.closeContextMenu();
            d.menuShown = false;
            d.copy = true;
        }

        if (!d.moved) {
            // Au doigt (pas Ctrl/Cmd, déjà tranché au clic) : un appui déjà tenu un moment avant que le
            // glisser ne commence bascule en copie — un tap-glisser immédiat reste un déplacement,
            // comme avant. Seuil sous les ~550ms du menu contextuel (voir attachContextMenuTrigger) :
            // le glisser aura déjà dépassé son propre seuil de 10px à ce moment-là, annulant le minuteur
            // du menu contextuel avant qu'il ne se déclenche.
            if (!d.copy && d.pointerType !== 'mouse' && (Date.now() - d.startTime) > 450) d.copy = true;
            d.moved = true;
            this.pushUndo(loadProgressionSections()); // un seul snapshot pour tout le geste de glisser
            d.ghost = this.createDragGhost(d.cell, d.width, d.height, d.copy ? d.dragIndices.length : 1); // cloner tant que la case est attachée
            // Instantané de sélection/édition d'AVANT tout glisser (déplacement, pas copie) : sert à
            // recalculer this.editingIndex/selectedIndex/multiSelect à CHAQUE case survolée ci-dessous
            // (pas seulement au dépôt final, voir onGridPointerUp) — TOUJOURS depuis ce même instantané
            // fixe plutôt que depuis leur valeur déjà décalée d'un survol précédent, sinon le décalage
            // s'accumulerait faux à chaque nouvelle case survolée.
            d.startEditingIndex = this.editingIndex;
            d.startSelectedIndex = this.selectedIndex;
            d.startMultiSelect = new Set(this.multiSelect);
            this.loadProgression();                                    // puis re-rendre (emplacement fantôme)
        }
        e.preventDefault();

        // Le fantôme suit le pointeur
        d.ghost.style.left = `${e.clientX - d.offsetX}px`;
        d.ghost.style.top = `${e.clientY - d.offsetY}px`;

        // Quel accord se trouve sous le pointeur ? (le fantôme est transparent aux événements).
        // On reste dans la MÊME partie : pas de glisser d'un accord d'une partie vers une autre.
        const under = document.elementFromPoint(e.clientX, e.clientY);
        const overCell = under && under.closest ? under.closest('.grid-cell') : null;
        if (overCell && +overCell.dataset.section === d.section) {
            const targetIndex = parseInt(overCell.dataset.index);
            if (!isNaN(targetIndex) && targetIndex !== d.index) {
                // Copie : l'original reste à sa place jusqu'au dépôt (voir onGridPointerUp,
                // duplicateChordTo) — seul le repère de case survolée (d.index) avance. Déplacement :
                // réagencement VIVANT comme avant, la grille se réorganise à chaque case survolée.
                if (!d.copy) {
                    this.moveChordLive(d.section, d.index, targetIndex);
                    d.index = targetIndex;
                    // Recalculé à CHAQUE case survolée depuis l'instantané pris au tout début du
                    // glisser (d.startEditingIndex etc., voir plus haut) et la position ORIGINALE
                    // d.origIndex — jamais de façon incrémentale depuis la valeur déjà en place, qui
                    // accumulerait un décalage faux au fil des cases survolées (voir _shiftIndex : un
                    // seul calcul « from origIndex à la position actuelle », comme onGridPointerUp au
                    // dépôt, simplement répété à chaque case plutôt qu'une seule fois à la fin).
                    this.editingIndex = this._shiftIndex(d.startEditingIndex, d.origIndex, d.index);
                    this.selectedIndex = this._shiftIndex(d.startSelectedIndex, d.origIndex, d.index);
                    this.multiSelect = new Set(Array.from(d.startMultiSelect, (i) => this._shiftIndex(i, d.origIndex, d.index)));
                    // Le séquenceur (loupe grille) doit suivre en direct l'accord qui vient de prendre
                    // la place de celui en édition, ou le contexte grisé si c'est un voisin qui bouge —
                    // sans effet si le panneau n'est pas ouvert (voir la garde de renderSequencer).
                    this.renderSequencer();
                } else {
                    this.loadProgression();
                    d.index = targetIndex;
                }
            }
        }
    }

    // Abandonne le glisser-réordonner en cours SANS le finaliser — voir onGridPointerDown, appelé
    // quand un second doigt se pose pendant qu'un pincer-zoomer démarre (voir setupPinchZoom sur
    // #grid-zoom-host, ancêtre de #progression-sections). Si le glisser avait déjà bougé (d.moved),
    // un réordonnancement réel a déjà été appliqué (voir onGridPointerMove, qui pousse un instantané
    // ET redessine la grille dès le premier mouvement) : this.undo() le défait proprement — l'appel
    // est sûr même en pleine pince, puisque le pincer-zoomer (plus haut dans le bouillonnement) ne
    // dépend que des coordonnées et d'un conteneur stable, jamais d'une .grid-cell précise.
    cancelGridGestureForPinch() {
        window.removeEventListener('pointermove', this._onMove);
        window.removeEventListener('pointerup', this._onUp);
        window.removeEventListener('pointercancel', this._onUp);
        const d = this.drag;
        this.drag = null;
        if (!d) return;
        if (d.ghost) d.ghost.remove();
        if (d.moved) this.undo();
    }

    onGridPointerUp() {
        window.removeEventListener('pointermove', this._onMove);
        window.removeEventListener('pointerup', this._onUp);
        window.removeEventListener('pointercancel', this._onUp);
        const d = this.drag;
        this.drag = null;
        if (!d) return;

        if (d.ghost) d.ghost.remove();

        // Relâché sans bouger APRÈS que le menu contextuel s'est ouvert sur ce même appui (voir
        // openContextMenu/onGridPointerMove) : rien de plus à faire, pas de tap-sélection, le menu
        // reste normalement affiché pour qu'on y choisisse une action.
        if (d.menuShown && !d.moved) return;

        if (!d.moved) {
            // Ctrl/Cmd+clic (sans glisser réel — un vrai glisser Ctrl reste la copie habituelle, voir
            // plus bas) : ajoute/retire cette case de la sélection multiple, prioritaire sur tout le
            // reste (loupe grille comprise) — voir toggleGridMultiSelect/copySelected/pasteChord.
            if (d.copy) {
                this._lastTap = null;
                this.toggleGridMultiSelect(d.section, d.index);
                return;
            }
            // Un clic normal (sans Ctrl/Cmd) ailleurs referme toujours la sélection multiple en cours,
            // comme dans la plupart des grilles/explorateurs de fichiers.
            this.multiSelect = new Set();
            // Dans la loupe grille (outil de modification rapide, voir editChordFromGridZoom) : un
            // seul clic n'importe où sur la case charge directement l'accord pour édition (+ le fait
            // entendre) et pousse aussitôt son rythme dans le séquenceur épinglé en bas — TOUJOURS,
            // quel que soit le bandeau Ajout/Modification (voir this.appMode) : c'est là tout l'intérêt
            // de cet outil dédié, contrairement à la grille classique. Un second clic rapproché PILE
            // sur le symbole (comme le double-tap normal) ouvre en plus son édition inline, pour
            // pouvoir retaper le texte sans revenir au panneau Accord.
            if (this.gridZoomOpen) {
                const now = Date.now();
                const isSecondTapOnSym = d.symTarget && this._lastTap && this._lastTap.section === d.section && this._lastTap.index === d.index && (now - this._lastTap.time) < 420;
                if (isSecondTapOnSym) {
                    this._lastTap = null;
                    this.startInlineChordSymbolEdit(d.section, d.index, d.cell);
                    return;
                }
                this._lastTap = { section: d.section, index: d.index, time: now };
                this.editChordFromGridZoom(d.section, d.index);
                return;
            }
            if (d.symTarget) {
                // Tap/clic pile sur le texte de l'accord (voir onGridPointerDown) : édition inline
                // immédiate, pas de sélection/écoute ni d'attente d'un éventuel second tap.
                this._lastTap = null;
                this.startInlineChordSymbolEdit(d.section, d.index, d.cell);
                return;
            }
            // Bandeau Ajout/Modification (voir this.appMode) : en Modification collante, un simple
            // clic sur n'importe quel accord le charge directement, plus besoin de rappuyer.
            if (this.appMode === 'edit') {
                this._lastTap = null;
                this.editChord(d.section, d.index);
                // Comme un clic en mode Ajout (voir selectChord) : fait entendre l'accord chargé — sans
                // ça, éditer en mode Modification restait muet (retour utilisateur : "la lecture ne
                // marche plus", en fait chaque clic éditait au lieu d'écouter, jamais silencieux avant).
                if (this.autoplaySelect) this.playCurrent();
                return;
            }
            const now = Date.now();
            const isSecondTap = this._lastTap && this._lastTap.section === d.section && this._lastTap.index === d.index && (now - this._lastTap.time) < 420;
            if (isSecondTap) {
                this._lastTap = null;
                this.editChord(d.section, d.index); // double-clic/double-tap = modifier
                if (this.autoplaySelect) this.playCurrent(); // même retour audio qu'un simple clic (voir ci-dessus)
            } else {
                this._lastTap = { section: d.section, index: d.index, time: now };
                this.selectChord(d.section, d.index); // simple tap/clic = écouter
            }
            return;
        }
        if (d.copy) {
            // Rien n'a encore bougé (voir onGridPointerMove) : insère la copie à l'endroit déposé —
            // tout le groupe sélectionné d'un coup si le geste avait démarré dessus (voir
            // onGridPointerDown/dragIndices), sinon juste la case glissée comme avant.
            if (d.dragIndices.length > 1) this.duplicateChordsTo(d.section, d.dragIndices, d.index);
            else this.duplicateChordTo(d.section, d.origIndex, d.index);
            return;
        }
        // La grille est déjà dans l'ordre final ; sélection/édition ont déjà été décalées en direct à
        // chaque case survolée (voir onGridPointerMove) — rien de plus à recalculer ici, un second
        // décalage sur des valeurs déjà à jour les fausserait (double décalage).
        this.loadProgression();
        this.renderSequencer(); // au cas où le tout dernier survol n'aurait pas déclenché son propre rendu
    }

    // Insère une COPIE de l'accord `fromIndex` à la position `toIndex` (voir onGridPointerUp,
    // Ctrl+glisser / appui long+glisser) — contrairement à moveChordLive, l'original reste en place ;
    // tout le reste (y compris l'original s'il est après le point d'insertion) décale d'un cran.
    // N'appelle PAS pushUndo : cette méthode n'est utilisée qu'en fin de glisser (onGridPointerUp),
    // dont le début (onGridPointerMove) a déjà pris l'unique instantané du geste — comme moveChordLive.
    duplicateChordTo(section, fromIndex, toIndex) {
        const sections = loadProgressionSections();
        const history = sections[section] && sections[section].chords;
        if (!history || !history[fromIndex]) return;
        const copy = { ...history[fromIndex] };
        const insertAt = Math.max(0, Math.min(toIndex, history.length));
        history.splice(insertAt, 0, copy);
        saveProgressionSections(sections);
        if (this.editingIndex != null && this.editingIndex >= insertAt) this.editingIndex++;
        // Même décalage pour la sélection multiple (voir onGridPointerUp) : sans ça elle continuait à
        // pointer sur les anciens index, donc sur d'autres accords une fois l'insertion faite.
        this.multiSelect = new Set(Array.from(this.multiSelect, (i) => (i >= insertAt ? i + 1 : i)));
        this.selectedIndex = insertAt; // sélectionne la copie, comme duplicateChord (menu contextuel)
        this.loadProgression();
    }

    // Même principe que duplicateChordTo, mais pour tout un GROUPE d'accords à la fois (voir
    // onGridPointerDown/dragIndices) : Ctrl+glisser depuis une case faisant partie de la sélection
    // multiple copie tout le groupe d'un coup, dans son ordre d'origine (pas celui des clics), à
    // l'endroit déposé — comme pasteChord, la sélection multiple redevient le bloc tout juste copié.
    duplicateChordsTo(section, fromIndices, toIndex) {
        const sections = loadProgressionSections();
        const history = sections[section] && sections[section].chords;
        if (!history) return;
        const sorted = fromIndices.filter(i => history[i]).sort((a, b) => a - b);
        if (!sorted.length) return;
        const copies = sorted.map(i => ({ ...history[i] }));
        const insertAt = Math.max(0, Math.min(toIndex, history.length));
        history.splice(insertAt, 0, ...copies);
        saveProgressionSections(sections);
        if (this.editingIndex != null && this.editingIndex >= insertAt) this.editingIndex += copies.length;
        this.multiSelect = new Set(Array.from({ length: copies.length }, (_, i) => insertAt + i));
        this.selectedIndex = insertAt + copies.length - 1;
        this.loadProgression();
    }

    // Édition directe du texte d'un accord déjà en place (voir onGridPointerUp, tap sur .cell-sym) :
    // remplace le symbole affiché par un champ texte pré-rempli avec ce qui est déjà à l'écran (donc
    // déjà correctement orthographié dièses/bémols dans ce contexte), sur le même modèle que la case
    // "+" (addChordFromSymbol/parseChordSymbol). Durée, style et instrument restent inchangés ; en
    // revanche octave/renversement/drop/basse sont ENTIÈREMENT redéfinis par ce qui est tapé (voir
    // parseChordSymbol) — un symbole SANS bloc "_" (ex. juste "C") repart d'un voicing par défaut au
    // lieu de garder l'ancien, pour rester cohérent avec la saisie rapide : ce qu'on tape EST le
    // voicing complet, pas un simple correctif de racine/qualité (retour utilisateur : pouvoir modifier
    // le voicing au clavier, en loupe ou volet gauche fermé, sans repasser par les menus déroulants).
    // Le repère de continuation ("↩") est retiré du texte proposé (pas la basse, désormais réaffichée
    // via "_" pour pouvoir la retoucher au même endroit — voir plus bas).
    // `initialChar` (optionnel) : au lieu de pré-remplir avec le symbole déjà affiché (tout
    // sélectionné, prêt à être remplacé), repart d'un champ vidé contenant CE caractère — pour
    // « taper au clavier » directement sur un accord chargé (loupe grille ou sélection normale, voir
    // le raccourci clavier dans setupKeyboardShortcuts) sans avoir à double-cliquer d'abord.
    startInlineChordSymbolEdit(section, index, cell, initialChar) {
        cell = cell || document.querySelector(`.grid-cell[data-section="${section}"][data-index="${index}"]`);
        const symEl = cell && cell.querySelector('.cell-sym');
        if (!symEl || symEl.tagName === 'INPUT') return; // déjà en édition ou case introuvable

        let displayText = (symEl.textContent || '').trim();
        displayText = displayText.replace(/↩\s*$/, '').trim();
        displayText = displayText.replace(/\/.*$/, '').trim();

        // Voicing actuel (basse/octave/renversement/drop) réintégré dans le texte proposé via "_",
        // pour pouvoir le retoucher sans le retaper de mémoire — seules les valeurs qui s'écartent du
        // défaut apparaissent, même notation compacte que les badges "O4-R1-D2" (voir getVoicingBadge).
        const sections0 = loadProgressionSections();
        const data0 = sections0[section] && sections0[section].chords[index];
        const modParts = [];
        if (data0) {
            if (data0.bass) modParts.push(data0.bass);
            if (data0.octave !== 3) modParts.push(`O${data0.octave}`);
            if (data0.inversion) modParts.push(`R${data0.inversion}`);
            if (data0.drop === 'drop2') modParts.push('D2');
            if (data0.drop === 'drop3') modParts.push('D3');
        }
        if (modParts.length) displayText += '_' + modParts.join('-');

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'cell-sym-input';
        input.value = initialChar != null ? initialChar : displayText;
        input.autocomplete = 'off';
        input.autocapitalize = 'off';
        input.spellcheck = false;
        symEl.replaceWith(input);
        input.focus();
        if (initialChar == null) input.select(); // sinon curseur laissé après le caractère déjà tapé

        let done = false;
        const commit = () => {
            if (done) return;
            done = true;
            const parsed = parseChordSymbol(input.value);
            if (!parsed) {
                if (input.value.trim()) this.flashHint('Accord non reconnu (ex. Cm7, F#dim, Bbadd9)');
                this.loadProgression();
                return;
            }
            const sections = loadProgressionSections();
            const data = sections[section] && sections[section].chords[index];
            if (!data) { this.loadProgression(); return; }
            this.pushUndo(sections);
            data.root = parsed.root;
            data.quality = parsed.quality;
            data.octave = parsed.octave ?? 3;
            data.inversion = parsed.inversion ?? 0;
            data.drop = parsed.drop ?? 'none';
            data.bass = parsed.bass || null;
            // Un doigté verrouillé (voir toggleGuitarLock) a été calculé pour l'ancien accord : le
            // garder afficherait un doigté ne jouant plus les notes du nouveau (voir changeChordOctave
            // pour le même principe appliqué à l'octave).
            data.guitarLock = null;
            saveProgressionSections(sections);
            hasUnsavedChanges = true;
            // Si c'est l'accord actuellement en mode édition complète, resynchronise le panneau Accord
            // (réglages/séquenceur) avec la nouvelle racine/qualité plutôt que de le laisser périmé.
            if (this.editingIndex === index && this.activeSection === section) this.editChord(section, index);
            else this.loadProgression();
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            else if (e.key === 'Escape') { e.preventDefault(); done = true; this.loadProgression(); }
        });
    }

    // Monte/descend l'accord `index` d'une octave entière (voir la pastille flottante posée par
    // updateGridCellOctaveFloat, visible uniquement dans la loupe grille) — borné à la plage du
    // sélecteur Octave (2 à 5) du panneau Accord, pour ne jamais produire une case dont l'octave
    // serait ensuite impossible à régler depuis ce même panneau.
    shiftChordOctave(section, index, delta) {
        const sections = loadProgressionSections();
        const data = sections[section] && sections[section].chords[index];
        if (!data) return;
        const next = Math.max(2, Math.min(5, octaveFromData(data) + delta));
        if (next === octaveFromData(data)) return;
        this.pushUndo(sections);
        data.octave = next;
        // Voir changeChordOctave : un doigté verrouillé peut ne plus correspondre à la nouvelle octave.
        data.guitarLock = null;
        saveProgressionSections(sections);
        hasUnsavedChanges = true;
        // Si c'est l'accord actuellement en édition, resynchronise le panneau Accord (dont le
        // sélecteur Octave) plutôt que de le laisser périmé — comme startInlineChordSymbolEdit.
        if (this.editingIndex === index && this.activeSection === section) this.editChord(section, index);
        else this.loadProgression();
    }

    // Accord de la grille "actif" pour tout ce qui n'a qu'UNE case à la fois en tête : la pastille
    // octave flottante (voir updateGridCellOctaveFloat) et les raccourcis clavier (voir
    // setupKeyboardShortcuts) — l'accord en édition (voir editChordFromGridZoom, le clic normal en
    // loupe grille) prime sur la simple sélection (this.selectedIndex, surtout pertinente hors
    // loupe) : les deux désignent presque toujours le même accord une fois en loupe, mais l'édition
    // est celle qui compte vraiment là où elle existe (ex. l'octave modifiée doit se refléter tout
    // de suite dans le panneau Accord déjà ouvert dessus).
    activeGridChordIndex() {
        return this.editingIndex != null ? this.editingIndex : this.selectedIndex;
    }

    // Branche UNE FOIS pour toutes les boutons de la pastille octave flottante (voir index.html) —
    // contrairement au reste de la grille, cet élément n'est jamais reconstruit par loadProgression,
    // inutile de re-brancher ses écouteurs à chaque rendu.
    setupGridCellOctaveFloat() {
        document.getElementById('grid-cell-octave-up').onclick = () => {
            const index = this.activeGridChordIndex();
            if (index != null) this.shiftChordOctave(this.activeSection, index, 1);
        };
        document.getElementById('grid-cell-octave-down').onclick = () => {
            const index = this.activeGridChordIndex();
            if (index != null) this.shiftChordOctave(this.activeSection, index, -1);
        };
        // Suit le défilement de la loupe grille (#grid-zoom-host, voir openGridZoom) : la pastille est
        // en position FIXE (voir .cell-octave-float en CSS, pour échapper à l'overflow:hidden de la
        // grille), donc jamais repositionnée automatiquement par le simple scroll natif — sans cet
        // écouteur, elle resterait figée à l'écran pendant que la case sélectionnée défile dessous.
        document.getElementById('grid-zoom-host').addEventListener('scroll', () => this.updateGridCellOctaveFloat(), { passive: true });
    }

    // Positionne (ou masque) la pastille octave flottante juste au-dessus de la case actuellement
    // sélectionnée/en édition dans la loupe grille — jamais posée sur la case elle-même comme avant
    // (gênait la lecture de l'accord, retour utilisateur), et jamais affichée hors de la loupe ni sans
    // accord ciblé. Appelée après chaque rendu de la grille (voir loadProgression) et à chaque scroll
    // de la loupe (voir setupGridCellOctaveFloat) : la case ciblée peut se déplacer/disparaître à tout moment.
    updateGridCellOctaveFloat() {
        const float = document.getElementById('grid-cell-octave-float');
        if (!float) return;
        const hide = () => { float.hidden = true; };
        const index = this.activeGridChordIndex();
        if (!this.gridZoomOpen || index == null) return hide();
        const cell = document.querySelector(
            `#grid-zoom-host .grid-cell[data-section="${this.activeSection}"][data-index="${index}"]`
        );
        if (!cell) return hide(); // accord filtré/scrollé hors du DOM, ou plus de sélection valide
        const rect = cell.getBoundingClientRect();
        float.hidden = false;
        // Mesuré APRÈS avoir levé `hidden` (une pastille encore masquée a des dimensions nulles) —
        // centrée sur la case, juste au-dessus ; jamais au-delà du haut de l'écran (clampée à 4px)
        // si la case sélectionnée est trop proche du bord pour laisser la place au-dessus.
        const floatRect = float.getBoundingClientRect();
        const left = rect.left + rect.width / 2 - floatRect.width / 2;
        const top = Math.max(4, rect.top - floatRect.height - 6);
        float.style.left = `${left}px`;
        float.style.top = `${top}px`;
    }

    // ---------- Plage à boucler (glisser sur la ligne des numéros de mesure) ----------
    // Glisser directement sur les accords sert déjà à les réordonner (voir onGridPointerDown) : on
    // déclenche donc ce geste-ci uniquement depuis la fine ligne de numéros de mesure sous la grille
    // (.row-measure), jamais utilisée pour autre chose — comme la règle/barre de cycle de GarageBand.
    setupLoopRangeInteractions() {
        const host = document.getElementById('progression-sections');
        host.addEventListener('pointerdown', (e) => this.onLoopRangeStart(e));
    }

    // Retrouve l'accord (index) sous un point (clientX/clientY), à partir de la géométrie de la
    // grille CSS elle-même (colonnes = temps, lignes = paires accords/numéros) plutôt que d'un
    // element-from-point : la ligne des numéros n'a d'élément qu'aux débuts de mesure (colonnes
    // creuses sinon), on ne peut donc pas se contenter d'un hit-test dessus.
    chordIndexAtPoint(gridEl, section, clientX, clientY) {
        const rect = gridEl.getBoundingClientRect();
        const beatsPerRow = parseInt(gridEl.dataset.beatsPerRow) || 16;
        const col = Math.max(0, Math.min(beatsPerRow - 1, Math.floor((clientX - rect.left) / (rect.width / beatsPerRow))));
        const history = loadProgressionSections()[section]?.chords;
        if (!history || history.length === 0) return null;
        const { cells, rows } = this.layoutProgression(history, this.beatsPerBar());
        // Hauteur RÉELLE d'un groupe de lignes CSS (chiffrage romain éventuel + accord + numéro de
        // mesure), mesurée dans le DOM (écart entre les VRAIES cases de deux lignes d'accords
        // consécutives) plutôt que recalculée depuis --row-h/--measure-row-h/--roman-row-h : ces
        // variables valent désormais un calc() (échelle verticale de la loupe grille, voir
        // applyZoomLevel), que getComputedStyle ne résout JAMAIS sur une propriété personnalisée —
        // elle renvoie la chaîne "calc(...)" telle quelle, illisible par parseFloat (NaN), ce qui
        // décalait complètement le calcul de ligne dès que la grille tenait sur plus d'une ligne.
        // Une seule ligne de vraies cases : rien à mesurer, row vaut toujours 0.
        let row = 0;
        if (rows > 1) {
            const tops = [...new Set(
                Array.from(gridEl.querySelectorAll('.grid-cell[data-index]')).map(el => Math.round(el.getBoundingClientRect().top))
            )].sort((a, b) => a - b);
            if (tops.length > 1) {
                const groupH = tops[1] - tops[0];
                row = Math.max(0, Math.min(rows - 1, Math.floor((clientY - tops[0]) / groupH)));
            }
        }
        const seg = cells.find(s => s.row === row && col >= s.col && col < s.col + s.span);
        return seg ? seg.index : null;
    }

    // Compare deux positions {section, index} dans l'ORDRE DE LECTURE (une partie puis l'autre) :
    // <0 si a vient avant b, >0 si après, 0 si identique. Sert à normaliser une plage qui peut
    // maintenant traverser plusieurs parties (voir setLoopRange).
    compareChordPos(a, b) {
        return a.section !== b.section ? a.section - b.section : a.index - b.index;
    }

    // La plage à boucler est-elle définie ET couvre-t-elle (au moins en partie) cette partie ?
    sectionInLoopRange(si) {
        const r = this.loopRange;
        return !!r && si >= r.startSection && si <= r.endSection;
    }

    // Portion de la plage à boucler qui retombe dans CETTE partie (indices locaux), ou null si la
    // plage ne la touche pas — une partie entièrement comprise entre les deux extrémités de la plage
    // est couverte en entier ; les parties de départ/arrivée ne le sont qu'à partir/jusqu'à leur bord
    // réel. isTrueStart/isTrueEnd distinguent un bord réel de la plage (poignée déplaçable) d'une
    // simple coupure de partie (voir buildLoopRangeBars).
    loopRangeForSection(si, len) {
        const r = this.loopRange;
        if (!r || si < r.startSection || si > r.endSection) return null;
        const isTrueStart = si === r.startSection;
        const isTrueEnd = si === r.endSection;
        return {
            start: isTrueStart ? r.startIndex : 0,
            end: isTrueEnd ? r.endIndex : Math.max(0, len - 1),
            isTrueStart, isTrueEnd
        };
    }

    // Deux façons de commencer un geste sur la plage à boucler, selon l'élément visé :
    //  - une poignée (.loop-range-handle-left/right) : étire CE bord seul, l'autre reste fixe ;
    //  - n'importe où ailleurs sur la ligne des numéros de mesure (.loop-range-bar OU .row-measure) :
    //    décidé GÉOMÉTRIQUEMENT (voir plus bas) selon que ce point tombe DANS la plage existante de
    //    cette partie ou non, jamais selon l'élément DOM qui a effectivement reçu le clic — .row-
    //    measure (z-index 2, un début de mesure sur deux seulement) recouvre très souvent .loop-
    //    range-bar (z-index 1, dessous) au même endroit, et se fiait à closest() pour trancher entre
    //    « attraper la bande existante » et « en démarrer une nouvelle » rendait ce geste peu fiable
    //    (retour utilisateur : la bande semblait dure à attraper, un tap dessus recommençait parfois
    //    une nouvelle plage au lieu de la déplacer/supprimer) dès que la plage démarrait/finissait
    //    pile sur un début de mesure — le cas le plus courant.
    // La plage peut maintenant traverser plusieurs parties : l'ancre/le bord fixe sont des positions
    // {section, index} (plus de simples index dans UNE section, voir compareChordPos/setLoopRange).
    onLoopRangeStart(e) {
        if (e.button != null && e.button !== 0) return; // clic gauche / toucher uniquement
        const handle = e.target.closest('.loop-range-handle');
        if (!handle && !e.target.closest('.loop-range-bar') && !e.target.closest('.row-measure')) return;
        const gridEl = e.target.closest('.chord-grid');
        if (!gridEl) return;
        e.preventDefault();
        // stopIMMEDIATEPropagation (pas juste stopPropagation) : onGridPointerDown écoute le MÊME
        // événement sur le MÊME conteneur (voir l'ordre d'attachement dans le constructeur) — sans
        // ça, il tournerait quand même juste après, changerait la partie active et re-rendrait la
        // grille AVANT la fin de ce gestionnaire, détachant `gridEl` en plein calcul.
        e.stopImmediatePropagation();
        const section = +gridEl.dataset.section;
        const range = this.loopRange;

        if (handle) {
            // Une poignée n'apparaît que sur le VRAI bord de la plage (voir buildLoopRangeBars) : pas
            // besoin de re-vérifier laquelle, sa seule présence ici suffit à identifier la section.
            if (!range) return;
            const edge = handle.dataset.edge;
            const fixed = edge === 'left'
                ? { section: range.endSection, index: range.endIndex }
                : { section: range.startSection, index: range.startIndex };
            this.loopRangeDrag = { mode: edge === 'left' ? 'edge-left' : 'edge-right', fixed, moved: false };
        } else {
            const anchorIndex = this.chordIndexAtPoint(gridEl, section, e.clientX, e.clientY);
            if (anchorIndex == null) return;
            const history = loadProgressionSections()[section]?.chords;
            const localRange = history ? this.loopRangeForSection(section, history.length) : null;
            const insideExisting = localRange && anchorIndex >= localRange.start && anchorIndex <= localRange.end;
            if (insideExisting) {
                // Tap sans bouger = supprime (voir onLoopRangeEnd) ; glisser = redéfinit depuis ce
                // point, exactement comme un glisser démarré hors de la plage — seul le tap immobile
                // change de sens ici, d'où un mode distinct ('bar-tap') malgré une logique de glisser
                // identique au cas ci-dessous.
                this.loopRangeDrag = { mode: 'bar-tap', anchor: { section, index: anchorIndex }, moved: false };
            } else {
                this.loopRangeDrag = { mode: 'new', anchor: { section, index: anchorIndex }, moved: false };
                this.setLoopRange(section, anchorIndex, section, anchorIndex);
            }
        }

        this.loopRangeDragStart = { x: e.clientX, y: e.clientY };
        this._onLoopRangeMove = (ev) => this.onLoopRangeMove(ev);
        this._onLoopRangeUp = () => this.onLoopRangeEnd();
        window.addEventListener('pointermove', this._onLoopRangeMove);
        window.addEventListener('pointerup', this._onLoopRangeUp);
        window.addEventListener('pointercancel', this._onLoopRangeUp);
    }

    onLoopRangeMove(e) {
        const d = this.loopRangeDrag;
        if (!d) return;
        const start = this.loopRangeDragStart;
        // Même seuil que la grille (voir onGridPointerMove) : 6px était trop sensible au moindre
        // tremblement, transformant un tap voulu (supprimer/attraper la bande) en un début de glisser.
        if (!d.moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 10) return;
        d.moved = true;

        // Le pointeur peut maintenant survoler N'IMPORTE QUELLE grille (glisser d'une partie à une
        // autre) : on retrouve celle du point courant par hit-test plutôt que de rester bloqué sur la
        // section de départ. Hors de toute grille (espace entre deux cartes...) : on ignore ce
        // déplacement, la plage reste comme avant plutôt que de sauter n'importe où.
        const hit = document.elementFromPoint(e.clientX, e.clientY);
        const gridEl = hit && hit.closest('.chord-grid');
        if (!gridEl) return;
        const section = +gridEl.dataset.section;
        const index = this.chordIndexAtPoint(gridEl, section, e.clientX, e.clientY);
        if (index == null) return;
        const cur = { section, index };

        if (d.mode === 'edge-left') {
            // Bloquée au bord fixe (pas au-delà) : sinon le bord gauche glissé au-delà du droit
            // inverserait silencieusement leurs rôles (voir setLoopRange, qui réordonne les deux bords).
            const clamped = this.compareChordPos(cur, d.fixed) <= 0 ? cur : d.fixed;
            this.setLoopRange(clamped.section, clamped.index, d.fixed.section, d.fixed.index);
        } else if (d.mode === 'edge-right') {
            const clamped = this.compareChordPos(cur, d.fixed) >= 0 ? cur : d.fixed;
            this.setLoopRange(d.fixed.section, d.fixed.index, clamped.section, clamped.index);
        } else {
            this.setLoopRange(d.anchor.section, d.anchor.index, cur.section, cur.index);
        }
    }

    onLoopRangeEnd() {
        window.removeEventListener('pointermove', this._onLoopRangeMove);
        window.removeEventListener('pointerup', this._onLoopRangeUp);
        window.removeEventListener('pointercancel', this._onLoopRangeUp);
        const d = this.loopRangeDrag;
        this.loopRangeDrag = null;
        this.loopRangeDragStart = null;
        // Tap (sans glisser) pile sur une bande déjà là, pas sur une poignée : la supprime — sans ça,
        // aucun moyen tactile d'annuler une plage à boucler une fois posée.
        if (d && d.mode === 'bar-tap' && !d.moved && this.sectionInLoopRange(d.anchor.section)) {
            this.loopRange = null;
            this.loadProgression();
            this.renderSequencer(); // #seq-play reflète la plage (voir renderSequencer) — sans effet si fermé
            // Retire la chanson entière de la boucle : une lecture en cours doit refléter ça tout de
            // suite (voir liveRestartForGlobalChange), sinon elle continuerait à boucler l'ancienne
            // plage jusqu'à un Stop manuel.
            this.liveRestartForGlobalChange();
        }
    }

    // sectionA/indexA et sectionB/indexB sont les deux bords de la plage, dans n'importe quel ordre
    // (normalisés ici selon compareChordPos) — peuvent désigner deux parties différentes.
    setLoopRange(sectionA, indexA, sectionB, indexB) {
        const a = { section: sectionA, index: indexA }, b = { section: sectionB, index: indexB };
        const [lo, hi] = this.compareChordPos(a, b) <= 0 ? [a, b] : [b, a];
        const r = this.loopRange;
        // Rien de changé -> pas de re-rendu (évite de re-déclencher loadProgression à chaque micro-
        // mouvement du pointeur quand l'accord visé n'a pas bougé).
        if (r && r.startSection === lo.section && r.startIndex === lo.index
            && r.endSection === hi.section && r.endIndex === hi.index) return;
        this.loopRange = { startSection: lo.section, startIndex: lo.index, endSection: hi.section, endIndex: hi.index };
        this.loadProgression();
        this.renderSequencer(); // #seq-play reflète la plage (voir renderSequencer) — sans effet si fermé
        // Une lecture de toute la chanson en cours doit se mettre à boucler cette plage tout de suite
        // (voir liveRestartForGlobalChange) plutôt que d'attendre un Stop/Lecture manuel — sans effet
        // sur l'audition d'un seul accord (playCurrent), sans rapport avec cette plage.
        if (this._playMode === 'progression') this.liveRestartForGlobalChange();
    }

    // Bande(s) façon barre de cycle (GarageBand) marquant la plage à boucler, sur la ligne des
    // numéros de mesure — une par LIGNE de la grille effectivement couverte (un accord scindé sur
    // plusieurs lignes, ou une plage qui déborde sur la ligne suivante, ont chacun leur propre bande).
    // Poignées d'étirement (voir .loop-range-handle) posées UNIQUEMENT sur le vrai bord de la plage
    // (premier segment de loopRange.start, dernier segment de loopRange.end) : une bande intermédiaire
    // (plage qui traverse plusieurs lignes) n'a pas de poignée, ses bords ne sont que des retours à la
    // ligne, pas de vraies extrémités déplaçables. Poignées posées comme éléments de grille INDÉPENDANTS
    // (pas imbriquées dans .loop-range-bar) : imbriquées, leur z-index resterait piégé dans le contexte
    // d'empilement isolé de la bande (position+z-index), sans jamais pouvoir passer devant .row-measure
    // — qui occupe pourtant la case juste là la plupart du temps (un bord de plage tombe presque
    // toujours sur un début de mesure).
    // `rowsPerGroup` (2 ou 3 lignes CSS par ligne d'ACCORDS, selon que le chiffrage romain est affiché
    // au-dessus — voir loadProgression) traduit this.row en ligne CSS : la plage/ses poignées occupent
    // toujours la DERNIÈRE sous-ligne du groupe (celle des numéros de mesure), quel que soit ce nombre.
    // `loopRange` est déjà borné aux indices LOCAUX de cette partie (voir loopRangeForSection) :
    // isTrueStart/isTrueEnd indiquent si son bord ici est un vrai bord de la plage globale (poignée
    // déplaçable) ou juste la coupure d'une plage qui continue dans la partie précédente/suivante
    // (pas de poignée là — rien à en déplacer, elle n'a de sens que d'un seul tenant).
    buildLoopRangeBars(cells, loopRange, rowsPerGroup) {
        if (!loopRange) return '';
        const byRow = new Map();
        cells.forEach(s => {
            if (s.index < loopRange.start || s.index > loopRange.end) return;
            const r = byRow.get(s.row) || { minCol: s.col, maxCol: s.col + s.span };
            r.minCol = Math.min(r.minCol, s.col);
            r.maxCol = Math.max(r.maxCol, s.col + s.span);
            byRow.set(s.row, r);
        });
        const startCell = loopRange.isTrueStart ? cells.find(s => s.index === loopRange.start && s.isFirst) : null;
        const endCell = loopRange.isTrueEnd ? cells.find(s => s.index === loopRange.end && s.isLast) : null;
        const bars = Array.from(byRow.entries()).map(([row, r]) => `
                    <div class="loop-range-bar" style="grid-column: ${r.minCol + 1} / ${r.maxCol + 1}; grid-row: ${row * rowsPerGroup + rowsPerGroup};"></div>`
        ).join('');
        const leftHandle = startCell ? `
                    <div class="loop-range-handle loop-range-handle-left" data-edge="left" style="grid-column: ${startCell.col + 1} / span 1; grid-row: ${startCell.row * rowsPerGroup + rowsPerGroup};"></div>` : '';
        const rightHandle = endCell ? `
                    <div class="loop-range-handle loop-range-handle-right" data-edge="right" style="grid-column: ${endCell.col + endCell.span} / span 1; grid-row: ${endCell.row * rowsPerGroup + rowsPerGroup};"></div>` : '';
        return bars + leftHandle + rightHandle;
    }

    // Case "+" en bout de grille (une par partie) : un simple champ texte (placeholder "+"), pour
    // taper un accord directement dedans (voir addChordFromSymbol/onAddCellKeydown) sans repasser par
    // le champ d'ajout rapide séparé — pratique maintenant que les accords se réordonnent par glisser
    // (voir onGridPointerDown), plus besoin d'ajouter au bon endroit du premier coup. `gridRow` est
    // déjà la ligne CSS finale (traduite par l'appelant, voir loadProgression), pas un index logique.
    buildAddCellHtml(section, gridRow, col, span) {
        return `
                    <div class="grid-cell grid-cell-add" style="grid-column: ${col + 1} / span ${span}; grid-row: ${gridRow};">
                        <input type="text" class="cell-add-input" data-section="${section}" placeholder="+" autocomplete="off" autocapitalize="off" spellcheck="false" title="Un accord seul (ex. Cm7), avec une basse via « _ » (ex. C_E = do avec mi à la basse), ou plusieurs accords séparés par « / » : un par mesure, sans renversement ni drop">
                    </div>`;
    }

    // ---------- Étirement d'un accord (durée) directement dans la grille ----------
    // Glisser la poignée au bord droit du DERNIER segment d'un accord change sa durée par pas d'un
    // temps entier (comme toutes les durées de l'appli), sans repasser par le panneau Accord. Le
    // bord GAUCHE du PREMIER segment fait de même mais symétriquement : il emprunte/rend des temps à
    // l'accord PRÉCÉDENT (glisser vers la gauche agrandit l'accord courant et réduit le précédent
    // d'autant, et inversement) — les deux accords restent toujours à 1 temps minimum.
    onResizeStart(e, section, index, edge) {
        if (e.button != null && e.button !== 0) return; // clic gauche / toucher uniquement
        e.stopPropagation(); // n'ouvre pas aussi le glisser-déposer (réordonner) de la grille
        e.preventDefault();
        const sections = loadProgressionSections();
        const history = sections[section] && sections[section].chords;
        const data = history && history[index];
        if (!data) return;
        const prevData = (edge === 'left') ? history[index - 1] : null;
        if (edge === 'left' && !prevData) return; // pas d'accord précédent à réduire
        const grid = e.target.closest('.chord-grid');
        const beatsPerRow = parseInt(grid.dataset.beatsPerRow) || 16;
        const colWidth = grid.getBoundingClientRect().width / beatsPerRow;
        // Grille pas encore mesurable (largeur nulle : masquée, en transition...) : pas de division
        // par zéro plus loin (onResizeMove), qui produirait un delta Infinity/NaN et corromprait
        // durablement la durée de l'accord (voir beatsFromData).
        if (!(colWidth > 0)) return;

        this.resize = {
            section, index, edge,
            startX: e.clientX,
            startBeats: beatsFromData(data),
            startPrevBeats: prevData ? beatsFromData(prevData) : null,
            colWidth,
            lastDelta: 0,
        };
        this._onResizeMove = (ev) => this.onResizeMove(ev);
        this._onResizeEnd = () => this.onResizeEnd();
        window.addEventListener('pointermove', this._onResizeMove, { passive: false });
        window.addEventListener('pointerup', this._onResizeEnd);
        window.addEventListener('pointercancel', this._onResizeEnd);
    }

    onResizeMove(e) {
        const r = this.resize;
        if (!r) return;
        e.preventDefault();
        const dxBeats = Math.round((e.clientX - r.startX) / r.colWidth);

        let delta; // temps ajoutés à l'accord courant (bord droit : direct : bord gauche : inversé,
                   // glisser à gauche = dx négatif doit AGRANDIR l'accord courant)
        if (r.edge === 'left') {
            delta = -dxBeats;
            // bornes : l'accord courant et le précédent restent chacun à 1 temps minimum
            delta = Math.max(1 - r.startBeats, Math.min(r.startPrevBeats - 1, delta));
        } else {
            delta = Math.max(1 - r.startBeats, dxBeats);
        }
        if (delta === r.lastDelta) return;
        r.lastDelta = delta;

        if (!r.pushedUndo) { this.pushUndo(loadProgressionSections()); r.pushedUndo = true; }
        const sections = loadProgressionSections();
        const history = sections[r.section] && sections[r.section].chords;
        const data = history && history[r.index];
        if (!data) return;
        data.beats = r.startBeats + delta;
        if (r.edge === 'left') {
            const prevData = history[r.index - 1];
            if (prevData) prevData.beats = r.startPrevBeats - delta;
        }
        saveProgressionSections(sections);
        // Si l'accord actuellement en ÉDITION (panneau Accord, toujours ouvert dessus tant qu'on ne
        // valide pas) est concerné par ce redimensionnement — lui-même, ou le PRÉCÉDENT si on étire
        // depuis le bord gauche (voir plus haut, `data`/`prevData`) — son champ Durée doit suivre :
        // renderSequencer ci-dessous s'appuie sur readChord()/getLiveSeqPattern, qui lisent CE champ,
        // pas les données qu'on vient de sauvegarder — sans ce ré-alignement, le séquenceur resterait
        // figé sur l'ancienne durée pendant tout le glissé (l'accord voisin en contexte grisé de la
        // vue continue, lui, n'a pas ce problème : son rythme est relu directement depuis les données
        // sauvegardées à chaque rendu, jamais depuis un champ du panneau).
        if (r.section === this.activeSection) {
            const editedData = this.editingIndex === r.index ? data
                : (r.edge === 'left' && this.editingIndex === r.index - 1) ? history[r.index - 1]
                : null;
            if (editedData) {
                this.setDurationField(beatsFromData(editedData));
                this.syncDurationPicker();
            }
        }
        this.loadProgression();
        // Le séquenceur (loupe grille : séquenceur épinglé/vue continue) doit suivre en direct, pas
        // seulement une fois le glissé relâché — que ce soit l'accord affiché dedans (sa propre durée
        // change) ou l'un de ses voisins immédiats (leur rythme réel, affiché en contexte grisé dans
        // la vue continue, dépend aussi de leur durée — voir renderSequencer). Sans effet si le
        // panneau n'est pas ouvert (voir la garde tout en haut de renderSequencer).
        this.renderSequencer();
    }

    onResizeEnd() {
        window.removeEventListener('pointermove', this._onResizeMove);
        window.removeEventListener('pointerup', this._onResizeEnd);
        window.removeEventListener('pointercancel', this._onResizeEnd);
        const r = this.resize;
        this.resize = null;
        // Une seule fois ici, à la FIN du glissé (pas à chaque onResizeMove) : voir
        // extendChordPatternToHold. Bord droit uniquement — le bord gauche fait grandir l'accord
        // courant en repoussant son DÉBUT plus tôt (préfixe, pas suffixe) : cas plus rare, non couvert
        // ici, laissé au comportement existant (resizeSeqPattern boucle toujours dans ce cas précis).
        if (r && r.edge !== 'left' && r.lastDelta > 0) {
            this.extendChordPatternToHold(r.section, r.index, r.startBeats);
        }
        // Redessine la grille pour effacer les repères propres AU GESTE (mesure atteinte/traits de
        // temps, voir resizeReachedBar/beatTicksEl dans loadProgression) — sans ça, ils resteraient
        // affichés indéfiniment : ni extendChordPatternToHold ni rien d'autre ici ne redessine la
        // grille (seul onResizeMove le faisait, systématiquement, jusqu'ici PENDANT le geste).
        if (r) this.loadProgression();
    }

    // Prolonge le motif d'un accord dont la durée vient de GRANDIR (jamais appelé pour un
    // rétrécissement, déjà couvert par la troncature de resizeSeqPattern) : la zone AJOUTÉE ne reçoit
    // QUE des notes tenues (retour utilisateur) — jusque-là, étirer un accord dans la grille laissait
    // resizeSeqPattern boucler le motif/préréglage d'origine (croches, style rythmique...) sur toute
    // la zone ajoutée au lieu de la tenir simplement. Le motif d'origine, lui, ne change pas, quel que
    // soit son propre rythme. Prend `oldBeats` en paramètre plutôt que de le déduire : à cet instant
    // `data.beats` porte déjà la NOUVELLE valeur (voir les deux appelants).
    extendChordPatternToHold(section, index, oldBeats) {
        const sections = loadProgressionSections();
        const data = sections[section] && sections[section].chords[index];
        if (!data) return;
        const newBeats = beatsFromData(data);
        if (newBeats <= oldBeats) return;

        const oldChord = new Chord(data.root, data.quality, oldBeats, data.inversion, data.drop, octaveFromData(data), data.bass, data.guitarLock, data.extraNotes);
        const { pattern, tie } = this.resolveSeqPatternForData(oldChord, data);
        const voices = oldChord.getSeqMidiNotes().length;
        const oldSteps = pattern.length;
        const newSteps = newBeats * SEQ_STEPS_PER_BEAT;
        const boundaryActive = pattern[oldSteps - 1] || [];
        for (let s = oldSteps; s < newSteps; s++) {
            const active = [], tied = [];
            for (let v = 0; v < voices; v++) {
                active.push(v);
                // Liée à la croche précédente sauf tout premier pas ajouté pour une voix qui ne
                // sonnait pas encore juste avant l'étirement (attaque nette à cet instant précis).
                if (s > oldSteps || boundaryActive.includes(v)) tied.push(v);
            }
            pattern.push(active);
            tie.push(tied);
        }
        data.arpPattern = serializeSeqPattern(pattern, tie);
        data.seqEdited = true;
        saveProgressionSections(sections);

        // Cet accord est actuellement ouvert dans le panneau d'édition : le champ live doit refléter
        // le prolongement tout de suite, sinon le séquenceur affiché resterait sur l'ancien motif
        // bouclé/préréglage jusqu'à la prochaine ouverture de cet accord (getLiveSeqPattern lit
        // #arpPattern, jamais les données qu'on vient de sauvegarder ci-dessus).
        if (section === this.activeSection && this.editingIndex === index) {
            document.getElementById('arpPattern').value = data.arpPattern;
            this.seqTouched = true;
            this.renderSequencer();
        }
    }

    // Équivalent clavier de la poignée d'étirement (voir onResizeStart/onResizeMove ci-dessus) pour
    // l'accord sélectionné dans la grille (Maj+←/→, voir setupKeyboardShortcuts) : même pas d'un
    // temps entier que la souris, borné à 1 temps minimum. Pas de lecture audio ni de déplacement du
    // playhead ici (contrairement à selectChord) — seule la durée change, l'accord reste sélectionné.
    // `index` : this.selectedIndex par défaut (grille classique), mais l'appelant peut passer
    // this.activeGridChordIndex() pour suivre l'accord en ÉDITION dans la loupe grille à la place.
    resizeSelectedChord(delta, index = this.selectedIndex) {
        if (index == null) return;
        const sections = loadProgressionSections();
        const history = sections[this.activeSection] && sections[this.activeSection].chords;
        const data = history && history[index];
        if (!data) return;
        const beats = beatsFromData(data);
        const next = Math.max(1, beats + delta);
        if (next === beats) return;
        this.pushUndo(sections);
        data.beats = next;
        saveProgressionSections(sections);
        // Si l'accord redimensionné est celui actuellement en édition, le champ Durée du panneau doit
        // suivre AVANT tout rendu du séquenceur (voir onResizeMove pour le même besoin au glisser
        // souris) : renderSequencer ci-dessous (via extendChordPatternToHold) déclenche désormais aussi
        // commitLiveEdit (voir ce dernier), qui réécrirait sinon `next` avec l'ancienne valeur encore
        // affichée dans ce champ, annulant le redimensionnement.
        if (this.editingIndex === index) {
            this.setDurationField(next);
            this.syncDurationPicker();
        }
        this.extendChordPatternToHold(this.activeSection, index, beats);
        this.loadProgression();
    }

    // Crée un clone flottant de la case en cours de déplacement. `count` > 1 (copie d'un groupe
    // sélectionné en une fois, voir onGridPointerDown/duplicateChordsTo) : petit badge « ×N » pour
    // indiquer que tout le groupe suit, alors qu'une seule case est visuellement glissée.
    createDragGhost(cell, width, height, count = 1) {
        const rect = cell.getBoundingClientRect();
        const ghost = cell.cloneNode(true);
        ghost.classList.add('drag-ghost');
        ghost.classList.remove('selected', 'editing', 'drag-placeholder');
        ghost.style.width = `${width || rect.width}px`;
        ghost.style.height = `${height || rect.height}px`;
        if (count > 1) {
            const badge = document.createElement('span');
            badge.className = 'drag-ghost-badge';
            badge.textContent = `×${count}`;
            ghost.appendChild(badge);
        }
        document.body.appendChild(ghost);
        return ghost;
    }

    // Déplace l'accord `from` -> `to` en direct, au sein d'une même partie (écrit et re-rend,
    // sans toucher sélection/édition)
    moveChordLive(section, from, to) {
        const sections = loadProgressionSections();
        const history = sections[section] && sections[section].chords;
        if (!history || from < 0 || from >= history.length || to < 0 || to >= history.length) return;
        const [item] = history.splice(from, 1);
        history.splice(to, 0, item);
        saveProgressionSections(sections);
        this.loadProgression();
    }

    // Recalcule un index après déplacement d'un élément de `from` vers `to`
    _shiftIndex(idx, from, to) {
        if (idx == null) return null;
        if (idx === from) return to;
        if (from < idx && idx <= to) return idx - 1;
        if (to <= idx && idx < from) return idx + 1;
        return idx;
    }

    // ---------- Séquenceur pas-à-pas (résolution croche, disponible pour tous les styles) ----------

    // Motif tel que stocké dans l'interface, ajusté (tronqué/complété/voix filtrées) à cet accord.
    // Renvoie { pattern, tie }.
    getLiveSeqPattern(chord) {
        const steps = chord.beats * SEQ_STEPS_PER_BEAT;
        const voices = chord.getSeqMidiNotes().length;
        const { pattern, tie } = parseSeqPattern(document.getElementById('arpPattern').value);
        return resizeSeqPattern(pattern, tie, steps, voices);
    }

    setLiveSeqPattern(pattern, tie) {
        document.getElementById('arpPattern').value = serializeSeqPattern(pattern, tie);
    }

    // Garde le motif cohérent avec l'accord courant, qu'on ait ouvert le panneau séquenceur ou non
    // (sinon la sauvegarde figerait un motif invalide ou périmé). Tant que rien n'a été personnalisé
    // (this.seqTouched === false), on suit simplement le style de lecture choisi.
    syncSeqPatternForCurrentChord() {
        const chord = this.readChord();
        const steps = chord.beats * SEQ_STEPS_PER_BEAT;
        const voices = chord.getSeqMidiNotes().length;
        const chordToneVoices = chord.getIntervals().length; // corps de l'accord seul (jamais notes
                                                               // libres/basse, voir seqLastChordToneVoices)
        let result;
        if (this.seqTouched) {
            const parsed = parseSeqPattern(document.getElementById('arpPattern').value);
            result = resizeSeqPattern(parsed.pattern, parsed.tie, steps, voices);
            // Une ou plusieurs voix neuves DANS LE CORPS DE L'ACCORD (ex. qualité min -> min7, la 7te) :
            // resizeSeqPattern ne fait que filtrer/répéter l'existant, jamais en inventer une — voir
            // applyNewVoiceDefaults pour la règle (même schéma que les autres voix du corps si elles
            // concordent toutes, sinon tenue pleine durée). Bornée au corps de l'accord seul : une note
            // libre qui vient d'être ajoutée (voir addSequencerNote) grandit `voices` de la même façon
            // mais doit rester silencieuse par défaut (voir ghost_note_test), donc jamais concernée ici.
            result = applyNewVoiceDefaults(result.pattern, result.tie, this.seqLastChordToneVoices, chordToneVoices);
        } else {
            result = seqPreset(document.getElementById('playStyle').value, voices, steps);
        }
        this.setLiveSeqPattern(result.pattern, result.tie);
        this.seqLastChordToneVoices = chordToneVoices;
        return chord;
    }

    // Motif à jouer pour un accord SAUVEGARDÉ. Avant le séquenceur généralisé, seul le style
    // « Arpège » utilisait vraiment le champ arpPattern (Maintenu/Par temps l'ignoraient) : pour les
    // sauvegardes antérieures (sans le marqueur seqEdited), on régénère donc le motif-type du style
    // plutôt que de faire confiance à un arpPattern hérité qui ne correspond à rien. Renvoie { pattern, tie }.
    resolveSeqPatternForData(chord, data) {
        const steps = chord.beats * SEQ_STEPS_PER_BEAT;
        const voices = chord.getSeqMidiNotes().length;
        const style = data.playStyle || 'held';
        const trustStored = data.seqEdited || style === 'arpeggio';
        if (!trustStored) return seqPreset(style, voices, steps);
        const { pattern, tie } = parseSeqPattern(data.arpPattern);
        return resizeSeqPattern(pattern, tie, steps, voices);
    }

    // Glisser sur la grille pour étirer/effacer une note sur plusieurs croches d'affilée (souris et
    // tactile) : on délègue depuis le conteneur stable #arp-sequencer, qui survit aux re-rendus de
    // la grille (contrairement aux cases elles-mêmes, reconstruites à chaque renderSequencer()).
    setupSequencerInteractions() {
        const host = document.getElementById('arp-sequencer');
        host.addEventListener('pointerdown', (e) => this.onSeqPointerDown(e));
        // Nettoyage du suivi des doigts actifs (voir this._seqActiveTouchIds/onSeqPointerDown) : posé
        // sur window, pas sur `host`, pour retirer un doigt même s'il se lève hors du séquenceur (glissé
        // qui sort de la zone pendant un pincer-zoomer, par exemple).
        window.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') this._seqActiveTouchIds.delete(e.pointerId); });
        window.addEventListener('pointercancel', (e) => { if (e.pointerType === 'touch') this._seqActiveTouchIds.delete(e.pointerId); });
    }

    // Le geste n'est appliqué qu'à la fin (voir onSeqPointerUp) : un simple tap sur une note déjà
    // posée la SÉLECTIONNE au lieu de l'effacer immédiatement ; ce n'est qu'un vrai glissé (mouvement
    // détecté) qui peint/efface plusieurs croches d'affilée.
    onSeqPointerDown(e) {
        if (e.button != null && e.button !== 0) return; // clic gauche / toucher uniquement

        // Second doigt qui se pose (voir this._seqActiveTouchIds) : un pincer-zoomer démarre (voir
        // setupPinchZoom, posé sur un ancêtre — #seq-zoom-host/#grid-zoom-pinned-body — qui reçoit LE
        // MÊME évènement par bouillonnement) — abandonne proprement tout peindre/glisser/rectangle déjà
        // amorcé par le premier doigt plutôt que de laisser les deux se disputer la même case.
        if (e.pointerType === 'touch') {
            this._seqActiveTouchIds.add(e.pointerId);
            if (this._seqActiveTouchIds.size > 1) {
                this.cancelSeqGestureForPinch();
                return;
            }
        }

        const cell = e.target.closest('.seq-cell');
        if (!cell) return;

        const voice = +cell.dataset.voice, step = +cell.dataset.step;
        const wasOn = cell.classList.contains('on');

        // Pipette de motif armée (voir toggleSeqRowPipette) : n'importe quel clic sur cette ligne
        // dépose le motif prélevé dessus, au lieu de peindre/étirer/sélectionner normalement — reste
        // armée pour enchaîner d'autres lignes (voir applySeqRowPipette).
        if (this.seqRowPipette) {
            e.preventDefault();
            this.applySeqRowPipette(voice);
            return;
        }

        // Sélection par rectangle (Maj/Shift + glisser depuis une case VIDE, retour utilisateur :
        // sélectionner plusieurs notes à la fois, même sur des voix différentes, sans les Ctrl+clic
        // une par une) : état séparé de this.seqDrag ci-dessous (qui suppose toujours une seule voix
        // de départ), voir beginSeqMarqueeSelect. Réservé à une case VIDE pour ne rien changer au
        // glissé normal (peindre/effacer/étirer) qui, lui, ignore Maj. Ctrl/Cmd déjà enfoncé = ajoute
        // à la sélection existante au lieu de la remplacer, même convention que Ctrl+clic.
        if (!wasOn && e.shiftKey) {
            this.beginSeqMarqueeSelect(voice, step, e);
            return;
        }

        const chord = this.readChord();
        const { pattern, tie } = this.getLiveSeqPattern(chord);

        // Si la croche touchée appartient à une note existante ET qu'elle en est le DÉBUT, la FIN,
        // ou l'unique croche, un glissé pourra étirer/raccourcir la note depuis ce bord. Mais un
        // simple tap (sans glisser) se contente TOUJOURS de sélectionner, exactement comme au milieu
        // d'une note : cliquer ne modifie jamais rien, seul un vrai glissé le fait.
        let resize = null;
        let noteStart = null, noteEnd = null, isStart = false, isEnd = false;
        if (wasOn) {
            noteStart = step; noteEnd = step;
            while (noteStart > 0 && pattern[noteStart - 1].includes(voice) && tie[noteStart].includes(voice)) noteStart--;
            while (noteEnd + 1 < pattern.length && pattern[noteEnd + 1].includes(voice) && tie[noteEnd + 1].includes(voice)) noteEnd++;
            isStart = (step === noteStart); isEnd = (step === noteEnd);
            if (isStart || isEnd) {
                const { minStart, maxEnd } = this.seqNeighborBounds(pattern, voice, noteStart, noteEnd);
                // 'auto' pour une note d'une seule croche : le sens du tout premier glissé décide du bord
                const edge = (isStart && isEnd) ? 'auto' : (isStart ? 'start' : 'end');
                resize = { edge, noteStart, noteEnd, minStart, maxEnd };
            }
        }

        // Plusieurs notes sélectionnées (Ctrl/Cmd+clic, voir selectSeqNoteAt) ET le geste démarre sur
        // L'UNE d'entre elles : étirer/déplacer TOUTES les notes sélectionnées ensemble, du même nombre
        // de croches (voir onSeqMultiDragMove) — plutôt que de ne toucher que celle sous le doigt.
        // Démarrer sur une note NON sélectionnée retombe sur le comportement habituel (une seule note).
        let multi = null;
        if (wasOn && this.seqSelections.length > 1) {
            const ownSel = this.seqSelections.find(s => s.voice === voice && noteStart === s.start && noteEnd === s.end);
            if (ownSel) {
                const edge = resize ? ((isStart && isEnd) ? 'auto' : (isStart ? 'start' : 'end')) : null;
                multi = {
                    edge,
                    startStep: step,
                    selections: this.seqSelections.map(s => ({ ...s })), // instantané des positions de départ
                    steps: pattern.length,
                    appliedDelta: 0,
                };
            }
        }

        // Ctrl/Cmd enfoncé : le tap (sans glisser) ajoutera/retirera cette note de la sélection au
        // lieu de la remplacer — voir onSeqPointerUp. N'affecte pas le glissé de peinture/effacement.
        // Réutilisé aussi comme repère « copier » pour un changement de voix (voir beginSeqVoiceDrag) :
        // Ctrl/Cmd déjà enfoncé à la prise = copie, sinon déplacement, même convention que la grille.
        this.seqDrag = {
            mode: 'paint', voice, wasOn, startStep: step, lastStep: step, moved: false,
            rowCells: null, touched: {}, additive: e.ctrlKey || e.metaKey,
            resize, resizeChanged: false, crossedThreshold: false, multi,
            curStart: resize ? resize.noteStart : null, curEnd: resize ? resize.noteEnd : null,
            noteEl: null, startX: e.clientX, startY: e.clientY,
            // Bornes de la note sous le doigt (même hors bord, contrairement à resize.noteStart/End
            // ci-dessus qui ne sont posés QUE si le geste a démarré pile sur un bord) : nécessaires
            // pour basculer en changement de voix depuis N'IMPORTE quel point de la note (voir
            // onSeqPointerMove/beginSeqVoiceDrag), pas seulement ses extrémités.
            noteStart, noteEnd,
            // Alt/Option déjà enfoncée à la prise, sur une note existante : un glissé horizontal
            // dominant posera une COPIE plus loin sur la MÊME voix au lieu de rien faire (voir
            // beginSeqDupDrag) — retour utilisateur, geste jusqu'ici sans effet dans ce cas précis
            // (voir le commentaire "d.wasOn) return;" plus bas), donc sans conflit avec l'existant.
            altDuplicate: wasOn && e.altKey,
            gestureDecided: false, voiceDrag: null, dupDrag: null,
        };

        this._onSeqMove = (ev) => this.onSeqPointerMove(ev);
        this._onSeqUp = () => this.onSeqPointerUp();
        window.addEventListener('pointermove', this._onSeqMove, { passive: false });
        window.addEventListener('pointerup', this._onSeqUp);
        window.addEventListener('pointercancel', this._onSeqUp);
    }

    // Amorce une sélection par rectangle (voir onSeqPointerDown) : réutilise les MÊMES écouteurs
    // fenêtre que this.seqDrag (posés ici, pas dans un doublon) — onSeqPointerMove/onSeqPointerUp
    // vérifient this.seqMarquee EN PREMIER et s'y branchent avant de toucher this.seqDrag.
    beginSeqMarqueeSelect(voice, step, e) {
        this.seqMarquee = {
            startVoice: voice, startStep: step, startX: e.clientX, startY: e.clientY,
            curX: e.clientX, curY: e.clientY, moved: false,
            additive: e.ctrlKey || e.metaKey, el: null,
        };
        this._onSeqMove = (ev) => this.onSeqPointerMove(ev);
        this._onSeqUp = () => this.onSeqPointerUp();
        window.addEventListener('pointermove', this._onSeqMove, { passive: false });
        window.addEventListener('pointerup', this._onSeqUp);
        window.addEventListener('pointercancel', this._onSeqUp);
    }

    // Glissé du rectangle de sélection (voir beginSeqMarqueeSelect) : un simple rectangle en pixels
    // (position:fixed), pas calé sur la grille — au contraire du fantôme de duplication (voir
    // beginSeqDupDrag), il n'a pas besoin de suivre une case précise, seule sa FORME compte pour
    // savoir quelles notes il touche. Chaque note dont le rectangle DOM (getBoundingClientRect)
    // chevauche celui du rectangle reçoit une classe transitoire (.marquee-hit) en retour visuel
    // immédiat ; la sélection réelle (this.seqSelections) n'est posée qu'au relâchement.
    onSeqMarqueeMove(e) {
        const m = this.seqMarquee;
        if (!m.moved) {
            const dx = e.clientX - m.startX, dy = e.clientY - m.startY;
            if (Math.hypot(dx, dy) < 10) return; // seuil, comme les autres gestes séquenceur
            m.moved = true;
            m.el = document.createElement('div');
            m.el.className = 'seq-marquee-rect';
            document.body.appendChild(m.el);
        }
        e.preventDefault();
        m.curX = e.clientX; m.curY = e.clientY;
        const x1 = Math.min(m.startX, m.curX), x2 = Math.max(m.startX, m.curX);
        const y1 = Math.min(m.startY, m.curY), y2 = Math.max(m.startY, m.curY);
        m.el.style.left = `${x1}px`;
        m.el.style.top = `${y1}px`;
        m.el.style.width = `${x2 - x1}px`;
        m.el.style.height = `${y2 - y1}px`;

        document.querySelectorAll('.seq-note').forEach(note => {
            const r = note.getBoundingClientRect();
            const hit = r.left < x2 && r.right > x1 && r.top < y2 && r.bottom > y1;
            note.classList.toggle('marquee-hit', hit);
        });
    }

    // Relâchement du rectangle (voir onSeqPointerUp) : les notes actuellement en surbrillance
    // (.marquee-hit, posée en direct par onSeqMarqueeMove) deviennent la sélection réelle — remplacée
    // si Ctrl/Cmd n'était pas enfoncé à la prise, sinon ajoutée à celle déjà en place (même convention
    // que Ctrl+clic sur une seule note, voir selectSeqNoteAt). Un simple Maj+clic SANS glisser ne
    // sélectionne rien de spécial (repart de la sélection existante, vidée si pas additive).
    finalizeSeqMarqueeSelect() {
        const m = this.seqMarquee;
        this.seqMarquee = null;
        if (!m.moved) {
            if (!m.additive) this.seqSelections = [];
            this.renderSequencer();
            return;
        }
        if (m.el) m.el.remove();
        const hits = [];
        document.querySelectorAll('.seq-note.marquee-hit').forEach(note => {
            hits.push({ voice: +note.dataset.voice, start: +note.dataset.start, end: +note.dataset.end });
            note.classList.remove('marquee-hit');
        });
        if (!m.additive) {
            this.seqSelections = hits;
        } else {
            hits.forEach(h => {
                if (!this.seqSelections.some(s => s.voice === h.voice && s.start === h.start && s.end === h.end)) {
                    this.seqSelections.push(h);
                }
            });
        }
        this.renderSequencer();
    }

    // Bornes dans lesquelles une note peut être étirée sans empiéter sur la note voisine de LA MÊME
    // voix (celle qu'on redimensionne étant elle-même exclue du calcul, puisqu'on cherche la première
    // croche occupée au-delà de ses propres bornes actuelles, dans chaque direction).
    seqNeighborBounds(pattern, voice, start, end) {
        let minStart = 0;
        for (let s = start - 1; s >= 0; s--) {
            if (pattern[s].includes(voice)) { minStart = s + 1; break; }
        }
        let maxEnd = pattern.length - 1;
        for (let s = end + 1; s < pattern.length; s++) {
            if (pattern[s].includes(voice)) { maxEnd = s - 1; break; }
        }
        return { minStart, maxEnd };
    }

    // Retrouve la croche survolée par une recherche géométrique dans la voix d'origine, plutôt qu'un
    // elementFromPoint strict : une souris/un doigt qui dérive légèrement dans un interstice (gap entre
    // cases, bordure...) ne doit pas interrompre le glissé — c'est ce qui rendait l'étirement peu fiable.
    findSeqStepAt(d, clientX, clientY) {
        if (!d.rowCells) {
            d.rowCells = Array.from(document.querySelectorAll(`.seq-cell[data-voice="${d.voice}"]`))
                .map(el => ({ step: +el.dataset.step, rect: el.getBoundingClientRect() }));
        }
        let best = null, bestDist = Infinity;
        for (const c of d.rowCells) {
            if (clientY < c.rect.top - 40 || clientY > c.rect.bottom + 40) continue; // hors de cette ligne
            const dist = clientX < c.rect.left ? c.rect.left - clientX : (clientX > c.rect.right ? clientX - c.rect.right : 0);
            if (dist < bestDist) { bestDist = dist; best = c; }
        }
        return best ? best.step : null;
    }

    // Défilement automatique de la bande séquenceur (voir renderSequencer, wideCompact/continu)
    // pendant peindre/étirer/déplacer/dupliquer une note, dès que le pointeur approche du bord gauche
    // ou droit de .seq-scroll (retour utilisateur : sinon impossible d'étirer une note jusque sur la
    // mesure suivante sans d'abord zoomer arrière pour la voir). `d.scrollEl` mis en cache sur le
    // geste (comme d.rowCells), retrouvé une seule fois. N'agit que s'il y a réellement de quoi
    // défiler : sans effet en dehors de wideCompact/continu (page qui tient déjà entière).
    _updateSeqAutoScroll(d) {
        if (d.scrollEl === undefined) d.scrollEl = document.querySelector('#arp-sequencer .seq-scroll');
        const el = d.scrollEl;
        if (!el || el.scrollWidth <= el.clientWidth + 1) { this._stopSeqAutoScroll(d); return; }
        const rect = el.getBoundingClientRect();
        const EDGE = 36, MAX_SPEED = 16;
        const x = d._lastClientX;
        let dir = 0, dist = 0;
        if (x < rect.left + EDGE) { dir = -1; dist = (rect.left + EDGE) - x; }
        else if (x > rect.right - EDGE) { dir = 1; dist = x - (rect.right - EDGE); }
        const atStart = el.scrollLeft <= 0;
        const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
        if (dir === 0 || (dir < 0 && atStart) || (dir > 0 && atEnd)) { this._stopSeqAutoScroll(d); return; }
        d._autoScrollDir = dir;
        d._autoScrollSpeed = Math.min(MAX_SPEED, 4 + dist * 0.35);
        if (!d._autoScrollRAF) this._runSeqAutoScrollTick(d);
    }

    _stopSeqAutoScroll(d) {
        if (d._autoScrollRAF) { cancelAnimationFrame(d._autoScrollRAF); d._autoScrollRAF = null; }
    }

    // Ancêtre RÉELLEMENT défilant verticalement autour de #arp-sequencer, retrouvé en remontant le DOM
    // plutôt que ciblé par id fixe : #arp-sequencer se déplace entre plusieurs hôtes sans être dupliqué
    // (panneau compact -> .panel-controls, loupe séquenceur -> #seq-zoom-host, loupe grille épinglée ->
    // #grid-zoom-pinned-body, voir openSeqZoom/pinSequencerHost), chacun son propre ancêtre défilant.
    // Utilisé pour reproduire en JS le défilement vertical qu'un doigt sur une case faisait avant
    // nativement (voir .seq-cell/touch-action:none en CSS, retiré pour laisser le pan à 2 doigts, voir
    // setupPinchZoom, garder un contrôle fiable sur cet axe aussi).
    _scrollableSeqAncestor() {
        let el = document.getElementById('arp-sequencer');
        while (el && el !== document.body) {
            el = el.parentElement;
            if (!el) break;
            const style = getComputedStyle(el);
            if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
                return el;
            }
        }
        // Aucun ancêtre en overflow-y:auto trouvé avant le <body> : c'est la PAGE elle-même qui défile
        // (mise en page mobile — .panel-controls ne devient son propre conteneur défilant qu'à partir
        // de 900px, voir style.css) — scrollingElement (<html>, ou <body> en quirks mode) est alors le
        // bon repli, avec le même scrollTop assignable que n'importe quel autre conteneur défilant.
        const page = document.scrollingElement || document.documentElement;
        if (page && page.scrollHeight > page.clientHeight) return page;
        return null;
    }

    // Met en évidence, dans la ligne de temps sous la grille (voir renderSequencer/.seq-beat-label),
    // le chiffre du temps JUSTE ATTEINT par un étirement/peindre/étirement multiple en cours — retour
    // utilisateur : "je ne vois pas exactement où est le temps 4" pendant un glissé. `step` peut être
    // null pour tout éteindre (fin/annulation du geste, voir onSeqPointerUp/cancelSeqGestureForPinch).
    // Un seul chiffre allumé à la fois (pas de traînée) : le repère le plus lisible reste "où j'en
    // suis maintenant", pas l'historique du geste.
    _highlightSeqBeatLabel(step) {
        const prev = document.querySelector('.seq-beat-label.seq-beat-reached');
        if (prev) prev.classList.remove('seq-beat-reached');
        if (step == null) return;
        const beatIndex = Math.floor(step / SEQ_STEPS_PER_BEAT);
        const label = document.querySelector(`.seq-beat-label[data-beat-index="${beatIndex}"]`);
        if (label) label.classList.add('seq-beat-reached');
    }

    // Avance le défilement d'un cran et REJOUE le geste en cours à la même position écran : le
    // contenu a bougé dessous, donc la croche visée change même si le doigt/la souris, eux, n'ont pas
    // bougé pendant que la vue défile — sans ce rejeu, rien ne suivrait tant qu'un vrai mouvement du
    // pointeur ne serait pas détecté. d.rowCells invalidé À CHAQUE défilement : ses rects mis en cache
    // (voir findSeqStepAt) deviennent faux dès que .seq-scroll bouge sous eux.
    _runSeqAutoScrollTick(d) {
        if (this.seqDrag !== d) { this._stopSeqAutoScroll(d); return; } // le geste s'est terminé entretemps
        const el = d.scrollEl;
        el.scrollLeft += d._autoScrollDir * d._autoScrollSpeed;
        d.rowCells = null;
        const fakeEvent = { clientX: d._lastClientX, clientY: d._lastClientY, preventDefault() {} };
        d._autoScrollRAF = requestAnimationFrame(() => {
            d._autoScrollRAF = null;
            this.onSeqPointerMove(fakeEvent);
        });
    }

    // Mémorise l'état d'origine (avant ce glissé) d'une croche la première fois qu'elle est touchée,
    // pour pouvoir la restaurer fidèlement si le geste revient en arrière et la sort de la plage.
    rememberSeqOriginalState(d, step) {
        if (d.touched[step]) return;
        const chord = this.readChord();
        const { pattern, tie } = this.getLiveSeqPattern(chord);
        d.touched[step] = { on: pattern[step].includes(d.voice), tied: tie[step].includes(d.voice) };
    }

    onSeqPointerMove(e) {
        if (this.seqMarquee) { this.onSeqMarqueeMove(e); return; }
        const d = this.seqDrag;
        if (!d) return;

        // Défilement automatique près du bord gauche/droit (voir _updateSeqAutoScroll) : posé tout en
        // haut, avant même le routage ci-dessous, pour couvrir peindre/étirer/déplacer/dupliquer d'un
        // même geste — retour utilisateur, un accord qui déborde d'une page (voir wideCompact dans
        // renderSequencer) ne doit plus obliger à zoomer arrière pour étirer une note jusque sur la
        // mesure suivante : glisser jusqu'au bord suffit désormais, la vue défile toute seule.
        d._lastClientX = e.clientX;
        d._lastClientY = e.clientY;
        this._updateSeqAutoScroll(d);

        // Défilement vertical à UN SEUL doigt (voir .seq-cell/touch-action:none en CSS — retiré pour
        // laisser le pan à 2 doigts, voir setupPinchZoom, garder la main de façon fiable) : décidé une
        // seule fois, au tout premier vrai mouvement de CE geste, UNIQUEMENT pour étirer (d.resize) et
        // peindre sur une case vide (!d.wasOn) — les deux seuls cas qui n'avaient pas déjà un sens pour
        // une dominante verticale. Un geste démarré sur le CORPS d'une note existante garde le SIEN
        // (changer de voix, voir juste plus bas), jamais détourné vers un défilement.
        if (!d.axisDecided && (d.resize || !d.wasOn)) {
            const dx0 = e.clientX - d.startX, dy0 = e.clientY - d.startY;
            if (Math.hypot(dx0, dy0) < 10) return;
            d.axisDecided = true;
            if (Math.abs(dy0) > Math.abs(dx0)) { d.verticalScroll = true; d._vScrollLastY = e.clientY; }
        }
        if (d.verticalScroll) {
            const dy = e.clientY - d._vScrollLastY;
            d._vScrollLastY = e.clientY;
            const target = this._scrollableSeqAncestor();
            if (target) target.scrollTop -= dy;
            e.preventDefault();
            return;
        }

        // Démarré SUR une note déjà posée, hors sélection multiple : le sens du tout premier vrai
        // mouvement (seuil commun aux autres gestes séquenceur) décide si ce glissé change de VOIX —
        // la barre suit le pointeur vers une autre ligne, copiée/déplacée selon Ctrl/Cmd, voir
        // beginSeqVoiceDrag — ou reste sur la même ligne (étirement depuis un bord, effacement en
        // glissant depuis le corps : comportement historique, inchangé). Dominante verticale = change
        // de voix ; horizontale ET Alt déjà enfoncée à la prise = duplication sur la même ligne (voir
        // beginSeqDupDrag) ; horizontale sans Alt = comportement habituel — décidé une seule fois
        // pour tout le geste, comme le changement de voix.
        if (d.wasOn && !d.multi && !d.gestureDecided) {
            const dx0 = e.clientX - d.startX, dy0 = e.clientY - d.startY;
            if (Math.hypot(dx0, dy0) < 10) return;
            d.gestureDecided = true;
            if (Math.abs(dy0) > Math.abs(dx0)) this.beginSeqVoiceDrag(d);
            else if (d.altDuplicate) this.beginSeqDupDrag(d);
        }
        if (d.voiceDrag) { this.onSeqVoiceDragMove(e, d); return; }
        if (d.dupDrag) { this.onSeqDupDragMove(e, d); return; }

        if (d.multi) { this.onSeqMultiDragMove(e, d); return; }
        if (d.resize) { this.onSeqResizeMove(e, d); return; }

        // Démarré au MILIEU d'une note existante (ni un bord — sinon d.resize serait posé, voir
        // onSeqPointerDown — ni un changement de voix, déjà écarté juste au-dessus) : n'efface plus
        // rien du tout (retour utilisateur : glisser depuis le corps d'une note la scindait en deux
        // par accident trop souvent, sans le vouloir). Pour raccourcir une note, glisser depuis SON
        // BORD (voir onSeqResizeMove juste au-dessus) ; pour en reposer une nouvelle juste après,
        // peindre sur une case vide comme d'habitude — un simple tap, lui, continue de sélectionner
        // normalement (voir onSeqPointerUp), rien ne change de ce côté.
        if (d.wasOn) return;

        // Même garde-fou que pour le redimensionnement (voir onSeqResizeMove) : sans lui, le moindre
        // tremblement de souris/doigt au clic — surtout sur des cases étroites — peut franchir la
        // case voisine et être lu comme un glissé, ce qui écrase la sélection au lieu de simplement
        // sélectionner/Ctrl+sélectionner (peindre une note neuve, elle, part toujours d'une case vide).
        if (!d.crossedThreshold) {
            const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
            if (Math.hypot(dx, dy) < 10) return;
            d.crossedThreshold = true;
        }

        const step = this.findSeqStepAt(d, e.clientX, e.clientY);
        if (step == null) return;
        // Retour utilisateur : "je ne vois pas exactement où est le temps 4" pendant un glissé — voir
        // le même repère sur onSeqResizeMove ; ici avant le "pas bougé depuis, rien à faire" pour
        // rester à jour même si on revient pile sur le même pas (le repère ne doit jamais rester figé
        // sur une valeur périmée pendant qu'on hésite/ajuste).
        this._highlightSeqBeatLabel(step);
        if (step === d.lastStep && d.moved) return;

        e.preventDefault(); // glissé horizontal reconnu -> on empêche le scroll de page de le voler
        this.pushSeqUndo(); // un seul instantané pour tout le glissé, pas un par croche traversée
        d.moved = true;

        // Le point de départ décide : geste commencé sur une case éteinte -> on peint (note tenue,
        // liée à partir de la 2e croche parcourue) ; commencé sur une case allumée -> on efface.
        const paintOn = !d.wasOn;
        const newFrom = Math.min(step, d.startStep), newTo = Math.max(step, d.startStep);

        // Toujours un nouvel appui, MÊME juste à côté d'une note déjà là (jamais fusionnée avec elle,
        // retour utilisateur : garder deux appuis séparés plutôt qu'une seule note liée) — un geste qui
        // veut au contraire ÉTENDRE une note existante part de son propre bord (voir onSeqResizeMove),
        // pas d'une case vide adjacente.
        // Aller-retour du geste : restaure hors de la nouvelle plage les croches déjà modifiées
        if (d.rangeFrom != null) {
            for (let s = d.rangeFrom; s <= d.rangeTo; s++) {
                if (s < newFrom || s > newTo) {
                    const orig = d.touched[s];
                    this.applySeqCell(d.voice, s, orig.on, orig.tied);
                }
            }
        }
        for (let s = newFrom; s <= newTo; s++) {
            this.rememberSeqOriginalState(d, s);
            this.applySeqCell(d.voice, s, paintOn, paintOn && s !== newFrom);
        }
        d.rangeFrom = newFrom;
        d.rangeTo = newTo;
        d.lastStep = step;
    }

    // Glissé démarré sur le bord d'une note existante (ou son unique croche) : étend/raccourcit
    // depuis ce bord, sans jamais empiéter sur la note voisine de la même voix (bornes calculées une
    // seule fois à la prise, cf. seqNeighborBounds). Un simple clic sans glisser réel ne modifie
    // jamais rien : onSeqPointerUp retombe alors sur le comportement de sélection habituel.
    onSeqResizeMove(e, d) {
        // Seuil avant de considérer que c'est un vrai glissé (et non un simple tap pour sélectionner) :
        // le moindre tremblement au clic/toucher (souris, trackpad, doigt) ne doit jamais être lu
        // comme une intention de modifier. Tant que ce seuil n'est pas franchi, on ne touche à rien.
        if (!d.crossedThreshold) {
            const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
            if (Math.hypot(dx, dy) < 10) return;
            d.crossedThreshold = true;
        }

        const step = this.findSeqStepAt(d, e.clientX, e.clientY);
        if (step == null) return;

        // Note d'une seule croche : le sens du tout premier mouvement décide quel bord on manipule
        if (d.resize.edge === 'auto') {
            if (step > d.resize.noteStart) d.resize.edge = 'end';
            else if (step < d.resize.noteStart) d.resize.edge = 'start';
            else return; // toujours sur la même case : direction pas encore déterminée
        }

        let newStart = d.curStart, newEnd = d.curEnd;
        if (d.resize.edge === 'end') {
            newEnd = Math.max(d.resize.noteStart, Math.min(step, d.resize.maxEnd));
        } else {
            newStart = Math.min(d.resize.noteEnd, Math.max(step, d.resize.minStart));
        }
        // Retour utilisateur : "je ne vois pas exactement où est le temps 4" pendant un glissé — le
        // bord qui bouge réellement (borné par minStart/maxEnd, pas le doigt brut) décide du temps
        // mis en évidence, avant même de savoir si ce mouvement change quoi que ce soit de plus.
        this._highlightSeqBeatLabel(d.resize.edge === 'end' ? newEnd : newStart);
        if (newStart === d.curStart && newEnd === d.curEnd) return;

        e.preventDefault();
        if (!d.resizeChanged) {
            this.pushSeqUndo(); // un seul instantané pour tout le glissé de redimensionnement
            // Repère l'élément visuel de la note pour l'étirer en direct pendant le glissé
            d.noteEl = document.querySelector(
                `.seq-note[data-voice="${d.voice}"][data-start="${d.resize.noteStart}"][data-end="${d.resize.noteEnd}"]`
            );
        }
        d.resizeChanged = true;

        // Réapplique toute la plage traversée par ce geste : les croches désormais hors [newStart,
        // newEnd] s'éteignent, celles qui y entrent s'allument (liées entre elles, sauf la toute
        // première = attaque). Un seul passage suffit même en cas d'aller-retour du pointeur.
        const lo = Math.min(d.curStart, newStart, d.resize.noteStart);
        const hi = Math.max(d.curEnd, newEnd, d.resize.noteEnd);
        for (let s = lo; s <= hi; s++) {
            const within = s >= newStart && s <= newEnd;
            this.applySeqCell(d.voice, s, within, within && s !== newStart);
        }
        d.curStart = newStart;
        d.curEnd = newEnd;

        // Étire/déplace la pilule visuelle EN DIRECT, sans attendre le renderSequencer() final
        // (les cases en dessous, elles, sont déjà mises à jour case par case via applySeqCell ci-dessus)
        if (d.noteEl) {
            d.noteEl.style.gridColumn = `${newStart + 2} / span ${newEnd - newStart + 1}`;
            d.noteEl.style.marginRight = (newEnd % 2 === 1) ? '4px' : '0';
        }
    }

    // Bornes du décalage (en croches, un seul delta partagé par toutes les notes) qui gardent CHAQUE
    // note de `selections` dans la grille et loin de toute case occupée qui ne fait PAS partie de la
    // sélection — les autres notes sélectionnées, qui se décalent avec elle, ne comptent jamais comme
    // un obstacle. `edge` : null (déplacement, les deux bords bougent) | 'start' | 'end' (étirement,
    // un seul bord bouge, l'autre reste fixe). Voir onSeqMultiDragMove.
    computeMultiDragDeltaBounds(selections, steps, edge) {
        const chord = this.readChord();
        const { pattern } = this.getLiveSeqPattern(chord);
        const isOwn = (voice, s) => selections.some(sel => sel.voice === voice && s >= sel.start && s <= sel.end);
        let minDelta = -Infinity, maxDelta = Infinity;
        selections.forEach(sel => {
            let lowBound = 0;
            for (let s = sel.start - 1; s >= 0; s--) {
                if (pattern[s].includes(sel.voice) && !isOwn(sel.voice, s)) { lowBound = s + 1; break; }
            }
            let highBound = steps - 1;
            for (let s = sel.end + 1; s < steps; s++) {
                if (pattern[s].includes(sel.voice) && !isOwn(sel.voice, s)) { highBound = s - 1; break; }
            }
            if (edge === 'end') {
                minDelta = Math.max(minDelta, sel.start - sel.end); // jamais moins d'une croche
                maxDelta = Math.min(maxDelta, highBound - sel.end);
            } else if (edge === 'start') {
                minDelta = Math.max(minDelta, lowBound - sel.start);
                maxDelta = Math.min(maxDelta, sel.end - sel.start); // jamais moins d'une croche
            } else {
                minDelta = Math.max(minDelta, lowBound - sel.start);
                maxDelta = Math.min(maxDelta, highBound - sel.end);
            }
        });
        if (minDelta > maxDelta) { minDelta = 0; maxDelta = 0; }
        return { minDelta, maxDelta };
    }

    // Glissé démarré sur l'une des notes d'une sélection multiple (voir onSeqPointerDown) : étire
    // (depuis le bord touché) ou déplace (depuis le corps de la note) TOUTES les notes sélectionnées
    // du MÊME nombre de croches à la fois — jamais une seule, contrairement au glissé habituel.
    onSeqMultiDragMove(e, d) {
        if (!d.crossedThreshold) {
            const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
            if (Math.hypot(dx, dy) < 10) return;
            d.crossedThreshold = true;
        }

        const m = d.multi;
        const step0 = this.findSeqStepAt(d, e.clientX, e.clientY);
        if (step0 == null) return;
        // Retour utilisateur : "je ne vois pas exactement où est le temps 4" pendant un glissé — voir
        // le même repère sur onSeqResizeMove/la queue "peindre" ; basé sur le pas sous le doigt, pas
        // sur la position finale (bornée) de chaque note, qui peut différer d'une sélection à l'autre.
        this._highlightSeqBeatLabel(step0);
        // Note d'une seule croche démarrée en 'auto' : le sens du tout premier mouvement décide du bord
        if (m.edge === 'auto') {
            if (step0 > m.startStep) m.edge = 'end';
            else if (step0 < m.startStep) m.edge = 'start';
            else return;
        }

        const { minDelta, maxDelta } = this.computeMultiDragDeltaBounds(m.selections, m.steps, m.edge);
        let delta = step0 - m.startStep;
        delta = Math.max(minDelta, Math.min(maxDelta, delta));
        if (delta === m.appliedDelta && d.moved) return;

        e.preventDefault();
        if (!d.moved) this.pushSeqUndo(); // un seul instantané pour tout le glissé, quel que soit le nombre de notes
        d.moved = true;

        // Repeint chaque note sélectionnée à sa nouvelle position — toujours calculée depuis sa
        // position de DÉPART (m.selections) et le delta actuel/précédent, jamais de façon incrémentale :
        // un aller-retour du pointeur revient ainsi exactement sur ses pas, sans croche orpheline.
        // edge === null (déplacement) : les DEUX bords suivent le delta. edge === 'start'/'end' :
        // seul ce bord-là bouge, l'autre reste fixe (étirement).
        const movesStart = m.edge === 'start' || m.edge === null;
        const movesEnd = m.edge === 'end' || m.edge === null;
        m.selections.forEach(sel => {
            const newStart = movesStart ? sel.start + delta : sel.start;
            const newEnd = movesEnd ? sel.end + delta : sel.end;
            const prevStart = movesStart ? sel.start + m.appliedDelta : sel.start;
            const prevEnd = movesEnd ? sel.end + m.appliedDelta : sel.end;
            const lo = Math.min(prevStart, newStart);
            const hi = Math.max(prevEnd, newEnd);
            for (let s = lo; s <= hi; s++) {
                const within = s >= newStart && s <= newEnd;
                this.applySeqCell(sel.voice, s, within, within && s !== newStart);
            }
        });
        m.appliedDelta = delta;
    }

    // Bascule un glissé démarré sur une note déjà posée (n'importe où dessus, pas juste un bord) en
    // changement de VOIX (retour utilisateur : recopier/décaler un motif de jeu — ex. 2 croches
    // staccato — d'une ligne à l'autre) : la note quitte visuellement sa ligne pour suivre le
    // pointeur (fantôme flottant), jusqu'au dépôt (voir onSeqVoiceDragMove/finalizeSeqVoiceDrag).
    // N'affecte QUE l'affichage tant qu'on n'a pas relâché — rien n'est peint avant.
    beginSeqVoiceDrag(d) {
        const noteEl = document.querySelector(
            `.seq-note[data-voice="${d.voice}"][data-start="${d.noteStart}"][data-end="${d.noteEnd}"]`
        );
        if (!noteEl) return; // page/scroll a changé entretemps : abandonne, reste un glissé "même ligne"
        this.pushSeqUndo(); // un seul instantané pour tout le geste, comme les autres gestes séquenceur
        const rect = noteEl.getBoundingClientRect();
        const ghost = noteEl.cloneNode(true);
        ghost.className = noteEl.className.replace(/\bclip-(start|end)\b/g, '').trim(); // forme pleine, jamais coupée, une fois flottante
        ghost.classList.add('seq-note-ghost');
        ghost.style.gridColumn = '';
        ghost.style.gridRow = '';
        ghost.style.marginRight = '';
        ghost.style.left = `${rect.left}px`;
        ghost.style.top = `${rect.top}px`;
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        document.body.appendChild(ghost);
        noteEl.style.visibility = 'hidden'; // l'original reste en place (annulation = rien à refaire) tant qu'on ne relâche pas
        d.voiceDrag = {
            origVoice: d.voice, start: d.noteStart, end: d.noteEnd,
            targetVoice: d.voice, copy: d.additive,
            ghost, noteEl,
            offsetX: d.startX - rect.left, offsetY: d.startY - rect.top,
        };
    }

    // Fantôme flottant recoloré selon la voix survolée (voir beginSeqVoiceDrag) : `.seq-cell` étant
    // la seule case sous le pointeur (les notes elles-mêmes ont pointer-events:none, voir
    // renderSequencer), elementFromPoint donne directement la voix survolée sans détour.
    onSeqVoiceDragMove(e, d) {
        e.preventDefault();
        const vd = d.voiceDrag;
        vd.ghost.style.left = `${e.clientX - vd.offsetX}px`;
        vd.ghost.style.top = `${e.clientY - vd.offsetY}px`;

        const under = document.elementFromPoint(e.clientX, e.clientY);
        const cell = under && under.closest ? under.closest('.seq-cell') : null;
        const targetVoice = cell ? +cell.dataset.voice : null;
        if (targetVoice === vd.targetVoice) return;
        vd.targetVoice = targetVoice;
        vd.ghost.classList.toggle('seq-note-ghost-invalid', targetVoice == null);
        if (targetVoice != null) {
            const chord = this.readChord();
            const midis = chord.getSeqMidiNotes();
            const role = chord.getRoleMap()[midis[targetVoice]] || 'ext';
            vd.ghost.className = vd.ghost.className.replace(/\brole-\S+/g, '').trim() + ` role-${role}`;
        }
    }

    // Éteint entièrement toute note déjà présente sur `voice` qui chevauche (même partiellement) la
    // plage [start, end] — étendue jusqu'aux bords RÉELS de chaque note trouvée (même logique que
    // seqNeighborBounds/onSeqPointerDown), pas seulement la portion qui déborde. Sans ça, déposer une
    // note par-dessus une autre plus longue laisserait un fragment de l'ancienne accroché de part et
    // d'autre — voir finalizeSeqVoiceDrag.
    clearSeqRunsOverlapping(voice, start, end) {
        const chord = this.readChord();
        const { pattern, tie } = this.getLiveSeqPattern(chord);
        let lo = null, hi = null;
        for (let s = start; s <= end; s++) {
            if (!pattern[s].includes(voice)) continue;
            let a = s, b = s;
            while (a > 0 && pattern[a - 1].includes(voice) && tie[a].includes(voice)) a--;
            while (b + 1 < pattern.length && pattern[b + 1].includes(voice) && tie[b + 1].includes(voice)) b++;
            lo = lo == null ? a : Math.min(lo, a);
            hi = hi == null ? b : Math.max(hi, b);
        }
        if (lo == null) return;
        for (let s = lo; s <= hi; s++) this.applySeqCell(voice, s, false);
    }

    // Dépôt d'un changement de voix (voir beginSeqVoiceDrag/onSeqVoiceDragMove) : peint le même motif
    // (attaque + tenue, positions temporelles inchangées) sur la voix cible, puis efface l'original
    // SEULEMENT si ce n'est pas une copie (Ctrl/Cmd déjà enfoncé à la prise, voir d.additive) — sinon
    // les deux lignes jouent désormais le même motif.
    finalizeSeqVoiceDrag(d) {
        const vd = d.voiceDrag;
        vd.ghost.remove();
        if (vd.noteEl) vd.noteEl.style.visibility = '';

        if (vd.targetVoice == null || vd.targetVoice === vd.origVoice) {
            // Déposé hors grille, ou revenu sur sa ligne d'origine : rien à changer.
            this.renderSequencer();
            return;
        }

        const { start, end, origVoice, targetVoice, copy } = vd;
        this.clearSeqRunsOverlapping(targetVoice, start, end);
        for (let s = start; s <= end; s++) this.applySeqCell(targetVoice, s, true, s !== start);
        if (!copy) for (let s = start; s <= end; s++) this.applySeqCell(origVoice, s, false);

        this.seqTouched = true;
        this.seqSelections = [{ voice: targetVoice, start, end }];
        this.renderSequencer();
        this.livePreviewUpdate();
    }

    // Bascule un glissé démarré sur le CORPS d'une note (Alt/Option déjà enfoncée à la prise, voir
    // onSeqPointerDown) en duplication horizontale : une copie fantôme (contour en pointillés, voir
    // .seq-note-dup-ghost) suit le pointeur sur LA MÊME voix, calée sur la grille — l'originale reste
    // affichée et inchangée jusqu'au dépôt (voir onSeqDupDragMove/finalizeSeqDupDrag). Contrairement au
    // changement de voix (beginSeqVoiceDrag), pas besoin de masquer l'original : rien ne le déplace.
    beginSeqDupDrag(d) {
        const noteEl = document.querySelector(
            `.seq-note[data-voice="${d.voice}"][data-start="${d.noteStart}"][data-end="${d.noteEnd}"]`
        );
        if (!noteEl) return; // page/scroll a changé entretemps : abandonne, reste un glissé "sur place"
        this.pushSeqUndo(); // un seul instantané pour tout le geste, comme les autres gestes séquenceur
        const ghost = noteEl.cloneNode(true);
        ghost.classList.add('seq-note-dup-ghost');
        ghost.removeAttribute('data-start'); // pas encore une vraie note posée
        ghost.removeAttribute('data-end');
        noteEl.insertAdjacentElement('afterend', ghost); // même grille CSS que l'original (grid-row/column)
        // Repart de la colonne EXACTE déjà affichée (aucune reformulation du calcul page/décalage,
        // voir renderSequencer) : seul le premier nombre ("N / span L") bougera avec le glissé.
        const [colStart] = noteEl.style.gridColumn.split('/').map(s => s.trim());
        d.dupDrag = {
            voice: d.voice, origStart: d.noteStart, origEnd: d.noteEnd,
            colStart: parseInt(colStart, 10), ghost, appliedDelta: 0,
        };
    }

    // Fantôme de duplication (voir beginSeqDupDrag) : suit le glissé horizontalement, calé sur la
    // grille (jamais entre deux cases) et borné à la page actuellement affichée (mêmes limites que
    // findSeqStepAt, qui ne connaît que les cases réellement visibles) — et ne peut jamais chevaucher
    // l'originale elle-même (sinon dupliquer une note reviendrait à en effacer un bout, voir
    // clearSeqRunsOverlapping/finalizeSeqDupDrag) : la zone de chevauchement se traverse sans que le
    // fantôme n'y bouge, comme une résistance, jusqu'à en ressortir de l'autre côté.
    onSeqDupDragMove(e, d) {
        if (!d.crossedThreshold) {
            const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
            if (Math.hypot(dx, dy) < 10) return;
            d.crossedThreshold = true;
        }
        const step0 = this.findSeqStepAt(d, e.clientX, e.clientY);
        if (step0 == null) return;

        const dd = d.dupDrag;
        const visibleSteps = d.rowCells.map(c => c.step);
        const minVisible = Math.min(...visibleSteps), maxVisible = Math.max(...visibleSteps);
        const len = dd.origEnd - dd.origStart + 1;
        let delta = step0 - d.startStep;
        delta = Math.max(minVisible - dd.origStart, Math.min(maxVisible - dd.origEnd, delta));
        if (delta !== 0 && Math.abs(delta) < len) delta = dd.appliedDelta; // zone de chevauchement : ignore
        if (delta === dd.appliedDelta && d.moved) return;

        e.preventDefault();
        d.moved = true;
        dd.appliedDelta = delta;
        dd.ghost.style.gridColumn = `${dd.colStart + delta} / span ${len}`;
    }

    // Dépôt d'une duplication (voir beginSeqDupDrag/onSeqDupDragMove) : si le fantôme a bien bougé
    // (appliedDelta non nul), peint une COPIE du même motif (attaque + tenue, positions inchangées à
    // l'offset près) à sa nouvelle position sur la MÊME voix — l'originale, elle, n'est jamais touchée
    // (voir finalizeSeqVoiceDrag pour le changement de voix, qui lui peut effacer l'originale).
    finalizeSeqDupDrag(d) {
        const dd = d.dupDrag;
        dd.ghost.remove();
        if (!d.moved || dd.appliedDelta === 0) {
            // Jamais vraiment glissé (ou revenu pile sur l'originale) : rien à dupliquer.
            this.renderSequencer();
            return;
        }

        const newStart = dd.origStart + dd.appliedDelta, newEnd = dd.origEnd + dd.appliedDelta;
        this.clearSeqRunsOverlapping(dd.voice, newStart, newEnd);
        for (let s = newStart; s <= newEnd; s++) this.applySeqCell(dd.voice, s, true, s !== newStart);

        this.seqTouched = true;
        this.seqSelections = [{ voice: dd.voice, start: newStart, end: newEnd }];
        this.renderSequencer();
        this.livePreviewUpdate();
    }

    // Abandonne le glisser/rectangle en cours SANS le finaliser (contrairement à onSeqPointerUp, qui
    // sélectionne/peint une note isolée pour un simple tap) — voir onSeqPointerDown, appelé quand un
    // second doigt se pose pendant qu'un pincer-zoomer démarre. Restaure les croches déjà peintes par
    // ce début de glissé (voir rememberSeqOriginalState/d.touched) si le geste avait déjà bougé ; sinon
    // (cas le plus courant : les deux doigts d'une pince se posent avant tout mouvement réel) il n'y a
    // rien à défaire — et surtout PAS de renderSequencer() dans ce cas : reconstruire les .seq-cell
    // ici détacherait du DOM celle qu'un doigt tactile a implicitement capturée (voir spec Pointer
    // Events), coupant net la réception de ses pointermove/pointerup suivants — cassant justement le
    // pincer-zoomer qu'on cherche à laisser continuer tranquillement.
    cancelSeqGestureForPinch() {
        window.removeEventListener('pointermove', this._onSeqMove);
        window.removeEventListener('pointerup', this._onSeqUp);
        window.removeEventListener('pointercancel', this._onSeqUp);
        const d = this.seqDrag;
        this.seqDrag = null;
        if (d) this._stopSeqAutoScroll(d);
        this._highlightSeqBeatLabel(null); // éteint le repère de temps (voir onSeqResizeMove/paint), geste annulé
        let painted = false;
        // Restaure EXACTEMENT l'état d'avant ce début de geste, quel que soit son type — un 2e doigt
        // qui se pose (typiquement pour le pan à 2 doigts, voir setupPinchZoom) peut survenir APRÈS
        // que le 1er doigt a déjà légèrement bougé (les deux doigts d'une vraie pince ne se posent
        // jamais parfaitement en même temps) : sans un rattrapage complet ici, ce tout petit geste
        // resterait appliqué à moitié — une note laissée dans un état intermédiaire incohérent avec
        // les autres voix du même accord (retour utilisateur : bug visible après un geste à 2 doigts).
        if (d) {
            // d.moved N'EST posé que par la queue "peindre" et onSeqMultiDragMove — jamais par
            // onSeqResizeMove, qui a son PROPRE indicateur (d.resizeChanged) : chaque branche vérifie
            // donc la sienne, plutôt qu'un seul garde-fou commun qui aurait sauté le redimensionnement.
            if (d.moved && d.touched && !d.resize && !d.multi && !d.voiceDrag && !d.dupDrag) {
                // Peindre/effacer (voir onSeqPointerMove, queue "paint") : chaque croche touchée est
                // déjà mémorisée avant sa toute première modification.
                Object.keys(d.touched).forEach(key => {
                    const orig = d.touched[key];
                    this.applySeqCell(d.voice, +key, orig.on, orig.tied);
                });
                painted = true;
            } else if (d.resize && d.resizeChanged) {
                // Étirement (voir onSeqResizeMove) : d.resize.noteStart/noteEnd gardent les bornes
                // D'ORIGINE de la note (jamais mises à jour pendant le geste, contrairement à
                // d.curStart/curEnd) — remet tout ce que le geste a pu toucher entre les deux dans son
                // état d'origine (note d'origine SEULE allumée sur cette plage).
                const lo = Math.min(d.curStart, d.resize.noteStart);
                const hi = Math.max(d.curEnd, d.resize.noteEnd);
                for (let s = lo; s <= hi; s++) {
                    const within = s >= d.resize.noteStart && s <= d.resize.noteEnd;
                    this.applySeqCell(d.voice, s, within, within && s !== d.resize.noteStart);
                }
                painted = true;
            } else if (d.multi) {
                // Étirement/déplacement de plusieurs notes sélectionnées (voir onSeqMultiDragMove) :
                // d.multi.selections garde un instantané des positions de DÉPART de chacune, jamais
                // muté pendant le geste — remet chaque note exactement là où elle était.
                const m = d.multi;
                const movesStart = m.edge === 'start' || m.edge === null;
                const movesEnd = m.edge === 'end' || m.edge === null;
                m.selections.forEach(sel => {
                    const curStart = movesStart ? sel.start + m.appliedDelta : sel.start;
                    const curEnd = movesEnd ? sel.end + m.appliedDelta : sel.end;
                    const lo = Math.min(sel.start, curStart), hi = Math.max(sel.end, curEnd);
                    for (let s = lo; s <= hi; s++) {
                        const within = s >= sel.start && s <= sel.end;
                        this.applySeqCell(sel.voice, s, within, within && s !== sel.start);
                    }
                });
                painted = true;
            }
        }
        // Changement de voix / duplication (voir beginSeqVoiceDrag/beginSeqDupDrag) : rien n'est
        // encore écrit dans les données à ce stade (seul un fantôme visuel suit le doigt, voir
        // finalizeSeqVoiceDrag/finalizeSeqDupDrag pour l'écriture réelle, jamais atteinte ici) — mais
        // le fantôme lui-même, posé dans le DOM en dehors du rendu normal, doit être retiré, et la
        // note d'origine (masquée pendant un changement de voix) redevenue visible, sans quoi elle
        // resterait invisible jusqu'au prochain rendu sans rapport (même bug visuel que ci-dessus).
        if (d && d.voiceDrag) {
            d.voiceDrag.ghost.remove();
            if (d.voiceDrag.noteEl) d.voiceDrag.noteEl.style.visibility = '';
        }
        if (d && d.dupDrag) {
            d.dupDrag.ghost.remove();
        }
        if (this.seqMarquee) {
            if (this.seqMarquee.el) this.seqMarquee.el.remove();
            document.querySelectorAll('.seq-note.marquee-hit').forEach(n => n.classList.remove('marquee-hit'));
            this.seqMarquee = null;
        }
        if (painted) this.renderSequencer();
    }

    onSeqPointerUp() {
        window.removeEventListener('pointermove', this._onSeqMove);
        window.removeEventListener('pointerup', this._onSeqUp);
        window.removeEventListener('pointercancel', this._onSeqUp);
        if (this.seqMarquee) { this.finalizeSeqMarqueeSelect(); return; }
        const d = this.seqDrag;
        this.seqDrag = null;
        if (!d) return;
        this._stopSeqAutoScroll(d);
        this._highlightSeqBeatLabel(null); // éteint le repère de temps (voir onSeqResizeMove/paint), geste terminé

        // Défilement vertical (voir onSeqPointerMove) : jamais une modification, rien à valider ici —
        // sans ce retour anticipé, une case vide (!d.wasOn) jamais peinte serait lue comme un simple
        // tap au relâchement (voir plus bas, "!d.moved") et peindrait une note isolée non voulue là où
        // le geste a commencé, alors qu'on cherchait juste à faire défiler la page verticalement.
        if (d.verticalScroll) return;

        if (d.voiceDrag) {
            this.finalizeSeqVoiceDrag(d);
            return;
        }

        if (d.dupDrag) {
            this.finalizeSeqDupDrag(d);
            return;
        }

        if (d.multi) {
            if (d.moved) {
                const m = d.multi;
                this.seqTouched = true;
                // Toutes les notes déplacées/étirées RESTENT sélectionnées (positions mises à jour),
                // contrairement au redimensionnement d'une seule note qui, lui, réduit la sélection.
                this.seqSelections = m.selections.map(sel => ({
                    voice: sel.voice,
                    start: (m.edge === 'start' || m.edge === null) ? sel.start + m.appliedDelta : sel.start,
                    end: (m.edge === 'end' || m.edge === null) ? sel.end + m.appliedDelta : sel.end,
                }));
                this.renderSequencer();
                this.livePreviewUpdate();
                return;
            }
            // Sinon : simple tap sans glissé réel -> retombe sur le comportement de sélection habituel.
        }

        if (d.resize) {
            if (d.resizeChanged) {
                this.seqTouched = true;
                this.seqSelections = [{ voice: d.voice, start: d.curStart, end: d.curEnd }];
                this.renderSequencer();
                this.livePreviewUpdate();
                return;
            }
            // Sinon : simple tap sur le bord d'une note, sans glissé réel -> retombe sur le
            // comportement de sélection habituel juste en dessous (c'est exactement le point :
            // cliquer ne doit jamais modifier une note, seul un vrai glissé le fait).
        }

        if (!d.moved) {
            // Simple tap, sans glisser
            if (d.wasOn) {
                this.selectSeqNoteAt(d.voice, d.startStep, d.additive); // sélectionne (ou ajoute/retire si Ctrl), ne la touche pas
            } else if (!d.additive) {
                // Ctrl/Cmd enfoncé sur une case vide : ne peint rien (Ctrl sert uniquement à sélectionner)
                this.pushSeqUndo();
                this.applySeqCell(d.voice, d.startStep, true, false); // nouvelle note isolée, rejouée
                this.selectSeqNoteAt(d.voice, d.startStep);
            }
        } else {
            // Glissé terminé : sélectionne la note qui vient d'être dessinée, ou rien si on a effacé
            if (d.wasOn) this.seqSelections = [];
            else this.selectSeqNoteAt(d.voice, d.startStep);
        }
        this.renderSequencer();
        // Une seule fois ici, à la fin du geste (voir applySeqCell, appelé en rafale pendant le
        // glissé lui-même) : pas à chaque case peinte, qui redémarrerait le son en boucle pendant le drag.
        this.livePreviewUpdate();
    }

    // Allume/éteint une case précise (et sa liaison à la précédente) et met à jour le motif stocké,
    // sans reconstruire toute la grille (indispensable pour que le glissé reste fluide, au doigt aussi)
    applySeqCell(voice, step, on, tied = false) {
        const chord = this.readChord();
        const { pattern, tie } = this.getLiveSeqPattern(chord);
        const wasOn = pattern[step].includes(voice);
        const wasTied = tie[step].includes(voice);
        if (on && wasOn && wasTied === tied) return;  // rien à changer
        if (!on && !wasOn) return;                    // déjà silencieuse

        if (on) {
            if (!wasOn) pattern[step].push(voice);
            if (tied && !wasTied) tie[step].push(voice);
            if (!tied && wasTied) tie[step].splice(tie[step].indexOf(voice), 1);
            // Première case peinte pour une voix libre toute neuve (voir addSequencerNote/_new) : lève
            // sa protection contre pruneEmptyExtraNotes, elle a désormais un vrai rythme à perdre si on
            // l'efface entièrement plus tard (comportement normal, inchangé, pour toute autre voix).
            const extraStart = chord.getIntervals().length;
            if (voice >= extraStart && this.extraNotes[voice - extraStart]) {
                delete this.extraNotes[voice - extraStart]._new;
            }
        } else {
            pattern[step].splice(pattern[step].indexOf(voice), 1);
            if (wasTied) tie[step].splice(tie[step].indexOf(voice), 1);
            // la croche suivante ne peut plus être liée à une croche désormais silencieuse
            if (step + 1 < tie.length) {
                const nt = tie[step + 1].indexOf(voice);
                if (nt >= 0) tie[step + 1].splice(nt, 1);
            }
        }

        this.seqTouched = true;
        this.setLiveSeqPattern(pattern, tie);
        const cell = document.querySelector(`.seq-cell[data-step="${step}"][data-voice="${voice}"]`);
        if (cell) cell.classList.toggle('on', on);
    }

    // Sélectionne la note (isolée ou pilule) à laquelle appartient cette croche, pour cette voix.
    // `additive` (Ctrl/Cmd enfoncé) : ajoute/retire cette note de la sélection au lieu de la
    // remplacer, pour permettre d'en sélectionner plusieurs à la fois (ex. avant une suppression groupée).
    selectSeqNoteAt(voice, step, additive = false) {
        const chord = this.readChord();
        const { pattern, tie } = this.getLiveSeqPattern(chord);
        if (!pattern[step] || !pattern[step].includes(voice)) {
            if (!additive) this.seqSelections = [];
            return;
        }
        let start = step, end = step;
        while (start > 0 && pattern[start - 1].includes(voice) && tie[start].includes(voice)) start--;
        while (end + 1 < pattern.length && pattern[end + 1].includes(voice) && tie[end + 1].includes(voice)) end++;

        if (!additive) { this.seqSelections = [{ voice, start, end }]; return; }
        const idx = this.seqSelections.findIndex(s => s.voice === voice && s.start === start);
        if (idx >= 0) this.seqSelections.splice(idx, 1); // déjà sélectionnée -> Ctrl+clic la retire
        else this.seqSelections.push({ voice, start, end });
    }

    // Supprime entièrement toutes les notes actuellement sélectionnées (touche Suppr/Retour arrière,
    // bouton dédié, ou double-tap tactile) — une seule lecture/écriture du motif même à plusieurs.
    deleteSelectedSeqNote() {
        if (this.seqSelections.length === 0) return;
        this.pushSeqUndo();
        const chord = this.readChord();
        const { pattern, tie } = this.getLiveSeqPattern(chord);
        this.seqSelections.forEach(sel => {
            for (let s = sel.start; s <= sel.end; s++) {
                const at = pattern[s].indexOf(sel.voice);
                if (at >= 0) pattern[s].splice(at, 1);
                const ti = tie[s].indexOf(sel.voice);
                if (ti >= 0) tie[s].splice(ti, 1);
            }
            if (sel.end + 1 < tie.length) {
                const nt = tie[sel.end + 1].indexOf(sel.voice);
                if (nt >= 0) tie[sel.end + 1].splice(nt, 1);
            }
        });
        this.seqTouched = true;
        this.setLiveSeqPattern(pattern, tie);
        this.seqSelections = [];
        this.renderSequencer();
        this.livePreviewUpdate();
    }

    // Étire (delta > 0) ou raccourcit (delta < 0) TOUTES les notes sélectionnées d'une croche, chacune
    // depuis sa fin — tout ou rien : si une seule des notes sélectionnées ne peut pas bouger (bord de
    // grille, ou déjà collée à une autre note de sa voix), aucune n'est modifiée, pour ne jamais
    // désynchroniser un groupe qu'on étire ensemble. Pour redimensionner depuis le DÉBUT d'une note,
    // utiliser les poignées de la souris/du doigt (resize à une seule note à la fois).
    resizeSelectedSeqNote(delta) {
        if (this.seqSelections.length === 0) return;
        const chord = this.readChord();
        const { pattern, tie } = this.getLiveSeqPattern(chord);
        const steps = pattern.length;

        for (const sel of this.seqSelections) {
            if (delta > 0) {
                const next = sel.end + 1;
                if (next >= steps || pattern[next].includes(sel.voice)) return; // bord de grille, ou déjà occupé
            } else if (sel.end <= sel.start) {
                return; // une seule croche : Suppr pour l'effacer entièrement
            }
        }

        this.seqSelections.forEach(sel => {
            if (delta > 0) {
                const next = sel.end + 1;
                pattern[next].push(sel.voice);
                tie[next].push(sel.voice); // prolonge la même note tenue
                sel.end = next;
            } else {
                const last = sel.end;
                pattern[last].splice(pattern[last].indexOf(sel.voice), 1);
                const ti = tie[last].indexOf(sel.voice);
                if (ti >= 0) tie[last].splice(ti, 1);
                sel.end = last - 1;
            }
        });

        this.seqTouched = true;
        this.setLiveSeqPattern(pattern, tie);
        this.renderSequencer();
        this.livePreviewUpdate();
    }

    // Décale TOUTES les notes sélectionnées d'une croche vers la gauche (delta<0) ou la droite
    // (delta>0), en bloc — tout ou rien, comme resizeSelectedSeqNote : si une seule ne peut pas se
    // décaler (bord de grille, ou collision avec une note non sélectionnée de sa voix), aucune ne
    // bouge. Les croches couvertes par la sélection elle-même ne comptent jamais comme un obstacle,
    // puisqu'elles se libèrent avec ce même geste.
    moveSelectedSeqNotes(delta) {
        if (this.seqSelections.length === 0 || delta === 0) return;
        const chord = this.readChord();
        const { pattern, tie } = this.getLiveSeqPattern(chord);
        const steps = pattern.length;
        const ownStep = (voice, step) => this.seqSelections.some(s => s.voice === voice && step >= s.start && step <= s.end);

        for (const sel of this.seqSelections) {
            const newStart = sel.start + delta, newEnd = sel.end + delta;
            if (newStart < 0 || newEnd >= steps) return;
            for (let s = newStart; s <= newEnd; s++) {
                if (!ownStep(sel.voice, s) && pattern[s].includes(sel.voice)) return;
            }
        }

        // Vide d'abord TOUTES les anciennes positions, puis repeint les nouvelles, en deux passes
        // séparées : sinon une note du groupe pourrait effacer ce qu'une autre note du MÊME groupe
        // vient tout juste d'y écrire (ex. deux notes adjacentes qui glissent ensemble).
        this.seqSelections.forEach(sel => {
            for (let s = sel.start; s <= sel.end; s++) {
                const at = pattern[s].indexOf(sel.voice);
                if (at >= 0) pattern[s].splice(at, 1);
                const ti = tie[s].indexOf(sel.voice);
                if (ti >= 0) tie[s].splice(ti, 1);
            }
        });
        this.seqSelections.forEach(sel => {
            const newStart = sel.start + delta, newEnd = sel.end + delta;
            for (let s = newStart; s <= newEnd; s++) {
                pattern[s].push(sel.voice);
                if (s !== newStart) tie[s].push(sel.voice);
            }
            sel.start = newStart;
            sel.end = newEnd;
        });

        this.seqTouched = true;
        this.setLiveSeqPattern(pattern, tie);
        this.renderSequencer();
        this.livePreviewUpdate();
    }

    // Bouton dédié dans le volet Lecture : ouvre/ferme le panneau, indépendamment du style choisi
    toggleSequencer() {
        this.seqOpen = !this.seqOpen;
        if (!this.seqOpen) {
            this.seqSelections = [];
            this.closeSeqZoom(); // rien à agrandir une fois le panneau lui-même refermé
        }
        document.getElementById('toggle-sequencer').classList.toggle('active', this.seqOpen);
        document.getElementById('seq-zoom').hidden = !this.seqOpen;
        this.renderSequencer();
        this.updateGlobalUndoRedoButtons(); // le bouton unique repointe vers l'historique du séquenceur
    }

    // Verrouille/libère le défilement de la page derrière une fenêtre agrandie ouverte (voir
    // .body-scroll-locked dans style.css) — compteur plutôt qu'un simple booléen : au cas, même rare,
    // où la loupe grille et la loupe séquenceur se chevauchent, la première fermée ne doit pas
    // déverrouiller le défilement tant que l'autre reste ouverte.
    lockBodyScroll() {
        this._bodyScrollLocks = (this._bodyScrollLocks || 0) + 1;
        document.body.classList.add('body-scroll-locked');
    }
    unlockBodyScroll() {
        this._bodyScrollLocks = Math.max(0, (this._bodyScrollLocks || 0) - 1);
        if (this._bodyScrollLocks === 0) document.body.classList.remove('body-scroll-locked');
    }

    // Déplace #arp-sequencer (jamais ne le duplique) dans la fenêtre agrandie : toutes ses
    // interactions (glisser, étirer, sélectionner...) restent celles du vrai séquenceur, attachées
    // une fois pour toutes dans setupSequencerInteractions — un simple changement de parent ne les
    // perd pas. .seq-zoomed pilote uniquement la taille des cases/libellés (voir style.css).
    openSeqZoom() {
        if (!this.seqOpen) return;
        this.seqZoomOpen = true;
        const host = document.getElementById('arp-sequencer');
        document.getElementById('seq-zoom-host').appendChild(host);
        host.classList.add('seq-zoomed');
        document.getElementById('seq-zoom-overlay').hidden = false;
        this.lockBodyScroll();
        // Ré-applique aussi l'échelle courante à ce nouvel hôte et redéclenche un rendu (la
        // pagination dépend de this.seqZoomOpen — plus de mesures par page une fois agrandi, voir
        // seqPageBars —, sinon elle resterait celle de la vue compacte jusqu'au prochain changement).
        this.applyZoomLevel('seq');
    }

    // Remet #arp-sequencer à sa place d'origine dans le volet Lecture (juste après #arpPattern,
    // voir index.html) — sans effet si la fenêtre agrandie n'était pas ouverte.
    closeSeqZoom() {
        if (!this.seqZoomOpen) return;
        this.seqZoomOpen = false;
        document.getElementById('seq-zoom-overlay').hidden = true;
        this.unlockBodyScroll();
        const host = document.getElementById('arp-sequencer');
        host.classList.remove('seq-zoomed');
        document.getElementById('arpPattern').insertAdjacentElement('afterend', host);
        this.renderSequencer();
    }

    // Même principe qu'openSeqZoom/closeSeqZoom, pour la grille d'accords cette fois : déplace
    // #progression-sections + le bouton "Ajouter une partie" dans la fenêtre agrandie (jamais ne les
    // duplique), toutes leurs interactions (glisser-déposer, étirement, menu contextuel...) restant
    // celles déjà câblées sur les vrais éléments.
    openGridZoom() {
        this.gridZoomOpen = true;
        const grid = document.getElementById('progression-sections');
        const addBtn = document.getElementById('add-section');
        const dest = document.getElementById('grid-zoom-host');
        dest.appendChild(grid);
        dest.appendChild(addBtn);
        document.getElementById('grid-zoom-overlay').hidden = false;
        this.lockBodyScroll();
        this.applyZoomLevel('grid');
        // Reflète l'état actuel de la boucle (a pu être activée avant d'ouvrir la loupe, depuis le
        // vrai bouton du pied de colonne, voir le bouton dupliqué dans l'en-tête ci-dessus).
        document.getElementById('grid-zoom-loop').classList.toggle('active', this.loopActiveSection);

        // Séquenceur épinglé : toujours affiché une fois la loupe ouverte (masquable ensuite via son
        // propre chevron, voir toggleGridZoomPinnedSeq) — reflète tout de suite un accord déjà en
        // édition (ex. double-clic fait avant d'ouvrir la loupe), sinon affiche le message d'attente.
        document.getElementById('grid-zoom-pinned-seq').hidden = false;
        document.getElementById('grid-zoom-pinned-body').style.height =
            `${parseInt(localStorage.getItem(GRID_ZOOM_SEQ_HEIGHT_KEY)) || GRID_ZOOM_SEQ_HEIGHT_DEFAULT}px`;
        this.applyGridZoomPinnedCollapsed();
        // Un accord était déjà SÉLECTIONNÉ dans la grille (simple clic, sans être passé par "Modifier")
        // avant d'ouvrir la loupe : le charge directement pour édition, exactement comme un clic dessus
        // une fois la loupe déjà ouverte (voir editChordFromGridZoom) — sinon la loupe et le séquenceur
        // épinglé s'ouvraient sans rien montrer (retour utilisateur), obligeant à recliquer l'accord une
        // seconde fois une fois dedans.
        if (this.editingIndex == null && this.selectedIndex != null) {
            this.editChordFromGridZoom(this.activeSection, this.selectedIndex);
        } else if (this.editingIndex != null) {
            this.pinSequencerHost();
            this.renderSequencer();
        }
        this.syncGridZoomPinnedSeq();
        // Centre la vue de la grille elle-même sur l'accord en édition (voir editChordFromGridZoom
        // ci-dessus, ou déjà en édition avant l'ouverture) — sinon la loupe pouvait s'ouvrir avec cet
        // accord hors champ, tout en montrant pourtant déjà son rythme dans le séquenceur épinglé.
        if (this.editingIndex != null) {
            requestAnimationFrame(() => {
                const cell = document.querySelector(`#grid-zoom-host .grid-cell[data-section="${this.activeSection}"][data-index="${this.editingIndex}"]`);
                if (cell) cell.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
            });
        }
    }

    // Remet #progression-sections et #add-section à leur place d'origine (juste après la rangée
    // d'ajout rapide, voir index.html) — sans effet si la fenêtre agrandie n'était pas ouverte.
    closeGridZoom() {
        if (!this.gridZoomOpen) return;
        this.gridZoomOpen = false;
        document.getElementById('grid-zoom-overlay').hidden = true;
        this.unlockBodyScroll();
        const grid = document.getElementById('progression-sections');
        const addBtn = document.getElementById('add-section');
        // Place d'ORIGINE réelle (voir index.html) : juste après l'en-tête "Grille d'accords" dans
        // .history-section (col-right) — PAS .quick-add-row, qui vit désormais dans l'onglet Ajout de
        // la colonne de GAUCHE depuis son déplacement (voir tâche "Move quick-add grid to Ajout tab
        // only") sans que cet ancrage n'ait été mis à jour en même temps. Bug resté latent jusqu'à ce
        // qu'on ouvre PUIS referme la loupe grille : la grille entière atterrissait alors dans la
        // colonne de gauche à la fermeture, plutôt que de revenir sous son propre en-tête à droite
        // (retour utilisateur : "la grille et tout le reste change de place").
        const anchor = document.querySelector('.history-section .card-head');
        anchor.insertAdjacentElement('afterend', grid);
        grid.insertAdjacentElement('afterend', addBtn);

        // Le séquenceur épinglé n'a de sens que DANS la loupe grille : remettre #arp-sequencer à sa
        // place habituelle du volet Lecture (comme closeSeqZoom) — this.seqOpen n'est pas remis à
        // false pour autant, il continue d'y apparaître normalement si toujours vrai.
        document.getElementById('grid-zoom-pinned-seq').hidden = true;
        const seqHost = document.getElementById('arp-sequencer');
        if (document.getElementById('grid-zoom-pinned-body').contains(seqHost)) {
            seqHost.classList.remove('seq-zoomed'); // voir pinSequencerHost : ne s'applique qu'épinglé
            document.getElementById('arpPattern').insertAdjacentElement('afterend', seqHost);
        }
        this.loadProgression(); // revient à la largeur de ligne/aux boutons de la taille normale
        if (this.editingIndex != null) this.renderSequencer(); // idem pour la pagination du séquenceur
    }

    // Clic sur un accord DANS la loupe grille (voir onGridPointerUp) : le charge directement pour
    // édition — pas besoin d'un double-clic ici, l'intérêt même de cet outil de modification rapide
    // — et pousse aussitôt son rythme dans le séquenceur épinglé en bas de la fenêtre.
    editChordFromGridZoom(section, index) {
        this.seqOpen = true;
        document.getElementById('toggle-sequencer').classList.add('active');
        this.pinSequencerHost();
        this.editChord(section, index);
        this.syncGridZoomPinnedSeq();
        // Repositionne la pastille octave flottante APRÈS syncGridZoomPinnedSeq (voir
        // updateGridCellOctaveFloat) : basculer le panneau épinglé de son message d'attente au
        // séquenceur (hauteurs différentes) peut redonner à #grid-zoom-host une hauteur disponible
        // différente, décalant la case juste positionnée par editChord() un peu plus haut — sans ce
        // second passage, la pastille restait accrochée à sa position d'avant ce dernier décalage.
        this.updateGridCellOctaveFloat();
        // Comme un clic sur la grille normale (voir selectChord) : fait entendre l'accord touché,
        // sinon la loupe grille resterait muette au clic (retour utilisateur).
        if (this.autoplaySelect) this.playCurrent();
    }

    // Déplace #arp-sequencer dans #grid-zoom-pinned-body s'il n'y est pas déjà (jamais ne le
    // duplique) — même principe qu'openSeqZoom, pour cet emplacement épinglé plutôt qu'une fenêtre
    // séparée.
    pinSequencerHost() {
        const body = document.getElementById('grid-zoom-pinned-body');
        const host = document.getElementById('arp-sequencer');
        if (!body.contains(host)) body.appendChild(host);
        // .seq-zoomed pilote la taille des cases/libellés (voir style.css, même classe qu'openSeqZoom)
        // — sans elle, les boutons de zoom vertical du séquenceur épinglé (voir renderSequencer,
        // continuous) n'auraient aucun effet visible. --seq-zoom-scale-v posée directement sur CE nouvel
        // hôte (jamais déplacé lui-même, contrairement à #arp-sequencer) plutôt que via applyZoomLevel
        // (qui redéclencherait aussi un rendu ici, déjà fait juste après par l'appelant).
        host.classList.add('seq-zoomed');
        body.style.setProperty('--seq-zoom-scale-v', String(this.seqZoomLevelY));
    }

    // Reflète l'état courant (accord en édition ou non) dans l'en-tête/le corps du séquenceur
    // épinglé — appelé après un chargement (editChordFromGridZoom), un Enregistrer/Annuler, ou
    // l'ouverture de la loupe grille si un accord était déjà en édition avant coup.
    syncGridZoomPinnedSeq() {
        const editing = this.editingIndex != null;
        const title = document.getElementById('grid-zoom-pinned-title');
        title.innerHTML = editing
            ? flatTight(this.readChord().getLabel(this.useFlatsForRoot(document.getElementById('root').value)))
            : 'Séquenceur';
        document.getElementById('grid-zoom-pinned-placeholder').hidden = editing;
        document.getElementById('grid-zoom-pinned-body').hidden = !editing;
        document.getElementById('grid-zoom-pinned-save').hidden = !editing;
        document.getElementById('grid-zoom-pinned-cancel').hidden = !editing;
    }

    // Replie/déplie le séquenceur épinglé (chevron dans son en-tête) : masqué complètement (ne garde
    // que l'en-tête, comme la carte Morceau — voir toggleSongCardCollapse) sans perdre le motif en
    // cours, mémorisé d'une session à l'autre.
    toggleGridZoomPinnedSeq() {
        this.gridZoomSeqCollapsed = !this.gridZoomSeqCollapsed;
        localStorage.setItem(GRID_ZOOM_SEQ_COLLAPSED_KEY, this.gridZoomSeqCollapsed ? '1' : '0');
        this.applyGridZoomPinnedCollapsed();
    }

    applyGridZoomPinnedCollapsed() {
        const el = document.getElementById('grid-zoom-pinned-seq');
        el.classList.toggle('collapsed', this.gridZoomSeqCollapsed);
        const btn = document.getElementById('grid-zoom-pinned-toggle');
        btn.setAttribute('aria-pressed', String(!this.gridZoomSeqCollapsed));
        const label = this.gridZoomSeqCollapsed ? 'Afficher le séquenceur' : 'Masquer le séquenceur';
        btn.title = label;
        btn.setAttribute('aria-label', label);
    }

    // Masque/révèle tout le panneau de gauche (Accord/Morceau/Réglages...) — voir #toggle-sidebar :
    // la grille et les diagrammes (.col-right) profitent alors de toute la largeur, plus simple à
    // modifier (retour utilisateur). Bureau uniquement (voir style.css @media min-width:900px) : sur
    // mobile .col-left n'est de toute façon qu'un simple ordre d'affichage (display: contents), rien
    // à masquer séparément. Préférence d'APPAREIL (pas du morceau), mémorisée d'une session à l'autre.
    toggleSidebar() {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, this.sidebarCollapsed ? '1' : '0');
        this.applySidebarCollapsed();
    }

    applySidebarCollapsed() {
        document.body.classList.toggle('sidebar-collapsed', this.sidebarCollapsed);
        // #footer-dock (Accord/Grille/Boucle/Stop) vit normalement en dernier enfant de .col-left —
        // le masquer avec le reste du panneau rendrait la lecture/l'arrêt inaccessibles tant que la
        // grille est en plein écran. Déplacé (jamais dupliqué, même principe qu'openGridZoom/
        // openSeqZoom) dans .col-right pendant que le panneau est masqué, remis à sa place à la
        // réouverture. Sans effet sur mobile (col-left n'y est de toute façon qu'un display:contents,
        // voir le garde-fou de la règle CSS elle-même) mais inoffensif d'y déplacer le nœud quand même.
        const dock = document.getElementById('footer-dock');
        if (this.sidebarCollapsed) {
            document.querySelector('.col-right').appendChild(dock);
        } else {
            document.querySelector('.col-left').appendChild(dock);
        }
        const btn = document.getElementById('toggle-sidebar');
        btn.classList.toggle('active', this.sidebarCollapsed);
        btn.setAttribute('aria-pressed', String(this.sidebarCollapsed));
        const label = this.sidebarCollapsed ? 'Afficher le panneau de gauche' : 'Masquer le panneau de gauche';
        btn.title = label;
        btn.setAttribute('aria-label', label);
    }

    // Glisser la poignée du haut change la hauteur de #grid-zoom-pinned-body (pas celle du conteneur
    // lui-même, voir le commentaire CSS de .grid-zoom-pinned-seq) — glisser VERS LE HAUT agrandit
    // (la poignée est en haut du panneau, "la tirer vers le haut" l'agrandit vers le haut).
    setupGridZoomPinnedResize() {
        const handle = document.getElementById('grid-zoom-pinned-resize');
        const body = document.getElementById('grid-zoom-pinned-body');
        let startY = 0, startHeight = 0;
        const onMove = (e) => {
            const modal = document.querySelector('.grid-zoom-modal');
            const maxHeight = Math.round(modal.getBoundingClientRect().height * 0.75);
            const next = Math.max(GRID_ZOOM_SEQ_HEIGHT_MIN, Math.min(maxHeight, startHeight - (e.clientY - startY)));
            body.style.height = `${next}px`;
        };
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            localStorage.setItem(GRID_ZOOM_SEQ_HEIGHT_KEY, String(parseInt(body.style.height)));
        };
        handle.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            startY = e.clientY;
            startHeight = body.getBoundingClientRect().height;
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp, { once: true });
        });
    }

    // Pincer-zoomer à 2 doigts (retour utilisateur : équivalent tactile du Ctrl+molette existant, qui
    // ne marche pas au doigt — ni Ctrl ni molette sur mobile). Suit les deux pointeurs tactiles actifs
    // sur `el` via leur pointerId (peu importe lesquels des doigts posés, même si d'autres traînent
    // sur l'écran ailleurs). Zoom CONTINU (le ratio écart-actuel/écart-de-départ s'applique directement
    // à l'échelle de départ, à chaque pointermove) plutôt que par crans fixes tous les N pixels — un
    // premier essai par crans se sentait « à-coups » (retour utilisateur), loin du geste natif auquel
    // les doigts s'attendent. Zoome les DEUX axes à la fois (contrairement au Ctrl+molette, qui choisit
    // un seul axe à la fois selon Maj) : un geste de pince n'a pas d'équivalent naturel à une touche
    // Maj à mi-pince.
    // `pan` (retour utilisateur : « éviter les modifications non voulues dans le séquenceur, un
    // déplacement juste après le clic pourrait ressembler à un scroll ») : un glissé à UN seul doigt
    // sur une case reste TOUJOURS une édition (peindre/étirer/sélectionner), jamais un défilement —
    // aucune ambiguïté possible, contrairement à un doigt seul où les deux gestes se ressemblent trop
    // pour être devinés. Faire défiler sans risquer une édition demande donc DEUX doigts qui glissent
    // ENSEMBLE (comme naviguer dans GarageBand/FL Studio Mobile) : suit ici le déplacement du point
    // milieu entre les deux doigts, EN PLUS (pas à la place) du ratio d'écart déjà utilisé pour le
    // zoom — les deux se combinent naturellement dans un seul geste, sans code séparé pour les
    // distinguer. `zoom`/`pan` activables indépendamment : le séquenceur COMPACT (hors loupe) n'a pas
    // de zoom au pincement (son échelle horizontale dédiée, voir adjustSeqInlineZoom, reste
    // volontairement indépendante de seqZoomLevelX/Y — retour utilisateur antérieur), seulement le
    // défilement ; les fenêtres agrandies gardent zoom+pan tous les deux.
    setupPinchZoom(el, kind, { zoom = true, pan = false } = {}) {
        const pointers = new Map();
        let baseDist = null, baseZoomX = null, baseZoomY = null;
        const dist = () => {
            const pts = [...pointers.values()];
            return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        };
        // Cible du défilement : #arp-sequencer se déplace entre plusieurs hôtes (compact, loupe
        // séquenceur, loupe grille épinglée, voir openSeqZoom/pinSequencerHost) sans jamais être
        // dupliqué — retrouvée à CHAQUE geste plutôt que mise en cache, pour rester valide même après
        // un rendu qui a reconstruit .seq-scroll entretemps (un vrai zoom pinch redessine, voir
        // _flushZoomPinchRender ; un pan seul, lui, ne redessine jamais rien).
        const panTarget = () => (kind === 'seq') ? document.querySelector('#arp-sequencer .seq-scroll') : el;
        el.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch') return;
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            // Capture explicite sur `el` (stable, jamais reconstruit) plutôt que de laisser le doigt
            // capturé implicitement sur la case tactée (norme Pointer Events pour tout doigt) : un pas
            // de zoom horizontal en cours de pincement redessine la grille/le séquenceur (mise en page
            // recalculée, voir applyZoomLevel), qui détruit/reconstruit CES cases précises — sans
            // cette capture explicite, les pointermove/pointerup suivants de CE doigt se seraient
            // perdus dans le vide (plus aucun ancêtre à traverser depuis une case retirée du DOM),
            // coupant le pincement net (retour utilisateur : "l'agrandissement avec les doigts ne
            // fonctionne pas bien"). try/catch défensif : ignoré si le navigateur ne considère pas
            // encore ce pointeur comme actif (jamais le cas pour un vrai doigt).
            try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignoré, voir commentaire ci-dessus */ }
            if (pointers.size === 2 && zoom) {
                // Écart et échelle de DÉPART du pincement : toute la suite du geste s'exprime en
                // ratio de cet écart initial, jamais en delta cumulé depuis le dernier mouvement
                // (qui dériverait/s'accumulerait faux si un pointermove venait à manquer).
                baseDist = dist();
                baseZoomX = this[`${kind}ZoomLevelX`];
                baseZoomY = this[`${kind}ZoomLevelY`];
                this._zoomPinchActive = true;
                this._startZoomPinchFlushLoop();
            }
        });
        el.addEventListener('pointermove', (e) => {
            const prevPos = pointers.get(e.pointerId);
            if (!prevPos) return;
            // dxRaw AVANT d'écraser la position mémorisée : delta du SEUL doigt qui vient de bouger
            // (voir plus bas, pan) — jamais recalculé depuis un point milieu des DEUX doigts, qui
            // mélangerait la position toute fraîche de celui-ci avec celle de l'autre doigt, restée à
            // sa dernière valeur reçue un tick plus tôt (les deux doigts arrivent presque toujours par
            // évènements séparés, jamais parfaitement synchronisés) — cette lecture décalée était
            // exactement la source des petits à-coups au lieu d'un glissé fluide (retour utilisateur).
            const dxRaw = e.clientX - prevPos.x;
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pointers.size !== 2) return;
            let handled = false;
            if (zoom && baseDist != null && baseDist >= 1) {
                const ratio = dist() / baseDist;
                this.setZoomLevel(kind, 'x', baseZoomX * ratio);
                this.setZoomLevel(kind, 'y', baseZoomY * ratio);
                handled = true;
            }
            if (pan) {
                const target = panTarget();
                // Moitié du delta de CE seul doigt (2 doigts qui glissent ensemble se partagent le
                // déplacement perçu — voir le commentaire plus haut) : additionné aux évènements de
                // l'autre doigt au fil du geste, retrouve la même distance totale qu'un vrai suivi du
                // point milieu, sans jamais mélanger deux échantillons pris à des instants différents.
                // Doigts qui glissent vers la droite -> le contenu doit suivre vers la droite -> moins
                // reste caché à gauche (scrollLeft diminue) : même sens qu'un glissé tactile natif.
                if (target) target.scrollLeft -= dxRaw / 2;
                handled = true;
            }
            if (handled) e.preventDefault(); // empêche le navigateur de zoomer/défiler la PAGE entière avec la même pince
        }, { passive: false });
        const release = (e) => {
            pointers.delete(e.pointerId);
            if (pointers.size < 2) {
                baseDist = null;
                // Un doigt se lève, il n'en reste plus 2 : le pincement est terminé — arrête la boucle
                // de rattrapage périodique et applique un dernier rattrapage immédiat (voir
                // _startZoomPinchFlushLoop/_flushZoomPinchRender), pour être certain de finir sur la
                // toute dernière valeur de zoom, pas celle du dernier rattrapage périodique.
                if (zoom) {
                    this._zoomPinchActive = false;
                    this._stopZoomPinchFlushLoop();
                    this._flushZoomPinchRender();
                }
            }
        };
        el.addEventListener('pointerup', release);
        el.addEventListener('pointercancel', release);
    }

    // Pendant un pincer-zoomer, rattrape périodiquement (toutes les ~150ms, pas à chaque pointermove)
    // la reconstruction complète différée par applyZoomLevel (voir _seqZoomRenderPending/
    // _gridZoomRenderPending) : un cran d'échelle HORIZONTALE change la mise en page (mesures par page/
    // accords par ligne), donc redessine réellement la grille/le séquenceur — le faire à CHAQUE
    // pointermove détruirait sans arrêt les cases sous les doigts (voir setPointerCapture plus haut,
    // qui protège déjà ce risque, mais autant limiter la fréquence). Ne jamais rattraper DU TOUT avant
    // la fin du geste (comme avant) rendait le zoom horizontal visuellement figé pendant tout le
    // pincement puis sautait d'un coup à la fin — perçu comme saccadé, et la position centrée sur
    // l'accord en cours d'édition (recalculée par renderSequencer/loadProgression à CHAQUE rendu à
    // partir de l'état actuel) ne suivait plus qu'une seule fois, trop tard (retour utilisateur : "la
    // fenêtre n'est plus centrée sur l'accord"). Rattraper à intervalles réguliers réapplique cette
    // même logique de centrage en continu, comme les boutons +/- dédiés (jamais différés, eux).
    _startZoomPinchFlushLoop() {
        if (this._zoomPinchFlushRAF) return;
        let lastFlush = 0;
        const ZOOM_PINCH_FLUSH_MS = 150;
        const step = (ts) => {
            if (!this._zoomPinchActive) { this._zoomPinchFlushRAF = null; return; }
            if (ts - lastFlush >= ZOOM_PINCH_FLUSH_MS) {
                lastFlush = ts;
                this._flushZoomPinchRender();
            }
            this._zoomPinchFlushRAF = requestAnimationFrame(step);
        };
        this._zoomPinchFlushRAF = requestAnimationFrame(step);
    }

    _stopZoomPinchFlushLoop() {
        if (this._zoomPinchFlushRAF) {
            cancelAnimationFrame(this._zoomPinchFlushRAF);
            this._zoomPinchFlushRAF = null;
        }
    }

    _flushZoomPinchRender() {
        if (this._seqZoomRenderPending) {
            this._seqZoomRenderPending = false;
            if (this.seqOpen) this.renderSequencer();
        }
        if (this._gridZoomRenderPending) {
            this._gridZoomRenderPending = false;
            this.loadProgression();
        }
        if (this._voiceLeadingZoomRenderPending) {
            this._voiceLeadingZoomRenderPending = false;
            this.loadProgression();
        }
    }

    // Zoome les DEUX axes en même temps, d'un cran (voir adjustZoom ci-dessous pour chacun) — utilisé
    // par Ctrl+molette et le pincer-zoomer (voir setupPinchZoom) : retour utilisateur, le zoom séparé
    // par axe (Ctrl+molette = V, Ctrl+Maj+molette = H) ne se sentait pas fiable/prévisible ; zoomer les
    // deux à la fois est plus simple et correspond à l'intuition d'un geste de pince à deux doigts.
    adjustZoomBothAxes(kind, delta) {
        this.adjustZoom(kind, 'x', delta);
        this.adjustZoom(kind, 'y', delta);
    }

    // Câble les 4 boutons +/- H/V d'un panneau zoomable vers adjustZoom(kind, axis, ±STEP) — factorisé
    // ici car le même câblage se répétait à l'identique pour chaque panneau (loupe séquenceur, grille
    // classique, loupe grille, séquenceur épinglé, Conduite de voix) : un seul endroit à corriger si
    // ce câblage doit changer, plutôt que cinq blocs à faire évoluer en parallèle. `group` accepte des
    // ids (string) ou des éléments déjà résolus (ex. querySelector sur un panneau reconstruit).
    _bindZoomButtons(kind, { inH, outH, inV, outV } = {}, { stopPropagation = false } = {}) {
        const resolve = (ref) => (typeof ref === 'string') ? document.getElementById(ref) : ref;
        const bind = (ref, axis, delta) => {
            const el = resolve(ref);
            if (!el) return;
            el.onclick = (e) => { if (stopPropagation) e.stopPropagation(); this.adjustZoom(kind, axis, delta); };
        };
        bind(inH, 'x', ZOOM_LEVEL_STEP);
        bind(outH, 'x', -ZOOM_LEVEL_STEP);
        bind(inV, 'y', ZOOM_LEVEL_STEP);
        bind(outV, 'y', -ZOOM_LEVEL_STEP);
    }

    // Câble Ctrl+molette vers adjustZoomBothAxes(kind, ±STEP) sur un élément donné — même logique
    // (preventDefault pour ne pas zoomer la PAGE entière) répétée pour chaque fenêtre zoomable.
    // `guard`, si fourni, annule le zoom quand il renvoie vrai (ex. loupe déjà ouverte par-dessus).
    _bindCtrlWheelZoom(target, kind, guard) {
        const el = (typeof target === 'string') ? document.getElementById(target) : target;
        if (!el) return;
        el.addEventListener('wheel', (e) => {
            if (!e.ctrlKey) return;
            if (guard && guard()) return;
            e.preventDefault();
            this.adjustZoomBothAxes(kind, e.deltaY < 0 ? ZOOM_LEVEL_STEP : -ZOOM_LEVEL_STEP);
        }, { passive: false });
    }

    // Règle l'échelle horizontale (axis 'x') ou verticale (axis 'y') — INDÉPENDANTES l'une de
    // l'autre — du séquenceur ou de la grille d'accords d'un cran, une fois la fenêtre agrandie
    // correspondante déjà ouverte (boutons dédiés ou Ctrl+molette/Ctrl+Maj+molette dans cette
    // fenêtre, voir les écouteurs "wheel" plus haut) — mémorisé d'une session à l'autre.
    adjustZoom(kind, axis, delta) {
        const levelKey = `${kind}ZoomLevel${axis === 'x' ? 'X' : 'Y'}`;
        this.setZoomLevel(kind, axis, this[levelKey] + delta);
    }

    // Pose une échelle ABSOLUE (pas relative comme adjustZoom ci-dessus) : utilisé par le pincer-zoomer
    // (voir setupPinchZoom), qui suit en continu le ratio d'écartement des doigts plutôt que d'avancer
    // par crans — sinon le zoom au doigt semblait saccadé/à-coups (retour utilisateur), un cran entier
    // d'un coup au lieu de suivre le geste en direct.
    setZoomLevel(kind, axis, value) {
        const levelKey = `${kind}ZoomLevel${axis === 'x' ? 'X' : 'Y'}`;
        const storageKey = kind === 'seq'
            ? (axis === 'x' ? SEQ_ZOOM_LEVEL_X_KEY : SEQ_ZOOM_LEVEL_Y_KEY)
            : kind === 'classicGrid'
            ? (axis === 'x' ? CLASSIC_GRID_ZOOM_LEVEL_X_KEY : CLASSIC_GRID_ZOOM_LEVEL_Y_KEY)
            : kind === 'voiceLeading'
            ? (axis === 'x' ? VOICE_LEADING_ZOOM_LEVEL_X_KEY : VOICE_LEADING_ZOOM_LEVEL_Y_KEY)
            : (axis === 'x' ? GRID_ZOOM_LEVEL_X_KEY : GRID_ZOOM_LEVEL_Y_KEY);
        const next = Math.round(Math.max(ZOOM_LEVEL_MIN, Math.min(ZOOM_LEVEL_MAX, value)) * 100) / 100;
        if (next === this[levelKey]) return; // évite un applyZoomLevel (donc un rendu) inutile
        this[levelKey] = next;
        localStorage.setItem(storageKey, String(next));
        this.applyZoomLevel(kind);
        // Ces échelles sont désormais conservées DANS le morceau lui-même (voir zoomSettingsForSong/
        // saveCurrentSong) : comme les autres réglages "Morceau" (tonalité, tempo...), Enregistrer/
        // Ctrl+S doit rester le seul moment où ce changement devient permanent.
        hasUnsavedChanges = true;
    }

    // Applique les deux échelles courantes : l'HORIZONTALE joue sur la DENSITÉ (accords par ligne
    // via beatsPerRowFor, ou mesures par page via seqPageBars) — une vraie mise en page recalculée,
    // pas un simple agrandissement visuel — donc un nouveau rendu ; la VERTICALE joue sur la
    // hauteur des lignes via une variable CSS (--grid-zoom-scale-v/--seq-zoom-scale-v, voir
    // style.css) posée UNE FOIS sur le conteneur de la fenêtre agrandie : elle est ensuite héritée
    // par chaque rendu ultérieur sans qu'il faille la reposer à chaque fois.
    applyZoomLevel(kind) {
        if (kind === 'seq') {
            const host = document.getElementById('seq-zoom-host');
            if (host) host.style.setProperty('--seq-zoom-scale-v', String(this.seqZoomLevelY));
            // #grid-zoom-pinned-body : autre hôte possible de #arp-sequencer (séquenceur épinglé de la
            // loupe grille, voir pinSequencerHost) — même réglage partagé (seqZoomLevelY), posé ici
            // aussi puisque les boutons dédiés de CE panneau (zoom-axis-group « -pinned », voir
            // renderSequencer) appellent ce même adjustZoom('seq', ...)/applyZoomLevel('seq').
            const pinnedHost = document.getElementById('grid-zoom-pinned-body');
            if (pinnedHost) pinnedHost.style.setProperty('--seq-zoom-scale-v', String(this.seqZoomLevelY));
            if (this.seqOpen) {
                // Pincer-zoomer en cours (voir this._zoomPinchActive/setupPinchZoom) : reporte la
                // reconstruction complète (qui détruirait les .seq-cell actuellement sous les doigts,
                // coupant le geste) au relâchement — l'échelle verticale ci-dessus, elle, suit déjà les
                // doigts en direct via la variable CSS.
                if (this._zoomPinchActive) this._seqZoomRenderPending = true;
                else this.renderSequencer();
            }
        } else if (kind === 'classicGrid') {
            // .history-section : hôte STABLE de #progression-sections en mode classique (jamais
            // déplacé, contrairement à la loupe qui le déménage dans #grid-zoom-host) — même variable
            // CSS que la loupe (--grid-zoom-scale-v, voir style.css), mais posée ici sur un ancêtre
            // DIFFÉRENT : .chord-grid hérite de celui qui le contient réellement à l'instant, jamais
            // les deux à la fois.
            const host = document.querySelector('.history-section');
            if (host) host.style.setProperty('--grid-zoom-scale-v', String(this.classicGridZoomLevelY));
            if (this._zoomPinchActive) this._gridZoomRenderPending = true;
            else this.loadProgression();
        } else if (kind === 'voiceLeading') {
            // Contrairement aux deux cas ci-dessus, PAS de calc() CSS direct sur les dimensions ici :
            // le panneau est un SVG, ses coordonnées sont calculées et posées une fois pour toutes à
            // la construction (voir buildVoiceLeadingPanelHtml) — les deux axes ont donc besoin d'un
            // vrai nouveau rendu, jamais d'un simple redimensionnement de calc(). Pendant un pincement,
            // ce vrai rendu reste différé (~150ms, voir _startZoomPinchFlushLoop) : sans retour visuel
            // intermédiaire, le panneau restait figé tout du long puis sautait d'un coup, perçu comme
            // saccadé et lent (retour utilisateur). --vl-zoom-scale-x/-y (voir style.css) applique un
            // transform: scale() de secours, relatif à la DERNIÈRE construction réelle
            // (_voiceLeadingBuiltZoomX/Y) plutôt qu'à l'échelle absolue — fluide en continu, la vraie
            // reconstruction repart de 1 (voir buildVoiceLeadingPanelHtml).
            if (this._zoomPinchActive) {
                this._voiceLeadingZoomRenderPending = true;
                const panel = document.querySelector('.voice-leading-panel');
                if (panel) {
                    panel.style.setProperty('--vl-zoom-scale-x', String(this.voiceLeadingZoomLevelX / this._voiceLeadingBuiltZoomX));
                    panel.style.setProperty('--vl-zoom-scale-y', String(this.voiceLeadingZoomLevelY / this._voiceLeadingBuiltZoomY));
                }
            } else {
                this.loadProgression();
            }
        } else {
            const host = document.getElementById('grid-zoom-host');
            if (host) host.style.setProperty('--grid-zoom-scale-v', String(this.gridZoomLevelY));
            if (this._zoomPinchActive) this._gridZoomRenderPending = true;
            else this.loadProgression();
        }
    }

    // Échelle horizontale du séquenceur COMPACT (hors loupe séquenceur/loupe grille, voir
    // showInlineSeqZoom dans renderSequencer) : même pas que les échelles des fenêtres agrandies
    // mais bornée plus bas (voir SEQ_INLINE_ZOOM_MIN), mémorisée à part et sans effet tant qu'on
    // n'y touche pas (1 par défaut, exactement l'affichage actuel — retour utilisateur).
    adjustSeqInlineZoom(delta) {
        const next = Math.round(Math.max(SEQ_INLINE_ZOOM_MIN, Math.min(ZOOM_LEVEL_MAX, this.seqInlineZoomLevelX + delta)) * 100) / 100;
        this.seqInlineZoomLevelX = next;
        localStorage.setItem(SEQ_INLINE_ZOOM_LEVEL_X_KEY, String(next));
        this.renderSequencer();
        hasUnsavedChanges = true; // voir adjustZoom : conservé dans le morceau, Enregistrer/Ctrl+S le rend permanent
    }

    // Position verticale du pointeur -> pourcentage d'intensité (0 en bas, 100 en haut) pour LA croche
    // de cette barre (voir data-step, mode studio) — mutation directe du fill en cours de glissé plutôt
    // qu'un renderSequencer() à chaque mouvement (même convention que le reste du séquenceur : un seul
    // rendu complet à la FIN du geste, pas pendant).
    applyStudioVelocityFromClientY(bar, clientY) {
        const rect = bar.getBoundingClientRect();
        let pct = Math.round(((rect.bottom - clientY) / rect.height) * 100);
        pct = Math.max(0, Math.min(100, pct));
        this.intensityPerStep[+bar.dataset.step] = pct;
        const fill = bar.querySelector('.seq-vel-fill');
        if (fill) fill.style.height = pct + '%';
        // Valeur chiffrée affichée EN PLUS de la hauteur du remplissage (retour utilisateur : la
        // hauteur seule manque de précision pour repérer la valeur exacte) — mise à jour en direct
        // pendant le glissé, comme le remplissage juste au-dessus.
        const valueEl = bar.querySelector('.seq-vel-value span');
        if (valueEl) valueEl.textContent = pct + '%';
    }

    // Menu contextuel d'un accord de la grille (« Séquenceur ») : le charge dans le panneau Accord
    // (comme Modifier) ET ouvre directement le séquenceur en grand, pour éviter l'aller-retour
    // modifier-puis-ouvrir-le-panneau quand on veut juste peaufiner son rythme.
    openSequencerFor(section, index) {
        this.editChord(section, index);
        this.seqOpen = true;
        document.getElementById('toggle-sequencer').classList.add('active');
        document.getElementById('seq-zoom').hidden = false;
        this.renderSequencer();
        this.updateGlobalUndoRedoButtons();
        document.getElementById('arp-sequencer').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    renderSequencer() {
        const host = document.getElementById('arp-sequencer');
        if (!host) return;
        host.hidden = !this.seqOpen;
        // Retour visuel (curseur, voir style.css) tant que la pipette de motif entre voies reste armée
        // (voir toggleSeqRowPipette) : posé ici, pas dans toggleSeqRowPipette/applySeqRowPipette
        // eux-mêmes, pour rester synchronisé à CHAQUE rendu quelle que soit la méthode qui l'a déclenché.
        host.classList.toggle('seq-row-pipette-active', !!this.seqRowPipette);
        // Mode studio (voir #toggle-studio-mode) : réglage global mémorisé (this.studioMode), pas remis
        // à zéro à chaque accord édité — resynchronise l'apparence du bouton à CHAQUE rendu, quelle que
        // soit la méthode qui l'a déclenché (comme seq-row-pipette-active juste au-dessus).
        const studioModeBtn = document.getElementById('toggle-studio-mode');
        if (studioModeBtn) studioModeBtn.classList.toggle('active', this.studioMode);
        // Toute reconstruction des .seq-cell rend caduque le suivi des doigts actifs par élément (voir
        // this._seqActiveTouchIds/onSeqPointerDown) : un doigt encore posé pendant un pincer-zoomer (voir
        // setupPinchZoom) peut perdre son pointerup/pointercancel si sa case a été détruite entretemps
        // (plus aucun ancêtre DOM à traverser) — sans ce nettoyage, son id resterait bloqué dans le
        // suivi, faisant à tort passer le PROCHAIN tap à un seul doigt pour un second doigt de pince.
        this._seqActiveTouchIds.clear();
        if (!this.seqOpen) return;
        this.seqRenderGen++; // voir déclaration : identifie ce rendu pour les étiquettes éditables ci-dessous
        // Position de défilement horizontal AVANT de reconstruire tout le HTML (voir plus bas, mode
        // continu) : préservée d'un rendu à l'autre (peindre une note ne doit pas ramener la vue au
        // début), sinon centrée sur l'accord édité par défaut (ni perdue dans le contexte gauche).
        // Seulement si le rendu PRÉCÉDENT était LUI AUSSI en mode continu : sinon son scrollLeft (0,
        // un rendu normal ne débordant jamais) n'a rien à voir avec la position à retrouver ici — voir
        // le tout premier rendu continu d'un accord (ex. juste ouvert dans la loupe grille), qui
        // partait par erreur de 0 au lieu du centrage par défaut sur l'accord édité.
        // .seq-grid-continuous OU .seq-grid-wide (voir wideCompact plus bas) : les deux débordent et
        // défilent, donc les deux méritent cette préservation — seul .seq-grid-continuous change en
        // plus la hauteur des lignes (contexte voisin), .seq-grid-wide n'est qu'un simple repère.
        const prevScrollEl = host.querySelector('.seq-scroll');
        const prevGridEl = prevScrollEl ? prevScrollEl.querySelector('.seq-grid-continuous, .seq-grid-wide') : null;
        const wasPrevContinuous = !!prevGridEl;
        // Idem pour l'accord édité : basculer sur un accord VOISIN (clic sur le contexte grisé, voir
        // .seq-ctx-nav) doit recentrer la vue sur ce nouvel accord comme à sa toute première ouverture
        // — conserver le scrollLeft brut de l'ancien montrerait un bout de piste sans rapport (chaque
        // accord a son propre découpage prev/actuel/next, donc sa propre colonne "centre").
        const samePreviousChord = wasPrevContinuous && parseInt(prevGridEl.dataset.editingIndex) === this.editingIndex;
        const prevScrollLeft = samePreviousChord ? prevScrollEl.scrollLeft : null;
        // Avant toute chose : une note libre jouée assez longtemps depuis le dernier rendu complète-
        // t-elle désormais l'accord (voir reevaluateExtraNoteUpgrades) ? Peut changer la qualité/le
        // nombre de voix, donc AVANT de (re)synchroniser le motif ci-dessous.
        this.reevaluateExtraNoteUpgrades();
        const chord = this.syncSeqPatternForCurrentChord();

        const midis = chord.getSeqMidiNotes();
        const noteNames = chord.getSeqDisplayNotes(this.useFlatsForRoot(chord.root));
        const roleMap = chord.getRoleMap(); // même code couleur que le clavier : fondamentale/tierce/quinte/7e/extensions
        const voices = midis.length;
        const steps = chord.beats * SEQ_STEPS_PER_BEAT;
        const { pattern, tie } = this.getLiveSeqPattern(chord);

        // Loupe grille (voir gridZoomOpen) : axe vertical en demi-tons ABSOLUS plutôt qu'en voix
        // relatives à CET accord, pour voir d'un coup d'œil comment le voicing se place par rapport
        // aux accords voisins de la section — repère direct pour l'ajuster (retour utilisateur).
        // Uniquement quand un accord est réellement en édition (this.editingIndex) : sinon aucun
        // accord de référence n'existe pour comparer, on retombe sur l'affichage normal ci-dessous.
        const continuous = this.gridZoomOpen && this.editingIndex != null;
        let prevMidiSet = new Set(), nextMidiSet = new Set();
        // TOUS les accords de la partie active, avant/après celui en édition (pas seulement le plus
        // proche, retour utilisateur : pouvoir défiler/cliquer directement n'importe quel accord de la
        // grille, pas uniquement son voisin immédiat) — rythme/motif RÉELS de chacun, affichés en
        // lecture seule de part et d'autre (voir la boucle de rendu plus bas), concaténés dans l'ordre
        // chronologique de la grille. `colStart` : décalage cumulé (en cases) de CE segment au sein de
        // son côté (prev ou next), posé une fois ici plutôt que recalculé à chaque ligne/case.
        let prevSegs = [], nextSegs = [];
        let prevSteps = 0, nextSteps = 0;
        if (continuous) {
            const ctxSections = loadProgressionSections();
            const ctxSec = ctxSections[this.activeSection];
            const history = (ctxSec && ctxSec.chords) || [];
            const buildSeg = (data, index) => {
                const c = new Chord(data.root, data.quality, beatsFromData(data), data.inversion, data.drop, octaveFromData(data), data.bass, null, data.extraNotes);
                const segMidis = c.getSeqMidiNotes();
                const resolved = this.resolveSeqPatternForData(c, data);
                return { data, midis: segMidis, midiSet: new Set(segMidis), pattern: resolved.pattern, tie: resolved.tie, steps: c.beats * SEQ_STEPS_PER_BEAT, index };
            };
            let offset = 0;
            for (let i = 0; i < this.editingIndex; i++) {
                const seg = buildSeg(history[i], i);
                seg.colStart = offset;
                offset += seg.steps;
                prevSegs.push(seg);
            }
            prevSteps = offset;
            offset = 0;
            for (let i = this.editingIndex + 1; i < history.length; i++) {
                const seg = buildSeg(history[i], i);
                seg.colStart = offset;
                offset += seg.steps;
                nextSegs.push(seg);
            }
            nextSteps = offset;
            prevSegs.forEach(seg => seg.midiSet.forEach(m => prevMidiSet.add(m)));
            nextSegs.forEach(seg => seg.midiSet.forEach(m => nextMidiSet.add(m)));
        }

        // Ordre d'AFFICHAGE des lignes (la plus aiguë en haut, comme un piano-roll), à ne jamais
        // confondre avec l'index de voix (identité stable utilisée par le motif/pattern — voir
        // getSeqMidiNotes) : la basse, si présente, garde toujours le DERNIER index mais doit
        // s'afficher tout en BAS, pas en haut — d'où ce tri séparé, purement visuel.
        // `rowOrder` : { voice, midi } du plus aigu au plus grave. voice=-1 = ligne de CONTEXTE (une
        // hauteur jouée par l'accord précédent/suivant mais pas par celui-ci) : affichée en lecture
        // seule (label + petit repère gauche/droite), sans case ni note éditable.
        let rowOrder;
        if (continuous && (prevMidiSet.size || nextMidiSet.size)) {
            const allMidis = new Set(midis);
            prevMidiSet.forEach(m => allMidis.add(m));
            nextMidiSet.forEach(m => allMidis.add(m));
            rowOrder = Array.from(allMidis).sort((a, b) => b - a).map(midi => ({ voice: midis.indexOf(midi), midi }));
        } else {
            rowOrder = Array.from({ length: voices }, (_, i) => i)
                .sort((a, b) => midis[b] - midis[a])
                .map(i => ({ voice: i, midi: midis[i] }));
        }
        const rowCount = rowOrder.length;

        // Un accord qui dure plusieurs mesures dépassait la largeur d'une « page » (une mesure en
        // 4/4, deux en 2/4, une seule dès que la mesure est plus longue que 4 temps — voir
        // seqPageBars) : sur mobile, un glissé pour étirer une note se confondait avec le geste de
        // scroll natif du navigateur, d'où historiquement un vrai SAUT de page (boutons ‹ ›) plutôt
        // qu'un scroll continu. Même geste réglé depuis pour la vue continue de la loupe grille
        // ci-dessous (colonnes à largeur fixe + touch-action dédié par élément éditable) : réutilisé
        // ici (voir wideCompact) pour un accord compact qui déborde d'une page — retour utilisateur :
        // il fallait sinon zoomer arrière (H-) juste pour voir la mesure suivante avant d'y étirer
        // une note, alors qu'un vrai défilement (à la molette, au doigt, ou auto pendant le glissé
        // près du bord — voir _updateSeqAutoScroll) est bien plus direct.
        const beatsPerBar = this.beatsPerBar();
        const stepsPerBar = beatsPerBar * SEQ_STEPS_PER_BEAT;
        const seqZoomed = this.seqZoomOpen || this.gridZoomOpen;
        // Version compacte (hors loupe séquenceur ET hors vue continue de la loupe grille, voir
        // plus haut) : seule celle-ci a droit au réglage d'échelle horizontale dédié
        // (adjustSeqInlineZoom/showInlineSeqZoom plus bas) — la loupe séquenceur ET la vue continue
        // (séquenceur épinglé de la loupe grille) partagent le même réglage (seqZoomLevelX, voir
        // seqZoomed plus haut) : deux hôtes différents pour la même « vue agrandie » du séquenceur.
        const showInlineSeqZoom = !this.seqZoomOpen && !continuous;
        const seqHZoom = seqZoomed ? this.seqZoomLevelX : (showInlineSeqZoom ? this.seqInlineZoomLevelX : 1);
        const stepsPerPage = seqPageBars(beatsPerBar, seqZoomed, seqHZoom) * stepsPerBar;
        const totalPages = continuous ? 1 : Math.max(1, Math.ceil(steps / stepsPerPage));
        // Version compacte qui déborde d'une page : affiche tout l'accord d'un coup (comme la vue
        // continue), scrollable, plutôt qu'une seule page à la fois — voir le commentaire plus haut.
        const wideCompact = !continuous && totalPages > 1;
        this.seqPage = Math.min(Math.max(0, this.seqPage), totalPages - 1);
        // pageStart/pageEnd ne servent plus qu'à borner la fenêtre affichée pour une page COMPACTE qui
        // tient déjà en entier (cas normal, majoritaire) : dès que le contenu déborde (continu ou
        // wideCompact), tout s'affiche d'un coup et c'est le défilement qui fait le reste.
        const pageStart = (continuous || wideCompact) ? 0 : this.seqPage * stepsPerPage;
        const pageEnd = (continuous || wideCompact) ? steps : Math.min(steps, pageStart + stepsPerPage);
        const pageSteps = pageEnd - pageStart;

        // La colonne des noms de voix (max-content) se resserre à la largeur réelle du texte affiché
        // (ex. "C3", "F#3") au lieu d'une largeur fixe généreuse qui laissait un vide à gauche.
        // Colonnes de pas en 1fr PUR, sans largeur plancher, UNIQUEMENT quand tout tient déjà dans une
        // page (cas normal) : une page doit alors TOUJOURS tenir sans le moindre débordement, quelle
        // que soit la largeur d'écran — un plancher, même modeste, suffisait à forcer un débordement
        // (et donc un vrai scroll tactile) sur les téléphones étroits pour une simple mesure en 4/4.
        // data-page-start/steps : lus par updateSeqPlayhead pour savoir si le pas en cours de lecture
        // tombe dans la page affichée (et à quelle colonne), sans dupliquer ce calcul côté lecture.
        // .seq-grid-continuous : lignes plus basses (voir style.css) pour laisser tenir les demi-tons
        // supplémentaires du contexte sans faire déborder la loupe grille (retour utilisateur) —
        // wideCompact n'a pas de contexte voisin à faire tenir, garde donc la hauteur de ligne normale.
        // Colonnes à largeur FIXE (pas 1fr) dès que ça déborde (continu OU wideCompact) : le contenu
        // s'ajoute à la largeur totale plutôt que de se répartir dans l'espace visible, d'où le
        // défilement horizontal voulu (voir .seq-scroll-continuous/.seq-scroll-wide ci-dessous et dans
        // style.css) — en continu, seule la mesure éditée (au milieu) reste éditable, le contexte n'est
        // que lecture seule ; en wideCompact, tout l'accord affiché reste éditable (pas de contexte).
        const continuousCls = continuous ? ' seq-grid-continuous' : '';
        // .seq-grid-wide : pas de style propre (contrairement à .seq-grid-continuous, qui resserre la
        // hauteur des lignes) — juste un repère pour retrouver ce rendu au prochain (voir
        // prevGridEl/wasPrevScrollable plus haut dans ce rendu) et préserver son défilement.
        const wideCls = wideCompact ? ' seq-grid-wide' : '';
        const scrollCls = continuous ? ' seq-scroll-continuous' : (wideCompact ? ' seq-scroll-wide' : '');
        const colOffset = continuous ? prevSteps : 0;
        const totalCols = continuous ? (prevSteps + pageSteps + nextSteps) : pageSteps;
        // Largeur de case FIXE (voir commentaire plus haut) mise à l'échelle par seqHZoom : sans quoi
        // les boutons de zoom horizontal (zoom-axis-group, voir plus bas) resteraient sans le moindre
        // effet visible en vue continue/wideCompact — seuls modes où ce réglage joue sur une largeur
        // de case en pixels plutôt que sur le nombre de mesures par page. Base doublée sur ordinateur
        // (retour utilisateur : la loupe grille est bien plus large qu'un téléphone, une base fixe
        // unique laissait tout le côté droit vide dès qu'un accord n'avait que peu de temps) — même
        // seuil (900px) que .col-left/.col-right en CSS et les autres bascules bureau/mobile du script.
        // window.innerWidth (pas un média CSS) : cette largeur de case est un NOMBRE consommé par
        // scrollLeft juste plus bas (colOffset * continuousColPx), pas seulement injecté dans le HTML.
        const continuousColBase = window.innerWidth > 899 ? 28 : 14;
        const continuousColPx = continuousColBase * seqHZoom;
        const colTemplate = (continuous || wideCompact)
            ? `max-content repeat(${totalCols}, ${continuousColPx}px)`
            : `max-content repeat(${pageSteps}, 1fr)`;
        let html = `<div class="seq-scroll${scrollCls}"><div class="seq-grid${continuousCls}${wideCls}" data-page-start="${pageStart}" data-page-steps="${pageSteps}" data-col-offset="${colOffset}" data-editing-index="${this.editingIndex}" style="grid-template-columns: ${colTemplate};">`;

        // Cases de la grille : zones de clic/glisser (toujours présentes, sous les notes visuelles).
        // Placement explicite (grid-row/grid-column) sur TOUT le monde : les notes ci-dessous se
        // superposent volontairement aux cases, et le placement automatique de la grille CSS
        // évite les zones déjà occupées par un élément placé explicitement — sans ça, les cases
        // se retrouveraient décalées pour « fuir » les notes au lieu de rester dessous.
        // Chaque paire de cases (double-croches s pair/impair) partage visuellement le même
        // rectangle qu'avant (voir .seq-cell-a/.seq-cell-b dans le CSS) : la résolution de clic/
        // glisser est fine, mais rien ne change à l'œil tant qu'une note n'utilise pas cette finesse.
        // `data-step` garde l'indice ABSOLU (pas relatif à la page) : le glissé/étirement (voir
        // onSeqPointerDown et findSeqStepAt, qui ne connaissent que les cases réellement dans le
        // DOM, donc celles de la page affichée) continue de raisonner sur le motif complet.
        // Les voix "notes libres" (voir addSequencerNote) occupent toujours les indices juste après
        // les voix normales de la qualité, avant la basse éventuelle (voir _computeVoices) — leur
        // étiquette devient un champ éditable au lieu d'un simple texte, seul endroit où renommer une
        // note directement (voir commitExtraNoteLabel). `rowOrder` les replace déjà au bon endroit
        // visuellement (tri par hauteur), sans rien à faire de spécial ici pour ça.
        const extraStart = chord.getIntervals().length;
        const extraEnd = extraStart + chord.extraNotes.length;

        // Peint le rythme réel d'UN segment voisin (lecture seule) sur la ligne courante, à sa colonne
        // (seg.colStart, voir plus haut) — appelé une fois par segment de chaque côté ci-dessous.
        // Rien n'est rendu pour une croche silencieuse : seule la présence de ce petit repère signale
        // que ça sonne, pas besoin d'un état "off" visuellement distinct ici.
        const paintCtxSeg = (seg, row, colBase, rowIndex) => {
            const segVoice = seg.midis.indexOf(row.midi);
            if (segVoice < 0) return '';
            let out = '';
            for (let s = 0; s < seg.steps; s++) {
                if (!seg.pattern[s].includes(segVoice)) continue;
                const beatStart = (s % SEQ_STEPS_PER_BEAT === 0) ? ' beat-start' : '';
                out += `<div class="seq-ctx-cell${beatStart}" style="grid-row:${rowIndex}; grid-column:${colBase + seg.colStart + s + 2};"></div>`;
            }
            return out;
        };

        let rowIndex = 0;
        for (const row of rowOrder) {
            rowIndex++;
            const r = row.voice;
            // Repère discret (voir style.css .seq-label-echo-*) : cette hauteur est aussi jouée par
            // l'accord précédent/suivant — visible aussi bien sur une ligne de contexte que sur une
            // vraie voix de l'accord en édition, pour situer d'un coup d'œil ce qui reste commun.
            const echoCls = (prevMidiSet.has(row.midi) ? ' seq-label-echo-prev' : '') + (nextMidiSet.has(row.midi) ? ' seq-label-echo-next' : '');
            if (r < 0) {
                // Ligne de CONTEXTE : une hauteur jouée par un accord voisin mais pas par celui-ci —
                // juste le nom de la note, en lecture seule, aucune case ni note éditable dessous
                // pour l'accord en édition — mais le rythme du voisin, lui, s'affiche toujours.
                const ctxName = midiToDisplayName(row.midi, this.useFlatsForRoot(chord.root));
                html += `<div class="seq-label seq-label-context${echoCls}" style="grid-row:${rowIndex}; grid-column:1;">${ctxName}</div>`;
            } else if (r >= extraStart && r < extraEnd) {
                const extraIdx = r - extraStart;
                html += `<div class="seq-label seq-label-extra${echoCls}" style="grid-row:${rowIndex}; grid-column:1;">
                    <input type="text" class="seq-label-input" data-extra-index="${extraIdx}" data-voice="${r}" value="${escapeHtml(noteNames[r])}" title="Note libre : tape une hauteur (ex. E3), ou vide pour la supprimer" autocomplete="off" autocapitalize="off" spellcheck="false">
                </div>`;
            } else {
                html += `<div class="seq-label${echoCls}" data-voice="${r}" title="Cliquer pour écouter cette note" style="grid-row:${rowIndex}; grid-column:1;">${noteNames[r]}</div>`;
            }

            // Contexte GAUCHE (TOUS les accords avant celui édité, voir prevSegs plus haut) : rythme
            // réel de chacun, lecture seule — jamais de .seq-cell (classe réservée aux cases éditables,
            // voir onSeqPointerDown qui la cible spécifiquement).
            for (const seg of prevSegs) html += paintCtxSeg(seg, row, 0, rowIndex);
            // Contexte DROIT (TOUS les accords après) : même principe, décalé après l'accord édité.
            for (const seg of nextSegs) html += paintCtxSeg(seg, row, colOffset + pageSteps, rowIndex);

            if (r < 0) continue; // ligne de contexte pure : rien d'éditable pour l'accord en cours ici
            for (let s = pageStart; s < pageEnd; s++) {
                const col = colOffset + (s - pageStart);
                const beatStart = (s % SEQ_STEPS_PER_BEAT === 0) ? ' beat-start' : '';
                const pairCls = (s % 2 === 0) ? ' seq-cell-a' : ' seq-cell-b';
                // Croche au début ou à la fin d'une note : indice visuel discret (curseur) qu'un
                // glissé depuis là peut étirer/raccourcir la note (pas de poignée visible séparée).
                // Se base sur le motif COMPLET (pas la page) : une note qui continue sur la page
                // suivante n'affiche jamais ce curseur à la coupure, seul son vrai bord le fait.
                const isEdge = pattern[s].includes(r) && (
                    !(s > 0 && pattern[s - 1].includes(r) && tie[s].includes(r)) ||
                    !(s + 1 < steps && pattern[s + 1].includes(r) && tie[s + 1].includes(r))
                );
                const edgeCls = isEdge ? ' seq-cell-edge' : '';
                const onCls = pattern[s].includes(r) ? ' on' : '';
                html += `<div class="seq-cell${pairCls}${beatStart}${edgeCls}${onCls}" data-step="${s}" data-voice="${r}" style="grid-row:${rowIndex}; grid-column:${col + 2};"></div>`;
            }
        }

        // Notes posées par-dessus : les croches actives et LIÉES d'une même voix ne forment qu'un
        // seul bloc (pilule si étiré au glissé, petit carré si une seule croche isolée) — deux notes
        // adjacentes mais non liées (deux taps séparés) restent deux blocs bien distincts.
        // Chaque note reste purement visuelle (pointer-events:none) : c'est la case en dessous qui
        // gère le clic. Un glissé démarré sur sa première ou dernière croche l'étire/la raccourcit
        // depuis ce bord (voir onSeqPointerDown) ; ailleurs, un glissé peint/efface comme avant.
        let notesHtml = '';
        rowIndex = 0;
        for (const row of rowOrder) {
            rowIndex++;
            const r = row.voice;
            if (r < 0) continue; // ligne de contexte : aucune note éditable à dessiner ici
            let s = pageStart;
            while (s < pageEnd) {
                if (!pattern[s].includes(r)) { s++; continue; }
                const runStart = s;
                // Une note déjà en cours dès le premier pas visible de la page (liée à la croche
                // précédente, hors champ) est affichée « coupée » à ce bord plutôt que ronde, pour ne
                // pas laisser croire qu'elle commence ici (voir .seq-note.clip-start).
                const clipStart = (runStart === pageStart) && runStart > 0
                    && pattern[runStart - 1].includes(r) && tie[runStart].includes(r);
                s++;
                while (s < steps && pattern[s].includes(r) && tie[s].includes(r)) s++;
                const trueRunEnd = s - 1;
                // Idem à l'autre bout : la note continue au-delà de la page affichée -> coupée aussi
                // (voir .seq-note.clip-end), et le rendu s'arrête au dernier pas visible.
                const runEnd = Math.min(trueRunEnd, pageEnd - 1);
                const clipEnd = trueRunEnd > runEnd;
                s = runEnd + 1;
                const runLen = runEnd - runStart + 1;
                const shape = runLen > 1 ? 'run' : 'single';
                const role = roleMap[midis[r]] || 'ext';
                const isSelected = this.seqSelections.some(sel => sel.voice === r && sel.start === runStart);
                const sel = isSelected ? ' selected' : '';
                const clipCls = (clipStart ? ' clip-start' : '') + (clipEnd ? ' clip-end' : '');
                // Si la note finit sur la 2e moitié d'un rectangle (voir .seq-cell-b), la case de
                // fond s'arrête 4px avant le bord de la piste (son margin-right) pour laisser le
                // vrai espacement avant la paire suivante — sans ce même retrait, la pilule (qui
                // occupe toute la piste) dépasserait légèrement de ce rectangle de fond. Pas de
                // retrait si la note est coupée par la page : elle doit occuper toute la largeur.
                const trimEnd = (!clipEnd && runEnd % 2 === 1) ? ' margin-right:4px;' : '';
                // Petit repère à l'attaque (le tout début de la pilule, là où la note est réellement
                // pincée) pour la distinguer de sa partie tenue — seulement sur une vraie note (pas une
                // croche isolée, rien à distinguer) dont le début est réellement visible sur cette page
                // (une note coupée par la page — voir clip-start — n'attaque pas ici, juste continue).
                const headEl = (shape === 'run' && !clipStart) ? '<span class="seq-note-head"></span>' : '';
                notesHtml += `<div class="seq-note ${shape} role-${role}${sel}${clipCls}" data-voice="${r}" data-start="${runStart}" data-end="${trueRunEnd}" style="grid-row:${rowIndex}; grid-column:${colOffset + runStart - pageStart + 2} / span ${runLen};${trimEnd}">${headEl}</div>`;
            }
        }
        html += notesHtml;

        // Numéros de temps en petit sous la grille (1, 2, 3... à chaque début de temps, recommence à
        // 1 à chaque mesure) : pour repérer d'un coup d'œil où tombe chaque temps, comme les numéros
        // de mesure sous la grille d'accords principale. data-beat-index : repère stable (indépendant
        // de la page/du décalage affiché) pour _highlightSeqBeatLabel, qui met ce chiffre en évidence
        // au fur et à mesure qu'un étirement/peindre en cours l'atteint (retour utilisateur : "je ne
        // vois pas exactement où est le temps 4" pendant un glissé).
        const beatRow = rowCount + 1;
        let beatLabelsHtml = '';
        for (let s = pageStart; s < pageEnd; s += SEQ_STEPS_PER_BEAT) {
            const beatIndex = Math.floor(s / SEQ_STEPS_PER_BEAT);
            const beatNum = (beatIndex % beatsPerBar) + 1;
            // Le chiffre est dans un <span> à part, centré sur le VRAI début du temps (voir .seq-beat-num
            // en CSS) plutôt que posé tel quel dans sa case (qui l'aurait calé à GAUCHE du repère, son
            // texte partant de là et s'étirant vers la droite) : à côté du trait de contretemps, lui
            // bien centré, ce calage à gauche donnait une impression d'asymétrie (retour utilisateur :
            // "les traits sont centrés, mais plus les numéros").
            beatLabelsHtml += `<div class="seq-beat-label" data-beat-index="${beatIndex}" style="grid-row:${beatRow}; grid-column:${colOffset + s - pageStart + 2};"><span class="seq-beat-num">${beatNum}</span></div>`;
            // Contretemps (le "et" du temps, 2e croche — voir SEQ_STEPS_PER_BEAT) : petit trait estompé,
            // jamais un chiffre, pour rester bien plus discret que le numéro de temps lui-même (retour
            // utilisateur : repère discret, pas une nouvelle ligne de chiffres à lire). Centré sur la
            // frontière RÉELLE entre les deux croches du temps (le vrai milieu) plutôt que calé dans la
            // seule colonne de la 2e croche : la case s'étend sur les deux colonnes qui encadrent cette
            // frontière (offbeatStep-1 et offbeatStep) et le trait est centré dans cette case à deux
            // colonnes — sans ça, le repère paraît décalé vers la 2e croche au lieu d'être pile au
            // milieu (retour utilisateur : "pas aligné... pas à la moitié").
            const offbeatStep = s + SEQ_STEPS_PER_BEAT / 2;
            if (offbeatStep < pageEnd) {
                beatLabelsHtml += `<div class="seq-beat-offbeat" style="grid-row:${beatRow}; grid-column:${colOffset + offbeatStep - pageStart + 1} / span 2;"><span class="offbeat-dash"></span></div>`;
            }
        }
        html += beatLabelsHtml;

        // Mode studio (voir #toggle-studio-mode) : une barre de vélocité par croche où AU MOINS une voix
        // attaque (jamais une simple continuation liée) — une seule valeur par croche, partagée par
        // toutes les voix qui y sonnent (retour utilisateur : pas de réglage par voix). Glissée
        // verticalement (voir applyStudioVelocityFromClientY) pour un réglage fin façon GarageBand ;
        // double-clic efface le réglage propre à cette croche pour revenir à l'intensité globale de
        // l'accord (#intensity). Mêmes colonnes que .seq-beat-label juste au-dessus, une ligne plus bas.
        if (this.studioMode) {
            const velRow = beatRow + 1;
            const chordIntensity = +document.getElementById('intensity').value;
            let velHtml = `<div class="seq-vel-lane-label" style="grid-row:${velRow}; grid-column:1;">Studio</div>`;
            for (let s = pageStart; s < pageEnd; s++) {
                const hasAttack = pattern[s].some(v => !tie[s].includes(v));
                if (!hasAttack) continue;
                const val = (this.intensityPerStep[s] != null) ? this.intensityPerStep[s] : chordIntensity;
                velHtml += `<div class="seq-vel-bar" data-step="${s}" style="grid-row:${velRow}; grid-column:${colOffset + s - pageStart + 2};" title="Intensité de cette croche — glisser pour régler, double-clic pour revenir à l'intensité de l'accord">
                    <div class="seq-vel-fill" style="height:${val}%;"></div>
                    <div class="seq-vel-value"><span>${val}%</span></div>
                </div>`;
            }
            html += velHtml;
        }

        // Curseur de lecture (masqué par défaut, positionné/affiché par updateSeqPlayhead pendant la
        // lecture) : ne couvre que les rangées de voix (contexte compris), pas celle des temps en dessous.
        html += `<div class="seq-playhead" style="grid-row: 1 / span ${rowCount}; grid-column: 2 / span 1;"></div>`;

        // Zones cliquables couvrant TOUT le contexte gauche/droite (accords voisins grisés, voir plus
        // haut) : cliquer n'importe où dedans (pas seulement pile sur une note grisée, souvent fine)
        // bascule l'édition sur CET accord précis (voir le câblage plus bas, qui rappelle
        // editChordFromGridZoom) — le rectangle orangé de la grille suit alors automatiquement,
        // puisque c'est la même méthode que pour un clic direct dans la grille (retour utilisateur :
        // pouvoir défiler/cliquer directement N'IMPORTE QUEL accord de la grille sans quitter le
        // séquenceur, pas seulement le voisin immédiat — une zone par accord, chacune ciblant son
        // propre index plutôt qu'une seule grande zone qui ne menait qu'au plus proche). Toute la
        // hauteur des voix (comme .seq-playhead), jamais la ligne des temps en dessous.
        const ctxNavLabel = (seg) => `${noteNameForPc(NOTES.indexOf(seg.data.root), this.useFlatsForRoot(seg.data.root))}${QUALITY_LABEL[seg.data.quality] ?? ''}`;
        if (continuous) {
            prevSegs.forEach(seg => {
                html += `<div class="seq-ctx-nav seq-ctx-nav-prev" data-target-index="${seg.index}" style="grid-row: 1 / span ${rowCount}; grid-column: ${seg.colStart + 2} / span ${seg.steps};" title="Modifier ${escapeHtml(ctxNavLabel(seg))}"></div>`;
            });
            nextSegs.forEach(seg => {
                html += `<div class="seq-ctx-nav seq-ctx-nav-next" data-target-index="${seg.index}" style="grid-row: 1 / span ${rowCount}; grid-column: ${colOffset + pageSteps + seg.colStart + 2} / span ${seg.steps};" title="Modifier ${escapeHtml(ctxNavLabel(seg))}"></div>`;
            });
        }

        html += `</div></div>`;

        // Navigation par page (uniquement si l'accord déborde d'une page, voir wideCompact) : un vrai
        // défilement désormais, pas un saut avec reconstruction — voir le câblage plus bas
        // (updatePageNav), qui corrige l'étiquette et l'état désactivé juste après le montage, à
        // partir de la position RÉELLE de défilement plutôt que d'un index de page.
        if (totalPages > 1) {
            const totalBars = Math.ceil(steps / stepsPerBar);
            html += `<div class="seq-page-nav">
                <button type="button" id="seq-page-prev" class="icon-btn" title="Mesure précédente" aria-label="Mesure précédente">${svgIcon('chevron-left')}</button>
                <span class="seq-page-label" id="seq-page-label">Mesure 1 / ${totalBars}</span>
                <button type="button" id="seq-page-next" class="icon-btn" title="Mesure suivante" aria-label="Mesure suivante">${svgIcon('chevron-right')}</button>
            </div>`;
        }
        // Les préréglages rythmiques (Tenu, Noire...) se choisissent désormais uniquement via le
        // menu déroulant Lecture ; cette rangée ne garde que l'écoute directe et le nettoyage.
        const hasSelection = this.seqSelections.length > 0;
        const countSuffix = this.seqSelections.length > 1 ? ` (${this.seqSelections.length})` : '';
        // Ordre : transport (lecture/stop/boucle) -> actions sur le motif (ajouter/tout supprimer/
        // taper le rythme/pipette/supprimer la sélection) -> zoom H/V en TOUT DERNIER (retour
        // utilisateur : au milieu, ça coupait la suite logique des actions en deux). Le zoom est un
        // réglage d'AFFICHAGE, pas une action sur le motif — même place (tout à droite de sa rangée)
        // que partout ailleurs dans l'appli (en-tête de la grille, panneau Conduite de voix).
        // #seq-play ne priorise une plage à boucler (voir plus bas) qu'EN LOUPE (grille ou séquenceur) :
        // là, on navigue vraiment dans le contexte de toute la grille, la plage a donc un sens. Le
        // séquenceur COMPACT (hors loupe) reste toujours lié au seul accord en édition, quelle que soit
        // une plage définie par ailleurs sur la grille (retour utilisateur : le bouton lecture du petit
        // séquenceur se retrouvait à tort à jouer toute la grille).
        const seqLoopRangeActive = !!this.loopRange && (this.gridZoomOpen || this.seqZoomOpen);
        html += `<div class="seq-presets">
            <button type="button" id="seq-play" class="btn-prog seq-icon-btn${seqLoopRangeActive ? ' btn-loop-range' : ''}" title="${seqLoopRangeActive ? 'Lire la plage à boucler' : 'Lecture'}" aria-label="${seqLoopRangeActive ? 'Lire la plage à boucler' : 'Lecture'}">${svgIcon('play')}</button>
            <button type="button" id="seq-stop" class="btn-stop seq-icon-btn" title="Stop" aria-label="Stop">${svgIcon('stop')}</button>
            <button type="button" id="seq-loop-play" class="icon-btn seq-icon-btn${this.seqLoopPlay ? ' active' : ''}" title="Rejouer en boucle" aria-label="Rejouer en boucle">${svgIcon('loop')}</button>
            <button type="button" id="seq-add-note" class="icon-btn seq-icon-btn" title="Ajouter une note libre (ex. note de passage)" aria-label="Ajouter une note libre">${svgIcon('plus')}</button>
            <!-- Pipette de motif ENTRE VOIES du même accord (retour utilisateur : sélectionner une ou
                 plusieurs notes/barres, voir seqSelections, puis les appliquer sur une AUTRE ligne du
                 même séquenceur) — voir toggleSeqRowPipette/applySeqRowPipette. Distincte de Ctrl+C/V
                 (copySeqPattern/pasteSeqPattern, tout le motif entre ACCORDS) : ici on ne touche jamais
                 qu'une partie du motif, vers une autre voix du MÊME accord. Groupée avec les actions
                 constructives (ajouter/prélever), avant les deux actions de suppression ci-dessous. -->
            <button type="button" id="seq-row-pipette" class="icon-btn seq-icon-btn${this.seqRowPipette ? ' active' : ''}" ${(hasSelection || this.seqRowPipette) ? '' : 'disabled'} title="${this.seqRowPipette ? 'Clique une ligne pour y appliquer le motif prélevé (Échap pour annuler)' : 'Prélever le motif sélectionné pour le coller sur une autre ligne'}" aria-label="${this.seqRowPipette ? 'Appliquer le motif prélevé sur une ligne' : 'Prélever le motif sélectionné'}">${svgIcon('seqRowPipette')}</button>
            <button type="button" data-preset="clear" class="seq-delete-btn">${svgIcon('trash')} tout</button>
            <button type="button" id="seq-delete-selection" class="seq-delete-btn" ${hasSelection ? '' : 'disabled'}>${svgIcon('trash')}
                <span class="lbl-full">sélection${countSuffix}</span><span class="lbl-short">Sélect.${countSuffix}</span>
            </button>
            ${showInlineSeqZoom ? `
            <div class="zoom-axis-group" title="Échelle horizontale">
                <span class="zoom-axis-tag">H</span>
                <button type="button" id="seq-zoom-in-h-inline" class="icon-btn zoom-axis-btn" title="Agrandir l'échelle horizontale" aria-label="Agrandir l'échelle horizontale">${svgIcon('plus')}</button>
                <button type="button" id="seq-zoom-out-h-inline" class="icon-btn zoom-axis-btn" title="Réduire l'échelle horizontale" aria-label="Réduire l'échelle horizontale">${svgIcon('minus')}</button>
            </div>` : ''}
            ${continuous ? `
            <!-- Séquenceur ÉPINGLÉ de la loupe grille (vue continue) : aucun bouton de zoom n'y était
                 jusque-là accessible — ceux de la loupe séquenceur autonome (#seq-zoom-in-h etc., voir
                 index.html) vivent dans un tout autre hôte (#seq-zoom-host), jamais atteint quand
                 #arp-sequencer est épinglé dans #grid-zoom-pinned-body à la place (retour utilisateur).
                 Même réglage partagé que cette loupe autonome (seqZoomLevelX/Y, voir seqZoomed plus
                 haut) : les deux ne sont que deux hôtes différents pour la même « vue agrandie ».
                 Groupés dans .btn-wrap-group (voir style.css) : H et V passent à la ligne ENSEMBLE sur
                 téléphone si la rangée déborde, jamais scindés l'un de l'autre au hasard de l'endroit
                 où tombe le retour à la ligne (retour utilisateur : "beaucoup de décalages"). -->
            <div class="btn-wrap-group">
                <div class="zoom-axis-group" title="Échelle horizontale">
                    <span class="zoom-axis-tag">H</span>
                    <button type="button" id="seq-zoom-in-h-pinned" class="icon-btn zoom-axis-btn" title="Agrandir l'échelle horizontale" aria-label="Agrandir l'échelle horizontale">${svgIcon('plus')}</button>
                    <button type="button" id="seq-zoom-out-h-pinned" class="icon-btn zoom-axis-btn" title="Réduire l'échelle horizontale" aria-label="Réduire l'échelle horizontale">${svgIcon('minus')}</button>
                </div>
                <div class="zoom-axis-group" title="Échelle verticale">
                    <span class="zoom-axis-tag">V</span>
                    <button type="button" id="seq-zoom-in-v-pinned" class="icon-btn zoom-axis-btn" title="Agrandir l'échelle verticale" aria-label="Agrandir l'échelle verticale">${svgIcon('plus')}</button>
                    <button type="button" id="seq-zoom-out-v-pinned" class="icon-btn zoom-axis-btn" title="Réduire l'échelle verticale" aria-label="Réduire l'échelle verticale">${svgIcon('minus')}</button>
                </div>
            </div>` : ''}
        </div>`;

        host.innerHTML = html;

        // Mode continu : place (ou garde) le défilement horizontal sur l'accord en édition, jamais
        // perdu dans le contexte gauche par défaut — voir prevScrollLeft capturé plus haut, avant la
        // reconstruction du HTML ci-dessus. Différé à la frame suivante : au tout premier rendu depuis
        // la loupe grille (voir editChordFromGridZoom), le conteneur parent (#grid-zoom-pinned-body)
        // est encore masqué à CET instant précis — il ne l'est plus qu'APRÈS ce rendu, via
        // syncGridZoomPinnedSeq() appelé juste ensuite — et écrire scrollLeft sur un élément encore
        // sans mise en page (ancêtre caché) était silencieusement ignoré (retombait à 0).
        // wideCompact (voir plus haut) : même préservation qu'en continu — un accord compact qui
        // déborde d'une page ne doit pas revenir au tout début à chaque repeinture (ex. juste après
        // l'auto-scroll d'un étirement près du bord, voir _updateSeqAutoScroll) ; colOffset y vaut
        // toujours 0 (pas de contexte voisin), donc le repli par défaut est bien le tout début.
        if (continuous || wideCompact) {
            requestAnimationFrame(() => {
                const scrollEl = host.querySelector('.seq-scroll');
                if (scrollEl) scrollEl.scrollLeft = prevScrollLeft != null ? prevScrollLeft : colOffset * continuousColPx;
            });
        }

        // Molette SANS Ctrl (Ctrl+molette reste le zoom, voir _bindCtrlWheelZoom) : convertit le
        // défilement vertical natif de la molette en défilement HORIZONTAL sur cette bande — pratique
        // à la souris (pas de trackpad/Maj+molette) pour rejoindre la mesure suivante (retour
        // utilisateur). N'agit que s'il y a réellement de quoi défiler (wideCompact/continu), sinon la
        // molette continue de faire défiler la page normalement (preventDefault jamais posé).
        {
            const wheelScrollEl = host.querySelector('.seq-scroll');
            if (wheelScrollEl) {
                wheelScrollEl.addEventListener('wheel', (e) => {
                    if (e.ctrlKey) return;
                    if (wheelScrollEl.scrollWidth <= wheelScrollEl.clientWidth) return;
                    e.preventDefault();
                    wheelScrollEl.scrollLeft += e.deltaY;
                }, { passive: false });
            }
        }

        // Étiquette éditable d'une note libre (voir addSequencerNote) : Entrée valide (déclenche le
        // blur ci-dessous), Échap annule sans valider — même schéma que les autres renommages en
        // ligne de l'appli (morceau, dossier...).
        const myRenderGen = this.seqRenderGen; // voir déclaration : capturé PAR rendu, pas par étiquette
        host.querySelectorAll('.seq-label-input').forEach(input => {
            const extraIdx = parseInt(input.dataset.extraIndex);
            input.addEventListener('keydown', (e) => {
                e.stopPropagation();
                if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
                else if (e.key === 'Escape') { e.preventDefault(); input.value = input.defaultValue; input.blur(); }
            });
            // Un rendu ultérieur (autre accord chargé, ou même accord reconstruit pour une autre raison)
            // remplace ce champ sans jamais le blurrer explicitement : le navigateur déclenche alors LUI-
            // MÊME un blur natif au moment où `host.innerHTML` le détache, avec ce même écouteur toujours
            // branché dessus. Sans le garde-fou ci-dessous, ce commit tardif s'appliquerait à `this.
            // extraNotes` de l'accord ENTRETEMPS chargé (index de voix redevenu invalide, voire voix
            // fantôme dupliquée) au lieu de celui pour lequel ce champ existait — voir pruneEmptyExtraNotes.
            input.addEventListener('blur', () => {
                if (this.seqRenderGen !== myRenderGen) return;
                this.commitExtraNoteLabel(extraIdx, input.value);
            });
            // Écouter la hauteur au clic, comme les étiquettes normales ci-dessous : n'empêche pas le
            // focus/l'édition du texte qui suit ce même clic (pas de preventDefault ici).
            input.addEventListener('click', () => this.previewSeqNote(+input.dataset.voice));
        });

        // Étiquette normale (hauteur non modifiable) : clic = écouter cette voix, pratique pour
        // vérifier une note à l'oreille sans avoir à lancer toute la lecture de l'accord.
        host.querySelectorAll('.seq-label[data-voice]').forEach(label => {
            label.addEventListener('click', () => this.previewSeqNote(+label.dataset.voice));
        });

        // Zones de contexte gauche/droite (voir plus haut, mode continu) : bascule l'édition sur
        // l'accord voisin, exactement comme un clic dessus dans la grille (le rectangle orangé suit).
        host.querySelectorAll('.seq-ctx-nav').forEach(zone => {
            zone.addEventListener('click', () => this.editChordFromGridZoom(this.activeSection, +zone.dataset.targetIndex));
        });

        // Bouton « X tout » (remplace tout le motif par du silence) : ciblé via [data-preset] pour
        // ne pas capturer « X sélection » ci-dessous, qui a son propre câblage.
        host.querySelectorAll('.seq-presets button[data-preset]').forEach(btn => {
            btn.onclick = () => {
                this.pushSeqUndo();
                this.seqTouched = true;
                this.seqSelections = [];
                const { pattern: p, tie: t } = seqPreset(btn.dataset.preset, voices, steps);
                this.setLiveSeqPattern(p, t);
                this.renderSequencer();
                this.livePreviewUpdate();
            };
        });

        const delBtn = document.getElementById('seq-delete-selection');
        if (delBtn) delBtn.onclick = () => this.deleteSelectedSeqNote();

        const rowPipetteBtn = document.getElementById('seq-row-pipette');
        if (rowPipetteBtn) rowPipetteBtn.onclick = () => this.toggleSeqRowPipette();

        // Barres de vélocité du mode studio (voir plus haut dans ce rendu) : le pointerdown démarre le
        // glissé (this._velDragStep, suivi par pointermove/pointerup posés une seule fois dans
        // setupEventListeners), le double-clic efface le réglage propre à cette croche pour revenir à
        // l'intensité globale de l'accord.
        host.querySelectorAll('.seq-vel-bar').forEach(bar => {
            bar.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                this._velDragStep = +bar.dataset.step;
                this.applyStudioVelocityFromClientY(bar, e.clientY);
            });
            bar.addEventListener('dblclick', (e) => {
                e.preventDefault();
                delete this.intensityPerStep[+bar.dataset.step];
                this.renderSequencer();
            });
        });

        const playBtn = document.getElementById('seq-play');
        // Une plage à boucler (bande orange/dorée, voir setLoopRange) déjà en place ET on est EN LOUPE
        // (grille ou séquenceur, voir seqLoopRangeActive ci-dessus) : lire TOUTE la plage (comme le
        // bouton Grille, voir playProgression, qui la priorise déjà) plutôt que le seul accord en
        // édition — cohérent avec le recolorage ci-dessus (voir updatePlayButtonsForLoopRange pour
        // l'équivalent sur les boutons du pied de colonne/de l'en-tête loupe). Hors loupe, ce bouton
        // reste toujours lié au seul accord en cours, quelle que soit une plage définie ailleurs.
        if (playBtn) playBtn.onclick = () => (seqLoopRangeActive ? this.playProgression() : this.playCurrent());
        const stopBtn = document.getElementById('seq-stop');
        if (stopBtn) stopBtn.onclick = () => this.stopAll();
        const loopBtn = document.getElementById('seq-loop-play');
        if (loopBtn) loopBtn.onclick = (e) => {
            this.seqLoopPlay = !this.seqLoopPlay;
            e.currentTarget.classList.toggle('active', this.seqLoopPlay);
            // Applique tout de suite si un accord est déjà en train de jouer, plutôt que d'attendre la
            // fin (figée) de la lecture en cours pour en tenir compte (voir playCurrent).
            if (this.isPlaying) this.livePreviewUpdate();
        };
        const addNoteBtn = document.getElementById('seq-add-note');
        if (addNoteBtn) addNoteBtn.onclick = () => this.addSequencerNote();
        const seqZoomOutHInline = document.getElementById('seq-zoom-out-h-inline');
        if (seqZoomOutHInline) seqZoomOutHInline.onclick = () => this.adjustSeqInlineZoom(-ZOOM_LEVEL_STEP);
        const seqZoomInHInline = document.getElementById('seq-zoom-in-h-inline');
        if (seqZoomInHInline) seqZoomInHInline.onclick = () => this.adjustSeqInlineZoom(ZOOM_LEVEL_STEP);
        // Séquenceur épinglé de la loupe grille (vue continue) : mêmes seqZoomLevelX/Y que la loupe
        // séquenceur autonome (voir le commentaire au-dessus de ces boutons, plus haut dans ce rendu).
        this._bindZoomButtons('seq', { inH: 'seq-zoom-in-h-pinned', outH: 'seq-zoom-out-h-pinned', inV: 'seq-zoom-in-v-pinned', outV: 'seq-zoom-out-v-pinned' });

        // Navigation par page (seulement en wideCompact, voir plus haut — jamais en continu, qui n'a
        // pas ce bloc) : un vrai défilement fluide d'une mesure (ou groupe de mesures), pas un saut
        // avec reconstruction complète — le contenu est déjà tout affiché (voir wideCompact), scroller
        // suffit. L'étiquette et l'état désactivé des boutons suivent la position réelle de défilement,
        // pas un index de page qui n'existe plus vraiment ici (this.seqPage n'est plus utilisé que
        // comme repli initial, voir prevScrollLeft/colOffset plus haut dans ce rendu).
        const prevBtn = document.getElementById('seq-page-prev');
        const nextBtn = document.getElementById('seq-page-next');
        if (wideCompact && (prevBtn || nextBtn)) {
            const pageNavScrollEl = host.querySelector('.seq-scroll');
            const pageNavLabel = document.getElementById('seq-page-label');
            const totalBars = Math.ceil(steps / stepsPerBar);
            const pagePx = stepsPerPage * continuousColPx;
            // Mesure RÉELLEMENT visible (bornes gauche ET droite de la fenêtre de défilement), pas un
            // simple index de page multiplié par stepsPerPage : quand le débordement est modeste (peu
            // de croches qui dépassent), les deux mesures peuvent déjà être quasi entièrement visibles
            // à la fois même tout au bout du défilement — un calcul par page fixe restait alors bloqué
            // sur "Mesure 1" malgré un vrai défilement jusqu'au bout (repéré en testant ce câblage).
            const updatePageNav = () => {
                if (!pageNavScrollEl) return;
                const maxScroll = Math.max(0, pageNavScrollEl.scrollWidth - pageNavScrollEl.clientWidth);
                const firstBar = Math.floor(pageNavScrollEl.scrollLeft / continuousColPx / stepsPerBar) + 1;
                const lastBar = Math.min(totalBars, Math.ceil((pageNavScrollEl.scrollLeft + pageNavScrollEl.clientWidth) / continuousColPx / stepsPerBar));
                if (pageNavLabel) pageNavLabel.textContent = (firstBar >= lastBar) ? `Mesure ${firstBar} / ${totalBars}` : `Mesures ${firstBar}-${lastBar} / ${totalBars}`;
                if (prevBtn) prevBtn.disabled = pageNavScrollEl.scrollLeft <= 1;
                if (nextBtn) nextBtn.disabled = pageNavScrollEl.scrollLeft >= maxScroll - 1;
            };
            if (pageNavScrollEl) pageNavScrollEl.addEventListener('scroll', updatePageNav, { passive: true });
            if (prevBtn) prevBtn.onclick = () => pageNavScrollEl && pageNavScrollEl.scrollBy({ left: -pagePx, behavior: 'smooth' });
            if (nextBtn) nextBtn.onclick = () => pageNavScrollEl && pageNavScrollEl.scrollBy({ left: pagePx, behavior: 'smooth' });
            requestAnimationFrame(updatePageNav); // après le positionnement initial du scroll (voir plus haut)
        }

        // Mode Modification (voir commitLiveEdit) : toute mutation du séquenceur (peindre/étirer/
        // déplacer une note, notes libres, verrou guitare, rythme tapé, barres de vélocité...) appelle
        // déjà renderSequencer() pour se redessiner — un seul point d'accroche ici couvre donc TOUTES
        // ces mutations sans avoir à répéter l'appel dans chacune. refreshGrid=false : ces changements
        // ne modifient jamais ce qu'affiche la case dans la grille (symbole, etc.), et rappeler
        // loadProgression() (qui peut redéclencher renderSequencer) rouvrirait une boucle.
        this.commitLiveEdit(false);
    }

    // Ajoute une voix "libre" au séquenceur (bouton dédié, voir #seq-add-note) : hauteur de départ
    // arbitraire (une tierce mineure au-dessus de la voix la plus aiguë actuelle, ou La3 à défaut de
    // voix) — l'essentiel est de faire apparaître aussitôt le champ éditable (voir renderSequencer)
    // pour que la vraie hauteur voulue soit tapée dans la foulée. Toujours ajoutée à la fin de
    // extraNotes : sa position d'AFFICHAGE dans le séquenceur (triée par hauteur) se corrige d'elle-
    // même dès que sa vraie hauteur est validée (voir commitExtraNoteLabel).
    addSequencerNote() {
        const chord = this.readChord();
        const midis = chord.getSeqMidiNotes();
        const highestMidi = midis.length ? Math.max(...midis) : 57; // La3 à défaut de tout accord jouable
        const defaultMidi = highestMidi + 3;
        const pc = ((defaultMidi % 12) + 12) % 12;
        const octave = Math.floor(defaultMidi / 12) - 1;
        // _new (jamais persisté, voir buildLiveChordData) : protège cette voix de pruneEmptyExtraNotes
        // tant qu'elle n'a encore JAMAIS été peinte une seule fois — sans lui, en mode Modification, le
        // renderSequencer() juste en dessous (qui appelle déjà commitLiveEdit -> pruneEmptyExtraNotes à
        // chaque rendu) supprimait la voix aussitôt créée, avant même que le champ éditable ci-dessous
        // ait pu servir à quoi que ce soit (retour utilisateur : "impossible d'ajouter une note libre à
        // un accord déjà enregistré"). Levé dans applySeqCell dès la toute première case peinte.
        this.extraNotes.push({ note: NOTES[pc], octave, _new: true });
        this.seqTouched = true; // le motif doit garder cette voix (voir syncSeqPatternForCurrentChord)
        this.renderSequencer();
        this.refreshPreview();
        // Focus + sélection immédiate du champ fraîchement créé : la valeur par défaut n'a aucun sens
        // musical, autant la remplacer tout de suite sans avoir à cliquer.
        const input = document.querySelector(`.seq-label-input[data-extra-index="${this.extraNotes.length - 1}"]`);
        if (input) { input.focus(); input.select(); }
    }

    // Valide (ou annule) la saisie d'une note libre (voir addSequencerNote) : texte vide -> supprime
    // cette voix ; hauteur reconnue (ex. "E3") -> mémorisée telle quelle. La hauteur seule ne décide
    // JAMAIS de renommer l'accord (une note fraîchement tapée n'a encore aucun rythme peint, donc
    // aucune durée) — c'est reevaluateExtraNoteUpgrades, appelé à chaque rendu du séquenceur, qui
    // tranche une fois qu'on l'a réellement jouée (voir les seuils SEQ_HELD_MIN_STEPS/
    // SEQ_STACCATO_MIN_COVERAGE plus haut).
    commitExtraNoteLabel(extraIndex, text) {
        const trimmed = text.trim();
        if (!trimmed) {
            this.extraNotes.splice(extraIndex, 1);
            this.renderSequencer();
            this.refreshPreview();
            this.livePreviewUpdate();
            return;
        }
        const parsed = parseNoteNameOctave(trimmed);
        if (!parsed) {
            this.flashHint('Note non reconnue (ex. E3, F#4, Bb2)');
            this.renderSequencer(); // revient à l'ancienne valeur (le rendu relit this.extraNotes)
            return;
        }
        // Conserve _new (voir addSequencerNote/pruneEmptyExtraNotes) si elle y était déjà : valider la
        // hauteur ne peint toujours aucun rythme, cette voix reste donc à protéger tant qu'aucune case
        // n'a encore été peinte, exactement comme juste après sa création.
        const wasNew = this.extraNotes[extraIndex] && this.extraNotes[extraIndex]._new;
        this.extraNotes[extraIndex] = { note: parsed.note, octave: parsed.octave, ...(wasNew ? { _new: true } : {}) };
        this.seqTouched = true;
        this.renderSequencer();
        this.refreshPreview();
        this.livePreviewUpdate();
    }

    // Copie (Ctrl+C, voir setupKeyboardShortcuts — actif quand le séquenceur est ouvert) tout le motif
    // rythmique de l'accord EN COURS D'ÉDITION (toutes les voix + l'intensité par croche du mode
    // studio) dans this.seqPatternClipboard. L'adaptation à l'accord CIBLE (durée, nombre de voix) se
    // fait au moment de coller (voir pasteSeqPattern), jamais ici.
    copySeqPattern() {
        const chord = this.readChord();
        const { pattern, tie } = this.getLiveSeqPattern(chord);
        this.seqPatternClipboard = {
            pattern: pattern.map(voices => voices.slice()),
            tie: tie.map(voices => voices.slice()),
            intensityPerStep: { ...this.intensityPerStep },
            steps: pattern.length,
        };
        this.flashHint('Motif copié — Ctrl+V sur un autre accord pour le coller');
    }

    // Colle le motif copié (Ctrl+V, voir copySeqPattern) sur l'accord en cours d'édition : adapté à SA durée
    // (tronqué, ou répété en mosaïque si l'accord copié était plus court — voir resizeSeqPattern) et à
    // SON nombre de voix (correspondance simple par index ; une voix EN PLUS dans l'accord cible reste
    // silencieuse, exactement comme pour toute autre resynchronisation de motif, voir
    // syncSeqPatternForCurrentChord). L'intensité par croche (mode studio) suit la même mosaïque.
    pasteSeqPattern() {
        const clip = this.seqPatternClipboard;
        if (!clip) return;
        const chord = this.readChord();
        const steps = chord.beats * SEQ_STEPS_PER_BEAT;
        const voices = chord.getSeqMidiNotes().length;

        this.pushSeqUndo();
        const { pattern, tie } = resizeSeqPattern(clip.pattern, clip.tie, steps, voices);
        this.setLiveSeqPattern(pattern, tie);
        // Contourne applySeqCell (qui lève x._new au fil de l'eau, voir addSequencerNote) : si le
        // motif collé réveille une voix libre encore jamais peinte, la protection n'a plus lieu d'être.
        const extraStart = chord.getIntervals().length;
        this.extraNotes.forEach((x, i) => {
            if (x._new && pattern.some(s => s.includes(extraStart + i))) delete x._new;
        });

        const outIntensity = {};
        for (let i = 0; i < steps; i++) {
            const srcIdx = clip.steps > 0 ? (i % clip.steps) : i;
            if (clip.intensityPerStep[srcIdx] != null) outIntensity[i] = clip.intensityPerStep[srcIdx];
        }
        this.intensityPerStep = outIntensity;

        this.seqTouched = true;
        this.seqSelections = [];
        this.renderSequencer();
        this.livePreviewUpdate();
        this.commitLiveEdit(true);
        this.flashHint('Motif collé');
    }

    // Active/désactive la pipette de motif ENTRE VOIES (voir #seq-row-pipette, this.seqRowPipette) :
    // prélève d'abord la sélection courante (this.seqSelections — clic, Ctrl+clic ou rectangle, voir
    // finalizeSeqMarqueeSelect) sous forme de positions de croches ABSOLUES { start, end }, puis reste
    // armée jusqu'à ce qu'on la désactive (re-clic sur ce bouton, ou Échap — voir onSeqPointerDown pour
    // l'application elle-même) : permet d'appliquer le même motif sur plusieurs lignes à la suite sans
    // avoir à ressélectionner à chaque fois. Un clic alors qu'aucune note n'est sélectionnée n'arme rien.
    toggleSeqRowPipette() {
        if (this.seqRowPipette) {
            this.seqRowPipette = null;
            this.renderSequencer();
            return;
        }
        if (this.seqSelections.length === 0) {
            this.flashHint("Sélectionne d'abord une ou plusieurs notes à prélever");
            return;
        }
        this.seqRowPipette = this.seqSelections.map(s => ({ start: s.start, end: s.end }));
        this.renderSequencer();
        this.flashHint('Motif copié');
    }

    // Dépose le motif prélevé (voir toggleSeqRowPipette) sur `targetVoice`, une autre voix du MÊME
    // accord en cours d'édition — jamais de changement de durée/nombre de voix à gérer ici (contrairement
    // à pasteSeqPattern, qui traverse les accords) : les positions de croches captées restent valables
    // telles quelles. Vide TOUTE la ligne cible au préalable (pas seulement la plage couverte par le
    // motif, retour utilisateur : les anciennes croches avant/après restaient sinon en place), pour que
    // seul le motif collé subsiste sur cette voix. Reste armée après coup (voir toggleSeqRowPipette)
    // pour enchaîner d'autres lignes.
    applySeqRowPipette(targetVoice) {
        const motif = this.seqRowPipette;
        if (!motif || motif.length === 0) return;
        this.pushSeqUndo();
        const chord = this.readChord();
        const { pattern, tie } = this.getLiveSeqPattern(chord);
        for (let s = 0; s < pattern.length; s++) {
            const at = pattern[s].indexOf(targetVoice);
            if (at >= 0) pattern[s].splice(at, 1);
            const ti = tie[s].indexOf(targetVoice);
            if (ti >= 0) tie[s].splice(ti, 1);
        }
        motif.forEach(m => {
            for (let s = m.start; s <= m.end; s++) {
                pattern[s].push(targetVoice);
                if (s !== m.start) tie[s].push(targetVoice);
            }
        });
        this.seqTouched = true;
        this.setLiveSeqPattern(pattern, tie);
        // Lève la protection _new (voir applySeqCell/addSequencerNote) si la voix ciblée était une note
        // libre encore jamais peinte : elle a désormais un vrai rythme à perdre si on l'efface plus tard.
        const extraStart = chord.getIntervals().length;
        if (targetVoice >= extraStart && this.extraNotes[targetVoice - extraStart]) {
            delete this.extraNotes[targetVoice - extraStart]._new;
        }
        // Pas de resélection sur la voix cible : le motif prélevé peut contenir plusieurs notes
        // séparées par du silence (plusieurs entrées dans this.seqRowPipette), qu'une seule sélection
        // { start: lo, end: hi } représenterait à tort comme UNE SEULE note continue (voir
        // resizeSelectedSeqNote/moveSelectedSeqNotes, qui supposent une plage réellement contiguë).
        this.seqSelections = [];
        this.renderSequencer();
        this.livePreviewUpdate();
        this.flashHint('Motif appliqué sur cette ligne');
    }

    // Réévalue, à CHAQUE rendu du séquenceur (peindre/étirer/effacer une case, pas seulement taper le
    // nom de la note), si une note libre est désormais jouée assez longtemps pour compléter l'accord
    // (voir seqCoverageQualifies) : si oui, absorbée dans la qualité de l'accord comme
    // commitExtraNoteLabel le faisait autrefois sur la seule hauteur ; sinon reste une note
    // "étrangère" (de passage), même si sa hauteur complèterait pile une qualité reconnue — SEULE la
    // durée réellement jouée décide désormais, jamais la hauteur seule (retour utilisateur).
    // Rappelée en boucle tant qu'une note se qualifie : en fusionner une décale les index des
    // suivantes (voir _computeVoices), plus sûr de tout recalculer depuis le début à chaque fois.
    reevaluateExtraNoteUpgrades() {
        let again = this.extraNotes.length > 0;
        while (again) {
            again = false;
            const chord = this.readChord();
            const { pattern, tie } = this.getLiveSeqPattern(chord);
            const extraStart = chord.getIntervals().length;

            for (let i = 0; i < this.extraNotes.length; i++) {
                const cov = seqVoiceCoverage(pattern, tie, extraStart + i);
                if (!seqCoverageQualifies(cov)) continue;

                const qualitySelect = document.getElementById('quality');
                const rootPc = NOTES.indexOf(document.getElementById('root').value);
                const relPc = ((NOTES.indexOf(this.extraNotes[i].note) - rootPc) % 12 + 12) % 12;
                const currentSet = pitchClassSetForQuality(qualitySelect.value);
                const unionSet = new Set([...currentSet, relPc]);
                const matched = findQualityMatchingPitchClasses(unionSet);
                if (!matched || matched === qualitySelect.value) continue; // jouée assez longtemps, mais ne complète rien de reconnu

                // Révéler d'ABORD (peut reconstruire la liste d'options du <select>, voir
                // activateMoreOptions/toggleSelectOptions) : régler la valeur avant l'effacerait, la
                // qualité visée n'existant pas encore dans les options tant que le mode courant reste
                // masqué (même ordre qu'editChord, qui a le même piège avec la basse différente).
                this.revealComplexQualityIfNeeded(matched);
                qualitySelect.value = matched;

                // La qualité gagne une voix (celle qu'on absorbe), qui vient toujours se placer en
                // DERNIÈRE position du corps de l'accord (CHORD_INTERVALS n'ajoute jamais une extension
                // qu'à la fin) : décale donc dans le motif déjà peint les voix des notes libres restées
                // AVANT `i` (qui glissent chacune d'un cran), et fait pointer les cases qui visaient la
                // note absorbée vers ce nouveau dernier index — sans ce remappage, le rythme peint
                // continuait à référencer les mêmes numéros de voix qu'avant, qui ne désignaient plus
                // les mêmes notes une fois le corps de l'accord agrandi (voir reevaluateExtraNoteUpgrades
                // plus haut : la boucle recalcule tout, mais le motif lui-même doit suivre).
                {
                    const { pattern: livePattern, tie: liveTie } = parseSeqPattern(document.getElementById('arpPattern').value);
                    const remapVoice = (v) => {
                        if (v < extraStart || v > extraStart + i) return v;
                        if (v === extraStart + i) return extraStart;
                        return v + 1;
                    };
                    const remappedPattern = livePattern.map(voices => voices.map(remapVoice));
                    const remappedTie = liveTie.map(tied => tied.map(remapVoice));
                    this.setLiveSeqPattern(remappedPattern, remappedTie);
                }

                this.extraNotes.splice(i, 1);
                const label = QUALITY_LABEL[matched] || '';
                this.flashHint(`Accord complété : ${document.getElementById('root').value}${label}`);
                again = this.extraNotes.length > 0;
                break; // état changé (qualité + extraNotes) : on recommence le for depuis le début
            }
        }
    }

    // Déplace le curseur de lecture (petite ligne verticale) du séquenceur au pas `step` en cours ;
    // `null` le masque (arrêt, ou pas hors de la page affichée). Ne fait rien si le panneau est fermé
    // ou déjà démonté — la lecture continue même quand le séquenceur n'est pas ouvert (voir playCurrent).
    updateSeqPlayhead(step) {
        const host = document.getElementById('arp-sequencer');
        if (!host || host.hidden) return;
        const grid = host.querySelector('.seq-grid');
        const ph = host.querySelector('.seq-playhead');
        if (!grid || !ph) return;
        if (step == null) { ph.style.display = 'none'; return; }
        const pageStart = +grid.dataset.pageStart, pageSteps = +grid.dataset.pageSteps;
        const colOffset = +grid.dataset.colOffset || 0; // voir renderSequencer, mode continu (loupe grille)
        if (step < pageStart || step >= pageStart + pageSteps) { ph.style.display = 'none'; return; }
        ph.style.display = 'block';
        ph.style.gridColumn = `${colOffset + step - pageStart + 2} / span 1`;
    }

    // Clic sur une case : sélectionne (surbrillance) + écoute l'accord, sauf si l'utilisateur a
    // désactivé la lecture automatique à la sélection (Paramètres > Son) — l'accord reste alors
    // affiché (clavier/guitare) mais ne se joue pas.
    selectChord(section, index) {
        this.activeSection = section;
        this.selectedIndex = index;
        this.loadProgression(); // re-render pour afficher la surbrillance
        this.updateGridPlayhead(section, index); // la barre de lecture se pose à gauche de l'accord choisi
        this.playSavedChord(section, index, this.autoplaySelect);
    }

    // Ctrl/Cmd+clic sur une case (voir onGridPointerUp) : ajoute/retire son index de la sélection
    // multiple, EN PLUS de la sélection simple habituelle (this.selectedIndex, qui suit toujours le
    // DERNIER index touché — c'est lui qui sert de point d'insertion pour Coller). Ne joue jamais le
    // son (contrairement à un clic simple) : Ctrl+clic sert uniquement à composer une sélection avant
    // une action groupée (copier, bientôt supprimer/déplacer en masse).
    toggleGridMultiSelect(section, index) {
        if (section !== this.activeSection) this.setActiveSection(section); // repart d'une sélection vide dans l'autre partie
        if (this.multiSelect.has(index)) {
            this.multiSelect.delete(index);
        } else {
            // La sélection simple précédente (s'il y en avait une, pas encore dans le Set) rejoint le
            // groupe : un premier Ctrl+clic sur une DEUXIÈME case doit sélectionner les deux, pas
            // remplacer la première.
            if (this.selectedIndex != null) this.multiSelect.add(this.selectedIndex);
            this.multiSelect.add(index);
        }
        this.selectedIndex = index;
        // Sélection modifiée : un futur glissé de #intensity sur ce nouveau groupe doit repartir sur son
        // propre instantané Annuler (voir applyIntensityToSelection), pas réutiliser celui d'un groupe
        // précédent déjà refermé.
        this._multiIntensityUndoPushed = false;
        this.loadProgression();
    }

    // Applique l'intensité `value` à TOUS les accords de la sélection multiple courante (voir
    // toggleGridMultiSelect/#intensity ci-dessus) — même principe qu'un seul instantané Annuler par
    // session que commitLiveEdit pour un accord seul (this._multiIntensityUndoPushed, remis à zéro dès
    // que la sélection change), plutôt qu'un par cran de la barre.
    applyIntensityToSelection(value) {
        const sections = loadProgressionSections();
        const history = sections[this.activeSection] && sections[this.activeSection].chords;
        if (!history) return;
        const indices = [...this.multiSelect].filter(i => history[i]);
        if (indices.length === 0) return;
        if (!this._multiIntensityUndoPushed) {
            this.pushUndo(sections);
            this._multiIntensityUndoPushed = true;
        }
        indices.forEach(i => { history[i].intensity = value; });
        saveProgressionSections(sections);
        // Répercute tout de suite sur celles de ces cases qui font partie d'une lecture en cours (voir
        // liveUpdateProgressionChord) — un patch local par accord touché suffit, sans redémarrer toute
        // la chanson (l'intensité ne change ni la durée ni le minutage).
        if (this.isPlaying && this._playMode === 'progression') {
            indices.forEach(i => this.liveUpdateProgressionChord(this.activeSection, i));
        }
    }

    async playSavedChord(section, index, play = true) {
        await Tone.start();
        this.stopAll();
        const myGen = this._playGen;

        const sections = loadProgressionSections();
        const data = sections[section] && sections[section].chords[index];
        if (!data) return;

        const chord = new Chord(data.root, data.quality, beatsFromData(data), data.inversion, data.drop, octaveFromData(data), data.bass, data.guitarLock, data.extraNotes);
        const notes = chord.getSeqNotes();
        const midis = chord.getSeqMidiNotes();
        const roleMap = chord.getRoleMap();
        const useFlats = this.useFlatsForRoot(chord.root);

        // Affiche l'accord sélectionné dans le grand titre + cadre le clavier
        const disp = document.getElementById('current-chord-display');
        disp.innerHTML = `<span class="chord-title">${flatTight(chord.getLabel(useFlats))}</span><span class="chord-notes">${chordNotesHtml(chord, useFlats)}</span>`;
        this.ensurePianoWindow(midis);
        // Lecture seule (simple clic pour écouter, PAS d'édition en cours) : affiche le verrou PROPRE
        // à cet accord (chord.guitarLock, ci-dessus) plutôt que le this.guitarLock resté en mémoire
        // d'une précédente session d'édition, sans rapport (voir ensureGuitarDiagram). Mémorise CET
        // accord précis (voir guitarPreviewPos) : le panneau Accord ne synchronise ses champs qu'en
        // édition (voir editChord), donc c'est la SEULE façon pour toggleGuitarLock de savoir où écrire
        // si on clique le cadenas directement depuis un simple aperçu, sans avoir double-cliqué pour
        // ouvrir l'édition complète.
        this.guitarPreviewPos = { section, index };
        this.ensureGuitarDiagram(chord, false);
        this.updateViz(midis, roleMap);

        if (!play) return; // aperçu silencieux seulement : le clavier/la guitare restent affichés

        const bpm = parseInt(document.getElementById('bpm').value);
        const secPerBeat = 60 / bpm;
        const { pattern: seqPattern, tie: seqTie } = this.resolveSeqPatternForData(chord, data);
        this.schedulePlayback(notes, midis, seqPattern, seqTie, secPerBeat, 0.1, roleMap, data.instrument || 'piano', chord, false, { section, index }, data.intensity, data.intensityPerStep);
        this.isPlaying = true;

        // Attend que l'instrument soit prêt avant de démarrer le transport (voir playCurrent)
        await waitForAudioReady();
        // Voir playCurrent : abandonne si un stopAll() est survenu pendant cette attente.
        if (myGen !== this._playGen) return;

        // En fin de lecture, on GARDE l'accord affiché sur le clavier (au lieu de l'effacer)
        Tone.Transport.schedule((t) => {
            Tone.Draw.schedule(() => {
                try {
                    // `chord` est figé au lancement de cette lecture : relit le verrou depuis les
                    // données à cet instant, au cas où il aurait changé entre-temps (voir le même
                    // principe dans schedulePlayback ci-dessus).
                    const freshData = loadProgressionSections()[section]?.chords[index];
                    if (freshData) chord.guitarLock = freshData.guitarLock || null;
                    this.ensurePianoWindow(midis); this.updateViz(midis, roleMap); this.ensureGuitarDiagram(chord, false);
                } catch (e) {
                    console.warn('Affichage de fin ignoré :', e.message);
                }
                this.isPlaying = false;
            }, t);
        }, 0.1 + (chord.beats * secPerBeat));

        Tone.Transport.start();
    }

    removeChord(section, index) {
        const sections = loadProgressionSections();
        const history = sections[section] && sections[section].chords;
        if (!history) return;
        this.pushUndo(sections);
        history.splice(index, 1);
        saveProgressionSections(sections);

        if (section === this.activeSection) {
            // Si on supprimait l'accord en cours d'édition, on quitte le mode édition
            if (this.editingIndex === index) {
                this.exitEditMode();
            } else if (this.editingIndex != null && this.editingIndex > index) {
                this.editingIndex--;
            }

            // Ajuste la sélection
            if (this.selectedIndex === index) this.selectedIndex = null;
            else if (this.selectedIndex != null && this.selectedIndex > index) this.selectedIndex--;
        }

        this.loadProgression();
    }

    // ---------- Annuler / Rétablir (undo/redo) ----------
    // Chaque appel qui modifie la grille (ajout, suppression, modification, déplacement,
    // copier-coller, parties) capture l'état AVANT mutation via pushUndo(), avant d'appeler
    // saveProgressionSections(). Toute nouvelle action après un undo efface la pile de redo.
    // Chaque entrée retient aussi la tonalité globale du moment (pas seulement les accords) : la
    // plupart des actions annulables ne la touchent pas (restauration = no-op sur ce point-là), mais
    // la transposition de tout le morceau (transposeSong) la modifie EN MÊME TEMPS que les accords —
    // sans ça, un Ctrl+Z après une transposition remettrait les accords dans l'ancienne tonalité tout
    // en laissant affichée la nouvelle, un état incohérent que l'utilisateur n'a jamais demandé.
    pushUndo(sections) {
        const root = document.getElementById('global-root').value;
        this.undoStack.push(JSON.stringify({ sections, root }));
        if (this.undoStack.length > this.undoLimit) this.undoStack.shift();
        this.redoStack = [];
        this.updateGlobalUndoRedoButtons();
    }

    // Restaure la tonalité globale mémorisée dans une entrée d'historique si elle diffère de
    // l'actuelle (no-op sinon) — voir le commentaire de pushUndo.
    restoreHistoryRoot(root) {
        const rootSel = document.getElementById('global-root');
        if (!root || root === rootSel.value) return;
        rootSel.value = root;
        hasUnsavedChanges = true;
        this.updateKeyLabels();
    }

    undo() {
        if (this.undoStack.length === 0) { this.flashHint('Rien à annuler'); return; }
        const current = { sections: loadProgressionSections(), root: document.getElementById('global-root').value };
        this.redoStack.push(JSON.stringify(current));
        const prev = JSON.parse(this.undoStack.pop());
        saveProgressionSections(prev.sections);
        this.restoreHistoryRoot(prev.root);
        this.afterHistoryRestore(prev.sections);
        this.flashHint('Annulé');
    }

    redo() {
        if (this.redoStack.length === 0) { this.flashHint('Rien à rétablir'); return; }
        const current = { sections: loadProgressionSections(), root: document.getElementById('global-root').value };
        this.undoStack.push(JSON.stringify(current));
        const next = JSON.parse(this.redoStack.pop());
        saveProgressionSections(next.sections);
        this.restoreHistoryRoot(next.root);
        this.afterHistoryRestore(next.sections);
        this.flashHint('Rétabli');
    }

    // Après un undo/redo : les indices de sélection/édition ne correspondent plus forcément
    // à l'état restauré, donc on les réinitialise prudemment plutôt que de risquer un décalage.
    afterHistoryRestore(sections) {
        if (this.editingIndex != null) this.exitEditMode();
        if (this.activeSection >= sections.length) this.activeSection = Math.max(0, sections.length - 1);
        this.selectedIndex = null;
        this.loadProgression();
        this.updateGlobalUndoRedoButtons();
    }

    // Un seul bouton annuler/rétablir tout en haut pour les 3 historiques (grille, séquenceur,
    // fichiers) plutôt qu'une paire dupliquée dans chaque carte — bascule sur le bon exactement comme
    // Ctrl+Z/Ctrl+Y (voir setupKeyboardShortcuts) : fenêtre Fichiers ouverte > séquenceur ouvert >
    // grille par défaut.
    globalUndo() {
        if (this.settingsOpen) this.filesUndo();
        else if (this.seqOpen) this.seqUndo();
        else this.undo();
    }

    globalRedo() {
        if (this.settingsOpen) this.filesRedo();
        else if (this.seqOpen) this.seqRedo();
        else this.redo();
    }

    // Reflète l'historique du contexte actuellement actif (voir globalUndo ci-dessus) sur le bouton
    // unique — à appeler à chaque push/undo/redo des 3 historiques ET à chaque changement de contexte
    // (ouverture/fermeture Fichiers ou séquenceur), puisque le bouton doit re-pointer vers un autre
    // historique sans qu'aucune pile n'ait elle-même changé.
    updateGlobalUndoRedoButtons() {
        const undoBtn = document.getElementById('global-undo-btn');
        const redoBtn = document.getElementById('global-redo-btn');
        if (!undoBtn || !redoBtn) return;
        let undoStack, redoStack;
        if (this.settingsOpen) { undoStack = this.filesUndoStack; redoStack = this.filesRedoStack; }
        else if (this.seqOpen) { undoStack = this.seqUndoStack; redoStack = this.seqRedoStack; }
        else { undoStack = this.undoStack; redoStack = this.redoStack; }
        undoBtn.disabled = undoStack.length === 0;
        redoBtn.disabled = redoStack.length === 0;
        // Relais dans l'en-tête de la loupe grille (voir grid-zoom-undo/grid-zoom-redo) : même état
        // désactivé/activé que les boutons d'origine, sinon .click() dessus ne ferait jamais rien.
        const gridZoomUndoBtn = document.getElementById('grid-zoom-undo');
        const gridZoomRedoBtn = document.getElementById('grid-zoom-redo');
        if (gridZoomUndoBtn) gridZoomUndoBtn.disabled = undoBtn.disabled;
        if (gridZoomRedoBtn) gridZoomRedoBtn.disabled = redoBtn.disabled;
    }

    // Vide l'historique annuler/rétablir (appelé lors d'un changement de morceau : undo/redo
    // ne doit pas traverser deux morceaux différents)
    clearHistory() {
        this.undoStack = [];
        this.redoStack = [];
        this.updateGlobalUndoRedoButtons();
    }

    // ---------- Annuler / Rétablir dans le séquenceur ----------
    // Historique SÉPARÉ de celui de la grille d'accords : il porte sur le motif de l'accord en cours
    // d'édition (l'input caché #arpPattern), pas encore « Ajouté »/« Modifié » dans la progression.
    // Une simple chaîne suffit comme instantané, puisque c'est déjà la représentation complète du motif.
    pushSeqUndo() {
        this.seqUndoStack.push(document.getElementById('arpPattern').value);
        if (this.seqUndoStack.length > this.undoLimit) this.seqUndoStack.shift();
        this.seqRedoStack = [];
        this.updateGlobalUndoRedoButtons();
    }

    seqUndo() {
        if (this.seqUndoStack.length === 0) { this.flashHint('Rien à annuler dans le séquenceur'); return; }
        this.seqRedoStack.push(document.getElementById('arpPattern').value);
        document.getElementById('arpPattern').value = this.seqUndoStack.pop();
        this.seqTouched = true;
        this.seqSelections = [];
        this.renderSequencer();
        this.updateGlobalUndoRedoButtons();
        this.flashHint('Annulé');
        this.livePreviewUpdate();
    }

    seqRedo() {
        if (this.seqRedoStack.length === 0) { this.flashHint('Rien à rétablir dans le séquenceur'); return; }
        this.seqUndoStack.push(document.getElementById('arpPattern').value);
        document.getElementById('arpPattern').value = this.seqRedoStack.pop();
        this.seqTouched = true;
        this.seqSelections = [];
        this.renderSequencer();
        this.updateGlobalUndoRedoButtons();
        this.flashHint('Rétabli');
        this.livePreviewUpdate();
    }


    // Vide l'historique du séquenceur (nouvel accord chargé, réglages changés, ou motif enregistré
    // dans la grille : l'historique d'un accord n'a plus de sens pour un autre)
    clearSeqHistory() {
        this.seqUndoStack = [];
        this.seqRedoStack = [];
        this.updateGlobalUndoRedoButtons();
    }

    // ---------- Raccourcis clavier ----------
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const tag = (document.activeElement && document.activeElement.tagName) || '';
            const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)
                || (document.activeElement && document.activeElement.isContentEditable);
            const mod = e.ctrlKey || e.metaKey;

            if (e.key === 'Escape' && !document.getElementById('context-menu').hidden) { this.closeContextMenu(); return; }
            if (e.key === 'Escape' && !document.getElementById('section-picker-menu').hidden) { this.closeSectionPicker(); return; }
            if (e.key === 'Escape' && !document.getElementById('backup-scope-menu').hidden) { this.closeBackupScopeMenu(); return; }
            if (e.key === 'Escape' && !document.getElementById('key-suggest-menu').hidden) { this.closeKeySuggestMenu(); return; }
            if (e.key === 'Escape' && !document.getElementById('quick-add-help').hidden) { this.closeQuickAddHelp(); return; }
            if (e.key === 'Escape' && !document.getElementById('unsaved-modal').hidden) { if (this._unsavedModalCancel) this._unsavedModalCancel(); return; }
            if (e.key === 'Escape' && !document.getElementById('midi-export-modal').hidden) { if (this._midiExportModalCancel) this._midiExportModalCancel(); return; }
            if (e.key === 'Escape' && !document.getElementById('duration-dd-menu').hidden) { this.closeDurationMenu(); return; }
            if (e.key === 'Escape' && !document.getElementById('playstyle-dd-menu').hidden) { this.closePlayStyleMenu(); return; }
            if (e.key === 'Escape' && this.seqRowPipette) { this.seqRowPipette = null; this.renderSequencer(); return; }
            if (e.key === 'Escape' && this.settingsOpen) { this.closeSettings(); return; }
            if (e.key === 'Escape' && this.seqZoomOpen) { this.closeSeqZoom(); return; }
            if (e.key === 'Escape' && this.gridZoomOpen) { this.closeGridZoom(); return; }

            // Taper directement une lettre de note (A-G) sur un accord chargé en édition (loupe
            // grille, ou double-clic en grille normale) ou simplement sélectionné ouvre son édition
            // inline avec cette lettre déjà tapée — sans avoir à double-cliquer pile sur son texte
            // d'abord (retour utilisateur : ça ne suffisait pas en pratique, notamment dans la loupe).
            if (!typing && !mod && !e.altKey && /^[A-Ga-g]$/.test(e.key)) {
                const idx = this.editingIndex != null ? this.editingIndex : this.selectedIndex;
                if (idx != null) {
                    e.preventDefault();
                    this.startInlineChordSymbolEdit(this.activeSection, idx, null, e.key.toUpperCase());
                    return;
                }
            }

            // Barre d'espace : joue/stoppe l'accord courant si le séquenceur est ouvert (pour
            // itérer vite dessus sans la souris), sinon la progression entière. Volontairement PAS
            // exclu quand un bouton a le focus (ex. juste après un clic sur un préréglage du
            // séquenceur) : sinon l'espace réactive ce bouton au lieu de jouer/stopper.
            if ((e.key === ' ' || e.code === 'Space') && !typing && !mod) {
                e.preventDefault();
                if (this.isPlaying) this.stopAll();
                else if (this.seqOpen) this.playCurrent();
                else this.playProgression();
                return;
            }

            // Copier/coller le MOTIF rythmique (voir copySeqPattern/pasteSeqPattern) plutôt que tout
            // l'accord : actif seulement quand le séquenceur est ouvert sur un accord en cours
            // d'édition — retour utilisateur : au clavier plutôt qu'un bouton dédié dans la barre du
            // séquenceur. Sinon, Ctrl+C/Ctrl+V retombent sur leur comportement habituel (copier/coller
            // tout un accord dans la grille, voir copySelected/pasteChord juste en dessous).
            if (mod && (e.key === 'c' || e.key === 'C')) {
                if (!typing && this.seqOpen && this.editingIndex != null) { this.copySeqPattern(); e.preventDefault(); return; }
                if (!typing && (this.multiSelect.size > 0 || this.selectedIndex != null)) { this.copySelected(); e.preventDefault(); }
                return;
            }
            if (mod && (e.key === 'v' || e.key === 'V')) {
                if (!typing && this.seqOpen && this.editingIndex != null && this.seqPatternClipboard) { this.pasteSeqPattern(); e.preventDefault(); return; }
                if (!typing && this.clipboard && this.clipboard.length > 0) { this.pasteChord(); e.preventDefault(); }
                return;
            }
            // Annuler / Rétablir : Ctrl/Cmd+Z (annuler), Ctrl/Cmd+Y ou Ctrl/Cmd+Shift+Z (rétablir).
            // Trois historiques distincts, chacun actif seulement dans son propre contexte visible :
            // fenêtre Fichiers ouverte > séquenceur ouvert > grille d'accords par défaut.
            if (mod && !typing && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault();
                if (this.settingsOpen) { if (e.shiftKey) this.filesRedo(); else this.filesUndo(); }
                else if (this.seqOpen) { if (e.shiftKey) this.seqRedo(); else this.seqUndo(); }
                else { if (e.shiftKey) this.redo(); else this.undo(); }
                return;
            }
            if (mod && !typing && (e.key === 'y' || e.key === 'Y')) {
                e.preventDefault();
                if (this.settingsOpen) this.filesRedo();
                else if (this.seqOpen) this.seqRedo();
                else this.redo();
                return;
            }
            // Ctrl/Cmd+S : enregistre réellement le morceau (voir saveCurrentSong) — au lieu du
            // dialogue natif « Enregistrer la page », partout (même en train de taper un champ).
            if (mod && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                this.saveCurrentSong();
                return;
            }
            // Note(s) du séquenceur sélectionnée(s) : Suppr/Retour efface tout le groupe, ← → l'étire/
            // raccourcit (chacune depuis sa fin), Maj+← → le déplace en bloc — mêmes touches que la
            // grille d'accords (Maj = geste "structurel"), prioritaire ici sur elle, plus locale à
            // l'édition en cours.
            if (!typing && this.seqSelections.length > 0) {
                if (e.key === 'Delete' || e.key === 'Backspace') { this.deleteSelectedSeqNote(); e.preventDefault(); return; }
                if (e.key === 'ArrowRight') { if (e.shiftKey) this.moveSelectedSeqNotes(1); else this.resizeSelectedSeqNote(1); e.preventDefault(); return; }
                if (e.key === 'ArrowLeft') { if (e.shiftKey) this.moveSelectedSeqNotes(-1); else this.resizeSelectedSeqNote(-1); e.preventDefault(); return; }
            }

            // Accord ACTIF dans la grille : en loupe grille, cliquer un accord charge son édition
            // (this.editingIndex) plutôt que la simple sélection verte (this.selectedIndex, jamais
            // posée là — voir editChordFromGridZoom) ; activeGridChordIndex() suit lequel des deux
            // compte vraiment ici, pour que ces raccourcis marchent aussi bien en loupe que dans la
            // grille classique (retour utilisateur).
            const activeGridIdx = this.activeGridChordIndex();

            // Maj+← / Maj+→ raccourcit/rallonge sa case d'un temps entier — équivalent clavier de la
            // poignée d'étirement à la souris (voir onResizeMove/resizeSelectedChord), même pas, même
            // borne à 1 temps minimum. Maj pour ne pas entrer en conflit avec ← → seuls, qui naviguent
            // déjà d'un accord à l'autre juste en dessous.
            if (!typing && activeGridIdx != null && e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                this.resizeSelectedChord(e.key === 'ArrowRight' ? 1 : -1, activeGridIdx);
                e.preventDefault();
                return;
            }

            // ← → passe au précédent/suivant DANS LA MÊME PARTIE (s'arrête aux bornes, ne saute pas
            // d'une partie à l'autre) — en loupe grille avec un accord en édition, s'appuie sur
            // editChordFromGridZoom (le rectangle orangé et le séquenceur épinglé suivent, comme un
            // clic sur le contexte grisé du séquenceur, voir .seq-ctx-nav) ; sinon sur selectChord
            // (simple sélection verte, rejoue aussi l'accord ciblé, comme un clic direct sur sa case).
            if (!typing && activeGridIdx != null && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                const sections = loadProgressionSections();
                const history = sections[this.activeSection] && sections[this.activeSection].chords;
                if (history && history.length > 0) {
                    const dir = (e.key === 'ArrowRight') ? 1 : -1;
                    const next = Math.min(history.length - 1, Math.max(0, activeGridIdx + dir));
                    if (next !== activeGridIdx) {
                        if (this.gridZoomOpen && this.editingIndex != null) this.editChordFromGridZoom(this.activeSection, next);
                        else this.selectChord(this.activeSection, next);
                    }
                    e.preventDefault();
                }
            }

            if (!typing && (e.key === 'Delete' || e.key === 'Backspace')) {
                if (activeGridIdx != null) { this.removeChord(this.activeSection, activeGridIdx); e.preventDefault(); }
            }

            // Entrée depuis un réglage d'accord : ajoute sans avoir à cliquer sur le bouton — seulement
            // en mode Ajout : en mode Modification, chaque champ s'applique déjà tout seul (voir
            // commitLiveEdit), Entrée n'a plus rien à valider et ne doit pas refermer l'édition en cours.
            if (e.key === 'Enter' && this.appMode !== 'edit' && CHORD_PARAM_IDS.includes(document.activeElement && document.activeElement.id)) {
                e.preventDefault();
                this.saveCurrent();
            }
        });
    }

    // ---------- Copier / coller / dupliquer (au sein de la partie active) ----------
    // this.clipboard est TOUJOURS un tableau (un seul élément pour une simple sélection) : uniformise
    // copySelected/pasteChord, qui n'ont ainsi qu'un seul chemin à gérer, que la sélection multiple
    // (voir toggleGridMultiSelect) soit utilisée ou non.
    copySelected() {
        const sections = loadProgressionSections();
        const history = sections[this.activeSection].chords;
        // La sélection multiple, si non vide, l'emporte sur la sélection simple — dans l'ORDRE de la
        // grille (pas celui des clics), pour coller un bloc qui garde le même ordre que l'original.
        const indices = this.multiSelect.size > 0
            ? [...this.multiSelect].filter(i => history[i]).sort((a, b) => a - b)
            : (this.selectedIndex != null && history[this.selectedIndex]) ? [this.selectedIndex] : [];
        if (indices.length === 0) return;
        this.clipboard = indices.map(i => ({ ...history[i] }));
        this.flashHint(indices.length > 1
            ? `${indices.length} accords copiés — Ctrl/Cmd+V pour coller`
            : 'Accord copié — Ctrl/Cmd+V pour coller');
    }

    pasteChord() {
        if (!this.clipboard || this.clipboard.length === 0) return;
        const sections = loadProgressionSections();
        this.pushUndo(sections);
        const history = sections[this.activeSection].chords;
        // Bornée à history.length : this.selectedIndex peut, dans de rares cas, pointer au-delà (ex.
        // accords supprimés ailleurs entre-temps) — sans cette borne, un collage voulu "à la fin"
        // pouvait insérer le bloc au mauvais endroit plutôt qu'en toute fin de partie.
        const at = (this.selectedIndex != null && this.selectedIndex < history.length) ? this.selectedIndex + 1 : history.length;
        const copies = this.clipboard.map(c => ({ ...c }));
        history.splice(at, 0, ...copies);
        saveProgressionSections(sections);
        if (this.editingIndex != null && this.editingIndex >= at) this.editingIndex += copies.length;
        this.selectedIndex = at + copies.length - 1; // sélectionne le dernier accord collé
        // Le bloc collé redevient la sélection multiple courante : pratique pour le recoller ou le
        // supprimer aussitôt tel quel.
        this.multiSelect = copies.length > 1 ? new Set(Array.from({ length: copies.length }, (_, i) => at + i)) : new Set();
        this.loadProgression();
        this.flashHint(copies.length > 1 ? `${copies.length} accords collés` : 'Accord collé');
    }

    // Duplique un accord donné (bouton ⧉) : la copie se place juste après, dans la même partie
    duplicateChord(section, index) {
        const sections = loadProgressionSections();
        const history = sections[section] && sections[section].chords;
        if (!history || !history[index]) return;
        this.pushUndo(sections);
        history.splice(index + 1, 0, { ...history[index] });
        saveProgressionSections(sections);
        this.activeSection = section;
        if (this.editingIndex != null && this.editingIndex > index) this.editingIndex++;
        // Voir duplicateChordTo : même décalage pour la sélection multiple.
        this.multiSelect = new Set(Array.from(this.multiSelect, (i) => (i > index ? i + 1 : i)));
        this.selectedIndex = index + 1; // sélectionne la copie
        this.loadProgression();
    }

    // Monte/descend l'octave d'un accord d'un cran (menu contextuel, voir data-ctx-action="octave-*")
    // sans ouvrir le mode édition complet — plafonné aux mêmes bornes que le sélecteur Octave du
    // panneau Accord (2 à 5). Si c'est l'accord actuellement en édition, resynchronise le panneau
    // (et le séquenceur) avec la nouvelle octave plutôt que de le laisser périmé.
    changeChordOctave(section, index, delta) {
        const sections = loadProgressionSections();
        const data = sections[section] && sections[section].chords[index];
        if (!data) return;
        const current = octaveFromData(data);
        const next = Math.max(2, Math.min(5, current + delta));
        if (next === current) {
            this.flashHint(delta > 0 ? 'Déjà à l’octave la plus haute (5)' : 'Déjà à l’octave la plus basse (2)');
            return;
        }
        this.pushUndo(sections);
        data.octave = next;
        // Un doigté verrouillé (voir toggleGuitarLock) peut dépendre de l'octave (voicing personnalisé
        // envoyé au solveur exact) ou pas du tout (forme communément enseignée, indépendante de
        // l'octave) — impossible de savoir laquelle sans refaire tout le calcul ici. Plus sûr de
        // relâcher le verrou : le choix automatique retombera de toute façon sur la même forme pour un
        // accord standard, et sur une forme cohérente avec la nouvelle octave sinon.
        data.guitarLock = null;
        saveProgressionSections(sections);
        hasUnsavedChanges = true;
        if (this.editingIndex === index && this.activeSection === section) this.editChord(section, index);
        else this.loadProgression();
        this.flashHint(`Octave ${next}`);
    }

    // Petit message éphémère (toast)
    flashHint(msg, duration = 1600) {
        let t = document.getElementById('toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'toast';
            t.className = 'toast';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => t.classList.remove('show'), duration);
    }
}

window.app = new HarmoHubApp();
