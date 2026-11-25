// MODULE « synchro » — LA COUPURE DU RÉSEAU puis la reprise. Le travail continue en local (rien n'est perdu), la pastille le dit,
// et au retour du réseau tout part dans le cloud. La coupure est celle du navigateur (`context.setOffline`) : elle coupe aussi les émulateurs locaux.
import {
  test, expect, C_AM_F_G, DO_SOL_DO, emailDe, connecter, attendreSynchronise, pastille, morceauxCloud, morceauxLocaux, ouvrirMorceauDeLaListe,
  renommerPartieEtEnregistrer, bibliotheque, attendreNomsCloud, attendreNomsLocaux, titrePartie, etat, titre, boutonEnregistrer, creerMorceau,
} from './aide-synchro';
import type { Page } from '@playwright/test';

const DEUX = bibliotheque([{ id: 'a', nom: 'Alpha', accords: C_AM_F_G }, { id: 'b', nom: 'Bravo', accords: DO_SOL_DO }], 'a');
const coupure = async (page: Page) => { await page.context().setOffline(true); await expect(pastille(page)).toHaveAttribute('data-etat', 'offline', { timeout: 20_000 }); };
const reprise = async (page: Page) => { await page.context().setOffline(false); await attendreSynchronise(page); };

test.describe('Coupure du réseau puis reprise @synchro', () => {
  test('la coupure se voit sur la pastille ; enregistrer hors ligne garde le travail en local, puis tout part au retour du réseau @critique', async ({ ouvrirAppli }, testInfo) => {
    const page = await ouvrirAppli({ reglages: DEUX });
    const uid = await connecter(page, emailDe(testInfo));
    await attendreSynchronise(page);
    await attendreNomsCloud(uid, ['Alpha', 'Bravo']);

    await coupure(page);
    await expect(pastille(page)).toHaveAttribute('aria-label', 'Hors ligne — les modifications partiront au retour du réseau');
    // Le travail continue : on enregistre hors ligne.
    await renommerPartieEtEnregistrer(page, 'Refrain');
    await expect(pastille(page)).toHaveAttribute('data-etat', 'pending');
    await expect(pastille(page)).toHaveAttribute('aria-label', 'Modifications pas encore envoyées');
    expect((await morceauxLocaux(page)).find(m => m.name === 'Alpha')!.titres).toEqual(['Refrain']);
    expect((await morceauxCloud(uid)).find(m => m.name === 'Alpha')!.titres).toEqual(['Couplet']);   // le cloud ne sait encore rien

    await reprise(page);
    await expect.poll(async () => (await morceauxCloud(uid)).find(m => m.name === 'Alpha')!.titres, { timeout: 20_000 }).toEqual(['Refrain']);
    await expect(pastille(page)).toHaveAttribute('aria-label', 'Synchronisé avec le cloud');
  });

  test('plusieurs enregistrements hors ligne : au retour, le cloud reçoit le DERNIER état, sans doublon ni archive', async ({ ouvrirAppli }, testInfo) => {
    const page = await ouvrirAppli({ reglages: DEUX });
    const uid = await connecter(page, emailDe(testInfo));
    await attendreNomsCloud(uid, ['Alpha', 'Bravo']);
    await attendreSynchronise(page);
    await coupure(page);
    await renommerPartieEtEnregistrer(page, 'Un');
    await renommerPartieEtEnregistrer(page, 'Deux');
    await renommerPartieEtEnregistrer(page, 'Trois');
    await reprise(page);
    await expect.poll(async () => (await morceauxCloud(uid)).map(m => `${m.id}:${m.titres[0]}`).sort(), { timeout: 20_000 }).toEqual(['a:Trois', 'b:Couplet']);
    expect((await morceauxLocaux(page)).map(m => m.name).sort()).toEqual(['Alpha', 'Bravo']);
  });

  test('un morceau créé hors ligne part dans le cloud à la reprise', async ({ ouvrirAppli }, testInfo) => {
    const page = await ouvrirAppli({ reglages: DEUX });
    const uid = await connecter(page, emailDe(testInfo));
    await attendreNomsCloud(uid, ['Alpha', 'Bravo']);
    await attendreSynchronise(page);
    await coupure(page);
    await creerMorceau(page, 'Hors ligne');
    await boutonEnregistrer(page).click();
    await expect(etat(page)).toContainText(/Enregistré à \d{1,2}:\d{2}/);
    await expect(pastille(page)).toHaveAttribute('data-etat', 'pending');
    await reprise(page);
    await attendreNomsCloud(uid, ['Alpha', 'Bravo', 'Hors ligne']);
  });

  test('un appareil qui revient en ligne reçoit ce qu\'un autre a enregistré pendant son absence @critique', async ({ ouvrirAppli, nouvelAppareilOuvert }, testInfo) => {
    const a = await ouvrirAppli({ reglages: DEUX });
    const email = emailDe(testInfo);
    const uid = await connecter(a, email);
    await attendreNomsCloud(uid, ['Alpha', 'Bravo']);
    const b = await nouvelAppareilOuvert();
    await connecter(b, email);
    await attendreNomsLocaux(b, ['Alpha', 'Bravo']);
    await ouvrirMorceauDeLaListe(b, 'Alpha');
    await attendreSynchronise(b);

    await coupure(b);
    await renommerPartieEtEnregistrer(a, 'Pendant ton absence');
    await expect.poll(async () => (await morceauxCloud(uid)).find(m => m.name === 'Alpha')!.titres[0], { timeout: 20_000 }).toBe('Pendant ton absence');
    expect((await morceauxLocaux(b)).find(m => m.name === 'Alpha')!.titres).toEqual(['Couplet']);   // B n'a rien reçu : il est coupé

    await reprise(b);
    await expect.poll(async () => (await morceauxLocaux(b)).find(m => m.name === 'Alpha')!.titres, { timeout: 20_000 }).toEqual(['Pendant ton absence']);
    await expect(titrePartie(b)).toHaveValue('Pendant ton absence');
    // Rien n'a été archivé : B n'avait pas enregistré de son côté.
    expect((await morceauxLocaux(b)).filter(m => m.id.startsWith('arch_'))).toEqual([]);
  });

  test('la coupure ne casse pas le compte : la pastille « Hors ligne » n\'efface ni le nom ni le menu, et le titre du morceau reste', async ({ ouvrirAppli }, testInfo) => {
    const page = await ouvrirAppli({ reglages: DEUX });
    await connecter(page, emailDe(testInfo), 'Camille Test');
    await attendreSynchronise(page);
    await coupure(page);
    await expect(page.locator('#account-name')).toHaveText('Camille Test');
    await expect(titre(page)).toHaveText('Alpha');
    await page.locator('#account-info').click();
    await expect(page.getByRole('menu').getByText('Hors ligne', { exact: false }).first()).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Se déconnecter/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(page.locator('#account-info')).toBeVisible();   // toujours connecté, malgré la coupure
  });

  test('Y-01 : après une coupure SANS rien à envoyer, la pastille repasse à « Synchronisé » dès que le réseau revient', async ({ ouvrirAppli }, testInfo) => {
    const page = await ouvrirAppli({ reglages: DEUX });
    await connecter(page, emailDe(testInfo));
    await attendreSynchronise(page);
    await coupure(page);
    const debut = Date.now();
    await expect.poll(() => Date.now() - debut, { timeout: 10_000, message: 'la coupure dure au moins 3 s' }).toBeGreaterThan(3_000);
    await page.context().setOffline(false);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
    await attendreSynchronise(page);   // « Synchronisé » dès le retour du réseau, sans rien enregistrer (corrigé le 25/11 : synchro-cloud.js v3)
  });

  // Y-03 / Y-01 : les évènements `offline` / `online` du navigateur n'arrivent pas toujours (intermittent sous WebKit et Android). Le test les RETIENT lui-même (un écouteur
  // en capture, posé avant les nôtres, les arrête) : la pastille doit suivre quand même, grâce au coup d'œil régulier à `navigator.onLine`.
  test('Y-03 : la coupure se voit sur la pastille même si le navigateur n\'envoie pas l\'évènement « offline »', async ({ ouvrirAppli }, testInfo) => {
    const page = await ouvrirAppli({ reglages: DEUX });
    await connecter(page, emailDe(testInfo));
    await attendreSynchronise(page);
    await page.evaluate(() => window.addEventListener('offline', (e) => e.stopImmediatePropagation(), true));
    await page.context().setOffline(true);
    await expect(pastille(page)).toHaveAttribute('data-etat', 'offline', { timeout: 10_000 });
    await page.context().setOffline(false);
    await attendreSynchronise(page);
  });

  test('Y-01 : le retour du réseau se voit sur la pastille même si le navigateur n\'envoie pas l\'évènement « online »', async ({ ouvrirAppli }, testInfo) => {
    const page = await ouvrirAppli({ reglages: DEUX });
    await connecter(page, emailDe(testInfo));
    await attendreSynchronise(page);
    await coupure(page);
    await page.evaluate(() => window.addEventListener('online', (e) => e.stopImmediatePropagation(), true));
    await page.context().setOffline(false);
    await attendreSynchronise(page);
  });
});
