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
    data = request.get_json() or {}
    errors = note_schema.validate(data)
    if errors:
        return jsonify({"errors": errors}), 400

    note = note_schema.load(data)  # создаёт объект Note автоматически
    db.session.add(note)
    db.session.commit()
    return note_schema.jsonify(note), 201

# ---------------- UPDATE NOTE ----------------
@app.route('/notes/<int:note_id>', methods=['PUT', 'PATCH'])
def update_note(note_id):
    note = Note.query.get_or_404(note_id)
    data = request.get_json() or {}
    errors = note_schema.validate(data, partial=True)  # partial=True для PATCH
    if errors:
        return jsonify({"errors": errors}), 400

    if "title" in data:
        note.title = data["title"]
    if "content" in data:
        note.content = data["content"]

    db.session.commit()
    return note_schema.jsonify(note)

# ---------------- DELETE NOTE ----------------
@app.route('/notes/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    note = Note.query.get_or_404(note_id)
    db.session.delete(note)
    db.session.commit()
    return jsonify({"message": "Note deleted"}), 200

# ---------------- RUN ----------------
if __name__ == '__main__':
    app.run(debug=True)
