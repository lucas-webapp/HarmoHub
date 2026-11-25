// MODULE « grille » — le panneau du clavier au chargement (ES-18, essai neutre du 20/11) : rien n'est choisi, il montre le PREMIER accord du morceau
// et non le « C · C E G » du formulaire d'accord par défaut. Il ne sélectionne rien : l'aperçu est silencieux.
import { test, expect } from '../support/fixtures';
import { reglagesMorceau, caseN, selectionnees } from './aide-grille';

const titreClavier = (page: import('@playwright/test').Page) => page.locator('#current-chord-display .chord-title');

test.describe('Accord montré au repos @grille', () => {
  test('au chargement, le clavier montre le premier accord du morceau (Am), sans rien sélectionner @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: reglagesMorceau([{ titre: 'Couplet', accords: [{ root: 'A', quality: 'min' }, { root: 'C', quality: '' }, { root: 'F', quality: '' }, { root: 'G', quality: '' }] }]) });
    await expect(titreClavier(page)).toHaveText('Am');
    await expect(page.locator('#current-chord-display .chord-notes')).toContainText('E');
    await expect(selectionnees(page)).toHaveCount(0);   // l'aperçu ne choisit rien
  });

  test('choisir un accord remplace l\'aperçu de repos ; un morceau en Do majeur montre toujours C', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: reglagesMorceau([{ titre: 'Couplet', accords: [{ root: 'D', quality: 'min' }, { root: 'G', quality: '' }] }]) });
    await expect(titreClavier(page)).toHaveText('Dm');
    await caseN(page, 0, 1).click();
    await expect(titreClavier(page)).toHaveText('G');
  });
});
