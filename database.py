import os
import json
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool

# Get database URL from environment variable (Render sets this automatically)
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://localhost/classwrite')

# Create connection pool for better performance
pool = ThreadedConnectionPool(1, 20, DATABASE_URL)

def get_db():
    return pool.getconn()

def release_db(conn):
    pool.putconn(conn)

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS assignments (
            id SERIAL PRIMARY KEY,
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
            id SERIAL PRIMARY KEY,
            student_name TEXT NOT NULL,
            assignment_id INTEGER NOT NULL,
            content TEXT,
            status TEXT DEFAULT 'submitted',
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (assignment_id) REFERENCES assignments (id) ON DELETE CASCADE
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS student_work (
            id SERIAL PRIMARY KEY,
            student_name TEXT NOT NULL,
            assignment_id INTEGER NOT NULL,
            content TEXT,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'in_progress',
            UNIQUE(student_name, assignment_id)
        )
    ''')
    
    conn.commit()
    cursor.close()
    release_db(conn)

def save_assignment(title, question, resources, criteria, mindmap, images):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO assignments (title, question, resources, criteria, mindmap, images)
        VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
    ''', (title, question, json.dumps(resources), json.dumps(criteria), mindmap, json.dumps(images)))
    assignment_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    release_db(conn)
    return get_assignment(assignment_id)

def get_assignments():
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute('SELECT * FROM assignments ORDER BY created_at DESC')
    rows = cursor.fetchall()
    cursor.close()
    release_db(conn)
    
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
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute('SELECT * FROM assignments WHERE id = %s', (assignment_id,))
    row = cursor.fetchone()
    cursor.close()
    release_db(conn)
    
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
    cursor.execute('DELETE FROM assignments WHERE id = %s', (assignment_id,))
    cursor.execute('DELETE FROM submissions WHERE assignment_id = %s', (assignment_id,))
    cursor.execute('DELETE FROM student_work WHERE assignment_id = %s', (assignment_id,))
    conn.commit()
    cursor.close()
    release_db(conn)

def save_submission(student_name, assignment_id, content):
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if submission exists
    cursor.execute('SELECT id FROM submissions WHERE student_name = %s AND assignment_id = %s', 
                   (student_name, assignment_id))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
            UPDATE submissions 
            SET content = %s, submitted_at = CURRENT_TIMESTAMP, status = 'submitted'
            WHERE student_name = %s AND assignment_id = %s
        ''', (content, student_name, assignment_id))
    else:
        cursor.execute('''
            INSERT INTO submissions (student_name, assignment_id, content, status)
            VALUES (%s, %s, %s, 'submitted')
        ''', (student_name, assignment_id, content))
    
    conn.commit()
    cursor.close()
    release_db(conn)

def get_submissions(assignment_id=None):
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    if assignment_id:
        cursor.execute('SELECT * FROM submissions WHERE assignment_id = %s ORDER BY submitted_at DESC', 
                       (assignment_id,))
    else:
        cursor.execute('SELECT * FROM submissions ORDER BY submitted_at DESC')
    
    rows = cursor.fetchall()
    cursor.close()
    release_db(conn)
    
    return [dict(row) for row in rows]

def save_student_work(student_name, assignment_id, content):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO student_work (student_name, assignment_id, content, last_updated, status)
        VALUES (%s, %s, %s, CURRENT_TIMESTAMP, 'in_progress')
        ON CONFLICT (student_name, assignment_id) 
        DO UPDATE SET content = %s, last_updated = CURRENT_TIMESTAMP, status = 'in_progress'
    ''', (student_name, assignment_id, content, content))
    
    conn.commit()
    cursor.close()
    release_db(conn)

def get_student_work():
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute('SELECT * FROM student_work ORDER BY last_updated DESC')
    rows = cursor.fetchall()
    cursor.close()
    release_db(conn)
    
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
    cursor.execute('DELETE FROM student_work WHERE student_name = %s AND assignment_id = %s', 
                   (student_name, assignment_id))
    conn.commit()
    cursor.close()
    release_db(conn)

# Initialize database
init_db()