// main.js — localStorage persistence version
document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'kanban_notes';
  let notes = loadFromStorage();

  const createBtn = document.getElementById('create-note-btn');
  const saveBtn = document.getElementById('save-note-btn');
  const titleInput = document.getElementById('note-title-input');
  const contentInput = document.getElementById('note-content-input');
  const modalEl = document.getElementById('createNoteModal');
  const modal = new bootstrap.Modal(modalEl);

  // Initial render from storage
  renderAllNotes();

  // Open modal
  createBtn.addEventListener('click', () => {
    modal.show();
  });

  // Save new note
  saveBtn.addEventListener('click', () => {
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    if (!title) {
      alert('Title is required');
      return;
    }

    const note = {
      id: generateId(),
      title,
      content,
      status: 'todo',
      created_at: new Date().toISOString()
    };

    notes.push(note);
    saveToStorage();
    addNoteToColumn(note);
    titleInput.value = '';
    contentInput.value = '';
    modal.hide();
  });

  // Generate simple unique id
  function generateId() {
    return Date.now().toString(36) + '-' + Math.floor(Math.random() * 10000).toString(36);
  }

  // Storage helpers
  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch (err) {
      console.error('localStorage setItem error', err);
    }
  }
  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (err) {
      console.error('localStorage parse error', err);
      return [];
    }
  }

  // Render all notes (clear columns then add)
  function renderAllNotes() {
    ['todo','doing','complete'].forEach(id => {
      const col = document.getElementById(id);
      if (col) col.innerHTML = `<h5 class="mb-3">${col.id[0].toUpperCase() + col.id.slice(1).replace('-', ' ')}</h5>`;
    });
    notes.forEach(n => addNoteToColumn(n));
  }

  function createNoteElement(note) {
    const noteEl = document.createElement('div');
    noteEl.className = 'note';
    noteEl.id = `note-${note.id}`;
    noteEl.draggable = true;
    noteEl.innerHTML = `<strong>${escapeHtml(note.title)}</strong><br><small>${escapeHtml(note.content)}</small>`;

    noteEl.addEventListener('dblclick', (e) => {
      if (!confirm('Delete this note?')) return;
      
      const parent = noteEl.parentElement;
      if (parent) parent.removeChild(noteEl);

      notes = notes.filter(x => x.id !== note.id);
      saveToStorage();
    });

    noteEl.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', note.id);
      noteEl.classList.add('dragging');
    });
    noteEl.addEventListener('dragend', () => {
      noteEl.classList.remove('dragging');
    });

    return noteEl;
  }

  function addNoteToColumn(note) {
    const col = document.getElementById(note.status || 'todo');
    if (!col) return;
    // If element already exists (e.g., re-render), remove it first to avoid duplicates
    const existing = document.getElementById(`note-${note.id}`);
    if (existing && existing.parentElement) existing.parentElement.removeChild(existing);

    const el = createNoteElement(note);
    col.appendChild(el);
  }

  document.querySelectorAll('.column').forEach(col => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.classList.add('droppable-hover');
    });
    col.addEventListener('dragleave', () => {
      col.classList.remove('droppable-hover');
    });
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('droppable-hover');
      const noteId = e.dataTransfer.getData('text/plain');
      if (!noteId) return;
      const noteEl = document.getElementById(`note-${noteId}`);
      if (!noteEl) return;

      col.appendChild(noteEl);

      const noteObj = notes.find(n => n.id === noteId);
      if (noteObj) {
        noteObj.status = col.id;
        saveToStorage();
      }
    });
  });

  function escapeHtml(s) {
    if (!s) return '';
    return s.replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
  }

  window.kanbanClearStorage = function() {
    if (!confirm('Clear all notes from localStorage?')) return;
    localStorage.removeItem(STORAGE_KEY);
    notes = [];
    renderAllNotes();
    alert('Cleared');
  };
});
