import axios from 'axios';

const authAxios = axios.create({});

authAxios.interceptors.request.use(
    (config) => {
        const tokensStr = localStorage.getItem('tokens');
        if (!tokensStr) {
            const from = window.location.pathname + window.location.search;
            window.location.assign(`/pages/login/login3?from=${encodeURIComponent(from)}`);
            return Promise.reject(new Error('Not authenticated'));
        }
        const tokensData = JSON.parse(tokensStr);
        if (!config.headers) config.headers = {};
        if (!config.headers.common) config.headers.common = {};
        config.headers.common['Authorization'] = `Bearer ${tokensData.access_token}`;
        return config;
    },
    (err) => Promise.reject(err)
);

authAxios.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error?.response?.status;
        if (status === 401) {
            try {
                const authDataStr = localStorage.getItem('tokens');
                if (!authDataStr) {
                    const from = window.location.pathname + window.location.search;
                    window.location.assign(`/pages/login/login3?from=${encodeURIComponent(from)}`);
                    return Promise.reject(error);
                }
                const authData = JSON.parse(authDataStr);
                if (!authData?.refresh_token) {
                    localStorage.removeItem('tokens');
                    const from = window.location.pathname + window.location.search;
                    window.location.assign(`/pages/login/login3?from=${encodeURIComponent(from)}`);
                    return Promise.reject(error);
                }
                const apiResponse = await axios.post(
                    'http://localhost:5000/api/v1/security/refresh',
                    {},
                    {
                        headers: {
                            Authorization: `Bearer ${authData.refresh_token}`
                        }
                    }
                );
                authData.access_token = apiResponse.data.access_token;
                localStorage.setItem('tokens', JSON.stringify(authData));
                error.config.headers = error.config.headers || {};
                error.config.headers['Authorization'] = `Bearer ${apiResponse.data.access_token}`;
                return axios(error.config);
            } catch (e) {
                localStorage.removeItem('tokens');
                const from = window.location.pathname + window.location.search;
                window.location.assign(`/pages/login/login3?from=${encodeURIComponent(from)}`);
                return Promise.reject(error);
            }
        }
        return Promise.reject(error);
    }
);

export default authAxios;
