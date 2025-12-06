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

import { AuthProvider } from './context/AuthContext';

function App() {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayTrack = (track) => {
    setCurrentTrack(track);
    setIsPlaying(true); // Set isPlaying to true when a track starts playing
  };

  const togglePlay = () => { // Added togglePlay function
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
            {/* Add other routes here */}
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;
