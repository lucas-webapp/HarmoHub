// MODULE « fichiers » — export et import JSON : un morceau, toute la bibliothèque, restauration avec le choix « écraser / garder les deux / ignorer ».
// Les téléchargements se lisent par l'évènement `download` ; l'import passe par le sélecteur de fichiers (`filechooser`) ou, sur Chromium et Edge,
// par le sélecteur natif remplacé par un faux (voir `preparerImport`). Aucun accès à la production : les fichiers restent sur le disque du test.
import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import {
  bibliotheque, morceauxStockes, titre, toast, ouvrirMenuMorceau, menuMorceau, ouvrirMesMorceaux, fenetreMorceaux, ligne,
  telecharger, jsonDe, fichierJson, preparerImport, repondreAuxBoitesNatives, modifierLeMorceau, choisirDansMenuMorceau, noms, Telechargement,
} from './aide-fichiers';

const DEUX = [
  { id: 'a', nom: 'Alpha', accords: [{ root: 'C', quality: '' }, { root: 'G', quality: '' }] },
  { id: 'b', nom: 'Bravo', accords: [{ root: 'D', quality: 'min' }, { root: 'A', quality: '' }, { root: 'F', quality: '' }] },
];
const ouvrirAvecDeux = (ouvrirAppli: (o?: any) => Promise<Page>) => ouvrirAppli({ reglages: bibliotheque(DEUX, 'a') });

async function exporterDepuisLeMenu(page: Page, cible: 'Ce morceau' | 'Toute la bibliothèque'): Promise<Telechargement> {
  await ouvrirMenuMorceau(page);
  await menuMorceau(page).getByRole('menuitem', { name: 'Exporter…' }).click();
  return telecharger(page, () => page.getByText(cible, { exact: true }).click());
}
const accordsDuFichier = (s: any): string[] => s.sections.flatMap((p: any) => p.chords.map((c: any) => c.root + (c.quality || '')));
const importerPar = async (page: Page, declencher: () => Promise<unknown>, fichier: ReturnType<typeof fichierJson>) => {
  await preparerImport(page, fichier);
  await declencher();
};
const importerParLeMenu = (page: Page, fichier: ReturnType<typeof fichierJson>) =>
  importerPar(page, () => choisirDansMenuMorceau(page, 'Importer…'), fichier);

test.describe('Export JSON @fichiers', () => {
  test('« Exporter… » › « Ce morceau » télécharge une sauvegarde JSON du seul morceau ouvert @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAvecDeux(ouvrirAppli);
    const t = await exporterDepuisLeMenu(page, 'Ce morceau');
    expect(t.nom).toMatch(/^HarmoHub - Alpha - Morceau - \d{4}-\d{2}-\d{2} \d{4}\.json$/);
    const j = jsonDe(t);
    expect(j.app).toBe('HarmoHub');
    expect(j.kind).toBe('library-backup');
    expect(j.version).toBe(1);
    expect(j.songs).toHaveLength(1);
    expect(j.songs[0].name).toBe('Alpha');
    expect(accordsDuFichier(j.songs[0])).toEqual(['C', 'G']);
    await expect(toast(page)).toContainText('Téléchargements');
    expect(garde.bloquees).toEqual([]);
  });

  test('« Exporter… » › « Toute la bibliothèque » télécharge tous les morceaux @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecDeux(ouvrirAppli);
    const t = await exporterDepuisLeMenu(page, 'Toute la bibliothèque');
    expect(t.nom).toMatch(/^HarmoHub - Bibliotheque - \d{4}-\d{2}-\d{2} \d{4}\.json$/);
    const j = jsonDe(t);
    expect(j.kind).toBe('library-backup');
    expect(j.songs.map((s: any) => s.name)).toEqual(['Alpha', 'Bravo']);
    expect(accordsDuFichier(j.songs[1])).toEqual(['Dmin', 'A', 'F']);
    await expect(toast(page)).toContainText('Bibliothèque sauvegardée');
  });

  test('la fenêtre « Mes morceaux » exporte un morceau (bouton de sa ligne) ou toute la bibliothèque @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecDeux(ouvrirAppli);
    await ouvrirMesMorceaux(page);
    const un = await telecharger(page, () => ligne(page, 'Bravo').getByRole('button', { name: 'Exporter ce morceau en JSON' }).click());
    expect(un.nom).toMatch(/^HarmoHub - Bravo - Morceau - /);
    expect(jsonDe(un).songs.map((s: any) => s.name)).toEqual(['Bravo']);
    const tout = await telecharger(page, () => fenetreMorceaux(page).getByRole('button', { name: 'Exporter toute la bibliothèque' }).click());
    expect(tout.nom).toMatch(/^HarmoHub - Bibliotheque - /);
    expect(jsonDe(tout).songs).toHaveLength(2);
  });

  test('le fichier garde les réglages du morceau (tonalité, mesure, tempo, parties) et son identifiant', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecDeux(ouvrirAppli);
    const s = jsonDe(await exporterDepuisLeMenu(page, 'Ce morceau')).songs[0];
    expect(s.id).toBe('a');
    expect(s.sections.map((p: any) => p.title)).toEqual(['Couplet']);
    expect(s.sections[0].chords[0]).toMatchObject({ root: 'C', beats: 4 });
    expect(typeof s.savedAt).toBe('number');
  });

  test('un morceau sans modification exporté depuis le menu contient bien ce qui est à l\'écran', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecDeux(ouvrirAppli);
    const s = jsonDe(await exporterDepuisLeMenu(page, 'Ce morceau')).songs[0];
    expect(accordsDuFichier(s)).toEqual(await noms(page));
  });

  test('« Ce morceau » exporte les modifications non enregistrées de l\'écran', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecDeux(ouvrirAppli);
    await modifierLeMorceau(page, 'Refrain');
    const s = jsonDe(await exporterDepuisLeMenu(page, 'Ce morceau')).songs[0];
    expect(s.sections[0].title).toBe('Refrain');
  });
});

test.describe('Import JSON @fichiers', () => {
  // Un fichier de sauvegarde fabriqué à partir d'un vrai export (même forme), puis retouché.
  async function fichierDeSauvegarde(page: Page, retouche: (song: any) => void, nom = 'sauvegarde.json') {
    const j = jsonDe(await exporterDepuisLeMenu(page, 'Ce morceau'));
    retouche(j.songs[0]);
    return fichierJson(nom, j);
  }

  test('« Importer… » ajoute un morceau absent de la bibliothèque, sans toucher aux autres @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAvecDeux(ouvrirAppli);
    const f = await fichierDeSauvegarde(page, (s) => { s.id = 'etranger'; s.name = 'Étranger'; s.sections[0].chords = s.sections[0].chords.slice(0, 1); });
    await importerParLeMenu(page, f);
    await expect.poll(async () => (await morceauxStockes(page)).map(m => m.name)).toEqual(['Alpha', 'Bravo', 'Étranger']);
    const nouveau = (await morceauxStockes(page)).find(m => m.name === 'Étranger')!;
    expect(nouveau.accords).toEqual(['C']);
    await expect(page.getByRole('dialog', { name: 'Ce morceau existe déjà' })).toBeHidden();
    expect(garde.bloquees).toEqual([]);
  });

  test('importer ce qu\'on vient d\'exporter signale « Ce morceau existe déjà » et propose les trois choix @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecDeux(ouvrirAppli);
    const f = await fichierDeSauvegarde(page, () => {});
    await importerParLeMenu(page, f);
    const d = page.getByRole('dialog', { name: 'Ce morceau existe déjà' });
    await expect(d).toBeVisible();
    await expect(d).toContainText('Alpha');
    for (const choix of ['Écraser', 'Garder les deux', 'Ignorer']) await expect(d.getByRole('radio', { name: choix })).toBeVisible();
    await expect(d.getByRole('button', { name: 'Appliquer' })).toBeVisible();
    await d.getByRole('button', { name: 'Annuler' }).click();
    await expect(d).toBeHidden();
    expect((await morceauxStockes(page)).map(m => m.name)).toEqual(['Alpha', 'Bravo']);
  });

  test('conflit › « Garder les deux » ajoute une copie renommée « (2) » @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecDeux(ouvrirAppli);
    const f = await fichierDeSauvegarde(page, () => {});
    await importerParLeMenu(page, f);
    const d = page.getByRole('dialog', { name: 'Ce morceau existe déjà' });
    await d.getByRole('radio', { name: 'Garder les deux' }).check();
    await d.getByRole('button', { name: 'Appliquer' }).click();
    await expect(d).toBeHidden();
    await expect.poll(async () => (await morceauxStockes(page)).map(m => m.name)).toEqual(['Alpha', 'Alpha (2)', 'Bravo'].sort((x, y) => 0) && ['Alpha', 'Bravo', 'Alpha (2)']);
  });

  test('conflit › « Écraser » remplace la version en place par celle du fichier @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecDeux(ouvrirAppli);
    const f = await fichierDeSauvegarde(page, (s) => { s.sections[0].chords = s.sections[0].chords.slice(0, 1); s.savedAt = Date.now() + 60_000; });
    await importerParLeMenu(page, f);
    const d = page.getByRole('dialog', { name: 'Ce morceau existe déjà' });
    await expect(d).toBeVisible();
    await d.getByRole('radio', { name: 'Écraser' }).check();
    await d.getByRole('button', { name: 'Appliquer' }).click();
    await expect(d).toBeHidden();
    await expect.poll(async () => (await morceauxStockes(page)).find(m => m.id === 'a')?.accords).toEqual(['C']);
    expect((await morceauxStockes(page)).map(m => m.name)).toEqual(['Alpha', 'Bravo']);
  });

  test('conflit › « Ignorer » ne touche à rien', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecDeux(ouvrirAppli);
    const f = await fichierDeSauvegarde(page, (s) => { s.sections[0].chords = s.sections[0].chords.slice(0, 1); });
    await importerParLeMenu(page, f);
    const d = page.getByRole('dialog', { name: 'Ce morceau existe déjà' });
    await d.getByRole('radio', { name: 'Ignorer' }).check();
    await d.getByRole('button', { name: 'Appliquer' }).click();
    await expect(d).toBeHidden();
    expect((await morceauxStockes(page)).find(m => m.id === 'a')!.accords).toEqual(['C', 'G']);
    expect((await morceauxStockes(page)).map(m => m.name)).toEqual(['Alpha', 'Bravo']);
  });

  test('conflit › un fichier plus récent est proposé en « Écraser » d\'office', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecDeux(ouvrirAppli);
    const f = await fichierDeSauvegarde(page, (s) => { s.sections[0].chords = s.sections[0].chords.slice(0, 1); s.savedAt = Date.now() + 3_600_000; });
    await importerParLeMenu(page, f);
    const d = page.getByRole('dialog', { name: 'Ce morceau existe déjà' });
    await expect(d.getByRole('radio', { name: 'Écraser' })).toBeChecked();
  });

  test('conflit › un fichier plus ancien est proposé en « Ignorer » d\'office', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecDeux(ouvrirAppli);
    const f = await fichierDeSauvegarde(page, (s) => { s.sections[0].chords = s.sections[0].chords.slice(0, 1); s.savedAt = 1_000_000; });
    await importerParLeMenu(page, f);
    const d = page.getByRole('dialog', { name: 'Ce morceau existe déjà' });
    await expect(d.getByRole('radio', { name: 'Ignorer' })).toBeChecked();
  });

  test('conflit › « Partout : la plus récente » règle tout d\'un coup : le fichier plus ancien est écarté', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecDeux(ouvrirAppli);
    const f = await fichierDeSauvegarde(page, (s) => { s.sections[0].chords = s.sections[0].chords.slice(0, 1); s.savedAt = 1_000_000; });
    await importerParLeMenu(page, f);
    const d = page.getByRole('dialog', { name: 'Ce morceau existe déjà' });
    await d.getByRole('button', { name: 'la plus récente', exact: true }).click();
    await expect(d).toBeHidden();
    expect((await morceauxStockes(page)).find(m => m.id === 'a')!.accords).toEqual(['C', 'G']);
    expect((await morceauxStockes(page)).map(m => m.name)).toEqual(['Alpha', 'Bravo']);
  });

  test('conflit › « Partout : écraser » remplace même par un fichier plus ancien', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecDeux(ouvrirAppli);
    const f = await fichierDeSauvegarde(page, (s) => { s.sections[0].chords = s.sections[0].chords.slice(0, 1); s.savedAt = 1_000_000; });
    await importerParLeMenu(page, f);
    const d = page.getByRole('dialog', { name: 'Ce morceau existe déjà' });
    await d.getByRole('button', { name: 'écraser', exact: true }).click();
    await expect(d).toBeHidden();
    await expect.poll(async () => (await morceauxStockes(page)).find(m => m.id === 'a')?.accords).toEqual(['C']);
  });

  test('un fichier illisible est refusé avec un message, sans rien changer @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecDeux(ouvrirAppli);
    await importerParLeMenu(page, fichierJson('casse.json', '{ ceci n\'est pas du JSON'));
    await expect(toast(page)).toContainText('Fichier invalide — ce n\'est pas une sauvegarde HarmoHub');
    expect((await morceauxStockes(page)).map(m => m.name)).toEqual(['Alpha', 'Bravo']);
  });

  test('un JSON qui n\'est pas une sauvegarde HarmoHub est refusé', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecDeux(ouvrirAppli);
    await importerParLeMenu(page, fichierJson('autre.json', { truc: 1 }));
    await expect(toast(page)).toContainText('Fichier invalide');
    expect((await morceauxStockes(page)).map(m => m.name)).toEqual(['Alpha', 'Bravo']);
  });

  test('aller-retour : exporter la bibliothèque, tout supprimer, la réimporter dans « Mes morceaux » @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecDeux(ouvrirAppli);
    repondreAuxBoitesNatives(page, true);
    await ouvrirMesMorceaux(page);
    const sauvegarde = await telecharger(page, () => fenetreMorceaux(page).getByRole('button', { name: 'Exporter toute la bibliothèque' }).click());
    await ligne(page, 'Bravo').getByRole('button', { name: 'Supprimer' }).click();
    await expect(ligne(page, 'Bravo')).toHaveCount(0);
    await ligne(page, 'Alpha').getByRole('button', { name: 'Supprimer' }).click();
    await expect(fenetreMorceaux(page).locator('.file-row')).toHaveCount(0);
    expect(await morceauxStockes(page)).toEqual([]);
    await preparerImport(page, fichierJson(sauvegarde.nom, sauvegarde.texte));
    await fenetreMorceaux(page).getByRole('button', { name: 'Importer une bibliothèque' }).click();
    await expect.poll(async () => (await morceauxStockes(page)).map(m => m.name).sort()).toEqual(['Alpha', 'Bravo']);
    const retrouves = await morceauxStockes(page);
    expect(retrouves.find(m => m.name === 'Alpha')!.accords).toEqual(['C', 'G']);
    expect(retrouves.find(m => m.name === 'Bravo')!.accords).toEqual(['Dmin', 'A', 'F']);
    await expect(ligne(page, 'Bravo')).toContainText('3 accord(s)');
  });

  test('« Importer une bibliothèque » avec un fichier invalide ne change rien', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecDeux(ouvrirAppli);
    await ouvrirMesMorceaux(page);
    await preparerImport(page, fichierJson('mauvais.json', { pas: 'une sauvegarde' }));
    await fenetreMorceaux(page).getByRole('button', { name: 'Importer une bibliothèque' }).click();
    await expect(toast(page)).toContainText('Fichier invalide');
    await expect(fenetreMorceaux(page).locator('.file-row')).toHaveCount(2);
  });

  test('un morceau importé s\'ouvre comme les autres', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecDeux(ouvrirAppli);
    const f = await fichierDeSauvegarde(page, (s) => { s.id = 'etranger'; s.name = 'Étranger'; });
    await importerParLeMenu(page, f);
    await expect.poll(async () => (await morceauxStockes(page)).length).toBe(3);
    await ouvrirMenuMorceau(page);
    await menuMorceau(page).getByRole('menuitemradio', { name: /Étranger/ }).click();
    await expect(titre(page)).toHaveText('Étranger');
    expect(await noms(page)).toEqual(['C', 'G']);
  });
});
