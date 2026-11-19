// MODULE « parametres » — ce qu'on écrit sur les instruments : touches du piano, pastilles de la guitare, noms de notes du manche de dessin. Trois choix
// possibles pour le piano et la guitare : « Rien », « Notes » (A, C, E…) ou « Degrés » (1, ♭3, 5…). Ordinateur (tiroir clavier / guitare).
// E-03 à E-05 (bugs.md) : les noms de notes ignorent la tonalité (D# là où la grille écrit E♭ en do).
import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import { C_AM_F_G, ouvrir, fermer, interrupteur, choix, NOM, lireStockage } from './aide-parametres';
import { boutonGuitare, caseN, ouvrirEditeur, ongletDessin, manche, guitare, touchesJouees, notesAccord, fermerEditeur } from '../diagrammes/aide-diagrammes';
import { choisir, fermerFenetre } from '../tonalite/aide-tonalite';

const etiquettesPiano = (page: Page) => touchesJouees(page).evaluateAll(k => k.map(e => (e as HTMLElement).dataset.etiquette ?? ''));
// Les pastilles de la guitare : le texte blanc du dessin (les numéros de cases sont gris, les « X » des cordes étouffées rouges). Pas de `data-testid` :
// l'attribut `fill` du <text> SVG est le seul moyen de distinguer le « 5 » d'une pastille de degré du « 5 » de la case 5.
const pastilles = async (page: Page) => (await guitare(page).locator('text[fill="#fff"]').allTextContents()).map(t => t.trim());
// Les noms de note du manche de dessin : tout ce qu'il écrit en plus des numéros de cases et des « X ».
const nomsDuManche = async (page: Page) => (await manche(page).locator('text').allTextContents()).map(t => t.trim()).filter(t => !/^(\d+|X)$/.test(t));

// Attend que le dessin ait fini de se refaire : au moins trois pastilles, toutes parmi `permis` (une lecture entre deux redessins verrait l'ancien accord).
// Si une pastille étrangère reste affichée, l'attente échoue au bout du délai : rien n'est toléré, on laisse seulement le temps au dessin.
const pastillesParmi = (page: Page, permis: string[]) => expect.poll(async () => {
  const p = await pastilles(page);
  return p.length >= 3 && p.every(x => permis.includes(x));
}, { message: `pastilles attendues parmi ${permis.join(' ')}` }).toBe(true);

async function reglerEtiquettes(page: Page, piano?: string, guitareChoix?: string) {
  await ouvrir(page);
  if (piano) await choix(page, 'Touches du piano', piano).click();
  if (guitareChoix) await choix(page, 'Pastilles de la guitare', guitareChoix).click();
  await fermer(page);
}

test.describe('Touches du piano et pastilles de la guitare @parametres @ordinateur', () => {
  test('« Touches du piano » : Rien au départ ; Notes écrit A, C, E sur les touches de Am ; Degrés écrit 1, ♭3, 5 @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await caseN(page, 0, 1).click();   // Am
    await expect(touchesJouees(page)).toHaveCount(3);
    expect(await etiquettesPiano(page)).toEqual(['', '', '']);
    await reglerEtiquettes(page, 'Notes');
    await caseN(page, 0, 1).click();
    await expect.poll(() => etiquettesPiano(page)).toEqual(['A', 'C', 'E']);
    await reglerEtiquettes(page, 'Degrés');
    await caseN(page, 0, 1).click();
    await expect.poll(() => etiquettesPiano(page)).toEqual(['1', '♭3', '5']);
    await reglerEtiquettes(page, 'Rien');
    await caseN(page, 0, 1).click();
    await expect.poll(() => etiquettesPiano(page)).toEqual(['', '', '']);
    expect(await lireStockage(page, 'harmohubEtiquettesPiano')).toBe('rien');
    expect(garde.bloquees).toEqual([]);
  });

  test('« Pastilles de la guitare » : Rien au départ ; Notes écrit les noms de la tonalité ; Degrés écrit 1, ♭3, 5 dans les pastilles @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await boutonGuitare(page).click();
    await caseN(page, 0, 1).click();   // Am
    await expect(guitare(page).locator('svg')).toBeVisible();
    expect(await pastilles(page)).toEqual([]);
    await reglerEtiquettes(page, undefined, 'Notes');
    await caseN(page, 0, 1).click();
    await pastillesParmi(page, ['A', 'C', 'E']);   // les notes de Am, et aucune autre
    await reglerEtiquettes(page, undefined, 'Degrés');
    await caseN(page, 0, 1).click();
    await pastillesParmi(page, ['1', '♭3', '5']);
    await reglerEtiquettes(page, undefined, 'Rien');
    await caseN(page, 0, 1).click();
    await expect.poll(() => pastilles(page)).toEqual([]);
  });

  test('les deux réglages sont indépendants : Notes au piano n\'écrit rien sur la guitare, et inversement', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await boutonGuitare(page).click();
    await reglerEtiquettes(page, 'Notes', 'Rien');
    await caseN(page, 0, 1).click();
    await expect.poll(() => etiquettesPiano(page)).toEqual(['A', 'C', 'E']);
    expect(await pastilles(page)).toEqual([]);
    await reglerEtiquettes(page, 'Rien', 'Degrés');
    await caseN(page, 0, 1).click();
    await expect.poll(() => etiquettesPiano(page)).toEqual(['', '', '']);
    await expect.poll(async () => (await pastilles(page)).length).toBeGreaterThanOrEqual(3);
  });

  test('le choix est retenu après un rechargement (piano, guitare) @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await boutonGuitare(page).click();
    await reglerEtiquettes(page, 'Notes', 'Degrés');
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await caseN(page, 0, 1).click();
    await expect.poll(() => etiquettesPiano(page)).toEqual(['A', 'C', 'E']);
    await ouvrir(page);
    await expect(choix(page, 'Touches du piano', 'Notes')).toBeChecked();
    await expect(choix(page, 'Pastilles de la guitare', 'Degrés')).toBeChecked();
  });

  test('dans une tonalité à dièses (mi majeur), les noms de notes gardent leurs dièses : F# donne F#, A#, C#', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'F#', quality: '' }, { root: 'E', quality: '' }] });
    await boutonGuitare(page).click();
    await choisir(page, 'E');
    await fermerFenetre(page);
    await reglerEtiquettes(page, 'Notes', 'Notes');
    await caseN(page, 0, 0).click();
    await expect.poll(() => etiquettesPiano(page)).toEqual(expect.arrayContaining(['F#', 'A#', 'C#']));
    await pastillesParmi(page, ['F#', 'A#', 'C#']);
  });
});

test.describe('Notation des noms de notes : la tonalité décide des dièses et des bémols @parametres @ordinateur', () => {
  // Un accord de mi bémol, enregistré « D# » : en do majeur la grille et la fiche d'accord l'écrivent E♭, G, B♭.
  const MI_BEMOL = [{ root: 'D#', quality: '' }, { root: 'A', quality: 'min' }];

  test('référence : en do majeur, la grille et la fiche de l\'accord écrivent E♭ G B♭', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: MI_BEMOL });
    await caseN(page, 0, 0).click();
    await expect(caseN(page, 0, 0).locator('.cell-sym')).toHaveText('E♭');
    await expect(notesAccord(page)).toHaveText(['E♭', 'G', 'B♭']);
  });

  test('E-03 : « Pastilles de la guitare » écrit les notes de la tonalité (E♭ G B♭ en do), pas D# G A#', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: MI_BEMOL });
    await boutonGuitare(page).click();
    await reglerEtiquettes(page, undefined, 'Notes');
    await caseN(page, 0, 0).click();
    await expect.poll(async () => (await pastilles(page)).length).toBeGreaterThanOrEqual(3);
    expect([...new Set(await pastilles(page))].sort()).toEqual(['B♭', 'E♭', 'G']);
  });

  test('E-04 : « Notes du manche de dessin » écrit les notes de la tonalité (B♭, E♭ en do), pas A#, D#', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await boutonGuitare(page).click();
    await ouvrir(page);
    await interrupteur(page, NOM.nomsManche).click();
    await fermer(page);
    await caseN(page, 0, 0).click();
    await ouvrirEditeur(page);
    await ongletDessin(page).click();
    const noms = new Set(await nomsDuManche(page));
    for (const bemol of ['B♭', 'E♭', 'A♭', 'D♭', 'G♭']) expect(noms).toContain(bemol);
    for (const diese of ['A#', 'D#', 'G#', 'C#', 'F#']) expect(noms).not.toContain(diese);
  });

  test('E-05 : « Touches du piano » en mode Notes écrit les notes de la tonalité (E♭ G B♭ en do), comme la fiche de l\'accord', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: MI_BEMOL });
    await reglerEtiquettes(page, 'Notes');
    await caseN(page, 0, 0).click();
    await expect(notesAccord(page)).toHaveText(['E♭', 'G', 'B♭']);
    await expect.poll(() => etiquettesPiano(page)).toEqual(expect.arrayContaining(['E♭', 'B♭']));
  });
});

test.describe('Manche de dessin @parametres @ordinateur', () => {
  test('« Notes du manche de dessin » : éteint au départ, le manche vide est muet ; allumé, il écrit le nom de chaque case (6 cordes, de la case 0 à la 24) @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await boutonGuitare(page).click();
    await caseN(page, 0, 0).click();
    await ouvrirEditeur(page);
    await ongletDessin(page).click();
    await expect(manche(page).locator('svg')).toBeVisible();
    expect(await nomsDuManche(page)).toEqual([]);
    await fermerEditeur(page).click();
    await expect(page.getByRole('dialog', { name: 'Édition manuelle — Guitare' })).toBeHidden();

    await ouvrir(page);
    await expect(interrupteur(page, NOM.nomsManche)).toHaveAttribute('aria-checked', 'false');
    await interrupteur(page, NOM.nomsManche).click();
    await expect(interrupteur(page, NOM.nomsManche)).toHaveAttribute('aria-checked', 'true');
    await fermer(page);
    await caseN(page, 0, 0).click();
    await ouvrirEditeur(page);
    await ongletDessin(page).click();
    await expect.poll(async () => (await nomsDuManche(page)).length).toBe(150);   // 6 cordes × 25 cases (0 à 24)
    const noms = await nomsDuManche(page);
    // à vide, de la corde grave à la corde aiguë : mi, la, ré, sol, si, mi
    expect([0, 25, 50, 75, 100, 125].map(i => noms[i])).toEqual(['E', 'A', 'D', 'G', 'B', 'E']);
    // une octave plus haut (case 12) on retrouve la même note
    expect([12, 37, 62, 87, 112, 137].map(i => noms[i])).toEqual(['E', 'A', 'D', 'G', 'B', 'E']);
    expect(await lireStockage(page, 'harmohubNomsMancheDessin')).toBe('1');
  });
});
