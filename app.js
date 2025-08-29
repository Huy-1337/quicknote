class NotesApp {
    constructor() {
        this.notes = [];
        this.currentFilter = 'all';
        this.selectedTags = new Set();
        this.editingNoteId = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadFromStorage().then(() => {
            this.renderNotes();
            this.updateStats();
            this.setupCategoryFilter();
            this.renderTagsFilter();
            this.applySavedTheme();
        });
    }

    setupEventListeners() {
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterNotes(e.target.value);
        });

        document.getElementById('noteForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveNote();
        });

        // Theme toggle
        document.getElementById('themeToggleBtn').addEventListener('click', () => this.toggleTheme());

        // Export / Import
        document.getElementById('exportBtn').addEventListener('click', () => this.exportNotes());
        document.getElementById('importInput').addEventListener('change', (e) => this.importNotes(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'n':
                        e.preventDefault();
                        this.openNoteModal();
                        break;
                    case 's':
                        e.preventDefault();
                        if (this.editingNoteId) {
                            this.saveNote();
                        }
                        break;
                }
            }
            if (e.key === 'Escape') {
                this.closeNoteModal();
            }
        });
    }

    setupCategoryFilter() {
        const categoryTags = document.querySelectorAll('.category-tag');
        categoryTags.forEach(tag => {
            tag.addEventListener('click', () => {
                categoryTags.forEach(t => t.classList.remove('active'));
                tag.classList.add('active');
                this.currentFilter = tag.dataset.category;
                this.filterNotes(document.getElementById('searchInput').value);
            });
        });
    }

    renderTagsFilter() {
        const container = document.getElementById('tagsFilter');
        const allTags = new Set();
        this.notes.forEach(n => (n.tags || []).forEach(t => allTags.add(t)));
        container.innerHTML = '';
        [...allTags].sort().forEach(tag => {
            const el = document.createElement('div');
            el.className = 'category-tag' + (this.selectedTags.has(tag) ? ' active' : '');
            el.textContent = `#${tag}`;
            el.dataset.tag = tag;
            el.addEventListener('click', () => {
                if (this.selectedTags.has(tag)) this.selectedTags.delete(tag); else this.selectedTags.add(tag);
                this.renderTagsFilter();
                this.filterNotes(document.getElementById('searchInput').value);
            });
            container.appendChild(el);
        });
    }

    openNoteModal(noteId = null) {
        this.editingNoteId = noteId;
        const modal = document.getElementById('noteModal');
        const modalTitle = document.getElementById('modalTitle');
        const form = document.getElementById('noteForm');
        
        if (noteId) {
            const note = this.notes.find(n => n.id === noteId);
            if (note) {
                modalTitle.textContent = 'Edit Note';
                document.getElementById('noteTitle').value = note.title;
                document.getElementById('noteContent').value = note.content;
                document.getElementById('noteCategory').value = note.category;
                document.getElementById('notePriority').value = note.priority;
                document.getElementById('noteTags').value = (note.tags || []).join(', ');
            }
        } else {
            modalTitle.textContent = 'New Note';
            form.reset();
        }
        
        modal.classList.add('show');
        document.getElementById('noteTitle').focus();
    }

    closeNoteModal() {
        document.getElementById('noteModal').classList.remove('show');
        this.editingNoteId = null;
    }

    saveNote() {
        const title = document.getElementById('noteTitle').value.trim();
        const content = document.getElementById('noteContent').value.trim();
        const category = document.getElementById('noteCategory').value;
        const priority = document.getElementById('notePriority').value;
        const tags = document.getElementById('noteTags').value
            .split(',')
            .map(t => t.trim().toLowerCase())
            .filter(t => t);

        if (!title || !content) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        if (this.editingNoteId) {
            const noteIndex = this.notes.findIndex(n => n.id === this.editingNoteId);
            if (noteIndex !== -1) {
                this.notes[noteIndex] = {
                    ...this.notes[noteIndex],
                    title,
                    content,
                    category,
                    priority,
                    tags,
                    updatedAt: new Date().toISOString()
                };
                this.showToast('Note updated successfully!', 'success');
            }
        } else {
            const newNote = {
                id: Date.now().toString(),
                title,
                content,
                category,
                priority,
                tags,
                pinned: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.notes.unshift(newNote);
            this.showToast('Note created successfully!', 'success');
        }

        this.saveToStorage();
        this.renderNotes();
        this.updateStats();
        this.renderTagsFilter();
        this.closeNoteModal();
    }

    deleteNote(noteId) {
        if (confirm('Are you sure you want to delete this note?')) {
            this.notes = this.notes.filter(n => n.id !== noteId);
            this.saveToStorage();
            this.renderNotes();
            this.updateStats();
            this.showToast('Note deleted successfully!', 'success');
        }
    }

    togglePin(noteId) {
        const note = this.notes.find(n => n.id === noteId);
        if (note) {
            note.pinned = !note.pinned;
            this.saveToStorage();
            this.renderNotes();
            this.updateStats();
            this.showToast(note.pinned ? 'Note pinned!' : 'Note unpinned!', 'info');
        }
    }

    filterNotes(searchTerm = '') {
        let filteredNotes = this.notes;

        if (this.currentFilter !== 'all') {
            filteredNotes = filteredNotes.filter(note => note.category === this.currentFilter);
        }

        if (this.selectedTags.size > 0) {
            filteredNotes = filteredNotes.filter(note => {
                const tags = new Set(note.tags || []);
                for (const t of this.selectedTags) if (!tags.has(t)) return false;
                return true;
            });
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredNotes = filteredNotes.filter(note =>
                note.title.toLowerCase().includes(term) ||
                note.content.toLowerCase().includes(term)
            );
        }

        this.renderNotes(filteredNotes);
    }

    renderNotes(notesToRender = null) {
        const notes = notesToRender || this.notes;
        const pinnedNotes = notes.filter(note => note.pinned);
        const regularNotes = notes.filter(note => !note.pinned);

        const pinnedSection = document.getElementById('pinnedSection');
        const pinnedNotesContainer = document.getElementById('pinnedNotes');
        
        if (pinnedNotes.length > 0) {
            pinnedSection.style.display = 'block';
            pinnedNotesContainer.innerHTML = pinnedNotes.map(note => this.createNoteCard(note)).join('');
        } else {
            pinnedSection.style.display = 'none';
        }

        const notesGrid = document.getElementById('notesGrid');
        if (regularNotes.length > 0) {
            notesGrid.innerHTML = regularNotes.map(note => this.createNoteCard(note)).join('');
        } else if (notes.length === 0) {
            notesGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-notes-medical"></i>
                    <h3>No notes yet</h3>
                    <p>Create your first note to get started!</p>
                </div>
            `;
        } else {
            notesGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No notes found</h3>
                    <p>Try adjusting your search or filter criteria.</p>
                </div>
            `;
        }

        this.addNoteCardListeners();
    }

    createNoteCard(note) {
        const priorityColors = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };
        const safeHtml = DOMPurify.sanitize(marked.parse(note.content || ''));

        return `
            <div class="note-card ${note.pinned ? 'pinned' : ''}" data-note-id="${note.id}">
                <div class="note-actions">
                    <button class="action-btn" onclick="notesApp.togglePin('${note.id}')" title="${note.pinned ? 'Unpin' : 'Pin'}">
                        <i class="fas fa-thumbtack" style="color: ${note.pinned ? '#f59e0b' : '#64748b'}"></i>
                    </button>
                    <button class="action-btn" onclick="notesApp.openNoteModal('${note.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn" onclick="notesApp.deleteNote('${note.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                
                <div class="note-header">
                    <div class="note-category">${note.category}</div>
                    <div style="width: 12px; height: 12px; border-radius: 50%; background: ${priorityColors[note.priority]};"></div>
                </div>
                
                <h3 class="note-title">${this.escapeHtml(note.title)}</h3>
                <div class="note-content">${safeHtml}</div>
                ${(note.tags && note.tags.length) ? `<div style="margin:.5rem 0;display:flex;gap:.5rem;flex-wrap:wrap;">${note.tags.map(t=>`<span style=\"background:var(--gray-light);color:var(--dark);padding:2px 8px;border-radius:12px;font-size:.75rem\">#${this.escapeHtml(t)}<\/span>`).join('')}</div>` : ''}
                
                <div class="note-meta">
                    <span>${this.formatDate(note.updatedAt)}</span>
                    <span>${note.priority} priority</span>
                </div>
            </div>
        `;
    }

    addNoteCardListeners() {
        const noteCards = document.querySelectorAll('.note-card');
        noteCards.forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.action-btn')) return;
                const noteId = card.dataset.noteId;
                this.openNoteModal(noteId);
            });
        });
    }

    updateStats() {
        const totalNotes = this.notes.length;
        const pinnedNotes = this.notes.filter(note => note.pinned).length;
        
        document.getElementById('totalNotes').textContent = totalNotes;
        document.getElementById('pinnedNotes').textContent = pinnedNotes;

        const categoryStats = document.getElementById('categoryStats');
        const categories = ['personal', 'work', 'ideas', 'todo'];
        const categoryCounts = {};
        
        categories.forEach(cat => {
            categoryCounts[cat] = this.notes.filter(note => note.category === cat).length;
        });

        categoryStats.innerHTML = categories.map(cat => `
            <div style="margin-bottom: 0.5rem; padding: 0.5rem; background: white; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                <span style="text-transform: capitalize;">${cat}</span>
                <span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">${categoryCounts[cat]}</span>
            </div>
        `).join('');
    }

    async saveToStorage() {
        localStorage.setItem('notes', JSON.stringify(this.notes));
        try { await this.idbPutAll(this.notes); } catch (_) {}
    }

    async loadFromStorage() {
        try {
            const idbNotes = await this.idbGetAll();
            if (idbNotes && idbNotes.length) { this.notes = idbNotes; return; }
        } catch (_) {}
        this.notes = JSON.parse(localStorage.getItem('notes')) || [];
    }

    async idbOpen() {
        return await new Promise((resolve, reject) => {
            const req = indexedDB.open('notes-db', 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'id' });
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async idbPutAll(notes) {
        const db = await this.idbOpen();
        await new Promise((resolve, reject) => {
            const tx = db.transaction('notes', 'readwrite');
            const store = tx.objectStore('notes');
            store.clear();
            notes.forEach(n => store.put(n));
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async idbGetAll() {
        const db = await this.idbOpen();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction('notes', 'readonly');
            const store = tx.objectStore('notes');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    exportNotes() {
        const dataStr = JSON.stringify(this.notes, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notes-export-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Exported notes', 'success');
    }

    async importNotes(e) {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const json = JSON.parse(text);
            if (!Array.isArray(json)) throw new Error('Invalid format');
            if (!confirm('Replace your current notes with the imported file?')) return;
            this.notes = json;
            await this.saveToStorage();
            this.renderNotes();
            this.updateStats();
            this.renderTagsFilter();
            this.showToast('Imported notes', 'success');
        } catch (err) {
            this.showToast('Import failed', 'error');
        } finally {
            e.target.value = '';
        }
    }

    applySavedTheme() {
        const theme = localStorage.getItem('theme') || 'light';
        document.body.classList.toggle('theme-dark', theme === 'dark');
    }

    toggleTheme() {
        const isDark = document.body.classList.toggle('theme-dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) return 'Today';
        if (diffDays === 2) return 'Yesterday';
        if (diffDays <= 7) return `${diffDays - 1} days ago`;
        return date.toLocaleDateString();
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            ${message}
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
    }
}

// Initialize the app
const notesApp = new NotesApp();

// Global functions for onclick handlers
function openNoteModal() { notesApp.openNoteModal(); }
function closeNoteModal() { notesApp.closeNoteModal(); }

// Seed with examples if empty
if (notesApp.notes.length === 0) {
    const sampleNotes = [
        { id: '1', title: 'Welcome to Quick Notes!', content: 'This is your first note. Click on it to edit, or create new notes using the "New Note" button. You can pin important notes, organize them by categories, and search through your collection.', category: 'personal', priority: 'high', tags: ['welcome','tips'], pinned: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: '2', title: 'App Features', content: '✅ Create, edit, and delete notes\n✅ Pin important notes\n✅ Organize by categories\n✅ Search functionality\n✅ Local storage + IndexedDB\n✅ Responsive design\n✅ Keyboard shortcuts (Ctrl+N, Ctrl+S, Esc)\n✅ Markdown support', category: 'ideas', priority: 'medium', tags: ['features'], pinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ];
    notesApp.notes = sampleNotes;
    notesApp.saveToStorage();
    notesApp.renderNotes();
    notesApp.updateStats();
    notesApp.renderTagsFilter();
}


