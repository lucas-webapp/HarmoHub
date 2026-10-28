// Banc du VERRE dans HarmoHub — l'effet « verre dépoli » de TrainHub, dans un vrai navigateur.
//
// CE QU'IL PROTÈGE. Retour utilisateur : « un affichage de type verre comme sur TrainHub, très joli, je veux le retrouver sur toutes les
// applis. Il doit rester gérable en paramètres ». Un rendu se vérifie d'abord à l'œil — et ce banc ne remplace pas l'œil — mais quatre
// choses ne se voient PAS à l'œil et se dégradent en silence :
//
//   1. ÉTEINT, RIEN NE CHANGE. Si verre.css fuit d'une seule règle hors de `html[data-glass="1"]`, l'appli de tous ceux qui n'ont pas
//      allumé le verre change d'aspect sans prévenir. On compare donc le rendu CALCULÉ de chaque élément visible, verre.css retiré de la
//      page contre verre.css chargé mais éteint : identique, élément par élément (accueil, Paramètres, menu, confirmation, séquenceur).
//   2. LE TEXTE RESTE LISIBLE. Des fonds translucides laissent passer ce qu'ils recouvrent — y compris la couleur par défaut du navigateur,
//      que des dégradés opaques cachaient : sur la page Paroles, des pastilles BLANCHES au texte clair, illisibles, sans une erreur. Le
//      contraste texte/fond est MESURÉ, verre éteint puis allumé : tout rapport trop bas qui n'existait pas avant est une régression.
//   3. L'ATTRIBUT EST POSÉ AVANT LE PREMIER AFFICHAGE : sinon l'appli paraît un instant sans verre, puis est repeinte (un éclair).
//   4. LE REPLI. Sans flou (vieux navigateur) ou avec « moins de transparence », tout redevient opaque : chaque surface doit passer par
//      UNE variable (--glass-filter), jamais par un flou écrit en dur qu'aucun repli n'atteindrait.
//
// Et ce que l'utilisateur manie : l'interrupteur et la couleur du fond, dans Paramètres > Apparence — retenus par appareil, à jour
// quand le réglage change ailleurs, sans empiler d'abonnés à chaque ouverture, à la taille du doigt sur téléphone.
const creerHarnais = require('./_harness.js');
const { check, exiger, plan, bilan } = creerHarnais('verre dans HarmoHub');
const V = require('./_verre_commun.js');
const { chromium } = V.chargerPlaywright();

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 0, octave: 3, bass: null, playStyle: 'held' });
const PROGRESSION = JSON.stringify({ sections: [
    { title: 'Couplet', chords: [mk('C', 'maj', 4), mk('A', 'min7', 4), mk('F', 'maj7', 4), mk('G', '7', 4)] },
    { title: 'Refrain', chords: [mk('F', 'maj', 4), mk('G', 'maj', 4), mk('E', 'min7', 4), mk('A', 'min', 4)] }] });
const PRETE = () => !!window.app;
const ouvrirHH = (nav, o = {}) => V.ouvrir(nav, { url: BASE + '/index.html?nocache=' + Date.now(), prete: PRETE, ...o, reglages: { myProgression: PROGRESSION, ...(o.reglages || {}) } });
const VERRE = { 'harmohub.glass.v1': '1' };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// Le réglage lui-même n'existe que verre.js chargé : on l'écarte de la comparaison « éteint = avant ».
const EXCLURE = ['#settings-title-look', '#settings-panel-look'];

// Les états de l'interface qu'on relève, chacun avec le geste qui y mène.
const ETATS = {
    accueil: async () => {},
    parametres: async (p) => { await p.evaluate(() => window.app.openSettings()); await p.waitForTimeout(300); },
    menu: async (p) => { const c = await p.locator('.grid-cell').first().boundingBox(); await p.mouse.click(c.x + c.width / 2, c.y + c.height / 2, { button: 'right' }); await p.waitForTimeout(300); },
    confirmation: async (p) => { await p.evaluate(() => { window.app.openUnsavedModal(); }); await p.waitForTimeout(300); },
    sequenceur: async (p) => { await p.evaluate(() => window.app.editChord(0, 1)); await p.waitForTimeout(300); await p.click('#seq-zoom'); await p.waitForTimeout(600); },
};
// L'aperçu avant impression de la structure n'existe que dans les versions qui l'ont : son état n'est relevé que là.
const A_APERCU = V.lireSource('index.html').includes('id="structure-apercu"');
if (A_APERCU) ETATS.apercu = async (p) => { await p.click('#structure-btn'); await p.waitForTimeout(500); await p.click('#structure-pdf'); await p.waitForTimeout(800); };
async function fermerTout(p) { await p.keyboard.press('Escape'); await p.waitForTimeout(150); await p.evaluate(() => { try { window.app.closeSettings(); } catch (e) {} window.app.editingIndex = null; window.app.loadProgression(); }); await p.waitForTimeout(150); }

(async () => {
    plan(A_APERCU ? 64 : 63);
    const nav = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    try {
        // ===== 0. LES FICHIERS ET LEUR ORDRE (statique) ==========================================================================
        for (const page of ['index.html', 'paroles.html']) {
            const html = V.lireSource(page);
            const tete = html.slice(0, html.indexOf('</head>'));
            const balise = (tete.match(/<script[^>]*src="verre\.js[^"]*"[^>]*>/) || [''])[0];
            check(!!balise && !/\b(defer|async)\b|type="module"/.test(balise) && /data-app="harmohub"/.test(balise),
                `${page} : verre.js se charge dans <head>, sans defer ni async ni module (sinon l'attribut arrive après le premier affichage) et dit de quelle appli il est`);
            check(/href="verre\.css[^"]*"/.test(tete) && /href="verre-surfaces\.css[^"]*"/.test(tete), `${page} : verre.css (commun) et verre-surfaces.css (propre à l'appli) sont chargés`);
        }
        const surfaces = V.lireSource('verre-surfaces.css');
        const commun = V.lireSource('verre.css');
        const flousEnDur = (surfaces.match(/backdrop-filter\s*:[^;]+;/g) || []).filter((d) => !/var\(--glass-filter\)/.test(d));
        check(flousEnDur.length === 0 && !/blur\(/.test(surfaces),
            `chaque flou de verre-surfaces.css passe par var(--glass-filter) — un flou écrit en dur échapperait au repli (${flousEnDur.length} en dur)`);
        check((commun.match(/--glass-filter:\s*none/g) || []).length >= 2 && /@supports not/.test(commun) && /prefers-reduced-transparency/.test(commun),
            'le repli coupe le flou à deux endroits : navigateur sans backdrop-filter, et « moins de transparence » demandé par l\'appareil');
        const horsVerre = commun.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((b) => b.split('{')[0].trim()).filter((sel) => sel && !/^@/.test(sel) && !/html\[data-glass/.test(sel) && !/^:where\(html\[data-glass/.test(sel) && !/\.verre-/.test(sel));
        check(horsVerre.length === 0, `verre.css : toute règle est sous html[data-glass="1"] — sauf le dessin du réglage lui-même (.verre-*) ; hors de là : ${JSON.stringify(horsVerre.slice(0, 3))}`);
        const horsVerre2 = surfaces.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '').split('}').map((b) => b.split('{')[0].trim()).filter((sel) => sel && !/html\[data-glass/.test(sel));
        check(horsVerre2.length === 0, `verre-surfaces.css : AUCUNE règle hors de html[data-glass="1"] (verre éteint, rien ne s'applique) ; hors de là : ${JSON.stringify(horsVerre2.slice(0, 3))}`);

        // ===== 1. L'ATTRIBUT AVANT LE PREMIER AFFICHAGE ============================================================================
        {
            const A = await ouvrirHH(nav, { reglages: VERRE, avant: [V.enregistreurAttribut] });
            const e = await A.page.evaluate(() => window.__verreEnregistre);
            check(e.pose === true && e.bodyExistait === false && e.paintAvant === 0,
                `data-glass est posé avant que <body> n'existe et avant tout affichage (body ${e.bodyExistait ? 'déjà là' : 'absent'}, ${e.paintAvant} peinture)`);
            check(await A.page.evaluate(() => document.documentElement.getAttribute('data-glass-bg')) === 'aurora', 'et data-glass-bg avec lui (« aurora » par défaut)');
            await A.contexte.close();
        }

        // ===== 2. ÉTEINT = LE RENDU D'AVANT, ÉLÉMENT PAR ÉLÉMENT ====================================================================
        {
            const sans = await ouvrirHH(nav, { bloquer: [/verre\.css/, /verre-surfaces\.css/, /verre\.js/] });
            const avec = await ouvrirHH(nav, {});
            for (const [nom, aller] of Object.entries(ETATS)) {
                await aller(sans.page); await aller(avec.page);
                const a = await V.signature(sans.page, EXCLURE), b = await V.signature(avec.page, EXCLURE);
                const d = V.comparer(a, b);
                check(d.n === 0, `éteint, l'état « ${nom} » est IDENTIQUE à celui sans verre.css (${a.length} éléments relevés${d.n ? ', ' + d.n + ' écarts : ' + d.premieres.join(' / ') : ''})`);
                await fermerTout(sans.page); await fermerTout(avec.page);
            }
            check(await avec.page.evaluate(() => document.documentElement.hasAttribute('data-glass')) === false, 'et aucun attribut data-glass sur <html> quand le verre est éteint');
            check(sans.erreurs.length === 0 && avec.erreurs.length === 0, `aucune erreur JavaScript (${sans.erreurs.length + avec.erreurs.length}) ${sans.erreurs.concat(avec.erreurs).slice(0, 2).join(' | ')}`);
            await sans.contexte.close(); await avec.contexte.close();
        }

        // ===== 3. ALLUMÉ : LE FLOU VA OÙ IL DOIT, ET NULLE PART AILLEURS ===============================================================
        {
            const A = await ouvrirHH(nav, { reglages: VERRE });
            const p = A.page;
            const flou = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return 'ABSENT'; return getComputedStyle(e).backdropFilter; }, sel);
            const surf = {};
            for (const s of ['.control-card', '.viz-card']) surf[s] = await flou(s);
            check(Object.values(surf).every((v) => /blur\(24px\)/.test(v)), `les cartes floutent (24 px) : ${JSON.stringify(surf)}`);
            const sens = await p.evaluate(() => { const o = {}; for (const s of ['.grid-cell', '.seq-cell', '.key.white', '.chord-grid']) { const e = document.querySelector(s); o[s] = e ? getComputedStyle(e).backdropFilter : 'ABSENT'; } return o; });
            check(Object.entries(sens).every(([s, v]) => v === 'none' || v === 'ABSENT'), `JAMAIS de flou par case, par touche ni par grille (un flou par case coûterait cher sur un téléphone) : ${JSON.stringify(sens)}`);
            const sousDegrade = await V.boutonsSousDegrade(p);
            check(sousDegrade.length === 0, `aucun bouton à dégradé ne garde une couleur de fond dessous — le gris du navigateur transparaîtrait sous chaque bouton vert (${sousDegrade.length}${sousDegrade.length ? ' : ' + sousDegrade.slice(0, 3).join(' ; ') : ''})`);
            const opaques = await V.boutonsDegradeOpaque(p);
            check(opaques.length === 0, `ni aucun dégradé de bouton qui finisse sur une couleur pleine — un bouton moitié verre, moitié tuile ardoise (${opaques.length}${opaques.length ? ' : ' + opaques.slice(0, 3).join(' ; ') : ''})`);
            check(await flou('.top-bar') === 'none', `sur ordinateur la barre du haut ne floute PAS : ce sont des pastilles flottantes, un flou sur le conteneur dessinerait un rectangle flou derrière elles (${await flou('.top-bar')})`);
            await ETATS.parametres(p);
            check(/blur\(24px\)/.test(await flou('.settings-modal')), 'la fenêtre Paramètres floute ce qu\'elle recouvre');
            const fen = await p.evaluate(() => ({ img: getComputedStyle(document.querySelector('#settings-overlay .settings-modal')).backgroundImage, couleur: getComputedStyle(document.querySelector('#settings-overlay .settings-modal')).backgroundColor, titre: getComputedStyle(document.querySelector('.settings-group-title')).backgroundColor }));
            check(/gradient/.test(fen.img) && /rgba\(7, 11, 18, 0\.6\)/.test(fen.couleur), 'les fenêtres ont une sous-couche sombre sous leur teinte (sans elle, du clair derrière — les touches du piano — les grisonne)');
            check(/rgb\(\d+, \d+, \d+\)$/.test(fen.titre), `les titres de groupe collants des Paramètres sont OPAQUES (${fen.titre}) : translucides, le contenu qui défile dessous les traverserait`);
            await fermerTout(p); await ETATS.menu(p);
            check(/blur\(24px\)/.test(await flou('#context-menu')), 'le menu contextuel aussi');
            const menu = await p.evaluate(() => { const cs = getComputedStyle(document.getElementById('context-menu')); return { img: cs.backgroundImage, couleur: cs.backgroundColor }; });
            check(/gradient/.test(menu.img) && /rgba\(7, 11, 18, 0\.6\)/.test(menu.couleur), 'et lui aussi a sa sous-couche sombre (sinon il grisonne sur ce qu\'il recouvre)');
            await fermerTout(p);
            const fond = await p.evaluate(() => getComputedStyle(document.body).backgroundImage);
            check(/linear-gradient/.test(fond), 'le fond de la page est le dégradé « aurore »');
            const cartes = await p.evaluate(() => { const c = getComputedStyle(document.querySelector('.control-card')).backgroundColor; const m = c.match(/rgba?\(([^)]+)\)/)[1].split(',').map(Number); return m.length > 3 ? m[3] : 1; });
            check(cartes > 0 && cartes < 0.2, `les cartes sont TRANSLUCIDES (opacité ${cartes}) : c'est ce qui laisse voir l'aurore`);
            // LES COULEURS MUSICALES : le verre habille le cadre, pas le contenu.
            const touches = await p.evaluate(() => { const e = document.querySelector('.key.white'); return e ? getComputedStyle(e).backgroundImage + '|' + getComputedStyle(e).backgroundColor : null; });
            const B = await ouvrirHH(nav, {});
            const touchesOff = await B.page.evaluate(() => { const e = document.querySelector('.key.white'); return e ? getComputedStyle(e).backgroundImage + '|' + getComputedStyle(e).backgroundColor : null; });
            check(touches !== null && touches === touchesOff, 'les touches blanches du piano gardent EXACTEMENT leurs couleurs (le verre habille le cadre, pas le contenu musical)');
            if (A_APERCU) {
                // LA FEUILLE DE STRUCTURE (aperçu / PDF) est du papier, avec ses couleurs en dur : elle ne doit pas bouger d'un pixel.
                await fermerTout(p); await ETATS.apercu(p); await ETATS.apercu(B.page);
                const feuilleDe = (pg) => pg.evaluate(() => [...document.querySelectorAll('#apercu-pages .sf-contenu, #apercu-pages .sf-contenu *')].map((e) => { const cs = getComputedStyle(e); return [e.tagName, e.className && e.className.baseVal === undefined ? e.className : '', cs.backgroundColor, cs.backgroundImage, cs.color, cs.borderTopColor, cs.boxShadow, cs.filter, cs.opacity].join('|'); }));
                const fa = await feuilleDe(p), fb = await feuilleDe(B.page);
                const fondFeuille = await p.evaluate(() => getComputedStyle(document.querySelector('#apercu-pages .sf-page')).backgroundColor);
                check(fa.length > 10 && fa.length === fb.length && fa.every((x, k) => x === fb[k]) && fondFeuille === 'rgb(255, 255, 255)', `la FEUILLE de structure (aperçu et PDF) reste du papier blanc, ses ${fa.length} éléments identiques verre éteint : elle a ses couleurs en dur, le verre n'y touche pas`);
                await fermerTout(p);
            } else {
                check(await p.locator('#structure-apercu').count() === 0, 'cette version n\'a pas d\'aperçu de structure : il n\'y a pas de feuille à protéger (le banc la compare dès qu\'elle existe)');
            }
            // LE REPLI : le flou ne dépend que d'une variable — la couper (ce que fait « moins de transparence ») coupe tout.
            await p.evaluate(() => document.documentElement.style.setProperty('--glass-filter', 'none'));
            const apres = await p.evaluate(() => ['.control-card', '.viz-card'].map((s) => getComputedStyle(document.querySelector(s)).backdropFilter));
            check(apres.every((v) => v === 'none'), `repli : --glass-filter à « none » coupe le flou de toutes les surfaces (${apres.join(', ')})`);
            check(A.erreurs.length === 0, `aucune erreur JavaScript (${A.erreurs.length}) ${A.erreurs.slice(0, 2).join(' | ')}`);
            await A.contexte.close(); await B.contexte.close();
        }

        // ===== 4. LE TEXTE RESTE LISIBLE ===========================================================================================
        {
            const off = await ouvrirHH(nav, {});
            const on = await ouvrirHH(nav, { reglages: VERRE });
            let total = 0; const nouveaux = [];
            for (const [nom, aller] of Object.entries(ETATS)) {
                await aller(off.page); await aller(on.page);
                const a = await V.contrastesFaibles(off.page), b = await V.contrastesFaibles(on.page);
                total += b.length;
                for (const f of b) if (!a.some((g) => g.cle === f.cle)) nouveaux.push(`${nom}: ${f.cle} (${f.rapport})`);
                await fermerTout(off.page); await fermerTout(on.page);
            }
            check(nouveaux.length === 0, `aucun texte devenu illisible par le verre sur cinq états (${nouveaux.length} nouveaux contrastes < 3:1${nouveaux.length ? ' : ' + nouveaux.slice(0, 4).join(' ; ') : ''})`);
            await off.contexte.close(); await on.contexte.close();
        }

        // ===== 5. LA PAGE PAROLES SUIT LE MÊME RÉGLAGE ===============================================================================
        {
            const fs = require('fs'), os = require('os'), path = require('path');
            const fichier = path.join(os.tmpdir(), 'verre-paroles.json');
            fs.writeFileSync(fichier, JSON.stringify({ version: 1, song: 'Verre', songId: 'verre-1', beatsPerBar: 4, sections: [{ title: 'Couplet', chords: [{ symbol: 'C', beats: 4 }, { symbol: 'G', beats: 4 }] }] }));
            let schema = null;
            const lire = async (reglages) => {
                const P = await V.ouvrir(nav, { url: BASE + '/paroles.html?nocache=' + Date.now(), reglages });
                await P.page.setInputFiles('#file-input', fichier); await P.page.waitForTimeout(500);
                const r = { schema: await P.page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), attr: await P.page.evaluate(() => document.documentElement.getAttribute('data-glass')), faibles: await V.contrastesFaibles(P.page), pastille: await P.page.evaluate(() => { const e = document.querySelector('.chord-chip'); return e ? getComputedStyle(e).backgroundColor : null; }), sousDegrade: await V.boutonsSousDegrade(P.page), opaques: await V.boutonsDegradeOpaque(P.page), erreurs: P.erreurs };
                await P.contexte.close(); return r;
            };
            const off = await lire({}), on = await lire(VERRE);
            check(on.attr === '1' && off.attr === null, 'Paroles suit le réglage de HarmoHub (mêmes clés) : allumé ici, allumé là');
            check(on.schema === 'dark', `et dit au navigateur que le document est sombre (color-scheme: ${on.schema}) — Paroles ne le disait pas : barres de défilement et champs natifs restaient clairs`);
            const nouveaux = on.faibles.filter((f) => !off.faibles.some((g) => g.cle === f.cle));
            check(nouveaux.length === 0, `Paroles : aucun texte illisible en verre (${nouveaux.length}${nouveaux.length ? ' : ' + JSON.stringify(nouveaux.slice(0, 3)) : ''})`);
            check(on.pastille && !/^rgb\((23\d|24\d|25\d), (23\d|24\d|25\d), (23\d|24\d|25\d)\)$/.test(on.pastille),
                `les pastilles d'accord n'ont plus la couleur claire par défaut du navigateur (${on.pastille}) — c'était des pastilles blanches au texte clair`);
            check(on.sousDegrade.length === 0, `Paroles : aucun bouton à dégradé ne garde une couleur de fond dessous — le gris/blanc du navigateur traverserait les dégradés translucides (${on.sousDegrade.length}${on.sousDegrade.length ? ' : ' + on.sousDegrade.slice(0, 3).join(' ; ') : ''})`);
            check(on.opaques.length === 0, `Paroles : aucun dégradé de bouton ne finit sur une couleur pleine (${on.opaques.length}${on.opaques.length ? ' : ' + on.opaques.slice(0, 3).join(' ; ') : ''})`);
            check(on.erreurs.length === 0 && off.erreurs.length === 0, 'aucune erreur JavaScript sur Paroles');
        }

        // ===== 6. LE RÉGLAGE : Paramètres > Apparence ================================================================================
        {
            const A = await ouvrirHH(nav, {});
            const p = A.page;
            await ETATS.parametres(p);
            const g = await p.evaluate(() => ({
                titre: document.getElementById('settings-title-look').textContent, visible: !document.getElementById('settings-title-look').hidden,
                interrupteur: document.getElementById('toggle-glass').getAttribute('aria-checked'),
                pastilles: [...document.querySelectorAll('#look-fonds .verre-fond')].map((b) => b.dataset.fond),
                etiquettees: [...document.querySelectorAll('#look-fonds .verre-fond')].every((b) => b.getAttribute('aria-label') && b.getAttribute('role') === 'radio'),
                opacite: getComputedStyle(document.getElementById('look-fonds')).opacity,
                rondes: [...document.querySelectorAll('#look-fonds .verre-fond')].every((b) => { const r = b.getBoundingClientRect(); return Math.abs(r.width - r.height) < 1 && r.width <= 48; }),
                cochees: document.querySelectorAll('#look-fonds .verre-fond[aria-checked="true"]').length,
                estompe: document.getElementById('look-fond-row').dataset.verre,
            }));
            exiger(g.visible && g.titre === 'Apparence', 'Paramètres a un groupe « Apparence »');
            check(g.interrupteur === 'false' && g.estompe === 'off', 'verre éteint par défaut : l\'interrupteur est à l\'arrêt, les pastilles de couleur estompées (elles ne changent rien tant qu\'il est éteint)');
            check(g.pastilles.join() === 'aurora,blue,green,violet,rose,amber,grey' && g.cochees === 1 && g.etiquettees, 'sept pastilles de couleur, une seule cochée, chacune un bouton radio nommé (lecteur d\'écran)');
            check(g.rondes && +g.opacite < 0.6, `les pastilles sont des ronds de 48 px au plus (la règle générique « button » les ferait de 120 px) et verre éteint elles s'estompent (opacité ${g.opacite})`);
            await p.click('#toggle-glass');
            await p.waitForTimeout(150);
            const allume = await p.evaluate(() => ({ attr: document.documentElement.getAttribute('data-glass'), stocke: localStorage.getItem('harmohub.glass.v1'), coche: document.getElementById('toggle-glass').getAttribute('aria-checked'), estompe: document.getElementById('look-fond-row').dataset.verre, fond: getComputedStyle(document.body).backgroundImage }));
            check(allume.attr === '1' && allume.stocke === '1' && allume.coche === 'true' && allume.estompe === 'on' && /gradient/.test(allume.fond), 'cliquer l\'interrupteur allume le verre tout de suite (rien à recharger), le retient, et rend leur éclat aux pastilles');
            await p.click('#look-fonds [data-fond="violet"]');
            await p.waitForTimeout(150);
            const violet = await p.evaluate(() => ({ attr: document.documentElement.getAttribute('data-glass-bg'), stocke: localStorage.getItem('harmohub.glassBg.v1'), coche: document.querySelector('#look-fonds [aria-checked="true"]').dataset.fond, bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() }));
            check(violet.attr === 'violet' && violet.stocke === 'violet' && violet.coche === 'violet', 'choisir « violet » change le fond, le retient, et coche la bonne pastille');
            check(/^hsl\(266/.test(violet.bg) || /^#/.test(violet.bg) === false, `et la couleur du fond change réellement (--bg = ${violet.bg}), pas seulement un attribut`);
            // Rouvrir la fenêtre : rien ne s'empile.
            const n1 = await p.evaluate(() => window.Verre.nbAbonnes());
            for (let i = 0; i < 4; i++) { await p.evaluate(() => { window.app.closeSettings(); window.app.openSettings(); }); }
            const n2 = await p.evaluate(() => ({ abonnes: window.Verre.nbAbonnes(), pastilles: document.querySelectorAll('#look-fonds .verre-fond').length }));
            check(n2.abonnes === n1 && n2.pastilles === 7, `rouvrir quatre fois la fenêtre n'empile ni abonnés (${n1} → ${n2.abonnes}) ni pastilles (${n2.pastilles})`);
            // Changement venu d'un AUTRE onglet de l'appareil
            await p.evaluate(() => { localStorage.setItem('harmohub.glassBg.v1', 'rose'); window.dispatchEvent(new StorageEvent('storage', { key: 'harmohub.glassBg.v1', newValue: 'rose' })); });
            await p.waitForTimeout(100);
            const rose = await p.evaluate(() => ({ attr: document.documentElement.getAttribute('data-glass-bg'), coche: document.querySelector('#look-fonds [aria-checked="true"]').dataset.fond }));
            check(rose.attr === 'rose' && rose.coche === 'rose', 'un réglage changé dans un autre onglet de l\'appareil s\'applique ici et recoche la pastille, sans recharger');
            await p.evaluate(() => { localStorage.setItem('harmohub.glass.v1', '0'); window.dispatchEvent(new StorageEvent('storage', { key: 'harmohub.glass.v1', newValue: '0' })); });
            await p.waitForTimeout(100);
            const eteint = await p.evaluate(() => ({ attr: document.documentElement.hasAttribute('data-glass'), coche: document.getElementById('toggle-glass').getAttribute('aria-checked'), ligne: document.getElementById('look-fond-row').dataset.verre }));
            check(!eteint.attr && eteint.coche === 'false' && eteint.ligne === 'off', 'et l\'interrupteur suit lui aussi (éteint ailleurs, éteint ici, pastilles estompées) — la fenêtre ne ment pas sur l\'état');
            await p.evaluate(() => { localStorage.setItem('harmohub.glass.v1', '1'); window.dispatchEvent(new StorageEvent('storage', { key: 'harmohub.glass.v1', newValue: '1' })); });
            await p.waitForTimeout(100);
            // Persistance
            await p.reload({ waitUntil: 'load' }); await p.waitForFunction(PRETE); await p.waitForTimeout(500);
            const apres = await p.evaluate(() => ({ glass: document.documentElement.getAttribute('data-glass'), bg: document.documentElement.getAttribute('data-glass-bg') }));
            check(apres.glass === '1' && apres.bg === 'rose', 'rechargé : le verre est toujours allumé, dans la même couleur');
            await ETATS.parametres(p);
            await p.click('#toggle-glass'); await p.waitForTimeout(150);
            check(await p.evaluate(() => !document.documentElement.hasAttribute('data-glass') && localStorage.getItem('harmohub.glass.v1') === '0'), 'l\'éteindre retire l\'attribut : on retrouve le rendu d\'avant');
            check(A.erreurs.length === 0, `aucune erreur JavaScript pendant le réglage (${A.erreurs.length}) ${A.erreurs.slice(0, 2).join(' | ')}`);
            await A.contexte.close();
        }

        // ===== 7. SANS verre.js : pas de commande qui ne ferait rien ====================================================================
        {
            const A = await ouvrirHH(nav, { bloquer: [/verre\.js/] });
            await ETATS.parametres(A.page);
            const r = await A.page.evaluate(() => ({ titre: document.getElementById('settings-title-look').hidden, panneau: document.getElementById('settings-panel-look').hidden, verre: typeof window.Verre }));
            check(r.titre && r.panneau && r.verre === 'undefined', 'verre.js absent : le groupe « Apparence » se masque (pas d\'interrupteur qui ne ferait rien)');
            check(A.erreurs.length === 0, `et aucune erreur JavaScript (${A.erreurs.length}) ${A.erreurs.slice(0, 2).join(' | ')}`);
            await A.contexte.close();
        }

        // ===== 8. TÉLÉPHONE ===========================================================================================================
        {
            for (const largeur of [390, 320]) {
                const A = await ouvrirHH(nav, { viewport: { width: largeur, height: 800 }, tactile: true, reglages: VERRE });
                const p = A.page;
                const mesure = await p.evaluate(() => ({ debord: document.documentElement.scrollWidth - document.documentElement.clientWidth, barre: [...document.querySelector('.top-bar').children].filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect()).some((r) => r.left < -0.5 || r.right > innerWidth + 0.5), flou: getComputedStyle(document.querySelector('.top-bar')).backdropFilter }));
                check(mesure.debord <= 0 && !mesure.barre, `téléphone ${largeur}px, verre allumé : la page ne déborde pas (${mesure.debord}px) et tous les boutons de la barre du haut restent à l'écran`);
                if (largeur === 390) check(/blur\(24px\)/.test(mesure.flou), `sur téléphone la barre du haut est une vraie barre : elle floute comme les autres surfaces, à 24 px (style.css lui donne déjà son propre flou de 6 px, qui ne doit pas rester) : ${mesure.flou}`);
                await ETATS.parametres(p);
                const t = await p.evaluate(() => [...document.querySelectorAll('#look-fonds .verre-fond')].map((b) => { const r = b.getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); }));
                check(t.length === 7 && Math.min(...t) >= 38, `les pastilles de couleur sont assez grandes pour le doigt (${Math.min(...t)} px au minimum sur ${largeur}px)`);
                const hors = await p.evaluate(() => [...document.querySelectorAll('#look-fonds .verre-fond')].some((b) => { const r = b.getBoundingClientRect(); return r.right > innerWidth + 0.5 || r.left < -0.5; }));
                check(!hors, `et aucune ne sort de l'écran à ${largeur}px`);
                await A.contexte.close();
            }
        }
    } finally { await nav.close(); }
    bilan();
})().catch((e) => { console.error(e); process.exit(1); });
