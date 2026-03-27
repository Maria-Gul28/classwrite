import os
import sys
print("Python version:", sys.version)
print("Starting app...")
print("Current directory:", os.getcwd())

from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
from datetime import datetime
import database

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'

# Try to use eventlet, fall back to threading if not available
try:
    import eventlet
    async_mode = 'eventlet'
except ImportError:
    async_mode = 'threading'

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode=async_mode,
    logger=True,
    engineio_logger=True
)

# Rest of your code...
# Routes
@app.route('/')
def index():
    return render_template('index.html')

# Teacher endpoints
@app.route('/api/assignments', methods=['GET', 'POST'])
def assignments():
    if request.method == 'GET':
        return jsonify(database.get_assignments())

    elif request.method == 'POST':
        data = request.json
        new_assignment = database.save_assignment(
            title=data.get('title', 'Untitled'),
            question=data.get('question', ''),
            resources=data.get('resources', []),
            criteria=data.get('criteria', []),
            mindmap=data.get('mindmap', ''),
            images=data.get('images', [])
        )
        return jsonify(new_assignment)

@app.route('/api/assignments/<int:assignment_id>', methods=['DELETE'])
def delete_assignment(assignment_id):
    database.delete_assignment(assignment_id)
    return jsonify({'success': True})

@app.route('/api/submissions', methods=['GET'])
def get_submissions():
    return jsonify(database.get_submissions())

@app.route('/api/submissions/<int:assignment_id>', methods=['GET'])
def get_assignment_submissions(assignment_id):
    return jsonify(database.get_submissions(assignment_id))

@app.route('/api/student-work', methods=['GET'])
def get_all_student_work():
    return jsonify(database.get_student_work())

# Student endpoints
@app.route('/api/assignment/<int:assignment_id>', methods=['GET'])
def get_assignment(assignment_id):
    assignment = database.get_assignment(assignment_id)
    if assignment:
        return jsonify(assignment)
    return jsonify({'error': 'Assignment not found'}), 404

@app.route('/api/submit', methods=['POST'])
def submit_work():
    data = request.json
    student_name = data.get('student_name')
    assignment_id = data.get('assignment_id')
    content = data.get('content')

    database.save_submission(student_name, assignment_id, content)
    database.delete_student_work(student_name, assignment_id)

    submission = {
        'student_name': student_name,
        'assignment_id': assignment_id,
        'content': content,
        'submitted_at': datetime.now().isoformat(),
        'status': 'submitted'
    }

    # Emit to teacher that submission was made
    socketio.emit('submission_update', submission)

    return jsonify({'success': True})

# Socket.IO events for real-time progress
@socketio.on('update_progress')
def handle_progress(data):
    student_name = data.get('student_name')
    assignment_id = data.get('assignment_id')
    content = data.get('content')

    database.save_student_work(student_name, assignment_id, content)

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

    emit('student_joined', {
        'student_name': student_name,
        'assignment_id': assignment_id,
        'timestamp': datetime.now().isoformat()
    }, broadcast=True)

if __name__ == '__main__':
    # For local development
    socketio.run(app, debug=True, port=5000)
else:
    # For production (Render)
    application = app