// MODULE « mobile » — la barre du haut et les onglets au téléphone (< 900 px) : deux rangées (nom du morceau, Enregistrer, Paramètres, compte ; puis
// Grille / Structure / Paroles avec Annuler et Rétablir), puis la rangée des réglages (résumé « C · 120 BPM · 4/4 », Affichage, Séquenceur).
// Ouvrir un morceau, enregistrer, annuler une modification de la grille : déjà éprouvés au téléphone par les modules fichiers et grille.
import { test, expect } from '../support/fixtures';
import { C_AM_F_G, noms, estMobile, titre, boutonEnregistrer, voyant, onglets, ongletGrille, ongletStructure, ongletParoles, annuler, retablir, parametres,
  compte, logo, boite, defilementHorizontal, defiler, tientDansL_ecran, resume, boutonAffichage, boutonSequenceurHaut, barreLecture, DEUX_PARTIES, cases } from './aide-mobile';

test.describe('Barre du haut et onglets au téléphone @mobile', () => {
  test('deux rangées : nom du morceau, Enregistrer, Paramètres, compte ; puis les trois onglets, Annuler et Rétablir, le tout dans l\'écran @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    expect(estMobile(page)).toBe(true);
    await expect(logo(page)).toBeVisible();
    await expect(titre(page)).toHaveText('Démo');
    for (const l of [titre(page), boutonEnregistrer(page), parametres(page), compte(page), onglets(page), annuler(page), retablir(page)]) {
      await expect(l).toBeVisible();
      await tientDansL_ecran(page, l);
    }
    await expect(onglets(page).getByRole('button')).toHaveText(['Grille', 'Structure', 'Paroles']);
    await expect(ongletGrille(page)).toHaveAttribute('aria-pressed', 'true');
    // première rangée : le nom, puis Enregistrer, Paramètres et le compte, dans cet ordre, sur une même ligne
    const [t, e, p, c] = [await boite(titre(page)), await boite(boutonEnregistrer(page)), await boite(parametres(page)), await boite(compte(page))];
    expect(e.x).toBeGreaterThan(t.x + t.width - 1);
    expect(p.x).toBeGreaterThan(e.x + e.width - 1);
    expect(c.x).toBeGreaterThan(p.x + p.width - 1);
    for (const b of [e, p, c]) expect(Math.abs(b.y - t.y)).toBeLessThanOrEqual(8);
    // seconde rangée : les onglets sous le nom, Annuler et Rétablir à leur droite
    const o = await boite(onglets(page)), u = await boite(annuler(page)), r = await boite(retablir(page));
    expect(o.y).toBeGreaterThan(t.y + t.height - 1);
    expect(u.x).toBeGreaterThan(o.x + o.width - 1);
    expect(r.x).toBeGreaterThan(u.x + u.width - 1);
    // des cibles faites pour le doigt : 44 px au moins
    for (const [nom, b] of [['nom', t], ['Enregistrer', e], ['Paramètres', p], ['compte', c], ['onglets', o], ['Annuler', u], ['Rétablir', r]] as const)
      expect.soft(b.height, `hauteur de « ${nom} »`).toBeGreaterThanOrEqual(43.5);
    expect(await defilementHorizontal(page)).toBe(0);
    expect(garde.bloquees).toEqual([]);
  });

  test('Structure ouvre la structure du morceau, Paroles les paroles, Grille ramène la grille ; la barre de lecture reste @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    const structure = page.getByRole('dialog', { name: 'Structure du morceau' });
    const paroles = page.getByRole('region', { name: 'Paroles du morceau' });
    await expect(structure).toBeHidden();
    await expect(paroles).toBeHidden();

    await ongletStructure(page).tap();
    await expect(structure).toBeVisible();
    await expect(ongletStructure(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(ongletGrille(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(structure).toContainText('6 mesures');
    await expect(structure).toContainText('2 partie(s)');
    await expect(structure).toContainText('| C | Am | F | G |');
    await expect(structure).toContainText('| F | C |');
    await expect(cases(page).first()).toBeHidden();
    await expect(barreLecture(page)).toBeVisible();
    await tientDansL_ecran(page, structure);

    await ongletParoles(page).tap();
    await expect(paroles).toBeVisible();
    await expect(ongletParoles(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(ongletStructure(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(structure).toBeHidden();
    const cadre = page.frameLocator('iframe').first();
    await expect(cadre.getByText('Couplet').first()).toBeVisible();
    await expect(cadre.getByRole('button', { name: 'Am', exact: true })).toBeVisible();
    await expect(barreLecture(page)).toBeVisible();

    await ongletGrille(page).tap();
    await expect(ongletGrille(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(paroles).toBeHidden();
    await expect(structure).toBeHidden();
    await expect(cases(page)).toHaveCount(6);
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G', 'F', 'C']);
  });

  test('une modification allume le voyant et Annuler ; Annuler la défait et allume Rétablir', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await expect(annuler(page)).toBeDisabled();
    await expect(retablir(page)).toBeDisabled();
    await resume(page).tap();
    await page.getByRole('button', { name: 'Transposer tout le morceau vers le haut' }).tap();
    expect(await noms(page)).toEqual(['D♭', 'B♭m', 'G♭', 'A♭']);
    await expect(voyant(page)).toContainText('Non enregistré');
    await expect(annuler(page)).toBeEnabled();
    await annuler(page).tap();
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
    await expect(retablir(page)).toBeEnabled();
    await retablir(page).tap();
    expect(await noms(page)).toEqual(['D♭', 'B♭m', 'G♭', 'A♭']);
    await expect(retablir(page)).toBeDisabled();
  });

  test('Paramètres s\'ouvre au toucher, tient dans l\'écran et se referme', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await parametres(page).tap();
    const f = page.getByRole('dialog', { name: 'Paramètres' });
    await expect(f).toBeVisible();
    await tientDansL_ecran(page, f);
    await page.keyboard.press('Escape');
    await expect(f).toBeHidden();
  });

  test('la barre du haut reste collée en haut et la barre de lecture en bas quand la page défile', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    const [h0, b0] = [await boite(titre(page)), await boite(barreLecture(page))];
    await defiler(page, 300);
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(100);
    const [h1, b1] = [await boite(titre(page)), await boite(barreLecture(page))];
    expect(h1.y).toBeCloseTo(h0.y, 0);
    expect(b1.y).toBeCloseTo(b0.y, 0);
    await expect(onglets(page)).toBeVisible();
    await tientDansL_ecran(page, barreLecture(page));
  });

  test('la rangée des réglages tient sous les onglets : résumé du morceau, Affichage et Séquenceur, sur une ligne, boutons de 44 px', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await expect(resume(page)).toHaveText(/C\s*·\s*120 BPM\s*·\s*4\/4/);
    await expect(resume(page)).toHaveAccessibleName(/^Réglages du morceau : C majeur · 120 BPM · 4\/4/);
    const [r, a, s, o] = [await boite(resume(page)), await boite(boutonAffichage(page)), await boite(boutonSequenceurHaut(page)), await boite(onglets(page))];
    expect(r.y).toBeGreaterThan(o.y + o.height - 1);
    expect(a.x).toBeGreaterThan(r.x + r.width - 1);
    expect(s.x).toBeGreaterThan(a.x + a.width - 1);
    for (const b of [r, a, s]) { expect(b.height).toBeGreaterThanOrEqual(43.5); expect(Math.abs(b.y - r.y)).toBeLessThanOrEqual(2); }
    for (const l of [resume(page), boutonAffichage(page), boutonSequenceurHaut(page)]) await tientDansL_ecran(page, l);
    expect(await defilementHorizontal(page)).toBe(0);
  });
});
