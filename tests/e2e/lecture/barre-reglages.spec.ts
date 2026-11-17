// MODULE « lecture » — la barre de lecture elle-même (ordinateur) : la frise des parties, la mesure affichée et la fenêtre « Barre de lecture »
// (roue dentée de droite : frise pleine largeur, largeur, noms, mesure, réorganiser, ordre, rétablir). Les choix sont gardés d'une visite à l'autre.
import { test, expect } from '../support/fixtures';
import type { Page, Locator } from '@playwright/test';
import { C_AM_F_G, barre, reglagesMorceau, vitesseMax, boutonLecture, boutonStop, enLecture } from './aide-lecture';

const fenetreReglages = (page: Page): Locator => page.getByRole('dialog', { name: 'Barre de lecture' });
const interrupteur = (page: Page, nom: string): Locator => fenetreReglages(page).getByRole('switch', { name: nom });
const FRISE_PLEINE = 'Frise des parties en pleine largeur', NOMS = 'Noms des parties dans la frise', MESURE = 'Numéro de la mesure en cours', REORG = 'Réorganiser les blocs de la barre';

async function ouvrirReglages(page: Page) {
  if (await fenetreReglages(page).isVisible()) return;
  await page.getByRole('button', { name: 'Réglage de la barre de lecture' }).click();
  await expect(fenetreReglages(page)).toBeVisible();
}
const reglagesStockes = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('harmohubBarreReglages') || 'null'));
const ordreStocke = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('harmohubBarreLectureOrdre') || 'null'));

// Un morceau de deux parties de durées 3 : 1 (en accords de 4 temps).
const DEUX_PARTIES = reglagesMorceau([
  { titre: 'Couplet', accords: [{ root: 'C', quality: '' }, { root: 'G', quality: '' }, { root: 'A', quality: 'min' }] },
  { titre: 'Refrain', accords: [{ root: 'F', quality: '' }] },
]);

test.describe('Barre de lecture : frise et mesure @lecture @ordinateur', () => {
  test('la barre montre lecture, stop, boucle, mesure, frise des parties, tempo, métronome et clavier / guitare @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await expect(barre(page)).toBeVisible();
    for (const nom of ['Lecture', 'Stop']) await expect(barre(page).getByRole('button', { name: nom, exact: true })).toBeVisible();
    await expect(barre(page).getByRole('button', { name: /^Bouc/ })).toBeVisible();
    await expect(page.locator('#bl-mesure')).toBeVisible();
    await expect(page.locator('#bl-mesure')).toContainText('Mesure');
    await expect(page.locator('#bl-frise')).toBeVisible();
    await expect(page.locator('#bl-tempo')).toBeVisible();
    await expect(barre(page).getByRole('button', { name: 'Garder le métronome pendant la lecture de la grille' })).toBeVisible();
    await expect(barre(page).getByRole('button', { name: 'Afficher le piano' })).toBeVisible();
    await expect(barre(page).getByRole('button', { name: 'Afficher la guitare' })).toBeVisible();
    await expect(barre(page).getByRole('button', { name: 'Réglage de la barre de lecture' })).toBeVisible();
    // la barre est collée au bas de l'écran et n'en dépasse pas
    const b = (await barre(page).boundingBox())!, vue = page.viewportSize()!;
    expect(b.y + b.height).toBeLessThanOrEqual(vue.height + 1);
    expect(b.y).toBeGreaterThan(vue.height * 0.7);
  });

  test('la frise a une tranche par partie, large comme la durée de la partie, et nomme chacune', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    const tranches = page.locator('#bl-frise .bl-frise-part');
    await expect(tranches).toHaveText(['Couplet', 'Refrain']);
    const [a, b] = [(await tranches.nth(0).boundingBox())!, (await tranches.nth(1).boundingBox())!];
    expect(a.width / b.width).toBeGreaterThan(2.7);   // 3 mesures contre 1 : 3 fois plus large (aux marges près)
    expect(a.width / b.width).toBeLessThan(3.3);
    await expect(page.locator('#bl-mesure')).toHaveAccessibleName('Mesure en cours : 1 sur 4');
  });

  test('pendant la lecture, la tête de la frise avance de gauche à droite et la partie en cours est repérée', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    await vitesseMax(page);
    const position = () => page.locator('#bl-frise .bl-frise-tete').evaluate(e => parseFloat((e as HTMLElement).style.left) || 0);
    expect(await position()).toBe(0);
    await boutonLecture(page).click();
    await expect.poll(position, { timeout: 15_000 }).toBeGreaterThan(20);
    const milieu = await position();
    await expect.poll(position, { timeout: 15_000 }).toBeGreaterThan(milieu);
    await expect(page.locator('#bl-frise .bl-frise-part.en-cours')).toHaveCount(1);
    await expect.poll(() => page.locator('#bl-frise .bl-frise-part.en-cours').innerText(), { timeout: 15_000 }).toBe('Refrain');
    expect(await position()).toBeGreaterThan(70);
    await boutonStop(page).click();
    await expect.poll(() => enLecture(page)).toBe(false);
  });
});

test.describe('Fenêtre « Barre de lecture » @lecture @ordinateur', () => {
  test('la roue dentée ouvre la fenêtre de réglages ; Échap la ferme @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await expect(fenetreReglages(page)).toBeHidden();
    await ouvrirReglages(page);
    await expect(fenetreReglages(page).getByRole('heading', { name: 'Barre de lecture' })).toBeVisible();
    for (const nom of [FRISE_PLEINE, NOMS, MESURE, REORG]) await expect(interrupteur(page, nom)).toBeVisible();
    await expect(fenetreReglages(page).getByRole('slider', { name: 'Largeur' })).toBeVisible();
    await expect(fenetreReglages(page).getByRole('button', { name: 'Remettre les blocs dans l\'ordre d\'origine' })).toBeVisible();
    await expect(fenetreReglages(page).getByRole('button', { name: 'Rétablir', exact: true })).toBeVisible();
    // état d'origine : frise pleine largeur, noms et mesure affichés, réorganisation coupée
    await expect(interrupteur(page, FRISE_PLEINE)).toBeChecked();
    await expect(interrupteur(page, NOMS)).toBeChecked();
    await expect(interrupteur(page, MESURE)).toBeChecked();
    await expect(interrupteur(page, REORG)).not.toBeChecked();
    await page.keyboard.press('Escape');
    await expect(fenetreReglages(page)).toBeHidden();
    expect(garde.bloquees).toEqual([]);
  });

  test('« Mesure » masque le numéro de mesure ; « Noms » vide la frise de ses noms ; les deux se retrouvent après rechargement @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirReglages(page);
    await interrupteur(page, MESURE).click();
    await expect(interrupteur(page, MESURE)).not.toBeChecked();
    await expect(page.locator('#bl-mesure')).toBeHidden();
    await interrupteur(page, NOMS).click();
    await expect(interrupteur(page, NOMS)).not.toBeChecked();
    await expect(page.locator('#bl-frise .bl-frise-part')).toHaveCSS('font-size', '0px');   // le nom est dans la page mais n'est plus écrit
    expect(await reglagesStockes(page)).toMatchObject({ noms: false, mesure: false, pleine: true });
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await expect(page.locator('#bl-mesure')).toBeHidden();
    await expect(page.locator('#bl-frise .bl-frise-part')).toHaveCSS('font-size', '0px');
    await ouvrirReglages(page);
    await expect(interrupteur(page, MESURE)).not.toBeChecked();
    await expect(interrupteur(page, NOMS)).not.toBeChecked();
    // on les rallume
    await interrupteur(page, MESURE).click();
    await interrupteur(page, NOMS).click();
    await expect(page.locator('#bl-mesure')).toBeVisible();
    await expect(page.locator('#bl-frise .bl-frise-part')).not.toHaveCSS('font-size', '0px');
  });

  test('« Frise pleine largeur » : coupée, le bloc mesure + frise prend la largeur du curseur « Largeur » ; allumée, le curseur est grisé', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirReglages(page);
    const largeur = fenetreReglages(page).getByRole('slider', { name: 'Largeur' });
    const bloc = page.locator('[data-bloc="parties"]');   // le bloc « mesure + frise »
    const largeurBloc = async () => Math.round((await bloc.boundingBox())!.width);
    await expect(largeur).toBeDisabled();
    expect(await largeurBloc()).toBeGreaterThan(700);
    await interrupteur(page, FRISE_PLEINE).click();
    await expect(interrupteur(page, FRISE_PLEINE)).not.toBeChecked();
    await expect(largeur).toBeEnabled();
    await expect.poll(largeurBloc).toBe(480);   // largeur d'origine du curseur
    await largeur.fill('300');
    await expect(fenetreReglages(page).getByText('300 px')).toBeVisible();
    await expect.poll(largeurBloc).toBe(300);
    expect(await reglagesStockes(page)).toMatchObject({ pleine: false, largeur: 300 });
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await expect.poll(largeurBloc).toBe(300);
    await ouvrirReglages(page);
    await interrupteur(page, FRISE_PLEINE).click();
    await expect.poll(largeurBloc).toBeGreaterThan(700);
  });

  test('« Rétablir » remet tous les réglages de la fenêtre à leur valeur d\'origine', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirReglages(page);
    await interrupteur(page, MESURE).click();
    await interrupteur(page, NOMS).click();
    await interrupteur(page, FRISE_PLEINE).click();
    await expect(page.locator('#bl-mesure')).toBeHidden();
    await fenetreReglages(page).getByRole('button', { name: 'Rétablir', exact: true }).click();
    await expect(interrupteur(page, MESURE)).toBeChecked();
    await expect(interrupteur(page, NOMS)).toBeChecked();
    await expect(interrupteur(page, FRISE_PLEINE)).toBeChecked();
    await expect(page.locator('#bl-mesure')).toBeVisible();
    expect(await reglagesStockes(page)).toEqual({ pleine: true, largeur: 480, noms: true, mesure: true });
  });

  test('« Réorganiser » : on glisse un bloc de la barre pour le poser ailleurs ; « Ordre » remet l\'ordre d\'origine', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    expect(await ordreStocke(page)).toEqual(['lecture', 'parties', 'tempo', 'vues']);   // ordre d'origine
    const bloc = (nom: string) => page.locator(`[data-bloc="${nom}"]`);
    const xOrigine = { lecture: (await bloc('lecture').boundingBox())!.x, tempo: (await bloc('tempo').boundingBox())!.x };
    expect(xOrigine.lecture).toBeLessThan(xOrigine.tempo);
    await ouvrirReglages(page);
    await interrupteur(page, REORG).click();
    await expect(interrupteur(page, REORG)).toBeChecked();
    await page.keyboard.press('Escape');
    await expect(fenetreReglages(page)).toBeHidden();
    // on attrape le bloc du tempo et on le pose avant le bloc de lecture
    const t = (await bloc('tempo').boundingBox())!, l = (await bloc('lecture').boundingBox())!;
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2);
    await page.mouse.down();
    await page.mouse.move(t.x + t.width / 2 - 30, t.y + t.height / 2, { steps: 4 });
    await page.mouse.move(l.x + 10, l.y + l.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect.poll(() => ordreStocke(page)).toEqual(['tempo', 'lecture', 'parties', 'vues']);
    await expect.poll(async () => (await bloc('tempo').boundingBox())!.x).toBeLessThan((await bloc('lecture').boundingBox())!.x);
    // l'ordre est gardé au rechargement
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    expect((await bloc('tempo').boundingBox())!.x).toBeLessThan((await bloc('lecture').boundingBox())!.x);
    await ouvrirReglages(page);
    await fenetreReglages(page).getByRole('button', { name: 'Remettre les blocs dans l\'ordre d\'origine' }).click();
    await expect.poll(async () => (await bloc('lecture').boundingBox())!.x).toBeLessThan((await bloc('tempo').boundingBox())!.x);
    await expect.poll(() => ordreStocke(page)).toEqual(['lecture', 'parties', 'tempo', 'vues']);
  });
});
