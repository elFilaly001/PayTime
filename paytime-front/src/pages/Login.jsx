import { toast, Toaster } from "react-hot-toast";
import { Link } from "react-router-dom";
import { useState } from "react";
import {axiosInstance} from "../service/axiosInstence.js";
import InputEmail from "../components/inputs/InputEmail.jsx";
import InputPassword from "../components/inputs/InputPassword.jsx";
import ButtonSubmit from "../components/buttons/ButtonSubmit.jsx";
import { useNavigate } from "react-router-dom";
import { useDispatch , useSelector } from "react-redux";
import { setUser } from "../store/Slices/UserSlice.ts";


export default function Login() {

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const [data, setData] = useState({
    Email: "",
    Password: ""
  });


  const handleChange = (e) => {
    setData({ ...data, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (data.Username === "" || data.Email === "" || data.Region === "" || data.Password === "" || data.ConfirmPassword === "") {
      toast.error("Please fill in all fields");
      return;
  }

  if (!emailRegex.test(data.Email)) {
      toast.error("Invalid email address");
      return;
  }

  try {
    const response = await axiosInstance.post("/auth/login", data);
    console.log(response);

    if (response.data.requiresOTP) {
      navigate("/otp", { state: { userId: response.data.userId } });
      return;
    }else{
      dispatch(setUser(response.data.User));
      navigate("/");
    }
  } catch (error) {
    console.log(error);
  }
  };


  return (
    <>
            <Toaster/>
            <div className="flex flex-col gap-4 items-center justify-center h-screen">
                <h1 className="text-2xl font-bold">Login</h1>
                <form className="flex w-full flex-col items-center justify-center gap-4" onSubmit={handleSubmit}>
                    <InputEmail placeholder="Email" name="Email" value={data.Email} onChange={handleChange} />
                    <InputPassword placeholder="Password" name="Password" value={data.Password} onChange={handleChange} />
                    <div className="flex flex-row justify-around items-center w-1/2">
                        {/* <ButtonRedirect text="Login" href="/login" /> */}
                        <ButtonSubmit text="Login" />
                        <Link to="/register">Register</Link>
                    </div>
                </form>
            </div>
    </>
  )
}
