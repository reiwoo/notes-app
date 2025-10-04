// main.js — updated: immediate empty-state updates + modal style integration
document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'kanban_notes_v1';
  let notes = loadFromStorage();
  let currentEditId = null;

  // DOM
  const createBtn = document.getElementById('create-note-btn');
  const modalEl = document.getElementById('noteModal');
  const modal = new bootstrap.Modal(modalEl, { backdrop: 'static' });
  const modalTitleEl = document.getElementById('modal-title');
  const modalContentEl = document.getElementById('modal-content');
  const modalSaveBtn = document.getElementById('modal-save-btn');
  const modalDeleteBtn = document.getElementById('modal-delete-btn');
  const modalLabel = document.getElementById('noteModalLabel');

  // initial render
  renderAllNotes();
  updateCounts();

  // open create modal
  createBtn.addEventListener('click', () => {
    currentEditId = null;
    modalLabel.textContent = 'Create Note';
    modalDeleteBtn.style.display = 'none';
    modalTitleEl.value = '';
    modalContentEl.value = '';
    modal.show();
    setTimeout(() => modalTitleEl.focus(), 80);
  });

  // save (create or update)
  modalSaveBtn.addEventListener('click', () => {
    const title = modalTitleEl.value.trim();
    const content = modalContentEl.value.trim();
    if (!title) { modalTitleEl.focus(); return; }

    if (currentEditId) {
      const n = notes.find(x => x.id === currentEditId);
      if (n) {
        n.title = title;
        n.content = content;
        saveAndRepaint();
      }
    } else {
      const note = { id: generateId(), title, content, status: 'todo', created_at: new Date().toISOString() };
      notes.push(note);
      saveToStorage();
      addNoteToColumn(note, { flash: true });
      updateCounts();
      ensureEmptyStates();
    }
    modal.hide();
  });

  // delete
  modalDeleteBtn.addEventListener('click', () => {
    if (!currentEditId) return;
    if (!confirm('Delete this note?')) return;
    notes = notes.filter(n => n.id !== currentEditId);
    saveAndRepaint();
    currentEditId = null;
    modal.hide();
  });

  // click on note -> edit (delegation)
  document.addEventListener('click', (e) => {
    const noteEl = e.target.closest && e.target.closest('.note');
    if (!noteEl) return;
    const id = noteEl.id.replace('note-', '');
    const note = notes.find(n => n.id === id);
    if (!note) return;
    currentEditId = id;
    modalLabel.textContent = 'Edit Note';
    modalDeleteBtn.style.display = '';
    modalTitleEl.value = note.title;
    modalContentEl.value = note.content;
    modal.show();
    setTimeout(() => modalTitleEl.focus(), 60);
  });

  // drag & drop handlers
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
      const el = document.getElementById(`note-${id}`);
      if (!el) return;
      col.appendChild(el);
      const n = notes.find(x => x.id === id);
      if (n) {
        n.status = col.id;
        saveToStorage();
        updateCounts();
        ensureEmptyStates();
      }
    });
  });

  // Helpers --------------------------------------------------------------
  function renderAllNotes() {
    ['todo','doing','complete'].forEach(id => {
      const col = document.getElementById(id);
      if (!col) return;
      // используем data-title, если задан — иначе берём из id (fallback)
      const title = col.dataset.title || (col.id[0].toUpperCase() + col.id.slice(1));
      // сохраним текущие карточки (если они есть) — но проще: перезаписываем только header area
      // Обновляем header: если header уже есть, обновим текст и count, иначе создадим новый header
      let header = col.querySelector('.col-header');
      if (!header) {
        header = document.createElement('div');
        header.className = 'col-header';
        header.innerHTML = `<div class="col-title">${title}</div><div class="col-count" id="count-${col.id}">0</div>`;
        // вставляем в начало кол
        col.insertBefore(header, col.firstChild);
      } else {
        const titleEl = header.querySelector('.col-title');
        if (titleEl) titleEl.textContent = title;
        const countElId = `count-${col.id}`;
        let countEl = header.querySelector(`#${countElId}`);
        if (!countEl) {
          // если старый count имел другой id — создаём/заменяем
          const newCount = document.createElement('div');
          newCount.className = 'col-count';
          newCount.id = countElId;
          header.appendChild(newCount);
        }
      }
      // Удаляем все карточки и пустые подсказки ниже header before re-adding
      // (убираем всё, кроме header)
      Array.from(col.children).forEach(child => {
        if (!child.classList || !child.classList.contains('col-header')) {
          col.removeChild(child);
        }
      });
    });

    // затем заново рендерим все заметки (addNoteToColumn добавляет после header)
    notes.forEach(n => addNoteToColumn(n));
    ensureEmptyStates();
    updateCounts();
  }
  function addNoteToColumn(note, opts={}) {
    const col = document.getElementById(note.status || 'todo');
    if (!col) return;
    // remove existing if any
    const existing = document.getElementById(`note-${note.id}`);
    if (existing && existing.parentElement) existing.parentElement.removeChild(existing);

    const wrapper = document.createElement('div');
    wrapper.className = 'note';
    wrapper.id = `note-${note.id}`;
    wrapper.draggable = true;
    wrapper.innerHTML = `<div class="note-title"><strong>${escapeHtml(note.title)}</strong></div>
                         <div class="note-content"><small style="color:#cbd5e1">${escapeHtml(note.content)}</small></div>`;

    // drag handlers
    wrapper.addEventListener('dragstart', (e) => {
      try { e.dataTransfer.setData('text/plain', note.id); } catch (err) {}
      wrapper.classList.add('dragging');
    });
    wrapper.addEventListener('dragend', () => wrapper.classList.remove('dragging'));

    // double-click delete for quick removal (also updates storage)
    wrapper.addEventListener('dblclick', () => {
      if (!confirm('Delete this note?')) return;
      notes = notes.filter(n => n.id !== note.id);
      if (wrapper.parentElement) wrapper.parentElement.removeChild(wrapper);
      saveToStorage();
      updateCounts();
      ensureEmptyStates();
    });

    col.appendChild(wrapper);

    // flash on create
    if (opts.flash) {
      wrapper.style.transform = 'translateY(6px) scale(.995)';
      wrapper.style.opacity = '0';
      setTimeout(()=>{ wrapper.style.transition = 'transform .12s ease, opacity .18s ease'; wrapper.style.transform=''; wrapper.style.opacity='1'; }, 8);
    }

    // remove empty placeholder if present
    const empt = col.querySelector('.empty-state');
    if (empt) empt.remove();

    updateCounts();
  }

  function ensureEmptyStates() {
    ['todo','doing','complete'].forEach(id => {
      const col = document.getElementById(id);
      if (!col) return;
      const hasNote = !!col.querySelector('.note');
      const existingEmpty = col.querySelector('.empty-state');
      if (!hasNote) {
        if (!existingEmpty) {
          const empty = document.createElement('div');
          empty.className = 'empty-state';
          empty.textContent = 'No notes yet — drag here or click New note';
          col.appendChild(empty);
        }
      } else {
        if (existingEmpty) existingEmpty.remove();
      }
    });
  }

  function updateCounts() {
    ['todo','doing','complete'].forEach(id => {
      const count = notes.filter(n => n.status === id).length;
      const el = document.getElementById(`count-${id}`);
      if (el) el.textContent = count;
    });
  }

  function saveAndRepaint() {
    saveToStorage();
    renderAllNotes();
  }

  function saveToStorage() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); } catch(err){ console.error(err); }
  }
  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch(err){ console.error(err); return []; }
  }

  function generateId() {
    return Date.now().toString(36) + '-' + Math.floor(Math.random()*10000).toString(36);
  }

  function escapeHtml(s='') {
    return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }

  // debug
  window.kanban = { notes, saveToStorage, loadFromStorage, clear: ()=>{ if(confirm('Clear all?')){ notes=[]; saveToStorage(); renderAllNotes(); } } };
});
