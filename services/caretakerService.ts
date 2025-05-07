import { get, ref, set } from 'firebase/database';
import app, { database } from '../firebase/config';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  query, 
  where, 
  getDocs,
  deleteDoc,
  getFirestore
} from 'firebase/firestore';

const firestore = getFirestore(app);

export type Caretaker = {
  uid: string;
  displayName: string;
  phoneNumber: string;
  email?: string;
  isCaretaker?: boolean;
  patients?: string[];
};

/**
 * Find a caretaker by phone number
 * @param phoneNumber - Phone number to search for
 */
export const findCaretakerByPhone = async (phoneNumber: string): Promise<Caretaker | null> => {
  try {
    // First try firestore
    const usersRef = collection(firestore, 'users');
    const q = query(usersRef, where("phoneNumber", "==", phoneNumber), where("isCaretaker", "==", true));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      return {
        uid: doc.id,
        displayName: data.displayName || 'Unknown',
        phoneNumber: data.phoneNumber,
        email: data.email || '',
        isCaretaker: true
      };
    }
    
    // Try searching in profiles in Realtime Database as fallback
    const profilesRef = ref(database, 'profiles');
    const dbSnapshot = await get(profilesRef);
    
    if (dbSnapshot.exists()) {
      const profiles = dbSnapshot.val();
      
      // Look through all profiles
      for (const uid in profiles) {
        const profile = profiles[uid];
        if (profile.phoneNumber === phoneNumber && profile.isCaretaker === true) {
          return {
            uid,
            displayName: profile.displayName || 'Unknown',
            phoneNumber: profile.phoneNumber,
            email: profile.email || '',
            isCaretaker: true
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error finding caretaker:', error);
    throw error;
  }
};

/**
 * Find caretakers by partial phone number
 * @param partialNumber - The partial phone number to search for
 * @returns Array of matching caretakers
 */
export const findCaretakersByPartialPhone = async (partialNumber: string): Promise<Caretaker[]> => {
  try {
    // Only search if we have at least 3 digits
    if (!partialNumber || partialNumber.length < 3) {
      return [];
    }
    
    // Query all profiles because Firebase doesn't support direct "startsWith" on orderByChild
    const profilesRef = ref(database, 'profiles');
    const snapshot = await get(profilesRef);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    const profiles = snapshot.val();
    const caretakers: Caretaker[] = [];
    
    // Filter profiles manually for those with matching phone numbers and isCaretaker=true
    Object.entries(profiles).forEach(([uid, profile]: [string, any]) => {
      if (
        profile.isCaretaker === true && 
        profile.phoneNumber && 
        profile.phoneNumber.includes(partialNumber)
      ) {
        caretakers.push({
          uid,
          displayName: profile.displayName,
          phoneNumber: profile.phoneNumber,
          email: profile.email || '',
          isCaretaker: true,
          patients: profile.patients || []
        });
      }
    });
    
    return caretakers;
  } catch (error) {
    console.error('Error finding caretakers by partial phone:', error);
    return [];
  }
};

/**
 * Link a patient to a caretaker
 * @param patientId - The patient's user ID
 * @param caretakerId - The caretaker's user ID
 */
export const linkPatientToCaretaker = async (patientId: string, caretakerId: string): Promise<boolean> => {
  try {
    console.log(`Linking patient ${patientId} to caretaker ${caretakerId}`);
    
    // Check if patient and caretaker exist
    // Verify in both Firestore and Realtime Database
    
    // Create the link in Firestore
    const linkData = {
      patientId,
      caretakerId,
      dateLinked: new Date().toISOString()
    };
    
    // Use a unique ID to prevent duplicates
    const linkRef = doc(firestore, 'patient_caretakers', `${patientId}_${caretakerId}`);
    await setDoc(linkRef, linkData);
    
    // Also update the Realtime Database for backward compatibility
    try {
      // Add caretaker to patient's caretakers list
      const patientRef = ref(database, `profiles/${patientId}/caretakers`);
      const patientSnapshot = await get(patientRef);
      let caretakers = patientSnapshot.exists() ? patientSnapshot.val() : [];
      
      if (!Array.isArray(caretakers)) {
        caretakers = [];
      }
      
      if (!caretakers.includes(caretakerId)) {
        caretakers.push(caretakerId);
        await set(patientRef, caretakers);
      }
      
      // Add patient to caretaker's patients list
      const caretakerRef = ref(database, `profiles/${caretakerId}/patients`);
      const caretakerSnapshot = await get(caretakerRef);
      let patients = caretakerSnapshot.exists() ? caretakerSnapshot.val() : [];
      
      if (!Array.isArray(patients)) {
        patients = [];
      }
      
      if (!patients.includes(patientId)) {
        patients.push(patientId);
        await set(caretakerRef, patients);
      }
    } catch (rtdbError) {
      console.warn('Warning: Failed to update Realtime Database links:', rtdbError);
      // Continue since Firestore is our primary storage
    }
    
    console.log('Successfully linked patient and caretaker');
    return true;
  } catch (error) {
    console.error('Error linking patient to caretaker:', error);
    throw error;
  }
};

/**
 * Unlink a patient from a caretaker
 * @param patientId - The patient's user ID
 * @param caretakerId - The caretaker's user ID
 */
export const unlinkPatientFromCaretaker = async (patientId: string, caretakerId: string): Promise<boolean> => {
  try {
    // Remove the link from patient_caretakers collection
    await deleteDoc(doc(firestore, 'patient_caretakers', `${patientId}_${caretakerId}`));
    
    // Also update the Realtime Database for backward compatibility
    try {
      // Remove caretaker from patient's list
      const patientRef = ref(database, `profiles/${patientId}/caretakers`);
      const patientSnapshot = await get(patientRef);
      
      if (patientSnapshot.exists()) {
        let caretakers = patientSnapshot.val();
        if (Array.isArray(caretakers)) {
          caretakers = caretakers.filter(id => id !== caretakerId);
          await set(patientRef, caretakers);
        }
      }
      
      // Remove patient from caretaker's list
      const caretakerRef = ref(database, `profiles/${caretakerId}/patients`);
      const caretakerSnapshot = await get(caretakerRef);
      
      if (caretakerSnapshot.exists()) {
        let patients = caretakerSnapshot.val();
        if (Array.isArray(patients)) {
          patients = patients.filter(id => id !== patientId);
          await set(caretakerRef, patients);
        }
      }
    } catch (rtdbError) {
      console.warn('Warning: Failed to update Realtime Database links:', rtdbError);
      // Continue since Firestore is our primary storage
    }
    
    return true;
  } catch (error) {
    console.error('Error unlinking patient from caretaker:', error);
    throw error;
  }
};

/**
 * Get all caretakers linked to a patient
 * @param patientId - The patient's user ID
 */
export const getPatientCaretakers = async (patientId: string): Promise<Caretaker[]> => {
  try {
    // Query links where this user is the patient
    const linksQuery = query(
      collection(firestore, 'patient_caretakers'),
      where('patientId', '==', patientId)
    );
    
    const linkDocs = await getDocs(linksQuery);
    
    if (linkDocs.empty) return [];
    
    // Get caretaker details for each link
    const caretakers: Caretaker[] = [];
    
    for (const linkDoc of linkDocs.docs) {
      const link = linkDoc.data();
      
      try {
        // Try Firestore first
        const caretakerRef = doc(firestore, 'users', link.caretakerId);
        const caretakerDoc = await getDoc(caretakerRef);
        
        if (caretakerDoc.exists()) {
          const caretakerData = caretakerDoc.data();
          caretakers.push({
            uid: caretakerData.uid || link.caretakerId,
            displayName: caretakerData.displayName || 'Unknown',
            phoneNumber: caretakerData.phoneNumber || '',
            email: caretakerData.email || '',
            isCaretaker: true
          });
          continue; // Skip to next caretaker if found
        }
        
        // Try RTDB if not in Firestore
        const rtdbRef = ref(database, `profiles/${link.caretakerId}`);
        const rtdbSnapshot = await get(rtdbRef);
        
        if (rtdbSnapshot.exists()) {
          const profileData = rtdbSnapshot.val();
          caretakers.push({
            uid: link.caretakerId,
            displayName: profileData.displayName || 'Unknown',
            phoneNumber: profileData.phoneNumber || '',
            email: profileData.email || '',
            isCaretaker: true
          });
        }
      } catch (innerError) {
        console.warn(`Error getting caretaker ${link.caretakerId} details:`, innerError);
      }
    }
    
    return caretakers;
  } catch (error) {
    console.error('Error getting patient caretakers:', error);
    throw error;
  }
};

/**
 * Get all patients linked to a caretaker
 * @param caretakerId - The caretaker's user ID
 */
export const getCaretakerPatients = async (caretakerId: string) => {
  try {
    // Query links where this user is the caretaker
    const linksQuery = query(
      collection(firestore, 'patient_caretakers'),
      where('caretakerId', '==', caretakerId)
    );
    
    const linkDocs = await getDocs(linksQuery);
    
    if (linkDocs.empty) return [];
    
    // Get patient details for each link
    const patients = [];
    
    for (const linkDoc of linkDocs.docs) {
      const link = linkDoc.data();
      
      try {
        // Try Firestore first
        const patientRef = doc(firestore, 'users', link.patientId);
        const patientDoc = await getDoc(patientRef);
        
        if (patientDoc.exists()) {
          patients.push({
            id: link.patientId,
            ...patientDoc.data()
          });
          continue; // Skip to next patient if found
        }
        
        // Try RTDB if not in Firestore
        const rtdbRef = ref(database, `profiles/${link.patientId}`);
        const rtdbSnapshot = await get(rtdbRef);
        
        if (rtdbSnapshot.exists()) {
          patients.push({
            id: link.patientId,
            ...rtdbSnapshot.val()
          });
        }
      } catch (innerError) {
        console.warn(`Error getting patient ${link.patientId} details:`, innerError);
      }
    }
    
    return patients;
  } catch (error) {
    console.error('Error getting caretaker patients:', error);
    throw error;
  }
};

/**
 * Get count of caretakers linked to a patient (for diagnostics)
 * @param patientId - The patient's user ID
 */
export const getPatientCaretakerCount = async (patientId: string): Promise<number> => {
  try {
    // First check Firestore links
    const linksQuery = query(
      collection(firestore, 'patient_caretakers'),
      where('patientId', '==', patientId)
    );
    
    const linkDocs = await getDocs(linksQuery);
    if (!linkDocs.empty) {
      return linkDocs.size;
    }
    
    // Fallback to RTDB
    const rtdbRef = ref(database, `profiles/${patientId}/caretakers`);
    const rtdbSnapshot = await get(rtdbRef);
    
    if (rtdbSnapshot.exists()) {
      const caretakers = rtdbSnapshot.val();
      if (Array.isArray(caretakers)) {
        return caretakers.length;
      }
    }
    
    return 0;
  } catch (error) {
    console.error('Error getting patient caretaker count:', error);
    return 0;
  }
};
