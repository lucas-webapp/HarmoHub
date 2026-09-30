// SYNCHRO HARMOHUB — l'ADAPTATEUR de la bibliothèque, branché sur la couche générique synchro-cloud.js.
//
// CE QUI EST SYNCHRONISÉ : les morceaux, les dossiers, et la trace des suppressions. PAS le morceau en
// cours d'édition (`myProgression`) ni le morceau ouvert (`harmohubCurrentSongId`) : ce sont des états
// PAR APPAREIL. Les synchroniser ferait changer de morceau sous les doigts de quelqu'un qui travaille
// sur un autre écran. Les réglages de l'appli ne le sont pas non plus — à reconsidérer, pas à sous-
// entendre : chaque appareil garde les siens.
//
// POURQUOI UNE FUSION PAR MORCEAU ET NON UN REMPLACEMENT GLOBAL (ce que fait TrainHub). Un état unique
// se remplace en bloc. Une bibliothèque modifiée depuis Chrome, Safari et l'app du Dock se FUSIONNE :
// remplacer en bloc ferait perdre, à chaque synchro, les modifications de l'appareil « perdant » — soit
// exactement ce que l'utilisateur redoute (« des morceaux modifiés ailleurs ne doivent pas être
// écrasés »). Règle : morceau par morceau, le plus récent gagne ; et quand la version d'un appareil
// est remplacée ALORS QU'ELLE AVAIT ÉTÉ MODIFIÉE depuis la dernière synchro, elle est RANGÉE dans
// « Archives » au lieu d'être jetée. On perd au pire un peu de confort, jamais du travail.
//
// POURQUOI UNE DATE DE SYNCHRO (`syncAt`) À CÔTÉ DE `savedAt`. `savedAt` est la date d'enregistrement
// AFFICHÉE à l'utilisateur ; `moveSongToFolder` ne la touche pas, et pourtant un déplacement doit
// voyager d'un appareil à l'autre. `syncAt` est posée par ce fichier à toute modification, quelle
// qu'elle soit, et c'est elle qui arbitre. La date affichée reste donc celle du dernier vrai
// enregistrement, et un simple déplacement ne la fait pas changer.
//
// POURQUOI CHAQUE MORCEAU EST STOCKÉ COMME UNE CHAÎNE JSON. Firestore refuse les tableaux imbriqués et
// les valeurs `undefined`. Un morceau d'aujourd'hui n'en contient pas (le motif du séquenceur est
// sérialisé en texte), mais un champ ajouté demain pourrait en contenir, et l'écriture échouerait à
// ce moment-là, chez l'utilisateur, sans prévenir. Une chaîne ne peut pas échouer.

var CLE_SYNC_BASE = 'harmohub_sync_base';
var CLE_SYNC_SUPPR = 'harmohub_sync_deleted';
var CLE_SYNC_DOSSIERS = 'harmohub_sync_dossiers';
var CLE_SYNC_UID = 'harmohub_sync_uid';
// Une trace de suppression sert à empêcher un appareil resté hors ligne de ramener un morceau effacé.
// Au bout de six mois, on considère qu'aucun appareil n'est plus en retard à ce point.
var DUREE_TRACE_SUPPRESSION_MS = 180 * 86400000;

// ---------- petits outils ----------
function cleSync(s) { return (s && (s.syncAt || s.savedAt)) || 0; }

// Sérialisation à clés triées : deux objets de même contenu donnent la même chaîne, quel que soit
// l'ordre dans lequel leurs champs ont été créés. Sans ça, reconstruire un morceau avec `{...s}`
// suffirait à le faire passer pour modifié.
function canonique(v) {
    if (Array.isArray(v)) return '[' + v.map(canonique).join(',') + ']';
    if (v && typeof v === 'object') {
        return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canonique(v[k]); }).join(',') + '}';
    }
    return JSON.stringify(v === undefined ? null : v);
}
function sansSync(s) { var c = Object.assign({}, s); delete c.syncAt; return c; }
function memeContenu(a, b) { return canonique(sansSync(a)) === canonique(sansSync(b)); }

function lireCleJson(cle, repli) {
    try { var v = JSON.parse(localStorage.getItem(cle)); return (v === null || v === undefined) ? repli : v; }
    catch (e) { return repli; }
}
function ecrireCleJson(cle, valeur) {
    try { localStorage.setItem(cle, JSON.stringify(valeur)); } catch (e) { /* stockage plein : sans gravité ici */ }
}
function lireSuppressions() { var v = lireCleJson(CLE_SYNC_SUPPR, {}); return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; }
function lireEnregistrementsDossiers() { var v = lireCleJson(CLE_SYNC_DOSSIERS, {}); return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; }
function lireBaseSync() { var v = lireCleJson(CLE_SYNC_BASE, {}); return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; }

// ---------- la fusion (PURE : aucune lecture ni écriture de stockage, donc testable à part) ----------
// local / distant = { songs: [...], dossiers: [{nom, ts, supprime}], supprimes: {id: ts} }
// options.base = { id: syncAt } tel qu'il était à la dernière synchro de CET appareil.
function fusionnerBibliotheques(local, distant, options) {
    var base = (options && options.base) || {};
    var maintenant = (options && options.maintenant) || Date.now();

    // Suppressions : union, la plus récente l'emporte pour chaque identifiant.
    var tombes = {};
    [local.supprimes, distant.supprimes].forEach(function (m) {
        Object.keys(m || {}).forEach(function (id) { tombes[id] = Math.max(tombes[id] || 0, m[id] || 0); });
    });

    var L = new Map(local.songs.map(function (s) { return [s.id, s]; }));
    var R = new Map(distant.songs.map(function (s) { return [s.id, s]; }));
    var ids = []; L.forEach(function (_, id) { ids.push(id); });
    R.forEach(function (_, id) { if (!L.has(id)) ids.push(id); });

    var sortie = [], archives = [];
    var resume = { ajoutes: 0, remplaces: 0, supprimes: 0, archives: 0 };

    ids.forEach(function (id) {
        var l = L.get(id), r = R.get(id), gagnant = l;
        if (l && r) {
            // ÉDITION CONCURRENTE : ni l'une ni l'autre des deux versions n'est celle que cet appareil
            // avait à la dernière synchro. Chacune existe donc seule quelque part, et celle qui perd ne
            // doit pas disparaître. `base[id]` absent = jamais synchronisé = concurrent par défaut.
            // Sans cette condition, seul le cas « la version d'ICI perd » était protégé : quand elle
            // gagnait, celle de l'autre appareil partait sans laisser de trace.
            var concurrent = !memeContenu(l, r) && base[id] !== cleSync(l) && base[id] !== cleSync(r);
            // Égalité : l'appareil garde sa version. Deux versions de même date n'ont aucune raison de
            // s'échanger, et ça évite un va-et-vient sans fin entre deux appareils.
            if (cleSync(r) > cleSync(l)) {
                gagnant = r;
                if (!memeContenu(l, r)) resume.remplaces++;
                if (concurrent) archives.push(copieArchivee(l, maintenant));
            } else if (concurrent) {
                archives.push(copieArchivee(r, maintenant));
            }
        } else if (r) {
            gagnant = r;
            resume.ajoutes++;
        }
        var ts = tombes[id];
        if (ts && ts >= cleSync(gagnant)) { if (l) resume.supprimes++; return; } // supprimé, et rien de plus récent
        if (ts) delete tombes[id];                                                 // ressuscité par une modification plus récente
        sortie.push(gagnant);
    });

    // Copies de sauvegarde : déterministes (identifiant dérivé du morceau et de sa version), si bien
    // que rejouer la même fusion ne crée jamais deux fois la même archive.
    archives.forEach(function (a) {
        if (L.has(a.id) || R.has(a.id) || sortie.some(function (s) { return s.id === a.id; })) return;
        sortie.push(a);
        resume.archives++;
    });

    // Dossiers : pour chaque nom, l'enregistrement le plus récent décide (créé ou supprimé). À égalité,
    // l'appareil garde son idée.
    var dos = new Map();
    (distant.dossiers || []).concat(local.dossiers || []).forEach(function (rec) {
        var cur = dos.get(rec.nom);
        if (!cur || rec.ts >= cur.ts) dos.set(rec.nom, rec);
    });
    // Un dossier qu'un morceau vivant référence existe, quoi qu'en disent les traces : c'est ce que
    // fait déjà l'appli localement (renderFilesPanel rattrape les dossiers oubliés).
    sortie.forEach(function (s) {
        if (s.folder && !(dos.get(s.folder) && !dos.get(s.folder).supprime)) dos.set(s.folder, { nom: s.folder, ts: maintenant, supprime: false });
    });
    var visibles = [];
    (local.dossiers || []).forEach(function (rec) { var m = dos.get(rec.nom); if (m && !m.supprime && visibles.indexOf(rec.nom) < 0) visibles.push(rec.nom); });
    dos.forEach(function (rec, nom) { if (!rec.supprime && visibles.indexOf(nom) < 0) visibles.push(nom); });

    var fusionne = {
        songs: sortie,
        dossiers: Array.from(dos.values()),
        dossiersVisibles: visibles,
        supprimes: tombes,
    };

    var signature = function (songs, dossiers) {
        return songs.map(function (s) { return s.id + '|' + cleSync(s); }).sort().join(';') + '##' + dossiers.slice().sort().join(';');
    };
    var visiblesLocaux = (local.dossiers || []).filter(function (r) { return !r.supprime; }).map(function (r) { return r.nom; });
    var changeLocal = signature(sortie, visibles) !== signature(local.songs, visiblesLocaux);
    return { fusionne: fusionne, changeLocal: changeLocal, resume: resume };
}

function copieArchivee(s, maintenant) {
    var nomArchives = (typeof DOSSIER_ARCHIVES !== 'undefined') ? DOSSIER_ARCHIVES : 'Archives';
    var c = Object.assign({}, s);
    c.id = 'arch_' + s.id + '_' + cleSync(s);
    c.folder = nomArchives;
    c.syncAt = maintenant;
    return c;
}

// ---------- passage document Firestore <-> état ----------
function versDocumentHarmoHub(etat) {
    var maintenant = Date.now();
    return {
        app: 'HarmoHub',
        schema: 1,
        updatedAt: maintenant,
        songs: etat.songs.map(function (s) {
            return {
                id: String(s.id), name: String(s.name == null ? '' : s.name),
                savedAt: Number(s.savedAt) || 0, syncAt: cleSync(s),
                folder: s.folder ? String(s.folder) : null,
                json: JSON.stringify(s),
            };
        }),
        dossiers: etat.dossiers.map(function (r) { return { nom: String(r.nom), ts: Number(r.ts) || 0, supprime: !!r.supprime }; }),
        supprimes: Object.keys(etat.supprimes || {})
            .filter(function (id) { return maintenant - etat.supprimes[id] < DUREE_TRACE_SUPPRESSION_MS; })
            .map(function (id) { return { id: id, ts: Number(etat.supprimes[id]) || 0 }; }),
    };
}

function depuisDocumentHarmoHub(doc) {
    var songs = [];
    (doc && doc.songs || []).forEach(function (e) {
        try {
            var s = JSON.parse(e.json);
            if (s && s.id) { if (!s.syncAt && e.syncAt) s.syncAt = e.syncAt; songs.push(s); }
        } catch (err) { console.error('Morceau illisible dans le cloud, ignoré :', e && e.id, err); }
    });
    var supprimes = {};
    (doc && doc.supprimes || []).forEach(function (t) { if (t && t.id) supprimes[t.id] = Number(t.ts) || 0; });
    return { songs: songs, dossiers: (doc && doc.dossiers) || [], supprimes: supprimes };
}

// ---------- état local ----------
function dossiersLocaux() {
    var recs = lireEnregistrementsDossiers();
    var noms = loadFolders();
    var sortie = noms.map(function (nom) {
        var r = recs[nom];
        // Un dossier sans trace (créé avant la synchro) vaut « très ancien » : une suppression venue du
        // cloud le retire, un dossier plus récent ne se laisse pas retirer par un vieil oubli.
        return (r && !r.supprime) ? r : { nom: nom, ts: (r && r.ts) || 1, supprime: false };
    });
    Object.keys(recs).forEach(function (nom) { if (recs[nom].supprime && noms.indexOf(nom) < 0) sortie.push(recs[nom]); });
    return sortie;
}

function lireEtatHarmoHub() {
    return { songs: loadSongs(), dossiers: dossiersLocaux(), supprimes: lireSuppressions() };
}

// ---------- accroches appelées par saveSongs / saveFolders (script.js) ----------
// Toute écriture de la bibliothèque passe par saveSongs : c'est le SEUL endroit où l'on sait à la fois
// ce qu'il y avait avant et ce qu'il y a après — donc le seul où détecter ce qui a changé, ce qui a été
// supprimé, et ce qui revient (Ctrl+Z).
function cloudNoterChangement(ancien, nouveau) {
    if (typeof SYNCHRO !== 'undefined' && SYNCHRO && SYNCHRO.etat && SYNCHRO.etat.appliqueDistant) return; // reçu d'ailleurs
    var maintenant = Date.now();
    var avant = new Map((ancien || []).map(function (s) { return [s.id, s]; }));
    var suppr = lireSuppressions();
    var supprChange = false;
    var presents = new Set();
    (nouveau || []).forEach(function (s) {
        if (!s || !s.id) return;
        presents.add(s.id);
        var prev = avant.get(s.id);
        if (!prev || !memeContenu(prev, s)) {
            // Toujours strictement postérieure à la précédente : une horloge qui recule ne doit pas faire
            // perdre la course à une modification pourtant plus récente.
            s.syncAt = Math.max(maintenant, cleSync(prev) + 1);
        } else if (!s.syncAt && prev.syncAt) {
            s.syncAt = prev.syncAt;
        }
        if (suppr[s.id]) { delete suppr[s.id]; supprChange = true; } // un morceau qui revient n'est plus supprimé
    });
    avant.forEach(function (s, id) {
        if (!presents.has(id)) { suppr[id] = Math.max(maintenant, (suppr[id] || 0)); supprChange = true; }
    });
    if (supprChange) ecrireCleJson(CLE_SYNC_SUPPR, suppr);
    if (typeof SYNCHRO !== 'undefined' && SYNCHRO && SYNCHRO.planifierEnvoi) SYNCHRO.planifierEnvoi();
}

function cloudNoterDossiers(ancien, nouveau) {
    if (typeof SYNCHRO !== 'undefined' && SYNCHRO && SYNCHRO.etat && SYNCHRO.etat.appliqueDistant) return;
    var recs = lireEnregistrementsDossiers();
    var maintenant = Date.now();
    var avant = new Set(ancien || []), apres = new Set(nouveau || []);
    var change = false;
    apres.forEach(function (nom) {
        if (!avant.has(nom) || (recs[nom] && recs[nom].supprime)) { recs[nom] = { nom: nom, ts: maintenant, supprime: false }; change = true; }
    });
    avant.forEach(function (nom) {
        if (!apres.has(nom)) { recs[nom] = { nom: nom, ts: maintenant, supprime: true }; change = true; }
    });
    if (change) ecrireCleJson(CLE_SYNC_DOSSIERS, recs);
    if (typeof SYNCHRO !== 'undefined' && SYNCHRO && SYNCHRO.planifierEnvoi) SYNCHRO.planifierEnvoi();
}

// ---------- appliquer un état reçu ----------
function appliquerEtatHarmoHub(etat, resume, origine) {
    var ouvert = (typeof getCurrentSongId === 'function') ? getCurrentSongId() : null;
    var avantOuvert = ouvert ? loadSongs().find(function (s) { return s.id === ouvert; }) : null;

    // Les deux écritures passent par saveSongs/saveFolders : le drapeau `appliqueDistant`, levé par la
    // couche générique, empêche leurs accroches de prendre ce qu'on vient de recevoir pour une
    // modification locale (ce qui le renverrait aussitôt, et ferait tourner la synchro en boucle).
    saveSongs(etat.songs);
    saveFolders(etat.dossiersVisibles || []);
    var recs = {};
    (etat.dossiers || []).forEach(function (r) { recs[r.nom] = r; });
    ecrireCleJson(CLE_SYNC_DOSSIERS, recs);
    ecrireCleJson(CLE_SYNC_SUPPR, etat.supprimes || {});

    var app = window.app;
    if (!app) return;
    app.refreshSongList();
    if (app.filesOpen) app.renderFilesPanel();

    if (ouvert) {
        var apres = etat.songs.find(function (s) { return s.id === ouvert; });
        if (!apres) {
            setCurrentSongId(null);
            app.flashHint('Le morceau ouvert a été supprimé depuis un autre appareil', 5000);
        } else if (avantOuvert && cleSync(apres) !== cleSync(avantOuvert) && !memeContenu(apres, avantOuvert)) {
            // La version ouverte vient d'être remplacée. Recharger efface l'écran, donc seulement si
            // rien n'y a été modifié : sinon on prévient, et le travail en cours reste intact.
            if (typeof hasUnsavedChanges !== 'undefined' && hasUnsavedChanges) {
                // LA VERSION ARRIVÉE EST RANGÉE TOUT DE SUITE dans Archives. Sans ça, enregistrer ensuite
                // la version ouverte l'écraserait sans laisser de trace : la synchro prendrait la version
                // reçue pour celle que l'utilisateur avait sous les yeux, puisqu'elle figure désormais
                // dans l'historique de cet appareil. C'est pourtant exactement le cas que l'utilisateur
                // redoute — « des morceaux modifiés ailleurs ne doivent pas être écrasés ».
                var copie = copieArchivee(apres, Date.now());
                var liste = loadSongs();
                if (!liste.some(function (x) { return x.id === copie.id; })) {
                    liste.push(copie);
                    saveSongs(liste);
                    var dos = loadFolders();
                    var nomArch = (typeof DOSSIER_ARCHIVES !== 'undefined') ? DOSSIER_ARCHIVES : 'Archives';
                    if (dos.indexOf(nomArch) < 0) saveFolders(dos.concat([nomArch]));
                    // La copie existe ici seulement : on demande l'envoi APRÈS que la couche générique a
                    // baissé son drapeau de réception, sans quoi planifierEnvoi l'ignorerait.
                    setTimeout(function () { if (SYNCHRO && SYNCHRO.planifierEnvoi) SYNCHRO.planifierEnvoi(); }, 0);
                    app.refreshSongList();
                    if (app.filesOpen) app.renderFilesPanel();
                }
                app.flashHint('« ' + apres.name + ' » a été modifié sur un autre appareil — ta version ouverte est intacte, et celle de l\'autre appareil est rangée dans Archives', 8000);
            } else if (!app.isPlaying) {
                app.loadSong(ouvert);
            }
        }
    }

    if (origine === 'reception' && resume) {
        var bouts = [];
        if (resume.ajoutes) bouts.push(resume.ajoutes + ' ajouté(s)');
        if (resume.remplaces) bouts.push(resume.remplaces + ' mis à jour');
        if (resume.supprimes) bouts.push(resume.supprimes + ' supprimé(s)');
        if (resume.archives) bouts.push(resume.archives + ' version(s) rangée(s) dans Archives');
        if (bouts.length) app.flashHint('Cloud : ' + bouts.join(', '), 4500);
    }
}

// ---------- première connexion d'un appareil qui a déjà du contenu ----------
// C'est le cas qui fabriquait les doublons : chaque navigateur crée ses propres identifiants, donc deux
// bibliothèques qui se ressemblent ne se reconnaissent pas. On demande, morceau par morceau — décision
// prise avec l'utilisateur : « même titre = même morceau » et « comparer et choisir à chaque fois ».
var LIBELLES_CLOUD = {
    titre: 'Ta bibliothèque existe déjà dans le cloud',
    place: 'Sur cet appareil',
    fichier: 'Dans le cloud',
    ecraser: 'Prendre la version du cloud',
    lesDeux: 'Garder les deux',
    ignorer: 'Garder celle de cet appareil',
    intro: function (n) {
        return (n === 1 ? 'Ce morceau existe' : 'Ces ' + n + ' morceaux existent') + ' à la fois sur cet appareil et dans ton cloud, sous le même titre. Choisis la version à garder : <strong>l\'autre est rangée dans « Archives »</strong>, rien n\'est supprimé.';
    },
    aide: '<strong>Garder les deux</strong> conserve chaque version sous son nom, la copie de cet appareil étant renommée.',
    // Fermer sans choisir ne doit RIEN retirer à personne : on garde les deux, quitte à ranger plus tard.
    annulation: 'les-deux',
};

function premiereConnexionHarmoHub(local, distantDoc) {
    var distant = depuisDocumentHarmoHub(distantDoc);
    var locaux = local.songs;
    var paires = [];
    distant.songs.forEach(function (r) {
        if (estArchive(r)) return;
        if (locaux.some(function (l) { return l.id === r.id; })) return;      // même identifiant : la fusion normale tranche
        var l = apparierMorceau(r, locaux);
        if (l) paires.push({ r: r, l: l });
    });
    if (!paires.length) return Promise.resolve();
    return window.app.demanderResolutionImport(
        paires.map(function (p) { return p.r; }), locaux,
        new Map(paires.map(function (p) { return [p.r.id, p.l]; })), LIBELLES_CLOUD
    ).then(function (choix) {
        var songs = loadSongs();
        var nomsPris = new Set(songs.map(function (s) { return s.name; }).concat(distant.songs.map(function (s) { return s.name; })));
        var nomArchives = (typeof DOSSIER_ARCHIVES !== 'undefined') ? DOSSIER_ARCHIVES : 'Archives';
        var archive = false;
        paires.forEach(function (p) {
            var quoi = choix.get(p.r.id) || 'les-deux';
            var locale = songs.find(function (s) { return s.id === p.l.id; });
            if (quoi === 'ecraser' && locale) {
                locale.folder = nomArchives;                    // la version d'ici est rangée ; celle du cloud reste
                archive = true;
            } else if (quoi === 'ignorer') {
                // La version d'ici gagne : celle du cloud est rangée. On l'inscrit ICI sous sa propre
                // identité, plus récente, pour qu'elle remplace l'autre là-bas.
                songs.push(Object.assign({}, p.r, { folder: nomArchives }));
                archive = true;
            } else if (locale) {
                var nom = nomLibrePourCopie(locale.name, nomsPris);
                nomsPris.add(nom);
                locale.name = nom;                               // « garder les deux » : la copie d'ici prend un suffixe
            }
        });
        saveSongs(songs);
        if (archive) {
            var dossiers = loadFolders();
            if (dossiers.indexOf(nomArchives) < 0) saveFolders(dossiers.concat([nomArchives]));
        }
    });
}

// ---------- l'adaptateur ----------
var ADAPTATEUR_HARMOHUB = {
    slug: 'harmohub',
    lire: lireEtatHarmoHub,
    fusionner: function (local, distantDoc) {
        return fusionnerBibliotheques(local, depuisDocumentHarmoHub(distantDoc), { base: lireBaseSync() });
    },
    versDocument: versDocumentHarmoHub,
    appliquer: appliquerEtatHarmoHub,
    estVide: function (etat) {
        return etat.songs.length === 0 && etat.dossiers.filter(function (r) { return !r.supprime; }).length === 0;
    },
    premiereConnexion: premiereConnexionHarmoHub,
    dejaSynchronise: function () { return localStorage.getItem(CLE_SYNC_BASE) !== null; },
    // Ce que chaque morceau valait À LA DERNIÈRE SYNCHRO : c'est lui qui dit, plus tard, si une version
    // locale a été modifiée depuis (voir fusionnerBibliotheques).
    apresSynchro: function () {
        var base = {};
        loadSongs().forEach(function (s) { base[s.id] = cleSync(s); });
        ecrireCleJson(CLE_SYNC_BASE, base);
        // ON NE MARQUE PAS ICI « sauvegarde faite ». Ce repère est celui de la copie SUR DISQUE (voir
        // surveillerFraicheurSauvegarde) : la synchro cloud n'en est pas une, et le marquer ferait taire
        // le rappel que l'utilisateur veut précisément garder — « de temps en temps je conserverai mes
        // données sur un disque ». Le cloud protège du vidage d'un navigateur, pas d'un compte
        // supprimé ou d'une erreur de manipulation répliquée partout.
    },
    // Un autre compte Google n'hérite ni des traces ni de l'historique du précédent : ses morceaux
    // seraient fusionnés dans une base qui n'est pas la sienne.
    surCompte: function (uid) {
        var precedent = null;
        try { precedent = localStorage.getItem(CLE_SYNC_UID); } catch (e) { /* sans gravité */ }
        if (precedent && precedent !== uid) {
            [CLE_SYNC_BASE, CLE_SYNC_SUPPR, CLE_SYNC_DOSSIERS].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { } });
        }
        try { localStorage.setItem(CLE_SYNC_UID, uid); } catch (e) { /* sans gravité */ }
    },
};

// ---------- démarrage ----------
(function () {
    if (typeof demarrerSynchro !== 'function') return;
    demarrerSynchro(ADAPTATEUR_HARMOHUB, {
        statut: document.getElementById('sync-status'),
        connexion: document.getElementById('google-signin-btn'),
        compte: document.getElementById('account-info'),
        nomCompte: document.getElementById('account-name'),
        deconnexion: document.getElementById('signout-btn'),
    });
})();
