import React, { useState, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import LogoutButton from '../components/LogoutButton';
import EmergencyCallSettings from '../components/EmergencyCallSettings';

type Contact = {
  id: string;
  name: string;
  relationship: string;
  phone: string;
};

export default function EmergencyContactsScreen() {
  const { userProfile, updateUserProfile } = useContext(AuthContext);
  
  // Convert emergency contacts from profile to our local format
  const initialContacts: Contact[] = userProfile?.emergencyContacts 
    ? userProfile.emergencyContacts.map((contact, index) => ({
        id: index.toString(),
        name: contact.name,
        relationship: contact.relationship,
        phone: contact.phoneNumber,
      }))
    : [];
  
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState<Omit<Contact, 'id'>>({
    name: '',
    relationship: '',
    phone: '',
  });

  const handleAddContact = () => {
    if (!newContact.name || !newContact.phone) {
      Alert.alert('Error', 'Name and phone number are required');
      return;
    }

    const contact = {
      id: Date.now().toString(),
      ...newContact
    };

    const updatedContacts = [...contacts, contact];
    setContacts(updatedContacts);

    // Update user profile in Firebase
    const emergencyContacts = updatedContacts.map(c => ({
      name: c.name,
      relationship: c.relationship,
      phoneNumber: c.phone,
    }));

    updateUserProfile({ emergencyContacts })
      .catch(error => {
        Alert.alert('Error', 'Failed to update contacts');
        console.error('Update error:', error);
      });

    // Reset form
    setNewContact({
      name: '',
      relationship: '',
      phone: '',
    });
    setShowAddForm(false);
  };

  // Find the first contact's phone for testing
  const firstContactPhone = contacts.length > 0 ? contacts[0].phone : undefined;

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: "Emergency Contacts",
          headerRight: () => <LogoutButton color="white" />
        }} 
      />
      <ScrollView style={styles.container}>
        <Text style={styles.description}>
          Add people who should be notified in case of emergency.
        </Text>
        
        {/* Emergency Call Settings */}
        <EmergencyCallSettings 
          contactPhone={firstContactPhone} 
          patientName={userProfile?.displayName}
        />
        
        {/* Emergency Contacts Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Emergency Contacts</Text>
          
          {!showAddForm ? (
            <TouchableOpacity 
              style={styles.addButton} 
              onPress={() => setShowAddForm(true)}
            >
              <Ionicons name="add-circle" size={20} color="white" />
              <Text style={styles.addButtonText}>Add New Contact</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>Add Emergency Contact</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={newContact.name}
                  onChangeText={(text) => setNewContact({...newContact, name: text})}
                  placeholder="Contact name"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Relationship</Text>
                <TextInput
                  style={styles.input}
                  value={newContact.relationship}
                  onChangeText={(text) => setNewContact({...newContact, relationship: text})}
                  placeholder="e.g. Family, Friend, Doctor"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={newContact.phone}
                  onChangeText={(text) => setNewContact({...newContact, phone: text})}
                  placeholder="Phone number"
                  keyboardType="phone-pad"
                />
              </View>
              
              <View style={styles.formButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowAddForm(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleAddContact}
                >
                  <Text style={styles.saveButtonText}>Save Contact</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {contacts.length > 0 ? (
            contacts.map((contact) => (
              <View key={contact.id} style={styles.contactCard}>
                <View style={styles.contactDetails}>
                  <View style={styles.contactNameRow}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                  </View>
                  
                  {contact.relationship && (
                    <Text style={styles.contactRelationship}>{contact.relationship}</Text>
                  )}
                  
                  <Text style={styles.contactPhone}>{contact.phone}</Text>
                </View>
                
                <View style={styles.contactActions}>
                  <TouchableOpacity
                    style={styles.contactActionButton}
                    onPress={() => {
                      const updatedContacts = contacts.filter(c => c.id !== contact.id);
                      setContacts(updatedContacts);
                      
                      // Update profile
                      const emergencyContacts = updatedContacts.map(c => ({
                        name: c.name,
                        relationship: c.relationship,
                        phoneNumber: c.phone,
                      }));
                      
                      updateUserProfile({ emergencyContacts })
                        .catch(error => {
                          Alert.alert('Error', 'Failed to update contacts');
                          console.error('Update error:', error);
                        });
                    }}
                  >
                    <Ionicons name="trash-outline" size={22} color="#FF5252" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="people" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No emergency contacts added yet</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  description: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 20,
  },
  sectionContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  addButton: {
    backgroundColor: '#5C6BC0',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  formContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cancelButton: {
    padding: 12,
    borderRadius: 8,
    width: '48%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#555',
  },
  saveButton: {
    backgroundColor: '#5C6BC0',
    padding: 12,
    borderRadius: 8,
    width: '48%',
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  contactCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
  },
  contactDetails: {
    flex: 1,
  },
  contactNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  contactRelationship: {
    color: '#666',
    marginBottom: 4,
  },
  contactPhone: {
    color: '#666',
  },
  contactActions: {
    justifyContent: 'center',
  },
  contactActionButton: {
    padding: 8,
    marginBottom: 4,
  },
  emptyStateContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyStateText: {
    color: '#888',
    marginTop: 12,
    fontSize: 16,
  },
});
