// JWT Context
import axios from 'axios';
import { createContext, useState } from 'react';
import jwt_decode from 'jwt-decode';
import { useLocation, useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        if (localStorage.getItem('tokens')) {
            let tokens = JSON.parse(localStorage.getItem('tokens'));
            return jwt_decode(tokens.access_token);
        }
        return null;
    });
    const [username, setUsername] = useState(() => localStorage.getItem('username') || null);

    const navigate = useNavigate();
    const location = useLocation();

    const login = async (payload) => {
        payload.refresh = true;
        payload.provider = 'db';
        const apiResponse = await axios.post('http://localhost:5000/api/v1/security/login', payload);
        localStorage.setItem('tokens', JSON.stringify(apiResponse.data));
        localStorage.setItem('username', payload.username);
        setUser(jwt_decode(apiResponse.data.access_token));
        setUsername(payload.username);
        const from = location?.state?.from || '/';
        navigate(from, { replace: true });
    };

    const logout = async () => {
        localStorage.removeItem('tokens');
        localStorage.removeItem('username');
        setUser(null);
        setUsername(null);
        navigate('/');
    };
    return <AuthContext.Provider value={{ user, username, login, logout }}>{children}</AuthContext.Provider>;
};

export default AuthContext;
