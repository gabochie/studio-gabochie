import { callAI } from '../agents/_ai.js';

var PROGRAM_MAP = {
  'music':          { slug: 'guitar-method', title: 'Gideon Guitar Method' },
  'guitar':         { slug: 'guitar-method', title: 'Gideon Guitar Method' },
  'business':       { slug: 'systems-thinking', title: 'Systems Thinking Program' },
  'entrepreneurship': { slug: 'systems-thinking', title: 'Systems Thinking Program' },
  'finance':        { slug: 'systems-thinking', title: 'Systems Thinking Program' },
  'faith':          { slug: 'systems-thinking-genesis', title: 'The Spirit of God in Genesis' },
  'spirituality':   { slug: 'systems-thinking-genesis', title: 'The Spirit of God in Genesis' },
  'tech':           { slug: 'intro-computing', title: 'Introduction to Computing' },
  'digital':        { slug: 'intro-computing', title: 'Introduction to Computing' },
  'content':        { slug: 'intro-storytelling', title: 'Introduction to Storytelling & Narrative Design' },
  'creative':       { slug: 'guitar-method', title: 'Gideon Guitar Method' },
  'arts':           { slug: 'guitar-method', title: 'Gideon Guitar Method' }
};

var SYSTEM_PROMPT = [
  'You are a friendly learning advisor for GideonAbochie Studio, a Bible-based school in Ghana.',
  'Your task: given a student\'s interests, recommend ONE program from this list that best fits them.',
  '',
  'Available programs:',
  '- Gideon Guitar Method (guitar-method): Play guitar, Ghanaian songs. Best for music lovers, creative arts.',
  '- Systems Thinking Program (systems-thinking): Biblical wisdom for seeing the whole. Best for business, strategy, personal growth.',
  '- The Spirit of God in Genesis (systems-thinking-genesis): Bible study through creativity, wisdom & love. Best for faith, Bible study.',
  '- The Spirit of God in Revelation (revelation-study): Study of Revelation. Best for Bible study, prophecy.',
  '- The Spirit of God in the Psalms (psalms-worship-word): Study of Psalms. Best for worship, prayer.',
  '- Introduction to Computing (intro-computing): Coming soon. How computers work. Best for tech beginners.',
  '- Introduction to Storytelling (intro-storytelling): Coming soon. Narrative design. Best for content creators.',
  '- Introduction to Design Thinking (intro-design-thinking): Coming soon. Design methodology from Genesis.',
  '- Architectural Thinking (architectural-thinking): Coming soon. Structuring ideas with biblical wisdom.',
  '',
  'If the student\'s interest matches a "coming soon" program, still recommend it but note it\'s in development and suggest an active alternative.',
  '',
  'Respond in JSON format only (no markdown):',
  '{',
  '  "program_slug": "guitar-method",',
  '  "program_title": "Gideon Guitar Method",',
  '  "recommendation": "A short, friendly 2-3 sentence explanation of why this program fits them.",',
  '  "why_fits": "1-2 sentences about how their specific interests connect to this program"',
  '}'
].join('\n');

function findProgramByTopic(topic) {
  var lower = (topic || '').toLowerCase();
  for (var key in PROGRAM_MAP) {
    if (lower.indexOf(key) !== -1) return PROGRAM_MAP[key];
  }
  return { slug: 'systems-thinking', title: 'Systems Thinking Program' };
}

export async function onRequest(context) {
  var { request, env } = context;
  var db = env.DB;
  var cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }

  try {
    var body = await request.json();
    var name = (body.name || '').trim();
    var phone = (body.phone || '').trim();
    var topic = (body.topic || '').trim();
    var learningStyle = (body.learning_style || '').trim();
    var timeCommitment = (body.time_commitment || '').trim();
    var source = (body.source || 'web').trim();
    var sourceUrl = (body.source_url || '').trim();

    if (!name || !phone) {
      return new Response(JSON.stringify({ status: 'error', message: 'Name and phone are required' }), {
        status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }

    var program = findProgramByTopic(topic);
    var recommendation = '';
    var aiResult = null;

    if (env.OPENAI_API_KEY || env.AI_API_KEY || env.OPENROUTER_API_KEY) {
      var userPrompt = [
        'Student profile:',
        '- Name: ' + name,
        '- Topic interest: ' + topic,
        '- Learning style: ' + learningStyle,
        '- Time commitment: ' + timeCommitment,
        '',
        'Recommend the best program for this student and explain why.'
      ].join('\n');

      aiResult = await callAI(env, SYSTEM_PROMPT, userPrompt, {
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 500
      });

      if (aiResult && aiResult.content && !aiResult.error) {
        try {
          var parsed = JSON.parse(aiResult.content);
          if (parsed.program_slug) {
            program = { slug: parsed.program_slug, title: parsed.program_title || program.title };
            recommendation = parsed.recommendation || '';
          }
        } catch (_) {
          recommendation = aiResult.content;
        }
      }
    }

    if (!recommendation) {
      var reasons = {
        'guitar-method': 'Perfect for creative souls who want to express themselves through music — you will learn Ghanaian songs from day one.',
        'systems-thinking': 'Ideal for those who want to understand how the world works and make smarter decisions in business and life.',
        'systems-thinking-genesis': 'A deep dive into Scripture that will transform how you see God, creativity, and your purpose.',
        'revelation-study': 'For those ready to understand the big picture of God\'s plan and find hope in His promises.',
        'psalms-worship-word': 'For those who want to deepen their prayer life and learn to worship through every season.',
        'intro-computing': 'A beginner-friendly journey into how computers work — starting with the Logos who ordered all things.',
        'intro-storytelling': 'Learn to craft stories that move hearts and change minds, following the example of the greatest storyteller.'
      };
      recommendation = reasons[program.slug] || 'Based on your interests, this program will help you grow and discover your potential.';
    }

    var responseData = {
      status: 'ok',
      program_slug: program.slug,
      program_title: program.title,
      recommendation: recommendation
    };

    try {
      await db.prepare(
        'INSERT INTO survey_responses (name, phone, topic, learning_style, time_commitment, source, source_url, recommendation, recommended_program) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(name, phone, topic, learningStyle, timeCommitment, source, sourceUrl, recommendation, program.slug).run();
    } catch (_) {}

    return new Response(JSON.stringify(responseData), {
      headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });

  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
}
