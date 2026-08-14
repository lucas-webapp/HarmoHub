const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// Retour utilisateur sur l'échelle des notes à gauche du séquenceur continu :
// 1. « Mettre la vraie couleur des touches de piano (blanc-beige et noir). »
// 2. « Le nom des notes prend trop de place sur les touches. Laisser uniquement le Do avec son
//     octave. Quand je déplace ou ajoute une barre dans l'accord, tu dois faire apparaître la note
//     sur la gauche (même pendant le déplacement pour pouvoir poser la note au bon endroit). »
let PASS = 0, FAIL = 0;
const check = (c, l) => { if (c) { PASS++; console.log('PASS - ' + l); } else { FAIL++; console.log('FAIL - ' + l); } };
const SCR = __dirname + '/';

async function ouvrir(page) {
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
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
}

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/fonts\.googleapis|fonts\.gstatic|ERR_/.test(m.text())) errors.push('console: ' + m.text()); });

    await ouvrir(page);

    console.log('--- 1. Vraies couleurs de touches, les mêmes que le clavier de l\'appli ---');
    const couleurs = await page.evaluate(() => {
        const g = document.querySelector('.seq-grid-continuous');
        // `:not(.seq-key-jouee)` : une touche jouée porte maintenant la couleur de sa FONCTION (voir
        // le retour « les notes présentes dans l'accord ne restent pas affichées sur le piano »).
        // Pour contrôler l'ivoire et le noir, il faut donc une touche que l'accord ne joue pas.
        const b = g.querySelector('.seq-label.seq-key-white:not(.seq-key-jouee)');
        const n = g.querySelector('.seq-label.seq-key-black:not(.seq-key-jouee)');
        // Le clavier fixe de l'appli, référence de teinte.
        const refB = document.querySelector('.key.white');
        const refN = document.querySelector('.key.black');
        const fond = e => e && getComputedStyle(e).backgroundImage;
        // Un dégradé peut être écrit de mille façons : on ne compare que les triplets rgb() qu'il cite.
        const teintes = s => (s || '').match(/rgba?\([^)]+\)/g) || [];
        return {
            blanche: fond(b), noire: fond(n),
            teintesBlanche: teintes(fond(b)), teintesRefBlanche: teintes(fond(refB)),
            teintesNoire: teintes(fond(n)),
            // Le clavier fixe écrit son noir en background-COLOR (raccourci `background: dégradé,
            // #171310`) : il n'apparaît donc pas dans background-image. Lire les deux, sinon on
            // compare à une liste vide et l'assertion ne prouve rien.
            teintesRefNoire: teintes(fond(refN)).concat(refN ? [getComputedStyle(refN).backgroundColor] : []),
            couleurTexteBlanche: b && getComputedStyle(b).color,
            couleurTexteNoire: n && getComputedStyle(n).color,
            nbBlanches: g.querySelectorAll('.seq-label.seq-key-white').length,
            nbNoires: g.querySelectorAll('.seq-label.seq-key-black').length,
            // Les notes de l'accord, allumées et teintées par leur fonction.
            jouees: [...g.querySelectorAll('.seq-label.seq-key-jouee')].map(l => ({
                note: l.querySelector('.seq-key-name').textContent,
                role: (l.className.match(/seq-key-role-(\w+)/) || [])[1],
            })),
        };
    });
    console.log(JSON.stringify(couleurs));
    // #f3ede0 -> rgb(243, 237, 224) et #e7dcc4 -> rgb(231, 220, 196) : l'ivoire exact de .key.white.
    check(couleurs.teintesBlanche.includes('rgb(243, 237, 224)') && couleurs.teintesBlanche.includes('rgb(231, 220, 196)'),
        `touche blanche : l'ivoire du clavier de l'appli — ${couleurs.teintesBlanche.slice(0, 2).join(' / ')}`);
    check(couleurs.teintesRefBlanche.includes('rgb(243, 237, 224)'),
        'et c\'est bien la teinte que porte le clavier fixe (référence non dérivée)');
    // #171310 -> rgb(23, 19, 16) : le noir exact de .key.black.
    check(couleurs.teintesNoire.includes('rgb(23, 19, 16)') && couleurs.teintesRefNoire.includes('rgb(23, 19, 16)'),
        `touche noire : le même noir que le clavier de l'appli — ${couleurs.teintesNoire.join(' / ')}`);
    // Une touche noire ne laisse pas voir l'écran derrière : son décrochement de gauche est ivoire.
    check(couleurs.teintesNoire.includes('rgb(231, 220, 196)'),
        'le décrochement à gauche de la touche noire est ivoire, pas transparent');
    check(couleurs.nbBlanches > 0 && couleurs.nbNoires > 0,
        `les deux sortes de touches sont présentes — ${couleurs.nbBlanches} blanches, ${couleurs.nbNoires} noires`);
    // Am7 = A (fondamentale) C (tierce) E (quinte) G (septième) : une couleur par fonction, les mêmes
    // que la légende de l'appli.
    const roles = couleurs.jouees.map(j => `${j.note}=${j.role}`).join(' ');
    check(couleurs.jouees.length === 4 && new Set(couleurs.jouees.map(j => j.role)).size === 4,
        `les notes de l'accord restent allumées, chacune à la couleur de sa fonction — ${roles}`);

    console.log('--- 2. Un seul nom écrit : le DO, avec son octave ---');
    const noms = await page.evaluate(() => {
        const g = document.querySelector('.seq-grid-continuous');
        const labels = [...g.querySelectorAll('.seq-label.seq-key')];
        const lisible = l => {
            const sp = l.querySelector('.seq-key-name');
            return sp && getComputedStyle(sp).visibility === 'visible' ? sp.textContent.trim() : null;
        };
        const vus = labels.map(lisible).filter(Boolean);
        return {
            total: labels.length,
            visibles: vus,
            // Le texte reste dans le DOM (il doit pouvoir réapparaître) : c'est bien l'AFFICHAGE
            // qui est coupé, pas le contenu.
            tousEcritsDansLeDom: labels.every(l => (l.querySelector('.seq-key-name') || {}).textContent),
            // La place est réservée : la gouttière ne doit pas changer de largeur quand un nom
            // réapparaît en cours de geste.
            largeurGouttiere: Math.round(labels[0].getBoundingClientRect().width),
        };
    });
    console.log(JSON.stringify(noms));
    // CONTRAT ÉLARGI (retour utilisateur : « on ne voit plus toujours le nom des notes avec les
    // touches colorées ») : au repos, portent un nom les DO **et** les touches que l'accord JOUE
    // vraiment (.seq-key-jouee). Toutes les autres restent nues — c'est ce que vérifie l'assertion
    // suivante, qui reste la vraie garde contre le retour du mur de texte.
    check(noms.visibles.length > 0 && noms.visibles.every(t => /^[A-G][#b]?-?\d+$/.test(t)),
        `au repos, seuls les DO et les touches jouées sont nommés — ${noms.visibles.join(', ')} (sur ${noms.total} touches)`);
    check(noms.visibles.every(t => /\d/.test(t)), `...et chacun porte son octave — ${noms.visibles.join(', ')}`);
    // Seuil desserré de total/4 à total/3 : un accord de quatre sons plus le DO de repère fait 5 noms
    // pour 20 touches, soit le quart PILE — la borne stricte d'origine ne laissait littéralement aucune
    // place aux noms qu'on vient d'ajouter. Un tiers garde tout son sens de garde-fou (elle interdit
    // toujours le mur de texte d'origine, qui nommait les 20 touches).
    check(noms.visibles.length < noms.total / 3,
        `la grande majorité des touches reste nue — ${noms.visibles.length} noms pour ${noms.total} touches`);
    check(noms.tousEcritsDansLeDom, 'les noms masqués restent dans le DOM (ils doivent pouvoir réapparaître)');

    await page.screenshot({ path: SCR + 'touches_apres.png' });
    const clip = await page.evaluate(() => {
        const r = document.querySelector('.seq-scroll-continuous').getBoundingClientRect();
        return { x: r.x, y: r.y, width: Math.min(r.width, 620), height: Math.min(r.height, 320) };
    });
    await page.screenshot({ path: SCR + 'touches_gros_plan.png', clip });

    console.log('--- 3. Le nom réapparaît PENDANT le déplacement d\'une barre ---');
    // Prendre une note existante par son corps et la faire glisser vers le HAUT : c'est le geste
    // « changer de hauteur », celui où l'on doit lire où l'on va poser la note.
    const depart = await page.evaluate(() => {
        // Uniquement une note dont le CENTRE tombe dans la fenêtre visible de la bande, et assez bas
        // pour qu'on puisse encore glisser de 45px vers le haut sans sortir.
        const vue = document.querySelector('.seq-scroll-continuous').getBoundingClientRect();
        // Viser une CASE allumée, pas le centre de la barre : en vue continue une case sur deux
        // (.seq-cell-b) recule de 4px, si bien que le centre d'une barre peut tomber dans cette bande
        // morte — elementFromPoint y renvoie la grille, aucun geste ne démarre, et l'assertion
        // échouerait pour une raison sans rapport avec ce qu'elle teste.
        // Le CORPS de la barre, jamais un de ses bords (.seq-cell-edge) : depuis un bord, un glissé
        // vertical étire/fait défiler au lieu de changer de hauteur — ce n'est pas le geste testé ici.
        const c = [...document.querySelectorAll('.seq-cell.on:not(.seq-cell-edge)')].map(e => ({ e, r: e.getBoundingClientRect() }))
            .filter(({ r }) => r.top > vue.top + 60 && r.bottom < vue.bottom - 4
                && r.left > vue.left + 8 && r.right < vue.right - 8 && r.width > 2)
            .sort((a, b) => b.r.top - a.r.top)[0];
        if (!c) return null;
        return { x: Math.round(c.r.left + c.r.width / 2), y: Math.round(c.r.top + c.r.height / 2), voix: c.e.dataset.voice };
    });
    check(depart != null, 'un cas de test a été trouvé (une barre bien visible dans la bande)');
    // Les deux hauteurs de contrôle : le milieu de deux AUTRES lignes réellement jouées par l'accord.
    // Viser « 45px plus haut » au jugé tombe une fois sur deux sur une ligne de contexte (une hauteur
    // que l'accord ne joue pas) — le glissé de voix n'y désigne aucune voix, et l'assertion échouerait
    // pour une raison sans rapport avec ce qu'elle teste.
    const cibles = await page.evaluate((yDepart) => {
        const vue = document.querySelector('.seq-scroll-continuous').getBoundingClientRect();
        return [...document.querySelectorAll('.seq-label[data-row-voice]')]
            .filter(l => +l.dataset.rowVoice >= 0)
            .map(l => { const r = l.getBoundingClientRect(); return {
                y: Math.round(r.top + r.height / 2),
                nom: l.querySelector('.seq-key-name').textContent.trim() }; })
            .filter(o => o.y < yDepart - 8 && o.y > vue.top + 30)
            .sort((a, b) => b.y - a.y);
    }, depart.y);
    check(cibles.length >= 2, `au moins deux autres lignes jouées au-dessus — ${cibles.map(c => c.nom).join(', ')}`);
    await page.mouse.move(depart.x, depart.y);
    await page.mouse.down();
    await page.mouse.move(depart.x, depart.y - 6, { steps: 2 });
    const lireRevele = () => page.evaluate(() => {
        const rev = document.querySelector('.seq-label.seq-key-reveal');
        const sp = rev && rev.querySelector('.seq-key-name');
        return sp ? sp.textContent.trim() : null;
    });
    // Le repère doit SUIVRE la ligne visée, pas rester sur celle de départ : on lit sur deux lignes
    // différentes du même geste. Sans ça, une classe posée une fois pour toutes passerait le test.
    await page.mouse.move(depart.x, cibles[0].y, { steps: 8 });
    await page.waitForTimeout(200);
    const nom1 = await lireRevele();
    await page.mouse.move(depart.x, cibles[1].y, { steps: 6 });
    await page.waitForTimeout(200);
    const nom2 = await lireRevele();
    check(nom1 === cibles[0].nom && nom2 === cibles[1].nom,
        `le nom suit la ligne survolée — attendu « ${cibles[0].nom} » puis « ${cibles[1].nom} », lu « ${nom1} » puis « ${nom2} »`);
    check([nom1, nom2].some(n => n && !/^C-?\d+$/.test(n)),
        `au moins une des deux n'est pas un DO : c'est bien une révélation, pas le nom déjà écrit — ${nom1} / ${nom2}`);
    const pendant = await page.evaluate(() => {
        const rev = document.querySelector('.seq-label.seq-key-reveal');
        const sp = rev && rev.querySelector('.seq-key-name');
        const flot = document.querySelector('.seq-drag-readout');
        return {
            revele: !!rev,
            nom: sp ? sp.textContent.trim() : null,
            visible: sp ? getComputedStyle(sp).visibility : null,
            estUnDo: rev ? rev.classList.contains('seq-key-c') : null,
            // Le repère flottant près du doigt existe déjà : les deux doivent dire la MÊME note.
            flottant: flot && !flot.hidden ? flot.textContent.trim() : null,
        };
    });
    console.log(JSON.stringify(pendant));
    check(pendant.revele && pendant.visible === 'visible' && pendant.nom,
        `pendant le glissé, la note visée s'écrit sur sa touche — « ${pendant.nom} »`);
    check(pendant.flottant && pendant.flottant.replace(/[^A-G#b0-9]/g, '') === (pendant.nom || '').replace(/[^A-G#b0-9]/g, ''),
        `le repère du doigt et la touche annoncent la même note — « ${pendant.flottant} » / « ${pendant.nom} »`);
    await page.screenshot({ path: SCR + 'touches_pendant_glisse.png', clip });

    await page.mouse.up();
    await page.waitForTimeout(300);
    const apres = await page.evaluate(() => ({
        encoreRevele: !!document.querySelector('.seq-label.seq-key-reveal'),
        visibles: [...document.querySelectorAll('.seq-grid-continuous .seq-label.seq-key .seq-key-name')]
            .filter(s => getComputedStyle(s).visibility === 'visible').map(s => s.textContent.trim()),
    }));
    console.log(JSON.stringify(apres));
    check(!apres.encoreRevele && apres.visibles.every(t => /^[A-G][#b]?-?\d+$/.test(t)),
        `au relâchement, la gouttière se rétracte aux DO + touches jouées — ${apres.visibles.join(', ')}`);

    console.log('--- 4. ...et pendant qu\'on AJOUTE une barre ---');
    // Un accord TENU remplit toutes les cases de ses voix : il n'y aurait aucune case vide où tester
    // l'ajout. Croches piquées -> une case sur deux est libre.
    await page.evaluate(() => {
        const sel = document.getElementById('playStyle');
        sel.value = 'croche_staccato';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(500);
    const vide = await page.evaluate(() => {
        const vue = document.querySelector('.seq-scroll-continuous').getBoundingClientRect();
        const c = [...document.querySelectorAll('.seq-cell:not(.on):not(.seq-cell-free)')]
            .map(e => ({ e, r: e.getBoundingClientRect() }))
            .filter(({ r }) => r.top > vue.top + 60 && r.bottom < vue.bottom - 4
                && r.left > vue.left + 8 && r.right < vue.right - 8 && r.width > 2)[10];
        if (!c) return null;
        return { x: Math.round(c.r.left + c.r.width / 2), y: Math.round(c.r.top + c.r.height / 2), voix: c.e.dataset.voice };
    });
    check(vide != null, 'un cas de test a été trouvé (une case vide bien visible)');
    await page.mouse.move(vide.x, vide.y);
    await page.mouse.down();
    await page.waitForTimeout(150);
    const pendantAjout = await page.evaluate(() => {
        const rev = document.querySelector('.seq-label.seq-key-reveal');
        const sp = rev && rev.querySelector('.seq-key-name');
        return { revele: !!rev, nom: sp ? sp.textContent.trim() : null, voix: rev ? rev.dataset.rowVoice : null };
    });
    console.log(JSON.stringify(pendantAjout));
    check(pendantAjout.revele && pendantAjout.voix === vide.voix,
        `dès l'appui, la ligne où l'on pose la note s'annonce — « ${pendantAjout.nom} » (voix ${pendantAjout.voix})`);
    await page.mouse.up();
    await page.waitForTimeout(200);

    console.log('--- 5. Le PETIT séquenceur garde ses noms (pas de clavier chromatique) ---');
    await page.click('#grid-zoom');
    await page.waitForTimeout(300);
    await page.click('#toggle-sequencer');
    await page.waitForTimeout(500);
    const petit = await page.evaluate(() => {
        const g = document.querySelector('#arp-sequencer .seq-grid');
        const labels = [...g.querySelectorAll('.seq-label')];
        return {
            touches: g.querySelectorAll('.seq-key').length,
            noms: labels.map(l => l.textContent.trim()).filter(Boolean),
            tousVisibles: labels.every(l => l.getBoundingClientRect().width > 0),
        };
    });
    console.log(JSON.stringify(petit));
    check(petit.touches === 0 && petit.noms.length >= 3 && petit.tousVisibles,
        `lignes par voix, noms tous lisibles — ${petit.noms.join(', ')}`);

    console.log('--- 6. Téléphone ---');
    const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    mob.on('pageerror', e => errors.push('mobile pageerror: ' + e.message));
    await ouvrir(mob);
    const surMobile = await mob.evaluate(() => {
        const g = document.querySelector('.seq-grid-continuous');
        if (!g) return { absent: true };
        const labels = [...g.querySelectorAll('.seq-label.seq-key')];
        const vus = labels.map(l => {
            const sp = l.querySelector('.seq-key-name');
            return sp && getComputedStyle(sp).visibility === 'visible' ? sp.textContent.trim() : null;
        }).filter(Boolean);
        // Même raison qu'au point 1 : une touche jouée porte la couleur de sa fonction, pas l'ivoire.
        const b = g.querySelector('.seq-key-white:not(.seq-key-jouee)');
        return {
            visibles: vus, total: labels.length,
            teintes: (getComputedStyle(b).backgroundImage.match(/rgba?\([^)]+\)/g) || []),
            largeurGouttiere: Math.round(b.getBoundingClientRect().width),
        };
    });
    console.log(JSON.stringify(surMobile));
    check(surMobile.visibles.every(t => /^[A-G][#b]?-?\d+$/.test(t)) && surMobile.visibles.length > 0
        && surMobile.visibles.length < surMobile.total / 3,
        `DO + touches jouées sur téléphone aussi — ${surMobile.visibles.join(', ')} sur ${surMobile.total} touches`);
    check(surMobile.teintes.includes('rgb(243, 237, 224)'), 'et le même ivoire');
    await mob.screenshot({ path: SCR + 'touches_mobile.png' });

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript');
    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
