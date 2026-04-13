import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { supabase, onAuthChange, signOut, isAdmin as checkIsAdmin, fetchClasses as fetchClassesFromDB, bookClass as bookClassDB, fetchMyBookings, fetchWorkouts as fetchWorkoutsFromDB, logWorkout as logWorkoutDB, fetchProfile, fetchMemberStats, bookLml as bookLmlDB, fetchLmlSlots as fetchLmlSlotsDB, checkIn, fetchMyCheckins, enrollRegular, fetchMyRegularStatus, fetchLeaderboard, fetchPlans as fetchPlansFromDB } from './lib/supabase';
import { LoginScreen, SignupScreen } from './AuthScreens';
import AdminPanel from './admin/AdminPanel';

// Check if Supabase is configured
const SUPABASE_CONFIGURED = !!(process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON);

// ─── SVG Icons ─────────────────────────────────────────────────────────────
const icons = {
  home: <svg viewBox="0 0 24 24"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/></svg>,
  workout: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9 12h6M12 9v6"/></svg>,
  schedule: <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v3M16 2v3M3 9h18"/></svg>,
  membership: <svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20M6 15h4"/></svg>,
  profile: <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  regulars: <svg viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>,
  back: <svg viewBox="0 0 24 24" style={{width:14,height:14,flexShrink:0}}><path d="M15 19l-7-7 7-7"/></svg>,
  check: <svg viewBox="0 0 24 24" style={{width:12,height:12}}><path stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" fill="none"/></svg>,
  play: <svg viewBox="0 0 24 24" style={{width:14,height:14}} fill="currentColor"><path d="M8 5v14l11-7z"/></svg>,
  checkLg: <svg viewBox="0 0 24 24" style={{width:14,height:14}} fill="none"><path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>,
};

// ─── Data ───────────────────────────────────────────────────────────────────
const WORKOUTS = [
  { id: 1, date: 'Apr 12', type: 'AMRAP 20', sub: 'For Max Rounds · Intermediate', tags: ['Intermediate','Full Body','Strength + Cardio'],
    stats: [{num:'20',label:'Minutes'},{num:'5',label:'Movements'},{num:'~580',label:'Cal est.'}],
    exercises: [
      {icon:'🏋️', name:'Goblet Squats',   desc:'15 reps · 35/25 lb · Heels on mat'},
      {icon:'💪', name:'Push-Ups',         desc:'12 reps · Scale: knees OK'},
      {icon:'🔄', name:'Dumbbell Rows',    desc:'10 each side · Brace your core'},
      {icon:'📦', name:'Step-Ups',         desc:'8 each leg · Controlled descent'},
      {icon:'⚡', name:'Jump Rope',        desc:'50 singles · Scale: high knees'},
    ]},
  { id: 2, date: 'Apr 11', type: 'For Time', sub: '3 Rounds · Beginner Friendly', tags: ['Beginner','Lower Body','Endurance'],
    stats: [{num:'3',label:'Rounds'},{num:'4',label:'Movements'},{num:'~420',label:'Cal est.'}],
    exercises: [
      {icon:'🦵', name:'Lunges',           desc:'20 reps total · Keep torso upright'},
      {icon:'🔥', name:'Hip Thrusts',      desc:'15 reps · Squeeze at top'},
      {icon:'🏃', name:'Box Step-Overs',   desc:'10 reps · 20" box'},
      {icon:'💫', name:'Plank Hold',       desc:'45 seconds · Breathe steadily'},
    ]},
];

const CLASSES = [
  {time:'5:30', ampm:'AM', name:'Group Fitness',  coach:'Coach: Jenna M.',  duration:'60 min', spots:4,  status:'open'},
  {time:'9:00', ampm:'AM', name:'Pilates Flow',   coach:'Coach: Amber K.',  duration:'50 min', spots:1,  status:'open'},
  {time:'12:00',ampm:'PM', name:'Open Gym',       coach:'Self-directed',    duration:'4am–10pm',spots:99, status:'walkin'},
  {time:'4:30', ampm:'PM', name:'Strength & Tone',coach:'Coach: Mia R.',    duration:'55 min', spots:6,  status:'open'},
  {time:'5:30', ampm:'PM', name:'HIIT Express',   coach:'Coach: Dana P.',   duration:'45 min', spots:0,  status:'full'},
  {time:'6:30', ampm:'PM', name:'Sauna & Steam',  coach:'Luxury amenity',   duration:'18+ only',spots:8, status:'open'},
];

const PLANS = [
  { id:'365', eyebrow:'Best value',   name:'Renu 365', price:'$156', per:'/mo equiv.',
    desc:'Paid annually · $1,872 + tax',
    features:['Full year unlimited','All classes + amenities','Renu App access','5 workouts/week'] },
  { id:'180', eyebrow:'6 months',     name:'Renu 180', price:'$166', per:'/mo equiv.',
    desc:'$996 + tax · paid in full',
    features:['6-month unlimited','All classes + amenities','Renu App access'] },
  { id:'90',  eyebrow:'3 months',     name:'Renu 90',  price:'$176', per:'/mo equiv.',
    desc:'$528 + tax · paid in full',
    features:['3-month unlimited','All classes + amenities','Renu App access'] },
  { id:'30',  eyebrow:'No commitment',name:'Renu 30',  price:'$186', per:'/mo',
    desc:'$186 + tax per month',
    features:['Monthly unlimited','All classes + amenities','Renu App access'] },
  { id:'teen',eyebrow:'Add-on',       name:'Teen Add-On',price:'$60',per:'/mo',
    desc:'$60 + tax per month',
    features:['Ages 13–15 only','With parent/guardian','Classes + gym floor'] },
];

const BILLING_HISTORY = [
  {date:'Apr 1, 2026',  desc:'Renu 365 — Annual', amount:'$1,872.00'},
  {date:'Jan 1, 2026',  desc:'Renu 365 — Annual', amount:'$1,872.00'},
  {date:'Dec 5, 2025',  desc:'Guest visit fee',   amount:'$30.00'},
  {date:'Jan 2, 2025',  desc:'Renu 365 — Annual', amount:'$1,872.00'},
];

const MODAL_CONFIGS = {
  freeze: {
    title: 'Freeze Membership',
    body: 'Pause your membership for up to 3 months per year. Billing pauses and resumes automatically. Contact us at info@renufitnessclub.com to arrange.',
    buttons: [{ label: 'Contact Renu to Freeze', cls: 'primary' },{ label: 'Not Now', cls: 'ghost' }]
  },
  childcare: {
    title: 'Little Members Lounge',
    body: 'Safe, nurturing childcare just steps from your workout. Spots are limited — book in advance to secure your time slot.',
    buttons: [{ label: 'Request Booking', cls: 'primary' },{ label: 'Cancel', cls: 'ghost' }]
  },
  guest: {
    title: 'Bring a Guest',
    body: 'Guests may visit Renu when accompanied by a member for $30.00 + tax per visit. Payment is collected at reception.',
    buttons: [{ label: 'Got It', cls: 'primary' },{ label: 'Cancel', cls: 'ghost' }]
  },
  cancel: {
    title: 'Cancel Membership',
    body: "We'd love to help before you go. If something isn't working for you, please reach out — we're here. Contact info@renufitnessclub.com to process a cancellation.",
    buttons: [{ label: 'Keep My Membership', cls: 'primary' },{ label: 'Email Us to Cancel', cls: 'danger' }]
  },
};

// ─── useLocalStorage hook ────────────────────────────────────────────────────
function useLocalStorage(key, initial) {
  const [val, setVal] = useState(() => {
    try { const stored = localStorage.getItem(key); return stored ? JSON.parse(stored) : initial; }
    catch { return initial; }
  });
  const set = useCallback((v) => {
    setVal(v);
    try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
  }, [key]);
  return [val, set];
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function Toast({ message, visible }) {
  return <div className={`toast ${visible ? 'show' : ''}`}>{message}</div>;
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────
function BottomNav({ active, onNavigate }) {
  const tabs = [
    { id: 'home',       label: 'Home',       icon: icons.home },
    { id: 'workout',    label: 'Workout',    icon: icons.workout },
    { id: 'schedule',   label: 'Schedule',   icon: icons.schedule },
    { id: 'regulars',   label: 'Regulars',   icon: icons.regulars },
    { id: 'profile',    label: 'Profile',    icon: icons.profile },
  ];
  return (
    <nav className="bottom-nav">
      {tabs.map(t => (
        <button key={t.id} className={`nav-tab ${active === t.id ? 'active' : ''}`} onClick={() => onNavigate(t.id)}>
          {t.icon}
          <span className="nav-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ modal, onClose }) {
  if (!modal) return null;
  const cfg = typeof modal === 'string' ? MODAL_CONFIGS[modal] : modal;
  if (!cfg) return null;
  return (
    <div className={`modal-overlay open`} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <div className="modal-title">{cfg.title}</div>
        <div className="modal-body">{cfg.body}</div>
        <div className="modal-actions">
          {cfg.buttons.map((b, i) => (
            <button key={i} className={`modal-btn ${b.cls}`} onClick={onClose}>{b.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── HOME SCREEN ─────────────────────────────────────────────────────────────
function HomeScreen({ onNavigate, streak, memberName = 'Renu Member', memberInitials = 'RF' }) {
  const today = WORKOUTS[0];
  const days = ['M','T','W','T','F','S','S'];
  const todayIdx = 4;
  const firstName = memberName.split(' ')[0];

  return (
    <div className="screen">
      <div className="page-header">
        <div>
          <div style={{fontSize:11,color:'var(--text2)',letterSpacing:'0.5px'}}>Good morning, {firstName}</div>
          <div className="page-title">Welcome to Renu</div>
        </div>
        <div className="avatar">{memberInitials}</div>
      </div>

      <div className="home-hero">
        <div className="hero-eyebrow">Renu Fitness Club · Fort McMurray</div>
        <div className="hero-title">Move with purpose,<br />rest with intention.</div>
        <div className="hero-sub">Women's luxury fitness — Open daily 4am – 10pm</div>
      </div>

      <div className="streak-strip">
        <div className="streak-card" style={{flex:'1.2'}}>
          <div style={{fontSize:22}}>🔥</div>
          <div>
            <div style={{display:'flex',alignItems:'baseline',gap:5}}>
              <div className="streak-num">{streak}</div>
              <div style={{fontSize:11,color:'var(--text2)'}}>day streak</div>
            </div>
            <div className="week-dots">
              {days.map((d,i) => (
                <div key={i} className={`dot ${i < todayIdx ? 'done' : i === todayIdx ? 'today' : 'missed'}`}>{d}</div>
              ))}
            </div>
          </div>
        </div>
        <div className="streak-card" style={{flexDirection:'column',alignItems:'flex-start',gap:4}}>
          <div style={{fontSize:10,color:'var(--text2)'}}>Open today</div>
          <div style={{fontFamily:'var(--font-serif)',fontSize:16,color:'var(--brown)'}}>4am – 10pm</div>
          <span className="badge badge-green">Members only</span>
        </div>
      </div>

      <div className="section-label">Today's Workout — {today.date}</div>
      <div className="wod-card" onClick={() => onNavigate('workout')}>
        <div className="wod-header">
          <div className="wod-eyebrow">Daily Workout</div>
          <div className="wod-title">{today.type}</div>
          <div className="wod-sub">{today.sub}</div>
        </div>
        <div className="wod-stats">
          {today.stats.map((s,i) => (
            <div key={i} className="wod-stat">
              <div className="wod-stat-num">{s.num}</div>
              <div className="wod-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="wod-moves">
          {today.exercises.map((e,i) => (
            <div key={i} className="wod-move">
              <div className="move-dot" />
              <div className="move-name">{e.name}</div>
              <div className="move-reps">{e.desc.split('·')[0].trim()}</div>
            </div>
          ))}
        </div>
      </div>

      <button className="primary-btn" onClick={() => onNavigate('workout')}>
        {icons.play} Start Today's Workout
      </button>

      <div className="section-label">Upcoming Classes</div>
      <div className="classes-scroll">
        {CLASSES.slice(0,5).map((c,i) => (
          <div key={i} className={`class-chip ${i===1?'highlighted':''}`}>
            <div className="chip-time">{c.time} {c.ampm}</div>
            <div className="chip-name">{c.name}</div>
            <div className="chip-badge">
              {c.status === 'full'   && <span className="badge badge-muted">Full</span>}
              {c.status === 'walkin' && <span className="badge badge-brown">Walk-in</span>}
              {c.status === 'open' && c.spots === 1 && <span className="badge badge-rose">{c.spots} spot!</span>}
              {c.status === 'open' && c.spots > 1   && <span className="badge badge-green">{c.spots} spots</span>}
            </div>
          </div>
        ))}
      </div>
      <div style={{height:16}} />
    </div>
  );
}

// ─── VIDEO PLAYER (Sweat-style inline) ───────────────────────────────────────
function VideoPlayer({ url, onClose }) {
  if (!url) return null;
  // Support YouTube embed URLs
  const getEmbedUrl = (rawUrl) => {
    if (!rawUrl) return '';
    if (rawUrl.includes('youtube.com/watch')) {
      const vid = new URL(rawUrl).searchParams.get('v');
      return `https://www.youtube.com/embed/${vid}?autoplay=1&rel=0&modestbranding=1`;
    }
    if (rawUrl.includes('youtu.be/')) {
      const vid = rawUrl.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${vid}?autoplay=1&rel=0&modestbranding=1`;
    }
    return rawUrl; // Direct video URL
  };

  const embedUrl = getEmbedUrl(url);
  const isEmbed = embedUrl.includes('youtube.com/embed');

  return (
    <div className="video-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="video-container">
        <button className="video-close" onClick={onClose}>✕</button>
        {isEmbed ? (
          <iframe
            src={embedUrl}
            title="Exercise demo"
            className="video-frame"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        ) : (
          <video src={url} className="video-frame" controls autoPlay playsInline />
        )}
      </div>
    </div>
  );
}

// ─── WORKOUT SCREEN ───────────────────────────────────────────────────────────
function WorkoutScreen({ onNavigate, onWorkoutLogged, showToast }) {
  const [timerSec, setTimerSec]   = useState(1200);
  const [running, setRunning]     = useState(false);
  const [round, setRound]         = useState(1);
  const [roundsDone, setRoundsDone] = useState(0);
  const [checked, setChecked]     = useState({});
  const [videoUrl, setVideoUrl]   = useState(null);
  const timerRef = useRef(null);
  const workout = WORKOUTS[0];

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        setTimerSec(s => {
          if (s <= 1) { clearInterval(timerRef.current); setRunning(false); return 0; }
          return s - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [running]);

  const formatTime = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const toggleCheck = idx => {
    const next = { ...checked, [idx]: !checked[idx] };
    setChecked(next);
    const allDone = workout.exercises.every((_, i) => next[i]);
    if (allDone) {
      setRoundsDone(r => r + 1);
      setTimeout(() => setChecked({}), 500);
    }
  };

  const handleLog = () => {
    onWorkoutLogged();
    showToast('Workout logged!');
    setTimeout(() => onNavigate('profile'), 1200);
  };

  return (
    <div className="screen">
      <div className="workout-hero">
        <button className="back-btn" onClick={() => onNavigate('home')}>
          {icons.back} Back
        </button>
        <div className="workout-eyebrow">Daily Workout · {workout.date}</div>
        <div className="workout-name">{workout.type}</div>
        <div className="workout-tags">
          {workout.tags.map((t,i) => <span key={i} className="workout-tag">{t}</span>)}
        </div>
      </div>

      <div className="timer-card">
        <div className="timer-eyebrow">Workout Timer</div>
        <div className={`timer-display ${timerSec === 0 ? 'done' : ''}`}>{formatTime(timerSec)}</div>
        <div className="timer-controls">
          <button className="timer-btn go" onClick={() => setRunning(r => !r)}>
            {running ? 'Pause' : timerSec < 1200 && timerSec > 0 ? 'Resume' : 'Start'}
          </button>
          <button className="timer-btn ghost" onClick={() => { setRunning(false); setTimerSec(1200); }}>
            Reset
          </button>
        </div>
      </div>

      <div className="round-row">
        <span className="round-label">Round:</span>
        <div className="round-pills">
          {[1,2,3,'4+'].map((r,i) => (
            <button key={i} className={`round-pill ${round === r ? 'active' : ''}`} onClick={() => { setRound(r); setChecked({}); }}>
              {r}
            </button>
          ))}
        </div>
        <div className="rounds-done">Rounds: <span>{roundsDone}</span></div>
      </div>

      <div className="exercise-card">
        <div className="ex-card-header">
          <span className="ex-card-type">AMRAP</span>
          <span className="ex-card-sub">{workout.exercises.length} movements · repeat</span>
        </div>
        <div className="ex-card-body">
          {workout.exercises.map((ex, i) => (
            <div key={i} className="ex-row">
              <div className="ex-icon">{ex.icon}</div>
              <div className="ex-info">
                <div className="ex-name">{ex.name}</div>
                <div className="ex-desc">{ex.desc}</div>
              </div>
              {ex.video_url && (
                <button className="ex-video-btn" onClick={() => setVideoUrl(ex.video_url)}>
                  {icons.play}
                </button>
              )}
              <button className={`ex-check ${checked[i] ? 'checked' : ''}`} onClick={() => toggleCheck(i)}>
                {checked[i] && icons.check}
              </button>
            </div>
          ))}
        </div>
      </div>

      {videoUrl && <VideoPlayer url={videoUrl} onClose={() => setVideoUrl(null)} />}

      <button className="primary-btn green-btn" onClick={handleLog}>
        {icons.checkLg} Log Workout
      </button>
      <div style={{height:12}} />
    </div>
  );
}

// ─── SCHEDULE SCREEN ──────────────────────────────────────────────────────────
function ScheduleScreen({ showToast }) {
  const [activeDay, setActiveDay] = useState(4);
  const [bookedIds, setBookedIds] = useLocalStorage('renu_booked', []);
  const [lmlSlot, setLmlSlot] = useState(null);
  const [lmlBooked, setLmlBooked] = useLocalStorage('renu_lml', []);
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const dates = [7,8,9,10,11,12,13];

  const noBookClasses = ['Open Gym', 'Sauna & Steam'];

  const book = id => {
    if (!bookedIds.includes(id)) {
      setBookedIds([...bookedIds, id]);
      showToast('Class reserved!');
    }
  };

  const lmlSlots = ['5:30 AM','9:00 AM','12:00 PM','4:30 PM','5:30 PM'];

  const bookLml = () => {
    if (lmlSlot !== null && !lmlBooked.includes(lmlSlot)) {
      setLmlBooked([...lmlBooked, lmlSlot]);
      showToast('Little Members Lounge booked!');
      setLmlSlot(null);
    }
  };

  return (
    <div className="screen">
      <div className="page-header" style={{paddingBottom:14}}>
        <div className="page-title">Schedule</div>
        <span className="badge badge-green">Active member</span>
      </div>

      <div className="date-strip">
        {days.map((d,i) => (
          <div key={i} className={`date-pill ${activeDay === i ? 'active' : ''}`} onClick={() => setActiveDay(i)}>
            <div className="date-day">{d}</div>
            <div className="date-num">{dates[i]}</div>
          </div>
        ))}
      </div>

      <div className="section-label">{days[activeDay]} Classes</div>

      {CLASSES.map((c, i) => {
        const isBooked = bookedIds.includes(i);
        const isNoBook = noBookClasses.includes(c.name);
        return (
          <div key={i} className="class-list-item">
            <div className="class-time-col">
              <div className="class-time-h">{c.time}</div>
              <div className="class-time-ampm">{c.ampm}</div>
            </div>
            <div className="vline" />
            <div className="class-info">
              <div className="class-info-name">{c.name}</div>
              <div className="class-info-coach">{c.coach} · {c.duration}</div>
              <div className="class-info-spots">
                {c.status === 'full' && <span style={{color:'var(--rose)'}}>Full — waitlist available</span>}
                {c.status === 'walkin' && <span style={{color:'var(--brown2)'}}>Walk-in welcome</span>}
                {c.status === 'open' && c.spots === 1 && <span style={{color:'var(--rose)'}}>{c.spots} spot left!</span>}
                {c.status === 'open' && c.spots > 1 && <span style={{color:'var(--green)'}}>{c.spots} spots left</span>}
              </div>
            </div>
            {isNoBook
              ? <span className="badge badge-muted" style={{flexShrink:0}}>{c.status === 'walkin' ? 'Walk-in' : 'No booking'}</span>
              : isBooked
                ? <button className="book-btn booked">✓ Reserved</button>
                : c.status === 'full'
                  ? <button className="book-btn full">Waitlist</button>
                  : <button className="book-btn open" onClick={() => book(i)}>Book</button>
            }
          </div>
        );
      })}

      <div className="section-label">Little Members Lounge</div>
      <div className="lml-card">
        <div className="lml-header">
          <div className="lml-header-title">🧸 Little Members Lounge</div>
          <div className="lml-header-sub">Safe, nurturing childcare while you work out</div>
        </div>
        <div className="lml-body">
          <div className="lml-info-row"><span className="lml-info-icon">👶</span> Ages 6 months – 8 years</div>
          <div className="lml-info-row"><span className="lml-info-icon">⏱️</span> Up to 90 minutes per session</div>
          <div className="lml-info-row"><span className="lml-info-icon">📋</span> Limited spots — book ahead</div>
          <div style={{fontSize:11,color:'var(--text3)',marginTop:10,letterSpacing:'1px',textTransform:'uppercase',fontWeight:600}}>Select a time slot</div>
          <div className="lml-slots">
            {lmlSlots.map((slot,i) => {
              const isSlotBooked = lmlBooked.includes(i);
              return (
                <button
                  key={i}
                  className={`lml-slot ${isSlotBooked ? 'booked' : lmlSlot === i ? 'selected' : ''}`}
                  onClick={() => !isSlotBooked && setLmlSlot(i)}
                >
                  {isSlotBooked ? `✓ ${slot}` : slot}
                </button>
              );
            })}
          </div>
          <button className="lml-book-btn" disabled={lmlSlot === null} onClick={bookLml}>
            {lmlSlot !== null ? `Book ${lmlSlots[lmlSlot]} Slot` : 'Select a time to book'}
          </button>
        </div>
      </div>

      <div style={{height:16}} />
    </div>
  );
}

// ─── MEMBERSHIP SCREEN ────────────────────────────────────────────────────────
function MembershipScreen({ showToast, openModal, memberName = 'Renu Member', memberInitials = 'RF' }) {
  const [currentPlan] = useLocalStorage('renu_plan', '365');
  const [toggles, setToggles] = useLocalStorage('renu_toggles', { reminders: true, childcare: false, notifications: true });

  const plan = PLANS.find(p => p.id === currentPlan) || PLANS[0];

  const inquirePlan = id => {
    const p = PLANS.find(p => p.id === id);
    openModal({
      title: 'Contact Front Desk',
      body: `To switch to the ${p.name} plan (${p.desc}), please reach out to our front desk. We maintain a waitlist for membership changes and will get you set up as soon as a spot opens. Call us or stop by — we're happy to help!`,
      buttons: [{ label: 'Got It', cls: 'primary' }]
    });
  };

  const toggle = key => setToggles({ ...toggles, [key]: !toggles[key] });

  return (
    <div className="screen">
      <div className="page-header" style={{paddingBottom:14}}>
        <div className="page-title">Membership</div>
        <span className="badge badge-green">Active</span>
      </div>

      <div className="member-card-outer">
        <div className="member-card-bg">
          <div className="mc-deco1" /><div className="mc-deco2" />
          <div className="mc-top">
            <div className="mc-gym-name">RENU FITNESS CLUB</div>
            <div className="mc-status-pill">{plan.name.toUpperCase()}</div>
          </div>
          <div className="mc-plan-name">{plan.name}</div>
          <div className="mc-since">Member since January 2025</div>
          <div className="mc-bottom">
            <div className="mc-avatar">{memberInitials}</div>
            <div>
              <div className="mc-holder">{memberName}</div>
              <div className="mc-id">Renu Fitness Club</div>
            </div>
            <div className="mc-renews">
              <div className="mc-renews-label">Renews</div>
              <div className="mc-renews-date">Jan 1, 2027</div>
            </div>
          </div>
        </div>
      </div>

      <div className="billing-row">
        <div className="billing-icon">💳</div>
        <div style={{flex:1}}>
          <div className="billing-label">Current plan</div>
          <div className="billing-val">{plan.price}{plan.per}</div>
          <div className="billing-sub">{plan.desc}</div>
        </div>
        <div className="billing-badge">Paid</div>
      </div>

      <div className="section-label">Settings</div>
      <div className="toggle-section">
        {[
          { key:'reminders',     title:'Class reminders',    sub:'Notify me before booked classes' },
          { key:'childcare',     title:'Childcare booking',  sub:'Little Members Lounge add-on' },
          { key:'notifications', title:'Workout alerts',     sub:'5 new workouts posted weekly' },
        ].map(t => (
          <div key={t.key} className="toggle-row">
            <div className="toggle-info">
              <div className="toggle-title">{t.title}</div>
              <div className="toggle-sub">{t.sub}</div>
            </div>
            <div className={`toggle ${toggles[t.key] ? '' : 'off'}`} onClick={() => toggle(t.key)} />
          </div>
        ))}
      </div>

      <div className="section-label">Change Plan</div>
      <div className="plans-scroll">
        {PLANS.map(p => (
          <div key={p.id} className={`plan-card ${currentPlan === p.id ? 'current' : ''}`}>
            <div className="plan-eyebrow">{p.eyebrow}</div>
            <div className="plan-name">{p.name}</div>
            <div className="plan-price">{p.price}<span>{p.per}</span></div>
            <div className="plan-features">
              {p.features.map((f,i) => <div key={i} className="plan-feature">{f}</div>)}
            </div>
            <button
              className="plan-select-btn"
              onClick={() => currentPlan !== p.id && inquirePlan(p.id)}
            >
              {currentPlan === p.id ? 'Current plan' : 'Inquire'}
            </button>
          </div>
        ))}
      </div>

      <div className="section-label">Quick Actions</div>
      <div className="actions-list">
        {[
          { icon:'🧸', bg:'var(--rose-light)',           title:'Little Members Lounge', sub:'Book childcare — limited spots',     modal:'childcare', danger:false },
          { icon:'👥', bg:'var(--brown-light)',           title:'Bring a guest',         sub:'$30 + tax per visit, with you',      modal:'guest',     danger:false },
          { icon:'❄️', bg:'rgba(75,143,255,0.1)',         title:'Freeze membership',     sub:'Pause billing temporarily',          modal:'freeze',    danger:false },
          { icon:'✕',  bg:'var(--rose-light)',            title:'Cancel membership',     sub:"We'd hate to see you go",            modal:'cancel',    danger:true  },
        ].map((a,i) => (
          <div key={i} className="action-row" onClick={() => openModal(a.modal)}>
            <div className="action-icon" style={{background:a.bg}}>{a.icon}</div>
            <div>
              <div className={`action-title ${a.danger ? 'danger' : ''}`}>{a.title}</div>
              <div className="action-sub">{a.sub}</div>
            </div>
            <div className={`action-arrow ${a.danger ? 'danger' : ''}`}>›</div>
          </div>
        ))}
      </div>

      <div className="section-label">Billing History</div>
      {BILLING_HISTORY.map((h,i) => (
        <div key={i} className="history-item">
          <div className="hist-date">{h.date}</div>
          <div className="hist-desc">{h.desc}</div>
          <div style={{textAlign:'right'}}>
            <div className="hist-amount">{h.amount}</div>
            <div className="hist-ok">✓ Paid</div>
          </div>
        </div>
      ))}
      <div style={{height:12}} />
    </div>
  );
}

// ─── PROFILE SCREEN ───────────────────────────────────────────────────────────
function ProfileScreen({ workoutsLogged, memberName = 'Renu Member', memberInitials = 'RF', user, admin, onAdmin, onSignOut, onNavigate }) {
  const prs = [
    { lift:'Goblet Squat',      value:'75 lbs', gain:'↑ +5 this month' },
    { lift:'Romanian DL',       value:'115 lbs',gain:'↑ +10 this month' },
    { lift:'DB Shoulder Press', value:'35 lbs', gain:'↑ +5 last week' },
    { lift:'Hip Thrust',        value:'145 lbs',gain:'↑ +15 this month' },
    { lift:'1-mile run',        value:'9:42',   gain:'↑ −0:28 PR' },
  ];
  const progress = [
    { name:'Goblet Squat', pct:78 },
    { name:'Romanian DL',  pct:85 },
    { name:'DB Press',     pct:65 },
    { name:'Hip Thrust',   pct:72 },
  ];

  return (
    <div className="screen">
      <div className="profile-hero">
        <div className="profile-avatar-lg">{memberInitials}</div>
        <div className="profile-name">{memberName}</div>
        <div className="profile-handle">Fort McMurray, AB</div>
        <div className="profile-badges">
          <span className="badge badge-brown">Renu 365</span>
          <span className="badge badge-rose">Top 15%</span>
          <span className="badge badge-green">{workoutsLogged} Workouts</span>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-cell">
          <div className="stat-big">{workoutsLogged}</div>
          <div className="stat-label">Workouts</div>
        </div>
        <div className="stat-cell">
          <div className="stat-big">14</div>
          <div className="stat-label">Day streak</div>
        </div>
        <div className="stat-cell">
          <div className="stat-big">8</div>
          <div className="stat-label">PRs set</div>
        </div>
      </div>

      <div className="section-label">Strength Progress</div>
      <div className="progress-list">
        {progress.map((p,i) => (
          <div key={i} className="progress-item">
            <div className="progress-name">{p.name}</div>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{width:`${p.pct}%`}} />
            </div>
            <div className="progress-pct">{p.pct}%</div>
          </div>
        ))}
      </div>

      <div className="section-label">Personal Records</div>
      <div className="pr-table">
        {prs.map((p,i) => (
          <div key={i} className="pr-row">
            <div className="pr-lift">{p.lift}</div>
            <div style={{textAlign:'right'}}>
              <div className="pr-value">{p.value}</div>
              <div className="pr-gain">{p.gain}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="section-label">Account</div>
      <div className="actions-list">
        <div className="action-row" onClick={() => onNavigate && onNavigate('membership')}>
          <div className="action-icon" style={{background:'var(--brown-light)'}}>💳</div>
          <div>
            <div className="action-title">Membership & Billing</div>
            <div className="action-sub">View plan, billing history, settings</div>
          </div>
          <div className="action-arrow">›</div>
        </div>
      </div>

      {/* Admin + Sign Out */}
      {SUPABASE_CONFIGURED && user && (
        <div style={{ padding: '16px 20px 0' }}>
          {admin && (
            <button className="primary-btn" onClick={onAdmin} style={{ marginLeft: 0, marginRight: 0, width: '100%' }}>
              Admin Panel
            </button>
          )}
          <button className="primary-btn rose-btn" onClick={onSignOut} style={{ marginLeft: 0, marginRight: 0, width: '100%' }}>
            Sign Out
          </button>
        </div>
      )}
      <div style={{height:12}} />
    </div>
  );
}

// ─── RENU REGULARS SCREEN ────────────────────────────────────────────────────
function RegularsScreen({ user, showToast }) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthName = now.toLocaleString('default', { month: 'long' });
  const TARGET = 16;

  const [enrolled, setEnrolled]       = useLocalStorage('renu_regular_enrolled', false);
  const [myCheckins, setMyCheckins]   = useLocalStorage('renu_checkins_count', 0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [todayChecked, setTodayChecked] = useLocalStorage('renu_today_checkin', '');

  const todayStr = now.toISOString().split('T')[0];
  const alreadyCheckedToday = todayChecked === todayStr;

  // Load leaderboard data from Supabase if configured
  useEffect(() => {
    if (SUPABASE_CONFIGURED && user) {
      fetchMyRegularStatus(user.id, month, year).then(data => {
        if (data) setEnrolled(true);
      }).catch(() => {});
      fetchMyCheckins(user.id, month, year).then(data => {
        if (data) setMyCheckins(data.length);
      }).catch(() => {});
      fetchLeaderboard(month, year).then(data => {
        if (data) setLeaderboard(data);
      }).catch(() => {});
    }
  }, [user, month, year]);

  const handleEnroll = async () => {
    if (SUPABASE_CONFIGURED && user) {
      try {
        await enrollRegular(user.id, month, year);
        setEnrolled(true);
        showToast('Welcome to Renu Regulars!');
      } catch (err) {
        showToast('Already enrolled!');
      }
    } else {
      setEnrolled(true);
      showToast('Welcome to Renu Regulars!');
    }
  };

  const handleCheckIn = async () => {
    if (alreadyCheckedToday) return;
    if (SUPABASE_CONFIGURED && user) {
      try {
        await checkIn(user.id, 'gym');
        setMyCheckins(c => c + 1);
        setTodayChecked(todayStr);
        showToast('Checked in! Keep it up!');
      } catch (err) {
        showToast('Check-in failed');
      }
    } else {
      setMyCheckins(c => c + 1);
      setTodayChecked(todayStr);
      showToast('Checked in! Keep it up!');
    }
  };

  const pct = Math.min(100, Math.round((myCheckins / TARGET) * 100));
  const daysLeft = new Date(year, month, 0).getDate() - now.getDate();

  // Demo leaderboard if no Supabase data
  const displayBoard = leaderboard.length > 0 ? leaderboard : [
    { rank: 1, full_name: 'Sarah K.',    total_checkins: 22, goal_met: true },
    { rank: 2, full_name: 'Jenna M.',    total_checkins: 19, goal_met: true },
    { rank: 3, full_name: 'Amber L.',    total_checkins: 18, goal_met: true },
    { rank: 4, full_name: 'Mia R.',      total_checkins: 16, goal_met: true },
    { rank: 5, full_name: 'Dana P.',     total_checkins: 14, goal_met: false },
    { rank: 6, full_name: 'You',         total_checkins: myCheckins, goal_met: myCheckins >= TARGET },
  ];

  if (!enrolled) {
    return (
      <div className="screen">
        <div className="regulars-hero">
          <div className="regulars-badge-lg">RENU REGULARS</div>
          <div className="regulars-hero-title">The Monthly Commitment Club</div>
          <div className="regulars-hero-sub">Show up. Check in. Make it count.</div>
        </div>
        <div style={{padding:'0 20px'}}>
          <div className="regulars-info-card">
            <div className="regulars-info-title">How It Works</div>
            <div className="regulars-info-row"><span className="regulars-info-num">16</span> Check-ins per month to hit your goal</div>
            <div className="regulars-info-row"><span className="regulars-info-num">1</span> Check-in per day maximum</div>
            <div className="regulars-info-row"><span className="regulars-info-num">Top</span> Members featured on the leaderboard</div>
            <div className="regulars-info-detail">Check in each time you visit Renu. Hit 16 in a month and you're a certified Renu Regular. The leaderboard resets monthly — every month is a fresh start.</div>
          </div>
          <button className="primary-btn" onClick={handleEnroll} style={{marginTop:20}}>
            Join Renu Regulars — {monthName}
          </button>
        </div>
        <div style={{height:16}} />
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="page-header" style={{paddingBottom:14}}>
        <div>
          <div className="page-title">Renu Regulars</div>
          <div style={{fontSize:11,color:'var(--text2)',marginTop:2}}>{monthName} {year}</div>
        </div>
        <span className={`badge ${myCheckins >= TARGET ? 'badge-green' : 'badge-brown'}`}>
          {myCheckins >= TARGET ? 'Goal Met!' : `${daysLeft} days left`}
        </span>
      </div>

      {/* Progress card */}
      <div className="regulars-progress-card">
        <div className="regulars-progress-top">
          <div className="regulars-progress-count">{myCheckins}<span>/{TARGET}</span></div>
          <div className="regulars-progress-label">check-ins this month</div>
        </div>
        <div className="regulars-bar-bg">
          <div className="regulars-bar-fill" style={{width:`${pct}%`}} />
        </div>
        <div className="regulars-bar-labels">
          <span>{pct}% complete</span>
          <span>{TARGET - myCheckins > 0 ? `${TARGET - myCheckins} to go` : 'Goal reached!'}</span>
        </div>
        <button
          className={`regulars-checkin-btn ${alreadyCheckedToday ? 'done' : ''}`}
          onClick={handleCheckIn}
          disabled={alreadyCheckedToday}
        >
          {alreadyCheckedToday ? '✓ Checked In Today' : 'Check In Now'}
        </button>
      </div>

      {/* Leaderboard */}
      <div className="section-label">Leaderboard — {monthName}</div>
      <div className="leaderboard">
        {displayBoard.map((m, i) => (
          <div key={i} className={`lb-row ${i < 3 ? 'top3' : ''} ${m.full_name === 'You' ? 'me' : ''}`}>
            <div className="lb-rank">
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : m.rank || i + 1}
            </div>
            <div className="lb-name">{m.full_name}</div>
            <div className="lb-count">{m.total_checkins}</div>
            <div className={`lb-status ${m.goal_met ? 'met' : ''}`}>
              {m.goal_met ? '✓' : `${TARGET - m.total_checkins} to go`}
            </div>
          </div>
        ))}
      </div>
      <div style={{height:16}} />
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]     = useState('home');
  const [modal, setModal]       = useState(null);
  const [toast, setToast]       = useState({ msg: '', visible: false });
  const [streak]                = useLocalStorage('renu_streak', 14);
  const [workoutsLogged, setWorkoutsLogged] = useLocalStorage('renu_workouts', 62);
  const toastTimeout = useRef(null);

  // ─── Auth state ──────────────────────────────────────────────────────
  const [user, setUser]         = useState(null);
  const [authScreen, setAuthScreen] = useState('login');  // 'login' | 'signup'
  const [authLoading, setAuthLoading] = useState(true);
  const [admin, setAdmin]       = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [profile, setProfile]   = useState(null);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      setAuthLoading(false);
      return;
    }
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setAuthLoading(false);
      if (session?.user) {
        checkIsAdmin(session.user.id).then(setAdmin);
        fetchProfile(session.user.id).then(setProfile).catch(() => {});
      }
    });
    // Listen for auth changes
    const { data: { subscription } } = onAuthChange((event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        checkIsAdmin(session.user.id).then(setAdmin);
        fetchProfile(session.user.id).then(setProfile).catch(() => {});
      } else {
        setAdmin(false);
        setProfile(null);
      }
    });
    return () => subscription?.unsubscribe();
  }, []);

  const showToast = msg => {
    clearTimeout(toastTimeout.current);
    setToast({ msg, visible: true });
    toastTimeout.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 2500);
  };

  const openModal  = cfg => setModal(cfg);
  const closeModal = ()  => setModal(null);
  const handleLogWorkout = () => setWorkoutsLogged(n => n + 1);

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    setAdmin(false);
    setProfile(null);
    showToast('Signed out');
  };

  // ─── Auth guard (only when Supabase is configured) ───────────────────
  if (SUPABASE_CONFIGURED && authLoading) {
    return (
      <div className="app-shell" style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ textAlign:'center', color:'var(--text2)' }}>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:24, color:'var(--brown)', marginBottom:8 }}>RENU</div>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  if (SUPABASE_CONFIGURED && !user) {
    return (
      <div className="app-shell">
        {authScreen === 'login'
          ? <LoginScreen  onSwitch={() => setAuthScreen('signup')} onSuccess={() => {}} showToast={showToast} />
          : <SignupScreen onSwitch={() => setAuthScreen('login')}  onSuccess={() => {}} showToast={showToast} />
        }
        <Toast message={toast.msg} visible={toast.visible} />
      </div>
    );
  }

  // ─── Admin panel ─────────────────────────────────────────────────────
  if (showAdmin && admin) {
    return (
      <div className="app-shell">
        <AdminPanel onClose={() => setShowAdmin(false)} />
      </div>
    );
  }

  // ─── Member name for display ─────────────────────────────────────────
  const memberName = profile?.full_name || user?.user_metadata?.full_name || 'Renu Member';
  const memberInitials = memberName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || 'RF';

  return (
    <div className="app-shell">
      {screen === 'home'       && <HomeScreen       onNavigate={setScreen} streak={streak} memberName={memberName} memberInitials={memberInitials} />}
      {screen === 'workout'    && <WorkoutScreen    onNavigate={setScreen} onWorkoutLogged={handleLogWorkout} showToast={showToast} />}
      {screen === 'schedule'   && <ScheduleScreen   showToast={showToast} user={user} />}
      {screen === 'regulars'   && <RegularsScreen   user={user} showToast={showToast} />}
      {screen === 'membership' && <MembershipScreen showToast={showToast} openModal={openModal} memberName={memberName} memberInitials={memberInitials} />}
      {screen === 'profile'    && <ProfileScreen    workoutsLogged={workoutsLogged} memberName={memberName} memberInitials={memberInitials} user={user} admin={admin} onAdmin={() => setShowAdmin(true)} onSignOut={handleSignOut} onNavigate={setScreen} />}

      <BottomNav active={screen} onNavigate={setScreen} />
      {modal && <Modal modal={modal} onClose={closeModal} />}
      <Toast message={toast.msg} visible={toast.visible} />
    </div>
  );
}
