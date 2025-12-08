import React, { useEffect, useState } from 'react';
import client from '../api/client';
import TrackList from '../components/TrackList';
import { FaPlay, FaPause, FaMusic } from 'react-icons/fa';
import { Link } from 'react-router-dom';

const Home = ({ onPlay, currentTrack, isPlaying, onTogglePlay }) => {
    const [tracks, setTracks] = useState([]);
    const [greeting, setGreeting] = useState('Good morning');
    const [artists, setArtists] = useState([]);
    const [albums, setAlbums] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch tracks
                const tracksRes = await client.get('/tracks/?public_only=true');
                setTracks(tracksRes.data);

                // For demo purposes, extract unique albums/artists from tracks 
                // In a real app, these would be separate endpoints
                const uniqueArtists = [...new Map(tracksRes.data.map(item => [item.artist_id, item])).values()];
                setArtists(uniqueArtists.slice(0, 6));

                const uniqueAlbums = [...new Map(tracksRes.data.filter(t=>t.album_id).map(item => [item.album_id, item])).values()];
                setAlbums(uniqueAlbums.slice(0, 6));

            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        fetchData();

        const hour = new Date().getHours();
        if (hour >= 12 && hour < 18) setGreeting('Good afternoon');
        else if (hour >= 18) setGreeting('Good evening');
    }, []);

    const handlePlayCard = (e, track) => {
        e.preventDefault();
        e.stopPropagation();
        if (currentTrack && currentTrack.id === track.id) {
            onTogglePlay();
        } else {
            onPlay(track, tracks);
        }
    };

    const handlePlayAlbumCard = (e, albumTrack) => {
        e.preventDefault();
        e.stopPropagation();
        // Check if currently playing from this album (approximate check using track's album_id)
        if (currentTrack && currentTrack.album_id === albumTrack.album_id) {
            onTogglePlay();
        } else {
            // In a real app, fetch album tracks. Here we play the specific track representing the album or filter tracks.
            const albumTracks = tracks.filter(t => t.album_id === albumTrack.album_id);
            if (albumTracks.length > 0) {
                onPlay(albumTracks[0], albumTracks);
            } else {
                onPlay(albumTrack, [albumTrack]);
            }
        }
    }

    return (
        <div className="bg-gradient-to-b from-[#1e1e1e] to-[#121212] min-h-full p-8 pb-32">
            {/* Greeting */}
            <h1 className="text-3xl font-bold text-white mb-6 tracking-tight">{greeting}</h1>

            {/* Shortcuts Grid (Albums) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                {albums.slice(0, 6).map((item) => {
                    const isPlayingAlbum = isPlaying && currentTrack && currentTrack.album_id === item.album_id;
                    const isCurrentAlbum = currentTrack && currentTrack.album_id === item.album_id;
                    
                    return (
                        <Link 
                            to={`/album/${item.album_id}`} 
                            key={`shortcut-${item.album_id}`} 
                            className={`bg-[#303030] hover:bg-[#454545] transition-all duration-200 rounded overflow-hidden flex items-center gap-4 group cursor-pointer h-20 ${isCurrentAlbum ? 'bg-[#454545]' : 'border-transparent'}`}
                        >
                            <div className="h-20 w-20 flex-shrink-0 bg-[#282828] shadow-lg relative">
                                {item.album_art_path ? (
                                    <img src={`http://localhost:8000/${item.album_art_path}`} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500"><FaMusic /></div>
                                )}
                            </div>
                            <span className={`font-bold truncate pr-4 ${isCurrentAlbum ? 'text-green-400' : 'text-white'}`}>{item.album}</span>
                            
                            {/* Play Button */}
                            <div className={`ml-auto mr-4 shadow-xl transition-opacity ${isCurrentAlbum || isPlayingAlbum ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                <button 
                                    onClick={(e) => handlePlayAlbumCard(e, item)}
                                    className="w-10 h-10 bg-[#1ed760] rounded-full flex items-center justify-center hover:scale-105 cursor-pointer shadow-lg"
                                >
                                    {isPlayingAlbum ? <FaPause size={16} className="text-black" /> : <FaPlay size={16} className="text-black ml-1" />}
                                </button>
                            </div>
                        </Link>
                    );
                })}
            </div>

            {/* Section: Made For You */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-white hover:underline cursor-pointer">Made For You</h2>
                    <span className="text-xs font-bold text-[#b3b3b3] hover:underline cursor-pointer tracking-widest">SHOW ALL</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    {tracks.slice(0, 5).map(track => {
                        const isCurrent = currentTrack && currentTrack.id === track.id;
                        const isPlayingTrack = isCurrent && isPlaying;
                        
                        return (
                            <div key={track.id} className={`bg-[#181818] p-4 rounded-md hover:bg-[#282828] transition-all duration-200 group cursor-pointer ${isCurrent ? 'bg-[#282828]' : 'border-transparent'}`}>
                                <div className="relative mb-4">
                                    <div className="aspect-square bg-[#333] shadow-[0_8px_24px_rgba(0,0,0,0.5)] rounded-md overflow-hidden">
                                        {track.album_art_path ? (
                                            <img src={`http://localhost:8000/${track.album_art_path}`} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-500"><FaMusic size={40}/></div>
                                        )}
                                    </div>
                                    <button 
                                        onClick={(e) => handlePlayCard(e, track)}
                                        className={`absolute bottom-2 right-2 w-12 h-12 bg-[#1ed760] rounded-full flex items-center justify-center shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer ${isCurrent || isPlayingTrack ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0'}`}
                                    >
                                        {isPlayingTrack ? <FaPause size={20} className="text-black" /> : <FaPlay size={20} className="text-black ml-1" />}
                                    </button>
                                </div>
                                <h3 className={`font-bold mb-1 truncate ${isCurrent ? 'text-green-400' : 'text-white'}`}>{track.title}</h3>
                                <p className="text-sm text-[#b3b3b3] line-clamp-2 hover:underline hover:text-white" onClick={(e) => e.stopPropagation()}>
                                    <Link to={`/artist/${track.artist_id}`}>{track.artist}</Link>
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Section: Popular Artists */}
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-4 hover:underline cursor-pointer">Popular Artists</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    {artists.map(item => (
                        <Link to={`/artist/${item.artist_id}`} key={item.artist_id} className="bg-[#181818] p-4 rounded-md hover:bg-[#282828] transition-colors group cursor-pointer">
                            <div className="aspect-square bg-[#333] shadow-[0_8px_24px_rgba(0,0,0,0.5)] rounded-full overflow-hidden mb-4">
                                {/* Placeholder for artist image if we don't have one on track object easily */}
                                <div className="w-full h-full flex items-center justify-center bg-[#333] text-gray-500">
                                    <FaMusic size={40} />
                                </div>
                            </div>
                            <h3 className="font-bold text-white mb-1 truncate">{item.artist}</h3>
                            <p className="text-sm text-[#b3b3b3]">Artist</p>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Home;