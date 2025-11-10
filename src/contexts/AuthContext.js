// JWT Context
import axios from 'axios';
import { createContext, useState } from 'react';
import jwt_decode from 'jwt-decode';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        if (localStorage.getItem('tokens')) {
            let tokens = JSON.parse(localStorage.getItem('tokens'));
            return jwt_decode(tokens.access_token);
        }
        return null;
    });

    const navigate = useNavigate();

    const login = async (payload) => {
        payload.refresh = true;
        payload.provider = 'db';
        const apiResponse = await axios.post('http://localhost:5000/api/v1/security/login', payload);
        localStorage.setItem('tokens', JSON.stringify(apiResponse.data));
        setUser(jwt_decode(apiResponse.data.access_token));
        navigate('/');
    };

    const logout = async () => {
        localStorage.removeItem('tokens');
        setUser(null);
        navigate('/');
    };
    return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
};

export default AuthContext;
