
-- Table to track device fingerprints that already used a trial
CREATE TABLE public.trial_fingerprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  email TEXT NOT NULL,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE UNIQUE INDEX idx_trial_fingerprints_fp ON public.trial_fingerprints(fingerprint);
CREATE INDEX idx_trial_fingerprints_email ON public.trial_fingerprints(email);

-- Enable RLS
ALTER TABLE public.trial_fingerprints ENABLE ROW LEVEL SECURITY;

-- Only service role can manage (no public access)
CREATE POLICY "Service role only" ON public.trial_fingerprints
  FOR ALL USING (false) WITH CHECK (false);
