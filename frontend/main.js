// main.js — full create/edit/delete + drag&drop + localStorage persistence
document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'kanban_notes_v1';
  let notes = loadFromStorage(); // array of {id, title, content, status}
  let currentEditId = null; // null = creating, otherwise editing id

  // DOM elements
  const createBtn = document.getElementById('create-note-btn');
  const modalEl = document.getElementById('noteModal');
  const modalTitleEl = document.getElementById('modal-title');
  const modalContentEl = document.getElementById('modal-content');
  const modalSaveBtn = document.getElementById('modal-save-btn');
  const modalDeleteBtn = document.getElementById('modal-delete-btn');
  const modalLabel = document.getElementById('noteModalLabel');
  const modal = new bootstrap.Modal(modalEl, { backdrop: 'static' });

  // initial render
  renderAllNotes();

  // Open modal for creating
  createBtn.addEventListener('click', () => {
    currentEditId = null;
    modalLabel.textContent = 'Create Note';
    modalDeleteBtn.style.display = 'none';
    modalTitleEl.value = '';
    modalContentEl.value = '';
    modal.show();
    modalTitleEl.focus();
  });

  // When user clicks Save (create or update)
  modalSaveBtn.addEventListener('click', () => {
    const title = modalTitleEl.value.trim();
    const content = modalContentEl.value.trim();
    if (!title) {
      alert('Title is required');
      modalTitleEl.focus();
      return;
    }

    if (currentEditId) {
      // update
      const n = notes.find(x => x.id === currentEditId);
      if (n) {
        n.title = title;
        n.content = content;
        saveToStorage();
        // update DOM (without full rerender)
        const el = document.getElementById(`note-${n.id}`);
        if (el) {
          el.querySelector('.note-title').textContent = n.title;
          el.querySelector('.note-content').textContent = n.content;
        } else {
          // fallback
          renderAllNotes();
        }
      }
    } else {
      // create
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
    }

    modal.hide();
  });

  // Delete from modal
  modalDeleteBtn.addEventListener('click', () => {
    if (!currentEditId) return;
    if (!confirm('Delete this note?')) return;
    // remove from array
    notes = notes.filter(n => n.id !== currentEditId);
    saveToStorage();
    // remove from DOM
    const el = document.getElementById(`note-${currentEditId}`);
    if (el && el.parentElement) el.parentElement.removeChild(el);
    currentEditId = null;
    modal.hide();
  });

  // When modal shown via clicking on a note or create, we already set values.
  // We will attach click on notes via event delegation below.

  // Event delegation: click on a note opens modal for editing
  document.addEventListener('click', (e) => {
    const noteEl = e.target.closest && e.target.closest('.note');
    if (!noteEl) return;
    const id = noteEl.id.replace('note-', '');
    const note = notes.find(n => n.id === id);
    if (!note) return;
    // open modal in edit mode
    currentEditId = id;
    modalLabel.textContent = 'Edit Note';
    modalDeleteBtn.style.display = '';
    modalTitleEl.value = note.title;
    modalContentEl.value = note.content;
    modal.show();
  });

  // Drag & drop setup for columns
  document.querySelectorAll('.column').forEach(col => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.classList.add('droppable-hover');
      e.dataTransfer.dropEffect = 'move';
    });
    col.addEventListener('dragleave', () => col.classList.remove('droppable-hover'));
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('droppable-hover');
      const id = e.dataTransfer.getData('text/plain');
      if (!id) return;
      const noteEl = document.getElementById(`note-${id}`);
      if (!noteEl) return;
      col.appendChild(noteEl);
      // update notes array
      const n = notes.find(x => x.id === id);
      if (n) {
        n.status = col.id;
        saveToStorage();
      }
    });
  });

  // Helpers ----------------------------------------------------------------

  // render all notes from notes[] into columns (clears columns)
  function renderAllNotes() {
    ['todo','doing','complete'].forEach(id => {
      const col = document.getElementById(id);
      if (!col) return;
      // keep the header (first H5), clear rest
      col.innerHTML = `<h5>${col.id[0].toUpperCase() + col.id.slice(1)}</h5>`;
    });
    notes.forEach(addNoteToColumn);
  }

  // create DOM node for note and append to its column
  function addNoteToColumn(note) {
    const col = document.getElementById(note.status || 'todo');
    if (!col) return;

    // remove existing node if any to avoid duplicates
    const existing = document.getElementById(`note-${note.id}`);
    if (existing && existing.parentElement) existing.parentElement.removeChild(existing);

    const wrapper = document.createElement('div');
    wrapper.className = 'note';
    wrapper.id = `note-${note.id}`;
    wrapper.draggable = true;

    // content structure: title and content spans for easy update
    wrapper.innerHTML = `
      <div class="note-title"><strong>${escapeHtml(note.title)}</strong></div>
      <div class="note-content"><small style="color:#ddd">${escapeHtml(note.content)}</small></div>
    `;

    // drag handlers
    wrapper.addEventListener('dragstart', (e) => {
      try { e.dataTransfer.setData('text/plain', note.id); } catch (err) {}
      wrapper.classList.add('dragging');
    });
    wrapper.addEventListener('dragend', () => wrapper.classList.remove('dragging'));

    col.appendChild(wrapper);
  }

  // storage
  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch (err) {
      console.error('saveToStorage error', err);
    }
  }
  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (err) {
      console.error('loadFromStorage parse error', err);
      return [];
    }
  }

  // simple id generator
  function generateId() {
    return Date.now().toString(36) + Math.floor(Math.random()*10000).toString(36);
  }

  // escape HTML
  function escapeHtml(s) {
    if (!s) return '';
    return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'", '&#39;');
  }

  // expose for debugging
  window.kanban = {
    notes,
    saveToStorage,
    loadFromStorage,
    clearAll: () => { if(confirm('Clear all?')) { notes=[]; saveToStorage(); renderAllNotes(); } }
  };
});
