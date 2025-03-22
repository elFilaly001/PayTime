import React, { useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";
import NavBar from "../components/Bars/NavBar";
import SideBar from "../components/Bars/Sidebar";
import { axiosInstance } from "../service/axiosInstence";
import { format } from "date-fns";

export default function History() {
    const [transactions, setTransactions] = useState([]);
    const [filteredTransactions, setFilteredTransactions] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                setIsLoading(true);
                const response = await axiosInstance.get("/transaction");
                setTransactions(response.data);
                setFilteredTransactions(response.data);
            } catch (error) {
                console.error("Error fetching transactions:", error);
                toast.error("Failed to load transaction history");
            } finally {
                setIsLoading(false);
            }
        };

        fetchTransactions();
    }, []);

    useEffect(() => {
        if (searchTerm.trim() === "") {
            setFilteredTransactions(transactions);
            return;
        }

        const lowercasedSearch = searchTerm.toLowerCase();
        const filtered = transactions.filter(transaction => 
            transaction.ticket.place.toLowerCase().includes(lowercasedSearch) ||
            transaction.counterparty.name.toLowerCase().includes(lowercasedSearch) ||
            transaction.transaction.status.toLowerCase().includes(lowercasedSearch) ||
            transaction.ticket.type.toLowerCase().includes(lowercasedSearch)
        );
        
        setFilteredTransactions(filtered);
    }, [searchTerm, transactions]);

    const formatDate = (dateString) => {
        try {
            return format(new Date(dateString), "MMM dd, yyyy • HH:mm");
        } catch (e) {
            return "Invalid date";
        }
    };

    const getStatusColor = (status) => {
        switch (status.toLowerCase()) {
            case "completed":
            case "paid":
                return "bg-green-100 text-green-800";
            case "pending":
                return "bg-yellow-100 text-yellow-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    const getDirectionIcon = (direction) => {
        // Up arrow (↑) for outgoing payments, Down arrow (↓) for incoming payments
        return direction === "outgoing" ? 
            <span className="text-red-500">↑</span> : 
            <span className="text-green-500">↓</span>;
    };

    return (
        <>
            <div className="flex flex-col min-h-screen">
                <Toaster />
                <NavBar />
                <div className="flex flex-1">
                    <SideBar />
                    <main className="flex-1 p-6 bg-gray-50">
                        <div className="max-w-6xl mx-auto">
                            <div className="flex justify-between items-center mb-6">
                                <h1 className="text-3xl font-bold text-gray-900">Transaction History</h1>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search transactions..."
                                        className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                    <svg 
                                        className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" 
                                        xmlns="http://www.w3.org/2000/svg" 
                                        viewBox="0 0 20 20" 
                                        fill="currentColor"
                                    >
                                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            </div>

                            {isLoading ? (
                                <div className="flex justify-center items-center h-64">
                                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                                </div>
                            ) : filteredTransactions.length === 0 ? (
                                <div className="bg-white rounded-lg shadow p-6 text-center">
                                    <p className="text-gray-500">No transactions found.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {filteredTransactions.map((item, index) => (
                                        <div key={index} className="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <div className="text-lg font-medium text-gray-900 flex items-center">
                                                        {getDirectionIcon(item.direction)} 
                                                        <span className="ml-2">{item.ticket.place}</span>
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        With {item.counterparty.name} ({item.counterparty.role})
                                                    </div>
                                                </div>
                                                <div className="text-xl font-semibold">
                                                    {
                                                    // For loanee:
                                                    // - Outgoing payment (paying back debt) = money leaving account (-)
                                                    // - Incoming payment (receiving loan) = money entering account (+) 
                                                    item.userRole === "loanee" ? 
                                                        (item.direction === "outgoing" ? "-" : "+") :
                                                    // For loaner:
                                                    // - Outgoing payment (giving loan) = money leaving account (-) 
                                                    // - Incoming payment (getting repaid) = money entering account (+)
                                                    (item.direction === "outgoing" ? "-" : "+")
                                                    }
                                                    {item.ticket.amount}
                                                </div>
                                            </div>
                                            
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                <span className={`text-xs px-2 py-1 rounded ${getStatusColor(item.transaction.status)}`}>
                                                    {item.transaction.status}
                                                </span>
                                                <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                                                    {item.ticket.type}
                                                </span>
                                                <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800">
                                                    {item.userRole}
                                                </span>
                                            </div>
                                            
                                            <div className="text-sm text-gray-500">
                                                {item.ticket.paidAt ? 
                                                    `Paid on ${formatDate(item.ticket.paidAt)}` : 
                                                    `Due on ${formatDate(item.ticket.dueDate)}`}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </div>
        </>
    );
}
