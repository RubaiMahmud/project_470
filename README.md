# JAMBI — Web Music Player

Jambi is a web based music player built with Flask, MongoDB and JavaScript.  
Course project (CSE470) to stream music, manage playlists, and administer content.

## Key features
- Global persistent audio player with play / pause / next / previous controls
- Create, rename, delete playlists
- Like / unlike (Liked Songs) per user
- Recently played per user (limited history)
- Search by song title, artist, or genre
- Admin area for uploading/managing songs, artists, albums
- Files stored in MongoDB GridFS (audio and images)
- Role-based access (user / admin) via flask-login

## Tech stack
- Python 3.8+
- Flask
- MongoDB (+ GridFS)
- PyMongo
- flask-login for authentication
- HTML5 / CSS / JavaScript (vanilla)
- dotenv for environment variables

## Repository layout
- app.py — Flask app, routes and view handlers
- models.py — MongoDB wrapper + User, Song, Artist, Playlist helpers
- config.py — application configuration / environment loading
- templates/ — Jinja2 templates (layout.html, index.html, library.html, ...)
- static/
  - js/player.js — audio player logic (play/pause/next/prev, progress, volume)
  - css/styles.css — styling
- README.md — this file

## Prerequisites
- Python 3.8+
- MongoDB server (local or remote)
- pip (package manager)

## Environment (.env)
Create a `.env` file at the project root with at least these keys:
```
SECRET_KEY=your_secret_key
MONGO_URI=mongodb://localhost:27017/
MONGO_DB_NAME=music_app
```
You can override defaults in `config.py`.

## 📸 Screenshots

### 🏠 **Homepage**
<img width="1710" height="988" alt="home_page" src="https://github.com/user-attachments/assets/588a4ad7-4ff8-485d-b788-7214337f95bc" />

<div align="center">
  <img src="/Users/rubaimahmud/Screenshots/screenshot_app/home_page.png" alt="Homepage" width="800"/>
 
</div>

### **Discover Section**
<div align="center">
  <img src="/Users/rubaimahmud/Screenshots/screenshot_app.png" alt="Discover Section" width="800"/>
 
</div>

### **Admin Panel**
<div align="center">
  <img src="/Users/rubaimahmud/Screenshots/screenshot_app/admin_edit_panel.png" alt="Admin Panel" width="800"/>

</div>

### **Like Songs**
<div align="center">
  <img src="/Users/rubaimahmud/Screenshots/screenshot_app/like_songs.png" alt="Like Songs" width="800"/>
  
</div>

### **Playlists**
<div align="center">
  <img src="/Users/rubaimahmud/Screenshots/screenshot_app/playlist.png" alt="PLaylist" width="800"/>
 
</div>

### **Artist Info**
<div align="center">
  <img src="/Users/rubaimahmud/Screenshots/screenshot_app/artist_info.png" alt="Artist info" width="800"/>

</div>

### **Artist Upload**
<div align="center">
  <img src="/Users/rubaimahmud/Screenshots/screenshot_app/admin_upload.png" alt="Admin Upload" width="800"/>

</div>


## Installation (macOS / Linux)
1. Clone repository:
   ```
   git clone <repo-url>
   cd music_app_backup
   ```
2. Create and activate a virtual environment:
   ```
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
   If you don't have `requirements.txt`, install:
   ```
   pip install flask pymongo gridfs flask-login python-dotenv werkzeug
   ```
4. Ensure MongoDB is running and reachable via MONGO_URI.
5. Run the app:
   ```
   export FLASK_APP=app.py
   export FLASK_ENV=development
   flask run
   ```
   Or:
   ```
   python app.py
   ```
6. Open http://127.0.0.1:5000 in your browser.

## Usage notes
- Login / registration handled via flask-login; admin users have elevated routes.
- Audio assets are streamed from GridFS. When uploading songs, the file is stored into GridFS 

## Admin and data management
- Admin routes allow uploading songs, adding artists and albums, and editing metadata.
- Ensure uploaded files conform to allowed extensions defined in `config.py`:
  - Audio: mp3, flac, wav
  - Images: png, jpg, jpeg, gif, webp, svg

## Testing / Development tips
- Use a development copy of MongoDB for testing.
- To seed the DB, either use the admin UI or write a small script to insert documents and store files in GridFS.
- For debugging, consult the Flask terminal output and the browser DevTools console.

## Troubleshooting
- Module import error for flask-login:
  ```
  pip install flask_login
  ```
- MongoDB connection issues: check `MONGO_URI` and that mongod is running.
- Audio not playing: verify GridFS storage and that returned file routes stream bytes correctly.
- flask-login user loader errors: ensure `models.MongoDB.init_app` sets `users_collection` and `mongo_db` is initialized before login_manager is used.

## Contributing
- Fork and create focused PRs.
- Include tests for new logic where practical.
- Keep UI/style changes separate from backend logic changes for easier review.

## Security & Privacy
- Do not commit secrets to the repository. Use `.env` for secret keys and connection strings.
- Validate uploaded files and sanitize metadata inputs.

**Your Name**
- GitHub: [@RubaiMahmud](https://github.com/RubaiMahmud)
- Email: mafrubai@gmail.com

