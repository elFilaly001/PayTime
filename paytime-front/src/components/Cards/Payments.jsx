import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useStripe } from '@stripe/react-stripe-js';
import { toast, Toaster } from "react-hot-toast";
import { useDispatch, useSelector } from 'react-redux';
import { getUser } from "../../store/Slices/UserSlice"
import CardForm from '../Forms/CardForm';
import PaymentCard from './PaymentCard';
import axios from 'axios';
import { axiosInstance } from '../../service/axiosInstence';

const PaymentCardManagement = () => {
    const user = useSelector((state) => state.user);
    const [isPaymentLoading, setPaymentLoading] = useState(false);
    const stripe = useStripe();
    const [cards, setCards] = useState([]);
    const [showModal, setShowModal] = useState(false);


    console.log(user);

    useEffect(() => {
        async function fetchUserCards() {
            try {
                const response = await axiosInstance.get(`/payment/Cards/${user.StripeCostumer}`);
                console.log(response);
                setCards(response.data);
            } catch (error) {
                console.log(error);
            }
        }
        fetchUserCards();
    }, []);

    const handleDelete = async (id) => {
        try {
            await axiosInstance.delete(`/payment/${id}`);
            setCards(cards.filter(card => card.id !== id));
        } catch (error) {
            console.log(error);
        }
    };

    const handleSetDefault = async (id) => {
        const costumerId = user.StripeCostumer
        const response = await axiosInstance.put(`/payment/default/${costumerId}/${id}`);

        setCards(cards.map(card => ({ ...card, isDefault: card._id === id })));
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
        const payment = await axiosInstance.post('/payment/addCard', card)
        // console.log(payment)
        setCards([...cards, payment.data]);
        toast.success('Payment method added successfully');
    } catch (error) {
        toast.error(error.message);
    }
    };

    return (
        <>
        <Toaster/>
            <div className="max-w-screen mx-auto p-5">
                <h2 className="text-2xl font-semibold mb-4">Payment Methods</h2>
                <div className="flex flex-wrap gap-4">
                    {cards.map(card => (
                        <PaymentCard key={card.id} card={card} onDelete={handleDelete} onSetDefault={handleSetDefault} />
                    ))}
                </div>
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