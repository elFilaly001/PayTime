import { useEffect, useState, useRef, useCallback } from "react";
import { useDispatch } from "react-redux";
import { io } from "socket.io-client";
import { addFriendRequest, addFriend, removeFriendRequest } from "../store/Slices/UserSlice";
import { toast } from "react-hot-toast";

const DEBUG = true;

const useSocketIO = (userId) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dispatch = useDispatch();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const socketRef = useRef(null);
  
  const debug = (message, data) => {
    if (DEBUG) {
      console.log(`[Socket] ${message}`, data ? data : '');
    }
  };
  
  const refreshToken = useCallback(async () => {
    try {
      setIsRefreshing(true);
      debug('Attempting to refresh token');
      
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
      localStorage.setItem('token', data.token);
      debug('Token refreshed successfully');
      return data.token;
    } catch (error) {
      debug('Token refresh failed', error);
      throw error;
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Initialize the socket only once when userId is available and changes
  useEffect(() => {
    // Don't connect if there's no userId
    if (!userId) {
      debug('No userId provided, not connecting');
      return;
    }

    // Clean up any existing connection
    if (socketRef.current) {
      debug('Cleaning up existing socket before creating new one');
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    debug(`Initializing socket for user: ${userId}`);
    
    // Create a new socket connection
    const newSocket = io(import.meta.env.VITE_BACK_APP_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      query: { 
        token: localStorage.getItem('token') 
      }
    });
    
    socketRef.current = newSocket;
    
    // Set up event handlers
    newSocket.on('connect', () => {
      debug('Connected to socket server');
      setIsConnected(true);
      reconnectAttempts.current = 0;
      setConnectionError(null);
      
      // Register with socket server
      newSocket.emit('register', { userId }, (response) => {
        if (response.success) {
          setIsRegistered(true);
          debug('Successfully registered with socket server');
        } else {
          debug('Failed to register with socket server', response);
          setIsRegistered(false);
        }
      });
    });
    
    newSocket.on('disconnect', (reason) => {
      debug(`Disconnected: ${reason}`);
      setIsConnected(false);
      setIsRegistered(false);
    });
    
    newSocket.on('connect_error', async (err) => {
      debug('Connection error', err);
      setConnectionError(err.message);
      
      if (err.message.includes('authentication') && reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current += 1;
        debug(`Reconnect attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`);
        
        try {
          const newToken = await refreshToken();
          if (newToken) {
            newSocket.io.opts.query = { token: newToken };
            newSocket.connect();
          }
        } catch (error) {
          debug('Failed to recover connection', error);
        }
      }
    });
    
    // Handle incoming friend requests
    newSocket.on('friend_request', (data) => {
      debug('Received friend request event', data);
      toast.success(`New friend request from ${data.from.Username}`);
      dispatch(addFriendRequest(data));
    });
    
    // Handle accepted friend requests
    newSocket.on('friend_accepted', (data) => {
      debug('Friend request accepted', data);
      toast.success(`${data.Username} accepted your friend request!`);
      dispatch(addFriend(data));
    });
    
    // Handle rejected friend requests
    newSocket.on('friend_rejected', (data) => {
      debug('Friend request rejected', data);
      toast.error(`${data.Username} rejected your friend request`);
      dispatch(removeFriendRequest(data.requestId));
    });
    
    // Clean up the socket connection when the component unmounts or userId changes
    return () => {
      debug('Cleaning up socket connection');
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [userId, dispatch, refreshToken]);

  // Send friend request via socket
  const sendFriendRequest = useCallback((toUserId) => {
    if (!socketRef.current || !isConnected || !isRegistered) {
      debug('Cannot send friend request: socket not ready');
      return false;
    }
    
    debug(`Sending friend request to ${toUserId}`);
    socketRef.current.emit('friend_request', { toUserId });
    return true;
  }, [isConnected, isRegistered]);

  return {
    isConnected,
    isRegistered,
    connectionError,
    sendFriendRequest
  };
};

export default useSocketIO;