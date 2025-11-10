// action - state management
import * as actionTypes from './actions';

export const initialState = {
    instance: null // for selected instance (object)
};

// ==============================|| CUSTOMIZATION REDUCER ||============================== //

const isntanceReducer = (state = initialState, action) => {
    switch (action.type) {
        case actionTypes.SET_INSTANCE:
            return {
                ...state,
                instance: action.instance
            };
        default:
            return state;
    }
};

export default isntanceReducer;
