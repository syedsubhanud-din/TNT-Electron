import axios from "axios";
import {
  LOG_IN_USER,
  LOGOUT,
  USERS_LIST
} from "../../reducer/auth-reducer/auth-reducer";
import instance from "../../../libraries-configuration/axios-config/axios-config";
import apiCallMethods from "../../../libraries-configuration/api-methods/api-methods";


let endPoints = {
  login: "/auth/login",
};

// Note: Action function...!
const loginUser = (formData, resHandler) => {
  return async (dispatch) => {
    try {
      let response = await instance({
        method: apiCallMethods.POST,
        url: endPoints.login,
        data: formData,
      });

      console.log("Login data:", response);
      let { status, data } = response;

      if (status === 200) {
          resHandler(response);
          dispatch({
            type: LOG_IN_USER,
            payload: data,
          });
      }
    } catch (error) {
      resHandler(error?.response?.data);
      console.log(error);
    } finally {
    
    }
  };
};






export {
    loginUser,
}
