const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// Retour utilisateur : « j'ai encore beaucoup de mal à scroller dans le séquenceur sur le téléphone.
// À chaque fois que je veux scroller, je crée une note non voulue ou je modifie une note sans faire
// exprès. Des fois ça fonctionne bien et la barre de défilement apparaît. C'est trop aléatoire.
// Regarder ce que ça donne sur ordinateur également. »
let PASS = 0, FAIL = 0;
const check = (c, l) => { if (c) { PASS++; console.log('PASS - ' + l); } else { FAIL++; console.log('FAIL - ' + l); } };
const SCR = __dirname + '/';

// `ecraser: false` garde le morceau déjà en mémoire — indispensable quand un point de contrôle vient
// d'y poser un motif particulier : le réécrire ici l'effacerait sans bruit.
async function ouvrir(page, ecraser = true) {
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    if (ecraser) await page.evaluate(() => {
        const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 0, octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            mk('C', 'maj', 4), mk('A', 'min7', 4), mk('D', 'min7', 2), mk('G', '7', 6), mk('C', 'maj7', 4)] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.evaluate(() => window.app.editChord(0, 1));
    await page.waitForTimeout(300);
    await page.click('#grid-zoom');
    await page.waitForTimeout(700);
    await page.evaluate(() => document.querySelector('.seq-dock-panel').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(400);
}

// Une case ÉDITABLE bien au centre de la bande visible : c'est là que le doigt tombe naturellement,
// et c'est le cas qui posait problème (avant, tout glissé y peignait).
const caseTouchable = (page, selecteur = '.seq-cell') => page.evaluate((sel) => {
    // Le rectangle ne suffit pas à savoir si un point est atteignable : barre fixe du bas, volets et
    // débordements s'interposent sans changer le rectangle de la case. Seul elementFromPoint tranche,
    // et c'est LUI que le navigateur consultera aussi pour livrer l'évènement tactile.
    for (const e of document.querySelectorAll(sel)) {
        const r = e.getBoundingClientRect();
        if (r.width < 3 || r.height < 3) continue;
        const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
        if (x < 4 || y < 4 || x > window.innerWidth - 4 || y > window.innerHeight - 4) continue;
        const sous = document.elementFromPoint(x, y);
        if (sous && sous === e) return { x, y, voix: e.dataset.voice, pas: e.dataset.step };
    }
    return null;
}, selecteur);
const caseCentrale = (page) => caseTouchable(page, '.seq-cell');

// Empreinte du motif : toute création/modification involontaire la change.
const empreinte = (page) => page.evaluate(() => {
    const on = [...document.querySelectorAll('.seq-cell.on')].map(c => `${c.dataset.voice}:${c.dataset.step}`);
    return on.sort().join(',');
});

const etatDefil = (page) => page.evaluate(() => {
    const s = document.querySelector('.seq-scroll-continuous');
    return { left: Math.round(s.scrollLeft), top: Math.round(s.scrollTop),
             maxLeft: s.scrollWidth - s.clientWidth, maxTop: s.scrollHeight - s.clientHeight };
});

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const errors = [];

    console.log('=== TÉLÉPHONE ===');
    const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    mob.on('pageerror', e => errors.push('mobile pageerror: ' + e.message));
    mob.on('console', m => { if (m.type() === 'error' && !/fonts\.googleapis|fonts\.gstatic|ERR_/.test(m.text())) errors.push('mobile console: ' + m.text()); });
    await ouvrir(mob);

    console.log('--- 0. Toute la surface laisse le navigateur défiler ---');
    const surfaces = await mob.evaluate(() => {
        const g = document.querySelector('.seq-grid-continuous');
        const lire = sel => { const e = g.querySelector(sel); return e ? getComputedStyle(e).touchAction : '(absent)'; };
        return {
            case_: lire('.seq-cell'), nav: lire('.seq-ctx-nav'),
            regle: lire('.seq-beat-label'), gouttiere: lire('.seq-label'),
            bande: getComputedStyle(document.querySelector('.seq-scroll-continuous')).touchAction,
        };
    });
    console.log(JSON.stringify(surfaces));
    check(Object.values(surfaces).every(v => v === 'pan-x pan-y'),
        `cases, zones d'accord voisin, règle, gouttière et bande : toutes en pan-x pan-y — ${JSON.stringify(surfaces)}`);

    console.log('--- 0-bis. (mesuré plus bas, sur ordinateur : question de géométrie, pas d\'appareil) ---');
    const mortes = await mob.evaluate(() => {
        const bande = document.querySelector('.seq-scroll-continuous');
        const vue = bande.getBoundingClientRect();
        // On balaie une ligne de cases pixel par pixel : partout où il y a de la musique, il doit y
        // avoir une case à toucher.
        // Toutes les cases d'UNE MÊME ligne (même grid-row), pour ne balayer que la plage réellement
        // couverte : une ligne de contexte n'a de cases que sous l'accord édité, et balayer au-delà
        // compterait comme « mort » un endroit où il n'y a légitimement rien.
        const parLigne = {};
        [...document.querySelectorAll('.seq-cell')].forEach(e => {
            const r = e.getBoundingClientRect();
            if (r.top < Math.max(vue.top + 40, 4) || r.bottom > Math.min(vue.bottom - 20, window.innerHeight - 4)) return;
            (parLigne[e.style.gridRow] = parLigne[e.style.gridRow] || []).push(r);
        });
        const meilleure = Object.values(parLigne).sort((a, b) => b.length - a.length)[0];
        if (!meilleure || meilleure.length < 4) return null;
        const gauche = Math.max(Math.min(...meilleure.map(r => r.left)), vue.left + 45, 4);
        const droite = Math.min(Math.max(...meilleure.map(r => r.right)), vue.right - 5, window.innerWidth - 4);
        const y = meilleure[0].top + meilleure[0].height / 2;
        let vides = 0, total = 0;
        for (let x = Math.ceil(gauche) + 1; x < droite - 1; x += 1) {
            total++;
            const el = document.elementFromPoint(x, y);
            if (!el || !el.closest('.seq-cell')) vides++;
        }
        return { vides, total };
    });
    console.log('(téléphone, indicatif)', JSON.stringify(mortes));

    console.log('--- 1. Un glissé au doigt FAIT DÉFILER, et ne touche à aucune note ---');
    const c1 = await caseCentrale(mob);
    check(c1 != null, 'un cas de test a été trouvé (case au centre de la bande)');
    const avant = await empreinte(mob);
    const defAvant = await etatDefil(mob);
    // Glissé horizontal franc, comme on se déplace dans le morceau.
    await mob.touchscreen.tap(1, 1).catch(() => {});
    await mob.evaluate(({ x, y }) => {
        const bande = document.querySelector('.seq-scroll-continuous');
        // Playwright n'émule pas le défilement natif d'un glissé tactile : il envoie les évènements
        // pointeur, mais aucun moteur de défilement n'est branché derrière touch-action. On vérifie
        // donc les DEUX moitiés séparément : ici, que l'application ne s'empare PAS du geste (aucune
        // note touchée, aucun seqDrag ouvert) ; le défilement lui-même est garanti par touch-action,
        // vérifié au point 0, et par le fait que la bande est bien défilable (vérifié juste après).
        window.__bandeDefilable = bande.scrollWidth > bande.clientWidth;
    }, c1);
    await mob.touchscreen.tap(c1.x, c1.y).catch(() => {});
    await mob.waitForTimeout(50);

    // Geste : poser, glisser tout de suite, relever — sans jamais s'arrêter.
    const glisser = async (page, x, y, dx, dy, pas = 10, pauseAvant = 0) => {
        await page.evaluate(({ x, y }) => {
            const el = document.elementFromPoint(x, y);
            el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'touch',
                clientX: x, clientY: y, bubbles: true, isPrimary: true }));
        }, { x, y });
        if (pauseAvant) await page.waitForTimeout(pauseAvant);
        for (let i = 1; i <= pas; i++) {
            await page.evaluate(({ x, y }) => {
                window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, pointerType: 'touch',
                    clientX: x, clientY: y, bubbles: true, isPrimary: true }));
            }, { x: Math.round(x + dx * i / pas), y: Math.round(y + dy * i / pas) });
            await page.waitForTimeout(12);
        }
        await page.evaluate(({ x, y }) => {
            window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, pointerType: 'touch',
                clientX: x, clientY: y, bubbles: true, isPrimary: true }));
        }, { x: Math.round(x + dx), y: Math.round(y + dy) });
    };

    await glisser(mob, c1.x, c1.y, -120, 0);
    await mob.waitForTimeout(300);
    const apresGlisse = await empreinte(mob);
    const etat1 = await mob.evaluate(() => ({ drag: !!window.app.seqDrag, appui: !!window.app._seqAppuiLong,
        defilable: window.__bandeDefilable }));
    console.log(JSON.stringify({ etat1, change: avant !== apresGlisse }));
    check(avant === apresGlisse,
        'un glissé immédiat ne crée et ne déforme AUCUNE note (c\'était le reproche principal)');
    check(!etat1.drag && !etat1.appui, 'et l\'application n\'a ouvert aucun geste d\'édition');
    check(etat1.defilable, 'la bande a bien de quoi défiler horizontalement (le navigateur peut le faire)');

    console.log('--- 1-bis. Idem verticalement ---');
    const avantV = await empreinte(mob);
    await glisser(mob, c1.x, c1.y, 0, -110);
    await mob.waitForTimeout(300);
    check(avantV === await empreinte(mob), 'un glissé vertical immédiat ne touche à aucune note non plus');

    console.log('--- 2. Un APPUI MAINTENU, lui, donne bien la main à l\'édition ---');
    const c2 = await caseCentrale(mob);
    await mob.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, pointerType: 'touch',
            clientX: x, clientY: y, bubbles: true, isPrimary: true }));
    }, c2);
    await mob.waitForTimeout(120);
    const aMiChemin = await mob.evaluate(() => ({ drag: !!window.app.seqDrag, appui: !!window.app._seqAppuiLong }));
    check(!aMiChemin.drag && aMiChemin.appui,
        'à mi-attente, rien n\'est encore engagé : le geste peut toujours devenir un défilement');
    await mob.waitForTimeout(260);
    const engage = await mob.evaluate(() => ({
        drag: !!window.app.seqDrag,
        arme: document.getElementById('arp-sequencer').classList.contains('seq-edition-armee'),
        liseré: getComputedStyle(document.querySelector('#arp-sequencer .seq-scroll')).boxShadow,
    }));
    console.log(JSON.stringify(engage));
    check(engage.drag, 'après l\'appui maintenu, l\'édition a pris la main');
    check(engage.arme && /rgba?\(0, 230, 118/.test(engage.liseré),
        'et elle le dit : liseré vert autour de la bande');
    await mob.screenshot({ path: SCR + 'defil_appui_long.png' });
    await mob.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2, pointerType: 'touch', bubbles: true })));
    await mob.waitForTimeout(300);
    check(await mob.evaluate(() => !document.getElementById('arp-sequencer').classList.contains('seq-edition-armee')),
        'le liseré s\'éteint au relâchement');

    console.log('--- 3. Un TAP bref pose toujours une note (le geste d\'ajout n\'a pas changé) ---');
    // Motif clairsemé : une attaque d'une croche tous les 4 pas. Il faut une case vide SANS note
    // collée à gauche ni à droite, sinon le tap sélectionne la voisine au lieu de créer (comportement
    // voulu, demandé précédemment) — et les croches piquées ne laissent que des trous d'une case.
    await mob.evaluate(() => {
        const p = JSON.parse(localStorage.getItem('myProgression'));
        p.sections[0].chords[1].arpPattern = Array.from({ length: 16 }, (_, i) => (i % 4 === 0 ? '0,1,2,3' : '')).join(';');
        p.sections[0].chords[1].seqEdited = true;
        localStorage.setItem('myProgression', JSON.stringify(p));
    });
    await ouvrir(mob, false);
    const vide = await mob.evaluate(() => {
        const on = new Set([...document.querySelectorAll('.seq-cell.on')].map(c => `${c.dataset.voice}:${c.dataset.step}`));
        for (const e of document.querySelectorAll('.seq-cell:not(.on):not(.seq-cell-free)')) {
            const v = e.dataset.voice, st = +e.dataset.step;
            if (on.has(`${v}:${st - 1}`) || on.has(`${v}:${st + 1}`)) continue;
            const r = e.getBoundingClientRect();
            if (r.width < 3) continue;
            const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
            if (x < 4 || y < 4 || x > window.innerWidth - 4 || y > window.innerHeight - 4) continue;
            if (document.elementFromPoint(x, y) === e) return { x, y, voix: v, pas: st };
        }
        return null;
    });
    check(vide != null, 'un cas de test a été trouvé (case vide au centre)');
    const nbAvant = await mob.evaluate(() => document.querySelectorAll('.seq-note').length);
    await glisser(mob, vide.x, vide.y, 0, 0, 1);
    await mob.waitForTimeout(400);
    const nbApres = await mob.evaluate(() => document.querySelectorAll('.seq-note').length);
    console.log(JSON.stringify({ nbAvant, nbApres }));
    check(nbApres > nbAvant, `un tap bref pose bien une note — ${nbAvant} puis ${nbApres} barres`);

    console.log('--- 4. Un glissé APRÈS l\'appui maintenu dessine, il ne fait plus défiler ---');
    await ouvrir(mob); // vue neuve : le point précédent a pu déplacer la sélection ou l'accord édité
    const c4 = await caseCentrale(mob);
    check(c4 != null, 'un cas de test a été trouvé (case au centre, vue neuve)');
    const defAvant4 = await etatDefil(mob);
    const emp4 = await empreinte(mob);
    await glisser(mob, c4.x, c4.y, 70, 0, 10, 350); // 350ms d'appui immobile AVANT de glisser
    await mob.waitForTimeout(400);
    const apres4 = await empreinte(mob);
    const defApres4 = await etatDefil(mob);
    console.log(JSON.stringify({ change: emp4 !== apres4, defAvant4, defApres4 }));
    check(emp4 !== apres4, 'le motif a bien changé : le glissé a dessiné');
    check(defApres4.left === defAvant4.left,
        `et la vue n'a pas glissé sous le doigt — ${defAvant4.left}px avant, ${defApres4.left}px après`);

    console.log('=== ORDINATEUR ===');
    const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await ouvrir(page);

    console.log('--- 4-bis. Plus de bandes mortes entre les cases (balayage pixel par pixel) ---');
    const mortesOrdi = await page.evaluate(() => {
        // Toutes les cases d'UNE MÊME ligne, pour ne balayer que la plage réellement couverte : une
        // ligne de contexte n'a de cases que sous l'accord édité.
        const parLigne = {};
        [...document.querySelectorAll('.seq-cell')].forEach(e => {
            const r = e.getBoundingClientRect();
            if (r.top < 4 || r.bottom > window.innerHeight - 4) return;
            (parLigne[e.style.gridRow] = parLigne[e.style.gridRow] || []).push(r);
        });
        const meilleure = Object.values(parLigne).sort((a, b) => b.length - a.length)[0];
        if (!meilleure || meilleure.length < 8) return null;
        const gauche = Math.max(Math.min(...meilleure.map(r => r.left)), 4);
        const droite = Math.min(Math.max(...meilleure.map(r => r.right)), window.innerWidth - 4);
        const y = meilleure[0].top + meilleure[0].height / 2;
        let vides = 0, total = 0, exemples = [];
        for (let x = Math.ceil(gauche) + 1; x < droite - 1; x += 1) {
            total++;
            const el = document.elementFromPoint(x, y);
            if (!el || !el.closest('.seq-cell')) { vides++; if (exemples.length < 5) exemples.push(Math.round(x - gauche)); }
        }
        return { vides, total, exemples, largeurLigne: Math.round(droite - gauche) };
    });
    console.log(JSON.stringify(mortesOrdi));
    // Avant : une bande morte de 4px toutes les 28px (une case sur deux recule pour creuser l'écart
    // visuel entre paires de doubles croches) — soit ~14 % de la ligne qui ne répond à rien.
    check(mortesOrdi && mortesOrdi.vides === 0,
        `aucun pixel sans case sur toute une ligne — ${mortesOrdi ? mortesOrdi.vides : '?'} vides sur ${mortesOrdi ? mortesOrdi.total : '?'}px`);

    console.log('--- 5. La souris n\'attend pas : un glissé dessine tout de suite ---');
    const c5 = await caseCentrale(page);
    const emp5 = await empreinte(page);
    await page.mouse.move(c5.x, c5.y);
    await page.mouse.down();
    await page.mouse.move(c5.x + 60, c5.y, { steps: 8 });
    const pendant5 = await page.evaluate(() => !!window.app.seqDrag);
    await page.mouse.up();
    await page.waitForTimeout(300);
    check(pendant5, 'aucun appui long à la souris : le geste est ouvert immédiatement');
    check(emp5 !== await empreinte(page), 'et il dessine bien');

    console.log('--- 6. La molette fait défiler, la barre horizontale est là et se prend ---');
    const molette = await page.evaluate(async () => {
        const s = document.querySelector('.seq-scroll-continuous');
        const cs = getComputedStyle(s);
        return {
            avantTop: s.scrollTop, avantLeft: s.scrollLeft,
            overflow: cs.overflow,
            barreH: s.offsetHeight - s.clientHeight, // épaisseur réelle de la barre horizontale
            barreV: s.offsetWidth - s.clientWidth,
            debordeH: s.scrollWidth - s.clientWidth,
        };
    });
    console.log(JSON.stringify(molette));
    // L'épaisseur de barre n'est PAS mesurable ici : Chromium sans interface graphique dessine des
    // barres en surimpression, qui ne prennent aucune place (barreH vaut 0 même quand la feuille de
    // style en habille une de 14px). On vérifie donc ce qui est vérifiable : la bande déborde bien,
    // et le style de barre existe pour l'habiller.
    check(molette.debordeH > 0, `la bande déborde horizontalement de ${molette.debordeH}px`);
    const boite = await page.evaluate(() => {
        const r = document.querySelector('.seq-scroll-continuous').getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    // Geste horizontal d'un pavé tactile à deux doigts : deltaX seul. Il était purement ignoré —
    // pire, le preventDefault du gestionnaire coupait aussi le défilement natif qui l'aurait fait.
    await page.mouse.move(boite.x, boite.y);
    await page.mouse.wheel(200, 0);
    await page.waitForTimeout(250);
    const apresH = await etatDefil(page);
    check(apresH.left > molette.avantLeft,
        `un geste horizontal (deltaX, pavé tactile) fait défiler — ${molette.avantLeft}px puis ${apresH.left}px`);
    // Molette verticale seule : avance dans le morceau tant que les hauteurs tiennent dans la bande.
    // Revenir au début d'abord : le geste précédent a poussé la bande jusqu'à sa butée droite, où
    // plus rien ne peut bouger — l'assertion échouerait sans rapport avec ce qu'elle teste.
    await page.evaluate(() => { document.querySelector('.seq-scroll-continuous').scrollLeft = 0; });
    await page.waitForTimeout(150);
    const remis = await etatDefil(page);
    await page.mouse.wheel(0, 150);
    await page.waitForTimeout(250);
    const apresV = await etatDefil(page);
    check(apresV.maxTop === 0 ? apresV.left > remis.left : apresV.top > remis.top,
        `la molette seule ${apresV.maxTop === 0 ? 'avance dans le morceau' : 'parcourt les hauteurs'} — ` +
        `gauche ${remis.left}->${apresV.left}, haut ${remis.top}->${apresV.top}`);

    console.log('--- 7. Rien n\'a bougé pour les zones qui faisaient déjà défiler (règle, gouttière) ---');
    const bords = await page.evaluate(() => {
        const g = document.querySelector('.seq-grid-continuous');
        return {
            regle: getComputedStyle(g.querySelector('.seq-beat-label')).touchAction,
            gouttiere: getComputedStyle(g.querySelector('.seq-label')).touchAction,
            curseurRegle: getComputedStyle(g.querySelector('.seq-beat-label')).cursor,
        };
    });
    console.log(JSON.stringify(bords));
    check(bords.regle === 'pan-x pan-y' && bords.gouttiere === 'pan-x pan-y' && bords.curseurRegle === 'grab',
        'règle et gouttière restent les surfaces de préhension qu\'elles étaient');

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript');
    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
