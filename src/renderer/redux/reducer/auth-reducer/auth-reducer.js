import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    authenticatedUser: null,
    userslist: null
}

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        LOG_IN_USER: (state, action) => {
            console.log("action.payload");
            console.log(action.payload);

            state.authenticatedUser = action.payload
        },
        USERS_LIST: (state, action) => {
            console.log("action?.payload");
            console.log(action?.payload);

            state.userslist = action?.payload
        },
        LOGOUT: (state, action) => {
            state.userslist = null;
            state.authenticatedUser = null;
        }
    }
})

export const {
    LOG_IN_USER,
    USERS_LIST,
    LOGOUT,
} = authSlice.actions

export default authSlice.reducer
