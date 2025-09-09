import os
from dotenv import load_dotenv

# Load environment variables from .env file with explicit path
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'secret')
    ALLOWED_EXTENSIONS = {'mp3', 'flac', 'wav'}
    ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'}
    MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
    MONGO_DB_NAME = 'music_app'
    