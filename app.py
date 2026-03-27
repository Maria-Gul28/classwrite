from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
import json
import os
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
socketio = SocketIO(app, cors_allowed_origins="*")

# Data storage paths
DATA_DIR = 'data'
ASSIGNMENTS_FILE = os.path.join(DATA_DIR, 'assignments.json')
SUBMISSIONS_FILE = os.path.join(DATA_DIR, 'submissions.json')
STUDENT_WORK_FILE = os.path.join(DATA_DIR, 'student_work.json')

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

# Initialize data files if they don't exist
def init_data_files():
    if not os.path.exists(ASSIGNMENTS_FILE):
        with open(ASSIGNMENTS_FILE, 'w') as f:
            json.dump([], f)
    if not os.path.exists(SUBMISSIONS_FILE):
        with open(SUBMISSIONS_FILE, 'w') as f:
            json.dump([], f)
    if not os.path.exists(STUDENT_WORK_FILE):
        with open(STUDENT_WORK_FILE, 'w') as f:
            json.dump({}, f)

init_data_files()

# Helper functions
def load_assignments():
    with open(ASSIGNMENTS_FILE, 'r') as f:
        return json.load(f)

def save_assignments(assignments):
    with open(ASSIGNMENTS_FILE, 'w') as f:
        json.dump(assignments, f, indent=2)

def load_submissions():
    with open(SUBMISSIONS_FILE, 'r') as f:
        return json.load(f)

def save_submissions(submissions):
    with open(SUBMISSIONS_FILE, 'w') as f:
        json.dump(submissions, f, indent=2)

def load_student_work():
    with open(STUDENT_WORK_FILE, 'r') as f:
        return json.load(f)

def save_student_work(work):
    with open(STUDENT_WORK_FILE, 'w') as f:
        json.dump(work, f, indent=2)

# Routes
@app.route('/')
def index():
    return render_template('index.html')

# Teacher endpoints
@app.route('/api/assignments', methods=['GET', 'POST'])
def assignments():
    if request.method == 'GET':
        return jsonify(load_assignments())
    
    elif request.method == 'POST':
        data = request.json
        assignments = load_assignments()
        new_id = len(assignments) + 1
        new_assignment = {
            'id': new_id,
            'title': data.get('title', 'Untitled'),
            'question': data.get('question', ''),
            'resources': data.get('resources', []),
            'criteria': data.get('criteria', []),
            'mindmap': data.get('mindmap', ''),
            'images': data.get('images', []),
            'created_at': datetime.now().isoformat()
        }
        assignments.append(new_assignment)
        save_assignments(assignments)
        return jsonify(new_assignment)

@app.route('/api/assignments/<int:assignment_id>', methods=['DELETE'])
def delete_assignment(assignment_id):
    assignments = load_assignments()
    assignments = [a for a in assignments if a['id'] != assignment_id]
    save_assignments(assignments)
    return jsonify({'success': True})

@app.route('/api/submissions', methods=['GET'])
def get_submissions():
    return jsonify(load_submissions())

@app.route('/api/submissions/<int:assignment_id>', methods=['GET'])
def get_assignment_submissions(assignment_id):
    submissions = load_submissions()
    filtered = [s for s in submissions if s['assignment_id'] == assignment_id]
    return jsonify(filtered)

@app.route('/api/student-work', methods=['GET'])
def get_all_student_work():
    return jsonify(load_student_work())

# Student endpoints
@app.route('/api/assignment/<int:assignment_id>', methods=['GET'])
def get_assignment(assignment_id):
    assignments = load_assignments()
    assignment = next((a for a in assignments if a['id'] == assignment_id), None)
    if assignment:
        return jsonify(assignment)
    return jsonify({'error': 'Assignment not found'}), 404

@app.route('/api/submit', methods=['POST'])
def submit_work():
    data = request.json
    student_name = data.get('student_name')
    assignment_id = data.get('assignment_id')
    content = data.get('content')
    
    submissions = load_submissions()
    
    # Check if already submitted
    existing = next((s for s in submissions if s['student_name'] == student_name and s['assignment_id'] == assignment_id), None)
    
    submission = {
        'student_name': student_name,
        'assignment_id': assignment_id,
        'content': content,
        'submitted_at': datetime.now().isoformat(),
        'status': 'submitted'
    }
    
    if existing:
        # Update existing
        existing.update(submission)
    else:
        submissions.append(submission)
    
    save_submissions(submissions)
    
    # Clear active work after submission
    student_work = load_student_work()
    key = f"{student_name}_{assignment_id}"
    if key in student_work:
        del student_work[key]
        save_student_work(student_work)
    
    # Emit to teacher that submission was made
    socketio.emit('submission_update', submission)
    
    return jsonify({'success': True})

# Socket.IO events for real-time progress
@socketio.on('update_progress')
def handle_progress(data):
    student_name = data.get('student_name')
    assignment_id = data.get('assignment_id')
    content = data.get('content')
    
    student_work = load_student_work()
    key = f"{student_name}_{assignment_id}"
    
    student_work[key] = {
        'student_name': student_name,
        'assignment_id': assignment_id,
        'content': content,
        'last_updated': datetime.now().isoformat(),
        'status': 'in_progress'
    }
    
    save_student_work(student_work)
    
    # Broadcast to teacher
    emit('progress_update', {
        'student_name': student_name,
        'assignment_id': assignment_id,
        'content': content,
        'last_updated': datetime.now().isoformat()
    }, broadcast=True)

@socketio.on('join_assignment')
def handle_join(data):
    student_name = data.get('student_name')
    assignment_id = data.get('assignment_id')
    
    # Notify teacher that student joined
    emit('student_joined', {
        'student_name': student_name,
        'assignment_id': assignment_id,
        'timestamp': datetime.now().isoformat()
    }, broadcast=True)

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)