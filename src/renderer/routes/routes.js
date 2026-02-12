import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AuthRoutes from './AuthRoutes/AuthRoutes';
import UnAuthRoutes from './UnAuthRoutes/UnAuthRoutes';
// import { useSelector } from 'react-redux';

export default function AppRoutes() {

  // const { authenticatedUser } = useSelector(({ authStates }) => authStates);
  const [authenticatedUser, setAuthenticatedUser] = useState(null);

  useEffect(() => {
    // Check localStorage for authenticated user
    const storedUser = localStorage.getItem('authenticatedUser');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setAuthenticatedUser(userData);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('authenticatedUser');
      }
    }
  }, []);

    return (
        <>
          {authenticatedUser != null ? ( // Check if authuserdetail is true
                <UnAuthRoutes /> // Render UnAuthRoutes if true
          ) : (
                <AuthRoutes /> // Render AuthRoutes if false
          )}
        </>
    )
}
