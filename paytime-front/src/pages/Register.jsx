import { useState } from "react";
import { axiosInstance } from "../service/axiosInstence";
import { toast , Toaster } from "react-hot-toast";
import { Link } from "react-router-dom";
import InputEmail from "../components/inputs/InputEmail";
import InputPassword from "../components/inputs/InputPassword";
import InputUsername from "../components/inputs/InputUsername";
import CountrySelect from "../components/Select/CountrySelect";
import ButtonSubmit from "../components/buttons/ButtonSubmit";
import ButtonRedirect from "../components/buttons/ButtonRedirect";

export default function Register() {


    const [data, setData] = useState({
        Username: "",
        Email: "",
        Region: "",
        Password: "",
        ConfirmPassword: ""
    });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setData((prevData) => ({
            ...prevData,
            [name]: value
        }));
    };

    const handleChangeCountry = (selectedOption) => {
        const value = selectedOption ? selectedOption.value : '';
        setData((prevData) => ({
            ...prevData,
            Region: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (data.Username === "" || data.Email === "" || data.Region === "" || data.Password === "" || data.ConfirmPassword === "") {
            toast.error("Please fill in all fields");
            return;
        }

        if (data.Password !== data.ConfirmPassword) {
            toast.error("Passwords do not match");
            return;
        }
        if (!emailRegex.test(data.Email)) {
            toast.error("Invalid email address");
            return;
        }

        try {

            const response = await axiosInstance.post("/auth/register", data);
            
            if (response.status === 201) {
                toast.success(response.data.message);
                setData({
                    Username: "",
                    Email: "",
                    Region: "",
                    Password: "",
                    ConfirmPassword: ""
                });
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message || "Something went wrong";
            toast.error(errorMessage);
        }
    };



    return (
        <>
            <Toaster/>
            <div className="flex flex-col gap-4 items-center justify-center h-screen">
                <h1 className="text-2xl font-bold">Register</h1>
                <p className="text-sm text-gray-500 ">Please fill in the form below to create an account.</p>
                <form className="flex w-full flex-col items-center justify-center gap-4" onSubmit={handleSubmit}>
                    <InputUsername placeholder="Username" name="Username" value={data.Username} onChange={handleChange} />
                    <InputEmail placeholder="Email" name="Email" value={data.Email} onChange={handleChange} />
                    <CountrySelect name="Region" onChange={handleChangeCountry} />
                    <InputPassword placeholder="Password" name="Password" value={data.Password} onChange={handleChange} />
                    <InputPassword placeholder="Confirm Password" name="ConfirmPassword" value={data.ConfirmPassword} onChange={handleChange} />
                    <div className="flex flex-row justify-around items-center w-1/2">
                        {/* <ButtonRedirect text="Login" href="/login" /> */}
                        <Link to="/login">Login</Link>
                        <ButtonSubmit text="Register" />
                    </div>
                </form>
            </div>
        </>
    )
}
