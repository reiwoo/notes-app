const API_URL = "http://127.0.0.1:5000/notes";

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
            <strong>${note.title}</strong>
            <p>${note.content}</p>
            <button onclick="editNote(${note.id})">Edit</button>
            <button onclick="deleteNote(${note.id})">Delete</button>
        `;
        notesDiv.appendChild(noteDiv);
    });
}

// Создать заметку
async function createNote() {
    const title = document.getElementById("title").value;
    const content = document.getElementById("content").value;

    await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content })
    });

    document.getElementById("title").value = "";
    document.getElementById("content").value = "";
    getNotes();
}

// Редактировать заметку (prompt)
async function editNote(id) {
    const noteRes = await fetch(`${API_URL}/${id}`);
    const note = await noteRes.json();
    const newTitle = prompt("New title", note.title);
    const newContent = prompt("New content", note.content);

    if (newTitle !== null && newContent !== null) {
        await fetch(`${API_URL}/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: newTitle, content: newContent })
        });
        getNotes();
    }
}

// Удалить заметку
async function deleteNote(id) {
    if (confirm("Delete this note?")) {
        await fetch(`${API_URL}/${id}`, { method: "DELETE" });
        getNotes();
    }
}

// Инициализация
getNotes();
