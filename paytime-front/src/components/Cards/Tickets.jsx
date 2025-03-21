import React from 'react';
import { useSelector } from 'react-redux';
import PropTypes from 'prop-types';

const Tickets = ({ ticket, onSubmit }) => {
  const user = useSelector((state) => state.user);

  // Determine status styling
  const getStatusStyles = (status) => {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-100 text-amber-800';
      case 'PAID':
        return 'bg-green-100 text-green-800';
      case 'OVERDUE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Determine transaction message based on current user
  const getTransactionMessage = () => {
    if (user && ticket) {
      if (user._id === ticket.loaner) {
        return `You should receive from ${ticket.loaneeName || 'Unknown'}`;
      } else if (user._id === ticket.loanee) {
        return `You should pay ${ticket.loanerName || 'Unknown'}`;
      }
    }
    return "Transaction details unavailable";
  };

  // Format date nicely
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Add this updated renderActionButtons function
  const renderActionButtons = () => {
    // First check if user is the loanee (the person who needs to pay)
    const isLoanee = user && ticket && user._id === ticket.loanee;

    // If user is not the loanee, they don't need to see payment buttons
    if (!isLoanee) {
      if (ticket.status === 'PAYED') {
        return (
          <div className="w-full mt-4 px-3 py-2 bg-green-100 text-green-800 rounded-md text-sm text-center">
            Payment Completed
          </div>
        );
      } else {
        return (
          <div className="w-full mt-4 px-3 py-2 bg-gray-100 text-gray-800 rounded-md text-sm text-center">
            Awaiting Payment
          </div>
        );
      }
    }

    // For the loanee (person who needs to pay)
    if (ticket.status === 'PAYED') {
      return (
        <div className="w-full mt-4 px-3 py-2 bg-green-100 text-green-800 rounded-md text-sm text-center">
          Payment Completed
        </div>
      );
    }

    if (ticket.status === 'PENDING' || ticket.status === 'OVERDUE') {
      const handleCashClick = () => {
        console.log(`Initiating CASH payment for ticket: ${ticket._id}`);
        onSubmit(ticket._id, 'CASH');
      };

      const handleCardClick = () => {
        console.log(`Initiating CARD payment for ticket: ${ticket._id}`);
        onSubmit(ticket._id, 'CARD');
      };

      // Check ticket type to determine payment options
      if (ticket.Type === 'CASH') {
        return (
          <div className="mt-4">
            <button
              onClick={handleCashClick}
              className="w-full py-2 bg-green-500 text-white rounded-md text-sm hover:bg-green-600 transition-colors font-medium"
            >
              Pay with Cash
            </button>
          </div>
        );
      } else if (ticket.Type === 'MANUAL_CARD') {
        return (
          <div className="mt-4">
            <button
              onClick={handleCardClick}
              className="w-full py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors font-medium"
            >
              Pay with Card
            </button>
          </div>
        );
      } else {
        // If ticket type is something else or unspecified, show both options
        return (
          <div className="flex flex-col gap-2 mt-4">
            <button
              onClick={handleCardClick}
              className="w-full py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors font-medium"
            >
              Pay with Card
            </button>
            <button
              onClick={handleCashClick}
              className="w-full py-2 bg-green-500 text-white rounded-md text-sm hover:bg-green-600 transition-colors font-medium"
            >
              Pay with Cash
            </button>
          </div>
        );
      }
    }

    return null;
  };

  // Handle missing ticket data
  if (!ticket) {
    return (
      <div className="bg-white rounded-xl w-full max-w-[300px] shadow-md overflow-hidden border border-gray-100 p-5">
        <p className="text-center text-gray-500">Ticket information unavailable</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl w-full max-w-[300px] shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 border border-gray-100">
      <div className="p-5">
        {/* Header with type and status */}
        <div className="flex justify-between items-center mb-4">
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
            {ticket.Type || 'N/A'}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyles(ticket.status)}`}>
            {ticket.status || 'N/A'}
          </span>
        </div>

        {/* Simplified transaction message */}
        <div className="mb-4">
          <div className="text-center py-3">
            <p className="font-medium text-gray-800">{getTransactionMessage()}</p>
          </div>

          <div className="flex justify-center">
            <div className="text-center py-2 px-4 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-500">Amount</span>
              <p className="text-2xl font-bold text-gray-800">${ticket.amount || 0}</p>
            </div>
          </div>
        </div>

        {/* Footer with date and location */}
        <div className="pt-3 border-t border-gray-100 text-sm text-gray-600 flex justify-between">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{formatDate(ticket.createdAt)}</span>
          </div>
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{ticket.Place || 'N/A'}</span>
          </div>
        </div>

        {renderActionButtons()}
      </div>
    </div>
  );
};

Tickets.propTypes = {
  ticket: PropTypes.shape({
    _id: PropTypes.string,
    Type: PropTypes.string,
    status: PropTypes.string,
    amount: PropTypes.number,
    loaner: PropTypes.string,
    loanee: PropTypes.string,
    loanerName: PropTypes.string,
    loaneeName: PropTypes.string,
    createdAt: PropTypes.string,
    Place: PropTypes.string
  }),
  onSubmit: PropTypes.func.isRequired
};

export default Tickets;
