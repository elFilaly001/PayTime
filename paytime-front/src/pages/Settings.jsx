import React from 'react'
import { LogOut } from 'lucide-react';
import SideBar from '../components/Bars/Sidebar';
import Payments from '../components/Cards/Payments';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { axiosInstance } from '../service/axiosInstence';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
    const user = useSelector((state) => state.user);
    const navigate = useNavigate();


    async function logout() { 
         const res = await axiosInstance.get('/auth/logout');
        
        if (res.status === 200) {
            localStorage.removeItem('accessToken');
            navigate('/login');
        }
        console.log(res);
     }

    return (
        <div className="flex flex-col min-h-screen">
            <div className="flex flex-1">
                <SideBar />

                {/* Main Content */}
                <main className="flex-1 p-6 bg-gray-50">
                    <div className="max-w-6xl mx-auto">
                        <h1 className="text-3xl font-bold text-gray-900 mb-6">Settings</h1>
                        <main className="flex-1 p-6 bg-gray-50">
                            <div className="max-w-6xl mx-auto">
                                <h1 className="text-3xl font-bold text-gray-900 mb-6">Your Friend code</h1>
                                {/* Example content */}
                                <div className="bg-white p-6 rounded-lg  ">
                                    <h1 className="text-xl font-semibold">{user.Friend_Code}</h1>
                                </div>
                            </div>
                        </main>
                        <Payments />
                    </div>
                </main>
                <div className="fixed bottom-4 right-4 max-w-md">
                    <button  onClick={logout} className="mt-5 flex items-center px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg mr-6">
                        <LogOut  className='mr-2' /> Logout
                    </button>
                </div>
            </div>
        </div>
    );
}