import sqlite3
from datetime import datetime
import json
import os

DATABASE = 'classwrite.db'

def get_db():
    conn = sqlite3.connect(DATABASE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            question TEXT NOT NULL,
            resources TEXT,
            criteria TEXT,
            mindmap TEXT,
            images TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_name TEXT NOT NULL,
            assignment_id INTEGER NOT NULL,
            content TEXT,
            status TEXT DEFAULT 'submitted',
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (assignment_id) REFERENCES assignments (id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS student_work (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_name TEXT NOT NULL,
            assignment_id INTEGER NOT NULL,
            content TEXT,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'in_progress',
            UNIQUE(student_name, assignment_id)
        )
    ''')
    
    conn.commit()
    conn.close()

def save_assignment(title, question, resources, criteria, mindmap, images):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO assignments (title, question, resources, criteria, mindmap, images)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (title, question, json.dumps(resources), json.dumps(criteria), mindmap, json.dumps(images)))
    conn.commit()
    assignment_id = cursor.lastrowid
    conn.close()
    return get_assignment(assignment_id)

def get_assignments():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM assignments ORDER BY created_at DESC')
    rows = cursor.fetchall()
    conn.close()
    
    assignments = []
    for row in rows:
        assignments.append({
            'id': row['id'],
            'title': row['title'],
            'question': row['question'],
            'resources': json.loads(row['resources']) if row['resources'] else [],
            'criteria': json.loads(row['criteria']) if row['criteria'] else [],
            'mindmap': row['mindmap'],
            'images': json.loads(row['images']) if row['images'] else [],
            'created_at': row['created_at']
        })
    return assignments

def get_assignment(assignment_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM assignments WHERE id = ?', (assignment_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            'id': row['id'],
            'title': row['title'],
            'question': row['question'],
            'resources': json.loads(row['resources']) if row['resources'] else [],
            'criteria': json.loads(row['criteria']) if row['criteria'] else [],
            'mindmap': row['mindmap'],
            'images': json.loads(row['images']) if row['images'] else [],
            'created_at': row['created_at']
        }
    return None

def delete_assignment(assignment_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM assignments WHERE id = ?', (assignment_id,))
    cursor.execute('DELETE FROM submissions WHERE assignment_id = ?', (assignment_id,))
    cursor.execute('DELETE FROM student_work WHERE assignment_id = ?', (assignment_id,))
    conn.commit()
    conn.close()

def save_submission(student_name, assignment_id, content):
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if submission exists
    cursor.execute('SELECT id FROM submissions WHERE student_name = ? AND assignment_id = ?', 
                   (student_name, assignment_id))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
            UPDATE submissions 
            SET content = ?, submitted_at = CURRENT_TIMESTAMP, status = 'submitted'
            WHERE student_name = ? AND assignment_id = ?
        ''', (content, student_name, assignment_id))
    else:
        cursor.execute('''
            INSERT INTO submissions (student_name, assignment_id, content, status)
            VALUES (?, ?, ?, 'submitted')
        ''', (student_name, assignment_id, content))
    
    conn.commit()
    conn.close()

def get_submissions(assignment_id=None):
    conn = get_db()
    cursor = conn.cursor()
    
    if assignment_id:
        cursor.execute('SELECT * FROM submissions WHERE assignment_id = ? ORDER BY submitted_at DESC', 
                       (assignment_id,))
    else:
        cursor.execute('SELECT * FROM submissions ORDER BY submitted_at DESC')
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def save_student_work(student_name, assignment_id, content):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO student_work (student_name, assignment_id, content, last_updated, status)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'in_progress')
        ON CONFLICT(student_name, assignment_id) 
        DO UPDATE SET content = ?, last_updated = CURRENT_TIMESTAMP, status = 'in_progress'
    ''', (student_name, assignment_id, content, content))
    
    conn.commit()
    conn.close()

def get_student_work():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM student_work ORDER BY last_updated DESC')
    rows = cursor.fetchall()
    conn.close()
    
    work_dict = {}
    for row in rows:
        key = f"{row['student_name']}_{row['assignment_id']}"
        work_dict[key] = {
            'student_name': row['student_name'],
            'assignment_id': row['assignment_id'],
            'content': row['content'],
            'last_updated': row['last_updated'],
            'status': row['status']
        }
    return work_dict

def delete_student_work(student_name, assignment_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM student_work WHERE student_name = ? AND assignment_id = ?', 
                   (student_name, assignment_id))
    conn.commit()
    conn.close()

# Initialize database
init_db()