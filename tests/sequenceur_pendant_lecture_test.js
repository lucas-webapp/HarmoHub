// LE SÉQUENCEUR PENDANT LA LECTURE (L9b, 15/11) : poser, étirer, déplacer des barres PENDANT que le morceau joue (ordinateur, souris).
//
// SES MOTS : « Pendant que la lecture est en cours, je n'arrive pas à créer des barres et à les étirer. » ; « J'ai essayé de poser une barre d'une certaine longueur et ça ne fonctionne pas.
// D'abord tu poses la barre avec un temps, puis je dois l'étirer. J'aimerais pouvoir la créer tout en l'étirant en même temps. » (l'utilisateur, 15/11 ; appareil : « sur ordinateur »).
//
// POURQUOI CE BANC : le défaut n'a PAS pu être reproduit (Playwright, Chromium, souris) ; il garde donc ici ce qui marche, dans toutes les conditions qu'on a pu imaginer, pour qu'une
// régression ne le recrée pas : lecture réelle (isPlaying), glissé rapide (un seul mouvement), lent (une seconde), avec et sans accord choisi, avec une plage à boucler et l'anneau de boucle,
// et un glissé qui TRAVERSE le moment où la lecture passe à la ligne suivante de la grille. Chaque geste doit écrire la barre ENTIÈRE, d'un seul trait, en une annulation.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('séquenceur pendant la lecture');
const { estBruitReseau } = require('./_harness');
const V = require('./_verre_commun');

plan(34);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const mk = (r, q) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
// Huit accords = deux lignes de la grille ; 240 BPM (le maximum du curseur) : une ligne de 16 temps dure 4 s, la lecture change de ligne vite.
const PARTIE = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7'), mk('E', 'min7'), mk('A', 'dom7'), mk('D', 'min7'), mk('G', 'dom7')] }];

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async () => {
        const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
        await ctx.addInitScript((S) => {
            if (sessionStorage.getItem('banc-sq-lecture')) return;
            sessionStorage.setItem('banc-sq-lecture', '1');
            localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), bpm: 240, sections: S }]));
            localStorage.setItem('harmohubCurrentSongId', 's1');
            localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
            sessionStorage.setItem('cc_accueil_vu', '1');
            localStorage.setItem('harmohubSequenceurOuvert', '1');
            localStorage.setItem('harmohubSequenceurVue', 'voix');
        }, PARTIE);
        await ctx.route(/gstatic\.com|googleapis\.com|tonejs\.github\.io/, r => r.abort());
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !V.BRUIT.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.waitForFunction(() => !!window.app);
        await p.waitForTimeout(900);
        return { p, ctx };
    };
    // Lecture de l'état (jamais pour agir).
    const etat = (p) => p.evaluate(() => ({
        joue: !!window.app.isPlaying, choisi: window.app.selectedIndex, boucle: window.app.loopRange ? { ...window.app.loopRange } : null,
        noms: [...document.querySelectorAll('.sq-nom')].map(e => +e.dataset.c),
        bpm: window.app.tempoCourant(),
    }));
    // Les croches allumées d'une ligne (r) d'un accord (c), lues dans l'écran : { k, soudeGauche }.
    const lignes = (p, c, r) => p.evaluate(([c, r]) => [...document.querySelectorAll(`#sq-grille .sq-case.on[data-c="${c}"][data-r="${r}"]`)].map(e => ({ k: +e.dataset.k, g: e.classList.contains('soude-g') })).sort((a, b) => a.k - b.k), [c, r]);
    const modele = (p, c) => p.evaluate((c) => { const d = JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[c]; return JSON.stringify(d.arpPattern || null); }, c);
    const centre = async (p, c, r, k) => { const b = await p.locator(`#sq-grille .sq-case[data-c="${c}"][data-r="${r}"][data-k="${k}"]`).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, l: b.x, r: b.x + b.width }; };
    // Un VRAI glissé : appui, `pas` mouvements espacés de `ms`, relâchement.
    const glisser = async (p, de, vers, pas, ms) => {
        await p.mouse.move(de.x, de.y); await p.mouse.down();
        for (let i = 1; i <= pas; i++) { await p.mouse.move(de.x + (vers.x - de.x) * i / pas, de.y + (vers.y - de.y) * i / pas); if (ms) await p.waitForTimeout(ms); }
        await p.mouse.up(); await p.waitForTimeout(250);
    };
    const barre = (liste, de, a) => liste.length === a - de + 1 && liste.every((x, i) => x.k === de + i) && liste.slice(1).every(x => x.g);
    const joue = async (p) => { await p.click('#play-prog'); return p.waitForFunction(() => window.app.isPlaying && document.querySelector('#sq-grille .sq-case.tete'), null, { timeout: 5000 }).then(() => true, () => false); };

    // ======================================================================================================
    console.log('\n=== A. Lecture réelle, aucun accord choisi : poser, glisser vite, glisser lentement, étirer, déplacer ===');
    let { p, ctx } = await ouvrir();
    let e = await etat(p);
    exiger(e.choisi == null && e.bpm === 240 && e.noms.join() === '0,1,2,3', `départ : aucun accord choisi, 240 BPM, le séquenceur montre la première ligne (${e.noms.join(' ')})`);
    await p.click('#sq-effacer'); await p.waitForTimeout(300);
    check((await Promise.all([0, 1, 2, 3].map(r => lignes(p, 0, r)))).every(l => l.length === 0), 'l\'accord 1 est vidé (« Effacer ») : quatre lignes sans une note');
    exiger(await joue(p), 'la lecture démarre (isPlaying) : la croche qui sonne est marquée');
    // 1. un clic sur une case vide
    let c = await centre(p, 0, 0, 3);
    await p.mouse.click(c.x, c.y); await p.waitForTimeout(300);
    let l = await lignes(p, 0, 0);
    e = await etat(p);
    check(l.length === 1 && l[0].k === 3 && e.joue, `un clic pose UNE croche pendant la lecture, et la lecture continue (${l.map(x => x.k)})`);
    // 2. un glissé rapide : un seul mouvement de 5 croches
    let de = await centre(p, 0, 1, 0), vers = await centre(p, 0, 1, 4);
    await glisser(p, de, vers, 1, 0);
    l = await lignes(p, 0, 1);
    check(barre(l, 0, 4), `glissé RAPIDE (un seul mouvement) : une barre de 5 croches soudées d'un trait (${l.map(x => x.k)})`);
    // 3. un glissé lent : une seconde
    de = await centre(p, 0, 2, 0); vers = await centre(p, 0, 2, 4);
    await glisser(p, de, vers, 25, 40);
    l = await lignes(p, 0, 2);
    e = await etat(p);
    check(barre(l, 0, 4) && e.joue, `glissé LENT (une seconde) : la même barre de 5 croches, et la lecture continue (${l.map(x => x.k)})`);
    await p.waitForTimeout(1500);
    check(barre(await lignes(p, 0, 1), 0, 4) && barre(await lignes(p, 0, 2), 0, 4), 'les deux barres sont toujours là une seconde et demie plus tard (rien ne les défait)');
    // 4. la poignée droite de la première barre : l'étirer de deux croches
    de = await centre(p, 0, 1, 4);
    const bord = await p.locator('#sq-grille .sq-case[data-c="0"][data-r="1"][data-k="4"] .sq-bord.d').first().boundingBox();
    vers = await centre(p, 0, 1, 6);
    await glisser(p, { x: bord.x + bord.width / 2, y: bord.y + bord.height / 2 }, { x: vers.x, y: de.y }, 8, 30);
    l = await lignes(p, 0, 1);
    check(barre(l, 0, 6), `la poignée étire la barre de deux croches pendant la lecture (${l.map(x => x.k)})`);
    // 5. déplacer la deuxième barre d'une ligne vers le bas
    de = await centre(p, 0, 2, 2); vers = await centre(p, 0, 3, 2);
    await glisser(p, de, vers, 8, 30);
    l = await lignes(p, 0, 3);
    check(barre(l, 0, 4) && (await lignes(p, 0, 2)).length === 0, `déplacer la barre d'une ligne vers le bas pendant la lecture : elle y est tout entière, l'ancienne place est vide (${l.map(x => x.k)})`);
    // 6. une seule annulation défait toute la barre
    const avantAnnulation = (await lignes(p, 0, 3)).length;
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
    check(avantAnnulation === 5 && (await lignes(p, 0, 3)).length === 0 && (await lignes(p, 0, 2)).length === 5, 'Ctrl+Z défait le déplacement en UNE fois (la barre est revenue à sa ligne)');
    e = await etat(p);
    check(e.joue, 'la lecture jouait encore tout ce temps');
    await p.click('#stop'); await p.waitForTimeout(300);
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== B. Avec un accord choisi, et la barre se pose sur un autre accord de la ligne ===');
    ({ p, ctx } = await ouvrir());
    await p.click('.sq-nom[data-c="1"]'); await p.waitForTimeout(250);
    await p.click('#sq-effacer'); await p.waitForTimeout(300);
    e = await etat(p);
    exiger(e.choisi === 1, `l'accord 2 est choisi et vidé (${e.choisi})`);
    exiger(await joue(p), 'la lecture démarre');
    de = await centre(p, 1, 2, 1); vers = await centre(p, 1, 2, 5);
    await glisser(p, de, vers, 3, 20);
    l = await lignes(p, 1, 2);
    check(barre(l, 1, 5), `un glissé de 5 croches sur l'accord choisi pendant la lecture : la barre entière (${l.map(x => x.k)})`);
    const modeleApres = await modele(p, 1);
    check(modeleApres !== 'null' && modeleApres.length > 4, 'et elle est ENREGISTRÉE dans le morceau (pas seulement à l\'écran)');
    await p.waitForTimeout(600);
    check((await etat(p)).joue && barre(await lignes(p, 1, 2), 1, 5), 'la lecture continue et la barre est toujours là');
    await p.click('#stop'); await p.waitForTimeout(300);
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== C. Plage à boucler orange et anneau de boucle ===');
    ({ p, ctx } = await ouvrir());
    await p.click('#sq-effacer'); await p.waitForTimeout(300);
    // la plage : un glissé sur la règle des temps, de l'accord 1 à l'accord 2
    de = await p.locator('#sq-grille .sq-temps[data-c="0"][data-k="0"]').boundingBox();
    vers = await p.locator('#sq-grille .sq-temps[data-c="1"][data-k="4"]').boundingBox();
    await glisser(p, { x: de.x + de.width / 2, y: de.y + de.height / 2 }, { x: vers.x + vers.width / 2, y: vers.y + vers.height / 2 }, 6, 20);
    e = await etat(p);
    exiger(e.boucle && e.boucle.startIndex === 0 && e.boucle.endIndex === 1, `une plage à boucler est posée sur la règle (accords ${e.boucle ? e.boucle.startIndex + ' à ' + e.boucle.endIndex : '—'})`);
    check(await p.evaluate(() => document.getElementById('boucle-btn').getAttribute('aria-pressed') === 'true' && window.app.bouclerLecture === true), 'poser la plage allume l\'anneau de boucle (la lecture répétera la plage)');
    exiger(await joue(p), 'la lecture démarre sur la plage, en boucle');
    de = await centre(p, 0, 1, 0); vers = await centre(p, 0, 1, 4);
    await glisser(p, de, vers, 5, 30);
    l = await lignes(p, 0, 1);
    check(barre(l, 0, 4), `plage orange + boucle : la barre de 5 croches est posée d'un trait (${l.map(x => x.k)})`);
    await p.waitForTimeout(2500);
    check((await etat(p)).joue && barre(await lignes(p, 0, 1), 0, 4), 'après un tour de boucle (2,5 s à 240 BPM) elle est toujours là, la lecture aussi');
    await p.click('#stop'); await p.waitForTimeout(300);
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== D. Un glissé qui traverse le changement de ligne que la lecture suit ===');
    ({ p, ctx } = await ouvrir());
    await p.click('#sq-effacer'); await p.waitForTimeout(300);
    await p.mouse.click(1380, 250); await p.waitForTimeout(250);   // à côté des accords, dans la grille : plus aucun accord choisi
    e = await etat(p);
    exiger(e.choisi == null && e.noms.join() === '0,1,2,3', `aucun accord choisi (${e.choisi}) : la lecture suit la ligne qui sonne`);
    await p.click('#boucle-btn'); await p.waitForTimeout(200);   // en boucle : la lecture ne s'arrête pas d'elle-même si la machine est chargée (le morceau ne dure que 8 s)
    exiger(await joue(p), 'la lecture démarre');
    await p.waitForTimeout(1300);   // ≈ 5 temps : la lecture est dans l'accord 2, la ligne 2 de la grille arrive à 4 s
    de = await centre(p, 0, 1, 0); vers = await centre(p, 0, 1, 7);
    await p.mouse.move(de.x, de.y); await p.mouse.down();
    for (let i = 1; i <= 30; i++) { await p.mouse.move(de.x + (vers.x - de.x) * i / 30, de.y); await p.waitForTimeout(100); }   // trois secondes : le temps 16 (4 s) tombe dans le geste
    const pendant = await etat(p);
    await p.mouse.up(); await p.waitForTimeout(300);
    l = await lignes(p, 0, 1);
    check(pendant.noms.join() === '0,1,2,3' && pendant.joue, `pendant le geste, la lecture ne change pas la ligne sous la main (${pendant.noms.join(' ')})`);
    check(barre(l, 0, 7), `la barre de 8 croches est entière après un glissé de trois secondes (${l.map(x => x.k)})`);
    e = await etat(p);
    check(e.choisi === 0, `le glissé a CHOISI l'accord où l'on dessine (accord ${e.choisi}) : la lecture ne l'emmène pas ailleurs`);
    await p.waitForTimeout(2500);
    e = await etat(p);
    check(e.noms.join() === '0,1,2,3' && e.joue && barre(await lignes(p, 0, 1), 0, 7), `trois secondes plus tard, la vue est toujours sur la ligne dessinée, la barre dessus (${e.noms.join(' ')})`);
    await p.click('#stop'); await p.waitForTimeout(300);
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== E. Rien de choisi : la lecture ne change pas la ligne sous la souris qui vise ===');
    ({ p, ctx } = await ouvrir());
    e = await etat(p);
    exiger(e.choisi == null && e.noms.join() === '0,1,2,3', 'aucun accord choisi : le séquenceur suit la ligne qui sonne');
    await p.click('#boucle-btn'); await p.waitForTimeout(200);   // en boucle : le morceau ne dure que 8 s
    exiger(await joue(p), 'la lecture démarre');
    de = await centre(p, 0, 2, 3);
    await p.mouse.move(de.x, de.y); await p.waitForTimeout(5200);   // la lecture passe à la ligne suivante de la grille à 4 s (240 BPM)
    e = await etat(p);
    check(e.joue && e.noms.join() === '0,1,2,3', `la souris sur les cases : la vue reste sur la ligne visée alors que la lecture est passée à la suivante (${e.noms.join(' ')})`);
    await p.mouse.move(700, 25);   // la main quitte les cases
    const suit = await p.waitForFunction(() => [...document.querySelectorAll('.sq-nom')].some(n => n.dataset.c === '4'), null, { timeout: 2500 }).then(() => true, () => false);
    check(suit, 'dès que la souris quitte les cases, la vue rejoint la ligne qui sonne (le suivi de la lecture marche toujours)');
    await p.click('#stop'); await p.waitForTimeout(300);
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== F. Une exception audio ne casse pas le geste ===');
    ({ p, ctx } = await ouvrir());
    await p.click('#sq-effacer'); await p.waitForTimeout(300);
    exiger(await joue(p), 'la lecture démarre');
    // Un défaut de l'instrument sonore (Tone : « start time », échantillons pas prêts) injecté dans la mise à jour en direct de la lecture : le geste doit aller au bout.
    await p.evaluate(() => { window.app.liveUpdateProgressionChord = () => { throw new Error('Tone : instrument pas prêt (essai)'); }; });
    const avantErreurs = erreurs.length;
    de = await centre(p, 0, 1, 0); vers = await centre(p, 0, 1, 4);
    await glisser(p, de, vers, 8, 40);
    l = await lignes(p, 0, 1);
    check(barre(l, 0, 4) && erreurs.length === avantErreurs, `la mise à jour en direct de la lecture échoue : la barre de 5 croches est posée quand même, sans erreur de page (${l.map(x => x.k)})`);
    await p.click('#stop'); await p.waitForTimeout(300);
    await p.close(); await ctx.close();

    check(erreurs.length === 0, `aucune erreur de page ni de console (${erreurs.slice(0, 3).join(' | ')})`);
    await nav.close();
    bilan();
})().catch(e => { console.log('FATAL ' + (e && e.stack || e)); process.exit(1); });
