// MODULE « fichiers » — nouveau morceau, enregistrer, « modifications non enregistrées ». Mêmes gestes à l'ordinateur et au téléphone
// (le nom du morceau en haut ouvre son menu ; « Enregistrer » est la disquette). Le morceau de départ est posé dans le stockage local.
import { test, expect } from '../support/fixtures';
import {
  C_AM_F_G, bibliotheque, morceauxStockes, morceauCourantId, titre, etat, toast, boutonEnregistrer, champNomMorceau, menuMorceau,
  ouvrirMenuMorceau, choisirDansMenuMorceau, enregistrerSous, modifierLeMorceau, alerteNonEnregistre, fenetreNouveau, creerMorceau, noms,
  telecharger, jsonDe,
} from './aide-fichiers';

test.describe('Nouveau morceau et enregistrement @fichiers', () => {
  test('un morceau neuf s\'appelle « Nouveau morceau » et n\'est dans aucune liste tant qu\'il n\'est pas enregistré @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli();
    await expect(titre(page)).toHaveText('Nouveau morceau');
    await expect(etat(page)).toContainText('Nouveau morceau');
    expect(await morceauxStockes(page)).toEqual([]);
    expect(await morceauCourantId(page)).toBeNull();
    expect(garde.bloquees).toEqual([]);
  });

  test('« Enregistrer » demande un nom, puis garde le morceau (nom, accords, statut « Enregistré ») @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G, reglages: { harmohubSongs: '[]', harmohubCurrentSongId: '' } });
    await boutonEnregistrer(page).click();
    await expect(champNomMorceau(page)).toBeVisible();
    await expect(champNomMorceau(page)).toBeFocused();
    await champNomMorceau(page).fill('Ballade en do');
    await champNomMorceau(page).press('Enter');
    await expect(titre(page)).toHaveText('Ballade en do');
    await expect(etat(page)).toContainText(/Enregistré à \d{1,2}:\d{2}/);
    await expect(toast(page)).toContainText('« Ballade en do » enregistré');
    const [m, ...autres] = await morceauxStockes(page);
    expect(autres).toEqual([]);
    expect(m.name).toBe('Ballade en do');
    expect(m.accords).toEqual(['C', 'Amin', 'F', 'G']);
    expect(await morceauCourantId(page)).toBe(m.id);
  });

  test('Échap pendant la saisie du nom l\'abandonne : rien n\'est enregistré', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G, reglages: { harmohubSongs: '[]', harmohubCurrentSongId: '' } });
    await boutonEnregistrer(page).click();
    await champNomMorceau(page).fill('Brouillon');
    await champNomMorceau(page).press('Escape');
    await expect(champNomMorceau(page)).toBeHidden();
    await expect(titre(page)).toHaveText('Nouveau morceau');
    expect(await morceauxStockes(page)).toEqual([]);
  });

  test('toute modification affiche « Non enregistré » ; « Enregistrer » le rétablit sans redemander le nom @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });   // « Démo » est déjà dans la bibliothèque
    await expect(titre(page)).toHaveText('Démo');
    await expect(etat(page)).toContainText(/Enregistré|Nouveau|Non/);   // l'état d'ouverture dépend du chargement ; on n'en dépend pas
    await modifierLeMorceau(page, 'Refrain');
    await boutonEnregistrer(page).click();
    await expect(champNomMorceau(page)).toBeHidden();   // le morceau a déjà un nom
    await expect(etat(page)).toContainText(/Enregistré à \d{1,2}:\d{2}/);
    await expect(toast(page)).toContainText('Morceau enregistré');   // (un premier enregistrement dit « « Nom » enregistré »)
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('harmohubSongs')!)[0].sections[0].title)).toBe('Refrain');
  });

  test('un morceau enregistré est retrouvé tel quel après un rechargement @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G, reglages: { harmohubSongs: '[]', harmohubCurrentSongId: '' } });
    await enregistrerSous(page, 'Survivant');
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await expect(titre(page)).toHaveText('Survivant');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('Ctrl+S enregistre (et demande le nom d\'un morceau neuf) @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G, reglages: { harmohubSongs: '[]', harmohubCurrentSongId: '' } });
    await page.keyboard.press('Control+s');
    await expect(champNomMorceau(page)).toBeVisible();
    await champNomMorceau(page).fill('Au clavier');
    await champNomMorceau(page).press('Enter');
    await expect(titre(page)).toHaveText('Au clavier');
    await modifierLeMorceau(page, 'Pont');
    await page.keyboard.press('Control+s');
    await expect(etat(page)).toContainText('Enregistré');
    expect((await morceauxStockes(page)).map(m => m.name)).toEqual(['Au clavier']);
  });

  test('« Nouveau morceau » (menu du nom) ouvre une fenêtre « Titre du morceau / Dossier », « Créer » le crée vide et l\'ouvre @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await choisirDansMenuMorceau(page, 'Nouveau morceau');
    const f = fenetreNouveau(page);
    await expect(f).toBeVisible();
    await expect(f.getByRole('textbox', { name: 'Titre du morceau' })).toBeFocused();
    await expect(f.getByRole('combobox', { name: 'Dossier' })).toHaveValue('');
    await f.getByRole('textbox', { name: 'Titre du morceau' }).fill('Autre chanson');
    await f.getByRole('button', { name: 'Créer' }).click();
    await expect(f).toBeHidden();
    await expect(titre(page)).toHaveText('Autre chanson');
    expect(await noms(page)).toEqual([]);
    await expect(toast(page)).toContainText('« Autre chanson » créé');
    expect((await morceauxStockes(page)).map(m => m.name)).toEqual(['Démo', 'Autre chanson']);
  });

  test('« Annuler » dans la fenêtre « Nouveau morceau » ne crée rien', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await choisirDansMenuMorceau(page, 'Nouveau morceau');
    await fenetreNouveau(page).getByRole('button', { name: 'Annuler' }).click();
    await expect(fenetreNouveau(page)).toBeHidden();
    await expect(titre(page)).toHaveText('Démo');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
    expect((await morceauxStockes(page)).map(m => m.name)).toEqual(['Démo']);
  });

  test('un nouveau morceau sans titre s\'appelle « Sans titre » (valeur proposée) ou garde le nom tapé', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await choisirDansMenuMorceau(page, 'Nouveau morceau');
    await expect(fenetreNouveau(page).getByRole('textbox', { name: 'Titre du morceau' })).toHaveAttribute('placeholder', 'Sans titre');
    await fenetreNouveau(page).getByRole('button', { name: 'Créer' }).click();
    await expect(fenetreNouveau(page)).toBeHidden();
    const noms_ = (await morceauxStockes(page)).map(m => m.name);
    expect(noms_.length).toBe(2);
    expect(noms_[1]).toMatch(/\S/);   // un titre non vide a été attribué
  });
});

test.describe('Modifications non enregistrées @fichiers', () => {
  async function ouvrirAvecModification(ouvrirAppli: (o?: any) => Promise<import('@playwright/test').Page>) {
    const page = await ouvrirAppli({ reglages: bibliotheque([
      { id: 'a', nom: 'Alpha', accords: [{ root: 'C', quality: '' }, { root: 'G', quality: '' }] },
      { id: 'b', nom: 'Bravo', accords: [{ root: 'D', quality: 'min' }, { root: 'A', quality: '' }] },
    ], 'a') });
    await expect(titre(page)).toHaveText('Alpha');
    await modifierLeMorceau(page, 'Refrain');
    return page;
  }
  const titrePartieStocke = (page: import('@playwright/test').Page, id: string) =>
    page.evaluate((i) => JSON.parse(localStorage.getItem('harmohubSongs')!).find((s: any) => s.id === i).sections[0].title, id);

  test('ouvrir un autre morceau avec des modifications propose quatre choix ; « Annuler » ne change rien @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecModification(ouvrirAppli);
    await ouvrirMenuMorceau(page);
    await menuMorceau(page).getByRole('menuitemradio', { name: /Bravo/ }).click();
    const a = alerteNonEnregistre(page);
    await expect(a).toBeVisible();
    await expect(a).toContainText('Des modifications ne sont pas enregistrées et seront perdues si tu continues.');
    for (const nom of ['Enregistrer et continuer', 'Exporter en JSON et continuer', 'Continuer sans enregistrer', 'Annuler'])
      await expect(a.getByRole('button', { name: nom })).toBeVisible();
    await a.getByRole('button', { name: 'Annuler' }).click();
    await expect(a).toBeHidden();
    await expect(titre(page)).toHaveText('Alpha');
    await expect(etat(page)).toContainText('Non enregistré');
    expect(await titrePartieStocke(page, 'a')).toBe('Couplet');
  });

  test('« Enregistrer et continuer » garde les modifications, puis ouvre l\'autre morceau @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecModification(ouvrirAppli);
    await ouvrirMenuMorceau(page);
    await menuMorceau(page).getByRole('menuitemradio', { name: /Bravo/ }).click();
    await alerteNonEnregistre(page).getByRole('button', { name: 'Enregistrer et continuer' }).click();
    await expect(alerteNonEnregistre(page)).toBeHidden();
    await expect(titre(page)).toHaveText('Bravo');
    expect(await noms(page)).toEqual(['Dm', 'A']);
    expect(await titrePartieStocke(page, 'a')).toBe('Refrain');
  });

  test('« Continuer sans enregistrer » ouvre l\'autre morceau et perd les modifications @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecModification(ouvrirAppli);
    await ouvrirMenuMorceau(page);
    await menuMorceau(page).getByRole('menuitemradio', { name: /Bravo/ }).click();
    await alerteNonEnregistre(page).getByRole('button', { name: 'Continuer sans enregistrer' }).click();
    await expect(titre(page)).toHaveText('Bravo');
    expect(await noms(page)).toEqual(['Dm', 'A']);
    expect(await titrePartieStocke(page, 'a')).toBe('Couplet');
  });

  test('« Exporter en JSON et continuer » télécharge le morceau MODIFIÉ (celui de l\'écran), puis continue @critique', async ({ ouvrirAppli }) => {
    test.fail(true, 'F-01 (bugs.md) : le fichier téléchargé contient la dernière version ENREGISTRÉE, pas les modifications de l\'écran');
    const page = await ouvrirAvecModification(ouvrirAppli);
    await ouvrirMenuMorceau(page);
    await menuMorceau(page).getByRole('menuitemradio', { name: /Bravo/ }).click();
    const t = await telecharger(page, () => alerteNonEnregistre(page).getByRole('button', { name: 'Exporter en JSON et continuer' }).click());
    expect(t.nom).toMatch(/^HarmoHub - Alpha - .*\.json$/);
    expect(jsonDe(t).songs[0].sections[0].title).toBe('Refrain');
    await expect(titre(page)).toHaveText('Bravo');
  });

  test('« Nouveau morceau » avec des modifications demande aussi, puis « Continuer sans enregistrer » ouvre la fenêtre de création @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecModification(ouvrirAppli);
    await choisirDansMenuMorceau(page, 'Nouveau morceau');
    await expect(alerteNonEnregistre(page)).toBeVisible();
    await expect(fenetreNouveau(page)).toBeHidden();
    await alerteNonEnregistre(page).getByRole('button', { name: 'Continuer sans enregistrer' }).click();
    await expect(fenetreNouveau(page)).toBeVisible();
    await fenetreNouveau(page).getByRole('textbox', { name: 'Titre du morceau' }).fill('Charlie');
    await fenetreNouveau(page).getByRole('button', { name: 'Créer' }).click();
    await expect(titre(page)).toHaveText('Charlie');
    expect(await titrePartieStocke(page, 'a')).toBe('Couplet');
  });

  test('« Nouveau morceau » sans modification ne demande rien', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await choisirDansMenuMorceau(page, 'Nouveau morceau');
    await expect(fenetreNouveau(page)).toBeVisible();
    await expect(alerteNonEnregistre(page)).toBeHidden();
  });

  test('on peut changer de morceau sans question quand tout est enregistré', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: bibliotheque([
      { id: 'a', nom: 'Alpha', accords: [{ root: 'C', quality: '' }] },
      { id: 'b', nom: 'Bravo', accords: [{ root: 'D', quality: 'min' }] },
    ], 'a') });
    await ouvrirMenuMorceau(page);
    await menuMorceau(page).getByRole('menuitemradio', { name: /Bravo/ }).click();
    await expect(titre(page)).toHaveText('Bravo');
    await expect(alerteNonEnregistre(page)).toBeHidden();
    expect(await noms(page)).toEqual(['Dm']);
  });
});

test.describe('Menu du morceau @fichiers', () => {
  test('le menu liste les morceaux (le courant coché) puis les actions du morceau @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: bibliotheque([
      { id: 'a', nom: 'Alpha', accords: [{ root: 'C', quality: '' }] },
      { id: 'b', nom: 'Bravo', accords: [{ root: 'D', quality: 'min' }] },
    ], 'a') });
    const menu = await ouvrirMenuMorceau(page);
    await expect(menu.getByRole('menuitemradio', { name: /Alpha/ })).toBeChecked();
    await expect(menu.getByRole('menuitemradio', { name: /Bravo/ })).not.toBeChecked();
    for (const e of ['Mes morceaux…', 'Nouveau morceau', 'Renommer', 'Dupliquer', 'Importer…', 'Exporter…', 'Historique du morceau…'])
      await expect(menu.getByRole('menuitem', { name: e })).toBeVisible();
    // « Rangement sur le disque… » n'existe que là où le navigateur sait ranger dans un dossier (Chromium, Edge) ; ailleurs l'entrée est absente
    const peutRanger = await page.evaluate(() => typeof (window as any).showDirectoryPicker === 'function');
    await expect(menu.getByRole('menuitem', { name: 'Rangement sur le disque…' })).toHaveCount(peutRanger ? 1 : 0);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test('un clic à côté referme le menu', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const menu = await ouvrirMenuMorceau(page);
    const v = page.viewportSize()!;
    await page.mouse.click(v.width - 10, Math.round(v.height / 2));
    await expect(menu).toBeHidden();
  });

  test('le menu du morceau tient dans l\'écran, à l\'ordinateur comme au téléphone', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const menu = await ouvrirMenuMorceau(page);
    const b = (await menu.boundingBox())!, v = page.viewportSize()!;
    expect(b.x).toBeGreaterThanOrEqual(-1);
    expect(b.x + b.width).toBeLessThanOrEqual(v.width + 1);
    expect(b.y + b.height).toBeLessThanOrEqual(v.height + 1);
  });
});
