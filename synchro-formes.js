// LES FORMES DU SÉQUENCEUR, AU CLOUD (refonte du séquenceur, point D, deuxième sous-lot — cahier `docs/refonte-sequenceur.md`, section 4, point 1).
//
// Demande de l'utilisateur (11/11) : les formes enregistrées « vivent sur le compte » — tous les morceaux et tous les appareils —, « comme les
// morceaux et les paroles dans Firestore ». Une forme supprimée disparaît partout ; les accords qui la suivaient passent « À la main » (sequenceur.js
// le lit tout seul : un accord dont la forme n'existe plus ne suit plus rien).
//
// CE QUI EST GARDÉ, une ENTRÉE par identifiant :
//   • les FORMES de l'utilisateur (type 'forme', id « f-… ») : nom, et pour chacune des quatre positions (basse, voix 2, voix 3, aiguë) ses croches,
//     ses soudures (une note tenue) et ses intensités, sur une mesure de huit croches ;
//   • les RETOUCHES d'un motif fourni (type 'retouche', id du motif : 'plaque', 'monte'…) : « les retouches se posent PAR-DESSUS, l'original n'est
//     jamais perdu » (cahier, « Modifier un schéma ») — « Rétablir l'original » supprime la retouche.
//
// POURQUOI UN DOCUMENT À PART (`users/{uid}/apps/harmohub-formes`, chemin déjà couvert par les règles du projet) et pas dans la bibliothèque : une
// forme n'appartient à aucun morceau. POURQUOI PAS synchro-cloud.js : ce moteur (partagé avec TabHub, à garder tel quel) ne sert qu'UN document par
// page, déjà pris par la bibliothèque. On réutilise seulement sa connexion (SYNCHRO.etat), comme synchro-versions.js, et on écoute ce seul document.
//
// LA FUSION (pure), entrée par entrée : la plus récente (`at`) gagne ; une SUPPRESSION est tracée (`supprimes`, id → date) et l'emporte sur toute
// version plus ancienne qu'elle — un appareil resté hors ligne ne ramène pas une forme supprimée ailleurs. Hors ligne d'abord : tout s'écrit ici,
// part au cloud dès la connexion. Les traces sont gardées six mois, comme celles des morceaux.
//
// FORMAT AU CLOUD : chaque entrée garde son dessin en CHAÎNE JSON (`json`) — Firestore refuse les tableaux imbriqués, et une forme en est faite.

var CLE_FORMES = 'harmohubFormes';                  // { entrees: { id: entrée }, supprimes: { id: date } }
var CLE_FORMES_A_ENVOYER = 'harmohubFormesAEnvoyer'; // '1' : une modification d'ici n'est pas encore au cloud
var SLUG_FORMES = 'harmohub-formes';
var DUREE_TRACE_FORMES_MS = 180 * 86400000;

var FormesSequenceur = (function () {
    var abonnes = [];
    var ecoute = null, uidEcoute = null, minuteur = null, envoiEnCours = null;
    var derniereErreur = '';

    function lireLocal() {
        var v = null;
        try { v = JSON.parse(localStorage.getItem(CLE_FORMES)); } catch (e) { v = null; /* illisible : on repart de rien, le cloud la rendra */ }
        if (!v || typeof v !== 'object') v = {};
        return { entrees: (v.entrees && typeof v.entrees === 'object') ? v.entrees : {}, supprimes: (v.supprimes && typeof v.supprimes === 'object') ? v.supprimes : {} };
    }
    function ecrireLocal(etat) {
        try { localStorage.setItem(CLE_FORMES, JSON.stringify(etat)); } catch (e) { console.error('Formes du séquenceur non enregistrées (stockage plein ?) :', e); }
    }
    function prevenir() { abonnes.forEach(function (f) { try { f(); } catch (e) { console.error('Rafraîchissement après un changement de forme impossible :', e); } }); }

    // Une entrée propre : quatre positions, croches de 0 à 7 sans doublon, niveaux « fort » / « doux » seulement.
    function nettoyer(x) {
        if (!x || typeof x.id !== 'string' || !x.id) return null;
        var pos = function (l) { var r = []; (Array.isArray(l) ? l : []).forEach(function (k) { k = Number(k); if (k >= 0 && k < 8 && Math.floor(k) === k && r.indexOf(k) < 0) r.push(k); }); return r.sort(function (a, b) { return a - b; }); };
        var niv = function (o) { var r = {}; Object.keys(o || {}).forEach(function (k) { if (o[k] === 'fort' || o[k] === 'doux') r[k] = o[k]; }); return r; };
        var v = [0, 1, 2, 3].map(function (p) { return pos((x.v || [])[p]); });
        var s = [0, 1, 2, 3].map(function (p) { return pos((x.s || [])[p]).filter(function (k) { return v[p].indexOf(k) >= 0 && v[p].indexOf(k === 0 ? 7 : k - 1) >= 0; }); }); // 0 : tenue depuis la croche 7 de la mesure d'avant
        var n = [0, 1, 2, 3].map(function (p) { return niv((x.n || [])[p]); });
        return { id: x.id, type: x.type === 'retouche' ? 'retouche' : 'forme', nom: String(x.nom || '').slice(0, 40), v: v, s: s, n: n, at: Number(x.at) || 0, cree: Number(x.cree) || Number(x.at) || 0 };
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
            if (ts) delete tombes[id];      // revenue : plus récente que sa suppression
            sortie[id] = g;
            if (!meme(l, g)) changeLocal = true;
            if (!meme(r, g)) changeDistant = true;
        });
        var maintenant = Date.now();
        Object.keys(tombes).forEach(function (id) { if (maintenant - tombes[id] >= DUREE_TRACE_FORMES_MS) delete tombes[id]; });
        var sig = function (m) { return Object.keys(m || {}).sort().map(function (id) { return id + '=' + m[id]; }).join('|'); };
        if (sig(tombes) !== sig(local.supprimes)) changeLocal = true;
        if (sig(tombes) !== sig(distant.supprimes)) changeDistant = true;
        return { fusionne: { entrees: sortie, supprimes: tombes }, changeLocal: changeLocal, changeDistant: changeDistant };
    }

    function versDocument(etat) {
        return {
            app: 'HarmoHub-Formes', schema: 1, updatedAt: Date.now(),
            entrees: Object.keys(etat.entrees).sort().map(function (id) {
                var x = etat.entrees[id];
                return { id: id, type: x.type, nom: x.nom, at: x.at, cree: x.cree, json: JSON.stringify({ v: x.v, s: x.s, n: x.n }) };
            }),
            supprimes: Object.keys(etat.supprimes).sort().map(function (id) { return { id: id, ts: Number(etat.supprimes[id]) || 0 }; }),
        };
    }
    function depuisDocument(doc) {
        var entrees = {}, supprimes = {};
        ((doc && doc.entrees) || []).forEach(function (e) {
            if (!e || typeof e.json !== 'string') return;
            var dessin = null;
            try { dessin = JSON.parse(e.json); } catch (err) { return; }   // une entrée illisible est ignorée, jamais une raison d'échouer
            var x = nettoyer({ id: e.id, type: e.type, nom: e.nom, at: e.at, cree: e.cree, v: dessin.v, s: dessin.s, n: dessin.n });
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
    function refDoc(c) { return c.db.collection('users').doc(c.uid).collection('apps').doc(SLUG_FORMES); }

    // Ce qui vient du cloud : fusionné avec ce qui est ici ; si le cloud manque de quelque chose d'ici, on le renvoie.
    function recevoir(donnees) {
        var r = fusionner(lireLocal(), depuisDocument(donnees));
        if (r.changeLocal) { ecrireLocal(r.fusionne); prevenir(); }
        if (r.changeDistant) planifierEnvoi();
    }

    function planifierEnvoi() {
        try { localStorage.setItem(CLE_FORMES_A_ENVOYER, '1'); } catch (e) { /* sans gravité : repartira au prochain changement */ }
        if (minuteur) clearTimeout(minuteur);
        minuteur = setTimeout(envoyer, 400);
    }

    function envoyer() {
        if (minuteur) { clearTimeout(minuteur); minuteur = null; }
        if (envoiEnCours) return envoiEnCours.then(function () { return envoyer(); });
        var c = connexion();
        var attend = false;
        try { attend = localStorage.getItem(CLE_FORMES_A_ENVOYER) === '1'; } catch (e) { attend = false; }
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
            try { localStorage.removeItem(CLE_FORMES_A_ENVOYER); } catch (e) { /* sans gravité */ }
            if (recu && recu.changeLocal) { ecrireLocal(recu.fusionne); prevenir(); }
            derniereErreur = '';
            return true;
        }).catch(function (e) {
            // Reste en attente : repartira au battement ci-dessous. Avertissement et non erreur : rien n'est perdu, tout est ici.
            derniereErreur = (e && (e.code || e.message)) || 'erreur inconnue';
            console.warn('Envoi des formes du séquenceur impossible', e);
            return false;
        }).finally(function () { envoiEnCours = null; });
        return envoiEnCours;
    }

    // On suit la connexion du moteur de la page (pas d'accroche dans le moteur partagé) : un battement léger qui ne lit rien tant que le compte
    // ne change pas. À la connexion, on ÉCOUTE le document des formes (un seul) ; à la déconnexion, on arrête.
    function suivreConnexion() {
        var c = connexion();
        var uid = c ? c.uid : null;
        if (uid === uidEcoute) {
            var attend = false;
            try { attend = localStorage.getItem(CLE_FORMES_A_ENVOYER) === '1'; } catch (e) { attend = false; }
            if (c && attend && !envoiEnCours && !minuteur) envoyer();
            return;
        }
        if (ecoute) { try { ecoute(); } catch (e) { /* écoute déjà close */ } ecoute = null; }
        uidEcoute = uid;
        if (!c) return;
        // Un autre compte n'hérite pas des TRACES du précédent (ses formes à lui seraient effacées) ; les formes d'ici, elles, le rejoignent,
        // comme les paroles.
        var precedent = null;
        try { precedent = localStorage.getItem(CLE_FORMES + 'Uid'); localStorage.setItem(CLE_FORMES + 'Uid', uid); } catch (e) { precedent = null; }
        if (precedent && precedent !== uid) { var e0 = lireLocal(); e0.supprimes = {}; ecrireLocal(e0); }
        try { localStorage.setItem(CLE_FORMES_A_ENVOYER, '1'); } catch (e) { /* sans gravité */ }
        try {
            ecoute = refDoc(c).onSnapshot(function (snap) {
                if (snap && snap.exists) recevoir(snap.data());
            }, function (e) { derniereErreur = (e && (e.code || e.message)) || 'erreur'; console.warn('Écoute des formes du séquenceur interrompue', e); });
        } catch (e) { console.warn('Écoute des formes du séquenceur impossible', e); }
        envoyer();
    }

    // ---------- ce que le séquenceur appelle ----------
    function formes() {
        var e = lireLocal().entrees;
        return Object.keys(e).map(function (id) { return e[id]; }).filter(function (x) { return x.type === 'forme'; })
            .sort(function (a, b) { return a.cree - b.cree || (a.id < b.id ? -1 : 1); });
    }
    function retouche(id) { var x = lireLocal().entrees[id]; return x && x.type === 'retouche' ? x : null; }
    function lire(id) { return lireLocal().entrees[id] || null; }
    function enregistrer(x) {
        var etat = lireLocal();
        var avant = etat.entrees[x.id];
        var propre = nettoyer(Object.assign({}, x, { at: Date.now(), cree: avant ? avant.cree : Date.now() }));
        if (!propre) return null;
        etat.entrees[propre.id] = propre;
        delete etat.supprimes[propre.id];
        ecrireLocal(etat);
        planifierEnvoi();
        prevenir();
        return propre;
    }
    function supprimer(id) {
        var etat = lireLocal();
        if (!etat.entrees[id]) return false;
        delete etat.entrees[id];
        etat.supprimes[id] = Date.now();
        ecrireLocal(etat);
        planifierEnvoi();
        prevenir();
        return true;
    }
    function nouvelId() { return 'f-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

    // Un autre onglet du même appareil a changé les formes : on suit.
    window.addEventListener('storage', function (e) { if (e.key === CLE_FORMES) prevenir(); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && minuteur) envoyer(); });
    setInterval(suivreConnexion, 1000);
    setTimeout(suivreConnexion, 0);

    return {
        formes: formes, retouche: retouche, lire: lire, enregistrer: enregistrer, supprimer: supprimer, nouvelId: nouvelId,
        surChangement: function (f) { abonnes.push(f); },
        envoyer: envoyer, connecte: function () { return !!connexion(); }, derniereErreur: function () { return derniereErreur; },
        // Pour les bancs (fonctions pures).
        _fusionner: fusionner, _versDocument: versDocument, _depuisDocument: depuisDocument,
    };
})();
if (typeof window !== 'undefined') window.FormesSequenceur = FormesSequenceur;
