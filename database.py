import os
import json
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool

# Get database URL from environment variable
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://localhost/classwrite')

# Create connection pool
pool = ThreadedConnectionPool(
    minconn=1,
    maxconn=10,
    dsn=DATABASE_URL
)

def get_db():
    """Get a connection from the pool"""
    return pool.getconn()

def release_db(conn):
    """Release a connection back to the pool"""
    if conn:
        pool.putconn(conn)

def init_db():
    conn = None
    cursor = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Create tables
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
        
        conn.commit()
        print("Database tables created/verified successfully")
        
    except Exception as e:
        print(f"Error initializing database: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            release_db(conn)

def save_assignment(title, question, resources, criteria, mindmap, images):
    conn = None
    cursor = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO assignments (title, question, resources, criteria, mindmap, images)
            VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
        ''', (
            title, 
            question, 
            json.dumps(resources),
            json.dumps(criteria),
            mindmap, 
            json.dumps(images)
        ))
        assignment_id = cursor.fetchone()[0]
        conn.commit()
        
        cursor.close()
        release_db(conn)
        return get_assignment(assignment_id)
        
    except Exception as e:
        print(f"Error saving assignment: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if cursor and not cursor.closed:
            cursor.close()
        if conn:
            release_db(conn)

def get_assignments():
    conn = None
    cursor = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM assignments ORDER BY created_at DESC')
        rows = cursor.fetchall()
        
        assignments_list = []
        for row in rows:
            # row is a tuple, need to access by index
            # PostgreSQL returns JSONB as Python objects already parsed
            # So we just use them directly
            resources = row[3]  # resources column
            if resources is None:
                resources = []
            elif isinstance(resources, str):
                resources = json.loads(resources)
                
            criteria = row[4]  # criteria column
            if criteria is None:
                criteria = []
            elif isinstance(criteria, str):
                criteria = json.loads(criteria)
                
            images = row[6]  # images column
            if images is None:
                images = []
            elif isinstance(images, str):
                images = json.loads(images)
            
            assignments_list.append({
                'id': row[0],
                'title': row[1],
                'question': row[2],
                'resources': resources,
                'criteria': criteria,
                'mindmap': row[5] or '',
                'images': images,
                'created_at': row[7]
            })
        
        cursor.close()
        release_db(conn)
        return assignments_list
        
    except Exception as e:
        print(f"Error getting assignments: {e}")
        if conn:
            release_db(conn)
        raise

def get_assignment(assignment_id):
    conn = None
    cursor = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM assignments WHERE id = %s', (assignment_id,))
        row = cursor.fetchone()
        cursor.close()
        release_db(conn)
        
        if row:
            resources = row[3]
            if resources is None:
                resources = []
            elif isinstance(resources, str):
                resources = json.loads(resources)
                
            criteria = row[4]
            if criteria is None:
                criteria = []
            elif isinstance(criteria, str):
                criteria = json.loads(criteria)
                
            images = row[6]
            if images is None:
                images = []
            elif isinstance(images, str):
                images = json.loads(images)
            
            return {
                'id': row[0],
                'title': row[1],
                'question': row[2],
                'resources': resources,
                'criteria': criteria,
                'mindmap': row[5] or '',
                'images': images,
                'created_at': row[7]
            }
        return None
        
    except Exception as e:
        print(f"Error getting assignment {assignment_id}: {e}")
        if conn:
            release_db(conn)
        raise

def delete_assignment(assignment_id):
    conn = None
    cursor = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM assignments WHERE id = %s', (assignment_id,))
        conn.commit()
        
    except Exception as e:
        print(f"Error deleting assignment {assignment_id}: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            release_db(conn)

def save_submission(student_name, assignment_id, content):
    conn = None
    cursor = None
    try:
        conn = get_db()
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
        
        conn.commit()
        
    except Exception as e:
        print(f"Error saving submission: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            release_db(conn)

def get_submissions(assignment_id=None):
    conn = None
    cursor = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        if assignment_id:
            cursor.execute('SELECT * FROM submissions WHERE assignment_id = %s ORDER BY submitted_at DESC', 
                           (assignment_id,))
        else:
            cursor.execute('SELECT * FROM submissions ORDER BY submitted_at DESC')
        
        rows = cursor.fetchall()
        cursor.close()
        release_db(conn)
        
        submissions_list = []
        for row in rows:
            submissions_list.append({
                'id': row[0],
                'student_name': row[1],
                'assignment_id': row[2],
                'content': row[3] or '',
                'status': row[4],
                'submitted_at': row[5]
            })
        return submissions_list
        
    except Exception as e:
        print(f"Error getting submissions: {e}")
        if conn:
            release_db(conn)
        raise

def save_student_work(student_name, assignment_id, content):
    conn = None
    cursor = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO student_work (student_name, assignment_id, content, last_updated, status)
            VALUES (%s, %s, %s, CURRENT_TIMESTAMP, 'in_progress')
            ON CONFLICT (student_name, assignment_id) 
            DO UPDATE SET content = %s, last_updated = CURRENT_TIMESTAMP, status = 'in_progress'
        ''', (student_name, assignment_id, content, content))
        
        conn.commit()
        
    except Exception as e:
        print(f"Error saving student work: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            release_db(conn)

def get_student_work():
    conn = None
    cursor = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM student_work ORDER BY last_updated DESC')
        rows = cursor.fetchall()
        cursor.close()
        release_db(conn)
        
        work_dict = {}
        for row in rows:
            key = f"{row[1]}_{row[2]}"
            work_dict[key] = {
                'student_name': row[1],
                'assignment_id': row[2],
                'content': row[3] or '',
                'last_updated': row[4],
                'status': row[5]
            }
        return work_dict
        
    except Exception as e:
        print(f"Error getting student work: {e}")
        if conn:
            release_db(conn)
        raise

def delete_student_work(student_name, assignment_id):
    conn = None
    cursor = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM student_work WHERE student_name = %s AND assignment_id = %s', 
                       (student_name, assignment_id))
        conn.commit()
        
    except Exception as e:
        print(f"Error deleting student work: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            release_db(conn)

# Initialize database
try:
    init_db()
except Exception as e:
    print(f"Failed to initialize database: {e}")