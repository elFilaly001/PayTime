import axios from "axios";

export const axiosInstance = axios.create({
    baseURL: "http://172.27.160.1:3000",
    headers: {
        "Content-Type": "application/json"
    }
});


// axiosInstance.interceptors.request.use(config => {
//     const token = localStorage.getItem("token");
//     if (token) {
//         config.headers.Authorization = `Bearer ${token}`;
//     }
//     return config;
// });
