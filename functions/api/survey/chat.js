import { callAI } from '../agents/_ai.js';

var PROGRAM_MAP = {
  'civic education': { slug: 'systems-thinking', title: 'Systems Thinking Program' },
  'governance':      { slug: 'systems-thinking', title: 'Systems Thinking Program' },
  'entrepreneurship': { slug: 'systems-thinking', title: 'Systems Thinking Program' },
  'jobs':            { slug: 'systems-thinking', title: 'Systems Thinking Program' },
  'arts':            { slug: 'guitar-method', title: 'Gideon Guitar Method' },
  'culture':         { slug: 'guitar-method', title: 'Gideon Guitar Method' },
  'identity':        { slug: 'guitar-method', title: 'Gideon Guitar Method' },
  'tech':            { slug: 'intro-computing', title: 'Introduction to Computing' },
  'digital':         { slug: 'intro-computing', title: 'Introduction to Computing' },
  'faith':           { slug: 'systems-thinking-genesis', title: 'The Spirit of God in Genesis' },
  'community leadership': { slug: 'systems-thinking-genesis', title: 'The Spirit of God in Genesis' },
  'finance':         { slug: 'systems-thinking', title: 'Systems Thinking Program' },
  'wealth':          { slug: 'systems-thinking', title: 'Systems Thinking Program' },
  'critical thinking': { slug: 'systems-thinking', title: 'Systems Thinking Program' },
  'strategic thinking': { slug: 'systems-thinking', title: 'Systems Thinking Program' },
  'leadership':      { slug: 'systems-thinking', title: 'Systems Thinking Program' },
  'public speaking': { slug: 'systems-thinking', title: 'Systems Thinking Program' },
  'computing':       { slug: 'intro-computing', title: 'Introduction to Computing' },
  'creative':        { slug: 'guitar-method', title: 'Gideon Guitar Method' },
  'music':           { slug: 'guitar-method', title: 'Gideon Guitar Method' },
  'biblical wisdom': { slug: 'systems-thinking-genesis', title: 'The Spirit of God in Genesis' },
  'business':        { slug: 'systems-thinking', title: 'Systems Thinking Program' }
};

var SYSTEM_PROMPT = [
  'You are a youth development advisor for GideonAbochie Studio, a Ghanaian school aligned with the National Youth Policy (2022-2032).',
  'Your mission: help young Ghanaians (ages 15-35) find the right program that matches their interests and national development goals.',
  '',
  'The National Youth Policy vision: "An empowered youth contributing positively to national development."',
  'The policy focuses on: skills development, job creation, civic participation, leadership, and national identity.',
  '',
  'Available programs at GideonAbochie Studio:',
  '- Gideon Guitar Method (guitar-method): Play guitar, learn Ghanaian songs. Best for creative arts, music, cultural identity.',
  '- Systems Thinking Program (systems-thinking): Biblical wisdom for seeing the whole picture. Best for business, strategy, governance, leadership, civic education.',
  '- The Spirit of God in Genesis (systems-thinking-genesis): Deep Bible study through creativity, wisdom & love. Best for faith, community leadership, biblical wisdom.',
  '- The Spirit of God in Revelation (revelation-study): Study of Revelation. Best for Bible study, prophecy, hope.',
  '- The Spirit of God in the Psalms (psalms-worship-word): Study of Psalms. Best for worship, prayer, artistic expression.',
  '- Introduction to Computing (intro-computing): Coming soon. How computers work. Best for tech skills, digital literacy.',
  '- Introduction to Storytelling (intro-storytelling): Coming soon. Narrative design. Best for content creators, media.',
  '- Introduction to Design Thinking (intro-design-thinking): Coming soon. Design methodology. Best for innovation, problem-solving.',
  '- Architectural Thinking (architectural-thinking): Coming soon. Structuring ideas with wisdom. Best for strategic planning.',
  '',
  'If the student\'s interest matches a "coming soon" program, recommend it but note it is in development and suggest an active alternative.',
  'Always connect your recommendation to national development and the student\'s potential to contribute to Ghana\'s future.',
  '',
  'Respond in JSON format only (no markdown):',
  '{',
  '  "program_slug": "systems-thinking",',
  '  "program_title": "Systems Thinking Program",',
  '  "recommendation": "2-3 sentences explaining why this program fits the student. Connect it to their personal growth AND Ghana\'s development. Be warm and encouraging."',
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
        '- National development interest: ' + topic,
        '- Desired skill: ' + learningStyle,
        '- Time commitment: ' + timeCommitment,
        '',
        'Recommend ONE program from GideonAbochie Studio that best fits this young Ghanaian.',
        'Explain why it helps both their personal growth and Ghana\'s national development.'
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
        'guitar-method': 'Ghana\'s creative arts and cultural identity are central to our national story. This program lets you express yourself through music while learning Ghanaian songs — building the creative economy one artist at a time.',
        'systems-thinking': 'Ghana needs young people who can see the big picture — in business, governance, and community development. This program teaches you to think strategically and solve problems that matter.',
        'systems-thinking-genesis': 'Faith and values are the foundation of every great nation. This program deepens your biblical understanding so you can lead with wisdom and serve your community with love.',
        'revelation-study': 'In uncertain times, young people need hope and a clear vision for the future. This program builds unshakeable faith and a long-term perspective essential for nationbuilding.',
        'psalms-worship-word': 'Worship and the arts have always been central to Ghanaian identity. This program deepens your spiritual life and equips you to lead others in worship and community building.',
        'intro-computing': 'Digital skills are the language of the 21st century economy. This program gives you a strong foundation in how technology works — opening doors in Ghana\'s growing tech sector.',
        'intro-storytelling': 'Ghana\'s stories need to be told by Ghanaians. This program teaches you to craft narratives that preserve our heritage, inspire change, and shape the national conversation.'
      };
      recommendation = reasons[program.slug] || 'Based on your interests, this program will help you grow and contribute to Ghana\'s development.';
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
