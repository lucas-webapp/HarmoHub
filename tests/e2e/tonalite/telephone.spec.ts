// MODULE « tonalite » — téléphone : la tonalité vit dans le panneau que déplie la ligne de résumé du morceau (« C · 120 BPM · 4/4 »). Les gestes
// communs (choix, suggestion, transposition) sont dans les autres fichiers du module, qui passent aussi sur téléphone.
import { test, expect } from '../support/fixtures';
import { C_AM_F_G, puce, transposerHaut, transposerBas, choisir, fermerFenetre, ouvrirReglages, estMobile, libelle, noms } from './aide-tonalite';

test.describe('Tonalité au téléphone @tonalite @mobile', () => {
  test('le résumé du morceau dit la tonalité ; le panneau déplié montre la tuile « Tonalité » et les flèches « Transposer » @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    expect(estMobile(page)).toBe(true);
    const resume = page.locator('#song-summary');
    await expect(resume).toHaveAttribute('aria-label', /^Réglages du morceau : C majeur · 120 BPM · 4\/4/);
    await expect(resume).toContainText('C · 120 BPM · 4/4');
    await expect(puce(page)).toBeHidden();                 // replié au départ
    await expect(transposerHaut(page)).toBeHidden();
    await resume.tap();
    await expect(puce(page)).toBeVisible();
    await expect(puce(page)).toContainText('Tonalité');
    await expect(puce(page)).toContainText('C majeur');
    await expect(transposerHaut(page)).toBeVisible();
    await expect(transposerBas(page)).toBeVisible();
    expect(garde.bloquees).toEqual([]);
  });

  test('choisir « D dorien » met à jour le résumé du morceau et la tuile', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await choisir(page, 'D', 'Dorien');
    await fermerFenetre(page);
    await expect(puce(page)).toContainText('D dorien');
    await expect(page.locator('#song-summary')).toHaveAttribute('aria-label', /^Réglages du morceau : D dorien · /);
    await expect(page.locator('#song-summary')).toContainText('D dor');
    expect(await libelle(page)).toBe('D dorien');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('replier le panneau garde la tonalité choisie', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await choisir(page, 'E♭');
    await fermerFenetre(page);
    await page.locator('#song-summary').tap();
    await expect(puce(page)).toBeHidden();
    await expect(page.locator('#song-summary')).toContainText('E♭');
    await ouvrirReglages(page);
    await expect(puce(page)).toContainText('E♭ majeur');
  });
});

test.describe('Tonalité à l\'ordinateur : la barre des réglages @tonalite @ordinateur', () => {
  test('la puce « Tonalité » et les flèches « Transposer » sont visibles d\'emblée, sans panneau à déplier', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    expect(estMobile(page)).toBe(false);
    await expect(puce(page)).toBeVisible();
    await expect(puce(page)).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(puce(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(puce(page)).toHaveAttribute('title', /^Tonalité : C majeur — /);
    await expect(page.locator('#song-summary')).toBeHidden();
    await expect(transposerHaut(page)).toBeVisible();
    await expect(transposerBas(page)).toBeVisible();
    await choisir(page, 'A', 'Mineur');
    await expect(puce(page)).toHaveAttribute('aria-expanded', 'true');
    await fermerFenetre(page);
    await expect(puce(page)).toHaveAttribute('title', /^Tonalité : A mineur — /);
    await expect(puce(page)).toContainText('Am');
  });
});
