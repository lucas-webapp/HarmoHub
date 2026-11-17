// MODULE « lecture » — lecture et arrêt. Le son est factice : on vérifie l'état (case allumée, mesure affichée, `app.isPlaying`), pas l'audio.
// À 120 BPM une mesure dure 2 s et la lecture commence par une mesure de décompte : les tests passent la vitesse à 200 % pour rester courts.
import { test, expect } from '../support/fixtures';
import {
  C_AM_F_G, caseN, estMobile, reglagesMorceau, boutonLecture, boutonStop, enLecture, caseEnLecture, mesureAffichee, vitesseMax, lireEtAttendre,
  suivreTete, suivreSequence, selectionner, observerPassages, observerMesures, mesuresVues, maxSimultanees,
} from './aide-lecture';

test.describe('Lecture et arrêt @lecture', () => {
  test('« Lecture » lance la lecture, « Stop » l\'arrête et éteint la case en cours @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await vitesseMax(page);
    await expect(boutonLecture(page)).toBeVisible();
    await expect(boutonStop(page)).toBeVisible();
    expect(await enLecture(page)).toBe(false);
    await expect(caseEnLecture(page)).toHaveCount(0);

    await lireEtAttendre(page);
    expect(await enLecture(page)).toBe(true);
    await expect(caseEnLecture(page)).toHaveCount(1);

    await boutonStop(page).click();
    await expect.poll(() => enLecture(page)).toBe(false);
    await expect(caseEnLecture(page)).toHaveCount(0);
    expect(garde.bloquees).toEqual([]);
  });

  test('la tête de lecture parcourt les accords dans l\'ordre, une case à la fois @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await vitesseMax(page);
    await lireEtAttendre(page);
    const vus = await suivreTete(page, [0, 1, 2, 3]);
    expect(vus).toEqual([0, 1, 2, 3]);
    expect(await maxSimultanees(page)).toBe(1);   // jamais deux cases allumées en même temps
  });

  test('la mesure affichée suit la lecture, de 1 jusqu\'au total @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await vitesseMax(page);
    expect(await mesureAffichee(page)).toBe(1);
    if (!estMobile(page)) await expect(page.locator('#bl-mesure')).toHaveAccessibleName('Mesure en cours : 1 sur 4');
    await observerMesures(page);
    await lireEtAttendre(page);
    await expect.poll(async () => (await mesuresVues(page)).includes(4), { timeout: 25_000 }).toBe(true);
    expect(await mesuresVues(page)).toEqual([1, 2, 3, 4]);
    if (!estMobile(page)) await expect(page.locator('#bl-mesure')).toHaveAccessibleName('Mesure en cours : 4 sur 4');
  });

  test('sans boucle, la lecture s\'arrête d\'elle-même à la fin du morceau', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await vitesseMax(page);
    await lireEtAttendre(page);
    await expect.poll(() => enLecture(page), { timeout: 20_000 }).toBe(false);
    await expect(caseEnLecture(page)).toHaveCount(0);
  });

  test('« Stop » en cours de route : la lecture repart du début, pas de là où elle s\'était arrêtée', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await vitesseMax(page);
    await lireEtAttendre(page);
    await suivreTete(page, [0, 1]);
    await boutonStop(page).click();
    await expect.poll(() => enLecture(page)).toBe(false);
    await observerPassages(page);   // on repart d'une liste vide : la première case allumée doit être la première du morceau
    await boutonLecture(page).click();
    await expect.poll(() => enLecture(page)).toBe(true);
    expect(await suivreSequence(page, 1)).toEqual([0]);
    await boutonStop(page).click();
  });

  test('avec une case sélectionnée, la lecture démarre à cette case et non au début du morceau', async ({ ouvrirAppli, browserName }) => {
    // L-04 (bugs.md, à arbitrer) : Chromium et Edge démarrent à la case sélectionnée ; Firefox et WebKit (dont iPhone et iPad) au début du morceau.
    test.fail(browserName !== 'chromium', 'L-04 (bugs.md) : Firefox et WebKit ignorent la case sélectionnée au lancement de la lecture');
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await vitesseMax(page);
    await selectionner(page, 0, 2);   // « F »
    await expect.poll(() => enLecture(page), { timeout: 15_000 }).toBe(false);   // l'écoute de l'accord au clic est un aperçu : on attend qu'il soit fini
    await observerPassages(page);
    await boutonLecture(page).click();
    await expect.poll(() => enLecture(page)).toBe(true);
    expect(await suivreSequence(page, 2)).toEqual([2, 3]);
    await boutonStop(page).click();
  });

  test('« Lecture » pendant la lecture la relance sans la doubler', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await vitesseMax(page);
    await lireEtAttendre(page);
    await boutonLecture(page).click();
    await expect.poll(() => enLecture(page)).toBe(true);
    await expect(caseEnLecture(page)).toHaveCount(1);
    await boutonStop(page).click();
    await expect.poll(() => enLecture(page)).toBe(false);   // (la case allumée après un Stop n'est pas vérifiée ici : voir L-05 ; le premier test de ce fichier le fait)
  });

  test('la touche Espace lance et arrête la lecture @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await vitesseMax(page);
    await page.locator('body').click({ position: { x: 5, y: 300 } });   // le focus n'est dans aucun champ
    await page.keyboard.press('Space');
    await expect.poll(() => enLecture(page)).toBe(true);
    await page.keyboard.press('Space');
    await expect.poll(() => enLecture(page)).toBe(false);
  });

  test('un morceau à deux parties : la mesure continue d\'une partie à l\'autre et la frise nomme la partie en cours @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({
      reglages: reglagesMorceau([
        { titre: 'Couplet', accords: [{ root: 'C', quality: '' }, { root: 'G', quality: '' }] },
        { titre: 'Refrain', accords: [{ root: 'F', quality: '' }, { root: 'C', quality: '' }] },
      ]),
    });
    await expect(page.locator('#bl-mesure')).toHaveAccessibleName('Mesure en cours : 1 sur 4');
    await vitesseMax(page);
    await lireEtAttendre(page);
    await expect(page.locator('#bl-frise .bl-frise-part.en-cours')).toHaveText('Couplet');
    await expect(caseN(page, 0, 0)).toHaveClass(/\bplaying\b/);
    // la lecture entre dans le Refrain : mesure 3 sur 4, frise sur « Refrain », case du Refrain allumée
    await expect(page.locator('#bl-mesure')).toHaveAccessibleName('Mesure en cours : 3 sur 4', { timeout: 20_000 });
    await expect(page.locator('#bl-frise .bl-frise-part.en-cours')).toHaveText('Refrain');
    await expect(caseN(page, 1, 0)).toHaveClass(/\bplaying\b/);
    await expect(caseN(page, 0, 0)).not.toHaveClass(/\bplaying\b/);
    await boutonStop(page).click();
  });

  test('un accord de deux temps ne dure pas une mesure : les deux cases s\'allument à tour de rôle @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'C', quality: '', beats: 2 }, { root: 'G', quality: '', beats: 2 }, { root: 'A', quality: 'min', beats: 4 }] });
    await expect(page.locator('#bl-mesure')).toHaveAccessibleName('Mesure en cours : 1 sur 2');
    await vitesseMax(page);
    await lireEtAttendre(page);
    const vus = await suivreTete(page, [0, 1, 2]);
    expect(vus).toEqual([0, 1, 2]);
    await boutonStop(page).click();
  });
});
