from flask import Flask, request, jsonify, abort
from models import db, Note
import config

def create_app():
    app = Flask(__name__)
    app.config.from_object(config)
    db.init_app(app)

    @app.route('/notes', methods=['GET'])
    def list_notes():
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        pagination = Note.query.order_by(Note.id.desc()).paginate(page=page, per_page=per_page, error_out=False)
        items = [note.to_dict() for note in pagination.items]
        return jsonify({
            "items": items,
            "page": page,
            "per_page": per_page,
            "total": pagination.total
        })

    @app.route('/notes/<int:note_id>', methods=['GET'])
    def get_note(note_id):
        note = Note.query.get_or_404(note_id)
        return jsonify(note.to_dict())

    @app.route('/notes', methods=['POST'])
    def create_note():
        data = request.get_json() or {}
        title = data.get('title')
        content = data.get('content', '')
        if not title:
            return jsonify({"error": "title required"}), 400
        note = Note(title=title, content=content)
        db.session.add(note)
        db.session.commit()
        return jsonify(note.to_dict()), 201

    @app.route('/notes/<int:note_id>', methods=['PUT', 'PATCH'])
    def update_note(note_id):
        note = Note.query.get_or_404(note_id)
        data = request.get_json() or {}
        if 'title' in data:
            note.title = data['title']
        if 'content' in data:
            note.content = data['content']
        db.session.commit()
        return jsonify(note.to_dict())

    @app.route('/notes/<int:note_id>', methods=['DELETE'])
    def delete_note(note_id):
        note = Note.query.get_or_404(note_id)
        db.session.delete(note)
        db.session.commit()
        return jsonify({"message": "deleted"}), 200

    return app

if __name__ == '__main__':
    app = create_app()
    
    # создаём БД при первом запуске
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='127.0.0.1', port=5000)
