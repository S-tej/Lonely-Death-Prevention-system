import React, { useContext, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { AuthContext } from '../context/AuthContext';

export default function Index() {
  const { user, loading } = useContext(AuthContext);

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [loading, user]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lonely Death Prevention System</Text>
      <Text style={styles.subtitle}>Caring for your loved ones remotely</Text>
      <ActivityIndicator size="large" color="#f05545" style={styles.loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  loading: {
    marginTop: 20,
  },
});

// import React, { useEffect, useState } from 'react';
// import { View, Text, ScrollView, StyleSheet } from 'react-native';

// const ESP_IP = 'http://192.168.18.99'; // Replace with your actual ESP32 IP

// // 1. Define the data type (adjust based on ESP JSON structure)
// type SensorData = {
//   temperature: number;
//   heart_rate: number;
//   spo2?: number; // optional if you have SpO2
// };

// const IndexPage: React.FC = () => {
//   const [data, setData] = useState<SensorData | null>(null);

//   useEffect(() => {
//     fetch(`${ESP_IP}`)
//       .then((res) => res.json())
//       .then((json: SensorData) => {
//         console.log('Received:', json);
//         setData(json);
//       })
//       .catch((err) => console.error('Error fetching from ESP32:', err));
//   }, []);

//   return (
//     <ScrollView contentContainerStyle={styles.container}>
//       {data ? (
//         <>
//           <Text style={styles.title}>ESP32 Sensor Data</Text>
//           <Text style={styles.dataText}>🌡️ Temperature: {data.temperature} °C</Text>
//           <Text style={styles.dataText}>❤️ Heart Rate: {data.heart_rate} bpm</Text>
//           {data.spo2 !== undefined && (
//             <Text style={styles.dataText}>🩸 SpO₂: {data.spo2}%</Text>
//           )}
//         </>
//       ) : (
//         <Text style={styles.loading}>Loading data from ESP32...</Text>
//       )}
//     </ScrollView>
//   );
// };

// export default IndexPage;

// // 2. Styles
// const styles = StyleSheet.create({
//   container: {
//     padding: 20,
//     flexGrow: 1,
//     justifyContent: 'center',
//     backgroundColor: '#f5f5f5',
//   },
//   title: {
//     fontSize: 22,
//     fontWeight: 'bold',
//     marginBottom: 20,
//   },
//   dataText: {
//     fontSize: 18,
//     marginVertical: 5,
//   },
//   loading: {
//     fontSize: 18,
//     fontStyle: 'italic',
//   },
// });
