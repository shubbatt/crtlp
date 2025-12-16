import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../utils/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import type { User, LoginCredentials } from '../../types';

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
}

const initialState: AuthState = {
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    token: localStorage.getItem('auth_token'),
    isAuthenticated: !!localStorage.getItem('auth_token'),
    isLoading: false,
    error: null,
};

// Async thunks
export const login = createAsyncThunk(
    'auth/login',
    async (credentials: LoginCredentials, { rejectWithValue }) => {
        try {
            const { data } = await apiClient.post(API_ENDPOINTS.LOGIN, credentials);

            // Store token, user, and outlet
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            if (data.outlet_id) {
                localStorage.setItem('outlet_id', data.outlet_id.toString());
            }

            return data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || 'Login failed');
        }
    }
);

export const logout = createAsyncThunk('auth/logout', async () => {
    try {
        await apiClient.post(API_ENDPOINTS.LOGOUT);
    } catch (error) {
        // Ignore errors on logout
    } finally {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('outlet_id');
    }
});

export const getCurrentUser = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
    try {
        const { data } = await apiClient.get(API_ENDPOINTS.ME);
        localStorage.setItem('user', JSON.stringify(data));
        return data;
    } catch (error: any) {
        return rejectWithValue(error.response?.data?.error || 'Failed to get user');
    }
});

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        // Login
        builder.addCase(login.pending, (state) => {
            state.isLoading = true;
            state.error = null;
        });
        builder.addCase(login.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isAuthenticated = true;
            state.user = action.payload.user;
            state.token = action.payload.token;
            state.error = null;
        });
        builder.addCase(login.rejected, (state, action) => {
            state.isLoading = false;
            state.isAuthenticated = false;
            state.user = null;
            state.token = null;
            state.error = action.payload as string;
        });

        // Logout
        builder.addCase(logout.fulfilled, (state) => {
            state.isAuthenticated = false;
            state.user = null;
            state.token = null;
            state.error = null;
        });

        // Get current user
        builder.addCase(getCurrentUser.fulfilled, (state, action) => {
            state.user = action.payload;
        });
    },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;
