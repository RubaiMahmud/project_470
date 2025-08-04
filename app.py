from flask import Flask, render_template, request, redirect, url_for, session, flash
from models import db, Song
from config import Config
import os

app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)

# Create DB 
with app.app_context():
    db.create_all()

def allowes_files(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

@app.route('/')
def index():
    songs = Song.query.all()
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

        if file:
            filename = file.filename
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)

            song = Song(title=title, artist=artist, genre=genre, filename=filename)
            db.session.add(song)
            db.session.commit()
            return redirect(url_for('upload'))

    return render_template('upload.html')

if __name__ == '__main__':
    app.run(debug=True)
