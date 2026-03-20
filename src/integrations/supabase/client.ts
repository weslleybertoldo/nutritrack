import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qyikubuqyhobppvojvpa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5aWt1YnVxeWhvYnBwdm9qdnBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5ODM5NDUsImV4cCI6MjA4OTU1OTk0NX0.YYhbW3KrkXtBDBb4Wpnvfrbl8hzb8-ixet54prpD6_U";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
