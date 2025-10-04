const API_URL = "http://127.0.0.1:5000/notes";

function showNotification(message, color = "#4caf50") {
    const notif = document.getElementById("notification");
    notif.style.background = color;
    notif.textContent = message;
    notif.style.display = "block";
    setTimeout(() => notif.style.display = "none", 2000);
}

// Получить все заметки
async function getNotes() {
    const res = await fetch(API_URL);
    const data = await res.json();
    const notesDiv = document.getElementById("notes");
    notesDiv.innerHTML = "";

    data.notes.forEach(note => {
        const noteDiv = document.createElement("div");
        noteDiv.className = "note";
        noteDiv.innerHTML = `
            <input type="text" value="${note.title}" id="title-${note.id}">
            <textarea id="content-${note.id}">${note.content}</textarea>
            <div class="buttons">
                <button onclick="updateNote(${note.id})">Save</button>
                <button onclick="deleteNote(${note.id})">Delete</button>
            </div>
        `;
        notesDiv.appendChild(noteDiv);
    });
}

// Создать заметку
async function createNote() {
    const title = document.getElementById("title").value;
    const content = document.getElementById("content").value;

    if (!title) {
        showNotification("Title is required!", "#f44336");
        return;
    }

    await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content })
    });

    document.getElementById("title").value = "";
    document.getElementById("content").value = "";
    showNotification("Note created!");
    getNotes();
}

// Обновить заметку
async function updateNote(id) {
    const newTitle = document.getElementById(`title-${id}`).value;
    const newContent = document.getElementById(`content-${id}`).value;

    await fetch(`${API_URL}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, content: newContent })
    });

    showNotification("Note updated!");
    getNotes();
}

// Удалить заметку
async function deleteNote(id) {
    if (confirm("Delete this note?")) {
        await fetch(`${API_URL}/${id}`, { method: "DELETE" });
        showNotification("Note deleted!", "#f44336");
        getNotes();
    }
}

// Инициализация
getNotes();
