from flask import Flask, render_template, request, redirect, url_for, flash, Response, jsonify
from models import mongo_db, Song, User
from config import Config
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from bson import ObjectId
from functools import wraps

app = Flask(__name__)
app.config.from_object(Config)


mongo_db.init_app(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(user_id):
    return User.get(user_id)

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin:
            flash('You do not have permission to access this page.', 'error')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def allowed_files(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']


@app.route('/')
def index():
    songs = Song.get_all()
    liked_song_ids = current_user.get_liked_song_ids() if current_user.is_authenticated else []
    return render_template('index.html', songs=songs, liked_song_ids=liked_song_ids)

@app.route('/search', methods=['GET', 'POST'])
def search():
    query = request.form.get('query', '')
    songs = Song.search(query) if query else []
    liked_song_ids = current_user.get_liked_song_ids() if current_user.is_authenticated else []
    return render_template('search.html', songs=songs, query=query, liked_song_ids=liked_song_ids)


@app.route('/like/<song_id>', methods=['POST'])
@login_required
def toggle_like(song_id):
    liked = current_user.toggle_like(song_id)
    return jsonify({'liked': liked, 'message': 'Success'})

@app.route('/library')
@login_required
def library():
    liked_song_ids = current_user.get_liked_song_ids()
    liked_songs = Song.get_songs_by_ids(liked_song_ids)
    
    
    playlists = [{
        'name': 'Liked Songs',
        'song_count': len(liked_songs),
        'songs': liked_songs
    }]
    return render_template('library.html', playlists=playlists, liked_song_ids=liked_song_ids)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        user_data = mongo_db.users_collection.find_one({'email': email})
        if user_data and check_password_hash(user_data['password'], password):
            user = User(user_data)
            login_user(user)
            flash('Logged in successfully!', 'success')
            if user.is_admin:
                return redirect(url_for('upload'))
            return redirect(url_for('index'))
        else:
            flash('Invalid email or password.', 'error')
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        if mongo_db.users_collection.find_one({'email': email}):
            flash('Email address already in use.', 'error')
            return redirect(url_for('register'))
        role = 'user'
        if mongo_db.users_collection.count_documents({}) == 0:
            role = 'admin'
            flash('Admin account created! Please log in.', 'success')
        else:
            flash('Registration successful! Please log in.', 'success')
        hashed_password = generate_password_hash(password)
        mongo_db.users_collection.insert_one({'username': username, 'email': email, 'password': hashed_password, 'role': role})
        return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('login'))

@app.route('/upload', methods=['GET', 'POST'])
@admin_required
def upload():
    if request.method == 'POST':
        file = request.files.get('file')
        title = request.form.get('title')
        artist = request.form.get('artist')
        genre = request.form.get('genre')
        if file and allowed_files(file.filename):
            file_data = file.read()
            metadata = {'title': title, 'artist': artist, 'genre': genre, 'content_type': file.content_type}
            file_id = Song.store_file(file_data, file.filename, metadata)
            song = Song(title=title, artist=artist, genre=genre, file_id=file_id, filename=file.filename)
            song.save()
            flash('Song uploaded successfully!', 'success')
            return redirect(url_for('upload'))
        else:
            flash('Invalid file type. Please upload MP3, FLAC, or WAV files.', 'error')
    return render_template('upload.html')

@app.route('/delete/<song_id>', methods=['POST'])
@admin_required
def delete_song(song_id):
    if Song.delete(song_id):
        flash('Song deleted successfully.', 'success')
    else:
        flash('Error deleting song.', 'error')
    return redirect(request.referrer or url_for('index'))

@app.route('/stream/<file_id>')
def stream_audio(file_id):
    try:
        grid_fs_file = Song.get_file(file_id)
        content_type = grid_fs_file.metadata.get('content_type', 'audio/mpeg')
        response = Response(grid_fs_file.read(), mimetype=content_type)
        response.headers['Content-Disposition'] = f'inline; filename="{grid_fs_file.filename}"'
        return response
    except Exception as e:
        flash(f'Error streaming file: {str(e)}', 'error')
        return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(debug=True)
