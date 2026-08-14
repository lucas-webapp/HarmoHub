// Paroles — corrections : l'ancre suit le texte, le collage est propre, la réserve reste à portée,
// et poser une progression coûte deux fois moins de clics.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

const SONG = {
    version: 1, song: 'Test', songId: 'fixes-1', beatsPerBar: 4,
    sections: [{ title: 'Couplet', chords: [
        { symbol: 'C', beats: 4 }, { symbol: 'Am', beats: 4 }, { symbol: 'F', beats: 4 }, { symbol: 'G', beats: 4 },
    ] }],
};

// Où se trouve, à l'écran, le caractère qui commence `mot` ?
const OUTILS = `
window._posMot = (mot) => {
    const t = document.querySelector('.lyrics-text');
    const noeuds = [];
    const w = document.createTreeWalker(t, NodeFilter.SHOW_TEXT, null);
    let n; while ((n = w.nextNode())) noeuds.push(n);
    for (const nd of noeuds) {
        const i = nd.textContent.indexOf(mot);
        if (i < 0) continue;
        const r = document.createRange(); r.setStart(nd, i); r.setEnd(nd, i + 1);
        const b = r.getBoundingClientRect();
        return { x: b.left, y: b.top + b.height / 2, gauche: b.left };
    }
    return null;
};
// La pastille est CENTRÉE sur son point d'ancrage (transform: translate(-50%) en CSS) : c'est donc
// son centre qu'il faut comparer au bord gauche du caractère visé, jamais son bord gauche à elle.
window._pastilles = () => [...document.querySelectorAll('.lyric-pill')].map(p => {
    const b = p.getBoundingClientRect();
    return { txt: p.textContent.replace('×','').trim(), gauche: b.left + b.width / 2 };
});
window._ecrire = (txt) => {
    const t = document.querySelector('.lyrics-text');
    t.innerHTML = '';
    t.appendChild(document.createTextNode(txt));
    t.dispatchEvent(new Event('input', { bubbles: true }));
};
`;

(async () => {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));

    async function neuf(id) {
        await page.goto(`${BASE}/paroles.html`);
        await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('harmohub_lyrics_pending_import', JSON.stringify(s)); },
            { ...SONG, songId: id });
        await page.reload();
        await page.waitForTimeout(500);
        await page.addScriptTag({ content: OUTILS });
    }

    // ============================================================
    // === A. L'ancre suit le texte quand on le retouche ===
    // ============================================================
    await neuf('a1');
    await page.evaluate(() => window._ecrire('marche seul dans la nuit froide'));
    await page.waitForTimeout(250);
    let cible = await page.evaluate(() => window._posMot('nuit'));
    await page.click('.chord-chip:nth-child(1)');
    await page.mouse.click(cible.x + 1, cible.y);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);

    // Insère un mot AU DÉBUT : l'accord doit rester sur « nuit », donc se décaler avec lui.
    await page.evaluate(() => {
        const t = document.querySelector('.lyrics-text');
        t.firstChild.textContent = 'Je ' + t.firstChild.textContent;
        t.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    let r = await page.evaluate(() => ({ cible: window._posMot('nuit'), pastilles: window._pastilles() }));
    check(r.pastilles.length === 1 && Math.abs(r.pastilles[0].gauche - r.cible.gauche) < 12,
        `un mot inséré AVANT : l'accord suit sa syllabe — pastille ${Math.round(r.pastilles[0].gauche)}, syllabe ${Math.round(r.cible.gauche)}`);

    // Efface un mot avant l'ancre : elle doit revenir vers la gauche avec le texte.
    await page.evaluate(() => {
        const t = document.querySelector('.lyrics-text');
        t.firstChild.textContent = t.firstChild.textContent.replace('seul ', '');
        t.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    r = await page.evaluate(() => ({ cible: window._posMot('nuit'), pastilles: window._pastilles() }));
    check(r.pastilles.length === 1 && Math.abs(r.pastilles[0].gauche - r.cible.gauche) < 12,
        `un mot effacé AVANT : l'accord suit encore — pastille ${Math.round(r.pastilles[0].gauche)}, syllabe ${Math.round(r.cible.gauche)}`);

    // Retouche APRÈS l'ancre : elle ne doit surtout pas bouger.
    const avantSuffixe = r.pastilles[0].gauche;
    await page.evaluate(() => {
        const t = document.querySelector('.lyrics-text');
        t.firstChild.textContent = t.firstChild.textContent + ' et sombre';
        t.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    r = await page.evaluate(() => window._pastilles());
    check(Math.abs(r[0].gauche - avantSuffixe) < 3,
        `une retouche APRÈS l'ancre ne la déplace pas — ${Math.round(r[0].gauche)} vs ${Math.round(avantSuffixe)}`);

    // Le mot porteur est réécrit : l'accord ne doit pas disparaître.
    await page.evaluate(() => {
        const t = document.querySelector('.lyrics-text');
        t.firstChild.textContent = t.firstChild.textContent.replace('nuit', 'brume');
        t.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    r = await page.evaluate(() => window._pastilles());
    check(r.length === 1, `réécrire le mot porteur ne fait pas disparaître l'accord — ${r.length} pastille(s)`);

    // Frappe caractère par caractère (le vrai geste), pas une réécriture d'un bloc.
    await neuf('a2');
    await page.click('.lyrics-text');
    await page.keyboard.type('marche seul dans la nuit');
    await page.waitForTimeout(300);
    cible = await page.evaluate(() => window._posMot('nuit'));
    await page.click('.chord-chip:nth-child(1)');
    await page.mouse.click(cible.x + 1, cible.y);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    await page.evaluate(() => {
        const t = document.querySelector('.lyrics-text');
        t.focus();
        const r2 = document.createRange(); r2.setStart(t.firstChild, 0); r2.collapse(true);
        const s = getSelection(); s.removeAllRanges(); s.addRange(r2);
    });
    await page.keyboard.type('Je ');
    await page.waitForTimeout(400);
    r = await page.evaluate(() => ({ cible: window._posMot('nuit'), pastilles: window._pastilles() }));
    check(r.pastilles.length === 1 && Math.abs(r.pastilles[0].gauche - r.cible.gauche) < 12,
        `en tapant vraiment au clavier, l'accord suit aussi — pastille ${Math.round(r.pastilles[0].gauche)}, syllabe ${Math.round(r.cible.gauche)}`);

    // Annuler doit ramener l'ancre ET le texte ensemble.
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(400);
    r = await page.evaluate(() => ({ texte: document.querySelector('.lyrics-text').innerText, cible: window._posMot('nuit'), pastilles: window._pastilles() }));
    check(!r.texte.startsWith('Je ') && r.pastilles.length === 1 && Math.abs(r.pastilles[0].gauche - r.cible.gauche) < 12,
        `après Annuler, texte et accord reviennent ensemble — « ${r.texte.slice(0, 26)} »`);

    // ...et la frappe SUIVANTE se recale par rapport au texte restauré, pas au texte d'avant.
    await page.evaluate(() => {
        const t = document.querySelector('.lyrics-text');
        t.focus();
        const r2 = document.createRange(); r2.setStart(t.firstChild, 0); r2.collapse(true);
        const s = getSelection(); s.removeAllRanges(); s.addRange(r2);
    });
    await page.keyboard.type('Oh ');
    await page.waitForTimeout(400);
    r = await page.evaluate(() => ({ cible: window._posMot('nuit'), pastilles: window._pastilles(), texte: document.querySelector('.lyrics-text').innerText }));
    if (r.pastilles.length !== 1) console.log('   (diagnostic : ' + JSON.stringify(r) + ')');
    check(r.pastilles.length === 1 && r.cible && Math.abs(r.pastilles[0].gauche - r.cible.gauche) < 12,
        `la frappe qui SUIT une annulation se recale correctement — pastille ${Math.round(r.pastilles[0].gauche)}, syllabe ${Math.round(r.cible.gauche)}`);

    // ============================================================
    // === B. Collage : le texte entre, la mise en forme reste dehors ===
    // ============================================================
    await neuf('b1');
    await page.evaluate(async () => {
        const html = '<p style="color:#c00;font-size:32px;font-family:Georgia"><b>Couplet collé</b></p>'
                   + '<p style="background:yellow">deuxième ligne</p>';
        await navigator.clipboard.write([new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob(['Couplet collé\ndeuxième ligne'], { type: 'text/plain' }),
        })]);
    });
    await page.click('.lyrics-text');
    await page.keyboard.press('Control+V');
    await page.waitForTimeout(400);
    const colle = await page.evaluate(() => {
        const t = document.querySelector('.lyrics-text');
        return {
            html: t.innerHTML,
            texte: t.innerText.replace(/\n+/g, '|'),
            balises: [...t.querySelectorAll('*')].map(x => x.tagName).join(','),
        };
    });
    check(!/style=|color|font-size|Georgia|background/i.test(colle.html),
        `la mise en forme du traitement de texte n'entre pas — ${colle.html.slice(0, 90)}`);
    check(/Couplet collé/.test(colle.texte) && /deuxième ligne/.test(colle.texte),
        `...mais tout le texte est bien là — « ${colle.texte} »`);
    check(/BR/.test(colle.balises) && !/P|B|SPAN|FONT/.test(colle.balises.replace(/BR/g, '')),
        `...avec ses retours à la ligne, et rien d'autre — balises : ${colle.balises}`);

    // Un accord posé avant un collage doit se recaler comme pour n'importe quelle frappe.
    await page.evaluate(() => window._ecrire('la nuit tombe'));
    await page.waitForTimeout(250);
    cible = await page.evaluate(() => window._posMot('tombe'));
    await page.click('.chord-chip:nth-child(1)');
    await page.mouse.click(cible.x + 1, cible.y);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    await page.evaluate(async () => {
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob(['Oh '], { type: 'text/plain' }) })]);
        const t = document.querySelector('.lyrics-text');
        t.focus();
        const r2 = document.createRange(); r2.setStart(t.firstChild, 0); r2.collapse(true);
        const s = getSelection(); s.removeAllRanges(); s.addRange(r2);
    });
    await page.keyboard.press('Control+V');
    await page.waitForTimeout(400);
    r = await page.evaluate(() => ({ cible: window._posMot('tombe'), pastilles: window._pastilles() }));
    check(r.pastilles.length === 1 && Math.abs(r.pastilles[0].gauche - r.cible.gauche) < 12,
        `un collage devant l'ancre la décale comme il faut — pastille ${Math.round(r.pastilles[0].gauche)}, syllabe ${Math.round(r.cible.gauche)}`);

    // ============================================================
    // === C. La réserve reste à portée dans une partie longue ===
    // ============================================================
    await neuf('c1');
    await page.evaluate(() => {
        const t = document.querySelector('.lyrics-text');
        t.innerHTML = '';
        for (let i = 1; i <= 30; i++) {
            const d = document.createElement('div');
            d.textContent = `Ligne ${i} des paroles de cette chanson`;
            t.appendChild(d);
        }
        t.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const bas = await page.evaluate(() => {
        const p = document.querySelector('.chord-pool').getBoundingClientRect();
        const tb = document.querySelector('.toolbar').getBoundingClientRect();
        const hb = document.querySelector('.top-bar').getBoundingClientRect();
        return {
            reserveVisible: p.top >= 0 && p.bottom <= window.innerHeight,
            barreOutilsVisible: tb.top >= hb.bottom - 1,
            reserveSousBarre: p.top >= tb.bottom - 1,
            chipCliquable: (() => {
                const c = document.querySelector('.chord-chip').getBoundingClientRect();
                const dessus = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2);
                return !!(dessus && dessus.closest('.chord-chip'));
            })(),
        };
    });
    check(bas.reserveVisible, 'tout en bas d\'une partie de 30 lignes, la réserve d\'accords est encore à l\'écran');
    check(bas.chipCliquable, '...et ses pastilles sont réellement cliquables, rien ne passe par-dessus');
    check(bas.barreOutilsVisible, 'la barre d\'outils ne se cache pas derrière l\'en-tête');
    check(bas.reserveSousBarre, 'les trois barres s\'empilent sans se recouvrir');

    // ============================================================
    // === D. Enchaînement : une progression coûte deux fois moins de clics ===
    // ============================================================
    await neuf('d1');
    await page.evaluate(() => {
        const t = document.querySelector('.lyrics-text');
        t.innerHTML = '';
        for (let i = 1; i <= 4; i++) {
            const d = document.createElement('div');
            d.textContent = `Ligne numéro ${i} de cette chanson`;
            t.appendChild(d);
        }
        t.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(400);
    const lignes = await page.evaluate(() => [...document.querySelector('.lyrics-text').children]
        .map(d => { const b = d.getBoundingClientRect(); return { x: Math.round(b.left + 40), y: Math.round(b.top + b.height / 2) }; }));

    let clics = 0;
    await page.click('.chord-chip:nth-child(1)'); clics++;      // un seul choix dans la réserve
    for (const l of lignes) { await page.mouse.click(l.x, l.y); clics++; await page.waitForTimeout(120); }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const enchaine = await page.evaluate(() => [...document.querySelectorAll('.lyric-pill')]
        .map(p => p.textContent.replace('×', '').trim()));
    check(clics === 5, `4 accords posés en ${clics} clics (2 par accord auparavant, soit 8)`);
    check(JSON.stringify(enchaine) === JSON.stringify(['C', 'Am', 'F', 'G']),
        `...et ce sont bien les accords de la partie, dans l'ordre — obtenu ${JSON.stringify(enchaine)}`);

    // L'indication annonce l'accord suivant.
    await page.click('.chord-chip:nth-child(1)');
    await page.waitForTimeout(200);
    const indic = await page.evaluate(() => document.getElementById('armed-hint').textContent);
    check(/C/.test(indic) && /puis Am/.test(indic), `l'indication annonce l'accord en main ET le suivant — « ${indic} »`);

    // Le mode tampon reste disponible : décocher l'option remet le comportement d'avant.
    await page.click('#btn-options');
    await page.click('#opt-chain');
    await page.waitForTimeout(200);
    await page.click('#btn-options'); // referme le panneau : ouvert, il décale toute la page vers le bas
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    // Coordonnées RECALCULÉES : la mise en page a bougé entre-temps, viser les anciennes ferait
    // cliquer à côté du texte — et le test conclurait à tort que la pose ne marche plus.
    const lignes2 = await page.evaluate(() => [...document.querySelector('.lyrics-text').children]
        .map(d => { const b = d.getBoundingClientRect(); return { x: Math.round(b.left + 160), y: Math.round(b.top + b.height / 2) }; }));
    await page.click('.chord-chip:nth-child(3)'); // F
    for (const l of lignes2.slice(0, 2)) { await page.mouse.click(l.x, l.y); await page.waitForTimeout(150); }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const tampon = await page.evaluate(() => [...document.querySelectorAll('.lyric-pill')]
        .map(p => p.textContent.replace('×', '').trim()));
    const ajoutes = tampon.filter(x => x === 'F').length;
    check(ajoutes === 3, `option décochée : le MÊME accord se pose plusieurs fois d'affilée — ${ajoutes} F au total (1 posé avant + 2)`);

    // Le réglage survit à un rechargement.
    await page.reload();
    await page.waitForTimeout(600);
    const persiste = await page.evaluate(() => document.getElementById('opt-chain').checked);
    check(persiste === false, `le réglage est retenu d'une session à l'autre — coché : ${persiste}`);

    // ============================================================
    // === E. Cibles tactiles ===
    // ============================================================
    await page.close();
    const mctx = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
    const mob = await mctx.newPage();
    mob.on('pageerror', e => errors.push('pageerror(mobile): ' + e.message));
    await mob.goto(`${BASE}/paroles.html`);
    await mob.evaluate((s) => { localStorage.clear(); localStorage.setItem('harmohub_lyrics_pending_import', JSON.stringify(s)); }, { ...SONG, songId: 'e1' });
    await mob.reload();
    await mob.waitForTimeout(600);
    const cibles = await mob.evaluate(() => {
        const g = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; };
        return { chip: g('.chord-chip'), undo: g('#btn-undo'), mode: g('#mode-syllable') };
    });
    check(cibles.chip && cibles.chip[1] >= 36, `au doigt, une pastille de la réserve fait au moins 36px de haut — ${JSON.stringify(cibles.chip)}`);
    check(cibles.undo && cibles.undo[1] >= 36, `...et les boutons Annuler/Rétablir aussi — ${JSON.stringify(cibles.undo)}`);
    check(cibles.mode && cibles.mode[1] >= 36, `...et le choix du mode — ${JSON.stringify(cibles.mode)}`);

    // Sur téléphone, les trois barres doivent aussi s'empiler sans se cacher.
    await mob.evaluate(() => {
        const t = document.querySelector('.lyrics-text');
        for (let i = 1; i <= 30; i++) { const d = document.createElement('div'); d.textContent = `Ligne ${i}`; t.appendChild(d); }
        t.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await mob.waitForTimeout(300);
    await mob.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await mob.waitForTimeout(300);
    const empil = await mob.evaluate(() => {
        const hb = document.querySelector('.top-bar').getBoundingClientRect();
        const tb = document.querySelector('.toolbar').getBoundingClientRect();
        const p = document.querySelector('.chord-pool').getBoundingClientRect();
        return { entete: Math.round(hb.height), outilsCaches: tb.top < hb.bottom - 1, reserveVisible: p.top >= tb.bottom - 1 && p.bottom <= window.innerHeight };
    });
    check(!empil.outilsCaches,
        `sur téléphone, la barre d'outils n'est plus cachée derrière l'en-tête de ${empil.entete}px — ${JSON.stringify(empil)}`);
    check(empil.reserveVisible, 'et la réserve reste visible sous les deux autres barres');
    await mob.close();

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 || errors.length > 0 ? 1 : 0);
})();
