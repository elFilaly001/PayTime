import axios from "axios";

export const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_BACK_APP_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Create a separate instance for token refresh to avoid infinite loops
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

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
// Queue of requests to retry after token refresh
let refreshSubscribers = [];

// Function to retry failed requests after token refresh
const onRefreshed = (newToken) => {
    refreshSubscribers.forEach(callback => callback(newToken));
    refreshSubscribers = [];
};

// Function to add callbacks to the queue
const addSubscriber = (callback) => {
    refreshSubscribers.push(callback);
};

axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If the error is not 401 or the request has already been retried, reject immediately
        if (error.response?.status !== 401 || originalRequest._retry) {
            return Promise.reject(error);
        }

        // Mark this request as retried to prevent infinite loops
        originalRequest._retry = true;

        // If currently refreshing, add this request to the queue
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
                // If queued request fails, redirect to login
                window.location.href = '/login';
                return Promise.reject(err);
            }
        }

        // Start refreshing process
        isRefreshing = true;

        try {
            // Use a separate instance to avoid interceptor loop
            const response = await refreshInstance.get('/auth/refresh');
            const newToken = response.data.Access;
            
            localStorage.setItem('accessToken', newToken);
            
            // Update original request authorization
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            
            // Process queued requests
            onRefreshed(newToken);
            
            // Reset refreshing flag
            isRefreshing = false;
            
            // Retry the original request
            return axiosInstance(originalRequest);
        } catch (refreshError) {
            // Reset refreshing flag
            isRefreshing = false;
            
            // Clear tokens on refresh failure
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            
            // Notify all pending requests of the failure
            refreshSubscribers = [];
            
            // Redirect to login page
            window.location.href = '/login';
            return Promise.reject(refreshError);
        }
    }
);
