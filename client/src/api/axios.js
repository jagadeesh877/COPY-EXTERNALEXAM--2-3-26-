import axios from 'axios';

const API_BASE_URL = `http://${window.location.hostname}:3000/api`;

const api = axios.create({
    baseURL: API_BASE_URL,
});

// Add a request interceptor to add the JWT token to every request
api.interceptors.request.use(
    (config) => {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user && user.accessToken) {
            config.headers['Authorization'] = `Bearer ${user.accessToken}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;
