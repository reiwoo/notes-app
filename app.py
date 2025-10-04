from flask import Flask, request, jsonify
from models import db, Note
from flask_migrate import Migrate
from schemas import ma, note_schema, notes_schema
import config
from flask_cors import CORS

app = Flask(__name__)
CORS(app) 
app.config.from_object(config)
db.init_app(app)
migrate = Migrate(app, db)
ma.init_app(app)

with app.app_context():
    db.create_all()

# ---------------- GET ALL NOTES ----------------
@app.route('/notes', methods=['GET'])
def get_notes():
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    title_filter = request.args.get('title', None)

    query = Note.query
    if title_filter:
        query = query.filter(Note.title.ilike(f"%{title_filter}%"))

    pagination = query.order_by(Note.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    notes = notes_schema.dump(pagination.items)
    return jsonify({
        "notes": notes,
        "total": pagination.total,
        "page": pagination.page,
        "per_page": pagination.per_page,
        "pages": pagination.pages
    })

# ---------------- GET SINGLE NOTE ----------------
@app.route('/notes/<int:note_id>', methods=['GET'])
def get_note(note_id):
    note = Note.query.get_or_404(note_id)
    return note_schema.jsonify(note)

# ---------------- CREATE NOTE ----------------
@app.route('/notes', methods=['POST'])
def create_note():
    data = request.json
    note = Note(title=data.get('title'), content=data.get('content', ''), status=data.get('status', 'todo'))
    db.session.add(note)
    db.session.commit()
    return jsonify({'id': note.id, 'title': note.title, 'content': note.content, 'status': note.status}), 201

# ---------------- UPDATE NOTE ----------------
@app.route('/notes/<int:note_id>', methods=['PATCH'])
def update_note(note_id):
    note = Note.query.get_or_404(note_id)
    data = request.get_json() or {}
    if 'title' in data:
        note.title = data['title']
    if 'content' in data:
        note.content = data['content']
    if 'status' in data:
        note.status = data['status']
    db.session.commit()
    return jsonify(note.to_dict())

# ---------------- DELETE NOTE ----------------
@app.route('/notes/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    note = Note.query.get_or_404(note_id)
    db.session.delete(note)
    db.session.commit()
    return jsonify({"message": "Note deleted"}), 200

# ---------------- Status NOTE ----------------
@app.route('/notes/<int:note_id>/status', methods=['PATCH'])
def update_note_status(note_id):
    note = Note.query.get_or_404(note_id)
    data = request.get_json() or {}
    if 'status' in data and data['status'] in ['todo', 'doing', 'complete']:
        note.status = data['status']
        db.session.commit()
        return jsonify(note.to_dict())
    return jsonify({"error": "invalid status"}), 400

# ---------------- RUN ----------------
if __name__ == '__main__':
    app.run(debug=True)
