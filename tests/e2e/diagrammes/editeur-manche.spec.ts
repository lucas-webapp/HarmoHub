// MODULE « diagrammes » — l'ÉDITION MANUELLE du manche (crayon sous le manche) : une fenêtre qui montre le manche COMPLET (24 cases) avec deux onglets :
// « Dessiner sur le manche » (un clic pose une note, l'appli reconnaît l'accord et propose de l'ajouter à la grille ou de l'utiliser comme substitut guitare)
// et « Taper le nom » (écrire « Cm7 » : la guitare joue cet accord quel que soit celui du morceau).
import { test, expect } from '../support/fixtures';
import {
  morceauDeux, caseN, noms, selectionner, boutonGuitare, guitare, compteur, cadenas, suivant, pastilleCase, nomAccord, signature, doigteDuManche,
  editeur, ongletDessin, ongletNom, manche, jouer, valider, resultat, champNom, validerNom, fermerEditeur, ouvrirEditeur, poserNote, poserDoigte, rondsDuManche,
  candidats, substitut, retirerSubstitut, envoyer, substituer,
} from './aide-diagrammes';
import type { Page } from '@playwright/test';

const uniques = async (page: Page) => [...new Set(await rondsDuManche(page))];
const annuler = (page: Page) => page.getByRole('button', { name: 'Annuler' }).first();
const toast = (page: Page, texte: string | RegExp) => page.getByText(texte).first();

// « Do ouvert » : x 3 2 0 1 0 ; « La mineur ouvert » : x 0 2 2 1 0 (cordes 6 → 1 ; null = étouffée, 0 = à vide)
const DO_OUVERT = [null, 3, 2, 0, 1, 0];
const LAM_OUVERT = [null, 0, 2, 2, 1, 0];

async function ouvrirSurLeDessin(page: Page) {
  await boutonGuitare(page).click();   // la guitare d'abord (voir D-02) : l'accord est choisi ensuite
  await selectionner(page, 0, 1);
  await ouvrirEditeur(page);
  await ongletDessin(page).click();
  await expect(ongletDessin(page)).toHaveAttribute('aria-selected', 'true');
}

test.describe('Édition manuelle du manche @diagrammes @ordinateur', () => {
  test('le crayon ouvre une fenêtre « Édition manuelle — Guitare » : le manche complet (24 cases), deux onglets, le doigté courant dessiné @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();   // la guitare d'abord (voir D-02) : l'accord est choisi ensuite
    await selectionner(page, 0, 1);
    await expect(editeur(page)).toBeHidden();
    const sig = await signature(page);
    await ouvrirEditeur(page);
    await expect(editeur(page).getByRole('heading', { name: 'Édition manuelle — Guitare' })).toBeVisible();
    await expect(editeur(page).getByRole('tab')).toHaveCount(2);
    await expect(editeur(page).locator('[role=tab][aria-selected=true]')).toHaveCount(1);
    // le manche est complet : 24 cases = 24 frettes + le repère 24
    expect(await manche(page).locator('svg line').evaluateAll(ls => ls.filter(l => l.getAttribute('x1') === l.getAttribute('x2')).length)).toBe(24);
    await expect(manche(page).locator('svg text', { hasText: /^24$/ })).toHaveCount(1);
    // il montre le même doigté que le petit diagramme : une note par rond posé
    const petit = (await doigteDuManche(page)).notes.length;
    expect((await uniques(page)).length).toBe(petit);
    expect(await signature(page)).toBe(sig);
  });

  test('« Fermer », Échap et un clic hors de la fenêtre la referment sans rien changer au morceau', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();   // la guitare d'abord (voir D-02) : l'accord est choisi ensuite
    await selectionner(page, 0, 1);
    const sig = await signature(page);
    await ouvrirEditeur(page);
    await fermerEditeur(page).click();
    await expect(editeur(page)).toBeHidden();
    await ouvrirEditeur(page);
    await page.keyboard.press('Escape');
    await expect(editeur(page)).toBeHidden();
    await ouvrirEditeur(page);
    await page.mouse.click(5, 5);
    await expect(editeur(page)).toBeHidden();
    expect(await signature(page)).toBe(sig);
    expect(await noms(page)).toEqual(['Cmaj7', 'Am7', 'Dm7', 'G7', 'Fmaj7', 'Em7']);
    await expect(annuler(page)).toBeDisabled();
  });

  test('les flèches et le compteur de la fenêtre commandent le même doigté que ceux du petit diagramme', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();   // la guitare d'abord (voir D-02) : l'accord est choisi ensuite
    await selectionner(page, 0, 1);
    await ouvrirEditeur(page);
    const compteurFenetre = page.locator('#guitar-edit-nav-label');
    await expect(compteurFenetre).toHaveText('1/4');
    const avant = await uniques(page);
    await page.locator('#guitar-edit-next').click();
    await expect(compteurFenetre).toHaveText('2/4');
    await expect(compteur(page)).toHaveText('2/4');
    expect(await uniques(page)).not.toEqual(avant);
    await page.locator('#guitar-edit-prev').click();
    await expect(compteurFenetre).toHaveText('1/4');
    expect(await uniques(page)).toEqual(avant);
  });

  test('le cadenas de la fenêtre fixe le doigté comme celui du petit diagramme', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();   // la guitare d'abord (voir D-02) : l'accord est choisi ensuite
    await selectionner(page, 0, 1);
    await ouvrirEditeur(page);
    await expect(page.locator('#guitar-edit-lock')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#guitar-edit-lock').click();
    await expect(page.locator('#guitar-edit-lock')).toHaveAttribute('aria-pressed', 'true');
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(pastilleCase(page, 0, 1)).toHaveCount(1);
    await expect(page.locator('#guitar-edit-next')).toBeDisabled();
  });

  test('« Dessiner » : tout est étouffé au départ, un clic pose une note, un second clic la retire, « Jouer » et « Valider » ne s\'activent qu\'avec des notes', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await ouvrirSurLeDessin(page);
    await expect(manche(page).locator('svg text', { hasText: /^X$/ })).toHaveCount(6);   // six cordes étouffées
    expect(await uniques(page)).toEqual([]);
    await expect(jouer(page)).toBeDisabled();
    await expect(valider(page)).toBeDisabled();
    await poserNote(page, 5, 2);                                                          // corde de la, case 2
    expect(await uniques(page)).toHaveLength(1);
    await expect(manche(page).locator('svg text', { hasText: /^X$/ })).toHaveCount(5);   // cette corde n'est plus étouffée
    await expect(jouer(page)).toBeEnabled();
    await expect(valider(page)).toBeEnabled();
    await poserNote(page, 5, 2);                                                          // reclique : retirée
    expect(await uniques(page)).toEqual([]);
    await expect(manche(page).locator('svg text', { hasText: /^X$/ })).toHaveCount(6);
    await expect(valider(page)).toBeDisabled();
  });

  test('« Dessiner » : une corde n\'a qu\'une note à la fois (une autre case de la même corde remplace la première) ; la corde à vide se pose à gauche du sillet', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await ouvrirSurLeDessin(page);
    await poserNote(page, 4, 2);
    const premiere = await uniques(page);
    await poserNote(page, 4, 5);
    const apres = await uniques(page);
    expect(apres).toHaveLength(1);
    expect(apres).not.toEqual(premiere);
    await poserNote(page, 4, 0);                                                          // à vide
    const vide = await uniques(page);
    expect(vide).toHaveLength(1);
    expect(Number(vide[0].split(',')[0])).toBeLessThan(20);                               // à gauche du sillet (x = 20 dans le dessin)
    await poserNote(page, 6, 3);
    expect(await uniques(page)).toHaveLength(2);
  });

  test('« Dessiner » : un clic droit pose une note fantôme (sans hauteur), qu\'on peut écouter mais pas faire reconnaître', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await ouvrirSurLeDessin(page);
    const avant = await manche(page).locator('svg text').count();
    await poserNote(page, 5, 2, { button: 'right' });
    await expect.poll(() => manche(page).locator('svg text').count()).toBe(avant + 1);
    expect(await uniques(page)).toEqual([]);                    // pas un rond : aucune hauteur
    await expect(jouer(page)).toBeEnabled();
    await expect(valider(page)).toBeDisabled();
    await poserNote(page, 5, 2, { button: 'right' });
    await expect.poll(() => manche(page).locator('svg text').count()).toBe(avant);
  });

  test('« Valider » reconnaît l\'accord dessiné et le propose en premier : Do ouvert → C ; La mineur ouvert → Am @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await ouvrirSurLeDessin(page);
    await expect(resultat(page)).toBeHidden();
    await poserDoigte(page, DO_OUVERT);
    await valider(page).click();
    await expect(resultat(page)).toContainText('Accord reconnu');
    await expect(candidats(page).first()).toHaveText('C');
    await expect(candidats(page).first()).toHaveClass(/active/);
    await expect(envoyer(page)).toContainText('Ajouter C à la grille');
    // on efface et on dessine un autre accord
    for (let corde = 1; corde <= 5; corde++) { /* rien : on rouvre une fenêtre propre */ }
    await fermerEditeur(page).click();
    await ouvrirEditeur(page);
    await ongletDessin(page).click();
    await poserNote(page, 5, 0); await poserNote(page, 4, 2); await poserNote(page, 3, 2); await poserNote(page, 2, 1); await poserNote(page, 1, 0);
    await valider(page).click();
    await expect(candidats(page).first()).toHaveText('Am');
  });

  test('le dessin n\'est pas reconnu quand il ne forme pas un accord : aucun nom, aucun bouton d\'envoi', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await ouvrirSurLeDessin(page);
    await poserNote(page, 6, 3);                                // une seule note
    await valider(page).click();
    await expect(candidats(page)).toHaveCount(0);
    await expect(envoyer(page)).toBeHidden();
    await expect(substituer(page)).toBeHidden();
  });

  test('choisir un autre nom parmi ceux proposés change les boutons « Ajouter … à la grille » @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await ouvrirSurLeDessin(page);
    await poserDoigte(page, DO_OUVERT);
    await valider(page).click();
    const n = await candidats(page).count();
    expect(n).toBeGreaterThanOrEqual(2);
    const deuxieme = ((await candidats(page).nth(1).textContent()) || '').trim();
    await candidats(page).nth(1).click();
    await expect(candidats(page).nth(1)).toHaveClass(/active/);
    await expect(candidats(page).first()).not.toHaveClass(/active/);
    await expect(envoyer(page)).toContainText(`Ajouter ${deuxieme} à la grille`);
  });

  test('« Ajouter … à la grille » range l\'accord reconnu à la fin de la partie, ferme la fenêtre, et s\'annule en une étape @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await ouvrirSurLeDessin(page);
    await poserDoigte(page, DO_OUVERT);
    await valider(page).click();
    await envoyer(page).click();
    await expect(editeur(page)).toBeHidden();
    await expect(toast(page, 'C ajouté à la grille')).toBeVisible();
    expect(await noms(page, 0)).toEqual(['Cmaj7', 'Am7', 'Dm7', 'G7', 'C']);
    expect(await noms(page, 1)).toEqual(['Fmaj7', 'Em7']);
    await annuler(page).click();
    expect(await noms(page, 0)).toEqual(['Cmaj7', 'Am7', 'Dm7', 'G7']);
  });

  test('« Utiliser comme substitut guitare » : la guitare joue l\'accord dessiné, le clavier garde celui du morceau, la case est marquée @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await ouvrirSurLeDessin(page);
    await poserDoigte(page, LAM_OUVERT);
    await valider(page).click();
    // Am7 est choisi dans la grille ; on dessine « Am » : c'est un autre accord, donc un substitut
    await expect(candidats(page).first()).toHaveText('Am');
    await substituer(page).click();
    await expect(editeur(page)).toBeHidden();
    await expect(toast(page, 'Substitut guitare verrouillé sur ce doigté')).toBeVisible();
    await expect(substitut(page)).toBeVisible();
    await expect(substitut(page)).toContainText('Am');
    await expect(substitut(page)).toContainText('A');
    await expect(nomAccord(page)).toHaveText('Am7');            // le clavier et la grille n'ont pas changé
    expect(await noms(page, 0)).toEqual(['Cmaj7', 'Am7', 'Dm7', 'G7']);
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(suivant(page)).toBeDisabled();
    await expect(pastilleCase(page, 0, 1)).toHaveCount(1);
  });

  test('la croix de la pastille du substitut « revient à l\'accord réellement joué à la guitare » et libère le doigté', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await ouvrirSurLeDessin(page);
    const avant = await signature(page);
    await poserDoigte(page, DO_OUVERT);
    await valider(page).click();
    await substituer(page).click();
    await expect(substitut(page)).toBeVisible();
    expect(await signature(page)).not.toBe(avant);
    await expect(retirerSubstitut(page)).toHaveAccessibleName("Revenir à l'accord réellement joué à la guitare");
    await retirerSubstitut(page).click();
    await expect(substitut(page)).toBeHidden();
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(pastilleCase(page, 0, 1)).toHaveCount(0);
    await expect(suivant(page)).toBeEnabled();
    await expect(nomAccord(page)).toHaveText('Am7');
  });

  test('le substitut est enregistré avec le morceau : il revient après « Enregistrer » et un rechargement', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await ouvrirSurLeDessin(page);
    await poserDoigte(page, DO_OUVERT);
    await valider(page).click();
    await substituer(page).click();
    await expect(substitut(page)).toBeVisible();
    const sig = await signature(page);
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.locator('#tb-etat')).toContainText(/Enregistré à \d{1,2}:\d{2}/);
    await page.reload();
    await selectionner(page, 0, 1);
    await expect(substitut(page)).toBeVisible();
    await expect(substitut(page)).toContainText('C');
    expect(await signature(page)).toBe(sig);
    await expect(pastilleCase(page, 0, 1)).toHaveCount(1);
  });

  test('« Taper le nom » : « Cm7 » met la pastille « Cm7 » et son doigté sur le manche, sans changer l\'accord du morceau @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();   // la guitare d'abord (voir D-02) : l'accord est choisi ensuite
    await selectionner(page, 0, 1);
    await ouvrirEditeur(page);
    await ongletNom(page).click();
    await expect(ongletNom(page)).toHaveAttribute('aria-selected', 'true');
    await expect(champNom(page)).toBeVisible();
    await expect(champNom(page)).toHaveAttribute('placeholder', 'Ex. F#dim7');
    const avant = await signature(page);
    await champNom(page).fill('Cm7');
    await validerNom(page).click();
    await expect(substitut(page)).toContainText('Cm7');
    await expect(substitut(page)).toContainText('E');           // les notes de l'accord : C E♭ G B♭
    expect(await signature(page)).not.toBe(avant);
    await expect(nomAccord(page)).toHaveText('Am7');
    expect(await noms(page, 0)).toEqual(['Cmaj7', 'Am7', 'Dm7', 'G7']);
  });

  test('« Taper le nom » : Entrée valide aussi ; un nom inconnu est refusé avec un message ; un champ vide revient à l\'accord du morceau', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();   // la guitare d'abord (voir D-02) : l'accord est choisi ensuite
    await selectionner(page, 0, 1);
    await ouvrirEditeur(page);
    await ongletNom(page).click();
    await champNom(page).fill('zzz');
    await validerNom(page).click();
    await expect(toast(page, /Accord non reconnu/)).toBeVisible();
    await expect(substitut(page)).toBeHidden();
    await champNom(page).fill('Fmaj7');
    await champNom(page).press('Enter');
    await expect(substitut(page)).toContainText('Fmaj7');
    await champNom(page).fill('');
    await validerNom(page).click();
    await expect(substitut(page)).toBeHidden();
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'false');
  });
});
