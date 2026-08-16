#!/usr/bin/env python3
import os, socket, threading, time, webbrowser
from http.server import ThreadingHTTPServer
import app

PORT = int(os.environ.get('PORT', '8080'))

def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()

if __name__ == '__main__':
    app.init_db()
    local = f'http://127.0.0.1:{PORT}'
    network = f'http://{lan_ip()}:{PORT}'
    print('\n' + '='*62)
    print('  НУ ЧТО, ПОЕХАЛИ! — ГЕЙМИФИКАЦИЯ КОМАНДЫ')
    print('='*62)
    print(f'  На этом компьютере: {local}')
    print(f'  На телефонах в этой Wi‑Fi сети: {network}')
    print('  Кабинет управляющего: PIN 2026 (смените после входа)')
    print('='*62)
    print('  Не закрывайте это окно, пока сотрудники пользуются сайтом.\n')
    threading.Timer(1.0, lambda: webbrowser.open(local)).start()
    try:
        ThreadingHTTPServer(('0.0.0.0', PORT), app.Handler).serve_forever()
    except OSError as e:
        print(f'\nНе удалось запустить сервер на порту {PORT}: {e}')
        print('Закройте другую копию приложения и запустите снова.')
        input('\nНажмите Enter для выхода...')
