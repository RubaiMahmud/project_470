from flask import Flask, render_template, request, redirect, url_for, session, flash, Response
from models import mongo_db, Song
from config import Config
from bson import ObjectId

app = Flask(__name__)
app.config.from_object(Config)

# Initialize MongoDB
mongo_db.init_app(app)

def allowed_files(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

@app.route('/')
def index():
    songs = Song.get_all()
    return render_template('index.html', songs=songs)

# ADMIN LOGIN
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        if request.form['username'] == 'admin' and request.form['password'] == 'admin12345':
            session['admin'] = True
            return redirect(url_for('upload'))
        else:
            flash('Invalid credentials')
    return render_template('login.html')     

@app.route('/logout')
def logout():
    session.pop('admin', None)
    return redirect(url_for('login'))   

@app.route('/upload', methods=['GET', 'POST'])
def upload():
    if not session.get('admin'):
        return redirect(url_for('login'))
    
    if request.method == 'POST':
        file = request.files['file']
        title = request.form['title']
        artist = request.form['artist']
        genre = request.form['genre']

        if file and allowed_files(file.filename):
            filename = file.filename
            
            # Store file in GridFS
            file_data = file.read()
            metadata = {
                'title': title,
                'artist': artist,
                'genre': genre,
                'content_type': file.content_type
            }
            file_id = Song.store_file(file_data, filename, metadata)

            # Create song document with GridFS file_id
            song = Song(title=title, artist=artist, genre=genre, file_id=file_id, filename=filename)
            song.save()
            
            flash('Song uploaded successfully!', 'success')
            return redirect(url_for('upload'))
        else:
            flash('Invalid file type. Please upload MP3, FLAC, or WAV files.', 'error')

    return render_template('upload.html')

@app.route('/stream/<file_id>')
def stream_audio(file_id):
    """Stream audio file from GridFS"""
    try:
        file = Song.get_file(file_id)
        # Use metadata content_type or default to audio/mpeg
        content_type = file.metadata.get('content_type', 'audio/mpeg') if file.metadata else 'audio/mpeg'
        response = Response(file.read(), mimetype=content_type)
        response.headers['Content-Disposition'] = f'inline; filename="{file.filename}"'
        return response
    except Exception as e:
        flash(f'Error streaming file: {str(e)}', 'error')
        return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(debug=True)
