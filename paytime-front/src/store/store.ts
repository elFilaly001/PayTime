import { configureStore } from "@reduxjs/toolkit";
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import userReducer from "./Slices/UserSlice";
import paymentReducer from "./Slices/PaymentSlice";

const persistConfig = {
  key: 'root',
  storage,
  version: 1, // Add version number to track schema changes
};

// Separate config for payment to handle migrations
const paymentPersistConfig = {
  key: 'payment',
  storage,
  version: 1,
  // Migration to handle data structure changes
  migrate: (state) => {
    // If we have old state format, transform it
    console.log("Migrating payment state:", state);
    if (state) {
      // Make sure we have the new structure
      return {
        ...state,
        defaultCard: state.defaultCard || null,
        isLoading: false,
        error: null,
      };
    }
    return state;
  }
};

const persistedUserReducer = persistReducer(persistConfig, userReducer);
const persistedPaymentReducer = persistReducer(paymentPersistConfig, paymentReducer);

const store = configureStore({
  reducer: {
    user: persistedUserReducer,
    payment: persistedPaymentReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const persistor = persistStore(store);

export default store;