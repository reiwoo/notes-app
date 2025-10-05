import sys
import os

# Добавляем корневую директорию в PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_imports():
    """Тест что все модули импортируются без ошибок"""
    try:
        from app import app, get_db_connection, init_db
        assert app is not None
        print("✅ Все модули импортированы успешно")
    except Exception as e:
        import pytest
        pytest.fail(f"Ошибка импорта: {e}")

def test_app_creation():
    """Тест создания приложения"""
    from app import app
    assert app.name == 'app'
    assert hasattr(app, 'route')
    print("✅ Приложение создано корректно")

def test_escape_html():
    """Тест функции escape_html"""
    from app import escape_html
    
    # Тест базовых случаев
    assert escape_html("") == ""
    assert escape_html("hello") == "hello"
    assert escape_html("<script>") == "&lt;script&gt;"
    assert escape_html('"test"') == "&quot;test&quot;"
    assert escape_html("'test'") == "&#39;test&#39;"
    assert escape_html("a & b") == "a &amp; b"
    print("✅ Функция escape_html работает корректно")