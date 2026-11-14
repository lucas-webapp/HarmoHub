// MES DOIGTÉS, AU CLOUD (L8, fin, 14/11 — décisions du 13/11, lettre « diagrammes guitare + piano », et son commentaire : « un doigté verrouillé ou dessiné est proposé EN PREMIER pour
// le même accord dans tous les morceaux, synchronisé au compte sur le modèle de `synchro-formes.js` »).
//
// CE QUI EST GARDÉ : pour un ACCORD (fondamentale + qualité + basse), les doigtés que l'utilisateur a verrouillés au cadenas ou dessinés sur le manche — la case tenue sur chacune des
// six cordes (`null` : corde étouffée). guitarFingeringsForChord (script.js) les met en tête de la liste des doigtés de cet accord, dans TOUS les morceaux : le cadenas, lui, reste
// propre à une case du morceau et passe toujours avant (« le cadenas reste tel quel »). Une entrée par doigté : verrouiller deux fois le même doigté ne la double pas, elle remonte seulement.
//
// POURQUOI UN DOCUMENT À PART (`users/{uid}/apps/harmohub-doigtes`, même famille de chemins que les formes du séquenceur) et pas dans la bibliothèque : un doigté n'appartient à aucun
// morceau. POURQUOI PAS synchro-cloud.js : ce moteur (partagé avec TabHub, à garder tel quel) ne sert qu'UN document par page, déjà pris par la bibliothèque ; ni compte-cloud.js.
// On réutilise seulement sa connexion (SYNCHRO.etat), comme synchro-formes.js et synchro-versions.js, et on écoute ce seul document.
//
// LA FUSION (pure), entrée par entrée : la plus récente (`at`) gagne ; un RETRAIT est tracé (`supprimes`, id → date) et l'emporte sur toute version plus ancienne : un appareil resté hors
// ligne ne ramène pas un doigté retiré ailleurs. Hors ligne d'abord : tout s'écrit ici, part au cloud dès la connexion. Les traces sont gardées six mois, comme celles des formes.
//
// FORMAT AU CLOUD : chaque entrée garde ses six cases en chaîne JSON (`json`), comme les formes (Firestore refuse les tableaux imbriqués ; ici le tableau est plat, mais un seul format
// pour tous les documents de l'appli évite deux lectures à maintenir).

var CLE_DOIGTES = 'harmohubMesDoigtes';                   // { entrees: { id: entrée }, supprimes: { id: date } }
var CLE_DOIGTES_A_ENVOYER = 'harmohubMesDoigtesAEnvoyer'; // '1' : une modification d'ici n'est pas encore au cloud
var SLUG_DOIGTES = 'harmohub-doigtes';
var DUREE_TRACE_DOIGTES_MS = 180 * 86400000;
// Au plus six doigtés mémorisés par accord : au-delà, le plus ancien s'efface (tracé, comme un retrait). Une popover n'a pas la place d'en montrer davantage, et six suffisent largement
// à qui n'a pas de raison d'en avoir plus (un par position qu'il joue vraiment).
var MAX_DOIGTES_PAR_ACCORD = 6;

var MesDoigtes = (function () {
    var abonnes = [];
    var ecoute = null, uidEcoute = null, minuteur = null, envoiEnCours = null;
    var derniereErreur = '';
    // La liste est relue à chaque calcul de diagramme (guitarFingeringsForChord, y compris à l'export du PDF) : on ne ré-analyse le JSON que s'il a changé.
    var cacheBrut = null, cacheEtat = null;

    function lireLocal() {
        var brut = null;
        try { brut = localStorage.getItem(CLE_DOIGTES); } catch (e) { brut = null; }
        if (cacheEtat && brut === cacheBrut) return cacheEtat;
        var v = null;
        try { v = JSON.parse(brut); } catch (e) { v = null; /* illisible : on repart de rien, le cloud le rendra */ }
        if (!v || typeof v !== 'object') v = {};
        cacheBrut = brut;
        cacheEtat = { entrees: (v.entrees && typeof v.entrees === 'object') ? v.entrees : {}, supprimes: (v.supprimes && typeof v.supprimes === 'object') ? v.supprimes : {} };
        return cacheEtat;
    }
    // Une copie qu'on peut modifier sans toucher à la mémoire partagée de lireLocal.
    function copieLocale() { return JSON.parse(JSON.stringify(lireLocal())); }
    function ecrireLocal(etat) {
        try { localStorage.setItem(CLE_DOIGTES, JSON.stringify(etat)); } catch (e) { console.error('Mes doigtés non enregistrés (stockage plein ?) :', e); }
        cacheBrut = null; cacheEtat = null;
    }
    function prevenir() { abonnes.forEach(function (f) { try { f(); } catch (e) { console.error('Rafraîchissement après un changement de doigté impossible :', e); } }); }

    // L'identité d'un accord pour ses doigtés : fondamentale, qualité, basse (« D/F# » n'a pas les doigtés de « D »). Le renversement et le drop ne comptent pas : ils s'écrivent dans la case.
    function cleAccord(root, quality, bass) { return String(root) + '|' + String(quality) + '|' + (bass ? String(bass) : ''); }
    function cleCases(cases) { return cases.map(function (c) { return c == null ? 'x' : c; }).join(','); }

    // Une entrée propre : un accord, six cases (null ou 0 à 24), au moins une corde jouée.
    function nettoyer(x) {
        if (!x || typeof x.root !== 'string' || !x.root || x.root.length > 4 || typeof x.quality !== 'string' || !x.quality || x.quality.length > 30) return null;
        var bass = (typeof x.bass === 'string' && x.bass.length <= 4) ? x.bass : '';
        if (!Array.isArray(x.cases) || x.cases.length !== 6) return null;
        var cases = x.cases.map(function (c) { if (c == null) return null; c = Number(c); return (Math.floor(c) === c && c >= 0 && c <= 24) ? c : NaN; });
        if (cases.some(function (c) { return c !== null && isNaN(c); }) || cases.every(function (c) { return c === null; })) return null;
        return { id: cleAccord(x.root, x.quality, bass) + '#' + cleCases(cases), root: x.root, quality: x.quality, bass: bass, cases: cases, at: Number(x.at) || 0, cree: Number(x.cree) || Number(x.at) || 0 };
    }

    // ---------- la fusion (PURE) ----------
    function fusionner(local, distant) {
        var L = local.entrees || {}, R = distant.entrees || {};
        var tombes = {};
        [local.supprimes, distant.supprimes].forEach(function (m) { Object.keys(m || {}).forEach(function (id) { tombes[id] = Math.max(tombes[id] || 0, Number(m[id]) || 0); }); });
        var ids = Object.keys(L); Object.keys(R).forEach(function (id) { if (!(id in L)) ids.push(id); });
        var sortie = {}, changeLocal = false, changeDistant = false;
        var meme = function (a, b) { return !!a && !!b && JSON.stringify(a) === JSON.stringify(b); };
        ids.forEach(function (id) {
            var l = L[id], r = R[id];
            // À date égale mais contenu différent, la chaîne la plus grande gagne : le choix est le même des deux côtés, ils convergent.
            var g = !l ? r : !r ? l : (r.at > l.at || (r.at === l.at && JSON.stringify(r) > JSON.stringify(l))) ? r : l;
            var ts = tombes[id];
            if (ts && ts >= g.at) { if (l) changeLocal = true; if (r) changeDistant = true; return; }
            if (ts) delete tombes[id];      // revenu : plus récent que son retrait
            sortie[id] = g;
            if (!meme(l, g)) changeLocal = true;
            if (!meme(r, g)) changeDistant = true;
        });
        var maintenant = Date.now();
        Object.keys(tombes).forEach(function (id) { if (maintenant - tombes[id] >= DUREE_TRACE_DOIGTES_MS) delete tombes[id]; });
        var sig = function (m) { return Object.keys(m || {}).sort().map(function (id) { return id + '=' + m[id]; }).join('|'); };
        if (sig(tombes) !== sig(local.supprimes)) changeLocal = true;
        if (sig(tombes) !== sig(distant.supprimes)) changeDistant = true;
        return { fusionne: { entrees: sortie, supprimes: tombes }, changeLocal: changeLocal, changeDistant: changeDistant };
    }

    function versDocument(etat) {
        return {
            app: 'HarmoHub-Doigtes', schema: 1, updatedAt: Date.now(),
            entrees: Object.keys(etat.entrees).sort().map(function (id) {
                var x = etat.entrees[id];
                return { id: id, root: x.root, quality: x.quality, bass: x.bass, at: x.at, cree: x.cree, json: JSON.stringify(x.cases) };
            }),
            supprimes: Object.keys(etat.supprimes).sort().map(function (id) { return { id: id, ts: Number(etat.supprimes[id]) || 0 }; }),
        };
    }
    function depuisDocument(doc) {
        var entrees = {}, supprimes = {};
        ((doc && doc.entrees) || []).forEach(function (e) {
            if (!e || typeof e.json !== 'string') return;
            var cases = null;
            try { cases = JSON.parse(e.json); } catch (err) { return; }   // une entrée illisible est ignorée, jamais une raison d'échouer
            var x = nettoyer({ root: e.root, quality: e.quality, bass: e.bass, cases: cases, at: e.at, cree: e.cree });
            if (x) entrees[x.id] = x;
        });
        ((doc && doc.supprimes) || []).forEach(function (t) { if (t && t.id) supprimes[t.id] = Number(t.ts) || 0; });
        return { entrees: entrees, supprimes: supprimes };
    }

    // ---------- connexion (celle du moteur de la page) ----------
    function connexion() {
        var s = (typeof SYNCHRO !== 'undefined') ? SYNCHRO : null;
        if (!s || !s.etat || !s.etat.utilisateur || !s.etat.db) return null;
        return { db: s.etat.db, uid: s.etat.utilisateur.uid };
    }
    function refDoc(c) { return c.db.collection('users').doc(c.uid).collection('apps').doc(SLUG_DOIGTES); }

    // Ce qui vient du cloud : fusionné avec ce qui est ici ; si le cloud manque de quelque chose d'ici, on le renvoie.
    function recevoir(donnees) {
        var r = fusionner(lireLocal(), depuisDocument(donnees));
        if (r.changeLocal) { ecrireLocal(r.fusionne); prevenir(); }
        if (r.changeDistant) planifierEnvoi();
    }

    function planifierEnvoi() {
        try { localStorage.setItem(CLE_DOIGTES_A_ENVOYER, '1'); } catch (e) { /* sans gravité : repartira au prochain changement */ }
        if (minuteur) clearTimeout(minuteur);
        minuteur = setTimeout(envoyer, 400);
    }

    function envoyer() {
        if (minuteur) { clearTimeout(minuteur); minuteur = null; }
        if (envoiEnCours) return envoiEnCours.then(function () { return envoyer(); });
        var c = connexion();
        var attend = false;
        try { attend = localStorage.getItem(CLE_DOIGTES_A_ENVOYER) === '1'; } catch (e) { attend = false; }
        if (!c || !attend) return Promise.resolve(false);
        var ref = refDoc(c), recu = null;
        envoiEnCours = c.db.runTransaction(function (tx) {
            return tx.get(ref).then(function (snap) {
                var distant = snap.exists ? snap.data() : null;
                var r = fusionner(lireLocal(), depuisDocument(distant));
                recu = r;
                if (distant && !r.changeDistant) return;
                tx.set(ref, versDocument(r.fusionne));
            });
        }).then(function () {
            try { localStorage.removeItem(CLE_DOIGTES_A_ENVOYER); } catch (e) { /* sans gravité */ }
            if (recu && recu.changeLocal) { ecrireLocal(recu.fusionne); prevenir(); }
            derniereErreur = '';
            return true;
        }).catch(function (e) {
            // Reste en attente : repartira au battement ci-dessous. Avertissement et non erreur : rien n'est perdu, tout est ici.
            derniereErreur = (e && (e.code || e.message)) || 'erreur inconnue';
            console.warn('Envoi de Mes doigtés impossible', e);
            return false;
        }).finally(function () { envoiEnCours = null; });
        return envoiEnCours;
    }

    // On suit la connexion du moteur de la page (pas d'accroche dans le moteur partagé) : un battement léger qui ne lit rien tant que le compte
    // ne change pas. À la connexion, on ÉCOUTE le document des doigtés (un seul) ; à la déconnexion, on arrête.
    function suivreConnexion() {
        var c = connexion();
        var uid = c ? c.uid : null;
        if (uid === uidEcoute) {
            var attend = false;
            try { attend = localStorage.getItem(CLE_DOIGTES_A_ENVOYER) === '1'; } catch (e) { attend = false; }
            if (c && attend && !envoiEnCours && !minuteur) envoyer();
            return;
        }
        if (ecoute) { try { ecoute(); } catch (e) { /* écoute déjà close */ } ecoute = null; }
        uidEcoute = uid;
        if (!c) return;
        // Un autre compte n'hérite pas des TRACES du précédent (ses doigtés à lui seraient effacés) ; les doigtés d'ici, eux, le rejoignent, comme les formes et les paroles.
        var precedent = null;
        try { precedent = localStorage.getItem(CLE_DOIGTES + 'Uid'); localStorage.setItem(CLE_DOIGTES + 'Uid', uid); } catch (e) { precedent = null; }
        if (precedent && precedent !== uid) { var e0 = copieLocale(); e0.supprimes = {}; ecrireLocal(e0); }
        try { localStorage.setItem(CLE_DOIGTES_A_ENVOYER, '1'); } catch (e) { /* sans gravité */ }
        try {
            ecoute = refDoc(c).onSnapshot(function (snap) {
                if (snap && snap.exists) recevoir(snap.data());
            }, function (e) { derniereErreur = (e && (e.code || e.message)) || 'erreur'; console.warn('Écoute de Mes doigtés interrompue', e); });
        } catch (e) { console.warn('Écoute de Mes doigtés impossible', e); }
        envoyer();
    }

    // ---------- ce que l'appli appelle ----------
    // Les doigtés d'un accord, le plus récemment utilisé d'abord. Chaque entrée : { id, root, quality, bass, cases, at, cree }.
    function mes(root, quality, bass) {
        var cle = cleAccord(root, quality, bass), e = lireLocal().entrees;
        return Object.keys(e).map(function (id) { return e[id]; })
            .filter(function (x) { return cleAccord(x.root, x.quality, x.bass) === cle; })
            .sort(function (a, b) { return b.at - a.at || (a.id < b.id ? -1 : 1); });
    }
    function tous() { var e = lireLocal().entrees; return Object.keys(e).map(function (id) { return e[id]; }); }
    function lire(id) { return lireLocal().entrees[id] || null; }
    // Retient un doigté pour un accord. Le même doigté ne se double pas : il remonte (sa date est renouvelée). Au-delà de MAX_DOIGTES_PAR_ACCORD, le plus ancien est retiré.
    function memoriser(root, quality, bass, cases) {
        var etat = copieLocale();
        var propre = nettoyer({ root: root, quality: quality, bass: bass, cases: cases, at: Date.now() });
        if (!propre) return null;
        var avant = etat.entrees[propre.id];
        propre.cree = avant ? avant.cree : propre.at;
        etat.entrees[propre.id] = propre;
        delete etat.supprimes[propre.id];
        var cle = cleAccord(propre.root, propre.quality, propre.bass);
        var memes = Object.keys(etat.entrees).map(function (id) { return etat.entrees[id]; })
            .filter(function (x) { return cleAccord(x.root, x.quality, x.bass) === cle; })
            .sort(function (a, b) { return b.at - a.at || (a.id < b.id ? -1 : 1); });
        memes.slice(MAX_DOIGTES_PAR_ACCORD).forEach(function (x) { delete etat.entrees[x.id]; etat.supprimes[x.id] = propre.at; });
        ecrireLocal(etat);
        planifierEnvoi();
        prevenir();
        return propre;
    }
    function retirer(id) {
        var etat = copieLocale();
        if (!etat.entrees[id]) return false;
        delete etat.entrees[id];
        etat.supprimes[id] = Date.now();
        ecrireLocal(etat);
        planifierEnvoi();
        prevenir();
        return true;
    }

    // Un autre onglet du même appareil a changé les doigtés : on suit.
    window.addEventListener('storage', function (e) { if (e.key === CLE_DOIGTES) { cacheBrut = null; cacheEtat = null; prevenir(); } });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && minuteur) envoyer(); });
    setInterval(suivreConnexion, 1000);
    setTimeout(suivreConnexion, 0);

    return {
        mes: mes, tous: tous, lire: lire, memoriser: memoriser, retirer: retirer,
        surChangement: function (f) { abonnes.push(f); },
        envoyer: envoyer, connecte: function () { return !!connexion(); }, derniereErreur: function () { return derniereErreur; },
        // Pour les bancs (fonctions pures).
        _fusionner: fusionner, _versDocument: versDocument, _depuisDocument: depuisDocument,
    };
})();
if (typeof window !== 'undefined') window.MesDoigtes = MesDoigtes;
