class Config:
    SECRET_KEY = 'secret'
    ALLOWED_EXTENSIONS = {'mp3', 'flac', 'wav'}
    ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'}
    MONGO_URI = 'mongodb+srv://rubai535:r1uibiai1535#@jambiplayer.e7cle9o.mongodb.net/?retryWrites=true&w=majority&appName=jambiplayer&tlsAllowInvalidCertificates=true'
    MONGO_DB_NAME = 'music_app'