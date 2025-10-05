# app.py
import os
import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import urllib.parse

app = Flask(__name__)
CORS(app)

# Функция для подключения к базе данных
def get_db_connection():
    # Если есть DATABASE_URL (на Render), используем его
    if 'DATABASE_URL' in os.environ:
        urllib.parse.uses_netloc.append('postgres')
        url = urllib.parse.urlparse(os.environ['DATABASE_URL'])
        
        conn = psycopg2.connect(
            database=url.path[1:],
            user=url.username,
            password=url.password,
            host=url.hostname,
            port=url.port
        )
    else:
        # Локальное подключение на порту 5433
        conn = psycopg2.connect(
            host='localhost',
            database='notes_app',  # или 'postgres' если базу еще не создали
            user='postgres',
            password='ваш_пароль',  # пароль который вы ставили при установке
            port=5433  # ⬅️ ВАЖНО: меняем порт на 5433
        )
    return conn

# Инициализация базы данных
def init_db():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Создаем базу данных если она не существует
        cur.execute("SELECT 1 FROM pg_database WHERE datname = 'notes_app'")
        if not cur.fetchone():
            cur.execute('CREATE DATABASE notes_app')
            print("✅ База данных 'notes_app' создана")
        
        conn.commit()
        cur.close()
        conn.close()
        
        # Подключаемся к новой базе
        conn = psycopg2.connect(
            host='localhost',
            database='notes_app',
            user='postgres',
            password='ваш_пароль',
            port=5433
        )
        cur = conn.cursor()
        
        # Создаем таблицу
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
    return jsonify({"message": "Notes App API", "status": "running", "port": 5433})

@app.route('/notes', methods=['GET'])
def get_notes():
    try:
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
        return jsonify(note_dict), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/notes/<int:note_id>', methods=['PATCH'])
def update_note(note_id):
    try:
        data = request.json
        conn = get_db_connection()
        cur = conn.cursor()
        
        update_fields = []
        values = []
        
        if 'title' in data:
            update_fields.append("title = %s")
            values.append(data['title'])
        
        if 'content' in data:
            update_fields.append("content = %s")
            values.append(data['content'])
        
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
                return jsonify(note_dict)
        
        cur.close()
        conn.close()
        return jsonify({'error': 'Note not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/notes/<int:note_id>/status', methods=['PATCH'])
def update_note_status(note_id):
    try:
        data = request.json
        new_status = data.get('status', 'todo')
        
        conn = get_db_connection()
        cur = conn.cursor()
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
            return jsonify(note_dict)
        
        cur.close()
        conn.close()
        return jsonify({'error': 'Note not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/notes/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('DELETE FROM notes WHERE id = %s', (note_id,))
        conn.commit()
        cur.close()
        conn.close()
        
        return '', 204
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Инициализируем базу при запуске
init_db()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"🚀 Server running on http://localhost:{port}")
    print(f"🗄️  PostgreSQL connected on port 5433")
    app.run(host='0.0.0.0', port=port)