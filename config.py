class Config:
    SECRET_KEY = 'secret'
    ALLOWED_EXTENSIONS = {'mp3', 'flac', 'wav'}
    MONGO_URI = 'mongodb://localhost:27017/'
    MONGO_DB_NAME = 'music_app'