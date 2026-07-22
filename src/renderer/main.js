/**
 * Keystone - Renderer Process
 * Main UI logic for the menu bar app
 */

// State
let items = [];
let selectedId = null;
let activeFilter = 'All';
let activeView = 'favorites'; // favorites is the default, minimal landing view
let activeSource = null; // null, or a source id like 'claude-skill'
let editingId = null;
let sortOrder = 'recent'; // 'recent', 'alpha', 'type' - for the Library view
let favoritesSortOrder = 'custom'; // 'custom', 'recent', 'copied' - for the Favorites view
let draggedId = null;

// DOM Elements
const elements = {
  // Sidebar collapse
  sidebar: document.getElementById('sidebar'),
  sidebarToggle: document.getElementById('sidebarToggle'),
  expandToggle: document.getElementById('expandToggle'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),

  // Views
  libraryView: document.getElementById('libraryView'),
  libraryHeader: document.getElementById('libraryHeader'),
  filterPills: document.getElementById('filterPills'),
  detailView: document.getElementById('detailView'),
  detailEmpty: document.getElementById('detailEmpty'),
  detailContent: document.getElementById('detailContent'),
  
  // Sidebar
  navItems: document.querySelectorAll('.nav-item[data-view]'),
  filterBtns: document.querySelectorAll('.nav-item[data-filter]'),
  sourceNavItems: document.querySelectorAll('.nav-item[data-source]'),
  libraryCount: document.getElementById('libraryCount'),
  favoritesCount: document.getElementById('favoritesCount'),
  promptCount: document.getElementById('promptCount'),
  fileCount: document.getElementById('fileCount'),
  snippetCount: document.getElementById('snippetCount'),
  claudeSourceCount: document.getElementById('claudeSourceCount'),
  codexSourceCount: document.getElementById('codexSourceCount'),
  cursorSourceCount: document.getElementById('cursorSourceCount'),
  
  // Search & Filters
  searchInput: document.getElementById('searchInput'),
  filterButtons: document.querySelectorAll('.filter-btn'),
  sortBtn: document.getElementById('sortBtn'),
  
  // Cards & Detail
  cardsContainer: document.getElementById('cards'),
  
  // Modal
  modalOverlay: document.getElementById('modalOverlay'),
  modalTitle: document.getElementById('modalTitle'),
  editingIdInput: document.getElementById('editingId'),
  itemName: document.getElementById('itemName'),
  itemType: document.getElementById('itemType'),
  itemDescription: document.getElementById('itemDescription'),
  itemTags: document.getElementById('itemTags'),
  itemTone: document.getElementById('itemTone'),
  itemContent: document.getElementById('itemContent'),
  filesGroup: document.getElementById('filesGroup'),
  itemFiles: document.getElementById('itemFiles'),
  saveBtn: document.getElementById('saveBtn'),
  
  // Buttons
  newItemBtn: document.getElementById('newItemBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  
  // Toast
  toast: document.getElementById('toast')
};

// Sidebar collapse (persists across app restarts). Defaults to collapsed so
// the library list is the main thing you see, until a preference is saved.
function initSidebarCollapse() {
  const stored = localStorage.getItem('sidebarCollapsed');
  const collapsed = stored === null ? true : stored === '1';
  setSidebarCollapsed(collapsed);
  elements.sidebarToggle.addEventListener('click', () => {
    setSidebarCollapsed(!elements.sidebar.classList.contains('collapsed'));
  });
}

function setSidebarCollapsed(collapsed) {
  elements.sidebar.classList.toggle('collapsed', collapsed);
  elements.sidebarToggle.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0');
}

// Theme (persists across app restarts). Defaults to the system's light/dark
// preference until you explicitly pick one.
function initTheme() {
  const stored = localStorage.getItem('theme');
  const theme = stored || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  setTheme(theme);
  elements.themeToggleBtn.addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  });
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  elements.themeToggleBtn.title = theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
  elements.themeToggleBtn.setAttribute('aria-label', elements.themeToggleBtn.title);
  localStorage.setItem('theme', theme);
}

// Initialize
async function init() {
  await loadData();
  setupEventListeners();
  initSidebarCollapse();
  initTheme();
  render();
  
  // Listen for data updates from main process
  if (window.keystoneAPI) {
    window.keystoneAPI.onDataUpdated((data) => {
      items = data.items;
      render();
    });
  }
  
  // Focus search on Escape in detail view
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (elements.modalOverlay.classList.contains('open')) {
        closeModal();
      } else if (elements.detailContent.style.display !== 'none') {
        elements.searchInput.focus();
        elements.searchInput.select();
      }
    }
    
    // Cmd/Ctrl + K to focus search
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      elements.searchInput.focus();
      elements.searchInput.select();
    }
  });
}

// Load data from main process
async function loadData() {
  try {
    const data = await window.keystoneAPI.getData();
    items = data.items || [];
  } catch (e) {
    console.error('Failed to load data:', e);
    items = [];
  }
}

// Event Listeners
function setupEventListeners() {
  // Header toggle between the compact (Favorites, no sidebar) and expanded
  // (Library, with sidebar) window modes
  elements.expandToggle.addEventListener('click', () => {
    switchView(activeView === 'favorites' ? 'library' : 'favorites');
  });

  // Sidebar navigation
  elements.navItems.forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  
  // Collection filters
  elements.filterBtns.forEach(btn => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
  });

  // Source filters (Claude Code / Codex CLI / Cursor)
  elements.sourceNavItems.forEach(btn => {
    btn.addEventListener('click', () => setSourceFilter(btn.dataset.source));
  });

  // Search
  elements.searchInput.addEventListener('input', debounce(render, 100));
  
  // Filter buttons (top)
  elements.filterButtons.forEach(btn => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
  });
  
  // Sort
  elements.sortBtn.addEventListener('click', cycleSort);
  
  // New item
  elements.newItemBtn.addEventListener('click', () => openModal());
  
  // Modal
  elements.modalOverlay.addEventListener('submit', saveItem);
  
  // Settings (placeholder)
  elements.settingsBtn.addEventListener('click', () => {
    showToast('Settings coming soon');
  });
  
  // Type change in modal - show/hide files field
  elements.itemType.addEventListener('change', () => {
    elements.filesGroup.style.display = elements.itemType.value === 'File' ? 'block' : 'none';
  });
}

// View, type filter, and source filter are mutually exclusive - picking one
// clears the other two. They used to be independent and combinable, which
// silently produced "count says 3, list shows none" when e.g. a Favorites
// view and a Source filter that shares no items were both left active.
function clearNavHighlights() {
  elements.navItems.forEach(btn => btn.classList.remove('active'));
  elements.filterBtns.forEach(btn => btn.classList.remove('active'));
  elements.filterButtons.forEach(btn => btn.classList.remove('active'));
  elements.sourceNavItems.forEach(btn => btn.classList.remove('active'));
}

// View switching
function switchView(view) {
  clearNavHighlights();
  activeView = view;
  activeFilter = view === 'favorites' ? 'Favorites' : 'All';
  activeSource = null;

  elements.navItems.forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  if (view !== 'favorites') elements.filterButtons[0].classList.add('active');

  selectedId = null;
  render();
}

// Type filter (Prompts / Design Files / Snippets, from either the sidebar or the top pills)
function setFilter(filter) {
  clearNavHighlights();
  activeFilter = filter;
  activeView = 'library';
  activeSource = null;

  elements.navItems[0].classList.add('active'); // Library
  elements.filterButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.filter === filter));
  elements.filterBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.filter === filter));

  selectedId = null;
  render();
}

// Source filter (clicking the active source again clears it, back to the library)
function setSourceFilter(source) {
  const next = activeSource === source ? null : source;
  clearNavHighlights();
  activeSource = next;
  activeView = 'library';
  activeFilter = 'All';

  if (next) {
    elements.sourceNavItems.forEach(btn => btn.classList.toggle('active', btn.dataset.source === next));
  } else {
    elements.navItems[0].classList.add('active'); // Library
    elements.filterButtons[0].classList.add('active'); // All items
  }

  selectedId = null;
  render();
}

// Sort cycling
const LIBRARY_SORT_ORDERS = ['recent', 'alpha', 'type'];
const LIBRARY_SORT_LABELS = { recent: 'Recently updated', alpha: 'Name (A-Z)', type: 'Type' };
const FAVORITES_SORT_ORDERS = ['custom', 'recent', 'copied'];
const FAVORITES_SORT_LABELS = { custom: 'Custom order', recent: 'Most recent', copied: 'Most copied' };

function cycleSort() {
  if (activeView === 'favorites') {
    const idx = FAVORITES_SORT_ORDERS.indexOf(favoritesSortOrder);
    favoritesSortOrder = FAVORITES_SORT_ORDERS[(idx + 1) % FAVORITES_SORT_ORDERS.length];
  } else {
    const idx = LIBRARY_SORT_ORDERS.indexOf(sortOrder);
    sortOrder = LIBRARY_SORT_ORDERS[(idx + 1) % LIBRARY_SORT_ORDERS.length];
  }
  render();
}

function updateSortButtonLabel() {
  const label = activeView === 'favorites' ? FAVORITES_SORT_LABELS[favoritesSortOrder] : LIBRARY_SORT_LABELS[sortOrder];
  elements.sortBtn.innerHTML = `${label} <svg width="12" height="12" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>`;
}

// Get visible items
function getVisibleItems() {
  let result = [...items];
  
  // View filter
  if (activeView === 'favorites') {
    result = result.filter(x => x.favorite);
  }
  
  // Type filter
  if (activeFilter !== 'All' && activeFilter !== 'Favorites') {
    result = result.filter(x => x.type === activeFilter);
  }

  // Source filter
  if (activeSource) {
    result = result.filter(x => x.source === activeSource);
  }

  // Search
  const query = (elements.searchInput.value || '').toLowerCase().trim();
  if (query) {
    result = result.filter(x => 
      [x.name, x.description, x.type, ...(x.tags || [])].join(' ').toLowerCase().includes(query)
    );
  }
  
  // Sort
  if (activeView === 'favorites') {
    switch (favoritesSortOrder) {
      case 'recent':
        result.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        break;
      case 'copied':
        result.sort((a, b) => (b.copyCount || 0) - (a.copyCount || 0));
        break;
      case 'custom':
      default:
        result.sort((a, b) => (a.favoriteOrder ?? 0) - (b.favoriteOrder ?? 0));
        break;
    }
  } else {
    switch (sortOrder) {
      case 'alpha':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'type':
        result.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
        break;
      case 'recent':
      default:
        // Already in recent-first order from main process
        break;
    }
  }

  return result;
}

// Render everything
function render() {
  applyViewLayout();
  renderCounts();
  renderCards();
  renderDetail();
}

// Favorites is the minimal, default view: just search + sort + the list, no
// header copy or type-filter pills. Library keeps the fuller browsing chrome.
let currentWindowMode = 'compact';

function applyViewLayout() {
  const minimal = activeView === 'favorites';
  elements.libraryHeader.style.display = minimal ? 'none' : 'flex';
  elements.filterPills.style.display = minimal ? 'none' : 'flex';
  elements.cardsContainer.classList.toggle('compact', minimal);
  updateSortButtonLabel();

  // The sidebar (and its Library nav button) is fully hidden in compact
  // mode, so the header's expand-toggle is the only way back to it.
  elements.sidebar.classList.toggle('hidden', minimal);
  elements.expandToggle.title = minimal ? 'Show full library' : 'Back to favorites';
  elements.expandToggle.setAttribute('aria-label', elements.expandToggle.title);

  const mode = minimal ? 'compact' : 'expanded';
  if (mode !== currentWindowMode) {
    currentWindowMode = mode;
    window.keystoneAPI.setWindowMode(mode);
  }
}

// Render counts
function renderCounts() {
  elements.libraryCount.textContent = items.length;
  elements.favoritesCount.textContent = items.filter(x => x.favorite).length;
  elements.promptCount.textContent = items.filter(x => x.type === 'Prompt').length;
  elements.fileCount.textContent = items.filter(x => x.type === 'File').length;
  elements.snippetCount.textContent = items.filter(x => x.type === 'Snippet').length;
  elements.claudeSourceCount.textContent = items.filter(x => x.source === 'claude-skill').length;
  elements.codexSourceCount.textContent = items.filter(x => x.source === 'codex-skill').length;
  elements.cursorSourceCount.textContent = items.filter(x => x.source === 'cursor-rule').length;
}

// Render cards
function renderCards() {
  const visible = getVisibleItems();
  
  if (visible.length === 0) {
    elements.cardsContainer.innerHTML = `
      <div class="empty-state">
        No items found.
        <small>Try another search or add something new.</small>
      </div>
    `;
    return;
  }
  
  const draggableNow = activeView === 'favorites' && favoritesSortOrder === 'custom';
  const starIcon = (filled) => filled
    ? '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>'
    : '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/>';

  elements.cardsContainer.innerHTML = visible.map(item => `
    <article class="card" data-id="${item.id}" tabindex="0" role="button" title="Click to copy" aria-label="Copy ${escapeHtml(item.name)} to clipboard" ${draggableNow ? 'draggable="true"' : ''}>
      <div class="card-copy-hint">
        <svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>
        Click to copy
      </div>
      <div class="card-header">
        <div class="card-title">
          ${escapeHtml(item.name)}
          ${item.favorite ? '<span class="star-badge">★</span>' : ''}
        </div>
        <div class="card-actions">
          ${item.source ? `
          <button class="card-action-btn favorite-toggle" type="button" data-action="add-favorite" title="Add to Favorites" aria-label="Add to Favorites">
            <svg viewBox="0 0 24 24">${starIcon(false)}</svg>
          </button>` : `
          <button class="card-action-btn favorite-toggle ${item.favorite ? 'active' : ''}" type="button" data-action="toggle-favorite" title="${item.favorite ? 'Remove from favorites' : 'Add to favorites'}" aria-label="${item.favorite ? 'Remove from favorites' : 'Add to favorites'}">
            <svg viewBox="0 0 24 24">${starIcon(item.favorite)}</svg>
          </button>
          <button class="card-action-btn" type="button" data-action="edit" title="Edit" aria-label="Edit">
            <svg viewBox="0 0 24 24"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20ZM14 7l3 3"/></svg>
          </button>
          <button class="card-action-btn delete" type="button" data-action="delete" title="Delete" aria-label="Delete">
            <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>`}
        </div>
        <span class="card-type">${escapeHtml(item.type)}</span>
      </div>
      <p class="card-description">${escapeHtml(item.description || '')}</p>
      <div class="card-footer">
        ${(item.tags || []).slice(0, 3).map(tag => `<span class="tag ${item.tone}">${escapeHtml(tag)}</span>`).join('')}
        <span class="card-updated">${escapeHtml(item.updated || '')}</span>
      </div>
    </article>
  `).join('');

  // Click (or Enter/Space) anywhere on the card copies it; Favorite/Edit/Delete
  // are separate buttons so they don't fight with that default action.
  elements.cardsContainer.querySelectorAll('.card').forEach(card => {
    const id = Number(card.dataset.id);
    const copyHint = card.querySelector('.card-copy-hint');
    const copyThisCard = () => {
      const item = items.find(x => x.id === id);
      if (item) copyContent(item.content, copyHint, id);
    };

    card.addEventListener('click', copyThisCard);
    card.addEventListener('keydown', (e) => {
      if (e.target !== card) return; // ignore bubbled keydown from action buttons
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        copyThisCard();
      }
    });

    card.querySelector('[data-action="toggle-favorite"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(id);
    });
    card.querySelector('[data-action="add-favorite"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      addSyncedToFavorites(id);
    });
    card.querySelector('[data-action="edit"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal(id);
    });
    card.querySelector('[data-action="delete"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteItem(id);
    });

    if (draggableNow) {
      card.addEventListener('dragstart', (e) => {
        draggedId = id;
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('dragging');
        // Suspends the hover-hide watcher - unreliable cursor tracking during
        // a native drag could otherwise hide the popover mid-drag and drop
        // the reorder before it's saved.
        window.keystoneAPI.setDragging(true);
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        draggedId = null;
        window.keystoneAPI.setDragging(false);
      });
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (draggedId !== null && draggedId !== id) card.classList.add('drag-over');
      });
      card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        if (draggedId !== null && draggedId !== id) reorderFavoriteCards(draggedId, id);
      });
    }
  });

  // Deselect if the current selection has been filtered out of view
  if (selectedId !== null && !visible.some(x => x.id === selectedId)) {
    selectedId = null;
  }
}

// Drag-and-drop reordering within the Favorites view's custom sort order
function reorderFavoriteCards(draggedItemId, targetItemId) {
  const favorites = getVisibleItems();
  const draggedIdx = favorites.findIndex(i => i.id === draggedItemId);
  const targetIdx = favorites.findIndex(i => i.id === targetItemId);
  if (draggedIdx === -1 || targetIdx === -1) return;

  const reordered = [...favorites];
  const [dragged] = reordered.splice(draggedIdx, 1);
  reordered.splice(targetIdx, 0, dragged);

  const orderedIds = reordered.map(i => i.id);
  orderedIds.forEach((id, index) => {
    const item = items.find(i => i.id === id);
    if (item) item.favoriteOrder = index;
  });

  // Deferred, not called synchronously here: render() replaces the whole
  // cards container's innerHTML, which would destroy the dragged element
  // while the browser's own native drag sequence (drop -> dragend) is still
  // in progress, and can make the drop silently fail to stick.
  setTimeout(render, 0);

  window.keystoneAPI.reorderFavorites(orderedIds).catch(err => console.error('Reorder failed:', err));
}

// Clones a synced (read-only) skill into your own library as a favorite,
// since the synced entry itself is ephemeral and re-scanned from disk.
async function addSyncedToFavorites(id) {
  const item = items.find(x => x.id === id);
  if (!item) return;

  try {
    await window.keystoneAPI.saveItem({
      name: item.name,
      type: item.type,
      description: item.description,
      tags: item.tags,
      tone: item.tone,
      content: item.content,
      favorite: true
    });
    showToast('Added to Favorites');
  } catch (err) {
    console.error('Add to favorites failed:', err);
    showToast('Failed to add to favorites');
  }
}

// Select item
function selectItem(id) {
  selectedId = id;
  renderCards();
  renderDetail();
}

// Deselect, collapsing the detail panel back to the full-width library list
function closeDetail() {
  selectedId = null;
  renderCards();
  renderDetail();
}

// Render detail view
function renderDetail() {
  const item = items.find(x => x.id === selectedId);
  elements.detailView.classList.toggle('collapsed', !item);

  if (!item) {
    elements.detailEmpty.style.display = 'flex';
    elements.detailContent.style.display = 'none';
    return;
  }

  elements.detailEmpty.style.display = 'none';
  elements.detailContent.style.display = 'flex';
  elements.detailContent.innerHTML = `
    <div class="detail-header">
      <div class="detail-title-area">
        <div class="large-icon">${getTypeIcon(item.type)}</div>
        <div>
          <h2>${escapeHtml(item.name)} ${item.favorite ? '<span class="star-badge">★</span>' : ''}</h2>
          <div class="detail-sub">
            ${item.source
              ? `<span class="synced-badge" title="Synced from ${escapeHtml(item.sourceLabel)} — edit the source file to update it here">
                   <svg width="11" height="11" viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M17 4v3.5h-3.5M7 20v-3.5h3.5"/></svg>
                   Synced from ${escapeHtml(item.sourceLabel)}
                 </span>`
              : `${escapeHtml(item.type)} · Updated ${escapeHtml(item.updated || '')}`}
          </div>
        </div>
      </div>
      <div class="detail-tools">
        <button class="tool-btn icon-only" onclick="closeDetail()" aria-label="Back to library" title="Back to library">
          <svg width="14" height="14" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
        ${item.source ? '' : `
        <button class="tool-btn icon-only favorite-btn ${item.favorite ? 'active' : ''}" onclick="toggleFavorite()" aria-label="${item.favorite ? 'Remove from favorites' : 'Add to favorites'}" title="${item.favorite ? 'Remove from favorites' : 'Add to favorites'}">
          <svg width="16" height="16" viewBox="0 0 24 24">${item.favorite ? '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>' : '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/>'}</svg>
        </button>
        <button class="tool-btn edit-btn" onclick="openModal(${item.id})" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20ZM14 7l3 3"/></svg>
          Edit
        </button>
        <button class="tool-btn delete-btn" onclick="deleteItem(${item.id})" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>`}
      </div>
    </div>
    
    <div class="detail-section">
      <div class="section-header">Description</div>
      <div class="meta-value">${escapeHtml(item.description || 'No description')}</div>
    </div>
    
    <div class="detail-section">
      <div class="section-header">
        <span>${item.type === 'File' ? 'Notes' : 'Content'}</span>
        <button class="copy-btn" onclick="copyContent('${escapeHtml(item.content).replace(/'/g, "&#39;")}', this, ${item.id})">
          Copy to clipboard <svg width="12" height="12" viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>
        </button>
      </div>
      <div class="code-block">${highlightCode(escapeHtml(item.content || ''))}</div>
    </div>
    
    ${item.files && item.files.length ? `
      <div class="detail-section">
        <div class="section-header">Attached files</div>
        <div class="files-list">
          ${item.files.map(f => `
            <div class="file-item">
              <span class="file-icon">▧</span>
              <span class="file-name">${escapeHtml(f[0])}</span>
              <span class="file-size">${escapeHtml(f[1])}</span>
              <button class="file-download" onclick="showToast('File export coming soon')" title="Download">
                <svg width="14" height="14" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    
    <div class="detail-section">
      <div class="section-header">Details</div>
      <div class="meta-grid">
        <div class="meta-item">
          <div class="meta-label">Collection</div>
          <div class="meta-value">${getCollectionName(item.type)}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Tags</div>
          <div class="meta-value">${(item.tags || []).map(t => `<span>${escapeHtml(t)}</span>`).join('  ·  ')}</div>
        </div>
      </div>
    </div>
    
    <div class="tip-box">
      <svg width="16" height="16" viewBox="0 0 24 24"><path d="M9 18h6M10 22h4M8.5 14.5C7.6 13.7 7 12.5 7 11a5 5 0 0 1 10 0c0 1.5-.6 2.7-1.5 3.5-.8.7-1.5 1.3-1.5 2.5h-4c0-1.2-.7-1.8-1.5-2.5Z"/></svg>
      <div><strong>Use it anywhere</strong><br>Copy once, then paste into your terminal, IDE, or favorite chat. Keystone stays out of your way.</div>
    </div>
  `;
}

// Modal functions
function openModal(id = null) {
  editingId = id;
  const item = id ? items.find(x => x.id === id) : null;
  
  elements.modalTitle.textContent = item ? 'Edit item' : 'Add to your library';
  elements.editingIdInput.value = item?.id || '';
  elements.itemName.value = item?.name || '';
  elements.itemType.value = item?.type || 'Prompt';
  elements.itemDescription.value = item?.description || '';
  elements.itemTags.value = (item?.tags || []).join(', ');
  elements.itemTone.value = item?.tone || 'purple';
  elements.itemContent.value = item?.content || '';
  elements.itemFiles.value = (item?.files || []).map(f => `${f[0]}, ${f[1]}`).join('\n');
  elements.filesGroup.style.display = item?.type === 'File' ? 'block' : 'none';
  
  elements.modalOverlay.classList.add('open');
  setTimeout(() => elements.itemName.focus(), 50);
}

function closeModal() {
  elements.modalOverlay.classList.remove('open');
  editingId = null;
}

async function saveItem(e) {
  e.preventDefault();
  
  const name = elements.itemName.value.trim();
  const content = elements.itemContent.value.trim();
  
  if (!name || !content) {
    showToast('Name and content are required');
    return;
  }
  
  const tags = elements.itemTags.value.split(',').map(t => t.trim()).filter(Boolean);
  const files = elements.itemType.value === 'File' 
    ? elements.itemFiles.value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
        const [name, size] = l.split(',').map(s => s.trim());
        return [name, size || ''];
      })
    : undefined;
  
  const itemData = {
    id: editingId || undefined,
    name,
    type: elements.itemType.value,
    description: elements.itemDescription.value.trim() || 'Saved item',
    tags: tags.length ? tags : ['Personal'],
    tone: elements.itemTone.value,
    content,
    files
  };
  
  try {
    await window.keystoneAPI.saveItem(itemData);
    closeModal();
    showToast(editingId ? 'Item updated' : 'Added to your library');
  } catch (err) {
    console.error('Save failed:', err);
    showToast('Failed to save');
  }
}

async function deleteItem(id) {
  if (!confirm('Delete this item?')) return;
  
  try {
    await window.keystoneAPI.deleteItem(id);
    if (selectedId === id) selectedId = null;
    render();
    showToast('Item deleted');
  } catch (err) {
    console.error('Delete failed:', err);
    showToast('Failed to delete');
  }
}

async function toggleFavorite(id = selectedId) {
  if (!id) return;

  try {
    await window.keystoneAPI.toggleFavorite(id);
    render();
  } catch (err) {
    console.error('Toggle favorite failed:', err);
  }
}

async function copyContent(text, btn, id) {
  try {
    await window.keystoneAPI.copyToClipboard(text, id);
    showToast('Copied to clipboard');

    // Visual feedback on whichever element triggered the copy (detail panel's
    // "Copy to clipboard" button, or a card's hover overlay)
    if (btn) {
      const original = btn.innerHTML;
      const checkmark = '<svg width="12" height="12" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
      btn.classList.add('copied');
      btn.innerHTML = `Copied! ${checkmark}`;
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = original;
      }, 500);
    }
  } catch (err) {
    console.error('Copy failed:', err);
    // Fallback
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard');
    } catch {
      showToast('Copy failed');
    }
  }
}

// Helpers
function getTypeIcon(type) {
  switch (type) {
    case 'File': return '▧';
    case 'Snippet': return '⌘';
    default: return '✦';
  }
}

function getCollectionName(type) {
  switch (type) {
    case 'File': return 'Design Files';
    case 'Snippet': return 'Snippets';
    default: return 'Prompts';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function highlightCode(code) {
  if (!code) return '';
  return code
    .replace(/^(#.*|#.*$)/gm, '<span class="comment">$1</span>')
    .replace(/^(\s*(?:export|const|let|var|function|async|await|return|if|else|for|while|try|catch|import|from|as)\b)/gm, '<span class="key">$1</span>')
    .replace(/("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/g, '<span class="string">$1</span>')
    .replace(/(--\w+|-\w+)/g, '<span class="flag">$1</span>');
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function showToast(msg) {
  elements.toast.textContent = msg;
  elements.toast.classList.add('show');
  setTimeout(() => elements.toast.classList.remove('show'), 1800);
}

// The HTML uses inline onclick="..." attributes (both static, e.g. Cancel,
// and in templates built by renderDetail). Since this script loads as a
// module, its functions are scoped to the module and invisible to those
// inline handlers unless explicitly attached to window.
window.closeModal = closeModal;
window.openModal = openModal;
window.deleteItem = deleteItem;
window.toggleFavorite = toggleFavorite;
window.copyContent = copyContent;
window.showToast = showToast;
window.closeDetail = closeDetail;

// Initialize
init();