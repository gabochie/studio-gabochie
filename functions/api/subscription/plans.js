export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }
  const plans = [
    {
      id: 'monthly',
      name: 'Monthly Supporter',
      amount: 50,
      currency: 'GHS',
      interval: 'monthly',
      plan_id: env.FLW_PLAN_SUPPORTER || '160302',
      per: '/mo',
      description: 'Early access to content, supporter badge on the site, and a monthly teaching video from Gideon.',
      features: [
        'Early access to all new content',
        'Supporter badge on your profile',
        'Monthly teaching video',
        'Ad-free newsletter experience',
        'Direct email access to Gideon'
      ],
      popular: false
    },
    {
      id: 'annual',
      name: 'Annual Patron',
      amount: 500,
      currency: 'GHS',
      interval: 'yearly',
      plan_id: env.FLW_PLAN_PATRON || '160303',
      per: '/yr',
      description: 'All Monthly Supporter benefits plus every book in PDF, exclusive Q&A sessions, and the ad-free newsletter.',
      features: [
        'All Monthly Supporter benefits',
        'All books in PDF format',
        'Exclusive monthly Q&A sessions',
        'Ad-free newsletter',
        'Name listed in supporter roll',
        'Early access to new books'
      ],
      popular: true
    },
    {
      id: 'founding',
      name: 'Founding Partner',
      amount: 2500,
      currency: 'GHS',
      interval: 'yearly',
      plan_id: env.FLW_PLAN_FOUNDING || '160304',
      per: '/yr',
      description: 'Everything in Annual Patron plus your name featured on the site and a quarterly video call with Gideon.',
      features: [
        'All Annual Patron benefits',
        'Name featured on the website',
        'Quarterly 1-on-1 video call',
        'Early access to all projects',
        'Co-branded content opportunities',
        'Private Founding Partner community'
      ],
      popular: false
    }
  ];
  return new Response(JSON.stringify({ status: 'ok', plans, currency: 'GHS', public_key: 'FLWPUBK-6b8e97034170a30c3e07c20e4eab58af-X' }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
