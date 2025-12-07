import React from 'react';
import { FaCog } from 'react-icons/fa';

const Settings = () => {
    return (
        <div className="flex flex-col items-center justify-center h-full">
            <div className="bg-[#282828] p-8 rounded-lg shadow-lg w-full max-w-md text-center">
                <FaCog size={64} className="mx-auto mb-6 text-gray-500 animate-spin-slow" />
                <h2 className="text-2xl font-bold mb-4">Settings</h2>
                <p className="text-gray-400 mb-8">Application settings coming soon.</p>

                <div className="text-left space-y-4">
                    <div className="flex justify-between items-center p-3 bg-[#3e3e3e] rounded-lg">
                        <span className="text-white">Dark Mode</span>
                        <span className="text-green-500">On</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-[#3e3e3e] rounded-lg">
                        <span className="text-white">Audio Quality</span>
                        <span className="text-gray-400">High</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-[#3e3e3e] rounded-lg">
                        <span className="text-white">Notifications</span>
                        <span className="text-gray-400">Enabled</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
