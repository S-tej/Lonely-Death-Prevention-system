import React, { useContext } from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AlertsContext } from '../context/AlertsContext';

type EmergencyButtonProps = {
  message?: string;
};

const EmergencyButton: React.FC<EmergencyButtonProps> = ({ message = "Emergency assistance requested!" }) => {
  const { triggerEmergency } = useContext(AlertsContext);
  
  const handleEmergencyPress = async () => {
    console.log("Emergency button pressed - triggering emergency alert");
    try {
      const result = await triggerEmergency(message);
      console.log("Emergency triggered:", result);
    } catch (error) {
      console.error("Failed to trigger emergency:", error);
    }
  };
  
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={handleEmergencyPress} activeOpacity={0.8}>
        <Ionicons name="alert-circle" size={32} color="white" />
        <Text style={styles.text}>EMERGENCY</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 16,
  },
  button: {
    backgroundColor: '#FF3B30',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: '80%',
    elevation: 4,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  text: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
    marginLeft: 8,
  },
});

export default EmergencyButton;
