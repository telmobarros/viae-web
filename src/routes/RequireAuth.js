import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const RequireAuth = ({ children }) => {
    const location = useLocation();
    const tokensStr = localStorage.getItem('tokens');

    if (!tokensStr) {
        return <Navigate to={`/pages/login/login3`} replace state={{ from: location.pathname + location.search }} />;
    }

    return children;
};

export default RequireAuth;
