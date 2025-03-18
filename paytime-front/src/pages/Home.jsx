import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { axiosInstance } from "../service/axiosInstence";
import NavBar from "../components/Bars/NavBar";
import SideBar from "../components/Bars/Sidebar";
import Tickets from "../components/Cards/Tickets";
import CreateTicketModal from "../components/Modals/CreateTicketModal";
import useTicketSocket from "../Hooks/TicketSocketHook";
import toast from "react-hot-toast"; // Add this import

export default function HomePage() {
    const user = useSelector((state) => state.user);
    const [tickets, setTickets] = useState([]);
    const [friends, setFriends] = useState(user?.Friend_list);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const { isConnected, socket, createTicket } = useTicketSocket();

    const toggleCreateModal = () => {
        setIsCreateModalOpen(!isCreateModalOpen);
    };

    useEffect(() => {
        // If Friend_list exists, use it
        if (user?.Friend_list && Array.isArray(user.Friend_list)) {
            setFriends(user.Friend_list);
            console.log("Friends set from user state:", user.Friend_list);
        } 
        // Otherwise, we could fetch friends separately if needed
        else {
            console.log("No Friend_list in user state or it's not an array");
        }

        async function getTickets() {
            try {
                const response = await axiosInstance.get('tickets/')
                setTickets(response.data)
            } catch (error) {
                console.error(error)
            }
        }
        getTickets();
    }, [user]);

    // Listen for new tickets via socket with improved debugging
    useEffect(() => {
        if (!socket) {
            console.log('No socket connection available');
            return;
        }

        console.log('Setting up newTicket listener');
        
        const handleNewTicket = (newTicket) => {
            console.log('New ticket received via socket:', newTicket);
            
            // Validate the ticket object
            if (!newTicket || !newTicket._id) {
                console.error('Received invalid ticket object:', newTicket);
                return;
            }
            
            setTickets(prevTickets => {
                // Check for duplicates by ID
                const isDuplicate = prevTickets.some(t => t._id === newTicket._id);
                if (isDuplicate) {
                    console.log(`Duplicate ticket detected with ID: ${newTicket._id}`);
                    return prevTickets;
                }
                
                // Show toast notification
                toast.success(`Ticket updated: ${newTicket.title || 'Untitled ticket'}`, {
                    duration: 4000,
                    position: 'top-right',
                });
                
                console.log(`Adding ticket ${newTicket._id} to state`);
                return [...prevTickets, newTicket];
            });
        };

        // Register event handler with socket
        socket.on('newTicket', handleNewTicket);
        
        // Force a reregistration to ensure the server knows about this client
        socket.emit('register', user?._id);
        
        return () => {
            console.log('Cleaning up socket event listeners');
            socket.off('newTicket', handleNewTicket);
        };
    }, [socket, user]);

    // Handle ticket creation
    const handleCreateTicket = async (ticketData) => {
        try {
            // Show loading toast
            const loadingToast = toast.loading("Creating ticket...");
            
            const newTicket = await createTicket(ticketData);
            console.log('Ticket created:', newTicket);
            
            // Immediately add the new ticket to local state without waiting for socket
            setTickets(prevTickets => [...prevTickets, newTicket]);
            
            // Dismiss loading toast and show success
            toast.dismiss(loadingToast);
            toast.success("Ticket created successfully!", {
                icon: "🎫",
                duration: 3000,
            });
            
            toggleCreateModal();
            return newTicket;
        } catch (error) {
            console.error('Failed to create ticket:', error);
            toast.error(`Failed to create ticket: ${error.message}`, {
                duration: 5000,
            });
            throw error;
        }
    };

    return (
        <div className="flex flex-col min-h-screen">
            <NavBar />
            <div className="flex flex-1">
                <SideBar />

                {/* Main Content */}
                <main className="flex-1 p-6 bg-gray-50">
                    <div className="max-w-6xl mx-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h1 className="text-3xl font-bold text-gray-900">Tickets</h1>
                            <button 
                                onClick={toggleCreateModal}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-2 rounded-md flex items-center"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>

                        <div className="bg-white p-6 flex flex-row flex-wrap gap-4 rounded-lg shadow">
                            {tickets.map((ticket) => (
                                <Tickets key={ticket._id} ticket={ticket} />
                            ))}
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
                    Friend_list={friends} // Pass the friends from local state
                />
            )}
        </div>
    );
}