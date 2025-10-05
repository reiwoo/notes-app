#!/usr/bin/env python3
"""Скрипт для запуска тестов"""
import subprocess
import sys
import os
import requests

def is_server_running():
    """Проверяет, запущен ли сервер"""
    try:
        response = requests.get("http://localhost:5000/", timeout=2)
        return response.status_code == 200
    except:
        return False

def run_tests():
    """Запускает тесты и возвращает результат"""
    print("🚀 Запуск тестов...")
    print("=" * 50)
    
    # 1. Запускаем базовые тесты (должны всегда работать)
    print("1. Запуск базовых тестов...")
    result_basic = subprocess.run([
        sys.executable, '-m', 'pytest', 
        'tests/test_basic.py',
        '-v',
        '--tb=short'
    ], capture_output=False)
    
    if result_basic.returncode != 0:
        print("❌ Базовые тесты не прошли")
        return result_basic.returncode
    
    print("✅ Базовые тесты прошли успешно!")
    
    # 2. Проверяем запущен ли сервер
    if not is_server_running():
        print("\n⚠️  Сервер не запущен. Запустите его для полного тестирования:")
        print("   python app.py")
        print("\n📋 Запуская только базовые тесты...")
        return result_basic.returncode
    
    # 3. Запускаем тесты с живым сервером
    print("\n2. Запуск тестов с живым сервером...")
    result_live = subprocess.run([
        sys.executable, '-m', 'pytest', 
        'tests/test_simple_live.py',
        '-v',
        '--tb=short'
    ], capture_output=False)
    
    print("=" * 50)
    
    if result_live.returncode == 0:
        print("✅ Все тесты прошли успешно!")
    else:
        print("❌ Некоторые тесты не прошли")
    
    return result_live.returncode

if __name__ == '__main__':
    exit_code = run_tests()
    sys.exit(exit_code)