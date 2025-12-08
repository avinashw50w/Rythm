import React, { useState } from 'react';
import client from '../api/client';
import { useNavigate } from 'react-router-dom';
import { FaMusic } from 'react-icons/fa';
import { useUI } from '../context/UIContext';

const CreatePlaylist = () => {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { showToast } = useUI();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name) return;

        setLoading(true);
        try {
            const res = await client.post(`/playlists/?name=${encodeURIComponent(name)}&is_public=false`);
            
            // Dispatch event to refresh sidebar
            window.dispatchEvent(new Event('playlist-updated'));
            
            showToast('Playlist created successfully!', 'success');
            navigate(`/playlist/${res.data.id}`);
        } catch (error) {
            console.error('Error creating playlist:', error);
            showToast('Failed to create playlist. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full">
            <div className="bg-[#282828] p-8 rounded-lg shadow-lg w-full max-w-md text-center">
                <div className="bg-[#333] w-32 h-32 mx-auto rounded-md mb-6 flex items-center justify-center shadow-lg">
                    <FaMusic size={48} className="text-gray-500" />
                </div>
                <h2 className="text-2xl font-bold mb-6">Create Playlist</h2>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <input
                        type="text"
                        placeholder="Playlist Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-[#3e3e3e] text-white p-3 rounded-md border border-transparent focus:border-green-500 focus:outline-none placeholder-gray-500"
                        autoFocus
                    />

                    <button
                        type="submit"
                        disabled={!name || loading}
                        className="bg-green-500 text-black font-bold py-3 px-4 rounded-full hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {loading ? 'Creating...' : 'Create'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreatePlaylist;