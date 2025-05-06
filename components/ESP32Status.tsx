import React, { useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VitalsContext } from '../context/VitalsContext';

const ESP32Status = () => {
  const { isESP32Connected } = useContext(VitalsContext);
  
  return (
    <View style={styles.container}>
      <View style={[
        styles.statusIndicator, 
        { backgroundColor: isESP32Connected ? '#4CAF50' : '#FFC107' }
      ]} />
      <Text style={styles.statusText}>
        {isESP32Connected 
          ? 'Real Data: ESP32 Connected' 
          : 'Simulation Mode: ESP32 Disconnected'}
      </Text>
      <Ionicons 
        name={isESP32Connected ? "hardware-chip" : "pulse"} 
        size={18} 
        color={isESP32Connected ? "#4CAF50" : "#FFC107"} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 16,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#555',
    marginRight: 8,
  }
});

export default ESP32Status;
