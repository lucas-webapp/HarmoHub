// PROPOSER DE RENOMMER L'ACCORD QUAND UNE NOTE AJOUTÉE LE COMPLÈTE (outil perdu en route, redemandé par l'utilisateur le 15/11).
//
// SES MOTS : « il me semble qu'il y a un outil qu'on a perdu en cours de route, c'est de renommer automatiquement l'accord, enfin me le proposer, si j'ajoute des notes. Par exemple, si j'ajoute une 9e,
// j'aimerais que l'application me propose de renommer l'accord en accord 9e. »
//
// CE QUE LE BANC TIENT (vrais gestes dans la vue Piano) : une 9e posée sur Cmaj7 et TENUE (glissé de quatre croches) fait apparaître la proposition « Cmaj7 + D : renommer en Cmaj9 ? » ; une seule croche
// (une note de passage) ne propose rien ; « Renommer » change la qualité en maj9, la note devient une voix de l'accord (plus de note libre) et garde son rythme ; Ctrl+Z défait le renommage seul ;
// le × ignore ; rien n'est renommé sans le clic ; le téléphone n'a pas bougé.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('proposition de renommer');
const { estBruitReseau } = require('./_harness');
const R = require('./_retrait_ancien');

plan(13);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, b = 4) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const S = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7')] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    localStorage.setItem('harmohubSequenceurVue', 'notes');
    localStorage.setItem('harmohubSequenceurOuvert', '1');
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport, opts = {}) => {
        const p = await nav.newPage({ viewport, ...opts });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const accord = (p) => p.evaluate(() => { const d = loadProgressionSections()[0].chords[0]; return { q: d.quality, libres: (d.extraNotes || []).length }; });
    const prop = (p) => p.evaluate(() => { const b = document.getElementById('proposition-nom'); return b.hidden ? null : document.getElementById('proposition-nom-texte').textContent; });
    // La case de la ligne D5 (midi 74, la 9e de C), accord 0, croche k : visible dans la grille (on la fait défiler à la molette).
    const caseD5 = async (p, k) => {
        const g = await p.locator('#sq-grille').boundingBox();
        await p.mouse.move(g.x + 300, g.y + 150); await p.mouse.wheel(0, -2000); await p.waitForTimeout(200);
        return p.evaluate((k) => { const et = [...document.querySelectorAll('#sq-grille .sq-etiq[data-midi]')], i = et.findIndex(x => +x.dataset.midi === 74); const c = document.querySelector(`#sq-grille .sq-case[data-c="0"][data-r="${i}"][data-k="${k}"]`); const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; }, k);
    };

    console.log('\n=== A. Une 9e tenue : la proposition ; une note de passage : rien ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    exiger((await R.ouvrirNouveau(p)).ok, 'le séquenceur est ouvert');
    let c = await caseD5(p, 0);
    await p.mouse.click(c.x, c.y); await p.waitForTimeout(1300);
    check(await prop(p) === null, 'une seule croche (une note de passage) ne propose rien');
    check((await accord(p)).libres === 1, 'la note est posée, comme avant (une note libre)');
    await p.close();
    p = await ouvrir({ width: 1440, height: 900 });   // page neuve : la fenêtre du Piano repart de zéro
    c = await caseD5(p, 0);
    await p.mouse.move(c.x - c.w / 2 + 4, c.y); await p.mouse.down(); await p.mouse.move(c.x + 3.5 * c.w, c.y, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(1300);
    const texte = await prop(p);
    check(texte !== null && /Cmaj7/.test(texte) && /D/.test(texte) && /Cmaj9/.test(texte), `quatre croches tenues : « ${texte} »`);
    check((await accord(p)).q === 'maj7', 'rien n\'est renommé sans le clic');

    console.log('\n=== B. Renommer, annuler, ignorer ===');
    await p.click('#proposition-nom-ok'); await p.waitForTimeout(500);
    const apres = await p.evaluate(() => { const d = loadProgressionSections()[0].chords[0], e = SequenceurHarmo.lireAccord(d); const par = {}; e.on.forEach(k => { const v = k.split(':')[0]; par[v] = (par[v] || 0) + 1; }); return { q: d.quality, libres: (d.extraNotes || []).length, voix: e.info.voix.length, allumees: Object.keys(par).length, maxCroches: Math.max(...Object.values(par)), min: Math.min(...Object.values(par)) }; });
    check(apres.q === 'maj9' && apres.libres === 0, `« Renommer » : l'accord devient maj9, la note n'est plus une note libre (${JSON.stringify(apres)})`);
    check(apres.voix === 5 && apres.allumees === 5 && apres.min >= 4, `la 9e est une voix de l'accord et garde son rythme (quatre croches au moins : ${JSON.stringify(apres)})`);
    check(await prop(p) === null, 'la proposition se referme');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(400);
    const annule = await accord(p);
    check(annule.q === 'maj7' && annule.libres === 1, `Ctrl+Z défait le renommage seul : la note redevient libre (${JSON.stringify(annule)})`);
    await p.close();
    p = await ouvrir({ width: 1440, height: 900 });
    c = await caseD5(p, 0);
    await p.mouse.move(c.x - c.w / 2 + 4, c.y); await p.mouse.down(); await p.mouse.move(c.x + 3.5 * c.w, c.y, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(1300);
    exiger(await prop(p) !== null, 'la proposition revient pour la même note');
    await p.click('#proposition-nom-fermer'); await p.waitForTimeout(300);
    check(await prop(p) === null && (await accord(p)).q === 'maj7', 'le × ignore la proposition, l\'accord garde son nom');
    await p.close();

    console.log('\n=== C. Le téléphone n\'a pas bougé ===');
    p = await ouvrir({ width: 390, height: 844 }, { hasTouch: true, isMobile: true });
    check(await p.evaluate(() => document.getElementById('proposition-nom').hidden), 'au téléphone, aucune proposition');

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length ? erreurs.join(' | ') : 'aucune'})`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
