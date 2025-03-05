import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import NavBar from "../components/Bars/NavBar";
import SideBar from "../components/Bars/Sidebar";
import FriendRequest from "../components/Cards/FriendRequest";
import Input from "../components/inputs/Input";
import { axiosInstance } from "../service/axiosInstence";
import useSocketIO from "../Hooks/Socket_ioHook";
import { toast, Toaster } from "react-hot-toast";
import { UserPlus } from "lucide-react";

export default function FriendsPage() {
    const user = useSelector((state) => state.user);
    const { isConnected, sendFriendRequest } = useSocketIO(user._id);
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState([]);

    // Debug user ID
    useEffect(() => {
        console.log("Current user ID:", user._id);
        console.log("Socket connection status:", isConnected);
    }, [user._id, isConnected]);

    // Monitor friend requests changes
    useEffect(() => {
        console.log("Friend requests updated:", user.Friend_requests);
    }, [user.Friend_requests]);

    const Friend_requests = user.Friend_requests || [];

    const handleAddFriend = async (friendId) => {
        try {
            console.log("Attempting to add friend with ID:", friendId);
            console.log("Current user ID:", user._id);

            if (!user._id || !friendId) {
                toast.error("Missing user information");
                return;
            }

            // Try socket first if connected
            if (isConnected) {
                const sent = sendFriendRequest(friendId);
                if (!sent) {
                    throw new Error("Failed to send friend request via socket");
                }
            } else {
                // Fallback to REST API
                await axiosInstance.post("friends/add-friend", {
                    toUserId: friendId
                });
            }

            setSearchResults([]);
            setSearchTerm("");
            toast.success("Friend request sent successfully");
        } catch (error) {
            console.error("Error details:", error.response?.data || error);
            toast.error(error.response?.data?.message || "Failed to send friend request");
        }
    };

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

            console.log("Search results:", response.data);
            setSearchResults(response.data);
        } catch (error) {
            console.error("Error searching for friends:", error);
            toast.error("Failed to search for friends");
        }
    };

    return (
        <div className="flex flex-col min-h-screen">
            <Toaster />
            <NavBar />
            <div className="flex flex-1">
                <SideBar />
                <main className="flex-1 p-6 bg-gray-50">
                    <div className="max-w-6xl mx-auto">
                        <h1 className="text-3xl font-bold text-gray-900 mb-6">Friends</h1>
                        
                        {/* Search Section */}
                        <div className="bg-white p-6 rounded-lg shadow mb-6">
                            <div className="flex gap-4">
                                <Input
                                    placeholder="Search by username or friend code"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <button
                                    onClick={handleSearch}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                >
                                    Search
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
                        <div className="bg-white p-6 rounded-lg shadow">
                            <h2 className="text-xl font-semibold mb-4">Friend Requests</h2>
                            <div className="flex flex-row gap-4">
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
                    </div>
                </main>
            </div>
        </div>
    );
}
