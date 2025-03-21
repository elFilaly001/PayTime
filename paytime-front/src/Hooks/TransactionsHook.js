// src/Hooks/TransactionsHook.js
import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useSelector } from 'react-redux';

const useTransactionSocket = () => {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [tokenError, setTokenError] = useState(null);
    const user = useSelector((state) => state.user);

    const getAuthToken = useCallback(() => {
        // Try different token names that might be used in your app
        const token = localStorage.getItem('accessToken') 

        if (!token) {
            setTokenError('Authentication token not found');
            return null;
        }
        return token;
    }, []);

    // Initialize socket connection
    useEffect(() => {
        if (!user?._id) {
            console.log('No user ID available for transaction socket');
            return;
        }

        // Get the token
        const token = getAuthToken();
        if (!token) {
            console.error('No auth token available for socket connection');
            return;
        }

        console.log('Initializing transaction socket connection test');
        const newSocket = io(`${import.meta.env.VITE_BACK_APP_URL}/transactions`, {
            auth: {
                userId: user._id
            },
            extraHeaders: {
                authorization: `Bearer ${token}`
            }
        });

        newSocket.on('connect', () => {
            console.log(`Connected to transaction socket with ID: ${newSocket.id}`);
            setIsConnected(true);

            // Register with server
            newSocket.emit('register', user._id);
            console.log(`Sent registration for user ${user._id} to transaction socket`);
        });

        newSocket.on('registered', (response) => {
            console.log('Transaction socket registration response:', response);
        });

        newSocket.on('connect_error', (error) => {
            console.error('Transaction socket connection error:', error);
            setIsConnected(false);
        });

        newSocket.on('disconnect', () => {
            console.log('Disconnected from transaction socket');
            setIsConnected(false);
        });

        // For debugging all events
        newSocket.onAny((event, ...args) => {
            console.log(`[Socket Event] ${event}:`, args);
        });

        setSocket(newSocket);

        // Cleanup on unmount
        return () => {
            console.log('Cleaning up transaction socket');
            if (newSocket) {
                newSocket.disconnect();
            }
        };
    }, [user?._id, getAuthToken]);

    // Pay with cash method
    const payWithCash = useCallback((ticketId) => {
        return new Promise((resolve, reject) => {
            if (!socket || !isConnected) {
                reject(new Error('Socket not connected'));
                return;
            }

            console.log(`Requesting cash payment for ticket ${ticketId}`);

            socket.emit('payWithCash', { ticketId }, (response) => {
                console.log('Payment response received:', response);
                if (response && response.success) {
                    resolve(response.transaction);
                } else {
                    reject(new Error(response?.error || 'Payment failed'));
                }
            });
        });
    }, [socket, isConnected]);

    // Pay with card method
    const payWithCard = useCallback((ticketId, paymentMethod = 'MANUAL_CARD') => {
        return new Promise((resolve, reject) => {
            if (!socket || !isConnected) {
                reject(new Error('Socket not connected'));
                return;
            }

            console.log(`Requesting card payment for ticket ${ticketId}`);

            socket.emit('payWithCard', { ticketId, paymentMethod }, (response) => {
                console.log('Payment response received:', response);
                if (response && response.success) {
                    resolve(response.transaction);
                } else {
                    reject(new Error(response?.error || 'Payment failed'));
                }
            });
        });
    }, [socket, isConnected]);

    return {
        socket,
        isConnected,
        tokenError,
        payWithCash,
        payWithCard
    };
};

export default useTransactionSocket;