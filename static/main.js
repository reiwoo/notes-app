// main.js — server-based version for deployment
document.addEventListener('DOMContentLoaded', () => {
  // ---------- CONFIG ----------
  // Для Render: фронтенд и бэкенд на одном домене, используем относительные пути
  const API_BASE = ''; // Пустая строка - запросы идут на тот же домен
  const API_URL = '/notes'; // Относительный путь к API

  // ---------- STATE ----------
  let notes = [];
  let currentEditId = null;
  let columnsInitialized = false;
  let dropInProgress = false;
  let lastLoadToken = 0;

  // ---------- DOM refs ----------
  const createBtn = document.getElementById('create-note-btn');
  const modalEl = document.getElementById('noteModal');
  const modal = new bootstrap.Modal(modalEl, { backdrop: 'static' });
  const modalTitleEl = document.getElementById('modal-title');
  const modalContentEl = document.getElementById('modal-content');
  const modalSaveBtn = document.getElementById('modal-save-btn');
  const modalDeleteBtn = document.getElementById('modal-delete-btn');
  const modalLabel = document.getElementById('noteModalLabel');

  // ---------- Initialization ----------
  setupGlobalDragHandlers();
  setupCreateButton();
  setupModalButtons();
  setupColumns();
  loadNotes(); // Загружаем заметки с сервера

  // ---------- Global Drag Protection ----------
  function setupGlobalDragHandlers() {
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
    
    document.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  }

  // ---------- Setup functions ----------
  function setupCreateButton() {
    createBtn.addEventListener('click', (e) => {
      e.preventDefault();
      currentEditId = null;
      modalLabel.textContent = 'Create Note';
      modalDeleteBtn.style.display = 'none';
      modalTitleEl.value = '';
      modalContentEl.value = '';
      modal.show();
      setTimeout(() => modalTitleEl.focus(), 80);
    });
  }

  function setupModalButtons() {
    // Save (create or update)
    modalSaveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const title = modalTitleEl.value.trim();
      const content = modalContentEl.value.trim();
      if (!title) { modalTitleEl.focus(); return; }

      try {
        if (currentEditId) {
          // update existing note
          const res = await fetch(`${API_URL}/${currentEditId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content })
          });
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Update failed (${res.status}) ${txt}`);
          }
        } else {
          // create new note
          const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              title, 
              content, 
              status: 'todo',
              created_at: new Date().toISOString()
            })
          });
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Create failed (${res.status}) ${txt}`);
          }
        }
        await loadNotes();
        modal.hide();
      } catch (err) {
        console.error(err);
        alert(err.message || 'Save failed');
      }
    });

    // Delete note
    modalDeleteBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!currentEditId) return;
      if (!confirm('Delete this note?')) return;
      try {
        const res = await fetch(`${API_URL}/${currentEditId}`, { 
          method: 'DELETE' 
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Delete failed (${res.status}) ${txt}`);
        }
        currentEditId = null;
        modal.hide();
        await loadNotes();
      } catch (err) {
        console.error(err);
        alert(err.message || 'Delete failed');
      }
    });

    // Click on note -> open edit modal (delegation)
    document.addEventListener('click', (e) => {
      const noteEl = e.target.closest && e.target.closest('.note');
      if (!noteEl) return;
      const id = noteEl.dataset.id || noteEl.id?.replace?.('note-', '');
      if (!id) return;
      const note = notes.find(n => String(n.id) === String(id));
      if (!note) return;
      currentEditId = note.id;
      modalLabel.textContent = 'Edit Note';
      modalDeleteBtn.style.display = '';
      modalTitleEl.value = note.title || '';
      modalContentEl.value = note.content || '';
      modal.show();
      setTimeout(() => modalTitleEl.focus(), 60);
    });
  }

  function setupColumns() {
    if (columnsInitialized) return;
    columnsInitialized = true;

    document.querySelectorAll('.column').forEach(col => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        col.classList.add('droppable-hover');
      });

      col.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      col.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!col.contains(e.relatedTarget)) {
          col.classList.remove('droppable-hover');
        }
      });

      col.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        col.classList.remove('droppable-hover');

        if (dropInProgress) {
          console.warn('drop skipped — operation in progress');
          return;
        }
        dropInProgress = true;

        try {
          const rawId = e.dataTransfer.getData('text/plain');
          let realElem = document.elementFromPoint(e.clientX, e.clientY);
          if (realElem && realElem.closest) realElem = realElem.closest('.column');
          const targetCol = realElem || col;

          console.log('drop received id=', rawId, 'target col=', targetCol && targetCol.id);

          if (!rawId || !targetCol) {
            console.warn('drop: missing id or target column');
            return;
          }
          const id = String(rawId);

          // Оптимистичное обновление
          const noteIndex = notes.findIndex(n => String(n.id) === id);
          if (noteIndex === -1) {
            console.warn('Note not found in state:', id);
            return;
          }

          const oldStatus = notes[noteIndex].status;
          const newStatus = targetCol.id;
          
          // Если статус не изменился - выходим
          if (oldStatus === newStatus) {
            console.log('Status unchanged, skipping update');
            return;
          }

          notes[noteIndex].status = newStatus;
          
          // Обновляем DOM
          const el = document.querySelector(`.note[data-id='${id}']`) || document.getElementById(`note-${id}`);
          if (el && targetCol) {
            targetCol.appendChild(el);
            ensureEmptyStates();
            updateCounts();
          }

          // Обновляем на сервере
          const res = await fetch(`${API_URL}/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
          });
            
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Status update failed (${res.status}) ${text}`);
          }

          console.log('Status updated successfully');
          
        } catch (err) {
          console.error('Drop error:', err);
          // Восстанавливаем состояние при ошибке
          await loadNotes();
          alert(err.message || 'Move failed');
        } finally {
          dropInProgress = false;
        }
      });
    });
  }

  // ---------- Core: load / render ----------
  async function loadNotes() {
    const token = ++lastLoadToken;
    try {
      const res = await fetch(`${API_URL}?page=1&per_page=1000`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Failed to load notes (${res.status}) ${txt}`);
      }
      const data = await res.json();
      
      // Игнорируем устаревшие ответы
      if (token !== lastLoadToken) {
        console.warn('stale loadNotes response ignored');
        return;
      }
      
      notes = Array.isArray(data) ? data : (data.notes || []);
      renderAllNotes();
    } catch (err) {
      console.error('Load notes error:', err);
      alert(err.message || 'Failed to load notes');
    }
  }

  function renderAllNotes() {
    ['todo','doing','complete'].forEach(id => {
      const col = document.getElementById(id);
      if (!col) return;
      
      // Сохраняем заголовок, удаляем остальное
      Array.from(col.children).forEach(child => {
        if (!child.classList || !child.classList.contains('col-header')) {
          child.remove();
        }
      });
    });

    // Добавляем заметки
    notes.forEach(note => addNoteToColumn(note));

    ensureEmptyStates();
    updateCounts();
  }

  function addNoteToColumn(note) {
    const col = document.getElementById(note.status || 'todo');
    if (!col) return;

    // Проверяем, не находится ли заметка уже в правильной колонке
    const existing = document.querySelector(`.note[data-id='${note.id}']`);
    if (existing) {
      const currentCol = existing.closest('.column');
      if (currentCol && currentCol.id === note.status) {
        return; // Заметка уже в правильной колонке - пропускаем
      }
      existing.remove(); // Удаляем только если нужно переместить
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'note';
    wrapper.id = `note-${note.id}`;
    wrapper.dataset.id = String(note.id);
    wrapper.draggable = true;
    wrapper.innerHTML = `
      <div class="note-title"><strong>${escapeHtml(note.title)}</strong></div>
      <div class="note-content"><small style="color:#cbd5e1">${escapeHtml(note.content || '')}</small></div>
    `;

    // Drag handlers
    wrapper.addEventListener('dragstart', (e) => {
      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(note.id));
      } catch (err) {
        console.warn('dragstart setData failed', err);
      }
      wrapper.classList.add('dragging');
    });
    
    wrapper.addEventListener('dragend', () => {
      wrapper.classList.remove('dragging');
    });

    // Double-click quick delete
    wrapper.addEventListener('dblclick', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!confirm('Delete this note?')) return;
      try {
        const res = await fetch(`${API_URL}/${note.id}`, { 
          method: 'DELETE' 
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Delete failed (${res.status}) ${txt}`);
        }
        await loadNotes();
      } catch (err) {
        console.error(err);
        alert(err.message || 'Delete failed');
      }
    });

    col.appendChild(wrapper);

    // Удаляем пустое состояние если присутствует
    const empt = col.querySelector('.empty-state');
    if (empt) empt.remove();
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
      const el = document.getElementById(`count-${id}`);
      if (el) {
        el.textContent = notes.filter(n => n.status === id).length;
      }
    });
  }

  function escapeHtml(s = '') {
    return String(s || '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }

  // Debug helpers
  window.kanban = {
    reload: loadNotes,
    notes: () => notes.slice(),
    apiBase: API_BASE
  };
});