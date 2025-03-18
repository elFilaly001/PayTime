import { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useSelector } from 'react-redux';

const useTicketSocket = () => {
  const user = useSelector((state) => state.user);
  const [isConnected, setIsConnected] = useState(false);
  const [tokenError, setTokenError] = useState(null);
  const socketRef = useRef(null);

  // Get auth token from localStorage
  const getAuthToken = useCallback(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setTokenError('Authentication token not found');
      return null;
    }
    return token;
  }, []);

  // Initialize socket connection - restored to working version with improvements
  const initializeSocket = useCallback((token) => {
    if (!token || !user?._id) return null;

    const socket = io(`${import.meta.env.VITE_BACK_APP_URL}/tickets`, {
      auth: {
        userId: user._id,
      },
      extraHeaders: {
        authorization: `Bearer ${token}`,
      },
    });

    socket.on('connect', () => {
      console.log(`Socket connected with ID: ${socket.id}`);
      setIsConnected(true);
      setTokenError(null);
      
      // Register the user with their ID 
      socket.emit('register', user._id);
      console.log(`Sent registration for user ${user._id}`);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from tickets socket');
      setIsConnected(false);
    });

    socket.on('registered', (response) => {
      if (response.success) {
        console.log(`Successfully registered as ${response.userId}`);
      } else {
        console.error('Registration failed:', response.error);
      }
    });

    socket.on('unauthorized', (error) => {
      console.error('Authentication error:', error.message);
      setTokenError(error.message || 'Unauthorized: Invalid token');
    });

    // Add a handler for reconnection attempts
    socket.on('reconnect_attempt', (attempt) => {
      console.log(`Reconnection attempt ${attempt}`);
    });

    // Add a handler for reconnection errors
    socket.on('reconnect_error', (error) => {
      console.error('Reconnection error:', error);
    });

    // Add a handler for reconnection success
    socket.on('reconnect', (attemptNumber) => {
      console.log(`Reconnected after ${attemptNumber} attempts`);
      // Re-register after reconnection
      socket.emit('register', user._id);
    });

    // Add event listener for debugging all events
    socket.onAny((event, ...args) => {
      console.log(`[Socket Event] ${event}:`, args);
    });

    socketRef.current = socket;
    return socket;
  }, [user?._id]);

  // Reconnect socket with a new token
  const reconnectWithToken = useCallback(() => {
    const token = getAuthToken();
    if (!token || !user?._id) return false;

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    initializeSocket(token);
    return true;
  }, [user?._id, getAuthToken, initializeSocket]);

  // Initialize socket on component mount
  useEffect(() => {
    const token = getAuthToken();
    if (token && user?._id) {
      const socket = initializeSocket(token);
      
      return () => {
        if (socket) socket.disconnect();
      };
    }
  }, [user?._id, getAuthToken, initializeSocket]);

  // Function to create a new ticket via socket
  const createTicket = useCallback((ticketData) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current || !isConnected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const ticketPayload = {
        ...ticketData,
        userId: user._id
      };

      socketRef.current.emit('createTicket', ticketPayload, (response) => {
        if (response && response.success) {
          resolve(response.ticket);
        } else {
          reject(new Error(response?.error || 'Failed to create ticket'));
        }
      });
    });
  }, [isConnected, user?._id]);

  return {
    isConnected,
    socket: socketRef.current,
    createTicket,
    tokenError,
    reconnectWithToken,
  };
};

export default useTicketSocket;
