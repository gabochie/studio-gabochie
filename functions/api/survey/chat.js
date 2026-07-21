import { callAI } from '../agents/_ai.js';

var PROGRAM_MAP = {
  'civic education': { slug: 'civic-intelligence', title: 'Civic Intelligence Certificate' },
  'governance':      { slug: 'civic-intelligence', title: 'Civic Intelligence Certificate' },
  'citizenship':     { slug: 'civic-intelligence', title: 'Civic Intelligence Certificate' },
  'civic tech':      { slug: 'civic-intelligence', title: 'Civic Intelligence Certificate' },
  'national development': { slug: 'civic-intelligence', title: 'Civic Intelligence Certificate' },
  'constitution':    { slug: 'civic-intelligence', title: 'Civic Intelligence Certificate' },
  'data sovereignty': { slug: 'civic-intelligence', title: 'Civic Intelligence Certificate' },
  'participatory':   { slug: 'civic-intelligence', title: 'Civic Intelligence Certificate' },
  'artificial intelligence': { slug: 'ai-fundamentals', title: 'AI Fundamentals for Ghanaians' },
  'machine learning': { slug: 'ai-fundamentals', title: 'AI Fundamentals for Ghanaians' },
  'values':          { slug: 'essential-values', title: 'Essential Values for National Development' },
  'ethics':          { slug: 'essential-values', title: 'Essential Values for National Development' },
  'entrepreneurship': { slug: 'digital-entrepreneurship', title: 'Digital Entrepreneurship &amp; the Creative Economy' },
  'jobs':            { slug: 'digital-entrepreneurship', title: 'Digital Entrepreneurship &amp; the Creative Economy' },
  'creative economy': { slug: 'digital-entrepreneurship', title: 'Digital Entrepreneurship &amp; the Creative Economy' },
  'leadership':      { slug: 'youth-leadership', title: 'Youth Leadership &amp; Community Organizing' },
  'community organizing': { slug: 'youth-leadership', title: 'Youth Leadership &amp; Community Organizing' },
  'arts':            { slug: 'guitar-method', title: 'Gideon Guitar Method' },
  'culture':         { slug: 'guitar-method', title: 'Gideon Guitar Method' },
  'identity':        { slug: 'guitar-method', title: 'Gideon Guitar Method' },
  'tech':            { slug: 'intro-computing', title: 'Introduction to Computing' },
  'digital':         { slug: 'intro-computing', title: 'Introduction to Computing' },
  'faith':           { slug: 'systems-thinking-genesis', title: 'The Spirit of God in Genesis' },
  'community leadership': { slug: 'systems-thinking-genesis', title: 'The Spirit of God in Genesis' },
  'finance':         { slug: 'systems-thinking', title: 'Systems Thinking for Vision Builders' },
  'wealth':          { slug: 'systems-thinking', title: 'Systems Thinking for Vision Builders' },
  'critical thinking': { slug: 'systems-thinking', title: 'Systems Thinking for Vision Builders' },
  'strategic thinking': { slug: 'systems-thinking', title: 'Systems Thinking for Vision Builders' },
  'public speaking': { slug: 'systems-thinking', title: 'Systems Thinking for Vision Builders' },
  'computing':       { slug: 'intro-computing', title: 'Introduction to Computing' },
  'creative':        { slug: 'guitar-method', title: 'Gideon Guitar Method' },
  'music':           { slug: 'guitar-method', title: 'Gideon Guitar Method' },
  'biblical wisdom': { slug: 'systems-thinking-genesis', title: 'The Spirit of God in Genesis' },
  'business':        { slug: 'systems-thinking', title: 'Systems Thinking for Vision Builders' },
  'design thinking': { slug: 'intro-design-thinking', title: 'Design Thinking for Vision Builders' },
  'innovation':      { slug: 'intro-design-thinking', title: 'Design Thinking for Vision Builders' },
  'architecture':    { slug: 'architectural-thinking', title: 'Architectural Thinking for Vision Builders' },
  'strategic planning': { slug: 'architectural-thinking', title: 'Architectural Thinking for Vision Builders' },
  'sketching':       { slug: 'sketching-vision-builders', title: 'Sketching &amp; Drawing for Vision Builders' },
  'drawing':         { slug: 'sketching-vision-builders', title: 'Sketching &amp; Drawing for Vision Builders' },
  'visual thinking': { slug: 'sketching-vision-builders', title: 'Sketching &amp; Drawing for Vision Builders' },
  'vision board':    { slug: 'sketching-vision-builders', title: 'Sketching &amp; Drawing for Vision Builders' },
  'pattern recognition': { slug: 'pattern-recognition-vision-builders', title: 'Pattern Recognition for Vision Builders' },
  'patterns':       { slug: 'pattern-recognition-vision-builders', title: 'Pattern Recognition for Vision Builders' },
  'data analysis':  { slug: 'pattern-recognition-vision-builders', title: 'Pattern Recognition for Vision Builders' },
  'trends':         { slug: 'pattern-recognition-vision-builders', title: 'Pattern Recognition for Vision Builders' }
};

var SYSTEM_PROMPT = [
  'You are a youth development advisor for Studio by Gabochie, a Ghanaian school aligned with the National Youth Policy (2022-2032).',
  'Your mission: help young Ghanaians (ages 15-35) find the right program that matches their interests and national development goals.',
  '',
  'The National Youth Policy vision: "An empowered youth contributing positively to national development."',
  'The policy focuses on: skills development, job creation, civic participation, leadership, and national identity.',
  '',
  'Available programs at Studio by Gabochie:',
  '- Gideon Guitar Method (guitar-method): Play guitar, learn Ghanaian songs. Best for creative arts, music, cultural identity.',
  '- Systems Thinking for Vision Builders (systems-thinking): Biblical wisdom for seeing the whole picture. Best for business, strategy, governance, leadership, civic education.',
  '- The Spirit of God in Genesis (systems-thinking-genesis): Deep Bible study through creativity, wisdom & love. Best for faith, community leadership, biblical wisdom.',
  '- The Spirit of God in Revelation (revelation-study): Study of Revelation. Best for Bible study, prophecy, hope.',
  '- The Spirit of God in the Psalms (psalms-worship-word): Study of Psalms. Best for worship, prayer, artistic expression.',
  '- Introduction to Computing (intro-computing): Coming soon. How computers work. Best for tech skills, digital literacy.',
  '- Introduction to Storytelling (intro-storytelling): Coming soon. Narrative design. Best for content creators, media.',
  '- Design Thinking for Vision Builders (intro-design-thinking): Human-centered innovation rooted in the ultimate Designer. Best for innovation, problem-solving, product design.',
  '- Architectural Thinking for Vision Builders (architectural-thinking): Build anything that matters with clarity, purpose, and biblical wisdom. Best for strategic planning, project design, leadership.',
  '- Civic Intelligence Certificate (civic-intelligence): Learn how Ghana\'s democracy works, build civic tech, and lead community action projects. Best for civic education, governance, citizenship, national development.',
  '- AI Fundamentals for Ghanaians (ai-fundamentals): Understand AI, apply it to Ghanaian sectors, and build ethically. Best for technology, AI, digital skills, machine learning.',
  '- Essential Values for National Development (essential-values): Character formation for engaged citizenship and nation building. Best for values, ethics, personal development, discipline.',
  '- Digital Entrepreneurship & the Creative Economy (digital-entrepreneurship): Build digital products and creative businesses for Ghanaian and global markets. Best for entrepreneurship, business, creative arts, jobs.',
  '- Youth Leadership & Community Organizing (youth-leadership): Lead community change through civic clubs, projects, and advocacy. Best for leadership, community organizing, advocacy, youth development.',
  '- Pattern Recognition for Vision Builders (pattern-recognition-vision-builders): See patterns in nature, data, Scripture, and human behavior to make better decisions. Best for data analysis, strategic thinking, forecasting, research.',
  '- Sketching & Drawing for Vision Builders (sketching-vision-builders): Visual thinking and drawing skills for communicating ideas. Best for creative arts, design thinking, visual communication, vision boarding.',
  '',
  'If the student\'s interest matches a "coming soon" program, recommend it but note it is in development and suggest an active alternative.',
  'Always connect your recommendation to national development and the student\'s potential to contribute to Ghana\'s future.',
  '',
  'Respond in JSON format only (no markdown):',
  '{',
  '  "program_slug": "systems-thinking",',
  '  "program_title": "Systems Thinking for Vision Builders",',
  '  "recommendation": "2-3 sentences explaining why this program fits the student. Connect it to their personal growth AND Ghana\'s development. Be warm and encouraging."',
  '}'
].join('\n');

function findProgramByTopic(topic) {
  var lower = (topic || '').toLowerCase();
  for (var key in PROGRAM_MAP) {
    if (lower.indexOf(key) !== -1) return PROGRAM_MAP[key];
  }
  return { slug: 'systems-thinking', title: 'Systems Thinking for Vision Builders' };
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
        'Recommend ONE program from Studio by Gabochie that best fits this young Ghanaian.',
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
        'intro-storytelling': 'Ghana\'s stories need to be told by Ghanaians. This program teaches you to craft narratives that preserve our heritage, inspire change, and shape the national conversation.',
        'civic-intelligence': 'Ghana\'s future depends on citizens who understand their rights, use technology for accountability, and take action in their communities. This program gives you practical tools — from reading the Constitution to building civic tech — to become an engaged citizen who contributes to national development.',
        'ai-fundamentals': 'Ghana\'s AI Strategy envisions an AI-powered society by 2035. This program gives you the foundational knowledge to understand, apply, and shape AI for Ghana\'s unique needs — in agriculture, health, education, and governance.',
        'essential-values': 'Character is the foundation of every great nation. This program, based on the Essential Values for Ghanaian Youth Handbook, teaches the values that build strong citizens — integrity, honesty, discipline, and a heart for the common good.',
        'digital-entrepreneurship': 'Ghana\'s digital and creative economy is booming. This program teaches you practical skills to build a business, create digital products, and thrive in the 21st century economy — on your own terms.',
        'youth-leadership': 'Ghana has the youngest population in the world — and the greatest potential. This program equips you with the skills to organize your community, lead change, and make a real difference in your district and beyond.',
        'sketching-vision-builders': 'Visual communication is a superpower for any visionary. This program teaches you to sketch and draw so you can bring your ideas to life — whether you\'re designing a product, planning a community space, or telling Ghana\'s story through art.',
        'pattern-recognition-vision-builders': 'Every great leader sees what others miss. This program trains you to recognize patterns in nature, data, and human behavior — so you can make better decisions and anticipate what\'s coming next.'
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
