import os
from datetime import datetime
import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool
from contextlib import contextmanager

# Get database URL from environment variable
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://localhost/classwrite')

# Create connection pool
pool = ThreadedConnectionPool(
    minconn=1,
    maxconn=10,
    dsn=DATABASE_URL
)

@contextmanager
def get_db():
    """Context manager that gets a connection and always returns it to the pool."""
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)

def _dt(val):
    """Convert datetime to ISO string, or return as-is if already a string/None."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.isoformat()
    return str(val)

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS assignments (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                question TEXT NOT NULL,
                resources JSONB DEFAULT '[]',
                criteria JSONB DEFAULT '[]',
                mindmap TEXT,
                images JSONB DEFAULT '[]',
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
                UNIQUE(student_name, assignment_id),
                FOREIGN KEY (assignment_id) REFERENCES assignments (id) ON DELETE CASCADE
            )
        ''')
        
        cursor.close()
        print("Database tables created/verified successfully")

def save_assignment(title, question, resources, criteria, mindmap, images):
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO assignments (title, question, resources, criteria, mindmap, images)
            VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
        ''', (title, question,
              psycopg2.extras.Json(resources),
              psycopg2.extras.Json(criteria),
              mindmap,
              psycopg2.extras.Json(images)))
        
        assignment_id = cursor.fetchone()[0]
        cursor.close()
    
    return get_assignment(assignment_id)

def get_assignment(assignment_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM assignments WHERE id = %s', (assignment_id,))
        row = cursor.fetchone()
        cursor.close()
        
        if row:
            return {
                'id': row[0],
                'title': row[1],
                'question': row[2],
                'resources': row[3] if row[3] is not None else [],
                'criteria': row[4] if row[4] is not None else [],
                'mindmap': row[5] or '',
                'images': row[6] if row[6] is not None else [],
                'created_at': _dt(row[7])
            }
        return None

def get_assignments():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM assignments ORDER BY created_at DESC')
        rows = cursor.fetchall()
        cursor.close()
        
        assignments_list = []
        for row in rows:
            assignments_list.append({
                'id': row[0],
                'title': row[1],
                'question': row[2],
                'resources': row[3] if row[3] is not None else [],
                'criteria': row[4] if row[4] is not None else [],
                'mindmap': row[5] or '',
                'images': row[6] if row[6] is not None else [],
                'created_at': _dt(row[7])
            })
        
        return assignments_list

def delete_assignment(assignment_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM assignments WHERE id = %s', (assignment_id,))
        cursor.close()

def save_submission(student_name, assignment_id, content):
    with get_db() as conn:
        cursor = conn.cursor()
        
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
        
        cursor.close()

def get_submissions(assignment_id=None):
    with get_db() as conn:
        cursor = conn.cursor()
        
        if assignment_id:
            cursor.execute('SELECT * FROM submissions WHERE assignment_id = %s ORDER BY submitted_at DESC', 
                           (assignment_id,))
        else:
            cursor.execute('SELECT * FROM submissions ORDER BY submitted_at DESC')
        
        rows = cursor.fetchall()
        cursor.close()
        
        submissions_list = []
        for row in rows:
            submissions_list.append({
                'id': row[0],
                'student_name': row[1],
                'assignment_id': row[2],
                'content': row[3] or '',
                'status': row[4],
                'submitted_at': _dt(row[5])
            })
        return submissions_list

def save_student_work(student_name, assignment_id, content):
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO student_work (student_name, assignment_id, content, last_updated, status)
            VALUES (%s, %s, %s, CURRENT_TIMESTAMP, 'in_progress')
            ON CONFLICT (student_name, assignment_id) 
            DO UPDATE SET content = %s, last_updated = CURRENT_TIMESTAMP, status = 'in_progress'
        ''', (student_name, assignment_id, content, content))
        
        cursor.close()

def get_student_work():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM student_work ORDER BY last_updated DESC')
        rows = cursor.fetchall()
        cursor.close()
        
        work_dict = {}
        for row in rows:
            key = f"{row[1]}_{row[2]}"
            work_dict[key] = {
                'student_name': row[1],
                'assignment_id': row[2],
                'content': row[3] or '',
                'last_updated': _dt(row[4]),
                'status': row[5]
            }
        return work_dict

def delete_student_work(student_name, assignment_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM student_work WHERE student_name = %s AND assignment_id = %s', 
                       (student_name, assignment_id))
        cursor.close()

# Initialize database
try:
    init_db()
except Exception as e:
    print(f"Failed to initialize database: {e}")