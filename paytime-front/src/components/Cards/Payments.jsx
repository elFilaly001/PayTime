import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useStripe } from '@stripe/react-stripe-js';
import { toast, Toaster } from "react-hot-toast";
import { useDispatch, useSelector } from 'react-redux';
import { getUser } from "../../store/Slices/UserSlice";
import { fetchDefaultCard, setDefaultCard, resetPaymentState } from "../../store/Slices/PaymentSlice";
import store from "../../store/store";
import CardForm from '../Forms/CardForm';
import PaymentCard from './PaymentCard';
import { axiosInstance } from '../../service/axiosInstence';

const PaymentCardManagement = () => {
    const dispatch = useDispatch();
    const user = useSelector((state) => state.user);
    const { defaultCard, isLoading: isDefaultCardLoading } = useSelector((state) => state.payment);
    const stripe = useStripe();
    const [cards, setCards] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isCardsLoading, setCardsLoading] = useState(false);
    const payment = useSelector((state) => state.payment);
    
    // Console log on component mount and whenever payment state changes
    useEffect(() => {
        console.log("Current payment state:", payment);
    }, [payment]);

    useEffect(() => {
        dispatch(resetPaymentState());
    }, []);

    // Fetch all cards and default card on component mount
    useEffect(() => {
        async function fetchUserCards() {
            setCardsLoading(true);
            try {
                const response = await axiosInstance.get(`/payment/Cards/${user.StripeCostumer}`);
                console.log("All cards response data:", response.data);
                setCards(response.data);
                
                // Find default card from the card list instead of making a separate API call
                const defaultCard = response.data.find(card => card.isDefault === true);
                if (defaultCard) {
                    console.log("Found default card in cards list:", defaultCard);
                    dispatch({
                        type: 'payment/fetchDefaultCard/fulfilled',
                        payload: defaultCard
                    });
                } else {
                    console.log("No default card found in the list");
                }
            } catch (error) {
                console.error("Error fetching cards:", error.response?.data || error.message);
                toast.error("Failed to fetch payment methods");
            } finally {
                setCardsLoading(false);
            }
        }
        
        if (user.StripeCostumer) {
            fetchUserCards();
        }
    }, [dispatch, user.StripeCostumer]);

    const handleDelete = async (id) => {
        try {
            await axiosInstance.delete(`/payment/${id}`);
            setCards(cards.filter(card => card.id !== id));
            
            if (defaultCard && defaultCard.id === id) {
                dispatch(fetchDefaultCard(user.StripeCostumer));
            }
        } catch (error) {
            console.log(error);
            toast.error("Failed to delete card");
        }
    };

    const handleSetDefault = async (id) => {
        try {
            const customerId = user.StripeCostumer;
            // Update default card in Redux
            dispatch(setDefaultCard({ customerId, paymentMethodId: id }));
            
            // Update local state to reflect new default status
            setCards(cards.map(card => ({ 
                ...card, 
                isDefault: card._id === id 
            })));
            
            toast.success("Default payment method updated");
        } catch (error) {
            console.log(error);
            toast.error("Failed to update default payment method");
        }
    };

    const handleAddCard = () => {
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
    };

    const handlePaymentMethodSubmit = async (paymentMethod) => {
        try {
            const card = {
                costumerId: user.StripeCostumer,
                paymentMethodId: paymentMethod.id,
                holderName: paymentMethod.billing_details.name,
                brand: paymentMethod.card.brand,
                last4: paymentMethod.card.last4,
                exp_month: paymentMethod.card.exp_month,
                exp_year: paymentMethod.card.exp_year
            }
            const response = await axiosInstance.post('/payment/addCard', card);
            const newCard = response.data;
            
            console.log("Payment method added:", newCard);
            
            // If this is the first card OR the new card is marked as default
            if (cards.length === 0 || newCard.isDefault) {
                // Mark all existing cards as non-default and add the new one
                setCards(prev => [
                    ...prev.map(c => ({...c, isDefault: false})),
                    newCard
                ]);
                
                // Update the default card in Redux store
                dispatch({
                    type: 'payment/fetchDefaultCard/fulfilled',
                    payload: newCard
                });
            } else {
                // Just add the new card
                setCards(prev => [...prev, newCard]);
            }
            
            toast.success('Payment method added successfully');
            closeModal();
        } catch (error) {
            toast.error(error.message);
        }
    };

    // Updated debug method
    const checkStoreState = () => {
        const state = store.getState();
        
        const localDefault = cards.find(card => card.isDefault);
        console.log("Local Default Card:", localDefault);
    };

    return (
        <>
            <Toaster/>
            <div className="max-w-screen mx-auto p-5">
                <h2 className="text-2xl font-semibold mb-4">Payment Methods</h2>
                
                {isCardsLoading ? (
                    <div className="flex justify-center p-4">Loading payment methods...</div>
                ) : (
                    <div className="flex flex-wrap gap-4">
                        {cards.map(card => (
                            <PaymentCard 
                                key={card.id} 
                                card={card} 
                                onDelete={handleDelete} 
                                onSetDefault={handleSetDefault}
                                isDefaultFromStore={card.isDefault}
                            />
                        ))}
                    </div>
                )}
                
                <button onClick={handleAddCard} className="mt-5 flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg">
                    <Plus className="w-5 h-5 mr-2" /> Add Card
                </button>
                
                {showModal && (
                    <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center ">

                        <div className="mt-4 ">
                            <CardForm
                                closeModal={() => setShowModal(false)}
                                onSubmit={handlePaymentMethodSubmit}
                            />
                        </div>
                        <div className="flex justify-end mt-4">
                            <button onClick={closeModal} className="text-gray-600 hover:text-gray-900 px-4 py-2">Close</button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default PaymentCardManagement;