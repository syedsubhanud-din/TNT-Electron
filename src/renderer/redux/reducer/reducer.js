import { combineReducers } from "redux";
import { persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";
import authReducer from "./auth-reducer/auth-reducer";

const persistConfig = {
    key:'root',
    storage: storage,
    whiteList: ['authStates']
}

// Note: Main root reducer...!
const rootReducer = combineReducers({
    authStates: authReducer,
})

export default persistReducer(persistConfig, rootReducer)
