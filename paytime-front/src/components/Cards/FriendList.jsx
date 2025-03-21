import React from 'react';
import { Ticket } from 'lucide-react';

export default function FriendList({ username, friendId, onOpenTicketModal }) {
    const handleTicketClick = () => {
        if (onOpenTicketModal) {
            onOpenTicketModal({
                _id: friendId,
                Username: username
            });
        }
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow-md mt-2">
            <div className="flex items-center space-x-4">
                <div className="flex-grow">
                    <h3 className="font-bold text-lg">{username}</h3>
                </div>

                <div className="flex space-x-2">
                    <button
                        onClick={handleTicketClick}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                        title="Create Ticket"
                    >
                        <Ticket size={20} className="text-green-500" />
                    </button>
                </div>
            </div>
        </div>
    );
}
