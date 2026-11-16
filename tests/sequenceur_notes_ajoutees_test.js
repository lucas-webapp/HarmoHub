// LES NOTES AJOUTÉES DU SÉQUENCEUR : MÊME ASPECT, BONNE PLACE, RENOMMAGE DIRECT (L9d, 16/11).
//
// SES MOTS : « 1. Les notes ajoutées ont un aspect très différents des autres sur la gauche (piano). Je pense qu'il faut homogénéiser un peu. Tu peux laisser la croix pour les supprimer si besoin.
// 2. Permets-moi de renommer directement dans le piano des notes que j'ajoute, ça sera plus rapide. Permets-moi de le faire dès la définition d'une note lorsque j'en ajoute une.
// 3. Défaut rencontré : lorsque j'ajoute une note, elle doit se mettre au bon endroit dans le piano. Là elle reste en haut, même si c'est une note grave. »
//
// CE QUE LE BANC TIENT, avec de vrais gestes (clics, frappe au clavier) en vue Accord (Voix) :
//   A. une note ajoutée est une touche comme les autres (blanche ou sombre selon la note), la croix est ce qui la distingue ;
//   B. elle se place À SA HAUTEUR parmi les voix : une grave tout en bas, une aiguë tout en haut, une médiane entre deux voix ;
//   C. son nom se tape dès la bande « Note libre » (le champ, Entrée l'ajoute ; les puces et l'octave restent liés au champ) ;
//   D. un clic sur son nom le rend modifiable : Entrée valide (la note change de hauteur avec toutes ses croches, la ligne se replace, une annulation), Échap annule, un nom faux ou déjà pris est refusé ;
//   E. le téléphone : même aspect, même placement, pas de renommage au clic (le champ de la bande, lui, y est).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('séquenceur : notes ajoutées');
const { estBruitReseau } = require('./_harness');
const V = require('./_verre_commun');

plan(31);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const mk = (r, q) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
const PARTIE = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7')] }];
const TEL = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 };

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (contexte) => {
        const ctx = await nav.newContext(contexte);
        await ctx.addInitScript((S) => {
            if (sessionStorage.getItem('banc-sq-ajoutees')) return;
            sessionStorage.setItem('banc-sq-ajoutees', '1');
            localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
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
        await p.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
        await p.waitForFunction(() => !!window.app);
        await p.waitForTimeout(900);
        return { p, ctx };
    };
    // Les étiquettes de la colonne de gauche, de haut en bas : { nom, libre, diese, fond, bord, croix }.
    const etiquettes = (p) => p.evaluate(() => [...document.querySelectorAll('#sq-grille .sq-etiq')].map(e => {
        const cs = getComputedStyle(e);
        return { nom: e.textContent.trim(), libre: e.classList.contains('libre'), diese: e.classList.contains('diese'), fond: cs.backgroundColor, bord: cs.borderStyle, croix: !!e.querySelector('.sq-libre-retirer'), modifiable: !!e.querySelector('.sq-libre-nom') };
    }));
    const noms = async (p) => (await etiquettes(p)).map(e => e.nom).join(' ');
    const bande = async (p, texte) => {
        await p.click('#sq-grille .sq-libre-btn'); await p.waitForTimeout(250);
        await p.fill('#sq-libre-saisie', texte);
        await p.keyboard.press('Enter'); await p.waitForTimeout(450);
    };
    const accord = (p, c = 0) => p.evaluate((c) => { const d = JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[c]; return { libres: (d.extraNotes || []).map(x => x.note + x.octave).join(), pat: JSON.stringify(d.arpPattern || null) }; }, c);
    const croches = (p, nom) => p.evaluate((nom) => {
        const et = [...document.querySelectorAll('#sq-grille .sq-etiq')], r = et.findIndex(e => e.textContent.trim() === nom);
        return r < 0 ? null : [...document.querySelectorAll(`#sq-grille .sq-case.on[data-c="0"][data-r="${r}"]`)].map(e => +e.dataset.k).sort((a, b) => a - b);
    }, nom);

    // ======================================================================================================
    console.log('\n=== A et B. Même aspect, à la bonne hauteur ===');
    let { p, ctx } = await ouvrir({ viewport: { width: 1440, height: 900 } });
    exiger(await noms(p) === 'B3 G3 E3 C3', `départ : les quatre voix de Cmaj7 (${await noms(p)})`);
    await bande(p, 'A1');
    check(await noms(p) === 'B3 G3 E3 C3 A1', `une note grave se place TOUT EN BAS, sous la basse (${await noms(p)})`);
    await bande(p, 'F#3');
    check(await noms(p) === 'B3 G3 F#3 E3 C3 A1', `une médiane s'intercale entre deux voix, à sa hauteur (${await noms(p)})`);
    await bande(p, 'D5');
    check(await noms(p) === 'D5 B3 G3 F#3 E3 C3 A1', `une aiguë reste tout en haut (${await noms(p)})`);
    const et = await etiquettes(p);
    const voixB3 = et.find(e => e.nom === 'B3'), libreD5 = et.find(e => e.nom === 'D5'), libreFd = et.find(e => e.nom === 'F#3'), voixE3 = et.find(e => e.nom === 'E3');
    check(libreD5.fond === voixB3.fond && libreD5.bord === voixB3.bord, `une note ajoutée blanche (D5) a la même touche qu'une voix blanche (fond ${libreD5.fond}, bord ${libreD5.bord})`);
    check(libreFd.diese && !voixE3.diese && libreFd.fond !== libreD5.fond, 'une note ajoutée dièse (F#3) est une touche sombre, comme les dièses des voix');
    check(et.filter(e => e.libre).every(e => e.croix) && et.filter(e => !e.libre).every(e => !e.croix), 'seules les notes ajoutées portent la croix (pour les supprimer)');
    await p.click('#sq-grille .sq-libre-retirer[data-midi="74"]'); await p.waitForTimeout(400);
    check(await noms(p) === 'B3 G3 F#3 E3 C3 A1', `la croix retire la note (${await noms(p)})`);

    // ======================================================================================================
    console.log('\n=== C. Le nom se tape dès la bande « Note libre » ===');
    await p.click('#sq-grille .sq-libre-btn'); await p.waitForTimeout(250);
    check(await p.evaluate(() => document.getElementById('sq-libre-saisie').value === 'D5' && document.getElementById('sq-libre-ajouter').textContent === 'Ajouter D5'), 'la bande s\'ouvre sur la dernière note définie (D5) : le champ et le bouton disent la même chose');
    await p.fill('#sq-libre-saisie', 'eb3'); await p.waitForTimeout(150);
    let b = await p.evaluate(() => ({ bouton: document.getElementById('sq-libre-ajouter').textContent, puce: [...document.querySelectorAll('#sq-libre-bande [data-sq-note][aria-pressed="true"]')].map(x => x.dataset.sqNote).join(), octave: document.getElementById('sq-libre-octave').textContent }));
    check(b.bouton === 'Ajouter D#3' && b.puce === 'D#' && b.octave === '3', `taper « eb3 » règle les puces et l'octave : ${b.bouton}, puce ${b.puce}, octave ${b.octave}`);
    await p.fill('#sq-libre-saisie', 'zz9'); await p.waitForTimeout(150);
    check(await p.evaluate(() => document.getElementById('sq-libre-saisie').classList.contains('invalide')), 'un nom faux est signalé (champ rouge)');
    await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    check(await noms(p) === 'B3 G3 F#3 E3 C3 A1', 'et Entrée n\'ajoute rien');
    await p.click('#sq-libre-bande [data-sq-note="G"]'); await p.waitForTimeout(150);
    check(await p.evaluate(() => document.getElementById('sq-libre-saisie').value) === 'G3', 'les puces règlent le champ en retour (G3)');
    await p.fill('#sq-libre-saisie', 'Bb2'); await p.keyboard.press('Enter'); await p.waitForTimeout(450);
    check(await noms(p) === 'B3 G3 F#3 E3 C3 A#2 A1', `Entrée ajoute la note tapée : Bb2 s'affiche A#2 selon la tonalité, entre C3 et A1 (${await noms(p)})`);
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== D. Renommer au clic ===');
    ({ p, ctx } = await ouvrir({ viewport: { width: 1440, height: 900 } }));
    await bande(p, 'F#3');
    // trois croches sur la ligne F#3 (accord 1) : un clic chacune
    for (const k of [0, 1, 2]) {
        const c = await p.evaluate((k) => { const et = [...document.querySelectorAll('#sq-grille .sq-etiq')], r = et.findIndex(e => e.textContent.trim() === 'F#3'); const e = document.querySelector(`#sq-grille .sq-case[data-c="0"][data-r="${r}"][data-k="${k}"]`).getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + e.height / 2 }; }, k);
        await p.mouse.click(c.x, c.y); await p.waitForTimeout(250);
    }
    exiger((await croches(p, 'F#3')).join() === '0,1,2', `trois croches posées sur F#3 (${(await croches(p, 'F#3')).join()})`);
    const avant = await accord(p);
    await p.click('#sq-grille .sq-libre-nom'); await p.waitForTimeout(200);
    const champ = await p.evaluate(() => { const i = document.querySelector('#sq-grille .sq-etiq .sq-libre-saisie'); return i ? { valeur: i.value, focus: document.activeElement === i, selection: i.selectionStart === 0 && i.selectionEnd === i.value.length, croix: !!i.closest('.sq-etiq').querySelector('.sq-libre-retirer') && getComputedStyle(i.closest('.sq-etiq').querySelector('.sq-libre-retirer')).display !== 'none' } : null; });
    exiger(champ && champ.valeur === 'F#3', `un clic sur le nom en fait un champ, avec le nom actuel (${champ && champ.valeur})`);
    check(champ.focus && champ.selection && !champ.croix, 'le champ a le focus, le nom est sélectionné (taper remplace), la croix s\'efface pendant la frappe');
    await p.keyboard.type('g#2'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
    check(await noms(p) === 'B3 G3 E3 C3 G#2', `Entrée valide : la ligne se replace à sa nouvelle hauteur, tout en bas (${await noms(p)})`);
    check((await croches(p, 'G#2')).join() === '0,1,2', `ses trois croches ont suivi (${(await croches(p, 'G#2')).join()})`);
    const apres = await accord(p);
    check(/G#2/.test(apres.libres) && !/F#3/.test(apres.libres) && apres.libres !== avant.libres, `le morceau garde G#2 à la place de F#3 (${avant.libres} → ${apres.libres})`);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(400);
    check(await noms(p) === 'B3 G3 F#3 E3 C3' && (await croches(p, 'F#3')).join() === '0,1,2', `Ctrl+Z défait le renommage en une fois, croches comprises (${await noms(p)})`);
    // Échap annule
    await p.click('#sq-grille .sq-libre-nom'); await p.waitForTimeout(150);
    await p.keyboard.type('C2'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    check(await noms(p) === 'B3 G3 F#3 E3 C3' && await p.evaluate(() => !document.querySelector('#sq-grille .sq-libre-saisie')), 'Échap annule : rien ne change, le champ se referme');
    // un nom faux
    await p.click('#sq-grille .sq-libre-nom'); await p.waitForTimeout(150);
    await p.keyboard.type('H9'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    check(await noms(p) === 'B3 G3 F#3 E3 C3', 'un nom qui n\'est pas une note est refusé : la ligne garde son nom');
    // un nom déjà pris : une note de l'accord (B3) ...
    await p.click('#sq-grille .sq-libre-nom'); await p.waitForTimeout(150);
    await p.keyboard.type('B3'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    check(await noms(p) === 'B3 G3 F#3 E3 C3' && (await croches(p, 'F#3')).join() === '0,1,2', 'B3 est une note de l\'accord : refusé, la note reste F#3 avec ses croches');
    // ... et une autre note ajoutée
    await bande(p, 'D5');
    await p.click('#sq-grille .sq-libre-nom[data-midi="54"]'); await p.waitForTimeout(150);
    await p.keyboard.type('D5'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    check(await noms(p) === 'D5 B3 G3 F#3 E3 C3', 'D5 est déjà une ligne : refusé');
    // sans octave : la même
    await p.click('#sq-grille .sq-libre-nom[data-midi="54"]'); await p.waitForTimeout(150);
    await p.keyboard.type('a'); await p.keyboard.press('Enter'); await p.waitForTimeout(450);
    check(await noms(p) === 'D5 B3 A3 G3 E3 C3', `« a » sans octave garde l'octave de la note : F#3 devient A3, entre B3 et G3 (${await noms(p)})`);
    // clavier : Entrée sur le nom ouvre le champ
    await p.focus('#sq-grille .sq-libre-nom'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
    check(await p.evaluate(() => !!document.querySelector('#sq-grille .sq-libre-saisie')), 'au clavier, Entrée sur le nom (tabulation) ouvre aussi le champ');
    await p.keyboard.press('Escape');
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== E. Le téléphone ===');
    ({ p, ctx } = await ouvrir(TEL));
    await p.tap('#tel-sequenceur'); await p.waitForTimeout(700);
    await p.tap('#sq-grille .sq-libre-btn'); await p.waitForTimeout(300);
    await p.fill('#sq-libre-saisie', 'F#3'); await p.waitForTimeout(150);
    await p.tap('#sq-libre-ajouter'); await p.waitForTimeout(500);
    const tel = await etiquettes(p);
    check(tel.map(e => e.nom).join(' ') === 'B3 G3 F#3 E3 C3', `au téléphone aussi, la note se place à sa hauteur (${tel.map(e => e.nom).join(' ')})`);
    check(tel.find(e => e.nom === 'F#3').fond === tel.find(e => e.nom === 'E3').fond || tel.find(e => e.nom === 'F#3').diese, 'et a l\'aspect d\'une touche (pas de pointillés)');
    check(tel.every(e => !e.modifiable), 'pas de renommage au clic au téléphone (le champ de la bande suffit)');
    await p.close(); await ctx.close();

    check(erreurs.length === 0, `aucune erreur de page ni de console (${erreurs.slice(0, 3).join(' | ')})`);
    await nav.close();
    bilan();
})().catch(e => { console.log('FATAL ' + (e && e.stack || e)); process.exit(1); });
