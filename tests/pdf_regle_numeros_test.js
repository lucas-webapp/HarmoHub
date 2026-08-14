// La règle graduée du PDF : chiffres centrés sur leur trait, et fin de ligne qui annonce la suite.
// Retour utilisateur, capture à l'appui : « les chiffres ne sont pas bien centrés sous le temps 1,
// et il devrait y avoir 5 et 9 en fin de lignes, là on a à nouveau 4 et 8 ».
// Deux défauts distincts, mesurés :
//   - .ruler-num était posé à `left: 2px`, donc son centre tombait 5px à DROITE du trait majeur ;
//   - le numéro de fin affichait `firstBarNumber + bi`, exactement le même nombre que le .ruler-num
//     de cette mesure : une ligne finissant sur la 4 portait « 4 » aux deux bouts.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police vient de Google Fonts, injoignable derrière le proxy du bac à sable : bruit filtré.

let PASS = 0, FAIL = 0;
function check(c, l) { if (c) { PASS++; console.log('PASS - ' + l); } else { FAIL++; console.log('FAIL - ' + l); } }

const mk = (root, q, beats) => ({ root, quality: q, beats, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} });

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|fonts\.googleapis|fonts\.gstatic/.test(m.text())) errs.push('console: ' + m.text()); });

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(500);
    // 8 mesures de 4 temps : deux lignes pleines, donc deux fins de ligne à éprouver.
    await page.evaluate((s) => {
        const mk = eval('(' + s + ')');
        const c = []; for (let i = 0; i < 8; i++) c.push(mk(['C', 'A', 'F', 'G'][i % 4], i % 2 ? 'min7' : 'maj', 4));
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: c }] }));
    }, mk.toString());
    await page.reload();
    await page.waitForTimeout(900);

    // Rend la mise en page d'export telle que exportPdf la rastérise : même hôte, même largeur.
    const releve = await page.evaluate(() => {
        const host = document.querySelector('.print-export');
        const { gridInner } = window.app.buildPrintExportHtml();
        host.innerHTML = `<div class="print-page">${gridInner}</div>`;
        host.style.cssText = 'display:block; position:fixed; left:0; top:0; width:794px; background:#fff; z-index:99999;';
        const pageB = document.querySelector('.print-page').getBoundingClientRect();
        const lignes = [...document.querySelectorAll('.print-measure-ruler')].map(reg => ({
            mesures: [...reg.querySelectorAll('.ruler-bar')].map(bar => {
                const num = bar.querySelector('.ruler-num');
                const majeur = bar.querySelector('.ruler-tick-major');
                const fin = bar.querySelector('.ruler-num-end');
                const nb = num.getBoundingClientRect(), mb = majeur.getBoundingClientRect();
                const r = { numero: num.textContent, fin: fin ? fin.textContent : null,
                            ecart: Math.round((nb.left + nb.width / 2) - (mb.left + mb.width / 2)) };
                if (fin) {
                    const fb = fin.getBoundingClientRect(), barB = bar.getBoundingClientRect();
                    r.ecartFin = Math.round((fb.left + fb.width / 2) - barB.right);
                }
                return r;
            }),
        }));
        const nums = [...document.querySelectorAll('.ruler-num, .ruler-num-end')];
        // La règle doit rester alignée AU PIXEL avec les cases d'accords au-dessus.
        const alignement = [...document.querySelectorAll('.print-measure-ruler')].map((reg, i) => {
            const rangee = document.querySelectorAll('.print-chord-row')[i];
            if (!rangee) return null;
            return Math.round(reg.getBoundingClientRect().left - rangee.getBoundingClientRect().left);
        }).filter(v => v !== null);
        return {
            lignes,
            debordeGauche: Math.min(...nums.map(n => n.getBoundingClientRect().left)) < pageB.left,
            debordeDroite: Math.max(...nums.map(n => n.getBoundingClientRect().right)) > pageB.right,
            debordePage: document.querySelector('.print-page').scrollWidth > Math.ceil(pageB.width) + 1,
            alignementRegleCases: alignement,
        };
    });

    console.log('\n=== A. Chaque chiffre est centré sur son trait de mesure ===');
    const ecarts = releve.lignes.flatMap(l => l.mesures.map(m => m.ecart));
    check(ecarts.every(e => Math.abs(e) <= 1),
        `tous les numéros de mesure tombent sur leur trait — écarts ${JSON.stringify(ecarts)} (5px avant)`);
    const ecartsFin = releve.lignes.flatMap(l => l.mesures.filter(m => m.fin).map(m => m.ecartFin));
    check(ecartsFin.every(e => Math.abs(e) <= 1),
        `...et les numéros de fin de ligne sur le trait de fin — écarts ${JSON.stringify(ecartsFin)}`);

    console.log('\n=== B. La fin de ligne annonce la mesure SUIVANTE ===');
    const fins = releve.lignes.map(l => l.mesures.filter(m => m.fin).map(m => ({ derniere: m.numero, fin: m.fin }))[0]);
    check(fins[0] && fins[0].derniere === '4' && fins[0].fin === '5',
        `ligne 1 : se termine sur la mesure ${fins[0] && fins[0].derniere}, annonce ${fins[0] && fins[0].fin}`);
    check(fins[1] && fins[1].derniere === '8' && fins[1].fin === '9',
        `ligne 2 : se termine sur la mesure ${fins[1] && fins[1].derniere}, annonce ${fins[1] && fins[1].fin}`);
    check(fins.every(f => f && f.fin !== f.derniere),
        'plus aucun numéro répété aux deux bouts d\'une même ligne');

    console.log('\n=== C. Rien ne sort de la page imprimée ===');
    // Le centrage fait dépasser le premier et le dernier chiffre d'une demi-largeur : sans la place
    // qu'on leur a donnée sur la page, le rendu PDF rognait le « 1 » par la moitié.
    check(!releve.debordeGauche, 'le premier chiffre de chaque ligne tient dans la page');
    check(!releve.debordeDroite, 'le numéro de fin aussi');
    check(!releve.debordePage, 'et la page elle-même ne déborde pas — c\'est elle que le PDF rastérise');

    console.log('\n=== D. La règle reste alignée sur les cases d\'accords ===');
    check(releve.alignementRegleCases.every(v => Math.abs(v) <= 1),
        `même bord gauche que la rangée d'accords au-dessus — écarts ${JSON.stringify(releve.alignementRegleCases)}`);

    await browser.close();
    check(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' — ' + errs[0] : ''));
    console.log(`\n=== ${PASS} PASS / ${FAIL} FAIL ===`);
    process.exit(FAIL ? 1 : 0);
})();
