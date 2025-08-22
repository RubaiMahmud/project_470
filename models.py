from pymongo import MongoClient
from gridfs import GridFS
from bson import ObjectId
from datetime import datetime
from flask_login import UserMixin
import re

class MongoDB:
    def __init__(self):
        self.client = None
        self.db = None
        self.fs = None
        self.songs_collection = None
        self.users_collection = None
        self.playlists_collection = None

    def init_app(self, app):
        self.client = MongoClient(app.config['MONGO_URI'])
        self.db = self.client[app.config['MONGO_DB_NAME']]
        self.fs = GridFS(self.db)
        self.songs_collection = self.db.songs
        self.users_collection = self.db.users
        self.playlists_collection = self.db.playlists

        self.songs_collection.create_index([('title', 'text'), ('artist', 'text'), ('genre', 'text')])

mongo_db = MongoDB()

class User(UserMixin):
    def __init__(self, user_data):
        self.id = str(user_data.get('_id'))
        self.username = user_data.get('username')
        self.email = user_data.get('email')
        self.password_hash = user_data.get('password')
        self.role = user_data.get('role', 'user')

    @property
    def is_admin(self):
        return self.role == 'admin'

    @staticmethod
    def get(user_id):
        user_data = mongo_db.users_collection.find_one({'_id': ObjectId(user_id)})
        if user_data:
            return User(user_data)
        return None


    def get_liked_songs_playlist(self):
        """Finds or creates the 'Liked Songs' playlist for the user."""
        playlist = mongo_db.playlists_collection.find_one({
            'user_id': ObjectId(self.id),
            'name': 'Liked Songs'
        })
        if not playlist:
            playlist_id = mongo_db.playlists_collection.insert_one({
                'user_id': ObjectId(self.id),
                'name': 'Liked Songs',
                'songs': [] 
            }).inserted_id
            playlist = mongo_db.playlists_collection.find_one({'_id': playlist_id})
        return playlist

    def get_liked_song_ids(self):
        """Returns a list of song IDs from the user's Liked Songs playlist."""
        playlist = self.get_liked_songs_playlist()
        return playlist.get('songs', [])

    def toggle_like(self, song_id):
        """Adds or removes a song from the 'Liked Songs' playlist."""
        liked_playlist = self.get_liked_songs_playlist()
        song_object_id = ObjectId(song_id)
        
        if song_object_id in liked_playlist['songs']:
            
            mongo_db.playlists_collection.update_one(
                {'_id': liked_playlist['_id']},
                {'$pull': {'songs': song_object_id}}
            )
            return False 
        else:
            mongo_db.playlists_collection.update_one(
                {'_id': liked_playlist['_id']},
                {'$addToSet': {'songs': song_object_id}} 
            )
            return True 

class Song:
    def __init__(self, title=None, artist=None, genre=None, file_id=None, filename=None):
        self.title = title
        self.artist = artist
        self.genre = genre
        self.file_id = file_id
        self.filename = filename
    
    def save(self):
        song_data = {
            'title': self.title, 'artist': self.artist, 'genre': self.genre,
            'file_id': self.file_id, 'filename': self.filename,
            'upload_date': datetime.utcnow()
        }
        result = mongo_db.songs_collection.insert_one(song_data)
        return result.inserted_id
    
    @staticmethod
    def get_all():
        songs = []
        for song_doc in mongo_db.songs_collection.find():
            song = Song(
                title=song_doc['title'], artist=song_doc['artist'], genre=song_doc['genre'],
                file_id=str(song_doc['file_id']), filename=song_doc['filename']
            )
            song.id = str(song_doc['_id'])
            songs.append(song)
        return songs

    @staticmethod
    def search(query):
        safe_query = re.escape(query)
        search_filter = {"$or": [{"title": {"$regex": safe_query, "$options": "i"}}, {"artist": {"$regex": safe_query, "$options": "i"}}, {"genre": {"$regex": safe_query, "$options": "i"}}]}
        songs = []
        for song_doc in mongo_db.songs_collection.find(search_filter):
            song = Song(
                title=song_doc['title'], artist=song_doc['artist'], genre=song_doc['genre'],
                file_id=str(song_doc['file_id']), filename=song_doc['filename']
            )
            song.id = str(song_doc['_id'])
            songs.append(song)
        return songs

    @staticmethod
    def get_songs_by_ids(song_ids):
        """Retrieve multiple songs from a list of ObjectIds."""
        songs = []
        for song_doc in mongo_db.songs_collection.find({'_id': {'$in': song_ids}}):
            song = Song(
                title=song_doc['title'], artist=song_doc['artist'], genre=song_doc['genre'],
                file_id=str(song_doc['file_id']), filename=song_doc['filename']
            )
            song.id = str(song_doc['_id'])
            songs.append(song)
        return songs
    
    @staticmethod
    def store_file(file_data, filename, metadata=None):
        return mongo_db.fs.put(file_data, filename=filename, metadata=metadata)

    @staticmethod
    def get_file(file_id):
        return mongo_db.fs.get(ObjectId(file_id))
        
    @staticmethod
    def delete(song_id):
        try:
            song_doc = mongo_db.songs_collection.find_one_and_delete({'_id': ObjectId(song_id)})
            if song_doc and 'file_id' in song_doc:
                mongo_db.fs.delete(ObjectId(song_doc['file_id']))
            return True
        except Exception as e:
            print(f"Error deleting song: {e}")
            return False
