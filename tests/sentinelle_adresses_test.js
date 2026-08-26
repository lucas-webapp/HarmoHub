// SENTINELLE 1/3 — aucun banc ne doit adresser une adresse qui n'existe plus.
//
// POURQUOI CELLE-CI D'ABORD. Le dépouillement des 52 sections de docs/dette-tests.md donne une
// famille de loin plus fréquente et plus coûteuse que les autres : le banc périmé. « Suites
// supprimées — la fonctionnalité n'existe plus », « Contrats réécrits », « 4 suites adaptées au
// nouveau bouton », « deux bancs périmés et le vrai défaut qu'ils cachaient », « Reprise des 30 bancs
// de la vue plein écran », « quatre périmés, un vrai défaut »... et, tout récemment, le retrait de
// #guitar-override-btn qui a cassé CINQ bancs d'un coup.
//
// Le coût réel n'est pas le rouge : c'est le DÉLAI. Un banc qui vise une adresse disparue reste vert
// tant qu'il ne tourne pas, puis rougit au balayage complet — 42 minutes plus tard — ou, pire, à la
// campagne suivante, quand plus personne ne relie la cause à l'effet. Et un banc qui cherche une
// adresse morte à l'intérieur d'un `if` ne rougit même pas : il RENONCE EN SILENCE, et compte alors
// comme une couverture qu'on n'a pas (c'est exactement ce qui avait masqué la bande morte de 4px).
//
// CETTE SENTINELLE EST STATIQUE, ET C'EST TOUT L'INTÉRÊT : aucun navigateur, aucun serveur, moins
// d'une seconde. Elle peut donc tourner à CHAQUE lot sans entamer le budget de 20 minutes. Elle
// croise les adresses que les bancs citent avec celles qui existent quelque part dans le produit —
// index.html, ou une chaîne de gabarit de script.js.
//
// CE QU'ELLE NE PROUVE PAS : qu'un élément soit VISIBLE ou ATTEIGNABLE au moment où le banc le
// cherche. C'est le rôle de la sentinelle 2 (atteignabilité). Ici on ne répond qu'à une question,
// mais on y répond sans faux négatif : cette adresse existe-t-elle encore ?
const fs = require('fs');
const path = require('path');
const { check, exiger, plan, bilan } = require('./_harness')('sentinelle : adresses citées par les bancs');

const RACINE = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');

const produit = ['index.html', 'script.js', 'style.css', 'paroles.html', 'paroles.js']
    .filter(f => fs.existsSync(path.join(RACINE, f)))
    .map(lire).join('\n');

// Toutes les adresses que le PRODUIT peut offrir : celles écrites en dur dans le HTML, et celles que
// script.js fabrique dans ses gabarits (`id="seq-play"`, `id="${prefixe}-truc"`...). Les identifiants
// construits par concaténation sont irrécupérables statiquement — d'où la liste d'exceptions plus bas,
// qui les NOMME au lieu de les laisser affaiblir la sentinelle en silence.
const adressesProduit = new Set();
for (const m of produit.matchAll(/id="([a-zA-Z][a-zA-Z0-9_-]*)"/g)) adressesProduit.add(m[1]);
for (const m of produit.matchAll(/id='([a-zA-Z][a-zA-Z0-9_-]*)'/g)) adressesProduit.add(m[1]);
for (const m of produit.matchAll(/getElementById\(['"]([a-zA-Z][a-zA-Z0-9_-]*)['"]\)/g)) adressesProduit.add(m[1]);

// Identifiants assemblés à l'exécution : la recherche statique ne peut pas les voir. Chacun est ici
// avec sa raison — une exception nommée reste un garde-fou, une exception muette est un trou.
const ASSEMBLES_A_L_EXECUTION = [
    /^seq-/,        // cases, notes et étiquettes du séquenceur, numérotées par voix et par croche
    /^prog-/,       // cases de la grille, numérotées par partie et par accord
    /^guitar-draw/, // manche en mode dessin, une adresse par corde/case
];

const bancs = fs.readdirSync(path.join(RACINE, 'tests'))
    .filter(f => f.endsWith('_test.js'))
    .sort();
plan(bancs.length + 3);

const perimes = [];
let citationsTotal = 0;
for (const banc of bancs) {
    const source = lire(path.join('tests', banc));
    // Ligne par ligne, pour pouvoir juger le CONTEXTE de chaque citation — c'est ce qui distingue un
    // banc périmé d'un banc qui vérifie exprès qu'une adresse a disparu.
    // TOUTES les lignes citant l'adresse, pas seulement la première. Corrigé après avoir vu cette
    // sentinelle accuser deux bancs QUI FONT EXACTEMENT CE QU'ELLE DEMANDE : la vérification d'absence
    // tient presque toujours sur DEUX lignes — on récupère l'élément, puis on affirme qu'il est nul.
    //
    //     const oldBtn = await page.$('#btn-print');            <- la ligne citée
    //     check(!oldBtn, "l'ancien #btn-print n'existe plus");  <- celle qui porte le sens
    //
    // En ne retenant que la première, la sentinelle jugeait sur la ligne la moins parlante des deux et
    // déclarait « périmés » paroles_pdf_test et paroles_repeat_test, dont c'est justement le rôle
    // d'empêcher le retour d'un bouton supprimé. Elle poussait donc à effacer ces gardes — le pire
    // conseil possible, et sur l'outil chargé de traquer les bancs qui mentent.
    // Une adresse n'est morte que si AUCUNE de ses mentions n'attend son absence.
    const citees = new Map();  // adresse -> toutes les lignes où elle est citée
    source.split('\n').forEach(ligne => {
        const nue = ligne.trim();
        // Un commentaire n'adresse rien : il RACONTE, souvent l'histoire d'une adresse justement
        // retirée. Les compter reviendrait à punir la documentation.
        if (nue.startsWith('//') || nue.startsWith('*') || nue.startsWith('/*')) return;
        const prendre = (re, i) => { for (const m of ligne.matchAll(re)) { const a = m[i];
            // #fff, #1c2027 : une couleur CSS n'est pas une adresse.
            if (/^[0-9a-fA-F]{3}$/.test(a) || /^[0-9a-fA-F]{6}$/.test(a)) continue;
            if (!citees.has(a)) citees.set(a, []);
            citees.get(a).push(ligne); } };
        prendre(/getElementById\(['"`]([a-zA-Z][a-zA-Z0-9_-]*)['"`]\)/g, 1);
        prendre(/['"`]#([a-zA-Z][a-zA-Z0-9_-]*)['"`]/g, 1);
        prendre(/['"`]#([a-zA-Z][a-zA-Z0-9_-]*)[ .>:[,)]/g, 1);
    });

    // Une citation qui ATTEND L'ABSENCE est le contraire d'un banc périmé : c'est la garde qui
    // interdit le retour d'un élément retiré exprès (voir saisie_nom_dans_la_fenetre_test.js, qui
    // vérifie que le crayon a bien disparu). La reconnaître est indispensable, sinon la sentinelle
    // punirait précisément les bancs qui font le mieux leur travail.
    // Un banc peut FABRIQUER son propre élément — seq_selection_et_cadre_diagrammes injecte une
    // feuille de style `#banc-largeur` pour forcer une largeur. Ces adresses-là n'ont rien à voir avec
    // le produit : les compter accuserait le banc de citer ce qu'il vient lui-même de créer.
    const fabriquees = new Set();
    for (const m of source.matchAll(/\.id\s*=\s*['"`]([a-zA-Z][a-zA-Z0-9_-]*)['"`]/g)) fabriquees.add(m[1]);

    const ATTEND_ABSENCE = /count\(\)\s*===\s*0|=== null|== null|!\s*document|\bnon\b|absent|disparu|n'existe plus|retiré|supprim|=== undefined|\.length === 0|toBeNull/i;
    // L'EXONÉRATION NE SE JUGE PAS SUR LES SEULES LIGNES EXTRAITES, et c'est là que se cachait le
    // faux positif. L'extraction ci-dessus exige un guillemet collé au `#` — elle attrape donc
    // `page.$('#btn-print')` mais pas `check(!oldBtn, "l'ancien #btn-print n'existe plus")`, où le
    // dièse suit un espace au milieu d'une phrase. Résultat : la sentinelle jugeait l'adresse sur la
    // ligne qui la RÉCUPÈRE, sans jamais voir celle qui affirme sa disparition, et accusait deux bancs
    // de citer un bouton mort alors qu'ils gardent précisément la porte contre son retour.
    // On relit donc TOUTES les lignes de code du banc, pas seulement celles qu'un motif a su découper.
    // La borne `(?![\w-])` évite qu'un `#accord` exonère un `#accord-goto` voisin.
    // FENÊTRE DE DEUX LIGNES, parce que la vérification d'absence se répartit presque toujours sur
    // deux instructions et que la seconde ne répète PAS l'adresse :
    //
    //     const measureNumCheckbox = await page.$('#opt-show-measure-numbers');
    //     check(!measureNumCheckbox, "la case […] a bien disparu des options");
    //
    // Le mot qui dit tout — « disparu » — est sur la ligne 2, l'adresse sur la ligne 1, et aucune des
    // deux ne suffit seule. Juger ligne à ligne condamnait donc paroles_repeat_test, dont c'est
    // exactement le rôle d'empêcher le retour d'une option retirée à la demande de l'utilisateur.
    // Deux lignes et pas plus : au-delà, une vérification d'absence sans rapport, quelques lignes plus
    // bas, finirait par innocenter une vraie adresse morte.
    const toutesLignes = source.split('\n');
    const attendSonAbsence = (a) => {
        const motif = new RegExp('#?' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w-])');
        return toutesLignes.some((l, i) => {
            const nue = l.trim();
            if (nue.startsWith('//') || nue.startsWith('*') || nue.startsWith('/*')) return false;
            if (!motif.test(l)) return false;
            return toutesLignes.slice(i, i + 3).some(v => ATTEND_ABSENCE.test(v));
        });
    };
    const mortes = [...citees.keys()]
        .filter(a => !adressesProduit.has(a)
            && !ASSEMBLES_A_L_EXECUTION.some(re => re.test(a))
            && !fabriquees.has(a)
            && !attendSonAbsence(a));
    citationsTotal += citees.size;
    if (mortes.length) perimes.push({ banc, mortes });
    check(mortes.length === 0, `${banc} : ${citees.size} adresses citées, toutes encore offertes par le produit${mortes.length ? ' — MORTES : ' + mortes.join(', ') : ''}`);
}

check(citationsTotal > 300, `le corpus cite bien un volume significatif d'adresses (${citationsTotal}) — sinon c'est l'extraction qui est cassée, pas le produit qui est propre`);
check(adressesProduit.size > 150, `le produit offre bien un volume significatif d'adresses (${adressesProduit.size})`);
check(perimes.length === 0, `aucun banc périmé (${perimes.length}) : ${perimes.slice(0, 4).map(p => p.banc + ' -> ' + p.mortes.join('/')).join(' | ')}`);

bilan();
