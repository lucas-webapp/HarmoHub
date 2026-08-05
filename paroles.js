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
const prefs = { fontSize: 1, showMeasureNumbers: false };
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
    document.getElementById('opt-show-measure-numbers').checked = prefs.showMeasureNumbers;
    // La taille de police change la disposition du texte (retours à la ligne) et le réglage des
    // numéros de mesure change la marge réservée à gauche : les deux demandent de refaire le rendu des
    // pastilles/numéros pour rester alignés avec le texte tel qu'il s'affiche maintenant.
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
document.getElementById('opt-show-measure-numbers').addEventListener('change', (e) => {
    prefs.showMeasureNumbers = e.target.checked;
    savePrefs();
    applyPrefs();
});

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

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
    });
    state.song = data;
    state.armed = null;
    resetUndoHistory(); // l'historique d'annulation d'un AUTRE morceau n'a pas de sens ici

    document.getElementById('empty-state').hidden = true;
    document.getElementById('toolbar').hidden = false;
    document.getElementById('btn-print').hidden = false;
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
document.getElementById('btn-print').addEventListener('click', () => window.print());

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
            if (state.armed && state.armed.si === si) state.armed = null;
            saveSession();
            renderPool(si);
            renderPills(si);
            updateModeUI();
        });
        titleRow.appendChild(resetBtn);
        block.appendChild(titleRow);

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
        state.sectionEls[si] = { pool, wrap, text };

        // --- Écouteurs (posés une seule fois, jamais reconstruits) ---
        text.addEventListener('input', () => {
            // Regroupe les frappes rapprochées en UNE SEULE étape d'annulation (voir UNDO_GROUP_WINDOW) :
            // la photo est prise AVANT de mettre à jour sec._lyricsHtml, donc elle capture bien le texte
            // tel qu'il était juste avant CETTE frappe (la première du groupe).
            const now = Date.now();
            if (now - (sec._lastEditAt || 0) > UNDO_GROUP_WINDOW) pushUndoSnapshot();
            sec._lastEditAt = now;
            sec._lyricsHtml = text.innerHTML;
            saveSession();
            renderPills(si); // le texte a pu se redisposer : les pastilles ancrées à un caractère suivent
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
        chip.addEventListener('click', () => {
            if (isArmed) disarm();
            else armChord(si, ci);
        });
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
    }));
}

function pushUndoSnapshot() {
    if (!state.song) return;
    undoStack.push(snapshotSections());
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
    updateUndoRedoUI();
}

function resetUndoHistory() {
    undoStack = [];
    redoStack = [];
    updateUndoRedoUI();
}

function restoreSnapshot(snap) {
    state.song.sections.forEach((sec, si) => {
        const s = snap[si] || { lyricsHtml: '', placements: [] };
        sec._lyricsHtml = s.lyricsHtml;
        sec._placements = s.placements;
        state.sectionEls[si].text.innerHTML = sec._lyricsHtml;
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
    // Reste armé ("mode tampon") : ne PAS désarmer ici, pour pouvoir reposer d'autres exemplaires du
    // même accord ailleurs sans avoir à recliquer sur son chip à chaque fois (retour utilisateur :
    // "utiliser autant de fois que je veux le même accord"). Un clic sur le chip déjà armé (ou Échap)
    // le désarme explicitement quand l'utilisateur a fini.
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

// Index de la ligne (dans `lines`, voir getVisualLines) qui CONTIENT un rectangle donné — factorisé
// car utilisé à la fois pour poser une pastille (renderPills) et pour retrouver la ligne d'un accord
// "syllabe" lors du calcul des numéros de mesure (renderLineMeasureNumbers).
function lineIndexForRect(lines, rect) {
    const idx = lines.findIndex(l => rect.top >= l.top - 2 && rect.top <= l.bottom + 2);
    if (idx >= 0) return idx;
    return lines.length ? lines.length - 1 : -1;
}

// Ligne résolue pour UN placement donné, quel que soit son type — "syllabe" retrouve sa ligne via la
// position réelle du caractère ancré ; "libre" a déjà sa ligne enregistrée directement (lineIndex).
function resolvedLineIndex(pl, lines, text) {
    if (pl.type === 'free') return lines.length ? clamp(pl.lineIndex ?? 0, 0, lines.length - 1) : -1;
    const range = rangeFromGlobalOffset(text, pl.charIndex);
    if (!range) return -1;
    const rects = range.getClientRects();
    const rect = (rects && rects[0]) || range.getBoundingClientRect();
    return lineIndexForRect(lines, rect);
}

// Écart minimal (px) entre deux pastilles voisines sur une même ligne (voir la passe d'anti-
// chevauchement plus bas) : évite que deux accords posés au même endroit (ou très proches — le mode
// "tampon", voir placeArmedAt, le permet désormais) se retrouvent totalement superposés et illisibles
// (retour utilisateur, capture d'écran à l'appui : deux pastilles "Em" fondues en un bloc illisible).
const PILL_MIN_GAP = 5;

function renderPills(si) {
    const sec = state.song.sections[si];
    const { wrap, text } = state.sectionEls[si];
    // AVANT toute mesure (getBoundingClientRect/getVisualLines) : cette classe change le padding de la
    // zone (voir .lyrics-wrap.show-line-numbers en CSS), donc la disposition du texte elle-même — la
    // basculer après aurait mesuré l'ancienne mise en page.
    wrap.classList.toggle('show-line-numbers', !!prefs.showMeasureNumbers);
    wrap.querySelectorAll('.lyric-pill, .line-measure-num, .line-divider').forEach(p => p.remove());
    const wrapRect = wrap.getBoundingClientRect();
    const lines = getVisualLines(text);

    // Passe 1 : construit chaque pastille et sa position BRUTE (avant anti-chevauchement), mais ne la
    // positionne pas encore — il faut d'abord la mesurer une fois posée dans le DOM (largeur réelle,
    // variable selon le symbole) pour savoir de combien l'écarter d'une voisine trop proche.
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
            lineTop = li >= 0 ? lines[li].top : rect.top;
        } else {
            // Mode libre : horizontal libre (xPct, % de la largeur totale de la zone), mais la hauteur
            // est TOUJOURS celle d'UNE ligne entière (lineIndex), jamais une position Y arbitraire
            // (retour utilisateur : "laisser libre uniquement en horizontal, forcer sur une ligne
            // au-dessus de chaque ligne de texte").
            const lineIndex = clamp(pl.lineIndex ?? 0, 0, Math.max(0, lines.length - 1));
            const line = lines[lineIndex];
            x = wrapRect.left + (pl.xPct / 100) * wrapRect.width;
            lineTop = line ? line.top : wrapRect.top;
        }

        wrap.appendChild(pill); // pas encore positionnée : juste pour pouvoir mesurer sa largeur réelle
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
        b.pill.style.top = (b.lineTop - wrapRect.top - 20) + 'px';
    });

    renderLineDividers(lines, wrapRect, wrap);
    renderLineMeasureNumbers(si, lines, wrapRect);
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

// ---------- Numéro de mesure en début de chaque ligne (voir #opt-show-measure-numbers) ----------
// Pour chaque ligne qui porte au moins un accord posé, affiche le numéro de la mesure où tombe le
// PREMIER de ces accords dans l'ordre du morceau (le plus petit chordIndex) — déduit du cumul des
// temps des accords qui le précèdent dans CETTE partie (chaque partie renumérote depuis 1, comme la
// grille d'accords de HarmoHub elle-même). Une ligne sans aucun accord posé n'a rien à en déduire :
// pas de numéro affiché plutôt qu'une valeur inventée.
function renderLineMeasureNumbers(si, lines, wrapRect) {
    if (!prefs.showMeasureNumbers || !lines.length) return;
    const sec = state.song.sections[si];
    const { wrap, text } = state.sectionEls[si];
    const beatsPerBar = (state.song.beatsPerBar) || 4;

    const firstChordIndexByLine = new Map();
    (sec._placements || []).forEach(pl => {
        const li = resolvedLineIndex(pl, lines, text);
        if (li < 0) return;
        const cur = firstChordIndexByLine.get(li);
        if (cur === undefined || pl.chordIndex < cur) firstChordIndexByLine.set(li, pl.chordIndex);
    });

    firstChordIndexByLine.forEach((chordIndex, lineIndex) => {
        const beatsBefore = sec.chords.slice(0, chordIndex).reduce((sum, c) => sum + (c.beats || 0), 0);
        const measureNum = Math.floor(beatsBefore / beatsPerBar) + 1;
        const badge = document.createElement('div');
        badge.className = 'line-measure-num';
        badge.textContent = measureNum;
        badge.style.top = (lines[lineIndex].top - wrapRect.top - 20) + 'px';
        wrap.appendChild(badge);
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
        hint.textContent = `Clique dans le texte pour poser « ${chord.symbol} » (${state.freeMode ? 'libre' : 'syllabe'}) — Échap pour annuler`;
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
