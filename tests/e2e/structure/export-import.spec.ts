// MODULE « structure » — l'arrangement VOYAGE avec le morceau : export JSON puis import, sans perte (×N, noms, commentaires, ordre), et un fichier ANCIEN sans
// structure s'ouvre normalement (structure déduite de la grille). Plan : tests/PLAN-structure.md, point D.
import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import {
  morceauTroisParties, ouvrirStructure, retourGrille, lire, titresLignes, repsLignes, plus, monter, renommer, commenter, appuyer, structureDuMorceau,
  structureStockee,
} from './aide-structure';
import {
  telecharger, jsonDe, fichierJson, preparerImport, choisirDansMenuMorceau, ouvrirMenuMorceau, menuMorceau, morceauxStockes, ouvrirMesMorceaux, ligne, fenetreMorceaux,
} from '../fichiers/aide-fichiers';

async function exporterCeMorceau(page: Page) {
  await ouvrirMenuMorceau(page);
  await menuMorceau(page).getByRole('menuitem', { name: 'Exporter…' }).click();
  return jsonDe(await telecharger(page, () => page.getByText('Ce morceau', { exact: true }).click()));
}
async function arranger(page: Page) {
  await ouvrirStructure(page);
  await appuyer(page, plus(page, 0));
  await appuyer(page, plus(page, 0));                               // Couplet ×3
  await renommer(page, 1, 'Refrain final');
  await commenter(page, 1, 'à fond, tout le monde');
  await appuyer(page, monter(page, 2));                             // Pont avant Refrain final : Couplet, Pont, Refrain final
}
// Importe `sauvegarde` (après l'avoir modifiée par `f`) sous un autre identifiant et ouvre le morceau obtenu.
async function importerEtOuvrir(page: Page, sauvegarde: any, nom: string, f: (s: any) => void = () => {}) {
  const copie = JSON.parse(JSON.stringify(sauvegarde));
  const s = copie.songs[0];
  s.id = 'importe-' + nom; s.name = nom;
  f(s);
  await preparerImport(page, fichierJson(`${nom}.json`, copie));
  await choisirDansMenuMorceau(page, 'Importer…');
  await expect.poll(async () => (await morceauxStockes(page)).map(m => m.name)).toContain(nom);
  await ouvrirMesMorceaux(page);
  await ligne(page, nom).getByRole('button', { name: 'Ouvrir' }).click();
  await expect(fenetreMorceaux(page)).toBeHidden();
}

test.describe('Export et import de l\'arrangement @structure', () => {
  test('l\'export JSON d\'un morceau arrangé porte la structure telle quelle ; l\'import la rend sans perte @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await arranger(page);
    const attendu = await structureDuMorceau(page);
    expect(attendu.map(o => [o.rep, o.label, o.notes.length])).toEqual([[3, '', 0], [1, '', 0], [1, 'Refrain final', 1]]);
    await retourGrille(page);
    const j = await exporterCeMorceau(page);
    expect(j.songs[0].structure).toEqual(attendu);                      // octet pour octet : ×N, nom, commentaire, ordre, identités
    await importerEtOuvrir(page, j, 'Importé');
    await ouvrirStructure(page);
    expect(await titresLignes(page)).toEqual(['Couplet', 'Pont', 'Refrain final']);
    expect(await repsLignes(page)).toEqual(['×3', '', '']);
    expect((await lire(page)).lignes[2].notes).toEqual(['à fond, tout le monde']);
    expect(await structureStockee(page)).toEqual(attendu);
    expect(await structureDuMorceau(page)).toEqual(attendu);
  });

  test('un fichier ANCIEN, sans clé « structure » : la structure est déduite de la grille, rien ne plante', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await appuyer(page, plus(page, 0));
    await retourGrille(page);
    const j = await exporterCeMorceau(page);
    await importerEtOuvrir(page, j, 'Ancien', (s) => { delete s.structure; s.sections.forEach((p: any) => { delete p.sid; }); });
    await ouvrirStructure(page);
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Pont']);
    expect(await repsLignes(page)).toEqual(['', '', '']);
    expect((await lire(page)).mesures).toBe('9 mesures');
    expect(garde.erreurs ?? []).toEqual([]);
  });

  test('une structure qui cite une partie inconnue : la ligne est barrée (« partie supprimée »), les autres comptent, rien ne plante', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await arranger(page);
    await retourGrille(page);
    const j = await exporterCeMorceau(page);
    await importerEtOuvrir(page, j, 'Orpheline', (s) => { s.structure[1].sid = 'p-inconnue'; });
    await ouvrirStructure(page);
    const v = await lire(page);
    expect(v.lignes).toHaveLength(3);
    expect(v.lignes[1].mesures).toMatch(/n'existe plus/);
    expect(v.mesures).toBe('13 mesures');                              // Couplet ×3 (9) + Refrain final (4) ; Pont, devenu orphelin, ne compte pas
  });
});
