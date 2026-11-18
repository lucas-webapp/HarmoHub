// MODULE « synchro » — LE CONFLIT : le même morceau enregistré sur deux appareils pendant qu'ils ne se voient pas.
// Règle observée : la version enregistrée EN DERNIER gagne, et l'autre n'est pas perdue : elle devient un exemplaire « arch_… » rangé dans le dossier « Archives ».
import {
  test, expect, C_AM_F_G, DO_SOL_DO, emailDe, connecter, attendreSynchronise, pastille, morceauxCloud, morceauxLocaux, ouvrirMorceauDeLaListe,
  renommerPartieEtEnregistrer, bibliotheque, attendreNomsCloud, attendreNomsLocaux, titrePartie, ouvrirMesMorceaux, groupe, fenetreMorceaux,
} from './aide-synchro';
import type { Page } from '@playwright/test';

const ALPHA = bibliotheque([{ id: 'a', nom: 'Alpha', accords: C_AM_F_G }, { id: 'b', nom: 'Bravo', accords: DO_SOL_DO }], 'a');

const savedAtDe = async (page: Page, nom: string) => (await morceauxLocaux(page)).find(m => m.name === nom && !m.id.startsWith('arch_'))!.savedAt;
const titresDe = async (page: Page, nom = 'Alpha') => (await morceauxLocaux(page)).find(m => m.name === nom && !m.id.startsWith('arch_'))!.titres[0];
const archives = async (page: Page) => (await morceauxLocaux(page)).filter(m => m.id.startsWith('arch_')).map(m => m.titres[0]).sort();
const coupure = async (page: Page, hors: boolean) => {
  await page.context().setOffline(hors);
  if (hors) await expect(pastille(page)).toHaveAttribute('data-etat', 'offline', { timeout: 20_000 });
};

// Deux appareils connectés au même compte, le morceau « Alpha » ouvert des deux côtés.
async function deuxAppareils(ouvrirAppli: any, nouvelAppareilOuvert: any, testInfo: any) {
  const a: Page = await ouvrirAppli({ reglages: ALPHA });
  const email = emailDe(testInfo);
  const uid = await connecter(a, email);
  await attendreNomsCloud(uid, ['Alpha', 'Bravo']);
  const b: Page = await nouvelAppareilOuvert();
  await connecter(b, email);
  await attendreNomsLocaux(b, ['Alpha', 'Bravo']);
  await ouvrirMorceauDeLaListe(b, 'Alpha');
  await attendreSynchronise(a); await attendreSynchronise(b);
  return { a, b, uid };
}

test.describe('Conflit entre deux appareils @synchro', () => {
  test('A enregistre hors ligne, puis B enregistre plus tard : B gagne partout, la version de A est gardée dans « Archives » @critique', async ({ ouvrirAppli, nouvelAppareilOuvert }, testInfo) => {
    const { a, b, uid } = await deuxAppareils(ouvrirAppli, nouvelAppareilOuvert, testInfo);
    await coupure(a, true);
    await renommerPartieEtEnregistrer(a, 'Version A');
    await renommerPartieEtEnregistrer(b, 'Version B');
    expect(await savedAtDe(b, 'Alpha')).toBeGreaterThan(await savedAtDe(a, 'Alpha'));   // B a bien enregistré APRÈS A
    await expect.poll(async () => (await morceauxCloud(uid)).find(m => !m.id.startsWith('arch_') && m.name === 'Alpha')!.titres[0], { timeout: 20_000 }).toBe('Version B');

    await coupure(a, false);
    await attendreSynchronise(a);
    // Les deux appareils et le cloud s'accordent : B est le morceau, A est archivé.
    for (const page of [a, b]) {
      await expect.poll(() => titresDe(page), { timeout: 20_000 }).toBe('Version B');
      await expect.poll(() => archives(page), { timeout: 20_000 }).toEqual(['Version A']);
    }
    const cloud = await morceauxCloud(uid);
    expect(cloud.find(m => m.id === 'a')!.titres).toEqual(['Version B']);
    expect(cloud.filter(m => m.id.startsWith('arch_')).map(m => m.titres[0])).toEqual(['Version A']);
    // L'appareil qui avait perdu voit le gagnant dans sa grille.
    await expect(titrePartie(a)).toHaveValue('Version B');
  });

  test('B enregistre hors ligne APRÈS A : B gagne aussi, et la version de A (en ligne) est archivée', async ({ ouvrirAppli, nouvelAppareilOuvert }, testInfo) => {
    const { a, b, uid } = await deuxAppareils(ouvrirAppli, nouvelAppareilOuvert, testInfo);
    await coupure(b, true);
    await renommerPartieEtEnregistrer(a, 'Version A');
    await expect.poll(async () => (await morceauxCloud(uid)).find(m => m.id === 'a')!.titres[0], { timeout: 20_000 }).toBe('Version A');
    await renommerPartieEtEnregistrer(b, 'Version B');   // hors ligne, enregistré plus tard que A
    expect(await savedAtDe(b, 'Alpha')).toBeGreaterThan(await savedAtDe(a, 'Alpha'));
    await coupure(b, false);
    await attendreSynchronise(b);
    for (const page of [a, b]) {
      await expect.poll(() => titresDe(page), { timeout: 20_000 }).toBe('Version B');
      await expect.poll(() => archives(page), { timeout: 20_000 }).toEqual(['Version A']);
    }
    expect((await morceauxCloud(uid)).find(m => m.id === 'a')!.titres).toEqual(['Version B']);
  });

  test('A enregistre hors ligne APRÈS B : A gagne au retour du réseau, B est archivé', async ({ ouvrirAppli, nouvelAppareilOuvert }, testInfo) => {
    const { a, b, uid } = await deuxAppareils(ouvrirAppli, nouvelAppareilOuvert, testInfo);
    await coupure(a, true);
    await renommerPartieEtEnregistrer(b, 'Version B');
    await expect.poll(async () => (await morceauxCloud(uid)).find(m => m.id === 'a')!.titres[0], { timeout: 20_000 }).toBe('Version B');
    await renommerPartieEtEnregistrer(a, 'Version A');
    expect(await savedAtDe(a, 'Alpha')).toBeGreaterThan(await savedAtDe(b, 'Alpha'));
    await coupure(a, false);
    await attendreSynchronise(a);
    for (const page of [a, b]) {
      await expect.poll(() => titresDe(page), { timeout: 20_000 }).toBe('Version A');
      await expect.poll(() => archives(page), { timeout: 20_000 }).toEqual(['Version B']);
    }
  });

  test('la liste « Mes morceaux » montre le dossier « Archives » avec la version écartée, ouvrable @critique', async ({ ouvrirAppli, nouvelAppareilOuvert }, testInfo) => {
    const { a, b } = await deuxAppareils(ouvrirAppli, nouvelAppareilOuvert, testInfo);
    await coupure(a, true);
    await renommerPartieEtEnregistrer(a, 'Version A');
    await renommerPartieEtEnregistrer(b, 'Version B');
    await coupure(a, false);
    await attendreSynchronise(a);
    await expect.poll(() => archives(a), { timeout: 20_000 }).toEqual(['Version A']);

    await ouvrirMesMorceaux(a);
    await expect(groupe(a, 'Archives')).toContainText('(1)');
    await groupe(a, 'Archives').locator('.file-row').getByRole('button', { name: 'Ouvrir' }).click();   // l'exemplaire archivé
    await expect(fenetreMorceaux(a)).toBeHidden();
    await expect(titrePartie(a)).toHaveValue('Version A');
  });

  test('deux appareils qui modifient des morceaux DIFFÉRENTS gardent les deux modifications, sans archive', async ({ ouvrirAppli, nouvelAppareilOuvert }, testInfo) => {
    const { a, b, uid } = await deuxAppareils(ouvrirAppli, nouvelAppareilOuvert, testInfo);
    await coupure(a, true);
    await renommerPartieEtEnregistrer(a, 'Alpha modifié');   // le morceau ouvert sur A est Alpha
    await ouvrirMorceauDeLaListe(b, 'Bravo');
    await renommerPartieEtEnregistrer(b, 'Bravo modifié');
    await coupure(a, false);
    await attendreSynchronise(a);
    await expect.poll(async () => (await morceauxCloud(uid)).map(m => `${m.name}:${m.titres[0]}`).sort(), { timeout: 20_000 }).toEqual(['Alpha:Alpha modifié', 'Bravo:Bravo modifié']);
    for (const page of [a, b]) {
      await expect.poll(async () => (await morceauxLocaux(page)).map(m => `${m.name}:${m.titres[0]}`).sort(), { timeout: 20_000 }).toEqual(['Alpha:Alpha modifié', 'Bravo:Bravo modifié']);
    }
  });
});
