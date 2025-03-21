import { useEffect, useState, useRef, useCallback } from "react";
import { useDispatch } from "react-redux";
import { io } from "socket.io-client";
import { addFriendRequest, addFriend, removeFriendRequest } from "../store/Slices/UserSlice";
import { toast } from "react-hot-toast";

// Enable this for more detailed logs
const DEBUG = true;

const useSocketIO = (userId) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [socket, setSocket] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dispatch = useDispatch();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  
  
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
      
      // Store the new tokens
      localStorage.setItem('token', data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }
      
      debug('Token refreshed successfully');
      return data.accessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      setConnectionError('Failed to refresh authentication token');
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }, []);
  
  // Function to reconnect with a new token
  const reconnectWithNewToken = useCallback(async () => {
    const newToken = await refreshToken();
    if (!newToken || !userId) {
      debug('Failed to reconnect - no new token or userId');
      return false;
    }
    
    debug('Reconnecting with new token');
    
    // Clean up existing socket if any
    if (socket) {
      socket.disconnect();
    }
    
    // Create new socket with fresh token
    const socketInstance = io(`${import.meta.env.VITE_BACK_APP_URL}/friends`, {
      auth: { userId, token: newToken },
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      timeout: 10000,
      transports: ['websocket', 'polling'],
    });
    
    setSocket(socketInstance);
    
    // Set up the event listeners again
    socketInstance.on("connect", () => {
      debug(`Reconnected to WebSocket: ${socketInstance.id}`);
      setIsConnected(true);
      setConnectionError(null);
      socketInstance.emit("register", userId);
    });
    
    // Set up all the other event listeners...
    // (adding just key ones to avoid too much repetition)
    socketInstance.on("registered", (response) => {
      debug('Registration confirmed by server', response);
      setIsRegistered(true);
    });
    
    socketInstance.on("unauthorized", async (error) => {
      debug('Unauthorized error from server', error);
      // If we get another unauthorized after refresh, don't loop
      if (!isRefreshing) {
        await reconnectWithNewToken();
      }
    });
    
    return true;
  }, [userId, socket, refreshToken, isRefreshing, maxReconnectAttempts]);
  
  useEffect(() => {
    debug(`Hook initialized with userId: ${userId}`);
    if (!userId) {
      debug('No userId provided, skipping socket connection');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setConnectionError('No authentication token found');
      return;
    }
    
    const socketInstance = io(`${import.meta.env.VITE_BACK_APP_URL}/friends`, {
      auth: { userId, token },
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      timeout: 10000,
      transports: ['websocket', 'polling'],
    });

    socketInstance.on("connect", () => {
      debug(`Connected to WebSocket: ${socketInstance.id}`);
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttempts.current = 0;
      
      // Explicitly register with the server and wait for confirmation
      debug(`Sending registration for userId: ${userId}`);
      socketInstance.emit("register", userId);
    });

    // Listen for registration confirmation
    socketInstance.on("registered", (response) => {
      debug('Registration confirmed by server', response);
      setIsRegistered(true);
      // toast.success("Connected to real-time notifications");
    });

    socketInstance.on("connect_error", async (error) => {
      console.error("Socket connection error:", error.message);
      reconnectAttempts.current += 1;
      setIsConnected(false);
      setIsRegistered(false);
      setConnectionError(`Connection failed: ${error.message}`);
      
      // Check if the error is related to authentication
      if (error.message.includes('auth') || error.message.includes('token') || 
          error.message.includes('unauthorized') || error.message.includes('jwt')) {
        debug('Connection error appears to be auth-related, trying to refresh token');
        await reconnectWithNewToken();
      } else if (reconnectAttempts.current >= maxReconnectAttempts) {
        toast.error("Unable to connect to the server. Please check your connection and try again later.");
        socketInstance.disconnect();
      }
    });

    socketInstance.on("disconnect", (reason) => {
      debug(`Disconnected from WebSocket: ${reason}`);
      setIsConnected(false);
      setIsRegistered(false);
      if (reason === "io server disconnect") {
        setConnectionError("Disconnected by server");
        toast.error("Disconnected from server. Please refresh the page.");
      }
    });

    // Add specific handler for friend requests
    socketInstance.on("newFriendRequest", (data) => {
      debug('Received new friend request', data);
      
      if (!data.fromUserId) {
        console.error('Invalid friend request data received', data);
        return;
      }
      
      // Add to Redux store
      dispatch(addFriendRequest({
        _id: data.fromUserId,
        from: data.fromUserId,
        Username: data.fromUsername || "Unknown User"
      }));
      
      // Show notification
      toast.success(`New friend request from ${data.fromUsername}`);
    });

    socketInstance.on("friendRequestAccepted", (data) => {
      debug('Friend request accepted', data);
      if (data.friend) {
        dispatch(removeFriendRequest(data.friend));
        dispatch(addFriend({
          _id: data.friend,
          Username: data.fromUsername
        }));
        toast.success("Friend request accepted!");
      }
    });

    socketInstance.on("friendRequestRejected", (data) => {
      debug('Friend request rejected', data);
      if (data.fromUserId) {
        dispatch(removeFriendRequest(data.fromUserId));
        toast.info("Friend request was rejected");
      }
    });

    // Add specific handler for unauthorized responses
    socketInstance.on("unauthorized", async (error) => {
      debug('Unauthorized error received', error);
      if (!isRefreshing) {
        await reconnectWithNewToken();
      }
    });

    setSocket(socketInstance);

    return () => {
      debug('Cleaning up socket connection');
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, [userId, reconnectWithNewToken, isRefreshing, maxReconnectAttempts]);
  
  const sendFriendRequest = useCallback((toUserId) => {
    if (!socket || !isConnected) {
      debug('Cannot send friend request - socket not connected');
      return false;
    }
    
    debug(`Sending friend request to ${toUserId}`);
    socket.emit("sendFriendRequest", {
      fromUserId: userId,
      toUserId
    });
    
    return true;
  }, [socket, isConnected, userId]);
  
  const acceptFriendRequest = (fromUserId) => {
    if (!socket || !isConnected) {
      debug('Cannot accept friend request - socket not connected');
      return false;
    }
    
    debug(`Accepting friend request from ${fromUserId}`);
    socket.emit("acceptFriendRequest", {
      fromUserId,
      toUserId: userId
    });
    
    return true;
  };
  
  const rejectFriendRequest = (fromUserId) => {
    if (!socket || !isConnected) {
      debug('Cannot reject friend request - socket not connected');
      return false;
    }
    
    debug(`Rejecting friend request from ${fromUserId}`);
    socket.emit("rejectFriendRequest", {
      fromUserId,
      toUserId: userId
    });
    
    return true;
  };
  
  return {
    isConnected,
    isRegistered,
    connectionError,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    refreshToken,
    isRefreshing
  };
};

export default useSocketIO;