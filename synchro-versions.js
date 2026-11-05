// SYNCHRO DES VERSIONS — les versions des morceaux et de leurs paroles, au cloud (sous-lot « Versions au cloud », 05/11).
//
// Demande de l'utilisateur : « toutes les versions stockées dans le firestore », celles des MORCEAUX et des PAROLES, donc retrouvées sur
// tous les appareils ; « s'il y a un problème de place, il faut garder moins de versions que prévu […] le minimum acceptable (environ 3 à 5
// versions) ». Et la page Paroles ouverte seule doit aussi les lister et les restaurer (« oui on restaure »).
//
// POURQUOI UN DOCUMENT PAR MORCEAU, et non les versions dans le document de la bibliothèque : Firestore plafonne un document à 1 Mio, et la
// bibliothèque entière y tient déjà. Des versions de tous les morceaux n'y entreraient pas. Ici, chaque morceau a SON document
// (`users/{uid}/apps/harmohub-versions-{songId}`, chemin déjà couvert par les règles du projet : rien à changer dans la console), qui garde
// les 5 versions les plus récentes du morceau et les 5 de ses paroles. Un morceau très lourd en garde moins (jusqu'à une de chaque) : on
// préfère garder peu que ne rien garder. Un petit INDEX (`harmohub-versions`) dit quels morceaux ont des versions au cloud et de quand date la
// dernière : un appareil n'ouvre ainsi que les documents qui ont du neuf, et retrouve aussi les versions d'un morceau supprimé ailleurs.
//
// POURQUOI CE FICHIER NE PASSE PAS PAR synchro-cloud.js : ce moteur (partagé avec TabHub, à garder tel quel) synchronise UN document par
// instance et l'écoute en continu. Écouter un document par morceau coûterait une écoute par morceau de la bibliothèque. Les versions n'ont
// pas besoin du temps réel : elles partent quand on en garde une, et on va chercher celles des autres appareils quand on ouvre la liste
// (Paramètres › Historique, ou les Options de la page Paroles). On réutilise seulement la connexion du moteur de la page (SYNCHRO.etat).
//
// CE QUI NE CHANGE PAS : historique.js reste la copie de l'appareil (40 versions par morceau). Restaurer remet une version dans le brouillon
// d'ICI, rien ne se défait tout seul ailleurs. Une version ne part au cloud que si l'on est connecté ; prise hors ligne ou déconnecté, elle
// est notée et part à la connexion suivante.
//
// FORMAT D'UNE VERSION AU CLOUD : les champs de historique.js, `charge` et `resume` en CHAÎNES JSON (Firestore refuse les tableaux imbriqués,
// et une grille en contient : rien ne garantit qu'il n'y en ait jamais). Une chaîne ne peut pas échouer.

var VERSIONS_CLOUD_MAX = 5;                    // par morceau, et autant pour ses paroles
var VERSIONS_CLOUD_TAILLE_MAX = 900 * 1024;    // sous le plafond de 1 048 576 octets, avec de la marge pour les en-têtes du document
var VERSIONS_CLOUD_DELAI_MS = 3000;            // regroupe les versions prises d'affilée (opération lourde + enregistrement)
var VERSIONS_CLOUD_RELECTURE_MS = 30000;       // un même document n'est pas relu plus souvent (le panneau se redessine souvent)
var CLE_VERSIONS_A_ENVOYER = 'harmohub_versions_a_envoyer';   // { songId: uid au moment de la version, ou '' si personne n'était connecté }
var SLUG_VERSIONS = 'harmohub-versions';

var VersionsCloud = (function () {
    var minuteur = null, envoiEnCours = null;
    var dernieresLectures = {};   // clé de document -> date de la dernière lecture
    var derniereErreur = '';

    function lireJson(cle, repli) {
        try { var v = JSON.parse(localStorage.getItem(cle)); return (v && typeof v === 'object') ? v : repli; } catch (e) { return repli; }
    }
    function connexion() {
        var s = (typeof SYNCHRO !== 'undefined') ? SYNCHRO : null;
        if (!s || !s.etat || !s.etat.utilisateur || !s.etat.db) return null;
        return { db: s.etat.db, uid: s.etat.utilisateur.uid };
    }
    function refDoc(c, nom) { return c.db.collection('users').doc(c.uid).collection('apps').doc(nom); }
    function nomDoc(songId) { return SLUG_VERSIONS + '-' + songId; }
    function poids(o) { try { return new Blob([JSON.stringify(o)]).size; } catch (e) { return 0; } }
    function historiques() {
        return {
            morceau: (typeof HistoriqueVersions !== 'undefined') ? HistoriqueVersions : null,
            paroles: (typeof HistoriqueParoles !== 'undefined') ? HistoriqueParoles : null,
        };
    }

    // ---------- passage version <-> document ----------
    function versCloud(v) {
        return {
            id: String(v.id), songId: String(v.songId || ''), songName: String(v.songName || ''), date: Number(v.date) || 0,
            motif: String(v.motif || 'auto'), libelle: String(v.libelle || ''), empreinte: String(v.empreinte || ''), appareil: String(v.appareil || ''),
            resume: JSON.stringify(v.resume || {}), charge: JSON.stringify(v.charge || {}),
        };
    }
    function depuisCloud(e) {
        if (!e || typeof e.id !== 'string' || typeof e.charge !== 'string') return null;
        try {
            return {
                id: e.id, songId: String(e.songId || ''), songName: String(e.songName || ''), date: Number(e.date) || 0, motif: e.motif || 'auto',
                libelle: e.libelle || '', empreinte: e.empreinte || '', appareil: e.appareil || '', charge: JSON.parse(e.charge),
            };
        } catch (err) { return null; }   // une version illisible est ignorée, jamais une raison d'échouer
    }

    // ---------- la fusion (PURE) ----------
    // Union des versions d'ici et du cloud, sans doublon (même id, ou même contenu : on garde la plus récente), de la plus récente à la plus
    // ancienne, coupée à `max`. Les entrées sont au format du cloud (chaînes).
    function fusionner(locales, distantes, max) {
        var parId = {}, parEmpreinte = {};
        locales.concat(distantes).forEach(function (v) {
            if (!v || !v.id) return;
            if (parId[v.id]) return;
            var autre = v.empreinte ? parEmpreinte[v.empreinte] : null;
            if (autre) {
                if (autre.date >= v.date) return;
                delete parId[autre.id];
            }
            parId[v.id] = v;
            if (v.empreinte) parEmpreinte[v.empreinte] = v;
        });
        return Object.keys(parId).map(function (k) { return parId[k]; })
            .sort(function (a, b) { return b.date - a.date || (a.id < b.id ? 1 : -1); }).slice(0, max);
    }

    // Le document d'un morceau : 5 + 5 au plus ; s'il dépasse la taille permise, on retire la plus ancienne de la liste la plus longue, jusqu'à
    // une de chaque. Une seule version trop lourde pour le cloud n'y va pas (elle reste ici). Rend { doc, retirees }.
    function composer(songId, morceau, paroles) {
        var m = morceau.slice(), p = paroles.slice(), retirees = 0;
        var faire = function () { return { app: 'HarmoHub-Versions', schema: 1, songId: songId, updatedAt: Date.now(), morceau: m, paroles: p }; };
        var doc = faire();
        while (poids(doc) > VERSIONS_CLOUD_TAILLE_MAX && (m.length > 1 || p.length > 1)) {
            if (m.length >= p.length && m.length > 1) m.pop(); else p.pop();
            retirees++;
            doc = faire();
        }
        while (poids(doc) > VERSIONS_CLOUD_TAILLE_MAX && (m.length || p.length)) {
            if (poids({ v: m[0] }) >= poids({ v: p[0] })) m.shift(); else p.shift();
            retirees++;
            doc = faire();
        }
        return { doc: doc, retirees: retirees };
    }
    function memesListes(a, b) {
        var ids = function (l) { return (l || []).map(function (v) { return v.id + '@' + v.date; }).join('|'); };
        return ids(a) === ids(b);
    }

    // ---------- verser au local ce qui vient du cloud ----------
    async function importer(docDonnees) {
        var h = historiques(), n = 0;
        if (!docDonnees) return 0;
        var m = (docDonnees.morceau || []).map(depuisCloud).filter(Boolean);
        var p = (docDonnees.paroles || []).map(depuisCloud).filter(Boolean);
        if (h.morceau && m.length) n += await h.morceau.importer(m);
        if (h.paroles && p.length) n += await h.paroles.importer(p);
        return n;
    }

    // ---------- synchroniser un morceau : lire le cloud, verser ici ce qui manque, écrire l'union ----------
    async function synchroniserMorceau(c, songId) {
        var h = historiques();
        var locM = h.morceau ? (await h.morceau.lister(songId)).slice(0, VERSIONS_CLOUD_MAX).map(versCloud) : [];
        var locP = h.paroles ? (await h.paroles.lister(songId)).slice(0, VERSIONS_CLOUD_MAX).map(versCloud) : [];
        var ref = refDoc(c, nomDoc(songId)), refIndex = refDoc(c, SLUG_VERSIONS);
        var recu = null, retirees = 0;
        await c.db.runTransaction(function (tx) {
            return Promise.all([tx.get(ref), tx.get(refIndex)]).then(function (snaps) {
                var distant = snaps[0].exists ? snaps[0].data() : null;
                var index = snaps[1].exists ? snaps[1].data() : null;
                recu = distant;
                var m = fusionner(locM, (distant && distant.morceau) || [], VERSIONS_CLOUD_MAX);
                var p = fusionner(locP, (distant && distant.paroles) || [], VERSIONS_CLOUD_MAX);
                var compo = composer(songId, m, p);
                retirees = compo.retirees;
                if (distant && memesListes(distant.morceau, compo.doc.morceau) && memesListes(distant.paroles, compo.doc.paroles)) return; // rien de neuf
                tx.set(ref, compo.doc);
                // L'index : une ligne par morceau qui a des versions au cloud.
                var toutes = compo.doc.morceau.concat(compo.doc.paroles);
                var lignes = ((index && index.morceaux) || []).filter(function (l) { return l && l.songId && l.songId !== songId; });
                if (toutes.length) {
                    var derniere = toutes.reduce(function (x, v) { return v.date > x.date ? v : x; }, toutes[0]);
                    lignes.push({ songId: songId, songName: derniere.songName || '', derniere: derniere.date, n: toutes.length });
                }
                tx.set(refIndex, { app: 'HarmoHub-Versions', schema: 1, updatedAt: Date.now(), morceaux: lignes });
            });
        });
        dernieresLectures[nomDoc(songId)] = Date.now();
        var importees = await importer(recu);
        return { importees: importees, retirees: retirees };
    }

    // ---------- les versions en attente d'envoi ----------
    function noter(songId) {
        if (!songId) return;   // un tampon jamais nommé n'a pas de document à lui
        var c = connexion();
        var attente = lireJson(CLE_VERSIONS_A_ENVOYER, {});
        if (!(songId in attente)) attente[songId] = c ? c.uid : '';
        try { localStorage.setItem(CLE_VERSIONS_A_ENVOYER, JSON.stringify(attente)); } catch (e) { /* sans gravité : partira à la prochaine version */ }
        if (minuteur) clearTimeout(minuteur);
        minuteur = setTimeout(envoyer, VERSIONS_CLOUD_DELAI_MS);
    }

    // Envoie tout ce qui attend. Une version notée sous un AUTRE compte que celui connecté n'est pas envoyée à celui-ci (elle attend le sien) ;
    // notée sans compte, elle part au premier compte qui se connecte — comme la bibliothèque à sa première synchro.
    function envoyer() {
        if (minuteur) { clearTimeout(minuteur); minuteur = null; }
        if (envoiEnCours) return envoiEnCours.then(function () { return envoyer(); });
        var c = connexion();
        var attente = lireJson(CLE_VERSIONS_A_ENVOYER, {});
        var ids = Object.keys(attente).filter(function (id) { return !attente[id] || (c && attente[id] === c.uid); });
        if (!c || !ids.length) return Promise.resolve({ envoyes: 0 });
        envoiEnCours = (async function () {
            var envoyes = 0;
            for (var i = 0; i < ids.length; i++) {
                try {
                    await synchroniserMorceau(c, ids[i]);
                    var a = lireJson(CLE_VERSIONS_A_ENVOYER, {});
                    delete a[ids[i]];
                    try { localStorage.setItem(CLE_VERSIONS_A_ENVOYER, JSON.stringify(a)); } catch (e) { /* sans gravité */ }
                    envoyes++;
                    derniereErreur = '';
                } catch (e) {
                    // Reste en attente : repartira à la prochaine version, à la prochaine ouverture de la liste, ou au battement ci-dessous.
                    derniereErreur = (e && (e.code || e.message)) || 'erreur inconnue';
                    // Avertissement et non erreur : rien n'est perdu (la version est ici, elle reste en attente et repartira).
                    console.warn('Envoi des versions impossible', e);
                }
            }
            return { envoyes: envoyes };
        })().finally(function () { envoiEnCours = null; });
        return envoiEnCours;
    }

    // ---------- aller chercher les versions des autres appareils ----------
    // `songId` : le morceau qu'on regarde (toujours relu, au plus toutes les 30 s). L'index dit lesquels des autres ont du neuf : seuls
    // ceux-là sont ouverts. Rend { importees } — le panneau se redessine s'il y en a. Ne lève jamais.
    async function rafraichir(songId, options) {
        options = options || {};
        var c = connexion();
        if (!c) return { importees: 0, hors: true };
        var maintenant = Date.now();
        try {
            await envoyer();   // ce qui attend part d'abord : la liste qu'on va relire l'inclut
            var importees = 0, aLire = {};
            if (songId) aLire[songId] = true;
            if (options.force || maintenant - (dernieresLectures[SLUG_VERSIONS] || 0) >= VERSIONS_CLOUD_RELECTURE_MS) {
                dernieresLectures[SLUG_VERSIONS] = maintenant;
                var snapIndex = await refDoc(c, SLUG_VERSIONS).get();
                var lignes = (snapIndex.exists && snapIndex.data().morceaux) || [];
                var h = historiques();
                for (var i = 0; i < lignes.length; i++) {
                    var l = lignes[i];
                    if (!l || !l.songId || aLire[l.songId]) continue;
                    var plusRecente = 0;
                    if (h.morceau) (await h.morceau.lister(l.songId)).slice(0, 1).forEach(function (v) { plusRecente = Math.max(plusRecente, v.date); });
                    if (h.paroles) (await h.paroles.lister(l.songId)).slice(0, 1).forEach(function (v) { plusRecente = Math.max(plusRecente, v.date); });
                    if (Number(l.derniere) > plusRecente) aLire[l.songId] = true;
                }
            }
            var ids = Object.keys(aLire);
            for (var j = 0; j < ids.length; j++) {
                var nom = nomDoc(ids[j]);
                if (!options.force && maintenant - (dernieresLectures[nom] || 0) < VERSIONS_CLOUD_RELECTURE_MS) continue;
                dernieresLectures[nom] = maintenant;
                var snap = await refDoc(c, nom).get();
                if (snap.exists) importees += await importer(snap.data());
            }
            derniereErreur = '';
            return { importees: importees };
        } catch (e) {
            derniereErreur = (e && (e.code || e.message)) || 'erreur inconnue';
            console.warn('Lecture des versions du cloud impossible', e);   // la liste d'ici reste affichée : pas une panne
            return { importees: 0, erreur: derniereErreur };
        }
    }

    // ---------- branchement ----------
    (function () {
        var h = historiques();
        if (h.morceau && h.morceau.surAjout) h.morceau.surAjout(function (x) { noter(x.songId); });
        if (h.paroles && h.paroles.surAjout) h.paroles.surAjout(function (x) { noter(x.songId); });
        // Quitter la page (onglet masqué, appli basculée sur téléphone) : dernier moment sûr pour envoyer ce qui attend.
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && minuteur) envoyer(); });
        // Une version prise hors ligne ou déconnecté part à la connexion : pas d'accroche dans le moteur partagé, donc un battement léger,
        // qui ne fait rien (pas une lecture) tant que rien n'attend.
        setInterval(function () {
            var attente = lireJson(CLE_VERSIONS_A_ENVOYER, {});
            if (Object.keys(attente).length && connexion() && !envoiEnCours) envoyer();
        }, 20000);
    })();

    return {
        noter: noter, envoyer: envoyer, rafraichir: rafraichir,
        connecte: function () { return !!connexion(); },
        derniereErreur: function () { return derniereErreur; },
        // Pour les bancs (fonctions pures).
        _fusionner: fusionner, _composer: composer,
        limites: { MAX: VERSIONS_CLOUD_MAX, TAILLE_MAX: VERSIONS_CLOUD_TAILLE_MAX },
    };
})();
if (typeof window !== 'undefined') window.VersionsCloud = VersionsCloud;
