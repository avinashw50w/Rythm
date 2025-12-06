import React, { useState } from 'react';
import client from '../api/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';

const Login = () => {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleGoogleSuccess = async (credentialResponse) => {
        setLoading(true);
        try {
            const res = await client.post('/auth/google', { token: credentialResponse.credential });
            login(res.data.user, res.data.access_token, res.data.refresh_token);
            navigate('/');
        } catch (error) {
            console.error('Login failed:', error);
            alert('Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleError = () => {
        console.error('Google Login Failed');
        alert('Google Login Failed');
    };

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
            {/* Background Gradient Blob */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-600 rounded-full blur-[150px] opacity-20"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600 rounded-full blur-[150px] opacity-20"></div>

            <div className="z-10 bg-[#121212] p-10 rounded-xl shadow-2xl w-full max-w-md border border-[#282828] text-center">
                <div className="flex justify-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-3xl font-black shadow-lg">
                        R
                    </div>
                </div>

                <h1 className="text-4xl font-black text-white mb-2 tracking-tighter">Rythm</h1>
                <p className="text-gray-400 mb-8">Music for everyone.</p>

                <div className="flex justify-center w-full">
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={handleGoogleError}
                        theme="filled_black"
                        shape="pill"
                        size="large"
                        width="300"
                    />
                </div>

                <div className="mt-8 pt-8 border-t border-[#282828]">
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">No account needed</p>
                    <p className="mt-4 text-gray-400 text-sm">Sign in with Google to create an account automatically.</p>
                </div>
            </div>

            <footer className="absolute bottom-6 text-xs text-gray-600">
                &copy; 2024 Rythm. All rights reserved.
            </footer>
        </div>
    );
};

export default Login;
