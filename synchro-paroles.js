// SYNCHRO PAROLES — l'ADAPTATEUR des paroles, branché sur la couche générique synchro-cloud.js.
//
// Retour utilisateur : « je veux que tout soit stocké en ligne pour retrouver mes données en changeant d'ordinateur. »
// Les paroles (le texte de chaque partie + les accords posés dessus) n'étaient QUE dans le navigateur : une clé
// `harmohub_lyrics_v1_id-<morceau>` par morceau (voir paroles.js). Changer d'ordinateur, vider le navigateur, ou la purge de
// Safari après sept jours sans visite, et elles disparaissaient — alors que les morceaux, eux, étaient déjà au cloud.
//
// POURQUOI UN DOCUMENT À PART ET UN MOTEUR DANS CETTE PAGE (et non les paroles dans le document de la bibliothèque).
//   • La page Paroles est un document HTML à part : si ses modifications n'étaient envoyées que par la page principale, des
//     paroles tapées puis la fenêtre fermée n'atteindraient le cloud qu'à la prochaine ouverture de HarmoHub — c'est-à-dire,
//     pour qui change d'ordinateur le soir même, jamais à temps. Ici, la page envoie ELLE-MÊME, comme la page principale.
//   • Le moteur synchro-cloud.js est générique (une instance par page) et ne connaît pas les données : cette page en a donc
//     une à elle, avec son adaptateur, sur le document `users/{uid}/apps/harmohub-paroles`. Les règles Firestore du projet
//     (`users/{uid}/apps/{appId}`) l'autorisent déjà : rien à changer dans la console. Et la limite de 1 Mio d'un document
//     s'applique séparément à la bibliothèque et aux paroles.
//
// CE QUI EST SYNCHRONISÉ : les SESSIONS de paroles, une par morceau. PAS le dernier morceau ouvert ici (`harmohub_lyrics_last_song`,
// copie de la structure du morceau, qui vient de HarmoHub) ni les préférences d'affichage de cette page (taille du texte,
// enchaînement) : états PAR APPAREIL, dépendants de la taille d'écran.
//
// LA FUSION, session par session : la plus récente (`savedAt`) gagne. Quand la version d'ICI est remplacée alors qu'elle avait
// été modifiée depuis la dernière synchro — ou quand c'est celle de l'autre appareil qui perd —, la perdante est RANGÉE (une par
// morceau, sur cet appareil) et un bandeau propose de la restaurer. On perd au pire un peu de confort, jamais du texte.
// À date égale mais contenu différent, la chaîne la plus grande gagne : le choix est le même sur les deux appareils, donc ils
// convergent au lieu de s'échanger indéfiniment leurs versions.
//
// POURQUOI CHAQUE SESSION EST UNE CHAÎNE JSON : Firestore refuse les tableaux imbriqués et les `undefined`, et les accords posés
// (`placements`) sont des tableaux d'objets que rien ne garantit de rester ainsi. Une chaîne ne peut pas échouer.

var PREFIXE_PAROLES = 'harmohub_lyrics_v1_';
var CLE_PAROLES_BASE = 'harmohub_lyrics_sync_base';        // { cle: savedAt à la dernière synchro de CET appareil }
var CLE_PAROLES_UID = 'harmohub_lyrics_sync_uid';
var PREFIXE_PAROLES_RANGEE = 'harmohub_lyrics_rangee_';     // la version perdante, une par session (volontairement HORS du préfixe ci-dessus)

function lireJsonParoles(cle, repli) {
    try { var v = JSON.parse(localStorage.getItem(cle)); return (v === null || v === undefined) ? repli : v; }
    catch (e) { return repli; }
}

// ---------- état local : les sessions enregistrées dans ce navigateur ----------
function lireSessionsParoles() {
    var sessions = {};
    for (var i = 0; i < localStorage.length; i++) {
        var cle = localStorage.key(i);
        if (!cle || cle.indexOf(PREFIXE_PAROLES) !== 0) continue;
        var brut = localStorage.getItem(cle);
        var payload = null;
        try { payload = JSON.parse(brut); } catch (e) { continue; }   // session illisible : paroles.js la signale, on ne l'envoie pas
        if (!payload || !Array.isArray(payload.sections)) continue;
        var id = cle.slice(PREFIXE_PAROLES.length);
        sessions[id] = { cle: id, nom: String(payload.songName || ''), at: Number(payload.savedAt) || 0, json: brut };
    }
    return sessions;
}

// Une session « a du contenu » quand elle porte du texte ou des accords posés. Une session vide (page ouverte, rien tapé, ou
// « effacer la partie ») ne vaut pas la peine d'être rangée quand elle est remplacée.
function sessionAContenu(s) {
    try {
        var p = JSON.parse(s.json);
        return p.sections.some(function (sec) {
            var texte = String(sec.lyricsHtml || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
            return !!texte || (sec.placements && sec.placements.length > 0);
        });
    } catch (e) { return false; }
}

// ---------- la fusion (PURE : aucune lecture ni écriture de stockage) ----------
// local / distant = { sessions: { cle: { cle, nom, at, json } } } ; base = { cle: at } tel qu'à la dernière synchro.
// Rend { fusionne, changeLocal, changeDistant, rangees: [{ session, de }] } — `rangees` : les versions perdantes à garder.
function fusionnerParoles(local, distant, base) {
    base = base || {};
    var L = local.sessions || {}, R = distant.sessions || {};
    var cles = Object.keys(L);
    Object.keys(R).forEach(function (c) { if (!(c in L)) cles.push(c); });

    var sortie = {}, rangees = [], changeLocal = false, changeDistant = false;
    cles.forEach(function (c) {
        var l = L[c], r = R[c], gagnant = l;
        if (l && r && l.json !== r.json) {
            // ÉDITION CONCURRENTE : ni l'une ni l'autre n'est celle que cet appareil avait à la dernière synchro. Chacune existe
            // alors seule quelque part, et celle qui perd ne doit pas disparaître. `base[c]` absent = jamais synchronisé =
            // concurrent par défaut — mais seulement si la perdante a du contenu (inutile de ranger du vide).
            var concurrent = base[c] !== l.at && base[c] !== r.at;
            var droitGagne = r.at > l.at || (r.at === l.at && r.json > l.json);
            gagnant = droitGagne ? r : l;
            var perdant = droitGagne ? l : r;
            if (concurrent && sessionAContenu(perdant)) rangees.push({ session: perdant, de: droitGagne ? 'cet appareil' : 'un autre appareil' });
        } else if (!l) {
            gagnant = r;
        }
        sortie[c] = gagnant;
        if (!l || l.json !== gagnant.json) changeLocal = true;
        if (!r || r.json !== gagnant.json) changeDistant = true;
    });
    return { fusionne: { sessions: sortie }, changeLocal: changeLocal, changeDistant: changeDistant, rangees: rangees };
}

// ---------- passage document Firestore <-> état ----------
function versDocumentParoles(etat) {
    return {
        app: 'HarmoHub-Paroles',
        schema: 1,
        updatedAt: Date.now(),
        sessions: Object.keys(etat.sessions || {}).sort().map(function (c) {
            var s = etat.sessions[c];
            return { cle: String(c), nom: String(s.nom || ''), at: Number(s.at) || 0, json: String(s.json) };
        }),
    };
}

function depuisDocumentParoles(doc) {
    var sessions = {};
    ((doc && doc.sessions) || []).forEach(function (e) {
        if (e && e.cle && typeof e.json === 'string') sessions[e.cle] = { cle: e.cle, nom: String(e.nom || ''), at: Number(e.at) || 0, json: e.json };
    });
    return { sessions: sessions };
}

// ---------- appliquer un état reçu ----------
// La page affiche UNE session à la fois (state.song, voir paroles.js) : si c'est celle-là qui vient de changer, on la recharge à
// partir de la copie brute du morceau (`harmohub_lyrics_last_song`), qui relit la session fraîchement écrite.
function cleSessionOuverte() {
    return (typeof state !== 'undefined' && state && state.song && typeof storageKeyForSong === 'function')
        ? storageKeyForSong(state.song) : null;
}

function appliquerEtatParoles(etat, resume) {
    var ouverte = cleSessionOuverte();
    var ouverteChangee = false;
    Object.keys(etat.sessions).forEach(function (c) {
        var s = etat.sessions[c];
        var cle = PREFIXE_PAROLES + c;
        if (localStorage.getItem(cle) === s.json) return;
        try { localStorage.setItem(cle, s.json); } catch (e) { console.error('Écriture d\'une session reçue impossible :', e); return; }
        if (cle === ouverte) ouverteChangee = true;
    });
    if (ouverteChangee) rechargerParolesOuvertes();
}

// Les versions PERDANTES sont rangées au moment de la FUSION, et non à l'application : le moteur n'appelle `appliquer` que
// lorsque l'état d'ICI change. Quand c'est la version de l'AUTRE appareil qui perd, rien ne change ici, et elle serait écrasée au
// cloud sans laisser de trace. Une seule version rangée par session (la dernière perdante) : la fusion est rejouée par la
// transaction d'envoi et par l'écoute, et elle écrit toujours la même chose pour les mêmes entrées.
function ranger(rangees) {
    (rangees || []).forEach(function (x) {
        try {
            localStorage.setItem(PREFIXE_PAROLES_RANGEE + x.session.cle,
                JSON.stringify({ json: x.session.json, at: x.session.at, nom: x.session.nom, de: x.de }));
        } catch (e) { console.error('Rangement de la version remplacée impossible :', e); }
    });
}

function rechargerParolesOuvertes() {
    if (typeof loadSong !== 'function') return;
    try {
        var brut = localStorage.getItem(LAST_SONG_KEY);
        if (brut) loadSong(JSON.parse(brut));
    } catch (e) { console.error('Rechargement des paroles reçues impossible :', e); }
}

// Annonce, une fois par version rangée, ce qui vient de se passer pour le morceau OUVERT. Appelée après chaque synchro réussie,
// donc APRÈS un éventuel rechargement (qui efface les bandeaux).
var rangeesAnnoncees = {};
function annoncerParoles() {
    var id = cleSessionOuverte();
    if (!id || typeof showBanner !== 'function') return;
    var c = id.slice(PREFIXE_PAROLES.length);
    var rangee = lireJsonParoles(PREFIXE_PAROLES_RANGEE + c, null);
    if (!rangee || rangeesAnnoncees[c] === rangee.at + ':' + rangee.de) return;
    rangeesAnnoncees[c] = rangee.at + ':' + rangee.de;
    proposerRestauration(c, rangee);
}

// La version perdante, rangée : un bandeau avec un bouton, plutôt qu'un menu caché.
function proposerRestauration(c, rangee) {
    var ici = rangee.de === 'cet appareil';
    showBanner(ici
        ? 'Tes paroles de ce morceau ont été modifiées sur un autre appareil. La version qui était ici est gardée à part.'
        : 'Une autre version de tes paroles de ce morceau, modifiée sur un autre appareil, est gardée à part : la tienne, plus récente, a été conservée.',
        'warning');
    var bandeaux = document.querySelectorAll('#banners .banner');
    var bandeau = bandeaux[bandeaux.length - 1];
    if (!bandeau) return;
    var bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'banner-action';
    bouton.id = 'paroles-restaurer';
    bouton.textContent = ici ? 'Restaurer la version d\'ici' : 'Prendre l\'autre version';
    bouton.addEventListener('click', function () { restaurerParolesRangees(c); });
    bandeau.insertBefore(bouton, bandeau.querySelector('.banner-close'));
}

// Remet la version rangée EN SESSION, datée de maintenant : elle redevient la plus récente, donc la gagnante à la prochaine
// synchro — sans quoi le cloud la remplacerait de nouveau aussitôt.
function restaurerParolesRangees(c) {
    var rangee = lireJsonParoles(PREFIXE_PAROLES_RANGEE + c, null);
    if (!rangee) return;
    try {
        var payload = JSON.parse(rangee.json);
        payload.savedAt = Date.now();
        localStorage.setItem(PREFIXE_PAROLES + c, JSON.stringify(payload));
        localStorage.removeItem(PREFIXE_PAROLES_RANGEE + c);
    } catch (e) { console.error('Restauration impossible :', e); return; }
    if (typeof SYNCHRO !== 'undefined' && SYNCHRO && SYNCHRO.planifierEnvoi) SYNCHRO.planifierEnvoi();
    var brut = localStorage.getItem(LAST_SONG_KEY);
    if (brut && typeof loadSong === 'function') loadSong(JSON.parse(brut));
    if (typeof showBanner === 'function') showBanner('Version restaurée.', 'info');
}

// ---------- accroche appelée par paroles.js après chaque enregistrement ----------
function parolesNoterChangement() {
    if (typeof SYNCHRO !== 'undefined' && SYNCHRO && SYNCHRO.etat && SYNCHRO.etat.appliqueDistant) return; // reçu d'ailleurs
    if (typeof SYNCHRO !== 'undefined' && SYNCHRO && SYNCHRO.planifierEnvoi) SYNCHRO.planifierEnvoi();
}

// ---------- l'adaptateur ----------
var ADAPTATEUR_PAROLES = {
    slug: 'harmohub-paroles',
    lire: function () { return { sessions: lireSessionsParoles() }; },
    fusionner: function (local, distantDoc) {
        var r = fusionnerParoles(local, depuisDocumentParoles(distantDoc), lireJsonParoles(CLE_PAROLES_BASE, {}));
        ranger(r.rangees);
        return r;
    },
    versDocument: versDocumentParoles,
    appliquer: appliquerEtatParoles,
    // Un navigateur sans aucune session reprend celles du cloud sans rien demander : écraser le cloud avec du vide est
    // justement ce qu'on ne doit JAMAIS faire.
    estVide: function (etat) { return Object.keys(etat.sessions).length === 0; },
    // Ce que chaque session valait À LA DERNIÈRE SYNCHRO : c'est lui qui dit, plus tard, si la version locale a été modifiée depuis.
    apresSynchro: function () {
        var base = {}, s = lireSessionsParoles();
        Object.keys(s).forEach(function (c) { base[c] = s[c].at; });
        try { localStorage.setItem(CLE_PAROLES_BASE, JSON.stringify(base)); } catch (e) { /* sans gravité */ }
        annoncerParoles();
    },
    // Un autre compte Google n'hérite pas de l'historique du précédent.
    surCompte: function (uid) {
        var precedent = null;
        try { precedent = localStorage.getItem(CLE_PAROLES_UID); } catch (e) { /* sans gravité */ }
        if (precedent && precedent !== uid) { try { localStorage.removeItem(CLE_PAROLES_BASE); } catch (e) { } }
        try { localStorage.setItem(CLE_PAROLES_UID, uid); } catch (e) { /* sans gravité */ }
    },
};

// ---------- démarrage ----------
(function () {
    if (typeof demarrerSynchro !== 'function') return;
    var indisponible = function (raison) { if (typeof showBanner === 'function') showBanner('Synchronisation indisponible — ' + raison, 'warning'); };
    // La pilule est la MÊME que dans HarmoHub (compte-cloud.js). Pas de fenêtre d'accueil ici (`accueil: false`) : on arrive en général
    // depuis HarmoHub, qui l'a déjà proposée, et la proposer deux fois par visite serait du harcèlement.
    var ui = (typeof monterCompteCloud === 'function') ? monterCompteCloud(document.getElementById('compte-cloud'), {
        appli: 'Paroles', slug: 'harmohub', objets: 'paroles', accueil: false,
        seConnecter: function () { if (SYNCHRO && SYNCHRO.seConnecter) SYNCHRO.seConnecter(); },
        seDeconnecter: function () { if (SYNCHRO && SYNCHRO.seDeconnecter) SYNCHRO.seDeconnecter(); },
        surIndisponible: indisponible,
    }) : null;
    demarrerSynchro(ADAPTATEUR_PAROLES, { ui: ui, surIndisponible: indisponible });
})();
