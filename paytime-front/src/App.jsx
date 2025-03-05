import Router from './router/Router'
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Provider } from "react-redux";
import { PersistGate } from 'redux-persist/integration/react';
import store , { persistor } from './store/store';



const stripePromise = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

function App() {

  
  return (

    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <Elements stripe={stripePromise}>
          <Router />
        </Elements>
      </PersistGate>
    </Provider>
/*************  ✨ Codeium Command ⭐  *************/
    // Handles WebSocket errors, e.g. network connection errors
    // or unsupported protocols. Logs the error to the console.
/******  b43b3e6f-7dee-4389-a1e0-10f082565072  *******/  )
}

export default App
