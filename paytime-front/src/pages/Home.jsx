import { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { axiosInstance } from "../service/axiosInstence";
import NavBar from "../components/Bars/NavBar";
import SideBar from "../components/Bars/Sidebar";
import Tickets from "../components/Cards/Tickets";
import CreateTicketModal from "../components/Modals/CreateTicketModal";
import useTicketSocket from "../Hooks/TicketSocketHook";
import useTransactionSocket from "../Hooks/TransactionsHook";
import { toast, Toaster } from "react-hot-toast";

export default function HomePage() {
    const user = useSelector((state) => state.user);
    const [tickets, setTickets] = useState([]);
    const [friends, setFriends] = useState(user?.Friend_list);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Socket connections
    const { isConnected: isTicketSocketConnected, socket: ticketSocket, createTicket } = useTicketSocket();
    const { isConnected: isTransactionSocketConnected, socket: transactionSocket, payWithCash, payWithCard } = useTransactionSocket();

    // Track processed updates to prevent duplicates
    const [processedUpdates, setProcessedUpdates] = useState(new Set());

    const toggleCreateModal = () => {
        setIsCreateModalOpen(!isCreateModalOpen);
    };

    // Initial data loading
    useEffect(() => {
        if (user?.Friend_list && Array.isArray(user.Friend_list)) {
            setFriends(user.Friend_list);
            console.log("Friends set from user state:", user.Friend_list);
        } else {
            console.log("No Friend_list in user state or it's not an array");
        }

        loadTickets();
    }, [user]);

    // Load tickets from API
    const loadTickets = async () => {
        try {
            const response = await axiosInstance.get('tickets/');
            setTickets(response.data);
        } catch (error) {
            console.error("Error loading tickets:", error);
            toast.error("Failed to load tickets");
        }
    };

    // Handle ticket socket events
    useEffect(() => {
        if (!ticketSocket) {
            return;
        }

        // Handler for new tickets
        const handleNewTicket = (newTicket) => {
            console.log('New ticket received:', newTicket);

            if (!newTicket || !newTicket._id) {
                console.error('Invalid ticket data received');
                return;
            }

            setTickets(prevTickets => {
                // Avoid duplicates
                if (prevTickets.some(t => t._id === newTicket._id)) {
                    return prevTickets;
                }
                return [...prevTickets, newTicket];
            });

            toast.success("New ticket received!", { icon: "🎫" });
        };

        // Handler for ticket status updates
        const handleStatusUpdate = (update) => {
            console.log('Ticket status update received:', update);

            const ticketId = update?.ticketId || update?._id;
            const newStatus = update?.status;

            if (!ticketId || !newStatus) {
                return;
            }

            // Create update identifier
            const updateKey = `${ticketId}-${newStatus}-${Date.now()}`;

            // Skip if already processed recently
            if (processedUpdates.has(updateKey)) {
                return;
            }

            // Update ticket status
            setTickets(prevTickets => {
                const updatedTickets = prevTickets.map(ticket =>
                    ticket._id === ticketId
                        ? { ...ticket, status: newStatus }
                        : ticket
                );

                // Only show toast if status actually changed
                const ticketChanged = updatedTickets.some((t, i) =>
                    t._id === ticketId && t.status !== prevTickets[i].status
                );

                if (ticketChanged) {
                    const ticket = prevTickets.find(t => t._id === ticketId);
                    if (ticket) {
                        toast.success(`Ticket "${ticket.title || 'Unknown'}" status: ${newStatus}`, {
                            icon: "🔄"
                        });
                    }

                    // Mark this update as processed
                    setProcessedUpdates(prev => new Set([...prev, updateKey]));
                }

                return updatedTickets;
            });
        };

        // Register event handlers
        ticketSocket.on('newTicket', handleNewTicket);
        ticketSocket.on('ticketStatusUpdate', handleStatusUpdate);

        // Clean up
        return () => {
            ticketSocket.off('newTicket', handleNewTicket);
            ticketSocket.off('ticketStatusUpdate', handleStatusUpdate);
        };
    }, [ticketSocket]);

    // Handle transaction socket events
    useEffect(() => {
        // Use transactionSocket instead of socket
        if (!transactionSocket) {
            return;
        }

        // Transaction completion handler
        const handleTransactionComplete = (transaction) => {
            console.log('Transaction complete:', transaction);

            if (!transaction?.ticketId) {
                return;
            }

            // Update the ticket status based on transaction
            setTickets(prevTickets => {
                return prevTickets.map(ticket =>
                    ticket._id === transaction.ticketId
                        ? { ...ticket, status: 'PAYED' }
                        : ticket
                );
            });

            toast.success("Payment successful!", { icon: "💰" });
        };

        // Register transaction event handlers on the TRANSACTION socket
        transactionSocket.on('transactionComplete', handleTransactionComplete);

        // Clean up
        return () => {
            transactionSocket.off('transactionComplete', handleTransactionComplete);
        };
    }, [transactionSocket]); // <-- Update the dependency to transactionSocket

    // Handle manual refresh
    const handleManualRefresh = async () => {
        const loadingToast = toast.loading("Refreshing tickets...");
        await loadTickets();
        toast.dismiss(loadingToast);
        toast.success("Tickets refreshed");
    };

    // Handle ticket creation
    const handleCreateTicket = async (ticketData) => {
        try {
            const loadingToast = toast.loading("Creating ticket...");

            const newTicket = await createTicket(ticketData);
            console.log('Ticket created:', newTicket);

            toast.dismiss(loadingToast);
            toast.success("Ticket created successfully!");

            toggleCreateModal();
            return newTicket;
        } catch (error) {
            console.error('Failed to create ticket:', error);
            toast.error(`Failed to create ticket: ${error.message}`);
            throw error;
        }
    };

    const handlePayment = async (ticketId, paymentType) => {
        try {
            const loadingToast = toast.loading("Processing payment...");

            let transaction;
            if (paymentType === 'CASH') {
                transaction = await payWithCash(ticketId);
            } else {
                transaction = await payWithCard(ticketId);
            }

            console.log('Payment processed:', transaction);

            // Update ticket status immediately without waiting for socket
            setTickets(prevTickets =>
                prevTickets.map(ticket =>
                    ticket._id === ticketId
                        ? { ...ticket, status: 'PAYED' }
                        : ticket
                )
            );

            toast.dismiss(loadingToast);
            toast.success(`Payment successful via ${paymentType}!`);

            return transaction;
        } catch (error) {
            console.error('Payment failed:', error);
            toast.error(`Payment failed: ${error.message}`);
            throw error;
        }
    };

    // Socket connection status
    const allSocketsConnected = isTicketSocketConnected && isTransactionSocketConnected;

    return (
        <>
            <Toaster />
            <div className="flex flex-col min-h-screen">
                <NavBar />
                <div className="flex flex-1">
                    <SideBar />

                    {/* Main Content */}
                    <main className="flex-1 p-6 bg-gray-50">
                        <div className="max-w-6xl mx-auto">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-2">
                                    <h1 className="text-3xl font-bold text-gray-900">Tickets</h1>
                                    <div
                                        className={`w-3 h-3 rounded-full ${allSocketsConnected ? 'bg-green-500' : 'bg-red-500'}`}
                                        title={allSocketsConnected ? 'Sockets Connected' : 'Socket Disconnected'}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleManualRefresh}
                                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-3 rounded-md flex items-center"
                                        title="Refresh tickets"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={toggleCreateModal}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-md flex items-center"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white p-6 flex flex-row flex-wrap gap-4 rounded-lg shadow">
                                {tickets.length > 0 ? (
                                    tickets.map((ticket) => (
                                        <Tickets
                                            key={ticket._id}
                                            ticket={ticket}
                                            onSubmit={handlePayment}
                                        />
                                    ))
                                ) : (
                                    <div className="w-full text-center py-6 text-gray-500">
                                        No tickets found. Create one to get started!
                                    </div>
                                )}
                            </div>
                        </div>
                    </main>
                </div>

                {/* Create Ticket Modal */}
                {isCreateModalOpen && (
                    <CreateTicketModal
                        isOpen={isCreateModalOpen}
                        onClose={toggleCreateModal}
                        onSubmit={handleCreateTicket}
                        Friend_list={friends}
                    />
                )}
            </div>
        </>
    );
}