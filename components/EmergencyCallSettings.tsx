import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeEmergencyCall } from '../utils/twilioService';

interface EmergencyCallSettingsProps {
  contactPhone?: string;
  patientName?: string;
}

export default function EmergencyCallSettings({ contactPhone, patientName }: EmergencyCallSettingsProps) {
  const [autoCallsEnabled, setAutoCallsEnabled] = useState(true);
  
  // Load setting from AsyncStorage
  useEffect(() => {
    const loadSetting = async () => {
      const setting = await AsyncStorage.getItem('autoCallsEnabled');
      if (setting !== null) {
        setAutoCallsEnabled(setting === 'true');
      }
    };
    loadSetting();
  }, []);
  
  // Save setting when changed
  const toggleAutoCalls = async (value: boolean) => {
    setAutoCallsEnabled(value);
    await AsyncStorage.setItem('autoCallsEnabled', value.toString());
    
    Alert.alert(
      value ? 'Emergency Calls Enabled' : 'Emergency Calls Disabled',
      value 
        ? 'Automatic calls will be made to your emergency contacts during critical health events.'
        : 'Automatic calls have been disabled. You can still manually trigger emergency alerts.'
    );
  };
  
  // Handle test call
  const handleTestCall = () => {
    if (!contactPhone) {
      Alert.alert('No Contact Available', 'Please add at least one emergency contact first.');
      return;
    }
    
    Alert.alert(
      'Test Emergency Call',
      'Do you want to send a test emergency call to your first emergency contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Send Test', 
          style: 'default', 
          onPress: async () => {
            const success = await makeEmergencyCall({
              to: contactPhone,
              message: 'This is a test emergency call. No action is required.',
              patientName: patientName || 'Patient'
            });
            
            if (success) {
              Alert.alert('Success', 'Test call initiated successfully.');
            } else {
              Alert.alert('Failed', 'Failed to make test call. Please check your network connection.');
            }
          }
        }
      ]
    );
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="call-outline" size={24} color="#FF5252" />
        <Text style={styles.title}>Emergency Call Settings</Text>
      </View>
      
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Automatic Emergency Calls</Text>
          <Text style={styles.settingDescription}>
            Automatically call contacts when critical health events are detected
          </Text>
        </View>
        <Switch
          value={autoCallsEnabled}
          onValueChange={toggleAutoCalls}
          trackColor={{ false: '#ccc', true: '#FF525280' }}
          thumbColor={autoCallsEnabled ? '#FF5252' : '#f4f3f4'}
        />
      </View>
      
      <TouchableOpacity
        style={styles.testButton}
        onPress={handleTestCall}
      >
        <Text style={styles.testButtonText}>Test Emergency Call</Text>
      </TouchableOpacity>
      
      <Text style={styles.disclaimer}>
        Emergency calls use Twilio to contact your emergency contacts when critical health situations occur.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flex: 1,
    paddingRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  testButton: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  testButtonText: {
    color: '#FF5252',
    fontWeight: '500',
  },
  disclaimer: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  }
});
