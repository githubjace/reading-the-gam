// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://vzzagzkmedupwflxxoym.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6emFnemttZWR1cHdmbHh4b3ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2Nzc2MjAsImV4cCI6MjA4ODI1MzYyMH0.4pDp05nBmGWBzN9-9ROq4T3Q1iulkA_CD1CQtO8zqd8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);