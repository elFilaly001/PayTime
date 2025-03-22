import React, { useState } from 'react';
import { CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';

const CardForm = ({ closeModal, onSubmit }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [cardholderName, setCardholderName] = useState('');
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Custom styling for Stripe elements
  const stripeElementStyle = {
    base: {
      fontSize: '16px',
      color: '#1F2937', // Tailwind gray-800
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      '::placeholder': {
        color: '#9CA3AF', // Tailwind gray-400
      },
    },
    invalid: {
      color: '#EF4444', // Tailwind red-500
      iconColor: '#EF4444', // Tailwind red-500
    },
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      // Stripe.js has not loaded yet
      return;
    }
    
    setProcessing(true);
    
    // Create a payment method using the card elements
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: elements.getElement(CardNumberElement),
      billing_details: {
        name: cardholderName,
      },
    });
    
    if (error) {
      setError(error.message);
      setProcessing(false);
    } else {
      // Pass the payment method to your parent component
      onSubmit(paymentMethod);
      setProcessing(false);
      closeModal();
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h3 className="text-lg font-semibold">Add New Card</h3>
        
        <form onSubmit={handleSubmit} className="mt-4">
          <div className="space-y-4">
            {/* Cardholder Name Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cardholder Name</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={cardholderName}
                onChange={(e) => setCardholderName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>
            
            {/* Card Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
              <div className="px-3 py-2 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                <CardNumberElement options={{ style: stripeElementStyle }} />
              </div>
            </div>
            
            {/* Card Details in a grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
                <div className="px-3 py-2 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                  <CardExpiryElement options={{ style: stripeElementStyle }} />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CVC</label>
                <div className="px-3 py-2 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                  <CardCvcElement options={{ style: stripeElementStyle }} />
                </div>
              </div>
            </div>
            
            {/* Error message display */}
            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}
          </div>
          
          {/* Form buttons */}
          <div className="flex justify-end mt-4 space-x-3">
            <button
              type="button"
              onClick={closeModal}
              className="text-gray-600 hover:text-gray-900 px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!stripe || processing}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Processing...' : 'Add Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CardForm;