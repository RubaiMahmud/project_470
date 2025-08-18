from pymongo import MongoClient
from gridfs import GridFS
from bson import ObjectId
from datetime import datetime
from flask_login import UserMixin

class MongoDB:
    def __init__(self):
        self.client = None
        self.db = None
        self.fs = None
        self.songs_collection = None
        self.users_collection = None
    
    def init_app(self, app):
        self.client = MongoClient(app.config['MONGO_URI'])
        self.db = self.client[app.config['MONGO_DB_NAME']]
        self.fs = GridFS(self.db)
        self.songs_collection = self.db.songs
        # This line has been corrected
        self.users_collection = self.db.users      
        
        # Create indexes for better performance
        self.songs_collection.create_index("title")
        self.songs_collection.create_index("artist")
        self.songs_collection.create_index("genre")

# Global MongoDB instance
mongo_db = MongoDB()

class User(UserMixin):
    def __init__(self, user_data):
        self.id = str(user_data.get('_id'))
        self.username = user_data.get('username')
        self.email = user_data.get('email')
        self.password_hash = user_data.get('password')
        # Add a role attribute, defaulting to 'user' if not present
        self.role = user_data.get('role', 'user')

    @property
    def is_admin(self):
        """Property to check if the user is an admin."""
        return self.role == 'admin'

    @staticmethod
    def get(user_id):
        """Static method to retrieve a user by their ID."""
        user_data = mongo_db.users_collection.find_one({'_id': ObjectId(user_id)})
        if user_data:
            return User(user_data)
        return None


class Song:
    def __init__(self, title=None, artist=None, genre=None, file_id=None, filename=None):
        self.title = title
        self.artist = artist
        self.genre = genre
        self.file_id = file_id
        self.filename = filename
    
    def save(self):
        """Save song metadata to MongoDB"""
        song_data = {
            'title': self.title,
            'artist': self.artist,
            'genre': self.genre,
            'file_id': self.file_id,
            'filename': self.filename,
            'upload_date': datetime.utcnow()
        }
        result = mongo_db.songs_collection.insert_one(song_data)
        return result.inserted_id
    
    @staticmethod
    def get_all():
        """Get all songs from MongoDB"""
        songs = []
        for song_doc in mongo_db.songs_collection.find():
            song = Song(
                title=song_doc['title'],
                artist=song_doc['artist'],
                genre=song_doc['genre'],
                file_id=str(song_doc['file_id']),
                filename=song_doc['filename']
            )
            song.id = str(song_doc['_id'])
            songs.append(song)
        return songs
    
    @staticmethod
    def store_file(file_data, filename, metadata=None):
        """Store file in GridFS and return file_id"""
        return mongo_db.fs.put(file_data, filename=filename, metadata=metadata)
    
    @staticmethod
    def get_file(file_id):
        """Retrieve file from GridFS by file_id"""
        return mongo_db.fs.get(ObjectId(file_id))
