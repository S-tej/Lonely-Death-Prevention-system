import React, { useState, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Switch, 
  Alert,
  TextInput,
  Platform 
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { VitalsContext } from '../context/VitalsContext';
import { AuthContext } from '../context/AuthContext';
import LogoutButton from '../components/LogoutButton';

export default function SettingsScreen() {
  const { thresholds, updateThresholds } = useContext(VitalsContext);
  const { userProfile, updateUserProfile, logout } = useContext(AuthContext);
  
  // Local state for thresholds form
  const [heartRateHigh, setHeartRateHigh] = useState(thresholds.heartRateHigh.toString());
  const [heartRateLow, setHeartRateLow] = useState(thresholds.heartRateLow.toString());
  const [systolicHigh, setSystolicHigh] = useState(thresholds.bloodPressureHigh.systolic.toString());
  const [systolicLow, setSystolicLow] = useState(thresholds.bloodPressureLow.systolic.toString());
  const [diastolicHigh, setDiastolicHigh] = useState(thresholds.bloodPressureHigh.diastolic.toString());
  const [diastolicLow, setDiastolicLow] = useState(thresholds.bloodPressureLow.diastolic.toString());
  const [oxygenLow, setOxygenLow] = useState(thresholds.oxygenSaturationLow.toString());
  const [temperatureHigh, setTemperatureHigh] = useState(thresholds.temperatureHigh.toString());
  const [temperatureLow, setTemperatureLow] = useState(thresholds.temperatureLow.toString());
  
  // Notification settings
  const [notifications, setNotifications] = useState({
    alertsEnabled: true,
    dailyReportsEnabled: true,
    caretakerUpdates: true,
    vibrateOnAlert: true,
    soundOnAlert: true
  });
  
  const toggleSwitch = (setting: string) => {
    setNotifications(prevState => ({
      ...prevState,
      [setting]: !prevState[setting as keyof typeof prevState]
    }));
  };

  const handleSaveThresholds = async () => {
    try {
      // Validate input values
      const hrHigh = parseInt(heartRateHigh);
      const hrLow = parseInt(heartRateLow);
      const sysHigh = parseInt(systolicHigh);
      const sysLow = parseInt(systolicLow);
      const diaHigh = parseInt(diastolicHigh);
      const diaLow = parseInt(diastolicLow);
      const oxyLow = parseInt(oxygenLow);
      const tempHigh = parseFloat(temperatureHigh);
      const tempLow = parseFloat(temperatureLow);
      
      // Basic validation
      if (hrLow >= hrHigh) {
        Alert.alert('Error', 'Heart rate low threshold must be less than high threshold');
        return;
      }
      
      if (sysLow >= sysHigh) {
        Alert.alert('Error', 'Systolic low threshold must be less than high threshold');
        return;
      }
      
      if (diaLow >= diaHigh) {
        Alert.alert('Error', 'Diastolic low threshold must be less than high threshold');
        return;
      }
      
      if (tempLow >= tempHigh) {
        Alert.alert('Error', 'Temperature low threshold must be less than high threshold');
        return;
      }
      
      // Update thresholds
      await updateThresholds({
        heartRateHigh: hrHigh,
        heartRateLow: hrLow,
        bloodPressureHigh: {
          systolic: sysHigh,
          diastolic: diaHigh
        },
        bloodPressureLow: {
          systolic: sysLow,
          diastolic: diaLow
        },
        oxygenSaturationLow: oxyLow,
        temperatureHigh: tempHigh,
        temperatureLow: tempLow
      });
      
      Alert.alert('Success', 'Alert thresholds have been updated');
    } catch (error) {
      console.error('Failed to update thresholds:', error);
      Alert.alert('Error', 'Failed to update thresholds');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/login');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to log out');
            }
          }
        }
      ]
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: "Settings" }} />
      <ScrollView style={styles.container}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alert Thresholds</Text>
          <Text style={styles.sectionDescription}>
            Set threshold values for vital sign alerts
          </Text>
          
          <View style={styles.settingCard}>
            <Text style={styles.settingTitle}>Heart Rate (BPM)</Text>
            <View style={styles.thresholdInputRow}>
              <View style={styles.thresholdInputContainer}>
                <Text style={styles.thresholdLabel}>High</Text>
                <TextInput
                  style={styles.thresholdInput}
                  value={heartRateHigh}
                  onChangeText={setHeartRateHigh}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.thresholdInputContainer}>
                <Text style={styles.thresholdLabel}>Low</Text>
                <TextInput
                  style={styles.thresholdInput}
                  value={heartRateLow}
                  onChangeText={setHeartRateLow}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>
          
          <View style={styles.settingCard}>
            <Text style={styles.settingTitle}>Blood Pressure (mmHg)</Text>
            <View style={styles.bpContainer}>
              <Text style={styles.bpLabel}>Systolic</Text>
              <View style={styles.thresholdInputRow}>
                <View style={styles.thresholdInputContainer}>
                  <Text style={styles.thresholdLabel}>High</Text>
                  <TextInput
                    style={styles.thresholdInput}
                    value={systolicHigh}
                    onChangeText={setSystolicHigh}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.thresholdInputContainer}>
                  <Text style={styles.thresholdLabel}>Low</Text>
                  <TextInput
                    style={styles.thresholdInput}
                    value={systolicLow}
                    onChangeText={setSystolicLow}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              
              <Text style={[styles.bpLabel, {marginTop: 16}]}>Diastolic</Text>
              <View style={styles.thresholdInputRow}>
                <View style={styles.thresholdInputContainer}>
                  <Text style={styles.thresholdLabel}>High</Text>
                  <TextInput
                    style={styles.thresholdInput}
                    value={diastolicHigh}
                    onChangeText={setDiastolicHigh}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.thresholdInputContainer}>
                  <Text style={styles.thresholdLabel}>Low</Text>
                  <TextInput
                    style={styles.thresholdInput}
                    value={diastolicLow}
                    onChangeText={setDiastolicLow}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>
          </View>
          
          <View style={styles.settingCard}>
            <Text style={styles.settingTitle}>SpO₂ (%)</Text>
            <View style={styles.thresholdInputRow}>
              <View style={styles.thresholdInputContainer}>
                <Text style={styles.thresholdLabel}>Low</Text>
                <TextInput
                  style={styles.thresholdInput}
                  value={oxygenLow}
                  onChangeText={setOxygenLow}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.thresholdInputContainer}>
                {/* Empty container for layout */}
              </View>
            </View>
          </View>
          
          <View style={styles.settingCard}>
            <Text style={styles.settingTitle}>Temperature (°C)</Text>
            <View style={styles.thresholdInputRow}>
              <View style={styles.thresholdInputContainer}>
                <Text style={styles.thresholdLabel}>High</Text>
                <TextInput
                  style={styles.thresholdInput}
                  value={temperatureHigh}
                  onChangeText={setTemperatureHigh}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.thresholdInputContainer}>
                <Text style={styles.thresholdLabel}>Low</Text>
                <TextInput
                  style={styles.thresholdInput}
                  value={temperatureLow}
                  onChangeText={setTemperatureLow}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.saveButton}
            onPress={handleSaveThresholds}
          >
            <Text style={styles.saveButtonText}>Save Thresholds</Text>
          </TouchableOpacity>
        </View>
        
        {/* <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingName}>Health Alerts</Text>
              <Text style={styles.settingDescription}>Notifications for health anomalies</Text>
            </View>
            <Switch
              value={notifications.alertsEnabled}
              onValueChange={() => toggleSwitch('alertsEnabled')}
              trackColor={{ false: '#cccccc', true: '#f0554580' }}
              thumbColor={notifications.alertsEnabled ? '#f05545' : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingName}>Daily Reports</Text>
              <Text style={styles.settingDescription}>Receive daily health summaries</Text>
            </View>
            <Switch
              value={notifications.dailyReportsEnabled}
              onValueChange={() => toggleSwitch('dailyReportsEnabled')}
              trackColor={{ false: '#cccccc', true: '#f0554580' }}
              thumbColor={notifications.dailyReportsEnabled ? '#f05545' : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingName}>Caretaker Updates</Text>
              <Text style={styles.settingDescription}>Allow caretakers to receive updates</Text>
            </View>
            <Switch
              value={notifications.caretakerUpdates}
              onValueChange={() => toggleSwitch('caretakerUpdates')}
              trackColor={{ false: '#cccccc', true: '#f0554580' }}
              thumbColor={notifications.caretakerUpdates ? '#f05545' : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingName}>Vibrate on Alert</Text>
              <Text style={styles.settingDescription}>Device will vibrate for alerts</Text>
            </View>
            <Switch
              value={notifications.vibrateOnAlert}
              onValueChange={() => toggleSwitch('vibrateOnAlert')}
              trackColor={{ false: '#cccccc', true: '#f0554580' }}
              thumbColor={notifications.vibrateOnAlert ? '#f05545' : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingName}>Sound on Alert</Text>
              <Text style={styles.settingDescription}>Play sound for alerts</Text>
            </View>
            <Switch
              value={notifications.soundOnAlert}
              onValueChange={() => toggleSwitch('soundOnAlert')}
              trackColor={{ false: '#cccccc', true: '#f0554580' }}
              thumbColor={notifications.soundOnAlert ? '#f05545' : '#f4f3f4'}
            />
          </View>
        </View> */}
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity 
            style={styles.accountRow}
            onPress={() => router.push('/profile-setup')}
          >
            <Ionicons name="person-outline" size={24} color="#333" />
            <Text style={styles.accountRowText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={24} color="#ccc" />
          </TouchableOpacity>
          
          {/* <TouchableOpacity 
            style={styles.accountRow}
            onPress={() => router.push('/devices')}
          > */}
            {/* <Ionicons name="hardware-chip" size={24} color="#333" />
            <Text style={styles.accountRowText}>Manage Devices</Text>
            <Ionicons name="chevron-forward" size={24} color="#ccc" />
          </TouchableOpacity> */}
          
          <TouchableOpacity 
            style={styles.accountRow}
            onPress={() => router.push('/caretakers')}
          >
            <Ionicons name="people-outline" size={24} color="#333" />
            <Text style={styles.accountRowText}>Manage Caretakers</Text>
            <Ionicons name="chevron-forward" size={24} color="#ccc" />
          </TouchableOpacity>
          
          <View style={[styles.accountRow, { borderBottomWidth: 0 }]}>
            <LogoutButton 
              color="#FF5252" 
              showText={true} 
              iconSize={24}
              style={{
                flex: 1, 
                justifyContent: 'flex-start',
              }}
              confirmLogout={true}
            />
          </View>
        </View>
        
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>Lonely Death Prevention System v1.0.0</Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  settingCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  thresholdInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  thresholdInputContainer: {
    width: '45%',
  },
  thresholdLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  thresholdInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: 'white',
  },
  bpContainer: {
    marginBottom: 8,
  },
  bpLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginBottom: 8,
  },
  saveButton: {
    backgroundColor: '#5C6BC0',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  settingName: {
    fontSize: 16,
    color: '#333',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: '#888',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  accountRowText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  appInfo: {
    alignItems: 'center',
    padding: 16,
    marginBottom: 16,
  },
  appVersion: {
    color: '#888',
    fontSize: 12,
  },
});
