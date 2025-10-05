# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import psycopg2
from datetime import datetime
import urllib.parse

app = Flask(__name__)
CORS(app)

# Получение подключения к базе данных
def get_db_connection():
    # Для Render PostgreSQL
    database_url = os.environ.get('DATABASE_URL')
    
    if database_url:
        # Parse the database URL for Render
        parsed_url = urllib.parse.urlparse(database_url)
        conn = psycopg2.connect(
            database=parsed_url.path[1:],
            user=parsed_url.username,
            password=parsed_url.password,
            host=parsed_url.hostname,
            port=parsed_url.port
        )
    else:
        # Для локальной разработки
        conn = psycopg2.connect(
            host='localhost',
            database='notes_db',
            user='postgres',
            password='password'
        )
    
    return conn

def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        CREATE TABLE IF NOT EXISTS notes (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT,
            status TEXT DEFAULT 'todo',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    cur.close()
    conn.close()

@app.route('/notes', methods=['GET'])
def get_notes():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT * FROM notes ORDER BY created_at DESC')
    notes = cur.fetchall()
    
    # Конвертируем в список словарей
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

@app.route('/notes', methods=['POST'])
def create_note():
    data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute('''
        INSERT INTO notes (title, content, status, created_at)
        VALUES (%s, %s, %s, %s)
        RETURNING id, title, content, status, created_at
    ''', (data.get('title', ''), 
          data.get('content', ''), 
          data.get('status', 'todo'),
          data.get('created_at', datetime.now().isoformat())))
    
    new_note = cur.fetchone()
    conn.commit()
    
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

@app.route('/notes/<int:note_id>', methods=['PATCH'])
def update_note(note_id):
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

@app.route('/notes/<int:note_id>/status', methods=['PATCH'])
def update_note_status(note_id):
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

@app.route('/notes/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('DELETE FROM notes WHERE id = %s', (note_id,))
    conn.commit()
    cur.close()
    conn.close()
    
    return '', 204

# Инициализируем базу при запуске
init_db()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)