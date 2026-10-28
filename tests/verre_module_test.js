// Banc du MODULE DU VERRE (verre.js) — sans navigateur.
//
// CE QU'IL PROTÈGE. Retour utilisateur : « un affichage de type verre comme sur TrainHub [...] il doit rester gérable en
// paramètres ». verre.js ne dessine rien : il retient deux réglages par appareil (allumé ? quelle couleur de fond ?) et
// les pose en attributs sur <html>. Tout le reste (verre.css) en dépend : un attribut mal posé, et le rendu est faux sans
// la moindre erreur. Les cas ci-dessous sont ceux où cette mécanique dérape en silence :
//
//   • éteint par défaut, et allumé SEULEMENT par un « 1 » explicite — une valeur illisible n'allume jamais rien ;
//   • éteint = AUCUN attribut data-glass : c'est ce qui garantit que le rendu d'avant revient à l'identique ;
//   • data-glass-bg est toujours posé, et une couleur inconnue retombe sur « aurora » (jamais un attribut absurde) ;
//   • deux applis sur une même origine ne partagent PAS leurs réglages (préfixe de clé) ;
//   • un stockage qui plante (navigation privée, quota) ne casse rien : le réglage vaut pour la séance ;
//   • l'interface est prévenue d'un changement, et un abonné qui plante n'en prive pas un autre.
const creerHarnais = require('./_harness.js');
const { check, plan, bilan } = creerHarnais('module du verre');
const fs = require('fs');
const path = require('path');

// Charge verre.js comme le navigateur le fait : un script classique, sans document ici (donc sans instance auto).
globalThis.window = globalThis;
new Function(fs.readFileSync(path.join(__dirname, '..', 'verre.js'), 'utf8'))();
const { creer, FONDS, DEFAUT_ALLUME } = globalThis.VerreModule;

function stockage(initial = {}) { const m = { ...initial }; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, _m: m }; }
function racine() { const a = {}; return { setAttribute: (k, v) => { a[k] = String(v); }, removeAttribute: (k) => { delete a[k]; }, _a: a }; }

plan(25);

// ----- 1. Le défaut ---------------------------------------------------------------------------------------------------
{
    const r = racine(); const v = creer({ app: 'harmohub', stockage: stockage(), racine: r }); v.appliquer();
    check(DEFAUT_ALLUME === false && v.actif() === false, 'par défaut le verre est ÉTEINT (comme sur TrainHub) : rien ne change tant qu\'on ne l\'allume pas');
    check(!('data-glass' in r._a), 'éteint : AUCUN attribut data-glass sur <html> — c\'est ce qui rend le rendu d\'avant à l\'identique');
    check(r._a['data-glass-bg'] === 'aurora', 'mais data-glass-bg est toujours posé (« aurora » par défaut)');
}

// ----- 2. Allumer, éteindre, retenir ---------------------------------------------------------------------------------
{
    const s = stockage(); const r = racine(); const v = creer({ app: 'harmohub', stockage: s, racine: r }); v.appliquer();
    v.definirActif(true);
    check(r._a['data-glass'] === '1' && s._m['harmohub.glass.v1'] === '1', 'allumer pose data-glass="1" ET le retient dans le stockage de l\'appareil');
    const r2 = racine(); creer({ app: 'harmohub', stockage: s, racine: r2 }).appliquer();
    check(r2._a['data-glass'] === '1', 'rechargé (nouvelle instance, même stockage) : le verre est toujours allumé');
    v.definirActif(false);
    check(!('data-glass' in r._a) && s._m['harmohub.glass.v1'] === '0', 'éteindre retire l\'attribut (il ne reste pas data-glass="0") et le retient');
}

// ----- 3. Valeurs illisibles : jamais d'allumage par accident ------------------------------------------------------
{
    for (const mauvais of ['true', 'oui', '2', '', 'null', '{"a":1}']) {
        const r = racine(); creer({ app: 'harmohub', stockage: stockage({ 'harmohub.glass.v1': mauvais }), racine: r }).appliquer();
        if ('data-glass' in r._a) { check(false, `la valeur « ${mauvais} » allume le verre (elle ne devrait pas)`); }
    }
    check(true, 'une valeur stockée autre que « 1 » (« true », « oui », « 2 », vide…) n\'allume jamais le verre');
    const r = racine(); const v = creer({ app: 'harmohub', stockage: stockage({ 'harmohub.glass.v1': '1' }), racine: r }); v.appliquer();
    check(r._a['data-glass'] === '1', 'et un « 1 » explicite l\'allume');
}

// ----- 4. La couleur du fond ---------------------------------------------------------------------------------------------
{
    const s = stockage(); const r = racine(); const v = creer({ app: 'tabhub', stockage: s, racine: r }); v.appliquer();
    check(FONDS.map(f => f[0]).join() === 'aurora,blue,green,violet,rose,amber,grey', 'les sept fonds de TrainHub, dans le même ordre (aurore, bleu, vert, violet, rose, ambre, gris)');
    check(v.definirFond('violet') === true && r._a['data-glass-bg'] === 'violet' && s._m['tabhub.glassBg.v1'] === 'violet', 'choisir une couleur la pose et la retient');
    check(v.definirFond('fuchsia-fluo') === false && v.fond() === 'violet' && r._a['data-glass-bg'] === 'violet', 'une couleur inconnue est REFUSÉE : le fond reste celui d\'avant');
    const r2 = racine(); creer({ app: 'tabhub', stockage: stockage({ 'tabhub.glassBg.v1': 'n\'importe quoi' }), racine: r2 }).appliquer();
    check(r2._a['data-glass-bg'] === 'aurora', 'une couleur illisible dans le stockage retombe sur « aurora » (jamais un attribut absurde)');
    check(!('data-glass' in r._a), 'choisir une couleur n\'allume PAS le verre (deux réglages indépendants)');
}

// ----- 5. Deux applis, une origine ----------------------------------------------------------------------------------------
{
    const s = stockage(); // le MÊME stockage : c'est ce que partagent des applis servies depuis une même origine
    const rh = racine(); const rt = racine();
    const harmohub = creer({ app: 'harmohub', stockage: s, racine: rh }); const tabhub = creer({ app: 'tabhub', stockage: s, racine: rt });
    harmohub.definirActif(true); harmohub.definirFond('rose');
    tabhub.appliquer();
    check(!('data-glass' in rt._a) && rt._a['data-glass-bg'] === 'aurora', 'régler HarmoHub ne change PAS TabHub, même sur un stockage partagé (clés préfixées)');
    check(s._m['harmohub.glass.v1'] === '1' && !('tabhub.glass.v1' in s._m), 'chacun écrit sous sa propre clé');
}

// ----- 6. Un stockage qui plante ----------------------------------------------------------------------------------------
{
    const cassé = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceededError'); } };
    const r = racine(); let ok = true;
    try { const v = creer({ app: 'harmohub', stockage: cassé, racine: r }); v.appliquer(); v.definirActif(true); v.definirFond('blue'); } catch (e) { ok = false; }
    check(ok, 'un stockage inaccessible (navigation privée) ne lève aucune erreur, ni à la lecture ni à l\'écriture');
    check(!('data-glass' in r._a) && r._a['data-glass-bg'] === 'aurora', 'et rien n\'est allumé par défaut : le réglage ne tient pas, mais l\'appli non plus ne casse pas');
}

// ----- 7. Prévenir l'interface -----------------------------------------------------------------------------------------------
{
    const v = creer({ app: 'harmohub', stockage: stockage(), racine: racine() });
    const recus = []; v.surChangement((e) => recus.push(e));
    v.definirActif(true); v.definirFond('green');
    check(recus.length === 2 && recus[1].actif === true && recus[1].fond === 'green', 'un abonné est prévenu de chaque changement, avec l\'état complet');
    const v2 = creer({ app: 'harmohub', stockage: stockage(), racine: racine() });
    let atteint = false; v2.surChangement(() => { throw new Error('boum'); }); v2.surChangement(() => { atteint = true; });
    v2.definirActif(true);
    check(atteint, 'un abonné qui plante n\'empêche pas les suivants d\'être prévenus');
    const r = racine(); const s = stockage(); const v3 = creer({ app: 'harmohub', stockage: s, racine: r }); v3.appliquer();
    s.setItem('harmohub.glass.v1', '1'); // un autre onglet vient d'écrire
    check(!('data-glass' in r._a), 'préalable : sans signal, un changement fait ailleurs ne s\'applique pas tout seul…');
    let prevenu = false; v3.surChangement(() => { prevenu = true; }); v3.rafraichir();
    check(r._a['data-glass'] === '1' && prevenu, '…et rafraichir() (appelé sur l\'évènement de stockage) pose l\'attribut ET prévient l\'interface');
}

// ----- 7 bis. Se désabonner -------------------------------------------------------------------------------------------------
{
    const v = creer({ app: 'harmohub', stockage: stockage(), racine: racine() });
    let n = 0; const oter = v.surChangement(() => { n++; });
    v.definirActif(true); oter(); v.definirActif(false);
    check(n === 1 && v.nbAbonnes() === 0, 'se désabonner arrête les notifications et libère l\'abonné (une fenêtre reconstruite à chaque ouverture n\'en empile pas)');
}

// ----- 8. Sans racine (page sans document) -----------------------------------------------------------------------------
{
    let ok = true; try { const v = creer({ app: 'x', stockage: stockage() }); v.appliquer(); v.definirActif(true); } catch (e) { ok = false; }
    check(ok, 'sans élément racine, appliquer() est sans effet et ne plante pas');
    check(creer({ app: 'x', stockage: stockage() }).CLES.verre === 'x.glass.v1' && creer({ app: 'x', stockage: stockage() }).CLES.fond === 'x.glassBg.v1', 'les clés ont la forme de TrainHub (« <appli>.glass.v1 », « <appli>.glassBg.v1 »)');
    check(creer({ stockage: stockage() }).CLES.verre === 'app.glass.v1', 'sans nom d\'appli (balise <script> sans data-app), un préfixe neutre — jamais « undefined.glass.v1 »');
}

bilan();
