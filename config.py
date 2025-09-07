import os
from dotenv import load_dotenv

# Load environment variables from .env file with explicit path
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

# Debug: Print the loaded MONGO_URI (remove in production)
mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
print(f"[CONFIG DEBUG] Loaded MONGO_URI: {mongo_uri[:50]}..." if mongo_uri != 'mongodb://localhost:27017/' else "[CONFIG DEBUG] Using fallback localhost - .env not loaded!")

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'secret')
    ALLOWED_EXTENSIONS = {'mp3', 'flac', 'wav'}
    ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'}
    MONGO_URI = mongo_uri
    MONGO_DB_NAME = 'music_app'