-- Create the rakshak_ratings table
CREATE TABLE IF NOT EXISTS rakshak_ratings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  rakshak_id uuid REFERENCES rakshak_profiles(profile_id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE rakshak_ratings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read ratings
CREATE POLICY "Ratings are viewable by everyone" ON rakshak_ratings
  FOR SELECT USING (true);

-- Allow anyone to insert ratings (or restrict to auth.uid() IS NOT NULL if required)
CREATE POLICY "Anyone can insert ratings" ON rakshak_ratings
  FOR INSERT WITH CHECK (true);

-- Enable real-time for the table so the UI updates automatically
ALTER PUBLICATION supabase_realtime ADD TABLE rakshak_ratings;
