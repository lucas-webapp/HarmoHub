// MODULE « voicing » — la fenêtre « Conduite des voix » : le bouton, l'ouverture, les trois façons de la fermer, la partie montrée (la partie active),
// l'état vide, le redessin quand la grille change. Ordinateur et iPad (≥ 900 px) ; au téléphone le bouton n'existe pas (voir telephone.spec.ts).
import { test, expect } from '../support/fixtures';
import {
  C_AM_F_G, caseN, morceauQuatreParties, bouton, popover, notes, titre, ouvrirVoicing, attendreFermee, activerPartie, reglagesMorceau,
} from './aide-voicing';

test.describe('Fenêtre « Conduite des voix » @voicing @ordinateur', () => {
  test('le bouton « Voicing » est à droite de la barre de réglages ; la fenêtre est fermée au départ', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await expect(bouton(page)).toBeVisible();
    await expect(bouton(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(bouton(page)).toHaveAttribute('title', /voix/i);
    await expect(popover(page)).toBeHidden();
    // « tout à droite » : le bouton est le dernier de la rangée, collé au bord droit de la fenêtre
    const b = (await bouton(page).boundingBox())!, v = page.viewportSize()!;
    expect(v.width - (b.x + b.width)).toBeLessThan(40);
    expect(b.y).toBeLessThan(120);
    // et il est après le bouton « Séquenceur » (leur ordre ne change pas)
    const s = (await page.locator('#vue-sequenceur').boundingBox())!;
    expect(b.x).toBeGreaterThan(s.x + s.width - 1);
  });

  test('un clic sur le bouton ouvre la fenêtre, sous le bouton et dans la fenêtre du navigateur @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await ouvrirVoicing(page);
    await expect(titre(page)).toHaveText('Couplet');
    await expect(notes(page)).toHaveCount(16);
    const p = (await popover(page).boundingBox())!, b = (await bouton(page).boundingBox())!, v = page.viewportSize()!;
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x + p.width).toBeLessThanOrEqual(v.width);
    expect(p.y).toBeGreaterThanOrEqual(b.y + b.height - 1);     // sous le bouton
    expect(p.y + p.height).toBeLessThanOrEqual(v.height);
  });

  test('Échap ferme la fenêtre et le bouton le redit (aria-expanded) @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await ouvrirVoicing(page);
    await page.keyboard.press('Escape');
    await attendreFermee(page);
  });

  test('un second clic sur le bouton referme la fenêtre ; un troisième la rouvre', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await ouvrirVoicing(page);
    await bouton(page).click();
    await attendreFermee(page);
    await ouvrirVoicing(page);
    await expect(notes(page)).toHaveCount(16);
  });

  test('au clavier : Entrée sur le bouton ouvre la fenêtre, Échap la ferme même si le focus est dedans', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await bouton(page).focus();
    await page.keyboard.press('Enter');
    await expect(popover(page)).toBeVisible();
    await popover(page).getByRole('button', { name: 'Agrandir l\'échelle horizontale' }).focus();
    await page.keyboard.press('Escape');
    await attendreFermee(page);
  });

  test('au clavier : après Entrée sur le bouton, la touche Tab mène dans la fenêtre (aux boutons H et V) et non dans la grille derrière', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await bouton(page).focus();
    await page.keyboard.press('Enter');
    await expect(popover(page)).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(popover(page).locator(':focus')).toHaveCount(1);
  });

  test('avec le séquenceur ouvert, la fenêtre s\'ouvre par-dessus ; un clic sur « Séquenceur » la ferme sans fermer le séquenceur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await page.locator('#vue-sequenceur').click();
    await expect(page.locator('#sequenceur')).toBeVisible();
    await ouvrirVoicing(page);
    await expect(page.locator('#sequenceur')).toBeVisible();
    await expect(notes(page)).toHaveCount(16);
    await page.locator('#vue-sequenceur').click();
    await expect(popover(page)).toBeHidden();
  });

  test('lancer la lecture ferme la fenêtre ouverte (un clic à côté) et la lecture démarre', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await ouvrirVoicing(page);
    await page.locator('#play-prog').click();
    await attendreFermee(page);
    await expect(page.locator('#progression-sections .grid-cell.playing').first()).toBeVisible();   // la lecture a démarré
    await page.locator('#play-prog').click();
  });

  test('un clic à côté (sur le fond de l\'appli) ferme la fenêtre', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await ouvrirVoicing(page);
    await page.mouse.click(12, 300);     // le fond, à gauche de la fenêtre
    await attendreFermee(page);
  });

  test('un clic dans la fenêtre ne la ferme pas', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await ouvrirVoicing(page);
    await notes(page).first().click();
    await titre(page).click();
    await expect(popover(page)).toBeVisible();
    await expect(bouton(page)).toHaveAttribute('aria-expanded', 'true');
  });

  test('la fenêtre ouverte se ferme quand on clique sur une case de la grille ; la case est alors sélectionnée', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await ouvrirVoicing(page);
    await caseN(page, 3, 0).click();     // « Long » : ses premières cases restent visibles sous la fenêtre
    await attendreFermee(page);
    await expect(caseN(page, 3, 0)).toHaveClass(/\bselected\b/);
  });

  test('la fenêtre montre la partie ACTIVE : le Couplet au départ, puis la partie de l\'accord sélectionné @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await ouvrirVoicing(page);
    await expect(titre(page)).toHaveText('Couplet');
    await expect(notes(page)).toHaveCount(16);                    // 4 accords × 4 sons
    await activerPartie(page, 1);
    await ouvrirVoicing(page);
    await expect(titre(page)).toHaveText('Refrain');
    await expect(notes(page)).toHaveCount(12);                    // 3 accords × 4 sons
    await activerPartie(page, 3);
    await ouvrirVoicing(page);
    await expect(titre(page)).toHaveText('Long');
    await expect(notes(page)).toHaveCount(48);                    // 12 accords × 4 sons
  });

  test('une partie d\'un seul accord n\'a rien à enchaîner : la fenêtre le dit', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await activerPartie(page, 2);
    await ouvrirVoicing(page);
    await expect(popover(page)).toContainText('Pont : il faut au moins deux accords pour voir comment les voix bougent.');
    await expect(notes(page)).toHaveCount(0);
  });

  test('une partie de deux accords (le minimum) est dessinée', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: reglagesMorceau([{ titre: 'Court', accords: [{ root: 'C', quality: '' }, { root: 'G', quality: '' }] }]) });
    await ouvrirVoicing(page);
    await expect(titre(page)).toHaveText('Court');
    await expect(notes(page)).toHaveCount(6);                     // 2 accords × 3 sons
  });

  test('supprimer un accord redessine la fenêtre restée ouverte ; Ctrl+Z le rend @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await activerPartie(page, 1, 1);                           
    await page.keyboard.press('Delete');
    await expect(caseN(page, 1, 2)).toHaveCount(0);               // il ne reste que deux accords
    await ouvrirVoicing(page);
    await expect(titre(page)).toHaveText('Refrain');
    await expect(notes(page)).toHaveCount(8);                     // 2 accords × 4 sons
    await page.keyboard.press('Control+z');
    await expect(notes(page)).toHaveCount(12);                    // l'accord revient, la fenêtre, restée ouverte, se redessine
    await expect(popover(page)).toBeVisible();
  });

  test('morceau sans accord : la fenêtre s\'ouvre sans erreur et ne dessine rien', async ({ ouvrirAppli }) => {
    const erreurs: string[] = [];
    const page = await ouvrirAppli();
    page.on('pageerror', e => erreurs.push(e.message));
    await ouvrirVoicing(page);
    await expect(notes(page)).toHaveCount(0);
    await expect(popover(page)).toContainText(/au moins deux accords/);
    expect(erreurs).toEqual([]);
  });

  test('la fenêtre est fermée après un rechargement', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await ouvrirVoicing(page);
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await expect(bouton(page)).toBeVisible();
    await expect(popover(page)).toBeHidden();
    await expect(bouton(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('sous 900 px de large, la fenêtre se referme et le bouton disparaît (mise en page du téléphone) ; elle revient en élargissant', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    const largeur = page.viewportSize()!.width;
    await ouvrirVoicing(page);
    await page.setViewportSize({ width: 800, height: 900 });
    await expect(popover(page)).toBeHidden();
    await expect(bouton(page)).toBeHidden();
    await page.setViewportSize({ width: largeur, height: 900 });
    await expect(bouton(page)).toBeVisible();
    await expect(bouton(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('à 1000 px de large le bouton ne garde que son logo (carré de 32 px) et la fenêtre tient dans l\'écran', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await page.setViewportSize({ width: 1000, height: 800 });
    await expect(bouton(page)).toBeVisible();
    await expect.poll(async () => Math.round((await bouton(page).boundingBox())!.width)).toBe(32);
    expect(Math.round((await bouton(page).boundingBox())!.height)).toBe(32);
    await ouvrirVoicing(page);
    const p = (await popover(page).boundingBox())!;
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x + p.width).toBeLessThanOrEqual(1000);
  });

  test('elle sert aussi pour un morceau de triades (do, la mineur, fa, sol) : une barre par son et par accord', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirVoicing(page);
    await expect(notes(page)).toHaveCount(12);
  });
});
