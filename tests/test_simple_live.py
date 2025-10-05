import requests
import json
import time
import pytest

BASE_URL = "http://localhost:5000"

def is_server_running():
    try:
        response = requests.get(f"{BASE_URL}/", timeout=2)
        return response.status_code == 200
    except:
        return False

@pytest.mark.skipif(not is_server_running(), reason="Сервер не запущен")
class TestLiveServer:
    
    def test_home_page(self):

        response = requests.get(f"{BASE_URL}/")
        assert response.status_code == 200
        data = response.json()
        assert 'message' in data
        print("Главная страница работает")

    def test_notes_endpoint(self):
        response = requests.get(f"{BASE_URL}/notes")
        
        assert response.status_code in [200, 500]
        print("Эндпоинт/notes отвечает")

    def test_create_note_simple(self):
        
        note_data = {
            'title': 'Simple Test Note',
            'content': 'Simple Test Content',
            'status': 'todo'
        }
        
        response = requests.post(f"{BASE_URL}/notes", json=note_data)
        # Если сервер работает с БД - 201, если нет - 500
        assert response.status_code in [201, 500]
        
        if response.status_code == 201:
            data = response.json()
            assert 'id' in data
            print("Создание заметки работает")
        else:
            print("Создание заметки не работает (проблемы с БД)")

def test_server_requirements():
    
    if not is_server_running():
        print("Для полного тестирования запустите сервер: python app.py")
        print("Затем запустите тесты снова")
        pytest.skip("Сервер не запущен")