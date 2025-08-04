document.addEventListener('DOMContentLoaded', function () {
  const audioPlayer = document.getElementById('audio-player');
  const nowPlaying = document.getElementById('now-playing');
  const albumArt = document.getElementById('album-art');
  const songItems = document.querySelectorAll('.song-item');

  if (!audioPlayer || !nowPlaying || songItems.length === 0) {
    console.error("Audio player or song list not found.");
    return;
  }

  // Only one song can play at a time
  songItems.forEach(item => {
    item.addEventListener('click', () => {
      const songUrl = item.dataset.url;
      const songTitle = item.dataset.title;

      if (songUrl && songTitle) {
        audioPlayer.src = songUrl;
        audioPlayer.play();
        nowPlaying.textContent = songTitle;
      } else {
        console.warn("Missing song URL or title.");
      }
    });
  });
});
