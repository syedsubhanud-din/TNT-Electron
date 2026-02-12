import './App.css';
import AppRoutes from './routes/routes';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { persistor, store } from './redux/store';
import { Toaster } from 'react-hot-toast';

export default function App() {

  return (
    <>
     <Toaster
        position="top-center"
        reverseOrder={true}
      />
      <Provider store={store}>
        <PersistGate persistor={persistor}>
          <AppRoutes/>
        </PersistGate>
      </Provider>
    </>
  );
}
