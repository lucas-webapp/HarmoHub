// MODULE « diagrammes » — les DOIGTÉS de la guitare : les flèches (et leur compteur « 2/4 »), la liste « Voir tous les doigtés », le CADENAS qui fixe un doigté
// pour un accord du morceau (point orange sur la case, flèches bloquées, doigté enregistré avec le morceau).
import { test, expect } from '../support/fixtures';
import {
  morceauDeux, caseN, selectionner, boutonGuitare, guitare, precedent, suivant, compteur, cadenas, listeDoigtes, doigteDeLaListe, pastilleCase, signature, position,
  doigteDuManche, nomAccord, notesAccord, ouvrirEditeur,
} from './aide-diagrammes';

const annuler = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Annuler' }).first();
const retablir = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Rétablir' }).first();

test.describe('Doigtés de la guitare @diagrammes @ordinateur', () => {
  test('le manche montre un doigté de l\'accord choisi et un compteur « 1/4 » ; Am7 et Dm7 n\'ont pas le même dessin @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 1);
    await expect(guitare(page)).toBeVisible();
    await expect(nomAccord(page)).toHaveText('Am7');
    expect(await position(page)).toEqual({ rang: 1, total: 4 });
    const d = await doigteDuManche(page);
    expect(d.notes.length).toBeGreaterThanOrEqual(3);
    const sigAm7 = await signature(page);
    await selectionner(page, 0, 2);
    await expect(nomAccord(page)).toHaveText('Dm7');
    expect(await position(page)).toEqual({ rang: 1, total: 4 });
    expect(await signature(page)).not.toBe(sigAm7);
  });

  test('« Doigté suivant » parcourt les doigtés un à un puis revient au premier ; « Doigté précédent » fait le chemin inverse @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 1);
    await expect(precedent(page)).toBeEnabled();
    await expect(suivant(page)).toBeEnabled();
    const vus: string[] = [await signature(page)];
    for (let n = 2; n <= 4; n++) {
      await suivant(page).click();
      await expect(compteur(page)).toHaveText(`${n}/4`);
      vus.push(await signature(page));
    }
    expect(new Set(vus).size).toBe(4);                       // quatre doigtés différents
    await suivant(page).click();                              // après le dernier : le premier
    await expect(compteur(page)).toHaveText('1/4');
    expect(await signature(page)).toBe(vus[0]);
    await precedent(page).click();                            // avant le premier : le dernier
    await expect(compteur(page)).toHaveText('4/4');
    expect(await signature(page)).toBe(vus[3]);
    await precedent(page).click();
    await expect(compteur(page)).toHaveText('3/4');
    expect(await signature(page)).toBe(vus[2]);
  });

  test('changer de doigté ne touche pas au morceau : ni accord modifié, ni étape d\'annulation, ni case marquée', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 1);
    await suivant(page).click();
    await expect(compteur(page)).toHaveText('2/4');
    await expect(annuler(page)).toBeDisabled();
    await expect(pastilleCase(page, 0, 1)).toHaveCount(0);
    await expect(nomAccord(page)).toHaveText('Am7');
  });

  test('« Voir tous les doigtés » liste les doigtés proposés, marque le courant, et en choisir un le met sur le manche @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 1);
    await expect(compteur(page)).toHaveAccessibleName('Voir tous les doigtés');
    await expect(compteur(page)).toHaveAttribute('aria-expanded', 'false');
    await compteur(page).click();
    await expect(listeDoigtes(page)).toBeVisible();
    await expect(compteur(page)).toHaveAttribute('aria-expanded', 'true');
    const boutons = listeDoigtes(page).getByRole('button');
    await expect(boutons).toHaveCount(4);
    await expect(doigteDeLaListe(page, 1)).toHaveAttribute('aria-pressed', 'true');
    await expect(doigteDeLaListe(page, 2)).toHaveAttribute('aria-pressed', 'false');
    // les doigtés incomplets le disent
    await expect(listeDoigtes(page).getByRole('button', { name: /sans quinte/ })).toHaveCount(2);
    const sig0 = await signature(page);
    await doigteDeLaListe(page, 3).click();
    await expect(listeDoigtes(page)).toBeHidden();
    await expect(compteur(page)).toHaveText('3/4');
    expect(await signature(page)).not.toBe(sig0);
    // le doigté choisi est celui de la liste : on le retrouve avec les flèches
    const sig3 = await signature(page);
    await suivant(page).click(); await suivant(page).click();      // 4, puis 1
    await expect(compteur(page)).toHaveText('1/4');
    expect(await signature(page)).toBe(sig0);
    await compteur(page).click();
    await doigteDeLaListe(page, 3).click();
    expect(await signature(page)).toBe(sig3);
  });

  test('la liste des doigtés se ferme avec Échap, par un clic à côté, et un clic sur un autre accord de la grille', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 1);
    await compteur(page).click();
    await expect(listeDoigtes(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(listeDoigtes(page)).toBeHidden();
    await expect(compteur(page)).toHaveAttribute('aria-expanded', 'false');
    await compteur(page).click();
    await expect(listeDoigtes(page)).toBeVisible();
    await page.mouse.click(200, 400);                         // une zone vide de la page
    await expect(listeDoigtes(page)).toBeHidden();
    await compteur(page).click();
    await expect(listeDoigtes(page)).toBeVisible();
    await compteur(page).click();                             // le même bouton la referme
    await expect(listeDoigtes(page)).toBeHidden();
    await compteur(page).click();
    await expect(listeDoigtes(page)).toBeVisible();
    await caseN(page, 0, 2).click();                          // un autre accord : la liste de l'ancien n'a plus de sens
    await expect(listeDoigtes(page)).toBeHidden();
    await expect(nomAccord(page)).toHaveText('Dm7');
  });

  test('le cadenas fixe le doigté de l\'accord : flèches et compteur bloqués, point orange sur la case, doigté inchangé @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 1);
    await suivant(page).click();
    await suivant(page).click();
    const sig = await signature(page);                        // le 3ᵉ doigté
    await expect(cadenas(page)).toHaveAccessibleName('Verrouiller ce doigté pour cet accord');
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(pastilleCase(page, 0, 1)).toHaveCount(0);
    await cadenas(page).click();
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(cadenas(page)).toHaveAccessibleName(/^Doigté verrouillé pour cet accord/);
    await expect(precedent(page)).toBeDisabled();
    await expect(suivant(page)).toBeDisabled();
    await expect(compteur(page)).toBeDisabled();
    await expect(pastilleCase(page, 0, 1)).toHaveCount(1);
    await expect(pastilleCase(page, 0, 1)).toHaveAccessibleName('Voicing personnalisé : doigté de guitare fixé');
    expect(await signature(page)).toBe(sig);                  // le doigté fixé est bien celui qu'on regardait
    await expect(pastilleCase(page, 0, 2)).toHaveCount(0);    // les autres accords ne sont pas marqués
    // un clic sur les flèches (désactivées) ne change rien
    await suivant(page).click({ force: true });
    expect(await signature(page)).toBe(sig);
  });

  test('un doigté fixé est retrouvé en revenant sur l\'accord, et n\'empêche pas les autres accords d\'avoir leurs flèches @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 1);
    await suivant(page).click();
    const sig = await signature(page);
    await cadenas(page).click();
    await selectionner(page, 0, 2);
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(suivant(page)).toBeEnabled();
    await expect(compteur(page)).toBeEnabled();
    await selectionner(page, 1, 0);
    await expect(suivant(page)).toBeEnabled();
    await selectionner(page, 0, 1);
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'true');
    expect(await signature(page)).toBe(sig);
    await expect(suivant(page)).toBeDisabled();
  });

  test('re-cliquer le cadenas libère l\'accord : le point orange disparaît et les flèches reviennent', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 1);
    await cadenas(page).click();
    await expect(pastilleCase(page, 0, 1)).toHaveCount(1);
    await cadenas(page).click();
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(cadenas(page)).toHaveAccessibleName('Verrouiller ce doigté pour cet accord');
    await expect(pastilleCase(page, 0, 1)).toHaveCount(0);
    await expect(precedent(page)).toBeEnabled();
    await expect(suivant(page)).toBeEnabled();
    await expect(compteur(page)).toBeEnabled();
    const avant = await signature(page);
    await suivant(page).click();
    expect(await signature(page)).not.toBe(avant);            // les flèches changent de nouveau le doigté
  });

  test('le doigté fixé est enregistré avec le morceau : il revient après « Enregistrer » et un rechargement @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 1);
    await suivant(page).click(); await suivant(page).click();
    const sig = await signature(page);
    await cadenas(page).click();
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.locator('#tb-etat')).toContainText(/Enregistré à \d{1,2}:\d{2}/);
    await page.reload();
    await expect(caseN(page, 0, 1)).toBeVisible();
    await expect(pastilleCase(page, 0, 1)).toHaveCount(1);
    await selectionner(page, 0, 1);
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'true');
    expect(await signature(page)).toBe(sig);
    await expect(suivant(page)).toBeDisabled();
    await expect(pastilleCase(page, 0, 0)).toHaveCount(0);
  });

  test('verrouiller est une étape d\'annulation : Annuler libère le doigté, Rétablir le fixe de nouveau', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 1);
    await expect(annuler(page)).toBeDisabled();
    await cadenas(page).click();
    await expect(pastilleCase(page, 0, 1)).toHaveCount(1);
    await expect(annuler(page)).toBeEnabled();
    await annuler(page).click();
    await expect(pastilleCase(page, 0, 1)).toHaveCount(0);
    // D-04 : le bouton cadenas affiché juste après l'annulation peut être périmé (sous WebKit chargé) ; l'état réel se lit en revenant sur l'accord
    await selectionner(page, 0, 2);
    await selectionner(page, 0, 1);
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(suivant(page)).toBeEnabled();
    await retablir(page).click();
    await expect(pastilleCase(page, 0, 1)).toHaveCount(1);
    await selectionner(page, 0, 2);
    await selectionner(page, 0, 1);
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(suivant(page)).toBeDisabled();
  });

  test('D-04 : juste après Annuler / Rétablir, le bouton cadenas montre déjà le bon état', async ({ ouvrirAppli, browserName }) => {
    test.fixme(browserName === 'webkit', 'D-04 (bugs.md) : intermittent sous WebKit (Safari, iPad) quand la machine est chargée, le cadenas reste dans l\'ancien état plusieurs secondes après Annuler / Rétablir');
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 1);
    await cadenas(page).click();
    await expect(pastilleCase(page, 0, 1)).toHaveCount(1);
    await annuler(page).click();
    await expect(pastilleCase(page, 0, 1)).toHaveCount(0);
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(suivant(page)).toBeEnabled();
    await retablir(page).click();
    await expect(pastilleCase(page, 0, 1)).toHaveCount(1);
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(suivant(page)).toBeDisabled();
  });

  // Renommer l'accord en cliquant sur son nom dans la case (geste de l'utilisateur).
  async function renommer(page: import('@playwright/test').Page, partie: number, n: number, nom: string) {
    await caseN(page, partie, n).locator('.cell-sym').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(nom);
    await page.keyboard.press('Enter');
    await expect(caseN(page, partie, n).locator('.cell-sym')).toHaveText(nom);
  }

  test('renommer l\'accord d\'une case dont le doigté est fixé retire le point orange : le doigté fixé ne suit pas un autre accord', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 3);
    await cadenas(page).click();
    await expect(pastilleCase(page, 0, 3)).toHaveCount(1);
    await renommer(page, 0, 3, 'Bm7');
    await expect(pastilleCase(page, 0, 3)).toHaveCount(0);
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(suivant(page)).toBeEnabled();
  });

  test('renommer l\'accord choisi met aussitôt à jour le clavier et le manche (D-01)', async ({ ouvrirAppli }) => {
    test.fail(true, 'D-01 (bugs.md) : après un renommage dans la case, le tiroir garde l\'ancien accord jusqu\'au prochain changement de sélection');
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 3);
    await expect(nomAccord(page)).toHaveText('G7');
    const sig = await signature(page);
    await renommer(page, 0, 3, 'Bm7');
    await expect(nomAccord(page)).toHaveText('Bm7');
    await expect(notesAccord(page)).toHaveText([/^B$/, /^D$/, /^F[#♯]$/, /^A$/]);
    expect(await signature(page)).not.toBe(sig);
  });

  test('le crayon ouvre l\'édition manuelle sur le même doigté ; fermer la fenêtre ne le change pas', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 1);
    await suivant(page).click();
    const sig = await signature(page);
    const e = await ouvrirEditeur(page);
    await expect(e).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(e).toBeHidden();
    expect(await signature(page)).toBe(sig);
    await expect(compteur(page)).toHaveText('2/4');
  });
});
