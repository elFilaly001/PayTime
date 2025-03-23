import React from 'react'
import NavBar from '../components/Bars/NavBar';
import SideBar from '../components/Bars/Sidebar';
import Payments from '../components/Cards/Payments';
import { useSelector } from 'react-redux';
export default function Settings() {
    const user = useSelector((state) => state.user);

    return (
        <div className="flex flex-col min-h-screen">
            <NavBar />
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
                                    <h1 className="text-xl font-semibold mb-4">{user.Friend_Code}</h1>
                                </div>
                            </div>
                        </main>
                        <Payments />
                    </div>
                </main>
            </div>
        </div>
    );
}