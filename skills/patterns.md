# Patterns d'architecture

## Structure HTML d'un widget

### Template de base
```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mon Widget</title>
    <script src="https://docs.getgrist.com/grist-plugin-api.js"></script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: system-ui, -apple-system, sans-serif;
            background: transparent;
        }
        /* ... styles ... */
    </style>
</head>
<body>
    <div id="app">Chargement...</div>

    <!-- Modales (optionnel) -->
    <div id="modal" class="modal"></div>

    <!-- Toast (optionnel) -->
    <div id="toast-container"></div>

    <script>
        // Code widget
    </script>
</body>
</html>
```

### Organisation du JavaScript
```javascript
// ═══════════════════════════════════════════════════════════
// ÉTAT GLOBAL
// ═══════════════════════════════════════════════════════════
let records = [];
let selectedId = null;
let isDemo = false;

// ═══════════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════════
function escapeHtml(text) { /* ... */ }
function formatDate(ts) { /* ... */ }
function convertToRows(data) { /* ... */ }

// ═══════════════════════════════════════════════════════════
// RENDU
// ═══════════════════════════════════════════════════════════
function render() { /* ... */ }

// ═══════════════════════════════════════════════════════════
// MODALES
// ═══════════════════════════════════════════════════════════
function openModal(id) { /* ... */ }
function closeModal() { /* ... */ }
function saveModal() { /* ... */ }

// ═══════════════════════════════════════════════════════════
// GRIST
// ═══════════════════════════════════════════════════════════
async function init() { /* ... */ }

// Démarrage
init();
```

---

## Modales

### Structure HTML
```html
<div id="taskModal" class="modal">
    <div class="modal-backdrop"></div>
    <div class="modal-content">
        <div class="modal-header">
            <h2 id="modalTitle">Titre</h2>
            <button onclick="closeModal()" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
            <input type="hidden" id="taskId">
            <label>Titre</label>
            <input type="text" id="titre">
            <!-- autres champs -->
        </div>
        <div class="modal-footer">
            <button onclick="closeModal()" class="btn-secondary">Annuler</button>
            <button onclick="saveTask()" class="btn-primary">Enregistrer</button>
        </div>
    </div>
</div>
```

### CSS Modal
```css
.modal {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 1000;
}
.modal.open { display: flex; align-items: center; justify-content: center; }

.modal-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.5);
}

.modal-content {
    position: relative;
    background: white;
    border-radius: 12px;
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 25px 50px rgba(0,0,0,0.25);
}

.modal-header { padding: 20px; border-bottom: 1px solid #e5e7eb; }
.modal-body { padding: 20px; }
.modal-footer { padding: 20px; border-top: 1px solid #e5e7eb; display: flex; gap: 12px; justify-content: flex-end; }
```

### JavaScript Modal
```javascript
function openModal(taskId = null) {
    const modal = document.getElementById('taskModal');
    const title = document.getElementById('modalTitle');

    if (taskId) {
        // Mode édition
        const task = records.find(t => t.id === taskId);
        title.textContent = 'Modifier la tâche';
        document.getElementById('taskId').value = taskId;
        document.getElementById('titre').value = task.titre || '';
        // ... remplir autres champs
    } else {
        // Mode création
        title.textContent = 'Nouvelle tâche';
        document.getElementById('taskId').value = '';
        document.getElementById('titre').value = '';
        // ... vider autres champs
    }

    modal.classList.add('open');
}

function closeModal() {
    document.getElementById('taskModal').classList.remove('open');
}

async function saveTask() {
    const taskId = document.getElementById('taskId').value;
    const data = {
        titre: document.getElementById('titre').value,
        // ... autres champs
    };

    try {
        if (taskId) {
            await grist.docApi.applyUserActions([
                ['UpdateRecord', 'Tasks', parseInt(taskId), data]
            ]);
            showToast('Tâche modifiée');
        } else {
            await grist.docApi.applyUserActions([
                ['AddRecord', 'Tasks', null, data]
            ]);
            showToast('Tâche créée');
        }
        closeModal();
    } catch (e) {
        showToast('Erreur: ' + e.message, 'error');
    }
}
```

---

## Toast / Notifications

### HTML
```html
<div id="toast-container"></div>
```

### CSS
```css
#toast-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.toast {
    padding: 12px 20px;
    border-radius: 8px;
    background: #1f2937;
    color: white;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease;
}

.toast.success { background: #10b981; }
.toast.error { background: #ef4444; }
.toast.warning { background: #f59e0b; }

@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}
```

### JavaScript
```javascript
function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}
```

---

## Filtres

### Stockage localStorage
```javascript
const FILTER_KEY = 'mywidget_filters';

function loadFilters() {
    try {
        return JSON.parse(localStorage.getItem(FILTER_KEY)) || {};
    } catch {
        return {};
    }
}

function saveFilters(filters) {
    localStorage.setItem(FILTER_KEY, JSON.stringify(filters));
}
```

### Application des filtres
```javascript
let filters = loadFilters();

function getFilteredRecords() {
    return records.filter(record => {
        if (filters.project && record.projet !== filters.project) return false;
        if (filters.priority && record.priorite !== filters.priority) return false;
        if (filters.search) {
            const search = filters.search.toLowerCase();
            if (!record.titre?.toLowerCase().includes(search)) return false;
        }
        return true;
    });
}

function setFilter(key, value) {
    if (value) {
        filters[key] = value;
    } else {
        delete filters[key];
    }
    saveFilters(filters);
    render();
}
```

### UI Filtres
```html
<div class="filters">
    <input type="text" id="search" placeholder="Rechercher..."
           oninput="setFilter('search', this.value)">

    <select id="projectFilter" onchange="setFilter('project', this.value)">
        <option value="">Tous les projets</option>
        <!-- options dynamiques -->
    </select>

    <select id="priorityFilter" onchange="setFilter('priority', this.value)">
        <option value="">Toutes priorités</option>
        <option value="1">Critique</option>
        <option value="2">Haute</option>
        <option value="3">Moyenne</option>
        <option value="4">Basse</option>
    </select>
</div>
```

---

## Variables CSS (thème)

```css
:root {
    /* Couleurs principales */
    --primary: #3b82f6;
    --primary-dark: #2563eb;
    --success: #10b981;
    --warning: #f59e0b;
    --danger: #ef4444;
    --info: #06b6d4;

    /* Texte */
    --text: #1f2937;
    --text-muted: #6b7280;
    --text-light: #9ca3af;

    /* Fond */
    --bg: #ffffff;
    --bg-secondary: #f3f4f6;
    --bg-hover: #f9fafb;

    /* Bordures */
    --border: #e5e7eb;
    --border-dark: #d1d5db;

    /* Ombres */
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
    --shadow: 0 4px 6px rgba(0,0,0,0.1);
    --shadow-lg: 0 10px 25px rgba(0,0,0,0.15);

    /* Rayons */
    --radius-sm: 4px;
    --radius: 8px;
    --radius-lg: 12px;

    /* Transitions */
    --transition: 0.2s ease;
}
```

### Usage
```css
.card {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
    transition: box-shadow var(--transition);
}

.card:hover {
    box-shadow: var(--shadow);
}

.btn-primary {
    background: var(--primary);
    color: white;
}

.btn-primary:hover {
    background: var(--primary-dark);
}
```

---

## Mapping de priorités

```javascript
const PRIORITY_CONFIG = {
    1: { label: 'Critique', color: '#ef4444', icon: '🔴' },
    2: { label: 'Haute', color: '#f59e0b', icon: '🟠' },
    3: { label: 'Moyenne', color: '#3b82f6', icon: '🔵' },
    4: { label: 'Basse', color: '#6b7280', icon: '⚪' }
};

function getPriorityBadge(priority) {
    const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG[3];
    return `<span class="priority-badge" style="background:${config.color}">${config.label}</span>`;
}
```

---

## Mapping de statuts

```javascript
const STATUS_CONFIG = {
    todo: { label: 'À faire', color: '#6b7280', icon: '📋' },
    inprogress: { label: 'En cours', color: '#3b82f6', icon: '🔄' },
    review: { label: 'Révision', color: '#f59e0b', icon: '👀' },
    done: { label: 'Terminé', color: '#10b981', icon: '✅' }
};
```

---

## Chargement initial

```javascript
async function init() {
    showLoading(true);

    try {
        grist.ready({ requiredAccess: 'full' });

        // Charger les données
        await loadAllData();

        // Écouter les changements
        grist.onRecords(handleRecordsUpdate);
        grist.onRecord(handleRecordSelect);

    } catch (e) {
        console.log('Mode démo:', e.message);
        isDemo = true;
        loadDemoData();
    }

    showLoading(false);
    render();
}

function showLoading(show) {
    document.getElementById('app').innerHTML = show
        ? '<div class="loading">Chargement...</div>'
        : '';
}

// Démarrer
init();
```

---

## Respecter les droits du document

> Aucun widget ne tient sa propre liste d'accès : tous appliquent celle du
> document. Implémentation de référence : `projects/tasks_app/core/taskflow-core.js`
> (lignes ~310-350), appliquée sur les sept widgets TaskFlow.

**Deux niveaux, et le second ne se voit qu'à l'erreur :**

| Niveau | Comment le détecter |
|---|---|
| Document ouvert en lecture seule | Grist passe `readonly=true` dans l'URL de l'iframe |
| Refus sur une ligne (ACL fine) | l'accès du widget vaut `full`, mais le serveur refuse **cette** écriture |

```javascript
function parametre(nom) {
    try { return new URLSearchParams(location.search).get(nom); }
    catch (e) { return null; }
}

// Grist a-t-il ouvert le widget en lecture seule ?
function lectureSeule() { return parametre('readonly') === 'true'; }

// Ce message est-il un refus de droits, et non une panne ?
function refusDeDroits(e) {
    const m = (e && (e.message || String(e))) || '';
    return /access denied|not allowed|permission|forbidden|read[- ]?only|cannot (modify|add|remove)|acl/i.test(m);
}
```

### Rendre compte plutôt que lever

Une exception qui traverse jusqu'à un `alert()` affiche le message brut du
serveur, et ne dit pas s'il s'agit des droits ou d'une panne.

```javascript
async function ecrire(id, champs) {
    if (lectureSeule()) {
        return { ok: false, refuse: true, message: 'Document ouvert en lecture seule' };
    }
    try {
        await grist.getTable().update({ id, fields: champs });
        return { ok: true };
    } catch (e) {
        return { ok: false, refuse: refusDeDroits(e), message: e.message || String(e) };
    }
}

// À l'appel : distinguer, sinon l'utilisateur cherche un bug là où il faut
// demander un accès.
const res = await ecrire(id, champs);
if (!res.ok) {
    toast(res.refuse
        ? 'Vos droits ne permettent pas cette modification'
        : 'Enregistrement impossible : ' + res.message, res.refuse ? 'warn' : 'error');
}
```

### La garde transverse

Pour ne pas modifier chaque site d'écriture, TaskFlow enrobe `applyUserActions`
une seule fois (`TF.guardWrites`) : lecture seule → bloqué avec `onReadOnly()` ;
refus ACL → `onDenied(err)`, l'erreur continuant d'être levée pour les `try/catch`
existants.

### Ne pas proposer ce qu'on refusera

Annoncer la lecture seule tout en affichant des champs à remplir n'est pas
cohérent. Désactiver **vraiment** — `disabled`, pas un habillage CSS, sinon le
champ reste atteignable au clavier :

```javascript
if (lectureSeule()) {
    racine.querySelectorAll('[data-field]').forEach(el => { el.disabled = true; });
    racine.querySelectorAll('.editable-tag').forEach(el => el.remove());
}
```

Et un bandeau qui **pousse** le contenu au lieu de le recouvrir : masquer la barre
de titre pour annoncer une restriction serait un remède pire que le mal.

```css
#bandeau-lecture-seule {
    position: fixed; top: 0; left: 0; right: 0; z-index: 40;
    padding: 6px 12px; text-align: center; font-size: 12px;
    background: var(--ca-l); color: var(--ca);
    border-bottom: 1px solid var(--ca);
}
body.avec-bandeau .app-shell { padding-top: 28px; }
```
