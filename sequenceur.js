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

    // Trois niveaux seulement (maquette : « normal → fort → doux → enlevée »). « Normal » = pas de réglage propre : la note suit l'intensité de
    // l'accord (data.intensity) ; doux et fort reprennent les valeurs des cinq niveaux de l'appli (NIVEAUX_INTENSITE : Doux 55, Fort 90).
    const NIVEAU_VALEUR = { doux: 55, fort: 90 };
    const CYCLE_INTENSITE = { normal: 'fort', fort: 'doux', doux: null };

    const LIGNE_MIN = 22, LIGNE_MAX = 48, LIGNE_DEFAUT = 30;   // hauteur des LIGNES (cahier 3 bis : « de 22 à 48 px (30 par défaut) »)
    const CLE_LIGNE = 'harmohubSequenceurLigne';
    const CLE_OUVERT = 'harmohubSequenceurOuvert';
    const CLE_PORTEE = 'harmohubSequenceurPortee';
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
    function motifActuel(data) {
        if (data.motifSeq && (MOTIF_PAR_ID[data.motifSeq])) return data.motifSeq;
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
    const crochesPosition = (liste, croches) => {
        const r = new Set();
        for (let k = 0; k < croches; k++) if (liste.includes(k % 8)) r.add(k);
        return r;
    };
    const memesCroches = (a, b) => a.size === b.size && [...a].every(k => b.has(k));

    // APPLIQUER UN MOTIF À UN ACCORD (cahier, « Accords de 3, 5 ou 6 notes » et « Renversements, basses différentes ») : renvoie, pour chaque
    // voix (hors notes libres, qu'un motif ne touche jamais), l'ensemble de ses croches.
    //  - 4 voix : une position chacune, de la plus grave à la plus aiguë ;
    //  - moins de voix : on garde toujours la basse et l'aiguë, les voix du milieu en trop « se fondent dans la voisine » (leurs croches s'ajoutent) ;
    //  - plus de voix (9e, 11e, 13e) : les voix en plus prennent le rythme COMMUN des voix au-dessus de la basse s'il existe (Plaqué, Pompe), sinon
    //    celui de la basse (Arpège) — règle confirmée le 11/11 (« Ok ça me va ») ; basse muette → la voix la plus proche en hauteur ;
    //  - une basse différente (C_E) est la voix la plus grave : elle prend le rythme de la basse, et le corps de l'accord se range au-dessus comme
    //    un accord sans elle.
    function motifSurVoix(motif, info) {
        const P = motif.v.map(l => crochesPosition(l, info.croches)); // [basse, voix 2, voix 3, aiguë]
        const out = new Map();
        let ordre = info.positions.slice();
        if (info.basse != null) {
            out.set(info.basse, new Set(P[0]));
            ordre = ordre.filter(i => i !== info.basse);
        }
        const n = ordre.length;
        const union = (...ens) => { const r = new Set(); ens.forEach(e => e.forEach(k => r.add(k))); return r; };
        if (n === 0) return out;
        if (n === 1) { out.set(ordre[0], union(...P)); return out; }
        if (n === 2) { out.set(ordre[0], union(P[0], P[1])); out.set(ordre[1], union(P[2], P[3])); return out; }
        if (n === 3) { out.set(ordre[0], P[0]); out.set(ordre[1], union(P[1], P[2])); out.set(ordre[2], P[3]); return out; }
        out.set(ordre[0], P[0]); out.set(ordre[1], P[1]); out.set(ordre[n - 2], P[2]); out.set(ordre[n - 1], P[3]);
        if (n > 4) {
            const hautCommun = memesCroches(P[1], P[2]) && memesCroches(P[2], P[3]);
            for (let j = 2; j < n - 2; j++) {
                let r;
                if (hautCommun) r = P[1];
                else if (P[0].size > 0) r = P[0];
                else r = (j - 1 <= (n - 2) - j) ? P[1] : P[2]; // basse muette : la voix la plus proche (voix 2 en dessous, voix 3 au-dessus)
                out.set(ordre[j], new Set(r));
            }
        }
        return out;
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
        motifSurVoix(motif, info).forEach((ks, v) => {
            ks.forEach(k => { on.add(cle(v, k)); if (ks.has(k - 1)) soude.add(cle(v, k)); });
        });
        return { info, on, soude, niveaux };
    }

    // Allumer / éteindre une croche en gardant le reste : une croche posée se soude à ses voisines ; une croche enlevée coupe la barre en deux.
    function poserCroche(etat, v, k, allumer) {
        const c = cle(v, k), apres = cle(v, k + 1);
        if (allumer) {
            if (etat.on.has(c)) return false;
            etat.on.add(c);
            if (etat.on.has(cle(v, k - 1))) { etat.soude.add(c); etat.niveaux.delete(c); }
            if (etat.on.has(apres)) { etat.soude.add(apres); etat.niveaux.delete(apres); }
            return true;
        }
        if (!etat.on.has(c)) return false;
        const niveauBarre = niveauDe(etat, v, k);
        etat.on.delete(c); etat.soude.delete(c); etat.niveaux.delete(c);
        // La suite de la barre devient une note à part entière : elle garde le niveau de la barre dont elle sort.
        if (etat.soude.has(apres)) { etat.soude.delete(apres); if (niveauBarre !== 'normal') etat.niveaux.set(apres, niveauBarre); }
        return true;
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
            this.bouton = document.getElementById('vue-sequenceur');
            this.intensite = false;
            this.presse = null;          // rythme copié : { de: nom, voix: [ [croches], ... ] par position, niveaux }
            this.portee = lireLocal(CLE_PORTEE) === 'accord' ? 'accord' : 'partie';
            const h = parseInt(lireLocal(CLE_LIGNE), 10);
            this.ligne = borner(isNaN(h) ? LIGNE_DEFAUT : h, LIGNE_MIN, LIGNE_MAX);
            this._tete = null;
            this._geste = null;
            if (!this.racine || !this.grille) return;
            this.brancher();
        }

        estOrdinateur() { return window.matchMedia('(min-width: 900px)').matches; }
        estOuvert() { return !!this.racine && !this.racine.hidden; }

        // Ouvert ou fermé : retenu par l'appareil. Ordinateur seulement (« téléphone inchangé » : il viendra dans le panneau d'accord, onglet
        // « Rythme », au sous-lot du téléphone).
        voulu() { return lireLocal(CLE_OUVERT) === '1'; }
        basculer(ouvrir) {
            const o = ouvrir == null ? !this.voulu() : !!ouvrir;
            ecrireLocal(CLE_OUVERT, o ? '1' : '0');
            this.synchroniser();
        }

        synchroniser() {
            if (!this.racine) return;
            const montrer = this.estOrdinateur() && this.voulu();
            this.racine.hidden = !montrer;
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
            if (i == null || i >= accords.length) i = accords.length ? 0 : null;
            return { sections, s, sec, accords, i };
        }

        // ---- Rendu ----------------------------------------------------------------------------------------------------------------
        rafraichir() {
            if (!this.estOuvert()) return;
            const { sec, accords, s, i } = this.cible();
            this._s = s; this._i = i;
            this.poserLigne();
            this.majBarreOutils(accords, i);
            if (!sec || accords.length === 0) {
                this.grille.innerHTML = '<p class="sq-vide">Ajoute un accord à la partie pour régler son rythme ici.</p>';
                this._etats = [];
                this.limiterHauteur();
                return;
            }
            const etats = accords.map(d => lireAccord(d, this.app));
            this._etats = etats;
            const nPos = Math.max(...etats.map(e => e.info.positions.length));
            const nLib = Math.max(0, ...etats.map(e => e.info.libres.length));
            // Lignes de haut en bas : notes libres (en pointillés), puis les voix de l'aiguë à la basse. Un accord plus pauvre que le plus riche de
            // la partie laisse ses lignes du haut vides (cahier : « vides, sans hachures »).
            const lignes = [];
            for (let j = nLib - 1; j >= 0; j--) lignes.push({ type: 'libre', j });
            for (let p = nPos - 1; p >= 0; p--) lignes.push({ type: 'voix', p });
            this._lignes = lignes;
            const voixLigne = (e, L) => L.type === 'libre' ? (e.info.libres[L.j] != null ? e.info.libres[L.j] : null)
                                                       : (e.info.positions[L.p] != null ? e.info.positions[L.p] : null);
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
            const cols = ['46px', '10px'];
            const colDebut = [];
            let piste = 3;
            accords.forEach((d, c) => {
                if (c > 0) { cols.push('4px'); piste++; }
                colDebut.push(piste);
                cols.push(`repeat(${etats[c].info.croches}, minmax(10px, 1fr))`);
                piste += etats[c].info.croches;
            });
            this.grille.style.gridTemplateColumns = cols.join(' ');
            this.grille.style.gridTemplateRows = `auto 20px repeat(${lignes.length}, var(--sq-ligne))`;

            const r = this.app.loopRange;
            const boucle = r && r.startSection === s && r.endSection === s ? [r.startIndex, r.endIndex] : null;
            const html = [];
            // Rangée 1 : nom et degré de chaque accord (un clic le choisit) ; rangée 2 : la règle, numéros de temps seulement.
            const gRoot = (document.getElementById('global-root') || {}).value, gMode = (document.getElementById('global-mode') || {}).value;
            let tempsAvant = 0;
            accords.forEach((d, c) => {
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
            const eSel = i != null ? etats[i] : etats[0], dSel = i != null ? accords[i] : accords[0];
            lignes.forEach((L, ri) => {
                const row = ri + 3;
                const vSel = voixLigne(eSel, L);
                const nomSel = vSel != null ? nomNote(eSel, vSel, dSel) : '';
                const diese = /[#♯♭b]/.test(nomSel.replace(/^[A-G]/, '').replace(/-?\d+$/, ''));
                html.push(`<div class="sq-etiq${diese ? ' diese' : ''}${L.type === 'libre' ? ' libre' : ''}" style="grid-row:${row};grid-column:1">${escapeHtml(nomSel)}</div>`);
                accords.forEach((d, c) => {
                    const e = etats[c], v = voixLigne(e, L), col = colDebut[c];
                    for (let k = 0; k < e.info.croches; k++) {
                        const cls = ['sq-case'];
                        if (k % 2 === 0) cls.push('temps');
                        if (k === 0) cls.push('mesure');
                        if (c === i) cls.push('choisi');
                        if (boucle && c >= boucle[0] && c <= boucle[1]) cls.push('dans-boucle');
                        if (ri % 2 === 1) cls.push('pair');
                        if (v == null) {
                            html.push(`<div class="${cls.join(' ')} sans-voix" style="grid-row:${row};grid-column:${col + k}"></div>`);
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
                            note = `<span class="sq-note" style="--sq-rgb:${rgb(x.role)}">${g ? '' : escapeHtml(nomNote(e, v, d))}</span>`;
                            label += ` : ${niv}`;
                        } else label += ' : vide';
                        html.push(`<div class="${cls.join(' ')}" role="gridcell" aria-label="${escapeHtml(label)}" data-c="${c}" data-v="${v}" data-k="${k}" data-r="${ri}" style="grid-row:${row};grid-column:${col + k}">${note}</div>`);
                    }
                });
            });
            this.grille.innerHTML = html.join('');
            this._colDebut = colDebut;
            this._tete = null;
            this.limiterHauteur();
        }

        // Barre d'outils : motif de l'accord choisi enfoncé, vignettes dessinées comme le séquenceur (croches voisines soudées en barre), portée,
        // Intensité, Coller grisé tant que rien n'est copié.
        majBarreOutils(accords, i) {
            const d = i != null ? accords[i] : null;
            const actuel = d ? motifActuel(d) : null;
            this.racine.querySelectorAll('[data-sq-motif]').forEach(b => {
                const id = b.dataset.sqMotif, m = MOTIF_PAR_ID[id];
                b.setAttribute('aria-pressed', String(id === actuel));
                const vg = b.querySelector('.sq-vignette');
                if (vg && !vg.childElementCount) {
                    const p = [];
                    for (let pos = 3; pos >= 0; pos--) for (let k = 0; k < 8; k++) {
                        const lit = m.v[pos].includes(k), av = lit && m.v[pos].includes(k - 1), ap = lit && m.v[pos].includes(k + 1);
                        p.push(`<span class="${lit ? 'lit' : ''}${av ? ' g' : ''}${ap ? ' d' : ''}"></span>`);
                    }
                    vg.innerHTML = p.join('');
                }
            });
            const pp = document.getElementById('sq-portee-partie'), pa = document.getElementById('sq-portee-accord');
            if (pp) pp.setAttribute('aria-pressed', String(this.portee === 'partie'));
            if (pa) pa.setAttribute('aria-pressed', String(this.portee === 'accord'));
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
            this.racine.style.maxHeight = Math.floor(this.placeLibre()) + 'px';
        }

        // ---- Écriture dans le morceau ---------------------------------------------------------------------------------------------
        // Un geste = une annulation (pushUndo AVANT d'écrire, une seule fois). `modifs` reçoit les données de chaque accord touché (index → état).
        ecrire(modifs, geste) {
            const sections = loadProgressionSections();
            const sec = sections[this._s];
            if (!sec) return;
            if (!geste || !geste.annulationPosee) {
                this.app.pushUndo(sections);
                if (geste) geste.annulationPosee = true;
            }
            modifs.forEach((m, c) => {
                const d = sec.chords[c];
                if (!d) return;
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

        async jouerNote(c, v, niveau) {
            const e = this._etats && this._etats[c];
            const x = e && e.info.voix[v];
            if (!x || !window.Tone) return;
            try {
                await Tone.start();
                const inst = this.app.getInstrument(this.app.songInstrument);
                const pct = niveau === 'normal' ? (this.accord(c).intensity || 75) : NIVEAU_VALEUR[niveau];
                const vel = Math.max(0.05, Math.min(1, (pct / 75) * 0.8 * 0.85));
                inst.triggerAttackRelease(Tone.Frequency(x.midi, 'midi').toNote(), 0.35, undefined, vel);
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
            window.addEventListener('pointercancel', () => { this._geste = null; });
            this.grille.addEventListener('keydown', (e) => {
                if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('sq-boucle')) { e.preventDefault(); this.retirerBoucle(); }
            });
            if (this.bouton) this.bouton.addEventListener('click', () => this.basculer());
            const fermer = document.getElementById('sq-fermer');
            if (fermer) fermer.addEventListener('click', () => this.basculer(false));
            this.brancherPoignee();
            window.addEventListener('resize', () => { this.synchroniser(); });
            // Le tiroir des diagrammes change de taille (poignée, clavier ou guitare allumés) : la place libre du séquenceur change avec lui.
            const tiroir = document.getElementById('vues-tiroir');
            if (tiroir && window.ResizeObserver) new ResizeObserver(() => this.limiterHauteur()).observe(tiroir);
            // Premier dessin APRÈS la construction de l'appli (une micro-tâche plus tard) : pendant celle-ci, l'état qu'il lit n'est pas encore entier.
            Promise.resolve().then(() => this.synchroniser());
        }

        surClic(e) {
            const b = e.target.closest('button');
            if (!b || !this.racine.contains(b) || b.disabled) return;
            if (b.dataset.sqMotif) { this.appliquerMotif(b.dataset.sqMotif); return; }
            switch (b.id) {
                case 'sq-portee-partie': this.portee = 'partie'; ecrireLocal(CLE_PORTEE, 'partie'); this.rafraichir(); break;
                case 'sq-portee-accord': this.portee = 'accord'; ecrireLocal(CLE_PORTEE, 'accord'); this.rafraichir(); break;
                case 'sq-intensite': this.intensite = !this.intensite; this.rafraichir(); break;
                case 'sq-copier': this.copier(); break;
                case 'sq-coller': this.coller(); break;
                case 'sq-effacer': this.effacer(); break;
            }
        }

        appliquerMotif(id) {
            const m = MOTIF_PAR_ID[id];
            if (!m || id === 'main' || !this._etats || !this._etats.length) return; // « À la main » : rien à appliquer, il s'allume tout seul
            const cibles = this.portee === 'partie' ? this._etats.map((_, c) => c) : (this._i != null ? [this._i] : []);
            const modifs = new Map();
            cibles.forEach(c => modifs.set(c, { etat: etatAvecMotif(this._etats[c], m), motif: id }));
            if (modifs.size) this.ecrire(modifs);
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
            if (nom) { e.preventDefault(); this.app.selectChord(this._s, +nom.dataset.c); return; }
            const caseEl = t.closest('.sq-case[data-v]');
            if (!caseEl) return;
            e.preventDefault();
            const c = +caseEl.dataset.c, v = +caseEl.dataset.v, k = +caseEl.dataset.k, r = +caseEl.dataset.r;
            const etat = this._etats[c];
            const allume = etat.on.has(cle(v, k));
            this._geste = { type: this.intensite ? 'intensite' : 'peinture', r, mode: allume ? 'off' : 'on', depart: { c, v, k }, faites: new Set(), etats: new Map(), annulationPosee: false, bouge: false };
        }

        surMouvement(e) {
            const g = this._geste;
            if (!g) return;
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
            const caseEl = el && el.closest && el.closest('#sq-grille .sq-case[data-v]');
            if (!caseEl || +caseEl.dataset.r !== g.r) return; // on peint sur la ligne de départ seulement
            const c = +caseEl.dataset.c, v = +caseEl.dataset.v, k = +caseEl.dataset.k;
            if (c === g.depart.c && k === g.depart.k && !g.bouge) return;
            if (!g.bouge) { g.bouge = true; this.peindre(g, g.depart.c, g.depart.v, g.depart.k); }
            this.peindre(g, c, v, k);
        }

        peindre(g, c, v, k) {
            const id = c + '/' + k;
            if (g.faites.has(id)) return;
            g.faites.add(id);
            if (!g.etats.has(c)) {
                const e = this._etats[c];
                g.etats.set(c, { etat: { info: e.info, on: new Set(e.on), soude: new Set(e.soude), niveaux: new Map(e.niveaux) }, motif: 'main' });
            }
            const m = g.etats.get(c);
            if (!poserCroche(m.etat, v, k, g.mode === 'on')) return;
            if (g.mode === 'on') this.jouerNote(c, v, 'normal');
            // Écrit à chaque case traversée (le dessin suit le doigt), sous UNE seule annulation pour tout le geste.
            this.ecrire(new Map([[c, m]]), g);
            this._etats[c] = { ...m.etat, motif: 'main' };
        }

        surRelache(e) {
            const g = this._geste;
            this._geste = null;
            if (!g) return;
            if (g.type === 'retirer-boucle') { this.retirerBoucle(); return; }
            if (g.type === 'boucle') { this.app.setLoopRange(this._s, g.c0, this._s, g.c1); return; }
            if (g.bouge) return; // un glissé : tout est déjà peint
            const { c, v, k } = g.depart;
            const lu = this._etats[c];
            const etat = { info: lu.info, on: new Set(lu.on), soude: new Set(lu.soude), niveaux: new Map(lu.niveaux) };
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
            this.choisirSansJouer(c);
            this.ecrire(new Map([[c, { etat, motif: 'main' }]]));
            if (entendre) this.jouerNote(c, v, entendre);
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
                const depart = { y: e.clientY, h: this.ligne, haut: this.racine.getBoundingClientRect().height };
                const bouger = (ev) => {
                    // Vers le haut = plus haut. Jamais plus que la place libre : la poignée s'arrête avant que rien ne passe sous la barre du haut.
                    const dy = depart.y - ev.clientY;
                    const maxParPlace = depart.h + Math.floor((this.placeLibre() - depart.haut) / nb);
                    this.ligne = borner(Math.round(depart.h + dy / nb), LIGNE_MIN, Math.max(LIGNE_MIN, Math.min(LIGNE_MAX, maxParPlace)));
                    this.poserLigne();
                };
                const finir = () => {
                    p.removeEventListener('pointermove', bouger);
                    p.removeEventListener('pointerup', finir);
                    p.removeEventListener('pointercancel', finir);
                    ecrireLocal(CLE_LIGNE, String(this.ligne));
                    this.limiterHauteur();
                };
                p.addEventListener('pointermove', bouger);
                p.addEventListener('pointerup', finir);
                p.addEventListener('pointercancel', finir);
            });
            p.addEventListener('dblclick', () => {
                this.ligne = LIGNE_DEFAUT;
                ecrireLocal(CLE_LIGNE, String(this.ligne));
                this.poserLigne();
                this.limiterHauteur();
            });
        }

        // Les noms de notes disparaissent des cases sous ~24 px de haut (cahier 3 bis) : ils n'y tiendraient plus.
        poserLigne() {
            this.racine.style.setProperty('--sq-ligne', this.ligne + 'px');
            this.racine.classList.toggle('lignes-basses', this.ligne < 24);
        }

        // ---- Tête de lecture ----------------------------------------------------------------------------------------------------
        // Appelée à chaque case de double-croche par la lecture (schedulePlayback) : la colonne de la croche qui sonne s'allume en vert.
        tete(section, index, step) {
            if (!this.estOuvert() || section !== this._s) return;
            const k = Math.floor(step / 2);
            const id = index + '/' + k;
            if (this._tete === id) return;
            this.effacerTete();
            this._tete = id;
            this.grille.querySelectorAll(`[data-c="${index}"][data-k="${k}"]`).forEach(el => el.classList.add('tete'));
        }
        effacerTete() {
            if (this._tete == null) return;
            this._tete = null;
            this.grille.querySelectorAll('.tete').forEach(el => el.classList.remove('tete'));
        }
    }

    window.SequenceurHarmo = { Sequenceur, MOTIFS, lireAccord, ecrireAccord, motifSurVoix, etatAvecMotif, voixDe, LIGNE_MIN, LIGNE_MAX, LIGNE_DEFAUT };
})();
