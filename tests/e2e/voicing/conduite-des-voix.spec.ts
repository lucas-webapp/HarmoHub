// MODULE « voicing » — ce que dessine la fenêtre « Conduite des voix » : une barre par son, rangée par rôle (fondamentale, tierce, quinte, septième, autres),
// le trait qui relie chaque voix à celle de même rang de l'accord suivant (plein = note tenue, pointillé = mouvement), les en-têtes (nom, chiffre romain),
// la colonne des touches, le défilement, et le redessin quand l'accord change (renversement, drop, octave, basse, type). Ordinateur et iPad.
import { test, expect } from '../support/fixtures';
import { degres } from '../tonalite/aide-tonalite';
import {
  C_AM_F_G, COUPLET, noms, reglagesMorceau, morceauQuatreParties, popover, dessin, notes, tenues, mouvements, defilante, touches,
  nomsDesNotes, rolesDesNotes, entetes, hauteurs, titre, ouvrirVoicing, activerPartie, ouvrirFenetre, choisirOnglet, bouton, attendreFermee,
} from './aide-voicing';

const unePartie = (accords: { root: string; quality: string }[], titre = 'Test') => reglagesMorceau([{ titre, accords }]);

// Après un réglage fait dans la fenêtre d'accord : on la quitte comme l'utilisateur (clic sur le fond) avant de rouvrir la conduite des voix.
async function quitterFenetreAccord(page: any) {
  await page.mouse.click(12, 300);
  await expect(page.getByRole('dialog', { name: /^Accord / })).toBeHidden();
}

test.describe('Dessin de la conduite des voix @voicing @ordinateur', () => {
  test('une barre par son de chaque accord, nommée par sa note, du grave à l\'aigu @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: unePartie(COUPLET, 'Couplet') });
    await ouvrirVoicing(page);
    await expect(notes(page)).toHaveCount(16);
    expect(await nomsDesNotes(page)).toEqual([
      'C', 'E', 'G', 'B',      // Cmaj7
      'C', 'E', 'G', 'B',      // Cmaj7
      'F', 'A', 'C', 'E',      // Fmaj7
      'G', 'B', 'D', 'F',      // G7
    ]);
    // du grave à l'aigu dans un accord : l'ordonnée (en pixels du dessin) diminue
    const y = await hauteurs(page);
    for (let accord = 0; accord < 4; accord++) for (let i = 1; i < 4; i++) expect(y[accord * 4 + i]).toBeLessThan(y[accord * 4 + i - 1]);
  });

  test('chaque colonne porte le nom de son accord ; les triades sont chiffrées en degrés (I vi IV V)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirVoicing(page);
    expect(await entetes(page)).toEqual(['C', 'I', 'Am', 'vi', 'F', 'IV', 'G', 'V']);
    await expect(notes(page)).toHaveCount(12);
  });

  test('les accords du Couplet portent leur nom (Cmaj7, Cmaj7, Fmaj7, G7)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: unePartie(COUPLET, 'Couplet') });
    await ouvrirVoicing(page);
    const t = await entetes(page);
    expect(t.filter((_, i) => i % 2 === 0)).toEqual(['Cmaj7', 'Cmaj7', 'Fmaj7', 'G7']);
    expect(t.filter((_, i) => i % 2 === 1)).toHaveLength(4);       // et un chiffre romain sous chacun
  });

  test('les barres sont rangées par rôle : 4 fondamentales, 4 tierces, 4 quintes, 4 septièmes @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: unePartie(COUPLET, 'Couplet') });
    await ouvrirVoicing(page);
    expect(await rolesDesNotes(page)).toEqual(Array(4).fill(['root', 'third', 'fifth', 'seventh']).flat());
  });

  test('les autres sons (neuvième, quarte suspendue) portent le rôle « autres » ; une triade n\'a pas de septième', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: unePartie([
      { root: 'C', quality: 'maj9' }, { root: 'A', quality: 'min' }, { root: 'D', quality: 'sus4' }, { root: 'E', quality: 'dim' },
    ]) });
    await ouvrirVoicing(page);
    expect(await rolesDesNotes(page)).toEqual([
      'root', 'third', 'fifth', 'seventh', 'ext',     // Cmaj9 : cinq sons
      'root', 'third', 'fifth',                       // Am
      'root', 'ext', 'fifth',                         // Dsus4 : la quarte est un « autre » son
      'root', 'third', 'fifth',                       // Edim
    ]);
    expect(await nomsDesNotes(page)).toEqual(['C', 'E', 'G', 'B', 'D', 'A', 'C', 'E', 'D', 'G', 'A', 'E', 'G', 'B♭']);
  });

  test('la légende donne les cinq couleurs : 1, 3, 5, 7, Autres ; chaque rôle a son dégradé', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: unePartie(COUPLET, 'Couplet') });
    await ouvrirVoicing(page);
    const legende = popover(page).locator('.voice-leading-legend .lg');
    await expect(legende).toHaveText(['1', '3', '5', '7', 'Autres']);
    // fondamentale verte, tierce bleue, quinte rouge, septième jaune, autres mauves : le dégradé de chaque rôle
    const degrades = await dessin(page).locator('linearGradient').evaluateAll(g => Object.fromEntries(g.map(x => [x.id.replace(/^vlg-\d+-/, ''), (x.querySelector('stop') as Element).getAttribute('stop-color')])));
    expect(degrades).toEqual({ root: '#3fe3a0', third: '#5b98f0', fifth: '#ff6f66', seventh: '#ffc247', ext: '#dba8ee' });
    // et chaque barre prend le dégradé de son rôle
    const remplissages = await notes(page).evaluateAll(ns => ns.map(n => `${n.getAttribute('data-role')}=${n.getAttribute('fill')}`));
    for (const r of remplissages) { const [role, fill] = r.split('='); expect(fill).toMatch(new RegExp(`^url\\(#vlg-\\d+-${role}\\)$`)); }
  });

  test('un accord répété garde ses voix : 4 traits PLEINS (tenues), et 8 traits POINTILLÉS (mouvements) @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: unePartie(COUPLET, 'Couplet') });
    await ouvrirVoicing(page);
    // Cmaj7 → Cmaj7 : 4 voix tenues ; Cmaj7 → Fmaj7 et Fmaj7 → G7 : 4 voix qui bougent chacune
    await expect(tenues(page)).toHaveCount(4);
    await expect(mouvements(page)).toHaveCount(8);
    // une voix par rang relie les accords consécutifs : 3 jonctions × 4 voix
    expect(await tenues(page).count() + await mouvements(page).count()).toBe(12);
  });

  test('le trait d\'une note tenue est plein et épais, celui d\'un mouvement fin et en pointillé', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: unePartie(COUPLET, 'Couplet') });
    await ouvrirVoicing(page);
    const style = (l: any) => l.first().evaluate((e: Element) => [e.getAttribute('stroke-width'), e.getAttribute('stroke-dasharray')]);
    expect(await style(tenues(page))).toEqual(['2.5', 'none']);
    expect(await style(mouvements(page))).toEqual(['1.6', '3,2']);
  });

  test('un trait part de la fin d\'une barre et arrive au début de la barre de même rang de l\'accord suivant', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: unePartie(COUPLET, 'Couplet') });
    await ouvrirVoicing(page);
    const b = await notes(page).evaluateAll(ns => ns.map(n => ({ x: Number(n.getAttribute('x')), w: Number(n.getAttribute('width')), y: Number(n.getAttribute('y')), h: Number(n.getAttribute('height')) })));
    const t = await tenues(page).evaluateAll(ls => ls.map(l => ({ x1: Number(l.getAttribute('x1')), x2: Number(l.getAttribute('x2')), y1: Number(l.getAttribute('y1')), y2: Number(l.getAttribute('y2')) })));
    // les tenues relient l'accord 1 (barres 0 à 3) à l'accord 2 (barres 4 à 7), voix par voix, à la hauteur du milieu de la barre
    expect(t).toHaveLength(4);
    t.sort((p, q) => q.y1 - p.y1);        // du grave à l'aigu
    for (let v = 0; v < 4; v++) {
      expect(t[v].y1).toBeCloseTo(b[v].y + b[v].h / 2, 0);
      expect(t[v].y2).toBeCloseTo(b[4 + v].y + b[4 + v].h / 2, 0);
      expect(t[v].x1).toBeGreaterThanOrEqual(b[v].x + b[v].w - 8);
      expect(t[v].x2).toBeLessThanOrEqual(b[4 + v].x + 8);
    }
  });

  test('la colonne des touches (blanches et noires) est nommée en Do et reste HORS de la zone qui défile', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: unePartie(COUPLET, 'Couplet') });
    await ouvrirVoicing(page);
    await expect(touches(page).locator('text')).toHaveText(['C3', 'C4']);
    // vingt touches dessinées : les blanches sont claires, les noires sombres
    const fonds = await touches(page).locator('rect').evaluateAll(rs => rs.map(r => r.getAttribute('fill') ?? ''));
    expect(fonds.length).toBeGreaterThanOrEqual(20);
    expect(new Set(fonds).size).toBeGreaterThanOrEqual(2);
    const bk = (await touches(page).boundingBox())!, bd = (await defilante(page).boundingBox())!;
    expect(bk.x + bk.width).toBeLessThanOrEqual(bd.x + 1);          // les touches sont à gauche du dessin, pas dedans
    expect(Math.round(bk.width)).toBe(34);
  });

  test('une partie longue déborde : un coup de molette horizontale fait défiler les notes et les touches ne bougent pas @critique', async ({ ouvrirAppli, browserName, isMobile }) => {
    test.skip(isMobile && browserName === 'webkit', 'Playwright ne sait pas simuler la molette sur WebKit mobile (iPad) : mouse.wheel n\'y existe pas');
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await activerPartie(page, 3);
    await ouvrirVoicing(page);
    await expect(titre(page)).toHaveText('Long');
    const dim = await defilante(page).evaluate(e => ({ large: e.scrollWidth, vu: e.clientWidth }));
    expect(dim.large).toBeGreaterThan(dim.vu + 200);                // il y a de la place à parcourir
    const avantTouches = (await touches(page).boundingBox())!, avantNote = (await notes(page).first().boundingBox())!;
    await defilante(page).hover();
    await page.mouse.wheel(400, 0);        // molette horizontale (pavé tactile) : sans débordement vertical, la molette verticale ne défile pas
    await expect.poll(() => defilante(page).evaluate(e => e.scrollLeft + e.scrollTop)).toBeGreaterThan(50);
    const apresTouches = (await touches(page).boundingBox())!, apresNote = (await notes(page).first().boundingBox())!;
    // les touches ne bougent pas, à 1 px près : sous WebKit la fenêtre se pose parfois sur 152 px au lieu de 151 (arrondi de la mise en page, ≈ 1 fois sur 3 sous charge) puis revient à 151
    expect(Math.abs(apresTouches.x - avantTouches.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(apresTouches.y - avantTouches.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(apresNote.x - avantNote.x) + Math.abs(apresNote.y - avantNote.y)).toBeGreaterThan(30);   // les notes, elles, ont bougé
  });

  test('un renversement posé dans la fenêtre d\'accord est dessiné : Cmaj7 au 1er renversement = E G B C', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: unePartie(COUPLET, 'Couplet') });
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Voicing');
    await f.getByRole('button', { name: '1er renv.' }).click();
    await quitterFenetreAccord(page);
    await ouvrirVoicing(page);
    expect((await nomsDesNotes(page)).slice(4, 8)).toEqual(['E', 'G', 'B', 'C']);
    // la première note a changé de ligne : ce n'est plus une voix tenue (C ne revient plus sur C)
    await expect(tenues(page)).toHaveCount(0);
    await expect(mouvements(page)).toHaveCount(12);
  });

  test('un drop 2 est dessiné : Cmaj7 en drop 2 = G C E B (la 2e voix du haut descend d\'une octave)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: unePartie(COUPLET, 'Couplet') });
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Voicing');
    await f.getByRole('button', { name: 'Drop 2' }).click();
    await quitterFenetreAccord(page);
    await ouvrirVoicing(page);
    expect((await nomsDesNotes(page)).slice(4, 8)).toEqual(['G', 'C', 'E', 'B']);
  });

  test('monter l\'octave d\'un accord monte ses barres d\'autant (12 demi-tons) sans changer leurs noms', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: unePartie(COUPLET, 'Couplet') });
    await ouvrirVoicing(page);
    const avant = await hauteurs(page);
    await page.keyboard.press('Escape');
    await attendreFermee(page);
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Voicing');
    await f.getByRole('button', { name: 'Monter d\'une octave' }).click();
    await quitterFenetreAccord(page);
    await ouvrirVoicing(page);
    expect((await nomsDesNotes(page)).slice(4, 8)).toEqual(['C', 'E', 'G', 'B']);
    const apres = await hauteurs(page);
    // dans la colonne de l'accord relevé, l'écart entre les notes ne change pas ; par rapport à la colonne voisine, il monte de 12 demi-tons
    const pas = (apres[3] - apres[2]);                              // un demi-ton = (écart d'une ligne), mesuré sur G → B (4 demi-tons) : 4 pas
    const demiTon = Math.abs(pas) / 4;
    expect(avant[4] - avant[0]).toBe(0);                            // départ : même hauteur pour les deux Cmaj7
    expect((apres[0] - apres[4]) / demiTon).toBeCloseTo(12, 0);     // arrivée : 12 demi-tons plus haut
    for (let i = 5; i < 8; i++) expect(apres[i] - apres[4]).toBe(avant[i] - avant[4]);
  });

  test('une basse ajoutée dans la fenêtre d\'accord ajoute une barre grave et le nom « G7/B » à la colonne', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: unePartie(COUPLET, 'Couplet') });
    const f = await ouvrirFenetre(page, 0, 3);
    await choisirOnglet(f, 'Voicing');
    await f.getByRole('combobox').selectOption('B');
    await quitterFenetreAccord(page);
    await ouvrirVoicing(page);
    await expect(notes(page)).toHaveCount(17);
    expect((await entetes(page)).filter((_, i) => i % 2 === 0)).toEqual(['Cmaj7', 'Cmaj7', 'Fmaj7', 'G7/B']);
    expect((await nomsDesNotes(page)).slice(12)).toEqual(['B', 'G', 'B', 'D', 'F']);
    // la basse est la barre la plus grave de sa colonne
    const y = await hauteurs(page);
    expect(Math.max(...y.slice(12))).toBe(y[12]);
  });

  test('changer le type d\'un accord redessine sa colonne : Cmaj7 devient C (trois sons)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: unePartie(COUPLET, 'Couplet') });
    const f = await ouvrirFenetre(page, 0, 0);
    await f.getByRole('button', { name: 'Majeur', exact: true }).click();
    await quitterFenetreAccord(page);
    await ouvrirVoicing(page);
    await expect(notes(page)).toHaveCount(15);
    expect((await entetes(page)).filter((_, i) => i % 2 === 0)).toEqual(['C', 'Cmaj7', 'Fmaj7', 'G7']);
    expect((await nomsDesNotes(page)).slice(0, 3)).toEqual(['C', 'E', 'G']);
  });

  test('changer la fondamentale d\'un accord le redessine : Cmaj7 devient Dmaj7 (ré, fa dièse, la, do dièse)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: unePartie(COUPLET, 'Couplet') });
    const f = await ouvrirFenetre(page, 0, 0);
    await f.locator('[data-bulle="root"][data-valeur="D"]').click();
    await quitterFenetreAccord(page);
    await ouvrirVoicing(page);
    expect((await entetes(page)).filter((_, i) => i % 2 === 0)[0]).toBe('Dmaj7');
    expect((await nomsDesNotes(page)).slice(0, 4)).toEqual(['D', 'F#', 'A', 'C#']);
  });

  test('la transposition d\'un demi-ton redessine toute la partie, avec les mêmes noms que la grille', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: unePartie(COUPLET, 'Couplet') });
    await page.getByRole('button', { name: 'Transposer tout le morceau vers le haut' }).click();
    const grille = await noms(page, 0);
    expect(grille[0]).not.toBe('Cmaj7');                            // la grille a bien changé
    await ouvrirVoicing(page);
    expect((await entetes(page)).filter((_, i) => i % 2 === 0)).toEqual(grille);
    expect(await nomsDesNotes(page)).not.toEqual(['C', 'E', 'G', 'B', 'C', 'E', 'G', 'B', 'F', 'A', 'C', 'E', 'G', 'B', 'D', 'F']);
  });

  test('la largeur d\'une colonne suit la durée de l\'accord (2, 6, 1 et 4 temps)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: unePartie([
      { root: 'C', quality: 'maj7', beats: 2 }, { root: 'F', quality: 'maj7', beats: 6 }, { root: 'G', quality: 'dom7', beats: 1 }, { root: 'C', quality: '', beats: 4 },
    ]) });
    await ouvrirVoicing(page);
    const largeurs = await notes(page).evaluateAll(ns => ns.map(n => Number(n.getAttribute('width'))));
    // quatre barres pour les trois premiers accords, trois pour la triade finale ; une barre = sa colonne moins une marge de 6 px
    const colonnes = [largeurs[0], largeurs[4], largeurs[8], largeurs[12]].map(w => w + 6);
    const unTemps = colonnes[2];                                       // l'accord de 1 temps donne la largeur d'un temps
    expect(colonnes.map(c => c / unTemps)).toEqual([2, 6, 1, 4]);
    expect(largeurs).toHaveLength(15);
  });

  test('les chiffres romains de la fenêtre sont ceux de la grille (même tonalité, mêmes degrés)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: unePartie([
      { root: 'C', quality: 'maj7' }, { root: 'A', quality: 'min7' }, { root: 'D', quality: 'min7' }, { root: 'G', quality: 'dom7' },
    ]) });
    const grille = await degres(page);
    expect(grille).toHaveLength(4);
    await ouvrirVoicing(page);
    expect((await entetes(page)).filter((_, i) => i % 2 === 1)).toEqual(grille);
  });

  test('le chiffre romain garde l\'extension de l\'accord : Cmaj9 « I9 » (comme G9 « V9 »), Cdim7 « i°7 » (et non « I » et « i° »)', async ({ ouvrirAppli }) => {
    test.fail(true, 'V-02 (bugs.md) : bug connu, le test doit repasser au vert quand il sera corrigé');
    const page = await ouvrirAppli({ reglages: unePartie([{ root: 'C', quality: 'maj9' }, { root: 'C', quality: 'dim7' }, { root: 'C', quality: 'dim' }]) });
    await ouvrirVoicing(page);
    const chiffres = (await entetes(page)).filter((_, i) => i % 2 === 1);
    expect(chiffres[0]).toMatch(/9/);                                  // Cmaj9 : « I » aujourd'hui
    expect(chiffres[1]).toMatch(/7/);                                  // Cdim7 : « i° » aujourd'hui, comme Cdim
    expect(chiffres[1]).not.toBe(chiffres[2]);
  });

  test('l\'ouverture de la fenêtre ne modifie pas le morceau', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    const avant = await page.evaluate(() => localStorage.getItem('myProgression'));
    await ouvrirVoicing(page);
    await bouton(page).click();
    await attendreFermee(page);
    expect(await page.evaluate(() => localStorage.getItem('myProgression'))).toBe(avant);
  });
});
