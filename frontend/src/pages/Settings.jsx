import React, { useState } from 'react';
import client from '../api/client';
import { FaFolderOpen } from 'react-icons/fa';

const Settings = () => {
    const [path, setPath] = useState('');
    const [scanning, setScanning] = useState(false);
    const [message, setMessage] = useState('');

    const handleScan = async (e) => {
        e.preventDefault();
        if (!path) return;

        setScanning(true);
        setMessage('');

        try {
            const response = await client.post(`/tracks/scan?directory_path=${encodeURIComponent(path)}`);
            setMessage(response.data.message);
        } catch (error) {
            console.error('Scan failed:', error);
            setMessage('Scan failed. Please check the path and try again.');
        } finally {
            setScanning(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full">
            <div className="bg-[#282828] p-8 rounded-lg shadow-lg w-full max-w-md text-center">
                <FaFolderOpen size={64} className="mx-auto mb-6 text-blue-500" />
                <h2 className="text-2xl font-bold mb-4">Scan Local Directory</h2>
                <p className="text-gray-400 mb-8">Enter the full path to a folder containing audio files.</p>

                <form onSubmit={handleScan} className="flex flex-col gap-4">
                    <input
                        type="text"
                        placeholder="/Users/username/Music"
                        value={path}
                        onChange={(e) => setPath(e.target.value)}
                        className="bg-[#3e3e3e] text-white p-3 rounded-md border border-transparent focus:border-blue-500 focus:outline-none"
                    />

                    <button
                        type="submit"
                        disabled={!path || scanning}
                        className="bg-blue-500 text-white font-bold py-3 px-4 rounded-full hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {scanning ? 'Scanning...' : 'Scan Directory'}
                    </button>
                </form>

                {message && (
                    <div className={`mt-4 ${message.includes('failed') ? 'text-red-500' : 'text-green-500'}`}>
                        {message}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Settings;
