Notes App - Канбан-доска:
Современное веб-приложение для управления задачами в формате канбан-доски. Позволяет создавать, редактировать и перемещать заметки между колонками "Сделать", "В процессе" и "Завершено".
Деплоено с помощью Render: https://notes-app-backend-2453.onrender.com/

Функциональность:
Drag & Drop интерфейс для перемещения заметок
CRUD операции с заметками
Трехколоночная структура канбан-доски
Постоянное хранение данных в PostgreSQL
REST API для расширения функциональности
Система логирования действий

Технологии:
Backend: Python, Flask, PostgreSQL, Gunicorn
Frontend: JavaScript, HTML5, CSS3, Bootstrap 5

Локальная установка:
1. Клонируйте репозиторий:
git clone <url-репозитория>
cd notes-app
2. Создайте виртуальное окружение:
python -m venv venv
venv\Scripts\activate
3. Установите зависимости:
pip install -r requirements.txt
4. Настройте базу данных PostgreSQL:
CREATE DATABASE notes_app;
CREATE USER notes_user WITH PASSWORD 'ваш_пароль';
GRANT ALL PRIVILEGES ON DATABASE notes_app TO notes_user;
5. Запустите приложение:
python app.py

Деплой на Render
1. Создайте аккаунт на render.com
2. Создайте PostgreSQL базу данных:
Name: notes-app-db
Database: notes_app
User: notes_user
Plan: Free
3. Создайте Web Service:
Подключите GitHub репозиторий.
Build Command: pip install -r requirements.txt
Start Command: gunicorn app:app
Добавьте переменную окружения DATABASE_URL

Приложение будет автоматически развернуто и доступно по URL вида: https://notes-app-backend.onrender.com

