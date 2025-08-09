// Global player state
let currentSong = null;
let isPlaying = false;
let currentTime = 0;
let duration = 0;

// DOM elements
let audioPlayer;
let mainPlayBtn;
let currentTitle;
let currentArtist;
let currentTimeDisplay;
let durationDisplay;
let progressBar;
let progressFill;

// Initialize player when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  initializePlayer();
});

function initializePlayer() {
  // Get DOM elements
  audioPlayer = document.getElementById('audio-player');
  mainPlayBtn = document.getElementById('main-play-btn');
  currentTitle = document.getElementById('current-title');
  currentArtist = document.getElementById('current-artist');
  currentTimeDisplay = document.getElementById('current-time');
  durationDisplay = document.getElementById('duration');
  progressBar = document.querySelector('.progress-bar');
  progressFill = document.querySelector('.progress-fill');

  if (!audioPlayer) {
    console.error('Audio player not found');
    return;
  }

  // Audio event listeners
  audioPlayer.addEventListener('loadedmetadata', updateDuration);
  audioPlayer.addEventListener('timeupdate', updateProgress);
  audioPlayer.addEventListener('ended', onSongEnd);
  audioPlayer.addEventListener('play', onPlay);
  audioPlayer.addEventListener('pause', onPause);

  // Main play button listener
  if (mainPlayBtn) {
    mainPlayBtn.addEventListener('click', togglePlayPause);
  }

  // Progress bar click listener
  if (progressBar) {
    progressBar.addEventListener('click', seekTo);
  }
}

function playFromCard(button) {
  const musicCard = button.closest('.music-card');
  const songUrl = musicCard.dataset.url;
  const songTitle = musicCard.dataset.title;
  const songArtist = musicCard.dataset.artist;

  if (songUrl && songTitle) {
    loadAndPlaySong(songUrl, songTitle, songArtist);
    
    // Update card play buttons
    updateCardButtons();
    button.innerHTML = '<i class="fas fa-pause"></i>';
  }
}

function playRandomSong() {
  const musicCards = document.querySelectorAll('.music-card');
  if (musicCards.length > 0) {
    const randomCard = musicCards[Math.floor(Math.random() * musicCards.length)];
    const playBtn = randomCard.querySelector('.card-play-btn');
    if (playBtn) {
      playFromCard(playBtn);
    }
  }
}

function loadAndPlaySong(url, title, artist) {
  if (audioPlayer) {
    audioPlayer.src = url;
    audioPlayer.play();
    
    currentSong = { url, title, artist };
    updateTrackInfo(title, artist);
  }
}

function togglePlayPause() {
  if (!audioPlayer || !currentSong) return;

  if (isPlaying) {
    audioPlayer.pause();
  } else {
    audioPlayer.play();
  }
}

function updateTrackInfo(title, artist) {
  if (currentTitle) currentTitle.textContent = title;
  if (currentArtist) currentArtist.textContent = artist;
}

function updateDuration() {
  duration = audioPlayer.duration;
  if (durationDisplay && duration) {
    durationDisplay.textContent = formatTime(duration);
  }
}

function updateProgress() {
  currentTime = audioPlayer.currentTime;
  
  if (currentTimeDisplay) {
    currentTimeDisplay.textContent = formatTime(currentTime);
  }
  
  if (progressFill && duration > 0) {
    const progressPercent = (currentTime / duration) * 100;
    progressFill.style.width = progressPercent + '%';
  }
}

function seekTo(event) {
  if (!audioPlayer || !duration) return;
  
  const rect = progressBar.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const width = rect.width;
  const percentage = clickX / width;
  const newTime = percentage * duration;
  
  audioPlayer.currentTime = newTime;
}

function onPlay() {
  isPlaying = true;
  if (mainPlayBtn) {
    mainPlayBtn.innerHTML = '<i class="fas fa-pause"></i>';
  }
}

function onPause() {
  isPlaying = false;
  if (mainPlayBtn) {
    mainPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
  }
  updateCardButtons();
}

function onSongEnd() {
  isPlaying = false;
  if (mainPlayBtn) {
    mainPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
  }
  updateCardButtons();
  
  if (currentTitle) currentTitle.textContent = 'Nothing playing';
  if (currentArtist) currentArtist.textContent = 'Select a song to start listening';
}

function updateCardButtons() {
  const allCardButtons = document.querySelectorAll('.card-play-btn');
  allCardButtons.forEach(btn => {
    btn.innerHTML = '<i class="fas fa-play"></i>';
  });
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Favorite button functionality
document.addEventListener('click', function(event) {
  if (event.target.closest('.favorite-btn')) {
    const btn = event.target.closest('.favorite-btn');
    const icon = btn.querySelector('i');
    
    if (icon.classList.contains('far')) {
      icon.classList.remove('far');
      icon.classList.add('fas');
      btn.style.color = '#ef4444';
    } else {
      icon.classList.remove('fas');
      icon.classList.add('far');
      btn.style.color = '';
    }
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
  if (event.code === 'Space' && event.target.tagName !== 'INPUT') {
    event.preventDefault();
    togglePlayPause();
  }
});