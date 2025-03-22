import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { axiosInstance } from '../../service/axiosInstence';

// Define types for our state
interface PaymentMethod {
  id: string;
  stripeCustomerId: string;
  stripePaymentMethodId: string;
  holderName: string;
  last4: string;
  cardBrand: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

interface PaymentState {
  defaultCard: PaymentMethod | null;
  isLoading: boolean;
  error: string | null;
  // Adding back these fields for compatibility with persisted state
  paymentMethods: PaymentMethod[];
  currentPaymentMethod: PaymentMethod | null;
}

// Initial state
const initialState: PaymentState = {
  defaultCard: null,
  isLoading: false,
  error: null,
  // Initialize compatibility fields
  paymentMethods: [],
  currentPaymentMethod: null
};

// Create async thunks for API calls
export const fetchDefaultCard = createAsyncThunk(
  'payment/fetchDefaultCard',
  async (customerId: string, { rejectWithValue }) => {
    try {
      // Let's check if there's a different API endpoint for default cards
      // Correcting the API endpoint based on the 404 error
      const response = await axiosInstance.get(`/payment/Cards/${customerId}`);
      console.log("All cards response:", response.data);
      
      // Find the default card in the response
      const defaultCard = response.data.find((card: any) => card.isDefault === true);
      console.log("Found default card:", defaultCard);
      
      if (!defaultCard) {
        console.log("No default card found");
        return null;
      }
      
      return defaultCard;
    } catch (error: any) {
      console.error("Error fetching default card:", error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to fetch default card');
    }
  }
);

export const setDefaultCard = createAsyncThunk(
  'payment/setDefaultCard',
  async ({ customerId, paymentMethodId }: { customerId: string, paymentMethodId: string }, { rejectWithValue }) => {
    try {
      // Make sure we're using the correct API endpoint
      const response = await axiosInstance.put(`/payment/default/${customerId}/${paymentMethodId}`);
      console.log("Set default card response:", response.data);
      return response.data;
    } catch (error: any) {
      console.error("Error setting default card:", error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to set default card');
    }
  }
);

// Create the slice
const paymentSlice = createSlice({
  name: 'payment',
  initialState,
  reducers: {
    clearPaymentError: (state) => {
      state.error = null;
    },
    resetPaymentState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // Handle fetchDefaultCard
      .addCase(fetchDefaultCard.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDefaultCard.fulfilled, (state, action) => {
        state.isLoading = false;
        state.defaultCard = action.payload;
      })
      .addCase(fetchDefaultCard.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Handle setDefaultCard
      .addCase(setDefaultCard.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(setDefaultCard.fulfilled, (state, action) => {
        state.isLoading = false;
        state.defaultCard = action.payload;
      })
      .addCase(setDefaultCard.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

// Export actions and reducer
export const { clearPaymentError, resetPaymentState } = paymentSlice.actions;

export default paymentSlice.reducer;
