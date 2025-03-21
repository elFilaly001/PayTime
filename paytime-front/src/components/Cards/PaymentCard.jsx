import React from 'react';
import { Check, Trash, CreditCard, X, ChevronDown } from 'lucide-react';

const PaymentCard = ({ card, onDelete, onSetDefault, isDefaultFromStore }) => {
    // Check both local and store default status
    const isDefault = card.isDefault || isDefaultFromStore;
    
    const cardTypeColor = {
      "visa": "bg-gradient-to-r from-blue-500 to-blue-700",
      "mastercard": "bg-gradient-to-r from-red-500 to-yellow-500",
      "amex": "bg-gradient-to-r from-indigo-500 to-indigo-700",
      "discover": "bg-gradient-to-r from-orange-500 to-orange-700"
    };
    
    const getCardLogo = (type) => {
      if (type === "visa") return "VISA";
      if (type === "mastercard") return "MasterCard";
      if (type === "amex") return "AMEX";
      if (type === "discover") return "Discover";
      return "Card";
    };
  
    const formatCardNumber = (number) => {
      return `•••• •••• •••• ${number}`;
    };
  
    return (
      <div className={`relative w-80 h-48 rounded-2xl shadow-lg transition-all duration-300 hover:shadow-2xl overflow-hidden ${cardTypeColor[card.cardBrand] || 'bg-gray-800'} text-white`}> 
        <div className="p-5 h-full flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="font-bold text-xl tracking-wide">{getCardLogo(card.cardBrand)}</span>
            {isDefault && (
              <span className="bg-white bg-opacity-20 text-white text-xs px-3 py-1 rounded-full flex items-center">
                <Check className="w-3 h-3 mr-1" /> Default
              </span>
            )}
          </div>
          <div className="text-lg font-mono tracking-widest">
            {formatCardNumber(card.last4)}
          </div>
          <div className="flex justify-between text-sm">
            <span>{card.holderName}</span>
            <span>{card.expiryMonth}/{card.expiryYear}</span>
          </div>
        </div>
        {!isDefault && (
          <button onClick={() => onDelete(card.id || card._id)} className="absolute top-3 right-3 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full">
            <Trash className="w-4 h-4" />
          </button>
        )}
        {!isDefault && (
          <button onClick={() => onSetDefault(card.id || card._id)} className="absolute bottom-3 right-3 bg-green-500 hover:bg-green-600 text-white p-2 rounded-full text-xs">
            Set as Default
          </button>
        )}
      </div>
    );
  };

  export default PaymentCard;