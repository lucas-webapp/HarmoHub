// LA CASE SÉLECTIONNÉE EST GRISE CLAIRE (B1 de la session du 12/11), avec de vrais gestes.
//
// LA DEMANDE : « la couleur bleue des cases sélectionnées […] ne va pas avec le design de l'application ». Trois propositions rendues sur de vraies cases (verre éteint et allumé,
// ordinateur et téléphone) ont été soumises ; CHOIX DE L'UTILISATEUR, 12/11 : « Brillance » en gris clair — « on laisse en gris clair » — le renfort portant sur les BORDS et non
// sur le corps de la case (« l'effet renforcé dans la case dénote trop avec les cases adjacentes »). Rien n'éclaire le bas de la case : la barre de lecture y passe.
// L'orange est écarté (déjà la plage à boucler et « modifié, pas enregistré »), le gris-vert aussi (trop proche du vert de la lecture).
//
// CE QUE LE BANC TIENT : la case choisie a un bord gris clair presque plein (pas bleu), un halo en haut et sur les côtés et AUCUNE ombre vers le bas, le corps de ses voisines, un nom
// blanc ; plusieurs cases choisies portent toutes le même habillage (plus d'anneau bleu) ; la case en modification pousse l'effet d'un cran (bord plein, fil intérieur) ; la lecture
// reste verte ; le bord contraste d'au moins 3:1 avec la case voisine sur chacun des sept fonds du verre allumé et verre éteint (la crainte de l'utilisateur : « avoir du mal à
// discerner la case en cours de modification ») ; le téléphone a le même habillage.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('sélection grise claire');
const { estBruitReseau } = require('./_harness');
const { dblclickHorsNom } = require('./_geste_accord');

plan(25);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, b = 4) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const S = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    sessionStorage.setItem('cc_accueil_vu', '1');
};
const FONDS = ['aurora', 'blue', 'green', 'violet', 'rose', 'amber', 'grey'];

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport, tactile = false) => {
        const ctx = await nav.newContext({ viewport, hasTouch: tactile, isMobile: tactile });
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(1000);
        return p;
    };
    const caseSel = (i) => `#progression-sections .grid-cell[data-section="0"][data-index="${i}"]`;
    // Les styles calculés d'une case, déjà décortiqués : couleur et opacité du bord, ombres (décalage, flou, intérieur ou non), fond, couleur du nom.
    const style = (p, i) => p.evaluate((sel) => {
        const c = document.querySelector(sel), cs = getComputedStyle(c);
        const rgba = (t) => { const m = /rgba?\(([^)]*)\)/.exec(t || ''); if (!m) return null; const v = m[1].split(',').map(x => parseFloat(x)); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
        const ombres = [];
        const re = /(rgba?\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?(\s+inset)?|inset\s+(rgba?\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?/g;
        let m;
        while ((m = re.exec(cs.boxShadow))) {
            if (m[1]) ombres.push({ c: rgba(m[1]), x: +m[2], y: +m[3], flou: +m[4], etalement: m[5] != null ? +m[5] : 0, dedans: !!m[6] });
            else ombres.push({ c: rgba(m[7]), x: +m[8], y: +m[9], flou: +m[10], etalement: m[11] != null ? +m[11] : 0, dedans: true });
        }
        return { bord: rgba(cs.borderTopColor), ombres, brut: cs.boxShadow, fond: cs.backgroundColor, nom: rgba(getComputedStyle(c.querySelector('.cell-sym')).color), classes: c.className };
    }, caseSel(i));
    const grisClair = (c) => !!c && Math.min(c.r, c.g, c.b) >= 190 && Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) <= 25;

    // Contraste WCAG du bord de la case choisie avec le CORPS de sa voisine, mesuré sur les pixels réellement affichés (capture relue dans une page vierge).
    const contraste = async (p, q, i) => {
        const b = await p.locator(caseSel(i)).boundingBox();
        const buf = await p.screenshot({ clip: { x: b.x - 8, y: b.y + b.height / 2 - 2, width: b.width + 16, height: 4 } });
        return q.evaluate(async (b64) => {
            const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
            const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
            const x = cv.getContext('2d'); x.drawImage(img, 0, 0);
            const px = (X, Y) => Array.from(x.getImageData(X, Y, 1, 1).data.slice(0, 3));
            const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
            const L = c => 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
            const R = (a, c) => { const [h, l] = [L(a), L(c)].sort((m, n) => n - m); return (h + 0.05) / (l + 0.05); };
            const y = 2;
            const bord = [8, 9, 10, 11, 12].map(X => px(X, y)).sort((m, n) => L(n) - L(m))[0];   // le bord gauche de la case choisie (8 px de marge dans la capture)
            const voisin = px(3, y);                                                                // 5 px dans la case voisine
            return R(bord, voisin);
        }, buf.toString('base64'));
    };

    // ======================================================================================================
    console.log('\n=== A. Ordinateur : la case choisie est grise claire, éclairée par le haut et les côtés, rien en bas ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    const q = await (await nav.newContext()).newPage();
    let b = await p.locator(caseSel(1)).boundingBox();
    await p.mouse.click(b.x + b.width / 2, b.y + b.height - 6); await p.waitForTimeout(600);
    exiger(await p.locator(caseSel(1) + '.selected').count() === 1, 'un clic sur une case la choisit');
    const sel = await style(p, 1);
    const voisine = await style(p, 2);
    check(grisClair(sel.bord) && sel.bord.a >= 0.8, `le bord est un gris clair presque plein, pas un bleu (rgba ${sel.bord.r}, ${sel.bord.g}, ${sel.bord.b}, ${sel.bord.a})`);
    const dehors = sel.ombres.filter(o => !o.dedans);
    check(dehors.some(o => o.y < 0) && dehors.filter(o => o.x !== 0).length >= 2, `un halo en haut et sur les deux côtés (${dehors.length} ombres extérieures)`);
    check(sel.ombres.filter(o => !o.dedans).every(o => o.y <= 0), 'et AUCUNE ombre extérieure vers le bas : la barre de lecture y passe');
    check(sel.fond === voisine.fond, `le corps de la case est celui de ses voisines (${sel.fond})`);
    check(sel.nom.r >= 240 && sel.nom.g >= 240 && sel.nom.b >= 240, 'le nom de l\'accord est blanc');
    check(!/76, 141, 255/.test(sel.brut) && sel.bord.b - sel.bord.r < 25, 'plus rien de l\'ancien bleu (76, 141, 255)');

    console.log('\n=== B. Plusieurs cases : toutes portent le même habillage, plus d\'anneau bleu ===');
    b = await p.locator(caseSel(2)).boundingBox();
    await p.keyboard.down('Control'); await p.mouse.click(b.x + b.width / 2, b.y + b.height - 6); await p.keyboard.up('Control'); await p.waitForTimeout(500);
    const m1 = await style(p, 1), m2 = await style(p, 2);
    check(/multi-selected/.test(m1.classes + m2.classes) && grisClair(m1.bord) && grisClair(m2.bord), 'deux cases choisies (Ctrl+clic) : les deux ont le bord gris clair');
    check(!/47, 129, 247/.test(m1.brut + m2.brut), 'l\'anneau bleu de la sélection multiple n\'existe plus');
    await p.mouse.click(1300, 300); await p.waitForTimeout(400);

    console.log('\n=== C. En modification : l\'effet monte d\'un cran, toujours sur les bords ===');
    await dblclickHorsNom(p, caseSel(3)); await p.waitForTimeout(500);
    await p.click('#bulle-accord [data-bulle="son"]'); await p.waitForTimeout(600);
    exiger(await p.locator(caseSel(3) + '.editing').count() === 1, '« Réglages du son » met la case en modification');
    const ed = await style(p, 3);
    check(grisClair(ed.bord) && ed.bord.a >= 0.95, `bord plein (opacité ${ed.bord.a})`);
    check(ed.ombres.some(o => o.dedans && o.x === 0 && o.y === 0 && o.etalement >= 1), 'avec un fil clair à l\'intérieur de la bordure (ombre intérieure de 1 px)');
    check(ed.brut !== sel.brut && ed.ombres.filter(o => !o.dedans).every(o => o.y <= 0), 'différente de la simple sélection, et toujours rien vers le bas');
    await p.evaluate(() => window.app.cancelEdit()); await p.waitForTimeout(300);

    console.log('\n=== D. La lecture reste verte, même sur une case choisie ===');
    await p.mouse.click(1300, 300); await p.waitForTimeout(300);
    await p.click('#play-prog');
    // La première surbrillance arrive après le chargement des sons (réseau coupé ici : « son de secours en attendant »), d'où une attente large.
    await p.waitForSelector('#progression-sections .grid-cell.playing', { timeout: 15000 });
    const lect = await p.evaluate(() => { const c = document.querySelector('#progression-sections .grid-cell.playing'); return { ombre: getComputedStyle(c).boxShadow, fond: getComputedStyle(c).backgroundColor }; });
    exiger(/0, 230, 118/.test(lect.ombre) && lect.fond === 'rgb(10, 26, 15)', `la case qui sonne est verte, anneau et fond (${lect.fond})`);
    await p.click('#stop'); await p.waitForTimeout(400);
    // « Choisie ET en lecture » n'arrive pas par un geste (mesuré : la lecture EFFACE la sélection, et un clic pendant la lecture l'arrête) : on pose la classe sur une case
    // choisie pour éprouver la CASCADE, rien d'autre — la lecture doit l'emporter sur l'habillage gris (la règle .playing d'en haut est plus ancienne que celle de B1).
    b = await p.locator(caseSel(2)).boundingBox();
    await p.mouse.click(b.x + b.width / 2, b.y + b.height - 6); await p.waitForTimeout(500);
    await p.evaluate((sel) => document.querySelector(sel).classList.add('playing'), caseSel(2));
    await p.waitForTimeout(500); // la case a une transition de 0,15 s sur son fond : on lit l'état d'arrivée, pas le milieu du fondu
    const mixte = await p.evaluate((sel) => { const c = document.querySelector(sel); const cs = getComputedStyle(c); return { ombre: cs.boxShadow, fond: cs.backgroundColor, sel: c.classList.contains('selected') }; }, caseSel(2));
    check(mixte.sel && /0, 230, 118/.test(mixte.ombre) && mixte.fond === 'rgb(10, 26, 15)', `choisie ET en lecture : le vert l'emporte sur le gris (${mixte.fond})`);

    console.log('\n=== E. Le bord se voit sur chacun des sept fonds du verre (contraste ≥ 3:1 avec la case voisine) ===');
    await p.mouse.click(1300, 300); await p.waitForTimeout(300);
    b = await p.locator(caseSel(1)).boundingBox();
    await p.mouse.click(b.x + b.width / 2, b.y + b.height - 6); await p.waitForTimeout(500);
    const eteint = await contraste(p, q, 1);
    check(eteint >= 3, `verre éteint : ${eteint.toFixed(1)}:1`);
    await p.evaluate(() => { localStorage.setItem('harmohub.glass.v1', '1'); window.dispatchEvent(new StorageEvent('storage', { key: 'harmohub.glass.v1', newValue: '1' })); });
    for (const fond of FONDS) {
        await p.evaluate((f) => { localStorage.setItem('harmohub.glassBg.v1', f); window.dispatchEvent(new StorageEvent('storage', { key: 'harmohub.glassBg.v1', newValue: f })); }, fond);
        await p.waitForTimeout(500);
        const r = await contraste(p, q, 1);
        check(r >= 3, `verre allumé, fond « ${fond} » : ${r.toFixed(1)}:1`);
    }
    await p.context().close();

    // ======================================================================================================
    console.log('\n=== F. Téléphone : le même habillage ===');
    p = await ouvrir({ width: 390, height: 844 }, true);
    b = await p.locator(caseSel(1)).boundingBox();
    await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height - 6); await p.waitForTimeout(700);
    const tel = await style(p, 1);
    check(/selected/.test(tel.classes) && grisClair(tel.bord) && !/76, 141, 255/.test(tel.brut), `au toucher, la case choisie a le même bord gris clair (rgba ${tel.bord && tel.bord.r}, ${tel.bord && tel.bord.g}, ${tel.bord && tel.bord.b})`);
    await p.context().close();

    check(erreurs.length === 0, `aucune erreur de page${erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''}`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
