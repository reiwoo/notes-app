import os
import sys
import psycopg2
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from datetime import datetime
import urllib.parse
import logging
from logging.handlers import RotatingFileHandler
import json

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    """Главная страница с фронтендом"""
    return render_template('index.html')

TESTING = os.environ.get('TESTING') == 'True'

if TESTING:
    print("🔧 Режим тестирования активирован")

# Настройка логирования
def setup_logging():
    # Создаем папку для логов если ее нет
    if not os.path.exists('logs'):
        os.makedirs('logs')
    
    # Настраиваем формат логов
    formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - [%(ip)s] - %(message)s'
    )
    
    file_handler = RotatingFileHandler(
        'logs/app.log', 
        maxBytes=5*1024*1024, 
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)
    
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)

# Кастомный фильтр для добавления IP в логи
class IPLogFilter(logging.Filter):
    def filter(self, record):
        record.ip = get_client_ip()
        return True

app.logger.addFilter(IPLogFilter())

def get_client_ip():
    """Получаем реальный IP клиента"""
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0]
    elif request.headers.get('X-Real-IP'):
        return request.headers.get('X-Real-IP')
    else:
        return request.remote_addr

def get_user_agent_info():
    """Получаем информацию о устройстве и браузере"""
    user_agent = request.headers.get('User-Agent', '')
    # Простой парсинг User-Agent
    if 'Mobile' in user_agent:
        device = 'Mobile'
    elif 'Tablet' in user_agent:
        device = 'Tablet'
    else:
        device = 'Desktop'
    
    if 'Chrome' in user_agent:
        browser = 'Chrome'
    elif 'Firefox' in user_agent:
        browser = 'Firefox'
    elif 'Safari' in user_agent:
        browser = 'Safari'
    elif 'Edge' in user_agent:
        browser = 'Edge'
    else:
        browser = 'Other'
    
    return {
        'device': device,
        'browser': browser,
        'user_agent': user_agent[:100]  # ограничиваем длину
    }

def log_action(action, note_id=None, details=None):
    """Логируем действие и сохраняем в базу данных"""
    ip = get_client_ip()
    user_agent_info = get_user_agent_info()
    
    log_data = {
        'timestamp': datetime.now().isoformat(),
        'ip': ip,
        'action': action,
        'note_id': note_id,
        'device': user_agent_info['device'],
        'browser': user_agent_info['browser'],
        'details': details,
        'endpoint': request.endpoint,
        'method': request.method
    }
    
    # 1. Логируем в stdout (для Render)
    log_message = f"{action} | IP: {ip} | Device: {user_agent_info['device']}"
    if note_id:
        log_message += f" | Note: {note_id}"
    app.logger.info(log_message)
    
    # 2. Сохраняем в базу данных (для постоянного хранения)
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute('''
            CREATE TABLE IF NOT EXISTS logs (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ip VARCHAR(45),
                action VARCHAR(100),
                note_id INTEGER,
                device VARCHAR(50),
                browser VARCHAR(50),
                details JSONB,
                endpoint VARCHAR(100),
                method VARCHAR(10)
            )
        ''')
        
        cur.execute('''
            INSERT INTO logs (ip, action, note_id, device, browser, details, endpoint, method)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ''', (
            ip, action, note_id, 
            user_agent_info['device'], 
            user_agent_info['browser'],
            json.dumps(details) if details else None,
            request.endpoint,
            request.method
        ))
        
        conn.commit()
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Ошибка сохранения лога в БД: {e}")
# Функция для подключения к базе данных
def get_db_connection():
    # Для Render и продакшена
    if 'DATABASE_URL' in os.environ:
        import urllib.parse
        urllib.parse.uses_netloc.append('postgres')
        url = urllib.parse.urlparse(os.environ['DATABASE_URL'])
        
        conn = psycopg2.connect(
            database=url.path[1:],
            user=url.username,
            password=url.password,
            host=url.hostname,
            port=url.port
        )
        return conn
    
    # Для локальной разработки
    try:
        conn = psycopg2.connect(
            host='localhost',
            database='notes_app',
            user='postgres',
            password='',  # замените на ваш пароль
            port=5433
        )
        return conn
    except Exception as e:
        print(f"Ошибка подключения к локальной БД: {e}")
        # Fallback: создаем SQLite базу
        import sqlite3
        conn = sqlite3.connect('notes.db')
        conn.row_factory = sqlite3.Row
        return conn

# Инициализация базы данных
def init_db():
    if TESTING:
        return  # В режиме тестирования таблица уже создана в get_db_connection
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute('''
            CREATE TABLE IF NOT EXISTS notes (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                content TEXT,
                status VARCHAR(50) DEFAULT 'todo',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        conn.commit()
        cur.close()
        conn.close()
        print("✅ Таблица 'notes' создана/проверена")
        
    except Exception as e:
        print(f"❌ Ошибка инициализации базы: {e}")

@app.route('/')
def home():
    log_action('VISIT_HOME')
    return jsonify({
        "message": "Notes App API", 
        "status": "running", 
        "port": 5433,
        "logging": "enabled"
    })

@app.route('/notes', methods=['GET'])
def get_notes():
    try:
        log_action('GET_ALL_NOTES')
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT * FROM notes ORDER BY created_at DESC')
        notes = cur.fetchall()
        
        notes_list = []
        for note in notes:
            notes_list.append({
                'id': note[0],
                'title': note[1],
                'content': note[2],
                'status': note[3],
                'created_at': note[4].isoformat() if note[4] else None
            })
        
        cur.close()
        conn.close()
        return jsonify(notes_list)
    except Exception as e:
        log_action('ERROR', details=f"Get notes failed: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/notes', methods=['POST'])
def create_note():
    try:
        data = request.json
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute('''
            INSERT INTO notes (title, content, status, created_at)
            VALUES (%s, %s, %s, %s)
            RETURNING id
        ''', (
            data.get('title', ''), 
            data.get('content', ''), 
            data.get('status', 'todo'),
            data.get('created_at', datetime.now().isoformat())
        ))
        
        note_id = cur.fetchone()[0]
        conn.commit()
        
        cur.execute('SELECT * FROM notes WHERE id = %s', (note_id,))
        new_note = cur.fetchone()
        
        note_dict = {
            'id': new_note[0],
            'title': new_note[1],
            'content': new_note[2],
            'status': new_note[3],
            'created_at': new_note[4].isoformat() if new_note[4] else None
        }
        
        cur.close()
        conn.close()
        
        # Логируем создание заметки
        log_action('CREATE_NOTE', note_id, {
            'title': data.get('title', ''),
            'status': data.get('status', 'todo')
        })
        
        return jsonify(note_dict), 201
    except Exception as e:
        log_action('ERROR', details=f"Create note failed: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/notes/<int:note_id>', methods=['PATCH'])
def update_note(note_id):
    try:
        data = request.json
        conn = get_db_connection()
        cur = conn.cursor()
        
        update_fields = []
        values = []
        changes = {}
        
        if 'title' in data:
            update_fields.append("title = %s")
            values.append(data['title'])
            changes['title'] = data['title']
        
        if 'content' in data:
            update_fields.append("content = %s")
            values.append(data['content'])
            changes['content'] = 'updated'  # не логируем сам контент для краткости
        
        values.append(note_id)
        
        if update_fields:
            query = f"UPDATE notes SET {', '.join(update_fields)} WHERE id = %s RETURNING *"
            cur.execute(query, values)
            updated_note = cur.fetchone()
            conn.commit()
            
            if updated_note:
                note_dict = {
                    'id': updated_note[0],
                    'title': updated_note[1],
                    'content': updated_note[2],
                    'status': updated_note[3],
                    'created_at': updated_note[4].isoformat() if updated_note[4] else None
                }
                cur.close()
                conn.close()
                
                # Логируем обновление заметки
                log_action('UPDATE_NOTE', note_id, {
                    'changes': list(changes.keys()),
                    'new_title': changes.get('title')
                })
                
                return jsonify(note_dict)
        
        cur.close()
        conn.close()
        return jsonify({'error': 'Note not found'}), 404
    except Exception as e:
        log_action('ERROR', note_id, f"Update note failed: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/notes/<int:note_id>/status', methods=['PATCH'])
def update_note_status(note_id):
    try:
        data = request.json
        new_status = data.get('status', 'todo')
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Получаем старый статус для логирования
        cur.execute('SELECT status FROM notes WHERE id = %s', (note_id,))
        old_note = cur.fetchone()
        old_status = old_note[0] if old_note else None
        
        cur.execute('UPDATE notes SET status = %s WHERE id = %s RETURNING *', (new_status, note_id))
        updated_note = cur.fetchone()
        conn.commit()
        
        if updated_note:
            note_dict = {
                'id': updated_note[0],
                'title': updated_note[1],
                'content': updated_note[2],
                'status': updated_note[3],
                'created_at': updated_note[4].isoformat() if updated_note[4] else None
            }
            cur.close()
            conn.close()
            
            # Логируем изменение статуса
            log_action('CHANGE_STATUS', note_id, {
                'old_status': old_status,
                'new_status': new_status
            })
            
            return jsonify(note_dict)
        
        cur.close()
        conn.close()
        return jsonify({'error': 'Note not found'}), 404
    except Exception as e:
        log_action('ERROR', note_id, f"Status update failed: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/notes/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Получаем информацию о заметке перед удалением для логирования
        cur.execute('SELECT title, status FROM notes WHERE id = %s', (note_id,))
        note_info = cur.fetchone()
        
        cur.execute('DELETE FROM notes WHERE id = %s', (note_id,))
        conn.commit()
        cur.close()
        conn.close()
        
        if note_info:
            # Логируем удаление заметки
            log_action('DELETE_NOTE', note_id, {
                'title': note_info[0],
                'status': note_info[1]
            })
        
        return '', 204
    except Exception as e:
        log_action('ERROR', note_id, f"Delete note failed: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/logs', methods=['GET'])
def get_logs():
    try:
        password = request.args.get('password')
        if password != 'admin123':  # простой пароль для демо
            return jsonify({'error': 'Unauthorized'}), 401
            
        log_lines = []
        log_file = 'logs/app.log'
        
        if os.path.exists(log_file):
            with open(log_file, 'r', encoding='utf-8') as f:
                log_lines = f.readlines()[-100:]  # последние 100 строк
        
        return jsonify({
            'logs': log_lines,
            'total': len(log_lines)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Инициализируем базу и логирование при запуске
def escape_html(s=''):
    """Экранирует HTML символы для безопасности"""
    if s is None:
        s = ''
    s = str(s)
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace("'", '&#39;')

init_db()
setup_logging()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"🚀 Server running on http://localhost:{port}")
    print(f"🗄️  PostgreSQL connected on port 5433")
    print(f"📝 Logging enabled - check logs/app.log")
    app.run(host='0.0.0.0', port=port)
    
if __name__ != '__main__':
    # Это нужно для pytest
    application = app