/**
 * Keystone - Renderer Process
 * Main UI logic for the menu bar app
 */

// State
let items = [];
let selectedId = null;
let activeFilter = 'All';
let activeView = 'library';
let editingId = null;
let sortOrder = 'recent'; // 'recent', 'alpha', 'type'

// DOM Elements
const elements = {
  // Views
  libraryView: document.getElementById('libraryView'),
  detailView: document.getElementById('detailView'),
  detailEmpty: document.getElementById('detailEmpty'),
  detailContent: document.getElementById('detailContent'),
  
  // Sidebar
  navItems: document.querySelectorAll('.nav-item[data-view]'),
  filterBtns: document.querySelectorAll('.nav-item[data-filter]'),
  libraryCount: document.getElementById('libraryCount'),
  favoritesCount: document.getElementById('favoritesCount'),
  promptCount: document.getElementById('promptCount'),
  fileCount: document.getElementById('fileCount'),
  snippetCount: document.getElementById('snippetCount'),
  
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

// Initialize
async function init() {
  await loadData();
  setupEventListeners();
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
  // Sidebar navigation
  elements.navItems.forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  
  // Collection filters
  elements.filterBtns.forEach(btn => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
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

// View switching
function switchView(view) {
  activeView = view;
  elements.navItems.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  
  if (view === 'favorites') {
    activeFilter = 'Favorites';
    elements.filterButtons.forEach(btn => btn.classList.remove('active'));
  } else {
    activeFilter = 'All';
    elements.filterButtons[0].classList.add('active');
  }
  
  selectedId = null;
  render();
}

// Filter
function setFilter(filter) {
  activeFilter = filter;
  elements.filterButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  
  // Update sidebar filter buttons too
  elements.filterBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  
  selectedId = null;
  render();
}

// Sort cycling
function cycleSort() {
  const orders = ['recent', 'alpha', 'type'];
  const idx = orders.indexOf(sortOrder);
  sortOrder = orders[(idx + 1) % orders.length];
  
  const labels = { recent: 'Recently updated', alpha: 'Name (A-Z)', type: 'Type' };
  const icons = { recent: 'm6 9 6 6 6-6', alpha: 'm6 15 6-6 6 6', type: 'm6 9 6 6 6-6' };
  
  elements.sortBtn.innerHTML = `${labels[sortOrder]} <svg width="12" height="12" viewBox="0 0 24 24"><path d="${icons[sortOrder]}"/></svg>`;
  render();
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
  
  // Search
  const query = (elements.searchInput.value || '').toLowerCase().trim();
  if (query) {
    result = result.filter(x => 
      [x.name, x.description, x.type, ...(x.tags || [])].join(' ').toLowerCase().includes(query)
    );
  }
  
  // Sort
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
  
  return result;
}

// Render everything
function render() {
  renderCounts();
  renderCards();
  renderDetail();
}

// Render counts
function renderCounts() {
  elements.libraryCount.textContent = items.length;
  elements.favoritesCount.textContent = items.filter(x => x.favorite).length;
  elements.promptCount.textContent = items.filter(x => x.type === 'Prompt').length;
  elements.fileCount.textContent = items.filter(x => x.type === 'File').length;
  elements.snippetCount.textContent = items.filter(x => x.type === 'Snippet').length;
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
  
  elements.cardsContainer.innerHTML = visible.map(item => `
    <article class="card ${item.id === selectedId ? 'selected' : ''}" data-id="${item.id}" tabindex="0" role="button" aria-label="${escapeHtml(item.name)}">
      <div class="card-header">
        <div class="card-title">
          ${escapeHtml(item.name)}
          ${item.favorite ? '<span class="star-badge">★</span>' : ''}
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
  
  // Add click/keyboard handlers
  elements.cardsContainer.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => selectItem(Number(card.dataset.id)));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectItem(Number(card.dataset.id));
      }
    });
  });
  
  // Auto-select first if current selection not visible
  if (visible.length && !visible.some(x => x.id === selectedId)) {
    selectedId = visible[0].id;
  }
}

// Select item
function selectItem(id) {
  selectedId = id;
  renderCards();
  renderDetail();
}

// Render detail view
function renderDetail() {
  const item = items.find(x => x.id === selectedId);
  
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
          <div class="detail-sub">${escapeHtml(item.type)} · Updated ${escapeHtml(item.updated || '')}</div>
        </div>
      </div>
      <div class="detail-tools">
        <button class="tool-btn icon-only favorite-btn ${item.favorite ? 'active' : ''}" onclick="toggleFavorite()" aria-label="${item.favorite ? 'Remove from favorites' : 'Add to favorites'}" title="${item.favorite ? 'Remove from favorites' : 'Add to favorites'}">
          <svg width="16" height="16" viewBox="0 0 24 24">${item.favorite ? '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>' : '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/>'}</svg>
        </button>
        <button class="tool-btn edit-btn" onclick="openModal(${item.id})" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20ZM14 7l3 3"/></svg>
          Edit
        </button>
        <button class="tool-btn delete-btn" onclick="deleteItem(${item.id})" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
    
    <div class="detail-section">
      <div class="section-header">Description</div>
      <div class="meta-value">${escapeHtml(item.description || 'No description')}</div>
    </div>
    
    <div class="detail-section">
      <div class="section-header">
        <span>${item.type === 'File' ? 'Notes' : 'Content'}</span>
        <button class="copy-btn" onclick="copyContent('${escapeHtml(item.content).replace(/'/g, "&#39;")}')">
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

async function toggleFavorite() {
  if (!selectedId) return;
  
  try {
    await window.keystoneAPI.toggleFavorite(selectedId);
    render();
  } catch (err) {
    console.error('Toggle favorite failed:', err);
  }
}

async function copyContent(text) {
  try {
    await window.keystoneAPI.copyToClipboard(text);
    showToast('Copied to clipboard');
    
    // Visual feedback on copy button
    const btn = document.querySelector('.copy-btn');
    if (btn) {
      btn.classList.add('copied');
      btn.innerHTML = 'Copied! <svg width="12" height="12" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = 'Copy to clipboard <svg width="12" height="12" viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';
      }, 1500);
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

// Initialize
init();