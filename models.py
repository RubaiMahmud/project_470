from pymongo import MongoClient
from gridfs import GridFS
from bson import ObjectId
from datetime import datetime

class MongoDB:
    def __init__(self):
        self.client = None
        self.db = None
        self.fs = None
        self.songs_collection = None
    
    def init_app(self, app):
        self.client = MongoClient(app.config['MONGO_URI'])
        self.db = self.client[app.config['MONGO_DB_NAME']]
        self.fs = GridFS(self.db)
        self.songs_collection = self.db.songs
        
        # Create indexes for better performance
        self.songs_collection.create_index("title")
        self.songs_collection.create_index("artist")
        self.songs_collection.create_index("genre")

# Global MongoDB instance
mongo_db = MongoDB()

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
                file_id=song_doc['file_id'],
                filename=song_doc['filename']
            )
            song.id = song_doc['_id']
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
    