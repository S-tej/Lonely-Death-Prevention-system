import React, { useState, useContext } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch
} from 'react-native';
import { router } from 'expo-router';
import { AuthContext } from '../context/AuthContext';
import { Stack } from 'expo-router';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isCaretaker, setIsCaretaker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { register } = useContext(AuthContext);

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (isCaretaker && !phoneNumber) {
      Alert.alert('Error', 'Phone number is required for caretakers');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password should be at least 6 characters');
      return;
    }

    try {
      setIsLoading(true);
      const newUser = await register(email, password, name, isCaretaker, phoneNumber);
      
      if (isCaretaker) {
        // Direct caretakers to their dashboard
        Alert.alert('Success', 'Caretaker account created successfully!', [
          { text: 'OK', onPress: () => router.replace('/caretaker-dashboard') } // Use replace instead of push
        ]);
      } else {
        // Direct patients to profile setup
        Alert.alert('Success', 'Account created successfully! Please complete your profile.', [
          { text: 'OK', onPress: () => router.push('/profile-setup') }
        ]);
      }
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Create Account" }} />
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.formContainer}>
            <Text style={styles.title}>Join LDPS</Text>
            <Text style={styles.subtitle}>Create an account to monitor your health</Text>

            {/* Role Selection */}
            <View style={styles.roleContainer}>
              <Text style={styles.roleTitle}>I am registering as a:</Text>
              <View style={styles.roleOptions}>
                <TouchableOpacity 
                  style={[styles.roleButton, !isCaretaker && styles.roleButtonActive]}
                  onPress={() => setIsCaretaker(false)}
                >
                  <Text style={[styles.roleButtonText, !isCaretaker && styles.roleButtonTextActive]}>
                    Patient
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.roleButton, isCaretaker && styles.roleButtonActive]}
                  onPress={() => setIsCaretaker(true)}
                >
                  <Text style={[styles.roleButtonText, isCaretaker && styles.roleButtonTextActive]}>
                    Caretaker
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Regular fields */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your full name"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Phone Number - mandatory for caretakers */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                Phone Number {isCaretaker && <Text style={styles.required}>*</Text>}
              </Text>
              <TextInput
                style={styles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
              />
              {isCaretaker && (
                <Text style={styles.helperText}>
                  Phone number is required for caretakers to allow patients to add you.
                </Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Create a password"
                secureTextEntry
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your password"
                secureTextEntry
              />
            </View>

            <TouchableOpacity 
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/login')}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  formContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#f05545',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#f0554580',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginText: {
    color: '#666',
    fontSize: 14,
  },
  loginLink: {
    color: '#f05545',
    fontSize: 14,
    fontWeight: 'bold',
  },
  roleContainer: {
    marginBottom: 20,
  },
  roleTitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
  },
  roleOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roleButton: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    marginHorizontal: 5,
    borderRadius: 8,
  },
  roleButtonActive: {
    backgroundColor: '#f05545',
    borderColor: '#f05545',
  },
  roleButtonText: {
    color: '#333',
    fontWeight: '500',
  },
  roleButtonTextActive: {
    color: 'white',
  },
  required: {
    color: '#f05545',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
});