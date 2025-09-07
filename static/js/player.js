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
    let currentSongId = null;
    let isPlaying = false;
    let isDraggingProgress = false;
    let isDraggingVolume = false;
    let hideDropdownTimeout = null;
    let userPlaylists = [];

    if (!audioPlayer) {
        console.error("Audio player element not found!");
        return;
    }

    // --- Core Player Functions ---
    function playSong(songContainer) {
        const songUrl = songContainer.dataset.url;
        const songTitle = songContainer.dataset.title;
        const songArtist = songContainer.dataset.artist;
        const songAlbum = songContainer.dataset.album;
        const albumArtId = songContainer.dataset.albumArtId;
        const songId = songContainer.dataset.songId;

        if (!songUrl || !songTitle) return;

        if (currentSongUrl === songUrl) {
            togglePlayPause();
        } else {
            audioPlayer.src = songUrl;
            currentSongUrl = songUrl;
            currentSongId = songId;
            currentTitle.textContent = songTitle;
            currentArtist.textContent = (songAlbum && songAlbum.trim()) ? `${songArtist} • ${songAlbum}` : songArtist;
            
            updatePlayerAlbumArt(albumArtId);
            updatePlayerHeartButton(songId);
            
            if (songId) {
                trackSongPlay(songId);
            }
            
            audioPlayer.play().catch(e => console.error('Play failed:', e));
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

    async function trackSongPlay(songId) {
        try {
            await fetch('/api/track-play', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ song_id: songId })
            });
        } catch (error) {
            console.error('Error tracking song play:', error);
        }
    }
    
    // --- UI Update Functions ---
    function updatePlayerAlbumArt(albumArtId) {
        if (!currentTrackArt) return;
        currentTrackArt.innerHTML = '';
        if (albumArtId && albumArtId.trim()) {
            const img = document.createElement('img');
            img.src = `/album_art/${albumArtId}`;
            img.alt = 'Album Art';
            img.className = 'player-album-art';
            img.onerror = () => { currentTrackArt.innerHTML = '<i class="fas fa-music track-icon"></i>'; };
            currentTrackArt.appendChild(img);
        } else {
            currentTrackArt.innerHTML = '<i class="fas fa-music track-icon"></i>';
        }
    }

    function updatePlayerHeartButton(songId) {
        const playerHeartBtn = document.getElementById('player-heart-btn');
        if (!playerHeartBtn || !songId) return;
        
        const currentSongCard = document.querySelector(`[data-song-id="${songId}"] .favorite-btn`);
        const isLiked = currentSongCard && currentSongCard.classList.contains('liked');
        
        const icon = playerHeartBtn.querySelector('i');
        if (isLiked) {
            icon.classList.replace('far', 'fas');
            playerHeartBtn.classList.add('liked');
        } else {
            icon.classList.replace('fas', 'far');
            playerHeartBtn.classList.remove('liked');
        }
    }

    // --- Playlist and Like Functionality ---
    async function loadUserPlaylists() {
        try {
            const response = await fetch('/api/playlists');
            if (response.ok) {
                const data = await response.json();
                userPlaylists = data.playlists || [];
            } else {
                userPlaylists = [];
            }
        } catch (error) {
            console.error('Error loading playlists:', error);
            userPlaylists = [];
        }
    }
    
    async function showPlaylistDropdown(heartButton) {
        const container = heartButton.closest('.favorite-btn-container');
        if (!container) return;
        
        const dropdown = container.querySelector('.playlist-dropdown');
        if (!dropdown) return;
        
        const playlistItems = dropdown.querySelector('.playlist-items');
        if (!playlistItems) return;

        const songId = getSongIdFromButton(heartButton);
        if (!songId) {
            playlistItems.innerHTML = '<div class="playlist-item" style="cursor:default; opacity: 0.6;">No song selected</div>';
            return;
        }

        // Fetch which playlists this song is already in
        let songPlaylists = [];
        try {
            const response = await fetch(`/api/song/${songId}/playlists`);
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    songPlaylists = data.playlist_ids;
                }
            }
        } catch (error) {
            console.error("Could not fetch song's playlists:", error);
        }
        
        playlistItems.innerHTML = ''; // Clear existing items
        
        if (userPlaylists.length > 0) {
            userPlaylists.forEach(playlist => {
                const item = document.createElement('div');
                item.className = 'playlist-item';
                item.dataset.playlistId = playlist.id;

                const isInPlaylist = songPlaylists.includes(playlist.id);
                item.dataset.inPlaylist = isInPlaylist;

                if (isInPlaylist) {
                    item.classList.add('in-playlist');
                    item.innerHTML = `<i class="fas fa-check"></i> ${playlist.name}`;
                } else {
                    item.innerHTML = `<i class="fas fa-plus"></i> ${playlist.name}`;
                }
                playlistItems.appendChild(item);
            });
        } else {
            const emptyItem = document.createElement('div');
            emptyItem.className = 'playlist-item';
            emptyItem.style.opacity = '0.6';
            emptyItem.style.cursor = 'default';
            emptyItem.innerHTML = '<i class="fas fa-info-circle"></i> No playlists';
            playlistItems.appendChild(emptyItem);
        }
        
        dropdown.style.display = 'block';
    }

    function hideAllDropdowns(exceptThisOne = null) {
        document.querySelectorAll('.playlist-dropdown').forEach(dropdown => {
            if (dropdown !== exceptThisOne) {
                dropdown.style.display = 'none';
            }
        });
    }
    
    function getSongIdFromButton(button) {
        if (button && button.id === 'player-heart-btn') {
            return currentSongId;
        }
        if (button) {
            const songContainer = button.closest('[data-song-id]');
            return songContainer ? songContainer.dataset.songId : null;
        }
        return null;
    }

    async function addToPlaylist(playlistId, songId) {
        if (!songId || !playlistId) {
            showToast('Error: Could not add to playlist', 'error');
            return;
        }
        
        try {
            const response = await fetch('/playlist/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playlist_id: playlistId, song_id: songId })
            });
            const result = await response.json();
            showToast(result.message || 'Action completed', result.success ? 'success' : 'error');
        } catch (error) {
            showToast('Error adding to playlist', 'error');
        }
    }
    
    async function removeFromPlaylist(playlistId, songId) {
        if (!songId || !playlistId) {
            showToast('Error: Could not remove from playlist', 'error');
            return;
        }
        
        try {
            const response = await fetch('/playlist/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playlist_id: playlistId, song_id: songId })
            });
            const result = await response.json();
            showToast(result.message || 'Action completed', result.success ? 'success' : 'error');
        } catch (error) {
            showToast('Error removing from playlist', 'error');
        }
    }
    
    async function toggleLike(likeButton) {
        const songId = getSongIdFromButton(likeButton);
        if (!songId) return;

        try {
            const response = await fetch(`/like/${songId}`, { method: 'POST' });
            if (!response.ok) {
                 if (response.status === 401) window.location.href = '/login';
                 return;
            }
            
            const result = await response.json();

            // Update all heart buttons for this song on the page, including the player
            document.querySelectorAll(`[data-song-id="${songId}"] .favorite-btn, #player-heart-btn`).forEach(btn => {
                 if (getSongIdFromButton(btn) === songId) {
                    const icon = btn.querySelector('i');
                    if (result.liked) {
                        icon.classList.replace('far', 'fas');
                        btn.classList.add('liked');
                    } else {
                        icon.classList.replace('fas', 'far');
                        btn.classList.remove('liked');
                    }
                }
            });
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    }
    
    function showToast(message, type = 'success') {
        const existingToast = document.querySelector('.toast');
        if (existingToast) existingToast.remove();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    // --- Simplified Event Handling Setup ---
    function initializeInteractiveElements() {
        // Initialize hover behavior for playlist dropdowns
        document.querySelectorAll('.favorite-btn-container').forEach(container => {
            container.addEventListener('mouseenter', () => {
                clearTimeout(hideDropdownTimeout);
                const dropdown = container.querySelector('.playlist-dropdown');
                hideAllDropdowns(dropdown); // Hide others
                showPlaylistDropdown(container.querySelector('.favorite-btn'));
            });

            container.addEventListener('mouseleave', () => {
                hideDropdownTimeout = setTimeout(hideAllDropdowns, 300);
            });
        });

        // Single delegated click listener for the whole page
        document.body.addEventListener('click', (event) => {
            const playlistItem = event.target.closest('.playlist-item');
            if (playlistItem && playlistItem.dataset.playlistId) {
                event.preventDefault();
                event.stopPropagation();
                const container = playlistItem.closest('.favorite-btn-container');
                const songId = getSongIdFromButton(container.querySelector('.favorite-btn'));
                const playlistId = playlistItem.dataset.playlistId;
                const isInPlaylist = playlistItem.dataset.inPlaylist === 'true';

                if (isInPlaylist) {
                    removeFromPlaylist(playlistId, songId);
                } else {
                    addToPlaylist(playlistId, songId);
                }
                
                hideAllDropdowns();
                return;
            }

            const favoriteBtn = event.target.closest('.favorite-btn');
            if (favoriteBtn) {
                event.preventDefault();
                event.stopPropagation();
                toggleLike(favoriteBtn);
                return;
            }
            
            const playBtn = event.target.closest('.card-play-btn, .song-item-art');
            if (playBtn) {
                playSong(playBtn.closest('[data-url]'));
                return;
            }

            // If the click is not on a favorite button container, hide dropdowns
            if (!event.target.closest('.favorite-btn-container')) {
                hideAllDropdowns();
            }
        });
    }

    // Initialize all event listeners
    initializeInteractiveElements();
    loadUserPlaylists();

    // The rest of your player logic (progress bar, volume, etc.) remains unchanged.
    // ...
    function playNextSong() {
        const allSongs = Array.from(document.querySelectorAll('[data-url]'));
        if (allSongs.length === 0) return;
        if (!currentSongUrl) { playSong(allSongs[0]); return; }
        const currentIndex = allSongs.findIndex(song => song.dataset.url === currentSongUrl);
        const nextIndex = (currentIndex + 1) % allSongs.length;
        playSong(allSongs[nextIndex]);
    }

    function playPreviousSong() {
        const allSongs = Array.from(document.querySelectorAll('[data-url]'));
        if (allSongs.length === 0) return;
        if (!currentSongUrl) { playSong(allSongs[allSongs.length - 1]); return; }
        const currentIndex = allSongs.findIndex(song => song.dataset.url === currentSongUrl);
        const prevIndex = currentIndex === 0 ? allSongs.length - 1 : currentIndex - 1;
        playSong(allSongs[prevIndex]);
    }

    function onPlay() { isPlaying = true; mainPlayBtn.innerHTML = '<i class="fas fa-pause"></i>'; }
    function onPause() { isPlaying = false; mainPlayBtn.innerHTML = '<i class="fas fa-play"></i>'; }
    function onSongEnd() { playNextSong(); }

    function updateProgress() {
        if (isDraggingProgress || !audioPlayer.duration) return;
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
    
    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec.toString().padStart(2, '0')}`;
    }

    // Player controls and progress bar logic
    mainPlayBtn.addEventListener('click', togglePlayPause);
    document.getElementById('next-song-btn').addEventListener('click', playNextSong);
    document.getElementById('prev-song-btn').addEventListener('click', playPreviousSong);

    audioPlayer.addEventListener('play', onPlay);
    audioPlayer.addEventListener('pause', onPause);
    audioPlayer.addEventListener('ended', onSongEnd);
    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('loadedmetadata', () => {
        durationDisplay.textContent = formatTime(audioPlayer.duration);
    });
    audioPlayer.addEventListener('volumechange', updateVolumeUI);
    
    function setupSlider(slider, fill, handle, onDrag, onClick) {
        let isDragging = false;
        function getPercentage(event) {
            const rect = slider.getBoundingClientRect();
            const clientX = event.clientX || (event.touches && event.touches[0].clientX);
            let percentage = (clientX - rect.left) / rect.width;
            return Math.max(0, Math.min(1, percentage));
        }
        function startDrag(event) {
            isDragging = true; onDrag(getPercentage(event));
            document.addEventListener('mousemove', drag); document.addEventListener('touchmove', drag);
            document.addEventListener('mouseup', stopDrag); document.addEventListener('touchend', stopDrag);
        }
        function drag(event) { if(isDragging) onDrag(getPercentage(event)); }
        function stopDrag() {
            isDragging = false;
            document.removeEventListener('mousemove', drag); document.removeEventListener('touchmove', drag);
            document.removeEventListener('mouseup', stopDrag); document.removeEventListener('touchend', stopDrag);
        }
        slider.addEventListener('mousedown', startDrag); slider.addEventListener('touchstart', startDrag);
        slider.addEventListener('click', (e) => onClick(getPercentage(e)));
    }

    setupSlider(progressBar, progressFill, progressHandle, 
        (percentage) => { 
            isDraggingProgress = true;
            progressFill.style.width = `${percentage * 100}%`; progressHandle.style.left = `${percentage * 100}%`;
            audioPlayer.currentTime = audioPlayer.duration * percentage;
        }, 
        (percentage) => { audioPlayer.currentTime = audioPlayer.duration * percentage; }
    );
    document.addEventListener('mouseup', () => { isDraggingProgress = false; });
    document.addEventListener('touchend', () => { isDraggingProgress = false; });

    setupSlider(volumeSlider, volumeFill, volumeHandle,
        (percentage) => { audioPlayer.volume = percentage; },
        (percentage) => { audioPlayer.volume = percentage; }
    );

    audioPlayer.volume = 0.7; updateVolumeUI();

    window.showRecentlyPlayed = async function() {
        const modal = document.getElementById('recently-played-modal'); if (!modal) return;
        modal.style.display = 'flex'; const listContainer = document.getElementById('recently-played-list');
        listContainer.innerHTML = `<div class="loading-message"><i class="fas fa-spinner fa-spin"></i> Loading...</div>`;
        try {
            const response = await fetch('/api/recently-played');
            const data = await response.json();
            if (data.success && data.songs.length > 0) {
                listContainer.innerHTML = '';
                data.songs.forEach(song => {
                    const item = document.createElement('div');
                    item.className = 'recently-played-item';
                    item.dataset.url = `/stream/${song.file_id}`; item.dataset.title = song.title;
                    item.dataset.artist = song.artist; item.dataset.album = song.album || '';
                    item.dataset.albumArtId = song.album_art_id || ''; item.dataset.songId = song.id;
                    item.innerHTML = `<div class="recently-played-art">${song.album_art_id ? `<img src="/album_art/${song.album_art_id}">` : '<i class="fas fa-music"></i>'}</div><div class="recently-played-details"><div class="recently-played-title">${song.title}</div><div class="recently-played-meta">${song.artist}${song.album ? ` • ${song.album}` : ''}</div></div><button class="recently-played-play-btn"><i class="fas fa-play"></i></button>`;
                    item.addEventListener('click', () => { playSong(item); hideRecentlyPlayed(); });
                    listContainer.appendChild(item);
                });
            } else { listContainer.innerHTML = `<div class="empty-message"><i class="fas fa-music"></i><p>No recently played songs.</p></div>`; }
        } catch (error) { listContainer.innerHTML = `<div class="empty-message"><i class="fas fa-exclamation-triangle"></i><p>Error loading songs.</p></div>`; }
    };
    
    window.hideRecentlyPlayed = function() {
        const modal = document.getElementById('recently-played-modal');
        if (modal) modal.style.display = 'none';
    };
    document.getElementById('recently-played-modal')?.addEventListener('click', function(e) { if (e.target === this) hideRecentlyPlayed(); });

    window.playRandomSong = function() {
        const allMusicCards = document.querySelectorAll('.music-card, .album-card');
        if (allMusicCards.length > 0) {
            const randomIndex = Math.floor(Math.random() * allMusicCards.length);
            playSong(allMusicCards[randomIndex]);
        }
    };
    
    // Album Popup Functions
    window.showAlbumPopup = async function(albumName, artistName) {
        const modal = document.getElementById('album-modal');
        if (!modal) return;
        
        modal.style.display = 'flex';
        
        // Update modal header
        document.getElementById('album-title').textContent = albumName;
        document.getElementById('album-artist').textContent = artistName;
        
        try {
            const response = await fetch(`/api/album/${encodeURIComponent(albumName)}/${encodeURIComponent(artistName)}`);
            const data = await response.json();
            
            const listContainer = document.getElementById('album-songs-list');
            
            if (data.success && data.album.songs.length > 0) {
                const album = data.album;
                
                // Update album art in header
                const albumArtHeader = document.getElementById('album-art-header');
                if (album.album_art_id) {
                    albumArtHeader.innerHTML = `<img src="/album_art/${album.album_art_id}" alt="${album.name} Album Art" onclick="playAlbum()">`;
                } else {
                    albumArtHeader.innerHTML = '<i class="fas fa-compact-disc"></i>';
                }
                
                // Update song count
                document.getElementById('album-song-count').textContent = `${album.song_count} songs`;
                
                // Store album data for playing
                window.currentAlbumData = album;
                
                // Update album about section if user is admin
                updateAlbumAboutSection(album);
                
                // Create song list
                listContainer.innerHTML = '';
                album.songs.forEach((song, index) => {
                    const item = createAlbumSongItem(song, index + 1);
                    listContainer.appendChild(item);
                });
            } else {
                listContainer.innerHTML = `
                    <div class="empty-message">
                        <i class="fas fa-compact-disc"></i>
                        <p>No songs found in this album.</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading album details:', error);
            document.getElementById('album-songs-list').innerHTML = `
                <div class="empty-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error loading album songs.</p>
                </div>
            `;
        }
    };
    
    window.hideAlbumPopup = function() {
        const modal = document.getElementById('album-modal');
        if (modal) {
            modal.style.display = 'none';
            window.currentAlbumData = null;
        }
    };
    
    window.playAlbum = function() {
        if (window.currentAlbumData && window.currentAlbumData.songs.length > 0) {
            const firstSong = window.currentAlbumData.songs[0];
            const songContainer = createSongContainerFromData(firstSong);
            playSong(songContainer);
            hideAlbumPopup();
        }
    };
    
    function createAlbumSongItem(song, trackNumber) {
        const item = document.createElement('div');
        item.className = 'album-song-item';
        item.setAttribute('data-url', `/stream/${song.file_id}`);
        item.setAttribute('data-title', song.title);
        item.setAttribute('data-artist', song.artist);
        item.setAttribute('data-album', song.album || '');
        item.setAttribute('data-genre', song.genre);
        item.setAttribute('data-album-art-id', song.album_art_id || '');
        item.setAttribute('data-song-id', song.id);
        
        item.innerHTML = `
            <div class="song-number">${trackNumber}</div>
            <div class="album-song-details">
                <div class="album-song-title">${song.title}</div>
                <div class="album-song-meta">${song.genre}</div>
            </div>
            <div class="album-song-actions">
                <button class="album-song-play-btn">
                    <i class="fas fa-play"></i>
                </button>
            </div>
        `;
        
        // Add click handler for playing the song
        item.addEventListener('click', (e) => {
            e.preventDefault();
            playSong(item);
            hideAlbumPopup();
        });
        
        return item;
    }
    
    function createSongContainerFromData(song) {
        const container = document.createElement('div');
        container.setAttribute('data-url', `/stream/${song.file_id}`);
        container.setAttribute('data-title', song.title);
        container.setAttribute('data-artist', song.artist);
        container.setAttribute('data-album', song.album || '');
        container.setAttribute('data-genre', song.genre);
        container.setAttribute('data-album-art-id', song.album_art_id || '');
        container.setAttribute('data-song-id', song.id);
        return container;
    }
    
    // Close modals when clicking outside
    document.getElementById('album-modal')?.addEventListener('click', function(e) { 
        if (e.target === this) hideAlbumPopup(); 
    });
    
    // Album About Section Functions
    function updateAlbumAboutSection(album) {
        const descriptionText = document.getElementById('album-description-text');
        const descriptionDisplay = document.getElementById('album-description-display');
        const aboutSection = document.getElementById('album-about-section');
        
        if (!descriptionText || !descriptionDisplay || !aboutSection) return;
        
        if (album.has_description && album.description.trim()) {
            // Show description for all users
            descriptionText.textContent = album.description;
            descriptionText.classList.remove('no-description');
            descriptionDisplay.style.display = 'block';
            aboutSection.style.display = 'block';
        } else {
            // Check if user is admin by looking for the edit button
            const editBtn = document.getElementById('edit-album-btn');
            const isAdmin = editBtn !== null;
            
            if (isAdmin) {
                // For admins, show "No description available" and allow editing
                descriptionText.textContent = 'No description available.';
                descriptionText.classList.add('no-description');
                descriptionDisplay.style.display = 'block';
                aboutSection.style.display = 'block';
            } else {
                // For regular users, hide the entire about section if no description
                aboutSection.style.display = 'none';
            }
        }
    }
    
    window.toggleAlbumEdit = function() {
        const displayDiv = document.getElementById('album-description-display');
        const editForm = document.getElementById('album-edit-form');
        const editBtn = document.getElementById('edit-album-btn');
        const descriptionText = document.getElementById('album-description-text');
        const descriptionInput = document.getElementById('album-description-input');
        
        if (displayDiv && editForm && editBtn && descriptionInput) {
            // Switch to edit mode
            displayDiv.style.display = 'none';
            editForm.style.display = 'block';
            editBtn.style.display = 'none';
            
            // Pre-fill the textarea with current description
            const currentText = descriptionText.textContent;
            if (currentText && currentText !== 'No description available.') {
                descriptionInput.value = currentText;
            } else {
                descriptionInput.value = '';
            }
            
            // Focus on the textarea
            descriptionInput.focus();
        }
    };
    
    window.cancelAlbumEdit = function() {
        const displayDiv = document.getElementById('album-description-display');
        const editForm = document.getElementById('album-edit-form');
        const editBtn = document.getElementById('edit-album-btn');
        
        if (displayDiv && editForm && editBtn) {
            // Switch back to display mode
            displayDiv.style.display = 'block';
            editForm.style.display = 'none';
            editBtn.style.display = 'inline-flex';
        }
    };
    
    window.saveAlbumDescription = async function() {
        const descriptionInput = document.getElementById('album-description-input');
        const descriptionText = document.getElementById('album-description-text');
        
        if (!descriptionInput || !window.currentAlbumData) return;
        
        const description = descriptionInput.value.trim();
        const albumName = window.currentAlbumData.name;
        const artistName = window.currentAlbumData.artist;
        
        try {
            const response = await fetch(`/api/album/${encodeURIComponent(albumName)}/${encodeURIComponent(artistName)}/info`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ description: description })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Update the display
                if (description) {
                    descriptionText.textContent = description;
                    descriptionText.classList.remove('no-description');
                } else {
                    descriptionText.textContent = 'No description available.';
                    descriptionText.classList.add('no-description');
                }
                
                // Update current album data
                window.currentAlbumData.description = description;
                window.currentAlbumData.has_description = !!description;
                
                // Switch back to display mode
                cancelAlbumEdit();
                
                // Show success message (you can implement a toast notification here)
                console.log('Album description saved successfully');
            } else {
                alert('Failed to save album description: ' + result.message);
            }
        } catch (error) {
            console.error('Error saving album description:', error);
            alert('Error saving album description. Please try again.');
        }
    };
});