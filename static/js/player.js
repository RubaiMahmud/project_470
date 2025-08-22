document.addEventListener('DOMContentLoaded', () => {
    const audioPlayer = document.getElementById('audio-player');
    const mainPlayBtn = document.getElementById('main-play-btn');
    const currentTitle = document.getElementById('current-title');
    const currentArtist = document.getElementById('current-artist');
    const currentTimeDisplay = document.getElementById('current-time');
    const durationDisplay = document.getElementById('duration');
    const progressBar = document.querySelector('.progress-bar');
    const progressFill = document.querySelector('.progress-fill');
    const progressHandle = document.querySelector('.progress-handle');
    const volumeSlider = document.querySelector('.volume-slider');
    const volumeFill = document.querySelector('.volume-fill');
    const volumeHandle = document.querySelector('.volume-handle');

    // Player states 
    let currentSongUrl = null;
    let isPlaying = false;
    let isDraggingProgress = false;
    let isDraggingVolume = false;

    if (!audioPlayer) {
        console.error("Audio player element not found!");
        return;
    }

    console.log('Elements found:', {
        audioPlayer: !!audioPlayer,
        progressBar: !!progressBar,
        progressFill: !!progressFill,
        progressHandle: !!progressHandle
    });

    // Functions
    function playSong(songContainer) {
        const songUrl = songContainer.dataset.url;
        const songTitle = songContainer.dataset.title;
        const songArtist = songContainer.dataset.artist;

        if (!songUrl || !songTitle) return;

        if (currentSongUrl === songUrl) {
            togglePlayPause();
        } else {
            audioPlayer.src = songUrl;
            currentSongUrl = songUrl;
            currentTitle.textContent = songTitle;
            currentArtist.textContent = songArtist;
            audioPlayer.play().catch(e => console.error('Play failed:', e));
        }
    }

    window.playRandomSong = function() {
        const allMusicCards = document.querySelectorAll('.music-card');
        if (allMusicCards.length > 0) {
            const randomIndex = Math.floor(Math.random() * allMusicCards.length);
            const randomSongContainer = allMusicCards[randomIndex];
            playSong(randomSongContainer);
        } else {
            console.warn("No songs found on the page to play randomly.");
        }
    };

    function togglePlayPause() {
        if (!currentSongUrl) {
            const firstSong = document.querySelector('.music-card, .song-list-item');
            if (firstSong) playSong(firstSong);
            return;
        }
        isPlaying ? audioPlayer.pause() : audioPlayer.play().catch(e => console.error('Play failed:', e));
    }

    async function toggleLike(likeButton) {
        const songContainer = likeButton.closest('[data-song-id]');
        const songId = songContainer.dataset.songId;
        if (!songId) return;

        try {
            const response = await fetch(`/like/${songId}`, { method: 'POST' });
            if (!response.ok) {
                if (response.status === 401 || response.status === 404) {
                    window.location.href = '/login';
                }
                throw new Error('Failed to toggle like status');
            }
            const result = await response.json();
            const icon = likeButton.querySelector('i');

            if (result.liked) {
                icon.classList.replace('far', 'fas');
                likeButton.classList.add('liked');
            } else {
                icon.classList.replace('fas', 'far');
                likeButton.classList.remove('liked');
            }
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    }

    // Event
    function onPlay() {
        isPlaying = true;
        mainPlayBtn.innerHTML = '<i class="fas fa-pause"></i>';
        document.body.classList.add('is-playing');
        updateAllPlayIcons();
    }

    function onPause() {
        isPlaying = false;
        mainPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
        document.body.classList.remove('is-playing');
        updateAllPlayIcons();
    }

    function onSongEnd() {
        const allSongs = Array.from(document.querySelectorAll('[data-url]'));
        const currentIndex = allSongs.findIndex(song => song.dataset.url === currentSongUrl);
        if (currentIndex !== -1 && currentIndex < allSongs.length - 1) {
            playSong(allSongs[currentIndex + 1]);
        } else {
            onPause();
        }
    }

    function updateProgress() {
        if (isDraggingProgress || !audioPlayer.duration || isNaN(audioPlayer.duration)) return;
        
        const progressPercent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressFill.style.width = `${progressPercent}%`;
        progressHandle.style.left = `${progressPercent}%`;
        currentTimeDisplay.textContent = formatTime(audioPlayer.currentTime);
    }

    function updateVolumeUI() {
        const volumePercent = audioPlayer.volume * 100;
        volumeFill.style.width = `${volumePercent}%`;
        volumeHandle.style.left = `${volumePercent}%`;
    }

    //Progress bar
    function getProgressPercentage(clientX) {
        const rect = progressBar.getBoundingClientRect();
        let percentage = (clientX - rect.left) / rect.width;
        return Math.max(0, Math.min(1, percentage));
    }

    function getVolumePercentage(clientX) {
        const rect = volumeSlider.getBoundingClientRect();
        let percentage = (clientX - rect.left) / rect.width;
        return Math.max(0, Math.min(1, percentage));
    }

    function updateProgressUI(percentage) {
        const percentDisplay = percentage * 100;
        progressFill.style.width = `${percentDisplay}%`;
        progressHandle.style.left = `${percentDisplay}%`;
        
        if (audioPlayer.duration && !isNaN(audioPlayer.duration)) {
            const newTime = percentage * audioPlayer.duration;
            currentTimeDisplay.textContent = formatTime(newTime);
        }
    }

    function startProgressDrag(event) {
        if (!audioPlayer.duration || isNaN(audioPlayer.duration)) {
            console.warn('Cannot drag progress - no audio duration');
            return;
        }
        
        event.preventDefault();
        isDraggingProgress = true;
        
        const clientX = event.clientX || (event.touches && event.touches[0].clientX);
        if (clientX !== undefined) {
            const percentage = getProgressPercentage(clientX);
            updateProgressUI(percentage);
        }
        
        console.log('Started dragging progress');
    }

    function startVolumeDrag(event) {
        event.preventDefault();
        isDraggingVolume = true;
        
        const clientX = event.clientX || (event.touches && event.touches[0].clientX);
        if (clientX !== undefined) {
            const percentage = getVolumePercentage(clientX);
            audioPlayer.volume = percentage;
        }
        
        console.log('Started dragging volume');
    }

    function handleGlobalDrag(event) {
        if (!isDraggingProgress && !isDraggingVolume) return;
        
        const clientX = event.clientX || (event.touches && event.touches[0].clientX);
        if (clientX === undefined) return;

        if (isDraggingProgress && audioPlayer.duration && !isNaN(audioPlayer.duration)) {
            const percentage = getProgressPercentage(clientX);
            updateProgressUI(percentage);
        }

        if (isDraggingVolume) {
            const percentage = getVolumePercentage(clientX);
            audioPlayer.volume = percentage;
        }
    }

    function stopDrag(event) {
        if (isDraggingProgress && audioPlayer.duration && !isNaN(audioPlayer.duration)) {
            const clientX = (event.changedTouches) ? event.changedTouches[0].clientX : event.clientX;
            if (clientX !== undefined) {
                const percentage = getProgressPercentage(clientX);
                const newTime = percentage * audioPlayer.duration;
                audioPlayer.currentTime = newTime;
                updateProgressUI(percentage);
                
                console.log(`Seeked to: ${newTime.toFixed(2)}s (${(percentage * 100).toFixed(1)}%)`);
            }
        }
        
        if (isDraggingProgress) console.log('Stopped dragging progress');
        if (isDraggingVolume) console.log('Stopped dragging volume');
        
        isDraggingProgress = false;
        isDraggingVolume = false;
    }

    function handleProgressBarClick(event) {
        if (isDraggingProgress) return; 
        
        if (!audioPlayer.duration || isNaN(audioPlayer.duration)) {
            console.warn('Cannot seek - no audio duration');
            return;
        }
        
        const percentage = getProgressPercentage(event.clientX);
        const newTime = percentage * audioPlayer.duration;
        
        audioPlayer.currentTime = newTime;
        updateProgressUI(percentage);
        
        console.log(`Clicked progress bar - seeked to: ${newTime.toFixed(2)}s`);
    }

    function handleVolumeClick(event) {
        if (isDraggingVolume) return;
        
        const percentage = getVolumePercentage(event.clientX);
        audioPlayer.volume = percentage;
        
        console.log(`Clicked volume slider - set to: ${(percentage * 100).toFixed(1)}%`);
    }

    function updateAllPlayIcons() {
        document.querySelectorAll('[data-url]').forEach(songContainer => {
            const playIcon = songContainer.querySelector('.fa-play, .fa-pause');
            if (!playIcon) return;

            if (songContainer.dataset.url === currentSongUrl && isPlaying) {
                playIcon.classList.replace('fa-play', 'fa-pause');
            } else {
                playIcon.classList.replace('fa-pause', 'fa-play');
            }
        });
    }

    function formatTime(seconds) {
        if (isNaN(seconds) || seconds === null || seconds === undefined) return '0:00';
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec.toString().padStart(2, '0')}`;
    }

    document.body.addEventListener('click', (event) => {
        const playBtn = event.target.closest('.card-play-btn, .song-item-art');
        if (playBtn) {
            event.preventDefault();
            playSong(playBtn.closest('[data-url]'));
            return;
        }
        
        const favoriteBtn = event.target.closest('.favorite-btn');
        if (favoriteBtn) {
            event.preventDefault();
            toggleLike(favoriteBtn);
            return;
        }
        
        if (event.target.closest('#main-play-btn')) {
            event.preventDefault();
            togglePlayPause();
            return;
        }
    });

    audioPlayer.addEventListener('play', onPlay);
    audioPlayer.addEventListener('pause', onPause);
    audioPlayer.addEventListener('ended', onSongEnd);
    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('loadedmetadata', () => {
        if (durationDisplay) {
            durationDisplay.textContent = formatTime(audioPlayer.duration);
        }
        console.log('Audio metadata loaded, duration:', audioPlayer.duration);
    });
    audioPlayer.addEventListener('volumechange', updateVolumeUI);

    if (progressBar) {
        progressBar.addEventListener('mousedown', startProgressDrag);
        progressBar.addEventListener('touchstart', startProgressDrag, { passive: false });
        progressBar.addEventListener('click', handleProgressBarClick);
        
        console.log('Progress bar event listeners attached');
    } else {
        console.error('Progress bar element not found!');
    }

    if (volumeSlider) {
        volumeSlider.addEventListener('mousedown', startVolumeDrag);
        volumeSlider.addEventListener('touchstart', startVolumeDrag, { passive: false });
        volumeSlider.addEventListener('click', handleVolumeClick);
        
        console.log('Volume slider event listeners attached');
    } else {
        console.error('Volume slider element not found!');
    }

    document.addEventListener('mousemove', handleGlobalDrag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', handleGlobalDrag, { passive: false });
    document.addEventListener('touchend', stopDrag);

    //Keyboard controls
    document.addEventListener('keydown', (event) => {
        if (event.code === 'Space' && event.target.tagName !== 'INPUT') {
            event.preventDefault();
            togglePlayPause();
        }
    });

    //initial volume
    audioPlayer.volume = 0.7;
    updateVolumeUI();
    
    console.log('Audio player initialized successfully');
});