import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Upload from './pages/Upload';
import Login from './pages/Login';
import Library from './pages/Library';
import CreatePlaylist from './pages/CreatePlaylist';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import TrackDetails from './pages/TrackDetails';
import AlbumDetails from './pages/AlbumDetails';
import LikedSongs from './pages/LikedSongs';
import PlaylistDetails from './pages/PlaylistDetails';

import { AuthProvider } from './context/AuthContext';

function App() {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const handlePlayTrack = (track, trackList = []) => {
    setCurrentTrack(track);
    setIsPlaying(true);
    
    // If a new list is provided (context switch), replace queue
    if (trackList.length > 0) {
      setQueue(trackList);
      const idx = trackList.findIndex(t => t.id === track.id);
      setCurrentIndex(idx !== -1 ? idx : 0);
    } else if (queue.length > 0) {
        // Playing from current queue, just update index if found
        const idx = queue.findIndex(t => t.id === track.id);
        if (idx !== -1) setCurrentIndex(idx);
    }
  };

  const playNext = () => {
    if (queue.length > 0 && currentIndex < queue.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentTrack(queue[nextIndex]);
      setCurrentIndex(nextIndex);
      setIsPlaying(true);
    }
  };

  const playPrev = () => {
    if (queue.length > 0 && currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentTrack(queue[prevIndex]);
      setCurrentIndex(prevIndex);
      setIsPlaying(true);
    }
  };

  const togglePlay = () => {
    setIsPlaying(prev => !prev);
  };

  return (
    <AuthProvider>
      <Router>
        <Layout
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          setIsPlaying={setIsPlaying}
          onNext={playNext}
          onPrev={playPrev}
          hasNext={currentIndex < queue.length - 1}
          hasPrev={currentIndex > 0}
        >
          <Routes>
            <Route path="/" element={
              <Home
                onPlay={handlePlayTrack}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onTogglePlay={togglePlay}
              />
            } />
            <Route path="/upload" element={<Upload />} />
            <Route path="/login" element={<Login />} />
            <Route path="/library" element={<Library />} />
            <Route path="/liked-songs" element={
              <LikedSongs
                onPlay={handlePlayTrack}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onTogglePlay={togglePlay}
              />
            } />
            <Route path="/create-playlist" element={<CreatePlaylist />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={
              <Profile
                onPlay={handlePlayTrack}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onTogglePlay={togglePlay}
              />
            } />
            <Route path="/profile/:userId" element={
              <Profile
                onPlay={handlePlayTrack}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onTogglePlay={togglePlay}
              />
            } />
            <Route path="/track/:trackId" element={
              <TrackDetails
                onPlay={handlePlayTrack}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onTogglePlay={togglePlay}
              />
            } />
            <Route path="/album/:albumName" element={
              <AlbumDetails
                onPlay={handlePlayTrack}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onTogglePlay={togglePlay}
              />
            } />
            <Route path="/playlist/:playlistId" element={
              <PlaylistDetails
                onPlay={handlePlayTrack}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onTogglePlay={togglePlay}
              />
            } />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;
