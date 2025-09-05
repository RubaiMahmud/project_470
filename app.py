from flask import Flask, render_template, request, redirect, url_for, flash, Response, jsonify, stream_with_context
from models import mongo_db, Song, User, Artist
from config import Config
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from bson import ObjectId
from functools import wraps
from urllib.parse import unquote, quote
import re

app = Flask(__name__)
app.config.from_object(Config)

# Add URL quote filter for templates
@app.template_filter('urlencode')
def urlencode_filter(s):
    return quote(str(s), safe='')

@app.template_filter('get_artist_data')
def get_artist_data_filter(artist_name):
    return Artist.get_by_name(artist_name)


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

def allowed_image_files(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_IMAGE_EXTENSIONS']


@app.route('/')
def index():
    # Get featured songs (limit to 2 rows - assuming 6 songs per row on desktop)
    songs = Song.get_featured(limit=12)
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
        album_art = request.files.get('album_art')
        title = request.form.get('title')
        artist = request.form.get('artist')
        genre = request.form.get('genre')
        album = request.form.get('album', '')
        artist_description = request.form.get('artist_description', '')
        
        if file and allowed_files(file.filename):
            # Store the audio file
            file_data = file.read()
            metadata = {'title': title, 'artist': artist, 'genre': genre, 'album': album, 'content_type': file.content_type}
            file_id = Song.store_file(file_data, file.filename, metadata)
            
            # Store album art if provided
            album_art_id = None
            if album_art and album_art.filename and allowed_image_files(album_art.filename):
                album_art_data = album_art.read()
                album_art_metadata = {'content_type': album_art.content_type, 'type': 'album_art'}
                album_art_id = Song.store_file(album_art_data, album_art.filename, album_art_metadata)
            
            # Create and save song
            song = Song(title=title, artist=artist, genre=genre, album=album, 
                       file_id=file_id, filename=file.filename, album_art_id=album_art_id,
                       artist_description=artist_description)
            song.save()
            flash('Song uploaded successfully!', 'success')
            return redirect(url_for('upload'))
        else:
            flash('Invalid file type. Please upload MP3, FLAC, or WAV files.', 'error')
    return render_template('upload.html')

@app.route('/admin/uploads')
@admin_required
def admin_uploads():
    recent_songs = Song.get_recent_uploads(limit=50)  # Get last 50 uploads
    return render_template('admin_uploads.html', songs=recent_songs)

@app.route('/upload_album', methods=['GET', 'POST'])
@admin_required
def upload_album():
    if request.method == 'POST':
        # Get album-wide metadata
        artist = request.form.get('artist')
        album = request.form.get('album')
        genre = request.form.get('genre')
        artist_description = request.form.get('artist_description', '')
        album_art = request.files.get('album_art')
        
        # Get multiple files
        files = request.files.getlist('files')
        
        if not files or len(files) == 0:
            flash('Please select at least one audio file.', 'error')
            return render_template('upload_album.html')
        
        # Validate all files first
        valid_files = []
        for file in files:
            if file.filename and allowed_files(file.filename):
                valid_files.append(file)
            elif file.filename:  # File exists but invalid type
                flash(f'Invalid file type for {file.filename}. Only MP3, FLAC, and WAV files are allowed.', 'error')
                return render_template('upload_album.html')
        
        if not valid_files:
            flash('No valid audio files found.', 'error')
            return render_template('upload_album.html')
        
        # Store album art once if provided
        album_art_id = None
        if album_art and album_art.filename and allowed_image_files(album_art.filename):
            album_art_data = album_art.read()
            album_art_metadata = {'content_type': album_art.content_type, 'type': 'album_art'}
            album_art_id = Song.store_file(album_art_data, album_art.filename, album_art_metadata)
        
        # Process each song
        uploaded_count = 0
        failed_uploads = []
        
        for i, file in enumerate(valid_files):
            try:
                # Get individual song title or use filename
                song_title = request.form.get(f'title_{i}') or file.filename.rsplit('.', 1)[0]
                
                # Store the audio file
                file_data = file.read()
                metadata = {
                    'title': song_title, 
                    'artist': artist, 
                    'genre': genre, 
                    'album': album, 
                    'content_type': file.content_type
                }
                file_id = Song.store_file(file_data, file.filename, metadata)
                
                # Create and save song
                song = Song(
                    title=song_title, 
                    artist=artist, 
                    genre=genre, 
                    album=album,
                    file_id=file_id, 
                    filename=file.filename, 
                    album_art_id=album_art_id,
                    artist_description=artist_description
                )
                song.save()
                uploaded_count += 1
                
            except Exception as e:
                failed_uploads.append(f'{file.filename}: {str(e)}')
                print(f"Error uploading {file.filename}: {e}")
        
        # Provide feedback
        if uploaded_count > 0:
            flash(f'Successfully uploaded {uploaded_count} songs to album "{album}"!', 'success')
        
        if failed_uploads:
            flash(f'Failed to upload: {", ".join(failed_uploads)}', 'error')
        
        return redirect(url_for('upload_album'))
    
    return render_template('upload_album.html')

@app.route('/edit/<song_id>', methods=['GET', 'POST'])
@admin_required
def edit_song(song_id):
    song = Song.get_by_id(song_id)
    if not song:
        flash('Song not found.', 'error')
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        title = request.form.get('title')
        artist = request.form.get('artist')
        genre = request.form.get('genre')
        album = request.form.get('album', '')
        artist_description = request.form.get('artist_description', '')
        album_art = request.files.get('album_art')
        
        # Update song info
        update_data = {
            'title': title,
            'artist': artist, 
            'genre': genre,
            'album': album,
            'artist_description': artist_description
        }
        
        # Handle album art update if provided
        if album_art and album_art.filename and allowed_image_files(album_art.filename):
            # Delete old album art if it exists
            if song.album_art_id:
                try:
                    mongo_db.fs.delete(ObjectId(song.album_art_id))
                except Exception as e:
                    print(f"Error deleting old album art: {e}")
            
            # Store new album art
            album_art_data = album_art.read()
            album_art_metadata = {'content_type': album_art.content_type, 'type': 'album_art'}
            new_album_art_id = Song.store_file(album_art_data, album_art.filename, album_art_metadata)
            update_data['album_art_id'] = new_album_art_id
        
        # Update the song in database
        if Song.update(song_id, update_data):
            flash('Song updated successfully!', 'success')
            return redirect(request.referrer or url_for('index'))
        else:
            flash('Error updating song.', 'error')
    
    return render_template('edit_song.html', song=song)

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
    except Exception as e:
        app.logger.error(f"Error finding file_id {file_id}: {e}")
        return "File not found", 404

    file_size = grid_fs_file.length
    range_header = request.headers.get('Range', None)
    
    if not range_header:
        # If no range header, stream the entire file in chunks.
        # It's important to set 'Accept-Ranges' to 'bytes' to let the browser know
        # that it can request parts of the file in the future.
        def generate():
            chunk_size = 1024 * 1024 # 1MB chunks
            while True:
                chunk = grid_fs_file.read(chunk_size)
                if not chunk:
                    break
                yield chunk

        response = Response(stream_with_context(generate()), mimetype=grid_fs_file.content_type)
        response.headers['Content-Length'] = str(file_size)
        response.headers['Accept-Ranges'] = 'bytes'
        return response

    # Handle the range request.
    byte1, byte2 = 0, None
    m = re.search(r'bytes=(\d+)-(\d*)', range_header)
    if not m:
        return "Invalid Range header", 416
    
    groups = m.groups()
    byte1 = int(groups[0])
    if groups[1]:
        byte2 = int(groups[1])
    
    length = file_size - byte1
    if byte2 is not None:
        length = byte2 - byte1 + 1
    
    # Read the requested chunk from the GridFS file.
    grid_fs_file.seek(byte1)
    data_chunk = grid_fs_file.read(length)

    # Create a 206 Partial Content response.
    response = Response(data_chunk, 206, mimetype=grid_fs_file.content_type, direct_passthrough=True)
    response.headers.add('Content-Range', f'bytes {byte1}-{byte1 + len(data_chunk) - 1}/{file_size}')
    response.headers.add('Accept-Ranges', 'bytes')
    response.headers.add('Content-Length', str(len(data_chunk)))
    
    return response

@app.route('/album_art/<file_id>')
def serve_album_art(file_id):
    try:
        grid_fs_file = Song.get_file(file_id)
        content_type = grid_fs_file.metadata.get('content_type', 'image/jpeg')
        response = Response(grid_fs_file.read(), mimetype=content_type)
        response.headers['Cache-Control'] = 'max-age=3600'  # Cache for 1 hour
        return response
    except Exception as e:
        # Return a 404 for missing album art
        return '', 404

@app.route('/artist/<artist_name>')
def artist_page(artist_name):
    # URL decode the artist name to handle special characters
    decoded_artist_name = unquote(artist_name)
    artist_info = Song.get_artist_info(decoded_artist_name)
    if not artist_info:
        flash('Artist not found.', 'error')
        return redirect(url_for('search'))
    
    liked_song_ids = current_user.get_liked_song_ids() if current_user.is_authenticated else []
    return render_template('artist.html', 
                         artist=artist_info, 
                         liked_song_ids=liked_song_ids)

@app.route('/artist/<artist_name>/update', methods=['POST'])
@admin_required
def update_artist_info(artist_name):
    try:
        # URL decode the artist name
        decoded_artist_name = unquote(artist_name)
        
        # Get form data
        name = request.form.get('name', '').strip()
        description = request.form.get('description', '').strip()
        photo = request.files.get('photo')
        
        if not name:
            return jsonify({'success': False, 'message': 'Artist name is required.'})
        
        # Get or create artist record
        existing_artist = Artist.get_by_name(decoded_artist_name)
        
        if existing_artist:
            # Update existing artist
            update_data = {
                'name': name,
                'description': description
            }
            
            # Handle photo update if provided
            if photo and photo.filename and allowed_image_files(photo.filename):
                # Delete old photo if it exists
                if existing_artist.photo_id:
                    try:
                        mongo_db.fs.delete(ObjectId(existing_artist.photo_id))
                    except Exception as e:
                        print(f"Error deleting old artist photo: {e}")
                
                # Store new photo
                photo_data = photo.read()
                photo_metadata = {'content_type': photo.content_type, 'type': 'artist_photo'}
                new_photo_id = Artist.store_file(photo_data, photo.filename, photo_metadata)
                update_data['photo_id'] = new_photo_id
            
            # Update artist in database
            if Artist.update(existing_artist.id, update_data):
                return jsonify({'success': True, 'message': f'Artist "{name}" updated successfully!'})
            else:
                return jsonify({'success': False, 'message': 'Error updating artist information.'})
        
        else:
            # Create new artist record
            photo_id = None
            if photo and photo.filename and allowed_image_files(photo.filename):
                photo_data = photo.read()
                photo_metadata = {'content_type': photo.content_type, 'type': 'artist_photo'}
                photo_id = Artist.store_file(photo_data, photo.filename, photo_metadata)
            
            # Create and save artist
            artist = Artist(name=name, description=description, photo_id=photo_id)
            artist.save()
            return jsonify({'success': True, 'message': f'Artist "{name}" created successfully!'})
            
    except Exception as e:
        print(f"Error updating artist info: {e}")
        return jsonify({'success': False, 'message': 'An error occurred while updating artist information.'})

@app.route('/admin/artists')
@admin_required
def admin_artists():
    artists = Artist.get_all()
    return render_template('admin_artists.html', artists=artists)

@app.route('/admin/artist/new', methods=['GET', 'POST'])
@admin_required
def admin_create_artist():
    if request.method == 'POST':
        name = request.form.get('name')
        description = request.form.get('description', '')
        photo = request.files.get('photo')
        
        if not name or not name.strip():
            flash('Artist name is required.', 'error')
            return render_template('admin_edit_artist.html')
        
        # Check if artist already exists
        existing_artist = Artist.get_by_name(name.strip())
        if existing_artist:
            flash(f'Artist "{name}" already exists.', 'error')
            return render_template('admin_edit_artist.html')
        
        # Store artist photo if provided
        photo_id = None
        if photo and photo.filename and allowed_image_files(photo.filename):
            photo_data = photo.read()
            photo_metadata = {'content_type': photo.content_type, 'type': 'artist_photo'}
            photo_id = Artist.store_file(photo_data, photo.filename, photo_metadata)
        
        # Create and save artist
        artist = Artist(name=name.strip(), description=description, photo_id=photo_id)
        artist.save()
        flash(f'Artist "{name}" created successfully!', 'success')
        return redirect(url_for('admin_artists'))
    
    return render_template('admin_edit_artist.html')

@app.route('/admin/artist/<artist_id>/edit', methods=['GET', 'POST'])
@admin_required
def admin_edit_artist(artist_id):
    artist = Artist.get_by_id(artist_id)
    if not artist:
        flash('Artist not found.', 'error')
        return redirect(url_for('admin_artists'))
    
    if request.method == 'POST':
        name = request.form.get('name')
        description = request.form.get('description', '')
        photo = request.files.get('photo')
        
        if not name or not name.strip():
            flash('Artist name is required.', 'error')
            return render_template('admin_edit_artist.html', artist=artist)
        
        # Check if another artist with this name exists
        existing_artist = Artist.get_by_name(name.strip())
        if existing_artist and existing_artist.id != artist_id:
            flash(f'Another artist with name "{name}" already exists.', 'error')
            return render_template('admin_edit_artist.html', artist=artist)
        
        update_data = {
            'name': name.strip(),
            'description': description
        }
        
        # Handle photo update if provided
        if photo and photo.filename and allowed_image_files(photo.filename):
            # Delete old photo if it exists
            if artist.photo_id:
                try:
                    mongo_db.fs.delete(ObjectId(artist.photo_id))
                except Exception as e:
                    print(f"Error deleting old artist photo: {e}")
            
            # Store new photo
            photo_data = photo.read()
            photo_metadata = {'content_type': photo.content_type, 'type': 'artist_photo'}
            new_photo_id = Artist.store_file(photo_data, photo.filename, photo_metadata)
            update_data['photo_id'] = new_photo_id
        
        # Update artist in database
        if Artist.update(artist_id, update_data):
            flash(f'Artist "{name}" updated successfully!', 'success')
            return redirect(url_for('admin_artists'))
        else:
            flash('Error updating artist.', 'error')
    
    return render_template('admin_edit_artist.html', artist=artist)

@app.route('/admin/artist/<artist_id>/delete', methods=['POST'])
@admin_required
def admin_delete_artist(artist_id):
    artist = Artist.get_by_id(artist_id)
    if not artist:
        flash('Artist not found.', 'error')
        return redirect(url_for('admin_artists'))
    
    if Artist.delete(artist_id):
        flash(f'Artist "{artist.name}" deleted successfully.', 'success')
    else:
        flash('Error deleting artist.', 'error')
    
    return redirect(url_for('admin_artists'))

@app.route('/artist_photo/<file_id>')
def serve_artist_photo(file_id):
    try:
        grid_fs_file = Artist.get_file(file_id)
        content_type = grid_fs_file.metadata.get('content_type', 'image/jpeg')
        response = Response(grid_fs_file.read(), mimetype=content_type)
        response.headers['Cache-Control'] = 'max-age=3600'  # Cache for 1 hour
        return response
    except Exception as e:
        # Return a 404 for missing artist photos
        return '', 404

if __name__ == '__main__':
    app.run(debug=True)
