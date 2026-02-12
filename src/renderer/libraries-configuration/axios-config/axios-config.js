/***** Note: Axios Configuration File *****/

import axios from "axios";
import { useDispatch } from "react-redux";
import { SystemLogout } from "../../redux/actions/auth-action/auth-action";
import { ClearAllUser } from "../../redux/actions/user-action/user-action";
import { Clearallbalancesheet } from "../../redux/actions/balance-sheet-action/balance-sheet-action";

const urls = {
  // hostedUrl: "http://vibe.qbscocloud.net:9000" // STAGING URL
};

// Default config options
const defaultOptions = {
    baseURL: urls.hostedUrl,
    headers: {
        "Content-Type": "application/json",
    }
};

// Create a function to handle dispatch
function handleDispatch() {
  const dispatch = useDispatch();

  dispatch(SystemLogout());
  dispatch(ClearAllUser());
  dispatch(Clearallbalancesheet());
}


// Create axios instance
const instance = axios.create(defaultOptions);

// Set the AUTH token for any request
instance.interceptors.request.use((config) => {
    const fetchToken = localStorage.getItem("AuthToken");
    config.headers.Authorization = fetchToken ? `Bearer ${fetchToken}` : "";
    return config;
});

// Intercept the response to handle token expiration
instance.interceptors.response.use(
    (response) => response,
    async (error) => {
        console.error("Request error:", error);
        const originalRequest = error.config;

        // Handle 401 Unauthorized response
        if (error.response?.status === 401 || (error.response?.status === 403 && !originalRequest._retry)) {
            originalRequest._retry = true;

            // Clear cookies
            document.cookie.split(";").forEach((c) => {
                document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });

            // Clear local storage
            handleDispatch();
            localStorage.clear();
            // window.location.href = '/'

            // Optionally, redirect to login page or any other action

            return Promise.reject(error);
        }
        return Promise.reject(error);
    }
);

export default instance;
