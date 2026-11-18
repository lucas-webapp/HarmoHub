// MODULE « diagrammes » — CONSTRUIRE UN ACCORD AU CLAVIER : un clic sur les touches pose des notes (sans rien écrire dans le morceau), l'appli reconnaît l'accord ;
// « Remplacer » met l'accord à la place de celui choisi, « Ajouter en fin de partie » le range à la suite, « Effacer » recommence.
import { test, expect } from '../support/fixtures';
import { morceauDeux, caseN, noms, selectionner, piano, touchesJouees, constructionClavier, remplacer, ajouter, effacer, nomAccord } from './aide-diagrammes';

// do = 48 (premier do du clavier affiché), fa = 53, la = 57, do = 60, mi = 64, sol = 67
const touche = (page: import('@playwright/test').Page, midi: number) => page.locator(`#piano-viz .key[data-midi="${midi}"]`);
const FA = 53, LA = 57, DO = 60, MI = 64, SOL = 67;

test.describe('Accord construit au clavier @diagrammes @ordinateur', () => {
  test('cliquer des touches allume les notes, dit « Tu joues : … » et nomme l\'accord reconnu, sans rien changer au morceau @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await selectionner(page, 0, 0);
    await expect(constructionClavier(page)).toBeHidden();
    await touche(page, FA).click();
    await expect(constructionClavier(page)).toBeVisible();
    await expect(constructionClavier(page)).toContainText('Tu joues : F');
    await expect(constructionClavier(page)).toContainText('Accord non reconnu');   // une seule note : pas un accord
    await touche(page, LA).click();
    await touche(page, DO).click();
    await expect(constructionClavier(page)).toContainText('Tu joues : F · A · C');
    await expect(constructionClavier(page)).toContainText(/^[\s\S]*\bF\s*$/m);
    await expect(touche(page, FA)).toHaveClass(/\bactive\b/);
    await expect(touche(page, LA)).toHaveClass(/\bactive\b/);
    await expect(touche(page, DO)).toHaveClass(/\bactive\b/);
    // le morceau n'a pas bougé : aucune étape d'annulation n'est apparue
    expect(await noms(page)).toEqual(['Cmaj7', 'Am7', 'Dm7', 'G7', 'Fmaj7', 'Em7']);
    await expect(page.getByRole('button', { name: 'Annuler' }).first()).toBeDisabled();
  });

  test('un clic de plus sur une touche allumée la retire ; plus aucune note : le panneau « Accord construit » disparaît', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await selectionner(page, 0, 0);
    await touche(page, FA).click();
    await expect(constructionClavier(page)).toBeVisible();
    await touche(page, FA).click();
    await expect(constructionClavier(page)).toBeHidden();
    // l'accord choisi est de nouveau montré tel qu'il est dans le morceau
    await expect(nomAccord(page)).toHaveText('Cmaj7');
    await expect(touchesJouees(page)).toHaveCount(4);
  });

  test('« Remplacer » met l\'accord construit à la place de l\'accord choisi, en UNE étape d\'annulation @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await selectionner(page, 0, 0);
    for (const m of [FA, LA, DO]) await touche(page, m).click();
    await expect(remplacer(page)).toBeEnabled();
    await expect(remplacer(page)).toHaveAccessibleName('Remplacer Cmaj7');
    await remplacer(page).click();
    expect(await noms(page, 0)).toEqual(['F', 'Am7', 'Dm7', 'G7']);
    await expect(page.getByText('Cmaj7 remplacé par F')).toBeVisible();
    await expect(constructionClavier(page)).toBeHidden();       // la construction est terminée
    await expect(nomAccord(page)).toHaveText('F');
    // une seule annulation rend l'ancien accord
    await page.getByRole('button', { name: 'Annuler' }).first().click();
    expect(await noms(page, 0)).toEqual(['Cmaj7', 'Am7', 'Dm7', 'G7']);
    await page.getByRole('button', { name: 'Rétablir' }).first().click();
    expect(await noms(page, 0)).toEqual(['F', 'Am7', 'Dm7', 'G7']);
  });

  test('« Ajouter en fin de partie » range l\'accord à la suite de la partie de l\'accord choisi, et laisse l\'accord choisi intact @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await selectionner(page, 1, 0);   // « Refrain », partie de deux accords
    for (const m of [DO, MI, SOL]) await touche(page, m).click();
    await expect(constructionClavier(page)).toContainText('Tu joues : C · E · G');
    await ajouter(page).click();
    expect(await noms(page, 1)).toEqual(['Fmaj7', 'Em7', 'C']);
    expect(await noms(page, 0)).toEqual(['Cmaj7', 'Am7', 'Dm7', 'G7']);   // l'autre partie n'a pas bougé
    await expect(page.getByText('C ajouté')).toBeVisible();
    await expect(constructionClavier(page)).toBeHidden();
    await page.getByRole('button', { name: 'Annuler' }).first().click();
    expect(await noms(page, 1)).toEqual(['Fmaj7', 'Em7']);
  });

  test('un accord non reconnu ne peut ni remplacer ni être ajouté ; « Effacer » recommence à zéro', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await selectionner(page, 0, 1);
    await touche(page, FA).click();
    await expect(constructionClavier(page)).toContainText('Accord non reconnu');
    await expect(remplacer(page)).toBeDisabled();
    await expect(ajouter(page)).toBeDisabled();
    await expect(effacer(page)).toBeEnabled();
    await touche(page, SOL).click();
    await expect(constructionClavier(page)).toContainText('Tu joues : F · G');
    await effacer(page).click();
    await expect(constructionClavier(page)).toBeHidden();
    await expect(touche(page, FA)).not.toHaveClass(/kb-note/);
    expect(await noms(page, 0)).toEqual(['Cmaj7', 'Am7', 'Dm7', 'G7']);
  });

  test('changer d\'accord dans la grille efface les notes tapées ; le clavier montre le nouvel accord', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await selectionner(page, 0, 0);
    for (const m of [FA, LA, DO]) await touche(page, m).click();
    await expect(constructionClavier(page)).toBeVisible();
    await selectionner(page, 0, 2);
    await expect(constructionClavier(page)).toBeHidden();
    await expect(nomAccord(page)).toHaveText('Dm7');
    await expect(touchesJouees(page)).toHaveCount(4);
    expect(await noms(page)).toEqual(['Cmaj7', 'Am7', 'Dm7', 'G7', 'Fmaj7', 'Em7']);
  });

  test('l\'accord construit se reconnaît aussi avec une septième : Do Mi Sol Si = Cmaj7, et remplace Am7', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await selectionner(page, 0, 1);
    for (const m of [DO, MI, SOL, 71]) await touche(page, m).click();
    await expect(constructionClavier(page)).toContainText('Tu joues : C · E · G · B');
    await expect(remplacer(page)).toHaveAccessibleName('Remplacer Am7');
    await remplacer(page).click();
    expect(await noms(page, 0)).toEqual(['Cmaj7', 'Cmaj7', 'Dm7', 'G7']);
    await expect(piano(page)).toBeVisible();
  });
});
