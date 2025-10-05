# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Простая in-memory база (для продакшена используйте PostgreSQL)
notes_db = []
current_id = 1

@app.route('/notes', methods=['GET'])
def get_notes():
    return jsonify(notes_db)

@app.route('/notes', methods=['POST'])
def create_note():
    global current_id
    data = request.json
    note = {
        'id': current_id,
        'title': data.get('title', ''),
        'content': data.get('content', ''),
        'status': data.get('status', 'todo'),
        'created_at': data.get('created_at', datetime.now().isoformat())
    }
    notes_db.append(note)
    current_id += 1
    return jsonify(note), 201

@app.route('/notes/<int:note_id>', methods=['PATCH'])
def update_note(note_id):
    data = request.json
    for note in notes_db:
        if note['id'] == note_id:
            if 'title' in data:
                note['title'] = data['title']
            if 'content' in data:
                note['content'] = data['content']
            return jsonify(note)
    return jsonify({'error': 'Note not found'}), 404

@app.route('/notes/<int:note_id>/status', methods=['PATCH'])
def update_note_status(note_id):
    data = request.json
    for note in notes_db:
        if note['id'] == note_id:
            note['status'] = data.get('status', 'todo')
            return jsonify(note)
    return jsonify({'error': 'Note not found'}), 404

@app.route('/notes/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    global notes_db
    notes_db = [note for note in notes_db if note['id'] != note_id]
    return '', 204

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)