import axios from 'axios';

const authAxios = axios.create({});

authAxios.interceptors.request.use((config) => {
    let tokensData = JSON.parse(localStorage.getItem('tokens'));
    config.headers.common['Authorization'] = `Bearer ${tokensData.access_token}`;
    return config;
});

authAxios.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        if (error.response.status === 401) {
            const authData = JSON.parse(localStorage.getItem('tokens'));
            const payload = {
                access_token: authData.access_token,
                refresh_token: authData.refreshToken
            };

            let apiResponse = await axios.post(
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
            error.config.headers['Authorization'] = `Bearer ${apiResponse.data.access_token}`;
            return axios(error.config);
        } else {
            return Promise.reject(error);
        }
    }
);

export default authAxios;
