import React, { useState, useEffect, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert 
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
// Fix the Firebase imports
import { database } from '../firebase/config';
import app from '../firebase/config';
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { ref, get } from 'firebase/database';
import LogoutButton from '../components/LogoutButton';

// Define firestore constant after imports
const firestore = getFirestore(app);

interface Patient {
  id: string;
  displayName: string;
  lastUpdate?: string;
  status?: 'normal' | 'warning' | 'critical';
}

export default function CaretakerDashboardScreen() {
  const { user, userProfile, logout } = useContext(AuthContext);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !userProfile) return;

    const loadPatients = async () => {
      try {
        setLoading(true);
        console.log("Loading patients for caretaker:", userProfile.displayName);
        
        // Improved: use the userProfile.phoneNumber to find connections
        if (!userProfile.phoneNumber) {
          console.error('Caretaker has no phone number defined');
          setLoading(false);
          return;
        }
        
        // Get all patients linked to this caretaker via profiles collection
        const patientsData: Patient[] = [];
        
        const patientsQuery = query(
          collection(firestore, 'patient_caretakers'),
          where('caretakerId', '==', user.uid)
        );
        
        const patientDocs = await getDocs(patientsQuery);
        
        if (patientDocs.empty) {
          setPatients([]);
          setLoading(false);
          return;
        }
        
        // Fetch full patient info for each link
        for (const patientDoc of patientDocs.docs) {
          const data = patientDoc.data();
          const patientId = data.patientId;
          
          // Get patient profile from Firestore
          const patientProfileRef = doc(firestore, 'users', patientId);
          const patientProfileSnap = await getDoc(patientProfileRef);
          
          if (patientProfileSnap.exists()) {
            const profile = patientProfileSnap.data();
            
            // Get latest vitals from Realtime Database
            let status: 'normal' | 'warning' | 'critical' = 'normal';
            let lastUpdate = 'N/A';
            
            try {
              const vitalsRef = ref(database, `vitals/${patientId}/current`);
              const vitalsSnap = await get(vitalsRef);
              
              if (vitalsSnap.exists()) {
                const vitals = vitalsSnap.val();
                lastUpdate = new Date(vitals.timestamp).toLocaleString();
                
                // Simple rule-based status evaluation
                if (vitals.heartRate > 100 || vitals.heartRate < 60 || 
                    vitals.oxygenSaturation < 92 || vitals.temperature > 37.8) {
                  status = 'warning';
                }
                
                if (vitals.heartRate > 120 || vitals.heartRate < 50 || 
                    vitals.oxygenSaturation < 88 || vitals.temperature > 39) {
                  status = 'critical';
                }
              }
            } catch (error) {
              console.error('Error fetching vitals data:', error);
            }
            
            patientsData.push({
              id: patientId,
              displayName: profile.displayName || 'Patient',
              lastUpdate,
              status
            });
          }
        }
        
        console.log(`Found ${patientsData.length} patients for caretaker`);
        setPatients(patientsData);
      } catch (error) {
        console.error('Error loading patients:', error);
        Alert.alert('Error', 'Failed to load patients');
      } finally {
        setLoading(false);
      }
    };
    
    loadPatients();
  }, [user, userProfile]);

  const handleLogout = async () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Log Out", 
          style: "destructive",
          onPress: async () => {
            try {
              await logout();
              // Navigation is handled by AuthContext
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            }
          }
        }
      ]
    );
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: "Your Patients",
          headerRight: () => <LogoutButton color="white" />
        }} 
      />
      
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.welcomeText}>
            Welcome, {userProfile?.displayName || 'Caretaker'}
          </Text>
          <Text style={styles.subtitle}>
            Manage and monitor your patients' health
          </Text>
        </View>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#5C6BC0" />
            <Text style={styles.loadingText}>Loading patients...</Text>
          </View>
        ) : patients.length > 0 ? (
          <FlatList
            data={patients}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.patientCard}
                onPress={() => router.push({
                  pathname: './patient-reports',
                  params: { patientId: item.id }
                })}
              >
                <View style={styles.patientInfo}>
                  <Text style={styles.patientName}>{item.displayName}</Text>
                  <Text style={styles.lastUpdated}>Last updated: {item.lastUpdate}</Text>
                </View>
                <View style={styles.statusContainer}>
                  <View style={[
                    styles.statusIndicator, 
                    item.status === 'normal' ? styles.statusNormal : 
                    item.status === 'warning' ? styles.statusWarning : 
                    styles.statusCritical
                  ]} />
                  <Text style={[
                    styles.statusText,
                    item.status === 'normal' ? styles.statusTextNormal : 
                    item.status === 'warning' ? styles.statusTextWarning : 
                    styles.statusTextCritical
                  ]}>
                    {item.status === 'normal' ? 'Normal' : 
                     item.status === 'warning' ? 'Warning' : 'Critical'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#999" />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people" size={64} color="#ccc" />
                <Text style={styles.emptyText}>No patients yet</Text>
                <Text style={styles.emptySubtext}>
                  Patients will appear here when they add you as a caretaker
                </Text>
              </View>
            }
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="people" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No patients yet</Text>
            <Text style={styles.emptySubtext}>
              Patients will appear here when they add you as a caretaker
            </Text>
          </View>
        )}
        
        {/* Logout Button at Bottom */}
        <View style={styles.logoutButtonContainer}>
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="white" />
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  headerContainer: {
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  patientCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#999',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  statusNormal: {
    backgroundColor: '#4CAF50',
  },
  statusWarning: {
    backgroundColor: '#FFC107',
  },
  statusCritical: {
    backgroundColor: '#F44336',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusTextNormal: {
    color: '#4CAF50',
  },
  statusTextWarning: {
    color: '#FFC107',
  },
  statusTextCritical: {
    color: '#F44336',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  logoutButtonContainer: {
    marginTop: 'auto',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  logoutButton: {
    backgroundColor: '#f05545',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
});
