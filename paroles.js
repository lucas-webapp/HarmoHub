'use strict';
// Paroles — HarmoHub : outil compagnon À PART (voir paroles.html). Reçoit un JSON exporté par
// HarmoHub (bouton "Exporter pour paroles", voir exportLyricsData dans script.js) : parties + accords
// (symbole + durée), rien d'autre — ni voicing, ni instrument. Le placement des accords sur le texte
// est ENTIÈREMENT MANUEL (retour utilisateur : "positionner précisément et manuellement au-dessus du
// texte") : deux modes possibles par accord posé —
//   - "syllabe" (par défaut) : accroché au caractère le plus proche du clic (via caretRangeFromPoint),
//     donc précis à la syllabe près et STABLE si le texte se redispose ensuite (contrairement à des
//     coordonnées pixel figées) ;
//   - "libre" : position horizontale libre (%), pour les cas sans caractère à accrocher (fin de ligne,
//     ligne encore vide) — mais la position VERTICALE n'est jamais libre, dans AUCUN des deux modes :
//     elle se verrouille toujours sur la ligne de texte visée (voir getVisualLines/renderPills), pour
//     que tous les accords d'une même ligne s'alignent pile à la même hauteur (retour utilisateur :
//     "aligner les accords au-dessus du texte verticalement... forcer sur une ligne au-dessus de
//     chaque ligne de texte").
// Persistance en localStorage (voir STORAGE_PREFIX/storageKeyForSong) : ce fichier ne dépend d'aucun
// serveur, comme le reste de HarmoHub. L'enregistrement est visible (voir #save-status) plutôt que
// silencieux : retour utilisateur "assure-toi que les enregistrements sont bien réalisés, avec
// messages d'erreur si nécessaire".

const STORAGE_PREFIX = 'harmohub_lyrics_v1_';

const state = {
    song: null,          // { version, song, songId, beatsPerBar, sections: [{ title, chords: [{symbol,beats}], _placements }] }
    armed: null,         // { si, ci } | null — accord actuellement "en main", prêt à être posé
    freeMode: false,
    sectionEls: [],       // [{ pool, wrap, text }] par section, remplis une seule fois par buildSectionsDOM
};

// Pile d'annulation (voir pushUndoSnapshot/undo/redo plus bas) : déclarée ICI, tout en haut, et pas
// juste avant son usage — resetUndoHistory() est appelée dès l'import automatique au chargement de la
// page (voir tryAutoImportFromHarmoHub), qui s'exécute AVANT tout code de plus bas dans ce fichier ;
// un "let" déclaré plus loin resterait dans sa zone morte temporelle à ce moment-là (ReferenceError).
const UNDO_GROUP_WINDOW = 1000; // ms : au-delà, la frappe suivante ouvre une NOUVELLE étape
const MAX_UNDO = 100;
let undoStack = [];
let redoStack = [];

// Identifiant unique par emplacement posé (voir placeArmedAt) : un même accord (chordIndex) peut
// désormais être posé plusieurs fois dans une section (retour utilisateur : "utiliser autant de fois
// que je veux le même accord dans une section") — chordIndex seul ne suffit donc plus à distinguer un
// exemplaire posé d'un autre pour le retirer/repositionner.
let placementIdCounter = 0;
function nextPlacementId() {
    placementIdCounter += 1;
    return `pl-${Date.now().toString(36)}-${placementIdCounter}`;
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Préférences d'affichage (globales, pas liées à un morceau précis) ----------

const PREFS_KEY = 'harmohub_lyrics_prefs';
// `chain` : après avoir posé un accord, armer AUTOMATIQUEMENT le suivant de la grille. Les accords
// d'une partie arrivent dans l'ordre où on les joue, et c'est dans cet ordre qu'on les pose sur le
// texte — enchaîner fait donc tomber le coût d'un accord de deux clics (choisir, poser) à un seul
// (poser). Mesuré sur une progression de huit accords : 16 clics avant, 9 après.
// Reste débrayable : poser plusieurs fois LE MÊME accord d'affilée (mode tampon) était un usage
// explicitement demandé, et c'est exactement ce que l'enchaînement empêcherait.
const prefs = { fontSize: 1, chain: true };
(function loadPrefs() {
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        if (raw) Object.assign(prefs, JSON.parse(raw));
    } catch (e) { console.error('Préférences Paroles illisibles :', e); }
})();

function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); }
    catch (e) { console.error('Impossible d\'enregistrer les préférences Paroles :', e); }
}

function applyPrefs() {
    document.documentElement.style.setProperty('--lyrics-fs', prefs.fontSize + 'rem');
    document.getElementById('opt-font-size').value = prefs.fontSize;
    document.getElementById('opt-font-size-value').textContent = Math.round(prefs.fontSize * 100) + '%';
    document.getElementById('opt-chain').checked = prefs.chain !== false;
    // La taille de police change la disposition du texte (retours à la ligne) : il faut refaire le
    // rendu des pastilles pour rester alignées avec le texte tel qu'il s'affiche maintenant.
    if (state.song) refreshAllPoolsAndPills();
}
applyPrefs();

document.getElementById('btn-options').addEventListener('click', () => {
    const panel = document.getElementById('options-panel');
    panel.hidden = !panel.hidden;
});
document.getElementById('opt-font-size').addEventListener('input', (e) => {
    prefs.fontSize = parseFloat(e.target.value);
    savePrefs();
    applyPrefs();
});
document.getElementById('opt-chain').addEventListener('change', (e) => {
    prefs.chain = e.target.checked;
    savePrefs();
    updateModeUI(); // l'indication d'armement annonce l'accord suivant : elle change avec ce réglage
});
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Trois barres se superposent en haut de page quand on fait défiler : l'en-tête, la barre d'outils, et
// la réserve d'accords de la partie en cours. Leurs décalages étaient écrits en dur dans le CSS, ce
// qui supposait une hauteur d'en-tête fixe — or il passe sur deux lignes dès que l'écran se rétrécit.
// Mesuré sur un écran de téléphone : l'en-tête faisait 98 px alors que la barre d'outils se calait à
// 58 px, donc Annuler/Rétablir et le choix du mode se retrouvaient CACHÉS derrière lui dès le premier
// défilement. On mesure donc les hauteurs réelles et on empile à partir d'elles.
function syncStickyOffsets() {
    const bar = document.querySelector('.top-bar');
    const toolbar = document.getElementById('toolbar');
    if (!bar) return;
    const barH = Math.ceil(bar.getBoundingClientRect().height);
    // Hauteur de la barre d'outils hors défilement : la mesurer alors qu'elle est déjà collée en haut
    // donnerait sa position, pas sa taille — c'est bien `height` qu'on lit, jamais `top`.
    const toolH = (toolbar && !toolbar.hidden) ? Math.ceil(toolbar.getBoundingClientRect().height) : 0;
    const root = document.documentElement;
    root.style.setProperty('--sticky-top-bar', barH + 'px');
    root.style.setProperty('--sticky-pool', (barH + toolH) + 'px');
}
window.addEventListener('resize', () => syncStickyOffsets());
// L'en-tête change de hauteur quand son contenu apparaît (nom du morceau, boutons d'export révélés à
// l'import) : on le remesure alors, sans attendre un redimensionnement de fenêtre qui pourrait ne
// jamais venir.
if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => syncStickyOffsets());
    const barEl = document.querySelector('.top-bar');
    if (barEl) ro.observe(barEl);
    const tbEl = document.getElementById('toolbar');
    if (tbEl) ro.observe(tbEl);
}
syncStickyOffsets();

function slugForSong(name) {
    return (name || 'Sans titre').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
}

// Clé de session : préfère l'identifiant STABLE du morceau (songId, voir exportLyricsData dans
// script.js) au seul nom affiché — deux morceaux de même nom (ou renommés depuis) ne doivent jamais
// se marcher dessus. Repli sur le nom seul pour un fichier exporté avant l'ajout de songId (vieux
// export encore sur le disque de l'utilisateur).
function storageKeyForSong(song) {
    return song.songId ? `${STORAGE_PREFIX}id-${song.songId}` : `${STORAGE_PREFIX}name-${slugForSong(song.song)}`;
}

// ---------- Bandeaux de notification (avertissements/erreurs visibles, pas juste la console) ----------

function showBanner(text, kind = 'info') {
    const host = document.getElementById('banners');
    const el = document.createElement('div');
    el.className = `banner banner-${kind}`;
    el.innerHTML = `<span>${escapeHtml(text)}</span><button type="button" class="banner-close" aria-label="Fermer">×</button>`;
    el.querySelector('.banner-close').addEventListener('click', () => el.remove());
    host.appendChild(el);
    return el;
}

// ---------- État d'enregistrement (voir #save-status) ----------

function setSaveStatus(kind, detail) {
    const el = document.getElementById('save-status');
    if (!el) return;
    el.classList.remove('save-pending', 'save-ok', 'save-error');
    if (kind === 'pending') {
        el.textContent = 'Enregistrement…';
        el.classList.add('save-pending');
        el.title = '';
    } else if (kind === 'ok') {
        const t = new Date();
        el.textContent = `Enregistré ✓ ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
        el.classList.add('save-ok');
        el.title = '';
    } else {
        el.textContent = '⚠ Échec de l\'enregistrement';
        el.classList.add('save-error');
        el.title = detail || '';
    }
}

// ---------- Persistance ----------

let saveTimer = null;

// Écriture proprement dite, factorisée pour être appelable soit après le délai anti-rebond normal
// (voir saveSession), soit IMMÉDIATEMENT (voir "beforeunload" plus bas) — sans ça, fermer l'onglet ou
// naviguer moins de 350ms après une dernière frappe perdrait cette toute dernière modification, jamais
// écrite (retour utilisateur : "assure-toi que les enregistrements sont bien réalisés").
function writeSessionNow() {
    if (!state.song) return;
    const payload = {
        songName: state.song.song,
        sections: state.song.sections.map(sec => ({
            lyricsHtml: sec._lyricsHtml || '',
            placements: sec._placements || [],
            repeatCount: sec._repeatCount || 1,
        })),
    };
    try {
        localStorage.setItem(storageKeyForSong(state.song), JSON.stringify(payload));
        setSaveStatus('ok');
    } catch (e) {
        // Ex. quota localStorage dépassé, ou navigation privée qui bloque l'écriture — retour
        // utilisateur explicite : "assure-toi que les enregistrements sont bien réalisés, avec
        // messages d'erreur si nécessaire", pas juste une trace dans la console que personne ne
        // regarde.
        console.error('Sauvegarde paroles impossible :', e);
        setSaveStatus('error', e && e.message);
        showBanner(
            "Échec de l'enregistrement des paroles (stockage plein, ou navigation privée ?). Tes dernières modifications ne sont peut-être pas conservées — exporte/imprime par précaution avant de fermer cet onglet.",
            'error'
        );
    }
}

function saveSession() {
    if (!state.song) return;
    setSaveStatus('pending');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(writeSessionNow, 350);
}

// Filet de sécurité : si une écriture est encore en attente (dans les 350ms) au moment de fermer
// l'onglet/naviguer ailleurs, on la force IMMÉDIATEMENT plutôt que de la laisser expirer dans le vide.
window.addEventListener('beforeunload', () => {
    if (saveTimer) { clearTimeout(saveTimer); writeSessionNow(); }
});

function loadSavedSession(song) {
    const key = storageKeyForSong(song);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (e) {
        // Session illisible (localStorage corrompu/tronqué) : le signale plutôt que de repartir de
        // zéro sans un mot — l'utilisateur pourrait croire que ses paroles n'ont jamais été perdues.
        console.error('Session paroles illisible :', e);
        showBanner("La session précédente de ce morceau était illisible (données corrompues) — on repart d'une page vierge pour ne pas bloquer, mais tes anciennes paroles n'ont pas pu être récupérées.", 'error');
        return null;
    }
}

// ---------- Import ----------

function loadSong(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.sections)) {
        alert("Fichier invalide — utilise le fichier téléchargé depuis le bouton « Exporter pour paroles » de HarmoHub.");
        return;
    }
    document.getElementById('banners').innerHTML = '';
    const saved = loadSavedSession(data);
    let droppedPlacements = 0;
    data.sections.forEach((sec, si) => {
        const savedSec = saved && saved.sections && saved.sections[si];
        sec._lyricsHtml = savedSec ? (savedSec.lyricsHtml || '') : '';
        // Défensif : ignore un emplacement dont l'accord référencé n'existe plus (le morceau a pu
        // changer côté HarmoHub depuis le dernier export) — plutôt que de planter ou d'afficher une
        // pastille orpheline. Compté pour prévenir l'utilisateur (voir plus bas), pas juste ignoré en
        // silence.
        const rawPlacements = savedSec ? (savedSec.placements || []) : [];
        sec._placements = rawPlacements.filter(p => p.chordIndex < sec.chords.length);
        // Compatibilité ascendante : une session enregistrée avant l'ajout du "tampon" (accord posé
        // plusieurs fois, voir armChord/placeArmedAt) n'a pas d'id unique par emplacement — on le
        // complète ici pour que retrait/déplacement par id fonctionnent aussi sur d'anciennes données.
        sec._placements.forEach(p => { if (!p.id) p.id = nextPlacementId(); });
        droppedPlacements += rawPlacements.length - sec._placements.length;
        // Nombre de répétitions d'affilée (voir buildSectionMeta) : propre à Paroles, absent des
        // anciennes sessions enregistrées avant cet ajout — 1 par défaut (aucune répétition en plus).
        sec._repeatCount = (savedSec && savedSec.repeatCount) || 1;
    });
    state.song = data;
    state.armed = null;
    resetUndoHistory(); // l'historique d'annulation d'un AUTRE morceau n'a pas de sens ici

    document.getElementById('empty-state').hidden = true;
    document.getElementById('toolbar').hidden = false;
    document.getElementById('btn-export-pdf').hidden = false;
    document.getElementById('btn-export-text').hidden = false;
    const nameEl = document.getElementById('song-name');
    nameEl.hidden = false;
    nameEl.textContent = data.song;

    buildSectionsDOM();
    updateModeUI();

    if (droppedPlacements > 0) {
        showBanner(
            `Le morceau a changé dans HarmoHub depuis ta dernière session ici : ${droppedPlacements} accord(s) posé(s) référençaient des accords qui n'existent plus et ont été retiré(s). Vérifie le placement de tes accords.`,
            'warning'
        );
    }
    setSaveStatus('ok'); // la session vient d'être chargée telle quelle : rien à réécrire pour l'instant
}

document.getElementById('btn-import').addEventListener('click', () => document.getElementById('file-input').click());
document.getElementById('file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try { loadSong(JSON.parse(reader.result)); }
        catch (err) { alert('Impossible de lire ce fichier JSON.'); }
    };
    reader.readAsText(file);
    e.target.value = ''; // permet de réimporter le même fichier plusieurs fois de suite
});
// Bascule le mode "impression/PDF" (voir la classe .pdf-export-mode dans paroles.css) : une VRAIE
// impression navigateur (Ctrl+P, ou l'imprimante système) reste possible en secours, et partage les
// mêmes règles de mise en forme que notre propre export PDF ci-dessous plutôt que deux jeux dupliqués.
window.addEventListener('beforeprint', () => document.body.classList.add('pdf-export-mode'));
window.addEventListener('afterprint', () => document.body.classList.remove('pdf-export-mode'));

// Export PDF réel (jsPDF + html2canvas, même recette que exportPdf dans script.js de HarmoHub) —
// remplace l'ancien bouton "Imprimer" qui ne faisait qu'ouvrir la boîte d'impression du navigateur :
// retour utilisateur, "les accords ne ressortent pas sur le PDF actuellement, je vois que le texte"
// (les pastilles, positionnées en absolu, se perdaient selon la pagination du navigateur). html2canvas
// rastérise le DOM tel qu'il est RÉELLEMENT affiché à l'écran (mode .pdf-export-mode activé juste
// avant) : les pastilles s'y retrouvent forcément, quel que soit le navigateur.
async function exportLyricsPdf() {
    if (!state.song) return;
    const btn = document.getElementById('btn-export-pdf');
    const blocks = Array.from(document.querySelectorAll('#sections .section-block'));
    if (!blocks.length) { showBanner('Rien à exporter — importe un morceau avant.', 'warning'); return; }

    btn.disabled = true;
    document.body.classList.add('pdf-export-mode');
    // Rastériser plusieurs sections prend quelques secondes (voir la boucle html2canvas plus bas) :
    // un bandeau visible plutôt qu'un bouton silencieusement désactivé, pour ne pas laisser croire que
    // rien ne se passe (même esprit que "assure-toi que les enregistrements sont bien réalisés, avec
    // messages d'erreur si nécessaire" d'un retour précédent).
    const pendingBanner = showBanner('Génération du PDF…', 'info');
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const margin = 10;
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const maxW = pageW - margin * 2, maxH = pageH - margin * 2;

        // Un canvas par SECTION (pas un seul pour tout le morceau) : chacune saute proprement à la
        // page suivante si elle ne tient plus dans le reste de la page courante, sans jamais être
        // coupée en plein milieu entre deux pages.
        let cursorYmm = margin;
        let isFirstBlock = true;
        for (const block of blocks) {
            const canvas = await window.html2canvas(block, { scale: 2, backgroundColor: '#ffffff' });
            const ratio = canvas.width / canvas.height;
            let imgW = maxW, imgH = imgW / ratio;
            if (imgH > maxH) { imgH = maxH; imgW = imgH * ratio; } // section très longue : bornée par la hauteur de page

            if (!isFirstBlock && cursorYmm + imgH > margin + maxH) {
                pdf.addPage();
                cursorYmm = margin;
            }
            isFirstBlock = false;
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, cursorYmm, imgW, imgH);
            cursorYmm += imgH + 6; // petit espace entre deux sections sur la même page
        }

        const title = state.song.song || 'Sans titre';
        pdf.save(`${title.replace(/[\\/:*?"<>|]+/g, '_')} - paroles.pdf`);
        pendingBanner.remove();
    } catch (err) {
        console.error('Export PDF Paroles impossible :', err);
        pendingBanner.remove();
        showBanner("Échec de l'export PDF — réessaie, ou utilise Ctrl+P (Imprimer) en secours.", 'error');
    } finally {
        document.body.classList.remove('pdf-export-mode');
        btn.disabled = false;
    }
}
document.getElementById('btn-export-pdf').addEventListener('click', () => exportLyricsPdf());

// Export texte brut : lisible n'importe où (éditeur de texte, mail, autre appareil), pas seulement
// dans un navigateur — contrairement à Imprimer/PDF. Liste les accords de chaque partie PUIS ses
// paroles telles quelles, sans tenter de reproduire au caractère près le placement visuel (une
// reconstruction fiable en ASCII demanderait de rejouer toute la mise en page du texte — bien plus
// fragile que de laisser le navigateur l'afficher lui-même, voir les pastilles à l'écran/à
// l'impression) : ce fichier sert de sauvegarde/référence portable, pas de copie exacte de la vue.
document.getElementById('btn-export-text').addEventListener('click', () => {
    if (!state.song) return;
    const title = state.song.song || 'Sans titre';
    let out = `${title}\n${'='.repeat(title.length)}\n\n`;
    state.song.sections.forEach((sec, si) => {
        const secTitle = sec.title || `Partie ${si + 1}`;
        out += `[${secTitle}]\n`;
        if (sec.chords.length) out += `Accords : ${sec.chords.map(c => c.symbol).join(', ')}\n`;
        const lyrics = (state.sectionEls[si].text.innerText || '').trim();
        out += lyrics ? `\n${lyrics}\n\n` : '\n';
    });
    const blob = new Blob([out], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[\\/:*?"<>|]+/g, '_')} - paroles.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
});

// ---------- Récupération automatique depuis HarmoHub (même navigateur) ----------
// Voir exportLyricsData dans script.js : en plus du fichier téléchargé (utile pour partager/changer
// d'appareil), les mêmes données sont déposées ici — évite de repasser par "Importer un fichier" à
// chaque export (retour utilisateur : "il faut réimporter un morceau ensuite"). Consommé une seule
// fois (retiré aussitôt lu) : une visite ultérieure de cette page (favori, retour en arrière) retombe
// normalement sur le morceau déjà ouvert dans CETTE page, pas sur un réimport fantôme.
const PENDING_IMPORT_KEY = 'harmohub_lyrics_pending_import';
(function tryAutoImportFromHarmoHub() {
    try {
        const raw = localStorage.getItem(PENDING_IMPORT_KEY);
        if (!raw) return;
        localStorage.removeItem(PENDING_IMPORT_KEY);
        loadSong(JSON.parse(raw));
    } catch (e) { console.error('Récupération automatique depuis HarmoHub impossible :', e); }
})();

// ---------- Construction du DOM (une seule fois par import) ----------

function buildSectionsDOM() {
    const host = document.getElementById('sections');
    host.innerHTML = '';
    state.sectionEls = [];

    state.song.sections.forEach((sec, si) => {
        const block = document.createElement('div');
        block.className = 'section-block';

        const titleRow = document.createElement('div');
        titleRow.className = 'section-title-row';
        const title = document.createElement('div');
        title.className = 'section-title';
        title.textContent = sec.title || `Partie ${si + 1}`;
        titleRow.appendChild(title);

        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'btn-reset-section';
        // Icône "rotate-ccw" (même famille que les flèches Annuler/Rétablir de la barre d'outils, voir
        // paroles.html) plutôt qu'une simple corbeille : cette action ne SUPPRIME rien pour de bon
        // (Ctrl+Z la défait), elle "revient en arrière" comme un vrai reset, pas une suppression.
        resetBtn.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg> Réinitialiser';
        resetBtn.title = 'Efface les paroles et les accords posés de cette partie (les accords eux-mêmes restent disponibles dans la réserve)';
        resetBtn.addEventListener('click', () => {
            const label = sec.title || `Partie ${si + 1}`;
            if (!confirm(`Effacer les paroles et tous les accords posés de « ${label} » ? (Ctrl+Z pour annuler si besoin.)`)) return;
            pushUndoSnapshot();
            sec._lyricsHtml = '';
            sec._placements = [];
            state.sectionEls[si].text.innerHTML = '';
            syncPlainText(si); // même raison que dans restoreSnapshot
            if (state.armed && state.armed.si === si) state.armed = null;
            saveSession();
            renderPool(si);
            renderPills(si);
            updateModeUI();
        });
        titleRow.appendChild(resetBtn);
        block.appendChild(titleRow);
        const meta = buildSectionMeta(sec);
        block.appendChild(meta);

        const pool = document.createElement('div');
        pool.className = 'chord-pool';
        block.appendChild(pool);

        if (!sec.chords.length) {
            const note = document.createElement('div');
            note.className = 'no-chords-note';
            note.textContent = 'Aucun accord dans cette partie.';
            block.appendChild(note);
        }

        const wrap = document.createElement('div');
        wrap.className = 'lyrics-wrap';
        const text = document.createElement('div');
        text.className = 'lyrics-text';
        text.contentEditable = 'true';
        text.spellcheck = false;
        text.innerHTML = sec._lyricsHtml || '';
        wrap.appendChild(text);
        block.appendChild(wrap);

        host.appendChild(block);
        state.sectionEls[si] = { pool, wrap, text, meta };
        syncPlainText(si); // référence de départ pour le recalage des ancres (voir remapPlacementOffsets)

        // --- Écouteurs (posés une seule fois, jamais reconstruits) ---
        text.addEventListener('input', () => {
            // Regroupe les frappes rapprochées en UNE SEULE étape d'annulation (voir UNDO_GROUP_WINDOW) :
            // la photo est prise AVANT de mettre à jour sec._lyricsHtml, donc elle capture bien le texte
            // tel qu'il était juste avant CETTE frappe (la première du groupe).
            const now = Date.now();
            if (now - (sec._lastEditAt || 0) > UNDO_GROUP_WINDOW) pushUndoSnapshot();
            sec._lastEditAt = now;
            // Recale les ancres AVANT tout le reste : le texte vient de changer sous elles, et une
            // ancre est une position de caractère (voir remapPlacementOffsets). L'instantané
            // d'annulation ci-dessus a déjà copié les emplacements, on peut donc les modifier ici.
            const nouveauTexte = plainTextOf(text);
            remapPlacementOffsets(sec, sec._plainText || '', nouveauTexte);
            sec._plainText = nouveauTexte;
            sec._lyricsHtml = text.innerHTML;
            saveSession();
            renderPills(si); // le texte a pu se redisposer : les pastilles ancrées à un caractère suivent
        });

        // Collage : on ne garde que le TEXTE. Sans ça, coller ses paroles depuis un traitement de texte
        // ou une note téléphone injectait la mise en forme d'origine telle quelle — mesuré : du Georgia
        // rouge 32 px sur fond jaune au milieu des paroles, impossible à enlever sans tout retaper.
        // Les retours à la ligne, eux, sont conservés : c'est la seule chose qui compte vraiment dans
        // des paroles collées.
        text.addEventListener('paste', (e) => {
            e.preventDefault();
            const brut = (e.clipboardData || window.clipboardData).getData('text/plain') || '';
            if (!brut) return;
            const html = brut.replace(/\r\n?/g, '\n').split('\n').map(escapeHtml).join('<br>');
            // execCommand plutôt qu'une insertion à la main : il respecte la sélection en cours, la
            // position du curseur après coup, et déclenche l'événement `input` ci-dessus — donc le
            // recalage des ancres et l'enregistrement se font tout seuls, sans code en double.
            document.execCommand('insertHTML', false, html);
        });

        // Glisser-déposer une pastille déjà posée (retour utilisateur : "je dois pouvoir déplacer
        // l'accord si je l'ai mal placé sur la ligne") : en plus du clic (reprendre puis reposer
        // ailleurs, voir pickUpPlacement/placeArmedAt), on peut désormais la faire glisser directement
        // d'un seul geste. `dragState` suit le pointeur en cours ; `suppressNextClick` évite que le
        // `click` que le navigateur envoie juste après un pointerup ne déclenche AUSSI la logique de
        // reprise-au-clic ci-dessous pour ce même geste.
        let dragState = null;
        let suppressNextClick = false;
        const DRAG_THRESHOLD = 6; // px : en-deçà, on considère que c'est un simple clic, pas un glisser

        wrap.addEventListener('pointerdown', (e) => {
            const pill = e.target.closest('.lyric-pill');
            if (!pill || e.target.dataset.del) return;
            dragState = {
                placementId: pill.dataset.placementId,
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                moved: false,
            };
            pill.setPointerCapture(e.pointerId);
        });

        wrap.addEventListener('pointermove', (e) => {
            if (!dragState || dragState.pointerId !== e.pointerId) return;
            const dx = e.clientX - dragState.startX;
            const dy = e.clientY - dragState.startY;
            if (!dragState.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
            dragState.moved = true;
            const pill = wrap.querySelector(`.lyric-pill[data-placement-id="${dragState.placementId}"]`);
            if (!pill) return;
            pill.classList.add('dragging');
            // Aperçu en direct : suit le pointeur en X, se cale sur la ligne de texte la plus proche en
            // Y (même verrouillage qu'à la pose, voir placeArmedAt) — l'utilisateur voit tout de suite
            // sur quelle ligne l'accord va retomber avant même de relâcher.
            const wrapRect = wrap.getBoundingClientRect();
            const lines = getVisualLines(text);
            const lineIdx = lines.length ? nearestLineIndex(lines, e.clientY) : 0;
            const lineTop = lines[lineIdx] ? lines[lineIdx].top : wrapRect.top;
            const xClamped = clamp(e.clientX, wrapRect.left, wrapRect.right);
            pill.style.left = (xClamped - wrapRect.left) + 'px';
            pill.style.top = (lineTop - wrapRect.top - 20) + 'px';
        });

        wrap.addEventListener('pointerup', (e) => {
            if (!dragState || dragState.pointerId !== e.pointerId) return;
            const { placementId, moved } = dragState;
            dragState = null;
            if (!moved) return; // pas un glisser : laisse le gestionnaire "click" ci-dessous s'en charger
            suppressNextClick = true;
            // Filet de sécurité : movePlacementTo() reconstruit la pastille (renderPills), donc l'élément
            // qui a reçu ce pointerup est DÉTACHÉ du DOM avant même que le "click" de suivi du navigateur
            // ne se déclenche — cet événement ne remonte alors JAMAIS jusqu'au gestionnaire ci-dessous
            // pour remettre le drapeau à false, qui resterait bloqué à `true` et avalerait silencieusement
            // le TOUT PROCHAIN clic sur une pastille. On le retombe donc aussi tout seul peu après, que le
            // "click" ait été reçu ou non (s'il l'a été, il l'aura déjà remis à false entre-temps).
            setTimeout(() => { suppressNextClick = false; }, 400);
            movePlacementTo(si, placementId, e.clientX, e.clientY);
        });

        wrap.addEventListener('click', (e) => {
            if (suppressNextClick) { suppressNextClick = false; return; }
            const pill = e.target.closest('.lyric-pill');
            if (pill) {
                e.stopPropagation();
                const ci = +pill.dataset.chordIndex;
                const placementId = pill.dataset.placementId;
                if (e.target.dataset.del) removePlacement(si, placementId);
                else pickUpPlacement(si, ci, placementId); // reprend CET exemplaire précis pour le replacer
                return;
            }
            if (state.armed && state.armed.si === si) placeArmedAt(si, e);
        });

        window.addEventListener('resize', debounce(() => renderPills(si), 150));

        renderPool(si);
        renderPills(si);
    });
}

// Ligne de métadonnées sous le titre de chaque section (retour utilisateur : "je ne veux plus le
// numéro de mesure en début de phrase" — remplacé par des informations plus utiles au niveau de la
// section elle-même) : le nombre total de mesures de la grille, et le nombre de fois où l'on rejoue
// cette section d'affilée (répétition purement indicative, propre à Paroles — HarmoHub n'a pas cette
// notion, voir _repeatCount, saisie et enregistrée ici). Présentation volontairement sobre : un simple
// texte "N mesures" et un petit compteur "× N" à côté, pas de tableau ni d'icônes superflues.
function buildSectionMeta(sec) {
    const meta = document.createElement('div');
    meta.className = 'section-meta';
    meta.refreshRepeatUI = () => {}; // remplacé plus bas s'il y a un compteur de répétitions à afficher

    const beatsPerBar = state.song.beatsPerBar || 4;
    const totalBeats = sec.chords.reduce((sum, c) => sum + (c.beats || 0), 0);
    const totalMeasures = Math.round(totalBeats / beatsPerBar);

    const measuresEl = document.createElement('span');
    measuresEl.className = 'section-measures';
    measuresEl.textContent = totalMeasures > 0
        ? `${totalMeasures} mesure${totalMeasures > 1 ? 's' : ''}`
        : 'Aucun accord';
    meta.appendChild(measuresEl);

    if (totalMeasures > 0) {
        const repeatWrap = document.createElement('div');
        repeatWrap.className = 'section-repeat';
        repeatWrap.title = 'Nombre de fois où cette partie est rejouée d\'affilée (repère purement indicatif)';

        const minusBtn = document.createElement('button');
        minusBtn.type = 'button';
        minusBtn.className = 'repeat-btn';
        minusBtn.textContent = '−';
        minusBtn.setAttribute('aria-label', 'Une répétition de moins');

        const valueEl = document.createElement('span');
        valueEl.className = 'repeat-value';

        const plusBtn = document.createElement('button');
        plusBtn.type = 'button';
        plusBtn.className = 'repeat-btn';
        plusBtn.textContent = '+';
        plusBtn.setAttribute('aria-label', 'Une répétition de plus');

        const refreshRepeatUI = () => {
            valueEl.textContent = `× ${sec._repeatCount}`;
            minusBtn.disabled = sec._repeatCount <= 1;
        };
        refreshRepeatUI();
        meta.refreshRepeatUI = refreshRepeatUI; // pour resynchroniser l'affichage après un Annuler/Rétablir

        const changeRepeat = (delta) => {
            pushUndoSnapshot();
            sec._repeatCount = clamp((sec._repeatCount || 1) + delta, 1, 99);
            refreshRepeatUI();
            saveSession();
        };
        minusBtn.addEventListener('click', () => changeRepeat(-1));
        plusBtn.addEventListener('click', () => changeRepeat(1));

        repeatWrap.appendChild(minusBtn);
        repeatWrap.appendChild(valueEl);
        repeatWrap.appendChild(plusBtn);
        meta.appendChild(repeatWrap);
    }

    return meta;
}

// ---------- Réserve d'accords (pastilles cliquables, une par occurrence) ----------

function renderPool(si) {
    const sec = state.song.sections[si];
    const { pool } = state.sectionEls[si];
    pool.innerHTML = '';
    sec.chords.forEach((chord, ci) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chord-chip';
        // Un même accord peut être posé plusieurs fois (voir armChord/placeArmedAt), mais le NOMBRE
        // d'exemplaires ne s'affiche plus sur le chip (retour utilisateur : "je n'ai pas besoin du
        // nombre de fois que j'ai utilisé un accord") — seul l'état "déjà posé au moins une fois"
        // reste visible (classe .placed, chip estompé).
        const placedCount = (sec._placements || []).filter(p => p.chordIndex === ci).length;
        const isArmed = state.armed && state.armed.si === si && state.armed.ci === ci;
        if (placedCount > 0) chip.classList.add('placed');
        if (isArmed) chip.classList.add('armed');
        chip.textContent = chord.symbol;
        chip.title = isArmed
            ? 'Armé — clique dans le texte pour poser un exemplaire (reste armé pour en poser d\'autres), ou reclique ici pour désarmer'
            : (placedCount > 0
                ? 'Déjà posé — cliquer pour en poser un exemplaire de plus (glisse une pastille existante pour la déplacer)'
                : 'Cliquer puis clique dans le texte pour le poser');
        // Cliquer un accord l'ARME, toujours — même s'il l'était déjà. Ce clic désarmait auparavant,
        // ce qui se tenait tant qu'un accord ne pouvait être armé QUE par un clic. Depuis
        // l'enchaînement (voir prefs.chain), l'accord suivant s'arme tout seul : cliquer dessus veut
        // alors dire « c'est bien celui-là que je pose », et désarmer était précisément l'inverse de
        // l'intention — on cliquait, puis on cliquait dans le texte, et rien ne se posait.
        // Pour s'arrêter, il y a Échap et le bouton « Arrêter » de l'indication (voir updateModeUI),
        // qui a l'avantage d'exister aussi au doigt.
        chip.addEventListener('click', () => armChord(si, ci));
        pool.appendChild(chip);
    });
}

// ---------- Annuler / rétablir ----------
// Pile de "photos" de l'état complet (paroles + accords posés de TOUTES les parties), pas un journal
// d'actions détaillé — plus simple et fiable à restaurer d'un coup, même logique que l'annuler/rétablir
// de HarmoHub lui-même côté grille d'accords. Les frappes de texte sont REGROUPÉES (voir
// UNDO_GROUP_WINDOW) : sans ça, chaque caractère tapé ouvrirait sa propre étape, illisible à l'usage.
// (undoStack/redoStack/UNDO_GROUP_WINDOW/MAX_UNDO déclarés tout en haut du fichier, avec `state` : le
// "let" ci-dessous n'est PAS hissé comme une fonction — resetUndoHistory() est appelée dès l'import
// automatique au chargement de la page, voir tryAutoImportFromHarmoHub, qui s'exécute AVANT d'arriver
// jusqu'ici dans le fichier si ces variables étaient déclarées à cet endroit.)

function snapshotSections() {
    return state.song.sections.map(sec => ({
        lyricsHtml: sec._lyricsHtml || '',
        placements: JSON.parse(JSON.stringify(sec._placements || [])),
        repeatCount: sec._repeatCount || 1,
    }));
}

function pushUndoSnapshot() {
    if (!state.song) return;
    undoStack.push(snapshotSections());
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
    // Referme le groupe de frappe en cours : la PROCHAINE touche tapée doit ouvrir sa propre étape.
    // Sans ça, poser un accord puis retaper aussitôt (moins d'une seconde après la frappe précédente)
    // ne créait aucune étape pour cette frappe : elle rejoignait le groupe d'AVANT l'accord, et un seul
    // Ctrl+Z effaçait à la fois la correction de texte et l'accord qu'on venait de poser — l'accord
    // disparaissait sans qu'on ait rien demandé de tel.
    state.song.sections.forEach(sec => { sec._lastEditAt = 0; });
    updateUndoRedoUI();
}

function resetUndoHistory() {
    undoStack = [];
    redoStack = [];
    updateUndoRedoUI();
}

function restoreSnapshot(snap) {
    state.song.sections.forEach((sec, si) => {
        const s = snap[si] || { lyricsHtml: '', placements: [], repeatCount: 1 };
        sec._lyricsHtml = s.lyricsHtml;
        sec._placements = s.placements;
        sec._repeatCount = s.repeatCount || 1;
        state.sectionEls[si].text.innerHTML = sec._lyricsHtml;
        // Le texte vient d'être remplacé d'un bloc : la référence de recalage doit suivre, sinon la
        // PROCHAINE frappe se comparerait au texte d'avant l'annulation et décalerait tout (voir
        // remapPlacementOffsets).
        syncPlainText(si);
        state.sectionEls[si].meta.refreshRepeatUI();
    });
    state.armed = null;
    refreshAllPoolsAndPills();
    updateModeUI();
    saveSession();
}

function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshotSections());
    restoreSnapshot(undoStack.pop());
    updateUndoRedoUI();
}

function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshotSections());
    restoreSnapshot(redoStack.pop());
    updateUndoRedoUI();
}

function updateUndoRedoUI() {
    const u = document.getElementById('btn-undo');
    const r = document.getElementById('btn-redo');
    if (u) u.disabled = undoStack.length === 0;
    if (r) r.disabled = redoStack.length === 0;
}

document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-redo').addEventListener('click', redo);

// ---------- Armement / pose ----------

function armChord(si, ci) {
    // Armer ne touche plus à un éventuel emplacement déjà posé de CE MÊME accord : un accord peut
    // désormais être posé plusieurs fois dans la section (retour utilisateur : "utiliser autant de
    // fois que je veux le même accord dans une section"), donc l'armement n'a plus à en "ramasser" un
    // pour éviter un doublon — au contraire, on veut pouvoir en ajouter d'autres. Reprendre un
    // exemplaire déjà posé pour le déplacer se fait maintenant en cliquant DIRECTEMENT sur sa pastille
    // (voir pickUpPlacement), pas en ré-armant le chip de la réserve.
    state.armed = { si, ci };
    updateModeUI();
    refreshAllPoolsAndPills();
}

function disarm() {
    state.armed = null;
    updateModeUI();
    refreshAllPoolsAndPills();
}

// Retire UN exemplaire précis (par id unique), pas "l'emplacement de cet accord" — plusieurs
// exemplaires du même accord peuvent coexister dans la section (voir armChord).
function removePlacement(si, placementId) {
    pushUndoSnapshot();
    const sec = state.song.sections[si];
    sec._placements = (sec._placements || []).filter(p => p.id !== placementId);
    saveSession();
    refreshAllPoolsAndPills();
    updateModeUI();
}

// Clic sur le CORPS d'une pastille déjà posée (pas sa croix) : retire cet exemplaire précis et réarme
// le même accord pour le repositionner ailleurs — remplace l'ancien comportement où armer le chip de
// la réserve faisait ce "ramassage" (impossible désormais, puisqu'armer un chip ne doit plus faire
// disparaître les exemplaires déjà posés).
function pickUpPlacement(si, ci, placementId) {
    pushUndoSnapshot();
    const sec = state.song.sections[si];
    sec._placements = (sec._placements || []).filter(p => p.id !== placementId);
    state.armed = { si, ci };
    saveSession();
    refreshAllPoolsAndPills();
    updateModeUI();
}

// Résout où doit tomber un accord posé/déplacé à ce point (clientX/clientY) — partagé entre
// placeArmedAt (nouvelle pose) et movePlacementTo (glisser une pastille existante, voir plus bas) pour
// ne pas dupliquer la logique d'ancrage (syllabe vs libre, verrouillage de ligne). Retourne un objet de
// position SANS chordIndex ni id : à l'appelant de les compléter selon son cas d'usage.
function resolvePositionAt(si, clientX, clientY) {
    const { wrap, text } = state.sectionEls[si];
    const wrapRect = wrap.getBoundingClientRect();
    const noText = text.textContent.trim().length === 0;

    if (!state.freeMode && !noText) {
        const charIndex = caretOffsetFromPoint(text, clientX, clientY);
        if (charIndex != null) return { type: 'char', charIndex };
    }
    // Mode libre : seule la position HORIZONTALE reste libre — la verticale se verrouille sur la ligne
    // de texte la plus proche du point visé (retour utilisateur : "forcer sur une ligne au-dessus de
    // chaque ligne de texte"), jamais une position Y arbitraire. Section encore sans texte : ligne 0
    // par défaut (rien à mesurer, voir renderPills qui alors se rabat sur le haut de la zone).
    const lines = getVisualLines(text);
    const lineIndex = lines.length ? nearestLineIndex(lines, clientY) : 0;
    const xPct = ((clientX - wrapRect.left) / wrapRect.width) * 100;
    return { type: 'free', lineIndex, xPct: clamp(xPct, 0, 100) };
}

function placeArmedAt(si, e) {
    const sec = state.song.sections[si];
    const ci = state.armed.ci;
    const placement = resolvePositionAt(si, e.clientX, e.clientY);
    placement.chordIndex = ci;
    placement.id = nextPlacementId();

    // Cette pose ouvre sa propre étape d'annulation (armer ne le fait plus, voir armChord) : une pose
    // = une étape, indépendante de l'éventuel "ramassage" qui a précédé (voir pickUpPlacement, qui a
    // déjà sa propre étape).
    pushUndoSnapshot();
    sec._placements = sec._placements || [];
    sec._placements.push(placement);
    // On reste armé dans les deux cas — jamais de retour à « rien en main », qui obligerait à
    // retourner cliquer dans la réserve après chaque accord :
    //   - enchaînement (par défaut) : on passe à l'accord SUIVANT de la partie, puisque c'est dans cet
    //     ordre qu'on les pose sur le texte. Le tour boucle en fin de grille, une progression se
    //     répétant d'un couplet à l'autre.
    //   - tampon : on garde le même accord, pour en poser plusieurs exemplaires d'affilée.
    if (prefs.chain && sec.chords.length > 1) {
        state.armed = { si, ci: (ci + 1) % sec.chords.length };
    }
    saveSession();
    refreshAllPoolsAndPills();
    updateModeUI();
}

// Glisser-déposer une pastille déjà posée (voir pointerup dans buildSectionsDOM) : repositionne CET
// exemplaire précis (même id, même chordIndex) sans repasser par armer/pickUpPlacement — un seul geste
// plutôt que "reprendre au clic PUIS cliquer ailleurs" (retour utilisateur : "je dois pouvoir déplacer
// l'accord si je l'ai mal placé sur la ligne").
function movePlacementTo(si, placementId, clientX, clientY) {
    const sec = state.song.sections[si];
    const pl = (sec._placements || []).find(p => p.id === placementId);
    if (!pl) return;

    pushUndoSnapshot();
    const resolved = resolvePositionAt(si, clientX, clientY);
    // Efface les anciens champs de position avant d'appliquer les nouveaux — évite qu'un ancien
    // "charIndex" ou "lineIndex/xPct" traîne si le type d'ancrage change entre-temps (ex. glissé en
    // mode syllabe après avoir été posé libre). chordIndex + id (identité de l'exemplaire) restent.
    delete pl.type; delete pl.charIndex; delete pl.lineIndex; delete pl.xPct;
    Object.assign(pl, resolved);

    saveSession();
    refreshAllPoolsAndPills();
    updateModeUI();
}

function refreshAllPoolsAndPills() {
    state.song.sections.forEach((sec, si) => { renderPool(si); renderPills(si); });
}

// ---------- Ancrage au caractère (mode "syllabe") ----------

function textNodesOf(container) {
    const nodes = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
}

// Texte brut d'une zone de paroles, compté EXACTEMENT comme le sont les ancres (voir
// globalOffsetFromRange) : la simple concaténation des nœuds de texte, sans les sauts de ligne
// implicites des <div>/<br>. Les deux doivent compter pareil, sinon les ancres glisseraient d'un
// caractère par ligne.
function plainTextOf(container) {
    return textNodesOf(container).map(n => n.textContent).join('');
}

// Recale les ancres après une modification du texte.
// Sans ça, l'accrochage à la syllabe ne tenait que tant qu'on ne RETOUCHAIT PAS les paroles : une
// ancre est une position de caractère, donc insérer un mot en début de ligne décalait tout le texte
// sans décaler les accords, qui se retrouvaient une syllabe — ou dix — plus loin. C'était pourtant la
// promesse même du mode « syllabe », et le défaut ne se voyait qu'à l'usage : en corrigeant une faute
// de frappe APRÈS avoir posé ses accords, c'est-à-dire exactement ce qu'on fait en écrivant.
// Méthode : comparer l'ancien et le nouveau texte pour isoler la zone réellement modifiée (préfixe et
// suffixe communs), puis décaler les ancres situées après elle. C'est ainsi que tout éditeur entretient
// ses marques, et cela couvre d'un seul coup la frappe, l'effacement, le collage et le remplacement
// d'une sélection — sans avoir à distinguer les cas.
function remapPlacementOffsets(sec, oldText, newText) {
    if (oldText === newText) return;
    const anchored = (sec._placements || []).filter(p => p.type === 'char');
    if (!anchored.length) return;

    const maxCommon = Math.min(oldText.length, newText.length);
    let prefix = 0;
    while (prefix < maxCommon && oldText[prefix] === newText[prefix]) prefix++;
    let suffix = 0;
    while (suffix < maxCommon - prefix
        && oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]) suffix++;

    const delta = newText.length - oldText.length;
    const oldChangeEnd = oldText.length - suffix;
    anchored.forEach(p => {
        if (p.charIndex < prefix) return;                 // avant la retouche : rien ne bouge
        if (p.charIndex >= oldChangeEnd) {                // après : décalée d'exactement ce qui a changé
            p.charIndex += delta;
        } else {
            // L'ancre était DANS le passage réécrit. On la ramène au début de la zone plutôt que de la
            // supprimer : perdre un accord en silence parce qu'on a corrigé un mot serait bien pire que
            // de le retrouver un peu à gauche, où il reste visible et déplaçable d'un glissé.
            p.charIndex = prefix;
        }
        p.charIndex = clamp(p.charIndex, 0, newText.length);
    });
}

// Mémorise le texte courant d'une partie, référence pour le prochain recalage (voir ci-dessus).
// À appeler chaque fois que le texte change SANS passer par la frappe : chargement, annulation,
// réinitialisation — sinon le recalage suivant se ferait par rapport à un texte périmé.
function syncPlainText(si) {
    const sec = state.song.sections[si];
    sec._plainText = plainTextOf(state.sectionEls[si].text);
}

function globalOffsetFromRange(container, range) {
    let offset = 0;
    for (const node of textNodesOf(container)) {
        if (node === range.startContainer) return offset + range.startOffset;
        offset += node.textContent.length;
    }
    return offset;
}

function rangeFromGlobalOffset(container, globalOffset) {
    const nodes = textNodesOf(container);
    let remaining = globalOffset;
    for (const node of nodes) {
        if (remaining <= node.textContent.length) {
            const range = document.createRange();
            range.setStart(node, Math.max(0, remaining));
            range.collapse(true);
            return range;
        }
        remaining -= node.textContent.length;
    }
    if (nodes.length) {
        const last = nodes[nodes.length - 1];
        const range = document.createRange();
        range.setStart(last, last.textContent.length);
        range.collapse(true);
        return range;
    }
    return null;
}

function caretOffsetFromPoint(container, x, y) {
    let range = null;
    if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(x, y);
    } else if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(x, y);
        if (pos) { range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); }
    }
    if (!range || !container.contains(range.startContainer)) return null;
    return globalOffsetFromRange(container, range);
}

// ---------- Lignes visuelles du texte (pour verrouiller la hauteur des accords, voir plus bas) ----------
// Un rectangle par ligne VISUELLE (retour tapé OU habillage automatique dû à la largeur), quelle que
// soit la structure DOM en dessous (un <div> par ligne, des <br>, du texte brut...) — Range.
// getClientRects() les distingue déjà tout seul pour un contenu multi-lignes, bien plus robuste que
// d'interpréter la structure HTML nous-mêmes (qui varie d'un navigateur à l'autre).
function getVisualLines(textEl) {
    if (!textEl.firstChild) return [];
    // UNE range par enfant DIRECT du contenteditable, jamais une seule range couvrant tout le bloc :
    // une range qui traverse la frontière entre deux éléments de bloc (les <div> qu'un navigateur
    // insère à chaque Entrée) peut renvoyer un rectangle FANTÔME représentant la boîte du bloc entier
    // (pleine largeur du conteneur), pas le texte réel qu'il contient — faussant complètement le
    // regroupement par ligne juste en dessous. Mesurer chaque enfant à part l'évite d'emblée.
    const rects = [];
    Array.from(textEl.childNodes).forEach(node => {
        if (node.nodeName === 'BR') return;
        const range = document.createRange();
        range.selectNodeContents(node);
        const nodeRects = Array.from(range.getClientRects()).filter(r => r.width > 0 || r.height > 0);
        if (nodeRects.length) {
            rects.push(...nodeRects);
        } else if (node.nodeType !== Node.TEXT_NODE) {
            // Ligne vide (ex. un <div> ne contenant qu'un <br>, ou rien) : rien à mesurer dans son
            // CONTENU, mais sa propre boîte reste dimensionnée par la hauteur de ligne — sert
            // d'approximation pour ne pas perdre cette ligne (vide) du décompte.
            const rect = node.getBoundingClientRect();
            if (rect.height > 0) rects.push(rect);
        }
    });
    if (!rects.length) return [];
    const lines = [];
    rects.forEach(r => {
        // Un même mot/noeud peut être scindé en plusieurs rects sur une même ligne (ex. à cheval sur
        // deux éléments DOM) : fusionne tout ce qui partage sensiblement la même bande verticale.
        const existing = lines.find(l => Math.abs(l.top - r.top) < 2);
        if (existing) {
            existing.left = Math.min(existing.left, r.left);
            existing.right = Math.max(existing.right, r.right);
            existing.bottom = Math.max(existing.bottom, r.bottom);
        } else {
            lines.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
        }
    });
    lines.sort((a, b) => a.top - b.top);
    return lines;
}

// Ligne la plus proche d'une position Y (coordonnées écran) — sert au clic en mode libre : seule la
// position HORIZONTALE reste libre, la ligne visée elle-même se déduit du point cliqué le plus proche.
function nearestLineIndex(lines, clientY) {
    if (!lines.length) return -1;
    let best = 0, bestDist = Infinity;
    lines.forEach((l, i) => {
        const dist = Math.abs(clientY - (l.top + l.bottom) / 2);
        if (dist < bestDist) { bestDist = dist; best = i; }
    });
    return best;
}

// ---------- Rendu des pastilles posées ----------

// Index de la ligne (dans `lines`, voir getVisualLines) qui CONTIENT un rectangle donné — utilisé pour
// poser une pastille en mode "syllabe" (renderPills).
function lineIndexForRect(lines, rect) {
    const idx = lines.findIndex(l => rect.top >= l.top - 2 && rect.top <= l.bottom + 2);
    if (idx >= 0) return idx;
    return lines.length ? lines.length - 1 : -1;
}

// Écart minimal (px) entre deux pastilles voisines sur une même ligne (voir la passe d'anti-
// chevauchement plus bas) : évite que deux accords posés au même endroit (ou très proches — le mode
// "tampon", voir placeArmedAt, le permet désormais) se retrouvent totalement superposés et illisibles
// (retour utilisateur, capture d'écran à l'appui : deux pastilles "Em" fondues en un bloc illisible).
const PILL_MIN_GAP = 5;

// Centre Y du VRAI blanc disponible entre deux lignes (le bas de la ligne précédente et le haut de la
// ligne visée — ou le haut de la zone pour la 1ère ligne), plutôt qu'un décalage fixe en pixels depuis
// "line.top" : ce dernier ne suivait ni la taille de police (réglable, voir #opt-font-size) ni
// l'interligne réel, et pouvait faire déborder une pastille sur le texte de la ligne DU DESSUS (retour
// utilisateur, capture à l'appui : "le placement des accords est encore beaucoup trop aléatoire").
// Basé sur les rectangles RÉELLEMENT mesurés (voir getVisualLines) : robuste à tout changement de
// taille de police ou d'interligne, sans recalcul à la main.
function verticalSlotCenter(lines, lineIndex, wrapRect) {
    const line = lines[lineIndex];
    if (!line) return wrapRect.top;
    const prevBottom = lineIndex > 0 ? lines[lineIndex - 1].bottom : wrapRect.top;
    return (prevBottom + line.top) / 2;
}

function renderPills(si) {
    const sec = state.song.sections[si];
    const { wrap, text } = state.sectionEls[si];
    wrap.querySelectorAll('.lyric-pill, .line-divider').forEach(p => p.remove());
    const wrapRect = wrap.getBoundingClientRect();
    const lines = getVisualLines(text);

    // Passe 1 : construit chaque pastille et sa position BRUTE (avant anti-chevauchement), mais ne la
    // positionne pas encore — il faut d'abord la mesurer une fois posée dans le DOM (largeur ET hauteur
    // réelles, variables selon le symbole/la taille de police) pour l'écarter d'une voisine trop proche
    // et la centrer verticalement dans l'espace réservé (voir verticalSlotCenter).
    const built = [];
    (sec._placements || []).forEach(pl => {
        const chord = sec.chords[pl.chordIndex];
        if (!chord) return;
        const pill = document.createElement('div');
        pill.className = 'lyric-pill';
        pill.dataset.chordIndex = pl.chordIndex;
        pill.dataset.placementId = pl.id;
        pill.innerHTML = `${escapeHtml(chord.symbol)}<span class="pill-del" data-del="1" title="Retirer">×</span>`;

        let x, lineTop;
        if (pl.type === 'char') {
            const range = rangeFromGlobalOffset(text, pl.charIndex);
            if (!range) return;
            const rects = range.getClientRects();
            const rect = (rects && rects[0]) || range.getBoundingClientRect();
            x = rect.left;
            // Verrouille la HAUTEUR sur la ligne qui CONTIENT ce caractère (pas le rect du caractère
            // lui-même, qui peut dévier de quelques sous-pixels d'un caractère à l'autre sur la même
            // ligne) : tous les accords d'une même ligne s'alignent ainsi exactement à la même hauteur
            // (retour utilisateur : "aligner les accords au-dessus du texte verticalement").
            const li = lineIndexForRect(lines, rect);
            lineTop = li >= 0 ? verticalSlotCenter(lines, li, wrapRect) : rect.top;
        } else {
            // Mode libre : horizontal libre (xPct, % de la largeur totale de la zone), mais la hauteur
            // est TOUJOURS celle d'UNE ligne entière (lineIndex), jamais une position Y arbitraire
            // (retour utilisateur : "laisser libre uniquement en horizontal, forcer sur une ligne
            // au-dessus de chaque ligne de texte").
            const lineIndex = clamp(pl.lineIndex ?? 0, 0, Math.max(0, lines.length - 1));
            x = wrapRect.left + (pl.xPct / 100) * wrapRect.width;
            lineTop = lines[lineIndex] ? verticalSlotCenter(lines, lineIndex, wrapRect) : wrapRect.top;
        }

        wrap.appendChild(pill); // pas encore positionnée : juste pour pouvoir mesurer sa taille réelle
        built.push({ pl, pill, x, lineTop });
    });

    // Passe 2 : anti-chevauchement, ligne par ligne (regroupées par leur "lineTop" exact — deux
    // pastilles de la même ligne visuelle partagent TOUJOURS la même valeur, verrouillée juste
    // au-dessus). À largeur/symbole égal, l'ordre de POSE (celui du tableau _placements) l'emporte :
    // la pastille posée en premier garde sa position brute, celles qui suivent et la chevaucheraient
    // sont décalées vers la droite d'une par une plutôt que de rester empilées.
    const byLine = new Map();
    built.forEach(b => {
        const key = Math.round(b.lineTop);
        if (!byLine.has(key)) byLine.set(key, []);
        byLine.get(key).push(b);
    });
    byLine.forEach(group => {
        group.sort((a, b) => a.x - b.x);
        let prevRightEdge = -Infinity;
        group.forEach(b => {
            const halfWidth = b.pill.offsetWidth / 2;
            const minX = prevRightEdge + halfWidth + PILL_MIN_GAP;
            b.finalX = Math.max(b.x, minX);
            prevRightEdge = b.finalX + halfWidth;
        });
    });

    built.forEach(b => {
        b.pill.style.left = (b.finalX - wrapRect.left) + 'px';
        // `lineTop` est désormais le CENTRE Y de l'espace réservé (voir verticalSlotCenter) : on centre
        // donc la pastille dessus via sa hauteur réelle, pas un simple décalage fixe.
        b.pill.style.top = (b.lineTop - wrapRect.top - b.pill.offsetHeight / 2) + 'px';
    });

    renderLineDividers(lines, wrapRect, wrap);
}

// ---------- Séparation ligne d'accords / ligne de texte (retour utilisateur : "il faut différencier
// une ligne texte et une ligne accords, séparation discrète et fine") ----------
// Un simple filet fin, juste au-dessus de chaque ligne de texte détectée : marque clairement la
// frontière entre la zone réservée aux accords (au-dessus) et le texte lui-même (en dessous), plutôt
// que de laisser les deux zones se fondre visuellement l'une dans l'autre.
function renderLineDividers(lines, wrapRect, wrap) {
    lines.forEach(line => {
        const divider = document.createElement('div');
        divider.className = 'line-divider';
        divider.style.top = (line.top - wrapRect.top - 3) + 'px';
        wrap.appendChild(divider);
    });
}

// ---------- Mode syllabe / libre ----------

document.getElementById('mode-syllable').addEventListener('click', () => setFreeMode(false));
document.getElementById('mode-free').addEventListener('click', () => setFreeMode(true));

function setFreeMode(v) {
    state.freeMode = v;
    updateModeUI();
}

function updateModeUI() {
    document.getElementById('mode-syllable').classList.toggle('active', !state.freeMode);
    document.getElementById('mode-free').classList.toggle('active', state.freeMode);

    const hint = document.getElementById('armed-hint');
    if (state.armed && state.song) {
        const sec = state.song.sections[state.armed.si];
        const chord = sec.chords[state.armed.ci];
        hint.hidden = false;
        // Annonce aussi CE QUI VIENDRA ENSUITE quand l'enchaînement est actif : on pose alors une
        // progression entière sans quitter le texte des yeux, et savoir d'avance quel accord arrive
        // évite de devoir vérifier la réserve entre chaque clic.
        const suivant = (prefs.chain && sec.chords.length > 1)
            ? sec.chords[(state.armed.ci + 1) % sec.chords.length]
            : null;
        hint.innerHTML = `Clique dans le texte pour poser <strong>${escapeHtml(chord.symbol)}</strong>`
            + (suivant ? ` <span class="hint-next">puis ${escapeHtml(suivant.symbol)}</span>` : '')
            + ` <button type="button" id="hint-stop" class="hint-stop" title="Arrêter de poser (Échap)">Arrêter</button>`;
        // Un vrai bouton, pas seulement la mention « Échap » : au doigt il n'y a pas de touche Échap,
        // et depuis que cliquer un accord ne le désarme plus (voir renderPool), il n'existerait
        // sinon aucun moyen de reposer l'accord en main sur un téléphone.
        hint.querySelector('#hint-stop').addEventListener('click', (e) => { e.stopPropagation(); disarm(); });
    } else {
        hint.hidden = true;
    }

    state.sectionEls.forEach(({ wrap }) => {
        wrap.classList.toggle('armable', !!state.armed);
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.armed) { disarm(); return; }
    // Intercepte Ctrl/Cmd+Z même quand le focus est DANS la zone de paroles (contenteditable) : sans
    // preventDefault ici, le navigateur déclencherait EN PLUS son propre "annuler" natif du champ, qui
    // ne connaît rien de nos accords posés — deux historiques divergents plutôt qu'un seul cohérent.
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
});

// ---------- Utilitaire ----------

function debounce(fn, ms) {
    let t = null;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
