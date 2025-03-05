import { useEffect, useState, useRef, useCallback } from "react";
import { useDispatch } from "react-redux";
import { io } from "socket.io-client";
import { addFriendRequest, addFriend, removeFriendRequest } from "../store/Slices/UserSlice";
import { toast } from "react-hot-toast";

// Enable this for more detailed logs
const DEBUG = true;

const useSocketIO = (userId) => {
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const dispatch = useDispatch();
  const reconnectAttempts = useRef(0);
  
  // Debug logger
  const debug = (message, data) => {
    if (DEBUG) {
      console.log(`[Socket] ${message}`, data ? data : '');
    }
  };
  
  useEffect(() => {
    debug(`Hook initialized with userId: ${userId}`);
    if (!userId) {
      debug('No userId provided, skipping socket connection');
      return;
    }

    const socketInstance = io(`${import.meta.env.VITE_BACK_APP_URL}/friends`, {
      auth: { userId },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });

    socketInstance.on("connect", () => {
      debug(`Connected to WebSocket: ${socketInstance.id}`);
      setIsConnected(true);
      reconnectAttempts.current = 0;
      
      // Register with the server
      socketInstance.emit("register", userId);
      debug(`Registered with userId: ${userId}`);
    });

    socketInstance.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
      reconnectAttempts.current += 1;
      setIsConnected(false);
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

    setSocket(socketInstance);

    return () => {
      debug('Cleaning up socket connection');
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, [userId]);
  
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
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest
  };
};

export default useSocketIO;