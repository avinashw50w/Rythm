import React, { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import TrackList from '../components/TrackList';
import { Link } from 'react-router-dom';
import { FaSearch, FaMusic, FaUser, FaCompactDisc } from 'react-icons/fa';

const Search = ({ onPlay, currentTrack, isPlaying, onTogglePlay }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState({ tracks: [], artists: [], albums: [] });
    const [loading, setLoading] = useState(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.trim()) {
                performSearch();
            } else {
                setResults({ tracks: [], artists: [], albums: [] });
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [query]);

    const performSearch = async () => {
        setLoading(true);
        try {
            const res = await client.get(`/search?q=${encodeURIComponent(query)}`);
            setResults(res.data);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    };

    const hasResults = results.tracks.length > 0 || results.artists.length > 0 || results.albums.length > 0;

    return (
        <div className="text-white p-8 pb-32 max-w-7xl mx-auto min-h-screen">
            {/* Search Input */}
            <div className="sticky top-0 z-20 bg-[#121212] pt-2 pb-6 -mx-8 px-8">
                <div className="relative max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaSearch className="text-gray-500" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-3 rounded-full leading-5 bg-[#242424] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:bg-[#2a2a2a] transition-colors"
                        placeholder="What do you want to play?"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center pt-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
                </div>
            ) : !query ? (
                // Browse All Categories (Static for visual flair)
                <div>
                    <h2 className="text-2xl font-bold mb-6">Browse all</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                        {['Pop', 'Hip-Hop', 'Rock', 'Electronic', 'Indie', 'R&B', 'Jazz', 'Classical', 'Metal', 'Focus'].map((genre, idx) => (
                            <div 
                                key={idx} 
                                className="aspect-square rounded-lg p-4 font-bold text-2xl relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform"
                                style={{ backgroundColor: `hsl(${idx * 35}, 70%, 50%)` }}
                            >
                                {genre}
                                <div className="absolute -bottom-2 -right-4 rotate-[25deg] shadow-lg">
                                    <div className="w-24 h-24 bg-black/20 rounded-md"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : hasResults ? (
                <div className="space-y-10">
                    {/* Top Result (First Artist or First Song) */}
                    {(results.artists.length > 0 || results.tracks.length > 0) && (
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                            <div className="lg:col-span-2">
                                <h2 className="text-2xl font-bold mb-4">Top result</h2>
                                {results.artists.length > 0 ? (
                                    <Link to={`/artist/${results.artists[0].id}`} className="block bg-[#181818] hover:bg-[#282828] p-6 rounded-lg transition-colors group">
                                        <div className="mb-4">
                                            {results.artists[0].image_path ? (
                                                <img src={`http://localhost:8000/${results.artists[0].image_path}`} className="w-24 h-24 rounded-full object-cover shadow-lg" />
                                            ) : (
                                                <div className="w-24 h-24 bg-[#333] rounded-full flex items-center justify-center"><FaUser size={40} /></div>
                                            )}
                                        </div>
                                        <h3 className="text-3xl font-bold mb-2">{results.artists[0].name}</h3>
                                        <span className="bg-[#121212] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Artist</span>
                                    </Link>
                                ) : (
                                    <div className="bg-[#181818] hover:bg-[#282828] p-6 rounded-lg transition-colors group cursor-pointer" onClick={() => onPlay(results.tracks[0], results.tracks)}>
                                        <div className="mb-4">
                                            {results.tracks[0].album_art_path ? (
                                                <img src={`http://localhost:8000/${results.tracks[0].album_art_path}`} className="w-24 h-24 rounded-md object-cover shadow-lg" />
                                            ) : (
                                                <div className="w-24 h-24 bg-[#333] rounded-md flex items-center justify-center"><FaMusic size={40} /></div>
                                            )}
                                        </div>
                                        <h3 className="text-3xl font-bold mb-1 line-clamp-1">{results.tracks[0].title}</h3>
                                        <p className="text-gray-400 font-medium mb-4">{results.tracks[0].artist}</p>
                                        <span className="bg-[#121212] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Song</span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="lg:col-span-3">
                                <h2 className="text-2xl font-bold mb-4">Songs</h2>
                                <TrackList 
                                    tracks={results.tracks.slice(0, 4)} 
                                    onPlay={onPlay}
                                    currentTrack={currentTrack}
                                    isPlaying={isPlaying}
                                    onTogglePlay={onTogglePlay}
                                    hideAlbumColumn={true}
                                />
                            </div>
                        </div>
                    )}

                    {/* Artists */}
                    {results.artists.length > 0 && (
                        <div>
                            <h2 className="text-2xl font-bold mb-4">Artists</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                                {results.artists.map(artist => (
                                    <Link to={`/artist/${artist.id}`} key={artist.id} className="bg-[#181818] p-4 rounded-md hover:bg-[#282828] transition-colors group">
                                        <div className="aspect-square mb-4 rounded-full overflow-hidden shadow-lg bg-[#333] flex items-center justify-center">
                                            {artist.image_path ? (
                                                <img src={`http://localhost:8000/${artist.image_path}`} className="w-full h-full object-cover" />
                                            ) : (
                                                <FaUser size={48} className="text-gray-500" />
                                            )}
                                        </div>
                                        <h3 className="font-bold truncate">{artist.name}</h3>
                                        <p className="text-sm text-gray-400">Artist</p>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Albums */}
                    {results.albums.length > 0 && (
                        <div>
                            <h2 className="text-2xl font-bold mb-4">Albums</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                                {results.albums.map(album => (
                                    <Link to={`/album/${album.id}`} key={album.id} className="bg-[#181818] p-4 rounded-md hover:bg-[#282828] transition-colors group">
                                        <div className="aspect-square mb-4 rounded-md overflow-hidden shadow-lg bg-[#333] flex items-center justify-center">
                                            {album.album_art_path ? (
                                                <img src={`http://localhost:8000/${album.album_art_path}`} className="w-full h-full object-cover" />
                                            ) : (
                                                <FaCompactDisc size={48} className="text-gray-500" />
                                            )}
                                        </div>
                                        <h3 className="font-bold truncate">{album.title}</h3>
                                        <p className="text-sm text-gray-400">{album.artist} • Album</p>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center pt-20">
                    <h3 className="text-2xl font-bold mb-2">No results found for "{query}"</h3>
                    <p className="text-gray-400">Please make sure your words are spelled correctly or use less or different keywords.</p>
                </div>
            )}
        </div>
    );
};

export default Search;
