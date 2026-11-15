// L5c — BARRE DE LECTURE, FENÊTRE DU TEMPO, LOGOS, MESSAGES, ONGLET STRUCTURE (refonte, lettres D, J, L des décisions des 13 et 14/11).
//
// CE QUE DEMANDE L'UTILISATEUR (docs/decisions-13-14-11.md) :
//   - fenêtre du tempo : « que le BPM continue de défiler si je laisse appuyer sur les chevrons droite et gauche », « modifier les BPM en cliquant sur molette et en scrollant » (et en
//     glissant sur le chiffre), le clic noire / croche du métronome sur la rangée du tempo à droite de TAP, UN SEUL réglage de vitesse (barre aimantée), « trop de texte » : plus de légende ;
//   - barre de lecture : écart de 8 px entre tous les boutons, la ROUE pour le réglage (popover « Barre de lecture » : frise pleine largeur ou largeur, noms, mesure, réorganiser, ordre,
//     rétablir), « MESURE 1 / 8 » ; les logos : guitare penchée, « répéter » pour la boucle, le métronome de TrainHub ;
//   - messages : coins de 12 px, le texte ne dépasse jamais de l'encadré, plus d'alerte « son de secours » ;
//   - onglet Structure : menu d'ajout de 200 px, flèche à 14 px du bord, « Clic droit : options ».
// CE QUE LE BANC TIENT : de vrais gestes (clics, appui maintenu, glissés, molette), l'état relu dans la page ; le téléphone n'a pas bougé.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('barre de lecture, L5c');
const { estBruitReseau } = require('./_harness');

plan(61);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, b = 4) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const S = [
        { title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] },
        { title: 'Refrain', chords: [mk('F', 'maj7'), mk('E', 'min7')] },
    ];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S, bpm: 120 }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (width, height = 800) => {
        const p = await nav.newPage({ viewport: { width, height } });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const bpm = (p) => p.evaluate(() => window.app.tempoCourant());
    const centre = async (p, sel) => { const b = await p.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }; };
    const rect = (p, sel) => p.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; }, sel);

    // ======================================================================================================
    console.log('\n=== A. La fenêtre du tempo : chevrons à répétition, chiffre qu\'on glisse, molette ===');
    let p = await ouvrir(1440);
    await p.click('#bl-tempo'); await p.waitForTimeout(250);
    const lib = await p.evaluate(() => ({ moins: document.getElementById('bl-tempo-moins').textContent, plus: document.getElementById('bl-tempo-plus').textContent,
        aide: document.querySelectorAll('#bl-tempo-pop .bl-pop-aide').length, cinq: document.querySelectorAll('[data-vitesse]').length,
        ligneContretemps: /Contretemps au métronome/.test(document.getElementById('bl-tempo-pop').textContent) }));
    check(lib.moins === '‹' && lib.plus === '›', `des chevrons ‹ › à la place de − / + (« ${lib.moins} » « ${lib.plus} »)`);
    check(lib.aide === 0 && lib.cinq === 0 && !lib.ligneContretemps, 'plus de légende, plus de boutons de vitesses rapides, plus de ligne « Contretemps au métronome » : la fenêtre n\'a que le tempo et la vitesse');
    const t0 = await bpm(p);
    const plus = await centre(p, '#bl-tempo-plus');
    await p.mouse.click(plus.x, plus.y); await p.waitForTimeout(200);
    check(await bpm(p) === t0 + 1, `un appui bref = un cran (${t0} → ${await bpm(p)})`);
    await p.mouse.move(plus.x, plus.y); await p.mouse.down(); await p.waitForTimeout(900);
    const enRepetition = await bpm(p);
    await p.mouse.up(); await p.waitForTimeout(150);
    const apresRelache = await bpm(p);
    check(enRepetition - (t0 + 1) >= 4, `maintenu, le BPM défile (+${enRepetition - (t0 + 1)} en 0,9 s, un cran toutes les 70 ms après 0,42 s)`);
    await p.waitForTimeout(400);
    check(await bpm(p) === apresRelache, 'au relâchement la répétition s\'arrête, et le « clic » de fin n\'ajoute pas de cran');
    const moins = await centre(p, '#bl-tempo-moins');
    await p.mouse.move(moins.x, moins.y); await p.mouse.down(); await p.waitForTimeout(700);
    await p.mouse.move(40, 300); await p.mouse.up(); await p.waitForTimeout(120);
    const ailleurs = await bpm(p);
    await p.waitForTimeout(400);
    check(await bpm(p) === ailleurs && ailleurs < apresRelache, `relâché AILLEURS que sur le chevron : la répétition s'arrête aussi (${apresRelache} → ${ailleurs})`);
    await p.focus('#bl-tempo-plus');
    const avantClavier = await bpm(p);
    await p.keyboard.press('Enter'); await p.waitForTimeout(150);
    check(await bpm(p) === avantClavier + 1, 'au clavier (Entrée sur le chevron) : un cran');
    const avantMaj = await bpm(p);
    await p.click('#bl-tempo-plus', { modifiers: ['Shift'] }); await p.waitForTimeout(150);
    check(await bpm(p) === avantMaj + 5, 'Maj + chevron : cinq crans');

    const val = await centre(p, '#bl-tempo-pop-val');
    const avantGlisse = await bpm(p);
    await p.mouse.move(val.x, val.y); await p.mouse.down();
    await p.mouse.move(val.x, val.y - 25, { steps: 5 });
    check(await p.evaluate(() => document.getElementById('bl-tempo-pop-val').classList.contains('tire')), 'tiré, le chiffre s\'allume');
    await p.mouse.up(); await p.waitForTimeout(100);
    check(await bpm(p) === avantGlisse + 5, `glisser le chiffre vers le HAUT de 25 px = +5 (un cran tous les 5 px) : ${avantGlisse} → ${await bpm(p)}`);
    await p.mouse.move(val.x, val.y); await p.mouse.down(); await p.mouse.move(val.x, val.y + 15, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(100);
    check(await bpm(p) === avantGlisse + 2, 'vers le BAS de 15 px = −3 (le tempo redescend)');
    // Clic molette + glisser, comme sur le bouton de la barre.
    const avantMolette = await bpm(p);
    await p.mouse.move(val.x, val.y);
    await p.mouse.wheel(0, -100); await p.waitForTimeout(120);
    check(await bpm(p) === avantMolette + 1, `la molette sur le chiffre : ±1 (${avantMolette} → ${await bpm(p)})`);
    await p.mouse.wheel(0, 100); await p.waitForTimeout(120);
    check(await bpm(p) === avantMolette, 'et vers le bas elle redescend');

    console.log('\n=== A2. Le clic du métronome (noire / croche) à droite de TAP ; UNE vitesse ===');
    const sub = await p.evaluate(() => { const s = document.getElementById('toggle-metronome-subdivision').getBoundingClientRect(), t = document.getElementById('bl-tap').getBoundingClientRect(), l = document.getElementById('bl-tempo-ligne');
        return { apres: s.left >= t.right, memeLigne: Math.abs((s.top + s.bottom) / 2 - (t.top + t.bottom) / 2) <= 2, dansLigne: l.contains(document.getElementById('toggle-metronome-subdivision')), titre: document.getElementById('toggle-metronome-subdivision').title, h: Math.round(s.height) }; });
    check(sub.apres && sub.memeLigne && sub.dansLigne, 'l\'interrupteur noire / croche est sur la rangée du tempo, à droite de TAP');
    check(/noire/.test(sub.titre) && /croche/.test(sub.titre) && sub.h === 32, `son infobulle dit « ${sub.titre} » ; carré de ${sub.h} px`);
    const avantSub = await p.evaluate(() => document.getElementById('toggle-metronome-subdivision').getAttribute('aria-pressed'));
    await p.click('#toggle-metronome-subdivision'); await p.waitForTimeout(150);
    check(await p.evaluate(() => document.getElementById('toggle-metronome-subdivision').getAttribute('aria-pressed')) !== avantSub, 'un clic le bascule (noire ↔ croche), et il le dit (aria-pressed)');
    await p.click('#toggle-metronome-subdivision'); await p.waitForTimeout(100);
    // La vitesse : une seule barre, aimantée.
    const clicVitesse = async (v) => { const b = await p.locator('#bl-vitesse').boundingBox(); await p.mouse.click(b.x + 8 + (v - 50) / 150 * (b.width - 16), b.y + b.height / 2); await p.waitForTimeout(120); return p.evaluate(() => document.getElementById('bl-vitesse').value); };
    check(await clicVitesse(78) === '75', 'la barre de vitesse colle à 75 % (cliquée à 78)');
    check(await clicVitesse(147) === '150', 'elle colle à 150 % (cliquée à 147)');
    const libre = await clicVitesse(120);
    check(libre !== '100' && libre !== '150' && Math.abs(+libre - 120) <= 5, `entre deux crans elle ne colle pas (cliquée à 120 : ${libre} %)`);
    check(await clicVitesse(200) === '200' && await p.evaluate(() => document.getElementById('bl-vitesse-val').textContent) === '200 %', 'elle va jusqu\'à 200 %, et la valeur le dit');
    await clicVitesse(100);
    const ech = await p.evaluate(() => { const e = document.getElementById('bl-echelle'); return { texte: [...e.children].map(x => x.textContent).join(' '), clic: getComputedStyle(e).pointerEvents }; });
    check(ech.texte === '50 75 100 150 200' && ech.clic === 'none', `l'échelle sous la barre (${ech.texte}) n'est pas cliquable`);
    check(await p.evaluate(() => { const r = document.getElementById('bl-tempo-pop').getBoundingClientRect(); return r.right <= window.innerWidth && r.left >= 0; }), 'la fenêtre reste entièrement à l\'écran');
    await p.keyboard.press('Escape');
    await p.close();

    // ======================================================================================================
    console.log('\n=== B. La barre : 8 px entre les boutons, la roue, la popover « Barre de lecture » ===');
    p = await ouvrir(1440);
    const ecarts = await p.evaluate(() => {
        const r = (s) => document.querySelector(s).getBoundingClientRect();
        return { tempoMetro: r('#bl-metro').left - r('#bl-tempo').right, metroPiano: r('#toggle-viz-piano').left - r('#bl-metro').right, pianoGuitare: r('#toggle-viz-guitar').left - r('#toggle-viz-piano').right, guitareRoue: r('#bl-reorg').left - r('#toggle-viz-guitar').right };
    });
    check(Object.values(ecarts).every(x => Math.abs(x - 8) <= 1), `8 px entre tempo, métronome, clavier, guitare et réglage (${JSON.stringify(ecarts)})`);
    check(await p.evaluate(() => document.getElementById('bl-reorg').innerHTML.replace(/\s+/g, '') === document.getElementById('open-settings').innerHTML.replace(/\s+/g, '')), 'le bouton de réglage de la barre a la ROUE des Paramètres');
    await p.click('#bl-reorg'); await p.waitForTimeout(250);
    const pop = await p.evaluate(() => { const e = document.getElementById('bl-reglages-pop'), r = e.getBoundingClientRect(); return { visible: !e.hidden, titre: e.querySelector('.settings-group-title').textContent, libelles: [...e.querySelectorAll('.settings-toggle-row label, .settings-slider-head label')].map(x => x.textContent), pied: [...e.querySelectorAll('.rb-pied button')].map(x => x.textContent.trim()), dansEcran: r.right <= window.innerWidth && r.bottom <= window.innerHeight, au_dessus: r.bottom <= document.getElementById('bl-reorg').getBoundingClientRect().top, curseurInactif: document.getElementById('bl-r-largeur').disabled }; });
    exiger(pop.visible, 'la roue ouvre la popover « Barre de lecture »');
    check(JSON.stringify(pop.libelles) === JSON.stringify(['Frise pleine largeur', 'Largeur', 'Noms', 'Mesure', 'Réorganiser']) && JSON.stringify(pop.pied) === JSON.stringify(['Ordre', 'Rétablir']), `des libellés COURTS, dans le gabarit des Paramètres : ${pop.libelles.join(' · ')} / ${pop.pied.join(' · ')}`);
    check(pop.dansEcran && pop.au_dessus, 'elle se pose au-dessus de la roue, entièrement à l\'écran');
    check(pop.curseurInactif, 'tant que la frise est en pleine largeur, le curseur « Largeur » est grisé');
    const pleine = (await rect(p, '.bl-bloc[data-bloc="parties"]')).w;
    await p.click('#bl-r-pleine'); await p.waitForTimeout(250);
    check(await p.evaluate(() => !document.getElementById('bl-r-largeur').disabled && document.getElementById('barre-lecture').classList.contains('frise-limitee')), 'sans « pleine largeur », la largeur se règle');
    const sl = await p.locator('#bl-r-largeur').boundingBox();
    await p.mouse.click(sl.x + 8 + (300 - 200) / 700 * (sl.width - 16), sl.y + sl.height / 2); await p.waitForTimeout(250);
    const choisie = await p.evaluate(() => +document.getElementById('bl-r-largeur').value);
    const limitee = (await rect(p, '.bl-bloc[data-bloc="parties"]')).w;
    check(Math.abs(limitee - choisie) <= 2 && limitee < pleine - 100, `la frise prend la largeur choisie (${choisie} px → ${Math.round(limitee)} px au lieu de ${Math.round(pleine)})`);
    check(await p.evaluate(() => document.getElementById('bl-r-largeur-val').textContent === document.getElementById('bl-r-largeur').value + ' px'), 'la valeur est écrite à côté du curseur');
    check(await p.evaluate(() => { const b = document.getElementById('bl-reorg').getBoundingClientRect(); return Math.abs(window.innerWidth - 26 - b.right) <= 30; }), 'la roue reste à l\'extrémité droite de la barre');
    await p.click('#bl-r-noms'); await p.waitForTimeout(150);
    check(await p.evaluate(() => getComputedStyle(document.querySelector('.bl-frise-part')).fontSize === '0px'), '« Noms » éteint : les parties n\'ont plus leur nom dans la frise');
    await p.click('#bl-r-mesure'); await p.waitForTimeout(150);
    check(await p.evaluate(() => getComputedStyle(document.getElementById('bl-mesure')).display === 'none'), '« Mesure » éteint : le numéro de mesure disparaît');
    await p.mouse.click(200, 400); await p.waitForTimeout(250);
    check(await p.evaluate(() => document.getElementById('bl-reglages-pop').hidden), 'un clic à côté referme la popover');
    await p.reload(); await p.waitForTimeout(900);
    check(await p.evaluate(() => { const b = document.getElementById('barre-lecture'); return b.classList.contains('frise-limitee') && b.classList.contains('sans-noms-parties') && b.classList.contains('sans-mesure'); }), 'les réglages sont retrouvés au rechargement (mémorisés par appareil)');
    const synchro = await p.evaluate(() => typeof REGLAGES_SYNCHRONISES !== 'undefined' ? [...REGLAGES_SYNCHRONISES] : null);
    exiger(Array.isArray(synchro) && synchro.length > 10, 'la liste blanche des réglages synchronisés est lisible');
    check(!synchro.includes('harmohubBarreReglages'), 'les réglages de la barre ne sont pas synchronisés (l\'écran de chaque appareil)');
    await p.click('#bl-reorg'); await p.waitForTimeout(200);
    await p.click('#bl-r-retablir'); await p.waitForTimeout(250);
    check(await p.evaluate(() => { const b = document.getElementById('barre-lecture'); return !b.classList.contains('frise-limitee') && !b.classList.contains('sans-noms-parties') && !b.classList.contains('sans-mesure') && document.getElementById('bl-r-pleine').getAttribute('aria-checked') === 'true'; }), '« Rétablir » remet tout comme au départ');
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    check(await p.evaluate(() => document.getElementById('bl-reglages-pop').hidden), 'Échap referme la popover');
    await p.close();

    // ======================================================================================================
    console.log('\n=== C. Les logos : guitare penchée, « répéter », métronome de TrainHub ===');
    p = await ouvrir(1440);
    const logos = await p.evaluate(() => {
        const norm = (s) => s.replace(/\s+/g, '');
        const g = document.querySelector('#toggle-viz-guitar svg g');
        return { guitare: g && g.getAttribute('transform'), guitareParties: g ? g.children.length : 0,
            boucle: [...document.querySelectorAll('#boucle-btn svg path')].map(x => x.getAttribute('d')).join('|'), boucleTrait: document.querySelector('#boucle-btn svg').getAttribute('stroke-width'),
            metro: norm(document.querySelector('#toggle-metronome svg').innerHTML), barreMetro: norm(document.querySelector('#bl-metro').innerHTML.replace(/<span.*<\/span>/, '')) };
    });
    check(logos.guitare === 'rotate(40 12 11.6)' && logos.guitareParties === 5, `la guitare est penchée de 40° (corps, rosace, chevalet, manche, tête) : ${logos.guitare}`);
    check(logos.boucle === 'M17 2 21 6 17 10|M3 11V9a4 4 0 0 1 4-4h14|M7 22 3 18 7 14|M21 13v2a4 4 0 0 1-4 4H3' && logos.boucleTrait === '2', `la boucle montre le logo « répéter » (deux flèches en rectangle, trait 2) — ${logos.boucle}`);
    check(logos.metro.includes('M10.62.6h2.8l4.118.8H6.5Z') && logos.metro.includes('M7.717h8.6') && logos.metro.includes('M12.113.8') && logos.barreMetro.includes('M10.62.6h2.8l4.118.8H6.5Z'), 'le métronome est celui de TrainHub, dans la carte ET dans la barre');
    await p.close();

    // ======================================================================================================
    console.log('\n=== D. « MESURE 1 / 8 » à l\'ordinateur, « Mes. 1 » au téléphone ===');
    p = await ouvrir(1440);
    const m1 = await p.evaluate(() => { const m = document.getElementById('bl-mesure'), lab = m.querySelector('.bm-lab'), n = m.querySelector('.bm-val b'), t = m.querySelector('.bm-val i');
        return { lab: lab && lab.textContent, labTaille: lab && getComputedStyle(lab).fontSize, labCasse: lab && getComputedStyle(lab).textTransform, n: n && n.textContent, nTaille: n && getComputedStyle(n).fontSize, t: t && t.textContent, tTaille: t && getComputedStyle(t).fontSize, titre: m.title,
            labAuDessus: lab && n && lab.getBoundingClientRect().bottom <= n.getBoundingClientRect().top + 2 }; });
    check(m1.lab === 'Mesure' && m1.labTaille === '10px' && m1.labCasse === 'uppercase' && m1.labAuDessus, `un petit « MESURE » (10 px, majuscules) AU-DESSUS du numéro — ${JSON.stringify([m1.lab, m1.labTaille, m1.labCasse])}`);
    check(m1.n === '1' && m1.nTaille === '20px' && /^ \/ 6$/.test(m1.t) && m1.tTaille === '12px', `le numéro en grand (20 px) suivi du total « / 6 » (12 px) — ${m1.n} ${m1.t}`);
    check(m1.titre === 'Mesure en cours : 1 sur 6', `infobulle : « ${m1.titre} »`);
    await p.click('.chord-grid[data-section="1"] .grid-cell[data-index="1"]'); await p.waitForTimeout(300);
    check(await p.evaluate(() => document.querySelector('#bl-mesure .bm-val b').textContent) === '6' && await p.evaluate(() => document.getElementById('bl-mesure').title) === 'Mesure en cours : 6 sur 6', 'elle suit l\'accord choisi (le dernier accord est à la mesure 6 sur 6)');
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(500);
    check(await p.evaluate(() => /^Mes\. \d+$/.test(document.getElementById('bl-mesure').textContent)), 'passé sous 900 px, le libellé redevient « Mes. N » (le téléphone n\'a pas bougé)');
    await p.setViewportSize({ width: 1440, height: 800 }); await p.waitForTimeout(500);
    check(await p.evaluate(() => !!document.querySelector('#bl-mesure .bm-val b')), '...et revient à « MESURE n / total » au retour');
    await p.close();

    // ======================================================================================================
    console.log('\n=== E. Les messages : 12 px, le texte ne dépasse jamais, plus d\'alerte « son de secours » ===');
    for (const w of [1440, 1024, 390]) {
        p = await ouvrir(w, w === 390 ? 844 : 800);
        await p.evaluate(() => window.app.flashHint('Un message volontairement très long, pour vérifier que le texte revient à la ligne dans le cadre au lieu de le déborder, même sur un petit écran étroit', 3000));
        await p.waitForTimeout(450);
        const t = await p.evaluate(() => { const e = document.getElementById('toast'), r = e.getBoundingClientRect(), c = getComputedStyle(e); return { rayon: c.borderTopLeftRadius, largeur: Math.round(r.width), fenetre: window.innerWidth, deborde: e.scrollWidth > e.clientWidth + 1, lignes: Math.round(r.height / parseFloat(c.lineHeight)), blanc: c.whiteSpace, dedans: r.left >= 0 && r.right <= window.innerWidth }; });
        check(t.rayon === '12px' && !t.deborde && t.dedans && t.largeur <= 480 && t.blanc === 'normal', `${w} px : coins de 12 px, texte dans le cadre (${t.largeur} px, ${t.lignes} lignes, rayon ${t.rayon})`);
        await p.close();
    }
    p = await ouvrir(1440);
    check(await p.evaluate(() => typeof window.app.warnIfFallbackInstrument === 'undefined'), 'l\'alerte « Sons du piano pas encore chargés » n\'existe plus');
    await p.close();

    // ======================================================================================================
    console.log('\n=== F. L\'onglet Structure : menu d\'ajout de 200 px, flèche à 14 px, légende courte ===');
    p = await ouvrir(1440);
    await p.click('#structure-btn'); await p.waitForTimeout(500);
    const st = await p.evaluate(() => { const s = document.getElementById('struct-ajout-select'), r = s.getBoundingClientRect(), c = getComputedStyle(s), a = document.querySelector('.struct-aide');
        return { w: Math.round(r.width), premier: s.options[0].text, pos: c.backgroundPosition, appearance: c.appearance, aide: a && a.textContent, aideTitre: a && a.title }; });
    check(st.w === 200 && st.premier === '+ Partie…', `le menu d'ajout fait ${st.w} px et dit « ${st.premier} »`);
    check(/right 14px|calc\(100% - 14px\)|100% /.test(st.pos) || /14px/.test(st.pos), `sa flèche est dessinée à 14 px du bord droit (${st.pos})`);
    check(st.appearance === 'none', 'et ce n\'est plus la flèche native');
    check(st.aide === 'Clic droit : options' && /dupliquer, renommer/.test(st.aideTitre), `la légende : « ${st.aide} » (la phrase complète en infobulle)`);
    await p.close();

    // ======================================================================================================
    console.log('\n=== G. Le téléphone n\'a pas bougé (lot 7) ===');
    p = await ouvrir(390, 844);
    await p.click('#bl-plus'); await p.waitForTimeout(400);
    const tel = await p.evaluate(() => ({ roue: document.getElementById('bl-reorg').getBoundingClientRect().width === 0 ? 'none' : 'visible', pop: document.getElementById('bl-reglages-pop').hidden, ligne: !!document.querySelector('#panneau-lecture #bl-tempo-ligne'),
        sous: document.querySelector('#panneau-lecture #bl-tempo-ligne #bl-hote-subdivision #toggle-metronome-subdivision') ? 'ligne-du-tempo' : 'ailleurs', curseur: !!document.querySelector('#panneau-lecture #bl-vitesse'), boutons: document.querySelectorAll('#panneau-lecture [data-vitesse]').length,
        chev: document.getElementById('bl-tempo-plus').textContent }));
    check(tel.roue === 'none' && tel.pop, 'la barre n\'a pas de roue au téléphone (rien à ouvrir)');
    check(tel.ligne && tel.sous === 'ligne-du-tempo' && tel.curseur && tel.boutons === 0, 'le panneau Lecture porte la rangée du tempo, le contretemps à droite de TAP (L7b : plus de ligne à part) et UN curseur de vitesse');
    const t1 = await bpm(p);
    const pl = await centre(p, '#bl-tempo-plus');
    await p.mouse.click(pl.x, pl.y); await p.waitForTimeout(250);
    check(tel.chev === '›' && await bpm(p) === t1 + 1, 'un appui sur › = un cran de tempo');
    await p.close();

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length ? erreurs.join(' | ') : 'aucune'})`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
