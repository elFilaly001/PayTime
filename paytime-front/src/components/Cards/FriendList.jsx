import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { axiosInstance } from '../../service/axiosInstence';
import { toast } from 'react-hot-toast';
import { Ticket } from 'lucide-react';

export default function FriendList({ username, handleStartChat }) {
    return (
        <div className="bg-white p-4 rounded-lg shadow-md mt-2">
            <div className="flex items-center space-x-4">
                <div className="flex-grow">
                    <h3 className="font-bold text-lg">{username}</h3>
                    {/* <p className="text-gray-600 text-sm">{friend.status || 'Online'}</p> */}
                </div>

                <div className="flex space-x-2">
                    <button
                        onClick={handleStartChat}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                        title="Message"
                    >
                        <Ticket size={20} className="text-blue-500" />
                    </button>
                </div>
            </div>
        </div>
    );
}
