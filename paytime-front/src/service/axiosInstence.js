import axios from "axios";

export const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_BACK_APP_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    }
});

const refreshInstance = axios.create({
    baseURL: import.meta.env.VITE_BACK_APP_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    }
});

axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

let isRefreshing = false;
let refreshSubscribers = [];

const onRefreshed = (newToken) => {
    refreshSubscribers.forEach(callback => callback(newToken));
    refreshSubscribers = [];
};

const addSubscriber = (callback) => {
    refreshSubscribers.push(callback);
};

axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status !== 401 || originalRequest._retry) {
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        if (isRefreshing) {
            try {
                const newToken = await new Promise((resolve, reject) => {
                    addSubscriber((token) => {
                        resolve(token);
                    });
                });
                
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return axiosInstance(originalRequest);
            } catch (err) {
                window.location.href = '/login';
                return Promise.reject(err);
            }
        }

        isRefreshing = true;

        try {
            // Get both refresh token from localStorage (if exists) and cookie (via withCredentials)
            const storedRefreshToken = localStorage.getItem('refreshToken');
            const config = {};
            
            if (storedRefreshToken) {
                // If we have a refresh token in localStorage, send it in Authorization header
                config.headers = {
                    'Authorization': `Refresh ${storedRefreshToken}`
                };
            }
            
            const response = await refreshInstance.get('/auth/refresh', config);
            const newToken = response.data.Access;
            
            // If we received a refresh token in the response, store it
            if (response.data.refreshToken) {
                localStorage.setItem('refreshToken', response.data.refreshToken);
            }
            
            localStorage.setItem('accessToken', newToken);
            
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            
            onRefreshed(newToken);
            
            isRefreshing = false;
            
            // Retry the original request
            return axiosInstance(originalRequest);
        } catch (refreshError) {
            isRefreshing = false;
            localStorage.removeItem('accessToken');
            refreshSubscribers = [];
            window.location.href = '/login';
            return Promise.reject(refreshError);
        }
    }
);
