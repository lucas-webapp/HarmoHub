// MODULE « mobile » — la rangée des réglages sous les onglets : le résumé « C · 120 BPM · 4/4 » qui déplie les quatre cases (Tonalité, Mesure, Swing, Son) et
// « Transposer », le bouton « Affichage de la grille » (Compact / Normal / Large + pincement à deux doigts), et le bouton « Séquenceur ».
// Le tempo (barre-résumé), le panneau « Lecture » et le séquenceur lui-même sont éprouvés par les modules lecture et sequenceur.
import { test, expect } from '../support/fixtures';
import {
  C_AM_F_G, DEUX_PARTIES, caseN, cases, noms, resume, reglagesMorceauPanneau, boutonAffichage, boutonSequenceurHaut, voyant, hauteurCase, boite, tientDansL_ecran,
  fenetre, estChromium, pincer,
} from './aide-mobile';

const case_ = (page: any, nom: string) => reglagesMorceauPanneau(page).getByRole('button', { name: new RegExp(`^${nom} `) });

test.describe('Réglages du morceau et affichage de la grille au téléphone @mobile', () => {
  test('le résumé déplie quatre cases et « Transposer » dans la page, et les replie @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await expect(reglagesMorceauPanneau(page)).toBeHidden();
    await expect(resume(page)).toHaveAttribute('aria-expanded', 'false');
    const avant = await boite(caseN(page, 0, 0));

    await resume(page).tap();
    await expect(resume(page)).toHaveAttribute('aria-expanded', 'true');
    const p = reglagesMorceauPanneau(page);
    await expect(p).toBeVisible();
    await expect(case_(page, 'Tonalité')).toHaveText(/C majeur/);
    await expect(case_(page, 'Mesure')).toHaveText(/4\/4/);
    await expect(case_(page, 'Swing')).toHaveText(/Droit/);
    await expect(case_(page, 'Son')).toHaveText(/Piano/);
    await expect(p.getByRole('group', { name: 'Transposer le morceau' })).toBeVisible();
    await tientDansL_ecran(page, p);
    // le panneau est dans la page : il pousse la grille vers le bas, au lieu de la recouvrir
    expect((await boite(caseN(page, 0, 0))).y).toBeGreaterThan(avant.y + 80);

    await resume(page).tap();
    await expect(resume(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(p).toBeHidden();
    expect((await boite(caseN(page, 0, 0))).y).toBeCloseTo(avant.y, 0);
    expect(garde.bloquees).toEqual([]);
  });

  test('« Transposer » monte et descend tout le morceau d\'un demi-ton ; le résumé et la grille suivent @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await resume(page).tap();
    const haut = page.getByRole('button', { name: 'Transposer tout le morceau vers le haut' });
    const bas = page.getByRole('button', { name: 'Transposer tout le morceau vers le bas' });
    await haut.tap();
    expect(await noms(page)).toEqual(['D♭', 'B♭m', 'G♭', 'A♭']);
    await expect(resume(page)).toHaveAccessibleName(/^Réglages du morceau : D♭ majeur/);
    await expect(case_(page, 'Tonalité')).toHaveText(/D♭ majeur/);
    await haut.tap();
    expect(await noms(page)).toEqual(['D', 'Bm', 'G', 'A']);
    await bas.tap();
    await bas.tap();
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
    await expect(resume(page)).toHaveAccessibleName(/^Réglages du morceau : C majeur/);
    await bas.tap();
    expect(await noms(page)).toEqual(['B', 'G#m', 'E', 'F#']);
  });

  test('chaque case ouvre sa liste dans l\'écran ; choisir une valeur la porte au résumé @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await resume(page).tap();

    await case_(page, 'Mesure').tap();
    const mesures = page.getByRole('listbox', { name: 'Mesure' });
    await expect(mesures).toBeVisible();
    await tientDansL_ecran(page, mesures);
    await mesures.getByText('3/4', { exact: true }).tap();
    await expect(mesures).toBeHidden();
    await expect(case_(page, 'Mesure')).toHaveText(/3\/4/);
    await expect(resume(page)).toHaveText(/3\/4/);

    await case_(page, 'Swing').tap();
    const swing = page.getByRole('listbox', { name: 'Swing' });
    await expect(swing).toBeVisible();
    await tientDansL_ecran(page, swing);
    await swing.getByText('Ternaire', { exact: true }).tap();
    await expect(swing).toBeHidden();
    await expect(case_(page, 'Swing')).toHaveText(/Ternaire/);

    await case_(page, 'Son').tap();
    const sons = page.getByRole('listbox', { name: 'Son du morceau' });
    await expect(sons).toBeVisible();
    await tientDansL_ecran(page, sons);
    await sons.getByText('Orgue/Lead', { exact: true }).tap();
    await expect(sons).toBeHidden();
    await expect(case_(page, 'Son')).toHaveText(/Orgue\/Lead/);
    await expect(resume(page)).toHaveAccessibleName(/3\/4 · Ternaire · Orgue\/Lead/);
  });

  test('la tonalité se règle par la tonique puis le mode, sans toucher aux accords', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await resume(page).tap();
    await case_(page, 'Tonalité').tap();
    const f = page.getByRole('dialog', { name: 'Tonalité de référence' });
    await expect(f).toBeVisible();
    await tientDansL_ecran(page, f);
    // sept modes en libellé court (Maj, Min, Dor…), leur nom complet en nom accessible
    await expect(f.locator('[data-rr-action="mode"]')).toHaveText(['Maj', 'Min', 'Dor', 'Phr', 'Lyd', 'Mix', 'Loc']);
    for (const m of ['Majeur', 'Mineur', 'Dorien', 'Phrygien', 'Lydien', 'Mixolydien', 'Locrien']) await expect(f.getByRole('button', { name: m, exact: true })).toBeVisible();
    await expect(f.getByRole('button', { name: /Suggérer/ })).toBeVisible();
    await f.getByRole('button', { name: 'A', exact: true }).tap();
    await f.getByRole('button', { name: 'Mineur', exact: true }).tap();
    await expect(resume(page)).toHaveAccessibleName(/^Réglages du morceau : A mineur/);
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('« Affichage de la grille » : Compact 44 px, Normal 64 px, Large 72 px sur deux mesures par ligne ; le choix est gardé @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const etatAvant = await voyant(page).getAttribute('data-etat');
    await expect(boutonAffichage(page)).toHaveAccessibleName('Affichage de la grille : Normal');
    expect(await hauteurCase(page)).toBe(64);
    const rangees = () => page.evaluate(() => new Set([...document.querySelectorAll('#progression-sections .grid-cell[data-section="0"][data-index]')].map(c => Math.round(c.getBoundingClientRect().y))).size);
    expect(await rangees()).toBe(1);

    await boutonAffichage(page).tap();
    const choix = page.getByRole('button', { name: 'Compact', exact: true });
    await expect(choix).toBeVisible();
    await tientDansL_ecran(page, choix);
    await choix.tap();
    await expect(boutonAffichage(page)).toHaveAccessibleName('Affichage de la grille : Compact');
    expect(await hauteurCase(page)).toBe(44);
    expect(await rangees()).toBe(1);

    await page.getByRole('button', { name: 'Large', exact: true }).tap();
    await expect(boutonAffichage(page)).toHaveAccessibleName('Affichage de la grille : Large');
    expect(await hauteurCase(page)).toBe(72);
    expect(await rangees()).toBe(2);   // deux mesures par ligne : quatre accords sur deux lignes
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);

    // c'est une préférence de l'appareil : le voyant du morceau ne s'allume pas, et le choix survit à un rechargement
    await expect(voyant(page)).toHaveAttribute('data-etat', etatAvant!);
    await page.reload();
    await expect(cases(page)).toHaveCount(4);
    await expect(boutonAffichage(page)).toHaveAccessibleName('Affichage de la grille : Large');
    expect(await hauteurCase(page)).toBe(72);
    await boutonAffichage(page).tap();
    await page.getByRole('button', { name: 'Normal', exact: true }).tap();
    expect(await hauteurCase(page)).toBe(64);
  });

  test('un pincement à deux doigts agrandit puis réduit la grille ; choisir « Normal » rend la taille de l\'affichage', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    test.skip(!estChromium(page), 'Playwright ne sait pas poser deux doigts en WebKit mobile (pas de geste tactile composé) : vérifié sur Android seulement.');
    // les doigts se posent sur le corps des cases (un doigt sur la poignée de durée, au bord d'une case, ferait glisser la durée)
    const milieu = async (n: number) => { const b = await boite(caseN(page, 0, n)); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    expect(await hauteurCase(page)).toBe(64);
    const [c1, c2] = [await milieu(1), await milieu(2)];
    await pincer(page, (c1.x + c2.x) / 2, c1.y, (c2.x - c1.x) / 2, 100);
    await expect.poll(() => hauteurCase(page)).toBeGreaterThan(100);
    await boutonAffichage(page).tap();
    await page.getByRole('button', { name: 'Normal', exact: true }).tap();
    await expect.poll(() => hauteurCase(page)).toBe(64);
    const [c0, c3] = [await milieu(0), await milieu(3)];
    await pincer(page, (c0.x + c3.x) / 2, c0.y, (c3.x - c0.x) / 2, 40);
    await expect.poll(() => hauteurCase(page)).toBeLessThan(64);
  });

  test('le bouton « Séquenceur » ouvre la feuille d\'accord sur l\'onglet Rythme, sur l\'accord choisi, sinon le premier de la partie @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    await expect(boutonSequenceurHaut(page)).toHaveAccessibleName('Séquenceur');
    await boutonSequenceurHaut(page).tap();
    const f = fenetre(page);
    await expect(f).toBeVisible();
    await expect(f).toHaveAccessibleName('Accord C');
    await expect(f.getByRole('button', { name: 'Rythme', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await f.getByRole('button', { name: 'Fermer' }).first().tap();
    await expect(f).toBeHidden();

    await caseN(page, 1, 0).tap();
    await expect(caseN(page, 1, 0)).toHaveClass(/\bselected\b/);
    await boutonSequenceurHaut(page).tap();
    await expect(f).toBeVisible();
    await expect(f).toHaveAccessibleName('Accord F');
    await expect(f.getByRole('button', { name: 'Rythme', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });
});
