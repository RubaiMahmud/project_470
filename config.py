class Config:
    SECRET_KEY = 'secret'
    ALLOWED_EXTENSIONS = {'mp3', 'flac', 'wav'}
    ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'}
    MONGO_URI = 'mongodb://localhost:27017/'
    MONGO_DB_NAME = 'music_app'