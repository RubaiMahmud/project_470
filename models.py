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
        self.artists_collection = None

    def init_app(self, app):
        self.client = MongoClient(app.config['MONGO_URI'])
        self.db = self.client[app.config['MONGO_DB_NAME']]
        self.fs = GridFS(self.db)
        self.songs_collection = self.db.songs
        self.users_collection = self.db.users
        self.playlists_collection = self.db.playlists
        self.artists_collection = self.db.artists

        self.songs_collection.create_index([('title', 'text'), ('artist', 'text'), ('genre', 'text')])
        self.artists_collection.create_index([('name', 'text')])

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
    def __init__(self, title=None, artist=None, genre=None, album=None, file_id=None, filename=None, album_art_id=None, artist_description=None):
        self.title = title
        self.artist = artist
        self.genre = genre
        self.album = album
        self.file_id = file_id
        self.filename = filename
        self.album_art_id = album_art_id
        self.artist_description = artist_description
    
    def save(self):
        song_data = {
            'title': self.title, 'artist': self.artist, 'genre': self.genre, 'album': self.album,
            'file_id': self.file_id, 'filename': self.filename, 'album_art_id': self.album_art_id,
            'artist_description': self.artist_description,
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
                album=song_doc.get('album'), file_id=str(song_doc['file_id']), filename=song_doc['filename'],
                album_art_id=str(song_doc['album_art_id']) if song_doc.get('album_art_id') else None,
                artist_description=song_doc.get('artist_description')
            )
            song.id = str(song_doc['_id'])
            songs.append(song)
        return songs

    @staticmethod
    def search(query):
        safe_query = re.escape(query)
        search_filter = {"$or": [{"title": {"$regex": safe_query, "$options": "i"}}, {"artist": {"$regex": safe_query, "$options": "i"}}, {"genre": {"$regex": safe_query, "$options": "i"}}, {"album": {"$regex": safe_query, "$options": "i"}}]}
        songs = []
        for song_doc in mongo_db.songs_collection.find(search_filter):
            song = Song(
                title=song_doc['title'], artist=song_doc['artist'], genre=song_doc['genre'],
                album=song_doc.get('album'), file_id=str(song_doc['file_id']), filename=song_doc['filename'],
                album_art_id=str(song_doc['album_art_id']) if song_doc.get('album_art_id') else None,
                artist_description=song_doc.get('artist_description')
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
                album=song_doc.get('album'), file_id=str(song_doc['file_id']), filename=song_doc['filename'],
                album_art_id=str(song_doc['album_art_id']) if song_doc.get('album_art_id') else None,
                artist_description=song_doc.get('artist_description')
            )
            song.id = str(song_doc['_id'])
            songs.append(song)
        return songs
    
    @staticmethod
    def get_by_id(song_id):
        """Retrieve a single song by its ID."""
        try:
            song_doc = mongo_db.songs_collection.find_one({'_id': ObjectId(song_id)})
            if song_doc:
                song = Song(
                    title=song_doc['title'], artist=song_doc['artist'], genre=song_doc['genre'],
                    album=song_doc.get('album'), file_id=str(song_doc['file_id']), filename=song_doc['filename'],
                    album_art_id=str(song_doc['album_art_id']) if song_doc.get('album_art_id') else None,
                    artist_description=song_doc.get('artist_description')
                )
                song.id = str(song_doc['_id'])
                return song
        except Exception as e:
            print(f"Error getting song by ID: {e}")
        return None
    
    @staticmethod
    def update(song_id, update_data):
        """Update a song's information."""
        try:
            result = mongo_db.songs_collection.update_one(
                {'_id': ObjectId(song_id)},
                {'$set': update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error updating song: {e}")
            return False
    
    @staticmethod
    def get_featured(limit=None):
        """Get featured songs with optional limit."""
        songs = []
        query = mongo_db.songs_collection.find()
        if limit:
            query = query.limit(limit)
        
        for song_doc in query:
            song = Song(
                title=song_doc['title'], artist=song_doc['artist'], genre=song_doc['genre'],
                album=song_doc.get('album'), file_id=str(song_doc['file_id']), filename=song_doc['filename'],
                album_art_id=str(song_doc['album_art_id']) if song_doc.get('album_art_id') else None,
                artist_description=song_doc.get('artist_description')
            )
            song.id = str(song_doc['_id'])
            song.upload_date = song_doc.get('upload_date')
            songs.append(song)
        return songs
    
    @staticmethod
    def get_recent_uploads(limit=20):
        """Get recently uploaded songs sorted by upload date."""
        songs = []
        query = mongo_db.songs_collection.find().sort('upload_date', -1).limit(limit)
        
        for song_doc in query:
            song = Song(
                title=song_doc['title'], artist=song_doc['artist'], genre=song_doc['genre'],
                album=song_doc.get('album'), file_id=str(song_doc['file_id']), filename=song_doc['filename'],
                album_art_id=str(song_doc['album_art_id']) if song_doc.get('album_art_id') else None,
                artist_description=song_doc.get('artist_description')
            )
            song.id = str(song_doc['_id'])
            song.upload_date = song_doc.get('upload_date')
            songs.append(song)
        return songs
    
    @staticmethod
    def get_artist_info(artist_name):
        """Get artist information and their songs."""
        try:
            # Get artist description from any song by this artist
            artist_song = mongo_db.songs_collection.find_one(
                {'artist': {'$regex': f'^{re.escape(artist_name)}$', '$options': 'i'}}
            )
            
            if not artist_song:
                return None
            
            # Get all songs by this artist
            songs = []
            for song_doc in mongo_db.songs_collection.find(
                {'artist': {'$regex': f'^{re.escape(artist_name)}$', '$options': 'i'}}
            ):
                song = Song(
                    title=song_doc['title'], artist=song_doc['artist'], genre=song_doc['genre'],
                    album=song_doc.get('album'), file_id=str(song_doc['file_id']), filename=song_doc['filename'],
                    album_art_id=str(song_doc['album_art_id']) if song_doc.get('album_art_id') else None,
                    artist_description=song_doc.get('artist_description')
                )
                song.id = str(song_doc['_id'])
                songs.append(song)
            
            return {
                'name': artist_song['artist'],
                'description': artist_song.get('artist_description', ''),
                'songs': songs,
                'total_songs': len(songs),
                'albums': list(set([song.album for song in songs if song.album]))
            }
        except Exception as e:
            print(f"Error getting artist info: {e}")
            return None
    
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
                # Also delete album art if it exists
                if song_doc.get('album_art_id'):
                    try:
                        mongo_db.fs.delete(ObjectId(song_doc['album_art_id']))
                    except Exception as e:
                        print(f"Error deleting album art: {e}")
            return True
        except Exception as e:
            print(f"Error deleting song: {e}")
            return False

class Artist:
    def __init__(self, name=None, description=None, photo_id=None, created_date=None):
        self.name = name
        self.description = description
        self.photo_id = photo_id
        self.created_date = created_date or datetime.utcnow()
    
    def save(self):
        artist_data = {
            'name': self.name,
            'description': self.description,
            'photo_id': self.photo_id,
            'created_date': self.created_date
        }
        # Check if artist already exists
        existing_artist = mongo_db.artists_collection.find_one({'name': {'$regex': f'^{re.escape(self.name)}$', '$options': 'i'}})
        if existing_artist:
            # Update existing artist
            result = mongo_db.artists_collection.update_one(
                {'_id': existing_artist['_id']},
                {'$set': artist_data}
            )
            self.id = str(existing_artist['_id'])
            return existing_artist['_id']
        else:
            # Create new artist
            result = mongo_db.artists_collection.insert_one(artist_data)
            self.id = str(result.inserted_id)
            return result.inserted_id
    
    @staticmethod
    def get_all():
        artists = []
        for artist_doc in mongo_db.artists_collection.find().sort('name', 1):
            artist = Artist(
                name=artist_doc['name'],
                description=artist_doc.get('description', ''),
                photo_id=str(artist_doc['photo_id']) if artist_doc.get('photo_id') else None,
                created_date=artist_doc.get('created_date')
            )
            artist.id = str(artist_doc['_id'])
            artists.append(artist)
        return artists
    
    @staticmethod
    def get_by_name(name):
        try:
            artist_doc = mongo_db.artists_collection.find_one({'name': {'$regex': f'^{re.escape(name)}$', '$options': 'i'}})
            if artist_doc:
                artist = Artist(
                    name=artist_doc['name'],
                    description=artist_doc.get('description', ''),
                    photo_id=str(artist_doc['photo_id']) if artist_doc.get('photo_id') else None,
                    created_date=artist_doc.get('created_date')
                )
                artist.id = str(artist_doc['_id'])
                return artist
        except Exception as e:
            print(f"Error getting artist by name: {e}")
        return None
    
    @staticmethod
    def get_by_id(artist_id):
        try:
            artist_doc = mongo_db.artists_collection.find_one({'_id': ObjectId(artist_id)})
            if artist_doc:
                artist = Artist(
                    name=artist_doc['name'],
                    description=artist_doc.get('description', ''),
                    photo_id=str(artist_doc['photo_id']) if artist_doc.get('photo_id') else None,
                    created_date=artist_doc.get('created_date')
                )
                artist.id = str(artist_doc['_id'])
                return artist
        except Exception as e:
            print(f"Error getting artist by ID: {e}")
        return None
    
    @staticmethod
    def update(artist_id, update_data):
        try:
            result = mongo_db.artists_collection.update_one(
                {'_id': ObjectId(artist_id)},
                {'$set': update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error updating artist: {e}")
            return False
    
    @staticmethod
    def delete(artist_id):
        try:
            artist_doc = mongo_db.artists_collection.find_one_and_delete({'_id': ObjectId(artist_id)})
            if artist_doc and artist_doc.get('photo_id'):
                try:
                    mongo_db.fs.delete(ObjectId(artist_doc['photo_id']))
                except Exception as e:
                    print(f"Error deleting artist photo: {e}")
            return True
        except Exception as e:
            print(f"Error deleting artist: {e}")
            return False
    
    @staticmethod
    def store_file(file_data, filename, metadata=None):
        return mongo_db.fs.put(file_data, filename=filename, metadata=metadata)
    
    @staticmethod
    def get_file(file_id):
        return mongo_db.fs.get(ObjectId(file_id))
    
    def get_song_count(self):
        """Get the number of songs by this artist"""
        return mongo_db.songs_collection.count_documents({'artist': {'$regex': f'^{re.escape(self.name)}$', '$options': 'i'}})
    
    def get_album_count(self):
        """Get the number of unique albums by this artist"""
        pipeline = [
            {'$match': {'artist': {'$regex': f'^{re.escape(self.name)}$', '$options': 'i'}, 'album': {'$ne': None, '$ne': ''}}},
            {'$group': {'_id': '$album'}},
            {'$count': 'total'}
        ]
        result = list(mongo_db.songs_collection.aggregate(pipeline))
        return result[0]['total'] if result else 0
