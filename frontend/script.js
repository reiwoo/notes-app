const API_URL = 'http://127.0.0.1:5000/notes';  // Укажите ваш backend URL

document.addEventListener('DOMContentLoaded', () => {
    const newBtn = document.getElementById('newBtn');
    const notifyEl = document.getElementById('notify');
    const notifyBody = document.getElementById('notify-body');
    const modalEl = document.getElementById('noteModal');
    const bsModal = new bootstrap.Modal(modalEl);
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const modalStatus = document.getElementById('modal-status');
    const saveBtn = document.getElementById('saveBtn');
    const deleteBtn = document.getElementById('deleteBtn');

    let currentNoteId = null;  // Для редактирования/удаления

    // Уведомления
    function showNotify(msg, type = 'success') {
        notifyEl.className = `alert alert-${type} alert-dismissible fade show`;
        notifyBody.textContent = msg;
        notifyEl.style.display = 'block';
        setTimeout(() => notifyEl.style.display = 'none', 3000);
    }

    // Создание карточки
    function createCard(note) {
        const card = document.createElement('div');
        card.className = 'card card-kanban';
        card.id = `note-${note.id}`;
        card.draggable = true;
        card.dataset.id = note.id;
        card.dataset.status = note.status;
        card.innerHTML = `
            <div class="card-body">
                <h6 class="card-title">${note.title}</h6>
                <p class="card-text text-muted">${note.content || ''}</p>
            </div>
        `;

        // Drag events
        card.addEventListener('dragstart', (e) => {
            card.classList.add('dragging');
            e.dataTransfer.setData('text/plain', note.id);
        });
        card.addEventListener('dragend', () => card.classList.remove('dragging'));

        // Клик для редактирования
        card.addEventListener('click', () => openModal(note.id, note.title, note.content, note.status));

        return card;
    }

    // Открытие модалки
    function openModal(id = null, title = '', content = '', status = 'todo') {
        currentNoteId = id;
        modalTitle.value = title;
        modalContent.value = content;
        modalStatus.textContent = status;
        modalEl.querySelector('.modal-title').textContent = id ? 'Edit Note' : 'Create Note';
        deleteBtn.style.display = id ? 'block' : 'none';  // Скрыть delete для новых
        bsModal.show();
    }

    // Загрузка заметок
    async function loadNotes() {
        try {
            const res = await fetch(API_URL);
            if (!res.ok) throw new Error('Load failed');
            const data = await res.json();
            ['todo', 'doing', 'complete'].forEach(status => {
                document.getElementById(status).innerHTML = '<h4 class="text-center">' + status.charAt(0).toUpperCase() + status.slice(1) + '</h4>';
            });
            data.notes.forEach(note => {
                const col = document.getElementById(note.status || 'todo');
                col.appendChild(createCard(note));
            });
            attachDroppables();
        } catch (err) {
            showNotify('Error loading notes', 'danger');
        }
    }

    // Drag-and-drop handlers
    function attachDroppables() {
        document.querySelectorAll('.droppable').forEach(col => {
            col.addEventListener('dragover', (e) => {
                e.preventDefault();
                col.classList.add('droppable-hover');
            });
            col.addEventListener('dragleave', () => col.classList.remove('droppable-hover'));
            col.addEventListener('drop', async (e) => {
                e.preventDefault();
                col.classList.remove('droppable-hover');
                const noteId = e.dataTransfer.getData('text/plain');
                const newStatus = col.dataset.status;
                const card = document.getElementById(`note-${noteId}`);
                if (card) {
                    col.appendChild(card);  // Локальное перемещение
                    card.dataset.status = newStatus;
                }
                try {
                    const res = await fetch(`${API_URL}/${noteId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: newStatus })
                    });
                    if (!res.ok) throw new Error('Move failed');
                    showNotify('Note moved');
                } catch (err) {
                    showNotify('Error moving note', 'danger');
                    loadNotes();  // Синхронизация на ошибке
                }
            });
        });
    }

    // Создание новой
    newBtn.addEventListener('click', () => openModal());

    // Сохранение (create/update)
    saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const title = modalTitle.value.trim();
        const content = modalContent.value.trim();
        if (!title) return showNotify('Title required', 'warning');
        const body = { title, content };
        try {
            let res;
            if (currentNoteId) {
                res = await fetch(`${API_URL}/${currentNoteId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
            } else {
                body.status = 'todo';
                res = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
            }
            if (!res.ok) throw new Error('Save failed');
            const note = await res.json();
            const card = document.getElementById(`note-${note.id}`);
            if (card) {
                // Update existing
                card.querySelector('.card-title').textContent = note.title;
                card.querySelector('.card-text').textContent = note.content;
            } else {
                // Add new
                document.getElementById('todo').appendChild(createCard(note));
            }
            showNotify('Note saved');
            bsModal.hide();
        } catch (err) {
            showNotify('Error saving note', 'danger');
        }
    });

    // Удаление
    deleteBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!confirm('Delete this note?')) return;
        try {
            const res = await fetch(`${API_URL}/${currentNoteId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            const card = document.getElementById(`note-${currentNoteId}`);
            if (card) card.remove();
            showNotify('Note deleted');
            bsModal.hide();
        } catch (err) {
            showNotify('Error deleting note', 'danger');
        }
    });

    // Инициализация
    loadNotes();
});