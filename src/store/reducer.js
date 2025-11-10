import { combineReducers } from 'redux';

// reducer import
import customizationReducer from './customizationReducer';
import instanceReducer from './instanceReducer';

// ==============================|| COMBINE REDUCER ||============================== //

const reducer = combineReducers({
    customization: customizationReducer,
    instance: instanceReducer
});

export default reducer;
