// filepath: /e:/RCSLandings/landing_pages/src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('Supabase key is missing. Please check your environment variables.');
} else {
  console.log('Supabase key found:', supabaseKey);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('Supabase client created:', supabase);

// Storage bucket name constant
export const NOTES_BUCKET = 'educational-notes';

// Initialize storage bucket (call this function once in your app)
export const initializeStorageBucket = async () => {
  try {
    // Check if bucket exists, create if it doesn't
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Error listing buckets:', error);
      return;
    }

    const bucketExists = buckets.some(bucket => bucket.name === NOTES_BUCKET);
    
    if (!bucketExists) {
      console.log('Creating storage bucket:', NOTES_BUCKET);
      // Note: Bucket creation typically needs to be done via Supabase dashboard or SQL
      // This is just for reference - you'll need to create the bucket manually
      console.log('Please create the storage bucket manually in Supabase dashboard:');
      console.log('1. Go to Storage in your Supabase dashboard');
      console.log('2. Create new bucket named "educational-notes"');
      console.log('3. Set to public if you want public access');
    } else {
      console.log('Storage bucket already exists:', NOTES_BUCKET);
    }
  } catch (error) {
    console.error('Error initializing storage bucket:', error);
  }
};

// Helper function to check storage connection
export const testStorageConnection = async () => {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) {
      console.error('Storage connection test failed:', error);
      return false;
    }
    console.log('Storage connection successful. Available buckets:', data);
    return true;
  } catch (error) {
    console.error('Storage connection test failed:', error);
    return false;
  }
};

export { supabase };