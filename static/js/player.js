document.addEventListener('DOMContentLoaded', () => {
    const audioPlayer = document.getElementById('audio-player');
    const mainPlayBtn = document.getElementById('main-play-btn');
    const currentTitle = document.getElementById('current-title');
    const currentArtist = document.getElementById('current-artist');
    const currentTrackArt = document.getElementById('player-track-art');
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
    let dragStartTime = 0;
    let dragStartPos = { x: 0, y: 0 };

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
        const songAlbum = songContainer.dataset.album;
        const albumArtId = songContainer.dataset.albumArtId;

        if (!songUrl || !songTitle) return;

        if (currentSongUrl === songUrl) {
            togglePlayPause();
        } else {
            audioPlayer.src = songUrl;
            currentSongUrl = songUrl;
            currentTitle.textContent = songTitle;
            
            // Update artist info with album if available
            if (songAlbum && songAlbum.trim()) {
                currentArtist.textContent = `${songArtist} • ${songAlbum}`;
            } else {
                currentArtist.textContent = songArtist;
            }
            
            // Update album art in player
            updatePlayerAlbumArt(albumArtId);
            
            audioPlayer.play().catch(e => console.error('Play failed:', e));
        }
    }

    function updatePlayerAlbumArt(albumArtId) {
        if (!currentTrackArt) return;
        
        // Clear existing content
        currentTrackArt.innerHTML = '';
        
        if (albumArtId && albumArtId.trim()) {
            // Create and set album art image
            const img = document.createElement('img');
            img.src = `/album_art/${albumArtId}`;
            img.alt = 'Album Art';
            img.className = 'player-album-art';
            img.onerror = function() {
                // Fallback to music icon if image fails to load
                currentTrackArt.innerHTML = '<i class="fas fa-music track-icon"></i>';
            };
            currentTrackArt.appendChild(img);
        } else {
            // Default music icon
            currentTrackArt.innerHTML = '<i class="fas fa-music track-icon"></i>';
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

    function playNextSong() {
        const allSongs = Array.from(document.querySelectorAll('[data-url]'));
        if (allSongs.length === 0) {
            console.warn('No songs available to play next');
            return;
        }

        if (!currentSongUrl) {
            // No current song, play the first one
            playSong(allSongs[0]);
            return;
        }

        const currentIndex = allSongs.findIndex(song => song.dataset.url === currentSongUrl);
        if (currentIndex !== -1) {
            const nextIndex = (currentIndex + 1) % allSongs.length; // Loop back to first song
            playSong(allSongs[nextIndex]);
        } else {
            // Current song not found, play first song
            playSong(allSongs[0]);
        }
    }

    function playPreviousSong() {
        const allSongs = Array.from(document.querySelectorAll('[data-url]'));
        if (allSongs.length === 0) {
            console.warn('No songs available to play previous');
            return;
        }

        if (!currentSongUrl) {
            // No current song, play the last one
            playSong(allSongs[allSongs.length - 1]);
            return;
        }

        const currentIndex = allSongs.findIndex(song => song.dataset.url === currentSongUrl);
        if (currentIndex !== -1) {
            const prevIndex = currentIndex === 0 ? allSongs.length - 1 : currentIndex - 1; // Loop to last song
            playSong(allSongs[prevIndex]);
        } else {
            // Current song not found, play last song
            playSong(allSongs[allSongs.length - 1]);
        }
    }

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

    //Progress bar functions
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
        event.stopPropagation();
        
        // Record drag start time and position
        dragStartTime = Date.now();
        dragStartPos.x = event.clientX || (event.touches && event.touches[0].clientX) || 0;
        dragStartPos.y = event.clientY || (event.touches && event.touches[0].clientY) || 0;
        
        isDraggingProgress = true;
        
        console.log('Started dragging progress');
    }

    function startVolumeDrag(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Record drag start time and position
        dragStartTime = Date.now();
        dragStartPos.x = event.clientX || (event.touches && event.touches[0].clientX) || 0;
        dragStartPos.y = event.clientY || (event.touches && event.touches[0].clientY) || 0;
        
        isDraggingVolume = true;
        
        console.log('Started dragging volume');
    }

    function handleGlobalDrag(event) {
        if (!isDraggingProgress && !isDraggingVolume) return;
        
        event.preventDefault();
        const clientX = event.clientX || (event.touches && event.touches[0].clientX);
        if (clientX === undefined) return;

        if (isDraggingProgress && audioPlayer.duration && !isNaN(audioPlayer.duration)) {
            const percentage = getProgressPercentage(clientX);
            const newTime = percentage * audioPlayer.duration;
            audioPlayer.currentTime = newTime;
            updateProgressUI(percentage);
        }

        if (isDraggingVolume) {
            const percentage = getVolumePercentage(clientX);
            audioPlayer.volume = percentage;
            updateVolumeUI();
        }
    }

    function stopDrag(event) {
        if (isDraggingProgress || isDraggingVolume) {
            const dragDuration = Date.now() - dragStartTime;
            const currentX = event.clientX || (event.changedTouches && event.changedTouches[0].clientX) || 0;
            const currentY = event.clientY || (event.changedTouches && event.changedTouches[0].clientY) || 0;
            const dragDistance = Math.sqrt(Math.pow(currentX - dragStartPos.x, 2) + Math.pow(currentY - dragStartPos.y, 2));
            
            // If it was a quick click with minimal movement, treat as click
            if (dragDuration < 200 && dragDistance < 5) {
                if (isDraggingProgress && audioPlayer.duration && !isNaN(audioPlayer.duration)) {
                    const percentage = getProgressPercentage(currentX);
                    const newTime = percentage * audioPlayer.duration;
                    audioPlayer.currentTime = newTime;
                    updateProgressUI(percentage);
                    console.log(`Quick click - seeked to: ${newTime.toFixed(2)}s`);
                }
                
                if (isDraggingVolume) {
                    const percentage = getVolumePercentage(currentX);
                    audioPlayer.volume = percentage;
                    updateVolumeUI();
                    console.log(`Quick click - volume set to: ${(percentage * 100).toFixed(1)}%`);
                }
            }
        }
        
        if (isDraggingProgress) {
            console.log('Stopped dragging progress');
        }
        if (isDraggingVolume) {
            console.log('Stopped dragging volume');
        }
        
        isDraggingProgress = false;
        isDraggingVolume = false;
    }

    function handleProgressBarClick(event) {
        // Only handle clicks if we're not in the middle of a drag operation
        if (isDraggingProgress) return;
        
        if (!audioPlayer.duration || isNaN(audioPlayer.duration)) {
            console.warn('Cannot seek - no audio duration');
            return;
        }
        
        // Check if this is a mousedown event on the handle - don't treat as click
        if (event.target === progressHandle) {
            return;
        }
        
        event.preventDefault();
        event.stopPropagation();
        
        const percentage = getProgressPercentage(event.clientX);
        const newTime = percentage * audioPlayer.duration;
        
        audioPlayer.currentTime = newTime;
        updateProgressUI(percentage);
        
        console.log(`Clicked progress bar - seeked to: ${newTime.toFixed(2)}s`);
    }

    function handleVolumeClick(event) {
        if (isDraggingVolume) return;
        
        // Check if this is a mousedown event on the handle - don't treat as click
        if (event.target === volumeHandle) {
            return;
        }
        
        event.preventDefault();
        event.stopPropagation();
        
        const percentage = getVolumePercentage(event.clientX);
        audioPlayer.volume = percentage;
        updateVolumeUI();
        
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
        
        if (event.target.closest('#next-song-btn')) {
            event.preventDefault();
            playNextSong();
            return;
        }
        
        if (event.target.closest('#prev-song-btn')) {
            event.preventDefault();
            playPreviousSong();
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
    
    // Update duration display when metadata loads
    audioPlayer.addEventListener('loadeddata', () => {
        if (durationDisplay && audioPlayer.duration && !isNaN(audioPlayer.duration)) {
            durationDisplay.textContent = formatTime(audioPlayer.duration);
        }
    });
    
    // Ensure progress bar updates when seeking
    audioPlayer.addEventListener('seeked', () => {
        if (!isDraggingProgress) {
            updateProgress();
        }
    });
    
    // Handle when audio can start playing
    audioPlayer.addEventListener('canplay', () => {
        if (durationDisplay && audioPlayer.duration && !isNaN(audioPlayer.duration)) {
            durationDisplay.textContent = formatTime(audioPlayer.duration);
        }
    });

    // Progress bar event listeners
    if (progressBar) {
        // Handle clicking directly on the progress bar (not the handle)
        progressBar.addEventListener('click', (event) => {
            // Only handle clicks that aren't on the handle itself
            if (event.target !== progressHandle && !isDraggingProgress) {
                handleProgressBarClick(event);
            }
        });
        
        // Handle dragging specifically on the handle
        if (progressHandle) {
            progressHandle.addEventListener('mousedown', startProgressDrag);
            progressHandle.addEventListener('touchstart', startProgressDrag, { passive: false });
        }
        
        // Also allow dragging when clicking anywhere on the progress bar
        progressBar.addEventListener('mousedown', (event) => {
            if (event.target !== progressHandle) {
                startProgressDrag(event);
            }
        });
        progressBar.addEventListener('touchstart', (event) => {
            if (event.target !== progressHandle) {
                startProgressDrag(event);
            }
        }, { passive: false });
        
        console.log('Progress bar event listeners attached');
    } else {
        console.error('Progress bar element not found!');
    }

    // Volume slider event listeners
    if (volumeSlider) {
        volumeSlider.addEventListener('click', (event) => {
            // Only handle clicks that aren't on the handle itself
            if (event.target !== volumeHandle && !isDraggingVolume) {
                handleVolumeClick(event);
            }
        });
        
        // Handle dragging specifically on the handle
        if (volumeHandle) {
            volumeHandle.addEventListener('mousedown', startVolumeDrag);
            volumeHandle.addEventListener('touchstart', startVolumeDrag, { passive: false });
        }
        
        // Also allow dragging when clicking anywhere on the volume slider
        volumeSlider.addEventListener('mousedown', (event) => {
            if (event.target !== volumeHandle) {
                startVolumeDrag(event);
            }
        });
        volumeSlider.addEventListener('touchstart', (event) => {
            if (event.target !== volumeHandle) {
                startVolumeDrag(event);
            }
        }, { passive: false });
        
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
        if (event.code === 'ArrowRight' && event.target.tagName !== 'INPUT') {
            event.preventDefault();
            playNextSong();
        }
        if (event.code === 'ArrowLeft' && event.target.tagName !== 'INPUT') {
            event.preventDefault();
            playPreviousSong();
        }
    });

    //initial volume
    audioPlayer.volume = 0.7;
    updateVolumeUI();
    
    console.log('Audio player initialized successfully');
});