import InputOTP from "../components/inputs/InputOTP";
import { useRef  } from "react";
import ButtonSubmit from "../components/buttons/ButtonSubmit";
import { Toaster, toast } from "react-hot-toast";
import { useLocation , useNavigate} from "react-router-dom";
import {axiosInstance} from "../service/axiosInstence";

export default function OTP() {
    const location = useLocation();
    const navigate = useNavigate();
    const inputRefs = [
        useRef(null),
        useRef(null),
        useRef(null),
        useRef(null),
        useRef(null),
        useRef(null),
    ];

    const handleChange = (index, value) => {
        const numericValue = value.replace(/[^0-9]/g, '');

        if (inputRefs[index].current) {
            inputRefs[index].current.value = numericValue;
        }

        if (numericValue.length === 1) {
            const nextEmptyIndex = inputRefs.findIndex((ref, i) =>
                i > index && (!ref.current?.value || ref.current.value === '')
            );

            if (nextEmptyIndex !== -1) {
                inputRefs[nextEmptyIndex].current?.focus();
            }
        }
    };

    const handleFocus = (index) => {
        for (let i = index; i >= 0; i--) {
            if (inputRefs[i].current?.value === '') {
                inputRefs[i].current?.focus();
            }
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !inputRefs[index].current?.value) {
            if (index > 0) {
                inputRefs[index - 1].current?.focus();
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const otp = inputRefs.map(ref => ref.current?.value).join('');
        if (otp.length !== 6) {
            toast.error("OTP must be 6 digits");
            return;
        }

        const userId = location.state.userId;

        try {
            console.log(userId)
            const response = await axiosInstance.post("auth/verify-otp", { otp, userId });
            console.log(response);
            toast.success("OTP submitted");
            localStorage.setItem("token", response.data.token);
            location.state.userId = null;
            navigate("/");
        } catch (error) {
            console.log(error);
            toast.error("OTP incorrect , please try again");
        }

    };

    return (
        <>
            <Toaster/>
            <div className="flex flex-col gap-4 items-center justify-center h-screen">
                <p className="text-sm text-gray-500">Please enter the code sent to your email</p>
                <form className="flex flex-col gap-4 items-center justify-center" onSubmit={handleSubmit}>
                <div className="flex flex-row gap-4">

                    {inputRefs.map((ref, index) => (
                        <InputOTP
                            key={index}
                            ref={ref}
                            className="text-center"
                            onChange={(e) => handleChange(index, e.target.value)}
                            onFocus={() => handleFocus(index)}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                        />
                    ))}
                </div>
                <ButtonSubmit text="Submit" />
                </form>
            </div>
        </>
    );
}

