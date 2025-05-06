import React, { createContext, useState, useEffect, ReactNode, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { ref, set, get } from 'firebase/database';
import { database } from '../firebase/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  registerUser,
  loginWithPassword,
  sendPasswordResetEmail as sendResetEmail,
  updateUserProfile as updateProfile,
  ensureUserProfile
} from '../utils/customAuthUtils'; // Fixed path to point to utils directory
import { router } from 'expo-router';

type AuthContextType = {
  user: any;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string, isCaretaker?: boolean, phoneNumber?: string) => Promise<{ uid: string; email: string; displayName: string; createdAt: number; lastLoginAt: number; }>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  userProfile: UserProfile | null;
  authError: string | null;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  clearAuthError: () => void;
};

type UserProfile = {
  uid: string;
  displayName: string;
  age: number;
  gender: string;
  bloodGroup: string;
  hasBpHigh: number;
  hasBpLow: number;
  height: number;
  hasDiabetes: number;
  weight: number;
  emergencyContacts: EmergencyContact[];
  medicalConditions: string[];
  medications: string[];
  isCaretaker?: boolean;
  phoneNumber?: string;
};

type EmergencyContact = {
  isCaretaker: any;
  name: string;
  relationship: string;
  phoneNumber: string;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async (email: string, password: string, displayName: string, isCaretaker?: boolean, phoneNumber?: string) => ({ 
    uid: '', 
    email: '', 
    displayName: '', 
    createdAt: 0, 
    lastLoginAt: 0 
  }),
  logout: async () => {},
  updateUserProfile: async () => {},
  userProfile: null,
  authError: null,
  sendPasswordResetEmail: async () => {},
  clearAuthError: () => {},
});


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const appState = useRef(AppState.currentState);
  const backgroundTimeRef = useRef<number | null>(null);
  
  // Session timeout in milliseconds (1 minutes)
  const SESSION_TIMEOUT = 1 * 60 * 1000;

  // Check for stored user session on startup
  useEffect(() => {
    const loadStoredUser = async () => {
      try {
        // Get minimal user session info from AsyncStorage
        const userIdJson = await AsyncStorage.getItem('currentUserId');
        const lastActiveTime = await AsyncStorage.getItem('lastActiveTime');
        
        if (userIdJson && lastActiveTime) {
          const now = Date.now();
          const lastActive = parseInt(lastActiveTime, 10);
          
          // If session hasn't expired, restore the user from database
          if (now - lastActive < SESSION_TIMEOUT) {
            const userId = JSON.parse(userIdJson);
            
            // Get fresh user data from database
            const userSnapshot = await get(ref(database, `users/${userId}`));
            if (userSnapshot.exists()) {
              const userData = userSnapshot.val();
              // Remove password hash for security
              const { hashedPassword, ...userWithoutPassword } = userData;
              setUser(userWithoutPassword);
              
              // Update the last active time
              await AsyncStorage.setItem('lastActiveTime', now.toString());
              
              // Get user profile data
              const profileRef = ref(database, `profiles/${userId}`);
              const profileSnapshot = await get(profileRef);
              
              if (profileSnapshot.exists()) {
                const profileData = profileSnapshot.val();
                setUserProfile(profileData);
                
                // Route based on user type
                if (profileData.isCaretaker === true) {
                  console.log('Session restored as caretaker');
                  setTimeout(() => router.replace('/caretaker-dashboard'), 100);
                } else {
                  console.log('Session restored as patient');
                  setTimeout(() => router.replace('/dashboard'), 100);
                }
              } else {
                // Create default profile
                console.log('Session restored but no profile, creating default');
                const profile = await ensureUserProfile(userWithoutPassword);
                if (profile) {
                  setUserProfile(profile as UserProfile);
                  // Default to patient dashboard
                  setTimeout(() => router.replace('/dashboard'), 100);
                }
              }
            } else {
              // User no longer exists in database
              await AsyncStorage.multiRemove(['currentUserId', 'lastActiveTime']);
              setLoading(false);
            }
          } else {
            // Session expired, clear storage
            await AsyncStorage.multiRemove(['currentUserId', 'lastActiveTime']);
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error loading stored user:", error);
        setLoading(false);
      }
    };
    
    loadStoredUser();
    
    // Listen for app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, []);

  // Handle app state changes (active, background, inactive)
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (appState.current.match(/active/) && nextAppState.match(/inactive|background/)) {
      // App is going to background
      backgroundTimeRef.current = Date.now();
      
      // Store the current time as last active time
      if (user) {
        await AsyncStorage.setItem('lastActiveTime', Date.now().toString());
      }
    } else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App is coming back to foreground
      if (backgroundTimeRef.current && user) {
        const now = Date.now();
        const timeInBackground = now - backgroundTimeRef.current;
        
        // If the app was in background for longer than the timeout period, logout
        if (timeInBackground > SESSION_TIMEOUT) {
          logout();
        } else {
          // Update the last active time
          await AsyncStorage.setItem('lastActiveTime', now.toString());
        }
      }
    }
    
    appState.current = nextAppState;
  };

  const fetchUserProfile = async (uid: string) => {
    try {
      const profileRef = ref(database, `profiles/${uid}`);
      const snapshot = await get(profileRef);
      
      if (snapshot.exists()) {
        const profileData = snapshot.val();
        setUserProfile(profileData);
        return profileData; // Return the profile data for use in other functions
      } else {
        // Create a default profile if none exists
        if (user) {
          const profile = await ensureUserProfile(user);
          if (profile) {
            setUserProfile(profile as UserProfile);
            return profile;
          }
        }
      }
      return null;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      setAuthError("Failed to load user profile");
      throw error;
    }
  };

  // Login function to ensure proper routing based on user role
  const login = async (email: string, password: string) => {
    setAuthError(null);
    try {
      const loggedInUser = await loginWithPassword(email, password);
      
      // Store minimal user info in AsyncStorage (just ID)
      setUser(loggedInUser);
      await AsyncStorage.setItem('currentUserId', JSON.stringify(loggedInUser.uid));
      await AsyncStorage.setItem('lastActiveTime', Date.now().toString());
      
      // Fetch user profile
      const profileRef = ref(database, `profiles/${loggedInUser.uid}`);
      const profileSnapshot = await get(profileRef);
      
      if (profileSnapshot.exists()) {
        const profileData = profileSnapshot.val();
        setUserProfile(profileData);
        
        // Debug log to identify the profile data
        console.log('User profile loaded:', {
          uid: profileData.uid,
          displayName: profileData.displayName,
          isCaretaker: profileData.isCaretaker
        });
        
        // Check if user is a caretaker and route accordingly
        if (profileData.isCaretaker === true) {
          console.log('Successfully identified as caretaker, redirecting to caretaker dashboard');
          router.replace('/caretaker-dashboard');
        } else {
          console.log('Identified as patient, redirecting to dashboard');
          router.replace('/dashboard');
        }
      } else {
        // No profile exists, create one
        await fetchUserProfile(loggedInUser.uid);
        // Default to patient dashboard if we can't determine type
        console.log('No profile found, redirecting to patient dashboard');
        setTimeout(() => router.replace('/dashboard'), 100);
      }
      
    } catch (error: any) {
      setAuthError(error.message || "Login failed");
      throw error;
    }
  };

  const register = async (email: string, password: string, displayName: string, isCaretaker = false, phoneNumber = '') => {
    setAuthError(null);
    try {
      const newUser = await registerUser(email, password, displayName);
      
      // Store minimal user info in AsyncStorage (just ID)
      setUser(newUser);
      await AsyncStorage.setItem('currentUserId', JSON.stringify(newUser.uid));
      await AsyncStorage.setItem('lastActiveTime', Date.now().toString());
      
      // Create initial profile with new fields - explicitly set isCaretaker flag
      const initialProfile: UserProfile = {
        uid: newUser.uid, // Ensure proper ID is used
        displayName,
        age: 0,
        gender: '',
        bloodGroup: '',
        hasBpHigh: 0,
        hasBpLow: 0,
        height: 0,
        hasDiabetes: 0,
        weight: 0,
        emergencyContacts: [],
        medicalConditions: [],
        medications: [],
        isCaretaker: isCaretaker ? true : false, // Ensure boolean value
        phoneNumber: isCaretaker ? phoneNumber : '',
      };
      
      // Set the profile in the database with correct ID
      await set(ref(database, `profiles/${newUser.uid}`), initialProfile);
      setUserProfile(initialProfile);
      
      // Initialize thresholds for new patient accounts (skip for caretakers)
      if (!isCaretaker) {
        await set(ref(database, `vitals/${newUser.uid}/thresholds`), {
          heartRateHigh: 100,
          heartRateLow: 60,
          bloodPressureHigh: {
            systolic: 140,
            diastolic: 90
          },
          bloodPressureLow: {
            systolic: 90,
            diastolic: 60
          },
          oxygenSaturationLow: 92,
          temperatureHigh: 37.8,
          temperatureLow: 35.5
        });
      }
      
      // Log registration information
      console.log(`Registered new user as ${isCaretaker ? 'caretaker' : 'patient'} with ID: ${newUser.uid}`);
      
      return newUser;
    } catch (error: any) {
      setAuthError(error.message || "Registration failed");
      throw error;
    }
  };

  const logout = async () => {
    setAuthError(null);
    try {
      // Clear user from state and AsyncStorage
      setUser(null);
      setUserProfile(null);
      await AsyncStorage.multiRemove(['currentUserId', 'lastActiveTime']);
      router.replace('/login');
    } catch (error) {
      setAuthError("Failed to log out");
      throw error;
    }
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      const updatedProfile = { ...userProfile, ...data };
      await set(ref(database, `profiles/${user.uid}`), updatedProfile);
      setUserProfile(updatedProfile as UserProfile);
    } catch (error) {
      setAuthError("Failed to update profile");
      throw error;
    }
  };

  const sendPasswordResetEmail = async (email: string) => {
    try {
      await sendResetEmail(email);
    } catch (error: any) {
      setAuthError(error.message || "Failed to send reset email");
      throw error;
    }
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      register, 
      logout, 
      updateUserProfile,
      userProfile,
      authError,
      sendPasswordResetEmail,
      clearAuthError
    }}>
      {children}
    </AuthContext.Provider>
  );
};