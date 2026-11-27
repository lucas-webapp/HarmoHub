// MODULE « parametres » — les ONGLETS de la fenêtre (demande de l'utilisateur du 26/11 : « les paramètres triés par onglet, par exemple son, affichage… là, tout est à la suite ;
// sur TrainHub c'est vachement mieux fait »). Quatre catégories, une à la fois ; colonne à gauche à l'ordinateur, rangée au-dessus au téléphone ; la dernière consultée est retenue.
import { test, expect } from '../support/fixtures';
import { C_AM_F_G, estMobile, appuyer, ouvrir, fermer, fenetre, allerA, ongletReglages, interrupteur, curseur, NOM } from './aide-parametres';
import { choisirDansMenuMorceau } from '../fichiers/aide-fichiers';

const NOMS = ['Son', 'Affichage', 'Historique', 'À propos'] as const;

test.describe('Onglets des Paramètres @parametres', () => {
  test('un clic sur un onglet affiche sa catégorie et masque les autres ; l\'onglet affiché est le seul « sélectionné » @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrir(page);
    for (const nom of NOMS) {
      await allerA(page, nom);
      for (const autre of NOMS) await expect(ongletReglages(page, autre)).toHaveAttribute('aria-selected', String(autre === nom));
      await expect(fenetre(page).getByRole('tabpanel')).toHaveCount(1);                       // une seule catégorie visible à la fois
      await expect(fenetre(page).getByRole('tabpanel')).toHaveAccessibleName(nom);
    }
  });

  test('au clavier : les flèches passent d\'un onglet à l\'autre (et l\'affichent), Début et Fin vont aux extrémités ; seul l\'onglet affiché est dans l\'ordre de tabulation @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrir(page);
    await ongletReglages(page, 'Son').focus();
    await page.keyboard.press('ArrowDown');
    await expect(ongletReglages(page, 'Affichage')).toBeFocused();
    await expect(ongletReglages(page, 'Affichage')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(ongletReglages(page, 'Historique')).toBeFocused();
    await page.keyboard.press('End');
    await expect(ongletReglages(page, 'À propos')).toBeFocused();
    await page.keyboard.press('ArrowDown');                                                   // on boucle : après le dernier, le premier
    await expect(ongletReglages(page, 'Son')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(ongletReglages(page, 'À propos')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(ongletReglages(page, 'Son')).toBeFocused();
    await expect(ongletReglages(page, 'Son')).toHaveAttribute('tabindex', '0');
    for (const autre of ['Affichage', 'Historique', 'À propos'] as const) await expect(ongletReglages(page, autre)).toHaveAttribute('tabindex', '-1');
  });

  test('la dernière catégorie consultée est retenue : on ferme, on rouvre, on recharge la page, elle est toujours affichée @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrir(page);
    await expect(ongletReglages(page, 'Son')).toHaveAttribute('aria-selected', 'true');      // appareil neuf : « Son »
    await allerA(page, 'Affichage');
    await fermer(page);
    await ouvrir(page);
    await expect(ongletReglages(page, 'Affichage')).toHaveAttribute('aria-selected', 'true');
    await expect(interrupteur(page, NOM.degres)).toBeVisible();
    await fermer(page);
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await ouvrir(page);
    await expect(ongletReglages(page, 'Affichage')).toHaveAttribute('aria-selected', 'true');
  });

  test('les réglages d\'un onglet masqué sont gardés : on change un volume, on va voir ailleurs, on revient, la valeur est là', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrir(page);
    await curseur(page, 'Volume général').fill('55');
    await allerA(page, 'À propos');
    await expect(curseur(page, 'Volume général')).toBeHidden();
    await allerA(page, 'Son');
    await expect(curseur(page, 'Volume général')).toHaveValue('55');
  });

  test('« Historique du morceau… » (menu du nom) ouvre les Paramètres directement sur « Historique » @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await choisirDansMenuMorceau(page, 'Historique du morceau…');
    await expect(fenetre(page)).toBeVisible();
    await expect(ongletReglages(page, 'Historique')).toHaveAttribute('aria-selected', 'true');
    await expect(fenetre(page).getByRole('heading', { level: 3 })).toHaveText(['Historique et récupération']);
  });

  test('forme : colonne à gauche (32 px) à l\'ordinateur ; rangée au-dessus, quatre onglets de 44 px visibles et sans défilement de la page, au téléphone @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrir(page);
    const boites = [];
    for (const nom of NOMS) boites.push((await ongletReglages(page, nom).boundingBox())!);
    const contenu = (await fenetre(page).locator('.settings-content').boundingBox())!;
    const fen = (await fenetre(page).boundingBox())!;
    if (estMobile(page)) {
      for (const b of boites) {
        expect(b.height).toBeGreaterThanOrEqual(43.5);                                        // cible tactile
        expect(b.x).toBeGreaterThanOrEqual(fen.x - 1);
        expect(b.x + b.width).toBeLessThanOrEqual(fen.x + fen.width + 1);                      // les quatre tiennent dans la largeur : aucun n'est coupé
      }
      expect(boites[0].y).toBeLessThan(contenu.y);                                            // la rangée est AU-DESSUS du contenu
      expect(new Set(boites.map(b => Math.round(b.y))).size).toBe(1);                         // sur une seule ligne
    } else {
      for (const b of boites) expect(Math.round(b.height)).toBe(32);                          // la jauge des boutons
      expect(Math.max(...boites.map(b => b.x + b.width))).toBeLessThanOrEqual(contenu.x + 1); // la colonne est À GAUCHE du contenu
      for (let i = 1; i < boites.length; i++) expect(boites[i].y).toBeGreaterThan(boites[i - 1].y);   // empilés
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
});
