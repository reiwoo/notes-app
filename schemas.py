from flask_marshmallow import Marshmallow
from marshmallow import fields, validate
from models import Note

ma = Marshmallow()

class NoteSchema(ma.SQLAlchemySchema):
    class Meta:
        model = Note
        load_instance = True  # позволяет автоматически создавать Note из JSON

    id = ma.auto_field(dump_only=True)   # read-only
    title = ma.auto_field(required=True, validate=validate.Length(min=1, max=200))
    content = ma.auto_field(allow_none=True)
    created_at = ma.auto_field(dump_only=True)

# Экземпляры схем для удобства
note_schema = NoteSchema()           # один объект
notes_schema = NoteSchema(many=True) # список объектов
