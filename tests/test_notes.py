import pytest
from notes_app.app import app as flask_app   # вместо from app import app
from notes_app.models import db, Note

@pytest.fixture
def client():
    # Используем тестовую базу в памяти
    flask_app.config['TESTING'] = True
    flask_app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    with flask_app.app_context():
        db.create_all()
        yield flask_app.test_client()
        db.session.remove()
        db.drop_all()


def test_create_note(client):
    # CREATE
    res = client.post('/notes', json={"title": "Test note", "content": "Content"})
    assert res.status_code == 201
    data = res.get_json()
    assert data['title'] == "Test note"
    assert data['content'] == "Content"


def test_get_notes(client):
    # Создаём заметку
    client.post('/notes', json={"title": "Note 1"})
    client.post('/notes', json={"title": "Note 2"})

    # GET all
    res = client.get('/notes')
    data = res.get_json()
    assert res.status_code == 200
    assert data['total'] == 2
    assert len(data['notes']) == 2


def test_get_single_note(client):
    # Создаём
    res = client.post('/notes', json={"title": "Single note"})
    note_id = res.get_json()['id']

    # GET one
    res2 = client.get(f'/notes/{note_id}')
    assert res2.status_code == 200
    data = res2.get_json()
    assert data['title'] == "Single note"


def test_update_note(client):
    # Создаём
    res = client.post('/notes', json={"title": "Old title"})
    note_id = res.get_json()['id']

    # UPDATE
    res2 = client.patch(f'/notes/{note_id}', json={"title": "New title"})
    assert res2.status_code == 200
    data = res2.get_json()
    assert data['title'] == "New title"


def test_delete_note(client):
    # Создаём
    res = client.post('/notes', json={"title": "To delete"})
    note_id = res.get_json()['id']

    # DELETE
    res2 = client.delete(f'/notes/{note_id}')
    assert res2.status_code == 200

    # Проверяем, что нет
    res3 = client.get(f'/notes/{note_id}')
    assert res3.status_code == 404
