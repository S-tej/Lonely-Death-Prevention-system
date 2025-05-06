import React, { useState, useContext, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Switch,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { 
  findCaretakerByPhone, 
  findCaretakersByPartialPhone,
  linkPatientToCaretaker, 
  unlinkPatientFromCaretaker, 
  getPatientCaretakers,
  Caretaker
} from '../services/caretakerService';
import LogoutButton from '../components/LogoutButton';
// import Fuse from 'fuse.js';

type Contact = {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  isCaretaker: boolean;
};

export default function CaretakersScreen() {
  const { userProfile, updateUserProfile } = useContext(AuthContext);
  
  // Convert emergency contacts from profile to our local format
  const initialContacts: Contact[] = userProfile?.emergencyContacts 
    ? userProfile.emergencyContacts.map((contact, index) => ({
        id: index.toString(),
        name: contact.name,
        relationship: contact.relationship,
        phone: contact.phoneNumber,
        isCaretaker: contact.isCaretaker,
      }))
    : [];
  
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState<Omit<Contact, 'id'>>({
    name: '',
    relationship: '',
    phone: '',
    isCaretaker: true,
  });

  // State for caretaker search
  const [searchCaretakerPhone, setSearchCaretakerPhone] = useState('');
  const [searchingCaretaker, setSearchingCaretaker] = useState(false);
  const [foundCaretaker, setFoundCaretaker] = useState<{uid: string, name: string} | null>(null);
  const [caretakers, setCaretakers] = useState<Caretaker[]>([]);
  const [loading, setLoading] = useState(false);
  
  // New state for search suggestions
  const [caretakerSuggestions, setCaretakerSuggestions] = useState<Caretaker[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Load caretakers on component mount
  useEffect(() => {
    loadCaretakers();
  }, [userProfile?.uid]);

  const loadCaretakers = async () => {
    if (!userProfile?.uid) return;
    
    setLoading(true);
    try {
      const caretakersList = await getPatientCaretakers(userProfile.uid);
      setCaretakers(caretakersList);
    } catch (error) {
      console.error('Error loading caretakers:', error);
      Alert.alert('Error', 'Failed to load caretakers');
    } finally {
      setLoading(false);
    }
  };

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
      isCaretaker: c.isCaretaker,
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
      isCaretaker: true,
    });
    setShowAddForm(false);
  };

  const handleDeleteContact = (contactId: string) => {
    Alert.alert(
      'Remove Contact',
      'Are you sure you want to remove this contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => {
            const updatedContacts = contacts.filter(c => c.id !== contactId);
            setContacts(updatedContacts);

            // Update user profile in Firebase
            const emergencyContacts = updatedContacts.map(c => ({
              name: c.name,
              relationship: c.relationship,
              phoneNumber: c.phone,
              isCaretaker: c.isCaretaker,
            }));
            
            updateUserProfile({ emergencyContacts })
              .catch(error => {
                Alert.alert('Error', 'Failed to update contacts');
                console.error('Update error:', error);
              });
          }
        }
      ]
    );
  };

  const toggleCaretakerStatus = (contactId: string) => {
    const updatedContacts = contacts.map(contact => {
      if (contact.id === contactId) {
        return { ...contact, isCaretaker: !contact.isCaretaker };
      }
      return contact;
    });
    
    setContacts(updatedContacts);

    // Update user profile in Firebase
    const emergencyContacts = updatedContacts.map(c => ({
      name: c.name,
      relationship: c.relationship,
      phoneNumber: c.phone,
      isCaretaker: c.isCaretaker,
    }));
    
    updateUserProfile({ emergencyContacts })
      .catch(error => {
        Alert.alert('Error', 'Failed to update contacts');
        console.error('Update error:', error);
      });
  };

  // Modified search handler that updates as the user types
  const handleCaretakerPhoneChange = async (text: string) => {
    setSearchCaretakerPhone(text);
    
    if (text.length >= 3) {
      try {
        setSearchingCaretaker(true);
        const matches = await findCaretakersByPartialPhone(text);
        setCaretakerSuggestions(matches);
        setShowSuggestions(matches.length > 0);
      } catch (error) {
        console.error('Error searching caretakers:', error);
      } finally {
        setSearchingCaretaker(false);
      }
    } else {
      setCaretakerSuggestions([]);
      setShowSuggestions(false);
    }
  };
  
  // Handler for selecting a suggested caretaker
  const selectCaretaker = (caretaker: Caretaker) => {
    setFoundCaretaker({
      uid: caretaker.uid,
      name: caretaker.displayName
    });
    setSearchCaretakerPhone(caretaker.phoneNumber);
    setShowSuggestions(false);
  };

  const handleSearchCaretaker = async () => {
    if (!searchCaretakerPhone) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }
    
    try {
      setSearchingCaretaker(true);
      // Check if we already have a match in suggestions
      const existingMatch = caretakerSuggestions.find(c => c.phoneNumber === searchCaretakerPhone);
      
      if (existingMatch) {
        // Use the existing match
        setFoundCaretaker({
          uid: existingMatch.uid,
          name: existingMatch.displayName
        });
      } else {
        // Fall back to regular search
        const caretaker = await findCaretakerByPhone(searchCaretakerPhone);
        
        if (caretaker) {
          setFoundCaretaker({
            uid: caretaker.uid,
            name: caretaker.displayName
          });
        } else {
          Alert.alert('Not Found', 'No caretaker found with this phone number');
          setFoundCaretaker(null);
        }
      }
    } catch (error) {
      console.error('Error searching caretaker:', error);
      Alert.alert('Error', 'Failed to search for caretaker');
    } finally {
      setSearchingCaretaker(false);
      setShowSuggestions(false);
    }
  };

  // Implement the missing addCaretaker function
  const addCaretaker = async () => {
    if (!foundCaretaker || !userProfile?.uid) return;
    
    try {
      // Check if caretaker is already added
      const isAlreadyAdded = caretakers.some(c => c.uid === foundCaretaker.uid);
      
      if (isAlreadyAdded) {
        Alert.alert('Already Added', 'This caretaker is already linked to your account');
        return;
      }
      
      // Link the patient to the caretaker
      await linkPatientToCaretaker(userProfile.uid, foundCaretaker.uid);
      
      // Reset form and reload caretakers
      setSearchCaretakerPhone('');
      setFoundCaretaker(null);
      loadCaretakers();
      
      Alert.alert('Success', 'Caretaker added successfully');
    } catch (error) {
      console.error('Error adding caretaker:', error);
      Alert.alert('Error', 'Failed to add caretaker');
    }
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: "Caretakers & Emergency Contacts",
          headerRight: () => <LogoutButton color="white" />
        }} 
      />
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.description}>
          Add people who should be notified in case of emergency. Contacts marked as caretakers will receive regular health updates.
        </Text>
        
        {/* System Caretakers Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Health App Caretakers</Text>
          <Text style={styles.sectionDescription}>
            Add registered caretakers by their phone number to share your health data securely.
          </Text>
          
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              value={searchCaretakerPhone}
              onChangeText={handleCaretakerPhoneChange}
              placeholder="Enter caretaker's phone number"
              keyboardType="phone-pad"
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearchCaretaker}
              disabled={searchingCaretaker}
            >
              {searchingCaretaker ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.searchButtonText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>
          
          {/* Caretaker suggestions dropdown */}
          {showSuggestions && (
            <View style={styles.suggestionsContainer}>
              {caretakerSuggestions.map(caretaker => (
                <TouchableOpacity
                  key={caretaker.uid}
                  style={styles.suggestionItem}
                  onPress={() => selectCaretaker(caretaker)}
                >
                  <View>
                    <Text style={styles.suggestionName}>{caretaker.displayName}</Text>
                    <Text style={styles.suggestionPhone}>{caretaker.phoneNumber}</Text>
                  </View>
                  <Ionicons name="add-circle" size={24} color="#5C6BC0" />
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          {foundCaretaker && (
            <View style={styles.foundCaretakerContainer}>
              <View style={styles.foundCaretakerInfo}>
                <Text style={styles.foundCaretakerName}>{foundCaretaker.name}</Text>
                <Text style={styles.foundCaretakerPhone}>Phone: {searchCaretakerPhone}</Text>
              </View>
              <TouchableOpacity
                style={styles.addCaretakerButton}
                onPress={addCaretaker}
              >
                <Text style={styles.addCaretakerButtonText}>Add as Caretaker</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {/* ...existing caretaker list code... */}
        </View>
        
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
            <Text style={styles.formTitle}>Add New Contact</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name</Text>
              <TextInput 
                style={styles.input}
                value={newContact.name}
                onChangeText={(text) => setNewContact({...newContact, name: text})}
                placeholder="Enter full name"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Relationship</Text>
              <TextInput 
                style={styles.input}
                value={newContact.relationship}
                onChangeText={(text) => setNewContact({...newContact, relationship: text})}
                placeholder="E.g., Son, Daughter, Nurse"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput 
                style={styles.input}
                value={newContact.phone}
                onChangeText={(text) => setNewContact({...newContact, phone: text})}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
              />
            </View>
            
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Is caretaker?</Text>
              <Switch
                value={newContact.isCaretaker}
                onValueChange={(value) => setNewContact({...newContact, isCaretaker: value})}
                trackColor={{ false: '#cccccc', true: '#5C6BC060' }}
                thumbColor={newContact.isCaretaker ? '#5C6BC0' : '#f4f3f4'}
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
                <Text style={styles.saveButtonText}>Add Contact</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        <Text style={styles.sectionTitle}>
          {contacts.length > 0 ? 'Your Contacts' : ''}
        </Text>
        
        {contacts.length > 0 ? (
          contacts.map((contact) => (
            <View key={contact.id} style={styles.contactCard}>
              <View style={styles.contactDetails}>
                <View style={styles.contactNameRow}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  {contact.isCaretaker && (
                    <View style={styles.caretakerBadge}>
                      <Text style={styles.caretakerBadgeText}>Caretaker</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.contactRelationship}>{contact.relationship}</Text>
                <Text style={styles.contactPhone}>{contact.phone}</Text>
              </View>
              
              <View style={styles.contactActions}>
                <TouchableOpacity 
                  style={styles.contactActionButton}
                  onPress={() => toggleCaretakerStatus(contact.id)}
                >
                  <Ionicons 
                    name={contact.isCaretaker ? "eye" : "eye-off"} 
                    size={20} 
                    color={contact.isCaretaker ? "#5C6BC0" : "#888"} 
                  />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.contactActionButton}
                  onPress={() => handleDeleteContact(contact.id)}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF5252" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="people" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>
              No contacts added yet
            </Text>
          </View>
        )}
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
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
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
  caretakerBadge: {
    backgroundColor: '#5C6BC020',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginLeft: 8,
  },
  caretakerBadgeText: {
    color: '#5C6BC0',
    fontSize: 12,
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
  suggestionsContainer: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  suggestionPhone: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  // Add section container styles
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
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    marginRight: 8,
  },
  searchButton: {
    backgroundColor: '#5C6BC0',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  searchButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  // Add foundCaretaker styles
  foundCaretakerContainer: {
    borderWidth: 1,
    borderColor: '#5C6BC0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#5C6BC020',
  },
  foundCaretakerInfo: {
    marginBottom: 8,
  },
  foundCaretakerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  foundCaretakerPhone: {
    fontSize: 14,
    color: '#666',
  },
  addCaretakerButton: {
    backgroundColor: '#5C6BC0',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  addCaretakerButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});
