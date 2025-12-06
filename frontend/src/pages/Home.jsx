import React, { useEffect, useState } from 'react';
import client from '../api/client';
import TrackList from '../components/TrackList';

const Home = ({ onPlay }) => {
    const [tracks, setTracks] = useState([]);
    const [greeting, setGreeting] = useState('Good morning');
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('All'); // All, Artists, Albums

    useEffect(() => {
        const fetchTracks = async () => {
            try {
                const res = await client.get('/tracks/?public_only=true'); // Only fetch public tracks for home
                setTracks(res.data);
            } catch (error) {
                console.error('Error fetching tracks:', error);
            }
        };

        fetchTracks();

        const hour = new Date().getHours();
        if (hour >= 12 && hour < 18) setGreeting('Good afternoon');
        else if (hour >= 18) setGreeting('Good evening');
    }, []);

    const filteredTracks = tracks.filter(track => {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
            track.title.toLowerCase().includes(query) ||
            track.artist.toLowerCase().includes(query) ||
            (track.album && track.album.toLowerCase().includes(query));

        if (filter === 'All') return matchesSearch;
        if (filter === 'Artists') return matchesSearch && track.artist.toLowerCase().includes(query);
        if (filter === 'Albums') return matchesSearch && (track.album && track.album.toLowerCase().includes(query));
        return matchesSearch;
    });

    return (
        <div className="bg-gradient-to-b from-[#202020] to-[#121212] min-h-full p-8 pb-32">
            {/* Greeting & Search */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-white">{greeting}</h1>
                <div className="relative w-full md:w-96">
                    <input
                        type="text"
                        placeholder="What do you want to play?"
                        className="w-full bg-[#333] text-white rounded-full py-3 px-10 focus:outline-none focus:ring-2 focus:ring-white placeholder-gray-400"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <svg className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-8">
                {['All', 'Artists', 'Albums'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-1 rounded-full text-sm font-bold transition-colors ${filter === f ? 'bg-white text-black' : 'bg-[#333] text-white hover:bg-[#444]'}`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Recent/Featured Grid (Placeholder for now, using tracks as "cards" for demo) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                {filteredTracks.slice(0, 6).map(track => (
                    <div
                        key={track.id}
                        className="bg-[#2a2a2a] hover:bg-[#3a3a3a] transition-colors rounded-md overflow-hidden flex items-center gap-4 pr-4 cursor-pointer group"
                        onClick={() => onPlay(track)}
                    >
                        <div className="w-20 h-20 bg-[#333] flex-shrink-0 shadow-lg">
                            {track.album_art_path ? (
                                <img src={`http://localhost:8000/${track.album_art_path}`} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold text-xl">♪</div>
                            )}
                        </div>
                        <span className="font-bold text-white truncate">{track.title}</span>
                        <div className="ml-auto bg-green-500 rounded-full p-3 shadow-lg opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all">
                            <svg role="img" height="16" width="16" aria-hidden="true" viewBox="0 0 16 16" fill="black"><path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z"></path></svg>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Track List */}
            <h2 className="text-2xl font-bold mb-4 text-white">Made For You</h2>
            <TrackList tracks={filteredTracks} onPlay={onPlay} />
        </div>
    );
};

export default Home;
