import axios from 'axios';

const api = axios.create({
    baseURL: 'http://172.27.53.175:3000/api',
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
