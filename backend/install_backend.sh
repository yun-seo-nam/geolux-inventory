#!/bin/bash

echo "가상환경 생성 중..."
python3 -m venv venv
source venv/bin/activate

echo "필수 패키지 설치 중..."
pip install flask flask-socketio flask-sqlalchemy pymysql

pip install pandas

echo "requirements.txt 저장..."
pip freeze > requirements.txt

echo "설치 완료! 가상환경은 'source venv/bin/activate'로 다시 진입 가능"
