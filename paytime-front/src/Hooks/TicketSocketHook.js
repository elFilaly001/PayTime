import { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useSelector } from 'react-redux';

const useTicketSocket = () => {
  const user = useSelector((state) => state.user);
  const [isConnected, setIsConnected] = useState(false);
  const [tokenError, setTokenError] = useState(null);
  const socketRef = useRef(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const getAuthToken = useCallback(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setTokenError('Authentication token not found');
      return null;
    }
    return token;
  }, []);

  // Function to refresh the token
  const refreshToken = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${import.meta.env.VITE_BACK_APP_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();

      // Store the new tokens
      localStorage.setItem('accessToken', data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }

      console.log('Token refreshed successfully');
      return data.accessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      setTokenError('Failed to refresh authentication token');
      return null;
    } finally {
      setIsRefreshing(false);
    }
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

    socket.on('unauthorized', async (error) => {
      console.error('Authentication error:', error.message);
      setTokenError(error.message || 'Unauthorized: Invalid token');

      // If token is invalid/expired, try to refresh it
      if (error.message && (
        error.message.includes('invalid') ||
        error.message.includes('expired') ||
        error.message.includes('jwt')
      )) {
        console.log('Attempting to refresh token...');
        const newToken = await refreshToken();
        if (newToken) {
          console.log('Reconnecting with new token...');
          socket.disconnect();
          initializeSocket(newToken);
        }
      }
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
  }, [user?._id, refreshToken]);

  // Reconnect socket with a new token
  const reconnectWithToken = useCallback(async (forceRefresh = false) => {
    let token = getAuthToken();

    if (forceRefresh || !token) {
      token = await refreshToken();
    }

    if (!token || !user?._id) return false;

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    initializeSocket(token);
    return true;
  }, [user?._id, getAuthToken, initializeSocket, refreshToken]);

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
    refreshToken,
    isRefreshing,
  };
};

export default useTicketSocket;
