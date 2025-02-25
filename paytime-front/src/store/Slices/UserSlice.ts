import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UserState {
  _id: string;
  Username: string;
  Email: string;
  Region: string;
  Friend_Code: string;
  Friend_list: string[];
  Friend_requests: string[];
  Role: string;
  StripeCostumer: string;
}

const initialState: UserState = {
  _id: "",
  Username: "",
  Email: "",
  Region: "",
  Friend_Code: "",
  Friend_list: [],
  Friend_requests: [],
  Role: "",
  StripeCostumer: "",
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<UserState>) => {
      return { ...state, ...action.payload };
    },
    clearUser: () => initialState,
    updateUser: (state, action: PayloadAction<Partial<UserState>>) => {
      return { ...state, ...action.payload };
    },
    getUser: (state) => state,
  },
});

export const { setUser, clearUser, updateUser , getUser } = userSlice.actions;
export default userSlice.reducer;
