import React, { useState } from 'react';
import client from '../api/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { GoogleLogin } from '@react-oauth/google';

const Login = () => {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();
    const { showToast } = useUI();

    const handleGoogleSuccess = async (credentialResponse) => {
        setLoading(true);
        try {
            const res = await client.post('/auth/google', {
                token: credentialResponse.credential
            });
            
            const { access_token, refresh_token, user } = res.data;
            login(user, access_token, refresh_token);
            
            showToast(`Welcome back, ${user.name}!`, 'success');
            navigate('/');
        } catch (error) {
            console.error('Login failed:', error);
            showToast('Login failed. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleFailure = () => {
        showToast('Google Sign In was unsuccessful. Try again later.', 'error');
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
            <div className="w-full max-w-md bg-[#181818] p-8 rounded-xl shadow-2xl border border-[#282828] text-center">
                <div className="mb-8">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <span className="text-black font-black text-3xl">R</span>
                    </div>
                    <h1 className="text-3xl font-bold mb-2 tracking-tight">Log in to Rythm</h1>
                    <p className="text-gray-400">Manage your library and listen seamlessly.</p>
                </div>

                <div className="flex flex-col gap-4">
                    {loading ? (
                        <div className="flex justify-center py-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
                        </div>
                    ) : (
                        <div className="flex justify-center">
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={handleGoogleFailure}
                                theme="filled_black"
                                shape="pill"
                                size="large"
                                width="300"
                            />
                        </div>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-[#282828]">
                    <p className="text-xs text-gray-500">
                        By continuing, you agree to our Terms of Service and Privacy Policy.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;