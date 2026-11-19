// MODULE « robustesse » — LE RECHARGEMENT EN COURS D'ÉDITION (F5, fermeture accidentelle de l'onglet, plantage du navigateur) : le travail en cours doit
// survivre, ce que l'écran dit de son état doit rester vrai, et l'appli ne doit garder aucun état à moitié (lecture, fenêtre ouverte).
import { test, expect } from '../support/fixtures';
import {
  C_AM_F_G, cases, noms, collecterErreurs, ajouterAccords, titre, etat, boutonEnregistrer, bibliotheque, morceauxStockes, morceauCourantId, modifierLeMorceau,
  enregistrerSous, ouvrirMesMorceaux, fenetreMorceaux, ligne, estMobile,
} from './aide-robustesse';
import type { Page } from '@playwright/test';

const lecture = (page: Page) => page.getByRole('button', { name: 'Lecture', exact: true });
const stop = (page: Page) => page.getByRole('button', { name: 'Stop', exact: true });

// Recharge comme l'utilisateur (F5) en notant les avertissements de fermeture que le navigateur affiche (« Quitter cette page ? »), qu'on accepte.
async function recharger(page: Page): Promise<string[]> {
  const vus: string[] = [];
  const ecoute = (d: import('@playwright/test').Dialog) => { vus.push(d.type()); void d.accept(); };
  page.on('dialog', ecoute);
  await page.reload();
  await page.waitForFunction(() => !!(window as any).app);
  page.off('dialog', ecoute);
  return vus;
}
const partie1 = (page: Page) => page.locator('#progression-sections .prog-title').first();

test.describe('Rechargement en cours d\'édition @robustesse', () => {
  test('un morceau neuf, jamais enregistré : ses accords survivent au rechargement, et le navigateur prévient avant de quitter @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli();
    await ajouterAccords(page, ['C', 'Am', 'F']);
    await expect(cases(page)).toHaveCount(3);
    const avertissements = await recharger(page);
    expect(avertissements, 'le navigateur demande confirmation avant de quitter une page non enregistrée').toContain('beforeunload');
    await expect(cases(page)).toHaveCount(3);
    expect(await noms(page)).toEqual(['C', 'Am', 'F']);
    await expect(titre(page)).toHaveText('Nouveau morceau');
    expect(await morceauxStockes(page), 'rien n\'a été enregistré à la place de l\'utilisateur').toEqual([]);
  });

  test('un morceau enregistré puis modifié : la modification survit au rechargement SANS toucher la version enregistrée @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: bibliotheque([{ id: 'a', nom: 'Alpha', accords: C_AM_F_G }], 'a') });
    await modifierLeMorceau(page, 'Refrain');
    await recharger(page);
    await expect(titre(page)).toHaveText('Alpha');
    await expect(partie1(page)).toHaveValue('Refrain');   // le travail en cours est retrouvé
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
    const enregistre = await page.evaluate(() => JSON.parse(localStorage.getItem('harmohubSongs')!)[0].sections[0].title);
    expect(enregistre, 'la version enregistrée n\'a pas bougé').toBe('Couplet');
  });

  test('Z-06 : après le rechargement, un morceau modifié mais pas enregistré est toujours annoncé « Non enregistré »', async ({ ouvrirAppli }) => {
    test.fail(true, 'Z-06 (bugs.md) : après un rechargement, la barre du haut dit « Enregistré à hh:mm » alors que la grille porte une modification non enregistrée ; fermer ou changer de morceau sans avertissement la perd');
    const page = await ouvrirAppli({ reglages: bibliotheque([{ id: 'a', nom: 'Alpha', accords: C_AM_F_G }], 'a') });
    await modifierLeMorceau(page, 'Refrain');
    await recharger(page);
    await expect(partie1(page)).toHaveValue('Refrain');
    await expect(etat(page)).toContainText('Non enregistré');
  });

  test('« Enregistrer » puis rechargement immédiat : le morceau est enregistré et le navigateur ne prévient plus @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: bibliotheque([{ id: 'a', nom: 'Alpha', accords: C_AM_F_G }], 'a') });
    await modifierLeMorceau(page, 'Refrain');
    await boutonEnregistrer(page).click();
    const avertissements = await recharger(page);
    expect(avertissements).toEqual([]);
    await expect(partie1(page)).toHaveValue('Refrain');
    await expect(etat(page)).toContainText('Enregistré');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('harmohubSongs')!)[0].sections[0].title)).toBe('Refrain');
  });

  test('un morceau ouvert tel quel, jamais touché : le rechargement ne prévient pas et ne change rien', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: bibliotheque([{ id: 'a', nom: 'Alpha', accords: C_AM_F_G }], 'a') });
    const avertissements = await recharger(page);
    expect(avertissements).toEqual([]);
    await expect(titre(page)).toHaveText('Alpha');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('un accord ajouté puis un rechargement SANS attendre : l\'accord est déjà gardé', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ajouterAccords(page, ['E']);
    await page.reload().catch(() => undefined);   // aucune attente entre la validation et F5
    await page.waitForFunction(() => !!(window as any).app);
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G', 'E']);
  });

  test('le morceau ouvert reste le morceau ouvert : on rouvre le 2ᵉ de la liste après rechargement @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: bibliotheque([{ id: 'a', nom: 'Alpha', accords: C_AM_F_G }, { id: 'b', nom: 'Bravo', accords: [{ root: 'D', quality: 'min' }, { root: 'G', quality: 'dom7' }] }], 'a') });
    await ouvrirMesMorceaux(page);
    await ligne(page, 'Bravo').getByRole('button', { name: 'Ouvrir' }).click();
    await expect(titre(page)).toHaveText('Bravo');
    await recharger(page);
    await expect(titre(page)).toHaveText('Bravo');
    expect(await morceauCourantId(page)).toBe('b');
    expect(await noms(page)).toEqual(['Dm', 'G7']);
  });

  test('l\'annulation est conservée dans le travail : « Annuler » puis rechargement garde la grille annulée @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ajouterAccords(page, ['E', 'D']);
    await expect(cases(page)).toHaveCount(6);
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await expect(cases(page)).toHaveCount(5);
    await recharger(page);
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G', 'E']);
  });

  test('cinq rechargements de suite ne changent rien : ni accords en double, ni état qui dérive', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: bibliotheque([{ id: 'a', nom: 'Alpha', accords: C_AM_F_G }], 'a') });
    await modifierLeMorceau(page, 'Refrain');
    await ajouterAccords(page, ['E']);
    const avant = await noms(page);
    for (let i = 0; i < 5; i++) await recharger(page);
    expect(await noms(page)).toEqual(avant);
    await expect(partie1(page)).toHaveValue('Refrain');
    expect(await morceauxStockes(page)).toHaveLength(1);
  });

  test('rechargement PENDANT la lecture : la lecture ne reprend pas toute seule, aucune case n\'est allumée, et elle repart du début @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const erreurs = collecterErreurs(page);
    await lecture(page).click();
    await expect.poll(() => page.evaluate(() => (window as any).app.isPlaying)).toBe(true);
    await recharger(page);
    await expect.poll(() => page.evaluate(() => (window as any).app.isPlaying)).toBe(false);
    await expect(page.locator('#progression-sections .grid-cell.playing')).toHaveCount(0);
    await lecture(page).click();
    await expect.poll(() => page.evaluate(() => (window as any).app.isPlaying)).toBe(true);
    const allumee = page.locator('#progression-sections .grid-cell.playing').first();
    await expect(allumee).toBeVisible();
    await expect(allumee).toHaveAttribute('data-index', '0');   // la lecture part du premier accord (un accord dure 2 s à 120 BPM : la 1ʳᵉ case est allumée assez longtemps)
    await stop(page).click();
    expect(erreurs).toEqual([]);
  });

  test('rechargement avec la fenêtre « Mes morceaux » ouverte : elle est fermée, et l\'appli répond @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: bibliotheque([{ id: 'a', nom: 'Alpha', accords: C_AM_F_G }], 'a') });
    await ouvrirMesMorceaux(page);
    await recharger(page);
    await expect(fenetreMorceaux(page)).toBeHidden();
    await expect(titre(page)).toHaveText('Alpha');
    await ajouterAccords(page, ['E']);
    await expect(cases(page)).toHaveCount(5);
  });

  test('rechargement avec la fenêtre « Paramètres » ouverte : elle est fermée, les réglages posés sont gardés @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await page.locator('#open-settings').click();
    const fenetre = page.getByRole('dialog', { name: 'Paramètres' });
    await fenetre.getByRole('switch', { name: 'Verre dépoli' }).click();
    await expect(fenetre.getByRole('switch', { name: 'Verre dépoli' })).toHaveAttribute('aria-checked', 'true');
    await recharger(page);
    await expect(fenetre).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-glass'))).toBe('1');
  });

  test('un rechargement pendant la saisie d\'un accord ne touche pas à la grille : le texte tapé est perdu (Firefox : il est validé en quittant la page)', async ({ ouvrirAppli, browserName }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    if (estMobile(page)) {
      await page.locator('.prog-section-ajout').first().click();
      await page.locator('#quick-add-input').fill('Em7');
    } else {
      await page.getByRole('textbox', { name: 'Ajouter un accord à la fin de cette partie' }).first().fill('Em7');
    }
    await recharger(page);
    // Firefox valide le champ en le quittant (blur au déchargement) : le texte tapé devient un accord. Les autres moteurs le perdent. Dans les deux cas, la grille d'origine est intacte.
    expect(await noms(page)).toEqual(browserName === 'firefox' && !estMobile(page) ? ['C', 'Am', 'F', 'G', 'Em7'] : ['C', 'Am', 'F', 'G']);
    await expect(titre(page)).toHaveText('Démo');
  });

  test('un morceau neuf nommé puis enregistré, rechargé : il est dans la liste et rouvert @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli();
    await ajouterAccords(page, ['Dm7', 'G7']);
    await enregistrerSous(page, 'Nouveau');
    const avertissements = await recharger(page);
    expect(avertissements).toEqual([]);
    await expect(titre(page)).toHaveText('Nouveau');
    expect(await noms(page)).toEqual(['Dm7', 'G7']);
  });
});
