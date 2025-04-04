import React, { useEffect, useState, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import SideBar from "../components/Bars/Sidebar";
import FriendRequest from "../components/Cards/FriendRequest";
import Input from "../components/inputs/Input";
import { axiosInstance } from "../service/axiosInstence";
import useSocketIO from "../Hooks/Socket_ioHook";
import { toast, Toaster } from "react-hot-toast";
import { UserPlus, RefreshCw, Search } from "lucide-react";
import { setUser } from "../store/Slices/UserSlice";
import FriendList from "../components/Cards/FriendList";
import CreateTicketModal from '../components/Modals/CreateTicketModal';

export default function FriendsPage() {
    const user = useSelector((state) => state.user);
    const dispatch = useDispatch();
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [ticketModalOpen, setTicketModalOpen] = useState(false);
    const [selectedFriend, setSelectedFriend] = useState(null);
    const [friends, setFriends] = useState(null);

    // Only initialize socket connection if we have a valid user ID
    const { isConnected, isRegistered, sendFriendRequest } = useSocketIO(
        user._id ? user._id : null
    );


    // Initial data loading
    useEffect(() => {
        if (user?.Friend_list && Array.isArray(user.Friend_list)) {
            setFriends(user.Friend_list);
            console.log("Friends set from user state:", user.Friend_list);
        } else {
            console.log("No Friend_list in user state or it's not an array");
        }
    }, [user]);
    // Memoize the handleAddFriend function to avoid recreating it on every render
    const handleAddFriend = useCallback(async (friendId) => {
        try {
            if (!user._id || !friendId) {
                toast.error("Missing user information");
                return;
            }

            // Try socket first if connected and registered
            if (isConnected && isRegistered) {
                console.log(`Sending friend request via socket to: ${friendId}`);
                const sent = sendFriendRequest(friendId);
                if (!sent) {
                    throw new Error("Failed to send friend request via socket");
                }
                toast.success("Friend request sent successfully");
            } else {
                // Fallback to REST API
                console.log(`Sending friend request via REST API to: ${friendId}`);
                await axiosInstance.post("friends/add-friend", {
                    toUserId: friendId
                });
                toast.success("Friend request sent successfully");
            }

            setSearchResults([]);
            setSearchTerm("");
        } catch (error) {
            console.error("Error details:", error.response?.data || error);
            toast.error(error.response?.data?.message || "Failed to send friend request");
        }
    }, [user._id, isConnected, isRegistered, sendFriendRequest]);

    // Only log socket connection status when it changes
    useEffect(() => {
        console.log("Socket connection status:", isConnected);
        console.log("Socket registration status:", isRegistered);
    }, [isConnected, isRegistered]);

    // Log user info separately
    useEffect(() => {
        console.log("Current user ID:", user._id);
        console.log("Friend requests:", user);
    }, [user]);

    const Friend_requests = user.Friend_requests || [];

    const handleSearch = async () => {
        try {
            if (searchTerm.trim() === "") {
                toast.error("Search term must be filled");
                setSearchResults([]);
                return;
            }

            const response = await axiosInstance.post("friends/search", {
                searchTerm: searchTerm
            });

            setSearchResults(response.data);
        } catch (error) {
            console.error("Error searching for friends:", error);
            toast.error("Failed to search for friends");
        }
    };

    const refreshFriendRequests = async () => {
        try {
            const response = await axiosInstance.get("friends/requests");

            if (response.data) {
                // More flexible handling of the response format
                const friendRequests = response.data.requests || [];

                dispatch(setUser({ Friend_requests: friendRequests , Friend_list: user.Friend_list}));
                toast.success(`Friend requests refreshed (${friendRequests.length} found)`);
            } else {
                toast.error("No data received from server");
            }
        } catch (error) {
            console.error("Error refreshing friend requests:", error);
            console.error("Response:", error.response?.data);
            toast.error(error.response?.data?.message || "Failed to refresh friend requests");
        }
    };

    const handleOpenTicketModal = (friend) => {
        setSelectedFriend(friend);
        setTicketModalOpen(true);
    };

    const handleSubmitTicket = async (ticketData) => {
        try {
            const response = await axiosInstance.post('/tickets/create', ticketData);
            if (response.data) {
                toast.success("Ticket created successfully!");
                setTicketModalOpen(false);
            }
        } catch (error) {
            console.error("Error creating ticket:", error);
            toast.error(error.response?.data?.message || "Failed to create ticket");
        }
    };

    return (
        <div className="flex flex-col min-h-screen">
            <Toaster />
            <div className="flex flex-1">
                <SideBar />
                <main className="flex-1 p-6 bg-gray-50">
                    <div className="max-w-6xl mx-auto">
                        <h1 className="text-3xl font-bold text-gray-900 mb-6">Friends</h1>

                        {/* Search Section */}
                        <div className="bg-white p-6 rounded-lg shadow mb-6">
                            <div className="flex justify-center items-center gap-4">
                                <Input
                                    placeholder="Search by username or friend code"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <button
                                    onClick={handleSearch}
                                    className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                >
                                    <Search />
                                </button>
                            </div>

                            {/* Search Results */}
                            {searchResults.length > 0 && (
                                <div className="mt-4">
                                    <h2 className="text-lg font-semibold mb-2">Search Results</h2>
                                    <div className="space-y-2">
                                        {searchResults.map((result) => (
                                            <div key={result.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                                <span>{result.username}</span>
                                                <button
                                                    onClick={() => handleAddFriend(result.id)}
                                                    className="flex items-center gap-2 px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                                >
                                                    <UserPlus size={16} />
                                                    Add Friend
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Friend Requests Section */}
                        <div className="bg-white p-6 rounded-lg shadow mb-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold">Friend Requests</h2>
                                <button
                                    onClick={refreshFriendRequests}
                                    className="flex items-center gap-2 px-3 py-1 text-gray-600 hover:text-gray-900 transition-colors"
                                    title="Refresh friend requests"
                                >
                                    <RefreshCw size={18} />
                                </button>
                            </div>
                            <div className="flex flex-row gap-4 ml-4">
                                {Friend_requests.length > 0 ? (
                                    Friend_requests.map((friend) => (
                                        <FriendRequest
                                            key={friend._id}
                                            User={friend.from}
                                            text={friend.Username}
                                        />
                                    ))
                                ) : (
                                    <p className="text-gray-500">No friend requests.</p>
                                )}
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow">
                            <h2 className="text-xl font-semibold">Friend List</h2>
                            <div className="flex flex-row gap-4 ml-4">
                                {user.Friend_list.length > 0 ? (
                                    user.Friend_list.map((friend) => (
                                        <FriendList
                                            key={friend._id}
                                            username={friend.Username}
                                            friendId={friend._id}
                                            onOpenTicketModal={handleOpenTicketModal}
                                        />
                                    ))
                                ) : (
                                    <p className="text-gray-500">No friends.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
            {ticketModalOpen && (
                <CreateTicketModal
                    isOpen={ticketModalOpen}
                    onClose={() => setTicketModalOpen(false)}
                    onSubmit={handleSubmitTicket}
                    Friend_list={friends || user.Friend_list}
                    preselectedFriendId={selectedFriend?._id}
                />
            )}
        </div>
    );
}
