// MODULE « structure » — ajouter une occurrence (liste « + Partie… »), et le menu d'une ligne : Dupliquer, Renommer (cette occurrence seulement),
// commentaires, Supprimer (retire de la structure, PAS de la grille). Menu : clic droit à l'ordinateur, appui long au téléphone.
import { test, expect } from '../support/fixtures';
import {
  morceauTroisParties, ouvrirStructure, retourGrille, lire, titresLignes, repsLignes, lignes, ligne, ajoutPartie, ajouterPartie, ouvrirMenu, choisirAction,
  actionMenu, menuLigne, renommer, commenter, champRenommer, dialogueRenommer, champCommentaire, dialogueCommentaire, appuyer,
  structureStockee, noms, titres, titresParties, fenetre, plus,
} from './aide-structure';

const NEUF_ACCORDS = ['C', 'Am', 'F', 'G', 'F', 'C', 'G', 'Dm', 'G7'];

test.describe('Ajouter une partie à la structure @structure', () => {
  test('la liste propose chaque partie de la grille avec son nombre d\'emplois @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await expect(ajoutPartie(page).locator('option')).toHaveText(['+ Partie…', 'Couplet (déjà 1×)', 'Refrain (déjà 1×)', 'Pont (déjà 1×)']);
    await expect(ajoutPartie(page)).toHaveValue('');   // « + Partie… » est la valeur par défaut
  });

  test('choisir une partie l\'ajoute en fin de structure ; la liste revient sur « + Partie… » @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ajouterPartie(page, /^Pont/);
    await expect(lignes(page)).toHaveCount(4);
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Pont', 'Pont']);
    const v = await lire(page);
    expect(v.deroule).toBe('Couplet · Refrain · Pont · Pont');
    expect(v.lignes.map(l => l.position)).toEqual(['mes. 1–3', 'mes. 4–7', 'mes. 8–9', 'mes. 10–11']);
    expect(v.mesures).toBe('11 mesures');
    expect(v.duree).toBe('0 min 22 s à 120 BPM');
    expect(v.parties).toBe('4 partie(s)');                // compte les occurrences
    await expect(ajoutPartie(page).locator('option')).toHaveText(['+ Partie…', 'Couplet (déjà 1×)', 'Refrain (déjà 1×)', 'Pont (déjà 2×)']);
    await expect(ajoutPartie(page)).toHaveValue('');
    expect((await structureStockee(page)).length).toBe(4);
    expect(garde.bloquees).toEqual([]);
  });

  test('ajouter une partie n\'en crée pas dans la grille', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ajouterPartie(page, /^Couplet/);
    await expect(lignes(page)).toHaveCount(4);
    await retourGrille(page);
    expect(await titres(page)).toEqual(['Couplet', 'Refrain', 'Pont']);
    expect(await noms(page)).toEqual(NEUF_ACCORDS);
  });

  test('on peut ajouter plusieurs fois la même partie, puis les distinguer par leur position', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ajouterPartie(page, /^Refrain/);
    await ajouterPartie(page, /^Couplet/);
    await ajouterPartie(page, /^Refrain/);
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Pont', 'Refrain', 'Couplet', 'Refrain']);
    const v = await lire(page);
    expect(v.lignes.map(l => l.position)).toEqual(['mes. 1–3', 'mes. 4–7', 'mes. 8–9', 'mes. 10–13', 'mes. 14–16', 'mes. 17–20']);
    await expect(ajoutPartie(page).locator('option')).toHaveText(['+ Partie…', 'Couplet (déjà 2×)', 'Refrain (déjà 3×)', 'Pont (déjà 1×)']);
  });
});

test.describe('Menu d\'une ligne @structure', () => {
  test('le menu propose Dupliquer, Renommer, Ajouter un commentaire et Supprimer', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ouvrirMenu(page, 1);
    const m = menuLigne(page);
    await expect(m.getByRole('button')).toHaveCount(4);
    await expect(actionMenu(page, /^Dupliquer/)).toContainText('Une occurrence de plus, sans copier d\'accords');
    await expect(actionMenu(page, /^Renommer/)).toContainText('Seulement cette occurrence');
    await expect(actionMenu(page, /^Ajouter un commentaire/)).toContainText('batterie uniquement');
    await expect(actionMenu(page, /^Supprimer/)).toContainText('La retire de la structure, pas de la grille');
  });

  test('un clic à côté referme le menu sans rien faire', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ouvrirMenu(page, 0);
    await appuyer(page, fenetre(page).locator('.struct-somme'));
    await expect(menuLigne(page)).toBeHidden();
    await expect(fenetre(page)).toBeVisible();
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Pont']);
  });

  test('Échap referme le menu et laisse la fenêtre ouverte @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ouvrirMenu(page, 0);
    await page.keyboard.press('Escape');
    await expect(menuLigne(page)).toBeHidden();
    await expect(fenetre(page)).toBeVisible();
  });

  test('un simple toucher sur une ligne n\'ouvre pas le menu @mobile', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ligne(page, 1).locator('.struct-title').tap();
    await expect(menuLigne(page)).toBeHidden();
    await ouvrirMenu(page, 1);   // l'appui long, lui, l'ouvre
    await expect(menuLigne(page)).toBeVisible();
  });
});

test.describe('Dupliquer @structure', () => {
  test('« Dupliquer » ajoute une occurrence juste après, sans copier d\'accords @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await choisirAction(page, 1, /^Dupliquer/);
    await expect(lignes(page)).toHaveCount(4);
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Refrain', 'Pont']);
    const v = await lire(page);
    expect(v.deroule).toBe('Couplet · Refrain · Refrain · Pont');
    expect(v.mesures).toBe('13 mesures');
    expect(v.lignes.map(l => l.position)).toEqual(['mes. 1–3', 'mes. 4–7', 'mes. 8–11', 'mes. 12–13']);
    expect(v.lignes[2].accords).toBe(v.lignes[1].accords);
    await expect(ajoutPartie(page).locator('option')).toContainText(['+ Partie…', 'Couplet (déjà 1×)', 'Refrain (déjà 2×)', 'Pont (déjà 1×)']);
    await retourGrille(page);
    expect(await titres(page)).toEqual(['Couplet', 'Refrain', 'Pont']);   // aucune partie copiée dans la grille
    expect(await noms(page)).toEqual(NEUF_ACCORDS);
  });

  test('la copie garde le nombre de répétitions de l\'original', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await appuyer(page, plus(page, 2));
    await choisirAction(page, 2, /^Dupliquer/);
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Pont', 'Pont']);
    expect(await repsLignes(page)).toEqual(['', '', '×2', '×2']);
    expect((await lire(page)).mesures).toBe('15 mesures');   // 3 + 4 + 2×2 + 2×2
  });
});

test.describe('Renommer une occurrence @structure', () => {
  test('« Renommer » ouvre une fenêtre pré-remplie avec le nom courant', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await choisirAction(page, 1, /^Renommer/);
    await expect(dialogueRenommer(page)).toBeVisible();
    await expect(champRenommer(page)).toHaveValue('Refrain');
    await expect(dialogueRenommer(page).getByRole('button', { name: 'Valider' })).toBeVisible();
    await expect(dialogueRenommer(page).getByRole('button', { name: 'Annuler' })).toBeVisible();
  });

  test('le nouveau nom s\'affiche dans la ligne et dans le déroulé, pas dans la grille @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await renommer(page, 1, 'Final');
    expect(await titresLignes(page)).toEqual(['Couplet', 'Final', 'Pont']);
    const v = await lire(page);
    expect(v.deroule).toBe('Couplet · Final · Pont');
    expect(v.lignes[1].accords).toBe('| F | % | C | G |');   // c'est toujours la même partie
    expect((await structureStockee(page))[1].label).toBe('Final');
    await retourGrille(page);
    expect(await titres(page)).toEqual(['Couplet', 'Refrain', 'Pont']);   // « Seulement cette occurrence » : le titre de la grille ne bouge pas
    expect(garde.bloquees).toEqual([]);
  });

  test('renommer une occurrence laisse l\'autre occurrence de la même partie sous son nom', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ajouterPartie(page, /^Pont/);
    await renommer(page, 3, 'Pont (fin)');
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Pont', 'Pont (fin)']);
    expect((await lire(page)).deroule).toBe('Couplet · Refrain · Pont · Pont (fin)');
  });

  test('le nom choisi survit au rechargement', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await renommer(page, 0, 'Intro');
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await ouvrirStructure(page);
    expect(await titresLignes(page)).toEqual(['Intro', 'Refrain', 'Pont']);
  });

  test('Entrée valide le nouveau nom ; « Annuler » le laisse tel quel @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await choisirAction(page, 0, /^Renommer/);
    await champRenommer(page).fill('Annulé');
    await dialogueRenommer(page).getByRole('button', { name: 'Annuler' }).click();
    await expect(dialogueRenommer(page)).toBeHidden();
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Pont']);
    await choisirAction(page, 0, /^Renommer/);
    await champRenommer(page).fill('Intro');
    await champRenommer(page).press('Enter');
    await expect(dialogueRenommer(page)).toBeHidden();
    expect(await titresLignes(page)).toEqual(['Intro', 'Refrain', 'Pont']);
  });

  test('un nom vide rend à l\'occurrence le nom de sa partie', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await renommer(page, 2, 'Solo');
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Solo']);
    await renommer(page, 2, '');
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Pont']);
    expect((await structureStockee(page))[2].label).toBe('');
  });

  test('Échap dans la fenêtre « Renommer » ne ferme qu\'elle, la structure reste ouverte (R-02) @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await choisirAction(page, 1, /^Renommer/);
    await champRenommer(page).fill('XXX');
    await page.keyboard.press('Escape');
    await expect(dialogueRenommer(page)).toBeHidden();
    await expect(fenetre(page)).toBeVisible();
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Pont']);
  });
});

test.describe('Commentaires d\'une occurrence @structure', () => {
  test('« Ajouter un commentaire » l\'affiche sous les accords de la ligne @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await choisirAction(page, 0, /^Ajouter un commentaire/);
    await expect(dialogueCommentaire(page)).toBeVisible();
    await expect(champCommentaire(page)).toHaveAttribute('placeholder', /batterie uniquement/);
    await champCommentaire(page).fill('batterie seule');
    await appuyer(page, dialogueCommentaire(page).getByRole('button', { name: 'Valider' }));
    await expect(dialogueCommentaire(page)).toBeHidden();
    const v = await lire(page);
    expect(v.lignes[0].notes).toEqual(['batterie seule']);
    expect(v.lignes[1].notes).toEqual([]);
    expect((await structureStockee(page))[0].notes).toEqual([{ texte: 'batterie seule' }]);
  });

  test('on peut ajouter plusieurs commentaires à la même ligne', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await commenter(page, 1, 'mes. 4 : basse seule');
    await commenter(page, 1, 'mes. 6 : tout le monde');
    expect((await lire(page)).lignes[1].notes).toEqual(['mes. 4 : basse seule', 'mes. 6 : tout le monde']);
  });

  test('toucher un commentaire permet de le modifier @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await commenter(page, 0, 'batterie seule');
    await appuyer(page, ligne(page, 0).locator('.struct-note').first());
    await expect(dialogueCommentaire(page)).toBeVisible();
    await expect(dialogueCommentaire(page)).toHaveAccessibleName('Modifier le commentaire');
    await expect(champCommentaire(page)).toHaveValue('batterie seule');
    await champCommentaire(page).fill('batterie et basse');
    await appuyer(page, dialogueCommentaire(page).getByRole('button', { name: 'Valider' }));
    await expect(dialogueCommentaire(page)).toBeHidden();
    expect((await lire(page)).lignes[0].notes).toEqual(['batterie et basse']);
  });

  test('« Supprimer » dans la fenêtre du commentaire le retire', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await commenter(page, 0, 'à retirer');
    await commenter(page, 0, 'à garder');
    await appuyer(page, ligne(page, 0).locator('.struct-note').first());
    await appuyer(page, dialogueCommentaire(page).getByRole('button', { name: 'Supprimer' }));
    await expect(dialogueCommentaire(page)).toBeHidden();
    expect((await lire(page)).lignes[0].notes).toEqual(['à garder']);
    expect((await structureStockee(page))[0].notes).toEqual([{ texte: 'à garder' }]);
  });

  test('« Annuler » ne crée aucun commentaire', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await choisirAction(page, 0, /^Ajouter un commentaire/);
    await champCommentaire(page).fill('perdu');
    await appuyer(page, dialogueCommentaire(page).getByRole('button', { name: 'Annuler' }));
    await expect(dialogueCommentaire(page)).toBeHidden();
    expect((await lire(page)).lignes[0].notes).toEqual([]);
  });

  test('un commentaire survit au rechargement', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await commenter(page, 2, 'ralentir');
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await ouvrirStructure(page);
    expect((await lire(page)).lignes[2].notes).toEqual(['ralentir']);
  });

  test('Échap dans la fenêtre « Commentaire » ne ferme qu\'elle, la structure reste ouverte (R-02) @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await choisirAction(page, 0, /^Ajouter un commentaire/);
    await champCommentaire(page).fill('perdu');
    await page.keyboard.press('Escape');
    await expect(dialogueCommentaire(page)).toBeHidden();
    await expect(fenetre(page)).toBeVisible();
  });
});

test.describe('Supprimer une occurrence @structure', () => {
  test('« Supprimer » retire la ligne de la structure, pas la partie de la grille @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await choisirAction(page, 1, /^Supprimer/);
    await expect(lignes(page)).toHaveCount(2);
    expect(await titresLignes(page)).toEqual(['Couplet', 'Pont']);
    const v = await lire(page);
    expect(v.deroule).toBe('Couplet · Pont');
    expect(v.mesures).toBe('5 mesures');
    expect(v.parties).toBe('2 partie(s)');
    expect(v.lignes.map(l => l.position)).toEqual(['mes. 1–3', 'mes. 4–5']);
    await expect(ajoutPartie(page).locator('option')).toHaveText(['+ Partie…', 'Couplet (déjà 1×)', 'Refrain (pas encore utilisée)', 'Pont (déjà 1×)']);
    await retourGrille(page);
    expect(await titres(page)).toEqual(['Couplet', 'Refrain', 'Pont']);
    expect(await noms(page)).toEqual(NEUF_ACCORDS);                      // la partie et ses accords sont toujours dans la grille
    expect(garde.bloquees).toEqual([]);
  });

  test('une partie retirée se rajoute depuis la liste, en fin de structure', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await choisirAction(page, 0, /^Supprimer/);
    expect(await titresLignes(page)).toEqual(['Refrain', 'Pont']);
    await ajouterPartie(page, /^Couplet/);
    expect(await titresLignes(page)).toEqual(['Refrain', 'Pont', 'Couplet']);
    expect((await lire(page)).deroule).toBe('Refrain · Pont · Couplet');
  });

  test('retirer toutes les occurrences laisse une structure vide, la grille intacte', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    for (let i = 0; i < 3; i++) await choisirAction(page, 0, /^Supprimer/);
    await expect(lignes(page)).toHaveCount(0);
    const v = await lire(page);
    expect(v.mesures).toBe('0 mesures');
    expect(v.parties).toBe('0 partie(s)');
    await expect(ajoutPartie(page).locator('option')).toHaveText(['+ Partie…', 'Couplet (pas encore utilisée)', 'Refrain (pas encore utilisée)', 'Pont (pas encore utilisée)']);
    expect(await structureStockee(page)).toEqual([]);
    await retourGrille(page);
    expect(await noms(page)).toEqual(NEUF_ACCORDS);
    expect(await titresParties(page).count()).toBe(3);
  });

  test('la suppression est immédiate, sans demande de confirmation', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    const boites: string[] = [];
    page.on('dialog', d => { boites.push(d.type() + ':' + d.message()); void d.dismiss(); });
    await ouvrirStructure(page);
    await choisirAction(page, 2, /^Supprimer/);
    await expect(lignes(page)).toHaveCount(2);
    expect(boites).toEqual([]);
  });
});
