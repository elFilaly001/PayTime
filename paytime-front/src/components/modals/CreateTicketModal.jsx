import React, { useState, useEffect } from 'react';

const CreateTicketModal = ({ isOpen, onClose, onSubmit, Friend_list = [] }) => {
  // Create initial state with default values
  const initialTicketState = { 
    Type: "CASH", 
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 7 days from now
  };
  
  const [ticketData, setTicketData] = useState(initialTicketState);
  const [loadedFriends, setLoadedFriends] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);


  useEffect(() => {
    if (Friend_list && Array.isArray(Friend_list)) {
      setLoadedFriends(Friend_list);
      console.log('Friends loaded:', Friend_list);
    } else {
      console.log('Friend_list is not an array:', Friend_list);
    }
  }, [Friend_list]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTicketData(prev => ({
      ...prev,
      [name]: name === 'amount' ? parseFloat(value) : value
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!ticketData.loaner || !ticketData.amount) {
      alert('Please fill in all required fields');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await onSubmit(ticketData);
      
      // Reset to initial state instead of empty object
      setTicketData(initialTicketState);
    } catch (error) {
      console.error('Error submitting ticket:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl p-6 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          disabled={isSubmitting}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <h2 className="text-xl font-bold mb-6">Create New Ticket</h2>
        
        <form onSubmit={handleSubmit}>
          {/* Friend Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Friend</label>
            <select
              name="loaner"
              value={ticketData.loaner || ''}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={isSubmitting}
            >
              <option value="">Select a friend</option>
              {loadedFriends.length > 0 ? (
                loadedFriends.map((friend) => (
                  <option key={friend._id} value={friend._id}>
                    {friend.Username}
                  </option>
                ))
              ) : (
                <option disabled value="">No friends available</option>
              )}
            </select>
            <div className="text-xs text-gray-500 mt-1">
              {loadedFriends.length > 0 ? 
                `${loadedFriends.length} friend(s) available` : 
                "No friends loaded. Please check your data."}
            </div>
          </div>
          
          {/* Amount */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                name="amount"
                value={ticketData.amount || ''}
                onChange={handleChange}
                placeholder="0.00"
                className="w-full p-2 pl-7 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                min="0.01"
                step="0.01"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>
          
          {/* Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              name="Type"
              value={ticketData.Type || ''}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="CASH" >Cash payment</option>
              <option value="MANUAL_CARD">Manual card payment</option>
              <option value="AUTO_CARD">Automatic payment</option>
            </select>
          </div>
          
          {/* Place */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Place</label>
            <input
              type="text"
              name="Place"
              value={ticketData.Place || ''}
              onChange={handleChange}
              placeholder="e.g. Starbucks"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {/* Due Date */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date and Time</label>
            <input
              type="datetime-local"
              name="dueDate"
              value={ticketData.dueDate ? ticketData.dueDate.slice(0, 16) : ''}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 transition-colors"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Ticket'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateTicketModal;