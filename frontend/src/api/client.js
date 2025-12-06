import axios from 'axios';

const API_URL = 'http://localhost:8000';

const client = axios.create({
    baseURL: API_URL,
});

// Add a request interceptor to add the auth token
client.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add a response interceptor to handle token refresh
client.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // If error is 401 and we haven't tried to refresh yet
        if (error.response.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem('refresh_token');
                if (!refreshToken) {
                    throw new Error('No refresh token');
                }

                const res = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refreshToken });

                if (res.status === 200) {
                    const { access_token } = res.data;
                    localStorage.setItem('token', access_token);

                    // Update header for original request
                    originalRequest.headers.Authorization = `Bearer ${access_token}`;

                    // Update client defaults
                    client.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

                    return client(originalRequest);
                }
            } catch (refreshError) {
                console.error('Token refresh failed:', refreshError);
                // Clear auth and redirect to login
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('refresh_token');
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

export default client;
