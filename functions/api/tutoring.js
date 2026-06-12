import { checkRateLimit } from './_rate-limit.js';

var CATEGORIES = ['academic', 'creative', 'bible', 'professional'];
var CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

export async function onRequest(context) {
  var { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json', ...CORS } });

  var url = new URL(request.url);

  // GET — list approved tutors
  if (request.method === 'GET') {
    var subject = url.searchParams.get('subject') || '';
    var search = url.searchParams.get('search') || '';
    var limit = parseInt(url.searchParams.get('limit')) || 50;

    var conds = ["status = 'approved'"];
    var params = [];
    if (subject) { conds.push("subjects LIKE ?"); params.push('%' + subject + '%'); }
    if (search) { conds.push("(name LIKE ? OR bio LIKE ? OR subjects LIKE ?)"); var s = '%' + search + '%'; params.push(s, s, s); }

    try {
      var result = await env.DB.prepare("SELECT id, name, slug, bio, subjects, qualifications, hourly_rate, currency, availability, email, phone, photo_url, video_url, featured, created_at FROM tutors WHERE " + conds.join(' AND ') + " ORDER BY featured DESC, created_at DESC LIMIT ?").bind(...params, limit).all();
      var subjectsList = await env.DB.prepare("SELECT * FROM tutoring_subjects ORDER BY category, name").all();
      return new Response(JSON.stringify({ status: 'ok', tutors: result.results || [], subjects: subjectsList.results || [] }), { headers: { 'Content-Type': 'application/json', ...CORS } });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
    }
  }

  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...CORS } });

  var ip = request.headers.get('CF-Connecting-IP') || '';
  if (!await checkRateLimit(env.DB, ip, 'tutor', 5, 300)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Try again later.' }), { status: 429, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  // Determine action
  var action = url.searchParams.get('action') || 'apply';

  try {
    var body = await request.json();

    // Tutor application
    if (action === 'apply') {
      var name = (body.name || '').trim();
      var email = (body.email || '').trim();
      var phone = (body.phone || '').trim();
      var bio = (body.bio || '').trim();
      var subjects = body.subjects || [];
      var qualifications = (body.qualifications || '').trim();
      var hourly_rate = parseFloat(body.hourly_rate) || 0;
      var availability = (body.availability || '').trim();
      var photo_url = (body.photo_url || '').trim();
      var video_url = (body.video_url || '').trim();

      if (!name || !email || !subjects.length) {
        return new Response(JSON.stringify({ error: 'name, email, and subjects required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
      }

      var slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
      await env.DB.prepare("INSERT INTO tutors (name, slug, bio, subjects, qualifications, hourly_rate, currency, availability, email, phone, photo_url, video_url, status) VALUES (?, ?, ?, ?, ?, ?, 'GHS', ?, ?, ?, ?, ?, 'pending')").bind(name, slug, bio, JSON.stringify(subjects), qualifications, hourly_rate, availability, email, phone, photo_url, video_url).run();

      return new Response(JSON.stringify({ status: 'ok', message: 'Application submitted for review. We will contact you once approved.' }), { status: 201, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    // Booking request
    if (action === 'book') {
      var tutor_id = parseInt(body.tutor_id) || 0;
      var student_name = (body.student_name || '').trim();
      var student_email = (body.student_email || '').trim();
      var student_phone = (body.student_phone || '').trim();
      var subject = (body.subject || '').trim();
      var preferred_date = (body.preferred_date || '').trim();
      var preferred_time = (body.preferred_time || '').trim();
      var message = (body.message || '').trim();

      if (!tutor_id || !student_name || !student_email) {
        return new Response(JSON.stringify({ error: 'tutor_id, student_name, and student_email required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
      }

      await env.DB.prepare("INSERT INTO tutoring_bookings (tutor_id, student_name, student_email, student_phone, subject, preferred_date, preferred_time, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(tutor_id, student_name, student_email, student_phone, subject, preferred_date, preferred_time, message).run();

      return new Response(JSON.stringify({ status: 'ok', message: 'Booking request submitted. The tutor will contact you to confirm.' }), { status: 201, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
}