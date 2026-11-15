// L7a (15/11) — TÉLÉPHONE : la rangée du haut.
//
// CE QUE L'UTILISATEUR A DEMANDÉ (14/11, lettre S) : « trop de texte et ça dépasse de la fenêtre […] les noms d'accords sont encore écrits en français » → la barre-résumé
// dit « C · 120 BPM · 4/4 » ; « place le bouton séquenceur ici finalement : il y a un espace à droite » → trois éléments sous la barre des onglets : la barre-résumé
// (du bord gauche des onglets au bord droit de « Paroles »), le bouton d'affichage de la grille SOUS « Annuler », le bouton Séquenceur (logo vert, 44 px) SOUS « Rétablir ».
// Et la fenêtre de la tonalité : modes courts (Maj, Min, Dor…), « Suggérer », plus de phrase d'aide.
//
// Ce que le banc éprouve :
//   A. l'alignement au pixel, à 390, 360, 320 et 820 px : la barre part du bord des onglets, les deux boutons carrés tombent sous Annuler et Rétablir, écart de 6 px ;
//   B. le texte de la barre (court) et son détail en infobulle et en aria-label ; le résumé suit un changement de mesure et de mode ;
//   C. le bouton Séquenceur, au doigt : il ouvre le panneau d'accord sur l'onglet « Rythme », sur l'accord choisi (sinon le premier de la partie) ;
//   D. la fenêtre de la tonalité : sept modes courts avec leur nom complet en infobulle, « Suggérer », pas de phrase d'aide ; choisir « Dor » règle le vrai mode ;
//   E. l'ordinateur n'a pas bougé : pas de bouton Séquenceur de rangée, la fenêtre de tonalité a elle aussi des modes courts.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('téléphone : la rangée du haut (L7a)');
const { estBruitReseau } = require('./_harness');
const V = require('./_verre_commun');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

plan(34);

const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
const SECTIONS = [
    { title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', '7')] },
    { title: 'Refrain', chords: [mk('F', 'maj'), mk('G', 'maj'), mk('C', 'maj'), mk('A', 'min')] },
];

async function ouvrir(nav, contexte, erreurs, nom) {
    const ctx = await nav.newContext(contexte);
    await ctx.addInitScript((sections) => {
        if (sessionStorage.getItem('banc-l7a')) return;
        sessionStorage.setItem('banc-l7a', '1');
        localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight', savedAt: Date.now(), sections }]));
        localStorage.setItem('harmohubCurrentSongId', 's1');
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    }, SECTIONS);
    await ctx.route(/gstatic\.com|googleapis\.com|tonejs\.github\.io/, r => r.abort());
    const p = await ctx.newPage();
    p.on('pageerror', e => erreurs.push(nom + e.message));
    p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !V.BRUIT.test(m.text())) erreurs.push(nom + 'console: ' + m.text()); });
    await p.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await p.waitForFunction(() => !!window.app);
    await p.waitForTimeout(800);
    return { p, ctx };
}

const tel = (l) => ({ viewport: { width: l, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const toucher = async (p, sel, ms = 250) => { await p.tap(sel); await p.waitForTimeout(ms); };
const boite = (p, sel) => p.evaluate((s) => {
    const e = document.querySelector(s); if (!e) return null;
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    return { x: r.x, y: r.y, w: r.width, h: r.height, rt: r.right, b: r.bottom, rayon: parseFloat(cs.borderTopLeftRadius), vis: r.width > 1 && r.height > 1 && cs.display !== 'none' && cs.visibility !== 'hidden' };
}, sel);

// L'alignement de la rangée sur celle des onglets : retourne tous les écarts, en pixels.
async function alignement(p) {
    const m = await Promise.all(['#tb-onglets', '#global-undo-btn', '#global-redo-btn', '#song-summary', '#tel-affichage', '#tel-sequenceur'].map(s => boite(p, s)));
    const [onglets, annuler, retablir, resume, aff, seq] = m;
    if (m.some(b => !b || !b.vis)) return null;
    return {
        gaucheBarre: Math.abs(resume.x - onglets.x), // la barre part du bord gauche des onglets
        affSousAnnuler: Math.abs(aff.x - annuler.x), seqSousRetablir: Math.abs(seq.x - retablir.x),
        ecartBarreAff: aff.x - resume.rt, ecartAffSeq: seq.x - aff.rt, droite: Math.abs(seq.rt - retablir.rt),
        memeLigne: Math.max(Math.abs(resume.y - aff.y), Math.abs(aff.y - seq.y)),
        carres: [aff.w, aff.h, seq.w, seq.h], hauteurBarre: resume.h, rayons: [resume.rayon, aff.rayon, seq.rayon],
    };
}

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    try {
        // ===== A. L'ALIGNEMENT, À QUATRE LARGEURS ====================================================================================
        console.log('=== A. L\'alignement sur la rangée des onglets ===');
        let { p, ctx } = await ouvrir(nav, tel(390), erreurs, '390 : ');
        const a390 = await alignement(p);
        exiger(!!a390, 'à 390 px, la barre-résumé et les deux boutons carrés sont à l\'écran');
        check(a390.gaucheBarre <= 1 && a390.affSousAnnuler <= 1 && a390.seqSousRetablir <= 1 && a390.droite <= 1,
            `la barre part du bord des onglets ; Affichage tombe sous Annuler, Séquenceur sous Rétablir, bord droit commun (${JSON.stringify([a390.gaucheBarre, a390.affSousAnnuler, a390.seqSousRetablir, a390.droite])})`);
        check(Math.abs(a390.ecartBarreAff - 6) <= 1 && Math.abs(a390.ecartAffSeq - 6) <= 1 && a390.memeLigne <= 1,
            `écart de 6 px entre les trois, sur une seule ligne (${Math.round(a390.ecartBarreAff)} / ${Math.round(a390.ecartAffSeq)})`);
        check(a390.carres.every(v => Math.abs(v - 44) <= 1) && Math.abs(a390.hauteurBarre - 44) <= 1 && a390.rayons.every(r => r === 7),
            `barre de 44 px de haut, deux carrés de 44 px, angles de 7 px (${a390.carres.map(Math.round).join('×')})`);
        const vert = await p.evaluate(() => { const c = getComputedStyle(document.getElementById('tel-sequenceur')).color.match(/\d+/g).map(Number); return c; });
        check(vert[1] > vert[0] + 60 && vert[1] > vert[2] + 40, `le logo du bouton Séquenceur est vert (rgb ${vert.join(',')})`);
        const nbTrait = await p.evaluate(() => document.querySelectorAll('#tel-sequenceur svg path').length);
        check(nbTrait === 1, 'et c\'est le logo du bouton Séquenceur de l\'ordinateur, repris tel quel (un seul tracé de quatre barres)');
        await p.close(); await ctx.close();

        for (const l of [360, 320, 820]) {
            const o = await ouvrir(nav, tel(l), erreurs, l + ' : ');
            const a = await alignement(o.p);
            exiger(!!a, `à ${l} px, la rangée est à l'écran`);
            check(a.gaucheBarre <= 1 && a.affSousAnnuler <= 1 && a.seqSousRetablir <= 1 && Math.abs(a.ecartBarreAff - 6) <= 1 && Math.abs(a.ecartAffSeq - 6) <= 1,
                `à ${l} px : même alignement, écart de 6 px (${JSON.stringify([a.gaucheBarre, a.affSousAnnuler, a.seqSousRetablir, Math.round(a.ecartBarreAff), Math.round(a.ecartAffSeq)])})`);
            // Le résumé court n'est jamais coupé, à aucune de ces largeurs (le plus étroit, 320 px, est celui qui l'aurait rogné).
            const coupe = await o.p.evaluate(() => { const t = document.getElementById('song-summary-tel'); return { sw: t.scrollWidth, cw: t.clientWidth, debord: document.documentElement.scrollWidth - innerWidth }; });
            check(coupe.sw <= coupe.cw && coupe.debord <= 0, `à ${l} px, le résumé court tient sans être coupé et la page ne déborde pas (${coupe.sw} ≤ ${coupe.cw})`);
            await o.p.close(); await o.ctx.close();
        }

        // ===== B. LE TEXTE DE LA BARRE ===============================================================================================
        console.log('\n=== B. Le résumé court et son détail ===');
        ({ p, ctx } = await ouvrir(nav, tel(390), erreurs, 'téléphone : '));
        const lit = () => p.evaluate(() => { const b = document.getElementById('song-summary'); return { texte: b.innerText.trim(), aria: b.getAttribute('aria-label'), titre: b.title }; });
        const r0 = await lit();
        check(r0.texte === 'C · 120 BPM · 4/4', `la barre dit « ${r0.texte} »`);
        check(/C majeur/.test(r0.aria) && /Droit/.test(r0.aria) && /Piano/.test(r0.aria) && /120 BPM/.test(r0.aria) && /C majeur/.test(r0.titre) && /Droit/.test(r0.titre),
            `tout le détail (tonalité complète, swing, son) est dans l'aria-label et l'infobulle (« ${r0.aria} »)`);
        await toucher(p, '#song-summary');
        await toucher(p, '#rr-mesure');
        await toucher(p, '#rr-pop [data-rr-valeur="3/4"]', 400);
        const r1 = await lit();
        check(r1.texte === 'C · 120 BPM · 3/4' && /3\/4/.test(r1.aria), `choisir 3/4 : la barre le dit (« ${r1.texte} »)`);
        await toucher(p, '#global-undo-btn', 400);
        check((await lit()).texte === 'C · 120 BPM · 4/4', 'une annulation rend « C · 120 BPM · 4/4 »');

        // ===== D. LA FENÊTRE DE LA TONALITÉ ==========================================================================================
        console.log('\n=== D. Modes courts, « Suggérer », plus de phrase d\'aide ===');
        await toucher(p, '#rr-tonalite');
        const f = await p.evaluate(() => {
            const pop = document.getElementById('rr-pop');
            const modes = [...pop.querySelectorAll('[data-rr-action="mode"]')];
            const sugg = pop.querySelector('.rr-suggerer');
            return {
                mots: modes.map(b => b.textContent.trim()).join(), titres: modes.map(b => b.title).join(), arias: modes.map(b => b.getAttribute('aria-label')).join(),
                sugg: sugg && sugg.textContent.trim(), suggTitre: sugg && sugg.title, aide: pop.querySelectorAll('.rr-aide').length,
                titreMode: [...pop.querySelectorAll('.rr-lbl')].map(l => l.title).filter(Boolean).length,
                taille: Math.min(...modes.map(b => b.getBoundingClientRect().height)),
            };
        });
        check(f.mots === 'Maj,Min,Dor,Phr,Lyd,Mix,Loc', `les sept modes s'écrivent courts (${f.mots})`);
        check(f.titres === 'Majeur,Mineur,Dorien,Phrygien,Lydien,Mixolydien,Locrien' && f.arias === f.titres, `le nom complet est en infobulle et en aria-label (${f.titres})`);
        check(f.sugg === 'Suggérer' && /accords/.test(f.suggTitre), `« Suggérer » (la phrase entière en infobulle : « ${f.suggTitre} »)`);
        check(f.aide === 0 && f.titreMode === 2, `plus de phrase d'aide sous la fenêtre ; elle passe en infobulle des deux titres (${f.aide} phrase, ${f.titreMode} titres)`);
        check(f.taille >= 38, `les boutons restent faciles à toucher (${f.taille} px)`);
        await toucher(p, '#rr-pop [data-rr-action="mode"][data-rr-valeur="dorian"]');
        const dor = await p.evaluate(() => ({ mode: document.getElementById('global-mode').value, texte: document.getElementById('song-summary').innerText.trim(), puce: document.querySelector('#rr-tonalite .rr-val').textContent }));
        check(dor.mode === 'dorian' && dor.texte === 'C dor · 120 BPM · 4/4', `toucher « Dor » règle le vrai mode ; la barre dit « ${dor.texte} », la case « ${dor.puce} »`);
        await p.keyboard.press('Escape'); await p.waitForTimeout(200);
        await toucher(p, '#global-undo-btn', 400);
        check((await lit()).texte === 'C · 120 BPM · 4/4' && await p.evaluate(() => document.getElementById('global-mode').value === 'maj'), 'une annulation rend le mode majeur');

        // ===== C. LE BOUTON SÉQUENCEUR ===============================================================================================
        console.log('\n=== C. Le bouton Séquenceur ouvre le panneau d\'accord sur « Rythme » ===');
        await toucher(p, '#song-summary'); // referme les quatre cases
        const avant = await p.evaluate(() => ({ ouvert: !document.getElementById('panneau-accord').hidden, selection: window.app.selectedIndex }));
        check(!avant.ouvert, 'au départ, le panneau d\'accord est fermé');
        await toucher(p, '#tel-sequenceur', 500);
        const ouvert = await p.evaluate(() => {
            const pa = document.getElementById('panneau-accord'); const z = window.app._bulle;
            return { visible: !pa.hidden, rythme: !!(z && z.rythme), section: z && z.section, index: z && z.index, corps: document.body.classList.contains('pa-rythme-ouvert'), onglet: (pa.querySelector('[data-bulle="onglet"][aria-pressed="true"]') || {}).textContent };
        });
        check(ouvert.visible && ouvert.rythme && ouvert.corps && ouvert.onglet === 'Rythme', `un toucher ouvre le panneau d'accord sur l'onglet « ${ouvert.onglet} »`);
        check(ouvert.section === 0 && ouvert.index === 0, `sans accord choisi, c'est le premier de la partie (partie ${ouvert.section}, accord ${ouvert.index})`);
        const seqVisible = await p.evaluate(() => { const s = document.getElementById('sequenceur'); const r = s.getBoundingClientRect(); return { dans: document.getElementById('pa-rythme').contains(s), vu: r.width > 100 && r.height > 50 }; });
        check(seqVisible.dans && seqVisible.vu, 'le séquenceur est bien dans le panneau et on le voit');
        await p.close(); await ctx.close();

        // Avec un accord déjà choisi, c'est LUI.
        ({ p, ctx } = await ouvrir(nav, tel(390), erreurs, 'téléphone (choix) : '));
        await p.evaluate(() => { window.app.activeSection = 1; window.app.selectedIndex = 2; window.app.loadProgression(); });
        await p.waitForTimeout(300);
        await toucher(p, '#tel-sequenceur', 500);
        const choisi = await p.evaluate(() => { const z = window.app._bulle; return z && { rythme: z.rythme, section: z.section, index: z.index }; });
        check(choisi && choisi.rythme && choisi.section === 1 && choisi.index === 2, `avec l'accord 3 du Refrain choisi, le panneau s'ouvre sur lui (${JSON.stringify(choisi)})`);
        await p.close(); await ctx.close();

        // ===== E. L'ORDINATEUR N'A PAS BOUGÉ =========================================================================================
        console.log('\n=== E. Ordinateur ===');
        ({ p, ctx } = await ouvrir(nav, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, erreurs, 'ordinateur : '));
        const bureau = await p.evaluate(() => {
            const seq = document.getElementById('tel-sequenceur'), aff = document.getElementById('tel-affichage');
            return { seq: getComputedStyle(seq).display, aff: getComputedStyle(aff).display, grosBouton: !!document.getElementById('vue-sequenceur') && document.getElementById('vue-sequenceur').getBoundingClientRect().width > 20 };
        });
        check(bureau.seq === 'none' && bureau.aff === 'none' && bureau.grosBouton, `à l'ordinateur, la rangée du téléphone n'existe pas (${bureau.seq}, ${bureau.aff}) et le bouton Séquenceur de la grille est là`);
        await p.click('#rr-tonalite'); await p.waitForTimeout(250);
        const modesBureau = await p.evaluate(() => [...document.querySelectorAll('#rr-pop [data-rr-action="mode"]')].map(b => b.textContent.trim()).join());
        check(modesBureau === 'Maj,Min,Dor,Phr,Lyd,Mix,Loc', `la fenêtre de tonalité de l'ordinateur a aussi des modes courts (${modesBureau})`);
        await p.close(); await ctx.close();
    } catch (e) {
        console.log('FATAL ' + e.message);
        process.exitCode = 1;
    }
    check(erreurs.length === 0, `aucune erreur de page ni de console${erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''}`);
    await nav.close();
    bilan();
})();
