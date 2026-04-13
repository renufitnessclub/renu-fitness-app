import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.REACT_APP_SUPABASE_URL  || '';
const supabaseAnon = process.env.REACT_APP_SUPABASE_ANON || '';

// Build a dummy client that returns safe empty results
// so the app works even when Supabase isn't configured yet
function makeDummyChain() {
  const chain = () => chain;
  chain.select = chain;
  chain.eq = chain;
  chain.contains = chain;
  chain.order = chain;
  chain.limit = chain;
  chain.insert = chain;
  chain.upsert = chain;
  chain.update = chain;
  chain.delete = chain;
  chain.single = chain;
  chain.then = (resolve) => resolve({ data: null, error: null });
  return chain;
}

const dummyClient = {
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signUp: async () => ({ error: { message: 'Not connected yet' } }),
    signInWithPassword: async () => ({ error: { message: 'Not connected yet' } }),
    signOut: async () => ({}),
    getUser: async () => ({ data: null }),
  },
  from: () => makeDummyChain(),
};

export const supabase = (supabaseUrl && supabaseAnon)
  ? createClient(supabaseUrl, supabaseAnon)
  : dummyClient;

// ─── Auth helpers ────────────────────────────────────────────────────────────
export const signUp = (email, password, fullName) =>
  supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password });

export const signOut = () => supabase.auth.signOut();

export const getUser = () => supabase.auth.getUser();

export const onAuthChange = (callback) =>
  supabase.auth.onAuthStateChange(callback);

// ─── Classes / Schedule helpers ──────────────────────────────────────────────
export const fetchClasses = async (dayOfWeek) => {
  let query = supabase
    .from('classes')
    .select('*, bookings(count)')
    .eq('active', true)
    .order('time_sort', { ascending: true });
  if (dayOfWeek !== undefined) {
    query = query.contains('days_of_week', [dayOfWeek]);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const bookClass = async (classId, userId) => {
  const { data, error } = await supabase
    .from('bookings')
    .insert({ class_id: classId, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const cancelBooking = async (bookingId) => {
  const { error } = await supabase
    .from('bookings')
    .delete()
    .eq('id', bookingId);
  if (error) throw error;
};

export const fetchMyBookings = async (userId) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, classes(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

// ─── LML (Little Members Lounge) helpers ─────────────────────────────────────
export const fetchLmlSlots = async (date) => {
  const { data, error } = await supabase
    .from('lml_slots')
    .select('*, lml_bookings(count)')
    .eq('date', date)
    .order('time_sort', { ascending: true });
  if (error) throw error;
  return data;
};

export const bookLml = async (slotId, userId, childName) => {
  const { data, error } = await supabase
    .from('lml_bookings')
    .insert({ slot_id: slotId, user_id: userId, child_name: childName })
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ─── Workouts ────────────────────────────────────────────────────────────────
export const fetchWorkouts = async (limit = 5) => {
  const { data, error } = await supabase
    .from('workouts')
    .select('*, workout_exercises(*)')
    .eq('active', true)
    .order('date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
};

export const logWorkout = async (userId, workoutId, rounds, duration) => {
  const { data, error } = await supabase
    .from('workout_logs')
    .insert({ user_id: userId, workout_id: workoutId, rounds, duration_sec: duration })
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ─── Member profile ──────────────────────────────────────────────────────────
export const fetchProfile = async (userId) => {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
};

export const fetchMemberStats = async (userId) => {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('id', { count: 'exact' })
    .eq('user_id', userId);
  if (error) throw error;
  return { totalWorkouts: data?.length || 0 };
};

// ─── Admin helpers ───────────────────────────────────────────────────────────
export const isAdmin = async (userId) => {
  const { data } = await supabase
    .from('members')
    .select('role')
    .eq('id', userId)
    .single();
  return data?.role === 'admin';
};

export const upsertClass = async (classData) => {
  const { data, error } = await supabase
    .from('classes')
    .upsert(classData)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteClass = async (classId) => {
  const { error } = await supabase
    .from('classes')
    .update({ active: false })
    .eq('id', classId);
  if (error) throw error;
};

export const fetchAllBookings = async (date) => {
  let query = supabase
    .from('bookings')
    .select('*, classes(*), members(full_name, email)')
    .order('created_at', { ascending: false });
  if (date) {
    query = query.eq('date', date);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const fetchAllMembers = async () => {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

// ─── Plans (editable from admin) ─────────────────────────────────────────────
export const fetchPlans = async () => {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
};

export const upsertPlan = async (planData) => {
  const { data, error } = await supabase
    .from('plans')
    .upsert(planData)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ─── Renu Regulars — Check-ins ───────────────────────────────────────────────
export const checkIn = async (userId, checkType = 'gym', classId = null) => {
  const { data, error } = await supabase
    .from('checkins')
    .insert({ user_id: userId, check_type: checkType, class_id: classId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const fetchMyCheckins = async (userId, month, year) => {
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();
  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .eq('user_id', userId)
    .gte('checked_at', startDate)
    .lte('checked_at', endDate)
    .order('checked_at', { ascending: false });
  if (error) throw error;
  return data;
};

// ─── Renu Regulars — Enrollment ──────────────────────────────────────────────
export const enrollRegular = async (userId, month, year) => {
  const { data, error } = await supabase
    .from('renu_regulars')
    .insert({ user_id: userId, month, year, target_checkins: 16 })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const fetchMyRegularStatus = async (userId, month, year) => {
  const { data, error } = await supabase
    .from('renu_regulars')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .eq('year', year)
    .single();
  if (error) return null;
  return data;
};

// ─── Renu Regulars — Leaderboard ─────────────────────────────────────────────
export const fetchLeaderboard = async (month, year) => {
  const { data, error } = await supabase
    .from('regulars_leaderboard')
    .select('*')
    .eq('month', month)
    .eq('year', year)
    .order('rank', { ascending: true });
  if (error) throw error;
  return data;
};

// ─── Workout admin helpers ───────────────────────────────────────────────────
export const upsertWorkout = async (workoutData) => {
  const { data, error } = await supabase
    .from('workouts')
    .upsert(workoutData)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const upsertExercise = async (exerciseData) => {
  const { data, error } = await supabase
    .from('workout_exercises')
    .upsert(exerciseData)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteExercise = async (exerciseId) => {
  const { error } = await supabase
    .from('workout_exercises')
    .delete()
    .eq('id', exerciseId);
  if (error) throw error;
};
