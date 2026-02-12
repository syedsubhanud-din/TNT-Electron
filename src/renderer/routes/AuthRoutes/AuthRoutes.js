import React from 'react';
import { MemoryRouter as Router,Routes, Route } from 'react-router-dom';
import Login from '../../Views/login/login';

export default function AuthRoutes() {

    return (
        <>
           <Router>
           <Routes>
                <Route path='/' element={<Login />} />

                {/* <Route path='' element={< />} /> */}
            </Routes>
           </Router>
        </>
    )
}
