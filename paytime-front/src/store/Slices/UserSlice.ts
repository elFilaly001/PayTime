import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Define interfaces for type safety
interface FriendRequest {
  _id: string;
  from: string;
  Username: string;
}

interface Friend {
  _id: string;
  Username: string;
}

interface UserState {
  _id: string;
  Username: string;
  Email: string;
  Friend_list: Friend[];
  Friend_requests: FriendRequest[];
  isLogged: boolean;
  [key: string]: any; // Index signature to allow dynamic property access
}

const initialState: UserState = {
  _id: '',
  Username: '',
  Email: '',
  Friend_list: [],
  Friend_requests: [],
  isLogged: false,
};

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<Partial<UserState>>) => {
      // Ensure we have arrays for Friend_list and Friend_requests
      const user = {
        ...action.payload,
        Friend_list: action.payload.Friend_list || [],
        Friend_requests: action.payload.Friend_requests || [],
      };
      
      console.log('Setting user in Redux:', user);
      
      // Update state with all user properties
      Object.keys(user).forEach(key => {
        state[key as keyof UserState] = user[key as keyof typeof user];
      });
      
      state.isLogged = true;
    },
    addFriendRequest: (state, action) => {
      console.log('Adding friend request to Redux:', action.payload);
      
      // Prevent duplicates
      const exists = state.Friend_requests.some(
        req => req._id === action.payload._id || req.from === action.payload.from
      );
      
      if (!exists) {
        state.Friend_requests.push({
          _id: action.payload._id || action.payload.from,
          from: action.payload.from || action.payload._id,
          Username: action.payload.Username,
        });
      }
    },
    removeFriendRequest: (state, action) => {
      console.log('Removing friend request from Redux:', action.payload);
      
      // Remove the request by ID or from field
      state.Friend_requests = state.Friend_requests.filter(
        req => req._id !== action.payload && req.from !== action.payload
      );
    },
    addFriend: (state, action) => {
      console.log('Adding friend to Redux:', action.payload);
      
      // Prevent duplicates
      const exists = state.Friend_list.some(
        friend => friend._id === action.payload._id 
      );
      
      if (!exists) {
        state.Friend_list.push({
          _id: action.payload._id,
          Username: action.payload.Username,
        });
      }
    },
    removeFriend: (state, action) => {
      console.log('Removing friend from Redux:', action.payload);
      
      state.Friend_list = state.Friend_list.filter(
        friend => friend._id !== action.payload
      );
    },
    logoutUser: () => initialState,
  },
});

export const { setUser, addFriendRequest, removeFriendRequest, addFriend, removeFriend, logoutUser } = userSlice.actions;

// Add a selector to get the user state
export const getUser = (state: { user: UserState }) => state.user;

export default userSlice.reducer; 