import React, { useState, useCallback } from 'react';
import client from '../api/client';
import { FaCloudUploadAlt, FaMusic } from 'react-icons/fa';
import { useDropzone } from 'react-dropzone';

const Upload = () => {
    const [files, setFiles] = useState([]);
    const [albumName, setAlbumName] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [message, setMessage] = useState('');

    const onDrop = useCallback(acceptedFiles => {
        setFiles(prev => [...prev, ...acceptedFiles]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'audio/*': ['.mp3', '.wav', '.flac', '.m4a']
        },
        multiple: true
    });

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        if (files.length === 0) return;

        setUploading(true);
        setMessage('');
        setUploadProgress(0);

        // Upload files one by one (or in parallel) to track individual progress? 
        // For simplicity and album grouping, we can perhaps send them all? 
        // Backend expects single file per request usually for simple /tracks/ endpoint.
        // Let's loop and upload.

        // Calculate total size for progress
        const totalSize = files.reduce((acc, file) => acc + file.size, 0);
        let uploadedSize = 0;

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const formData = new FormData();
                formData.append('file', file);
                formData.append('title', file.name.replace(/\.[^/.]+$/, "")); // Use filename as title by default
                if (albumName) {
                    formData.append('album', albumName);
                }
                formData.append('is_public', false); // Default to private

                await client.post('/tracks/', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (progressEvent) => {
                        const currentFileUploaded = progressEvent.loaded;
                        // This specific file's contribution to total progress is tricky if we don't track per-file state accurately in loop
                        // simplified: just average it or increment.
                        // Better: just distinct progress for current file? Or a global one?
                        // Let's do a simple global estimation:
                        // We can't easily get precise exact global progress without Promise.all and intricate listeners.
                        // Let's just step progress by file count for now? Or use the loaded bytes for the current file + previous files total size

                        const percentCompleted = Math.round(((uploadedSize + currentFileUploaded) * 100) / totalSize);
                        setUploadProgress(percentCompleted);
                    }
                });
                uploadedSize += file.size;
            }

            setMessage(`Successfully uploaded ${files.length} tracks!`);
            setFiles([]);
            setAlbumName('');
            setUploadProgress(100);
        } catch (error) {
            console.error('Upload failed:', error);
            setMessage('Upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 pb-32">
            <div className="bg-[#181818] p-10 rounded-xl shadow-2xl w-full max-w-3xl text-center border border-[#282828]">
                <h2 className="text-3xl font-black mb-2 text-white tracking-tight">Upload Music</h2>
                <p className="text-gray-400 mb-8">Drag & drop tracks or albums to your library.</p>

                <div className="mb-6 text-left">
                    <label className="block text-gray-400 text-sm font-bold mb-2">Album Name (Optional)</label>
                    <input
                        type="text"
                        value={albumName}
                        onChange={(e) => setAlbumName(e.target.value)}
                        placeholder="Enter album name to group tracks..."
                        className="w-full bg-[#2a2a2a] border border-[#333] text-white rounded p-3 focus:outline-none focus:border-green-500 transition-colors placeholder-gray-600"
                    />
                </div>

                <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-xl p-12 mb-8 transition-colors cursor-pointer flex flex-col items-center justify-center gap-4 ${isDragActive ? 'border-green-500 bg-[#1a2e1a]' : 'border-gray-600 hover:border-gray-400 hover:bg-[#202020]'
                        }`}
                >
                    <input {...getInputProps()} />
                    <FaCloudUploadAlt size={64} className={isDragActive ? "text-green-500" : "text-gray-500"} />
                    {isDragActive ? (
                        <p className="text-green-500 font-bold text-lg">Drop the files here...</p>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-white font-bold text-lg">Drag & drop audio files here</p>
                            <p className="text-gray-500 text-sm">or click to select multiple files</p>
                        </div>
                    )}
                </div>

                {/* File List */}
                {files.length > 0 && (
                    <div className="mb-8 text-left bg-[#202020] rounded-lg p-4 max-h-60 overflow-y-auto">
                        <h3 className="text-white font-bold mb-3 sticky top-0 bg-[#202020] pb-2 border-b border-[#333]">Selected Files ({files.length})</h3>
                        <div className="space-y-2">
                            {files.map((file, index) => (
                                <div key={index} className="flex items-center justify-between text-sm bg-[#2a2a2a] p-2 rounded">
                                    <div className="flex items-center gap-3 truncate">
                                        <FaMusic className="text-gray-500 flex-shrink-0" />
                                        <span className="text-gray-300 truncate">{file.name}</span>
                                        <span className="text-gray-600 text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                    </div>
                                    <button
                                        onClick={() => removeFile(index)}
                                        className="text-gray-500 hover:text-red-500 px-2"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Progress Bar */}
                {uploading && (
                    <div className="mb-6">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>Uploading...</span>
                            <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-[#333] rounded-full h-2.5">
                            <div
                                className="bg-green-500 h-2.5 rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${uploadProgress}%` }}
                            ></div>
                        </div>
                    </div>
                )}

                <div className="flex justify-center">
                    <button
                        onClick={handleUpload}
                        disabled={files.length === 0 || uploading}
                        className={`bg-green-500 text-black font-bold py-3 px-8 rounded-full hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 min-w-[200px] shadow-lg shadow-green-900/20`}
                    >
                        {uploading ? 'Uploading...' : `Upload ${files.length > 0 ? files.length : ''} Tracks`}
                    </button>
                </div>

                {message && (
                    <div className={`mt-6 p-3 rounded-md font-medium ${message.includes('failed') ? 'bg-red-900/20 text-red-500' : 'bg-green-900/20 text-green-500'}`}>
                        {message}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Upload;
