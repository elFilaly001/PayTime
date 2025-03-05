import React, { useState } from "react";
import ButtonCheck from "../buttons/ButtonCheck";
import ButtonX from "../buttons/ButtonX";
import { toast, Toaster } from "react-hot-toast";
import { useSelector, useDispatch } from "react-redux";
import useSocketIO from "../../Hooks/Socket_ioHook";
import { removeFriendRequest, addFriend } from "../../store/Slices/UserSlice";
import { axiosInstance } from "../../service/axiosInstence";

export default function FriendRequest({ text, User }) {
    const [isProcessing, setIsProcessing] = useState(false);
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user._id);
    const { acceptFriendRequest, rejectFriendRequest, isConnected } = useSocketIO(currentUser || "");
    
    
    const handleAccept = async() => {
        if (isProcessing) return;
        
        setIsProcessing(true);
        try {
            console.log(`Accepting friend request from ${User}`);
            
            // First, update the database via REST API as a fallback
            await axiosInstance.post("friends/accept-friend-request", {
                requestId: User
            });
            
            // Update Redux state immediately for UI responsiveness
            dispatch(removeFriendRequest(User));
            dispatch(addFriend({ _id: User, Username: text }));
            
            // Then notify via WebSocket if connected
            if (isConnected) {
                acceptFriendRequest(User);
            }
            
            toast.success("Friend request accepted");
        } catch (error) {
            console.error("Error accepting friend request:", error);
            toast.error(error.response?.data?.message || "Failed to accept friend request");
        } finally {
            setIsProcessing(false);
        }
    }

    const handleReject = async() => {
        if (isProcessing) return;
        
        setIsProcessing(true);
        try {
            console.log(`Rejecting friend request from ${User}`);

            // First, update the database via REST API as a fallback
            await axiosInstance.post("friends/reject-friend-request", {
                requestId: User
            });
            
            // Update Redux state immediately for UI responsiveness
            dispatch(removeFriendRequest(User));
            
            // Then notify via WebSocket if connected
            if (isConnected) {
                rejectFriendRequest(User);
            }
            
            toast.success("Friend request rejected");
        } catch (error) {
            console.error("Error rejecting friend request:", error);
            toast.error(error.response?.data?.message || "Failed to reject friend request");
        } finally {
            setIsProcessing(false);
        }
    }
    
    return (
        <>
        <Toaster/>
            <div className="flex flex-1 flex-row align-center">
                <div className="bg-white p-2 py-5 rounded-rt shadow flex justify-center align-center">
                    <p className="font-bold text-gray-900 mr-5">{text}</p>
                    <ButtonCheck onClick={handleAccept} disabled={isProcessing} />
                    <ButtonX onClick={handleReject} disabled={isProcessing} />
                </div>
            </div>
        </>
    );
}