// =====================================================================================================================================
// LE SÉQUENCEUR (refonte du séquenceur, point D, premier sous-lot — cahier `docs/refonte-sequenceur.md`, sections 3 et 3 bis ; maquette v17,
// planche A v26). Écrit de zéro, dessiné d'un seul bloc : « très compliqué à utiliser, beaucoup de problèmes d'affichage » (l'utilisateur, 11/11)
// → UN séquenceur, UNE LIGNE PAR VOIX (basse, voix 2, voix 3, aiguë) et non une ligne par demi-ton, HUIT CROCHES par mesure, pas de zoom, pas de
// loupe, pas de « Étendre » : toute la partie tient à l'écran. L'ancien séquenceur (renderSequencer, #seq-dock-panel) reste en place jusqu'à la
// bascule (cahier, section 5) ; les deux écrivent le MÊME motif enregistré dans l'accord (arpPattern), lu par la lecture de toujours.
//
// Le modèle de stockage ne change pas : un motif est une liste de cases de DOUBLE-croche (SEQ_STEPS_PER_BEAT = 4 par temps) avec des liaisons.
// Ce module le lit et l'écrit à la CROCHE (2 cases) : une croche k allumée pour la voix v = cases 2k et 2k+1 ; deux croches voisines « soudées »
// = une seule note tenue (la case 2k est alors liée à la précédente). Une croche posée à côté d'une autre s'y soude (« une note tenue = une barre
// continue », maquette) ; les soudures qu'on ne touche pas sont gardées telles quelles, pour ne pas changer le son d'un accord ancien qui répète
// ses attaques (un « Noire maintenu » reste quatre attaques).
//
// Il dépend des globales de script.js (Chord, loadProgressionSections, saveProgressionSections, parseSeqPattern, serializeSeqPattern,
// beatsFromData, octaveFromData, midiToDisplayName, ROLE_COLOR, SEQ_STEPS_PER_BEAT…) et de l'appli (window.app), lues au moment de l'appel : l'ordre
// de chargement des deux fichiers n'importe donc pas.
// =====================================================================================================================================
(function () {
    'use strict';

    // Les MOTIFS FOURNIS, écrits PAR POSITION (basse, voix 2, voix 3, aiguë) et non par note (cahier : « un motif est écrit par position »), sur
    // huit croches. Ceux de la maquette v17, à l'identique. « Le premier temps n'est pas plus appuyé que les autres » : tout en « normal ».
    const TOUT = [0, 1, 2, 3, 4, 5, 6, 7];
    const MOTIFS = [
        { id: 'plaque', nom: 'Plaqué', v: [TOUT, TOUT, TOUT, TOUT] },
        { id: 'monte', nom: 'Arpège ↑', v: [TOUT, [1, 5], [2, 6], [3, 7]] },
        { id: 'descend', nom: 'Arpège ↓', v: [TOUT, [3, 7], [2, 6], [1, 5]] },
        { id: 'pompe', nom: 'Pompe', v: [[0, 1, 4, 5], [2, 6], [2, 6], [2, 6]] },
        { id: 'ballade', nom: 'Ballade', v: [TOUT, [1, 4, 7], [2, 5], [0, 3, 6]] },
        { id: 'main', nom: 'À la main', v: [[], [], [], []] },
    ];
    const MOTIF_PAR_ID = Object.fromEntries(MOTIFS.map(m => [m.id, m]));

    // DEUXIÈME SOUS-LOT : les FORMES de l'utilisateur et les RETOUCHES des motifs fournis (synchro-formes.js, au compte). Un motif, quel qu'il soit,
    // a la même forme : { id, nom, v: croches des quatre positions, s: soudures (null = croches voisines soudées), n: intensités (null = tout normal) }.
    // Une retouche se pose PAR-DESSUS le motif fourni (« l'original n'est jamais perdu » : MOTIFS ne change pas, « Rétablir l'original » la retire).
    const magasin = () => (typeof window !== 'undefined' && window.FormesSequenceur) ? window.FormesSequenceur : null;
    function motifParId(id) {
        if (!id) return null;
        const f = magasin();
        const base = MOTIF_PAR_ID[id];
        if (base) {
            const r = id !== 'main' && f ? f.retouche(id) : null;
            return r ? { id, nom: r.nom || base.nom, v: r.v, s: r.s, n: r.n, fourni: true, retouche: true }
                     : { id, nom: base.nom, v: base.v, s: null, n: null, fourni: true, retouche: false };
        }
        const x = f ? f.lire(id) : null;
        return x && x.type === 'forme' ? { id, nom: x.nom, v: x.v, s: x.s, n: x.n, fourni: false, forme: true } : null;
    }
    const formesUtilisateur = () => { const f = magasin(); return f ? f.formes() : []; };
    // La vignette d'un rythme : quatre lignes de huit croches, dessinées comme le séquenceur (croches voisines soudées en barre).
    function vignetteHtml(m) {
        const p = [];
        for (let pos = 3; pos >= 0; pos--) {
            const x = positionDe(m, pos, 8);
            for (let k = 0; k < 8; k++) {
                const lit = x.ks.has(k), av = lit && x.sd.has(k), ap = lit && x.sd.has(k + 1);
                p.push(`<span class="${lit ? 'lit' : ''}${av ? ' g' : ''}${ap ? ' d' : ''}"></span>`);
            }
        }
        return p.join('');
    }

    // Trois niveaux seulement (maquette : « normal → fort → doux → enlevée »). « Normal » = pas de réglage propre : la note suit l'intensité de
    // l'accord (data.intensity) ; doux et fort reprennent les valeurs des cinq niveaux de l'appli (NIVEAUX_INTENSITE : Doux 55, Fort 90).
    const NIVEAU_VALEUR = { doux: 55, fort: 90 };
    const CYCLE_INTENSITE = { normal: 'fort', fort: 'doux', doux: null };

    // 14/11, L1 (« Proposé ») : la ligne passe de 30 à 26 px par défaut, et la croche a sa propre largeur — 34 px au plus par défaut, entre 14 (une mesure = 112 px)
    // et 90 px (poignée de largeur, double-clic = 34). Les deux se retiennent par appareil.
    const LIGNE_MIN = 14, LIGNE_MAX = 48, LIGNE_DEFAUT = 26;   // hauteur des LIGNES (Paramètres › Affichage : de 22 à 48 px, 26 par défaut)
    const CROCHE_MIN = 14, CROCHE_MAX = 90, CROCHE_DEFAUT = 34;
    const LARGEUR_POIGNEE = 18;                                // la piste de la poignée de largeur, juste après la dernière croche
    const CLE_CROCHE = 'harmohubSequenceurCroche';
    const CLE_LIGNE = 'harmohubSequenceurLigne';
    const CLE_OUVERT = 'harmohubSequenceurOuvert';
    const CLE_PORTEE = 'harmohubSequenceurPortee';
    const CLE_CONTENU = 'harmohubSequenceurContenu';   // ce qu'écrivent les barres : 'rien', 'notes' ou 'degres'
    const CLE_REGLE = 'harmohubSequenceurRegle';       // '0' : règle des temps masquée
    const CLE_AUTO = 'harmohubSequenceurAuto';         // '1' : hauteur des barres adaptée au nombre de lignes
    const CLE_NOMS_RYTHMES = 'harmohubNomsRythmes';    // '1' / '0' : noms des rythmes dans la barre ; sans réglage, oui au-dessus de 1340 px
    const CROCHE_MAX_ROUE = 60;
    const DEGRES = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♯5', '6', '♭7', '7'];
    const CLE_MASQUES = 'harmohubRythmesMasques';   // les rythmes FOURNIS masqués de la barre (clic droit › Masquer), par appareil
    const CLE_VUE = 'harmohubSequenceurVue';   // 'voix' (une ligne par voix) ou 'notes' (« Toutes les notes » : une ligne par hauteur utilisée)
    const NOMS_LIBRES = NOTES_SQ();            // C, C#, D… : les noms proposés par la bande « Note libre » (maquette v17)
    function NOTES_SQ() { return ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']; }
    const midiDe = (note, octave) => NOMS_LIBRES.indexOf(note) + 12 * (octave + 1);
    const noteDe = (midi) => ({ note: NOMS_LIBRES[((midi % 12) + 12) % 12], octave: Math.floor(midi / 12) - 1 });
    const APPUI_LONG_MS = 380; // l'appui long au doigt : menu de la note, ou début d'un trait peint
    const GRILLE_MIN = 40; // ce que la poignée laisse au moins à la grille au-dessus (l'en-tête de partie reste lisible)

    const cle = (v, k) => v + ':' + k;
    const lireLocal = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; /* stockage refusé : réglage par défaut */ } };
    const ecrireLocal = (k, val) => { try { localStorage.setItem(k, val); } catch (e) { /* stockage plein ou refusé : vaut pour la session */ } };
    const borner = (x, a, b) => Math.max(a, Math.min(b, x));

    // ---------------------------------------------------------------------------------------------------------------------------------
    // MODÈLE (fonctions pures, exposées pour les bancs dans window.SequenceurHarmo)
    // ---------------------------------------------------------------------------------------------------------------------------------

    function chordDe(data) {
        return new Chord(data.root, data.quality, beatsFromData(data), data.inversion, data.drop, octaveFromData(data), data.bass, data.guitarLock, data.extraNotes);
    }

    // Les voix d'un accord, dans l'ordre STABLE du stockage (getSeqVoices : corps de l'accord, puis notes libres, puis basse différente), et leur
    // rangement du plus grave au plus aigu « d'après les notes réellement jouées (renversement, octave, drop compris) » (cahier, section 3).
    function voixDe(data) {
        const chord = chordDe(data);
        const voix = chord.getSeqVoices().map((x, i) => ({ index: i, midi: x.midi, role: x.role }));
        const corps = chord.getIntervals().length;
        const libres = (data.extraNotes || []).length;
        const basse = data.bass ? corps + libres : null;
        voix.forEach(x => { x.libre = x.index >= corps && x.index < corps + libres; x.basse = x.index === basse; });
        const positions = voix.filter(x => !x.libre).sort((a, b) => a.midi - b.midi || a.index - b.index).map(x => x.index);
        const indexLibres = voix.filter(x => x.libre).map(x => x.index);
        return { chord, voix, corps, positions, libres: indexLibres, basse, croches: chord.beats * SEQ_STEPS_PER_BEAT / 2 };
    }

    // Niveau d'une attaque : réglage propre à la voix (intensiteVoix, écrit par ce séquenceur), sinon l'ancien réglage par case (intensityPerStep,
    // mode studio d'avant), sinon « normal ».
    function niveauDeValeur(val) {
        if (val == null || isNaN(val)) return 'normal';
        if (val < 65) return 'doux';
        if (val >= 83) return 'fort';
        return 'normal';
    }

    // Lit le motif JOUÉ de l'accord (resolveSeqPatternForData : le motif-type de son style s'il n'a jamais été retouché) à la croche.
    // `app` : l'appli qui construit le séquenceur (window.app n'existe pas encore pendant sa construction, où le séquenceur peut déjà se dessiner).
    function lireAccord(data, app = window.app) {
        const info = voixDe(data);
        const { pattern, tie } = app.resolveSeqPatternForData(info.chord, data);
        const on = new Set(), soude = new Set(), niveaux = new Map();
        const iv = data.intensiteVoix || {}, ips = data.intensityPerStep || {};
        for (const x of info.voix) {
            const v = x.index;
            for (let k = 0; k < info.croches; k++) {
                const a = 2 * k, b = a + 1;
                const pa = (pattern[a] || []).includes(v), pb = (pattern[b] || []).includes(v);
                if (!pa && !pb) continue;
                on.add(cle(v, k));
                // Soudée à la précédente : la croche commence par une case LIÉE (ou, sans attaque sur sa première moitié, par sa seconde moitié liée).
                const lieeA = pa && (tie[a] || []).includes(v);
                const lieeB = !pa && pb && (tie[b] || []).includes(v);
                if (k > 0 && on.has(cle(v, k - 1)) && (lieeA || lieeB)) soude.add(cle(v, k));
            }
            for (let k = 0; k < info.croches; k++) {
                if (!on.has(cle(v, k)) || soude.has(cle(v, k))) continue;
                const pas = (pattern[2 * k] || []).includes(v) ? 2 * k : 2 * k + 1;
                const val = iv[cle(v, pas)] != null ? iv[cle(v, pas)] : ips[pas];
                const n = niveauDeValeur(val);
                if (n !== 'normal') niveaux.set(cle(v, k), n);
            }
        }
        return { info, on, soude, niveaux, motif: motifActuel(data) };
    }

    // Le motif que l'accord suit : celui qu'on lui a appliqué (data.motifSeq), « Plaqué » pour un accord jamais retouché qui se joue tenu (le
    // réglage d'origine de tout accord), « À la main » pour le reste.
    // Une forme supprimée (ici ou sur un autre appareil) n'existe plus : l'accord qui la suivait passe « À la main » en gardant ses notes (cahier,
    // section 4 : « les accords qui la suivaient passent À la main ») — sans réécrire aucun morceau.
    function motifActuel(data) {
        if (data.motifSeq && motifParId(data.motifSeq)) return data.motifSeq;
        if (!data.seqEdited && (data.playStyle || 'held') === 'held') return 'plaque';
        return 'main';
    }

    // Écrit l'état lu (et retouché) dans l'accord : arpPattern + seqEdited, intensiteVoix (l'ancien réglage par case est repris dedans puis vidé,
    // pour qu'une seule source dise l'intensité d'une note).
    function ecrireAccord(data, etat) {
        const { info, on, soude, niveaux } = etat;
        const steps = info.croches * 2;
        const pattern = Array.from({ length: steps }, () => []);
        const tie = Array.from({ length: steps }, () => []);
        const iv = {};
        for (const x of info.voix) {
            const v = x.index;
            for (let k = 0; k < info.croches; k++) {
                if (!on.has(cle(v, k))) continue;
                pattern[2 * k].push(v); pattern[2 * k + 1].push(v);
                tie[2 * k + 1].push(v);
                if (soude.has(cle(v, k))) tie[2 * k].push(v);
                else if (niveaux.has(cle(v, k))) iv[cle(v, 2 * k)] = NIVEAU_VALEUR[niveaux.get(cle(v, k))];
            }
        }
        data.arpPattern = serializeSeqPattern(pattern, tie);
        data.seqEdited = true;
        data.intensiteVoix = iv;
        data.intensityPerStep = {};
    }

    // Les croches d'une position du motif sur toute la durée de l'accord : le motif fait une mesure de 4/4 (8 croches), il se répète au-delà et
    // s'arrête où l'accord s'arrête (une mesure de 3/4 en garde les six premières).
    // Une POSITION du motif sur la durée de l'accord : ses croches (ks), celles qui sont soudées à la précédente (sd : une note tenue) et les niveaux
    // de ses attaques (nv). Motif fourni : croches voisines soudées, tout en « normal ». Forme ou retouche : soudures et intensités enregistrées
    // (« la forme garde les croches ET leurs intensités »). La croche 0 soudée = soudée à la croche 7 de la mesure d'avant (le motif qui se répète).
    function positionDe(motif, p, croches) {
        const liste = motif.v[p] || [], s = motif.s ? (motif.s[p] || []) : null, n = motif.n ? (motif.n[p] || {}) : null;
        const ks = new Set(), sd = new Set(), nv = new Map();
        for (let k = 0; k < croches; k++) if (liste.includes(k % 8)) ks.add(k);
        ks.forEach(k => {
            if (k > 0 && ks.has(k - 1) && (!s || s.includes(k % 8))) sd.add(k);
            else if (n && n[k % 8]) nv.set(k, n[k % 8]);
        });
        return { ks, sd, nv };
    }
    // Deux positions fondues en une voix (accord de moins de quatre sons) : leurs croches s'ajoutent ; une croche reste soudée seulement si elle
    // l'est partout où elle sonne (une attaque d'une des deux voix se réentend).
    function unionPositions(...P) {
        const ks = new Set(), sd = new Set(), nv = new Map();
        P.forEach(x => x.ks.forEach(k => ks.add(k)));
        ks.forEach(k => {
            const ou = P.filter(x => x.ks.has(k));
            if (ks.has(k - 1) && ou.every(x => x.sd.has(k))) sd.add(k);
            else { const a = ou.find(x => x.nv.has(k)); if (a) nv.set(k, a.nv.get(k)); }
        });
        return { ks, sd, nv };
    }
    const copiePosition = (x) => ({ ks: new Set(x.ks), sd: new Set(x.sd), nv: new Map(x.nv) });
    const memesCroches = (a, b) => a.size === b.size && [...a].every(k => b.has(k));

    // APPLIQUER UN MOTIF À UN ACCORD (cahier, « Accords de 3, 5 ou 6 notes » et « Renversements, basses différentes ») : renvoie, pour chaque
    // voix (hors notes libres, qu'un motif ne touche jamais), l'ensemble de ses croches.
    //  - 4 voix : une position chacune, de la plus grave à la plus aiguë ;
    //  - moins de voix : on garde toujours la basse et l'aiguë, les voix du milieu en trop « se fondent dans la voisine » (leurs croches s'ajoutent) ;
    //  - plus de voix (9e, 11e, 13e) : les voix en plus prennent le rythme COMMUN des voix au-dessus de la basse s'il existe (Plaqué, Pompe), sinon
    //    celui de la basse (Arpège) — règle confirmée le 11/11 (« Ok ça me va ») ; basse muette → la voix la plus proche en hauteur ;
    //  - une basse différente (C_E) est la voix la plus grave : elle prend le rythme de la basse, et le corps de l'accord se range au-dessus comme
    //    un accord sans elle.
    // Rend, pour chaque voix, une position { ks, sd, nv } (voir positionDe). La règle des notes en plus compare les croches seules (« sans tenir
    // compte des intensités ») ; la note en plus prend ensuite les intensités de la voix qu'elle suit.
    function motifSurVoix(motif, info) {
        const P = [0, 1, 2, 3].map(p => positionDe(motif, p, info.croches)); // [basse, voix 2, voix 3, aiguë]
        const out = new Map();
        let ordre = info.positions.slice();
        if (info.basse != null) {
            out.set(info.basse, copiePosition(P[0]));
            ordre = ordre.filter(i => i !== info.basse);
        }
        const n = ordre.length;
        if (n === 0) return out;
        if (n === 1) { out.set(ordre[0], unionPositions(...P)); return out; }
        if (n === 2) { out.set(ordre[0], unionPositions(P[0], P[1])); out.set(ordre[1], unionPositions(P[2], P[3])); return out; }
        if (n === 3) { out.set(ordre[0], copiePosition(P[0])); out.set(ordre[1], unionPositions(P[1], P[2])); out.set(ordre[2], copiePosition(P[3])); return out; }
        out.set(ordre[0], copiePosition(P[0])); out.set(ordre[1], copiePosition(P[1])); out.set(ordre[n - 2], copiePosition(P[2])); out.set(ordre[n - 1], copiePosition(P[3]));
        if (n > 4) {
            const hautCommun = memesCroches(P[1].ks, P[2].ks) && memesCroches(P[2].ks, P[3].ks);
            for (let j = 2; j < n - 2; j++) {
                let r;
                if (hautCommun) r = P[1];
                else if (P[0].ks.size > 0) r = P[0];
                else r = (j - 1 <= (n - 2) - j) ? P[1] : P[2]; // basse muette : la voix la plus proche (voix 2 en dessous, voix 3 au-dessus)
                out.set(ordre[j], copiePosition(r));
            }
        }
        return out;
    }

    // ENREGISTRER LA FORME (cahier, barre d'outils, point 3) : le rythme de l'accord choisi PAR POSITION, sur une mesure de huit croches — l'inverse
    // de motifSurVoix, pour qu'une forme prise sur un accord de trois sons se rejoue à l'identique sur lui (et par position sur les autres). Une basse
    // différente n'est pas une position : elle joue la basse du motif, c'est la voix juste au-dessus qui la dit. Les notes libres n'en font pas partie
    // (une forme a quatre voix).
    function formeDepuisEtat(etat) {
        const { info } = etat;
        let ordre = info.positions.filter(v => v !== info.basse);
        if (!ordre.length) ordre = info.positions.slice();
        const n = ordre.length;
        const source = n >= 4 ? [ordre[0], ordre[1], ordre[n - 2], ordre[n - 1]]
                     : n === 3 ? [ordre[0], ordre[1], ordre[1], ordre[2]]
                     : n === 2 ? [ordre[0], ordre[0], ordre[1], ordre[1]]
                     : n === 1 ? [ordre[0], ordre[0], ordre[0], ordre[0]] : [null, null, null, null];
        const v = [], s = [], niv = [];
        source.forEach((voix, p) => {
            v[p] = []; s[p] = []; niv[p] = {};
            if (voix == null) return;
            for (let k = 0; k < Math.min(8, info.croches); k++) {
                const c = cle(voix, k);
                if (!etat.on.has(c)) continue;
                v[p].push(k);
                if (etat.soude.has(c)) s[p].push(k);
                else if (etat.niveaux.has(c)) niv[p][k] = etat.niveaux.get(c);
            }
            // La croche 0 soudée à la mesure d'avant : l'accord tient sa note d'une mesure à l'autre.
            if (info.croches > 8 && etat.soude.has(cle(voix, 8)) && v[p].includes(0) && v[p].includes(7)) s[p].push(0);
        });
        return { v, s, n: niv };
    }

    // État d'un accord une fois le motif appliqué : les voix de l'accord prennent le motif (croches voisines soudées : une note tenue), niveaux
    // remis à « normal » ; les notes libres gardent leurs croches, leurs soudures et leurs niveaux.
    function etatAvecMotif(etat, motif) {
        const { info } = etat;
        const on = new Set(), soude = new Set(), niveaux = new Map();
        info.libres.forEach(v => {
            for (let k = 0; k < info.croches; k++) {
                const c = cle(v, k);
                if (etat.on.has(c)) on.add(c);
                if (etat.soude.has(c)) soude.add(c);
                if (etat.niveaux.has(c)) niveaux.set(c, etat.niveaux.get(c));
            }
        });
        motifSurVoix(motif, info).forEach((x, v) => {
            x.ks.forEach(k => {
                on.add(cle(v, k));
                if (x.sd.has(k)) soude.add(cle(v, k));
                else if (x.nv.has(k)) niveaux.set(cle(v, k), x.nv.get(k));
            });
        });
        return { info, on, soude, niveaux };
    }

    // ---- Notes libres (cahier, barre d'outils, point 5) ----------------------------------------------------------------------------------------
    // Une note libre est une LIGNE de la partie (« une ligne en pointillés sur tous les accords ») : la partie la retient (sec.notesLibres), et un
    // accord ne la porte dans ses notes (data.extraNotes) que lorsqu'on y pose une croche — une note libre sans croche n'est pas une voix fantôme
    // de l'accord (comptée dans ses diagrammes, sa pastille « voicing personnalisé »). Ajouter ou retirer une note libre décale l'index des voix qui
    // la suivent (la basse différente est rangée après elles, voir getSeqVoices) : l'état est donc RENUMÉROTÉ, jamais réécrit à la main.
    function renumeroter(etat, info2, f) {
        const on = new Set(), soude = new Set(), niveaux = new Map();
        const map = (c) => { const [v, k] = c.split(':').map(Number); const w = f(v); return w == null ? null : cle(w, k); };
        etat.on.forEach(c => { const d = map(c); if (d) on.add(d); });
        etat.soude.forEach(c => { const d = map(c); if (d) soude.add(d); });
        etat.niveaux.forEach((n, c) => { const d = map(c); if (d) niveaux.set(d, n); });
        return { info: info2, on, soude, niveaux };
    }
    // `m` : { etat, extraNotes } d'un accord en cours d'écriture ; `data` : l'accord (pour ses autres réglages). Rend l'index de la nouvelle voix.
    function ajouterLibre(m, data, midi) {
        const extra = (m.extraNotes || []).concat([noteDe(midi)]);
        const info2 = voixDe({ ...data, extraNotes: extra });
        const ancienne = m.etat.info.basse;
        m.etat = renumeroter(m.etat, info2, v => (ancienne != null && v === ancienne) ? info2.basse : v);
        m.extraNotes = extra;
        return info2.libres[info2.libres.length - 1];
    }
    function retirerLibre(m, data, v) {
        const corps = m.etat.info.corps, j = v - corps;
        const extra = (m.extraNotes || []).filter((_, i) => i !== j);
        const info2 = voixDe({ ...data, extraNotes: extra });
        m.etat = renumeroter(m.etat, info2, w => w < v ? w : (w === v ? null : w - 1));
        m.extraNotes = extra;
    }
    // La voix d'un accord à une hauteur donnée : une voix de l'accord d'abord, une note libre ensuite (vue « Toutes les notes ») ; `libre` : parmi
    // les notes libres seulement (vue Voix).
    function voixALaHauteur(info, midi, libre) {
        const ok = (x) => x.midi === midi && (libre ? x.libre : true);
        const corps = info.voix.find(x => ok(x) && !x.libre);
        if (corps && !libre) return corps.index;
        const l = info.voix.find(x => ok(x) && x.libre);
        return l ? l.index : null;
    }

    // Allumer / éteindre une croche en gardant le reste.
    // RETOUR DE L'UTILISATEUR (12/11, séquenceur du téléphone) : « 2 notes créées côte à côte = une note longue de 2 temps au lieu de 2 temps staccato. 2 notes
    // consécutives ne doivent pas constituer une note tenue » — une croche posée reste donc une attaque À PART, même collée à une autre. Une note tenue se fait
    // exprès : en peignant d'un trait (le glissé à la souris, l'appui long puis le glissé au doigt, voir peindre), ou par « Prolonger » au clic droit.
    // « Il est difficile de supprimer une note longue : elle se scinde en plusieurs notes au lieu de se supprimer complètement » — enlever UNE croche d'une note
    // longue enlève la note ENTIÈRE ; pour la scinder on le demande (« clic droit / Scinder la note », voir scinderNote).
    function poserCroche(etat, v, k, allumer) {
        const c = cle(v, k);
        if (allumer) {
            if (etat.on.has(c)) return false;
            etat.on.add(c);
            etat.soude.delete(c); etat.niveaux.delete(c);
            return true;
        }
        if (!etat.on.has(c)) return false;
        const [d, f] = bornesBarre(etat, v, k);
        for (let j = d; j <= f; j++) { const x = cle(v, j); etat.on.delete(x); etat.soude.delete(x); etat.niveaux.delete(x); }
        return true;
    }

    // Enlever UNE croche d'une note tenue en coupant la barre en deux (l'ancien geste) : réservé à l'éditeur de schéma d'un motif (clic droit sur une vignette),
    // petite grille de 4 × 8 sans menu où « Plaqué » est fait de longues barres qu'on raccourcit croche par croche.
    function couperCroche(etat, v, k) {
        const c = cle(v, k), apres = cle(v, k + 1);
        if (!etat.on.has(c)) return false;
        const niveauBarre = niveauDe(etat, v, k);
        etat.on.delete(c); etat.soude.delete(c); etat.niveaux.delete(c);
        if (etat.soude.has(apres)) { etat.soude.delete(apres); if (niveauBarre !== 'normal') etat.niveaux.set(apres, niveauBarre); }
        return true;
    }

    // Les croches de la note qui contient k : de son attaque à sa dernière croche soudée (une note seule : [k, k]).
    function bornesBarre(etat, v, k) {
        let d = k, f = k;
        while (d > 0 && etat.on.has(cle(v, d - 1)) && etat.soude.has(cle(v, d))) d--;
        while (etat.on.has(cle(v, f + 1)) && etat.soude.has(cle(v, f + 1))) f++;
        return [d, f];
    }

    // Soude la croche k à la précédente (la note devient tenue) : la croche de droite ne porte plus de niveau propre, c'est l'attaque de la barre qui le porte.
    function souder(etat, v, k) {
        if (!etat.on.has(cle(v, k)) || !etat.on.has(cle(v, k - 1))) return false;
        etat.soude.add(cle(v, k)); etat.niveaux.delete(cle(v, k));
        return true;
    }

    // « Scinder la note » : la croche k devient l'attaque d'une nouvelle note, qui garde le niveau de la barre dont elle sort. Impossible sur une attaque.
    function scinderNote(etat, v, k) {
        if (!etat.on.has(cle(v, k)) || !etat.soude.has(cle(v, k))) return false;
        const niveau = niveauDe(etat, v, k);
        etat.soude.delete(cle(v, k));
        if (niveau !== 'normal') etat.niveaux.set(cle(v, k), niveau);
        return true;
    }

    // « Prolonger » : la note qui contient k tient une croche de plus, si la place est libre et dans la mesure montrée.
    function prolongerNote(etat, v, k, croches) {
        const f = bornesBarre(etat, v, k)[1];
        if (!etat.on.has(cle(v, k)) || f + 1 >= croches || etat.on.has(cle(v, f + 1))) return false;
        etat.on.add(cle(v, f + 1)); etat.soude.add(cle(v, f + 1)); etat.niveaux.delete(cle(v, f + 1));
        return true;
    }

    // ÉTIRER / RACCOURCIR UNE NOTE AUX POIGNÉES (13/11 : « ajoute des poignées à droite et à gauche des notes pour pouvoir les étirer ou les raccourcir. On l'avait mis
    // en place pour HarmoHub »). `fixe` est une croche de la note qui ne bougera pas (son attaque quand on tire la poignée de DROITE, sa dernière croche quand on tire
    // celle de GAUCHE) ; `k` est la croche sous le pointeur, qui devient le nouveau bout. Une note garde au moins UNE croche, et ne passe jamais sur sa voisine : elle
    // s'arrête contre elle (rien n'est écrasé en silence). Le niveau d'intensité est porté par l'attaque : il la suit quand c'est le bord gauche qui bouge.
    function etirerNote(etat, v, fixe, cote, k, croches) {
        if (!etat.on.has(cle(v, fixe))) return false;
        const [d, f] = bornesBarre(etat, v, fixe);
        let nd = d, nf = f;
        if (cote === 'd') {
            let haut = croches - 1;
            for (let j = f + 1; j < croches; j++) if (etat.on.has(cle(v, j))) { haut = j - 1; break; }
            nf = borner(k, d, haut);
        } else {
            let bas = 0;
            for (let j = d - 1; j >= 0; j--) if (etat.on.has(cle(v, j))) { bas = j + 1; break; }
            nd = borner(k, bas, f);
        }
        if (nd === d && nf === f) return false;
        const niveau = niveauDe(etat, v, d);
        for (let j = d; j <= f; j++) { const x = cle(v, j); etat.on.delete(x); etat.soude.delete(x); etat.niveaux.delete(x); }
        for (let j = nd; j <= nf; j++) { const x = cle(v, j); etat.on.add(x); if (j > nd) etat.soude.add(x); }
        if (niveau !== 'normal') etat.niveaux.set(cle(v, nd), niveau);
        return true;
    }

    // Efface une note ENTIÈRE (de la croche d à la croche f de la voix v) : ses croches, leurs soudures et son niveau.
    function retirerCroches(etat, v, d, f) {
        for (let j = d; j <= f; j++) { const x = cle(v, j); etat.on.delete(x); etat.soude.delete(x); etat.niveaux.delete(x); }
    }

    // Début de la barre qui contient la croche k, et son niveau (il est porté par l'attaque).
    function debutBarre(etat, v, k) {
        let d = k;
        while (d > 0 && etat.soude.has(cle(v, d))) d--;
        return d;
    }
    function niveauDe(etat, v, k) {
        return etat.niveaux.get(cle(v, debutBarre(etat, v, k))) || 'normal';
    }

    // ---------------------------------------------------------------------------------------------------------------------------------
    // LE COMPOSANT
    // ---------------------------------------------------------------------------------------------------------------------------------

    class Sequenceur {
        constructor(app) {
            this.app = app;
            this.racine = document.getElementById('sequenceur');
            this.grille = document.getElementById('sq-grille');
            // TÉLÉPHONE (troisième sous-lot de D) : le même nœud est DÉPLACÉ dans le panneau d'accord, onglet « Rythme » (placerTelephone), jamais
            // dupliqué — mêmes adresses, mêmes écouteurs, comme la carte Accord dans « Réglages du son ». On retient sa place pour l'y remettre.
            this._origine = this.racine ? { parent: this.racine.parentElement, suivant: this.racine.nextSibling } : null;
            this._telVisible = false;
            this.bouton = document.getElementById('vue-sequenceur');
            this.repere = document.getElementById('sq-tete');   // la fine barre verte de la tête de lecture (ordinateur)
            this.intensite = false;
            this.presse = null;          // rythme copié : { de: nom, voix: [ [croches], ... ] par position, niveaux }
            this.portee = lireLocal(CLE_PORTEE) === 'accord' ? 'accord' : 'partie';
            const h = parseInt(lireLocal(CLE_LIGNE), 10);
            this.ligne = borner(isNaN(h) ? LIGNE_DEFAUT : h, LIGNE_MIN, LIGNE_MAX);
            const w = parseInt(lireLocal(CLE_CROCHE), 10);
            this.croche = borner(isNaN(w) ? CROCHE_DEFAUT : w, CROCHE_MIN, CROCHE_MAX);
            // Nombre de lignes montrées (« je préfère pouvoir voir plus de notes ») : 0 = toutes. Les barres gardent leur hauteur ; la poignée du haut change ce nombre.
            this._visibles = 0;
            const contenu = lireLocal(CLE_CONTENU);
            this.contenu = contenu === 'rien' || contenu === 'degres' ? contenu : 'notes';
            this.regle = lireLocal(CLE_REGLE) !== '0';
            this.auto = lireLocal(CLE_AUTO) === '1';
            // La ligne de la grille montrée (L1c) : { s, i } = la partie et l'accord où l'on était. Sans accord choisi, le séquenceur y reste (ou suit la lecture) au lieu de
            // sauter au premier accord ; `_montres` = les accords de cette ligne, `_s` / `_i` la partie et l'accord réglés (posés par rafraichir).
            // LA SÉLECTION DE NOTES (L2) : { c, k, midi } par note — l'accord, la croche d'attaque et la hauteur (pas un numéro de ligne : poser une note libre en ajoute une et
            // décale les lignes). Elle ne vaut que pour la ligne montrée (`_selCle`) et se vide dès qu'on en change.
            this.sel = [];
            this._selCle = null;
            this._vise = null;
            this._viseActive = null;   // la partie active au moment où `_vise` a été posée : si elle change (monter, supprimer, ajouter une partie), la ligne visée est périmée
            this._montres = [];
            this._tete = null;
            this._geste = null;
            this.vue = lireLocal(CLE_VUE) === 'notes' ? 'notes' : 'voix';
            this.schema = null;          // le schéma en cours de retouche (clic droit sur une vignette), voir ouvrirSchema
            this.libre = { ouvert: false, note: 'C', octave: 4 };   // la bande « Note libre » (maquette : « Ajouter C4 »)
            if (!this.racine || !this.grille) return;
            this.brancher();
            // Une forme enregistrée, retouchée ou supprimée — ici, dans un autre onglet ou sur un autre appareil : les vignettes et le motif suivi changent.
            const f = magasin();
            if (f) f.surChangement(() => this.rafraichir());
        }

        estOrdinateur() { return window.matchMedia('(min-width: 900px)').matches; }
        estOuvert() { return !!this.racine && !this.racine.hidden; }
        // Au téléphone, dans le panneau d'accord : on ne montre que l'accord du panneau (maquette `Telephone.dc.html` : huit croches, une ligne par voix).
        modeTel() { return !this.estOrdinateur() && !!this.racine && !!this.racine.closest('#pa-rythme'); }
        // Au téléphone, le séquenceur occupe tout l'écran entre la barre du haut et la barre de lecture (12/11 : « sur portable, il serait peut-être plus simple de
        // l'afficher en plein écran ») : « Toute la partie » y montre tous les accords, qu'on fait défiler de côté, « Cet accord » le seul accord du panneau.
        uneSeule() { return this.modeTel() && this.portee === 'accord'; }
        // À l'ordinateur tout agit sur l'accord choisi (L3, 14/11 : plus de choix de portée) ; le choix « Toute la partie | Cet accord » n'existe plus que pour le téléphone (L7).
        porteeEffective() { return this.estOrdinateur() ? 'accord' : this.portee; }
        // Mode « Dessiner » (au doigt seulement) : la grille ne défile plus, le doigt peint d'un trait une note tenue. Éteint tant qu'on ne l'allume pas.
        basculerDessin(oui) { this.dessin = oui === undefined ? !this.dessin : !!oui; this.majDessin(); }
        majDessin() {
            const b = document.getElementById('sq-dessin');
            if (b) {
                b.setAttribute('aria-pressed', String(!!this.dessin));
                b.title = this.dessin ? 'Dessiner allumé : le doigt peint d\'un trait une note tenue et la grille ne défile plus. Cliquer pour revenir au défilement' : 'Dessiner éteint : le doigt fait défiler, un toucher pose ou enlève une note. Cliquer pour peindre d\'un trait une note tenue';
            }
            if (this.racine) this.racine.classList.toggle('sq-dessin', !!this.dessin);
        }

        // Ouvert ou fermé : retenu par l'appareil À L'ORDINATEUR. Au téléphone, le séquenceur n'existe que dans le panneau d'accord (onglet
        // « Rythme ») : le bouton « Séquenceur » du panneau Lecture ouvre ce panneau sur l'onglet (app.ouvrirRythmeTelephone), sans toucher au réglage
        // de l'ordinateur.
        voulu() { return lireLocal(CLE_OUVERT) === '1'; }
        basculer(ouvrir) {
            if (!this.estOrdinateur()) {
                // APRÈS le clic qui nous appelle : il remonte encore jusqu'au document, où la fermeture « au clic à côté » (this._popups) refermerait
                // aussitôt le panneau qu'on vient d'ouvrir (le bouton n'est pas dans le panneau). Constaté au premier essai : le panneau ne s'ouvrait pas.
                const voulu = ouvrir == null ? !this._telVisible : !!ouvrir;
                if (this.app.ouvrirRythmeTelephone) setTimeout(() => this.app.ouvrirRythmeTelephone(voulu), 0);
                return;
            }
            const o = ouvrir == null ? !this.voulu() : !!ouvrir;
            ecrireLocal(CLE_OUVERT, o ? '1' : '0');
            this.synchroniser();
        }

        // Appelé par le panneau d'accord du téléphone : onglet « Rythme » ouvert (le séquenceur y vient) ou quitté (il retourne à sa place, au-dessus du
        // tiroir, où l'ordinateur le retrouve si l'écran s'élargit).
        placerTelephone(oui) {
            if (!this.racine || !this._origine) return;
            const hote = document.getElementById('pa-rythme');
            this._telVisible = !!(oui && hote);
            if (this._telVisible) {
                if (this.racine.parentElement !== hote) hote.appendChild(this.racine);
            } else if (this.racine.parentElement !== this._origine.parent) {
                const o = this._origine;
                o.parent.insertBefore(this.racine, o.suivant && o.suivant.parentNode === o.parent ? o.suivant : null);
            }
            this.synchroniser();
            // L'onglet vient de s'afficher : sa grille n'avait pas de mise en page au premier dessin (offsetLeft à 0), on la replace sur l'accord du panneau.
            if (this._telVisible) requestAnimationFrame(() => { this._vuAccord = null; this.rafraichir(); });
        }

        synchroniser() {
            if (!this.racine) return;
            const montrer = this.estOrdinateur() ? (this.voulu() && !this._telVisible) : this._telVisible;
            this.racine.hidden = !montrer;
            if (!montrer) this.majTrait();   // fermé : plus de trait sous la ligne dans la grille
            if (this.bouton) {
                this.bouton.setAttribute('aria-pressed', String(montrer));
                this.bouton.classList.toggle('active', montrer);
            }
            if (montrer) this.rafraichir();
        }

        // Partie et accord montrés : la partie de l'accord choisi (ou la partie active), l'accord choisi, sinon le premier.
        cible() {
            const sections = loadProgressionSections();
            const s = borner(this.app.activeSection || 0, 0, Math.max(0, sections.length - 1));
            const sec = sections[s];
            const accords = (sec && sec.chords) || [];
            let i = this.app.selectedIndex;
            if (i == null && this.app.editingIndex != null) i = this.app.editingIndex;
            // Au téléphone, l'accord du panneau (‹ › le changent) : c'est lui qu'on règle.
            const z = this.app._bulle;
            if (this.modeTel() && z && z.telephone && sections[z.section] && sections[z.section].chords[z.index]) {
                const sz = sections[z.section];
                return { sections, s: z.section, sec: sz, accords: sz.chords, i: z.index };
            }
            // L1c (14/11, « je ne veux pas de séquenceur inerte ») : sans accord choisi, il reste sur la ligne où il était, au lieu de retomber sur le premier accord de la partie.
            if (i == null && this._vise && !this.modeTel() && this._viseActive === (this.app.activeSection || 0)) {
                const sv = sections[this._vise.s];
                if (sv && sv.chords[this._vise.i]) return { sections, s: this._vise.s, sec: sv, accords: sv.chords, i: this._vise.i };
            }
            if (i == null || i >= accords.length) i = accords.length ? 0 : null;
            return { sections, s, sec, accords, i };
        }

        // ---- Rendu ----------------------------------------------------------------------------------------------------------------
        rafraichir() {
            if (!this.estOuvert()) return;
            const { sec, accords, s, i } = this.cible();
            this._s = s; this._i = i;
            if (!this.modeTel()) { this._vise = i != null ? { s, i } : null; this._viseActive = this.app.activeSection || 0; }
            this.poserLigne();
            this.majBarreOutils(accords, i);
            if (!sec || accords.length === 0) {
                this.grille.innerHTML = '<p class="sq-vide">Ajoute un accord à la partie pour régler son rythme ici.</p>';
                this._etats = [];
                this._montres = [];
                this.limiterHauteur();
                this.majLigne();
                this.majTrait();
                return;
            }
            const etats = accords.map(d => lireAccord(d, this.app));
            this._etats = etats;
            const nPos = Math.max(...etats.map(e => e.info.positions.length));
            // Les notes libres de la partie, PAR HAUTEUR : celles qu'elle retient (ajoutées par la bande « Note libre ») et celles que ses accords
            // portent déjà (posées avec l'ancien séquenceur). Une ligne par hauteur, la même sur tous les accords.
            const midisLibres = new Set();
            (sec.notesLibres || []).forEach(x => { const m = midiDe(x.note, x.octave); if (!isNaN(m)) midisLibres.add(m); });
            etats.forEach(e => e.info.libres.forEach(v => midisLibres.add(e.info.voix[v].midi)));
            const lignes = [];
            if (this.vue === 'notes') {
                // « TOUTES LES NOTES » (planche 2) : seulement les hauteurs utilisées par la partie (jamais 60 lignes), de la plus aiguë à la plus grave.
                const toutes = new Set(midisLibres);
                etats.forEach(e => e.info.voix.forEach(x => toutes.add(x.midi)));
                [...toutes].sort((a, b) => b - a).forEach(midi => lignes.push({ type: 'hauteur', midi }));
            } else {
                // Lignes de haut en bas : notes libres (en pointillés), puis les voix de l'aiguë à la basse. Un accord plus pauvre que le plus riche de
                // la partie laisse ses lignes du haut vides (cahier : « vides, sans hachures »).
                [...midisLibres].sort((a, b) => b - a).forEach(midi => lignes.push({ type: 'libre', midi }));
                for (let p = nPos - 1; p >= 0; p--) lignes.push({ type: 'voix', p });
            }
            this._lignes = lignes;
            const voixLigne = (e, L) => L.type === 'voix' ? (e.info.positions[L.p] != null ? e.info.positions[L.p] : null)
                                                      : voixALaHauteur(e.info, L.midi, L.type === 'libre');
            this._voixLigne = voixLigne;

            const bpb = this.app.beatsPerBar();
            const flats = (d) => this.app.useFlatsForRoot(d.root);
            const nomNote = (e, v, d) => { const x = e.info.voix[v]; return x ? midiToDisplayName(x.midi, flats(d)) : ''; };
            const rgb = (role) => {
                const hex = (ROLE_COLOR[role] || ROLE_COLOR.neutral).replace('#', '');
                return [0, 2, 4].map(o => parseInt(hex.substr(o, 2), 16)).join(',');
            };

            // Colonnes : étiquettes (46 px), un petit jour (10 px), puis les croches de chaque accord, un trait de 4 px entre deux accords.
            // (On compte les PISTES une à une : un « repeat(8, …) » en vaut huit.)
            // Au téléphone : l'accord du panneau seul (les autres sont à un ‹ › de là). Les index restent ceux de la partie (data-c, écriture).
            // À l'ordinateur (L1c) : les accords de LA LIGNE de la grille où se trouve l'accord choisi, comme elle est dessinée (au nombre de mesures de la Vue) ; au téléphone
            // l'accord du panneau seul, ou toute la partie qui défile de côté — rien n'y change.
            const montres = this.uneSeule() && i != null ? [i] : this.ligneMontree(s, i, accords);
            this._montres = montres;
            const colDebut = [];
            const crochesParAccord = [];
            let piste = 3;
            montres.forEach((c, n) => {
                // L'écart entre deux accords est nul (14/11, « les mesures se touchent ») : le trait de début de mesure suffit à les séparer.
                colDebut[c] = piste; // indexé par l'accord (au téléphone, un seul est montré : l'index n'est pas le rang)
                crochesParAccord.push(etats[c].info.croches);
                piste += etats[c].info.croches;
            });
            // La poignée de largeur est une piste de la grille elle-même, juste après la dernière croche : elle suit les croches quand on les élargit et ne demande aucun calcul
            // de position. Ordinateur seulement (au téléphone la croche reste à 30 px au moins et la grille défile de côté).
            const poigneeLargeur = !this.modeTel() && lignes.length > 0;
            this._plan = { croches: crochesParAccord, poignee: poigneeLargeur };
            this._nCroches = crochesParAccord.reduce((a, b) => a + b, 0);
            this.poserColonnes();
            const regle = this.estOrdinateur() ? this.regle : true;
            this.racine.classList.toggle('sans-regle', !regle);
            this.grille.style.gridTemplateRows = `auto ${regle ? '20px' : '0px'} repeat(${lignes.length}, var(--sq-ligne))`;

            const r = this.app.loopRange;
            let boucle = r && r.startSection === s && r.endSection === s ? [r.startIndex, r.endIndex] : null;
            // La bande orange ne couvre que ce qui est montré (les index de la plage sont ceux de la partie : ceux d'une autre ligne n'ont pas de colonne ici).
            if (boucle && montres.length > 1) {
                const a = Math.max(boucle[0], montres[0]), b = Math.min(boucle[1], montres[montres.length - 1]);
                boucle = a <= b ? [a, b] : null;
            }
            // Au téléphone, la bande orange ne couvre que ce qui est montré : l'accord du panneau, s'il est dans la plage.
            if (boucle && montres.length === 1) boucle = (montres[0] >= boucle[0] && montres[0] <= boucle[1]) ? [montres[0], montres[0]] : null;
            const html = [];
            // Rangée 1 : nom et degré de chaque accord (un clic le choisit) ; rangée 2 : la règle, numéros de temps seulement.
            const gRoot = (document.getElementById('global-root') || {}).value, gMode = (document.getElementById('global-mode') || {}).value;
            let tempsAvant = 0;
            for (let c = 0; c < montres[0]; c++) tempsAvant += etats[c].info.croches / 2; // le premier temps montré : celui de l'accord dans la partie
            montres.forEach((c) => {
                const d = accords[c];
                const e = etats[c], col = colDebut[c];
                const nom = flatTight(e.info.chord.getLabel(flats(d)));
                let degre = '';
                try { degre = this.app.getRomanNumeral(gRoot, gMode, d.root, d.quality) || ''; } catch (err) { degre = ''; /* tonalité illisible : pas de degré */ }
                html.push(`<div class="sq-nom${c === i ? ' choisi' : ''}" data-c="${c}" style="grid-row:1;grid-column:${col} / span ${e.info.croches}" title="Choisir ${escapeHtml(nom)}">${nom}${degre ? ` <span class="sq-degre">${escapeHtml(degre)}</span>` : ''}</div>`);
                for (let k = 0; k < e.info.croches; k++) {
                    const temps = tempsAvant + k / 2;
                    const mot = k % 2 === 0 ? String((Math.floor(temps) % bpb) + 1) : '';
                    const dans = boucle && c >= boucle[0] && c <= boucle[1];
                    html.push(`<div class="sq-temps${dans ? ' dans-boucle' : ''}${k % 2 === 0 ? ' temps' : ''}" data-c="${c}" data-k="${k}" style="grid-row:2;grid-column:${col + k}">${mot}</div>`);
                }
                tempsAvant += e.info.croches / 2;
            });
            if (boucle) {
                const a = colDebut[boucle[0]], fin = colDebut[boucle[1]] + etats[boucle[1]].info.croches;
                html.push(`<div class="sq-boucle" role="button" tabindex="0" aria-label="Retirer la plage à boucler" title="Cliquer pour retirer la plage à boucler" style="grid-row:2;grid-column:${a} / ${fin}"></div>`);
            }
            // Les lignes : étiquette (le nom de la note de l'accord choisi, dessiné comme une touche de piano), puis les cases.
            // NOTE LIBRE : le bouton « note de musique » est À GAUCHE, dans la colonne des noms de notes, juste au-dessus d'eux, en face de la règle
            // (« ni en dessous, où il se déplaçait à chaque ligne ajoutée, ni dans la barre d'outils », 11/11).
            html.push(`<button type="button" class="sq-libre-btn" aria-pressed="${this.libre.ouvert}" aria-label="Ajouter une note libre" title="Ajouter une note libre : choisir son nom et son octave, puis la poser dans le séquenceur" style="grid-row:1 / 3;grid-column:1"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/><path d="M4 4h4M6 2v4"/></svg></button>`);
            const flatsPartie = flats(accords[i != null ? i : 0]);
            const eSel = i != null ? etats[i] : etats[0], dSel = i != null ? accords[i] : accords[0];
            lignes.forEach((L, ri) => {
                const row = ri + 3;
                const vSel = voixLigne(eSel, L);
                // Vue Voix : le nom de la note de l'accord choisi ; une note libre ou une ligne de « Toutes les notes » : SA hauteur, la même partout.
                const nomSel = L.type === 'voix' ? (vSel != null ? nomNote(eSel, vSel, dSel) : '') : midiToDisplayName(L.midi, flatsPartie);
                const diese = L.type === 'voix' ? /[#♯♭b]/.test(nomSel.replace(/^[A-G]/, '').replace(/-?\d+$/, '')) : [1, 3, 6, 8, 10].includes(((L.midi % 12) + 12) % 12);
                const retirer = L.type === 'libre'
                    ? `<button type="button" class="sq-libre-retirer" data-midi="${L.midi}" aria-label="Retirer la note libre ${escapeHtml(nomSel)}" title="Retirer la note libre ${escapeHtml(nomSel)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>` : '';
                html.push(`<div class="sq-etiq${diese ? ' diese' : ''}${L.type === 'libre' ? ' libre' : ''}" style="grid-row:${row};grid-column:1">${retirer}${escapeHtml(nomSel)}</div>`);
                montres.forEach((c) => {
                    const d = accords[c];
                    const e = etats[c], v = voixLigne(e, L), col = colDebut[c];
                    for (let k = 0; k < e.info.croches; k++) {
                        const cls = ['sq-case'];
                        if (k % 2 === 0) cls.push('temps');
                        if (k === 0) cls.push('mesure');
                        if (c === i) cls.push('choisi');
                        if (boucle && c >= boucle[0] && c <= boucle[1]) cls.push('dans-boucle');
                        if (ri % 2 === 1) cls.push('pair');
                        if (v == null && L.type === 'voix') {
                            html.push(`<div class="${cls.join(' ')} sans-voix" style="grid-row:${row};grid-column:${col + k}"></div>`);
                            continue;
                        }
                        if (v == null) {
                            // Une note libre (ou une hauteur) que cet accord ne porte pas encore : case normale et cliquable (« c'est bizarre », les cases
                            // grisées) — y poser une croche ajoute la note à l'accord.
                            html.push(`<div class="${cls.join(' ')}" role="gridcell" aria-label="${escapeHtml(`${nomSel}, croche ${k + 1} : vide`)}" data-c="${c}" data-k="${k}" data-r="${ri}" style="grid-row:${row};grid-column:${col + k}"></div>`);
                            continue;
                        }
                        const x = e.info.voix[v];
                        const allume = e.on.has(cle(v, k));
                        let note = '', label = `${nomNote(e, v, d)}, croche ${k + 1}`;
                        if (allume) {
                            const g = e.soude.has(cle(v, k)), dr = e.soude.has(cle(v, k + 1)) && e.on.has(cle(v, k + 1));
                            const niv = niveauDe(e, v, k);
                            cls.push('on');
                            if (g) cls.push('soude-g');
                            if (dr) cls.push('soude-d');
                            if (x.libre) cls.push('libre');
                            cls.push('niv-' + niv);
                            // Les POIGNÉES aux deux bouts de la note (13/11) : à gauche sur son attaque, à droite sur sa dernière croche ; une note d'une croche porte les deux.
                            const poigneeG = g ? '' : '<i class="sq-bord g" title="Tirer pour étirer ou raccourcir la note" aria-hidden="true"></i>';
                            const poigneeD = dr ? '' : '<i class="sq-bord d" title="Tirer pour étirer ou raccourcir la note" aria-hidden="true"></i>';
                            note = `<span class="sq-note" style="--sq-rgb:${rgb(x.role)}">${poigneeG}${g ? '' : escapeHtml(this.texteBarre(e, v, d, nomNote))}${poigneeD}</span>`;
                            label += ` : ${niv}`;
                        } else label += ' : vide';
                        html.push(`<div class="${cls.join(' ')}" role="gridcell" aria-label="${escapeHtml(label)}" data-c="${c}" data-v="${v}" data-k="${k}" data-r="${ri}" style="grid-row:${row};grid-column:${col + k}">${note}</div>`);
                    }
                });
            });
            if (poigneeLargeur) html.push(`<div class="sq-poignee-largeur" role="separator" aria-orientation="vertical" aria-label="Largeur des croches du séquenceur" title="Tirer pour élargir ou resserrer les croches — double-clic : largeur d'origine (${CROCHE_DEFAUT} px)" style="grid-row:3 / span ${lignes.length};grid-column:${piste}"></div>`);
            const defile = this.grille.scrollLeft; // le défilement de côté survit aux rendus (poser une croche redessine toute la grille)
            this.grille.innerHTML = html.join('');
            this._colDebut = colDebut;
            if (this.modeTel()) {
                // Au téléphone, l'accord du panneau vient sous le doigt dès qu'il change (‹ ›, un autre accord touché) ; sinon on garde la place où l'on était.
                const el = i != null ? this.grille.querySelector(`.sq-nom[data-c="${i}"]`) : null;
                const changement = this._vuAccord !== `${s}/${i}`;
                this._vuAccord = `${s}/${i}`;
                this.grille.scrollLeft = changement && el ? Math.max(0, el.offsetLeft - 56 - 12) : defile;
            }
            this._tete = null;
            // La sélection de notes ne survit qu'à un redessin de la MÊME ligne (poser, déplacer, étirer) : autre partie, autre ligne ou autre vue, elle se vide.
            const cleSel = `${s}|${this.vue}|${montres.join()}`;
            if (cleSel !== this._selCle) { this._selCle = cleSel; this.sel = []; }
            this.marquerSelection();
            if (this.auto && !this.modeTel()) this.poserLigne();   // le nombre de lignes vient d'être connu
            this.majNomsRythmes();
            this.limiterHauteur();
            this.majLigne();
            this.majTrait();
            this.placerReglages();
        }

        // Ce qu'écrit une barre (L3, roue des réglages : « Barres : Rien | Notes | Degrés ») : le nom de la note, son degré dans l'accord, ou rien. Le téléphone écrit toujours les noms.
        texteBarre(e, v, d, nomNote) {
            if (this.modeTel() || this.contenu === 'notes') return nomNote(e, v, d);
            if (this.contenu === 'rien') return '';
            const x = e.info.voix[v], racine = NOTES.indexOf(d.root);
            return x && racine >= 0 ? DEGRES[(((x.midi - racine) % 12) + 12) % 12] : '';
        }

        // La ligne de la grille où se trouve l'accord `i` de la partie `s` : ses index d'accords (ceux qui y ont une case), dans l'ordre. Tous les accords de la partie si la grille
        // n'a pas (encore) de lignes, au téléphone, ou sans accord choisi.
        ligneMontree(s, i, accords) {
            const tous = accords.map((_, c) => c);
            if (this.modeTel() || i == null || !this.app.lignesDePartie) return tous;
            const ligne = this.app.lignesDePartie(s).find(l => l.includes(i));
            return ligne && ligne.length ? ligne : tous;
        }
        // La ligne voisine (delta = -1 ou 1), en passant d'une partie à l'autre ; l'accord visé garde son rang dans la ligne. Null au premier ou au dernier bout.
        voisine(delta) {
            if (this.modeTel()) return null;
            const c = this.cible();
            if (c.i == null) return null;
            const L = this.app.lignesDePartie(c.s), n = L.findIndex(l => l.includes(c.i));
            if (n < 0) return null;
            const rang = L[n].indexOf(c.i), m = n + delta;
            if (m >= 0 && m < L.length) return { s: c.s, i: L[m][Math.min(rang, L[m].length - 1)] };
            for (let k = c.s + delta; k >= 0 && k < c.sections.length; k += delta) {
                const L2 = this.app.lignesDePartie(k);
                if (!L2.length) continue;
                const ligne = delta > 0 ? L2[0] : L2[L2.length - 1];
                return { s: k, i: ligne[Math.min(rang, ligne.length - 1)] };
            }
            return null;
        }
        // ▲ ▼ : changer de ligne sans recliquer. Avec un accord choisi la sélection SUIT (même rang sur la nouvelle ligne) ; sans, seul le séquenceur change.
        allerLigne(delta) {
            const v = this.voisine(delta);
            if (!v) return;
            this._vise = v;
            this._viseActive = this.app.activeSection || 0;
            if (this.app.selectedIndex != null) {
                this.app.activeSection = v.s;
                this._viseActive = v.s;
                this.app.selectedIndex = v.i;
                if (this.app.multiSelect) this.app.multiSelect = new Set();
                this.app.loadProgression();   // redessine la grille, puis le séquenceur (fin de loadProgression)
            } else this.rafraichir();
        }
        // Dans la barre d'outils : le nom de la partie, « n/total » s'il y a plusieurs lignes, et les deux flèches (grisées, mais visibles, à chaque bout).
        majLigne() {
            const prec = document.getElementById('sq-ligne-prec'), suiv = document.getElementById('sq-ligne-suiv'), txt = document.getElementById('sq-ligne-txt');
            if (!prec || !suiv || !txt) return;
            const ok = !this.modeTel() && this._i != null;
            prec.disabled = !ok || !this.voisine(-1);
            suiv.disabled = !ok || !this.voisine(1);
            const nom = txt.querySelector('.sq-ligne-nom'), n = txt.querySelector('.sq-ligne-n');
            const sec = loadProgressionSections()[this._s];
            const L = ok ? this.app.lignesDePartie(this._s) : [], rang = ok ? L.findIndex(l => l.includes(this._i)) : -1;
            const titre = sec ? ((sec.title && sec.title.trim()) || 'Partie ' + (this._s + 1)) : '';
            const num = rang >= 0 && L.length > 1 ? (rang + 1) + '/' + L.length : '';
            if (nom.textContent !== titre) nom.textContent = titre;
            if (n.textContent !== num) n.textContent = num;
            const tip = rang >= 0 ? `${titre} : ligne ${rang + 1} sur ${L.length} — les flèches changent de ligne dans la grille` : 'Ligne de la grille montrée par le séquenceur';
            if (txt.title !== tip) txt.title = tip;
        }
        // LE TRAIT sous la ligne montrée, dans la grille (« un trait continu avec une lumière un petit peu diffuse », S1) : un seul élément, posé dans le .chord-grid de la partie, de
        // la première à la dernière case de la ligne ; il glisse d'une ligne à l'autre quand c'est la même grille (▲ ▼). Retiré si le séquenceur est fermé ou au téléphone.
        majTrait() {
            const anciens = [...document.querySelectorAll('.sq-vu-trait')];
            const g = this.estOuvert() && !this.modeTel() && this._i != null && this._montres.length
                ? document.querySelector(`#progression-sections .chord-grid[data-section="${this._s}"]`) : null;
            const ref = g ? g.querySelector(`.grid-cell[data-index="${this._i}"]`) : null;
            if (!ref) { anciens.forEach(x => x.remove()); return; }
            const haut = ref.getBoundingClientRect().top, gr = g.getBoundingClientRect();
            let x0 = Infinity, x1 = -Infinity, bas = 0;
            g.querySelectorAll('.grid-cell[data-index]').forEach(el => {
                if (!this._montres.includes(+el.dataset.index)) return;
                const r = el.getBoundingClientRect();
                if (Math.abs(r.top - haut) > 3) return;   // un accord coupé sur deux lignes n'a ici que la case de SA ligne
                x0 = Math.min(x0, r.left); x1 = Math.max(x1, r.right); bas = Math.max(bas, r.bottom);
            });
            if (x1 < x0) { anciens.forEach(x => x.remove()); return; }
            let t = anciens.find(x => x.parentElement === g);
            anciens.forEach(x => { if (x !== t) x.remove(); });
            if (!t) { t = document.createElement('div'); t.className = 'sq-vu-trait'; t.setAttribute('aria-hidden', 'true'); g.appendChild(t); }
            t.style.left = Math.round(x0 - gr.left + 4) + 'px';
            t.style.width = Math.max(10, Math.round(x1 - x0 - 8)) + 'px';
            t.style.top = Math.round(bas - gr.top - 2) + 'px';
        }

        // Barre d'outils : motif de l'accord choisi enfoncé, vignettes dessinées comme le séquenceur (croches voisines soudées en barre), portée,
        // Intensité, Coller grisé tant que rien n'est copié.
        majBarreOutils(accords, i) {
            const d = i != null ? accords[i] : null;
            const actuel = d ? motifActuel(d) : null;
            // Les formes de l'utilisateur, après les motifs fournis : vignette et nom. AUCUNE croix (14/11, « un peu dangereux ») : on les modifie, on les supprime (avec
            // confirmation) et on masque les rythmes fournis par un clic droit (menu du rythme).
            const zone = document.getElementById('sq-formes');
            if (zone) {
                const formes = formesUtilisateur();
                const sig = formes.map(f => f.id + '@' + f.at).join('|');
                if (zone.dataset.sig !== sig) {
                    zone.dataset.sig = sig;
                    zone.innerHTML = formes.map(f => `<button type="button" class="sq-motif" data-sq-motif="${escapeHtml(f.id)}" aria-pressed="false" title="${escapeHtml(f.nom)} — clic droit : modifier, supprimer"><span class="sq-vignette" aria-hidden="true"></span><span>${escapeHtml(f.nom)}</span></button>`).join('');
                }
            }
            this.racine.querySelectorAll('[data-sq-motif]').forEach(b => {
                const id = b.dataset.sqMotif, m = motifParId(id);
                if (!m) return;
                b.setAttribute('aria-pressed', String(id === actuel));
                b.classList.toggle('retouche', !!m.retouche);
                const nom = b.querySelector(':scope > span:not(.sq-vignette)');
                if (nom && id !== 'main' && nom.textContent !== m.nom) nom.textContent = m.nom;   // « + » porte son propre balisage (« À la main » au téléphone, « + » à l'ordinateur)
                if (id !== 'main') b.title = `${m.nom} — clic droit : modifier ce schéma${m.retouche ? ' (retouché)' : ''}`;
                const vg = b.querySelector('.sq-vignette');
                if (vg) {
                    // Redessinée à chaque fois : une retouche (ici ou ailleurs) change le dessin d'un motif fourni.
                    const html = vignetteHtml(m);
                    if (vg.innerHTML !== html) vg.innerHTML = html;
                }
            });
            // Les rythmes fournis masqués par l'utilisateur (clic droit) disparaissent de la barre ; « ↺ Rétablir (n) » les ramène.
            const masq = this.masques();
            this.racine.querySelectorAll('.sq-motifs > .sq-motif[data-sq-motif]').forEach(b => { b.hidden = b.dataset.sqMotif !== 'main' && masq.has(b.dataset.sqMotif); });
            const retab = document.getElementById('sq-rythmes-retablir'), nm = document.getElementById('sq-n-masques');
            const nMasques = [...masq].filter(x => MOTIF_PAR_ID[x] && x !== 'main').length;
            if (retab) retab.hidden = nMasques === 0 || this.modeTel();
            if (nm && nm.textContent !== String(nMasques)) nm.textContent = String(nMasques);
            const vv = document.getElementById('sq-vue-voix'), vn = document.getElementById('sq-vue-notes');
            if (vv) vv.setAttribute('aria-pressed', String(this.vue === 'voix'));
            if (vn) vn.setAttribute('aria-pressed', String(this.vue === 'notes'));
            const pp = document.getElementById('sq-portee-partie'), pa = document.getElementById('sq-portee-accord');
            if (pp) pp.setAttribute('aria-pressed', String(this.portee === 'partie'));
            if (pa) pa.setAttribute('aria-pressed', String(this.portee === 'accord'));
            this.majDessin();
            const bi = document.getElementById('sq-intensite');
            if (bi) {
                bi.setAttribute('aria-pressed', String(this.intensite));
                bi.title = this.intensite
                    ? 'Intensité allumée : un clic sur une note change sa force (normal, fort, doux, enlevée). Cliquer pour l’éteindre'
                    : 'Intensité éteinte : un clic pose ou enlève une note, toutes au même niveau. Cliquer pour régler l’intensité';
            }
            const col = document.getElementById('sq-coller');
            if (col) {
                col.disabled = !this.presse || !d;
                const t = this.presse && d ? `Coller le rythme de ${this.presse.de} sur ${flatTight(chordDe(d).getLabel(this.app.useFlatsForRoot(d.root)))}` : 'Coller un rythme copié (rien de copié)';
                col.title = t; col.setAttribute('aria-label', t);
            }
            ['sq-copier', 'sq-effacer'].forEach(id => { const b = document.getElementById(id); if (b) b.disabled = !d; });
        }

        // Rien n'est jamais caché (cahier 3 bis, poignée, règle 3) : le séquenceur ne dépasse pas la place entre la barre du haut et le tiroir des
        // diagrammes (moins un peu de grille) ; au-delà il défile en interne, barre d'outils et règle collées en haut.
        placeLibre() {
            const haut = document.querySelector('.top-bar');
            const yHaut = haut ? haut.getBoundingClientRect().bottom : 0;
            const tiroir = document.getElementById('vues-tiroir');
            const lecture = document.getElementById('barre-lecture');
            const hT = tiroir && !tiroir.hidden && !tiroir.classList.contains('vues-libre') ? tiroir.getBoundingClientRect().height : 0;
            const hL = lecture ? lecture.getBoundingClientRect().height : 0;
            return Math.max(120, window.innerHeight - yHaut - hT - hL - GRILLE_MIN);
        }
        limiterHauteur() {
            if (!this.estOuvert()) return;
            this.appliquerVisibles();
            if (this.modeTel()) { this.racine.style.maxHeight = ''; return; } // au téléphone, c'est le panneau d'accord qui défile
            this.racine.style.maxHeight = Math.floor(this.placeLibre()) + 'px';
        }

        // Les colonnes de la grille : étiquettes (46 px), un petit jour (10 px), puis les croches de chaque accord — de CROCHE_MIN px à `this.croche` px, calées à gauche : une grille
        // plus étroite que la fenêtre laisse du vide à droite au lieu d'étirer les croches (14/11, « la grille calée à gauche ») — et, à l'ordinateur, la piste de la poignée de
        // largeur. Séparée de rafraichir() pour que la poignée puisse changer la largeur SANS redessiner la grille : redessiner détruirait la poignée qu'on tient.
        poserColonnes() {
            const plan = this._plan;
            if (!plan || !this.grille) return;
            const tel = this.modeTel();
            const cols = ['46px', '10px'];
            plan.croches.forEach(n => {
                // au doigt : une croche garde 30 px au moins (le plancher de probe_seq_adaptatif), la grille défile de côté
                cols.push(`repeat(${n}, minmax(${tel ? 30 : CROCHE_MIN}px, ${tel ? '1fr' : this.croche + 'px'}))`);
            });
            if (plan.poignee) cols.push(LARGEUR_POIGNEE + 'px');
            this.grille.style.gridTemplateColumns = cols.join(' ');
        }

        // Hauteur : les barres gardent leur hauteur (Paramètres › Affichage), la poignée du haut règle le NOMBRE de lignes visibles ; au-delà la grille défile en interne.
        // `_visibles` à 0 (ou au moins le nombre de lignes) = tout est visible, sans plafond.
        appliquerVisibles() {
            const g = this.grille, nb = (this._lignes || []).length;
            if (!g) return;
            const c = g.querySelector('.sq-case[data-r]');
            if (this.modeTel() || !this._visibles || this._visibles >= nb || !c) { g.style.maxHeight = ''; g.style.overflowY = ''; return; }
            const haut = c.offsetTop - g.offsetTop;   // ce qui précède la première ligne de notes : noms d'accords et règle
            g.style.maxHeight = Math.round(haut + this._visibles * (this.ligne + 3)) + 'px';   // 3 px = l'écart entre deux lignes (row-gap)
            g.style.overflowY = 'auto';
        }

        // Réglage Paramètres › Affichage « Barres du séquenceur ».
        reglerHauteur(px) {
            this.ligne = borner(Math.round(px), LIGNE_MIN, LIGNE_MAX);
            ecrireLocal(CLE_LIGNE, String(this.ligne));
            this.poserLigne();
            this.limiterHauteur();
        }

        // ---- Écriture dans le morceau ---------------------------------------------------------------------------------------------
        // Un geste = une annulation (pushUndo AVANT d'écrire, une seule fois). `modifs` reçoit les données de chaque accord touché (index → état).
        // `surPartie(sec)` : ce que le geste change à la partie elle-même (ses notes libres), dans la même annulation.
        ecrire(modifs, geste, surPartie) {
            const sections = loadProgressionSections();
            const sec = sections[this._s];
            if (!sec) return;
            if (!geste || !geste.annulationPosee) {
                this.app.pushUndo(sections);
                if (geste) geste.annulationPosee = true;
            }
            if (surPartie) surPartie(sec);
            modifs.forEach((m, c) => {
                const d = sec.chords[c];
                if (!d) return;
                if (m.extraNotes) {
                    // Une note libre sans plus une croche dans cet accord le quitte (pas de voix fantôme) ; la LIGNE reste, retenue par la partie,
                    // jusqu'à son × (cahier : « petit × sur la ligne pour la retirer »).
                    let muette;
                    while ((muette = m.etat.info.libres.find(v => ![...m.etat.on].some(c2 => c2.startsWith(v + ':')))) != null) {
                        const x = m.etat.info.voix[muette];
                        const liste = sec.notesLibres || (sec.notesLibres = []);
                        if (!liste.some(n => midiDe(n.note, n.octave) === x.midi)) liste.push(noteDe(x.midi));
                        retirerLibre(m, d, muette);
                    }
                    d.extraNotes = m.extraNotes.map(x => ({ note: x.note, octave: x.octave }));
                }
                ecrireAccord(d, m.etat);
                // « À la main » n'est pas écrit : c'est ce que suit tout accord retouché sans motif (voir motifActuel).
                if (m.motif !== undefined) { if (m.motif && m.motif !== 'main') d.motifSeq = m.motif; else delete d.motifSeq; }
            });
            saveProgressionSections(sections);
            const s = this._s, app = this.app;
            // L'accord ouvert en modification relit ses réglages (son motif vivant est dans #arpPattern) : sans cela, refermer la fenêtre réécrirait
            // l'ancien rythme par-dessus.
            if (app.editingIndex != null && app.activeSection === s && modifs.has(app.editingIndex)) app.editionParSuivi(s, app.editingIndex);
            else app.loadProgression();
            if (app.isPlaying && app._playMode === 'progression') modifs.forEach((m, c) => app.liveUpdateProgressionChord(s, c));
        }

        // Choisir un accord SANS le faire entendre en entier (on vient de toucher une de ses notes, c'est elle qu'on entend).
        choisirSansJouer(c) {
            if (this.app.selectedIndex === c && this.app.activeSection === this._s) return;
            this.app.activeSection = this._s;
            this.app.selectedIndex = c;
            if (this.app.multiSelect) this.app.multiSelect = new Set();
            this.app.loadProgression();
        }

        async jouerNote(c, midi, niveau) {
            if (midi == null || !window.Tone) return;
            try {
                await Tone.start();
                const inst = this.app.getInstrument(this.app.songInstrument);
                const pct = niveau === 'normal' ? (this.accord(c).intensity || 75) : NIVEAU_VALEUR[niveau];
                const vel = Math.max(0.05, Math.min(1, (pct / 75) * 0.8 * 0.85));
                inst.triggerAttackRelease(Tone.Frequency(midi, 'midi').toNote(), 0.35, undefined, vel);
            } catch (err) {
                console.warn('Note du séquenceur non jouée (instrument pas encore prêt) :', err.message);
            }
        }
        accord(c) { const { accords } = this.cible(); return accords[c] || {}; }

        // ---- Gestes -------------------------------------------------------------------------------------------------------------
        brancher() {
            this.racine.addEventListener('click', (e) => this.surClic(e));
            this.grille.addEventListener('pointerdown', (e) => this.surAppui(e));
            window.addEventListener('pointermove', (e) => this.surMouvement(e));
            window.addEventListener('pointerup', (e) => this.surRelache(e));
            window.addEventListener('pointercancel', () => this.annulerGeste());
            this.grille.addEventListener('keydown', (e) => {
                if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('sq-boucle')) { e.preventDefault(); this.retirerBoucle(); }
            });
            // CLIC DROIT SUR UNE NOTE (12/11 : « si je veux scinder : clic droit / scinder la note ») : son menu. Ailleurs dans la grille, le menu du navigateur n'a
            // rien à faire non plus. Au doigt, l'appui long ouvre le même menu (surAppui) ; sur Android l'évènement natif arrive aussi : même chemin.
            this.grille.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const el = e.target.closest('.sq-case.on');
                if (el) this.ouvrirMenuNote(el, e.clientX, e.clientY);
            });
            const menu = document.getElementById('sq-menu-note');
            if (menu) menu.addEventListener('click', (e) => {
                const b = e.target.closest('button[data-sq-acte]');
                if (b && !b.disabled) this.agirNote(b.dataset.sqActe);
            });
            // CLIC DROIT SUR UN RYTHME (L3) : son menu — Modifier ce schéma, Supprimer cette forme (confirmation) ou Masquer ce rythme ; sur « + » : Créer / Enregistrer une forme.
            // Au téléphone (appui long, L7 plus tard) rien ne change : le schéma s'ouvre directement, « À la main » n'a pas de menu.
            this.racine.addEventListener('contextmenu', (e) => {
                const b = e.target.closest('[data-sq-motif]');
                if (!b) return;
                if (this.modeTel()) { if (b.dataset.sqMotif === 'main') return; e.preventDefault(); e.stopPropagation(); this.ouvrirSchema(b.dataset.sqMotif); return; }
                e.preventDefault();
                e.stopPropagation();
                this.ouvrirMenuRythme(b, e.clientX, e.clientY);
            });
            const menuRythme = document.getElementById('sq-menu-rythme');
            if (menuRythme) menuRythme.addEventListener('click', (e) => { const a = (e.composedPath ? e.composedPath() : [e.target]).find(x => x.matches && x.matches('button[data-a]')); if (a) this.agirMenuRythme(a); });
            // La popover du signet : clics (le formulaire redessine : composedPath), peinture de la grille de « Créer une forme », Entrée / Échap dans le champ de nom.
            const biblio = document.getElementById('sq-biblio');
            if (biblio) {
                biblio.addEventListener('click', (e) => this.surBiblio(e));
                biblio.addEventListener('pointerdown', (e) => {
                    const t = (e.composedPath ? e.composedPath() : [e.target]).find(x => x.matches && x.matches('.bi-case'));
                    if (!t || e.button !== 0 || !this.biblio || !this.biblio.creation) return;
                    e.preventDefault();
                    const pos = +t.dataset.biP, k = +t.dataset.biK, E = this.biblio.creation.etat;
                    this._peinture = { mode: E.on.has(cle(pos, k)) ? 'off' : 'on', fait: new Set(), derniere: null };
                    this.peindreCreation(pos, k);
                });
                biblio.addEventListener('pointerover', (e) => {
                    const t = e.target.closest && e.target.closest('.bi-case');
                    if (t && this._peinture && e.buttons & 1) this.peindreCreation(+t.dataset.biP, +t.dataset.biK);
                });
                window.addEventListener('pointerup', () => { this._peinture = null; });
                biblio.addEventListener('keydown', (e) => {
                    if (e.target.id !== 'sq-biblio-nom') return;
                    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); this.surBiblio({ composedPath: () => [biblio.querySelector('.bi-ok')], target: biblio.querySelector('.bi-ok') }); }
                    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.fermerBiblio(); const b = document.getElementById('sq-forme-enregistrer'); if (b) b.focus(); }
                });
            }
            // Les champs de nom : Entrée valide, Échap annule (et rien d'autre de l'appli ne réagit à ces touches pendant qu'on tape).
            const touches = (id, valider, annuler) => {
                const champ = document.getElementById(id);
                if (!champ) return;
                champ.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); valider(); }
                    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); annuler(); }
                });
            };
            touches('sq-schema-nom', () => this.enregistrerSchema(), () => this.fermerSchema());
            // Échap dans une bande ouverte (hors champ) la referme.
            this.racine.addEventListener('keydown', (e) => {
                if (e.key !== 'Escape') return;
                if (this.schema) { e.stopPropagation(); this.fermerSchema(); }
                else if (this.libre.ouvert) { e.stopPropagation(); this.ouvrirBandeLibre(false); }
            });
            // Suppr / Retour arrière supprime les notes choisies (L2). En capture : sinon l'appli supprimerait l'ACCORD choisi dans la grille.
            document.addEventListener('keydown', (e) => {
                if (!this.sel.length || !this.estOuvert() || this.modeTel() || (e.key !== 'Delete' && e.key !== 'Backspace')) return;
                const a = document.activeElement;
                if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
                e.stopPropagation(); e.preventDefault();
                this.supprimerSelection();
            }, true);
            if (this.bouton) this.bouton.addEventListener('click', () => this.basculer());
            const fermer = document.getElementById('sq-fermer');
            if (fermer) fermer.addEventListener('click', () => this.basculer(false));
            this.brancherPoignee();
            this.brancherPoigneeLargeur();
            this.brancherReglages();
            window.addEventListener('resize', () => { this.synchroniser(); this.majNomsRythmes(); });
            // Le tiroir des diagrammes change de taille (poignée, clavier ou guitare allumés) : la place libre du séquenceur change avec lui.
            const tiroir = document.getElementById('vues-tiroir');
            if (tiroir && window.ResizeObserver) new ResizeObserver(() => this.limiterHauteur()).observe(tiroir);
            // La grille change de taille (largeur de la fenêtre, hauteur des cases, fenêtre du navigateur) : le trait sous la ligne montrée la suit.
            const hote = document.getElementById('progression-sections');
            if (hote && window.ResizeObserver) new ResizeObserver(() => this.majTrait()).observe(hote);
            // Premier dessin APRÈS la construction de l'appli (une micro-tâche plus tard) : pendant celle-ci, l'état qu'il lit n'est pas encore entier.
            Promise.resolve().then(() => this.synchroniser());
        }

        surClic(e) {
            const b = e.target.closest('button');
            if (!b || !this.racine.contains(b) || b.disabled) return;
            // JAMAIS INERTE (L1c, 14/11) : un bouton qui agit sur UN accord, sans accord choisi, choisit d'abord celui que le séquenceur montre — pour qu'on voie dans la grille ce
            // qui va être modifié. (« Toute la partie » agit sur tous les accords : rien à choisir.)
            if (!this.modeTel() && this._i != null && this.app.selectedIndex == null
                && (b.id === 'sq-copier' || b.id === 'sq-coller' || b.id === 'sq-effacer' || (b.dataset.sqMotif && this.porteeEffective() === 'accord'))) this.choisirSansJouer(this._i);
            if (b.id === 'sq-ligne-prec') { this.allerLigne(-1); return; }
            if (b.id === 'sq-ligne-suiv') { this.allerLigne(1); return; }
            if (b.dataset.sqMotif) { this.appliquerMotif(b.dataset.sqMotif); return; }
            if (b.dataset.sqSuppr) { this.supprimerForme(b.dataset.sqSuppr); return; }
            if (b.dataset.sqNote) { this.libre.note = b.dataset.sqNote; this.majBandeLibre(); this.jouerMidi(this.midiLibre()); return; }
            if (b.dataset.sqSchema) { this.basculerSchema(+b.dataset.sqSchema, +b.dataset.k); return; }
            if (b.classList.contains('sq-libre-btn')) { this.ouvrirBandeLibre(!this.libre.ouvert); return; }
            if (b.classList.contains('sq-libre-retirer')) { this.retirerLigneLibre(+b.dataset.midi); return; }
            switch (b.id) {
                case 'sq-portee-partie': this.portee = 'partie'; ecrireLocal(CLE_PORTEE, 'partie'); this.rafraichir(); break;
                case 'sq-portee-accord': this.portee = 'accord'; ecrireLocal(CLE_PORTEE, 'accord'); this.rafraichir(); break;
                case 'sq-vue-voix': this.vue = 'voix'; ecrireLocal(CLE_VUE, 'voix'); this.rafraichir(); break;
                case 'sq-vue-notes': this.vue = 'notes'; ecrireLocal(CLE_VUE, 'notes'); this.rafraichir(); break;
                case 'sq-intensite': this.intensite = !this.intensite; this.rafraichir(); break;
                case 'sq-dessin': this.basculerDessin(); break;
                case 'sq-copier': this.copier(); break;
                case 'sq-coller': this.coller(); break;
                case 'sq-effacer': this.effacer(); break;
                case 'sq-forme-enregistrer': this.basculerBiblio(); break;
                case 'sq-rythmes-retablir': this.retablirRythmes(); break;
                case 'sq-libre-moins': this.libre.octave = Math.max(1, this.libre.octave - 1); this.majBandeLibre(); this.jouerMidi(this.midiLibre()); break;
                case 'sq-libre-plus': this.libre.octave = Math.min(6, this.libre.octave + 1); this.majBandeLibre(); this.jouerMidi(this.midiLibre()); break;
                case 'sq-libre-ajouter': this.ajouterLigneLibre(); break;
                case 'sq-libre-annuler': this.ouvrirBandeLibre(false); break;
                case 'sq-schema-ecouter': this.ecouterSchema(); break;
                case 'sq-schema-enregistrer': this.enregistrerSchema(); break;
                case 'sq-schema-annuler': this.fermerSchema(); break;
                case 'sq-schema-retablir': this.retablirMotif(); break;
                case 'sq-schema-supprimer': { const id = this.schema && this.schema.id; this.fermerSchema(); if (id) this.supprimerForme(id); break; }
            }
        }

        // ---- Formes enregistrées, menu des rythmes, popover du signet (L3, 14/11) --------------------------------------------------------------
        // Les rythmes fournis masqués par l'utilisateur, par appareil.
        // Les noms des rythmes dans la barre : réglage de l'appareil (Paramètres › Affichage), sinon oui au-dessus de 1340 px (la barre tient alors sur une ligne).
        nomsRythmes() { const v = lireLocal(CLE_NOMS_RYTHMES); return v === '1' ? true : v === '0' ? false : window.innerWidth >= 1340; }
        reglerNomsRythmes(on) { ecrireLocal(CLE_NOMS_RYTHMES, on ? '1' : '0'); this.majNomsRythmes(); }
        majNomsRythmes() { if (this.racine) this.racine.classList.toggle('sans-noms-rythmes', !this.nomsRythmes()); }
        masques() { try { return new Set(JSON.parse(lireLocal(CLE_MASQUES) || '[]')); } catch (e) { return new Set(); } }
        poserMasques(set) { ecrireLocal(CLE_MASQUES, JSON.stringify([...set])); this.rafraichir(); }
        masquerRythme(id) { if (!MOTIF_PAR_ID[id] || id === 'main') return; const m = this.masques(); m.add(id); this.poserMasques(m); this.app.flashHint && this.app.flashHint('Rythme masqué : le signet les retrouve tous'); }
        retablirRythmes() { this.poserMasques(new Set()); }

        // Le MENU d'un rythme (clic droit) : Modifier ce schéma… / Supprimer cette forme (confirmation dans le menu) ou Masquer ce rythme ; sur « + » : Créer / Enregistrer une forme.
        ouvrirMenuRythme(b, x, y) {
            const menu = document.getElementById('sq-menu-rythme');
            if (!menu) return;
            const id = b.dataset.sqMotif, m = motifParId(id);
            if (id !== 'main' && !m) return;
            this._menuRythme = id;
            const nom = id === 'main' ? '+' : m.nom;
            const titre = id === 'main' ? 'Formes' : `Rythme « ${escapeHtml(nom)} »`;
            const items = id === 'main'
                ? '<button type="button" role="menuitem" data-a="creer">Créer une forme…</button><button type="button" role="menuitem" data-a="enregistrer">Enregistrer la forme…</button>'
                : '<button type="button" role="menuitem" data-a="modifier">Modifier ce schéma…</button>'
                    + (m.forme ? '<button type="button" role="menuitem" class="danger" data-a="supprimer">Supprimer cette forme</button>' : '<button type="button" role="menuitem" class="danger" data-a="masquer">Masquer ce rythme</button>');
            menu.innerHTML = `<div class="titre">${titre}</div>${items}`;
            menu.hidden = false;
            const larg = menu.offsetWidth, haut = menu.offsetHeight;
            menu.style.left = Math.max(8, Math.min(x, window.innerWidth - larg - 8)) + 'px';
            menu.style.top = Math.max(8, Math.min(y, window.innerHeight - haut - 8)) + 'px';
        }
        fermerMenuRythme() { const menu = document.getElementById('sq-menu-rythme'); if (menu) menu.hidden = true; this._menuRythme = null; }
        agirMenuRythme(a) {
            const id = this._menuRythme, act = a.dataset.a;
            if (!id) return;
            if (act === 'supprimer' && !a.classList.contains('confirme')) {   // la suppression d'une forme est DÉFINITIVE : un deuxième clic la confirme
                a.classList.add('confirme'); a.textContent = 'Confirmer la suppression'; return;
            }
            this.fermerMenuRythme();
            if (act === 'modifier') this.ouvrirSchema(id);
            else if (act === 'supprimer') this.supprimerForme(id);
            else if (act === 'masquer') this.masquerRythme(id);
            else if (act === 'creer') this.ouvrirBiblio('creer');
            else if (act === 'enregistrer') this.ouvrirBiblio('enregistrer');
        }

        // LA POPOVER DU SIGNET : tous les rythmes (vignette + nom ; les masqués portent « masqué · afficher » ; « Mes formes » au-dessus des formes), puis « ＋ Enregistrer la forme… »
        // et « ＋ Créer une forme… » qui y ouvrent leur petit formulaire. Aucune phrase d'aide : l'information est dans les infobulles.
        basculerBiblio() { const o = document.getElementById('sq-biblio'); if (o && !o.hidden) this.fermerBiblio(); else this.ouvrirBiblio('liste'); }
        ouvrirBiblio(vue = 'liste') {
            const pop = document.getElementById('sq-biblio'), ancre = document.getElementById('sq-forme-enregistrer');
            if (!pop || !ancre) return;
            // Enregistrer une forme agit sur l'accord choisi : sans accord choisi, celui que le séquenceur vise (jamais inerte) ; la partie vide n'en a pas.
            if (vue === 'enregistrer') {
                if (this._i == null) { this.app.flashHint && this.app.flashHint('Ajoute d\'abord un accord pour en enregistrer la forme'); return; }
                if (this.app.selectedIndex == null) this.choisirSansJouer(this._i);
            }
            this.biblio = { vue };
            if (vue === 'creer') this.biblio.creation = { lignes: 4, etat: { info: { croches: 8 }, on: new Set(), soude: new Set(), niveaux: new Map() } };
            this.dessinerBiblio();
            pop.hidden = false;
            const r = ancre.getBoundingClientRect(), larg = pop.offsetWidth;
            pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - larg - 8)) + 'px';
            // Le séquenceur est en bas de l'écran : la popover s'ouvre AU-DESSUS du signet (sans le recouvrir) quand elle ne tient pas dessous.
            const h = pop.offsetHeight;
            pop.style.top = (r.bottom + 6 + h <= window.innerHeight - 8 ? r.bottom + 6 : Math.max(8, r.top - h - 8)) + 'px';
            const champ = pop.querySelector('input'); if (champ) { champ.focus(); champ.select(); }
        }
        fermerBiblio() { const pop = document.getElementById('sq-biblio'); if (pop) pop.hidden = true; this.biblio = null; this._peinture = null; }
        nomDeForme() {
            const pris = new Set(formesUtilisateur().map(f => f.nom));
            let n = 1;
            while (pris.has('Forme ' + n)) n++;
            return 'Forme ' + n;
        }
        dessinerBiblio() {
            const pop = document.getElementById('sq-biblio'), B = this.biblio;
            if (!pop || !B) return;
            const masq = this.masques(), actuel = this._i != null ? motifActuel(this.accord(this._i)) : null;
            const ligne = (id) => {
                const m = motifParId(id);
                if (!m) return '';
                const cache = masq.has(id), etat = cache ? 'masqué · afficher' : (id === actuel ? 'actif' : '');
                return `<button type="button" class="bi-item" data-bi-id="${escapeHtml(id)}" aria-pressed="${id === actuel}"><span class="sq-vignette" aria-hidden="true">${vignetteHtml(m)}</span><span class="bi-nom">${escapeHtml(m.nom)}</span><span class="bi-etat">${etat}</span></button>`;
            };
            if (B.vue === 'liste') {
                const formes = formesUtilisateur();
                const tip = this._i == null ? ' title="Ajoute d\'abord un accord"' : '';
                pop.innerHTML = MOTIFS.filter(m => m.id !== 'main').map(m => ligne(m.id)).join('')
                    + (formes.length ? '<div class="bi-sec">Mes formes</div>' + formes.map(f => ligne(f.id)).join('') : '')
                    + `<div class="bi-actions"><button type="button" class="bi-item" data-bi-a="enregistrer"${tip}${this._i == null ? ' disabled' : ''}>＋ Enregistrer la forme…</button><button type="button" class="bi-item" data-bi-a="creer">＋ Créer une forme…</button></div>`;
            } else if (B.vue === 'enregistrer') {
                const d = this.accord(this._i), nom = flatTight(chordDe(d).getLabel(this.app.useFlatsForRoot(d.root)));
                pop.innerHTML = `<div class="bi-titre">Enregistrer la forme · ${escapeHtml(nom)}</div><input id="sq-biblio-nom" class="bi-champ" type="text" autocomplete="off" maxlength="40" aria-label="Nom de la forme" value="${escapeHtml(this.nomDeForme())}">`
                    + '<div class="bi-pied"><button type="button" class="btn-sec" data-bi-a="liste">Annuler</button><button type="button" class="btn-sec bi-ok" data-bi-a="valider-enregistrer">Enregistrer</button></div>';
            } else {
                const C = B.creation, p = [];
                const noms = C.lignes === 3 ? ['Aiguë', 'Milieu', 'Grave'] : ['Aiguë', '3e note', '2e note', 'Grave'];
                for (let r = 0; r < C.lignes; r++) {
                    const pos = C.lignes - 1 - r;
                    for (let k = 0; k < 8; k++) {
                        const c = cle(pos, k), lit = C.etat.on.has(c), sg = lit && C.etat.soude.has(c), sd = lit && C.etat.soude.has(cle(pos, k + 1)) && C.etat.on.has(cle(pos, k + 1));
                        p.push(`<button type="button" class="bi-case${lit ? ' on' : ''}${sg ? ' g' : ''}${sd ? ' d' : ''}${k % 2 === 0 ? ' temps' : ''}" data-bi-p="${pos}" data-bi-k="${k}" aria-pressed="${lit}" aria-label="${noms[r]}, croche ${k + 1}"></button>`);
                    }
                }
                pop.innerHTML = `<div class="bi-titre">Créer une forme</div>`
                    + `<div class="bi-seg" role="group" aria-label="Nombre de lignes"><button type="button" data-bi-lignes="3" aria-pressed="${C.lignes === 3}" title="Triade : trois lignes">Triade · 3</button><button type="button" data-bi-lignes="4" aria-pressed="${C.lignes === 4}" title="Tétrade : quatre lignes">Tétrade · 4</button></div>`
                    + `<div class="bi-grille" data-lignes="${C.lignes}">${p.join('')}</div>`
                    + `<input id="sq-biblio-nom" class="bi-champ" type="text" autocomplete="off" maxlength="40" aria-label="Nom de la forme" value="${escapeHtml(B.nomCree || this.nomDeForme())}">`
                    + '<div class="bi-pied"><button type="button" class="btn-sec" data-bi-a="effacer">Effacer</button><button type="button" class="btn-sec" data-bi-a="liste">Annuler</button><button type="button" class="btn-sec bi-ok" data-bi-a="valider-creer">Enregistrer</button></div>';
            }
        }
        surBiblio(e) {
            const t = (e.composedPath ? e.composedPath() : [e.target]).find(x => x.matches && x.matches('button'));   // un clic qui redessine détache sa cible : composedPath
            const B = this.biblio;
            if (!t || !B || t.disabled) return;
            if (t.dataset.biId) {
                const id = t.dataset.biId, m = this.masques();
                if (m.has(id)) { m.delete(id); ecrireLocal(CLE_MASQUES, JSON.stringify([...m])); }   // « masqué · afficher » : elle revient dans la barre, et s'applique
                this.fermerBiblio();
                if (this._i != null && this.app.selectedIndex == null) this.choisirSansJouer(this._i);
                this.appliquerMotif(id);
                this.rafraichir();
                return;
            }
            if (t.dataset.biLignes) { B.creation.lignes = +t.dataset.biLignes; B.nomCree = (document.getElementById('sq-biblio-nom') || {}).value; this.dessinerBiblio(); return; }
            const a = t.dataset.biA;
            if (a === 'liste') { this.ouvrirBiblio('liste'); return; }
            if (a === 'enregistrer') { this.ouvrirBiblio('enregistrer'); return; }
            if (a === 'creer') { this.ouvrirBiblio('creer'); return; }
            if (a === 'effacer') { B.creation.etat = { info: { croches: 8 }, on: new Set(), soude: new Set(), niveaux: new Map() }; B.nomCree = (document.getElementById('sq-biblio-nom') || {}).value; this.dessinerBiblio(); return; }
            if (a === 'valider-enregistrer') this.enregistrerForme((document.getElementById('sq-biblio-nom') || {}).value);
            if (a === 'valider-creer') this.creerForme((document.getElementById('sq-biblio-nom') || {}).value);
        }
        // Peindre dans la grille de « Créer une forme » : un clic pose ou enlève une croche, un glissé peint UNE note tenue (croches voisines soudées).
        peindreCreation(pos, k) {
            const C = this.biblio && this.biblio.creation, E = C && C.etat, g = this._peinture;
            if (!E || !g) return;
            if (g.fait.has(pos + ':' + k)) return;
            g.fait.add(pos + ':' + k);
            const c = cle(pos, k);
            if (g.mode === 'on') { if (!E.on.has(c)) poserCroche(E, pos, k, true); if (g.derniere && g.derniere.pos === pos && Math.abs(k - g.derniere.k) === 1) souder(E, pos, Math.max(k, g.derniere.k)); g.derniere = { pos, k }; }
            else if (E.on.has(c)) couperCroche(E, pos, k);
            this.majGrilleCreation();
        }
        // Les cases de la grille de « Créer une forme » relues dans l'état, SANS les remplacer : un redessin pendant l'appui détacherait la cible avant que la fermeture « au clic à
        // côté » (this._popups) ne la regarde, et la popover se refermerait sous le doigt.
        majGrilleCreation() {
            const E = this.biblio && this.biblio.creation && this.biblio.creation.etat;
            if (!E) return;
            document.querySelectorAll('#sq-biblio .bi-case').forEach(b => {
                const pos = +b.dataset.biP, k = +b.dataset.biK, c = cle(pos, k), lit = E.on.has(c);
                b.classList.toggle('on', lit);
                b.classList.toggle('g', lit && E.soude.has(c));
                b.classList.toggle('d', lit && E.soude.has(cle(pos, k + 1)) && E.on.has(cle(pos, k + 1)));
                b.setAttribute('aria-pressed', String(lit));
            });
        }
        // La forme créée de zéro, PAR POSITION comme formeDepuisEtat : une triade ([L0, L1, L1, L2]) ou une tétrade ([L0, L1, L2, L3]) ; le format a quatre positions.
        creerForme(nom) {
            const f = magasin(), B = this.biblio, C = B && B.creation;
            nom = (nom || '').trim();
            if (!f || !C || !nom) return;
            const brut = { v: [], s: [], n: [] };
            for (let p = 0; p < C.lignes; p++) {
                const v = [], s = [], n = {};
                for (let k = 0; k < 8; k++) { const c = cle(p, k); if (!C.etat.on.has(c)) continue; v.push(k); if (C.etat.soude.has(c)) s.push(k); else if (C.etat.niveaux.has(c)) n[k] = C.etat.niveaux.get(c); }
                brut.v[p] = v; brut.s[p] = s; brut.n[p] = n;
            }
            const ordre = C.lignes === 3 ? [0, 1, 1, 2] : [0, 1, 2, 3];
            const dessin = { v: ordre.map(p => brut.v[p].slice()), s: ordre.map(p => brut.s[p].slice()), n: ordre.map(p => ({ ...brut.n[p] })) };
            if (!dessin.v.some(l => l.length)) { this.app.flashHint && this.app.flashHint('Pose au moins une croche pour créer une forme'); return; }
            const forme = f.enregistrer({ id: f.nouvelId(), type: 'forme', nom, v: dessin.v, s: dessin.s, n: dessin.n });
            this.fermerBiblio();
            if (forme && this.app.flashHint) this.app.flashHint(`Forme « ${forme.nom} » créée`);
        }
        // Enregistrer le rythme de l'accord choisi comme forme (nom saisi dans la popover).
        enregistrerForme(nomSaisi) {
            const f = magasin();
            const nom = (nomSaisi || '').trim();
            if (!nom || !f || this._i == null) return;
            const dessin = formeDepuisEtat(this._etats[this._i]);
            const forme = f.enregistrer({ id: f.nouvelId(), type: 'forme', nom, v: dessin.v, s: dessin.s, n: dessin.n });
            this.fermerBiblio();
            if (!forme) return;
            // L'accord dont on vient de prendre la forme la suit désormais (ses notes sont déjà les siennes : rien n'est réécrit).
            const e = this._etats[this._i];
            this.ecrire(new Map([[this._i, { etat: e, motif: forme.id }]]));
            this.app.flashHint && this.app.flashHint(`Forme « ${forme.nom} » enregistrée`);
        }
        // ---- La roue des réglages du séquenceur (L3) --------------------------------------------------------------------------------------------
        // Popover aux composants de Paramètres : hauteur des barres (14 à 48 px, « Auto » = adaptée au nombre de lignes), largeur des croches (14 à 60 px, 34 par défaut), ce
        // qu'écrivent les barres (Rien | Notes | Degrés), règle des temps, Rétablir. Par appareil. La hauteur et la largeur sont celles de Paramètres › Affichage et de la poignée.
        basculerReglages() { const p = document.getElementById('sq-reglages-pop'); if (p && !p.hidden) this.fermerReglages(); else this.ouvrirReglages(); }
        ouvrirReglages() {
            const pop = document.getElementById('sq-reglages-pop'), b = document.getElementById('sq-reglages');
            if (!pop || !b) return;
            this.dessinerReglages();
            pop.hidden = false;
            b.setAttribute('aria-expanded', 'true');
            this.placerReglages();
        }
        // Posée au-dessus de la roue, sans jamais recouvrir la barre d'outils : relue à chaque changement (la hauteur des barres déplace toute la barre).
        placerReglages() {
            const pop = document.getElementById('sq-reglages-pop'), b = document.getElementById('sq-reglages');
            if (!pop || !b || pop.hidden) return;
            const r = b.getBoundingClientRect();
            pop.style.left = Math.max(8, Math.min(r.right - pop.offsetWidth, window.innerWidth - pop.offsetWidth - 8)) + 'px';
            pop.style.top = Math.max(8, r.top - pop.offsetHeight - 8) + 'px';
        }
        fermerReglages() { const p = document.getElementById('sq-reglages-pop'), b = document.getElementById('sq-reglages'); if (p) p.hidden = true; if (b) b.setAttribute('aria-expanded', 'false'); }
        dessinerReglages() {
            const pop = document.getElementById('sq-reglages-pop');
            if (!pop) return;
            const h = this.auto ? this.hauteurAuto() : this.ligne;
            const seg = [['rien', 'Rien'], ['notes', 'Notes'], ['degres', 'Degrés']].map(([m, t]) => `<button type="button" role="radio" data-sq-contenu="${m}" aria-checked="${this.contenu === m}">${t}</button>`).join('');
            pop.innerHTML = `<h3 class="settings-group-title">Séquenceur</h3>
                <div class="settings-slider-row"><div class="settings-slider-head"><label for="sq-r-hauteur">Hauteur des barres</label><span class="val" id="sq-r-hauteur-val">${h} px</span></div><input type="range" id="sq-r-hauteur" min="${LIGNE_MIN}" max="${LIGNE_MAX}" step="2" value="${h}"${this.auto ? ' disabled' : ''}></div>
                <div class="settings-toggle-row"><label for="sq-r-auto" title="Adapte la hauteur des barres au nombre de lignes : hautes en vue Accord, basses en vue Piano">Auto</label><button type="button" id="sq-r-auto" class="switch" role="switch" aria-checked="${this.auto}" aria-label="Hauteur des barres automatique"><span class="switch-thumb"></span></button></div>
                <div class="settings-slider-sep"></div>
                <div class="settings-slider-row"><div class="settings-slider-head"><label for="sq-r-croche">Largeur des croches</label><span class="val" id="sq-r-croche-val">${Math.min(this.croche, CROCHE_MAX_ROUE)} px</span></div><input type="range" id="sq-r-croche" min="${CROCHE_MIN}" max="${CROCHE_MAX_ROUE}" step="2" value="${Math.min(this.croche, CROCHE_MAX_ROUE)}"></div>
                <div class="settings-slider-sep"></div>
                <div class="settings-select-row"><label id="sq-r-contenu-lbl" title="Ce qu'on écrit dans les barres : le nom de la note, son degré dans l'accord, ou rien">Barres</label><div class="settings-seg" role="radiogroup" aria-labelledby="sq-r-contenu-lbl">${seg}</div></div>
                <div class="settings-toggle-row"><label for="sq-r-regle" title="La règle des temps, au-dessus des barres (elle sert aussi à tirer une plage à boucler)">Règle</label><button type="button" id="sq-r-regle" class="switch" role="switch" aria-checked="${this.regle}" aria-label="Règle des temps"><span class="switch-thumb"></span></button></div>
                <div class="rb-pied"><button type="button" id="sq-r-retablir" class="btn-sec">Rétablir</button></div>`;
            this.placerReglages();
        }
        brancherReglages() {
            const pop = document.getElementById('sq-reglages-pop'), roue = document.getElementById('sq-reglages');
            if (roue) roue.addEventListener('click', () => this.basculerReglages());
            if (!pop) return;
            pop.addEventListener('input', (e) => {
                if (e.target.id === 'sq-r-hauteur') { this.reglerHauteur(+e.target.value); pop.querySelector('#sq-r-hauteur-val').textContent = this.ligne + ' px'; this.placerReglages(); }
                else if (e.target.id === 'sq-r-croche') { this.croche = borner(+e.target.value, CROCHE_MIN, CROCHE_MAX_ROUE); ecrireLocal(CLE_CROCHE, String(this.croche)); this.poserColonnes(); pop.querySelector('#sq-r-croche-val').textContent = this.croche + ' px'; }
            });
            pop.addEventListener('click', (e) => {
                const t = (e.composedPath ? e.composedPath() : [e.target]).find(x => x.matches && x.matches('button'));
                if (!t) return;
                if (t.id === 'sq-r-auto') { this.auto = !this.auto; ecrireLocal(CLE_AUTO, this.auto ? '1' : '0'); this.poserLigne(); this.limiterHauteur(); this.dessinerReglages(); }
                else if (t.id === 'sq-r-regle') { this.regle = !this.regle; ecrireLocal(CLE_REGLE, this.regle ? '1' : '0'); this.rafraichir(); this.dessinerReglages(); }
                else if (t.dataset.sqContenu) { this.contenu = t.dataset.sqContenu; ecrireLocal(CLE_CONTENU, this.contenu); this.rafraichir(); this.dessinerReglages(); }
                else if (t.id === 'sq-r-retablir') {
                    this.ligne = LIGNE_DEFAUT; this.croche = CROCHE_DEFAUT; this.contenu = 'notes'; this.regle = true; this.auto = false;
                    ecrireLocal(CLE_LIGNE, String(this.ligne)); ecrireLocal(CLE_CROCHE, String(this.croche)); ecrireLocal(CLE_CONTENU, 'notes'); ecrireLocal(CLE_REGLE, '1'); ecrireLocal(CLE_AUTO, '0');
                    this.rafraichir(); this.dessinerReglages();
                }
            });
        }

        // Supprimer une forme : elle disparaît partout (synchro-formes.js) ; les accords qui la suivaient gardent leurs notes et passent « À la main »
        // (motifActuel ne la trouve plus).
        supprimerForme(id) {
            const f = magasin();
            if (!f) return;
            const x = f.lire(id);
            if (!x || x.type !== 'forme') return;
            if (this.schema && this.schema.id === id) this.fermerSchema();
            f.supprimer(id);
            this.app.flashHint && this.app.flashHint(`Forme « ${x.nom} » supprimée`);
        }

        appliquerMotif(id) {
            const m = motifParId(id);
            if (!m || !this._etats || !this._etats.length) return;
            // « + » (14/11) : à l'ordinateur il REPART D'UN RYTHME VIDE pour l'accord choisi (sans confirmation, une annulation) ; il s'allume ensuite tout seul, comme avant, dès qu'on
            // retouche une note. Au téléphone il ne fait rien (rien à appliquer) jusqu'à L7.
            if (id === 'main' && !this.estOrdinateur()) return;
            const cibles = this.porteeEffective() === 'partie' ? this._etats.map((_, c) => c) : (this._i != null ? [this._i] : []);
            const modifs = new Map();
            cibles.forEach(c => modifs.set(c, { etat: etatAvecMotif(this._etats[c], m), motif: id }));
            if (modifs.size) this.ecrire(modifs);
            if (id === 'main' && modifs.size && this.app.flashHint) this.app.flashHint('Rythme vidé (Ctrl+Z pour annuler)');
        }

        // Le rythme de l'accord choisi, PAR POSITION (de la basse à l'aiguë), pour qu'il se colle sur un accord d'un autre nombre de voix.
        copier() {
            if (this._i == null) return;
            const e = this._etats[this._i], d = this.accord(this._i);
            const voix = e.info.positions.map(v => {
                const ks = [];
                for (let k = 0; k < e.info.croches; k++) if (e.on.has(cle(v, k))) ks.push({ k, s: e.soude.has(cle(v, k)), n: e.niveaux.get(cle(v, k)) || null });
                return ks;
            });
            this.presse = { de: flatTight(e.info.chord.getLabel(this.app.useFlatsForRoot(d.root))), voix, croches: e.info.croches };
            this.app.flashHint && this.app.flashHint(`Rythme de ${this.presse.de} copié`);
            this.rafraichir();
        }
        coller() {
            if (!this.presse || this._i == null) return;
            const e = this._etats[this._i], P = this.presse;
            const on = new Set(), soude = new Set(), niveaux = new Map();
            // Notes libres gardées, comme pour un motif.
            e.info.libres.forEach(v => { for (let k = 0; k < e.info.croches; k++) { const c = cle(v, k); if (e.on.has(c)) on.add(c); if (e.soude.has(c)) soude.add(c); if (e.niveaux.has(c)) niveaux.set(c, e.niveaux.get(c)); } });
            const n = e.info.positions.length, m = P.voix.length;
            e.info.positions.forEach((v, p) => {
                // Même nombre de voix : position pour position ; sinon la basse et l'aiguë se correspondent, le milieu prend la voix la plus proche.
                const src = n === m ? p : (p === 0 ? 0 : (p === n - 1 ? m - 1 : Math.min(m - 2, Math.max(1, Math.round(p * (m - 1) / (n - 1))))));
                (P.voix[src] || []).forEach(({ k, s, n: niv }) => {
                    for (let kk = k; kk < e.info.croches; kk += P.croches) {
                        on.add(cle(v, kk));
                        if (s && kk > 0) soude.add(cle(v, kk));
                        if (niv) niveaux.set(cle(v, kk), niv);
                    }
                });
            });
            this.ecrire(new Map([[this._i, { etat: { info: e.info, on, soude, niveaux }, motif: null }]]));
        }
        effacer() {
            if (this._i == null) return;
            const e = this._etats[this._i];
            const etat = { info: e.info, on: new Set(), soude: new Set(), niveaux: new Map() };
            // Les notes libres restent (comme pour un motif) : « Effacer » vide le rythme de l'accord, pas les lignes qu'on a ajoutées.
            e.info.libres.forEach(v => { for (let k = 0; k < e.info.croches; k++) { const c = cle(v, k); if (e.on.has(c)) etat.on.add(c); if (e.soude.has(c)) etat.soude.add(c); } });
            this.ecrire(new Map([[this._i, { etat, motif: 'main' }]]));
        }

        // ---- La bande « Note libre » : nom (C … B, dièses), octave − / +, « Ajouter C4 » --------------------------------------------------------
        midiLibre() { return midiDe(this.libre.note, this.libre.octave); }
        ouvrirBandeLibre(ouvrir) {
            this.libre.ouvert = !!ouvrir;
            if (ouvrir) this.fermerSchema();
            this.majBandeLibre();
            const btn = this.grille.querySelector('.sq-libre-btn');
            if (btn) btn.setAttribute('aria-pressed', String(this.libre.ouvert));
            if (ouvrir) { const a = document.getElementById('sq-libre-ajouter'); if (a) a.focus(); }
            this.limiterHauteur();
        }
        majBandeLibre() {
            const bande = document.getElementById('sq-libre-bande');
            if (!bande) return;
            bande.hidden = !this.libre.ouvert;
            bande.querySelectorAll('[data-sq-note]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sqNote === this.libre.note)));
            const o = document.getElementById('sq-libre-octave');
            if (o) o.textContent = String(this.libre.octave);
            const a = document.getElementById('sq-libre-ajouter');
            if (a) a.textContent = 'Ajouter ' + this.libre.note + this.libre.octave;
        }
        // Crée la LIGNE (cahier : « une ligne en pointillés sur tous les accords, cases toutes normales et cliquables : on pose les croches là où on
        // veut ») : la partie la retient, aucun accord ne change de son. Une annulation.
        ajouterLigneLibre() {
            const midi = this.midiLibre();
            const deja = (this._lignes || []).some(L => L.type !== 'voix' && L.midi === midi);
            this.ouvrirBandeLibre(false);
            if (deja) { this.app.flashHint && this.app.flashHint(`${this.libre.note}${this.libre.octave} est déjà une ligne du séquenceur`); return; }
            this.ecrire(new Map(), null, (sec) => { (sec.notesLibres || (sec.notesLibres = [])).push(noteDe(midi)); });
        }
        // Le × d'une ligne : la note quitte la partie ET chacun de ses accords (avec ses croches). Une annulation.
        retirerLigneLibre(midi) {
            const { accords } = this.cible();
            const modifs = new Map();
            (this._etats || []).forEach((e, c) => {
                const d = accords[c];
                if (!d) return;
                const m = { etat: e, extraNotes: (d.extraNotes || []).map(x => ({ ...x })), motif: undefined };
                let v, touche = false;
                while ((v = voixALaHauteur(m.etat.info, midi, true)) != null) { retirerLibre(m, d, v); touche = true; }
                if (touche) modifs.set(c, m);
            });
            this.ecrire(modifs, null, (sec) => {
                sec.notesLibres = (sec.notesLibres || []).filter(n => midiDe(n.note, n.octave) !== midi);
                if (!sec.notesLibres.length) delete sec.notesLibres;
            });
        }

        // ---- Modifier un schéma (clic droit sur une vignette) -------------------------------------------------------------------------------
        // « Un schéma SANS notes (4 voix × 8 croches) retouché dans une petite bande dépliée sous la barre d'outils, pas sur la vraie grille » : la grille
        // est liée à un accord, le schéma vaut pour tous (règle « par position »). « À la main » n'a pas de clic droit (rien à retoucher).
        ouvrirSchema(id) {
            const m = motifParId(id);
            if (!m || id === 'main') return;
            this.ouvrirBandeLibre(false);
            this.fermerBiblio();
            // L'état de travail : une « voix » par position (0 = basse … 3 = aiguë), les soudures et intensités du motif.
            const info = { croches: 8 };
            const on = new Set(), soude = new Set(), niveaux = new Map();
            for (let p = 0; p < 4; p++) {
                const x = positionDe(m, p, 8);
                x.ks.forEach(k => { on.add(cle(p, k)); if (x.sd.has(k)) soude.add(cle(p, k)); else if (x.nv.has(k)) niveaux.set(cle(p, k), x.nv.get(k)); });
                if (m.s && (m.s[p] || []).includes(0)) soude.add(cle(p, 0)); // tenue d'une mesure à l'autre : gardée telle quelle
            }
            this.schema = { id, fourni: m.fourni, retouche: !!m.retouche, etat: { info, on, soude, niveaux } };
            const champ = document.getElementById('sq-schema-nom');
            if (champ) champ.value = m.nom;
            this.majSchema();
            const bande = document.getElementById('sq-schema');
            if (bande) bande.hidden = false;
            if (champ) champ.focus();
            this.limiterHauteur();
        }
        fermerSchema() {
            const ouvert = !!this.schema;
            this.schema = null;
            const bande = document.getElementById('sq-schema');
            if (bande) bande.hidden = true;
            if (ouvert) this.limiterHauteur();
        }
        majSchema() {
            const S = this.schema, g = document.getElementById('sq-schema-grille');
            if (!S || !g) return;
            const h = [];
            for (let p = 3; p >= 0; p--) for (let k = 0; k < 8; k++) {
                const c = cle(p, k), lit = S.etat.on.has(c);
                const sg = lit && k > 0 && S.etat.soude.has(c), sd = lit && S.etat.soude.has(cle(p, k + 1)) && S.etat.on.has(cle(p, k + 1));
                h.push(`<button type="button" class="sq-schema-case${lit ? ' on' : ''}${sg ? ' g' : ''}${sd ? ' d' : ''}${k % 2 === 0 ? ' temps' : ''}" data-sq-schema="${p}" data-k="${k}" aria-pressed="${lit}" aria-label="Voix ${p + 1}, croche ${k + 1} : ${lit ? 'posée' : 'vide'}" style="grid-row:${4 - p};grid-column:${k + 1}"></button>`);
            }
            g.innerHTML = h.join('');
            const ret = document.getElementById('sq-schema-retablir'), sup = document.getElementById('sq-schema-supprimer');
            if (ret) ret.hidden = !(S.fourni && S.retouche);
            if (sup) sup.hidden = S.fourni;
        }
        basculerSchema(p, k) {
            const S = this.schema;
            if (!S) return;
            const c = cle(p, k);
            if (S.etat.on.has(c)) couperCroche(S.etat, p, k); else poserCroche(S.etat, p, k, true);
            this.majSchema();
        }
        dessinSchema() {
            const S = this.schema, v = [[], [], [], []], s = [[], [], [], []], n = [{}, {}, {}, {}];
            for (let p = 0; p < 4; p++) for (let k = 0; k < 8; k++) {
                const c = cle(p, k);
                if (!S.etat.on.has(c)) continue;
                v[p].push(k);
                if (S.etat.soude.has(c)) s[p].push(k);
                else if (S.etat.niveaux.has(c)) n[p][k] = S.etat.niveaux.get(c);
            }
            return { v, s, n };
        }
        // ▶ : le schéma retouché, joué sur l'accord choisi (sans rien écrire).
        ecouterSchema() {
            if (!this.schema || this._i == null) return;
            const d = this.accord(this._i);
            const essai = JSON.parse(JSON.stringify(d));
            ecrireAccord(essai, etatAvecMotif(lireAccord(essai, this.app), { ...this.dessinSchema(), id: this.schema.id }));
            this.app.playSavedChord(this._s, this._i, true, essai);
        }
        // Enregistrer : la retouche (motif fourni) ou la forme, au compte ; « les accords qui suivent ce schéma le suivent dans sa nouvelle version ».
        enregistrerSchema() {
            const S = this.schema, f = magasin();
            if (!S || !f) return;
            const champ = document.getElementById('sq-schema-nom');
            const base = motifParId(S.id);
            const nom = (champ && champ.value.trim()) || (base ? base.nom : '');
            f.enregistrer({ id: S.id, type: S.fourni ? 'retouche' : 'forme', nom, ...this.dessinSchema() });
            this.fermerSchema();
            this.reappliquer(S.id);
        }
        retablirMotif() {
            const S = this.schema, f = magasin();
            if (!S || !S.fourni || !f) return;
            f.supprimer(S.id);
            this.fermerSchema();
            this.reappliquer(S.id);
        }
        // Les accords du morceau qui suivent ce motif reprennent sa version du moment (toutes les parties, une annulation). Ceux d'AUTRES morceaux la
        // prendront quand on y réappliquera le motif : réécrire toute la bibliothèque d'un clic droit serait une surprise, et il faudrait l'annuler morceau
        // par morceau.
        reappliquer(id) {
            const m = motifParId(id);
            if (!m) return;
            const sections = loadProgressionSections();
            const touches = [];
            sections.forEach((sec, s) => (sec.chords || []).forEach((d, c) => { if (motifActuel(d) === id) touches.push([s, c]); }));
            if (!touches.length) { this.rafraichir(); return; }
            this.app.pushUndo(sections);
            touches.forEach(([s, c]) => {
                const d = sections[s].chords[c];
                ecrireAccord(d, etatAvecMotif(lireAccord(d, this.app), m));
                if (id !== 'main') d.motifSeq = id;
            });
            saveProgressionSections(sections);
            const app = this.app;
            if (app.editingIndex != null && touches.some(([s, c]) => s === app.activeSection && c === app.editingIndex)) app.editionParSuivi(app.activeSection, app.editingIndex);
            else app.loadProgression();
        }

        jouerMidi(midi) {
            if (!window.Tone || isNaN(midi)) return;
            Promise.resolve().then(() => Tone.start()).then(() => {
                const inst = this.app.getInstrument(this.app.songInstrument);
                inst.triggerAttackRelease(Tone.Frequency(midi, 'midi').toNote(), 0.35, undefined, 0.6);
            }).catch(err => console.warn('Note libre non jouée (instrument pas encore prêt) :', err.message));
        }

        retirerBoucle() {
            this.app.loopRange = null;
            this.app.loadProgression();
            if (this.app.renderSequencer) this.app.renderSequencer();
            this.app.liveRestartForGlobalChange();
        }

        // Un appui sur une case : avec Intensité éteinte, il commence une PEINTURE (cahier 3 bis : « cliquer-glisser peint plusieurs croches d'un
        // coup ; on pose ou on enlève selon l'état de la première case touchée ») ; avec Intensité allumée, il fera tourner le niveau au relâché.
        // Sur la règle, il trace la plage à boucler ; sur la bande orange, un clic la retire ; sur un nom d'accord, il le choisit.
        surAppui(e) {
            if (e.button !== 0) return;
            const t = e.target;
            const boucle = t.closest('.sq-boucle');
            if (boucle) { e.preventDefault(); this._geste = { type: 'retirer-boucle', x: e.clientX }; return; }
            const temps = t.closest('.sq-temps');
            if (temps) {
                e.preventDefault();
                const c = +temps.dataset.c;
                this._geste = { type: 'boucle', c0: c, c1: c, bouge: false };
                return;
            }
            const nom = t.closest('.sq-nom');
            if (nom) {
                e.preventDefault();
                this.app.selectChord(this._s, +nom.dataset.c);
                // Au téléphone le séquenceur couvre la grille : c'est ici qu'on change d'accord, et le panneau l'y suit (comme avec ‹ ›).
                if (this.modeTel()) this.app.ouvrirPanneauAccord(this._s, +nom.dataset.c);
                return;
            }
            const caseEl = t.closest('.sq-case[data-r]');
            if (!caseEl) return;
            const touch = e.pointerType === 'touch';
            if (!touch) e.preventDefault(); // au doigt on laisse le navigateur défiler : c'est lui qui annule le geste (pointercancel) si le doigt glisse
            const c = +caseEl.dataset.c, k = +caseEl.dataset.k, r = +caseEl.dataset.r;
            const v = caseEl.dataset.v != null ? +caseEl.dataset.v : null;
            const etat = this._etats[c];
            const allume = v != null && etat.on.has(cle(v, k));
            const g = { type: this.intensite ? 'intensite' : 'peinture', r, mode: allume ? 'off' : 'on', depart: { c, k }, faites: new Set(), etats: new Map(), annulationPosee: false, bouge: false,
                touch, dessin: touch && this.dessin, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, el: caseEl, minuteur: null };
            // L2 (14/11) — À L'ORDINATEUR, à la souris : un clic sur une NOTE la sélectionne (Ctrl / Cmd + clic l'ajoute ou la retire), glisser la déplace avec toute la sélection,
            // ses poignées étirent toutes les notes choisies, Suppr les supprime ; une case VIDE pose une croche, comme avant. Au doigt et au téléphone rien ne change (le clic
            // sur une note l'enlève encore) ; en mode Intensité un clic règle la force de la note.
            const geste = !touch && !this.modeTel() && !this.intensite;
            const note = geste && allume && v != null ? this.noteDe({ c, k, midi: this.midiDeLigne(c, r) }) : null;
            if (geste && !note && !(e.ctrlKey || e.metaKey) && this.sel.length) { this.sel = []; this.marquerSelection(); }
            if (note) {
                const it = { c, k: note.d, midi: note.midi };
                if (e.ctrlKey || e.metaKey) {
                    if (this.dansSel(note)) this.sel = this.sel.filter(x => !this.memeNote(x, note)); else this.sel.push(it);
                    this.choisirSansJouer(c);   // toucher une note choisit aussi son accord dans la grille : jamais de séquenceur inerte
                    this.marquerSelection();
                    return;
                }
                const bord = t.closest('.sq-bord');
                g.note = note;
                g.selectionSeule = true;   // sans glissé : le clic choisit CETTE note seule (même sur un groupe)
                if (bord) {
                    const cote = bord.classList.contains('g') ? 'g' : 'd';
                    if (this.sel.length > 1 && this.dansSel(note)) {
                        // Les poignées d'une note choisie étirent TOUTES les notes choisies du même nombre de croches.
                        g.type = 'etire-groupe'; g.cote = cote; g.k0 = cote === 'd' ? note.f : note.d; g.fait = 0; g.selectionSeule = false;
                        this._geste = g;
                        return;
                    }
                    this.sel = [it]; this.marquerSelection();
                } else {
                    g.type = 'deplace';
                    const b0 = this.grille.querySelector(`.sq-case[data-c="${c}"][data-r="${r}"][data-k="${note.d}"]`), b1 = this.grille.querySelector(`.sq-case[data-c="${c}"][data-r="${r}"][data-k="${note.f}"]`);
                    if (b0 && b1) { const r0 = b0.getBoundingClientRect(), r1 = b1.getBoundingClientRect(); g.prise = { dx: e.clientX - r0.left, dy: e.clientY - r0.top }; g.largeur = r1.right - r0.left; g.hauteur = r0.height; }
                    this._geste = g;
                    return;
                }
            }
            // Une POIGNÉE de note (13/11) : le glissé étire ou raccourcit CETTE note au lieu de peindre. Sans glissé (un simple clic sur le bord de la note), le geste reste celui de
            // la case : la note s'enlève, comme avant — un bord de 8 px n'est pas un piège pour qui veut juste effacer.
            const poignee = t.closest('.sq-bord');
            if (poignee && v != null && allume) {
                const cote = poignee.classList.contains('g') ? 'g' : 'd';
                const [debut, fin] = bornesBarre(etat, v, k);
                g.etire = { cote, v, fixe: cote === 'd' ? debut : fin };
            }
            // AU DOIGT (12/11, « interférence entre scroll horizontal et création / modification d'une note ») : un appui bref pose ou enlève ; un glissé fait DÉFILER (la
            // grille n'est plus en touch-action: none) sans toucher à aucune note ; l'appui long sur une note ouvre son menu. Pour PEINDRE d'un trait au doigt, le mode
            // « Dessiner » (crayon de la barre d'outils) : la grille y est en touch-action: none, le doigt peint et ne fait plus défiler. Pourquoi un mode et pas un appui long
            // suivi d'un glissé : le navigateur annule le geste (pointercancel) dès que le doigt bouge sur une zone qui défile — mesuré, la peinture s'arrêtait à la 2e croche.
            if (touch) g.minuteur = setTimeout(() => this.appuiLong(g), APPUI_LONG_MS);
            this._geste = g;
        }

        annulerGeste() {
            const g = this._geste;
            if (g && g.minuteur) clearTimeout(g.minuteur);
            this._geste = null;
            document.body.classList.remove('sq-etire');
        }

        // Le doigt est resté posé sur une note : son menu (Scinder, Prolonger, Supprimer). Sur une case vide, rien de plus qu'un appui.
        appuiLong(g) {
            g.minuteur = null;
            if (this._geste !== g || g.bouge || !g.el.classList.contains('on')) return;
            if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) { /* pas de vibreur : sans conséquence */ } }
            this._geste = null;
            this.ouvrirMenuNote(g.el, g.x, g.y);
        }

        // L'accord `c` en cours d'écriture par un geste : une copie de son état et de ses notes libres (voir ecrire).
        enCours(g, c) {
            if (!g.etats.has(c)) {
                const e = this._etats[c], d = this.accord(c);
                g.etats.set(c, { etat: { info: e.info, on: new Set(e.on), soude: new Set(e.soude), niveaux: new Map(e.niveaux) }, motif: 'main', extraNotes: (d.extraNotes || []).map(x => ({ ...x })) });
            }
            return g.etats.get(c);
        }
        // La voix de la ligne `r` dans l'accord en cours d'écriture ; une note libre (ou une hauteur de « Toutes les notes ») qu'il ne porte pas encore
        // y est AJOUTÉE si `creer` (on pose une croche).
        voixDuGeste(m, c, r, creer) {
            const L = this._lignes[r];
            if (!L) return null;
            const v = this._voixLigne(m.etat, L);
            if (v != null || !creer || L.type === 'voix') return v;
            return ajouterLibre(m, this.accord(c), L.midi);
        }

        surMouvement(e) {
            const g = this._geste;
            if (!g) return;
            if (g.touch) {
                g.x = e.clientX; g.y = e.clientY;
                const ecart = Math.hypot(e.clientX - g.x0, e.clientY - g.y0);
                // Un doigt qui s'écarte de plus de 8 px ne fait plus d'appui long ; hors mode Dessiner, il DÉFILE : aucune note ne bouge (le navigateur enverra aussi pointercancel).
                if (ecart > 8 && g.minuteur) { clearTimeout(g.minuteur); g.minuteur = null; }
                if (!g.dessin && !g.etire && g.type !== 'boucle' && g.type !== 'retirer-boucle' && ecart > 8) { this.annulerGeste(); return; }
            }
            if (g.etire) { this.etirer(g, e); return; }
            if (g.type === 'etire-groupe') { this.etirerGroupe(g, e); return; }
            if (g.type === 'deplace') { this.deplacerGeste(g, e); return; }
            if (g.type === 'boucle') {
                // elementsFromPoint : la bande orange déjà posée passe AU-DESSUS de la règle, la case visée est dessous.
                const tp = document.elementsFromPoint(e.clientX, e.clientY).find(el => el.matches && el.matches('#sq-grille [data-c]'));
                if (!tp) return;
                const c = +tp.dataset.c;
                if (c !== g.c1) { g.c1 = c; g.bouge = true; }
                return;
            }
            if (g.type !== 'peinture') return;
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const caseEl = el && el.closest && el.closest('#sq-grille .sq-case[data-r]');
            if (!caseEl || +caseEl.dataset.r !== g.r) return; // on peint sur la ligne de départ seulement
            const c = +caseEl.dataset.c, k = +caseEl.dataset.k;
            if (c === g.depart.c && k === g.depart.k && !g.bouge) return;
            if (!g.bouge) { g.bouge = true; this.peindre(g, g.depart.c, g.depart.k); }
            this.peindre(g, c, k);
        }

        // La croche de la ligne `r` de l'accord `c` qui est sous l'abscisse `x` — le bout de la note est celle-là, pas un point au pixel. Hors de l'accord, la première ou la
        // dernière : la poignée suit le pointeur jusqu'au bord de l'accord et s'y arrête (une note ne déborde pas sur l'accord voisin).
        crocheSous(c, r, x) {
            const cases = [...this.grille.querySelectorAll(`.sq-case[data-c="${c}"][data-r="${r}"]`)];
            if (!cases.length) return null;
            const bornes = cases.map(el => el.getBoundingClientRect());
            if (x <= bornes[0].left) return +cases[0].dataset.k;
            const dernier = cases.length - 1;
            if (x >= bornes[dernier].right) return +cases[dernier].dataset.k;
            const i = bornes.findIndex(b => x >= b.left && x < b.right);
            return +cases[i >= 0 ? i : dernier].dataset.k;
        }

        // Le glissé d'une poignée : une seule annulation pour tout le geste (comme la peinture), l'écriture suit le pointeur croche par croche.
        etirer(g, e) {
            const ecart = Math.hypot(e.clientX - g.x0, e.clientY - g.y0);
            if (!g.bouge && ecart < 4) return;   // pas encore un glissé : un clic sur le bord enlève toujours la note
            if (!g.bouge) { g.bouge = true; document.body.classList.add('sq-etire'); } // le curseur reste « ⇔ » même si le pointeur quitte la poignée
            const { c } = g.depart;
            const k = this.crocheSous(c, g.r, e.clientX);
            if (k == null) return;
            const m = this.enCours(g, c);
            if (!etirerNote(m.etat, g.etire.v, g.etire.fixe, g.etire.cote, k, m.etat.info.croches)) return;
            if (!g.annulationPosee) this.choisirSansJouer(c);
            this.ecrire(new Map([[c, m]]), g);
            this._etats[c] = { ...m.etat, motif: 'main' };
        }

        // Peindre d'un trait = UNE note tenue (le cahier : « une note longue est faite de croches soudées, qu'on peint d'un glissé ») : les croches posées par le
        // même glissé, côte à côte sur la même ligne, se soudent entre elles — et à elles seules : une note déjà là, ou posée par un autre geste, n'est jamais
        // soudée par ricochet (12/11 : « 2 notes consécutives ne doivent pas constituer une note tenue »). Un pointeur rapide saute des cases : celles du milieu
        // sont peintes aussi, dans l'ordre du trait. En mode « enlever », chaque case touchée enlève sa note ENTIÈRE.
        peindre(g, c, k) {
            const d = g.derniere;
            if (d && d.c === c && Math.abs(k - d.k) > 1) {
                const pas = k > d.k ? 1 : -1;
                for (let j = d.k + pas; j !== k; j += pas) this.peindreUne(g, c, j);
            }
            this.peindreUne(g, c, k);
        }

        peindreUne(g, c, k) {
            const id = c + '/' + k;
            if (g.faites.has(id)) return;
            g.faites.add(id);
            const m = this.enCours(g, c);
            const v = this.voixDuGeste(m, c, g.r, g.mode === 'on');
            if (v == null) return;
            const d = g.derniere;
            if (!poserCroche(m.etat, v, k, g.mode === 'on')) { g.derniere = null; return; }
            if (g.mode === 'on') {
                if (d && d.c === c && d.v === v && Math.abs(k - d.k) === 1) souder(m.etat, v, Math.max(k, d.k));
                g.derniere = { c, k, v };
                this.jouerNote(c, m.etat.info.voix[v].midi, 'normal');
            }
            // Écrit à chaque case traversée (le dessin suit le doigt), sous UNE seule annulation pour tout le geste.
            this.ecrire(new Map([[c, m]]), g);
            this._etats[c] = { ...m.etat, motif: 'main' };
        }

        surRelache(e) {
            const g = this._geste;
            if (g && g.minuteur) clearTimeout(g.minuteur);
            this._geste = null;
            document.body.classList.remove('sq-etire');
            if (!g) return;
            if (g.type === 'retirer-boucle') { this.retirerBoucle(); return; }
            if (g.type === 'boucle') { this.app.setLoopRange(this._s, g.c0, this._s, g.c1); return; }
            if (g.type === 'deplace') { this.finDeplacement(g); return; }
            if (g.type === 'etire-groupe') return;   // tout est déjà écrit, croche par croche
            if (g.selectionSeule && !g.bouge && g.note) { this.sel = [{ c: g.note.c, k: g.note.d, midi: g.note.midi }]; this.choisirSansJouer(g.note.c); this.marquerSelection(); return; }
            if (g.bouge) return; // un glissé : tout est déjà peint
            const { c, k } = g.depart;
            const m = this.enCours(g, c);
            const v = this.voixDuGeste(m, c, g.r, true);
            if (v == null) return;
            const etat = m.etat;
            let entendre = null;
            if (g.type === 'intensite' && etat.on.has(cle(v, k))) {
                // normal → fort → doux → enlevée, porté par l'attaque de la barre (une barre a un seul niveau : celui de sa première croche).
                const suite = CYCLE_INTENSITE[niveauDe(etat, v, k)];
                if (suite) { etat.niveaux.set(cle(v, debutBarre(etat, v, k)), suite); entendre = suite; }
                else poserCroche(etat, v, k, false);
            } else if (etat.on.has(cle(v, k))) {
                poserCroche(etat, v, k, false);
            } else {
                poserCroche(etat, v, k, true);
                entendre = niveauDe(etat, v, k);
            }
            // La hauteur est lue AVANT d'écrire : une note libre muette élaguée par l'écriture renumérote les voix qui la suivent.
            const midi = etat.info.voix[v] ? etat.info.voix[v].midi : null;
            this.choisirSansJouer(c);
            this.ecrire(new Map([[c, m]]));
            if (entendre && midi != null) this.jouerNote(c, midi, entendre);
        }

        // ---- Sélection, déplacement et étirement en groupe (L2, 14/11) -----------------------------------------------------------------------
        // Tout s'écrit dans le MODÈLE (enCours / voixDuGeste / ecrire), jamais par des clics simulés : le premier essai de l'aperçu raccourcissait les notes.
        // La hauteur (midi) de la ligne `r` de l'accord `c` : celle de sa voix, ou celle de la note libre / de la hauteur de la ligne.
        midiDeLigne(c, r) {
            const L = this._lignes && this._lignes[r], e = this._etats && this._etats[c];
            if (!L || !e) return null;
            const v = this._voixLigne(e, L);
            return v != null ? e.info.voix[v].midi : (L.midi != null ? L.midi : null);
        }
        // La note { c, k, midi } relue dans le modèle : sa ligne, sa voix, son début d et sa fin f, sa longueur n. Null si elle n'y est plus ou n'est pas à l'écran.
        noteDe(it) {
            const e = this._etats && this._etats[it.c];
            if (!e || !this._lignes || !this._montres.includes(it.c)) return null;
            for (let r = 0; r < this._lignes.length; r++) {
                const v = this._voixLigne(e, this._lignes[r]);
                if (v == null || e.info.voix[v].midi !== it.midi || !e.on.has(cle(v, it.k))) continue;
                const [d, f] = bornesBarre(e, v, it.k);
                return { c: it.c, r, v, d, f, n: f - d + 1, midi: it.midi };
            }
            return null;
        }
        memeNote(it, n) { return it.c === n.c && it.midi === n.midi && it.k >= n.d && it.k <= n.f; }
        dansSel(n) { return this.sel.some(it => this.memeNote(it, n)); }
        // Surbrillance claire : un seul trait autour de la NOTE entière (haut, bas, et les deux bouts), jamais autour de chaque croche.
        marquerSelection() {
            this.grille.querySelectorAll('.sq-sel').forEach(x => x.classList.remove('sq-sel', 'sq-sel-g', 'sq-sel-d'));
            const vus = new Set();
            this.sel = this.sel.map(it => this.noteDe(it)).filter(Boolean).map(n => ({ c: n.c, k: n.d, midi: n.midi })).filter(it => { const id = it.c + '/' + it.midi + '/' + it.k; if (vus.has(id)) return false; vus.add(id); return true; });
            this.sel.forEach(it => {
                const n = this.noteDe(it);
                for (let k = n.d; k <= n.f; k++) {
                    const el = this.grille.querySelector(`.sq-case[data-c="${n.c}"][data-r="${n.r}"][data-k="${k}"]`);
                    if (!el) continue;
                    el.classList.add('sq-sel');
                    if (k === n.d) el.classList.add('sq-sel-g');
                    if (k === n.f) el.classList.add('sq-sel-d');
                }
            });
        }
        // Les croches des accords montrés, bout à bout : de quoi déplacer une note d'un accord à l'autre.
        decalages() {
            const off = new Map(); let t = 0;
            this._montres.forEach(c => { off.set(c, t); t += this._etats[c].info.croches; });
            return { off, ordre: this._montres.slice() };
        }
        // Où va la note si on la décale de dG croches et dr lignes ; null si elle ne tient pas ENTIÈRE dans un accord, sort des lignes, ou n'a pas de voix à cet endroit.
        placer(it, dG, dr, D) {
            const n = this.noteDe(it);
            if (!n) return null;
            const G = D.off.get(n.c) + n.d + dG;
            if (G < 0) return null;
            let c1 = null;
            D.ordre.forEach(c => { if (G >= D.off.get(c)) c1 = c; });
            if (c1 == null) return null;
            const k1 = G - D.off.get(c1), r1 = n.r + dr;
            if (k1 + n.n > this._etats[c1].info.croches || r1 < 0 || r1 >= this._lignes.length) return null;
            const L = this._lignes[r1];
            if (L.type === 'voix' && this._voixLigne(this._etats[c1], L) == null) return null;
            return { c: c1, k: k1, r: r1, n: n.n, midi: this.midiDeLigne(c1, r1) };
        }
        nettoyerCibles() { this.grille.querySelectorAll('.sq-cible').forEach(x => x.classList.remove('sq-cible')); }
        // Le glissé d'une note : une copie la SUIT, l'originale reste pâle, les cases d'arrivée sont surlignées, chaque ligne survolée fait entendre sa note.
        deplacerGeste(g, e) {
            const ecart = Math.hypot(e.clientX - g.x0, e.clientY - g.y0);
            if (!g.bouge) {
                if (ecart < 4) return;
                g.bouge = true;
                if (!this.dansSel(g.note)) { this.sel = [{ c: g.note.c, k: g.note.d, midi: g.note.midi }]; this.marquerSelection(); }
                this.sel.forEach(it => { const n = this.noteDe(it); for (let k = n.d; k <= n.f; k++) { const el = this.grille.querySelector(`.sq-case[data-c="${n.c}"][data-r="${n.r}"][data-k="${k}"]`); if (el) el.classList.add('sq-fantome'); } });
                const f = document.getElementById('sq-fantome'), modele = g.el.querySelector('.sq-note');
                if (f && modele) { f.innerHTML = ''; const copie = modele.cloneNode(true); copie.querySelectorAll('.sq-bord').forEach(x => x.remove()); f.appendChild(copie); f.style.width = (g.largeur || 34) + 'px'; f.style.height = (g.hauteur || 26) + 'px'; f.hidden = false; }
                document.body.classList.add('sq-deplace');
            }
            const f = document.getElementById('sq-fantome');
            if (f) f.style.transform = `translate(${Math.round(e.clientX - (g.prise ? g.prise.dx : 0))}px, ${Math.round(e.clientY - (g.prise ? g.prise.dy : 0))}px)`;
            this.nettoyerCibles(); g.cible = null;
            const el = document.elementFromPoint(e.clientX, e.clientY), cs = el && el.closest && el.closest('#sq-grille .sq-case[data-r]');
            if (!cs) return;
            const o = { c: +cs.dataset.c, k: +cs.dataset.k, r: +cs.dataset.r };
            g.cible = o;
            if (this.app.sonDeplacementSeq !== false) {
                const id = o.r + '/' + o.c;
                if (id !== g.derniere) { g.derniere = id; this.ecouterLigne(o.c, o.r); }
            }
            const D = this.decalages();
            const dG = D.off.get(o.c) + o.k - (D.off.get(g.note.c) + g.note.d + (g.depart.k - g.note.d)), dr = o.r - g.note.r;
            const places = this.sel.map(it => this.placer(it, dG, dr, D));
            if (places.every(Boolean)) places.forEach(p => { for (let j = 0; j < p.n; j++) { const d2 = this.grille.querySelector(`.sq-case[data-c="${p.c}"][data-r="${p.r}"][data-k="${p.k + j}"]`); if (d2) d2.classList.add('sq-cible'); } });
        }
        // Entendre la hauteur de la ligne survolée (comme GarageBand), avec l'instrument du morceau.
        ecouterLigne(c, r) {
            const midi = this.midiDeLigne(c, r);
            if (midi != null) this.jouerNote(c, midi, 'normal');
        }
        finDeplacement(g) {
            const f = document.getElementById('sq-fantome');
            if (f) { f.hidden = true; f.innerHTML = ''; }
            document.body.classList.remove('sq-deplace');
            this.grille.querySelectorAll('.sq-fantome').forEach(x => x.classList.remove('sq-fantome'));
            this.nettoyerCibles();
            if (!g.bouge) { this.sel = [{ c: g.note.c, k: g.note.d, midi: g.note.midi }]; this.choisirSansJouer(g.note.c); this.marquerSelection(); return; }   // un simple clic sur une note d'un groupe garde cette seule note
            const o = g.cible;
            if (!o) return;
            const D = this.decalages();
            const dG = D.off.get(o.c) + o.k - (D.off.get(g.note.c) + g.depart.k), dr = o.r - g.note.r;
            if (dG === 0 && dr === 0) return;
            if (!this.deplacer(dG, dr)) this.app.flashHint && this.app.flashHint('Déplacement impossible : la note ne tient pas là');
        }
        // Déplacer toutes les notes choisies du même écart, sous UNE annulation. Une note garde exactement sa longueur ; si l'une d'elles ne tient pas (hors de son accord, sur une
        // autre note), RIEN ne change.
        deplacer(dG, dr) {
            const D = this.decalages(), g = { etats: new Map(), annulationPosee: false }, liste = [];
            const ok = this.sel.every(it => { const n = this.noteDe(it), p = this.placer(it, dG, dr, D); if (!n || !p) return false; liste.push({ n, p }); return true; });
            if (!ok) return false;
            // 1) on retire toutes les notes qui bougent, en gardant leur force
            liste.forEach(x => { const m = this.enCours(g, x.n.c); x.niveau = niveauDe(m.etat, x.n.v, x.n.d); retirerCroches(m.etat, x.n.v, x.n.d, x.n.f); });
            // 2) on les repose ; si une case est prise par une AUTRE note, on abandonne tout (rien n'est écrasé en silence)
            let pose = true;
            liste.forEach(x => {
                if (!pose) return;
                const m = this.enCours(g, x.p.c), v = this.voixDuGeste(m, x.p.c, x.p.r, true);
                if (v == null) { pose = false; return; }
                for (let j = 0; j < x.p.n; j++) if (m.etat.on.has(cle(v, x.p.k + j))) { pose = false; return; }
                for (let j = 0; j < x.p.n; j++) { const x2 = cle(v, x.p.k + j); m.etat.on.add(x2); if (j > 0) m.etat.soude.add(x2); }
                if (x.niveau !== 'normal') m.etat.niveaux.set(cle(v, x.p.k), x.niveau);
            });
            if (!pose) return false;
            this.choisirSansJouer(liste[0].p.c);   // l'accord d'arrivée est choisi dans la grille (avant la sélection : ce redessin-là vide ce qui n'est plus à sa place)
            this.sel = liste.map(x => ({ c: x.p.c, k: x.p.k, midi: x.p.midi }));   // posée AVANT l'écriture : le redessin la marque
            this.ecrire(new Map(g.etats), g);
            return true;
        }
        // Étirer toutes les notes choisies du même nombre de croches que la poignée tenue (une seule annulation pour tout le geste).
        etirerGroupe(g, e) {
            const ecart = Math.hypot(e.clientX - g.x0, e.clientY - g.y0);
            if (!g.bouge && ecart < 4) return;
            if (!g.bouge) { g.bouge = true; document.body.classList.add('sq-etire'); }
            const k = this.crocheSous(g.note.c, g.note.r, e.clientX);
            if (k == null) return;
            const delta = k - g.k0;
            if (delta === g.fait) return;
            const pas = delta - g.fait;
            let touche = false;
            this.sel.forEach(it => {
                const n = this.noteDe(it);
                if (!n) return;
                const m = this.enCours(g, n.c);
                const bord = g.cote === 'd' ? n.f : n.d, fixe = g.cote === 'd' ? n.d : n.f;
                if (etirerNote(m.etat, n.v, fixe, g.cote, bord + pas, m.etat.info.croches)) touche = true;
            });
            g.fait = delta;
            if (!touche) return;
            this.ecrire(new Map(g.etats), g);
            g.etats.forEach((m, c) => { this._etats[c] = { ...m.etat, motif: 'main' }; });
        }
        // Suppr / Retour arrière : toutes les notes choisies, d'une annulation.
        supprimerSelection() {
            const g = { etats: new Map(), annulationPosee: false };
            this.sel.forEach(it => { const n = this.noteDe(it); if (!n) return; const m = this.enCours(g, n.c); retirerCroches(m.etat, n.v, n.d, n.f); });
            this.sel = [];
            if (g.etats.size) this.ecrire(new Map(g.etats), g);
            else this.marquerSelection();
        }

        // ---- Le menu d'une note ---------------------------------------------------------------------------------------------------
        ouvrirMenuNote(el, x, y) {
            const menu = document.getElementById('sq-menu-note');
            if (!menu || el.dataset.v == null) return;
            const c = +el.dataset.c, k = +el.dataset.k, v = +el.dataset.v;
            const etat = this._etats[c];
            if (!etat || !etat.on.has(cle(v, k))) return;
            this._menuNote = { c, k, v };
            const copie = { on: new Set(etat.on), soude: new Set(etat.soude), niveaux: new Map(etat.niveaux) };
            const peut = {
                scinder: etat.soude.has(cle(v, k)),
                prolonger: prolongerNote(copie, v, k, etat.info.croches),
                supprimer: true,
            };
            menu.querySelectorAll('button[data-sq-acte]').forEach(b => { b.disabled = !peut[b.dataset.sqActe]; });
            menu.hidden = false;
            // Posé près du doigt ou du pointeur, jamais hors de l'écran.
            const larg = menu.offsetWidth, haut = menu.offsetHeight;
            menu.style.left = Math.max(8, Math.min(x, window.innerWidth - larg - 8)) + 'px';
            menu.style.top = Math.max(8, Math.min(y, window.innerHeight - haut - 8)) + 'px';
        }

        fermerMenuNote() {
            const menu = document.getElementById('sq-menu-note');
            if (menu) menu.hidden = true;
            this._menuNote = null;
        }

        // Scinder, prolonger ou supprimer la note du menu : une seule annulation, comme tout geste d'écriture.
        agirNote(acte) {
            const cible = this._menuNote;
            this.fermerMenuNote();
            if (!cible) return;
            const { c, k, v } = cible;
            const g = { etats: new Map(), annulationPosee: false };
            const m = this.enCours(g, c);
            const etat = m.etat;
            let fait = false;
            if (acte === 'scinder') fait = scinderNote(etat, v, k);
            else if (acte === 'prolonger') fait = prolongerNote(etat, v, k, etat.info.croches);
            else if (acte === 'supprimer') fait = poserCroche(etat, v, k, false);
            if (!fait) return;
            this.choisirSansJouer(c);
            this.ecrire(new Map([[c, m]]), g);
            this._etats[c] = { ...m.etat, motif: 'main' };
        }

        // ---- Poignée de hauteur des lignes (cahier 3 bis, « règle définitive ») ------------------------------------------------------
        brancherPoignee() {
            const p = document.getElementById('sq-poignee');
            if (!p) return;
            p.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                p.setPointerCapture(e.pointerId);
                const nb = Math.max(1, (this._lignes || []).length);
                const depart = { y: e.clientY, vis: Math.min(this._visibles || nb, nb), haut: this.racine.getBoundingClientRect().height };
                const bouger = (ev) => {
                    // 13/11 (« je préfère pouvoir voir plus de notes ») : la poignée ne change plus la hauteur des barres, elle change le NOMBRE de lignes visibles. Vers le haut = plus
                    // de lignes. Jamais plus que la place libre : la poignée s'arrête avant que rien ne passe sous la barre du haut.
                    const dy = depart.y - ev.clientY;
                    const parPlace = depart.vis + Math.floor((this.placeLibre() - depart.haut) / (this.ligne + 3));
                    this._visibles = borner(Math.round(depart.vis + dy / (this.ligne + 3)), Math.min(2, nb), Math.max(Math.min(2, nb), Math.min(nb, parPlace)));
                    this.appliquerVisibles();
                };
                const finir = () => {
                    p.removeEventListener('pointermove', bouger);
                    p.removeEventListener('pointerup', finir);
                    p.removeEventListener('pointercancel', finir);
                    this.limiterHauteur();
                };
                p.addEventListener('pointermove', bouger);
                p.addEventListener('pointerup', finir);
                p.addEventListener('pointercancel', finir);
            });
            // Double-clic : tout est visible.
            p.addEventListener('dblclick', () => {
                this._visibles = 0;
                this.limiterHauteur();
            });
        }

        // LA POIGNÉE DE LARGEUR (14/11) : au bord droit des croches, centrée sur les lignes de notes. Elle change la largeur de la croche de 14 à 90 px (jamais plus que
        // la place : la poignée reste dans la fenêtre), double-clic = 34 px. Retenue par appareil. La grille n'est pas redessinée pendant qu'on tire (poserColonnes) : la
        // poignée qu'on tient resterait sinon sans élément.
        brancherPoigneeLargeur() {
            const g = this.grille;
            const largeurMax = () => {
                const n = Math.max(1, this._nCroches || 1);
                return borner(Math.floor((g.clientWidth - 46 - 10 - LARGEUR_POIGNEE) / n), CROCHE_MIN, CROCHE_MAX);
            };
            const poser = (w, definitif) => {
                this.croche = borner(Math.round(w), CROCHE_MIN, largeurMax());
                this.poserColonnes();
                if (definitif) ecrireLocal(CLE_CROCHE, String(this.croche));
            };
            g.addEventListener('pointerdown', (e) => {
                const p = e.target.closest && e.target.closest('.sq-poignee-largeur');
                if (!p || e.button !== 0) return;
                e.preventDefault();
                const premiere = g.querySelector('.sq-case[data-r="0"]');
                if (!premiere) return;
                const gauche = premiere.getBoundingClientRect().left;
                const n = Math.max(1, this._nCroches || 1);
                p.classList.add('tire');
                document.body.classList.add('sq-etire-largeur');
                const bouger = (ev) => poser((ev.clientX - gauche) / n, false);
                const finir = () => {
                    window.removeEventListener('pointermove', bouger);
                    window.removeEventListener('pointerup', finir);
                    window.removeEventListener('pointercancel', finir);
                    p.classList.remove('tire');
                    document.body.classList.remove('sq-etire-largeur');
                    ecrireLocal(CLE_CROCHE, String(this.croche));
                };
                window.addEventListener('pointermove', bouger);
                window.addEventListener('pointerup', finir);
                window.addEventListener('pointercancel', finir);
            });
            g.addEventListener('dblclick', (e) => {
                if (e.target.closest && e.target.closest('.sq-poignee-largeur')) poser(CROCHE_DEFAUT, true);
            });
        }

        // « Auto » (roue des réglages) : la zone des notes vaut environ 32 % de la hauteur de la fenêtre (moins 60 px) répartie sur les lignes, de LIGNE_MIN à LIGNE_MAX :
        // quatre lignes en vue Accord = barres hautes, douze en vue Piano = barres basses.
        hauteurAuto() { const nb = Math.max(1, (this._lignes || []).length || 4); return borner(Math.round((window.innerHeight * 0.32 - 60) / nb), LIGNE_MIN, LIGNE_MAX); }
        // Les noms de notes disparaissent des cases sous ~24 px de haut (cahier 3 bis) : ils n'y tiendraient plus.
        // Au téléphone, des lignes de 44 px, la jauge du doigt (maquette `Telephone.dc.html`) : pas de poignée.
        poserLigne() {
            const h = this.modeTel() ? 40 : (this.auto ? this.hauteurAuto() : this.ligne); // plein écran au téléphone : des lignes de 40 px, pour voir plus de voix (elles étaient à 44)
            this.racine.style.setProperty('--sq-ligne', h + 'px');
            // Les noms de notes rapetissent de 18 à 23 px et disparaissent sous 18 px (ils disparaissaient sous 24 : à 22-23 px on les lit encore, en 10 px).
            this.racine.classList.toggle('lignes-basses', h < 18);
            this.racine.classList.toggle('lignes-moyennes', h >= 18 && h < 24);
        }

        // ---- Tête de lecture ----------------------------------------------------------------------------------------------------
        // Appelée à chaque case de double-croche par la lecture (schedulePlayback) : la colonne de la croche qui sonne reçoit la classe `tete`.
        // À l'ORDINATEUR (14/11, « plus de contour vert qui saute de croche en croche ») la classe n'a plus d'aspect : une fine barre verticale verte (#sq-tete) glisse en
        // continu, de la gauche à la droite de la croche pendant sa durée. Cette durée est MESURÉE (le temps écoulé entre deux changements de croche) : elle suit le tempo, la
        // vitesse et un changement de tempo en cours de route, sans rien lire de plus. Au téléphone rien ne change : la case reste entourée.
        tete(section, index, step) {
            if (!this.estOuvert()) return;
            // Pendant la lecture, sans accord choisi, le séquenceur SUIT la ligne qui sonne (L1c) ; avec un accord choisi il reste sur le sien, pour ne pas faire sauter la
            // grille sous les doigts pendant qu'on la modifie.
            if (!this.modeTel() && this.app.selectedIndex == null && this.app.editingIndex == null && (section !== this._s || !this._montres.includes(index))) {
                this._vise = { s: section, i: index };
                this._viseActive = this.app.activeSection || 0;
                this.rafraichir();
            }
            if (section !== this._s) return;
            const k = Math.floor(step / 2);
            const id = index + '/' + k;
            if (this._tete === id) return;
            const maintenant = performance.now();
            const avant = this._teteT0;
            this._tete = id;
            this.grille.querySelectorAll('.tete').forEach(el => el.classList.remove('tete'));
            this.grille.querySelectorAll(`[data-c="${index}"][data-k="${k}"]`).forEach(el => el.classList.add('tete'));
            if (this.modeTel() || !this.repere) return;
            // La durée d'une croche : celle qu'on vient de mesurer si elle est plausible (60 ms à 2 s), sinon un quart de seconde (120 BPM).
            const mesure = avant != null ? maintenant - avant : 0;
            this._teteDuree = mesure >= 60 && mesure <= 2000 ? mesure : (this._teteDuree || 250);
            this._teteT0 = maintenant;
            this._teteCase = { c: index, k };
            if (!this._teteImage) this._teteImage = requestAnimationFrame(() => this.animerTete());
        }
        animerTete() {
            this._teteImage = 0;
            const r = this.repere, cible = this._teteCase;
            if (!r || !cible || !this.estOuvert()) { if (r) r.hidden = true; return; }
            const cellule = this.grille.querySelector(`.sq-temps[data-c="${cible.c}"][data-k="${cible.k}"]`);
            if (!cellule) { r.hidden = true; }
            else {
                const f = Math.min(1, (performance.now() - this._teteT0) / (this._teteDuree || 250));
                const rr = this.racine.getBoundingClientRect(), b = cellule.getBoundingClientRect(), gb = this.grille.getBoundingClientRect();
                r.hidden = false;
                // Les coordonnées de la racine (elle défile en interne : la barre défile avec elle) ; de la règle au bas des lignes montrées.
                r.style.left = Math.round((b.left - rr.left + this.racine.scrollLeft + f * b.width) * 10) / 10 + 'px';
                r.style.top = Math.round(gb.top - rr.top + this.racine.scrollTop) + 'px';
                r.style.height = Math.round(gb.height) + 'px';
            }
            this._teteImage = requestAnimationFrame(() => this.animerTete());
        }
        effacerTete() {
            if (this._teteImage) { cancelAnimationFrame(this._teteImage); this._teteImage = 0; }
            this._teteT0 = null; this._teteCase = null;
            if (this.repere) this.repere.hidden = true;
            if (this._tete == null) return;
            this._tete = null;
            this.grille.querySelectorAll('.tete').forEach(el => el.classList.remove('tete'));
        }
    }

    window.SequenceurHarmo = { Sequenceur, MOTIFS, lireAccord, ecrireAccord, motifSurVoix, etatAvecMotif, voixDe, motifParId, motifActuel, formeDepuisEtat, LIGNE_MIN, LIGNE_MAX, LIGNE_DEFAUT, CROCHE_MIN, CROCHE_MAX, CROCHE_DEFAUT };
})();
