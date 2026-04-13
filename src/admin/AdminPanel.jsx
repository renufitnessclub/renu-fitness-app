import React, { useState, useEffect, useCallback } from 'react';
import {
  supabase,
  fetchClasses,
  fetchAllBookings,
  fetchAllMembers,
  upsertClass,
  deleteClass,
  fetchWorkouts,
  upsertWorkout,
  upsertExercise,
  deleteExercise,
  fetchPlans,
  upsertPlan,
  fetchLeaderboard,
} from '../lib/supabase';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ─── CLASS EDITOR ────────────────────────────────────────────────────────────
function ClassEditor({ cls, onSave, onCancel }) {
  const [form, setForm] = useState({
    name:         cls?.name || '',
    coach:        cls?.coach || '',
    time_display: cls?.time_display || '',
    time_sort:    cls?.time_sort || 0,
    duration:     cls?.duration || '',
    max_spots:    cls?.max_spots || 20,
    days_of_week: cls?.days_of_week || [1,2,3,4,5],
    category:     cls?.category || 'class',
  });

  const toggleDay = d => {
    setForm(f => ({
      ...f,
      days_of_week: f.days_of_week.includes(d)
        ? f.days_of_week.filter(x => x !== d)
        : [...f.days_of_week, d].sort()
    }));
  };

  const handleSave = () => {
    const data = { ...form };
    if (cls?.id) data.id = cls.id;
    onSave(data);
  };

  return (
    <div className="admin-editor">
      <div className="admin-editor-title">{cls ? 'Edit Class' : 'Add Class'}</div>

      <div className="admin-field">
        <label>Class Name</label>
        <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Pilates Flow" />
      </div>

      <div className="admin-field">
        <label>Coach</label>
        <input value={form.coach} onChange={e => setForm({...form, coach: e.target.value})} placeholder="e.g. Coach: Jenna M." />
      </div>

      <div className="admin-row-2">
        <div className="admin-field">
          <label>Time Display</label>
          <input value={form.time_display} onChange={e => setForm({...form, time_display: e.target.value})} placeholder="e.g. 5:30 AM" />
        </div>
        <div className="admin-field">
          <label>Sort Order (mins)</label>
          <input type="number" value={form.time_sort} onChange={e => setForm({...form, time_sort: Number(e.target.value)})} />
        </div>
      </div>

      <div className="admin-row-2">
        <div className="admin-field">
          <label>Duration</label>
          <input value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} placeholder="e.g. 60 min" />
        </div>
        <div className="admin-field">
          <label>Max Spots</label>
          <input type="number" value={form.max_spots} onChange={e => setForm({...form, max_spots: Number(e.target.value)})} />
        </div>
      </div>

      <div className="admin-field">
        <label>Category</label>
        <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
          <option value="class">Bookable Class</option>
          <option value="walkin">Walk-in</option>
          <option value="amenity">Amenity (no booking)</option>
        </select>
      </div>

      <div className="admin-field">
        <label>Days Active</label>
        <div className="admin-days">
          {DAYS.map((d, i) => (
            <button
              key={i}
              className={`admin-day-btn ${form.days_of_week.includes(i) ? 'active' : ''}`}
              onClick={() => toggleDay(i)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-editor-actions">
        <button className="admin-btn primary" onClick={handleSave}>Save Class</button>
        <button className="admin-btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── ADMIN PANEL ─────────────────────────────────────────────────────────────
export default function AdminPanel({ onClose }) {
  const [tab, setTab]           = useState('schedule');
  const [classes, setClasses]   = useState([]);
  const [bookings, setBookings] = useState([]);
  const [members, setMembers]   = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [plans, setPlans]       = useState([]);
  const [editing, setEditing]   = useState(null);
  const [loading, setLoading]   = useState(false);

  const loadClasses = useCallback(async () => {
    try {
      const data = await fetchClasses();
      setClasses(data || []);
    } catch (err) {
      console.error('Failed to load classes:', err);
    }
  }, []);

  const loadBookings = useCallback(async () => {
    try {
      const data = await fetchAllBookings();
      setBookings(data || []);
    } catch (err) {
      console.error('Failed to load bookings:', err);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    try {
      const data = await fetchAllMembers();
      setMembers(data || []);
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  }, []);

  const loadWorkouts = useCallback(async () => {
    try {
      const data = await fetchWorkouts(20);
      setWorkouts(data || []);
    } catch (err) {
      console.error('Failed to load workouts:', err);
    }
  }, []);

  const loadPlans = useCallback(async () => {
    try {
      const data = await fetchPlans();
      setPlans(data || []);
    } catch (err) {
      console.error('Failed to load plans:', err);
    }
  }, []);

  useEffect(() => {
    if (tab === 'schedule')  loadClasses();
    if (tab === 'bookings')  loadBookings();
    if (tab === 'members')   loadMembers();
    if (tab === 'workouts')  loadWorkouts();
    if (tab === 'plans')     loadPlans();
  }, [tab, loadClasses, loadBookings, loadMembers, loadWorkouts, loadPlans]);

  const handleSaveClass = async (data) => {
    setLoading(true);
    try {
      await upsertClass(data);
      setEditing(null);
      loadClasses();
    } catch (err) {
      alert('Error saving class: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClass = async (id) => {
    if (!window.confirm('Remove this class from the schedule?')) return;
    try {
      await deleteClass(id);
      loadClasses();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="admin-panel">
      {/* Header */}
      <div className="admin-header">
        <div>
          <div className="admin-header-title">Admin Panel</div>
          <div className="admin-header-sub">Renu Fitness Club</div>
        </div>
        <button className="admin-close" onClick={onClose}>Back to App</button>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        {[
          { id: 'schedule', label: 'Schedule' },
          { id: 'workouts', label: 'Workouts' },
          { id: 'plans',    label: 'Plans' },
          { id: 'bookings', label: 'Bookings' },
          { id: 'members',  label: 'Members' },
        ].map(t => (
          <button
            key={t.id}
            className={`admin-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => { setTab(t.id); setEditing(null); }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="admin-body">
        {/* ── SCHEDULE TAB ── */}
        {tab === 'schedule' && (
          <>
            {editing ? (
              <ClassEditor
                cls={editing === 'new' ? null : editing}
                onSave={handleSaveClass}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <>
                <button className="admin-btn primary" onClick={() => setEditing('new')} style={{ marginBottom: 16 }}>
                  + Add New Class
                </button>

                {classes.length === 0 && <div className="admin-empty">No classes yet. Add your first one!</div>}

                {classes.map(c => (
                  <div key={c.id} className="admin-class-row">
                    <div className="admin-class-time">{c.time_display}</div>
                    <div className="admin-class-info">
                      <div className="admin-class-name">{c.name}</div>
                      <div className="admin-class-meta">
                        {c.coach} · {c.duration} · {c.max_spots} spots ·{' '}
                        {c.days_of_week?.map(d => DAYS[d]).join(', ')}
                      </div>
                    </div>
                    <div className="admin-class-actions">
                      <button className="admin-btn-sm" onClick={() => setEditing(c)}>Edit</button>
                      <button className="admin-btn-sm danger" onClick={() => handleDeleteClass(c.id)}>Remove</button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* ── BOOKINGS TAB ── */}
        {tab === 'bookings' && (
          <>
            {bookings.length === 0 && <div className="admin-empty">No bookings yet.</div>}
            <div className="admin-booking-header">
              <span>Member</span>
              <span>Class</span>
              <span>Date</span>
              <span>Status</span>
            </div>
            {bookings.map(b => (
              <div key={b.id} className="admin-booking-row">
                <span>{b.members?.full_name || 'Unknown'}</span>
                <span>{b.classes?.name || '—'} ({b.classes?.time_display})</span>
                <span>{b.date}</span>
                <span className={`admin-status ${b.status}`}>{b.status}</span>
              </div>
            ))}
          </>
        )}

        {/* ── MEMBERS TAB ── */}
        {tab === 'members' && (
          <>
            {members.length === 0 && <div className="admin-empty">No members yet.</div>}
            <div className="admin-member-header">
              <span>Name</span>
              <span>Email</span>
              <span>Plan</span>
              <span>Status</span>
              <span>Since</span>
            </div>
            {members.map(m => (
              <div key={m.id} className="admin-member-row">
                <span>{m.full_name}</span>
                <span>{m.email}</span>
                <span>{m.plan_id ? `Renu ${m.plan_id}` : '—'}</span>
                <span className={`admin-status ${m.status}`}>{m.status}</span>
                <span>{m.member_since}</span>
              </div>
            ))}
          </>
        )}

        {/* ── WORKOUTS TAB ── */}
        {tab === 'workouts' && (
          <>
            {workouts.length === 0 && <div className="admin-empty">No workouts yet. Add your first one!</div>}
            <div style={{ marginBottom: 12, fontSize: 12, color: '#8A6E58' }}>
              Manage daily workouts and add video URLs for each exercise. Members see videos in the app.
            </div>
            {workouts.map(w => (
              <div key={w.id} className="admin-class-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="admin-class-time">{w.date}</div>
                  <div className="admin-class-info">
                    <div className="admin-class-name">{w.type}</div>
                    <div className="admin-class-meta">{w.subtitle} · {w.difficulty}</div>
                  </div>
                </div>
                {w.workout_exercises?.map((ex, i) => (
                  <div key={ex.id || i} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 12, fontSize: 12, borderTop: '1px solid #EDE3D8', paddingTop: 8 }}>
                    <span>{ex.icon}</span>
                    <span style={{ flex: 1 }}><strong>{ex.name}</strong> — {ex.description}</span>
                    <span style={{ fontSize: 10, color: ex.video_url ? '#5A8A6A' : '#B8A090' }}>
                      {ex.video_url ? '✓ Video' : 'No video'}
                    </span>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: '#8A6E58', paddingTop: 4 }}>
                  To add video URLs, edit exercises directly in Supabase → workout_exercises table → video_url column. Paste YouTube or direct video links.
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── PLANS TAB ── */}
        {tab === 'plans' && (
          <>
            {plans.length === 0 && <div className="admin-empty">No plans found. Check the plans table in Supabase.</div>}
            <div style={{ marginBottom: 12, fontSize: 12, color: '#8A6E58' }}>
              Edit membership plans. Changes show up instantly in the app.
            </div>
            {plans.map(p => (
              <div key={p.id} className="admin-class-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 10, color: '#8A6E58', textTransform: 'uppercase', letterSpacing: 1, minWidth: 80 }}>{p.eyebrow}</div>
                  <div className="admin-class-info">
                    <div className="admin-class-name">{p.name}</div>
                    <div className="admin-class-meta">{p.price}{p.per} — {p.description}</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#8A6E58', paddingLeft: 12 }}>
                  Features: {p.features?.join(' · ')}
                </div>
                <div style={{ fontSize: 11, color: '#8A6E58', paddingTop: 4 }}>
                  To edit, go to Supabase → plans table → click the row → update any field.
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
